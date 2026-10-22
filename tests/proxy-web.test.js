import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COPY, initialView, snapshotUrl, normalizeSnapshot, snapshotState, proxyStatus, connectUrl, relativeTime, renderProxyCard, createSnapshotLoader, bootProxyPage } from "../public/tools/proxy.js";
import { createSnapshot, listSnapshot } from "../src/proxy/model.js";
import { normalizeProxy } from "../src/proxy/protocol/normalize.js";

const now = Date.parse("2026-10-22T15:00:00Z");
const iso = milliseconds => new Date(milliseconds).toISOString();
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function fixture(overrides = {}, rowOverrides = {}) {
  const proxy = {
    id: "sample-1", label: "Community connection 1", host: "proxy.example.org", port: 443, type: "mtproto", transport: "classic", status: "active", latency_ms: 147,
    last_checked_at: iso(now - 30_000), last_success_at: iso(now - 30_000), check_location: null,
    source: { name: "Community directory", url: "https://example.org/proxies" }, operator: "community", availability_pct: 92.5, history: [],
    connect_url: "https://t.me/proxy?server=proxy.example.org&port=443&secret=0123456789abcdef0123456789abcdef",
    ...rowOverrides,
  };
  return { success: true, data: {
    schema_version: 1, generated_at: iso(now - 15_000), expires_at: iso(now + 165_000), monitor_status: "ready", target_active: 20, refresh_interval_seconds: 300,
    counts: { active: 1, unstable: 0, offline: 0, unverified: 0, stale: 0, total: 1 }, page: 1, per_page: 20, total_pages: 1, total: 1, proxies: [proxy], sources: [], ...overrides,
  } };
}

test("proxy directory defaults to English and sends only bounded public snapshot query fields", () => {
  assert.deepEqual(initialView("?lang=fr&page=-1&status=scan&sort=url&theme=bad"), { lang: "en", page: 1, status: "active", sort: "latency", theme: null });
  const view = initialView("?lang=sw&status=all&page=3&sort=reliability&theme=dark&host=internal&secret=hidden");
  assert.equal(view.lang, "sw");
  assert.equal(view.theme, "dark");
  assert.equal(snapshotUrl(view), "/api/proxies?status=all&page=3&per_page=20&sort=reliability");
  assert.equal(snapshotUrl({ status: "offline", page: Infinity, sort: "elsewhere" }), "/api/proxies?status=offline&page=1&per_page=20&sort=latency");
});

test("counts and availability must come from a complete response; unknown values never become fake successes", () => {
  const data = normalizeSnapshot(fixture({}, { latency_ms: null, availability_pct: null }));
  assert.equal(data.proxies[0].latency_ms, null);
  assert.equal(data.proxies[0].availability_pct, null);
  const rendered = renderProxyCard(data.proxies[0], data, "en", now);
  assert.match(rendered, /Not measured/);
  assert.match(rendered, /No history yet/);
  assert.doesNotMatch(rendered, /100%|0 ms/);
  assert.throws(() => normalizeSnapshot(fixture({ counts: undefined })), /invalid/);
  assert.throws(() => normalizeSnapshot(fixture({ schema_version: 2 })), /invalid/);
  assert.throws(() => normalizeSnapshot(fixture({}, { type: "http", port: 0 })), /invalid/);
  const warming = normalizeSnapshot(fixture({ generated_at: null, expires_at: null, monitor_status: "warming", counts: { active: 0, offline: 0, unstable: 0, unverified: 0, stale: 0, total: 0 }, total: 0, total_pages: 0, proxies: [] }));
  assert.equal(snapshotState(warming, now), "warming");
  assert.equal(warming.counts.active, 0);
});

test("fresh active proxies can connect during warming, then stop at either snapshot or row expiry", () => {
  const data = normalizeSnapshot(fixture({ monitor_status: "warming" }));
  const proxy = data.proxies[0];
  assert.equal(snapshotState(data, now), "warming");
  assert.ok(connectUrl(proxy, data, now));
  assert.equal(connectUrl(proxy, data, Date.parse(data.expires_at)), null);
  assert.equal(proxyStatus(proxy, data, Date.parse(data.expires_at)), "stale");
  const oldRow = { ...proxy, last_checked_at: iso(now - 600_000) };
  assert.equal(connectUrl(oldRow, data, now), null);
  assert.equal(connectUrl({ ...oldRow, last_checked_at: iso(now - 599_999) }, data, now) !== null, true);
  assert.equal(connectUrl({ ...proxy, last_checked_at: iso(now + 120_000) }, data, now), null);
  assert.equal(connectUrl(proxy, { ...data, monitor_status: "unavailable" }, now), null);
  assert.equal(connectUrl({ ...proxy, status: "unstable" }, data, now), null);
  assert.equal(connectUrl({ ...proxy, last_checked_at: null }, data, now), null);
  assert.equal(connectUrl({ ...proxy, last_success_at: iso(now - 600_000) }, data, now), null);
});

test("Connect allows only matching official Telegram proxy links with a supported transport", () => {
  const data = normalizeSnapshot(fixture());
  const proxy = data.proxies[0];
  assert.ok(connectUrl(proxy, data, now)?.startsWith("https://t.me/proxy?"));
  assert.ok(connectUrl({ ...proxy, connect_url: proxy.connect_url.replace("https://t.me/", "tg://") }, data, now)?.startsWith("tg://proxy?"));
  for (const value of [
    "javascript:alert(1)", "https://t.me.evil.example/proxy?server=proxy.example.org&port=443&secret=0123456789abcdef0123456789abcdef",
    proxy.connect_url.replace("server=proxy.example.org", "server=other.example.org"),
    proxy.connect_url.replace("port=443", "port=444"), proxy.connect_url + "&secret=second", proxy.connect_url + "&redirect=https://evil.example", proxy.connect_url + "#ignored",
    proxy.connect_url.replace("https://t.me", "https://name:password@t.me"),
  ]) assert.equal(connectUrl({ ...proxy, connect_url: value }, data, now), null, value);
  assert.equal(connectUrl({ ...proxy, transport: "unknown" }, data, now), null);
});

test("the real public snapshot and protocol normalizer produce compatible classic, padded and Fake TLS links", () => {
  const base = "0123456789abcdef0123456789abcdef";
  const secrets = [base, `dd${base}`, `ee${base}${Buffer.from("example.com").toString("hex")}`];
  const candidates = secrets.map((secret, index) => ({
    ...normalizeProxy({ host: "proxy.example.org", port: "443", secret }),
    id: `normalized-${index}`, status: "active", checked_at: now - 30_000, success_at: now - 30_000, checks: 4, successes: 3, latency_ms: 120,
  }));
  const stored = createSnapshot(candidates, [], now);
  const current = normalizeSnapshot({ success: true, data: listSnapshot(stored, new URLSearchParams("status=all&per_page=20"), now) });
  assert.equal(current.proxies.length, 3);
  for (const proxy of current.proxies) {
    assert.ok(connectUrl(proxy, current, now));
    assert.match(renderProxyCard(proxy, current, "en", now), /Connect to proxy.example.org in Telegram/);
  }
  const expired = normalizeSnapshot({ success: true, data: listSnapshot(stored, new URLSearchParams("status=all"), now + 180_000) });
  assert.equal(expired.counts.active, 0);
  assert.equal(expired.counts.stale, 3);
  assert.equal(expired.proxies.every(proxy => connectUrl(proxy, expired, now + 180_000) === null), true);
});

test("untrusted labels and monitoring locations remain text, while upstream branding is omitted", () => {
  const data = normalizeSnapshot(fixture({}, {
    id: 'x" onclick="alert(1)', label: '<img src=x onerror="alert(1)">', check_location: '<script>alert(1)</script>',
    source: { name: '<b>My source</b>', url: 'javascript:alert(1)' },
  }));
  const html = renderProxyCard(data.proxies[0], data, "en", now);
  assert.doesNotMatch(html, /<img|<script|<b>|href="javascript:|data-proxy-id="x" onclick/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(data.proxies[0].source, undefined);
  assert.doesNotMatch(html, /My source|<dt>Source<\/dt>/);
  assert.match(html, /Community provider/);
  assert.match(html, /30s ago/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  const neutral = normalizeSnapshot(fixture({}, { check_location: null }));
  assert.match(renderProxyCard(neutral.proxies[0], neutral, "en", now), /Checked from monitoring service/);
  assert.equal(relativeTime(null, "en", now), "Not checked");
  assert.equal(relativeTime(iso(now - 120_000), "sw", now), "dakika 2 zilizopita");
});

test("proxy cards never promote an upstream source even when a legacy snapshot includes one", () => {
  const payload = fixture({}, { source: { name: "Example upstream brand", url: "https://upstream.example/proxies" } });
  const data = normalizeSnapshot(payload);
  for (const lang of ["en", "sw"]) {
    const html = renderProxyCard(payload.data.proxies[0], data, lang, now);
    assert.doesNotMatch(html, /Example upstream brand|upstream\.example|<dt>Source<\/dt>|<dt>Chanzo<\/dt>/);
    assert.match(html, /https:\/\/t\.me\/proxy\?/);
  }
});

test("a late response cannot replace a newer status view; every request is a snapshot-only GET", async () => {
  const requests = [];
  const states = [];
  const loader = createSnapshotLoader({ fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })), onState: state => states.push(state) });
  const first = loader.load({ status: "active", sort: "latency", page: 1 });
  const second = loader.load({ status: "offline", sort: "reliability", page: 1 });
  assert.equal(requests[0].options.signal.aborted, true);
  requests[1].resolve({ ok: true, json: async () => fixture({}, { status: "offline", connect_url: null }) });
  await second;
  requests[0].resolve({ ok: true, json: async () => fixture() });
  await first;
  assert.equal(states.at(-1).view.status, "offline");
  assert.equal(states.at(-1).snapshot.proxies[0].status, "offline");
  assert.equal(states.filter(state => !state.loading).length, 1);
  for (const request of requests) {
    assert.match(request.url, /^\/api\/proxies\?/);
    assert.equal(request.options.method, "GET");
    assert.equal(request.options.credentials, "omit");
    assert.equal(request.options.redirect, "error");
    assert.equal(request.options.cache, "no-store");
    assert.equal(request.options.body, undefined);
  }
  loader.dispose();
});

test("failed refresh retains original results only in the same view and distinguishes invalid/rate-limited data", async () => {
  const states = [];
  let result = { ok: true, json: async () => fixture() };
  const loader = createSnapshotLoader({ fetch: async () => { if (result instanceof Error) throw result; return result; }, onState: state => states.push(state) });
  const view = { status: "active", sort: "latency", page: 1 };
  await loader.load(view);
  result = new Error("offline");
  await loader.load(view);
  assert.equal(states.at(-1).error, "network");
  assert.equal(states.at(-1).snapshot.generated_at, fixture().data.generated_at);
  await loader.load({ ...view, status: "offline" });
  assert.equal(states.at(-1).snapshot, null, "Old active cards must not appear as offline results");
  assert.equal(states.at(-1).summary.counts.active, 1, "Previously reported counts are retained without guessing");
  result = { ok: true, json: async () => ({ success: true, data: { counts: {} } }) };
  await loader.load(view);
  assert.equal(states.at(-1).error, "invalid");
  result = { ok: false, status: 429 };
  await loader.load(view);
  assert.equal(states.at(-1).error, "limited");
  loader.dispose();
});

test("each connection expires on screen at its own deadline without waiting for another network response", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now });
  const payload = fixture();
  payload.data.proxies = [1000, 3000].map((remaining, index) => ({
    ...payload.data.proxies[0], id: `expiring-${index}`,
    last_checked_at: iso(now - 600_000 + remaining), last_success_at: iso(now - 600_000 + remaining),
  }));
  payload.data.counts.active = payload.data.counts.total = payload.data.total = 2;
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      dataset: {}, textContent: "", innerHTML: "", setAttribute() {}, addEventListener() {},
      querySelectorAll: () => [], querySelector: child => element(`${id}:${child}`),
    });
    return elements.get(id);
  };
  const doc = {
    visibilityState: "visible", documentElement: { dataset: {} }, activeElement: null,
    getElementById: element, querySelector: element, querySelectorAll: () => [], addEventListener() {},
  };
  let reads = 0;
  const win = {
    location: { href: "https://cloudengine.sautilink.com/tools/proxy", search: "" },
    history: { replaceState() {} }, localStorage: { getItem: () => null },
    matchMedia: () => ({ matches: false }), addEventListener() {},
    fetch: async () => { reads++; return { ok: true, json: async () => payload }; },
  };
  const loader = bootProxyPage(doc, win);
  t.after(() => loader.dispose());
  await new Promise(setImmediate);
  const connections = () => [...element("proxy-list").innerHTML.matchAll(/data-connect-id=/g)].length;
  assert.equal(connections(), 2);
  t.mock.timers.tick(1030);
  assert.equal(connections(), 1);
  t.mock.timers.tick(2000);
  assert.equal(connections(), 0);
  assert.equal(element("active-count-label").textContent, "Active at last update");
  assert.equal(reads, 1, "Expiry rendering does not start any extra requests");
});

test("the bilingual directory is discoverable, keeps shared branding, and has complete UI translations", () => {
  const html = read("public/tools/proxy.html");
  assert.deepEqual(Object.keys(COPY.en).sort(), Object.keys(COPY.sw).sort());
  for (const [, key] of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) assert.ok(COPY.en[key] && COPY.sw[key], key);
  assert.match(html, /<html lang="en"/);
  assert.match(html, /InterVariable\.woff2/);
  assert.match(html, /public-icons\/adapter\.js/);
  assert.match(html, /id="proxy-theme"[^>]*aria-pressed="false"/);
  assert.match(html, /https:\/\/www\.sautilink\.com/);
  assert.match(html, /href="https:\/\/www\.sautilink\.com"[^>]*data-i18n="corporation">Powered by SautiLink Corporation/);
  assert.match(html, /href="https:\/\/t\.me\/drcharlesofficial"[^>]*class="proxy-inline-link proxy-updates"/);
  assert.equal(COPY.en.corporation, "Powered by SautiLink Corporation");
  assert.equal(COPY.sw.corporation, "Powered by SautiLink Corporation");
  assert.equal(COPY.en.updates, "Follow updates");
  assert.equal(COPY.sw.updates, "Fuata updates");
  assert.doesNotMatch(html, /<script[^>]*>\s*[^<\s]/);
  for (const path of ["public/app.js", "src/config/tools.js"]) assert.match(read(path), /id: "telegram-proxy"[^\n]+route: "\/tools\/proxy"[^\n]+status: "available"/);
  for (const path of ["public/index.html", "public/sitemap.xml", "public/llms.txt"]) assert.match(read(path), /\/tools\/proxy/);
});
