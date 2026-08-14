/**
 * Isolate-local usage protection for the public Telegram bot.
 *
 * NOT a global rate limiter. Cloudflare edge rate limiting remains authoritative.
 * State is ephemeral and bounded to a single isolate.
 */

import { getCommandMeta } from "./registry.js";

/** Defaults when env vars are absent. */
export const DEFAULT_WINDOW_SECONDS = 60;
export const DEFAULT_EXPENSIVE_LIMIT = 5;
export const DEFAULT_CHEAP_LIMIT = 20;
export const MAX_TRACKED_CHATS = 500;

/** @type {Map<string, { windowStart: number, expensive: number, cheap: number }>} */
const usageByChat = new Map();

export function getUsageConfig(env = {}) {
  const windowSeconds = intEnv(
    env.TELEGRAM_PUBLIC_RATE_WINDOW_SECONDS,
    DEFAULT_WINDOW_SECONDS,
    10,
    3600
  );
  const expensiveLimit = intEnv(
    env.TELEGRAM_PUBLIC_EXPENSIVE_LIMIT,
    DEFAULT_EXPENSIVE_LIMIT,
    1,
    100
  );
  const cheapLimit = intEnv(
    env.TELEGRAM_PUBLIC_CHEAP_LIMIT,
    DEFAULT_CHEAP_LIMIT,
    1,
    500
  );
  return { windowSeconds, expensiveLimit, cheapLimit, maxTracked: MAX_TRACKED_CHATS };
}

function intEnv(raw, fallback, min, max) {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {string} commandOrAction - primary command or callback action
 * @returns {'cheap'|'expensive'|null}
 */
export function commandCost(commandOrAction) {
  if (!commandOrAction) return null;
  const s = String(commandOrAction);

  // Expensive audit callbacks (re-fetch /api/audit)
  if (
    s === "audit:rerun" ||
    s === "audit:security" ||
    s === "audit:seo" ||
    s === "audit:mobile" ||
    s === "audit:email" ||
    s === "audit:https" ||
    s === "audit:priorities" ||
    s === "audit:summary" ||
    s === "audit:back"
  ) {
    return "expensive";
  }

  // Navigation / menus — cheap (or free of quota)
  if (s.startsWith("menu:") || s === "nav:back" || s === "status:refresh") {
    return "cheap";
  }
  if (s.startsWith("tool:")) {
    // Usage prompts only — treat as cheap
    return "cheap";
  }

  const meta = getCommandMeta(s);
  if (!meta) return null;
  return meta.cost === "expensive" ? "expensive" : "cheap";
}

function prune(now, windowMs) {
  for (const [key, entry] of usageByChat) {
    if (!entry || now - entry.windowStart >= windowMs) {
      usageByChat.delete(key);
    }
  }
  while (usageByChat.size > MAX_TRACKED_CHATS) {
    const first = usageByChat.keys().next().value;
    usageByChat.delete(first);
  }
}

/**
 * @returns {{ allowed: boolean, cost: string|null, reason?: string, counts?: object }}
 */
export function checkUsage({ chatId, commandOrAction, isAdminUser, env }) {
  const cost = commandCost(commandOrAction);
  if (!cost) return { allowed: true, cost: null };

  if (isAdminUser) {
    return { allowed: true, cost, reason: "admin_bypass" };
  }

  if (chatId == null || chatId === "") {
    return { allowed: true, cost };
  }

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
    return {
      allowed: false,
      cost,
      reason: "limit_reached",
      counts: {
        expensive: entry.expensive,
        cheap: entry.cheap,
        expensiveLimit: cfg.expensiveLimit,
        cheapLimit: cfg.cheapLimit,
        windowSeconds: cfg.windowSeconds,
      },
    };
  }

  if (cost === "expensive") entry.expensive += 1;
  else entry.cheap += 1;

  return {
    allowed: true,
    cost,
    counts: {
      expensive: entry.expensive,
      cheap: entry.cheap,
      expensiveLimit: cfg.expensiveLimit,
      cheapLimit: cfg.cheapLimit,
      windowSeconds: cfg.windowSeconds,
    },
  };
}

export function formatUsageLimitMessage() {
  return [
    "🚦 Too many checks",
    "",
    "You've reached the temporary usage limit.",
    "Please wait a little and try again.",
    "",
    "This limit helps keep Cloud Engine available for everyone.",
  ].join("\n");
}

/** Safe metrics for admin status (no secrets). */
export function getUsageStats() {
  return {
    trackedChats: usageByChat.size,
    maxTracked: MAX_TRACKED_CHATS,
  };
}

/** Test helper — clear isolate state. */
export function _resetUsageForTests() {
  usageByChat.clear();
}
