/**
 * Guided website diagnostics — isolate-local pending only.
 * No persistent sessions. No URLs in callback_data.
 */

import { normalizeUrlArg } from "./normalize.js";

const PENDING_TTL_MS = 5 * 60 * 1000;
const MAX_PENDING = 200;

/** @type {Map<string, object>} */
const pendingByChat = new Map();

function nowMs() {
  return Date.now();
}

function prune(now = nowMs()) {
  for (const [k, v] of pendingByChat) {
    if (!v || v.expiresAt <= now) pendingByChat.delete(k);
  }
  while (pendingByChat.size > MAX_PENDING) {
    const first = pendingByChat.keys().next().value;
    pendingByChat.delete(first);
  }
}

function touch(entry) {
  entry.expiresAt = nowMs() + PENDING_TTL_MS;
  return entry;
}

export function setAwaitTarget(chatId) {
  if (chatId == null) return;
  prune();
  pendingByChat.set(String(chatId), {
    mode: "await_target",
    expiresAt: nowMs() + PENDING_TTL_MS,
  });
}

export function setPendingAudit(chatId) {
  setAwaitTarget(chatId);
}

export function setDiagTarget(chatId, url, display, lastAction = null) {
  if (chatId == null || !url) return;
  prune();
  const prev = pendingByChat.get(String(chatId));
  pendingByChat.set(String(chatId), {
    mode: "diag",
    url: String(url),
    display: String(display || url),
    lastAction:
      lastAction ||
      (prev && prev.mode === "diag" ? prev.lastAction : null) ||
      null,
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
  if (e.expiresAt <= nowMs()) {
    pendingByChat.delete(String(chatId));
    return null;
  }
  return e;
}

export function peekPending(chatId) {
  const e = getGuidedState(chatId);
  if (!e) return null;
  if (e.mode === "await_target") return "audit";
  return null;
}

export function getDiagTarget(chatId) {
  const e = getGuidedState(chatId);
  if (!e || e.mode !== "diag") return null;
  return {
    url: e.url,
    display: e.display,
    lastAction: e.lastAction || null,
  };
}

export function refreshDiagTarget(chatId) {
  const e = getGuidedState(chatId);
  if (!e || e.mode !== "diag") return null;
  touch(e);
  pendingByChat.set(String(chatId), e);
  return {
    url: e.url,
    display: e.display,
    lastAction: e.lastAction || null,
  };
}

export function clearPending(chatId) {
  if (chatId == null) return;
  pendingByChat.delete(String(chatId));
}

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

export function checkAnotherPromptText() {
  return [
    "🌐 Check Another Website",
    "",
    "Send a domain or URL:",
    "• example.com",
    "• https://example.com",
  ].join("\n");
}

export function diagnosticMenuText(display) {
  return [
    "🔎 Website Diagnostics",
    `🌐 ${display}`,
    "",
    "Choose what you want to check:",
  ].join("\n");
}

export function diagnosticMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🛡 Security", callback_data: "diag:security" },
        { text: "🔍 SEO", callback_data: "diag:seo" },
      ],
      [
        { text: "📱 Mobile", callback_data: "diag:mobile" },
        { text: "✉️ Email", callback_data: "diag:email" },
      ],
      [
        { text: "🔐 HTTPS", callback_data: "diag:https" },
        { text: "🌐 DNS", callback_data: "diag:dns" },
      ],
      [
        { text: "🤖 Robots", callback_data: "diag:robots" },
        { text: "🗺 Sitemap", callback_data: "diag:sitemap" },
      ],
      [{ text: "📊 Full Audit", callback_data: "diag:audit" }],
      [
        { text: "🌐 Check Another", callback_data: "result:another" },
        { text: "⬅️ Back", callback_data: "diag:back" },
      ],
    ],
  };
}

export function diagnosticResultKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔄 Re-run", callback_data: "result:rerun" },
        { text: "🔎 Full Audit", callback_data: "result:fullaudit" },
      ],
      [{ text: "🌐 Check Another", callback_data: "result:another" }],
      [{ text: "⬅️ Back", callback_data: "result:back" }],
    ],
  };
}

/** Compact fail actions — Retry + Back only. */
export function diagnosticFailKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔄 Retry", callback_data: "result:rerun" },
        { text: "⬅️ Back", callback_data: "result:back" },
      ],
    ],
  };
}

export function guidedInvalidMessage(detail) {
  const d = detail ? String(detail).trim() : "";
  const lines = ["⚠️ That does not look like a website address."];
  if (d) lines.push(d);
  lines.push(
    "",
    "Try again with a domain or URL:",
    "• example.com",
    "• https://example.com"
  );
  return lines.join("\n");
}

export function expiredGuidedMessage() {
  return [
    "⏳ That check session expired.",
    "",
    "Tap 🌐 Check Another or 🔎 Check a Website and send the address again.",
  ].join("\n");
}

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

  if (/\s/.test(raw)) {
    return {
      ok: false,
      message: guidedInvalidMessage("Addresses cannot contain spaces."),
    };
  }

  if (/^(ftp|file|javascript|data|blob|ws|wss):/i.test(raw)) {
    return {
      ok: false,
      message: guidedInvalidMessage("Only http and https URLs are supported."),
    };
  }

  const n = normalizeUrlArg(raw);
  if (!n.ok) {
    return { ok: false, message: guidedInvalidMessage(n.message) };
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

  if (!hostname.includes(".")) {
    return {
      ok: false,
      message: guidedInvalidMessage(
        "Use a full domain name (for example example.com)."
      ),
    };
  }

  if (!/^[a-z0-9._-]+$/i.test(hostname)) {
    return {
      ok: false,
      message: guidedInvalidMessage("That domain contains invalid characters."),
    };
  }

  return { ok: true, url: n.url, display: hostname };
}

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

export function recoverDiagDisplayFromMessage(text) {
  if (typeof text !== "string") return null;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("🌐 ")) {
      const host = t.slice(2).trim();
      if (host && !/\s/.test(host)) return host;
    }
  }
  return null;
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

export const DIAG_ACTIONS = {
  "diag:security": {
    label: "Security",
    path: "/api/headers",
    arg: "url",
    command: "headers",
  },
  "diag:seo": {
    label: "SEO",
    path: "/api/website",
    arg: "url",
    command: "website",
  },
  "diag:mobile": {
    label: "Mobile",
    path: "/api/mobile",
    arg: "url",
    command: "mobile",
  },
  "diag:email": {
    label: "Email",
    path: "/api/email",
    arg: "domain",
    command: "email",
  },
  "diag:https": {
    label: "HTTPS",
    path: "/api/ssl",
    arg: "url",
    command: "ssl",
  },
  "diag:dns": {
    label: "DNS",
    path: "/api/dns",
    arg: "domain",
    command: "dns",
  },
  "diag:robots": {
    label: "Robots",
    path: "/api/robots",
    arg: "url",
    command: "robots",
  },
  "diag:sitemap": {
    label: "Sitemap",
    path: "/api/sitemap",
    arg: "sitemap",
    command: "sitemap",
  },
  "diag:audit": {
    label: "Full Audit",
    path: "/api/audit",
    arg: "url",
    command: "audit",
  },
};
