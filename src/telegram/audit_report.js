/**
 * Deterministic Telegram audit report formatting.
 * Data must come from Cloud Engine /api/audit — no invented findings.
 */

import { MAX_TELEGRAM_TEXT } from "./config.js";

const CATEGORY_META = {
  security: { label: "🛡 Security", key: "security" },
  seo: { label: "🔍 SEO", key: "seo" },
  mobile: { label: "📱 Mobile", key: "mobile" },
  infrastructure: { label: "🌐 Infrastructure", key: "infrastructure" },
  email: { label: "✉️ Email", key: "email" },
  https: { label: "🔐 HTTPS", key: "https" },
  technical: { label: "⚙️ Technical", key: "technical" },
};

const GRADE_LABEL = {
  A: "Excellent",
  B: "Good",
  C: "Fair",
  D: "Poor",
  F: "Critical configuration gaps",
};

export function scoreBar(score, width = 10) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "░".repeat(width);
  const clamped = Math.max(0, Math.min(100, n));
  const filled = Math.round((clamped / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function gradeExplanation(grade) {
  const g = String(grade || "").toUpperCase();
  return GRADE_LABEL[g] || "Configuration assessment";
}

function severityIcon(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "error" || s === "critical" || s === "high") return "🔴";
  if (s === "warning" || s === "medium") return "🟠";
  if (s === "info" || s === "low") return "🔵";
  return "•";
}

function findingLine(f) {
  const title = (f && (f.title || f.message || f.code)) || "Finding";
  const icon = severityIcon(f && f.severity);
  return `${icon} ${String(title).slice(0, 120)}`;
}

function recLine(r) {
  const title = (r && (r.title || r.message || r.code)) || "Recommendation";
  return `• ${String(title).slice(0, 120)}`;
}

function padLabel(label, width = 16) {
  const s = String(label);
  if (s.length >= width) return s.slice(0, width);
  return s + " ".repeat(width - s.length);
}

function displayDomain(data) {
  return String(data.domain || data.url || "").trim() || "(unknown)";
}

export function formatAuditReport(data) {
  const domain = displayDomain(data);
  const score = data.score || {};
  const total = score.total ?? score.score;
  const max = score.max ?? 100;
  const grade = score.grade || "?";
  const cats = data.categories || {};
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];

  const lines = [
    "🔎 WEBSITE AUDIT",
    "",
    `🌐 ${domain}`,
    "",
    `⭐ Overall: ${total ?? "—"}/${max} — ${grade}`,
    `   ${gradeExplanation(grade)}`,
    "",
  ];

  for (const meta of Object.values(CATEGORY_META)) {
    const c = cats[meta.key];
    if (!c) continue;
    if (c.available && c.score != null) {
      lines.push(`${padLabel(meta.label)} ${scoreBar(c.score)} ${c.score}`);
    } else {
      lines.push(`${padLabel(meta.label)} n/a`);
    }
  }

  lines.push("");
  lines.push(`⚠️ ${findings.length} findings`);
  for (const f of findings.slice(0, 5)) lines.push(findingLine(f));
  if (findings.length > 5) lines.push(`… +${findings.length - 5} more`);

  lines.push("");
  lines.push(`💡 ${recs.length} recommendations`);
  for (const r of recs.slice(0, 5)) lines.push(recLine(r));
  if (recs.length > 5) lines.push(`… +${recs.length - 5} more`);

  if (data.checkedAt || data.timestamp || (score && score.checkedAt)) {
    const ts = data.checkedAt || data.timestamp || score.checkedAt;
    lines.push("", `🕒 Checked: ${String(ts).slice(0, 40)}`);
  }

  lines.push(
    "",
    "Configuration assessment only —",
    "not a ranking or pentest score."
  );

  return truncateSafe(lines.join("\n"));
}

export function formatAuditSummary(data) {
  const domain = displayDomain(data);
  const score = data.score || {};
  const cats = data.categories || {};
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];

  const lines = [
    "🔎 Audit Summary",
    "",
    `🌐 ${domain}`,
    `${score.total ?? score.score ?? "—"}/${score.max ?? 100} — ${score.grade || "?"}`,
    "",
  ];
  for (const meta of Object.values(CATEGORY_META)) {
    const c = cats[meta.key];
    if (!c) continue;
    if (c.available && c.score != null) lines.push(`${meta.label} ${c.score}`);
    else lines.push(`${meta.label} n/a`);
  }
  lines.push("");
  lines.push(`${findings.length} findings`);
  lines.push(`${recs.length} recommendations`);
  return truncateSafe(lines.join("\n"));
}

export function formatAuditPriorities(data) {
  const domain = displayDomain(data);
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
  const ranked = [...findings].sort((a, b) => severityRank(a) - severityRank(b));
  const source = ranked.length ? ranked : recs;

  const lines = ["🚨 Priority Fixes", "", `🌐 ${domain}`, ""];
  if (!source.length) {
    lines.push("No findings or recommendations reported.");
  } else {
    let i = 1;
    for (const item of source.slice(0, 5)) {
      const title = (item && (item.title || item.message || item.code)) || "Item";
      lines.push(`${i}. ${String(title).slice(0, 120)}`);
      i += 1;
    }
    if (source.length > 5) lines.push(`… +${source.length - 5} more`);
  }
  lines.push(
    "",
    "These are configuration recommendations,",
    "not a penetration-test result."
  );
  return truncateSafe(lines.join("\n"));
}

function severityRank(f) {
  const s = String((f && f.severity) || "").toLowerCase();
  if (s === "critical" || s === "error" || s === "high") return 0;
  if (s === "warning" || s === "medium") return 1;
  if (s === "info" || s === "low") return 2;
  return 3;
}

export function formatCategoryDetail(data, categoryKey) {
  const meta = CATEGORY_META[categoryKey];
  if (!meta) return "Unknown category.";
  const domain = displayDomain(data);
  const cat = (data.categories || {})[categoryKey];
  if (!cat) {
    return truncateSafe(`${meta.label}\n\n🌐 ${domain}\n\nNo ${categoryKey} data.`);
  }

  const lines = [meta.label, "", `🌐 ${domain}`, ""];
  if (cat.available && cat.score != null) {
    lines.push(
      `Score: ${cat.score}/100 — ${cat.grade || "?"}`,
      `   ${gradeExplanation(cat.grade)}`,
      "",
      scoreBar(cat.score),
      ""
    );
  } else {
    lines.push(`Status: ${cat.status || "unavailable"}`, "");
  }

  const findings = Array.isArray(cat.findings)
    ? cat.findings
    : Array.isArray(data.findings)
      ? data.findings.filter(
          (f) =>
            !f.category ||
            String(f.category).toLowerCase() === categoryKey ||
            String(f.area || "").toLowerCase() === categoryKey
        )
      : [];

  lines.push("Findings:");
  if (!findings.length) lines.push("No findings reported.");
  else {
    for (const f of findings.slice(0, 5)) lines.push(findingLine(f));
    if (findings.length > 5) lines.push(`… +${findings.length - 5} more`);
  }

  const recs = Array.isArray(cat.recommendations)
    ? cat.recommendations
    : Array.isArray(data.recommendations)
      ? data.recommendations.filter(
          (r) =>
            !r.category ||
            String(r.category).toLowerCase() === categoryKey ||
            String(r.area || "").toLowerCase() === categoryKey
        )
      : [];

  lines.push("", "💡 Recommendations");
  if (!recs.length) lines.push("No recommendations reported.");
  else {
    for (const r of recs.slice(0, 5)) lines.push(recLine(r));
    if (recs.length > 5) lines.push(`… +${recs.length - 5} more`);
  }

  return truncateSafe(lines.join("\n"));
}

export function auditReportKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔄 Re-run", callback_data: "audit:rerun" },
        { text: "📋 Summary", callback_data: "audit:summary" },
      ],
      [{ text: "🚨 Priorities", callback_data: "audit:priorities" }],
      [
        { text: "🛡 Security", callback_data: "audit:security" },
        { text: "🔍 SEO", callback_data: "audit:seo" },
      ],
      [
        { text: "📱 Mobile", callback_data: "audit:mobile" },
        { text: "✉️ Email", callback_data: "audit:email" },
      ],
      [{ text: "🔐 HTTPS", callback_data: "audit:https" }],
    ],
  };
}

export function auditBackKeyboard() {
  return {
    inline_keyboard: [[{ text: "⬅️ Back to Audit", callback_data: "audit:back" }]],
  };
}

function truncateSafe(text, max = MAX_TELEGRAM_TEXT) {
  const s = String(text || "");
  if (s.length <= max) return s;
  let cut = s.slice(0, max - 20);
  if (
    cut.length &&
    cut.charCodeAt(cut.length - 1) >= 0xd800 &&
    cut.charCodeAt(cut.length - 1) <= 0xdbff
  ) {
    cut = cut.slice(0, -1);
  }
  return cut + "\n… (truncated)";
}
