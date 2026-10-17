/* Presentation enhancements only. Diagnostic and account APIs stay in their existing clients. */
(() => {
  "use strict";

  function setupNavigation() {
    const toggle = document.getElementById("nav-toggle");
    const nav = document.querySelector(".site-header .nav");
    if (!toggle || !nav) return;
    const close = (returnFocus = false) => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      if (returnFocus) toggle.focus();
    };
    // Existing page clients own their menu toggle. The FAQ has no client of its own.
    if (toggle.hasAttribute("data-ios-nav")) {
      toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => close()));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("open")) close(true);
    });
    document.addEventListener("click", (event) => {
      if (nav.classList.contains("open") && !nav.contains(event.target) && !toggle.contains(event.target)) close();
    });
    const desktop = window.matchMedia("(min-width: 1061px)");
    const onWidthChange = () => { if (desktop.matches) close(); };
    if (desktop.addEventListener) desktop.addEventListener("change", onWidthChange);
    else desktop.addListener?.(onWidthChange);
  }

  function setupContents() {
    const contents = document.querySelector("[data-ios-contents]");
    if (!contents) return;
    const summary = contents.querySelector("summary");
    const desktop = window.matchMedia("(min-width: 981px)");
    const sync = () => {
      contents.open = desktop.matches;
      if (desktop.matches) summary?.setAttribute("tabindex", "-1");
      else summary?.removeAttribute("tabindex");
    };
    sync();
    summary?.addEventListener("click", (event) => {
      if (desktop.matches) event.preventDefault();
    });
    contents.querySelectorAll("a[href^='#']").forEach((link) => {
      link.addEventListener("click", () => { if (!desktop.matches) contents.open = false; });
    });
    if (desktop.addEventListener) desktop.addEventListener("change", sync);
    else desktop.addListener?.(sync);
  }

  function setupFaqSearch() {
    const input = document.getElementById("faq-search");
    const status = document.getElementById("faq-search-status");
    const items = [...document.querySelectorAll(".faq-item")];
    if (!input || !status || !items.length) return;
    const searchable = items.map((item) => ({ item, text: item.textContent.toLowerCase() }));
    let savedOpen = null;

    const apply = () => {
      const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const searching = terms.length > 0;
      if (searching && savedOpen === null) savedOpen = items.map((item) => item.open);
      let count = 0;
      searchable.forEach(({ item, text }, index) => {
        const matches = terms.every((term) => text.includes(term));
        item.hidden = !matches;
        if (matches) count += 1;
        if (searching) item.open = matches;
        else if (savedOpen) item.open = savedOpen[index];
      });
      if (!searching) savedOpen = null;
      status.textContent = !searching
        ? `${items.length} questions. Browse below or search for an answer.`
        : count === 0
          ? "No matching answers. Try another word or contact support@sautilink.com."
          : `${count} ${count === 1 ? "answer" : "answers"} found.`;
    };
    const openLinkedAnswer = () => {
      let id;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!id) return;
      const target = document.getElementById(id);
      const item = target?.closest(".faq-item");
      if (!item) return;
      input.value = "";
      apply();
      item.open = true;
    };
    input.disabled = false;
    input.addEventListener("input", apply);
    window.addEventListener("hashchange", openLinkedAnswer);
    apply();
    openLinkedAnswer();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupContents();
    setupFaqSearch();
    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  });
})();
