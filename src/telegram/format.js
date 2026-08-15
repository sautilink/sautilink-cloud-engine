/** Plain-text formatters and public error vocabulary. */

import { MAX_TELEGRAM_TEXT } from "./config.js";
import { formatHelpFromRegistry } from "./registry.js";
import {
  formatAuditReport,
  formatAuditSummary,
  formatAuditPriorities,
  formatCategoryDetail,
  auditReportKeyboard,
  auditBackKeyboard,
  truncateSafe,
} from "./audit_report.js";

export function truncate(text, max = MAX_TELEGRAM_TEXT) {
  return truncateSafe(text, max);
}

export function formatEngineError(err) {
  const code = err && err.code ? String(err.code) : "ERROR";
  return truncate(mapUserError(code, err && err.message));
}

function mapUserError(code, message) {
  switch (code) {
    case "PRIVATE_ADDRESS_BLOCKED":
    case "SSRF_BLOCKED":
      return "🔒 Private or local addresses are not allowed.";
    case "CREDENTIALS_NOT_ALLOWED":
      return "⚠️ Invalid URL.\n\nURLs must not contain usernames or passwords.";
    case "UNSUPPORTED_PROTOCOL":
      return "⚠️ Only HTTP and HTTPS URLs are supported.";
    case "INVALID_URL":
    case "MISSING_URL":
      return "⚠️ Invalid URL.\n\nUse:\n/audit https://example.com";
    case "INVALID_DOMAIN":
    case "MISSING_DOMAIN":
      return "⚠️ Invalid input.\n\nUse:\n/dns example.com";
    case "INVALID_SELECTOR":
      return "⚠️ Invalid DKIM selector.";
    case "ENGINE_TIMEOUT":
    case "REQUEST_TIMEOUT":
      return "⏳ The check took too long. Please try again.";
    case "ENGINE_NETWORK":
    case "ENGINE_UNEXPECTED":
    case "ENGINE_BAD_JSON":
    case "ENGINE_HTTP_ERROR":
      return "🔴 Cloud Engine is temporarily unavailable.";
    case "RATE_LIMITED":
    case "TELEGRAM_RATE_LIMITED":
      return "🚦 Temporarily rate-limited. Please try again shortly.";
    default: {
      const msg = String(message || "Something went wrong.")
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
        .slice(0, 200);
      return `⚠️ ${msg}`;
    }
  }
}

export function formatTimeout() {
  return "⏳ The check took too long. Please try again.";
}

export function formatHelp() {
  return [
    formatHelpFromRegistry(),
    "",
    "💡 You can also use the menu below to explore tools.",
  ].join("\n");
}

export function formatStart() {
  return [
    "🚀 SautiLink Cloud Engine",
    "",
    "Website, DNS, email, security and infrastructure checks.",
    "",
    "Choose a tool below or use /help.",
    "Try: /audit example.com",
  ].join("\n");
}

export function formatAbout() {
  return [
    "About SautiLink Cloud Engine",
    "",
    "Automated website, DNS, email, HTTPS, and SEO configuration checks.",
    "",
    "Not a pentest, vulnerability scanner, Lighthouse report,",
    "Google ranking tool, or certification authority.",
    "",
    "Web: https://cloudengine.sautilink.com",
  ].join("\n");
}

export function formatStatus(ok) {
  if (!ok) {
    return ["🔴 SautiLink Cloud Engine", "", "Status: Unavailable"].join("\n");
  }
  return ["🟢 SautiLink Cloud Engine", "", "Status: Operational"].join("\n");
}

export function formatId(chat, from) {
  const lines = ["Diagnostic identifiers only:"];
  if (chat && chat.id != null) lines.push(`Your Telegram chat ID:\n${chat.id}`);
  else if (from && from.id != null) lines.push(`Your Telegram user ID:\n${from.id}`);
  lines.push("", "/id is for debugging. No tokens or server details are shown.");
  return lines.join("\n");
}

/**
 * Admin-only operational snapshot — no secrets.
 * Exported for commands.js (/admin). Required by Pages Functions bundle.
 */
export function formatAdmin(info) {
  const engine = info.engineOk
    ? "🟢 Engine: Operational"
    : "🔴 Engine: Unavailable";
  return [
    "🛠 Cloud Engine Admin",
    "",
    engine,
    "",
    "Bot:",
    "• Webhook: Active (secret required)",
    "• Usage protection: Active (isolate-local)",
    "• Deduplication: Active (isolate-local)",
    "• Cooldown: Active (isolate-local)",
    "",
    "Runtime:",
    `• Local tracked chats: ${info.trackedChats ?? 0}/${info.maxTracked ?? "?"}`,
    `• Window: ${info.windowSeconds ?? "?"}s`,
    `• Expensive limit: ${info.expensiveLimit ?? "?"}`,
    `• Cheap limit: ${info.cheapLimit ?? "?"}`,
    "",
    "Cloudflare edge rate limiting remains the global control.",
  ].join("\n");
}

export function formatAudit(data) {
  return formatAuditReport(data || {});
}

export function formatAuditSummaryView(data) {
  return formatAuditSummary(data || {});
}

export function formatAuditPrioritiesView(data) {
  return formatAuditPriorities(data || {});
}

export function formatAuditCategory(data, categoryKey) {
  return formatCategoryDetail(data || {}, categoryKey);
}

export function auditKeyboard() {
  return auditReportKeyboard();
}

export function auditDetailKeyboard() {
  return auditBackKeyboard();
}

export function formatDns(data) {
  const domain = data.domain || "";
  const records = data.records || {};
  const lines = [`DNS · ${domain}`, ""];
  for (const [type, vals] of Object.entries(records)) {
    const list = Array.isArray(vals) ? vals : [];
    if (!list.length) {
      lines.push(`${type}: (none)`);
      continue;
    }
    lines.push(`${type}:`);
    for (const v of list.slice(0, 8)) lines.push(`  ${v}`);
    if (list.length > 8) lines.push(`  … +${list.length - 8} more`);
  }
  return truncate(lines.join("\n"));
}

export function formatEmail(data) {
  const domain = data.domain || "";
  const score = data.score || {};
  const lines = [
    `Email · ${domain}`,
    `Score: ${score.total ?? "—"}/${score.max ?? 100} — ${score.grade || ""}`,
    "",
  ];
  if (data.mx) lines.push(`MX: ${data.mx.status || (data.mx.found ? "found" : "n/a")}`);
  if (data.spf) lines.push(`SPF: ${data.spf.status || (data.spf.found ? "found" : "n/a")}`);
  if (data.dmarc) lines.push(`DMARC: ${data.dmarc.status || (data.dmarc.found ? "found" : "n/a")}`);
  if (data.dkim)
    lines.push(
      `DKIM: ${data.dkim.status || (data.dkim.found ? "found" : "n/a")}${data.dkim.selector ? ` (${data.dkim.selector})` : ""}`
    );
  const findings = (score.findings || data.findings || []).slice(0, 5);
  if (findings.length) {
    lines.push("", "Findings:");
    for (const f of findings) lines.push(`• ${f.title || f.code}`);
  }
  return truncate(lines.join("\n"));
}

export function formatHeaders(data) {
  const sec = data.security || data.score || {};
  const lines = [
    "HTTP Headers",
    data.finalUrl || data.url || "",
    `Security score: ${sec.score ?? sec.total ?? "—"}/100 — ${sec.grade || ""}`,
    "",
  ];
  for (const f of (sec.findings || []).slice(0, 6)) lines.push(`• ${f.title || f.code}`);
  return truncate(lines.join("\n"));
}

export function formatSsl(data) {
  const score = data.score || {};
  const a = data.analysis || {};
  const https = a.https || {};
  const hsts = a.hsts || {};
  const lines = [
    "HTTPS / HSTS",
    data.url || "",
    `Score: ${score.total ?? "—"}/100 — ${score.grade || ""}`,
    `HTTPS: ${https.available ? "available" : "not available"}`,
    `HSTS: ${hsts.present ? `yes (max-age=${hsts.maxAge ?? "?"})` : "no"}`,
  ];
  return truncate(lines.join("\n"));
}

export function formatWebsite(data) {
  const score = data.score || {};
  const seo = data.seo || {};
  const lines = [
    "Website SEO",
    data.finalUrl || data.url || "",
    `Score: ${score.total ?? "—"}/100 — ${score.grade || ""}`,
    `Title: ${(seo.title || "").slice(0, 80) || "—"}`,
    `Status: ${data.status ?? "—"}`,
  ];
  for (const f of (score.findings || []).slice(0, 5)) lines.push(`• ${f.title || f.code}`);
  return truncate(lines.join("\n"));
}

export function formatMobile(data) {
  const score = data.score || {};
  const lines = [
    "Mobile heuristics",
    data.finalUrl || data.url || "",
    `Score: ${score.total ?? "—"}/100 — ${score.grade || ""}`,
  ];
  for (const f of (score.findings || []).slice(0, 5)) lines.push(`• ${f.title || f.code}`);
  return truncate(lines.join("\n"));
}

export function formatRobots(data) {
  const score = data.score || {};
  const lines = [
    "robots.txt",
    data.robotsUrl || data.url || "",
    `Status: ${data.status ?? "—"}`,
    `Score: ${score.total ?? "—"}/100`,
  ];
  for (const f of (score.findings || []).slice(0, 5)) lines.push(`• ${f.title || f.code}`);
  return truncate(lines.join("\n"));
}

export function formatSitemap(data) {
  const score = data.score || {};
  const lines = [
    "Sitemap",
    data.url || "",
    `Score: ${score.total ?? "—"}/100 — ${score.grade || ""}`,
  ];
  for (const f of (score.findings || []).slice(0, 5)) lines.push(`• ${f.title || f.code}`);
  return truncate(lines.join("\n"));
}

export function formatHttp(data) {
  const lines = [
    "HTTP status",
    data.finalUrl || data.url || "",
    `Status: ${data.status ?? "—"} ${data.statusText || ""}`,
    `Protocol: ${data.protocol || "—"}`,
    `Redirects: ${data.redirectCount ?? 0}`,
    `Time: ${data.responseTimeMs ?? "—"} ms`,
  ];
  return truncate(lines.join("\n"));
}
