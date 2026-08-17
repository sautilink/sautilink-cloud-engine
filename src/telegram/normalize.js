/**
 * Lightweight command-argument normalization for the Telegram client.
 * Cloud Engine remains the authoritative SSRF/domain validator.
 */

const UNSUPPORTED = /^(ftp|file|javascript|data|blob|ws|wss):/i;

export function normalizeUrlArg(input) {
  if (input == null || typeof input !== "string") return { ok: false, message: "Please provide a URL." };
  let raw = input.trim();
  if (!raw) return { ok: false, message: "Please provide a URL." };
  if (UNSUPPORTED.test(raw)) return { ok: false, message: "Only http and https URLs are supported." };
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) raw = "https://" + raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, message: "Only http and https URLs are supported." };
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, message: "Please provide a valid URL." };
  }
}

export function normalizeDomainArg(input) {
  if (input == null || typeof input !== "string") return { ok: false, message: "Please provide a domain (e.g. example.com)." };
  const raw = input.trim();
  if (!raw) return { ok: false, message: "Please provide a domain (e.g. example.com)." };
  if (/:\/\//.test(raw) || /[/?#@\\]/.test(raw)) return { ok: false, message: "Please provide a domain, not a URL (e.g. example.com)." };
  return { ok: true, domain: raw };
}

export function recoverAuditTargetFromMessage(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];
    if (line.startsWith("🔎") || line.toUpperCase().includes("WEBSITE AUDIT") || line.toUpperCase().includes("UKAGUZI WA TOVUTI")) continue;
    if (line.startsWith("⭐") || line.startsWith("Overall:") || line.startsWith("Alama ya Jumla:")) continue;
    if (line.startsWith("🌐 ")) {
      const host = line.slice(2).trim();
      const n = normalizeUrlArg(host);
      return n.ok ? n.url : null;
    }
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

export const ALLOWED_CALLBACKS = new Set([
  "menu:main", "menu:website", "menu:infrastructure", "menu:about", "menu:help", "menu:status", "menu:lang",
  "nav:back", "status:refresh", "lang:en", "lang:sw",
  "tool:audit", "tool:website", "tool:mobile", "tool:headers", "tool:ssl", "tool:robots", "tool:sitemap", "tool:dns", "tool:email", "tool:http",
  "audit:rerun", "audit:security", "audit:seo", "audit:mobile", "audit:email", "audit:https", "audit:summary", "audit:priorities", "audit:back",
  "diag:security", "diag:seo", "diag:mobile", "diag:email", "diag:https", "diag:dns", "diag:robots", "diag:sitemap", "diag:audit", "diag:back", "diag:menu",
  "result:rerun", "result:fullaudit", "result:another", "result:back",
]);

export const AUDIT_CALLBACKS = new Set([
  "audit:rerun", "audit:security", "audit:seo", "audit:mobile", "audit:email", "audit:https", "audit:summary", "audit:priorities", "audit:back",
]);

export function parseCallbackAction(data) {
  if (typeof data !== "string") return null;
  const s = data.trim();
  if (!s || s.length > 64) return null;
  if (!ALLOWED_CALLBACKS.has(s)) return null;
  return s;
}
