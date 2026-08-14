/**
 * Lightweight command-argument normalization for the Telegram client.
 * Cloud Engine remains the authoritative SSRF/domain validator.
 */

const UNSUPPORTED = /^(ftp|file|javascript|data|blob|ws|wss):/i;

/**
 * Normalize user input for URL-based tools.
 * @param {string} input
 * @returns {{ ok: true, url: string } | { ok: false, message: string }}
 */
export function normalizeUrlArg(input) {
  if (input == null || typeof input !== "string") {
    return { ok: false, message: "Please provide a URL." };
  }
  let raw = input.trim();
  if (!raw) return { ok: false, message: "Please provide a URL." };
  if (UNSUPPORTED.test(raw)) {
    return {
      ok: false,
      message: "Only http and https URLs are supported.",
    };
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    raw = "https://" + raw;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return {
        ok: false,
        message: "Only http and https URLs are supported.",
      };
    }
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, message: "Please provide a valid URL." };
  }
}

/**
 * Domain-only args for /dns and /email.
 * @param {string} input
 * @returns {{ ok: true, domain: string } | { ok: false, message: string }}
 */
export function normalizeDomainArg(input) {
  if (input == null || typeof input !== "string") {
    return { ok: false, message: "Please provide a domain (e.g. example.com)." };
  }
  const raw = input.trim();
  if (!raw) {
    return { ok: false, message: "Please provide a domain (e.g. example.com)." };
  }
  if (/:\/\//.test(raw) || /[/?#@\\]/.test(raw)) {
    return {
      ok: false,
      message: "Please provide a domain, not a URL (e.g. example.com).",
    };
  }
  return { ok: true, domain: raw };
}

/**
 * Recover audited host/URL from a previous audit message body.
 * @param {string|undefined} text
 * @returns {string|null} https URL or null
 */
export function recoverAuditTargetFromMessage(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // formatAudit: line0 title, line1 domain or url
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (line.startsWith("🔎") || line.toLowerCase().startsWith("website audit"))
      continue;
    if (line.startsWith("Overall:")) continue;
    // domain or URL-looking line
    if (/^https?:\/\//i.test(line)) {
      const n = normalizeUrlArg(line);
      return n.ok ? n.url : null;
    }
    if (/^[a-z0-9._-]+\.[a-z]{2,}$/i.test(line) && !/\s/.test(line)) {
      const n = normalizeUrlArg(line);
      return n.ok ? n.url : null;
    }
  }
  return null;
}

export const AUDIT_CALLBACKS = new Set([
  "audit:rerun",
  "audit:security",
  "audit:seo",
  "audit:mobile",
  "audit:email",
  "audit:https",
]);

export function parseCallbackAction(data) {
  if (typeof data !== "string") return null;
  const s = data.trim();
  if (!s || s.length > 64) return null;
  // Only fixed identifiers — no URLs/secrets in callback_data
  if (!AUDIT_CALLBACKS.has(s)) return null;
  return s;
}
