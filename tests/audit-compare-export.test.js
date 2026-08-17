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

test("workspace bootstrap installs the power layer before the existing audit module", () => {
  const bootstrap = read("public/tools/audit-workspace.js");
  assert.match(bootstrap, /installAuditPower\(\)/);
  assert.match(bootstrap, /await import\("\.\/audit\.js"\)/);
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

test("comparison performs one explicit fresh audit for only the second target", () => {
  const js = read("public/tools/audit-power.js");
  const html = read("public/tools/audit.html");
  const compareFetches = js.match(/nativeFetch\(`\/api\/audit\?url=/g) || [];
  assert.equal(compareFetches.length, 1);
  assert.match(js, /renderComparison\(currentAudit, comparisonAudit\)/);
  assert.match(html, /comparison minus primary/i);
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
