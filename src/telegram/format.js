/**
 * Plain-text formatters and public error vocabulary.
 */

import { MAX_TELEGRAM_TEXT } from "./config.js";
import { formatHelpFromRegistry } from "./registry.js";

export function truncate(text, max = MAX_TELEGRAM_TEXT) {
  const s = String(text || "");
  if (s.length <= max) return s;
  return s.slice(0, max - 20) + "\n… (truncated)";
}

export function formatEngineError(err) {
  const code = err && err.code ? String(err.code) : "ERROR";
  return truncate(mapUserError(code, err && err.message));
}

function mapUserError(code, message) {
  switch (code) {
    case "PRIVATE_ADDRESS_BLOCKED":
    case "SSRF_BLOCKED":
      return "🛡 That address cannot be checked for security reasons.";
    case "CREDENTIALS_NOT_ALLOWED":
      return "❌ URLs must not contain usernames or passwords.";
    case "UNSUPPORTED_PROTOCOL":
      return "❌ Only HTTP and HTTPS URLs are supported.";
    case "INVALID_URL":
    case "MISSING_URL":
      return "❌ Invalid input.\n\nUse:\n/audit https://example.com";
    case "INVALID_DOMAIN":
    case "MISSING_DOMAIN":
      return "❌ Invalid input.\n\nUse:\n/dns example.com";
    case "INVALID_SELECTOR":
      return "❌ Invalid DKIM selector.";
    case "ENGINE_TIMEOUT":
    case "REQUEST_TIMEOUT":
      return "⏱ The check took too long.\n\nPlease try again.";
    case "ENGINE_NETWORK":
    case "ENGINE_UNEXPECTED":
    case "ENGINE_BAD_JSON":
      return "⚠️ Cloud Engine is temporarily unavailable.\n\nPlease try again shortly.";
    case "RATE_LIMITED":
    case "TELEGRAM_RATE_LIMITED":
      return "⏱ You're checking too quickly.\n\nPlease wait a moment and try again.";
    case "ENGINE_HTTP_ERROR":
      return "⚠️ The service is temporarily busy.\n\nPlease try again shortly.";
    default: {
      const msg = String(message || "Something went wrong.")
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
        .slice(0, 200);
      // Avoid leaking internal code names to users when possible
      if (/BLOCKED|SSRF|PRIVATE|TIMEOUT|RATE/i.test(code)) {
        return `❌ ${msg}`;
      }
      return `❌ ${msg}`;
    }
  }
}

export function formatTimeout() {
  return "⏱ The check took too long.\n\nPlease try again.";
}

export function formatHelp() {
  return formatHelpFromRegistry();
}

export function formatStart() {
  return [
    "🚀 SautiLink Cloud Engine",
    "",
    "Website, DNS, email, security, and infrastructure checks from Telegram.",
    "",
    "Try:",
    "/audit example.com",
    "",
    "Use /help to see all available tools.",
  ].join("\n");
}

export function formatAbout() {
  return [
    "About SautiLink Cloud Engine",
    "",
    "Automated website, DNS, email, HTTPS, and SEO configuration checks.",
    "",
    "These are quality/configuration assessments — not a penetration test,",
    "vulnerability scanner, Lighthouse report, or Google ranking tool.",
    "",
    "Web: https://cloudengine.sautilink.com",
  ].join("\n");
}

export function formatStatus(ok, data) {
  if (!ok) {
    return [
      "🔴 SautiLink Cloud Engine",
      "",
      "Status: Temporarily unavailable.",
    ].join("\n");
  }
  return ["🟢 SautiLink Cloud Engine", "", "Status: Operational"].join("\n");
}

export function formatId(chat, from) {
  const lines = ["Diagnostic identifiers only:"];
  if (chat && chat.id != null) lines.push(`chat_id: ${chat.id}`);
  if (from && from.id != null) lines.push(`user_id: ${from.id}`);
  lines.push(
    "",
    "/id is for debugging. No tokens, secrets, or server details are shown."
  );
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
    `Overall: ${score.total ?? "—"}/${score.max ?? 100} — ${score.grade || "?"}${score.label ? ` (${score.label})` : ""}`,
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
    if (c.available && c.score != null) lines.push(`${label} ${c.score}`);
    else lines.push(`${label} n/a`);
  }
  const findings = data.findings || [];
  const recs = data.recommendations || [];
  lines.push("");
  lines.push(`⚠️ Findings: ${findings.length}`);
  for (const f of findings.slice(0, 5)) {
    lines.push(`• ${f.title || f.code}`);
  }
  if (findings.length > 5) lines.push(`… +${findings.length - 5} more`);
  lines.push("");
  lines.push(`💡 Recommendations: ${recs.length}`);
  for (const r of recs.slice(0, 3)) {
    lines.push(`• ${r.title || r.code}`);
  }
  if (recs.length > 3) lines.push(`… +${recs.length - 3} more`);
  lines.push(
    "",
    "Configuration assessment only — not a ranking or pentest score."
  );
  return truncate(lines.join("\n"));
}

export function auditKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🔍 Re-run Audit", callback_data: "audit:rerun" }],
      [
        { text: "🛡 Security", callback_data: "audit:security" },
        { text: "🔎 SEO", callback_data: "audit:seo" },
      ],
      [
        { text: "📱 Mobile", callback_data: "audit:mobile" },
        { text: "✉️ Email", callback_data: "audit:email" },
      ],
      [{ text: "🔐 HTTPS", callback_data: "audit:https" }],
    ],
  };
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
  if (data.mx)
    lines.push(`MX: ${data.mx.status || (data.mx.found ? "found" : "n/a")}`);
  if (data.spf)
    lines.push(`SPF: ${data.spf.status || (data.spf.found ? "found" : "n/a")}`);
  if (data.dmarc)
    lines.push(
      `DMARC: ${data.dmarc.status || (data.dmarc.found ? "found" : "n/a")}`
    );
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
    lines.push(`• ${f.title || f.code}`);
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
    `HTTPS: ${https.available ? "available" : "not available"}`,
    `HSTS: ${hsts.present ? `yes (max-age=${hsts.maxAge ?? "?"})` : "no"}`,
    "",
    "Certificate details are not observable via Pages Functions fetch.",
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

export function formatAuditCategory(data, categoryKey) {
  const domain = data.domain || data.url || "";
  const cat = (data.categories || {})[categoryKey];
  if (!cat) return truncate(`No ${categoryKey} data for ${domain}.`);
  const lines = [
    `${categoryKey.toUpperCase()} · ${domain}`,
    cat.available
      ? `Score: ${cat.score ?? "—"}/100 — ${cat.grade || ""}`
      : `Status: ${cat.status || "unavailable"}`,
    "",
  ];
  for (const f of (cat.findings || []).slice(0, 8)) {
    lines.push(`• ${f.title || f.code}`);
  }
  if (!(cat.findings || []).length) lines.push("(no findings)");
  const recs = cat.recommendations || [];
  if (recs.length) {
    lines.push("", "Recommendations:");
    for (const r of recs.slice(0, 5)) lines.push(`• ${r.title || r.code}`);
  }
  return truncate(lines.join("\n"));
}
