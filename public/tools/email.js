/**
 * Email Infrastructure Checker UI — MX + SPF + DMARC + DKIM
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
  body.innerHTML = `<table class="mx-table"><thead><tr><th>Priority</th><th>Mail server</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderSpf(spf) {
  const badge = document.getElementById("spf-badge");
  const body = document.getElementById("spf-body");
  if (!body) return;
  if (!spf || !spf.found) {
    setBadge(badge, "Missing", "error");
    body.innerHTML = `<p class="empty-note">No SPF (v=spf1) TXT record found.</p>`;
    return;
  }
  if (spf.valid === false) setBadge(badge, "Invalid", "error");
  else if (spf.policy === "pass" || (spf.warnings && spf.warnings.length)) setBadge(badge, "Warning", "warn");
  else setBadge(badge, "Valid", "ok");

  let html = `<dl class="spf-meta">
    <div><dt>Policy</dt><dd><code>${escapeHtml(spf.policy || "none")}</code></dd></div>
    <div><dt>Record count</dt><dd><code>${escapeHtml(String(spf.recordCount ?? 0))}</code></dd></div>
    <div><dt>Valid</dt><dd><code>${spf.valid ? "yes" : "no"}</code></dd></div>
  </dl>`;
  if (spf.record) html += `<p class="spf-record-label">Record</p><pre class="spf-record"><code>${escapeHtml(spf.record)}</code></pre>`;
  if (spf.warnings?.length) {
    html += `<p class="spf-record-label">Warnings</p><ul class="warn-list">${spf.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`;
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
    return;
  }
  if (dmarc.valid === false) setBadge(badge, "Invalid", "error");
  else if (dmarc.policy === "none") setBadge(badge, "Warning", "warn");
  else if (dmarc.policy === "reject") setBadge(badge, "Configured", "ok");
  else setBadge(badge, "Valid", "ok");

  const sp = dmarc.subdomainPolicy == null ? "(inherits p)" : dmarc.subdomainPolicy;
  let html = `<dl class="spf-meta">
    <div><dt>Policy (p)</dt><dd><code>${escapeHtml(String(dmarc.policy || "—"))}</code></dd></div>
    <div><dt>Subdomain (sp)</dt><dd><code>${escapeHtml(String(sp))}</code></dd></div>
    <div><dt>Percentage</dt><dd><code>${escapeHtml(String(dmarc.percentage ?? "—"))}</code></dd></div>
    <div><dt>DKIM align</dt><dd><code>${escapeHtml(dmarc.alignment?.dkim || "—")}</code></dd></div>
    <div><dt>SPF align</dt><dd><code>${escapeHtml(dmarc.alignment?.spf || "—")}</code></dd></div>
  </dl>`;
  if (dmarc.record) html += `<p class="spf-record-label">Record</p><pre class="spf-record"><code>${escapeHtml(dmarc.record)}</code></pre>`;
  if (dmarc.warnings?.length) {
    html += `<p class="spf-record-label">Notes</p><ul class="warn-list">${dmarc.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`;
  }
  body.innerHTML = html;
}

function renderDkim(dkim) {
  const badge = document.getElementById("dkim-badge");
  const body = document.getElementById("dkim-body");
  if (!body) return;

  if (!dkim || !dkim.found) {
    setBadge(badge, "Not found", "muted");
    const conf = dkim?.confidence === "explicit" ? "explicit selector" : "heuristic discovery";
    body.innerHTML = `<p class="empty-note">No DKIM public key found (${escapeHtml(conf)}).</p>`;
    if (dkim?.warnings?.length) {
      body.innerHTML += `<ul class="warn-list">${dkim.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`;
    }
    if (dkim?.checkedSelectors?.length) {
      body.innerHTML += `<p class="spf-record-label">Checked selectors</p><p class="empty-note"><code>${escapeHtml(dkim.checkedSelectors.join(", "))}</code></p>`;
    }
    return;
  }

  if (dkim.revoked) setBadge(badge, "Revoked", "warn");
  else if (dkim.valid === false) setBadge(badge, "Invalid", "error");
  else setBadge(badge, "Configured", "ok");

  const key = dkim.publicKey || "";
  const truncated = key.length > 80 ? key.slice(0, 80) + "…" : key;

  let html = `<dl class="spf-meta">
    <div><dt>Selector</dt><dd><code>${escapeHtml(dkim.selector || "—")}</code></dd></div>
    <div><dt>Confidence</dt><dd><code>${escapeHtml(dkim.confidence || "—")}</code></dd></div>
    <div><dt>Key type</dt><dd><code>${escapeHtml(dkim.keyType || "—")}</code></dd></div>
    <div><dt>Version</dt><dd><code>${escapeHtml(dkim.version || "—")}</code></dd></div>
    <div><dt>Valid key record</dt><dd><code>${dkim.valid ? "yes" : "no"}</code></dd></div>
    <div><dt>Revoked</dt><dd><code>${dkim.revoked ? "yes" : "no"}</code></dd></div>
  </dl>`;

  if (dkim.record) {
    html += `<p class="spf-record-label">Record</p><pre class="spf-record"><code>${escapeHtml(dkim.record)}</code></pre>`;
  }

  if (key) {
    html += `<p class="spf-record-label">Public key (DNS p=)</p>
      <pre class="spf-record dkim-key" data-full="${escapeHtml(key)}"><code class="dkim-key-short">${escapeHtml(truncated)}</code></pre>`;
    if (key.length > 80) {
      html += `<button type="button" class="btn btn-secondary btn-small" id="dkim-show-key">Show full key</button>`;
    }
  }

  if (dkim.checkedSelectors?.length) {
    html += `<p class="spf-record-label">Checked selectors</p><p class="empty-note"><code>${escapeHtml(dkim.checkedSelectors.join(", "))}</code></p>`;
  }

  if (dkim.warnings?.length) {
    html += `<p class="spf-record-label">Notes</p><ul class="warn-list">${dkim.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`;
  }

  html += `<p class="empty-note dkim-disclaimer">DNS public-key inspection only — message signatures are not verified.</p>`;

  body.innerHTML = html;

  const btn = document.getElementById("dkim-show-key");
  if (btn) {
    btn.addEventListener("click", () => {
      const pre = body.querySelector(".dkim-key");
      const code = body.querySelector(".dkim-key-short");
      if (pre && code) {
        code.textContent = pre.getAttribute("data-full") || "";
        btn.hidden = true;
      }
    });
  }
}

function renderResults(data) {
  const section = document.getElementById("email-results");
  const domainEl = document.getElementById("result-domain");
  if (domainEl) domainEl.textContent = data.domain;
  renderMx(data.mx);
  renderSpf(data.spf);
  renderDmarc(data.dmarc);
  renderDkim(data.dkim);
  if (section) section.hidden = false;
}

async function runCheck(domain, selector) {
  const submit = document.getElementById("email-submit");
  const results = document.getElementById("email-results");

  setError("");
  setStatus(
    selector ? `Checking email + DKIM selector “${selector}”…` : "Checking MX, SPF, DMARC, and DKIM…",
    "loading"
  );
  if (results) results.hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Checking…";
  }

  try {
    let api = `/api/email?domain=${encodeURIComponent(domain)}`;
    if (selector) api += `&selector=${encodeURIComponent(selector)}`;
    const res = await fetch(api, { method: "GET", headers: { Accept: "application/json" } });
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
      if (code === "MISSING_DOMAIN" || code === "INVALID_DOMAIN" || code === "INVALID_SELECTOR") {
        setError(msg);
      }
      return;
    }

    setStatus("");
    renderResults(payload.data);
  } catch (err) {
    setStatus(`Network error: ${err?.message || "request failed"}.`, "error");
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
  const sel = document.getElementById("selector-input");
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
    runCheck(value, (sel?.value || "").trim());
  });

  const params = new URLSearchParams(window.location.search);
  const prefill = params.get("domain");
  const preSel = params.get("selector");
  if (preSel && sel) sel.value = preSel;
  if (prefill) {
    input.value = prefill;
    runCheck(prefill.trim(), (preSel || "").trim());
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
