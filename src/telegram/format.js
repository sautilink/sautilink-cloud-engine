/** Plain-text formatters and public error vocabulary. */

import { MAX_TELEGRAM_TEXT } from "./config.js";
import { formatHelpFromRegistry } from "./registry.js";
import { t } from "./i18n/index.js";
import {
  formatAuditReport,
  formatAuditSummary,
  formatAuditPriorities,
  formatCategoryDetail,
  auditReportKeyboard,
  auditBackKeyboard,
  truncateSafe,
} from "./audit_report.js";

export function truncate(text, max = MAX_TELEGRAM_TEXT) { return truncateSafe(text, max); }

export function formatEngineError(err, locale = "en") {
  const code = err && err.code ? String(err.code) : "ERROR";
  return truncate(mapUserError(code, err && err.message, locale));
}

function mapUserError(code, message, locale) {
  switch (code) {
    case "PRIVATE_ADDRESS_BLOCKED":
    case "SSRF_BLOCKED": return t(locale, "error.private");
    case "CREDENTIALS_NOT_ALLOWED": return t(locale, "error.credentials");
    case "INVALID_URL":
    case "INVALID_DOMAIN": return t(locale, "error.invalid_public");
    case "RATE_LIMITED": return t(locale, "error.rate");
    case "ENGINE_TIMEOUT":
    case "REQUEST_TIMEOUT": return t(locale, "error.timeout");
    case "ENGINE_NETWORK": return t(locale, "error.network");
    case "BOT_NOT_CONFIGURED": return t(locale, "error.not_configured");
    default: return t(locale, "error.generic", { message: message ? String(message).slice(0, 180) : locale === "sw" ? "Tafadhali jaribu tena." : "Please try again." });
  }
}

export function formatTimeout(locale = "en") { return t(locale, "error.timeout"); }
export function formatHelp(locale = "en") { return formatHelpFromRegistry(locale); }

export function formatStart(locale = "en") {
  const company = locale === "sw"
    ? "🏢 Product ya SautiLink Corporation · sautilink.com"
    : "🏢 A SautiLink Corporation product · sautilink.com";
  return ["🚀 SautiLink Cloud Engine", "", t(locale, "start.body"), "", t(locale, "start.try"), "/audit example.com", "", t(locale, "start.help"), "", company].join("\n");
}

export function formatAbout(locale = "en") {
  const ownership = locale === "sw"
    ? "SautiLink Cloud Engine ni sehemu ya SautiLink Corporation."
    : "SautiLink Cloud Engine is part of SautiLink Corporation.";
  const architecture = locale === "sw"
    ? "Kwa maswali ya integration au architecture, wasiliana na SautiLink Corporation."
    : "For integration or architecture enquiries, contact SautiLink Corporation.";
  return ["ℹ️ SautiLink Cloud Engine", "", t(locale, "about.body"), "", t(locale, "about.disclaimer"), "", ownership, architecture, "", "https://cloudengine.sautilink.com", "https://sautilink.com"].join("\n");
}

export function formatStatus(ok, data, locale = "en") {
  if (!ok) return t(locale, "status.unavailable");
  const s = data && data.status ? data.status : "ok";
  const v = data && data.version ? data.version : "";
  return [t(locale, "status.ok", { status: s }), v ? t(locale, "status.version", { version: v }) : ""].filter(Boolean).join("\n");
}

export function formatId(chat, from, locale = "en") {
  const lines = [t(locale, "id.title")];
  if (chat && chat.id != null) lines.push(t(locale, "id.chat", { id: chat.id }));
  if (from && from.id != null) lines.push(t(locale, "id.user", { id: from.id }));
  if (from && from.username) lines.push(t(locale, "id.username", { username: from.username }));
  return lines.join("\n");
}

export function formatAdmin(info, locale = "en") {
  const lines = [t(locale, "admin.title"), "", `${info && info.engineOk ? "🟢" : "🔴"} Engine: ${info && info.engineOk ? "Operational" : "Unavailable"}`, "", "Bot:", "• Webhook: Active (secret required)", "• Usage protection: Active (isolate-local)", "• Deduplication: Active (isolate-local)", "• Cooldown: Active (isolate-local)", "", "Runtime:"];
  if (info) {
    lines.push(`• Local tracked chats: ${info.trackedChats ?? 0}/${info.maxTracked ?? 500}`);
    lines.push(`• Window: ${info.windowSeconds ?? 60}s`);
    lines.push(`• Expensive limit: ${info.expensiveLimit ?? 5}`);
    lines.push(`• Cheap limit: ${info.cheapLimit ?? 20}`);
  }
  lines.push("", "SautiLink global protection remains active.");
  return lines.join("\n");
}

export function formatAudit(data, locale = "en") { return formatAuditReport(data, locale); }
export function formatAuditSummaryView(data, locale = "en") { return formatAuditSummary(data, locale); }
export function formatAuditPrioritiesView(data, locale = "en") { return formatAuditPriorities(data, locale); }
export function formatAuditCategory(data, categoryKey, locale = "en") { return formatCategoryDetail(data, categoryKey, locale); }

export function formatDns(data, locale = "en") {
  const domain = data.domain || "";
  const lines = [`DNS · ${domain}`];
  const records = data.records || data;
  for (const [type, list] of Object.entries(records)) {
    if (!Array.isArray(list) || !list.length || ["domain", "normalized", "query", "resolver"].includes(type)) continue;
    lines.push(`${type}:`);
    for (const v of list.slice(0, 8)) lines.push(`  ${v}`);
  }
  return truncate(lines.join("\n"));
}

export function formatEmail(data, locale = "en") {
  const domain = data.domain || "";
  const score = data.score || {};
  const lines = [`${t(locale, "menu.email").replace(/^✉️\s*/, "")} · ${domain}`, t(locale, "report.score", { score: score.total ?? "—", max: score.max ?? 100, grade: score.grade || "" }), ""];
  if (data.mx) lines.push(`MX: ${data.mx.status || (data.mx.found ? "found" : "n/a")}`);
  if (data.spf) lines.push(`SPF: ${data.spf.status || (data.spf.found ? "found" : "n/a")}`);
  if (data.dmarc) lines.push(`DMARC: ${data.dmarc.status || (data.dmarc.found ? "found" : "n/a")}`);
  if (data.dkim) lines.push(`DKIM: ${data.dkim.status || (data.dkim.found ? "found" : "n/a")}${data.dkim.selector ? ` (${data.dkim.selector})` : ""}`);
  const findings = (score.findings || data.findings || []).slice(0, 5);
  if (findings.length) {
    lines.push("", t(locale, "report.findings"));
    for (const f of findings) lines.push(`• ${f.title || f.code}`);
  }
  return truncate(lines.join("\n"));
}

export function formatHeaders(data, locale = "en") {
  const sec = data.security || data.score || {};
  const lines = [t(locale, "report.http_headers"), data.finalUrl || data.url || "", t(locale, "report.security_score", { score: sec.score ?? sec.total ?? "—", grade: sec.grade || "" }), ""];
  for (const f of (sec.findings || []).slice(0, 6)) lines.push(`• ${f.title || f.code}`);
  return truncate(lines.join("\n"));
}

export function formatSsl(data, locale = "en") {
  const score = data.score || {};
  const a = data.analysis || {};
  const https = a.https || {};
  const hsts = a.hsts || {};
  const lines = [
    t(locale, "report.https_hsts"),
    data.url || "",
    t(locale, "report.score", { score: score.total ?? "—", max: 100, grade: score.grade || "" }),
    `HTTPS: ${https.available ? t(locale, "report.available") : t(locale, "report.not_available")}`,
    `HSTS: ${hsts.present ? `${t(locale, "report.yes")} (max-age=${hsts.maxAge ?? "?"})` : t(locale, "report.no")}`,
  ];
  return truncate(lines.join("\n"));
}

function seoFieldText(field) {
  if (field == null) return "";
  if (typeof field === "string") return field;
  if (typeof field === "object") {
    if (field.value != null) return String(field.value);
    if (field.content != null) return String(field.content);
  }
  return "";
}

export function formatWebsite(data, locale = "en") {
  const score = data.score || {};
  const seo = data.seo || {};
  const title = seoFieldText(seo.title).slice(0, 80);
  const lines = [
    t(locale, "report.website_seo"),
    data.finalUrl || data.url || "",
    t(locale, "report.score", { score: score.total ?? "—", max: 100, grade: score.grade || "" }),
    t(locale, "report.title", { title: title || "—" }),
    t(locale, "report.status", { status: data.status ?? "—" }),
  ];
  for (const f of (score.findings || []).slice(0, 5)) lines.push(`• ${f.title || f.code || "finding"}`);
  return truncate(lines.join("\n"));
}

export function formatMobile(data, locale = "en") {
  const score = data.score || {};
  const lines = [t(locale, "report.mobile"), data.finalUrl || data.url || "", t(locale, "report.score", { score: score.total ?? "—", max: 100, grade: score.grade || "" })];
  for (const f of (score.findings || []).slice(0, 5)) lines.push(`• ${f.title || f.code}`);
  return truncate(lines.join("\n"));
}

export function formatRobots(data, locale = "en") {
  const score = data.score || {};
  const lines = ["robots.txt", data.robotsUrl || data.url || "", t(locale, "report.status", { status: data.status ?? "—" }), t(locale, "report.score", { score: score.total ?? "—", max: 100, grade: score.grade || "" })];
  for (const f of (score.findings || []).slice(0, 5)) lines.push(`• ${f.title || f.code}`);
  return truncate(lines.join("\n"));
}

export function formatSitemap(data, locale = "en") {
  const score = data.score || {};
  const lines = [t(locale, "report.sitemap"), data.url || "", t(locale, "report.score", { score: score.total ?? "—", max: 100, grade: score.grade || "" })];
  for (const f of (score.findings || []).slice(0, 5)) lines.push(`• ${f.title || f.code}`);
  return truncate(lines.join("\n"));
}

export function formatHttp(data, locale = "en") {
  const lines = [
    t(locale, "report.http_status"),
    data.finalUrl || data.url || "",
    t(locale, "report.status", { status: `${data.status ?? "—"} ${data.statusText || ""}`.trim() }),
    t(locale, "report.protocol", { protocol: data.protocol || "—" }),
    t(locale, "report.redirects", { count: data.redirectCount ?? 0 }),
    t(locale, "report.time", { ms: data.responseTimeMs ?? "—" }),
  ];
  return truncate(lines.join("\n"));
}

export function auditKeyboard(locale = "en") { return auditReportKeyboard(locale); }
export function auditDetailKeyboard(locale = "en") { return auditBackKeyboard(locale); }
