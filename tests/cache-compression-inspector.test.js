import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("public/tools/cache.html");
const js = read("public/tools/cache.js");
const css = read("public/tools/cache.css");
const publicRegistry = read("public/app.js");
const serverRegistry = read("src/config/tools.js");

test("Cache and Compression Inspector is a responsive Manrope web tool", () => {
  assert.match(html, /<h1>Cache &amp; Compression Inspector<\/h1>/);
  assert.match(html, /typography-manrope\.css\?v=1/);
  assert.match(html, /not a synthetic performance benchmark/i);
  assert.match(css, /@media\(max-width:720px\)/);
});

test("delivery inspection reuses the existing headers API and persists nothing", () => {
  assert.match(js, /fetch\(`\/api\/headers\?url=/);
  assert.match(js, /method: "GET"/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(js, /fetch\(["'`]https?:\/\//i);
});

test("cache policy interpretation handles explicit storage and revalidation directives", () => {
  assert.match(js, /map\.has\("no-store"\)/);
  assert.match(js, /map\.has\("private"\)/);
  assert.match(js, /map\.has\("no-cache"\)/);
  assert.match(js, /map\.has\("public"\).*map\.has\("max-age"\).*map\.has\("s-maxage"\)/s);
  assert.match(js, /stale-while-revalidate/);
});

test("compression result stays observational and does not invent a benchmark", () => {
  assert.match(js, /content-encoding/);
  assert.match(js, /br.*gzip.*zstd.*deflate/s);
  assert.match(js, /does not prove that every client receives an uncompressed response/i);
  assert.doesNotMatch(js, /performance score|lighthouse score/i);
});

test("public and server registries expose Cache and Compression Inspector as available", () => {
  for (const source of [publicRegistry, serverRegistry]) {
    assert.match(source, /id: "cache-compression"[\s\S]*?route: "\/tools\/cache"[\s\S]*?status: "available"/);
  }
});
