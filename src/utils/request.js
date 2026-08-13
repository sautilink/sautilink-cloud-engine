/**
 * Request helpers: IDs, method checks, and basic abuse guards.
 */

import { LIMITS } from "./security.js";

/**
 * Generate or echo a request ID.
 * Uses crypto.randomUUID() when available (Workers / modern runtimes).
 * @param {Request} request
 * @returns {string}
 */
export function getRequestId(request) {
  const incoming =
    request.headers.get("X-Request-Id") ||
    request.headers.get("X-Request-ID");
  if (incoming && /^[\w\-]{8,64}$/.test(incoming.trim())) {
    return incoming.trim();
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reject oversized URLs / query values early.
 * @param {Request} request
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function guardRequestSize(request) {
  const url = request.url || "";
  if (url.length > LIMITS.MAX_URL_LENGTH) {
    return {
      ok: false,
      code: "REQUEST_TOO_LARGE",
      message: "Request URL exceeds the maximum allowed length.",
    };
  }

  try {
    const parsed = new URL(url);
    for (const [, value] of parsed.searchParams) {
      if (value != null && value.length > LIMITS.MAX_QUERY_VALUE_LENGTH) {
        return {
          ok: false,
          code: "REQUEST_TOO_LARGE",
          message: "A query parameter exceeds the maximum allowed length.",
        };
      }
    }
  } catch {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "Malformed request URL.",
    };
  }

  return { ok: true };
}

/**
 * @param {string} method
 * @param {string[]} allowed
 * @returns {boolean}
 */
export function isMethodAllowed(method, allowed) {
  return allowed.includes(String(method || "").toUpperCase());
}
