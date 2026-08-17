/**
 * Server Information — observational view over the existing /api/headers probe.
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setError(message) {
  const el = document.getElementById("server-error");
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
}

function setStatus(message, kind) {
  const el = document.getElementById("server-status");
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
  el.className = "tool-status" + (kind ? ` ${kind}` : "");
}

function signalRow(label, value, tone = "") {
  const display = value == null || value === "" ? "Not observed" : String(value);
  return `<div class="signal-item${tone ? ` ${escapeHtml(tone)}` : ""}"><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(display)}</code></dd></div>`;
}

const EDGE_EXACT = new Set([
  "via",
  "server-timing",
  "alt-svc",
  "x-cache",
  "x-cache-hits",
  "x-served-by",
  "x-timer",
  "cf-ray",
  "cf-cache-status",
  "x-amz-cf-id",
  "x-amz-cf-pop",
  "x-vercel-id",
  "x-nf-request-id",
  "akamai-grn",
  "x-akamai-transformed",
  "fly-request-id",
]);

const EDGE_PREFIXES = ["cf-", "x-cache", "x-served-by", "x-amz-cf-", "x-vercel-", "x-nf-", "akamai-", "fly-"];

function isEdgeSignal(name) {
  const key = String(name || "").toLowerCase();
  return EDGE_EXACT.has(key) || EDGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function renderEdgeSignals(headers) {
  const root = document.getElementById("edge-signals");
  if (!root) return;
  const entries = Object.entries(headers || {}).filter(([name, value]) => isEdgeSignal(name) && value != null && String(value).trim());
  if (!entries.length) {
    root.innerHTML = '<p class="empty-note">No recognizable edge or proxy response headers were observed. This does not mean the endpoint has no proxy, CDN, or edge layer.</p>';
    return;
  }
  root.innerHTML = `<div class="signal-table"><div class="signal-table-head"><span>Header</span><span>Observed value</span></div>${entries
    .map(([name, value]) => `<div class="signal-table-row"><code>${escapeHtml(name)}</code><code>${escapeHtml(value)}</code></div>`)
    .join("")}</div>`;
}

function renderRedirects(data) {
  const root = document.getElementById("redirect-chain");
  if (!root) return;
  const chain = Array.isArray(data.redirectChain) ? data.redirectChain : [];
  if (!chain.length) {
    root.innerHTML = '<p class="empty-note">No redirect hop was observed during this request.</p>';
    return;
  }
  root.innerHTML = `<ol class="redirect-list">${chain.map((hop, index) => {
    const from = hop?.url || hop?.from || "Unknown source";
    const to = hop?.location || hop?.to || hop?.target || "Unknown destination";
    const status = hop?.status || hop?.statusCode || "redirect";
    return `<li><span class="hop-index">${index + 1}</span><div><strong>${escapeHtml(status)}</strong><code>${escapeHtml(from)}</code><span aria-hidden="true">→</span><code>${escapeHtml(to)}</code></div></li>`;
  }).join("")}</ol>`;
}

function renderSecuritySignals(analysis) {
  const root = document.getElementById("security-signal-grid");
  if (!root) return;
  const a = analysis || {};
  root.innerHTML = [
    signalRow("HSTS", a.hsts?.present ? `Present${a.hsts.maxAge != null ? ` · max-age=${a.hsts.maxAge}` : ""}` : "Not observed", a.hsts?.present ? "good" : "muted"),
    signalRow("Content-Security-Policy", a.csp?.present ? "Present" : "Not observed", a.csp?.present ? "good" : "muted"),
    signalRow("X-Content-Type-Options", a.xContentTypeOptions || "Not observed"),
    signalRow("X-Frame-Options", a.xFrameOptions || "Not observed"),
    signalRow("Referrer-Policy", a.referrerPolicy || "Not observed"),
    signalRow("Permissions-Policy", a.permissionsPolicy?.present ? "Present" : "Not observed"),
  ].join("");
}

function renderResults(data) {
  const section = document.getElementById("server-results");
  const resultUrl = document.getElementById("result-url");
  const summary = document.getElementById("result-summary");
  const badge = document.getElementById("result-badge");
  const grid = document.getElementById("server-signal-grid");

  const finalUrl = data.finalUrl || data.url || "";
  if (resultUrl) resultUrl.textContent = finalUrl;
  if (summary) {
    const redirectText = data.redirected ? `${data.redirectCount || 0} redirect hop${Number(data.redirectCount) === 1 ? "" : "s"} observed.` : "No redirect observed.";
    summary.textContent = `${data.protocol || "HTTP"} response ${data.status || "—"} ${data.statusText || ""}. ${redirectText}`.trim();
  }
  if (badge) {
    const ok = Number(data.status) >= 200 && Number(data.status) < 400;
    badge.textContent = data.status ? `HTTP ${data.status}` : "Observed";
    badge.className = `state-badge ${ok ? "ok" : "warn"}`;
  }

  const analysis = data.analysis || {};
  if (grid) {
    grid.innerHTML = [
      signalRow("Protocol", data.protocol || "Not observed"),
      signalRow("Status", data.status ? `${data.status} ${data.statusText || ""}`.trim() : "Not observed"),
      signalRow("Response time", data.responseTimeMs != null ? `${data.responseTimeMs} ms` : "Not observed"),
      signalRow("Server banner", analysis.server || data.headers?.server || "Not observed"),
      signalRow("Content-Type", analysis.contentType || data.headers?.["content-type"] || "Not observed"),
      signalRow("Cache-Control", analysis.cacheControl || data.headers?.["cache-control"] || "Not observed"),
      signalRow("Redirect count", data.redirectCount ?? 0),
      signalRow("Cookie count", Array.isArray(data.cookies) ? data.cookies.length : 0),
    ].join("");
  }

  renderEdgeSignals(data.headers || {});
  renderSecuritySignals(analysis);
  renderRedirects(data);
  if (section) section.hidden = false;
}

async function runServerCheck(target) {
  const submit = document.getElementById("server-submit");
  const results = document.getElementById("server-results");
  setError("");
  setStatus("Inspecting observable server and delivery signals…", "loading");
  if (results) results.hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Inspecting…";
  }

  try {
    const response = await fetch(`/api/headers?url=${encodeURIComponent(target)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      setStatus("Received an invalid response from the API.", "error");
      return;
    }

    if (!payload || payload.success !== true) {
      const message = payload?.error?.message || "Unable to inspect this public URL.";
      setStatus(message, "error");
      const code = payload?.error?.code;
      if (code === "INVALID_URL" || code === "MISSING_URL" || code === "SSRF_BLOCKED" || code === "PRIVATE_ADDRESS_BLOCKED") setError(message);
      return;
    }

    setStatus("");
    renderResults(payload.data || {});
  } catch (error) {
    setStatus(`Network error: ${error?.message || "request failed"}.`, "error");
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = "Inspect server";
    }
  }
}

function setupForm() {
  const form = document.getElementById("server-form");
  const input = document.getElementById("server-url");
  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      setError("Please enter a public HTTP or HTTPS URL.");
      input.focus();
      return;
    }
    runServerCheck(value);
  });

  const params = new URLSearchParams(location.search);
  const prefill = params.get("url");
  if (prefill) {
    input.value = prefill;
    runServerCheck(prefill.trim());
  }
}

function setupNav() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.querySelector(".nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function setYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", () => {
  setupForm();
  setupNav();
  setYear();
});
