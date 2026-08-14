/** Process a single Telegram Update (stateless menus + commands). */

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
  formatTimeout,
  formatAbout,
  formatHelp,
  formatStatus,
  auditKeyboard,
} from "./format.js";
import {
  mainMenuKeyboard,
  websiteMenuKeyboard,
  infrastructureMenuKeyboard,
  backToMainKeyboard,
  statusKeyboard,
  helpMenuKeyboard,
  toolPromptKeyboard,
  mainMenuText,
  websiteMenuText,
  infrastructureMenuText,
  toolPrompt,
} from "./menu.js";
import { isDuplicateUpdate } from "./dedup.js";
import { checkCooldown, tryBeginAudit, endAudit } from "./cooldown.js";
import { newCorrelationId, logTelegram } from "./log.js";
import { authorizeUser } from "./authz.js";

export async function processUpdate(update, config) {
  const started = Date.now();
  const correlationId = newCorrelationId();
  const updateId = update && update.update_id;

  if (!update || typeof update !== "object") {
    return { handled: false, reason: "empty_update" };
  }

  if (isDuplicateUpdate(updateId)) {
    logTelegram({
      event: "telegram_duplicate_skipped",
      correlation_id: correlationId,
      update_id: updateId,
      status: "skipped",
      duration_ms: Date.now() - started,
    });
    return { handled: true, reason: "duplicate_update" };
  }

  if (update.callback_query) {
    return processCallback(update.callback_query, config, {
      correlationId,
      updateId,
      started,
    });
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

  const auth = authorizeUser({ from, chat, env: config.env });
  if (!auth.allowed) {
    await sendMessage(
      config.token,
      chat.id,
      "This command is not available for your account."
    );
    return { handled: true, reason: "denied" };
  }

  const parsed = parseCommand(message.text);
  if (!parsed) return { handled: false, reason: "not_command" };

  if (
    !KNOWN_COMMANDS.has(parsed.rawCommand) &&
    !KNOWN_COMMANDS.has(parsed.command)
  ) {
    await sendMessage(config.token, chat.id, "Unknown command. Try /help.");
    return { handled: true, command: parsed.command };
  }

  const cool = checkCooldown(chat.id, parsed.command);
  if (cool.blocked) {
    await sendMessage(
      config.token,
      chat.id,
      "⏱ You're checking too quickly.\n\nPlease wait a moment and try again."
    );
    return { handled: true, command: parsed.command, reason: "cooldown" };
  }

  const slowCommands = new Set([
    "audit", "email", "website", "mobile", "ssl", "headers",
    "sitemap", "robots", "http", "dns",
  ]);

  let pendingId = null;
  if (slowCommands.has(parsed.command) && parsed.arg) {
    if (parsed.command === "audit" && !tryBeginAudit(chat.id)) {
      await sendMessage(
        config.token,
        chat.id,
        "⏳ An audit is already running. Please wait for the current result."
      );
      return { handled: true, command: "audit", reason: "inflight" };
    }
    const pending = await sendMessage(
      config.token,
      chat.id,
      "⏳ Checking… please wait."
    );
    if (pending.ok && pending.result && pending.result.message_id != null) {
      pendingId = pending.result.message_id;
    }
  }

  let result;
  try {
    result = await handleCommand(
      { command: parsed.command, arg: parsed.arg, chat, from },
      config
    );
  } finally {
    if (parsed.command === "audit") endAudit(chat.id);
  }

  let text = result.text || "No response.";
  if (
    result &&
    result.errorCode &&
    (result.errorCode === "ENGINE_TIMEOUT" || result.errorCode === "REQUEST_TIMEOUT")
  ) {
    text = formatTimeout();
  }

  const extra = {};
  if (result.reply_markup) extra.reply_markup = result.reply_markup;

  if (pendingId != null) {
    const edited = await editMessageText(
      config.token, chat.id, pendingId, text, extra
    );
    if (!edited.ok) await sendMessage(config.token, chat.id, text, extra);
  } else {
    await sendMessage(config.token, chat.id, text, extra);
  }

  logTelegram({
    event: "telegram_command",
    correlation_id: correlationId,
    update_id: updateId,
    command: parsed.command,
    chat_id: chat.id,
    status: "ok",
    duration_ms: Date.now() - started,
  });

  return { handled: true, command: parsed.command };
}

async function processCallback(cq, config, meta) {
  const cqId = cq && cq.id;
  if (cqId) await answerCallbackQuery(config.token, cqId);

  const auth = authorizeUser({
    from: cq.from,
    chat: cq.message && cq.message.chat,
    env: config.env,
  });
  if (!auth.allowed) return { handled: true, reason: "denied" };

  const action = parseCallbackAction(cq && cq.data);
  if (!action) {
    if (cqId) await answerCallbackQuery(config.token, cqId, "Unknown action");
    return { handled: true, reason: "unknown_callback" };
  }

  const msg = cq.message;
  const chatId = msg && msg.chat && msg.chat.id;
  const messageId = msg && msg.message_id;
  if (chatId == null) return { handled: true, reason: "no_chat" };

  if (action === "menu:main" || action === "nav:back") {
    await safeEditOrSend(config.token, chatId, messageId, mainMenuText(), mainMenuKeyboard());
    return logCb(meta, action, chatId);
  }
  if (action === "menu:website") {
    await safeEditOrSend(config.token, chatId, messageId, websiteMenuText(), websiteMenuKeyboard());
    return logCb(meta, action, chatId);
  }
  if (action === "menu:infrastructure") {
    await safeEditOrSend(
      config.token, chatId, messageId, infrastructureMenuText(), infrastructureMenuKeyboard()
    );
    return logCb(meta, action, chatId);
  }
  if (action === "menu:about") {
    await safeEditOrSend(config.token, chatId, messageId, formatAbout(), backToMainKeyboard());
    return logCb(meta, action, chatId);
  }
  if (action === "menu:help") {
    await safeEditOrSend(config.token, chatId, messageId, formatHelp(), helpMenuKeyboard());
    return logCb(meta, action, chatId);
  }
  if (action === "menu:status" || action === "status:refresh") {
    const result = await callCloudEngine(config.cloudEngineBaseUrl, "/api/health", {});
    await safeEditOrSend(
      config.token, chatId, messageId, formatStatus(result.ok, result.data), statusKeyboard()
    );
    return logCb(meta, action, chatId);
  }

  if (action.startsWith("tool:")) {
    const tool = action.slice(5);
    const prompt = toolPrompt(tool);
    if (!prompt) return { handled: true, reason: "unknown_tool" };
    await safeEditOrSend(
      config.token, chatId, messageId, prompt.text, toolPromptKeyboard(prompt.parent)
    );
    return logCb(meta, action, chatId);
  }

  if (!action.startsWith("audit:")) {
    return { handled: true, reason: "unhandled_callback" };
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
    if (!tryBeginAudit(chatId)) {
      if (cqId) await answerCallbackQuery(config.token, cqId, "Audit already running");
      return { handled: true, action, reason: "inflight" };
    }
    try {
      if (messageId != null) {
        await editMessageText(config.token, chatId, messageId, "⏳ Re-running audit…");
      }
      const result = await callCloudEngine(
        config.cloudEngineBaseUrl, "/api/audit", { url: target }
      );
      let text;
      let extra = {};
      if (!result.ok) {
        text =
          result.error &&
          (result.error.code === "ENGINE_TIMEOUT" || result.error.code === "REQUEST_TIMEOUT")
            ? formatTimeout()
            : formatEngineError(result.error);
      } else {
        text = formatAudit(result.data || {});
        extra = { reply_markup: auditKeyboard() };
      }
      if (messageId != null) {
        const ed = await editMessageText(config.token, chatId, messageId, text, extra);
        if (!ed.ok) await sendMessage(config.token, chatId, text, extra);
      } else {
        await sendMessage(config.token, chatId, text, extra);
      }
    } finally {
      endAudit(chatId);
    }
    return logCb(meta, action, chatId);
  }

  const result = await callCloudEngine(config.cloudEngineBaseUrl, "/api/audit", {
    url: target,
  });
  if (!result.ok) {
    await sendMessage(
      config.token,
      chatId,
      result.error && result.error.code === "ENGINE_TIMEOUT"
        ? formatTimeout()
        : formatEngineError(result.error)
    );
    return { handled: true, action };
  }

  const map = {
    "audit:security": "security",
    "audit:seo": "seo",
    "audit:mobile": "mobile",
    "audit:email": "email",
    "audit:https": "https",
  };
  await sendMessage(
    config.token,
    chatId,
    formatAuditCategory(result.data || {}, map[action])
  );
  return logCb(meta, action, chatId);
}

async function safeEditOrSend(token, chatId, messageId, text, reply_markup) {
  const extra = reply_markup ? { reply_markup } : {};
  if (messageId != null) {
    const ed = await editMessageText(token, chatId, messageId, text, extra);
    if (ed.ok) return;
  }
  await sendMessage(token, chatId, text, extra);
}

function logCb(meta, action, chatId) {
  logTelegram({
    event: "telegram_callback",
    correlation_id: meta.correlationId,
    update_id: meta.updateId,
    callback_action: action,
    chat_id: chatId,
    status: "ok",
    duration_ms: Date.now() - meta.started,
  });
  return { handled: true, action };
}
