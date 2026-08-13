/**
 * DNS tool module (foundation only).
 *
 * Cloudflare Workers / Pages Functions do not provide a native DNS resolver
 * equivalent to Node's `dns` module. Direct DNS queries from the edge require
 * either:
 *   1. An external DNS-over-HTTPS (DoH) provider (e.g. Cloudflare DNS, Google),
 *   2. Or a future Workers-compatible DNS binding / service.
 *
 * This module defines the interface and helpers. Real lookups will be added
 * in Phase 2 once a compatible DoH approach is chosen and rate limits are
 * defined. No fake results are returned.
 */

import { normalizeDomain } from "../../utils/validation.js";

/**
 * Validate and prepare a domain for DNS tools.
 * @param {string} input
 * @returns {{ domain: string } | { error: { code: string, message: string } }}
 */
export function prepareDomain(input) {
  const domain = normalizeDomain(input);
  if (!domain) {
    return {
      error: {
        code: "INVALID_DOMAIN",
        message: "Please provide a valid domain.",
      },
    };
  }
  return { domain };
}

/**
 * Placeholder for future DNS lookup implementation.
 * @param {string} domain
 * @param {string[]} [types]
 * @returns {Promise<object>}
 */
export async function lookupDns(_domain, _types = ["A", "AAAA", "MX", "NS", "TXT"]) {
  throw new Error(
    "DNS lookup is not yet implemented. See docs/ARCHITECTURE.md for the recommended DoH approach."
  );
}
