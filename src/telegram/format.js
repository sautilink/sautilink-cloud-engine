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
    case "INVALID_URL":
    case "INVALID_DOMAIN":
      return "⚠️ Please provide a valid public domain or URL.";
    case "RATE_LIMITED":
      return "🚦 Temporarily rate-limited. Please try again shortly.";
    case "ENGINE_TIMEOUT":
    case "REQUEST_TIMEOUT":
      return "⏳ The check took too long. Please try again.";
    case "ENGINE_NETWORK":
      return "⚠️ Could not reach Cloud Engine. Please try again.";
    case "BOT_NOT_CONFIGURED":
      return "⚠️ This bot is not fully configured yet.";
    default:
      return (
        "⚠️ Something went wrong.\n" +
        (message ? String(message).slice(0, 180) : "Please try again.")
      );
  }
}

export function formatTimeout() {
  return "⏳ The check took too long. Please try again.";
}

export function formatHelp() {
  return formatHelpFromRegistry();
}

export function formatStart() {
  return [
    "🚀 SautiLink Cloud Engine",
    "",
    "Website, DNS, email, security and infrastructure checks from Telegram.",
    "",
    "Try:",
    "/audit example.com",
    "",
    "Use /help to see all available tools.",
  ].join("\n");
}

export function formatAbout() {
  return [
    "ℹ️ SautiLink Cloud Engine",
    "",
    "Automated website, DNS, email, HTTPS, and SEO configuration checks.",
    "",
    "This is a configuration assessment — not a ranking score or penetration test.",
    "",
    "https://cloudengine.sautilink.com",
  ].join("\n");
}

export function formatStatus(ok, data) {
  if (!ok) return "Status: unavailable";
  const s = data && data.status ? data.status : "ok";
  const v = data && data.version ? data.version : "";
  return [`🟢 Cloud Engine status: ${s}`, v ? `Version: ${v}` : ""]
    .filter(Boolean)
    .join("\n");
}

export function formatId(chat, from) {
  const lines = ["Your Telegram IDs"];
  if (chat && chat.id != null) lines.push(`Chat: ${chat.id}`);
  if (from && from.id != null) lines.push(`User: ${from.id}`);
  if (from && from.username) lines.push(`Username: @${from.username}`);
  return lines.join("\n");
}

export function formatAdmin(info) {
  const lines = ["Admin"];
  if (info && info.role) lines.push(`Role: ${info.role}`);
  if (info && info.note) lines.push(String(info.note));
  return lines.join("\n");
}

export function formatAudit(data) {
  return formatAuditReport(data);
}

export function formatAuditSummaryView(data) {
  return formatAuditSummary(data);
}

export function formatAuditPrioritiesView(data) {
  return formatAuditPriorities(data);
}

export function formatAuditCategory(data, categoryKey) {
  return formatCategoryDetail(data, categoryKey);
}

export function formatDns(data) {
  const domain = data.domain || "";
  const lines = [`DNS · ${domain}`];
  const records = data.records || data;
  for (const [type, list] of Object.entries(records)) {
    if (!Array.isArray(list) || !list.length) continue;
    if (["domain", "normalized", "query", "resolver"].includes(type)) continue;
    lines.push(`${type}:`);
    for (const v of list.slice(0, 8)) lines.push(`  ${v}`);
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

/** Extract display text from SEO field that may be a string or { value }. */
function seoFieldText(field) {
  if (field == null) return "";
  if (typeof field === "string") return field;
  if (typeof field === "object") {
    if (field.value != null) return String(field.value);
    if (field.content != null) return String(field.content);
  }
  return "";
}

export function formatWebsite(data) {
  const score = data.score || {};
  const seo = data.seo || {};
  const title = seoFieldText(seo.title).slice(0, 80);
  const lines = [
    "Website SEO",
    data.finalUrl || data.url || "",
    `Score: ${score.total ?? "—"}/100 — ${score.grade || ""}`,
    `Title: ${title || "—"}`,
    `Status: ${data.status ?? "—"}`,
  ];
  for (const f of (score.findings || []).slice(0, 5)) {
    lines.push(`• ${f.title || f.code || "finding"}`);
  }
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

export function auditKeyboard() {
  return auditReportKeyboard();
}

export function auditDetailKeyboard() {
  return auditBackKeyboard();
}
