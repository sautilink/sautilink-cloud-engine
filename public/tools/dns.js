/**
 * DNS Lookup tool page — calls relative /api/dns
 */

const RECORD_ORDER = ["A", "AAAA", "CNAME", "MX", "NS", "TXT"];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setError(message) {
  const el = document.getElementById("domain-error");
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
  const el = document.getElementById("dns-status");
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

function renderResults(domain, records) {
  const section = document.getElementById("dns-results");
  const grid = document.getElementById("dns-record-grid");
  const domainEl = document.getElementById("result-domain");
  if (!section || !grid || !domainEl) return;

  domainEl.textContent = domain;
  grid.innerHTML = RECORD_ORDER.map((type) => {
    const list = Array.isArray(records?.[type]) ? records[type] : [];
    const body =
      list.length === 0
        ? `<p class="record-empty">No records found</p>`
        : `<ul class="record-list">${list
            .map((r) => `<li><code>${escapeHtml(r)}</code></li>`)
            .join("")}</ul>`;
    return `
      <article class="record-card">
        <h3><span class="record-type">${escapeHtml(type)}</span></h3>
        ${body}
      </article>`;
  }).join("");

  section.hidden = false;
}

async function runLookup(domain) {
  const submit = document.getElementById("dns-submit");
  const results = document.getElementById("dns-results");

  setError("");
  setStatus("Looking up DNS records…", "loading");
  if (results) results.hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Checking…";
  }

  try {
    const url = `/api/dns?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, {
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
        payload?.error?.message ||
        "Unable to look up DNS records for this domain.";
      setStatus(msg, "error");
      if (payload?.error?.code === "INVALID_DOMAIN" || payload?.error?.code === "MISSING_DOMAIN") {
        setError(msg);
      }
      return;
    }

    setStatus("");
    renderResults(payload.data.domain, payload.data.records);
  } catch (err) {
    setStatus(
      `Network error: ${err?.message || "request failed"}. Check your connection and try again.`,
      "error"
    );
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = "Check DNS";
    }
  }
}

function setupForm() {
  const form = document.getElementById("dns-form");
  const input = document.getElementById("domain-input");
  if (!form || !input) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) {
      setError("Please enter a domain name.");
      setStatus("");
      input.focus();
      return;
    }
    runLookup(value);
  });

  const params = new URLSearchParams(window.location.search);
  const prefill = params.get("domain");
  if (prefill) {
    input.value = prefill;
    runLookup(prefill.trim());
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
