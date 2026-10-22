import { collectSources } from "./sources.js";
import { resolveProxyHost } from "./dns.js";
import { probeProxy } from "./protocol/index.js";
import { createSnapshot, observeCandidate, selectDueCandidates } from "./model.js";
import { SOURCE_INTERVAL_MS, MAX_CHECKS_PER_RUN, PROBE_TIMEOUT_MS, boundedInteger } from "./config.js";

export async function runMonitor(store, { connect, fetchFn = fetch, now = Date.now, probe = probeProxy, collect = collectSources, maxChecks = MAX_CHECKS_PER_RUN, checkLocation = "Cloudflare monitoring network" } = {}) {
  const started = now();
  const token = crypto.randomUUID();
  const metadata = await store.acquire(started, token);
  if (!metadata) return { skipped: true, reason: "already_running" };
  try {
    let sources = [];
    try { sources = JSON.parse(metadata.sources || "[]"); } catch { /* Empty source status is honest. */ }
    let sourceRefreshAt = metadata.source_refresh_at || 0;
    let refreshedSources = false;
    if (!sourceRefreshAt || started - sourceRefreshAt >= SOURCE_INTERVAL_MS) {
      const discovered = await collect({ fetchFn, now: started });
      sources = await store.importCandidates(discovered.candidates, discovered.observations, now(), sources, token);
      refreshedSources = true;
      // Retry failed discovery sooner; retain previously checked endpoints.
      sourceRefreshAt = discovered.candidates.length ? started : started - SOURCE_INTERVAL_MS + 300_000;
    }
    const candidates = await store.list();
    // Discovery and handshakes run on separate ticks to keep per-invocation CPU bounded.
    const selected = refreshedSources ? [] : selectDueCandidates(candidates, now(), boundedInteger(maxChecks, MAX_CHECKS_PER_RUN, 1, 16));
    const observed = [];
    let index = 0;
    async function work() {
      while (index < selected.length) {
        const row = selected[index++];
        if (now() - started > 55_000) break;
        let observation;
        try {
          observation = await probe(row, { connect, resolveHost: (host, options) => resolveProxyHost(host, { fetchFn, ...options }), timeoutMs: PROBE_TIMEOUT_MS, now });
        } catch {
          observation = { status: "unverified", reason_code: "CHECKER_ERROR", check_level: "none" };
        }
        observed.push(observeCandidate(row, { ...observation, check_location: checkLocation }, now()));
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, selected.length) }, work));
    await store.saveObservations(observed, token, now());
    const completed = now();
    const snapshot = createSnapshot(observed.length ? await store.list() : candidates, sources, completed);
    await store.publish(snapshot, sources, sourceRefreshAt, token, completed);
    return { checked: observed.length, active: snapshot.proxies.filter(row => row.status === "active").length, candidates: snapshot.proxies.length, source_refresh: refreshedSources, duration_ms: completed - started };
  } catch (error) {
    await store.release(token, "MONITOR_RUN_FAILED").catch(() => {});
    throw error;
  }
}
