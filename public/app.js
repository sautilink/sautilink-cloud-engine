/**
 * SautiLink Cloud Engine — flagship web workspace.
 * Tool registry mirrors src/config/tools.js until a shared browser-safe registry is introduced.
 */

const RECENTS_KEY = "sautilink.cloudengine.recentTargets.v1";
const MAX_RECENTS = 5;

const TOOL_CATEGORIES = [
  {
    id: "website-seo",
    name: "Website & SEO",
    description: "Analyze sites, crawlers, performance and search readiness.",
    tools: [
      { id: "audit", name: "Website Audit", description: "Unified multi-analyzer report for a public URL.", route: "/tools/audit", status: "available" },
      { id: "website", name: "Website SEO & Performance", description: "On-page SEO, structure, social tags, and request-level timing.", route: "/tools/website", status: "available" },
      { id: "http-status", name: "HTTP Status Checker", description: "Check response status codes and redirects.", route: "/tools/http-status", status: "available" },
      { id: "robots", name: "Robots.txt Analyzer", description: "Fetch and analyze robots.txt crawl rules.", route: "/tools/robots", status: "available" },
      { id: "sitemap", name: "Sitemap Analyzer", description: "Inspect XML sitemaps and coverage.", route: "/tools/sitemap", status: "available" },
      { id: "mobile-friendly", name: "Mobile-Friendly Analyzer", description: "Viewport, responsive signals, and mobile SEO heuristics.", route: "/tools/mobile", status: "available" },
      { id: "lighthouse", name: "Lighthouse / Performance", description: "Performance, accessibility and best-practice insights.", route: "/tools/performance", status: "coming_soon" },
    ],
  },
  {
    id: "dns-email",
    name: "DNS & Email",
    description: "Inspect DNS records and email authentication setup.",
    tools: [
      { id: "dns-lookup", name: "DNS Lookup", description: "Query common DNS record types for a domain.", route: "/tools/dns", status: "available" },
      { id: "email-infra", name: "Email Infrastructure Checker", description: "Check MX, SPF, DMARC, DKIM and email security score.", route: "/tools/email", status: "available" },
      { id: "mx", name: "MX Record Checker", description: "Check the mail exchange records configured for a domain.", route: "/tools/mx", status: "available" },
      { id: "spf", name: "SPF Checker", description: "Validate SPF records and policy.", route: "/tools/spf", status: "available" },
      { id: "dkim", name: "DKIM Checker", description: "Inspect DKIM selectors and keys.", route: "/tools/dkim", status: "available" },
      { id: "dmarc", name: "DMARC Checker", description: "Review DMARC policy and reporting setup.", route: "/tools/dmarc", status: "available" },
      { id: "nameserver", name: "Nameserver Lookup", description: "List authoritative nameservers for a domain.", route: "/tools/nameserver", status: "available" },
    ],
  },
  {
    id: "security",
    name: "Security",
    description: "Basic security posture and infrastructure detection.",
    tools: [
      { id: "blacklist", name: "Blacklist Checker", description: "Check domain/IP against common blacklists.", route: "/tools/blacklist", status: "coming_soon" },
      { id: "ssl", name: "SSL/TLS & HTTPS Analyzer", description: "Observable HTTPS, redirects, and HSTS (not full cert audit).", route: "/tools/ssl", status: "available" },
      { id: "security-headers", name: "HTTP Headers Analyzer", description: "Review HTTP security headers and configuration score.", route: "/tools/headers", status: "available" },
      { id: "cors-cookie", name: "CORS & Cookie Inspector", description: "Inspect observed CORS response headers and cookie security metadata.", route: "/tools/cors", status: "available" },
      { id: "port-scanner", name: "Basic Port Scanner", description: "Check common open ports (carefully rate-limited).", route: "/tools/ports", status: "coming_soon" },
      { id: "waf", name: "WAF Detector", description: "Detect presence of a Web Application Firewall.", route: "/tools/waf", status: "coming_soon" },
      { id: "cloudflare", name: "Cloudflare Detector", description: "Detect proxying and related edge-network signals.", route: "/tools/cloudflare", status: "coming_soon" },
      { id: "cdn", name: "CDN Detector", description: "Identify CDN providers in use.", route: "/tools/cdn", status: "coming_soon" },
    ],
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    description: "Hosting, IP, ASN and server information.",
    tools: [
      { id: "ip", name: "IP Lookup", description: "Resolve public domain/IP details and reverse DNS context.", route: "/tools/ip", status: "available" },
      { id: "asn", name: "ASN Lookup", description: "Find Autonomous System information.", route: "/tools/asn", status: "coming_soon" },
      { id: "hosting", name: "Hosting Provider Detector", description: "Identify likely hosting or cloud provider.", route: "/tools/hosting", status: "coming_soon" },
      { id: "rdns", name: "Reverse DNS", description: "PTR lookups for public IPv4/IPv6 addresses.", route: "/tools/rdns", status: "available" },
      { id: "http-headers", name: "HTTP Headers", description: "Fetch and analyze response headers.", route: "/tools/headers", status: "available" },
      { id: "server-info", name: "Server Information", description: "Inspect observable server, delivery, caching, and edge/proxy response signals.", route: "/tools/server", status: "available" },
    ],
  },
];

const QUICK_TOOL_IDS = ["audit", "website", "dns-lookup", "email-infra", "ssl", "security-headers", "http-status", "mobile-friendly"];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function allTools() {
  return TOOL_CATEGORIES.flatMap((category) =>
    category.tools.map((tool) => ({ ...tool, categoryId: category.id, categoryName: category.name }))
  );
}

function normalizeAuditTarget(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function readRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.filter((item) => typeof item?.target === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function writeRecents(items) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(items.slice(0, MAX_RECENTS)));
  } catch {
    // Browser storage may be unavailable. The audit still works without recents.
  }
}

function rememberTarget(target) {
  const next = [
    { target, at: Date.now() },
    ...readRecents().filter((item) => item.target !== target),
  ].slice(0, MAX_RECENTS);
  writeRecents(next);
  renderRecents();
}

function formatRecentTime(timestamp) {
  const delta = Math.max(0, Date.now() - Number(timestamp || 0));
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function renderRecents() {
  const root = document.getElementById("recent-targets");
  if (!root) return;
  const items = readRecents();
  if (!items.length) {
    root.innerHTML = '<p class="recent-empty">No recent targets yet. Run a full audit and it will appear here on this device.</p>';
    return;
  }
  root.innerHTML = items
    .map((item) => {
      const href = `/tools/audit?url=${encodeURIComponent(item.target)}`;
      return `<div class="recent-item"><a href="${href}">${escapeHtml(item.target)}</a><span>${escapeHtml(formatRecentTime(item.at))}</span></div>`;
    })
    .join("");
}

function renderQuickTools() {
  const root = document.getElementById("quick-tools");
  if (!root) return;
  const byId = new Map(allTools().map((tool) => [tool.id, tool]));
  root.innerHTML = QUICK_TOOL_IDS
    .map((id) => byId.get(id))
    .filter((tool) => tool?.status === "available")
    .map((tool) => `
      <a class="quick-card" href="${escapeHtml(tool.route)}">
        <strong>${escapeHtml(tool.name)}</strong>
        <span>${escapeHtml(tool.categoryName)}</span>
        <span class="quick-arrow" aria-hidden="true">→</span>
      </a>`)
    .join("");
}

function renderCategories() {
  const root = document.getElementById("tool-categories");
  if (!root) return;
  root.innerHTML = TOOL_CATEGORIES.map((category) => {
    const cards = category.tools.map((tool) => {
      const available = tool.status === "available";
      const action = available
        ? `<a class="btn btn-secondary" href="${escapeHtml(tool.route)}">Open Tool</a>`
        : '<button type="button" class="btn btn-secondary" disabled aria-disabled="true">Planned</button>';
      return `
        <article class="tool-card" data-tool-card data-search="${escapeHtml(`${category.name} ${tool.name} ${tool.description}`.toLowerCase())}">
          <h4>${escapeHtml(tool.name)}</h4>
          <p>${escapeHtml(tool.description)}</p>
          <div class="card-footer">
            <span class="badge${available ? " available" : ""}">${available ? "Available" : "Roadmap"}</span>
            ${action}
          </div>
        </article>`;
    }).join("");

    return `
      <section class="category" data-category>
        <div class="category-header"><h3>${escapeHtml(category.name)}</h3><p>${escapeHtml(category.description)}</p></div>
        <div class="tool-grid">${cards}</div>
      </section>`;
  }).join("");
}

function populateMetrics() {
  const availableRoutes = new Set(allTools().filter((tool) => tool.status === "available").map((tool) => tool.route));
  const live = document.getElementById("live-tools-count");
  const groups = document.getElementById("category-count");
  if (live) live.textContent = String(availableRoutes.size);
  if (groups) groups.textContent = String(TOOL_CATEGORIES.length);
}

function setupToolSearch() {
  const input = document.getElementById("tool-search");
  const empty = document.getElementById("tool-empty");
  if (!input) return;

  const apply = () => {
    const query = input.value.trim().toLowerCase();
    let visibleCount = 0;
    document.querySelectorAll("[data-category]").forEach((category) => {
      let categoryCount = 0;
      category.querySelectorAll("[data-tool-card]").forEach((card) => {
        const match = !query || (card.getAttribute("data-search") || "").includes(query);
        card.hidden = !match;
        if (match) {
          categoryCount += 1;
          visibleCount += 1;
        }
      });
      category.hidden = categoryCount === 0;
    });
    empty?.classList.toggle("show", visibleCount === 0);
  };

  input.addEventListener("input", apply);
}

function setupAuditLaunch() {
  const form = document.getElementById("audit-launch-form");
  const input = document.getElementById("audit-target");
  if (!form || !input) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const target = normalizeAuditTarget(input.value);
    if (!target) return;
    rememberTarget(target);
    location.href = `/tools/audit?url=${encodeURIComponent(target)}`;
  });
}

function setupRecents() {
  renderRecents();
  document.getElementById("clear-recents")?.addEventListener("click", () => {
    try { localStorage.removeItem(RECENTS_KEY); } catch { /* no-op */ }
    renderRecents();
  });
}

function setupNav() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.querySelector(".nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));
}

async function readHealth() {
  const status = document.getElementById("engine-status");
  try {
    const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("unhealthy");
    if (status) {
      status.textContent = "Operational";
      status.classList.remove("offline");
    }
    return response;
  } catch {
    if (status) {
      status.textContent = "Unavailable";
      status.classList.add("offline");
    }
    return null;
  }
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
    const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
    const text = await response.text();
    let formatted = text;
    try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
    result.textContent = formatted;
    result.classList.add(response.ok ? "ok" : "err");
  } catch (error) {
    result.textContent = `Network error: ${error?.message || "request failed"}`;
    result.classList.add("err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Check engine";
  }
}

function setYear() {
  const element = document.getElementById("year");
  if (element) element.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", () => {
  renderQuickTools();
  renderCategories();
  populateMetrics();
  setupToolSearch();
  setupAuditLaunch();
  setupRecents();
  setupNav();
  document.getElementById("try-health")?.addEventListener("click", tryHealth);
  readHealth();
  setYear();
});
