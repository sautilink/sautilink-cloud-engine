/**
 * DNS tool module — live lookups via DNS-over-HTTPS (DoH).
 *
 * Cloudflare Pages Functions have no Node `dns` module.
 * All queries go to Cloudflare's public DoH endpoint using fetch().
 * No Node-only APIs. No arbitrary URL fetching. Domain-only input.
 */

import { normalizeDomain } from "../../utils/validation.js";

/** Cloudflare DNS-over-HTTPS JSON API */
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

/** Per-request timeout for DoH (ms) */
const DOH_TIMEOUT_MS = 8000;

/**
 * Supported record types and their DNS TYPE codes (RFC 1035 / extensions).
 * Add new entries here to extend lookupDns without duplicating fetch logic.
 */
export const RECORD_TYPES = {
  A: 1,
  AAAA: 28,
  CNAME: 5,
  MX: 15,
  NS: 2,
  TXT: 16,
  PTR: 12,
};

// PTR is supported for explicit reverse-DNS calls, but is not queried during
// the normal domain lookup because a PTR question for a forward domain is not useful.
export const DEFAULT_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT"];

/**
 * Strict domain preparation for DNS tools.
 * Rejects protocols, paths, queries, fragments, localhost, and private targets.
 *
 * @param {string} input
 * @returns {{ domain: string } | { error: { code: string, message: string } }}
 */
export function prepareDomain(input) {
  if (input === undefined || input === null || typeof input !== "string") {
    return {
      error: {
        code: "MISSING_DOMAIN",
        message: "Please provide a domain query parameter.",
      },
    };
  }

  const raw = input.trim();
  if (!raw) {
    return {
      error: {
        code: "MISSING_DOMAIN",
        message: "Please provide a domain query parameter.",
      },
    };
  }

  // Reject URL-shaped input (protocol, path, query, fragment, userinfo)
  if (/:\/\//.test(raw) || /[/?#@\\]/.test(raw) || /\s/.test(raw)) {
    return {
      error: {
        code: "INVALID_DOMAIN",
        message:
          "Please provide a valid domain name only (e.g. example.com). URLs and paths are not accepted.",
      },
    };
  }

  // Reject bare IPv4 / obvious private hosts before normalization
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw) || /^localhost$/i.test(raw)) {
    return {
      error: {
        code: "INVALID_DOMAIN",
        message: "Please provide a valid public domain name.",
      },
    };
  }

  const domain = normalizeDomain(raw);
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
 * Format a single DNS answer into a plain string suitable for the API.
 * @param {string} typeName
 * @param {object} answer - Cloudflare DNS JSON answer object
 * @returns {string}
 */
function formatAnswer(typeName, answer) {
  const data = answer.data;
  if (data == null) return "";

  if (typeName === "MX") {
    const parts = String(data).trim().split(/\s+/);
    if (parts.length >= 2) {
      const priority = parts[0];
      let host = parts.slice(1).join(" ").replace(/\.$/, "");
      if (!host) host = ".";
      return `${priority} ${host}`;
    }
    return String(data).replace(/\.$/, "") || ".";
  }

  if (typeName === "TXT") {
    return String(data).replace(/^"(.*)"$/, "$1");
  }

  return String(data).replace(/\.$/, "");
}

/**
 * Query one record type via DoH.
 * @param {string} domain
 * @param {string} typeName
 * @returns {Promise<{ type: string, records: string[], error?: string }>}
 */
async function queryType(domain, typeName) {
  const typeCode = RECORD_TYPES[typeName];
  if (typeCode == null) {
    return { type: typeName, records: [], error: "unsupported_type" };
  }

  const url = new URL(DOH_ENDPOINT);
  url.searchParams.set("name", domain);
  url.searchParams.set("type", String(typeCode));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/dns-json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return { type: typeName, records: [], error: "upstream_http" };
    }

    let body;
    try {
      body = await res.json();
    } catch {
      return { type: typeName, records: [], error: "upstream_parse" };
    }

    const answers = Array.isArray(body.Answer) ? body.Answer : [];
    const records = answers
      .filter((a) => a && (a.type === typeCode || a.type === Number(typeCode)))
      .map((a) => formatAnswer(typeName, a))
      .filter(Boolean);

    const seen = new Set();
    const unique = [];
    for (const r of records) {
      if (!seen.has(r)) {
        seen.add(r);
        unique.push(r);
      }
    }

    return { type: typeName, records: unique };
  } catch (err) {
    if (err && err.name === "AbortError") {
      return { type: typeName, records: [], error: "timeout" };
    }
    return { type: typeName, records: [], error: "upstream_network" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up DNS records for a domain across the requested types.
 * Parallel DoH queries; never throws for empty results.
 *
 * @param {string} domain - already validated/normalized
 * @param {string[]} [types]
 * @returns {Promise<{ domain: string, records: Record<string, string[]> }>}
 * @throws {{ code: string, message: string }} structured failure when resolver is unavailable
 */
export async function lookupDns(domain, types = DEFAULT_TYPES) {
  const requested = types.filter((t) => RECORD_TYPES[t] != null);
  if (requested.length === 0) {
    throw {
      code: "INVALID_TYPE",
      message: "No supported DNS record types requested.",
    };
  }

  const results = await Promise.all(
    requested.map((typeName) => queryType(domain, typeName))
  );

  const records = {};
  for (const t of requested) {
    records[t] = [];
  }

  let hardFailures = 0;
  for (const result of results) {
    records[result.type] = result.records;
    if (
      result.error === "timeout" ||
      result.error === "upstream_network" ||
      result.error === "upstream_http"
    ) {
      hardFailures += 1;
    }
  }

  if (hardFailures === results.length) {
    throw {
      code: "DNS_RESOLVER_ERROR",
      message: "Unable to reach the DNS resolver. Please try again shortly.",
    };
  }

  return {
    domain,
    records,
  };
}
