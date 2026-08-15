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
  if (e.expiresAt <= nowMs()) {
    pendingByChat.delete(String(chatId));
    return null;
  }
  return e.action === "audit" ? "audit" : null;
}

function nowMs() {
  return Date.now();
}

export function clearPending(chatId) {
  if (chatId == null) return;
  pendingByChat.delete(String(chatId));
}

/** Consume pending if present (one-shot). Prefer validate-then-take in callers. */
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

export function guidedInvalidMessage(detail) {
  const d = detail ? String(detail).trim() : "";
  const lines = ["⚠️ That does not look like a website address."];
  if (d) lines.push(d);
  lines.push("", "Try again with a domain or URL:", "• example.com", "• https://example.com");
  return lines.join("\n");
}

/**
 * Validate free-text target for guided audit.
 * Does not perform DNS existence checks — only structural validation.
 * Single-label hosts (e.g. "hello") are rejected; public checks expect a dotted domain.
 *
 * @returns {{ ok: true, url: string, display: string } | { ok: false, message: string }}
 */
export function parseGuidedAuditTarget(input) {
  if (input == null || typeof input !== "string") {
    return { ok: false, message: guidedInvalidMessage("Please send a website address.") };
  }

  const raw = input.trim();
  if (!raw) {
    return { ok: false, message: guidedInvalidMessage("Please send a website address.") };
  }

  if (raw.startsWith("/")) {
    return {
      ok: false,
      message: guidedInvalidMessage("Send only the website address (no command)."),
    };
  }

  if (raw.length > 2048) {
    return { ok: false, message: guidedInvalidMessage("That address is too long.") };
  }

  // Spaces / multiple tokens are never valid hostnames or URLs here.
  if (/\s/.test(raw)) {
    return {
      ok: false,
      message: guidedInvalidMessage("Addresses cannot contain spaces."),
    };
  }

  // Unsupported schemes (before normalize)
  if (/^(ftp|file|javascript|data|blob|ws|wss):/i.test(raw)) {
    return {
      ok: false,
      message: guidedInvalidMessage("Only http and https URLs are supported."),
    };
  }

  const n = normalizeUrlArg(raw);
  if (!n.ok) {
    return {
      ok: false,
      message: guidedInvalidMessage(n.message),
    };
  }

  let hostname = "";
  try {
    hostname = new URL(n.url).hostname || "";
  } catch {
    return { ok: false, message: guidedInvalidMessage("Please provide a valid URL.") };
  }

  if (!hostname) {
    return { ok: false, message: guidedInvalidMessage("Please provide a valid URL.") };
  }

  // Reject IP literals here only for empty/odd host; SSRF still authoritative in Engine.
  // Require a dotted hostname for guided UX (FQDN-style). "hello" is syntactically a
  // possible host for URL parsers but is not accepted as a public website target.
  if (!hostname.includes(".")) {
    return {
      ok: false,
      message: guidedInvalidMessage(
        "Use a full domain name (for example example.com)."
      ),
    };
  }

  // Hostname labels: no spaces (already), basic charset
  if (!/^[a-z0-9._-]+$/i.test(hostname)) {
    return {
      ok: false,
      message: guidedInvalidMessage("That domain contains invalid characters."),
    };
  }

  return { ok: true, url: n.url, display: hostname };
}

/** True if free text looks like the user tried to submit a website target. */
export function looksLikeWebsiteAttempt(input) {
  if (typeof input !== "string") return false;
  const raw = input.trim();
  if (!raw || raw.startsWith("/")) return false;
  if (raw.length > 2048) return true;
  if (/\s/.test(raw)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return true;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw)) return true;
  if (/^[a-z0-9.-]+$/i.test(raw)) return true;
  return false;
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
