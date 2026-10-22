/** A fast, read-only view of the background monitor. Never initiates a probe. */
import { success, error, corsPreflight, methodNotAllowed } from "../../src/utils/response.js";
import { getRequestId, guardRequestSize } from "../../src/utils/request.js";
import { emptySnapshot, listSnapshot } from "../../src/proxy/model.js";
import { publicDirectoryView } from "../../src/proxy/presentation.js";

export async function onRequest({ request, env = {} }) {
  const requestId = getRequestId(request);
  const options = { request, requestId };
  if (request.method === "OPTIONS") return corsPreflight(request);
  if (request.method !== "GET") return methodNotAllowed(["GET", "OPTIONS"], options);
  const guard = guardRequestSize(request);
  if (!guard.ok) return error(guard.code, guard.message, 400, options);
  const input = new URL(request.url);
  if (!env.PROXY_DIRECTORY?.fetch) return success(listSnapshot(emptySnapshot("unavailable"), input.searchParams), 200, options);
  const upstream = new URL("https://proxy-directory.internal/v1/proxies");
  for (const key of ["status", "page", "per_page", "sort", "id"]) {
    const value = input.searchParams.get(key);
    if (value && value.length <= 64) upstream.searchParams.set(key, value);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await env.PROXY_DIRECTORY.fetch(new Request(upstream, { headers: { Accept: "application/json" }, signal: controller.signal }));
    if (!response.ok) throw new Error("unavailable");
    const payload = await response.json();
    if (payload?.success !== true || payload.data?.schema_version !== 1 || !Array.isArray(payload.data.proxies)) throw new Error("invalid_snapshot");
    // Service response has already been paginated; do not paginate it twice.
    // Also remove provenance from an older checker during a rolling deploy.
    const data = publicDirectoryView(payload.data);
    return success(data, 200, { ...options, cacheControl: "no-store" });
  } catch {
    return error("PROXY_DIRECTORY_UNAVAILABLE", "Proxy status is temporarily unavailable. Please try again shortly.", 503, options);
  } finally { clearTimeout(timeout); }
}
