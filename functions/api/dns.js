/**
 * GET /api/dns?domain=example.com
 * DNS lookup via DNS-over-HTTPS. Pages Function only — no Node DNS APIs.
 */

import { prepareDomain, lookupDns, DEFAULT_TYPES } from "../../src/tools/dns/index.js";
import {
  success,
  error,
  corsPreflight,
  methodNotAllowed,
} from "../../src/utils/response.js";
import { getRequestId, guardRequestSize } from "../../src/utils/request.js";
import { DNS_SUCCESS_CACHE_SECONDS } from "../../src/utils/security.js";

const ALLOWED = ["GET", "OPTIONS"];

export async function onRequest(context) {
  const { request } = context;
  const requestId = getRequestId(request);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return corsPreflight(request);
  }

  if (method !== "GET") {
    return methodNotAllowed(ALLOWED, { request, requestId });
  }

  try {
    const sizeGuard = guardRequestSize(request);
    if (!sizeGuard.ok) {
      return error(sizeGuard.code, sizeGuard.message, 400, {
        request,
        requestId,
      });
    }

    const url = new URL(request.url);
    const domainParam = url.searchParams.get("domain");

    const prepared = prepareDomain(domainParam);
    if (prepared.error) {
      return error(prepared.error.code, prepared.error.message, 400, {
        request,
        requestId,
      });
    }

    const data = await lookupDns(prepared.domain, DEFAULT_TYPES);
    return success(data, 200, {
      request,
      requestId,
      cacheControl: `public, max-age=${DNS_SUCCESS_CACHE_SECONDS}`,
    });
  } catch (err) {
    if (err && typeof err === "object" && err.code && err.message) {
      const status = err.code === "DNS_RESOLVER_ERROR" ? 502 : 400;
      return error(err.code, err.message, status, { request, requestId });
    }

    return error(
      "INTERNAL_ERROR",
      "An unexpected error occurred while looking up DNS records.",
      500,
      { request, requestId }
    );
  }
}
