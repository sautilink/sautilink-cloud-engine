import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const html = read("public/tools/server.html");
const js = read("public/tools/server.js");
const css = read("public/tools/server.css");
const publicRegistry = read("public/app.js");
const serverRegistry = read("src/config/tools.js");

test("Server Information is a first-class responsive Manrope web tool", () => {
  assert.match(html, /<h1>Server Information<\/h1>/);
  assert.match(html, /typography-manrope\.css\?v=1/);
  assert.match(html, /server\.css/);
  assert.match(html, /server\.js/);
  assert.match(css, /@media\(max-width:720px\)/);
});

test("Server Information reuses the existing SSRF-safe headers API", () => {
  assert.match(js, /fetch\(`\/api\/headers\?url=/);
  assert.doesNotMatch(js, /https?:\/\//);
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB/i);
});

test("edge signals are presented as observations rather than ownership proof", () => {
  assert.match(html, /Observed values only/);
  assert.match(html, /Not ownership proof/);
  assert.match(html, /does not prove who owns or hosts the target/);
  assert.match(js, /No recognizable edge or proxy response headers were observed/);
  assert.match(js, /cf-ray|x-amz-cf-id|x-vercel-id/);
});

test("Server Information exposes response, security, redirect and delivery context", () => {
  assert.match(js, /Server banner/);
  assert.match(js, /Response time/);
  assert.match(js, /Cache-Control/);
  assert.match(js, /Content-Security-Policy/);
  assert.match(js, /renderRedirects/);
});

test("public and server registries expose Server Information as available", () => {
  for (const source of [publicRegistry, serverRegistry]) {
    assert.match(source, /id: "server-info"[\s\S]*?route: "\/tools\/server"[\s\S]*?status: "available"/);
  }
});
