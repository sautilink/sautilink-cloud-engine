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
  normalizeUrlArg,
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
  formatDns,
  formatEmail,
  formatHeaders,
  formatSsl,
  formatWebsite,
  formatMobile,
  formatRobots,
  formatSitemap,
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
  setAwaitTarget,
  setPendingAudit,
  setDiagTarget,
  getDiagTarget,
  refreshDiagTarget,
  peekPending,
  clearPending,
  parseGuidedAuditTarget,
  guidedAuditPromptText,
  diagnosticMenuText,
  diagnosticMenuKeyboard,
  diagnosticResultKeyboard,
  expiredGuidedMessage,
  looksLikeWebsiteAttempt,
  recoverDiagDisplayFromMessage,
  DIAG_ACTIONS,
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

  // Guided: waiting for website address
  const pending = peekPending(chat.id);
  if (pending === "audit") {
    return runGuidedTargetCapture({
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

  if (looksLikeWebsiteAttempt(message.text)) {
    await sendMessage(
      config.token,
      chat.id,
      [
        "To check a website, tap 🔎 Check a Website first, then send the address.",
        "",
        "Or use a command:",
        "/audit example.com",
      ].join("\n"),
      { reply_markup: mainMenuKeyboard() }
    );
    return { handled: true, reason: "guided_hint" };
  }

  return { handled: false, reason: "not_command" };
}

/** Validate target → show diagnostic menu (does not run analyzers yet). */
async function runGuidedTargetCapture(ctx) {
  const { text, chat, config } = ctx;

  const target = parseGuidedAuditTarget(text);
  if (!target.ok) {
    setAwaitTarget(chat.id);
    await sendMessage(config.token, chat.id, target.message, {
      reply_markup: guidedAuditKeyboard(),
    });
    return { handled: true, reason: "guided_invalid" };
  }

  setDiagTarget(chat.id, target.url, target.display);

  await sendMessage(
    config.token,
    chat.id,
    diagnosticMenuText(target.display),
    { reply_markup: diagnosticMenuKeyboard() }
  );

  return { handled: true, reason: "diag_menu" };
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

function resolveDiagTarget(chatId, messageText) {
  let t = getDiagTarget(chatId);
  if (t) return t;

  const display = recoverDiagDisplayFromMessage(messageText);
  if (display) {
    const n = normalizeUrlArg(display);
    if (n.ok) {
      setDiagTarget(chatId, n.url, display);
      return { url: n.url, display };
    }
  }

  const recovered = recoverAuditTargetFromMessage(messageText);
  if (recovered) {
    try {
      const host = new URL(recovered).hostname || recovered;
      setDiagTarget(chatId, recovered, host);
      return { url: recovered, display: host };
    } catch {
      /* fall through */
    }
  }
  return null;
}

function buildQuery(meta, target) {
  if (meta.arg === "domain") {
    return { domain: target.display };
  }
  if (meta.arg === "sitemap") {
    // Prefer standard path when only origin is known
    let sitemapUrl = target.url;
    try {
      const u = new URL(target.url);
      if (!/sitemap/i.test(u.pathname)) {
        u.pathname = "/sitemap.xml";
        u.search = "";
        u.hash = "";
        sitemapUrl = u.toString();
      }
    } catch {
      /* keep */
    }
    return { url: sitemapUrl };
  }
  return { url: target.url };
}

function formatDiagResult(action, data) {
  switch (action) {
    case "diag:security":
      return formatHeaders(data);
    case "diag:seo":
      return formatWebsite(data);
    case "diag:mobile":
      return formatMobile(data);
    case "diag:email":
      return formatEmail(data);
    case "diag:https":
      return formatSsl(data);
    case "diag:dns":
      return formatDns(data);
    case "diag:robots":
      return formatRobots(data);
    case "diag:sitemap":
      return formatSitemap(data);
    case "diag:audit":
      return formatAudit(data);
    default:
      return "Result received.";
  }
}

async function runDiagnosticAction({
  action,
  chatId,
  messageId,
  messageText,
  from,
  config,
  env,
  adminUser,
  meta,
}) {
  const target = resolveDiagTarget(chatId, messageText);
  if (!target) {
    await sendMessage(config.token, chatId, expiredGuidedMessage(), {
      reply_markup: mainMenuKeyboard(),
    });
    return logCb(meta, action, chatId, "expired");
  }

  const toolMeta = DIAG_ACTIONS[action];
  if (!toolMeta) {
    return logCb(meta, action, chatId, "unknown");
  }

  const cool = checkCooldown(chatId, toolMeta.command, {
    isAdminUser: adminUser,
  });
  if (cool.blocked) {
    await sendMessage(
      config.token,
      chatId,
      "🚦 Temporarily rate-limited. Please try again shortly."
    );
    return logCb(meta, action, chatId, "cooldown");
  }

  if (action === "diag:audit" && !tryBeginAudit(chatId)) {
    await sendMessage(
      config.token,
      chatId,
      "⏳ An audit is already running. Please wait for the current result."
    );
    return logCb(meta, action, chatId, "inflight");
  }

  if (messageId != null) {
    await editMessageText(
      config.token,
      chatId,
      messageId,
      `⏳ ${toolMeta.label} · ${target.display}…`
    );
  } else {
    await sendMessage(
      config.token,
      chatId,
      `⏳ ${toolMeta.label} · ${target.display}…`
    );
  }

  try {
    const query = buildQuery(toolMeta, target);
    const result = await callCloudEngine(
      config.cloudEngineBaseUrl,
      toolMeta.path,
      query
    );

    let text;
    let extra = { reply_markup: diagnosticResultKeyboard() };
    if (!result.ok) {
      text =
        result.error &&
        (result.error.code === "ENGINE_TIMEOUT" ||
          result.error.code === "REQUEST_TIMEOUT")
          ? formatTimeout()
          : formatEngineError(result.error);
    } else {
      text = formatDiagResult(action, result.data || {});
      if (action === "diag:audit") {
        extra = { reply_markup: auditKeyboard() };
      }
    }

    refreshDiagTarget(chatId);

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
    if (action === "diag:audit") endAudit(chatId);
  }

  return logCb(meta, action, chatId);
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

  if (action === "tool:audit") {
    setAwaitTarget(chatId);
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      guidedAuditPromptText(),
      guidedAuditKeyboard()
    );
    return logCb(meta, action, chatId);
  }

  // Diagnostic navigation (cheap)
  if (action === "diag:back") {
    clearPending(chatId);
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      mainMenuText(),
      mainMenuKeyboard()
    );
    return logCb(meta, action, chatId);
  }

  if (action === "diag:menu") {
    const target = resolveDiagTarget(chatId, msg && msg.text);
    if (!target) {
      await sendMessage(config.token, chatId, expiredGuidedMessage(), {
        reply_markup: mainMenuKeyboard(),
      });
      return logCb(meta, action, chatId, "expired");
    }
    refreshDiagTarget(chatId);
    await safeEditOrSend(
      config.token,
      chatId,
      messageId,
      diagnosticMenuText(target.display),
      diagnosticMenuKeyboard()
    );
    return logCb(meta, action, chatId);
  }

  if (action.startsWith("diag:") && DIAG_ACTIONS[action]) {
    return runDiagnosticAction({
      action,
      chatId,
      messageId,
      messageText: msg && msg.text,
      from: cq.from,
      config,
      env,
      adminUser,
      meta,
    });
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
