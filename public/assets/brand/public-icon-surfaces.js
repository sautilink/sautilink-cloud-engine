/* Decorative public UI only. Existing page clients still own forms, results and navigation. */
(() => {
  "use strict";
  const root = document.querySelector("body[data-public-icons]");
  const icons = window.SautiPublicIcons;
  if (!root || !icons?.renderIcon) return;

  const toolIcons = {
    audit: "analytics-0-1", website: "globe-0-2", "http-status": "activity", robots: "file-0-1",
    sitemap: "lucide:network", mobile: "lucide:smartphone", cache: "refresh-0-1", dns: "lucide:router",
    email: "mail-0-1", mx: "mail-0-1", spf: "shield-check", dkim: "lock-keyhole", dmarc: "shield-check",
    nameserver: "server", ssl: "lock-keyhole", headers: "shield-check", cors: "security-block",
    ip: "globe-0-2", rdns: "lucide:network", server: "server", proxy: "wifi-0-1",
  };

  function icon(name, className = "") {
    if (!icons.catalog[name]) return null;
    const svg = icons.renderIcon(name, 24, document);
    svg.setAttribute("class", `public-icon ${className}`.trim());
    svg.setAttribute("data-public-icon", name);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    return svg;
  }

  function addIcon(element, name, className = "cloud-icon-label", iconClass = "") {
    if (!element || element.querySelector(":scope > svg[data-public-icon]")) return;
    const svg = icon(name, iconClass);
    if (!svg) return;
    if (className) element.classList.add(className);
    element.prepend(svg);
  }

  function toolName(element) {
    const href = element.getAttribute("href") || element.querySelector("a[href]")?.getAttribute("href") || "";
    const route = href.match(/^\/tools\/([^?#/]+)/)?.[1];
    if (route && toolIcons[route]) return toolIcons[route];
    const text = element.textContent;
    if (/mail|mx/i.test(text)) return "mail-0-1";
    if (/security|blacklist|waf|ssl/i.test(text)) return "shield-check";
    if (/dns|network|sitemap/i.test(text)) return "lucide:network";
    if (/infrastructure|server|hosting|cdn|cloudflare/i.test(text)) return "server";
    if (/mobile/i.test(text)) return "lucide:smartphone";
    if (/performance|audit|lighthouse/i.test(text)) return "analytics-0-1";
    return "globe-0-2";
  }

  const categoryIcons = {
    "Website & SEO": "globe-0-2", "DNS & Email": "mail-0-1", Security: "shield-check", Infrastructure: "server",
  };
  const auditCategoryIcons = {
    all: "analytics-0-1", seo: "globe-0-2", security: "shield-check", performance: "activity",
    dns: "lucide:router", email: "mail-0-1", mobile: "lucide:smartphone", crawl: "lucide:network",
    http: "code", infrastructure: "server",
  };

  function decorate() {
    // The workspace directory is rendered by app.js. Preserve its exact content,
    // availability states and hrefs while adding the same icon markup as static pages.
    root.querySelectorAll("#quick-tools .quick-card").forEach((card) => {
      addIcon(card, toolName(card), "", "cloud-card-icon");
      const arrow = card.querySelector("span.quick-arrow");
      if (arrow) arrow.replaceWith(icon("arrow-right-0-2", "quick-arrow"));
    });
    root.querySelectorAll("#tool-categories .category-header h3").forEach((heading) => {
      addIcon(heading, categoryIcons[heading.textContent.trim()] || "settings-0-1", "cloud-heading");
    });
    root.querySelectorAll("#tool-categories .tool-card").forEach((card) => {
      card.setAttribute("data-public-icon-trigger", "");
      addIcon(card.querySelector("h4"), toolName(card), "cloud-heading");
      const action = card.querySelector(".btn");
      addIcon(action, action?.disabled ? "clock-0-1" : "arrow-right-0-2");
    });
    root.querySelectorAll("#recent-targets .recent-item a").forEach((link) => addIcon(link, "refresh-0-1"));
    root.querySelectorAll("#category-nav .category-button").forEach((button) => {
      addIcon(button.querySelector("strong"), auditCategoryIcons[button.dataset.category] || "analytics-0-1", "");
    });
    // Some clients deliberately reset textContent during/after a request. Restore
    // decoration only; never intercept a click or modify control state or labels.
    root.querySelectorAll("[data-cloud-action-icon]").forEach((control) => addIcon(control, control.dataset.cloudActionIcon));
  }

  let queued = false;
  const observer = new MutationObserver((mutations) => {
    const changed = mutations.some((mutation) => !mutation.target.closest?.("svg.public-icon"));
    if (!changed || queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; decorate(); });
  });
  decorate();
  const main = root.querySelector("main");
  if (main) observer.observe(main, { subtree: true, childList: true });
  window.addEventListener("pagehide", (event) => { if (!event.persisted) observer.disconnect(); });
})();
