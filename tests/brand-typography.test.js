import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const typographyPath = "public/assets/brand/typography.css";
const loraDir = "public/assets/fonts/lora";
const zalandoDir = "public/assets/fonts/zalando-sans-semiexpanded";

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

test("SautiLink typography maps Lora primary and Zalando Sans SemiExpanded corporate", () => {
  const css = read(typographyPath);
  assert.match(css, /font-family:\s*"Lora"/);
  assert.match(css, /font-weight:\s*400 700/);
  assert.match(css, /font-family:\s*"Zalando Sans SemiExpanded"/);
  assert.match(css, /font-weight:\s*200 900/);
  assert.match(css, /--font-primary:\s*"Lora"/);
  assert.match(css, /--font-brand:\s*"Zalando Sans SemiExpanded"/);
  assert.match(css, /--font:\s*var\(--font-primary\)/);
  assert.match(css, /button,[\s\S]*input,[\s\S]*textarea,[\s\S]*select[\s\S]*font-family:\s*var\(--font-primary\)/);
  assert.match(css, /\.footer-copy,[\s\S]*\[data-brand-font\][\s\S]*font-family:\s*var\(--font-brand\)/);
});

test("SautiLink corporate color tokens are canonical and mapped to Cloud Engine accents", () => {
  const css = read(typographyPath);
  assert.match(css, /--brand-primary:\s*#2563eb/i);
  assert.match(css, /--brand-primary-hover:\s*#1d4ed8/i);
  assert.match(css, /--brand-light:\s*#60a5fa/i);
  assert.match(css, /--brand-white:\s*#ffffff/i);
  assert.match(css, /--accent:\s*var\(--brand-primary\)/);
  assert.match(css, /--accent-hover:\s*var\(--brand-light\)/);
});

test("self-hosted normal and italic variable WOFF2 assets and OFL licenses are present", () => {
  const assets = [
    `${loraDir}/Lora-Variable.woff2`,
    `${loraDir}/Lora-VariableItalic.woff2`,
    `${zalandoDir}/ZalandoSansSemiExpanded-Variable.woff2`,
    `${zalandoDir}/ZalandoSansSemiExpanded-VariableItalic.woff2`,
  ];
  for (const path of assets) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    assert.ok(statSync(path).size > 10_000, `${path} should contain a real WOFF2 font`);
  }

  for (const path of [`${loraDir}/OFL.txt`, `${zalandoDir}/OFL.txt`]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    assert.match(read(path), /SIL OPEN FONT LICENSE Version 1\.1/);
  }
});

test("every static HTML page wires the self-hosted typography and font preloads", () => {
  const pages = htmlFiles("public");
  assert.ok(pages.length > 1);
  for (const path of pages) {
    const html = read(path);
    if (!html.includes('href="/styles.css"')) continue;
    assert.match(html, /href="\/assets\/brand\/typography\.css"/i, path);
    assert.match(html, /href="\/assets\/fonts\/lora\/Lora-Variable\.woff2"[^>]*as="font"/i, path);
    assert.match(html, /href="\/assets\/fonts\/zalando-sans-semiexpanded\/ZalandoSansSemiExpanded-Variable\.woff2"[^>]*as="font"/i, path);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i, path);
  }
});

test("typography stylesheet has no runtime external font-provider dependency", () => {
  const css = read(typographyPath);
  assert.doesNotMatch(css, /https?:\/\//i);
  assert.doesNotMatch(css, /Roboto|system-ui|-apple-system|BlinkMacSystemFont/i);
});
