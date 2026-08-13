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
  document.getElementById("score-total").textContent = `${sec.total ?? "—"} / ${sec.max ?? 100}`;
  document.getElementById("score-grade").textContent = sec.grade || "";
  document.getElementById("score-label").textContent = sec.label || "";
  document.getElementById("score-version").textContent =
    `Mobile Score v${sec.version || "1.0"} · heuristic only — not Google Mobile-Friendly / Lighthouse / CWV`;
  const pct = Math.max(0, Math.min(100, sec.percentage ?? sec.total ?? 0));
  document.getElementById("score-bar").setAttribute("aria-valuenow", String(pct));
  document.getElementById("score-bar-fill").style.width = `${pct}%`;
  const cats = document.getElementById("score-cats");
  if (sec.categories) {
    cats.innerHTML = Object.entries(sec.categories)
      .map(([k, c]) => `<li><span>${escapeHtml(k)}</span><span>${c.score}/${c.max}</span></li>`)
      .join("");
  }

  document.getElementById("meta-grid").innerHTML = `
    <div><dt>Final URL</dt><dd><code>${escapeHtml(data.finalUrl || "")}</code></dd></div>
    <div><dt>Status</dt><dd><code>${escapeHtml(String(data.status))} ${escapeHtml(data.statusText || "")}</code></dd></div>
    <div><dt>Time</dt><dd><code>${escapeHtml(String(data.responseTimeMs ?? "—"))} ms</code></dd></div>
    <div><dt>Truncated</dt><dd><code>${data.truncated ? "yes" : "no"}</code></dd></div>
  `;

  const vp = data.viewport || {};
  document.getElementById("viewport-body").innerHTML = `
    <p><strong>Found</strong>: ${vp.found ? "yes" : "no"}</p>
    <p><strong>Quality</strong>: ${escapeHtml(vp.quality || "—")}</p>
    <p><strong>Content</strong>: <code>${escapeHtml(vp.content || "(none)")}</code></p>
    <p class="muted">device-width: ${vp.hasWidthDevice ? "yes" : "no"} · initial-scale: ${vp.hasInitialScale ? "yes" : "no"}</p>
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

  const img = data.images || {};
  const nav = data.navigation || {};
  document.getElementById("media-body").innerHTML = `
    <p>Images: ${img.total ?? 0} · srcset ${img.withSrcset ?? 0} · sizes ${img.withSizes ?? 0}</p>
    <p>Links: ${nav.total ?? 0} · density ${escapeHtml(nav.density || "—")}</p>
    <p>iframes: ${data.media?.iframes ?? 0} · tables: ${data.media?.tables ?? 0}</p>
  `;

  const seo = data.seo || {};
  document.getElementById("seo-body").innerHTML = `
    <p>Canonical: ${escapeHtml(seo.canonical?.value || "(none)")}</p>
    <p>Robots: ${escapeHtml(seo.robots?.content || "(none)")}</p>
    <p>Mobile alternate: ${seo.mobileAlternate ? "yes" : "no"}</p>
  `;

  document.getElementById("results").hidden = false;
}

async function runCheck(url) {
  const submit = document.getElementById("mobile-submit");
  setError("");
  setStatus("Analyzing mobile signals…", "loading");
  document.getElementById("results").hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Analyzing…";
  }
  try {
    const res = await fetch(`/api/mobile?url=${encodeURIComponent(url)}`, {
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
  document.getElementById("mobile-form")?.addEventListener("submit", (e) => {
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
