/**
 * SautiLink Cloud Engine — client-side application
 */

const TOOL_CATEGORIES = [
  {
    id: "website-seo",
    name: "Website & SEO",
    description: "Analyze sites, crawlers, performance and search readiness.",
    tools: [
      { id: "seo-checker", name: "SEO Checker", description: "Inspect on-page SEO signals for a given URL.", route: "/tools/seo", status: "coming_soon" },
      { id: "http-status", name: "HTTP Status Checker", description: "Check response status codes and redirects.", route: "/tools/http-status", status: "available" },
      { id: "robots", name: "Robots.txt Analyzer", description: "Fetch and analyze robots.txt rules.", route: "/tools/robots", status: "coming_soon" },
      { id: "sitemap", name: "Sitemap Analyzer", description: "Inspect XML sitemaps and coverage.", route: "/tools/sitemap", status: "coming_soon" },
      { id: "mobile-friendly", name: "Mobile Friendly Checker", description: "Evaluate mobile usability signals.", route: "/tools/mobile", status: "coming_soon" },
      { id: "lighthouse", name: "Lighthouse / Performance", description: "Performance, accessibility and best-practice insights.", route: "/tools/performance", status: "coming_soon" },
    ],
  },
  {
    id: "dns-email",
    name: "DNS & Email",
    description: "Inspect DNS records and email authentication setup.",
    tools: [
      { id: "dns-lookup", name: "DNS Lookup", description: "Query common DNS record types for a domain.", route: "/tools/dns", status: "available" },
      { id: "email-infra", name: "Email Infrastructure Checker", description: "Check MX mail servers and SPF sender policy for a domain.", route: "/tools/email", status: "available" },
      { id: "mx", name: "MX Record Checker", description: "Check the mail exchange records configured for a domain.", route: "/tools/mx", status: "coming_soon" },
      { id: "spf", name: "SPF Checker", description: "Validate SPF records and policy.", route: "/tools/spf", status: "coming_soon" },
      { id: "dkim", name: "DKIM Checker", description: "Inspect DKIM selectors and keys.", route: "/tools/dkim", status: "coming_soon" },
      { id: "dmarc", name: "DMARC Checker", description: "Review DMARC policy and reporting setup.", route: "/tools/dmarc", status: "coming_soon" },
      { id: "nameserver", name: "Nameserver Lookup", description: "List authoritative nameservers for a domain.", route: "/tools/nameserver", status: "coming_soon" },
    ],
  },
  {
    id: "security",
    name: "Security",
    description: "Basic security posture and infrastructure detection.",
    tools: [
      { id: "blacklist", name: "Blacklist Checker", description: "Check domain/IP against common blacklists.", route: "/tools/blacklist", status: "coming_soon" },
      { id: "ssl", name: "SSL/TLS Checker", description: "Inspect certificate chain and TLS configuration.", route: "/tools/ssl", status: "coming_soon" },
      { id: "security-headers", name: "Security Headers", description: "Review HTTP security headers.", route: "/tools/security-headers", status: "coming_soon" },
      { id: "port-scanner", name: "Basic Port Scanner", description: "Check common open ports (carefully rate-limited).", route: "/tools/ports", status: "coming_soon" },
      { id: "waf", name: "WAF Detector", description: "Detect presence of a Web Application Firewall.", route: "/tools/waf", status: "coming_soon" },
      { id: "cloudflare", name: "Cloudflare Detector", description: "Detect Cloudflare proxying and related signals.", route: "/tools/cloudflare", status: "coming_soon" },
      { id: "cdn", name: "CDN Detector", description: "Identify CDN providers in use.", route: "/tools/cdn", status: "coming_soon" },
    ],
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    description: "Hosting, IP, ASN and server information.",
    tools: [
      { id: "ip", name: "IP Lookup", description: "Resolve and inspect IP address details.", route: "/tools/ip", status: "coming_soon" },
      { id: "asn", name: "ASN Lookup", description: "Find Autonomous System information.", route: "/tools/asn", status: "coming_soon" },
      { id: "hosting", name: "Hosting Provider Detector", description: "Identify likely hosting or cloud provider.", route: "/tools/hosting", status: "coming_soon" },
      { id: "rdns", name: "Reverse DNS", description: "Perform reverse DNS (PTR) lookups.", route: "/tools/rdns", status: "coming_soon" },
      { id: "http-headers", name: "HTTP Headers", description: "Fetch and display response headers.", route: "/tools/headers", status: "coming_soon" },
      { id: "server-info", name: "Server Information", description: "Gather basic server and technology signals.", route: "/tools/server", status: "coming_soon" },
    ],
  },
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCategories() {
  const root = document.getElementById("tool-categories");
  if (!root) return;
  root.innerHTML = TOOL_CATEGORIES.map((cat) => {
    const cards = cat.tools
      .map((tool) => {
        const isAvailable = tool.status === "available";
        const badgeClass = isAvailable ? "badge available" : "badge";
        const badgeText = isAvailable ? "Available" : "Coming Soon";
        const btn = isAvailable
          ? `<a class="btn btn-secondary" href="${escapeHtml(tool.route)}">Open Tool</a>`
          : `<button type="button" class="btn btn-secondary" disabled aria-disabled="true">Open Tool</button>`;
        return `
          <article class="tool-card" data-tool-id="${escapeHtml(tool.id)}">
            <h4>${escapeHtml(tool.name)}</h4>
            <p>${escapeHtml(tool.description)}</p>
            <div class="card-footer">
              <span class="${badgeClass}">${badgeText}</span>
              ${btn}
            </div>
          </article>`;
      })
      .join("");
    return `
      <div class="category" id="cat-${escapeHtml(cat.id)}">
        <div class="category-header">
          <h3>${escapeHtml(cat.name)}</h3>
          <p>${escapeHtml(cat.description)}</p>
        </div>
        <div class="tool-grid">${cards}</div>
      </div>`;
  }).join("");
}

function setupNav() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.querySelector(".nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setupSearch() {
  const form = document.getElementById("universal-search");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("search-input");
    const q = (input?.value || "").trim().toLowerCase();
    const toolsSection = document.getElementById("tools");
    if (toolsSection) toolsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!q) return;
    document.querySelectorAll(".tool-card").forEach((card) => {
      const name = card.querySelector("h4")?.textContent?.toLowerCase() || "";
      const desc = card.querySelector("p")?.textContent?.toLowerCase() || "";
      const match = name.includes(q) || desc.includes(q);
      card.style.display = match ? "" : "none";
    });
    const visible = document.querySelectorAll('.tool-card:not([style*="display: none"])');
    if (visible.length === 0) {
      document.querySelectorAll(".tool-card").forEach((c) => { c.style.display = ""; });
    }
  });
}

async function tryHealth() {
  const btn = document.getElementById("try-health");
  const result = document.getElementById("health-result");
  if (!btn || !result) return;
  btn.disabled = true;
  btn.textContent = "Checking…";
  result.hidden = false;
  result.className = "api-result";
  result.textContent = "Requesting /api/health …";
  try {
    const res = await fetch("/api/health", { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    let formatted = text;
    try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
    result.textContent = formatted;
    result.classList.add(res.ok ? "ok" : "err");
  } catch (err) {
    result.textContent = `Network error: ${err?.message || "request failed"}`;
    result.classList.add("err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Try it live";
  }
}

function setupHealth() {
  const btn = document.getElementById("try-health");
  if (btn) btn.addEventListener("click", tryHealth);
}

function setupTelegramPlaceholder() {
  const btn = document.getElementById("telegram-btn");
  if (!btn) return;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    alert(
      "The SautiLink Cloud Engine Telegram Bot is not yet published.\n\n" +
        "When the bot goes live, this button will open the official bot chat.\n" +
        "Placeholder only — no username has been assigned yet."
    );
  });
}

function setYear() {
  const el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", () => {
  renderCategories();
  setupNav();
  setupSearch();
  setupHealth();
  setupTelegramPlaceholder();
  setYear();
});
