#!/usr/bin/env node
/** Build both production entry points, then exercise their service binding and D1 locally. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { ProxyStore } from "../src/proxy/store.js";
import { createSnapshot, observeCandidate } from "../src/proxy/model.js";
import { SOURCES } from "../src/proxy/config.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "sautilink-proxy-runtime-"));
const wrangler = join(root, "node_modules/wrangler/bin/wrangler.js");
function build(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: root, encoding: "utf8", timeout: 60_000,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: join(temporary, "wrangler.log") },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
}

const network = new MockAgent();
network.disableNetConnect();
network.enableNetConnect(host => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host));
const previous = getGlobalDispatcher();
let runtime;
try {
  build(["deploy", "--config", "wrangler.proxy.jsonc", "--dry-run", "--outdir", join(temporary, "directory")]);
  build(["pages", "functions", "build", "functions", "--outdir", join(temporary, "pages"), "--project-directory", root]);
  setGlobalDispatcher(network);
  const noExternalFetch = async () => { throw new Error("External requests are disabled in the runtime fixture"); };
  let feedStatus = 200;
  const sourceRequests = [];
  const fixtureFeeds = new Map(SOURCES.map((source, sourceIndex) => [source.feed, Array.from({ length: 2 }, (_, index) =>
    `https://t.me/proxy?server=source${sourceIndex}-proxy${index}.example.org&port=443&secret=1234567890abcdef1234567890abcdef`
  ).join("\n")]));
  const fixtureSourceFetch = async request => {
    sourceRequests.push({ url: request.url, method: request.method,
      accept: request.headers.get("accept"), userAgent: request.headers.get("user-agent"), aborted: request.signal.aborted });
    assert.ok(fixtureFeeds.has(request.url), `Unexpected fixture request: ${request.url}`);
    if (feedStatus !== 200) return new Response(null, { status: feedStatus, headers: { Location: "https://redirect-target.invalid/not-permitted" } });
    return new Response(fixtureFeeds.get(request.url), { headers: { "Content-Type": "text/plain" } });
  };
  runtime = new Miniflare(convertV4MiniflareOptions({
    workers: [
      {
        name: "pages", modules: true, rootPath: temporary, modulesRoot: temporary, scriptPath: join(temporary, "pages/index.js"),
        compatibilityDate: "2024-09-23", serviceBindings: { PROXY_DIRECTORY: "directory" },
        outboundService: noExternalFetch,
      },
      {
        name: "directory", modules: true, rootPath: temporary, modulesRoot: temporary, scriptPath: join(temporary, "directory/proxy.js"),
        compatibilityDate: "2026-10-21", compatibilityFlags: ["nodejs_compat"],
        d1Databases: { PROXY_DB: "local-proxy-fixture" }, outboundService: fixtureSourceFetch,
      },
    ],
  }));
  const db = await runtime.getD1Database("PROXY_DB", "directory");
  const migration = await readFile(join(root, "migrations/proxy/0001_proxy_directory.sql"), "utf8");
  await db.batch(migration.split(";").map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  const store = new ProxyStore(db);
  const now = Date.now();
  await store.acquire(now, "local-fixture");
  const candidates = Array.from({ length: 24 }, (_, index) => ({
    id: String(index).padStart(32, "0"), host: `proxy${index}.example.org`, port: 443,
    secret: "1234567890abcdef1234567890abcdef", transport: "classic", source_id: "shablin", source_seen_at: now,
  }));
  await store.importCandidates(candidates, [], now, [], "local-fixture");
  const rows = await store.list();
  const observed = rows.map((row, index) => observeCandidate(row, { status: "active", check_level: "mtproto", latency_ms: 10 + index }, index === 0 ? now - 598_000 : now));
  await store.saveObservations(observed, "local-fixture", now);
  await store.publish(createSnapshot(await store.list(), [], now), [], now, "local-fixture", now);

  const response = await runtime.dispatchFetch("https://fixture.invalid/api/proxies?per_page=5&page=2");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const payload = await response.json();
  assert.equal(payload.data.counts.active, 24);
  assert.equal(payload.data.page, 2);
  assert.equal(payload.data.proxies.length, 5);
  assert.equal(payload.data.proxies[0].latency_ms, 15);
  assert.ok(payload.data.proxies.every(row => row.connect_url?.startsWith("https://t.me/proxy?")));
  assert.ok(payload.data.proxies.every(row => !("secret" in row)));
  assert.equal((await runtime.dispatchFetch("https://fixture.invalid/api/proxies", { method: "POST" })).status, 405);

  // The Worker still has the same raw snapshot in its 15-second cache.
  // A row that expires meanwhile must lose Connect on the very next read.
  await delay(Math.max(0, now + 2100 - Date.now()));
  const expired = await (await runtime.dispatchFetch("https://fixture.invalid/api/proxies?status=all&per_page=100")).json();
  assert.equal(expired.data.counts.active, 23);
  assert.equal(expired.data.counts.stale, 1);
  assert.equal(expired.data.proxies.find(row => row.id === candidates[0].id).connect_url, null);
  console.log("PASS: production Worker + Pages bundles, service binding, actual local D1 migration/import/write, pagination, no-store, and freshness during cached reads.");

  // Exercise the actual scheduled handler and native Workerd fetch, not a Node
  // fetchFn mock. Unsupported Request options must fail this integration check.
  const directory = await runtime.getWorker("directory");
  for (const status of [200, 302, 307]) {
    feedStatus = status;
    sourceRequests.length = 0;
    await db.batch([
      db.prepare("DELETE FROM proxy_candidates"),
      db.prepare("DELETE FROM proxy_snapshots"),
      db.prepare("UPDATE proxy_monitor SET lease_token = NULL, lease_until = 0, source_refresh_at = 0, last_run_at = NULL, last_error_code = NULL, sources = '[]' WHERE id = 1"),
    ]);
    const scheduled = await directory.scheduled({ cron: "* * * * *", scheduledTime: new Date() });
    assert.equal(scheduled.outcome, "ok");
    const snapshot = await store.snapshot();
    assert.ok(snapshot, "Scheduled discovery must publish to the actual local D1 database");
    assert.equal(sourceRequests.length, SOURCES.length, "Only the fixed feeds may be requested; redirects must not be followed");
    assert.deepEqual(sourceRequests.map(request => request.url), SOURCES.map(source => source.feed));
    // Miniflare serializes a new Request for this callback. Verify redirect
    // behavior through the 302/307 responses rather than that Request's mode.
    assert.ok(sourceRequests.every(request => request.method === "GET" && !request.aborted));
    assert.ok(sourceRequests.every(request => request.accept === "text/plain" && request.userAgent === "SautiLink-Cloud-Engine-Proxy-Monitor/1.0"));
    assert.equal(snapshot.sources.length, SOURCES.length);
    const directoryView = await (await runtime.dispatchFetch("https://fixture.invalid/api/proxies?status=all&per_page=100")).json();
    assert.equal(directoryView.data.counts.active, 0, "Discovery must not fabricate protocol verification");
    if (status === 200) {
      assert.ok(snapshot.sources.every(source => source.status === "ok" && source.candidate_count === 2));
      assert.equal((await store.list()).length, 4);
      assert.equal(directoryView.data.counts.unverified, 4);
      assert.ok(directoryView.data.proxies.every(row => row.connect_url === null));
    } else {
      assert.ok(snapshot.sources.every(source => source.status === "unavailable" && source.reason_code === "SOURCE_HTTP_ERROR" && source.http_status === status));
      assert.equal((await store.list()).length, 0);
      assert.equal(directoryView.data.counts.total, 0);
    }
  }
  console.log("PASS: production scheduled discovery reaches fixture feeds through native Workerd fetch, persists candidates in local D1, and rejects 302/307 without following redirects.");
  console.log("Fixture endpoints only; no public proxy or Telegram account was contacted.");
} finally {
  await runtime?.dispose();
  setGlobalDispatcher(previous);
  await network.close();
  await rm(temporary, { recursive: true, force: true });
}
