/**
 * Telegram processUpdate — Phase 7K/7L flows + Phase 7M localization.
 */

import { parseCommand, KNOWN_COMMANDS } from "./router.js";
import { handleCommand } from "./commands.js";
import { sendMessage, editMessageText, answerCallbackQuery } from "./telegram.js";
import { callCloudEngine } from "./engine.js";
import { parseCallbackAction, recoverAuditTargetFromMessage, normalizeUrlArg } from "./normalize.js";
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
  languageKeyboard,
  languageMenuText,
  mainMenuText,
  websiteMenuText,
  infrastructureMenuText,
  toolPrompt,
} from "./menu.js";
import { isDuplicateUpdate } from "./dedup.js";
import { checkCooldown, tryBeginAudit, endAudit } from "./cooldown.js";
import { newCorrelationId, logTelegram } from "./log.js";
import { authorizeUser, isAdmin } from "./authz.js";
import { checkUsage, formatUsageLimitMessage } from "./usage.js";
import {
  setAwaitTarget,
  setDiagTarget,
  setLastDiagAction,
  getDiagTarget,
  refreshDiagTarget,
  peekPending,
  clearPending,
  parseGuidedAuditTarget,
  guidedAuditPromptText,
  diagnosticMenuText,
  diagnosticMenuKeyboard,
  diagnosticResultKeyboard,
  diagnosticFailKeyboard,
  expiredGuidedMessage,
  looksLikeWebsiteAttempt,
  recoverDiagDisplayFromMessage,
  DIAG_ACTIONS,
  diagnosticLabel,
} from "./guided.js";
import { handleResultAction } from "./result_actions.js";
import { resolveLocale, setLocaleOverride, t } from "./i18n/index.js";

export async function processUpdate(update, config) {
  const started = Date.now();
  const correlationId = newCorrelationId();
  const updateId = update && update.update_id;
  if (!update || typeof update !== "object") return { handled: false, reason: "empty_update" };
  if (isDuplicateUpdate(updateId)) {
    logTelegram({ event: "telegram_duplicate_skipped", correlation_id: correlationId, update_id: updateId, status: "skipped", duration_ms: Date.now() - started });
    return { handled: true, reason: "duplicate_update" };
  }
  if (update.callback_query) return processCallback(update.callback_query, config, { correlationId, updateId, started });

  const message = update.message || update.edited_message;
  if (!message || typeof message.text !== "string") return { handled: false, reason: "unsupported_update" };
  const chat = message.chat;
  const from = message.from;
  if (!chat || chat.id == null) return { handled: false, reason: "no_chat" };
  const env = config.env || {};
  const locale = resolveLocale({ chatId: chat.id, languageCode: from && from.language_code });
  const auth = authorizeUser({ from, chat, env });
  if (!auth.allowed) {
    await sendMessage(config.token, chat.id, t(locale, "error.denied"));
    return { handled: true, reason: "denied" };
  }
  const adminUser = auth.role === "admin" || isAdmin(from && from.id, env);
  const parsed = parseCommand(message.text);
  if (parsed) {
    clearPending(chat.id);
    if (!KNOWN_COMMANDS.has(parsed.rawCommand) && !KNOWN_COMMANDS.has(parsed.command)) {
      await sendMessage(config.token, chat.id, t(locale, "error.unknown_command"));
      return { handled: true, command: parsed.command };
    }
    return runCommandPath({ parsed, chat, from, config, env, adminUser, locale, correlationId, updateId, started });
  }
  if (peekPending(chat.id) === "audit") return runGuidedTargetCapture({ text: message.text, chat, config, locale });
  if (looksLikeWebsiteAttempt(message.text)) {
    await sendMessage(config.token, chat.id, t(locale, "guided.hint"), { reply_markup: mainMenuKeyboard(locale) });
    return { handled: true, reason: "guided_hint" };
  }
  return { handled: false, reason: "not_command" };
}

async function runGuidedTargetCapture({ text, chat, config, locale }) {
  const target = parseGuidedAuditTarget(text, locale);
  if (!target.ok) {
    setAwaitTarget(chat.id);
    await sendMessage(config.token, chat.id, target.message, { reply_markup: guidedAuditKeyboard(locale) });
    return { handled: true, reason: "guided_invalid" };
  }
  setDiagTarget(chat.id, target.url, target.display);
  await sendMessage(config.token, chat.id, diagnosticMenuText(target.display, locale), { reply_markup: diagnosticMenuKeyboard(locale) });
  return { handled: true, reason: "diag_menu" };
}

async function runCommandPath({ parsed, chat, from, config, env, adminUser, locale, correlationId, updateId, started }) {
  const usage = checkUsage({ chatId: chat.id, userId: from && from.id, commandOrAction: parsed.command, isAdminUser: adminUser, env });
  if (!usage.allowed) {
    await sendMessage(config.token, chat.id, formatUsageLimitMessage(locale));
    return { handled: true, command: parsed.command, reason: "usage_limited" };
  }
  const cool = checkCooldown(chat.id, parsed.command, { isAdminUser: adminUser });
  if (cool.blocked) {
    await sendMessage(config.token, chat.id, t(locale, "error.rate"));
    return { handled: true, command: parsed.command, reason: "cooldown" };
  }
  const slow = new Set(["audit", "email", "website", "mobile", "ssl", "headers", "sitemap", "robots", "http", "dns"]);
  let pendingId = null;
  if (slow.has(parsed.command) && parsed.arg) {
    if (parsed.command === "audit" && !tryBeginAudit(chat.id)) {
      await sendMessage(config.token, chat.id, t(locale, "error.audit_running"));
      return { handled: true, command: "audit", reason: "inflight" };
    }
    const pending = await sendMessage(config.token, chat.id, t(locale, "loading.checking"));
    if (pending.ok && pending.result && pending.result.message_id != null) pendingId = pending.result.message_id;
  }
  let result;
  try {
    result = await handleCommand({ command: parsed.command, arg: parsed.arg, chat, from, locale }, config);
  } finally {
    if (parsed.command === "audit") endAudit(chat.id);
  }
  const text = result.text || t(locale, "error.no_response");
  const extra = {};
  if (result.reply_markup) extra.reply_markup = result.reply_markup;
  if (pendingId != null) {
    const edited = await editMessageText(config.token, chat.id, pendingId, text, extra);
    if (!edited.ok) await sendMessage(config.token, chat.id, text, extra);
  } else {
    await sendMessage(config.token, chat.id, text, extra);
  }
  logTelegram({ event: "telegram_command", correlation_id: correlationId, update_id: updateId, command: parsed.command, cost_class: usage.cost, usage_allowed: true, locale, chat_id: chat.id, status: "ok", duration_ms: Date.now() - started });
  return { handled: true, command: parsed.command };
}

function resolveDiagTarget(chatId, messageText) {
  let target = getDiagTarget(chatId);
  if (target) return target;
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
    } catch { /* no-op */ }
  }
  return null;
}

function buildQuery(meta, target) {
  if (meta.arg === "domain") return { domain: target.display };
  if (meta.arg === "sitemap") {
    let sitemapUrl = target.url;
    try {
      const u = new URL(target.url);
      if (!/sitemap/i.test(u.pathname)) {
        u.pathname = "/sitemap.xml";
        u.search = "";
        u.hash = "";
        sitemapUrl = u.toString();
      }
    } catch { /* no-op */ }
    return { url: sitemapUrl };
  }
  return { url: target.url };
}

function formatDiagResult(action, data, locale) {
  switch (action) {
    case "diag:security": return formatHeaders(data, locale);
    case "diag:seo": return formatWebsite(data, locale);
    case "diag:mobile": return formatMobile(data, locale);
    case "diag:email": return formatEmail(data, locale);
    case "diag:https": return formatSsl(data, locale);
    case "diag:dns": return formatDns(data, locale);
    case "diag:robots": return formatRobots(data, locale);
    case "diag:sitemap": return formatSitemap(data, locale);
    case "diag:audit": return formatAudit(data, locale);
    default: return t(locale, "error.no_response");
  }
}

async function runDiagnosticAction({ action, chatId, messageId, messageText, from, config, env, adminUser, meta, locale = "en" }) {
  const target = resolveDiagTarget(chatId, messageText);
  if (!target) {
    await sendMessage(config.token, chatId, expiredGuidedMessage(locale), { reply_markup: mainMenuKeyboard(locale) });
    return logCb(meta, action, chatId, "expired", locale);
  }
  const toolMeta = DIAG_ACTIONS[action];
  if (!toolMeta) return logCb(meta, action, chatId, "unknown", locale);
  const label = diagnosticLabel(action, locale);
  const cool = checkCooldown(chatId, toolMeta.command, { isAdminUser: adminUser });
  if (cool.blocked) {
    await sendMessage(config.token, chatId, t(locale, "error.rate"));
    return logCb(meta, action, chatId, "cooldown", locale);
  }
  if (action === "diag:audit" && !tryBeginAudit(chatId)) {
    await sendMessage(config.token, chatId, t(locale, "error.audit_running"));
    return logCb(meta, action, chatId, "inflight", locale);
  }
  const loading = t(locale, "loading.diag", { label, host: target.display });
  if (messageId != null) await editMessageText(config.token, chatId, messageId, loading);
  else await sendMessage(config.token, chatId, loading);

  try {
    const result = await callCloudEngine(config.cloudEngineBaseUrl, toolMeta.path, buildQuery(toolMeta, target));
    let text;
    let extra = { reply_markup: diagnosticResultKeyboard(locale) };
    if (!result.ok) {
      const code = result.error && result.error.code;
      const timedOut = code === "ENGINE_TIMEOUT" || code === "REQUEST_TIMEOUT";
      text = timedOut ? t(locale, "error.diag_failed", { label }) : formatEngineError(result.error, locale);
      extra = { reply_markup: diagnosticFailKeyboard(locale) };
    } else {
      try {
        text = formatDiagResult(action, result.data || {}, locale);
      } catch {
        text = t(locale, "error.diag_failed", { label });
        extra = { reply_markup: diagnosticFailKeyboard(locale) };
      }
      if (action === "diag:audit") extra = { reply_markup: auditKeyboard(locale) };
    }
    setLastDiagAction(chatId, action);
    refreshDiagTarget(chatId);
    if (messageId != null) {
      const ed = await editMessageText(config.token, chatId, messageId, text, extra);
      if (!ed.ok) await sendMessage(config.token, chatId, text, extra);
    } else await sendMessage(config.token, chatId, text, extra);
  } catch {
    const text = t(locale, "error.diag_failed", { label });
    const extra = { reply_markup: diagnosticFailKeyboard(locale) };
    setLastDiagAction(chatId, action);
    refreshDiagTarget(chatId);
    if (messageId != null) {
      const ed = await editMessageText(config.token, chatId, messageId, text, extra);
      if (!ed.ok) await sendMessage(config.token, chatId, text, extra);
    } else await sendMessage(config.token, chatId, text, extra);
  } finally {
    if (action === "diag:audit") endAudit(chatId);
  }
  return logCb(meta, action, chatId, "ok", locale);
}

async function processCallback(cq, config, meta) {
  const cqId = cq && cq.id;
  if (cqId) await answerCallbackQuery(config.token, cqId);
  const env = config.env || {};
  const msg = cq && cq.message;
  const chatId = msg && msg.chat && msg.chat.id;
  const locale = resolveLocale({ chatId, languageCode: cq && cq.from && cq.from.language_code });
  const auth = authorizeUser({ from: cq.from, chat: msg && msg.chat, env });
  if (!auth.allowed) return { handled: true, reason: "denied" };
  const action = parseCallbackAction(cq && cq.data);
  if (!action) {
    if (cqId) await answerCallbackQuery(config.token, cqId, t(locale, "error.unknown_action"));
    return { handled: true, reason: "unknown_callback" };
  }
  const messageId = msg && msg.message_id;
  if (chatId == null) return { handled: true, reason: "no_chat" };
  const adminUser = auth.role === "admin" || isAdmin(cq.from && cq.from.id, env);
  if (action.startsWith("menu:") || action === "nav:back") clearPending(chatId);
  const usage = checkUsage({ chatId, userId: cq.from && cq.from.id, commandOrAction: action, isAdminUser: adminUser, env });
  if (!usage.allowed) {
    await sendMessage(config.token, chatId, formatUsageLimitMessage(locale));
    return logCb(meta, action, chatId, "limited", locale);
  }

  if (action === "lang:en" || action === "lang:sw") {
    const selected = action.slice(5);
    const nextLocale = setLocaleOverride(chatId, selected);
    const text = [t(nextLocale, selected === "sw" ? "lang.changed_sw" : "lang.changed_en"), "", mainMenuText(nextLocale)].join("\n");
    await safeEditOrSend(config.token, chatId, messageId, text, mainMenuKeyboard(nextLocale));
    return logCb(meta, action, chatId, "ok", nextLocale);
  }
  if (action === "menu:lang") {
    await safeEditOrSend(config.token, chatId, messageId, languageMenuText(locale), languageKeyboard(locale));
    return logCb(meta, action, chatId, "ok", locale);
  }
  if (action === "menu:main" || action === "nav:back") {
    await safeEditOrSend(config.token, chatId, messageId, mainMenuText(locale), mainMenuKeyboard(locale));
    return logCb(meta, action, chatId, "ok", locale);
  }
  if (action === "menu:website") {
    await safeEditOrSend(config.token, chatId, messageId, websiteMenuText(locale), websiteMenuKeyboard(locale));
    return logCb(meta, action, chatId, "ok", locale);
  }
  if (action === "menu:infrastructure") {
    await safeEditOrSend(config.token, chatId, messageId, infrastructureMenuText(locale), infrastructureMenuKeyboard(locale));
    return logCb(meta, action, chatId, "ok", locale);
  }
  if (action === "menu:about") {
    await safeEditOrSend(config.token, chatId, messageId, formatAbout(locale), backToMainKeyboard(locale));
    return logCb(meta, action, chatId, "ok", locale);
  }
  if (action === "menu:help") {
    await safeEditOrSend(config.token, chatId, messageId, formatHelp(locale), helpMenuKeyboard(locale));
    return logCb(meta, action, chatId, "ok", locale);
  }
  if (action === "menu:status" || action === "status:refresh") {
    const result = await callCloudEngine(config.cloudEngineBaseUrl, "/api/health", {});
    await safeEditOrSend(config.token, chatId, messageId, formatStatus(result.ok, result.data, locale), statusKeyboard(locale));
    return logCb(meta, action, chatId, "ok", locale);
  }

  const resultHandled = await handleResultAction({ action, chatId, messageId, messageText: msg && msg.text, config, resolveDiagTarget, runDiagnosticAction, safeEditOrSend, logCb, meta, from: cq.from, env, adminUser, locale });
  if (resultHandled) return resultHandled;

  if (action === "tool:audit") {
    setAwaitTarget(chatId);
    await safeEditOrSend(config.token, chatId, messageId, guidedAuditPromptText(locale), guidedAuditKeyboard(locale));
    return logCb(meta, action, chatId, "ok", locale);
  }
  if (action === "diag:back") {
    clearPending(chatId);
    await safeEditOrSend(config.token, chatId, messageId, mainMenuText(locale), mainMenuKeyboard(locale));
    return logCb(meta, action, chatId, "ok", locale);
  }
  if (action === "diag:menu") {
    const target = resolveDiagTarget(chatId, msg && msg.text);
    if (!target) {
      await sendMessage(config.token, chatId, expiredGuidedMessage(locale), { reply_markup: mainMenuKeyboard(locale) });
      return logCb(meta, action, chatId, "expired", locale);
    }
    refreshDiagTarget(chatId);
    await safeEditOrSend(config.token, chatId, messageId, diagnosticMenuText(target.display, locale), diagnosticMenuKeyboard(locale));
    return logCb(meta, action, chatId, "ok", locale);
  }
  if (action.startsWith("diag:") && DIAG_ACTIONS[action]) {
    return runDiagnosticAction({ action, chatId, messageId, messageText: msg && msg.text, from: cq.from, config, env, adminUser, meta, locale });
  }
  if (action.startsWith("tool:")) {
    const tool = action.slice(5);
    const prompt = toolPrompt(tool, locale);
    if (!prompt) return { handled: true, reason: "unknown_tool" };
    clearPending(chatId);
    await safeEditOrSend(config.token, chatId, messageId, prompt.text, toolPromptKeyboard(prompt.parent, locale));
    return logCb(meta, action, chatId, "ok", locale);
  }
  if (!action.startsWith("audit:")) return { handled: true, reason: "unhandled_callback" };

  const target = recoverAuditTargetFromMessage(msg && msg.text);
  if (!target) {
    await sendMessage(config.token, chatId, t(locale, "error.recover_audit"));
    return { handled: true, action };
  }
  async function fetchAudit() { return callCloudEngine(config.cloudEngineBaseUrl, "/api/audit", { url: target }); }

  if (action === "audit:rerun" || action === "audit:back") {
    if (action === "audit:rerun" && !tryBeginAudit(chatId)) {
      if (cqId) await answerCallbackQuery(config.token, cqId, t(locale, "error.audit_running"));
      return { handled: true, action, reason: "inflight" };
    }
    try {
      if (messageId != null) await editMessageText(config.token, chatId, messageId, action === "audit:rerun" ? t(locale, "loading.rerun") : t(locale, "loading.audit"));
      const result = await fetchAudit();
      let text;
      let extra = {};
      if (!result.ok) text = result.error && (result.error.code === "ENGINE_TIMEOUT" || result.error.code === "REQUEST_TIMEOUT") ? formatTimeout(locale) : formatEngineError(result.error, locale);
      else {
        text = formatAudit(result.data || {}, locale);
        extra = { reply_markup: auditKeyboard(locale) };
      }
      if (messageId != null) {
        const ed = await editMessageText(config.token, chatId, messageId, text, extra);
        if (!ed.ok) await sendMessage(config.token, chatId, text, extra);
      } else await sendMessage(config.token, chatId, text, extra);
    } finally {
      if (action === "audit:rerun") endAudit(chatId);
    }
    return logCb(meta, action, chatId, "ok", locale);
  }

  const result = await fetchAudit();
  if (!result.ok) {
    await sendMessage(config.token, chatId, result.error && result.error.code === "ENGINE_TIMEOUT" ? formatTimeout(locale) : formatEngineError(result.error, locale));
    return { handled: true, action };
  }
  const data = result.data || {};
  let text;
  if (action === "audit:summary") text = formatAuditSummaryView(data, locale);
  else if (action === "audit:priorities") text = formatAuditPrioritiesView(data, locale);
  else {
    const map = { "audit:security": "security", "audit:seo": "seo", "audit:mobile": "mobile", "audit:email": "email", "audit:https": "https" };
    const key = map[action];
    if (!key) return { handled: true, reason: "unknown_audit_action" };
    text = formatAuditCategory(data, key, locale);
  }
  await safeEditOrSend(config.token, chatId, messageId, text, auditDetailKeyboard(locale));
  return logCb(meta, action, chatId, "ok", locale);
}

async function safeEditOrSend(token, chatId, messageId, text, reply_markup) {
  const extra = reply_markup ? { reply_markup } : {};
  if (messageId != null) {
    const ed = await editMessageText(token, chatId, messageId, text, extra);
    if (ed.ok) return;
  }
  await sendMessage(token, chatId, text, extra);
}

function logCb(meta, action, chatId, status = "ok", locale = "en") {
  logTelegram({ event: "telegram_callback", correlation_id: meta.correlationId, update_id: meta.updateId, callback_action: action, locale, chat_id: chatId, status, duration_ms: Date.now() - meta.started });
  return { handled: true, action };
}
