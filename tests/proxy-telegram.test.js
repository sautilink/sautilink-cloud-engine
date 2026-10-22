import test from "node:test";
import assert from "node:assert/strict";
import {
  handleProxyCommand, handleProxyCallback, renderProxySnapshot, safeProxyConnectUrl,
  PROXY_TIMEOUT_MS, PROXY_SUCCESS_FRESH_MS,
} from "../src/telegram/proxies.js";
import { handleCommand } from "../src/telegram/commands.js";
import { parseCallbackAction } from "../src/telegram/normalize.js";
import { mainMenuKeyboard, toolsHomeKeyboard, infrastructureMenuKeyboard } from "../src/telegram/menu.js";
import en from "../src/telegram/i18n/en.js";
import sw from "../src/telegram/i18n/sw.js";

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const NOW = Date.parse("2026-10-22T10:00:00Z");
const SECRET = "1234567890abcdef1234567890abcdef";
const BASE = "https://cloudengine.example";

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
});

function entry(number = 1, now = NOW) {
  return {
    id: `proxy-${number}`, label: `Community proxy ${number}`,
    host: `proxy${number}.example.com`, port: 443, type: "mtproto", transport: "classic", status: "active",
    latency_ms: 112 + number, last_checked_at: new Date(now - 30_000).toISOString(),
    last_success_at: new Date(now - 30_000).toISOString(), check_location: "AMS",
    source: { name: "Maintainer feed", url: "https://github.com/example/feed" }, operator: "community",
    connect_url: `https://t.me/proxy?server=proxy${number}.example.com&port=443&secret=${SECRET}`,
    availability_pct: null, history: [],
  };
}

function snapshot(now = NOW, patch = {}) {
  return {
    schema_version: 1, generated_at: new Date(now - 10_000).toISOString(),
    expires_at: new Date(now + 170_000).toISOString(), monitor_status: "ready", target_active: 20,
    refresh_interval_seconds: 300,
    counts: { active: 12, unstable: 2, offline: 4, unverified: 3, stale: 1, total: 22 },
    page: 1, per_page: 5, total_pages: 3, total: 12,
    proxies: Array.from({ length: 5 }, (_, i) => entry(i + 1, now)), sources: [], ...patch,
  };
}

function buttons(result) { return result.reply_markup.inline_keyboard.flat(); }
function connections(result) { return buttons(result).filter((button) => button.url); }
function callbacks(result) { return buttons(result).map((button) => button.callback_data).filter(Boolean); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } }); }

test("proxy lists are paginated at five, with measured latency and provenance", () => {
  const data = snapshot(NOW, { page: 2, proxies: Array.from({ length: 6 }, (_, i) => entry(i + 6)) });
  const result = renderProxySnapshot(data, "en", { now: NOW });
  assert.equal(connections(result).length, 5);
  assert.match(result.text, /Active at the latest check: 12/);
  assert.match(result.text, /Page 2 of 3/);
  assert.match(result.text, /6\. Community proxy 6/);
  assert.doesNotMatch(result.text, /Community proxy 11/);
  assert.match(result.text, /Observed: 118 ms · monitor: AMS/);
  assert.match(result.text, /Source: Maintainer feed/);
  assert.match(result.text, /not your phone/);
  assert.ok(result.text.length < 3900);
  assert.ok(callbacks(result).includes("proxy:list:1"));
  assert.ok(callbacks(result).includes("proxy:list:3"));
  assert.ok(callbacks(result).includes("proxy:refresh:2"));
  for (const value of callbacks(result)) assert.equal(parseCallbackAction(value), value);
});

test("warming may show fresh Active entries without claiming the target has been met", () => {
  const data = snapshot(NOW, { monitor_status: "warming", counts: { active: 1, unstable: 0, offline: 0, unverified: 2, stale: 0, total: 3 }, proxies: [entry()], total: 1, total_pages: 1 });
  const result = renderProxySnapshot(data, "en", { now: NOW });
  assert.equal(connections(result).length, 1);
  assert.match(result.text, /Initial checks/);
  assert.match(result.text, /latest check: 1/);
  assert.doesNotMatch(result.text, /20 Active/);
  const status = renderProxySnapshot(data, "en", { now: NOW, view: "status" });
  assert.match(status.text, /Target: 20 Active proxies/);
  assert.match(status.text, /not a guaranteed live count/);
  assert.equal(connections(status).length, 0);
});

test("expired snapshots, failed rows and successes older than ten minutes cannot offer Connect", () => {
  for (const patch of [
    { expires_at: new Date(NOW).toISOString() },
    { generated_at: null },
    { monitor_status: "stale" },
    { monitor_status: "unavailable" },
  ]) {
    const result = renderProxySnapshot(snapshot(NOW, patch), "en", { now: NOW });
    assert.equal(connections(result).length, 0, JSON.stringify(patch));
    assert.match(result.text, /Last recorded Active/);
  }
  const rows = [
    { ...entry(1), status: "offline" },
    { ...entry(2), status: "unverified" },
    { ...entry(3), status: "unstable" },
    { ...entry(4), last_success_at: new Date(NOW - PROXY_SUCCESS_FRESH_MS - 1).toISOString() },
    { ...entry(5), last_success_at: null },
  ];
  assert.equal(connections(renderProxySnapshot(snapshot(NOW, { proxies: rows }), "en", { now: NOW })).length, 0);
  const future = { ...entry(), last_checked_at: new Date(NOW + 60_000).toISOString(), last_success_at: new Date(NOW + 60_000).toISOString() };
  assert.equal(connections(renderProxySnapshot(snapshot(NOW, { proxies: [future] }), "en", { now: NOW })).length, 0);
});

test("Connect accepts only a canonical Telegram proxy URL matching the stored endpoint", () => {
  assert.ok(safeProxyConnectUrl(entry()));
  const urls = [
    "javascript:alert(1)", "https://evil.example/proxy?server=proxy1.example.com&port=443&secret=" + SECRET,
    `https://t.me.evil.example/proxy?server=proxy1.example.com&port=443&secret=${SECRET}`,
    `https://user:password@t.me/proxy?server=proxy1.example.com&port=443&secret=${SECRET}`,
    `https://t.me:444/proxy?server=proxy1.example.com&port=443&secret=${SECRET}`,
    `https://t.me/proxy?server=other.example.com&port=443&secret=${SECRET}`,
    `https://t.me/proxy?server=proxy1.example.com&port=80&secret=${SECRET}`,
    entry().connect_url + "&server=another.example.com", entry().connect_url + "&token=hidden",
    entry().connect_url + "#hidden", "https://t.me/login",
  ];
  for (const connect_url of urls) assert.equal(safeProxyConnectUrl({ ...entry(), connect_url }), null, connect_url);
  assert.equal(safeProxyConnectUrl({ ...entry(), status: "offline" }), null);
  assert.equal(safeProxyConnectUrl({ ...entry(), host: "proxy.example.com\nLogin: evil" }), null);
});

test("missing metrics stay unknown and external strings cannot create markup or extra lines", () => {
  const row = { ...entry(), latency_ms: null, availability_pct: null, label: "<b>Proxy</b>\nForged header\u202e", source: { name: "Feed\r\nAnother line", url: "javascript:alert(1)" } };
  const result = renderProxySnapshot(snapshot(NOW, { proxies: [row] }), "en", { now: NOW });
  assert.match(result.text, /Latency not reported/);
  assert.doesNotMatch(result.text, /Observed: 0 ms|100%|\nForged header|\nAnother line|\u202e|javascript:/);
  assert.equal(result.parse_mode, undefined);
  assert.match(result.text, /<b>Proxy<\/b> Forged header/); // literal plain text, not HTML
  assert.equal(connections(result).length, 1);
  assert.ok(connections(result).every((button) => new URL(button.url).origin === "https://t.me"));
});

test("empty, unavailable and malformed snapshots never invent a working proxy", () => {
  const empty = snapshot(NOW, { proxies: [], counts: { active: 0, unstable: 0, offline: 0, unverified: 8, stale: 0, total: 8 }, total: 0, total_pages: 0, monitor_status: "warming" });
  const result = renderProxySnapshot(empty, "en", { now: NOW });
  assert.match(result.text, /No recently verified Active proxies are ready yet/);
  assert.match(result.text, /latest check: 0/);
  assert.equal(connections(result).length, 0);
  const initial = renderProxySnapshot({ ...empty, generated_at: null, expires_at: null }, "en", { now: NOW });
  assert.match(initial.text, /not completed its first snapshot/);
  assert.match(initial.text, /Initial checks/);
  assert.doesNotMatch(initial.text, /results have expired/);
  for (const invalid of [null, {}, { ...snapshot(), schema_version: 2 }, { ...snapshot(), counts: { active: -1 } }, { ...snapshot(), per_page: 500 }]) {
    const response = renderProxySnapshot(invalid, "sw", { now: NOW });
    assert.match(response.text, /haipatikani kwa sasa/);
    assert.equal(connections(response).length, 0);
  }
});

test("list, pagination, refresh and status use one fixed snapshot GET each", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const u = new URL(url); calls.push({ u, options });
    return json({ success: true, data: snapshot(Date.now(), { page: Number(u.searchParams.get("page")) }) });
  };
  await handleCommand({ command: "proxy", arg: "", locale: "en" }, { cloudEngineBaseUrl: BASE });
  await handleProxyCallback("proxy:list:2", BASE);
  await handleProxyCallback("proxy:refresh:2", BASE);
  await handleProxyCommand("status", BASE);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map(({ u }) => u.searchParams.get("page")), ["1", "2", "2", "1"]);
  assert.deepEqual(calls.map(({ u }) => u.searchParams.get("status")), ["active", "active", "active", "all"]);
  for (const { u, options } of calls) {
    assert.equal(u.origin, BASE); assert.equal(u.pathname, "/api/proxies");
    assert.equal(options.method, "GET"); assert.equal(u.searchParams.get("per_page"), "5");
    assert.equal(u.searchParams.get("sort"), "latency");
    assert.equal(u.searchParams.has("refresh"), false); assert.equal(options.body, undefined);
  }
});

test("help and invalid input never invoke the directory or a user-supplied URL", async () => {
  globalThis.fetch = async () => { throw new Error("No request expected"); };
  const help = await handleProxyCommand("help", BASE, "sw");
  assert.match(help.text, /proxies tano kwa ukurasa/);
  for (const arg of ["https://internal.example", "-1", "0", "10000", "1&refresh=true"]) {
    const result = await handleProxyCommand(arg, BASE);
    assert.match(result.text, /Usage: \/proxy/);
  }
  for (const action of ["proxy:list:0", "proxy:list:10000", "proxy:refresh:-1", "proxy:list:01", "proxy:list:1:host", "proxy:check:1"]) {
    assert.equal(parseCallbackAction(action), null);
    assert.equal(await handleProxyCallback(action, BASE), null);
  }
});

test("directory timeout is bounded at four seconds and returns safe retry copy", async () => {
  let delay;
  globalThis.setTimeout = (callback, ms) => { delay = ms; queueMicrotask(callback); return 1; };
  globalThis.clearTimeout = () => {};
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("test", "AbortError")), { once: true });
  });
  const result = await handleProxyCommand("", BASE);
  assert.equal(delay, PROXY_TIMEOUT_MS); assert.equal(delay, 4000);
  assert.match(result.text, /did not respond in time/);
  assert.equal(connections(result).length, 0);
});

test("backend error details and tokens are not echoed into Telegram", async () => {
  for (const status of [429, 500]) {
    globalThis.fetch = async () => json({ success: false, error: { code: "INTERNAL", message: "token=private-secret internal-host" } }, status);
    const result = await handleProxyCommand("", BASE);
    assert.doesNotMatch(result.text, /private-secret|internal-host/);
    assert.match(result.text, status === 429 ? /rate-limited/ : /unavailable right now/);
    assert.equal(connections(result).length, 0);
  }
});

test("proxy navigation is discoverable and all proxy copy exists in English and Kiswahili", () => {
  for (const keyboard of [mainMenuKeyboard, toolsHomeKeyboard, infrastructureMenuKeyboard]) {
    assert.ok(keyboard("en").inline_keyboard.flat().some((button) => button.callback_data === "proxy:list:1"));
  }
  for (const key of Object.keys(en).filter((key) => key.startsWith("proxy.") || key === "menu.proxy")) {
    assert.equal(typeof sw[key], "string", key);
  }
  const result = renderProxySnapshot(snapshot(), "sw", { now: NOW });
  assert.match(result.text, /Ukurasa 1 kati ya 3/);
  assert.match(connections(result)[0].text, /Unganisha Proxy/);
  assert.ok(buttons(result).some((button) => button.text === "Inayofuata ➡️"));
  assert.doesNotMatch(result.text, /proxy\.(?:state|monitor|source)/);
});
