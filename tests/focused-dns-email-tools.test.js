import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { FOCUSED_EMAIL_CHECKS, runFocusedEmailCheck } from "../src/tools/email/focused.js";

const read = (path) => readFileSync(path, "utf8");
const PAGE_IDS = ["mx", "spf", "dmarc", "dkim", "nameserver"];

test("focused email checks use a strict allowlist", async () => {
  assert.deepEqual(FOCUSED_EMAIL_CHECKS, ["mx", "spf", "dmarc", "dkim"]);
  await assert.rejects(
    runFocusedEmailCheck("example.com", "everything", null),
    (error) => error?.code === "INVALID_EMAIL_CHECK"
  );
});

test("focused orchestration performs check-specific DNS work instead of the full email suite", () => {
  const source = read("src/tools/email/focused.js");
  assert.match(source, /lookupDns\(domain, \["MX"\]\)/);
  assert.match(source, /lookupDns\(domain, \["TXT"\]\)/);
  assert.match(source, /lookupDns\(`_dmarc\.\$\{domain\}`, \["TXT"\]\)/);
  assert.match(source, /checkDkim\(domain, selector\.selector\)/);
  assert.doesNotMatch(source, /checkEmailInfrastructure/);
});

test("focused email API keeps request guards, caching and structured errors", () => {
  const source = read("functions/api/email-check.js");
  assert.match(source, /guardRequestSize/);
  assert.match(source, /runFocusedEmailCheck/);
  assert.match(source, /DNS_SUCCESS_CACHE_SECONDS/);
  assert.match(source, /methodNotAllowed/);
  assert.match(source, /INVALID_EMAIL_CHECK|focused email check/i);
});

test("five focused web tools share one responsive UI implementation", () => {
  for (const id of PAGE_IDS) {
    const path = `public/tools/${id}.html`;
    assert.equal(existsSync(path), true, `${path} should exist`);
    const html = read(path);
    assert.match(html, new RegExp(`data-focus="${id}"`));
    assert.match(html, /\/tools\/focused-dns-email\.css/);
    assert.match(html, /\/tools\/focused-dns-email\.js/);
    assert.match(html, /Manrope-Variable\.woff2/);
  }

  const css = read("public/tools/focused-dns-email.css");
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
});

test("DKIM focused page supports an optional selector while other tools remain domain-first", () => {
  const dkim = read("public/tools/dkim.html");
  assert.match(dkim, /DKIM selector \(optional\)/);
  assert.match(dkim, /id="selector-input"/);
  assert.match(dkim, /heuristic discovery/i);

  const ui = read("public/tools/focused-dns-email.js");
  assert.match(ui, /focus === "dkim" && selector/);
  assert.match(ui, /&selector=/);
});

test("focused web UI uses targeted email-check API and existing DNS API", () => {
  const ui = read("public/tools/focused-dns-email.js");
  assert.match(ui, /\/api\/email-check\?domain=/);
  assert.match(ui, /check=\$\{encodeURIComponent\(focus\)\}/);
  assert.match(ui, /\/api\/dns\?domain=/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|indexedDB/);
});

test("public and server tool registries expose all Phase 8D tools as available", () => {
  const publicRegistry = read("public/app.js");
  const serverRegistry = read("src/config/tools.js");
  for (const id of PAGE_IDS) {
    const route = id === "nameserver" ? "/tools/nameserver" : `/tools/${id}`;
    const publicPattern = new RegExp(`id: "${id}"[^\\n]+route: "${route}"[^\\n]+status: "available"`);
    const serverPattern = new RegExp(`id: "${id}"[^\\n]+route: "${route}"[^\\n]+status: "available"`);
    assert.match(publicRegistry, publicPattern);
    assert.match(serverRegistry, serverPattern);
  }
});
