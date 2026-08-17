const FOCUS_CONFIG = {
  mx: {
    title: "MX Record Checker",
    action: "Check MX",
    loading: "Checking mail exchange records…",
    summary: "Mail exchange records tell other mail systems where to deliver email for this domain.",
  },
  spf: {
    title: "SPF Checker",
    action: "Check SPF",
    loading: "Checking SPF policy…",
    summary: "SPF publishes which senders are allowed to send mail on behalf of a domain.",
  },
  dmarc: {
    title: "DMARC Checker",
    action: "Check DMARC",
    loading: "Checking DMARC policy…",
    summary: "DMARC defines authentication alignment, policy enforcement, and reporting behavior for email.",
  },
  dkim: {
    title: "DKIM Checker",
    action: "Check DKIM",
    loading: "Checking DKIM public key…",
    summary: "DKIM publishes public keys used by receiving systems to validate signed email messages.",
  },
  nameserver: {
    title: "Nameserver Lookup",
    action: "Check nameservers",
    loading: "Looking up authoritative nameservers…",
    summary: "Nameserver records identify the DNS servers responsible for publishing a domain's DNS zone.",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function focusType() {
  const value = document.body?.dataset?.focus || "";
  return Object.hasOwn(FOCUS_CONFIG, value) ? value : "";
}

function setError(message) {
  const el = document.getElementById("domain-error");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || "";
}

function setStatus(message, kind) {
  const el = document.getElementById("focused-status");
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
  return `<div class="detail-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function recordBlock(title, value) {
  if (!value) return "";
  return `<div class="record-block"><h3>${escapeHtml(title)}</h3><pre class="record-value"><code>${escapeHtml(value)}</code></pre></div>`;
}

function listBlock(title, values) {
  if (!Array.isArray(values) || !values.length) return "";
  return `<div class="record-block"><h3>${escapeHtml(title)}</h3><ul class="notice-list">${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div>`;
}

function renderMx(result) {
  if (!result?.found) {
    setBadge("Not found", "muted");
    return '<p class="empty-note">No MX records are published for this domain.</p>';
  }

  setBadge("Found", "ok");
  const rows = (result.records || []).map((record) => `
    <tr><td>${escapeHtml(record.priority ?? "—")}</td><td><code>${escapeHtml(record.host || "—")}</code></td></tr>`).join("");
  return `
    <div class="detail-grid">${stat("MX records", String((result.records || []).length))}${stat("Mail routing", "Configured")}</div>
    <div class="record-block"><h3>Mail exchangers</h3><table class="record-table"><thead><tr><th>Priority</th><th>Mail server</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderSpf(result) {
  if (!result?.found) {
    setBadge("Missing", "error");
    return '<p class="empty-note">No SPF record beginning with <code>v=spf1</code> was found.</p>';
  }

  if (result.valid === false) setBadge("Invalid", "error");
  else if ((result.warnings || []).length) setBadge("Warning", "warn");
  else setBadge("Valid", "ok");

  return `
    <div class="detail-grid">
      ${stat("Policy", result.policy || "none")}
      ${stat("Record count", String(result.recordCount ?? 0))}
      ${stat("Syntax", result.valid ? "Valid" : "Invalid")}
      ${stat("Warnings", String((result.warnings || []).length))}
    </div>
    ${recordBlock("SPF record", result.record)}
    ${listBlock("Warnings", result.warnings)}`;
}

function renderDmarc(result) {
  if (!result?.found) {
    setBadge("Missing", "error");
    return '<p class="empty-note">No DMARC TXT record was found at <code>_dmarc.&lt;domain&gt;</code>.</p>';
  }

  if (result.valid === false) setBadge("Invalid", "error");
  else if (result.policy === "none") setBadge("Monitor only", "warn");
  else setBadge("Configured", "ok");

  const subdomain = result.subdomainPolicy == null ? "inherits p" : result.subdomainPolicy;
  return `
    <div class="detail-grid">
      ${stat("Policy (p)", result.policy || "—")}
      ${stat("Subdomain (sp)", subdomain)}
      ${stat("Applied percentage", result.percentage == null ? "—" : String(result.percentage))}
      ${stat("DKIM alignment", result.alignment?.dkim || "—")}
      ${stat("SPF alignment", result.alignment?.spf || "—")}
      ${stat("Syntax", result.valid ? "Valid" : "Invalid")}
    </div>
    ${recordBlock("DMARC record", result.record)}
    ${listBlock("Notes", result.warnings)}`;
}

function renderDkim(result) {
  if (!result?.found) {
    setBadge("Not found", "muted");
    const mode = result?.confidence === "explicit" ? "the supplied selector" : "heuristic selector discovery";
    return `<p class="empty-note">No DKIM public key was found using ${escapeHtml(mode)}.</p>${listBlock("Notes", result?.warnings)}`;
  }

  if (result.revoked) setBadge("Revoked", "warn");
  else if (result.valid === false) setBadge("Invalid", "error");
  else setBadge("Configured", "ok");

  const key = String(result.publicKey || "");
  const displayKey = key.length > 240 ? `${key.slice(0, 240)}…` : key;
  return `
    <div class="detail-grid">
      ${stat("Selector", result.selector || "—")}
      ${stat("Confidence", result.confidence || "—")}
      ${stat("Key type", result.keyType || "—")}
      ${stat("Key record", result.valid ? "Valid" : "Invalid")}
      ${stat("Revoked", result.revoked ? "Yes" : "No")}
    </div>
    ${recordBlock("DKIM record", result.record)}
    ${recordBlock("Public key", displayKey)}
    ${listBlock("Notes", result.warnings)}
    <p class="tool-boundary">This checks DNS public-key configuration only. It does not verify a signature from a specific email message.</p>`;
}

function renderNameserver(records) {
  const list = Array.isArray(records) ? records : [];
  if (!list.length) {
    setBadge("Not found", "muted");
    return '<p class="empty-note">No NS records were returned for this domain.</p>';
  }

  setBadge("Found", "ok");
  return `
    <div class="detail-grid">${stat("Nameservers", String(list.length))}${stat("DNS delegation", "Present")}</div>
    <div class="record-block"><h3>Authoritative nameservers</h3><table class="record-table"><thead><tr><th>#</th><th>Nameserver</th></tr></thead><tbody>${list.map((value, index) => `<tr><td>${index + 1}</td><td><code>${escapeHtml(value)}</code></td></tr>`).join("")}</tbody></table></div>`;
}

function renderResult(focus, domain, result) {
  const section = document.getElementById("focused-results");
  const domainEl = document.getElementById("result-domain");
  const summary = document.getElementById("result-summary");
  const details = document.getElementById("result-details");
  const config = FOCUS_CONFIG[focus];
  if (!section || !details || !config) return;

  if (domainEl) domainEl.textContent = domain;
  if (summary) summary.textContent = config.summary;

  if (focus === "mx") details.innerHTML = renderMx(result);
  else if (focus === "spf") details.innerHTML = renderSpf(result);
  else if (focus === "dmarc") details.innerHTML = renderDmarc(result);
  else if (focus === "dkim") details.innerHTML = renderDkim(result);
  else details.innerHTML = renderNameserver(result);

  section.hidden = false;
}

async function runCheck(domain, selector) {
  const focus = focusType();
  const config = FOCUS_CONFIG[focus];
  const submit = document.getElementById("focused-submit");
  const results = document.getElementById("focused-results");
  if (!config) return;

  setError("");
  setStatus(config.loading, "loading");
  if (results) results.hidden = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Checking…";
  }

  try {
    let api;
    if (focus === "nameserver") {
      api = `/api/dns?domain=${encodeURIComponent(domain)}`;
    } else {
      api = `/api/email-check?domain=${encodeURIComponent(domain)}&check=${encodeURIComponent(focus)}`;
      if (focus === "dkim" && selector) api += `&selector=${encodeURIComponent(selector)}`;
    }

    const response = await fetch(api, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => null);
    if (!payload?.success) {
      const message = payload?.error?.message || "Unable to complete this check.";
      setStatus(message, "error");
      if (/DOMAIN|SELECTOR|CHECK/.test(payload?.error?.code || "")) setError(message);
      return;
    }

    setStatus("");
    if (focus === "nameserver") {
      renderResult(focus, payload.data.domain, payload.data.records?.NS || []);
    } else {
      renderResult(focus, payload.data.domain, payload.data.result);
    }
  } catch (error) {
    setStatus(`Network error: ${error?.message || "request failed"}.`, "error");
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = config.action;
    }
  }
}

function setupPage() {
  const focus = focusType();
  const config = FOCUS_CONFIG[focus];
  const form = document.getElementById("focused-form");
  const domainInput = document.getElementById("domain-input");
  const selectorRow = document.getElementById("focus-selector-row");
  const selectorInput = document.getElementById("selector-input");
  const submit = document.getElementById("focused-submit");
  if (!config || !form || !domainInput) return;

  if (submit) submit.textContent = config.action;
  if (selectorRow) selectorRow.hidden = focus !== "dkim";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const domain = domainInput.value.trim();
    if (!domain) {
      setError("Please enter a domain name.");
      setStatus("");
      domainInput.focus();
      return;
    }
    runCheck(domain, (selectorInput?.value || "").trim());
  });

  const params = new URLSearchParams(location.search);
  const domain = params.get("domain");
  const selector = params.get("selector");
  if (selector && selectorInput) selectorInput.value = selector;
  if (domain) {
    domainInput.value = domain;
    runCheck(domain.trim(), (selector || "").trim());
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

document.addEventListener("DOMContentLoaded", setupPage);
