/**
 * HTTP Status Checker UI — calls relative /api/http-status
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setError(message) {
  const el = document.getElementById("url-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}

function setStatus(message, kind) {
  const el = document.getElementById("http-status-msg");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.className = "tool-status";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = "tool-status" + (kind ? ` ${kind}` : "");
}

function statusClass(code) {
  if (code >= 200 && code < 300) return "ok";
  if (code >= 300 && code < 400) return "redirect";
  if (code >= 400 && code < 500) return "client";
  if (code >= 500) return "server";
  return "";
}

function renderResults(data) {
  const section = document.getElementById("http-results");
  const badge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");
  const finalUrl = document.getElementById("result-final-url");
  const grid = document.getElementById("http-meta-grid");
  const redirectBlock = document.getElementById("redirect-block");
  const redirectList = document.getElementById("redirect-list");
  if (!section || !badge || !grid) return;

  const code = data.status;
  badge.textContent = String(code);
  badge.className = "status-badge " + statusClass(code);
  if (statusText) statusText.textContent = data.statusText || "";
  if (finalUrl) finalUrl.textContent = data.finalUrl || data.url || "";

  const rows = [
    ["Requested URL", data.url],
    ["Final URL", data.finalUrl],
    ["Protocol", data.protocol],
    ["Redirected", data.redirected ? "Yes" : "No"],
    ["Redirect count", String(data.redirectCount ?? 0)],
    ["Response time", `${data.responseTimeMs} ms`],
    ["Content-Type", data.contentType || "—"],
    ["Content-Length", data.contentLength != null ? String(data.contentLength) : "—"],
    ["Server", data.server || "—"],
  ];

  grid.innerHTML = rows
    .map(
      ([k, v]) =>
        `<div class="meta-item"><dt>${escapeHtml(k)}</dt><dd><code>${escapeHtml(v)}</code></dd></div>`
    )
    .join("");

  const chain = Array.isArray(data.redirectChain) ? data.redirectChain : [];
  if (redirectBlock && redirectList) {
    if (chain.length > 0) {
      redirectBlock.hidden = false;
      redirectList.innerHTML = chain
        .map(
          (hop) =>
            `<li><span class="hop-status">${escapeHtml(String(hop.status))}</span> <code>${escapeHtml(hop.from)}</code> → <code>${escapeHtml(hop.to)}</code></li>`
        )
        .join("");
    } else {
      redirectBlock.hidden = true;
      redirectList.innerHTML = "";
    }
  }

  section.hidden = false;
}

async function runCheck(url) {
  const submit = document.getElementById("http-submit");
  const results = document.getElementById("http-results");

  setError("");
  setStatus("Checking URL…", "loading");
  if (results) results.hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Checking…";
  }

  try {
    const api = `/api/http-status?url=${encodeURIComponent(url)}`;
    const res = await fetch(api, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    let payload;
    try {
      payload = await res.json();
    } catch {
      setStatus("Received an invalid response from the API.", "error");
      return;
    }

    if (!payload || payload.success !== true) {
      const msg =
        payload?.error?.message || "Unable to check HTTP status for this URL.";
      setStatus(msg, "error");
      const code = payload?.error?.code;
      if (
        code === "MISSING_URL" ||
        code === "INVALID_URL" ||
        code === "UNSUPPORTED_PROTOCOL" ||
        code === "CREDENTIALS_NOT_ALLOWED" ||
        code === "PRIVATE_ADDRESS_BLOCKED" ||
        code === "SSRF_BLOCKED"
      ) {
        setError(msg);
      }
      return;
    }

    setStatus("");
    renderResults(payload.data);
  } catch (err) {
    setStatus(
      `Network error: ${err?.message || "request failed"}. Check your connection and try again.`,
      "error"
    );
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = "Check status";
    }
  }
}

function setupForm() {
  const form = document.getElementById("http-form");
  const input = document.getElementById("url-input");
  if (!form || !input) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) {
      setError("Please enter a URL.");
      setStatus("");
      input.focus();
      return;
    }
    runCheck(value);
  });

  const params = new URLSearchParams(window.location.search);
  const prefill = params.get("url");
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
