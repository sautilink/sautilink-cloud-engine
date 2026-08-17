function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mode() {
  return document.body?.dataset?.infraMode === "rdns" ? "rdns" : "ip";
}

function setError(message) {
  const el = document.getElementById("infra-error");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || "";
}

function setStatus(message, kind) {
  const el = document.getElementById("infra-status");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.className = "tool-status";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = `tool-status${kind ? ` ${kind}` : ""}`;
}

function setBadge(text, state) {
  const el = document.getElementById("result-badge");
  if (!el) return;
  el.textContent = text;
  el.className = `state-badge${state ? ` ${state}` : ""}`;
}

function stat(label, value) {
  return `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function addresses(title, list) {
  const values = Array.isArray(list) ? list : [];
  if (!values.length) return `<div class="address-group"><h3>${escapeHtml(title)}</h3><p class="empty-note">No records returned.</p></div>`;
  return `<div class="address-group"><h3>${escapeHtml(title)}</h3><ul class="address-list">${values.map((value) => `<li><code>${escapeHtml(value)}</code></li>`).join("")}</ul></div>`;
}

function renderIp(data) {
  const title = document.getElementById("result-title");
  const summary = document.getElementById("result-summary");
  const details = document.getElementById("result-details");
  if (!title || !summary || !details) return;

  if (data.kind === "domain") {
    title.textContent = data.domain || data.query || "Domain result";
    setBadge("Resolved", "ok");
    summary.textContent = "Forward DNS resolution through the shared Cloud Engine DNS engine.";
    details.innerHTML = `
      <div class="stat-grid">
        ${stat("IPv4 addresses", String((data.ipv4 || []).length))}
        ${stat("IPv6 addresses", String((data.ipv6 || []).length))}
      </div>
      ${addresses("A records", data.ipv4)}
      ${addresses("AAAA records", data.ipv6)}
      <p class="boundary-note">This tool resolves public DNS addresses. ASN, geolocation, and hosting-provider attribution are not inferred in this phase.</p>`;
    return;
  }

  title.textContent = data.ip || data.query || "IP result";
  setBadge("Public IP", "ok");
  summary.textContent = "Public IP validation with reverse-DNS context when a PTR record is available.";
  const reverse = data.reverse || {};
  details.innerHTML = `
    <div class="stat-grid">
      ${stat("IP version", data.version ? `IPv${data.version}` : "—")}
      ${stat("PTR hostnames", String((reverse.hostnames || []).length))}
    </div>
    ${addresses("Reverse DNS hostnames", reverse.hostnames)}
    <div class="address-group"><h3>Reverse query name</h3><ul class="address-list"><li><code>${escapeHtml(reverse.reverseName || "—")}</code></li></ul></div>
    <p class="boundary-note">Private, reserved, documentation, multicast, and other blocked IP ranges are rejected.</p>`;
}

function renderRdns(data) {
  const title = document.getElementById("result-title");
  const summary = document.getElementById("result-summary");
  const details = document.getElementById("result-details");
  if (!title || !summary || !details) return;

  title.textContent = data.ip || "Reverse DNS result";
  const found = (data.hostnames || []).length > 0;
  setBadge(found ? "PTR found" : "No PTR", found ? "ok" : "muted");
  summary.textContent = found
    ? "One or more PTR hostnames were returned for this public IP address."
    : "The lookup completed, but no PTR hostname was published for this public IP address.";
  details.innerHTML = `
    <div class="stat-grid">
      ${stat("IP version", data.version ? `IPv${data.version}` : "—")}
      ${stat("PTR hostnames", String((data.hostnames || []).length))}
    </div>
    ${addresses("PTR records", data.hostnames)}
    <div class="address-group"><h3>Reverse query name</h3><ul class="address-list"><li><code>${escapeHtml(data.reverseName || "—")}</code></li></ul></div>
    <p class="boundary-note">A PTR record is descriptive DNS data; it does not prove ownership, reputation, geolocation, or service identity by itself.</p>`;
}

async function runLookup(value) {
  const currentMode = mode();
  const submit = document.getElementById("infra-submit");
  const results = document.getElementById("infra-results");
  setError("");
  setStatus(currentMode === "rdns" ? "Looking up PTR records…" : "Resolving public IP information…", "loading");
  if (results) results.hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Checking…";
  }

  try {
    const endpoint = currentMode === "rdns"
      ? `/api/rdns?ip=${encodeURIComponent(value)}`
      : `/api/ip?query=${encodeURIComponent(value)}`;
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => null);
    if (!payload?.success) {
      const message = payload?.error?.message || "Unable to complete this infrastructure lookup.";
      setStatus(message, "error");
      if (/IP|DOMAIN|QUERY|PRIVATE|RESERVED/.test(payload?.error?.code || "")) setError(message);
      return;
    }

    setStatus("");
    if (currentMode === "rdns") renderRdns(payload.data);
    else renderIp(payload.data);
    if (results) results.hidden = false;
  } catch (error) {
    setStatus(`Network error: ${error?.message || "request failed"}.`, "error");
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = currentMode === "rdns" ? "Check reverse DNS" : "Look up IP";
    }
  }
}

function setup() {
  const currentMode = mode();
  const form = document.getElementById("infra-form");
  const input = document.getElementById("infra-input");
  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      setError(currentMode === "rdns" ? "Please enter a public IP address." : "Please enter a public domain or IP address.");
      setStatus("");
      input.focus();
      return;
    }
    runLookup(value);
  });

  const params = new URLSearchParams(location.search);
  const prefill = params.get(currentMode === "rdns" ? "ip" : "query");
  if (prefill) {
    input.value = prefill;
    runLookup(prefill.trim());
  }

  const toggle = document.getElementById("nav-toggle");
  const nav = document.querySelector(".nav");
  toggle?.addEventListener("click", () => {
    const open = nav?.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", setup);
