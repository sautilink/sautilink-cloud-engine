import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { RECORD_TYPES, DEFAULT_TYPES } from "../src/tools/dns/index.js";
import { preparePublicIp, reverseDnsName } from "../src/tools/infrastructure/ip.js";

const read = (path) => readFileSync(path, "utf8");

test("PTR is explicitly supported without changing default DNS lookup types", () => {
  assert.equal(RECORD_TYPES.PTR, 12);
  assert.equal(DEFAULT_TYPES.includes("PTR"), false);
  assert.deepEqual(DEFAULT_TYPES, ["A", "AAAA", "CNAME", "MX", "NS", "TXT"]);
});

test("IPv4 reverse DNS name is generated correctly", () => {
  const result = reverseDnsName("1.2.3.4");
  assert.equal(result.version, 4);
  assert.equal(result.reverseName, "4.3.2.1.in-addr.arpa");
});

test("IPv6 reverse DNS name expands to 32 reversed nibbles", () => {
  const result = reverseDnsName("2606:4700:4700::1111");
  assert.equal(result.version, 6);
  assert.match(result.reverseName, /\.ip6\.arpa$/);
  const labels = result.reverseName.replace(/\.ip6\.arpa$/, "").split(".");
  assert.equal(labels.length, 32);
  assert.ok(labels.every((label) => /^[0-9a-f]$/.test(label)));
});

test("public IP preparation blocks private and reserved ranges", () => {
  assert.deepEqual(preparePublicIp("1.2.3.4"), { ip: "1.2.3.4", version: 4 });
  for (const value of ["127.0.0.1", "10.0.0.1", "192.0.2.1", "::1", "2001:db8::1"]) {
    assert.equal(preparePublicIp(value).error?.code, "PRIVATE_ADDRESS_BLOCKED", value);
  }
  assert.equal(preparePublicIp("999.1.1.1").error?.code, "INVALID_IP");
});

test("IP and reverse DNS APIs keep request guards, caching, and shared helpers", () => {
  const ipApi = read("functions/api/ip.js");
  const rdnsApi = read("functions/api/rdns.js");
  for (const source of [ipApi, rdnsApi]) {
    assert.match(source, /guardRequestSize/);
    assert.match(source, /DNS_SUCCESS_CACHE_SECONDS/);
    assert.match(source, /methodNotAllowed/);
  }
  assert.match(ipApi, /lookupIp/);
  assert.match(rdnsApi, /reverseDnsLookup/);
});

test("IP and reverse DNS pages share a responsive Manrope UI", () => {
  for (const id of ["ip", "rdns"]) {
    const path = `public/tools/${id}.html`;
    assert.equal(existsSync(path), true);
    const html = read(path);
    assert.match(html, /Manrope-Variable\.woff2/);
    assert.match(html, /\/tools\/infrastructure\.css/);
    assert.match(html, /\/tools\/infrastructure\.js/);
  }
  const css = read("public/tools/infrastructure.css");
  assert.match(css, /@media\(max-width:600px\)/);
});

test("infrastructure web UI calls only the new DNS-based endpoints and stores no target history", () => {
  const ui = read("public/tools/infrastructure.js");
  assert.match(ui, /\/api\/ip\?query=/);
  assert.match(ui, /\/api\/rdns\?ip=/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|indexedDB/);
  assert.match(ui, /ASN, geolocation, and hosting-provider attribution are not inferred/i);
});

test("public and server registries expose IP and reverse DNS as available", () => {
  const publicRegistry = read("public/app.js");
  const serverRegistry = read("src/config/tools.js");
  for (const source of [publicRegistry, serverRegistry]) {
    assert.match(source, /id: "ip"[^\n]+route: "\/tools\/ip"[^\n]+status: "available"/);
    assert.match(source, /id: "rdns"[^\n]+route: "\/tools\/rdns"[^\n]+status: "available"/);
  }
});
