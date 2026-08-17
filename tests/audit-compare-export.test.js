import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("audit workspace exposes web-only compare and export controls", () => {
  const html = read("public/tools/audit.html");
  assert.match(html, /id="compare-toggle"/);
  assert.match(html, /id="export-json"/);
  assert.match(html, /id="export-csv"/);
  assert.match(html, /id="print-report"/);
  assert.match(html, /id="compare-panel"/);
  assert.match(html, /id="compare-category-rows"/);
  assert.match(html, /\/tools\/audit-power\.css/);
  assert.match(html, /\/tools\/audit-workspace\.js/);
  assert.doesNotMatch(html, /src="\/tools\/audit\.js"/);
});

test("workspace bootstrap statically loads the audit module before installing the power layer", () => {
  const bootstrap = read("public/tools/audit-workspace.js");
  assert.match(bootstrap, /import "\.\/audit\.js"/);
  assert.match(bootstrap, /installAuditPower\(\)/);
  assert.doesNotMatch(bootstrap, /await import\(/);
});

test("audit and power controls initialise even after DOMContentLoaded", () => {
  const audit = read("public/tools/audit.js");
  const power = read("public/tools/audit-power.js");
  assert.match(audit, /document\.readyState === "loading"/);
  assert.match(audit, /initAuditWorkspace\(\)/);
  assert.match(power, /document\.readyState === "loading"/);
  assert.match(power, /initAuditPower\(\)/);
});

test("export reuses the captured primary audit instead of re-running it", () => {
  const js = read("public/tools/audit-power.js");
  assert.match(js, /response\.clone\(\)\.json\(\)/);
  assert.match(js, /currentAudit = payload\.data/);
  assert.match(js, /exportJson\(currentAudit\)/);
  assert.match(js, /exportCsv\(currentAudit\)/);
  assert.match(js, /new Blob/);
  assert.match(js, /URL\.createObjectURL/);
});

test("CSV export guards spreadsheet formulas in string cells", () => {
  const js = read("public/tools/audit-power.js");
  assert.match(js, /typeof value === "string"/);
  assert.match(js, /\[=\+\\-@\]/);
  assert.match(js, /text = `\'\$\{text\}`/);
});

test("comparison performs one explicit fresh audit for only the second target", () => {
  const js = read("public/tools/audit-power.js");
  const html = read("public/tools/audit.html");
  const compareFetches = js.match(/nativeFetch\(`\/api\/audit\?url=/g) || [];
  assert.equal(compareFetches.length, 1);
  assert.match(js, /renderComparison\(currentAudit, comparisonAudit\)/);
  assert.match(html, /comparison minus primary/i);
});

test("comparison HTML escapes dynamic table labels and grades", () => {
  const js = read("public/tools/audit-power.js");
  assert.match(js, /function escapeHtml/);
  assert.match(js, /<td>\$\{escapeHtml\(label\)\}<\/td>/);
  assert.match(js, /escapeHtml\(a\.grade\)/);
  assert.match(js, /escapeHtml\(b\.grade\)/);
});

test("compare and export add no durable report-history storage", () => {
  const js = read("public/tools/audit-power.js");
  assert.match(js, /sautilink\.cloudengine\.recentTargets\.v1/);
  assert.match(js, /localStorage\.setItem/);
  assert.doesNotMatch(js, /\/api\/reports|\/api\/history|indexedDB|sessionStorage\.setItem|telegram_user_preferences/i);
});

test("print stylesheet produces a report-focused layout", () => {
  const css = read("public/tools/audit-power.css");
  assert.match(css, /@media print/);
  assert.match(css, /\.report-panel\[hidden\] \{ display: block !important; \}/);
  assert.match(css, /\.audit-site-header,/);
  assert.match(css, /\.report-tools,/);
});
