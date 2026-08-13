/**
 * GET /api/dns?domain=example.com
 * DNS lookup via DNS-over-HTTPS. Pages Function only — no Node DNS APIs.
 */

import { prepareDomain, lookupDns, DEFAULT_TYPES } from "../../src/tools/dns/index.js";
import { success, error, corsPreflight } from "../../src/utils/response.js";

export async function onRequestOptions() {
  return corsPreflight();
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const domainParam = url.searchParams.get("domain");

    const prepared = prepareDomain(domainParam);
    if (prepared.error) {
      const status =
        prepared.error.code === "MISSING_DOMAIN" ? 400 : 400;
      return error(prepared.error.code, prepared.error.message, status);
    }

    const data = await lookupDns(prepared.domain, DEFAULT_TYPES);
    return success(data, 200);
  } catch (err) {
    // Structured tool errors
    if (err && typeof err === "object" && err.code && err.message) {
      const status = err.code === "DNS_RESOLVER_ERROR" ? 502 : 400;
      return error(err.code, err.message, status);
    }

    // Never leak stack traces
    return error(
      "INTERNAL_ERROR",
      "An unexpected error occurred while looking up DNS records.",
      500
    );
  }
}
