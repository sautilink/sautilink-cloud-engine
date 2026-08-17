import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const binary = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const home = read("public/index.html");
const faq = read("public/faq.html");
const headers = read("public/_headers");
const robots = read("public/robots.txt");
const sitemap = read("public/sitemap.xml");
const manifest = read("public/site.webmanifest");
const llms = read("public/llms.txt");
const shell = read("public/assets/brand/product-shell.css");

function pngDimensions(path) {
  const data = binary(path);
  assert.equal(data.subarray(1, 4).toString("ascii"), "PNG", `${path} must be a PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function cspHash(scriptText) {
  return `sha256-${createHash("sha256").update(scriptText).digest("base64")}`;
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

test("Cloud Engine uses the official SautiLink logo in shared product chrome", () => {
  assert.match(shell, /https:\/\/sautilink\.com\/logo\.png/i);
  assert.match(home, /https:\/\/sautilink\.com\/logo\.png/i);
  assert.match(faq, /https:\/\/sautilink\.com\/logo\.png/i);
  assert.match(headers, /img-src 'self' data: https:\/\/sautilink\.com/);
  assert.doesNotMatch(home, /raw\.githubusercontent\.com/i);
});

test("homepage exposes real Telegram, legal and SautiLink ecosystem destinations", () => {
  assert.match(home, /https:\/\/t\.me\/sautilinkcloud_bot/i);
  assert.match(home, /https:\/\/sautilink\.com\/privacy/i);
  assert.match(home, /https:\/\/sautilink\.com\/terms/i);
  assert.match(home, /https:\/\/sautilink\.com\/sautinote/i);
  assert.match(home, /https:\/\/facebook\.com\/sautilink/i);
  assert.match(home, /https:\/\/tiktok\.com\/@sautilink/i);
  assert.match(home, /https:\/\/linktr\.ee\/sautilink/i);
});

test("share preview and app icon files have the expected formats and dimensions", () => {
  const required = [
    "public/assets/brand/cloud-engine-share.png",
    "public/favicon/favicon-32.png",
    "public/favicon/apple-touch-icon.png",
    "public/favicon/icon-192.png",
    "public/favicon/icon-512.png",
    "public/assets/brand/product-mark.svg",
  ];
  for (const path of required) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    assert.ok(statSync(path).size > 100, `${path} should be non-empty`);
  }
  assert.deepEqual(pngDimensions("public/assets/brand/cloud-engine-share.png"), { width: 1200, height: 630 });
  assert.deepEqual(pngDimensions("public/favicon/favicon-32.png"), { width: 32, height: 32 });
  assert.deepEqual(pngDimensions("public/favicon/apple-touch-icon.png"), { width: 180, height: 180 });
  assert.deepEqual(pngDimensions("public/favicon/icon-192.png"), { width: 192, height: 192 });
  assert.deepEqual(pngDimensions("public/favicon/icon-512.png"), { width: 512, height: 512 });
  assert.match(home, /cloud-engine-share\.png/);
  assert.match(home, /og:image:width" content="1200"/);
  assert.match(home, /og:image:height" content="630"/);
});

test("web manifest uses first-party favicon and install icons", () => {
  assert.match(manifest, /SautiLink Cloud Engine/);
  assert.match(manifest, /\/favicon\/favicon\.svg/);
  assert.match(manifest, /\/favicon\/icon-192\.png/);
  assert.match(manifest, /\/favicon\/icon-512\.png/);
});

test("FAQ is indexable and exposes FAQ structured data", () => {
  assert.match(faq, /<title>Cloud Engine FAQ — SautiLink<\/title>/);
  assert.match(faq, /"@type":"FAQPage"/);
  assert.match(faq, /What is SautiLink Cloud Engine\?/);
  assert.match(faq, /href="\/faq\.css"/);
  assert.doesNotMatch(faq, /<style>/i);
  assert.match(faq, /https:\/\/sautilink\.com\/privacy/i);
  assert.match(faq, /https:\/\/t\.me\/sautilinkcloud_bot/i);
  assert.match(sitemap, /https:\/\/cloudengine\.sautilink\.com\/faq/);
});

test("structured-data blocks are explicitly allowed by the strict CSP", () => {
  const blocks = [...jsonLdBlocks(home), ...jsonLdBlocks(faq)];
  assert.ok(blocks.length >= 2);
  for (const block of blocks) {
    assert.match(headers, new RegExp(cspHash(block).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(headers, /script-src[^\n]*'unsafe-inline'/i);
});

test("search and AI discovery rules allow public crawling while protecting account routes", () => {
  assert.match(robots, /User-agent: OAI-SearchBot[\s\S]*Allow: \/[\s\S]*Disallow: \/account\//);
  assert.match(robots, /User-agent: PerplexityBot[\s\S]*Allow: \/[\s\S]*Disallow: \/account\//);
  assert.match(robots, /Sitemap: https:\/\/cloudengine\.sautilink\.com\/sitemap\.xml/);
  assert.match(llms, /SautiLink Cloud Engine/);
  assert.match(llms, /https:\/\/cloudengine\.sautilink\.com\/faq/);
  assert.match(llms, /https:\/\/sautilink\.com\/privacy/);
});

test("homepage provides Organization, WebSite and WebApplication structured data", () => {
  assert.match(home, /"@type": "Organization"/);
  assert.match(home, /"@type": "WebSite"/);
  assert.match(home, /"@type": "WebApplication"/);
  assert.match(home, /"logo": "https:\/\/sautilink\.com\/logo\.png"/);
  assert.match(home, /"applicationCategory": "DeveloperApplication"/);
});
