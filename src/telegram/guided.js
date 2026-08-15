/**
 * Guided “Check a Website” flow — isolate-local pending only.
 * No persistent sessions. No URLs stored in callback_data.
 */

import { normalizeUrlArg } from "./normalize.js";

const PENDING_TTL_MS = 3 * 60 * 1000; // 3 minutes
const MAX_PENDING = 200;

/** @type {Map<string, { action: string, expiresAt: number }>} */
const pendingByChat = new Map();

function prune(now = Date.now()) {
  for (const [k, v] of pendingByChat) {
    if (!v || v.expiresAt <= now) pendingByChat.delete(k);
  }
  while (pendingByChat.size > MAX_PENDING) {
    const first = pendingByChat.keys().next().value;
    pendingByChat.delete(first);
  }
}

/** Mark chat as waiting for a website target (audit). */
export function setPendingAudit(chatId) {
  if (chatId == null) return;
  prune();
  pendingByChat.set(String(chatId), {
    action: "audit",
    expiresAt: Date.now() + PENDING_TTL_MS,
  });
}

/** @returns {'audit'|null} */
export function peekPending(chatId) {
  if (chatId == null) return null;
  prune();
  const e = pendingByChat.get(String(chatId));
  if (!e) return null;
  if (e.expiresAt <= Date.now()) {
    pendingByChat.delete(String(chatId));
    return null;
  }
  return e.action === "audit" ? "audit" : null;
}

export function clearPending(chatId) {
  if (chatId == null) return;
  pendingByChat.delete(String(chatId));
}

/** Consume pending if present (one-shot). */
export function takePending(chatId) {
  const action = peekPending(chatId);
  if (!action) return null;
  clearPending(chatId);
  return action;
}

export function guidedAuditPromptText() {
  return [
    "🔎 Check a Website",
    "",
    "Send the website address you want to check.",
    "",
    "Example: example.com",
    "Or: https://example.com",
  ].join("\n");
}

/**
 * Validate free-text target for guided audit.
 * @returns {{ ok: true, url: string, display: string } | { ok: false, message: string }}
 */
export function parseGuidedAuditTarget(input) {
  if (input == null || typeof input !== "string") {
    return {
      ok: false,
      message:
        "Please send a website address.\nExample: example.com",
    };
  }
  const raw = input.trim();
  if (!raw) {
    return {
      ok: false,
      message:
        "Please send a website address.\nExample: example.com",
    };
  }
  // Reject multi-line / command-like noise
  if (raw.startsWith("/")) {
    return {
      ok: false,
      message:
        "Send only the website address (no command).\nExample: example.com",
    };
  }
  if (raw.length > 2048) {
    return { ok: false, message: "That address is too long." };
  }

  const n = normalizeUrlArg(raw);
  if (!n.ok) {
    return {
      ok: false,
      message: `${n.message}\n\nExample: example.com`,
    };
  }

  let display = raw;
  try {
    display = new URL(n.url).hostname || raw;
  } catch {
    /* keep raw */
  }

  return { ok: true, url: n.url, display };
}

export function getGuidedStats() {
  prune();
  return { pending: pendingByChat.size, maxPending: MAX_PENDING, ttlMs: PENDING_TTL_MS };
}

export function _resetGuidedForTests() {
  pendingByChat.clear();
}

export const GUIDED_PENDING_TTL_MS = PENDING_TTL_MS;
export const GUIDED_MAX_PENDING = MAX_PENDING;
