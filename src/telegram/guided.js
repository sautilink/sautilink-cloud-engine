/**
 * Guided website diagnostics — isolate-local pending only.
 * No persistent sessions. No URLs in callback_data.
 */

import { normalizeUrlArg } from "./normalize.js";
import { t } from "./i18n/index.js";

const PENDING_TTL_MS = 5 * 60 * 1000;
const MAX_PENDING = 200;
const pendingByChat = new Map();

function nowMs() { return Date.now(); }
function prune(now = nowMs()) {
  for (const [k, v] of pendingByChat) if (!v || v.expiresAt <= now) pendingByChat.delete(k);
  while (pendingByChat.size > MAX_PENDING) pendingByChat.delete(pendingByChat.keys().next().value);
}
function touch(entry) { entry.expiresAt = nowMs() + PENDING_TTL_MS; return entry; }

export function setAwaitTarget(chatId) {
  if (chatId == null) return;
  prune();
  pendingByChat.set(String(chatId), { mode: "await_target", expiresAt: nowMs() + PENDING_TTL_MS });
}
export function setPendingAudit(chatId) { setAwaitTarget(chatId); }

export function setDiagTarget(chatId, url, display, lastAction = null) {
  if (chatId == null || !url) return;
  prune();
  const prev = pendingByChat.get(String(chatId));
  pendingByChat.set(String(chatId), {
    mode: "diag",
    url: String(url),
    display: String(display || url),
    lastAction: lastAction || (prev && prev.mode === "diag" ? prev.lastAction : null) || null,
    expiresAt: nowMs() + PENDING_TTL_MS,
  });
}

export function setLastDiagAction(chatId, action) {
  const e = getGuidedState(chatId);
  if (!e || e.mode !== "diag") return;
  e.lastAction = action;
  touch(e);
  pendingByChat.set(String(chatId), e);
}

export function getGuidedState(chatId) {
  if (chatId == null) return null;
  prune();
  const e = pendingByChat.get(String(chatId));
  if (!e) return null;
  if (e.expiresAt <= nowMs()) { pendingByChat.delete(String(chatId)); return null; }
  return e;
}

export function peekPending(chatId) {
  const e = getGuidedState(chatId);
  return e && e.mode === "await_target" ? "audit" : null;
}

export function getDiagTarget(chatId) {
  const e = getGuidedState(chatId);
  if (!e || e.mode !== "diag") return null;
  return { url: e.url, display: e.display, lastAction: e.lastAction || null };
}

export function refreshDiagTarget(chatId) {
  const e = getGuidedState(chatId);
  if (!e || e.mode !== "diag") return null;
  touch(e);
  pendingByChat.set(String(chatId), e);
  return { url: e.url, display: e.display, lastAction: e.lastAction || null };
}

export function clearPending(chatId) { if (chatId != null) pendingByChat.delete(String(chatId)); }
export function takePending(chatId) { const action = peekPending(chatId); if (!action) return null; clearPending(chatId); return action; }

export function guidedAuditPromptText(locale = "en") {
  return [t(locale, "guided.title"), "", t(locale, "guided.prompt"), "", t(locale, "guided.example"), t(locale, "guided.or")].join("\n");
}

export function checkAnotherPromptText(locale = "en") {
  return [t(locale, "guided.another_title"), "", t(locale, "guided.send_domain"), "• example.com", "• https://example.com"].join("\n");
}

export function diagnosticMenuText(display, locale = "en") {
  return [t(locale, "guided.diag_title"), `🌐 ${display}`, "", t(locale, "guided.choose")].join("\n");
}

export function diagnosticMenuKeyboard(locale = "en") {
  return { inline_keyboard: [
    [{ text: t(locale, "menu.security"), callback_data: "diag:security" }, { text: "🔍 SEO", callback_data: "diag:seo" }],
    [{ text: t(locale, "menu.mobile"), callback_data: "diag:mobile" }, { text: t(locale, "menu.email"), callback_data: "diag:email" }],
    [{ text: t(locale, "menu.https"), callback_data: "diag:https" }, { text: t(locale, "menu.dns"), callback_data: "diag:dns" }],
    [{ text: t(locale, "menu.robots"), callback_data: "diag:robots" }, { text: t(locale, "menu.sitemap"), callback_data: "diag:sitemap" }],
    [{ text: t(locale, "menu.full_audit"), callback_data: "diag:audit" }],
    [{ text: t(locale, "menu.check_another"), callback_data: "result:another" }, { text: t(locale, "menu.back"), callback_data: "diag:back" }],
  ] };
}

export function diagnosticResultKeyboard(locale = "en") {
  return { inline_keyboard: [
    [{ text: t(locale, "menu.rerun"), callback_data: "result:rerun" }, { text: t(locale, "menu.full_audit"), callback_data: "result:fullaudit" }],
    [{ text: t(locale, "menu.check_another"), callback_data: "result:another" }],
    [{ text: t(locale, "menu.back"), callback_data: "result:back" }],
  ] };
}

export function diagnosticFailKeyboard(locale = "en") {
  return { inline_keyboard: [[
    { text: t(locale, "menu.retry"), callback_data: "result:rerun" },
    { text: t(locale, "menu.back"), callback_data: "result:back" },
  ]] };
}

export function guidedInvalidMessage(detail, locale = "en") {
  const d = detail ? String(detail).trim() : "";
  const lines = [t(locale, "guided.invalid")];
  if (d) lines.push(d);
  lines.push("", t(locale, "guided.try_again"), "• example.com", "• https://example.com");
  return lines.join("\n");
}

export function expiredGuidedMessage(locale = "en") {
  return [t(locale, "guided.expired"), "", t(locale, "guided.expired_hint")].join("\n");
}

export function parseGuidedAuditTarget(input, locale = "en") {
  if (input == null || typeof input !== "string") return { ok: false, message: guidedInvalidMessage(t(locale, "guided.send_address"), locale) };
  const raw = input.trim();
  if (!raw) return { ok: false, message: guidedInvalidMessage(t(locale, "guided.send_address"), locale) };
  if (raw.startsWith("/")) return { ok: false, message: guidedInvalidMessage(t(locale, "guided.no_command"), locale) };
  if (raw.length > 2048) return { ok: false, message: guidedInvalidMessage(t(locale, "guided.too_long"), locale) };
  if (/\s/.test(raw)) return { ok: false, message: guidedInvalidMessage(t(locale, "guided.no_spaces"), locale) };
  if (/^(ftp|file|javascript|data|blob|ws|wss):/i.test(raw)) return { ok: false, message: guidedInvalidMessage(t(locale, "guided.http_only"), locale) };
  const n = normalizeUrlArg(raw);
  if (!n.ok) return { ok: false, message: guidedInvalidMessage(n.message, locale) };
  let hostname = "";
  try { hostname = new URL(n.url).hostname || ""; } catch { return { ok: false, message: guidedInvalidMessage(t(locale, "guided.valid_url"), locale) }; }
  if (!hostname) return { ok: false, message: guidedInvalidMessage(t(locale, "guided.valid_url"), locale) };
  if (!hostname.includes(".")) return { ok: false, message: guidedInvalidMessage(t(locale, "guided.full_domain"), locale) };
  if (!/^[a-z0-9._-]+$/i.test(hostname)) return { ok: false, message: guidedInvalidMessage(t(locale, "guided.invalid_chars"), locale) };
  return { ok: true, url: n.url, display: hostname };
}

export function looksLikeWebsiteAttempt(input) {
  if (typeof input !== "string") return false;
  const raw = input.trim();
  if (!raw || raw.startsWith("/")) return false;
  if (raw.length > 2048 || /\s/.test(raw) || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return true;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw) || /^[a-z0-9.-]+$/i.test(raw)) return true;
  return false;
}

export function recoverDiagDisplayFromMessage(text) {
  if (typeof text !== "string") return null;
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (s.startsWith("🌐 ")) {
      const host = s.slice(2).trim();
      if (host && !/\s/.test(host)) return host;
    }
  }
  return null;
}

export function getGuidedStats() { prune(); return { pending: pendingByChat.size, maxPending: MAX_PENDING, ttlMs: PENDING_TTL_MS }; }
export function _resetGuidedForTests() { pendingByChat.clear(); }
export const GUIDED_PENDING_TTL_MS = PENDING_TTL_MS;
export const GUIDED_MAX_PENDING = MAX_PENDING;

export const DIAG_ACTIONS = {
  "diag:security": { label: "Security", labelKey: "menu.security", path: "/api/headers", arg: "url", command: "headers" },
  "diag:seo": { label: "SEO", path: "/api/website", arg: "url", command: "website" },
  "diag:mobile": { label: "Mobile", labelKey: "menu.mobile", path: "/api/mobile", arg: "url", command: "mobile" },
  "diag:email": { label: "Email", labelKey: "menu.email", path: "/api/email", arg: "domain", command: "email" },
  "diag:https": { label: "HTTPS", labelKey: "menu.https", path: "/api/ssl", arg: "url", command: "ssl" },
  "diag:dns": { label: "DNS", labelKey: "menu.dns", path: "/api/dns", arg: "domain", command: "dns" },
  "diag:robots": { label: "Robots", labelKey: "menu.robots", path: "/api/robots", arg: "url", command: "robots" },
  "diag:sitemap": { label: "Sitemap", labelKey: "menu.sitemap", path: "/api/sitemap", arg: "sitemap", command: "sitemap" },
  "diag:audit": { label: "Full Audit", labelKey: "menu.full_audit", path: "/api/audit", arg: "url", command: "audit" },
};

export function diagnosticLabel(action, locale = "en") {
  const meta = DIAG_ACTIONS[action];
  if (!meta) return action;
  return meta.labelKey ? t(locale, meta.labelKey).replace(/^[^\p{L}\p{N}]+/u, "").trim() : meta.label;
}
