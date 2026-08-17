const RECENTS_KEY = "sautilink.cloudengine.recentTargets.v1";
const MAX_RECENTS = 5;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeTarget(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function auditRequest(input) {
  const raw = typeof input === "string" ? input : input?.url;
  if (!raw) return false;
  try {
    return new URL(raw, location.origin).pathname === "/api/audit";
  } catch {
    return false;
  }
}

function setCompareStatus(message, kind) {
  const el = document.getElementById("compare-status");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.className = "compare-status";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = `compare-status${kind ? ` ${kind}` : ""}`;
}

function safeFilename(value) {
  return String(value || "website")
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "website";
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value) {
  let text = String(value ?? "");
  // Prevent spreadsheet formula execution when user-controlled text is opened
  // in Excel/Sheets/LibreOffice. Numeric values remain numeric.
  if (typeof value === "string" && /^[\t\r\n ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function categoryRows(audit) {
  return Object.entries(audit?.categories || {}).map(([key, category]) => ({
    category: key,
    score: category?.score ?? "",
    grade: category?.grade ?? "",
    weight: category?.weight ?? "",
    status: category?.status ?? "",
    findings: (category?.findings || []).length,
    recommendations: (category?.recommendations || []).length,
    sources: (category?.sources || []).join(" | "),
  }));
}

function exportJson(audit) {
  const payload = {
    product: "SautiLink Cloud Engine",
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    report: audit,
  };
  const filename = `sautilink-cloud-engine-audit-${safeFilename(audit?.domain)}.json`;
  downloadBlob(`${JSON.stringify(payload, null, 2)}\n`, "application/json;charset=utf-8", filename);
}

function exportCsv(audit) {
  const rows = [
    ["SautiLink Cloud Engine Audit Export"],
    ["Target", audit?.url || ""],
    ["Domain", audit?.domain || ""],
    ["Unified Score", audit?.score?.total ?? ""],
    ["Grade", audit?.score?.grade || ""],
    ["Audit Score Version", audit?.score?.version || ""],
    ["Exported At", new Date().toISOString()],
    [],
    ["Category", "Score", "Grade", "Weight", "Status", "Findings", "Recommendations", "Sources"],
    ...categoryRows(audit).map((row) => [
      row.category,
      row.score,
      row.grade,
      row.weight,
      row.status,
      row.findings,
      row.recommendations,
      row.sources,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const filename = `sautilink-cloud-engine-audit-${safeFilename(audit?.domain)}.csv`;
  downloadBlob(`${csv}\r\n`, "text/csv;charset=utf-8", filename);
}

function scoreValue(audit) {
  return typeof audit?.score?.total === "number" ? audit.score.total : null;
}

function scoreText(value) {
  return typeof value === "number" ? `${value}/100` : "n/a";
}

function deltaText(delta) {
  if (typeof delta !== "number" || !Number.isFinite(delta)) return "—";
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function deltaClass(delta) {
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) return "neutral";
  return delta > 0 ? "positive" : "negative";
}

function priorityCount(audit) {
  return (audit?.findings || []).filter((finding) =>
    ["error", "warning"].includes(String(finding?.severity || "").toLowerCase())
  ).length;
}

function rememberRecentTarget(target) {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const items = Array.isArray(parsed) ? parsed : [];
    const next = [
      { target, at: Date.now() },
      ...items.filter((item) => item?.target !== target),
    ].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Comparison remains available even when local storage is unavailable.
  }
}

function renderComparison(primary, secondary) {
  const primaryScore = scoreValue(primary);
  const secondaryScore = scoreValue(secondary);
  const overallDelta = primaryScore != null && secondaryScore != null
    ? secondaryScore - primaryScore
    : null;

  document.getElementById("compare-primary-score").textContent = scoreText(primaryScore);
  document.getElementById("compare-secondary-score").textContent = scoreText(secondaryScore);
  document.getElementById("compare-primary-domain").textContent = primary?.domain || "Primary";
  document.getElementById("compare-secondary-domain").textContent = secondary?.domain || "Comparison";
  document.getElementById("compare-head-primary").textContent = primary?.domain || "Primary";
  document.getElementById("compare-head-secondary").textContent = secondary?.domain || "Comparison";

  const deltaEl = document.getElementById("compare-score-delta");
  deltaEl.textContent = deltaText(overallDelta);
  deltaEl.className = deltaClass(overallDelta);

  const keys = [...new Set([
    ...Object.keys(primary?.categories || {}),
    ...Object.keys(secondary?.categories || {}),
  ])];
  const rows = document.getElementById("compare-category-rows");
  rows.innerHTML = keys.map((key) => {
    const a = primary?.categories?.[key];
    const b = secondary?.categories?.[key];
    const av = typeof a?.score === "number" ? a.score : null;
    const bv = typeof b?.score === "number" ? b.score : null;
    const delta = av != null && bv != null ? bv - av : null;
    const label = key === "seo" ? "SEO" : key === "https" ? "HTTPS" : `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    return `<tr>
      <td>${escapeHtml(label)}</td>
      <td class="compare-value">${escapeHtml(scoreText(av))}${a?.grade ? ` · ${escapeHtml(a.grade)}` : ""}</td>
      <td class="compare-value">${escapeHtml(scoreText(bv))}${b?.grade ? ` · ${escapeHtml(b.grade)}` : ""}</td>
      <td class="compare-delta ${deltaClass(delta)}">${escapeHtml(deltaText(delta))}</td>
    </tr>`;
  }).join("");

  const primaryPriority = priorityCount(primary);
  const secondaryPriority = priorityCount(secondary);
  document.getElementById("compare-summary-note").textContent =
    `${primary?.domain || "Primary"}: ${primaryPriority} priority issues, ${(primary?.recommendations || []).length} recommendations · ` +
    `${secondary?.domain || "Comparison"}: ${secondaryPriority} priority issues, ${(secondary?.recommendations || []).length} recommendations.`;

  const open = document.getElementById("open-comparison-primary");
  open.href = `/tools/audit?url=${encodeURIComponent(secondary?.url || "")}`;
  document.getElementById("compare-results").hidden = false;
}

export function installAuditPower() {
  const nativeFetch = window.fetch.bind(window);
  let currentAudit = null;
  let comparisonAudit = null;

  function enablePowerActions() {
    for (const id of ["compare-toggle", "export-json", "export-csv", "print-report"]) {
      const button = document.getElementById(id);
      if (button) button.disabled = !currentAudit;
    }
    const note = document.getElementById("compare-primary-note");
    if (note && currentAudit) note.textContent = `Primary: ${currentAudit.domain || currentAudit.url}`;
  }

  function resetComparisonForPrimary() {
    comparisonAudit = null;
    const results = document.getElementById("compare-results");
    if (results) results.hidden = true;
    setCompareStatus("");
    enablePowerActions();
  }

  window.fetch = async function sautiLinkAuditAwareFetch(input, init) {
    const response = await nativeFetch(input, init);
    if (auditRequest(input)) {
      response.clone().json().then((payload) => {
        if (!payload?.success || !payload?.data) return;
        currentAudit = payload.data;
        resetComparisonForPrimary();
      }).catch(() => {
        // The normal audit renderer owns user-facing request errors.
      });
    }
    return response;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const comparePanel = document.getElementById("compare-panel");
    const compareForm = document.getElementById("compare-form");
    const compareInput = document.getElementById("compare-input");
    const compareSubmit = document.getElementById("compare-submit");

    enablePowerActions();

    document.getElementById("compare-toggle")?.addEventListener("click", () => {
      if (!currentAudit) return;
      comparePanel.hidden = false;
      document.getElementById("compare-primary-note").textContent = `Primary: ${currentAudit.domain || currentAudit.url}`;
      compareInput?.focus();
    });

    document.getElementById("compare-close")?.addEventListener("click", () => {
      comparePanel.hidden = true;
      setCompareStatus("");
    });

    document.getElementById("export-json")?.addEventListener("click", () => {
      if (currentAudit) exportJson(currentAudit);
    });

    document.getElementById("export-csv")?.addEventListener("click", () => {
      if (currentAudit) exportCsv(currentAudit);
    });

    document.getElementById("print-report")?.addEventListener("click", () => {
      if (currentAudit) window.print();
    });

    compareForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentAudit) return;
      const target = normalizeTarget(compareInput?.value || "");
      if (!target) {
        setCompareStatus("Enter a public website or URL to compare.", "error");
        return;
      }
      if (target === currentAudit.url) {
        setCompareStatus("Choose a different target from the primary audit.", "error");
        return;
      }

      setCompareStatus("Running one fresh audit for the comparison target…", "loading");
      document.getElementById("compare-results").hidden = true;
      if (compareSubmit) {
        compareSubmit.disabled = true;
        compareSubmit.textContent = "Comparing…";
      }

      try {
        const response = await nativeFetch(`/api/audit?url=${encodeURIComponent(target)}`, {
          headers: { Accept: "application/json" },
        });
        const payload = await response.json().catch(() => null);
        if (!payload?.success || !payload?.data) {
          setCompareStatus(payload?.error?.message || `Comparison failed with HTTP ${response.status}.`, "error");
          return;
        }
        comparisonAudit = payload.data;
        rememberRecentTarget(comparisonAudit.url || target);
        setCompareStatus("");
        renderComparison(currentAudit, comparisonAudit);
      } catch (error) {
        setCompareStatus(`Comparison network error: ${error?.message || "request failed"}`, "error");
      } finally {
        if (compareSubmit) {
          compareSubmit.disabled = false;
          compareSubmit.textContent = "Run comparison";
        }
      }
    });
  });
}
