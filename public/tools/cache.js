/** Passive cache/compression view over the existing /api/headers response probe. */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setError(message) {
  const el = document.getElementById("cache-error");
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
}

function setStatus(message, kind) {
  const el = document.getElementById("cache-status");
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
  el.className = "tool-status" + (kind ? ` ${kind}` : "");
}

function signalRow(label, value) {
  const display = value == null || value === "" ? "Not observed" : String(value);
  return `<div class="signal-item"><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(display)}</code></dd></div>`;
}

function parseCacheControl(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw.split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    if (index === -1) return { name: part.toLowerCase(), value: null, raw: part };
    const name = part.slice(0, index).trim().toLowerCase();
    const val = part.slice(index + 1).trim().replace(/^"|"$/g, "");
    return { name, value: val, raw: part };
  });
}

function directiveMap(directives) {
  return new Map(directives.map((item) => [item.name, item.value ?? true]));
}

function describeCache(headers) {
  const directives = parseCacheControl(headers["cache-control"]);
  const map = directiveMap(directives);
  if (map.has("no-store")) {
    return { tone: "warn", title: "Storage disabled", message: "Cache-Control includes no-store, so caches are instructed not to store this response." };
  }
  if (map.has("private")) {
    return { tone: "private", title: "Private caching policy", message: "Cache-Control includes private, indicating shared caches should not store the response." };
  }
  if (map.has("no-cache")) {
    return { tone: "review", title: "Revalidation required", message: "Cache-Control includes no-cache, which allows storage but requires revalidation before reuse." };
  }
  if (map.has("public") || map.has("max-age") || map.has("s-maxage")) {
    const ttl = map.get("s-maxage") !== undefined ? `s-maxage=${map.get("s-maxage")}` : map.get("max-age") !== undefined ? `max-age=${map.get("max-age")}` : "public";
    return { tone: "good", title: "Explicit cache policy observed", message: `The response advertises ${ttl}. Suitability depends on the resource and application behavior.` };
  }
  if (headers.expires) {
    return { tone: "review", title: "Legacy freshness signal observed", message: "Expires is present, but no explicit modern Cache-Control freshness directive was observed." };
  }
  return { tone: "muted", title: "No explicit cache policy observed", message: "Cloud Engine did not observe Cache-Control or an equivalent explicit freshness policy on this response." };
}

function describeCompression(headers) {
  const encoding = String(headers["content-encoding"] || "").trim().toLowerCase();
  if (!encoding) {
    return { tone: "muted", title: "No content encoding observed", message: "This response did not expose Content-Encoding to the Cloud Engine request. Negotiated delivery may differ for other clients." };
  }
  const recognized = new Set(["br", "gzip", "zstd", "deflate"]);
  const names = encoding.split(",").map((v) => v.trim()).filter(Boolean);
  const known = names.every((name) => recognized.has(name));
  return {
    tone: known ? "good" : "review",
    title: "Content encoding observed",
    message: `Content-Encoding: ${encoding}. This reports the observed representation only, not a compression ratio or benchmark.`,
  };
}

function renderVerdict(id, verdict) {
  const root = document.getElementById(id);
  if (!root) return;
  root.className = `verdict ${verdict.tone}`;
  root.innerHTML = `<strong>${escapeHtml(verdict.title)}</strong><p>${escapeHtml(verdict.message)}</p>`;
}

function renderDirectives(headers) {
  const root = document.getElementById("directive-list");
  if (!root) return;
  const directives = parseCacheControl(headers["cache-control"]);
  if (!directives.length) {
    root.innerHTML = '<p class="empty-note">No Cache-Control directives were observed.</p>';
    return;
  }
  root.innerHTML = `<div class="directive-grid">${directives.map((item) => `<div class="directive-pill"><strong>${escapeHtml(item.name)}</strong>${item.value == null ? "" : `<code>${escapeHtml(item.value)}</code>`}</div>`).join("")}</div>`;
}

function buildNotes(headers) {
  const notes = [];
  const directives = directiveMap(parseCacheControl(headers["cache-control"]));
  if (!headers.etag && !headers["last-modified"]) notes.push("No ETag or Last-Modified validator was observed for conditional revalidation.");
  if (directives.has("immutable")) notes.push("The immutable directive is present; use it only when the resource URL changes whenever content changes.");
  if (directives.has("must-revalidate")) notes.push("must-revalidate is present, requiring stale cached responses to be revalidated before reuse.");
  if (directives.has("stale-while-revalidate")) notes.push(`stale-while-revalidate=${directives.get("stale-while-revalidate")} allows controlled stale reuse while caches refresh in the background.`);
  if (directives.has("stale-if-error")) notes.push(`stale-if-error=${directives.get("stale-if-error")} allows eligible caches to reuse stale content during certain upstream failures.`);
  if (String(headers.vary || "").trim() === "*") notes.push("Vary: * was observed; shared cache reuse is generally prevented because every request is treated as a different representation.");
  if (headers.vary && /cookie/i.test(headers.vary)) notes.push("Vary includes Cookie, which can greatly reduce shared-cache reuse depending on request traffic.");
  if (headers.age) notes.push(`Age: ${headers.age} was observed, indicating the response may have spent time in a cache before reaching Cloud Engine.`);
  if (!headers["content-encoding"]) notes.push("No Content-Encoding header was observed; this is not proof that all clients receive an uncompressed representation.");
  if (!notes.length) notes.push("No special review note was generated from the observed cache and encoding headers.");
  return notes;
}

function renderResults(data) {
  const headers = data.headers || {};
  const section = document.getElementById("cache-results");
  const url = document.getElementById("result-url");
  const summary = document.getElementById("result-summary");
  const badge = document.getElementById("cache-badge");
  const grid = document.getElementById("cache-grid");
  const notes = document.getElementById("review-notes");

  if (url) url.textContent = data.finalUrl || data.url || "";
  if (summary) summary.textContent = `HTTP ${data.status || "—"} ${data.statusText || ""} · ${data.protocol || "HTTP"} · ${data.responseTimeMs ?? "—"} ms`.trim();
  const cacheVerdict = describeCache(headers);
  if (badge) {
    badge.textContent = cacheVerdict.tone === "good" ? "Cache policy" : cacheVerdict.tone === "warn" ? "No-store" : "Review";
    badge.className = `state-badge ${cacheVerdict.tone === "good" ? "ok" : cacheVerdict.tone === "warn" ? "warn" : "muted"}`;
  }
  renderVerdict("cache-verdict", cacheVerdict);
  renderVerdict("compression-verdict", describeCompression(headers));

  if (grid) {
    grid.innerHTML = [
      signalRow("Cache-Control", headers["cache-control"]),
      signalRow("Expires", headers.expires),
      signalRow("Age", headers.age),
      signalRow("ETag", headers.etag),
      signalRow("Last-Modified", headers["last-modified"]),
      signalRow("Vary", headers.vary),
      signalRow("Content-Encoding", headers["content-encoding"]),
      signalRow("Content-Length", headers["content-length"]),
      signalRow("Transfer-Encoding", headers["transfer-encoding"]),
      signalRow("Accept-Ranges", headers["accept-ranges"]),
    ].join("");
  }

  renderDirectives(headers);
  if (notes) notes.innerHTML = buildNotes(headers).map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  if (section) section.hidden = false;
}

async function runCheck(target) {
  const submit = document.getElementById("cache-submit");
  const results = document.getElementById("cache-results");
  setError("");
  setStatus("Inspecting cache policy and representation signals…", "loading");
  if (results) results.hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Inspecting…";
  }
  try {
    const response = await fetch(`/api/headers?url=${encodeURIComponent(target)}`, { method: "GET", headers: { Accept: "application/json" } });
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
      submit.textContent = "Inspect delivery";
    }
  }
}

function setupForm() {
  const form = document.getElementById("cache-form");
  const input = document.getElementById("cache-url");
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
