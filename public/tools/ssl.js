function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function setError(msg) {
  const el = document.getElementById("url-error");
  if (!el) return;
  el.hidden = !msg;
  el.textContent = msg || "";
}
function setStatus(msg, kind) {
  const el = document.getElementById("status");
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    el.className = "tool-status";
    return;
  }
  el.hidden = false;
  el.textContent = msg;
  el.className = "tool-status" + (kind ? ` ${kind}` : "");
}

function render(data) {
  const sec = data.score || {};
  const analysis = data.analysis || {};
  document.getElementById("score-total").textContent = `${sec.total ?? "—"} / ${sec.max ?? 100}`;
  document.getElementById("score-grade").textContent = sec.grade || "";
  document.getElementById("score-label").textContent = sec.label || "";
  document.getElementById("score-version").textContent =
    `Score v${sec.version || "1.0"} · observable HTTPS/HSTS only — no certificate chain audit`;
  const pct = Math.max(0, Math.min(100, sec.percentage ?? sec.total ?? 0));
  document.getElementById("score-bar").setAttribute("aria-valuenow", String(pct));
  document.getElementById("score-bar-fill").style.width = `${pct}%`;
  const cats = document.getElementById("score-cats");
  if (sec.categories) {
    cats.innerHTML = Object.entries(sec.categories)
      .map(([k, c]) => `<li><span>${escapeHtml(k)}</span><span>${c.score}/${c.max}</span></li>`)
      .join("");
  }

  const https = analysis.https || {};
  const up = analysis.httpUpgrade || {};
  document.getElementById("https-body").innerHTML = `
    <p><strong>HTTPS available</strong>: ${https.available ? "yes" : "no"}</p>
    <p><strong>Status</strong>: ${escapeHtml(String(https.status ?? "—"))} ${escapeHtml(https.statusText || "")}</p>
    <p><strong>Final URL</strong>: <code>${escapeHtml(https.finalUrl || "")}</code></p>
    <p><strong>HTTP→HTTPS</strong>: ${up.checked ? (up.redirectsToHttps ? "yes" : "no") : "not checked"}</p>
  `;

  const hsts = analysis.hsts || {};
  document.getElementById("hsts-body").innerHTML = `
    <p><strong>Present</strong>: ${hsts.present ? "yes" : "no"}</p>
    <p><strong>max-age</strong>: ${hsts.maxAge != null ? escapeHtml(String(hsts.maxAge)) : "—"}</p>
    <p><strong>includeSubDomains</strong>: ${hsts.includeSubDomains ? "yes" : "no"}</p>
    <p><strong>preload</strong>: ${hsts.preload ? "yes" : "no"}</p>
    <p><code>${escapeHtml(hsts.raw || "(none)")}</code></p>
  `;

  const cert = analysis.tlsCertificate || {};
  document.getElementById("cert-body").innerHTML = `
    <p class="muted">${escapeHtml(cert.reason || "Certificate details are not observable in this runtime.")}</p>
    <ul class="flags">
      <li>issuer: not_observable</li>
      <li>SANs: not_observable</li>
      <li>expiry: not_observable</li>
      <li>TLS version / cipher: not_observable</li>
    </ul>
  `;

  const fl = sec.findings || [];
  document.getElementById("findings-list").innerHTML = fl.length
    ? fl
        .map(
          (f) =>
            `<li class="${escapeHtml(f.severity || "info")}"><strong>${escapeHtml(f.title || f.code)}</strong> — ${escapeHtml(f.message || "")}</li>`
        )
        .join("")
    : "<li>No findings.</li>";

  const rl = sec.recommendations || [];
  document.getElementById("recs-list").innerHTML = rl.length
    ? rl
        .map(
          (r) =>
            `<li><strong>${escapeHtml(r.title || r.code)}</strong> — ${escapeHtml(r.message || "")}</li>`
        )
        .join("")
    : "<li>No recommendations.</li>";

  document.getElementById("results").hidden = false;
}

async function runCheck(url) {
  const submit = document.getElementById("ssl-submit");
  setError("");
  setStatus("Probing HTTPS configuration…", "loading");
  document.getElementById("results").hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Analyzing…";
  }
  try {
    const res = await fetch(`/api/ssl?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await res.json();
    if (!payload?.success) {
      const msg = payload?.error?.message || "Unable to analyze.";
      setStatus(msg, "error");
      if (
        payload?.error?.code &&
        /INVALID|MISSING|PRIVATE|SSRF|CREDENTIAL/.test(payload.error.code)
      )
        setError(msg);
      return;
    }
    setStatus("");
    render(payload.data);
  } catch (err) {
    setStatus(`Network error: ${err?.message || "failed"}`, "error");
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = "Analyze";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("ssl-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = document.getElementById("url-input").value.trim();
    if (!v) {
      setError("Enter a URL");
      return;
    }
    runCheck(v);
  });
  const pre = new URLSearchParams(location.search).get("url");
  if (pre) {
    document.getElementById("url-input").value = pre;
    runCheck(pre.trim());
  }
  const toggle = document.getElementById("nav-toggle");
  const nav = document.querySelector(".nav");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  const y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
});
