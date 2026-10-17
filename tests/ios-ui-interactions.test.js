import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../public/assets/brand/ios-ui.js", import.meta.url), "utf8");
const faq = readFileSync(new URL("../public/faq.html", import.meta.url), "utf8");

// Event and element doubles expose DOM primitives, not the behavior under test.
class Target {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, properties = {}) {
    const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...properties };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
}

class Element extends Target {
  constructor(attributes = {}, text = "") {
    super();
    this.attributes = new Map(Object.entries(attributes));
    this.textContent = text;
    this.hidden = false;
    this.open = "open" in attributes;
    this.disabled = "disabled" in attributes;
    this.value = "";
    this.children = [];
    this.focused = false;
    const classes = new Set((attributes.class || "").split(/\s+/));
    this.classList = {
      contains: (name) => classes.has(name),
      remove: (name) => classes.delete(name),
      toggle: (name) => { if (classes.has(name)) { classes.delete(name); return false; } classes.add(name); return true; },
    };
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  contains(target) { return this === target || this.children.some((child) => child.contains(target)); }
  focus() { this.focused = true; }
  closest(selector) { return selector === ".faq-item" && this.classList.contains("faq-item") ? this : null; }
}

function fixture({ width = 1280, hash = "", existingMenu = false } = {}) {
  const document = new Target();
  const window = new Target();
  window.location = { hash };
  const media = new Map();
  window.matchMedia = (query) => {
    if (!media.has(query)) {
      const value = new Target();
      value.matches = width >= Number(query.match(/\d+/)[0]);
      media.set(query, value);
    }
    return media.get(query);
  };

  const input = new Element({ id: "faq-search", disabled: "" });
  const status = new Element({ id: "faq-search-status" });
  const items = [...faq.matchAll(/<details class="faq-item" id="([^"]+)"([^>]*)>([\s\S]*?)<\/details>/g)].map(([, id, attrs, html]) => {
    return new Element({ id, class: "faq-item", ...(/\bopen\b/.test(attrs) ? { open: "" } : {}) }, html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&"));
  });
  const toggle = new Element({ id: "nav-toggle", "aria-expanded": "false", ...(existingMenu ? {} : { "data-ios-nav": "" }) });
  const nav = new Element({ class: "nav" });
  const navLink = new Element();
  nav.children.push(navLink);
  nav.querySelectorAll = () => [navLink];
  if (existingMenu) toggle.addEventListener("click", () => {
    toggle.setAttribute("aria-expanded", String(nav.classList.toggle("open")));
  });
  const contents = new Element({ "data-ios-contents": "", open: "" });
  const summary = new Element();
  const contentsLink = new Element({ href: "#privacy" });
  contents.querySelector = () => summary;
  contents.querySelectorAll = () => [contentsLink];
  const byId = new Map([input, status, toggle, ...items].map((item) => [item.getAttribute("id"), item]));
  document.getElementById = (id) => byId.get(id) || null;
  document.querySelector = (selector) => selector === ".site-header .nav" ? nav : selector === "[data-ios-contents]" ? contents : null;
  document.querySelectorAll = (selector) => selector === ".faq-item" ? items : [];
  runInNewContext(source, { document, window }, { filename: "ios-ui.js" });
  document.dispatch("DOMContentLoaded");
  return {
    document, window, input, status, items, toggle, nav, navLink, contents, summary, contentsLink,
    search(value) { input.value = value; input.dispatch("input"); },
    visible() { return items.filter((item) => !item.hidden).map((item) => item.getAttribute("id")); },
    resize(nextWidth) {
      for (const [query, value] of media) { value.matches = nextWidth >= Number(query.match(/\d+/)[0]); value.dispatch("change"); }
    },
  };
}

test("FAQ search matches multiple words across the real question and answer text", () => {
  const page = fixture();
  assert.equal(page.input.disabled, false);
  assert.equal(page.items.length, 10);
  page.search("  DATA   password ");
  assert.deepEqual(page.visible(), ["delete-account"]);
  assert.equal(page.items.find((item) => item.getAttribute("id") === "delete-account").open, true);
  assert.equal(page.status.textContent, "1 answer found.");
  page.search("nonexistent-answer-xyz");
  assert.deepEqual(page.visible(), []);
  assert.match(page.status.textContent, /No matching answers.*support@sautilink\.com/);
});

test("clearing help search restores the reader's prior disclosure choices", () => {
  const page = fixture();
  page.items[3].open = true;
  const before = page.items.map((item) => item.open);
  page.search("DNS");
  assert.ok(page.items.some((item) => item.hidden));
  page.search("");
  assert.equal(page.visible().length, 10);
  assert.deepEqual(page.items.map((item) => item.open), before);
  assert.match(page.status.textContent, /^10 questions/);
});

test("direct question links open the answer and safely clear an excluding search", () => {
  const page = fixture({ hash: "#delete-account" });
  assert.equal(page.items[3].open, true);
  page.search("unmatched-input");
  page.window.location.hash = "#telegram-companion";
  page.window.dispatch("hashchange");
  assert.equal(page.input.value, "");
  assert.equal(page.visible().length, 10);
  assert.equal(page.items[4].open, true);
  page.window.location.hash = "#%E0%A4%A";
  assert.doesNotThrow(() => page.window.dispatch("hashchange"));
});

test("FAQ menu closes with Escape and returns focus to its button", () => {
  const page = fixture({ width: 390 });
  page.toggle.dispatch("click");
  assert.equal(page.nav.classList.contains("open"), true);
  assert.equal(page.toggle.getAttribute("aria-expanded"), "true");
  page.document.dispatch("keydown", { key: "Escape" });
  assert.equal(page.nav.classList.contains("open"), false);
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(page.toggle.focused, true);
});

test("shared menu dismissal preserves the existing page client's toggle ownership", () => {
  const page = fixture({ width: 390, existingMenu: true });
  page.toggle.dispatch("click");
  assert.equal(page.nav.classList.contains("open"), true, "one click should not be toggled twice");
  page.document.dispatch("click", { target: page.navLink });
  assert.equal(page.nav.classList.contains("open"), true);
  page.document.dispatch("click", { target: new Element() });
  assert.equal(page.nav.classList.contains("open"), false);
  page.toggle.dispatch("click");
  page.navLink.dispatch("click");
  assert.equal(page.nav.classList.contains("open"), false);
  page.toggle.dispatch("click");
  page.resize(1280);
  assert.equal(page.toggle.getAttribute("aria-expanded"), "false");
});

test("legal contents expands on desktop and closes after a mobile section choice", () => {
  const page = fixture({ width: 390 });
  assert.equal(page.contents.open, false);
  assert.equal(page.summary.hasAttribute("tabindex"), false);
  page.contents.open = true;
  page.contentsLink.dispatch("click");
  assert.equal(page.contents.open, false);
  page.resize(1280);
  assert.equal(page.contents.open, true);
  assert.equal(page.summary.getAttribute("tabindex"), "-1");
  assert.equal(page.summary.dispatch("click").defaultPrevented, true);
  page.contentsLink.dispatch("click");
  assert.equal(page.contents.open, true);
  page.resize(390);
  assert.equal(page.contents.open, false);
});

test("shared enhancement tolerates pages without optional help or contents controls", () => {
  const document = new Target();
  document.getElementById = () => null;
  document.querySelector = () => null;
  document.querySelectorAll = () => [];
  runInNewContext(source, { document, window: {} });
  assert.doesNotThrow(() => document.dispatch("DOMContentLoaded"));
});
