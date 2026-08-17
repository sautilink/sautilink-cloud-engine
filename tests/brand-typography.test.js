import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const typographyPath = "public/assets/brand/typography-manrope.css";
const brandingPath = "docs/BRANDING.md";
const manropeDir = "public/assets/fonts/manrope";

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

test("Cloud Engine uses Manrope as its single UI and brand family", () => {
  const css = read(typographyPath);
  assert.match(css, /font-family:\s*"Manrope"/);
  assert.match(css, /font-weight:\s*200 800/);
  assert.match(css, /--font-primary:\s*"Manrope"/);
  assert.match(css, /--font:\s*var\(--font-primary\)/);
  assert.doesNotMatch(css, /Inter|Lora|Zalando Sans SemiExpanded|--font-brand/);
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

test("self-hosted Manrope variable WOFF2 and OFL are present", () => {
  const font = `${manropeDir}/Manrope-Variable.woff2`;
  assert.equal(existsSync(font), true, `${font} should exist`);
  assert.ok(statSync(font).size > 40_000, `${font} should contain a real WOFF2 variable font`);

  const license = `${manropeDir}/OFL.txt`;
  assert.equal(existsSync(license), true, `${license} should exist`);
  assert.match(read(license), /SIL OPEN FONT LICENSE Version 1\.1/);

  assert.equal(existsSync("public/assets/fonts/inter"), false, "Inter assets should not remain in Cloud Engine");
  assert.equal(existsSync("public/assets/fonts/lora"), false, "Lora assets should be removed");
  assert.equal(existsSync("public/assets/fonts/zalando-sans-semiexpanded"), false, "Zalando assets should be removed");
});

test("every static HTML page wires self-hosted Manrope", () => {
  const pages = htmlFiles("public");
  assert.ok(pages.length > 1);
  for (const path of pages) {
    const html = read(path);
    if (!html.includes('href="/styles.css"')) continue;
    assert.match(html, /href="\/assets\/brand\/typography-manrope\.css\?v=1"/i, path);
    assert.match(html, /href="\/assets\/fonts\/manrope\/Manrope-Variable\.woff2\?v=1"[^>]*as="font"/i, path);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com|InterVariable|Lora-Variable|ZalandoSans/i, path);
  }
});

test("typography stylesheet has no runtime external font-provider dependency", () => {
  const css = read(typographyPath);
  assert.doesNotMatch(css, /https?:\/\//i);
  assert.doesNotMatch(css, /Inter|Lora|Zalando Sans SemiExpanded/);
});

test("branding policy carries Manrope from web into future native apps", () => {
  const branding = read(brandingPath);
  assert.match(branding, /Manrope is the official SautiLink Cloud Engine product font/i);
  assert.match(branding, /iOS and Android app builds should bundle the same Manrope variable family/i);
  assert.match(branding, /Platform system fonts are fallbacks, not the Cloud Engine brand font/i);
});
