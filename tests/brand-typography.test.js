import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const typographyPath = "public/assets/brand/typography.css";
const interDir = "public/assets/fonts/inter";

function read(path) {
  return readFileSync(path, "utf8");
}

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(path);
  }
  return out;
}

test("SautiLink typography uses Inter as the single UI and brand family", () => {
  const css = read(typographyPath);
  assert.match(css, /font-family:\s*"Inter"/);
  assert.match(css, /font-weight:\s*100 900/);
  assert.match(css, /--font-primary:\s*"Inter"/);
  assert.match(css, /--font:\s*var\(--font-primary\)/);
  assert.doesNotMatch(css, /Lora|Zalando Sans SemiExpanded|--font-brand/);
  assert.match(css, /\.footer-copy,[\s\S]*\[data-brand-font\][\s\S]*font-family:\s*var\(--font-primary\)/);
});

test("SautiLink corporate color tokens remain canonical", () => {
  const css = read(typographyPath);
  assert.match(css, /--brand-primary:\s*#2563eb/i);
  assert.match(css, /--brand-primary-hover:\s*#1d4ed8/i);
  assert.match(css, /--brand-light:\s*#60a5fa/i);
  assert.match(css, /--brand-white:\s*#ffffff/i);
  assert.match(css, /--accent:\s*var\(--brand-primary\)/);
  assert.match(css, /--accent-hover:\s*var\(--brand-light\)/);
});

test("self-hosted Inter variable normal and italic assets plus OFL are present", () => {
  for (const path of [`${interDir}/InterVariable.woff2`, `${interDir}/InterVariable-Italic.woff2`]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    assert.ok(statSync(path).size > 100_000, `${path} should contain a real WOFF2 font`);
  }
  const license = `${interDir}/OFL.txt`;
  assert.equal(existsSync(license), true, `${license} should exist`);
  assert.match(read(license), /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.equal(existsSync("public/assets/fonts/lora"), false, "Lora assets should be removed");
  assert.equal(existsSync("public/assets/fonts/zalando-sans-semiexpanded"), false, "Zalando assets should be removed");
});

test("every static HTML page wires self-hosted Inter", () => {
  const pages = htmlFiles("public");
  assert.ok(pages.length > 1);
  for (const path of pages) {
    const html = read(path);
    if (!html.includes('href="/styles.css"')) continue;
    assert.match(html, /href="\/assets\/brand\/typography\.css"/i, path);
    assert.match(html, /href="\/assets\/fonts\/inter\/InterVariable\.woff2"[^>]*as="font"/i, path);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com|Lora-Variable|ZalandoSans/i, path);
  }
});

test("typography stylesheet has no runtime external font-provider dependency", () => {
  const css = read(typographyPath);
  assert.doesNotMatch(css, /https?:\/\//i);
  assert.doesNotMatch(css, /Lora|Zalando Sans SemiExpanded/);
});
