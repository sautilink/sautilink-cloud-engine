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
  document.getElementById("score-total").textContent =
    sec.total != null ? `${sec.total} / ${sec.max ?? 100}` : "—";
  document.getElementById("score-grade").textContent = sec.grade || "";
  document.getElementById("score-label").textContent = sec.label || "";
  document.getElementById("score-version").textContent =
    `Audit score v${sec.version || "1.0"} · ${escapeHtml(sec.disclaimer || "Cloud Engine assessment")}`;
  const pct = Math.max(0, Math.min(100, sec.percentage ?? sec.total ?? 0));
  document.getElementById("score-bar").setAttribute("aria-valuenow", String(pct));
  document.getElementById("score-bar-fill").style.width = `${pct}%`;

  const cats = data.categories || {};
  document.getElementById("score-cats").innerHTML = Object.entries(cats)
    .map(([k, c]) => {
      const val =
        c.available && c.score != null
          ? `${c.score}/100 · ${escapeHtml(c.grade || "")}`
          : `n/a (${escapeHtml(c.status || "unavailable")})`;
      return `<li><span>${escapeHtml(k)} <small>w${c.weight ?? ""}</small></span><span>${val}</span></li>`;
    })
    .join("");

  const az = data.analyzers || {};
  document.getElementById("analyzer-list").innerHTML = Object.entries(az)
    .map(
      ([id, a]) =>
        `<li><code>${escapeHtml(id)}</code> — ${escapeHtml(a.status || "?")} · ${escapeHtml(String(a.durationMs ?? 0))}ms${a.error ? ` · ${escapeHtml(a.error.code || "")}` : ""}</li>`
    )
    .join("");

  const fl = data.findings || [];
  document.getElementById("findings-list").innerHTML = fl.length
    ? fl
        .slice(0, 40)
        .map(
          (f) =>
            `<li class="${escapeHtml(f.severity || "info")}"><strong>${escapeHtml(f.title || f.code)}</strong> <small>[${escapeHtml(f.source || "")}]</small> — ${escapeHtml(f.message || "")}</li>`
        )
        .join("")
    : "<li>No findings.</li>";

  const rl = data.recommendations || [];
  document.getElementById("recs-list").innerHTML = rl.length
    ? rl
        .slice(0, 25)
        .map(
          (r) =>
            `<li><strong>${escapeHtml(r.title || r.code)}</strong> <small>[${escapeHtml(r.source || "")}]</small> — ${escapeHtml(r.message || "")}</li>`
        )
        .join("")
    : "<li>No recommendations.</li>";

  document.getElementById("results").hidden = false;
}

async function runCheck(url) {
  const submit = document.getElementById("audit-submit");
  setError("");
  setStatus("Running unified audit (may take up to ~18s)…", "loading");
  document.getElementById("results").hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Auditing…";
  }
  try {
    const res = await fetch(`/api/audit?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await res.json();
    if (!payload?.success) {
      const msg = payload?.error?.message || "Audit failed.";
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
      submit.textContent = "Run audit";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("audit-form")?.addEventListener("submit", (e) => {
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
