/**
 * Plain-text formatters for Telegram (no Markdown injection risk).
 */

import { MAX_TELEGRAM_TEXT } from "./config.js";

export function truncate(text, max = MAX_TELEGRAM_TEXT) {
  const s = String(text || "");
  if (s.length <= max) return s;
  return s.slice(0, max - 20) + "\n… (truncated)";
}

export function formatEngineError(err) {
  const code = err && err.code ? String(err.code) : "ERROR";
  const message =
    err && err.message ? String(err.message) : "Something went wrong.";
  const friendly = mapCode(code, message);
  return truncate(`❌ I couldn't complete that request.\nReason: ${friendly}`);
}

function mapCode(code, message) {
  switch (code) {
    case "PRIVATE_ADDRESS_BLOCKED":
    case "SSRF_BLOCKED":
      return "Private/internal address blocked.";
    case "CREDENTIALS_NOT_ALLOWED":
      return "URLs must not contain usernames or passwords.";
    case "UNSUPPORTED_PROTOCOL":
      return "Only http and https are supported.";
    case "INVALID_URL":
    case "MISSING_URL":
      return "Please provide a valid public URL.";
    case "INVALID_DOMAIN":
    case "MISSING_DOMAIN":
      return "Please provide a valid domain (e.g. example.com).";
    case "INVALID_SELECTOR":
      return "Invalid DKIM selector.";
    case "ENGINE_TIMEOUT":
    case "REQUEST_TIMEOUT":
      return "The check timed out. Try again shortly.";
    case "ENGINE_NETWORK":
      return "Could not reach Cloud Engine.";
    case "RATE_LIMITED":
      return "Service is temporarily rate-limited. Please try again shortly.";
    default:
      return message.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").slice(0, 300);
  }
}

export function formatHelp() {
  return [
    "SautiLink Cloud Engine Bot",
    "",
    "Commands:",
    "/start — welcome",
    "/help — this help",
    "/id — your chat id (debug)",
    "/audit <url> — unified website audit",
    "/dns <domain> — DNS lookup",
    "/email <domain> — email infrastructure",
    "/headers <url> — security headers",
    "/ssl <url> — HTTPS / HSTS",
    "/website <url> — on-page SEO",
    "/mobile <url> — mobile heuristics",
    "/robots <url> — robots.txt",
    "/sitemap <url> — sitemap.xml",
    "/http <url> — HTTP status",
    "",
    "Examples:",
    "/audit https://example.com",
    "/dns example.com",
    "",
    "Checks run via Cloud Engine APIs (not a pentest or Lighthouse).",
  ].join("\n");
}

export function formatStart() {
  return [
    "Welcome to SautiLink Cloud Engine.",
    "",
    "I run public website/DNS/email checks through the Cloud Engine API.",
    "Try /audit https://example.com or /help.",
  ].join("\n");
}

export function formatId(chat, from) {
  const lines = ["Your Telegram identifiers:"];
  if (chat && chat.id != null) lines.push(`chat_id: ${chat.id}`);
  if (from && from.id != null) lines.push(`user_id: ${from.id}`);
  lines.push("", "Use these only for debugging / future access control.");
  return lines.join("\n");
}

export function formatAudit(data) {
  const domain = data.domain || data.url || "";
  const score = data.score || {};
  const cats = data.categories || {};
  const lines = [
    "🔎 Website Audit",
    String(domain),
    "",
    `Overall: ${score.total ?? "—"}/${score.max ?? 100} — ${score.grade || "?"} (${score.label || ""})`.trim(),
    "",
  ];
  const labels = {
    security: "🛡 Security",
    seo: "🔍 SEO",
    mobile: "📱 Mobile",
    infrastructure: "🌐 Infrastructure",
    email: "✉️ Email",
    https: "🔐 HTTPS",
    technical: "⚙️ Technical",
  };
  for (const [k, label] of Object.entries(labels)) {
    const c = cats[k];
    if (!c) continue;
    if (c.available && c.score != null) {
      lines.push(`${label} ${c.score}`);
    } else {
      lines.push(`${label} n/a`);
    }
  }
  const findings = data.findings || [];
  const recs = data.recommendations || [];
  lines.push("");
  lines.push(`⚠️ Findings: ${findings.length}`);
  for (const f of findings.slice(0, 5)) {
    lines.push(`• [${f.severity || "info"}] ${f.title || f.code}`);
  }
  if (findings.length > 5) lines.push(`… +${findings.length - 5} more`);
  lines.push("");
  lines.push(`💡 Recommendations: ${recs.length}`);
  for (const r of recs.slice(0, 3)) {
    lines.push(`• ${r.title || r.code}`);
  }
  if (recs.length > 3) lines.push(`… +${recs.length - 3} more`);
  lines.push("", "Run /help for more commands.");
  return truncate(lines.join("\n"));
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
    `Email infrastructure · ${domain}`,
    `Score: ${score.total ?? "—"}/${score.max ?? 100} — ${score.grade || ""}`,
    "",
  ];
  if (data.mx) lines.push(`MX: ${data.mx.status || (data.mx.found ? "found" : "n/a")}`);
  if (data.spf) lines.push(`SPF: ${data.spf.status || (data.spf.found ? "found" : "n/a")}`);
  if (data.dmarc)
    lines.push(`DMARC: ${data.dmarc.status || (data.dmarc.found ? "found" : "n/a")}`);
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
  for (const f of (sec.findings || []).slice(0, 6)) {
    lines.push(`• [${f.severity || "info"}] ${f.title || f.code}`);
  }
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
    `HTTPS available: ${https.available ? "yes" : "no"}`,
    `HSTS: ${hsts.present ? `yes (max-age=${hsts.maxAge ?? "?"})` : "no"}`,
    "",
    "Certificate fields: not observable on Pages Functions fetch.",
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
  for (const f of (score.findings || []).slice(0, 5)) {
    lines.push(`• ${f.title || f.code}`);
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
  for (const f of (score.findings || []).slice(0, 5)) {
    lines.push(`• ${f.title || f.code}`);
  }
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
  for (const f of (score.findings || []).slice(0, 5)) {
    lines.push(`• ${f.title || f.code}`);
  }
  return truncate(lines.join("\n"));
}

export function formatSitemap(data) {
  const score = data.score || {};
  const lines = [
    "Sitemap",
    data.url || "",
    `Score: ${score.total ?? "—"}/100 — ${score.grade || ""}`,
  ];
  for (const f of (score.findings || []).slice(0, 5)) {
    lines.push(`• ${f.title || f.code}`);
  }
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
