/** Deterministic Telegram audit report formatting. */

import { MAX_TELEGRAM_TEXT } from "./config.js";
import { t } from "./i18n/index.js";

const CATEGORY_KEYS = ["security", "seo", "mobile", "infrastructure", "email", "https", "technical"];

function presentationConfig(value = {}) {
  const detailed = value.reportDetail === "detailed";
  return {
    detailed,
    developerMode: value.developerMode === true,
    itemLimit: detailed ? 8 : 3,
  };
}

export function scoreBar(score, width = 10) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "░".repeat(width);
  const clamped = Math.max(0, Math.min(100, n));
  const filled = Math.round((clamped / 100) * width);
  const f = Math.max(0, Math.min(width, filled));
  return "█".repeat(f) + "░".repeat(width - f);
}

export function gradeExplanation(grade, locale = "en") {
  const g = String(grade || "").toUpperCase();
  return t(locale, `audit.grade.${["A", "B", "C", "D", "F"].includes(g) ? g : "default"}`);
}

function categoryLabel(key, locale) { return t(locale, `audit.category.${key}`); }
function severityIcon(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "error" || s === "critical" || s === "high") return "🔴";
  if (s === "warning" || s === "medium") return "🟠";
  if (s === "info" || s === "low") return "🔵";
  return "•";
}
function itemTitle(item, developerMode = false) {
  const title = String((item && (item.title || item.message || item.code)) || "Item").slice(0, 120);
  const code = item && item.code ? String(item.code).slice(0, 60) : "";
  if (!developerMode || !code || code.toLowerCase() === title.toLowerCase()) return title;
  return `${title} [${code}]`;
}
function findingLine(f, developerMode = false) {
  return `${severityIcon(f && f.severity)} ${itemTitle(f, developerMode)}`;
}
function recLine(r, developerMode = false) {
  return `• ${itemTitle(r, developerMode)}`;
}
function categoryBlock(label, scoreOrNull) {
  if (scoreOrNull == null || !Number.isFinite(Number(scoreOrNull))) return `${label}\n   n/a`;
  const s = Number(scoreOrNull);
  return `${label}\n   ${scoreBar(s)} ${s}`;
}
function displayDomain(data) { return String(data.domain || data.url || "").trim() || "(unknown)"; }

export function formatAuditReport(data, locale = "en", value = {}) {
  const presentation = presentationConfig(value);
  const domain = displayDomain(data);
  const score = data.score || {};
  const total = score.total ?? score.score;
  const max = score.max ?? 100;
  const grade = score.grade || "?";
  const cats = data.categories || {};
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
  const lines = [
    t(locale, "audit.title"), `🌐 ${domain}`, "",
    t(locale, "audit.overall", { score: total ?? "—", max, grade }),
    `   ${gradeExplanation(grade, locale)}`, "",
  ];
  for (const key of CATEGORY_KEYS) {
    const c = cats[key];
    if (!c) continue;
    lines.push(categoryBlock(categoryLabel(key, locale), c.available && c.score != null ? c.score : null));
  }
  lines.push("", `⚠️ ${findings.length} ${t(locale, "audit.findings")}`);
  for (const f of findings.slice(0, presentation.itemLimit)) lines.push(findingLine(f, presentation.developerMode));
  if (findings.length > presentation.itemLimit) lines.push(t(locale, "audit.more", { count: findings.length - presentation.itemLimit }));
  lines.push("", `💡 ${recs.length} ${t(locale, "audit.recommendations")}`);
  for (const r of recs.slice(0, presentation.itemLimit)) lines.push(recLine(r, presentation.developerMode));
  if (recs.length > presentation.itemLimit) lines.push(t(locale, "audit.more", { count: recs.length - presentation.itemLimit }));
  if (presentation.developerMode) {
    lines.push("", "🧑‍💻 Developer details", `Categories returned: ${Object.keys(cats).length}`, `Finding count: ${findings.length}`, `Recommendation count: ${recs.length}`);
  }
  if (data.checkedAt || data.timestamp || score.checkedAt) {
    const ts = data.checkedAt || data.timestamp || score.checkedAt;
    lines.push("", t(locale, "report.checked", { time: String(ts).slice(0, 40) }));
  }
  lines.push("", t(locale, "audit.disclaimer"));
  return truncateSafe(lines.join("\n"));
}

export function formatAuditSummary(data, locale = "en", value = {}) {
  const presentation = presentationConfig(value);
  const domain = displayDomain(data);
  const score = data.score || {};
  const cats = data.categories || {};
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
  const lines = [t(locale, "audit.summary"), `🌐 ${domain}`, `${score.total ?? score.score ?? "—"}/${score.max ?? 100} — ${score.grade || "?"}`, ""];
  for (const key of CATEGORY_KEYS) {
    const c = cats[key];
    if (!c) continue;
    lines.push(`${categoryLabel(key, locale)} ${c.available && c.score != null ? c.score : "n/a"}`);
  }
  lines.push("", `${findings.length} ${t(locale, "audit.findings")} · ${recs.length} ${t(locale, "audit.recommendations")}`);
  if (presentation.developerMode) lines.push("", `🧑‍💻 Categories returned: ${Object.keys(cats).length}`);
  return truncateSafe(lines.join("\n"));
}

export function formatAuditPriorities(data, locale = "en", value = {}) {
  const presentation = presentationConfig(value);
  const domain = displayDomain(data);
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
  const ranked = [...findings].sort((a, b) => severityRank(a) - severityRank(b));
  const source = ranked.length ? ranked : recs;
  const lines = [t(locale, "audit.priorities"), `🌐 ${domain}`, ""];
  if (!source.length) lines.push(t(locale, "audit.none"));
  else {
    source.slice(0, presentation.itemLimit).forEach((item, i) => lines.push(`${i + 1}. ${itemTitle(item, presentation.developerMode)}`));
    if (source.length > presentation.itemLimit) lines.push(t(locale, "audit.more", { count: source.length - presentation.itemLimit }));
  }
  lines.push("", t(locale, "audit.priority_disclaimer"));
  return truncateSafe(lines.join("\n"));
}

function severityRank(f) {
  const s = String((f && f.severity) || "").toLowerCase();
  if (s === "critical" || s === "error" || s === "high") return 0;
  if (s === "warning" || s === "medium") return 1;
  if (s === "info" || s === "low") return 2;
  return 3;
}

export function formatCategoryDetail(data, categoryKey, locale = "en", value = {}) {
  const presentation = presentationConfig(value);
  if (!CATEGORY_KEYS.includes(categoryKey)) return t(locale, "audit.unknown_category");
  const label = categoryLabel(categoryKey, locale);
  const domain = displayDomain(data);
  const cat = (data.categories || {})[categoryKey];
  if (!cat) return truncateSafe(`${label}\n🌐 ${domain}\n\n${t(locale, "audit.no_category", { category: categoryKey })}`);
  const lines = [label, `🌐 ${domain}`, ""];
  if (cat.available && cat.score != null) lines.push(t(locale, "report.score", { score: cat.score, max: 100, grade: cat.grade || "?" }), `   ${gradeExplanation(cat.grade, locale)}`, `   ${scoreBar(cat.score)}`, "");
  else lines.push(t(locale, "report.status", { status: cat.status || t(locale, "report.unavailable") }), "");
  const findings = Array.isArray(cat.findings) ? cat.findings : Array.isArray(data.findings) ? data.findings.filter((f) => !f.category || String(f.category).toLowerCase() === categoryKey || String(f.area || "").toLowerCase() === categoryKey) : [];
  lines.push(t(locale, "report.findings"));
  if (!findings.length) lines.push(t(locale, "report.no_findings"));
  else {
    findings.slice(0, presentation.itemLimit).forEach((f) => lines.push(findingLine(f, presentation.developerMode)));
    if (findings.length > presentation.itemLimit) lines.push(t(locale, "audit.more", { count: findings.length - presentation.itemLimit }));
  }
  const recs = Array.isArray(cat.recommendations) ? cat.recommendations : Array.isArray(data.recommendations) ? data.recommendations.filter((r) => !r.category || String(r.category).toLowerCase() === categoryKey || String(r.area || "").toLowerCase() === categoryKey) : [];
  lines.push("", t(locale, "report.recommendations"));
  if (!recs.length) lines.push(t(locale, "report.no_recommendations"));
  else {
    recs.slice(0, presentation.itemLimit).forEach((r) => lines.push(recLine(r, presentation.developerMode)));
    if (recs.length > presentation.itemLimit) lines.push(t(locale, "audit.more", { count: recs.length - presentation.itemLimit }));
  }
  return truncateSafe(lines.join("\n"));
}

export function auditReportKeyboard(locale = "en") {
  return { inline_keyboard: [
    [{ text: t(locale, "menu.rerun"), callback_data: "audit:rerun" }, { text: t(locale, "menu.summary"), callback_data: "audit:summary" }],
    [{ text: t(locale, "menu.priorities"), callback_data: "audit:priorities" }],
    [{ text: t(locale, "menu.security"), callback_data: "audit:security" }, { text: "🔍 SEO", callback_data: "audit:seo" }],
    [{ text: t(locale, "menu.mobile"), callback_data: "audit:mobile" }, { text: t(locale, "menu.email"), callback_data: "audit:email" }],
    [{ text: t(locale, "menu.https"), callback_data: "audit:https" }],
  ] };
}

export function auditBackKeyboard(locale = "en") {
  return { inline_keyboard: [[{ text: t(locale, "menu.back_audit"), callback_data: "audit:back" }]] };
}

export function truncateSafe(text, max = MAX_TELEGRAM_TEXT) {
  const s = String(text || "");
  if (s.length <= max) return s;
  let cut = s.slice(0, max - 20);
  if (cut.length && cut.charCodeAt(cut.length - 1) >= 0xd800 && cut.charCodeAt(cut.length - 1) <= 0xdbff) cut = cut.slice(0, -1);
  return cut + "\n… (truncated)";
}
