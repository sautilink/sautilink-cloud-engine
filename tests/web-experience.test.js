import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Cloud Engine homepage is a web workspace, not a stale bot placeholder landing page", () => {
  const html = read("public/index.html");
  assert.match(html, /Web Diagnostics Workspace/);
  assert.match(html, /id="audit-launch-form"/);
  assert.match(html, /id="tool-search"/);
  assert.match(html, /id="recent-targets"/);
  assert.match(html, /id="channel-bridge"/);
  assert.match(html, /href="\/home\.css"/);
  assert.doesNotMatch(html, /bot is not yet published|Future phases will add the Telegram Bot/i);
  assert.doesNotMatch(html, /Cloudflare-native|Supabase|GitHub/i);
});

test("homepage launches Full Audit through the existing audit route and keeps recents browser-local", () => {
  const app = read("public/app.js");
  assert.match(app, /sautilink\.cloudengine\.recentTargets\.v1/);
  assert.match(app, /localStorage\.setItem/);
  assert.match(app, /localStorage\.removeItem/);
  assert.match(app, /\/tools\/audit\?url=/);
  assert.doesNotMatch(app, /fetch\([^\n]*recentTargets|\/api\/.*history/i);
});

test("web workspace preserves the Cloud Engine Manrope contract and responsive shell", () => {
  const html = read("public/index.html");
  const css = read("public/home.css");
  assert.equal(existsSync("public/assets/fonts/manrope/Manrope-Variable.woff2"), true);
  assert.match(html, /\/assets\/fonts\/manrope\/Manrope-Variable\.woff2/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
});

test("web documentation defines web as flagship and Telegram as companion over shared APIs", () => {
  const doc = read("docs/WEB.md");
  assert.match(doc, /web experience is the flagship/i);
  assert.match(doc, /Telegram remains a companion/i);
  assert.match(doc, /same Cloud Engine analyzer APIs/i);
  assert.match(doc, /short-lived, signed handoff identifiers/i);
  assert.match(doc, /Web is allowed to be more capable than Telegram/i);
});
