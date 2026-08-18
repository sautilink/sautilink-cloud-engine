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

function setupTableOfContents() {
  const links = [...document.querySelectorAll("[data-legal-toc] a[href^='#']")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if (!links.length || !sections.length || !("IntersectionObserver" in window)) return;

  const byId = new Map(links.map((link) => [link.getAttribute("href").slice(1), link]));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach((link) => link.removeAttribute("aria-current"));
    byId.get(visible.target.id)?.setAttribute("aria-current", "true");
  }, { rootMargin: "-18% 0px -70%", threshold: 0 });

  sections.forEach((section) => observer.observe(section));
}

function setupLocalDataClear() {
  const button = document.querySelector("[data-clear-recents]");
  const status = document.querySelector("[data-clear-recents-status]");
  if (!button) return;

  button.addEventListener("click", () => {
    try {
      localStorage.removeItem("sautilink.cloudengine.recentTargets.v1");
      if (status) status.textContent = "Recent targets were cleared from this browser.";
    } catch {
      if (status) status.textContent = "Browser storage is unavailable. Clear this site's data from your browser settings.";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  setupTableOfContents();
  setupLocalDataClear();
  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
});
