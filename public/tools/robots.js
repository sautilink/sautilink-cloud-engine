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
  const el = document.getElementById("robots-status");
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
    `Score model v${sec.version || "1.0"} · configuration assessment only`;
  const pct = Math.max(0, Math.min(100, sec.percentage ?? sec.total ?? 0));
  const bar = document.getElementById("score-bar");
  const fill = document.getElementById("score-bar-fill");
  if (bar) bar.setAttribute("aria-valuenow", String(pct));
  if (fill) fill.style.width = `${pct}%`;
  const cats = document.getElementById("score-cats");
  if (cats && sec.categories) {
    cats.innerHTML = Object.entries(sec.categories)
      .map(
        ([k, c]) =>
          `<li><span>${escapeHtml(k)}</span><span>${c.score}/${c.max}</span></li>`
      )
      .join("");
  }

  const meta = document.getElementById("meta-grid");
  meta.innerHTML = `
    <div><dt>robots.txt</dt><dd><code>${escapeHtml(data.robotsUrl || "")}</code></dd></div>
    <div><dt>Final URL</dt><dd><code>${escapeHtml(data.finalUrl || "")}</code></dd></div>
    <div><dt>Status</dt><dd><code>${escapeHtml(String(data.status))} ${escapeHtml(data.statusText || "")}</code></dd></div>
    <div><dt>Found</dt><dd><code>${data.robots?.found ? "yes" : "no"}</code></dd></div>
    <div><dt>Time</dt><dd><code>${escapeHtml(String(data.responseTimeMs ?? "—"))} ms</code></dd></div>
    <div><dt>Groups</dt><dd><code>${escapeHtml(String(data.robots?.summary?.groups ?? 0))}</code></dd></div>
    <div><dt>Wildcard *</dt><dd><code>${data.robots?.summary?.wildcard ? "yes" : "no"}</code></dd></div>
  `;

  const findings = document.getElementById("findings-list");
  const fl = sec.findings || [];
  findings.innerHTML = fl.length
    ? fl
        .map(
          (f) =>
            `<li class="${escapeHtml(f.severity || "info")}"><strong>${escapeHtml(f.title || f.code)}</strong> — ${escapeHtml(f.message || "")}</li>`
        )
        .join("")
    : "<li>No findings.</li>";

  const recs = document.getElementById("recs-list");
  const rl = sec.recommendations || [];
  recs.innerHTML = rl.length
    ? rl
        .map(
          (r) =>
            `<li><strong>${escapeHtml(r.title || r.code)}</strong> (${escapeHtml(r.priority || "")}) — ${escapeHtml(r.message || "")}</li>`
        )
        .join("")
    : "<li>No recommendations.</li>";

  const groupsBody = document.getElementById("groups-body");
  const groups = data.robots?.groups || [];
  if (!groups.length) {
    groupsBody.innerHTML = `<p class="empty">No user-agent groups parsed.</p>`;
  } else {
    groupsBody.innerHTML = groups
      .map((g) => {
        const uas = (g.userAgents || []).map((u) => `<code>${escapeHtml(u)}</code>`).join(", ");
        const allows = (g.allow || []).map((p) => `<li><code>Allow: ${escapeHtml(p || "(empty)")}</code></li>`).join("");
        const dis = (g.disallow || []).map((p) => `<li><code>Disallow: ${escapeHtml(p || "(empty)")}</code></li>`).join("");
        return `<div class="group"><p class="ua">User-agent: ${uas}</p><ul>${allows}${dis || "<li class=\"empty\">No path rules</li>"}</ul></div>`;
      })
      .join("");
  }

  const sm = document.getElementById("sitemaps-body");
  const list = data.robots?.sitemaps || [];
  sm.innerHTML = list.length
    ? `<ul>${list.map((s) => `<li><code>${escapeHtml(s)}</code></li>`).join("")}</ul><p class="empty">Sitemap URLs are not fetched in this tool.</p>`
    : `<p class="empty">No Sitemap directives.</p>`;

  document.getElementById("robots-results").hidden = false;
}

async function runCheck(url) {
  const submit = document.getElementById("robots-submit");
  setError("");
  setStatus("Fetching robots.txt…", "loading");
  document.getElementById("robots-results").hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Analyzing…";
  }
  try {
    const res = await fetch(`/api/robots?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await res.json();
    if (!payload?.success) {
      const msg = payload?.error?.message || "Unable to analyze robots.txt.";
      setStatus(msg, "error");
      if (payload?.error?.code && /INVALID|MISSING|PRIVATE|SSRF|CREDENTIAL/.test(payload.error.code))
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
      submit.textContent = "Analyze robots.txt";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("robots-form");
  const input = document.getElementById("url-input");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) {
      setError("Please enter a URL.");
      return;
    }
    runCheck(v);
  });
  const pre = new URLSearchParams(location.search).get("url");
  if (pre) {
    input.value = pre;
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
