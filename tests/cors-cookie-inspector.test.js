import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("public/tools/cors.html");
const js = read("public/tools/cors.js");
const css = read("public/tools/cors.css");
const publicRegistry = read("public/app.js");
const serverRegistry = read("src/config/tools.js");

test("CORS and Cookie Inspector is a responsive Manrope web tool", () => {
  assert.match(html, /<h1>CORS &amp; Cookie Inspector<\/h1>/);
  assert.match(html, /typography-manrope\.css\?v=1/);
  assert.match(html, /Passive observation/);
  assert.match(css, /@media\(max-width:720px\)/);
});

test("CORS inspection reuses the existing headers API as a passive GET", () => {
  assert.match(js, /fetch\(`\/api\/headers\?url=/);
  assert.match(js, /method: "GET"/);
  assert.doesNotMatch(js, /method:\s*["']OPTIONS["']/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB/i);
});

test("CORS UI documents passive semantics and wildcard credential risk", () => {
  assert.match(html, /not a custom-Origin or OPTIONS preflight simulator/i);
  assert.match(js, /Wildcard origin \+ credentials observed/);
  assert.match(js, /do not allow credentialed CORS with Access-Control-Allow-Origin: \*/);
  assert.match(js, /Dynamic origin handling cannot be confirmed from one passive request/);
});

test("cookie rendering exposes security metadata without cookie values", () => {
  assert.match(js, /cookie\.secure/);
  assert.match(js, /cookie\.httpOnly/);
  assert.match(js, /cookie\.sameSite/);
  assert.match(js, /cookie\.path/);
  assert.doesNotMatch(js, /cookie\.value/);
  assert.match(html, /Values are not displayed/);
});

test("public and server registries expose CORS and Cookie Inspector as available", () => {
  for (const source of [publicRegistry, serverRegistry]) {
    assert.match(source, /id: "cors-cookie"[\s\S]*?route: "\/tools\/cors"[\s\S]*?status: "available"/);
  }
});
