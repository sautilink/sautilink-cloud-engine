/** Process Telegram updates with usage protection (isolate-local). */

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
  formatAuditSummaryView,
  formatAuditPrioritiesView,
  formatEngineError,
  formatTimeout,
  formatAbout,
  formatHelp,
  formatStatus,
  auditKeyboard,
  auditDetailKeyboard,
} from "./format.js";
import {
  mainMenuKeyboard,
  websiteMenuKeyboard,
  infrastructureMenuKeyboard,
  backToMainKeyboard,
  statusKeyboard,
  helpMenuKeyboard,
  toolPromptKeyboard,
  guidedAuditKeyboard,
  mainMenuText,
  websiteMenuText,
  infrastructureMenuText,
  toolPrompt,
} from "./menu.js";
import { isDuplicateUpdate } from "./dedup.js";
import { checkCooldown, tryBeginAudit, endAudit } from "./cooldown.js";
import { newCorrelationId, logTelegram } from "./log.js";
import { authorizeUser, isAdmin } from "./authz.js";
import {
  checkUsage,
  formatUsageLimitMessage,
} from "./usage.js";
import {
  setPendingAudit,
  takePending,
  clearPending,
  parseGuidedAuditTarget,
  guidedAuditPromptText,
} from "./guided.js";

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

  const env = config.env || {};
  const auth = authorizeUser({ from, chat, env });
  if (!auth.allowed) {
    await sendMessage(
      config.token,
      chat.id,
      "This command is not available for your account."
    );
    return { handled: true, reason: "denied" };
  }

  const adminUser =
    auth.role === "admin" || isAdmin(from && from.id, env);

  // Commands take priority; clear guided pending so /help etc. work mid-flow.
  const parsed = parseCommand(message.text);
  if (parsed) {
    clearPending(chat.id);

    if (
      !KNOWN_COMMANDS.has(parsed.rawCommand) &&
      !KNOWN_COMMANDS.has(parsed.command)
    ) {
      await sendMessage(config.token, chat.id, "Unknown command. Try /help.");
      return { handled: true, command: parsed.command };
    }

    return runCommandPath({
      parsed,
      chat,
      from,
      config,
      env,
      adminUser,
      correlationId,
      updateId,
      started,
    });
  }

  // Guided free-text target (no command prefix)
  const pending = takePending(chat.id);
  if (pending === "audit") {
    return runGuidedAudit({
      text: message.text,
      chat,
      from,
      config,
      env,
      adminUser,
      correlationId,
      updateId,
      started,
    });
  }

  return { handled: false, reason: "not_command" };
}

async function runGuidedAudit(ctx) {
  const { text, chat, config, env, adminUser, correlationId, updateId, started } =
    ctx;

  const target = parseGuidedAuditTarget(text);
  if (!target.ok) {
    // Keep waiting for a valid address
    setPendingAudit(chat.id);
    await sendMessage(config.token, chat.id, `⚠️ ${target.message}`, {
      reply_markup: guidedAuditKeyboard(),
    });
    return { handled: true, reason: "guided_invalid" };
  }

  const usage = checkUsage({
    chatId: chat.id,
    userId: ctx.from && ctx.from.id,
    commandOrAction: "audit",
    isAdminUser: adminUser,
    env,
  });
  if (!usage.allowed) {
    await sendMessage(config.token, chat.id, formatUsageLimitMessage());
    return { handled: true, command: "audit", reason: "usage_limited" };
  }

  const cool = checkCooldown(chat.id, "audit", { isAdminUser: adminUser });
  if (cool.blocked) {
    await sendMessage(
      config.token,
      chat.id,
      "🚦 Temporarily rate-limited. Please try again shortly."
    );
    return { handled: true, command: "audit", reason: "cooldown" };
  }

  if (!tryBeginAudit(chat.id)) {
    await sendMessage(
      config.token,
      chat.id,
      "⏳ An audit is already running. Please wait for the current result."
    );
    return { handled: true, command: "audit", reason: "inflight" };
  }

  const pendingMsg = await sendMessage(
    config.token,
    chat.id,
    `⏳ Checking ${target.display}…`
  );
  const pendingId =
    pendingMsg.ok && pendingMsg.result && pendingMsg.result.message_id != null
      ? pendingMsg.result.message_id
      : null;

  try {
    const result = await callCloudEngine(
      config.cloudEngineBaseUrl,
      "/api/audit",
      { url: target.url }
    );

    let reply;
    let extra = {};
    if (!result.ok) {
      reply =
        result.error &&
        (result.error.code === "ENGINE_TIMEOUT" ||
          result.error.code === "REQUEST_TIMEOUT")
          ? formatTimeout()
          : formatEngineError(result.error);
    } else {
      reply = formatAudit(result.data || {});
      extra = { reply_markup: auditKeyboard() };
    }

    if (pendingId != null) {
      const ed = await editMessageText(
        config.token,
        chat.id,
        pendingId,
        reply,
        extra
      );
      if (!ed.ok) await sendMessage(config.token, chat.id, reply, extra);
    } else {
      await sendMessage(config.token, chat.id, reply, extra);
    }
  } finally {
    endAudit(chat.id);
  }

  logTelegram({
    event: "telegram_guided_audit",
    correlation_id: correlationId,
    update_id: updateId,
    command: "audit",
    cost_class: "expensive",
    usage_allowed: true,
    chat_id: chat.id,
    status: "ok",
    duration_ms: Date.now() - started,
  });

  return { handled: true, command: "audit", reason: "guided" };
}

async function runCommandPath({
  parsed,
  chat,
  from,
  config,
  env,
  adminUser,
  correlationId,
  updateId,
  started,
}) {
  const usage = checkUsage({
    chatId: chat.id,
    userId: from && from.id,
    commandOrAction: parsed.command,
    isAdminUser: adminUser,
    env,
  });
  if (!usage.allowed) {
    await sendMessage(config.token, chat.id, formatUsageLimitMessage());
    logTelegram({
      event: "telegram_usage_limited",
      correlation_id: correlationId,
      update_id: updateId,
      command: parsed.command,
      cost_class: usage.cost,
      usage_allowed: false,
      chat_id: chat.id,
      status: "limited",
      duration_ms: Date.now() - started,
    });
    return { handled: true, command: parsed.command, reason: "usage_limited" };
  }

  const cool = checkCooldown(chat.id, parsed.command, {
    isAdminUser: adminUser,
  });
  if (cool.blocked) {
    await sendMessage(
      config.token,
      chat.id,
      "🚦 Temporarily rate-limited. Please try again shortly."
    );
    return { handled: true, command: parsed.command, reason: "cooldown" };
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
    (result.errorCode === "ENGINE_TIMEOUT" ||
      result.errorCode === "REQUEST_TIMEOUT")
  ) {
    text = formatTimeout();
  }

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
    if (!edited.ok) await sendMessage(config.token, chat.id, text, extra);
  } else {
    await sendMessage(config.token, chat.id, text, extra);
  }

  logTelegram({
    event: "telegram_command",
    correlation_id: correlationId,
    update_id: updateId,
    command: parsed.command,
    cost_class: usage.cost,
    usage_allowed: true,
    chat_id: chat.id,
    status: "ok",
    duration_ms: Date.now() - started,
  });

  return { handled: true, command: parsed.command };
}

async function processCallback(cq, config, meta) {
  const cqId = cq && cq.id;
  if (cqId) await answerCallbackQuery(config.token, cqId);

  const env = config.env || {};
  const auth = authorizeUser({
    from: cq.from,
    chat: cq.message && cq.message.chat,
    env,
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

  const adminUser =
    auth.role === "admin" || isAdmin(cq.from && cq.from.id, env);

  // Leaving guided flow on menu navigation
  if (action.startsWith("menu:") || action === "nav:back") {
    clearPending(chatId);
  }

  const usage = checkUsage({
    chatId,
    userId: cq.from && cq.from.id,
    commandOrAction: action,
    isAdminUser: adminUser,
    env,
  });
  if (!usage.allowed) {
    await sendMessage(config.token, chatId, formatUsageLimitMessage());
    return logCb(meta, action, chatId, "limited");
  }

  if (action === "menu:main" || action === "nav:back") {
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      mainMenuText(),
      mainMenuKeyboard()
    );
    return logCb(meta, action, chatId);
  }
  if (action === "menu:website") {
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      websiteMenuText(),
      websiteMenuKeyboard()
    );
    return logCb(meta, action, chatId);
  }
  if (action === "menu:infrastructure") {
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      infrastructureMenuText(),
      infrastructureMenuKeyboard()
    );
    return logCb(meta, action, chatId);
  }
  if (action === "menu:about") {
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      formatAbout(),
      backToMainKeyboard()
    );
    return logCb(meta, action, chatId);
  }
  if (action === "menu:help") {
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      formatHelp(),
      helpMenuKeyboard()
    );
    return logCb(meta, action, chatId);
  }
  if (action === "menu:status" || action === "status:refresh") {
    const result = await callCloudEngine(
      config.cloudEngineBaseUrl,
      "/api/health",
      {}
    );
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      formatStatus(result.ok, result.data),
      statusKeyboard()
    );
    return logCb(meta, action, chatId);
  }

  // Guided audit entry — set pending, ask for address (no URL in callback)
  if (action === "tool:audit") {
    setPendingAudit(chatId);
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      guidedAuditPromptText(),
      guidedAuditKeyboard()
    );
    return logCb(meta, action, chatId);
  }

  if (action.startsWith("tool:")) {
    const tool = action.slice(5);
    const prompt = toolPrompt(tool);
    if (!prompt) return { handled: true, reason: "unknown_tool" };
    clearPending(chatId);
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      prompt.text,
      toolPromptKeyboard(prompt.parent)
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

  async function fetchAudit() {
    return callCloudEngine(config.cloudEngineBaseUrl, "/api/audit", {
      url: target,
    });
  }

  if (action === "audit:rerun" || action === "audit:back") {
    if (action === "audit:rerun") {
      if (!tryBeginAudit(chatId)) {
        if (cqId)
          await answerCallbackQuery(config.token, cqId, "Audit already running");
        return { handled: true, action, reason: "inflight" };
      }
    }
    try {
      if (messageId != null) {
        await editMessageText(
          config.token,
          chatId,
          messageId,
          action === "audit:rerun"
            ? "🔄 Re-running audit…"
            : "⏳ Loading audit…"
        );
      }
      const result = await fetchAudit();
      let text;
      let extra = {};
      if (!result.ok) {
        text =
          result.error &&
          (result.error.code === "ENGINE_TIMEOUT" ||
            result.error.code === "REQUEST_TIMEOUT")
            ? formatTimeout()
            : formatEngineError(result.error);
      } else {
        text = formatAudit(result.data || {});
        extra = { reply_markup: auditKeyboard() };
      }
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
    } finally {
      if (action === "audit:rerun") endAudit(chatId);
    }
    return logCb(meta, action, chatId);
  }

  const result = await fetchAudit();
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

  const data = result.data || {};
  let text;
  if (action === "audit:summary") {
    text = formatAuditSummaryView(data);
  } else if (action === "audit:priorities") {
    text = formatAuditPrioritiesView(data);
  } else {
    const map = {
      "audit:security": "security",
      "audit:seo": "seo",
      "audit:mobile": "mobile",
      "audit:email": "email",
      "audit:https": "https",
    };
    const key = map[action];
    if (!key) return { handled: true, reason: "unknown_audit_action" };
    text = formatAuditCategory(data, key);
  }

  await safeEditOrSend(
    config.token,
    chatId,
    messageId,
    text,
    auditDetailKeyboard()
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

function logCb(meta, action, chatId, status = "ok") {
  logTelegram({
    event: "telegram_callback",
    correlation_id: meta.correlationId,
    update_id: meta.updateId,
    callback_action: action,
    chat_id: chatId,
    status,
    duration_ms: Date.now() - meta.started,
  });
  return { handled: true, action };
}
