/** Passive CORS + cookie metadata view over the existing /api/headers probe. */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setError(message) {
  const el = document.getElementById("cors-error");
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
}

function setStatus(message, kind) {
  const el = document.getElementById("cors-status");
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
  el.className = "tool-status" + (kind ? ` ${kind}` : "");
}

function row(label, value) {
  const display = value == null || value === "" ? "Not observed" : String(value);
  return `<div class="policy-item"><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(display)}</code></dd></div>`;
}

function splitTokens(value) {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function corsVerdict(headers) {
  const allowOrigin = headers["access-control-allow-origin"] || "";
  const credentials = String(headers["access-control-allow-credentials"] || "").toLowerCase() === "true";
  if (!allowOrigin) {
    return {
      tone: "muted",
      title: "No allow-origin header observed",
      message: "This response did not expose Access-Control-Allow-Origin to the Cloud Engine GET request. That alone does not prove every cross-origin request is blocked.",
    };
  }
  if (allowOrigin.trim() === "*" && credentials) {
    return {
      tone: "warn",
      title: "Wildcard origin + credentials observed",
      message: "Browsers do not allow credentialed CORS with Access-Control-Allow-Origin: *. Review this configuration and test the real browser flow.",
    };
  }
  if (allowOrigin.trim() === "*") {
    return {
      tone: "open",
      title: "Wildcard origin observed",
      message: "The response advertises a wildcard allow-origin value for this request. Whether that is appropriate depends on the resource and whether credentials are involved.",
    };
  }
  return {
    tone: "restricted",
    title: "Specific allow-origin value observed",
    message: `The response advertised ${allowOrigin} for this request. Dynamic origin handling cannot be confirmed from one passive request.`,
  };
}

function renderCors(data) {
  const headers = data.headers || {};
  const grid = document.getElementById("cors-grid");
  const verdictRoot = document.getElementById("cors-verdict");
  const badge = document.getElementById("cors-badge");
  const verdict = corsVerdict(headers);

  if (verdictRoot) {
    verdictRoot.className = `cors-verdict ${verdict.tone}`;
    verdictRoot.innerHTML = `<strong>${escapeHtml(verdict.title)}</strong><p>${escapeHtml(verdict.message)}</p>`;
  }
  if (badge) {
    badge.textContent = verdict.tone === "warn" ? "Review" : verdict.tone === "open" ? "Wildcard" : verdict.tone === "restricted" ? "Observed" : "No header";
    badge.className = `state-badge ${verdict.tone === "warn" ? "warn" : verdict.tone === "restricted" ? "ok" : "muted"}`;
  }
  if (grid) {
    grid.innerHTML = [
      row("Allow-Origin", headers["access-control-allow-origin"]),
      row("Allow-Credentials", headers["access-control-allow-credentials"]),
      row("Allow-Methods", headers["access-control-allow-methods"]),
      row("Allow-Headers", headers["access-control-allow-headers"]),
      row("Expose-Headers", headers["access-control-expose-headers"]),
      row("Max-Age", headers["access-control-max-age"]),
      row("Vary", headers.vary),
      row("Observed methods count", splitTokens(headers["access-control-allow-methods"]).length || 0),
    ].join("");
  }
}

function cookieTone(cookie) {
  if (!cookie.secure || !cookie.httpOnly) return "warn";
  const sameSite = String(cookie.sameSite || "").toLowerCase();
  if (!sameSite) return "muted";
  return "good";
}

function renderCookies(cookies) {
  const root = document.getElementById("cookie-results");
  if (!root) return;
  const list = Array.isArray(cookies) ? cookies : [];
  if (!list.length) {
    root.innerHTML = '<p class="empty-note">No Set-Cookie metadata was observed in this response.</p>';
    return;
  }

  root.innerHTML = `<div class="cookie-grid">${list.map((cookie) => {
    const tone = cookieTone(cookie);
    return `<article class="cookie-card ${tone}">
      <div class="cookie-head"><strong>${escapeHtml(cookie.name || "Unnamed cookie")}</strong><span class="cookie-state">${tone === "good" ? "Hardened" : tone === "warn" ? "Review" : "Partial"}</span></div>
      <dl>
        <div><dt>Secure</dt><dd>${cookie.secure ? "Yes" : "No"}</dd></div>
        <div><dt>HttpOnly</dt><dd>${cookie.httpOnly ? "Yes" : "No"}</dd></div>
        <div><dt>SameSite</dt><dd>${escapeHtml(cookie.sameSite || "Not observed")}</dd></div>
        <div><dt>Path</dt><dd><code>${escapeHtml(cookie.path || "Not observed")}</code></dd></div>
      </dl>
    </article>`;
  }).join("")}</div>`;
}

function renderResults(data) {
  const section = document.getElementById("cors-results");
  const url = document.getElementById("result-url");
  const summary = document.getElementById("result-summary");
  if (url) url.textContent = data.finalUrl || data.url || "";
  if (summary) summary.textContent = `HTTP ${data.status || "—"} ${data.statusText || ""} · ${data.protocol || "HTTP"} · ${data.responseTimeMs ?? "—"} ms`.trim();
  renderCors(data);
  renderCookies(data.cookies);
  if (section) section.hidden = false;
}

async function runCheck(target) {
  const submit = document.getElementById("cors-submit");
  const results = document.getElementById("cors-results");
  setError("");
  setStatus("Inspecting CORS response headers and cookie metadata…", "loading");
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
    try { payload = await response.json(); } catch {
      setStatus("Received an invalid response from the API.", "error");
      return;
    }
    if (!payload || payload.success !== true) {
      const message = payload?.error?.message || "Unable to inspect this public URL.";
      setStatus(message, "error");
      if (["INVALID_URL", "MISSING_URL", "SSRF_BLOCKED", "PRIVATE_ADDRESS_BLOCKED"].includes(payload?.error?.code)) setError(message);
      return;
    }
    setStatus("");
    renderResults(payload.data || {});
  } catch (error) {
    setStatus(`Network error: ${error?.message || "request failed"}.`, "error");
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = "Inspect policy";
    }
  }
}

function setupForm() {
  const form = document.getElementById("cors-form");
  const input = document.getElementById("cors-url");
  if (!form || !input) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      setError("Please enter a public HTTP or HTTPS URL.");
      input.focus();
      return;
    }
    runCheck(value);
  });
  const prefill = new URLSearchParams(location.search).get("url");
  if (prefill) {
    input.value = prefill;
    runCheck(prefill.trim());
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
