import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { ProxyStore } from "../src/proxy/store.js";
import { createSnapshot, emptySnapshot, listSnapshot, observeCandidate, selectDueCandidates } from "../src/proxy/model.js";
import { onRequest } from "../functions/api/proxies.js";
import { resolveProxyHost } from "../src/proxy/dns.js";
import { runMonitor } from "../src/proxy/monitor.js";
import { collectSources, parseFeed, readLimitedText } from "../src/proxy/sources.js";
import { SOURCES, DISCOVERY_WINDOW_SIZE, SOURCE_INTERVAL_MS, MAX_FEED_BYTES } from "../src/proxy/config.js";

const NOW = Date.parse("2026-10-22T10:00:00Z");
const candidate = (id = "a".repeat(32), overrides = {}) => ({ id, host: "proxy.example.org", port: 443, secret: "1234567890abcdef1234567890abcdef", transport: "classic", source_id: "shablin", source_seen_at: NOW, created_at: NOW, checked_at: null, success_at: null, status: "unverified", failures: 0, checks: 0, successes: 0, latency_ms: null, reason_code: null, check_location: null, history: "[]", next_check_at: 0, ...overrides });
const passed = { status: "active", check_level: "mtproto", latency_ms: 88.6 };

/** Real SQLite executes the exact D1 queries, including RETURNING and transactions. */
function sqliteD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/proxy/0001_proxy_directory.sql", import.meta.url), "utf8"));
  function prepare(sql, args = []) {
    return {
      bind(...values) { return prepare(sql, values); },
      async first() { return db.prepare(sql).get(...args) || null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { return { success: true, meta: db.prepare(sql).run(...args) }; },
    };
  }
  return {
    prepare,
    async batch(statements) {
      db.exec("BEGIN");
      try { const result = []; for (const statement of statements) result.push(await statement.run()); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    close() { db.close(); },
  };
}

test("TCP-only success cannot become Active or acquire a Connect link", () => {
  const row = observeCandidate(candidate(), { ...passed, check_level: "tcp" }, NOW);
  assert.equal(row.status, "unverified");
  assert.equal(row.success_at, null);
  const result = listSnapshot(createSnapshot([row], [], NOW), new URLSearchParams("status=all"), NOW);
  assert.equal(result.counts.active, 0);
  assert.equal(result.proxies[0].connect_url, null);
});

test("verified configuration is connectable, with a real count instead of the target", () => {
  const row = observeCandidate(candidate(), passed, NOW);
  const result = listSnapshot(createSnapshot([row], [], NOW), new URLSearchParams(), NOW);
  assert.equal(result.counts.active, 1);
  assert.equal(result.target_active, 20);
  assert.equal(result.total, 1);
  assert.equal(result.proxies[0].latency_ms, 89);
  assert.equal(new URL(result.proxies[0].connect_url).searchParams.get("secret"), row.secret);
  assert.equal("secret" in result.proxies[0], false);
});

test("stopped monitor expires all previously green links even when the stored JSON is unchanged", () => {
  const snapshot = createSnapshot([observeCandidate(candidate(), passed, NOW)], [], NOW);
  const result = listSnapshot(snapshot, new URLSearchParams("status=all"), NOW + 180_001);
  assert.equal(result.monitor_status, "stale");
  assert.equal(result.counts.active, 0);
  assert.equal(result.counts.stale, 1);
  assert.equal(result.proxies[0].connect_url, null);
});

test("an individual old success expires even while other checks keep publishing snapshots", () => {
  const row = observeCandidate(candidate(), passed, NOW);
  const result = listSnapshot(createSnapshot([row], [], NOW + 600_001), new URLSearchParams("status=all"), NOW + 600_001);
  assert.equal(result.monitor_status, "ready");
  assert.equal(result.proxies[0].status, "stale");
  assert.equal(result.proxies[0].connect_url, null);
});

test("failures remove Connect immediately and only become Offline after confirmation", () => {
  let row = observeCandidate(candidate(), passed, NOW);
  row = observeCandidate(row, { status: "offline", check_level: "none", reason_code: "TIMEOUT" }, NOW + 1000);
  assert.equal(row.status, "unstable");
  assert.equal(createSnapshot([row], [], NOW + 1000).proxies[0].connect_url, null);
  row = observeCandidate(row, { status: "offline" }, NOW + 2000);
  assert.equal(row.status, "unstable");
  row = observeCandidate(row, { status: "offline" }, NOW + 3000);
  assert.equal(row.status, "offline");
  assert.equal(row.next_check_at, NOW + 303_000);
  row = observeCandidate(row, passed, NOW + 4000);
  assert.equal(row.status, "active");
  assert.equal(row.failures, 0);
});

test("checker restrictions are unverified, not server downtime, and history is bounded", () => {
  let row = candidate();
  for (let index = 0; index < 30; index++) row = observeCandidate(row, { status: "unverified", reason_code: "PLATFORM_RESTRICTED" }, NOW + index);
  assert.equal(row.failures, 0);
  assert.equal(row.checks, 0);
  assert.equal(row.status, "unverified");
  assert.equal(JSON.parse(row.history).length, 12);
});

test("due selection reserves room for new candidates without leaving available slots empty", () => {
  const rows = Array.from({ length: 30 }, (_, index) => candidate(String(index).padStart(32, "0"), { status: index < 20 ? "active" : "unverified" }));
  const selected = selectDueCandidates(rows, NOW, 12);
  assert.equal(selected.length, 12);
  assert.equal(selected.filter(row => row.status === "active").length, 6);
  assert.equal(new Set(selected.map(row => row.id)).size, 12);
  assert.equal(selectDueCandidates(rows.slice(0, 20), NOW, 12).length, 12);
  assert.equal(selectDueCandidates(rows.slice(20), NOW, 12).length, 10);
});

test("pagination preserves counts and handles invalid parameters without exposing secrets", () => {
  const rows = Array.from({ length: 23 }, (_, index) => observeCandidate(candidate(String(index).padStart(32, "0")), { ...passed, latency_ms: 20 + index }, NOW));
  const snapshot = createSnapshot(rows, [], NOW);
  const second = listSnapshot(snapshot, new URLSearchParams("page=2&per_page=5"), NOW);
  assert.equal(second.proxies.length, 5);
  assert.equal(second.proxies[0].latency_ms, 25);
  assert.equal(second.counts.active, 23);
  assert.equal(second.total_pages, 5);
  const invalid = listSnapshot(snapshot, new URLSearchParams("page=-2&per_page=99999&status=garbage"), NOW);
  assert.equal(invalid.page, 1);
  assert.equal(invalid.per_page, 20);
  assert.equal(invalid.filter, "active");
});

test("SQLite lease excludes overlapping workers and rejects stale writers", async () => {
  const db = sqliteD1(); const store = new ProxyStore(db);
  try {
    assert.ok(await store.acquire(NOW, "first"));
    assert.equal(await store.acquire(NOW + 1, "second"), null);
    assert.ok(await store.acquire(NOW + 90_001, "second"));
    await store.publish(createSnapshot([], [], NOW + 90_002), [], 0, "first", NOW + 90_002);
    assert.equal(await store.snapshot(), null);
    await store.publish(createSnapshot([], [], NOW + 90_003), [], 0, "second", NOW + 90_003);
    assert.equal((await store.snapshot()).generated_at, new Date(NOW + 90_003).toISOString());
    assert.ok(await store.acquire(NOW + 90_004, "third"));
  } finally { db.close(); }
});

test("SQLite import preserves health for unchanged keys, and a new secret starts unverified", async () => {
  const db = sqliteD1(); const store = new ProxyStore(db);
  try {
    await store.acquire(NOW, "lease");
    await store.importCandidates([candidate()], [], NOW, [], "lease");
    let row = (await store.list())[0];
    await store.saveObservations([observeCandidate(row, passed, NOW + 1)], "lease", NOW + 1);
    await store.importCandidates([candidate()], [], NOW + 2, [], "lease");
    row = (await store.list())[0];
    assert.equal(row.status, "active");
    assert.equal(row.checks, 1);
    await store.importCandidates([candidate("b".repeat(32), { secret: "abcdef1234567890abcdef1234567890" })], [], NOW + 3, [], "lease");
    const changed = (await store.list()).find(item => item.id.startsWith("b"));
    assert.equal(changed.status, "unverified");
    assert.equal(changed.success_at, null);
    await store.saveObservations([observeCandidate(row, { status: "offline" }, NOW)], "lease", NOW + 4);
    assert.equal((await store.list()).find(item => item.id === row.id).status, "active");
  } finally { db.close(); }
});

test("public API only forwards fixed read parameters to the bound service, never probe targets", async () => {
  let called = 0;
  const request = new Request("https://cloudengine.sautilink.com/api/proxies?page=2&per_page=5&host=127.0.0.1&url=http://localhost&refresh=true");
  const data = { ...listSnapshot(emptySnapshot("warming")), page: 2, total_pages: 5, total: 25 };
  const response = await onRequest({ request, env: { PROXY_DIRECTORY: { fetch: async forwarded => {
    called++;
    const url = new URL(forwarded.url);
    assert.equal(url.hostname, "proxy-directory.internal");
    assert.equal(url.search, "?page=2&per_page=5");
    return Response.json({ success: true, data });
  } } } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.page, 2);
  assert.equal(called, 1);
});

test("public API fails honestly and safely when deployment binding is absent", async () => {
  const request = new Request("https://cloudengine.sautilink.com/api/proxies");
  const body = await (await onRequest({ request, env: {} })).json();
  assert.equal(body.data.monitor_status, "unavailable");
  assert.equal(body.data.counts.active, 0);
  const bad = await onRequest({ request: new Request(request, { method: "POST" }), env: {} });
  assert.equal(bad.status, 405);
});

test("DNS returns pinned public addresses and rejects mixed private answers", async () => {
  const records = answers => async () => Response.json({ Status: 0, Answer: answers.map(data => ({ type: 1, data })) });
  assert.deepEqual(await resolveProxyHost("proxy.example.org", { fetchFn: records(["8.8.8.8"]) }), ["8.8.8.8"]);
  await assert.rejects(resolveProxyHost("proxy.example.org", { fetchFn: records(["8.8.8.8", "127.0.0.1"]) }), { code: "PRIVATE_ADDRESS_BLOCKED" });
  let contacted = false;
  await assert.rejects(resolveProxyHost("metadata.google.internal", { fetchFn: async () => { contacted = true; } }), { code: "PRIVATE_ADDRESS_BLOCKED" });
  assert.equal(contacted, false);
});

test("DNS rejects redirects without following their destinations", async () => {
  for (const status of [301, 302, 307, 308]) {
    let calls = 0; let cancelled = false;
    await assert.rejects(resolveProxyHost("proxy.example.org", { fetchFn: async (url, options) => {
      calls++;
      assert.equal(url.origin, "https://cloudflare-dns.com");
      assert.equal(options.redirect, "manual");
      return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status, headers: { Location: "http://127.0.0.1/private" } });
    } }), { code: "DNS_UNAVAILABLE" });
    assert.equal(calls, 1);
    assert.equal(cancelled, true);
  }
});

export { sqliteD1, candidate, NOW };

test("an expired lease cannot import, prune or update results before another worker starts", async () => {
  const db = sqliteD1(); const store = new ProxyStore(db);
  try {
    await store.acquire(NOW, "expired");
    await store.importCandidates([candidate()], [], NOW, [], "expired");
    await store.saveObservations([observeCandidate(candidate(), passed, NOW + 90_001)], "expired", NOW + 90_001);
    await store.importCandidates([candidate("b".repeat(32))], [], NOW + 90_001, [], "expired");
    const rows = await store.list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "unverified");
    await store.publish(createSnapshot(rows, [], NOW + 90_001), [], 0, "expired", NOW + 90_001);
    assert.equal(await store.snapshot(), null);
  } finally { db.close(); }
});

test("source parsing is bounded, validates addresses and deduplicates canonical links", async () => {
  const secret = "1234567890abcdef1234567890abcdef";
  const valid = `https://t.me/proxy?server=proxy.example.org&port=443&secret=${secret}`;
  assert.equal(parseFeed(`${valid}\n${valid.replaceAll("&", "&amp;")}\n${valid.replace("proxy.example.org", "127.0.0.1")}\nhttps://evil.example/proxy?server=8.8.8.8&port=443&secret=${secret}`).length, 1);
  await assert.rejects(readLimitedText(new Response("oversized body"), 5), /SOURCE_TOO_LARGE/);
});

test("bounded source rotation admits later entries and an unavailable source does not erase the other feed", async () => {
  const secret = "1234567890abcdef1234567890abcdef";
  const feed = Array.from({ length: 500 }, (_, index) => `https://t.me/proxy?server=proxy${index}.example.org&port=443&secret=${secret}`).join("\n");
  const fetchFn = async url => url === SOURCES[0].feed ? new Response(feed) : new Response("unavailable", { status: 503 });
  const first = await collectSources({ fetchFn, now: NOW });
  const second = await collectSources({ fetchFn, now: NOW + SOURCE_INTERVAL_MS });
  assert.equal(first.candidates.length, DISCOVERY_WINDOW_SIZE);
  assert.equal(second.candidates.length, DISCOVERY_WINDOW_SIZE);
  assert.equal(first.observations[0].scanned_count, DISCOVERY_WINDOW_SIZE);
  assert.equal(first.observations[0].feed_link_count, 500);
  assert.equal(first.observations[1].status, "unavailable");
  assert.notEqual(first.candidates[0].id, second.candidates[0].id);
  const previous = new Set(first.candidates.map(row => row.id));
  assert.ok(second.candidates.some(row => !previous.has(row.id)));
});

test("source diagnostics retain HTTP status without exposing response bodies", async () => {
  const privateDetail = "https://untrusted.invalid/private?token=feed-error-secret";
  for (const status of [301, 302, 307, 308, 403, 404, 429, 503]) {
    let calls = 0; let cancelled = false;
    const result = await collectSources({ sources: [SOURCES[0]], now: NOW, fetchFn: async (url, options) => {
      calls++;
      assert.equal(url, SOURCES[0].feed);
      assert.equal(options.redirect, "manual");
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode(privateDetail)); },
        cancel() { cancelled = true; },
      }), { status, headers: { Location: "http://127.0.0.1/private" } });
    } });
    assert.equal(result.candidates.length, 0);
    assert.equal(result.observations[0].reason_code, "SOURCE_HTTP_ERROR");
    assert.equal(result.observations[0].http_status, status);
    assert.equal(JSON.stringify(result).includes(privateDetail), false);
    assert.equal(calls, 1);
    assert.equal(cancelled, true);
  }
});

test("new source observations replace stale errors while preserving the last successful fetch", async () => {
  const store = new ProxyStore(null);
  const previous = [{ id: "shablin", status: "unavailable", last_fetched_at: new Date(NOW - 1000).toISOString(), reason_code: "SOURCE_HTTP_ERROR", http_status: 503 }];
  const recovered = await store.importCandidates([], [{ id: "shablin", status: "ok", last_fetched_at: new Date(NOW).toISOString() }], NOW, previous, "fixture");
  assert.equal(Object.hasOwn(recovered[0], "reason_code"), false);
  assert.equal(Object.hasOwn(recovered[0], "http_status"), false);
  const failedFetch = await store.importCandidates([], [{ id: "shablin", status: "unavailable", reason_code: "SOURCE_FETCH_ERROR" }], NOW, previous, "fixture");
  assert.equal(failedFetch[0].reason_code, "SOURCE_FETCH_ERROR");
  assert.equal(Object.hasOwn(failedFetch[0], "http_status"), false);
  assert.equal(failedFetch[0].last_fetched_at, previous[0].last_fetched_at);
});

test("source diagnostics distinguish an empty feed and the feed-size limit", async () => {
  const empty = await collectSources({ sources: [SOURCES[0]], now: NOW, fetchFn: async () => new Response("No proxy links") });
  assert.equal(empty.observations[0].reason_code, "SOURCE_EMPTY");
  assert.equal(empty.observations[0].http_status, 200);
  const oversized = await collectSources({ sources: [SOURCES[0]], now: NOW, fetchFn: async () => new Response("body", { headers: { "content-length": String(MAX_FEED_BYTES + 1) } }) });
  assert.equal(oversized.observations[0].reason_code, "SOURCE_TOO_LARGE");
  assert.equal(oversized.observations[0].http_status, 200);
});

test("source diagnostics distinguish fetch and body-read failures without exposing error details", async () => {
  const privateDetail = "https://untrusted.invalid/private?token=feed-error-secret";
  const failedFetch = await collectSources({ sources: [SOURCES[0]], now: NOW, fetchFn: async () => { throw new Error(privateDetail); } });
  assert.equal(failedFetch.observations[0].reason_code, "SOURCE_FETCH_ERROR");
  assert.equal(Object.hasOwn(failedFetch.observations[0], "http_status"), false);
  assert.equal(JSON.stringify(failedFetch).includes(privateDetail), false);
  const failedRead = await collectSources({ sources: [SOURCES[0]], now: NOW, fetchFn: async () => new Response(new ReadableStream({ start(controller) { controller.error(new Error(privateDetail)); } })) });
  assert.equal(failedRead.observations[0].reason_code, "SOURCE_READ_ERROR");
  assert.equal(failedRead.observations[0].http_status, 200);
  assert.equal(JSON.stringify(failedRead).includes(privateDetail), false);
});

test("source timeout diagnostics recognize an aborted signal even when fetch throws another error type", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = collectSources({
    sources: [SOURCES[0]], now: NOW,
    fetchFn: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new TypeError("private upstream detail")), { once: true });
    }),
  });
  context.mock.timers.tick(5000);
  const result = await pending;
  assert.equal(result.observations[0].reason_code, "SOURCE_TIMEOUT");
  assert.equal(Object.hasOwn(result.observations[0], "http_status"), false);
  assert.equal(JSON.stringify(result).includes("private upstream detail"), false);
});

test("scheduled runs build a verified pool with bounded concurrency and retain candidates during a source outage", async () => {
  const db = sqliteD1(); const store = new ProxyStore(db);
  let clock = NOW; let discoveryCalls = 0; let simultaneous = 0; let peak = 0;
  const candidates = Array.from({ length: 24 }, (_, index) => candidate(String(index).padStart(32, "0"), { host: `proxy${index}.example.org` }));
  const collect = async () => {
    discoveryCalls++;
    return discoveryCalls === 1 ? { candidates, observations: [{ id: "shablin", status: "ok" }] } : { candidates: [], observations: [{ id: "shablin", status: "unavailable" }] };
  };
  const probe = async () => {
    simultaneous++; peak = Math.max(peak, simultaneous);
    await new Promise(resolve => setTimeout(resolve, 1));
    simultaneous--;
    return passed;
  };
  try {
    for (let tick = 0; tick < 4; tick++) {
      clock = NOW + tick * 60_000;
      const result = await runMonitor(store, { now: () => clock, collect, probe });
      assert.equal(result.checked, tick === 0 ? 0 : 8);
      assert.equal(result.source_refresh, tick === 0);
      assert.equal((await store.snapshot()).monitor_status, tick === 0 ? "warming" : "ready");
    }
    const healthy = listSnapshot(await store.snapshot(), new URLSearchParams(), clock);
    assert.equal(healthy.counts.active, 24);
    assert.equal(healthy.proxies.length, 20);
    assert.equal(discoveryCalls, 1);
    assert.equal(peak, 3);
    clock = NOW + 3 * SOURCE_INTERVAL_MS;
    await runMonitor(store, { now: () => clock, collect, probe });
    clock += 60_000;
    await runMonitor(store, { now: () => clock, collect, probe });
    const afterOutage = listSnapshot(await store.snapshot(), new URLSearchParams("status=all"), clock);
    assert.equal(afterOutage.counts.total, 24);
    assert.equal(afterOutage.sources[0].status, "unavailable");
    assert.equal(afterOutage.counts.active, 8);
    assert.equal(afterOutage.counts.stale, 16);
    assert.equal((await store.list()).some(row => row.status === "offline"), false);
  } finally { db.close(); }
});
