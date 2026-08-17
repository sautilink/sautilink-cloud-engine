import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Full Audit is a multi-panel web workspace", () => {
  const html = read("public/tools/audit.html");
  assert.match(html, /Full Audit Workspace/);
  assert.match(html, /id="score-ring-progress"/);
  assert.match(html, /id="category-nav"/);
  assert.match(html, /data-view="overview"/);
  assert.match(html, /data-view="findings"/);
  assert.match(html, /data-view="recommendations"/);
  assert.match(html, /data-view="analyzers"/);
  assert.match(html, /id="severity-filters"/);
  assert.match(html, /id="analyzer-list"/);
});

test("Audit workspace keeps one shared audit API call and client-side drill-down", () => {
  const js = read("public/tools/audit.js");
  const fetchCalls = js.match(/fetch\(/g) || [];
  assert.equal(fetchCalls.length, 1);
  assert.match(js, /fetch\(`\/api\/audit\?url=/);
  assert.match(js, /activeCategory/);
  assert.match(js, /scopedFindings/);
  assert.match(js, /scopedRecommendations/);
  assert.match(js, /data-severity/);
  assert.doesNotMatch(js, /\/api\/(dns|email|ssl|headers|website|mobile|robots|sitemap)/);
});

test("Audit workspace shares browser-local recents with the flagship homepage", () => {
  const js = read("public/tools/audit.js");
  assert.match(js, /sautilink\.cloudengine\.recentTargets\.v1/);
  assert.match(js, /localStorage\.setItem/);
  assert.match(js, /MAX_RECENTS = 5/);
  assert.doesNotMatch(js, /\/api\/.*history|telegram_user_preferences/i);
});

test("Audit workspace exposes target actions without persisting report state", () => {
  const html = read("public/tools/audit.html");
  const js = read("public/tools/audit.js");
  assert.match(html, /id="copy-audit-link"/);
  assert.match(html, /id="open-target"/);
  assert.match(js, /\/tools\/audit\?url=/);
  assert.match(js, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(js, /sessionStorage\.setItem|indexedDB|\/api\/reports/i);
});

test("Audit workspace remains responsive and uses the Cloud Engine Manrope contract", () => {
  const html = read("public/tools/audit.html");
  const css = read("public/tools/audit.css");
  assert.match(html, /typography-manrope\.css\?v=1/);
  assert.match(html, /Manrope-Variable\.woff2\?v=1/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /\.report-tabs \{/);
  assert.match(css, /position: sticky/);
});
