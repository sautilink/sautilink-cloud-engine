/**
 * Email Infrastructure Checker UI — /api/email (MX + SPF + DMARC)
 */

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
  const el = document.getElementById("email-status");
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

function setBadge(el, text, state) {
  if (!el) return;
  el.textContent = text;
  el.className = "state-badge" + (state ? ` ${state}` : "");
}

function renderMx(mx) {
  const badge = document.getElementById("mx-badge");
  const body = document.getElementById("mx-body");
  if (!body) return;

  if (!mx || !mx.found) {
    setBadge(badge, "Not found", "muted");
    body.innerHTML = `<p class="empty-note">No MX records published for this domain.</p>`;
    return;
  }

  setBadge(badge, "Found", "ok");
  const rows = (mx.records || [])
    .map(
      (r) =>
        `<tr><td class="prio">${escapeHtml(String(r.priority))}</td><td><code>${escapeHtml(r.host)}</code></td></tr>`
    )
    .join("");
  body.innerHTML = `
    <table class="mx-table">
      <thead><tr><th>Priority</th><th>Mail server</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderSpf(spf) {
  const badge = document.getElementById("spf-badge");
  const body = document.getElementById("spf-body");
  if (!body) return;

  if (!spf || !spf.found) {
    setBadge(badge, "Missing", "error");
    body.innerHTML = `<p class="empty-note">No SPF (v=spf1) TXT record found.</p>`;
    if (spf?.warnings?.length) {
      body.innerHTML += `<ul class="warn-list">${spf.warnings
        .map((w) => `<li>${escapeHtml(w)}</li>`)
        .join("")}</ul>`;
    }
    return;
  }

  if (spf.valid === false) {
    setBadge(badge, "Invalid", "error");
  } else if (spf.policy === "pass" || (spf.warnings && spf.warnings.length)) {
    setBadge(badge, "Warning", "warn");
  } else {
    setBadge(badge, "Valid", "ok");
  }

  const policyLabel = spf.policy || "none";
  let html = `
    <dl class="spf-meta">
      <div><dt>Policy</dt><dd><code>${escapeHtml(policyLabel)}</code></dd></div>
      <div><dt>Record count</dt><dd><code>${escapeHtml(String(spf.recordCount ?? 0))}</code></dd></div>
      <div><dt>Valid</dt><dd><code>${spf.valid ? "yes" : "no"}</code></dd></div>
    </dl>`;

  if (spf.record) {
    html += `<p class="spf-record-label">Record</p><pre class="spf-record"><code>${escapeHtml(spf.record)}</code></pre>`;
  }

  if (Array.isArray(spf.mechanisms) && spf.mechanisms.length) {
    html += `<p class="spf-record-label">Mechanisms</p><ul class="mech-list">${spf.mechanisms
      .map((m) => `<li><code>${escapeHtml(m.raw || m.type)}</code></li>`)
      .join("")}</ul>`;
  }

  if (Array.isArray(spf.warnings) && spf.warnings.length) {
    html += `<p class="spf-record-label">Warnings</p><ul class="warn-list">${spf.warnings
      .map((w) => `<li>${escapeHtml(w)}</li>`)
      .join("")}</ul>`;
  }

  body.innerHTML = html;
}

function renderDmarc(dmarc) {
  const badge = document.getElementById("dmarc-badge");
  const body = document.getElementById("dmarc-body");
  if (!body) return;

  if (!dmarc || !dmarc.found) {
    setBadge(badge, "Missing", "error");
    body.innerHTML = `<p class="empty-note">No DMARC record at _dmarc.&lt;domain&gt;.</p>`;
    if (dmarc?.warnings?.length) {
      body.innerHTML += `<ul class="warn-list">${dmarc.warnings
        .map((w) => `<li>${escapeHtml(w)}</li>`)
        .join("")}</ul>`;
    }
    return;
  }

  if (dmarc.valid === false) {
    setBadge(badge, "Invalid", "error");
  } else if (dmarc.policy === "none" || (dmarc.warnings && dmarc.warnings.length > 2)) {
    setBadge(badge, "Warning", "warn");
  } else if (dmarc.policy === "reject") {
    setBadge(badge, "Configured", "ok");
  } else {
    setBadge(badge, "Valid", "ok");
  }

  const sp = dmarc.subdomainPolicy == null ? "(inherits p)" : dmarc.subdomainPolicy;
  const pct = dmarc.percentage == null ? "—" : String(dmarc.percentage);
  const adkim = dmarc.alignment?.dkim || "—";
  const aspf = dmarc.alignment?.spf || "—";

  let html = `
    <dl class="spf-meta">
      <div><dt>Policy (p)</dt><dd><code>${escapeHtml(String(dmarc.policy || "—"))}</code></dd></div>
      <div><dt>Subdomain (sp)</dt><dd><code>${escapeHtml(String(sp))}</code></dd></div>
      <div><dt>Percentage</dt><dd><code>${escapeHtml(pct)}</code></dd></div>
      <div><dt>DKIM alignment</dt><dd><code>${escapeHtml(adkim)}</code></dd></div>
      <div><dt>SPF alignment</dt><dd><code>${escapeHtml(aspf)}</code></dd></div>
      <div><dt>Valid</dt><dd><code>${dmarc.valid ? "yes" : "no"}</code></dd></div>
    </dl>`;

  if (dmarc.record) {
    html += `<p class="spf-record-label">Record</p><pre class="spf-record"><code>${escapeHtml(dmarc.record)}</code></pre>`;
  }

  const agg = dmarc.reporting?.aggregate || [];
  const forens = dmarc.reporting?.forensic || [];
  html += `<p class="spf-record-label">Aggregate reporting (rua)</p>`;
  html +=
    agg.length === 0
      ? `<p class="empty-note">None</p>`
      : `<ul class="mech-list">${agg.map((x) => `<li><code>${escapeHtml(x)}</code></li>`).join("")}</ul>`;
  html += `<p class="spf-record-label">Forensic reporting (ruf)</p>`;
  html +=
    forens.length === 0
      ? `<p class="empty-note">None</p>`
      : `<ul class="mech-list">${forens.map((x) => `<li><code>${escapeHtml(x)}</code></li>`).join("")}</ul>`;

  if (dmarc.options && Object.keys(dmarc.options).length) {
    html += `<p class="spf-record-label">Options / other tags</p><ul class="mech-list">`;
    for (const [k, v] of Object.entries(dmarc.options)) {
      html += `<li><code>${escapeHtml(k)}=${escapeHtml(Array.isArray(v) ? v.join(",") : String(v))}</code></li>`;
    }
    html += `</ul>`;
  }

  if (Array.isArray(dmarc.warnings) && dmarc.warnings.length) {
    html += `<p class="spf-record-label">Notes</p><ul class="warn-list">${dmarc.warnings
      .map((w) => `<li>${escapeHtml(w)}</li>`)
      .join("")}</ul>`;
  }

  body.innerHTML = html;
}

function renderResults(data) {
  const section = document.getElementById("email-results");
  const domainEl = document.getElementById("result-domain");
  if (domainEl) domainEl.textContent = data.domain;
  renderMx(data.mx);
  renderSpf(data.spf);
  renderDmarc(data.dmarc);
  if (section) section.hidden = false;
}

async function runCheck(domain) {
  const submit = document.getElementById("email-submit");
  const results = document.getElementById("email-results");

  setError("");
  setStatus("Checking MX, SPF, and DMARC…", "loading");
  if (results) results.hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Checking…";
  }

  try {
    const res = await fetch(`/api/email?domain=${encodeURIComponent(domain)}`, {
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
      const msg = payload?.error?.message || "Unable to check email infrastructure.";
      setStatus(msg, "error");
      const code = payload?.error?.code;
      if (code === "MISSING_DOMAIN" || code === "INVALID_DOMAIN") setError(msg);
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
      submit.textContent = "Check email";
    }
  }
}

function setupForm() {
  const form = document.getElementById("email-form");
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
    runCheck(value);
  });

  const params = new URLSearchParams(window.location.search);
  const prefill = params.get("domain");
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
