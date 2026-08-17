const RECENTS_KEY = "sautilink.cloudengine.recentTargets.v1";
const MAX_RECENTS = 5;

const state = {
  data: null,
  activeCategory: "all",
  activeView: "overview",
  severity: "all",
};

const CATEGORY_LABELS = {
  security: "Security",
  seo: "SEO",
  mobile: "Mobile",
  infrastructure: "Infrastructure",
  email: "Email",
  https: "HTTPS",
  technical: "Technical",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeAuditTarget(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function setError(message) {
  const el = document.getElementById("url-error");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || "";
}

function setStatus(message, kind) {
  const el = document.getElementById("status");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.className = "tool-status";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = `tool-status${kind ? ` ${kind}` : ""}`;
}

function readRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item?.target === "string").slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

function rememberTarget(target) {
  try {
    const next = [
      { target, at: Date.now() },
      ...readRecents().filter((item) => item.target !== target),
    ].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Browser-local recents are optional; the audit remains fully functional.
  }
}

function formatDuration(ms) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} s`;
}

function severityClass(value) {
  const severity = String(value || "info").toLowerCase();
  return ["error", "warning", "info", "success"].includes(severity)
    ? severity
    : "info";
}

function statusClass(value) {
  const status = String(value || "skipped").toLowerCase();
  return `status-${status.replace(/[^a-z0-9_-]/g, "")}`;
}

function categoryLabel(key) {
  return CATEGORY_LABELS[key] || String(key || "General");
}

function scopedCategory() {
  if (!state.data || state.activeCategory === "all") return null;
  return state.data.categories?.[state.activeCategory] || null;
}

function scopedFindings() {
  if (!state.data) return [];
  if (state.activeCategory === "all") return state.data.findings || [];
  return scopedCategory()?.findings || [];
}

function scopedRecommendations() {
  if (!state.data) return [];
  if (state.activeCategory === "all") return state.data.recommendations || [];
  return scopedCategory()?.recommendations || [];
}

function findingCard(finding) {
  const severity = severityClass(finding?.severity);
  return `
    <article class="finding-card ${severity}">
      <span class="severity-dot" aria-hidden="true"></span>
      <div>
        <div class="finding-title-row">
          <strong>${escapeHtml(finding?.title || finding?.code || "Finding")}</strong>
          <span class="severity-badge">${escapeHtml(severity)}</span>
        </div>
        <p class="finding-message">${escapeHtml(finding?.message || "No additional detail was returned.")}</p>
        <div class="finding-meta">
          <span>${escapeHtml(categoryLabel(finding?.category))}</span>
          <span>Source: ${escapeHtml(finding?.source || "unknown")}</span>
          ${finding?.code ? `<code>${escapeHtml(finding.code)}</code>` : ""}
        </div>
      </div>
    </article>`;
}

function renderCategoryNav() {
  const root = document.getElementById("category-nav");
  if (!root || !state.data) return;

  const score = state.data.score || {};
  const allButton = `
    <button type="button" class="category-button${state.activeCategory === "all" ? " active" : ""}" data-category="all">
      <span class="category-button-top"><strong>All</strong><span class="category-button-score">${score.total != null ? `${escapeHtml(score.total)}/100` : "n/a"}</span></span>
      <small>Unified report · all available categories</small>
    </button>`;

  const categories = Object.entries(state.data.categories || {})
    .map(([key, category]) => {
      const value = category?.available && category?.score != null
        ? `${category.score}/100`
        : "n/a";
      const detail = category?.available
        ? `${category.grade || ""} · weight ${category.weight ?? "—"}%`
        : `${category?.status || "unavailable"} · weight ${category?.weight ?? "—"}%`;
      return `
        <button type="button" class="category-button${state.activeCategory === key ? " active" : ""}" data-category="${escapeHtml(key)}">
          <span class="category-button-top"><strong>${escapeHtml(categoryLabel(key))}</strong><span class="category-button-score">${escapeHtml(value)}</span></span>
          <small>${escapeHtml(detail)}</small>
        </button>`;
    })
    .join("");

  root.innerHTML = allButton + categories;
}

function renderCategoryDetail() {
  if (!state.data) return;
  const title = document.getElementById("category-detail-title");
  const scoreEl = document.getElementById("category-detail-score");
  const root = document.getElementById("category-detail");
  if (!title || !scoreEl || !root) return;

  if (state.activeCategory === "all") {
    const categories = Object.values(state.data.categories || {});
    const available = categories.filter((category) => category?.available).length;
    const sources = new Set(categories.flatMap((category) => category?.sources || []));
    title.textContent = "All categories";
    scoreEl.textContent = state.data.score?.total != null
      ? `${state.data.score.total}/100 unified`
      : "Unified";
    root.innerHTML = `
      <div class="category-detail-grid">
        <div class="detail-stat"><span>Available categories</span><strong>${available} / ${categories.length}</strong></div>
        <div class="detail-stat"><span>Findings in scope</span><strong>${(state.data.findings || []).length}</strong></div>
        <div class="detail-stat"><span>Recommendations</span><strong>${(state.data.recommendations || []).length}</strong></div>
        <div class="detail-stat"><span>Contributing analyzers</span><strong>${sources.size}</strong></div>
      </div>
      <p class="detail-sources">The unified score renormalizes available category weights when a category is unavailable; missing data is not automatically scored as zero.</p>`;
    return;
  }

  const category = scopedCategory();
  title.textContent = categoryLabel(state.activeCategory);
  scoreEl.textContent = category?.available && category?.score != null
    ? `${category.score}/100 · ${category.grade || ""}`
    : category?.status || "Unavailable";
  const sources = category?.sources || [];
  root.innerHTML = `
    <div class="category-detail-grid">
      <div class="detail-stat"><span>Category score</span><strong>${category?.score != null ? `${escapeHtml(category.score)}/100` : "n/a"}</strong></div>
      <div class="detail-stat"><span>Score weight</span><strong>${category?.weight != null ? `${escapeHtml(category.weight)}%` : "—"}</strong></div>
      <div class="detail-stat"><span>Findings</span><strong>${(category?.findings || []).length}</strong></div>
      <div class="detail-stat"><span>Recommendations</span><strong>${(category?.recommendations || []).length}</strong></div>
    </div>
    <p class="detail-sources">Sources: ${sources.length ? sources.map((source) => escapeHtml(source)).join(", ") : "No successful source analyzer returned data for this category."}</p>`;
}

function renderOverviewFindings() {
  const root = document.getElementById("overview-findings");
  if (!root) return;
  const findings = scopedFindings();
  const priority = findings.filter((finding) => ["error", "warning"].includes(severityClass(finding?.severity)));
  const items = (priority.length ? priority : findings).slice(0, 6);

  if (!items.length) {
    root.innerHTML = '<div class="empty-report-state">No findings were returned for this scope.</div>';
    return;
  }
  root.innerHTML = items.map(findingCard).join("");
}

function updateSeverityCounts(findings) {
  const counts = { all: findings.length, error: 0, warning: 0, info: 0, success: 0 };
  for (const finding of findings) counts[severityClass(finding?.severity)] += 1;
  for (const [key, value] of Object.entries(counts)) {
    const el = document.getElementById(`severity-${key}-count`);
    if (el) el.textContent = String(value);
  }
}

function renderFindings() {
  const root = document.getElementById("findings-list");
  if (!root) return;
  const all = scopedFindings();
  updateSeverityCounts(all);
  const visible = state.severity === "all"
    ? all
    : all.filter((finding) => severityClass(finding?.severity) === state.severity);

  root.innerHTML = visible.length
    ? visible.map(findingCard).join("")
    : '<div class="empty-report-state">No findings match this category and severity filter.</div>';
}

function renderRecommendations() {
  const root = document.getElementById("recs-list");
  const note = document.getElementById("recommendation-scope-note");
  if (!root || !note) return;
  const recommendations = scopedRecommendations();
  note.textContent = state.activeCategory === "all"
    ? "Showing recommendations from all available categories."
    : `Showing recommendations for ${categoryLabel(state.activeCategory)}.`;

  root.innerHTML = recommendations.length
    ? recommendations.map((recommendation, index) => `
        <article class="recommendation-card">
          <span class="recommendation-index">${index + 1}</span>
          <h3>${escapeHtml(recommendation?.title || recommendation?.code || "Recommendation")}</h3>
          <p>${escapeHtml(recommendation?.message || "No additional detail was returned.")}</p>
          <div class="recommendation-meta">${escapeHtml(categoryLabel(recommendation?.category))} · ${escapeHtml(recommendation?.priority || "info")} · ${escapeHtml(recommendation?.source || "unknown")}${recommendation?.code ? ` · ${escapeHtml(recommendation.code)}` : ""}</div>
        </article>`).join("")
    : '<div class="empty-report-state">No recommendations were returned for this scope.</div>';
}

function renderAnalyzers() {
  const root = document.getElementById("analyzer-list");
  if (!root || !state.data) return;
  const analyzers = Object.entries(state.data.analyzers || {});
  root.innerHTML = analyzers.length
    ? analyzers.map(([id, analyzer]) => {
        const status = String(analyzer?.status || "skipped").toLowerCase();
        const error = analyzer?.error;
        return `
          <article class="analyzer-card">
            <div class="analyzer-head">
              <code>${escapeHtml(id)}</code>
              <span class="status-badge ${statusClass(status)}">${escapeHtml(status.replace(/_/g, " "))}</span>
            </div>
            <p class="analyzer-duration">${escapeHtml(formatDuration(analyzer?.durationMs))}</p>
            ${error ? `<p class="analyzer-error">${escapeHtml(error.code || "ANALYZER_ERROR")}: ${escapeHtml(error.message || "Analyzer did not complete.")}</p>` : ""}
          </article>`;
      }).join("")
    : '<div class="empty-report-state">No analyzer execution summary was returned.</div>';
}

function updateTabCounts() {
  const findings = scopedFindings();
  const recommendations = scopedRecommendations();
  const analyzers = Object.keys(state.data?.analyzers || {});
  const findingCount = document.getElementById("tab-findings-count");
  const recCount = document.getElementById("tab-recs-count");
  const analyzerCount = document.getElementById("tab-analyzers-count");
  if (findingCount) findingCount.textContent = String(findings.length);
  if (recCount) recCount.textContent = String(recommendations.length);
  if (analyzerCount) analyzerCount.textContent = String(analyzers.length);
}

function renderScope() {
  if (!state.data) return;
  renderCategoryNav();
  renderCategoryDetail();
  renderOverviewFindings();
  renderFindings();
  renderRecommendations();
  updateTabCounts();
}

function setView(view) {
  if (!["overview", "findings", "recommendations", "analyzers"].includes(view)) return;
  state.activeView = view;

  document.querySelectorAll(".report-tab").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const active = panel.dataset.panel === view;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function renderReport(data) {
  state.data = data;
  state.activeCategory = "all";
  state.severity = "all";

  document.querySelectorAll("[data-severity]").forEach((button) => {
    button.classList.toggle("active", button.dataset.severity === "all");
  });

  const score = data.score || {};
  const total = score.total;
  const max = score.max ?? 100;
  const percentage = Math.max(0, Math.min(100, Number(score.percentage ?? total ?? 0)));
  document.getElementById("score-total").textContent = total != null ? String(total) : "—";
  document.getElementById("score-max").textContent = String(max);
  document.getElementById("score-grade").textContent = score.grade || "—";
  document.getElementById("score-label").textContent = score.label || "Incomplete";
  document.getElementById("score-version").textContent = `Audit score v${score.version || "1.0"} · ${score.disclaimer || "SautiLink Cloud Engine configuration assessment."}`;
  document.getElementById("score-ring-progress").setAttribute("stroke-dashoffset", String(100 - percentage));

  document.getElementById("report-domain").textContent = data.domain || "Unknown target";
  document.getElementById("report-url").textContent = data.url || "";
  const openTarget = document.getElementById("open-target");
  if (openTarget) openTarget.href = /^https?:\/\//i.test(data.url || "") ? data.url : "#";

  const findings = data.findings || [];
  const priority = findings.filter((finding) => ["error", "warning"].includes(severityClass(finding?.severity))).length;
  const recommendations = data.recommendations || [];
  const analyzers = Object.values(data.analyzers || {});
  const okAnalyzers = analyzers.filter((analyzer) => analyzer?.status === "ok").length;

  document.getElementById("metric-priority").textContent = String(priority);
  document.getElementById("metric-recommendations").textContent = String(recommendations.length);
  document.getElementById("metric-analyzers").textContent = `${okAnalyzers} / ${analyzers.length}`;
  document.getElementById("metric-duration").textContent = formatDuration(data.meta?.durationMs);

  renderAnalyzers();
  renderScope();
  setView("overview");

  const results = document.getElementById("results");
  results.hidden = false;
  document.title = `${data.domain || "Website"} Audit — SautiLink Cloud Engine`;
}

async function copyAuditLink() {
  if (!state.data?.url) return;
  const button = document.getElementById("copy-audit-link");
  const link = `${location.origin}/tools/audit?url=${encodeURIComponent(state.data.url)}`;
  try {
    await navigator.clipboard.writeText(link);
    if (button) {
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = "Copy audit link"; }, 1600);
    }
  } catch {
    setStatus("Could not copy automatically. Copy the current page URL from your browser.", "error");
  }
}

async function runCheck(input) {
  const target = normalizeAuditTarget(input);
  const submit = document.getElementById("audit-submit");
  const results = document.getElementById("results");
  const inputEl = document.getElementById("url-input");

  setError("");
  if (!target) {
    setError("Enter a website or URL.");
    return;
  }

  if (inputEl) inputEl.value = target;
  setStatus("Running the unified audit. Individual analyzers may complete or time out independently…", "loading");
  results.hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Auditing…";
  }

  try {
    const response = await fetch(`/api/audit?url=${encodeURIComponent(target)}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => null);
    if (!payload?.success) {
      const message = payload?.error?.message || `Audit failed with HTTP ${response.status}.`;
      setStatus(message, "error");
      if (payload?.error?.code && /INVALID|MISSING|PRIVATE|SSRF|CREDENTIAL/.test(payload.error.code)) {
        setError(message);
      }
      return;
    }

    setStatus("");
    rememberTarget(payload.data?.url || target);
    history.replaceState(null, "", `/tools/audit?url=${encodeURIComponent(payload.data?.url || target)}`);
    renderReport(payload.data);
  } catch (error) {
    setStatus(`Network error: ${error?.message || "request failed"}`, "error");
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = "Run Full Audit";
    }
  }
}

function bindReportControls() {
  document.getElementById("category-nav")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button || !state.data) return;
    const category = button.dataset.category;
    if (category !== "all" && !state.data.categories?.[category]) return;
    state.activeCategory = category;
    state.severity = "all";
    document.querySelectorAll("[data-severity]").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.severity === "all");
    });
    renderScope();
  });

  document.querySelector(".report-tabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (button) setView(button.dataset.view);
  });

  document.getElementById("severity-filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-severity]");
    if (!button) return;
    state.severity = button.dataset.severity;
    document.querySelectorAll("[data-severity]").forEach((chip) => {
      chip.classList.toggle("active", chip === button);
    });
    renderFindings();
  });

  document.getElementById("panel-overview")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-view]");
    if (button) setView(button.dataset.openView);
  });

  document.getElementById("copy-audit-link")?.addEventListener("click", copyAuditLink);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("audit-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    runCheck(document.getElementById("url-input")?.value || "");
  });

  bindReportControls();

  const toggle = document.getElementById("nav-toggle");
  const nav = document.querySelector(".nav");
  toggle?.addEventListener("click", () => {
    const open = nav?.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const prefilled = new URLSearchParams(location.search).get("url");
  if (prefilled) runCheck(prefilled);
});
