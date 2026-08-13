/**
 * Shared security constants for API responses and static assets.
 *
 * CORS: public, unauthenticated endpoints currently allow a controlled
 * origin set (production + local Wrangler). Wildcard is intentionally
 * avoided so future authenticated APIs can tighten further without a
 * breaking policy change. Same-origin browser calls need no CORS.
 *
 * Rate limiting: application code does NOT implement global rate limits.
 * Cloudflare Pages Functions are isolated; an in-memory Map would not be
 * consistent across the edge. Use Cloudflare dashboard Rate Limiting
 * (or WAF custom rules) for production-wide enforcement. See docs/SECURITY.md.
 */

/** Production origin */
export const PRODUCTION_ORIGIN = "https://cloudengine.sautilink.com";

/** Allowed origins for CORS (browser cross-origin). */
export const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  "http://localhost:8788",
  "http://localhost:8787",
  "http://localhost:3000",
  "http://127.0.0.1:8788",
  "http://127.0.0.1:8787",
  "http://127.0.0.1:3000",
]);

/**
 * Resolve Access-Control-Allow-Origin for a request.
 * Returns the request Origin if allowed, otherwise null (omit header).
 * @param {Request} request
 * @returns {string|null}
 */
export function resolveCorsOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  return null;
}

/** Baseline security headers for API JSON responses. */
export const API_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * Request size / shape limits (application-level abuse guards).
 * These are not a substitute for edge rate limiting.
 */
export const LIMITS = {
  /** Maximum full request URL length (chars) */
  MAX_URL_LENGTH: 2048,
  /** Maximum single query parameter value length (allows full target URLs) */
  MAX_QUERY_VALUE_LENGTH: 2048,
  /** Maximum domain label string after trim (RFC-ish) */
  MAX_DOMAIN_LENGTH: 253,
};

/** Short cache for successful DNS lookups (seconds). Errors stay no-store. */
export const DNS_SUCCESS_CACHE_SECONDS = 30;
