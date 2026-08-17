/**
 * GET /api/rdns?ip=PUBLIC_IP
 * Public IPv4/IPv6 PTR lookup through the shared DNS engine.
 */

import { reverseDnsLookup } from "../../src/tools/infrastructure/ip.js";
import { success, error, corsPreflight, methodNotAllowed } from "../../src/utils/response.js";
import { getRequestId, guardRequestSize } from "../../src/utils/request.js";
import { DNS_SUCCESS_CACHE_SECONDS } from "../../src/utils/security.js";

const ALLOWED = ["GET", "OPTIONS"];

export async function onRequest(context) {
  const { request } = context;
  const requestId = getRequestId(request);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return corsPreflight(request);
  if (method !== "GET") return methodNotAllowed(ALLOWED, { request, requestId });

  try {
    const sizeGuard = guardRequestSize(request);
    if (!sizeGuard.ok) return error(sizeGuard.code, sizeGuard.message, 400, { request, requestId });

    const url = new URL(request.url);
    const data = await reverseDnsLookup(url.searchParams.get("ip"));
    return success(data, 200, {
      request,
      requestId,
      cacheControl: `public, max-age=${DNS_SUCCESS_CACHE_SECONDS}`,
    });
  } catch (err) {
    if (err && typeof err === "object" && err.code && err.message) {
      const status =
        err.code === "DNS_RESOLVER_ERROR" ? 502 : err.code === "DNS_TIMEOUT" ? 504 : 400;
      return error(err.code, err.message, status, { request, requestId });
    }
    return error("INTERNAL_ERROR", "An unexpected error occurred while checking reverse DNS.", 500, { request, requestId });
  }
}
