/**
 * Process a single Telegram Update (stateless).
 */

import { parseCommand, KNOWN_COMMANDS } from "./router.js";
import { handleCommand } from "./commands.js";
import {
  sendMessage,
  editMessageText,
  answerCallbackQuery,
} from "./telegram.js";
import { callCloudEngine } from "./engine.js";
import {
  parseCallbackAction,
  recoverAuditTargetFromMessage,
} from "./normalize.js";
import {
  formatAudit,
  formatAuditCategory,
  formatEngineError,
  auditKeyboard,
} from "./format.js";

/**
 * @param {object} update - Telegram Update
 * @param {{ token: string, cloudEngineBaseUrl: string }}
 */
export async function processUpdate(update, config) {
  if (!update || typeof update !== "object") {
    return { handled: false, reason: "empty_update" };
  }

  if (update.callback_query) {
    return processCallback(update.callback_query, config);
  }

  const message = update.message || update.edited_message;
  if (!message || typeof message.text !== "string") {
    return { handled: false, reason: "unsupported_update" };
  }

  const chat = message.chat;
  const from = message.from;
  if (!chat || chat.id == null) {
    return { handled: false, reason: "no_chat" };
  }

  const parsed = parseCommand(message.text);
  if (!parsed) {
    return { handled: false, reason: "not_command" };
  }

  if (!KNOWN_COMMANDS.has(parsed.command)) {
    await sendMessage(config.token, chat.id, "Unknown command. Try /help.");
    return { handled: true, command: parsed.command };
  }

  const slowCommands = new Set([
    "audit",
    "email",
    "website",
    "mobile",
    "ssl",
    "headers",
    "sitemap",
    "robots",
    "http",
    "dns",
  ]);

  let pendingId = null;
  if (slowCommands.has(parsed.command) && parsed.arg) {
    const pending = await sendMessage(
      config.token,
      chat.id,
      "⏳ Checking… please wait."
    );
    if (pending.ok && pending.result && pending.result.message_id != null) {
      pendingId = pending.result.message_id;
    }
  }

  const result = await handleCommand(
    {
      command: parsed.command,
      arg: parsed.arg,
      chat,
      from,
    },
    config
  );

  const text = result.text || "No response.";
  const extra = {};
  if (result.reply_markup) extra.reply_markup = result.reply_markup;

  if (pendingId != null) {
    const edited = await editMessageText(
      config.token,
      chat.id,
      pendingId,
      text,
      extra
    );
    if (!edited.ok) {
      await sendMessage(config.token, chat.id, text, extra);
    }
  } else {
    await sendMessage(config.token, chat.id, text, extra);
  }

  return { handled: true, command: parsed.command };
}

async function processCallback(cq, config) {
  if (!cq || typeof cq !== "object") {
    return { handled: false, reason: "empty_callback" };
  }

  const cqId = cq.id;
  if (cqId) {
    // Answer promptly so Telegram UI stops spinner
    await answerCallbackQuery(config.token, cqId);
  }

  const action = parseCallbackAction(cq.data);
  if (!action) {
    if (cqId) {
      await answerCallbackQuery(config.token, cqId, "Unknown action");
    }
    return { handled: true, reason: "unknown_callback" };
  }

  const msg = cq.message;
  const chatId = msg && msg.chat && msg.chat.id;
  const messageId = msg && msg.message_id;
  if (chatId == null) {
    return { handled: true, reason: "no_chat" };
  }

  const target = recoverAuditTargetFromMessage(msg && msg.text);
  if (!target) {
    await sendMessage(
      config.token,
      chatId,
      "Could not recover the audited site from this message. Please run /audit <url> again."
    );
    return { handled: true, action };
  }

  if (action === "audit:rerun") {
    if (messageId != null) {
      await editMessageText(
        config.token,
        chatId,
        messageId,
        "⏳ Re-running audit…"
      );
    }
    const result = await callCloudEngine(
      config.cloudEngineBaseUrl,
      "/api/audit",
      { url: target }
    );
    if (!result.ok) {
      const text = formatEngineError(result.error);
      if (messageId != null) {
        await editMessageText(config.token, chatId, messageId, text);
      } else {
        await sendMessage(config.token, chatId, text);
      }
      return { handled: true, action };
    }
    const text = formatAudit(result.data || {});
    const extra = { reply_markup: auditKeyboard() };
    if (messageId != null) {
      const ed = await editMessageText(
        config.token,
        chatId,
        messageId,
        text,
        extra
      );
      if (!ed.ok) await sendMessage(config.token, chatId, text, extra);
    } else {
      await sendMessage(config.token, chatId, text, extra);
    }
    return { handled: true, action };
  }

  // Category detail: one /api/audit, then format category slice
  const result = await callCloudEngine(config.cloudEngineBaseUrl, "/api/audit", {
    url: target,
  });
  if (!result.ok) {
    await sendMessage(config.token, chatId, formatEngineError(result.error));
    return { handled: true, action };
  }

  const map = {
    "audit:security": "security",
    "audit:seo": "seo",
    "audit:mobile": "mobile",
    "audit:email": "email",
    "audit:https": "https",
  };
  const key = map[action];
  const text = formatAuditCategory(result.data || {}, key);
  await sendMessage(config.token, chatId, text);
  return { handled: true, action };
}
