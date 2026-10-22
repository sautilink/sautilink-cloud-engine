import { connect } from "cloudflare:sockets";
import { ProxyStore } from "../src/proxy/store.js";
import { emptySnapshot, listSnapshot } from "../src/proxy/model.js";
import { runMonitor } from "../src/proxy/monitor.js";

let cachedSnapshot = null;
let cachedAt = 0;
let cachedDatabase = null;

function json(body, status = 200, cacheSeconds = 0) {
  return Response.json(body, { status, headers: {
    "Cache-Control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    if (url.pathname !== "/v1/proxies" && url.pathname !== "/health") return new Response("Not found", { status: 404 });
    if (!env.PROXY_DB) return json({ success: true, data: listSnapshot(emptySnapshot("unavailable"), url.searchParams) }, 503);
    try {
      const now = Date.now();
      if (!cachedSnapshot || cachedDatabase !== env.PROXY_DB || now - cachedAt >= 15_000) {
        cachedSnapshot = await new ProxyStore(env.PROXY_DB).snapshot();
        cachedAt = now;
        cachedDatabase = env.PROXY_DB;
      }
      const data = listSnapshot(cachedSnapshot, url.searchParams, now);
      if (url.pathname === "/health") return json({ ok: data.monitor_status === "ready", monitor_status: data.monitor_status, generated_at: data.generated_at, expires_at: data.expires_at, counts: data.counts });
      // Only the raw stored snapshot is cached. Recompute freshness on every GET.
      const response = json({ success: true, data });
      return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
    } catch {
      return json({ success: false, error: { code: "PROXY_DIRECTORY_UNAVAILABLE", message: "Proxy status is temporarily unavailable." } }, 503);
    }
  },

  async scheduled(controller, env, ctx) {
    if (!env.PROXY_DB) { console.error(JSON.stringify({ event: "proxy_monitor", error_code: "STORAGE_NOT_CONFIGURED" })); return; }
    ctx.waitUntil(runMonitor(new ProxyStore(env.PROXY_DB), { connect, maxChecks: env.PROXY_MAX_CHECKS_PER_RUN })
      .then(result => {
        cachedSnapshot = null;
        console.log(JSON.stringify({ event: "proxy_monitor", ...result }));
      })
      .catch(() => console.error(JSON.stringify({ event: "proxy_monitor", error_code: "MONITOR_RUN_FAILED" }))));
  },
};
