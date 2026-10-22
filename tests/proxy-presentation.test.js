import test from "node:test";
import assert from "node:assert/strict";
import { publicDirectoryView } from "../src/proxy/presentation.js";
import { createSnapshot, listSnapshot } from "../src/proxy/model.js";
import { onRequest } from "../functions/api/proxies.js";

const NOW = Date.parse("2026-10-22T15:00:00Z");
const sources = [
  { id: "upstream-one", name: "Upstream One", url: "https://example.org/feed-one", status: "ok", last_fetched_at: new Date(NOW).toISOString() },
  { id: "upstream-two", name: "Upstream Two", url: "https://example.org/feed-two", status: "unavailable", last_fetched_at: new Date(NOW - 60_000).toISOString(), reason_code: "SOURCE_TIMEOUT" },
];
const row = {
  id: "verified", host: "proxy.example.net", port: 443,
  secret: "1234567890abcdef1234567890abcdef", transport: "classic", source_id: "shablin",
  status: "active", checked_at: NOW, success_at: NOW, checks: 1, successes: 1,
  latency_ms: 50, reason_code: "MT_PROTO_RESPONSE", history: "[]",
};

test("public views retain connection results and aggregate health without feed attribution", () => {
  const stored = createSnapshot([row], sources, NOW);
  assert.deepEqual(stored.sources, sources, "Provenance remains available for monitor operations");
  const view = listSnapshot(stored, new URLSearchParams(), NOW);
  assert.equal(view.counts.active, 1);
  assert.equal(view.proxies[0].operator, "community");
  assert.equal(view.proxies[0].connect_url, stored.proxies[0].connect_url);
  assert.deepEqual(view.discovery, { feeds: 2, available: 1, last_fetched_at: new Date(NOW).toISOString() });
  assert.equal("sources" in view, false);
  assert.equal("source" in view.proxies[0], false);
  assert.doesNotMatch(JSON.stringify(view), /Upstream|upstream-|feed-one|feed-two|shablin|github\.com/);
  assert.deepEqual(publicDirectoryView(view), view, "The Pages boundary can safely project an already public view");
  assert.equal(stored.proxies[0].source.name, "shablin/mtproto-proxy", "Stored data is not mutated");
});

test("Pages removes attribution from an older Worker without paginating its response twice", async () => {
  const stored = createSnapshot([row], sources, NOW);
  const legacy = {
    ...listSnapshot(stored, new URLSearchParams(), NOW),
    sources,
    proxies: stored.proxies,
    page: 2, per_page: 5, total_pages: 3, total: 11,
  };
  const response = await onRequest({
    request: new Request("https://cloudengine.sautilink.com/api/proxies?page=2&per_page=5"),
    env: { PROXY_DIRECTORY: { fetch: async () => Response.json({ success: true, data: legacy }) } },
  });
  const { data } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(data.page, 2);
  assert.equal(data.total_pages, 3);
  assert.equal(data.proxies.length, 1);
  assert.equal(data.proxies[0].connect_url, stored.proxies[0].connect_url);
  assert.equal("sources" in data, false);
  assert.equal("source" in data.proxies[0], false);
  assert.doesNotMatch(JSON.stringify(data), /Upstream|upstream-|feed-one|feed-two|shablin|github\.com/);
});
