/**
 * Best-effort per-chat cooldown for expensive commands within one isolate.
 * Not a global rate limiter — Cloudflare edge remains authoritative.
 *
 * Admins (caller must pass isAdminUser) bypass this public isolate-local cooldown.
 * Dedup, audit in-flight, Telegram API limits, and Cloudflare edge still apply.
 */

const last = new Map();
const MAX_ENTRIES = 300;
const COOLDOWN_MS = 4_000;

const EXPENSIVE = new Set([
  "audit",
  "website",
  "mobile",
  "robots",
  "sitemap",
  "ssl",
  "headers",
  "dns",
  "email",
  "http",
]);

export function isExpensiveCommand(cmd) {
  return EXPENSIVE.has(String(cmd || ""));
}

/**
 * @param {string|number} chatId
 * @param {string} command
 * @param {{ isAdminUser?: boolean }} [opts]
 * @returns {{ blocked: boolean, retryAfterSec?: number }}
 */
export function checkCooldown(chatId, command, opts = {}) {
  if (opts && opts.isAdminUser) return { blocked: false };
  if (!isExpensiveCommand(command)) return { blocked: false };
  if (chatId == null) return { blocked: false };

  const key = `${chatId}:${command}`;
  const now = Date.now();

  if (last.size > MAX_ENTRIES) {
    const first = last.keys().next().value;
    last.delete(first);
  }

  const prev = last.get(key);
  if (prev != null && now - prev < COOLDOWN_MS) {
    const retryAfterSec = Math.ceil((COOLDOWN_MS - (now - prev)) / 1000);
    return { blocked: true, retryAfterSec };
  }
  last.set(key, now);
  return { blocked: false };
}

/** Soft in-flight mark for audit rerun (same isolate only). */
const inflight = new Map();
const INFLIGHT_TTL_MS = 25_000;

export function tryBeginAudit(chatId) {
  if (chatId == null) return true;
  const key = String(chatId);
  const now = Date.now();
  const until = inflight.get(key);
  if (until != null && until > now) return false;
  inflight.set(key, now + INFLIGHT_TTL_MS);
  return true;
}

export function endAudit(chatId) {
  if (chatId == null) return;
  inflight.delete(String(chatId));
}

/** Test helper */
export function _resetCooldownForTests() {
  last.clear();
  inflight.clear();
}
