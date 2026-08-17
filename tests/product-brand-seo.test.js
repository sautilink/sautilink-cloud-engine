import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = read("public/index.html");
const faq = read("public/faq.html");
const robots = read("public/robots.txt");
const sitemap = read("public/sitemap.xml");
const manifest = read("public/site.webmanifest");
const llms = read("public/llms.txt");
const shell = read("public/assets/brand/product-shell.css");

test("Cloud Engine uses the official SautiLink logo in shared product chrome", () => {
  assert.match(shell, /https:\/\/sautilink\.com\/logo\.png/i);
  assert.match(home, /https:\/\/sautilink\.com\/logo\.png/i);
  assert.match(faq, /https:\/\/sautilink\.com\/logo\.png/i);
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

test("share preview and app icon files exist as real non-empty assets", () => {
  const assets = [
    ["public/assets/brand/cloud-engine-share.png", 10_000],
    ["public/favicon/favicon-32.png", 300],
    ["public/favicon/apple-touch-icon.png", 1_000],
    ["public/favicon/icon-192.png", 1_000],
    ["public/favicon/icon-512.png", 4_000],
    ["public/assets/brand/product-mark.svg", 100],
  ];
  for (const [path, min] of assets) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    assert.ok(statSync(path).size > min, `${path} should be a real asset`);
  }
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
  assert.match(faq, /https:\/\/sautilink\.com\/privacy/i);
  assert.match(faq, /https:\/\/t\.me\/sautilinkcloud_bot/i);
  assert.match(sitemap, /https:\/\/cloudengine\.sautilink\.com\/faq/);
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
