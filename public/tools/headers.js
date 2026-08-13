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
  const el = document.getElementById("headers-status");
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

function renderResults(data) {
  const section = document.getElementById("headers-results");
  const sec = data.security || {};
  const totalEl = document.getElementById("score-total");
  const gradeEl = document.getElementById("score-grade");
  const labelEl = document.getElementById("score-label");
  const bar = document.getElementById("score-bar");
  const fill = document.getElementById("score-bar-fill");
  const ver = document.getElementById("score-version");
  const cats = document.getElementById("score-cats");

  if (totalEl) totalEl.textContent = `${sec.score ?? "—"} / ${sec.max ?? 100}`;
  if (gradeEl) gradeEl.textContent = sec.grade || "";
  if (labelEl) labelEl.textContent = sec.label || "";
  if (ver)
    ver.textContent = `Score model v${sec.version || "1.0"} · configuration assessment, not a security guarantee`;
  if (bar && fill) {
    const pct = Math.max(0, Math.min(100, sec.percentage ?? sec.score ?? 0));
    bar.setAttribute("aria-valuenow", String(pct));
    fill.style.width = `${pct}%`;
  }
  if (cats && sec.categories) {
    cats.innerHTML = Object.entries(sec.categories)
      .map(
        ([k, c]) =>
          `<li><span class="cat-name">${escapeHtml(k)}</span> <span class="cat-score">${c.score} / ${c.max}</span></li>`
      )
      .join("");
  }

  const meta = document.getElementById("meta-grid");
  if (meta) {
    meta.innerHTML = `
      <div><dt>Status</dt><dd><code>${escapeHtml(String(data.status))} ${escapeHtml(data.statusText || "")}</code></dd></div>
      <div><dt>Final URL</dt><dd><code>${escapeHtml(data.finalUrl || "")}</code></dd></div>
      <div><dt>Protocol</dt><dd><code>${escapeHtml(data.protocol || "")}</code></dd></div>
      <div><dt>Time</dt><dd><code>${escapeHtml(String(data.responseTimeMs ?? "—"))} ms</code></dd></div>
      <div><dt>Redirects</dt><dd><code>${escapeHtml(String(data.redirectCount ?? 0))}</code></dd></div>
    `;
  }

  const findings = document.getElementById("findings-list");
  if (findings) {
    const list = sec.findings || [];
    findings.innerHTML = list.length
      ? list
          .map(
            (f) =>
              `<li class="finding ${escapeHtml(f.severity || "info")}"><strong>${escapeHtml(f.title || f.code)}</strong> — ${escapeHtml(f.message || "")}</li>`
          )
          .join("")
      : `<li class="finding info">No findings.</li>`;
  }

  const recs = document.getElementById("recs-list");
  if (recs) {
    const list = sec.recommendations || [];
    recs.innerHTML = list.length
      ? list
          .map(
            (r) =>
              `<li><strong>${escapeHtml(r.title || r.code)}</strong> (${escapeHtml(r.priority || "")}) — ${escapeHtml(r.message || "")}</li>`
          )
          .join("")
      : `<li>No recommendations.</li>`;
  }

  const cookiesBody = document.getElementById("cookies-body");
  if (cookiesBody) {
    const cookies = data.cookies || [];
    if (!cookies.length) {
      cookiesBody.innerHTML = `<p class="empty-note">No Set-Cookie headers on this response.</p>`;
    } else {
      cookiesBody.innerHTML = `<ul class="cookie-list">${cookies
        .map(
          (c) =>
            `<li><code>${escapeHtml(c.name)}</code> · Secure=${c.secure ? "yes" : "no"} · HttpOnly=${c.httpOnly ? "yes" : "no"} · SameSite=${escapeHtml(c.sameSite || "—")}</li>`
        )
        .join("")}</ul><p class="empty-note">Cookie values are never returned by this API.</p>`;
    }
  }

  const headersBody = document.getElementById("headers-body");
  if (headersBody) {
    const headers = data.headers || {};
    const keys = Object.keys(headers).sort();
    if (!keys.length) {
      headersBody.innerHTML = `<p class="empty-note">No headers captured.</p>`;
    } else {
      headersBody.innerHTML = `<table class="headers-table"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${keys
        .map(
          (k) =>
            `<tr><td><code>${escapeHtml(k)}</code></td><td><code>${escapeHtml(headers[k])}</code></td></tr>`
        )
        .join("")}</tbody></table>`;
    }
  }

  if (section) section.hidden = false;
}

async function runCheck(url) {
  const submit = document.getElementById("headers-submit");
  const results = document.getElementById("headers-results");
  setError("");
  setStatus("Analyzing headers…", "loading");
  if (results) results.hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Analyzing…";
  }
  try {
    const res = await fetch(`/api/headers?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json" },
    });
    let payload;
    try {
      payload = await res.json();
    } catch {
      setStatus("Invalid API response.", "error");
      return;
    }
    if (!payload?.success) {
      const msg = payload?.error?.message || "Unable to analyze headers.";
      setStatus(msg, "error");
      const code = payload?.error?.code;
      if (code && /INVALID|MISSING|PRIVATE|SSRF|CREDENTIAL/.test(code)) setError(msg);
      return;
    }
    setStatus("");
    renderResults(payload.data);
  } catch (err) {
    setStatus(`Network error: ${err?.message || "failed"}`, "error");
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = "Analyze headers";
    }
  }
}

function setupForm() {
  const form = document.getElementById("headers-form");
  const input = document.getElementById("url-input");
  if (!form || !input) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) {
      setError("Please enter a URL.");
      return;
    }
    runCheck(value);
  });
  const prefill = new URLSearchParams(window.location.search).get("url");
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

document.addEventListener("DOMContentLoaded", () => {
  setupForm();
  setupNav();
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
});
