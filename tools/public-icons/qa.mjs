// Real-browser checks against the local static preview. Public API replies are
// deterministic fixtures; this script never scans or sends a live public target.
import { createRequire } from "node:module";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve } from "node:path";

const require = createRequire(process.argv[2] ? resolve(process.argv[2], "_qa.cjs") : import.meta.url);
const { chromium } = require("playwright");
const out = "tools/public-icons/qa-results";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const routes = ["/", "/faq", "/privacy", "/terms", "/account-deletion", ... (await readdir("public/tools")).filter((name) => name.endsWith(".html")).map((name) => "/tools/" + name.replace(/\.html$/, ""))];
const result = { origin: "http://127.0.0.1:4184", routes: routes.length, layouts: [], checks: [], browserErrors: [], consoleErrors: [] };
const context = await browser.newContext({ serviceWorkers: "block" });
await context.route("**/api/health", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, status: "ok" }) }));
const page = await context.newPage();
page.on("pageerror", (error) => result.browserErrors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });

for (const width of [390, 1440]) {
  await page.setViewportSize({ width, height: 920 });
  for (const route of routes) {
    await page.goto(result.origin + route, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, icons: document.querySelectorAll("svg[data-public-icon]").length, ready: document.querySelectorAll("svg[data-public-icon-ready]").length, unknown: [...document.querySelectorAll("svg[data-public-icon]")].filter((icon) => !window.SautiPublicIcons.catalog[icon.dataset.publicIcon]).length }));
    result.layouts.push({ route, ...layout });
    assert.ok(layout.scroll <= width + 1, `${route} overflows ${width}px: ${layout.scroll}`);
    assert.ok(layout.icons > 15 && layout.ready > 15, `${route} icons did not initialize`);
    assert.equal(layout.unknown, 0);
    if (route === "/") {
      await page.waitForTimeout(1700);
      await page.screenshot({ path: `${out}/home-${width}.png`, fullPage: true });
    }
  }
}
result.checks.push("All 25 public pages fit 390px and 1440px; known decorative SVGs initialize.");

for (const width of [320, 768, 1061, 1120, 1280]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(result.origin);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Home overflows ${width}px`);
}
result.checks.push("Homepage also fits 320/768/1061/1120/1280px.");

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(result.origin);
await page.waitForTimeout(1100);
await page.locator("#nav-toggle").click();
assert.equal(await page.locator("#nav-toggle").getAttribute("aria-expanded"), "true");
await page.keyboard.press("Escape");
assert.equal(await page.locator("#nav-toggle").getAttribute("aria-expanded"), "false");
await page.locator("#tool-search").fill("DNS");
assert.ok(await page.locator("[data-tool-card]:visible").count() > 0);
assert.ok(await page.locator("[data-tool-card][hidden]").count() > 0);
result.checks.push("Existing mobile menu and tool search still respond.");

await page.goto(result.origin + "/faq");
await page.locator("#faq-search").fill("data password");
assert.deepEqual(await page.locator(".faq-item:visible").evaluateAll((items) => items.map((item) => item.id)), ["delete-account"]);
result.checks.push("FAQ multiword search still finds the existing deletion answer.");
await page.screenshot({ path: `${out}/faq-390.png`, fullPage: true });

let lookups = 0;
await page.route("**/api/dns?**", async (route) => {
  lookups++;
  assert.equal(route.request().method(), "GET");
  assert.equal(new URL(route.request().url()).searchParams.get("domain"), "example.com");
  await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: { domain: "example.com", records: { A: ["93.184.216.34"], MX: ["10 mail.example.com"] } } }) });
});
await page.goto(result.origin + "/tools/dns");
await page.locator("#domain-input").fill("example.com");
await page.locator("#dns-submit").click();
await page.locator("#dns-results").waitFor({ state: "visible" });
assert.equal(lookups, 1);
assert.equal(await page.locator("#result-domain").textContent(), "example.com");
assert.equal((await page.locator("#dns-submit").textContent()).trim(), "Check DNS");
await page.locator("#dns-submit svg[data-public-icon]").waitFor();
assert.equal(await page.locator("#dns-submit").isEnabled(), true);
result.checks.push("DNS lookup makes one unchanged GET; results and button reset work with icons.");
await page.screenshot({ path: `${out}/dns-result-390.png`, fullPage: true });

let audits = 0;
await page.route("**/api/audit?**", async (route) => {
  audits++;
  const target = new URL(route.request().url()).searchParams.get("url");
  const finding = { title: "Example warning", severity: "warning", category: "seo", source: "website", message: "Fixture finding for interaction checks." };
  const recommendation = { title: "Example recommendation", category: "seo", priority: "medium", message: "Fixture recommendation for interaction checks." };
  await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: {
    url: target, domain: new URL(target).hostname, score: { total: 84, max: 100, grade: "B", label: "Good", version: "1" },
    categories: { seo: { available: true, score: 84, grade: "B", weight: 100, status: "ok", findings: [finding], recommendations: [recommendation], sources: ["website"] } },
    findings: [finding], recommendations: [recommendation], analyzers: { website: { status: "ok", durationMs: 42 } }, meta: { durationMs: 42 },
  } }) });
});
await page.goto(result.origin + "/tools/audit");
await page.locator("#url-input").fill("https://example.com");
await page.locator("#audit-submit").click();
await page.locator("#results").waitFor({ state: "visible" });
await page.locator('#category-nav [data-category="seo"] svg[data-public-icon]').waitFor();
await page.locator('#category-nav [data-category="seo"]').click();
assert.equal(await page.locator('#category-nav [data-category="seo"]').evaluate((button) => button.classList.contains("active")), true);
await page.locator('.report-tab[data-view="findings"]').click();
await page.locator('#panel-findings').waitFor({ state: "visible" });
await page.locator('[data-severity="warning"]').click();
assert.equal(await page.locator('#findings-list .finding-card').count(), 1);
assert.equal(audits, 1);
await page.locator("#compare-toggle").click();
await page.locator("#compare-input").fill("https://example.org");
await page.locator("#compare-submit").click();
await page.locator("#compare-results").waitFor({ state: "visible" });
assert.equal(audits, 2);
const download = page.waitForEvent("download");
await page.locator("#export-json").click();
assert.match((await download).suggestedFilename(), /\.json$/);
assert.equal(audits, 2);
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Audit result overflows mobile");
result.checks.push("Full Audit category/filter/tab interactions, one explicit comparison and JSON export remain intact; export adds no request.");
await page.screenshot({ path: `${out}/audit-result-390.png`, fullPage: true });

await page.setViewportSize({ width: 1440, height: 920 });
await page.goto(result.origin);
await page.waitForTimeout(1500);
const nav = page.locator('.nav-link[href="#tools"]');
await nav.focus();
await page.waitForTimeout(80);
assert.ok(await nav.locator("svg").evaluate((svg) => svg.querySelectorAll('[style*="transform"], [style*="opacity"], [style*="stroke"]').length > 0));
result.checks.push("Keyboard focus triggers the shared icon animation.");

const reduced = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
await reduced.route("**/api/health", (route) => route.fulfill({ contentType: "application/json", body: "{}" }));
const still = await reduced.newPage();
await still.goto(result.origin);
const target = still.locator('.nav-link[href="#tools"] svg');
const before = await target.evaluate((svg) => svg.innerHTML);
await still.locator('.nav-link[href="#tools"]').focus();
await still.waitForTimeout(250);
assert.equal(await target.evaluate((svg) => svg.innerHTML), before);
result.checks.push("Reduced motion keeps the SVG geometry still on keyboard focus.");
await reduced.close();

const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
const fallback = await noJs.newPage();
for (const route of ["/", "/faq", "/privacy", "/tools/dns"]) {
  await fallback.goto(result.origin + route);
  assert.ok(await fallback.locator("svg[data-public-icon]").count() > 15);
  assert.ok(await fallback.locator(".nav-toggle svg[data-public-icon]").evaluate((svg) => svg.getBBox().width > 1));
}
await fallback.screenshot({ path: `${out}/no-js-dns-390.png`, fullPage: true });
result.checks.push("Static icon fallback renders without JavaScript on home/help/legal/tool pages.");
await noJs.close();

assert.deepEqual(result.browserErrors, []);
await writeFile(`${out}/browser-validation.json`, JSON.stringify(result, null, 2) + "\n");
await context.close();
await browser.close();
console.log(JSON.stringify({ routes: result.routes, layouts: result.layouts.length, checks: result.checks, browserErrors: result.browserErrors, consoleErrors: [...new Set(result.consoleErrors)], output: out }, null, 2));
