/**
 * Isolate-local usage protection for the public Telegram bot.
 * NOT a global rate limiter. Cloudflare edge rate limiting remains authoritative.
 */

import { getCommandMeta } from "./registry.js";
import { isAdmin } from "./authz.js";
import { t } from "./i18n/index.js";

export const DEFAULT_WINDOW_SECONDS = 60;
export const DEFAULT_EXPENSIVE_LIMIT = 5;
export const DEFAULT_CHEAP_LIMIT = 20;
export const MAX_TRACKED_CHATS = 500;

const usageByChat = new Map();

export function getUsageConfig(env = {}) {
  const windowSeconds = intEnv(env.TELEGRAM_PUBLIC_RATE_WINDOW_SECONDS, DEFAULT_WINDOW_SECONDS, 10, 3600);
  const expensiveLimit = intEnv(env.TELEGRAM_PUBLIC_EXPENSIVE_LIMIT, DEFAULT_EXPENSIVE_LIMIT, 1, 100);
  const cheapLimit = intEnv(env.TELEGRAM_PUBLIC_CHEAP_LIMIT, DEFAULT_CHEAP_LIMIT, 1, 500);
  return { windowSeconds, expensiveLimit, cheapLimit, maxTracked: MAX_TRACKED_CHATS };
}

function intEnv(raw, fallback, min, max) {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function commandCost(commandOrAction) {
  if (!commandOrAction) return null;
  const s = String(commandOrAction);
  if (["audit:rerun", "audit:security", "audit:seo", "audit:mobile", "audit:email", "audit:https", "audit:priorities", "audit:summary", "audit:back"].includes(s)) return "expensive";
  if (s.startsWith("diag:")) return s === "diag:back" || s === "diag:menu" ? "cheap" : "expensive";
  if (s.startsWith("result:")) return s === "result:another" || s === "result:back" ? "cheap" : "expensive";
  if (s.startsWith("menu:") || s === "nav:back" || s === "status:refresh" || s.startsWith("lang:")) return "cheap";
  if (s.startsWith("tool:")) return "cheap";
  const meta = getCommandMeta(s);
  if (!meta) return null;
  return meta.cost === "expensive" ? "expensive" : "cheap";
}

function prune(now, windowMs) {
  for (const [key, entry] of usageByChat) {
    if (!entry || now - entry.windowStart >= windowMs) usageByChat.delete(key);
  }
  while (usageByChat.size > MAX_TRACKED_CHATS) usageByChat.delete(usageByChat.keys().next().value);
}

export function checkUsage({ chatId, userId, commandOrAction, isAdminUser, env }) {
  const cost = commandCost(commandOrAction);
  if (!cost) return { allowed: true, cost: null };
  const admin = Boolean(isAdminUser) || isAdmin(userId, env || {});
  if (admin) return { allowed: true, cost, reason: "admin_bypass" };
  if (chatId == null || chatId === "") return { allowed: true, cost };
  const cfg = getUsageConfig(env || {});
  const windowMs = cfg.windowSeconds * 1000;
  const now = Date.now();
  prune(now, windowMs);
  const key = String(chatId);
  let entry = usageByChat.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { windowStart: now, expensive: 0, cheap: 0 };
    usageByChat.set(key, entry);
  }
  const limit = cost === "expensive" ? cfg.expensiveLimit : cfg.cheapLimit;
  const used = cost === "expensive" ? entry.expensive : entry.cheap;
  if (used >= limit) {
    return { allowed: false, cost, reason: "limit_reached", counts: { expensive: entry.expensive, cheap: entry.cheap, expensiveLimit: cfg.expensiveLimit, cheapLimit: cfg.cheapLimit, windowSeconds: cfg.windowSeconds } };
  }
  if (cost === "expensive") entry.expensive += 1;
  else entry.cheap += 1;
  return { allowed: true, cost, counts: { expensive: entry.expensive, cheap: entry.cheap, expensiveLimit: cfg.expensiveLimit, cheapLimit: cfg.cheapLimit, windowSeconds: cfg.windowSeconds } };
}

export function formatUsageLimitMessage(locale = "en") {
  return [t(locale, "usage.title"), "", t(locale, "usage.reached"), t(locale, "usage.wait"), "", t(locale, "usage.reason")].join("\n");
}

export function getUsageStats() {
  return { trackedChats: usageByChat.size, maxTracked: MAX_TRACKED_CHATS };
}

export function _resetUsageForTests() {
  usageByChat.clear();
}
