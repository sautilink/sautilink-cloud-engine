/**
 * SSRF guards for outbound HTTP checks.
 *
 * Strategy:
 * 1. Block dangerous hostnames and IP literals at parse time.
 * 2. Resolve hostnames via Cloudflare DoH and reject private/reserved answers.
 * 3. Re-validate every redirect target the same way.
 *
 * Limitation: between DoH resolution and fetch there is a TOCTOU window
 * (DNS rebinding). Cloudflare's fetch API does not expose a way to pin the
 * connection to the resolved address from application code. This is documented
 * in docs/SECURITY.md — protection is strong but not absolute against rebinding.
 */

import { isBlockedIpLiteral, isIPv4Literal } from "../../utils/ip.js";

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const DOH_TIMEOUT_MS = 5000;

/** Hostnames blocked without DNS (metadata / internal). */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google",
  "metadata",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".corp",
  ".home",
  ".lan",
];

/**
 * Hostname-level block (no DNS yet).
 * @param {string} hostname
 * @returns {{ blocked: true, code: string, message: string } | { blocked: false }}
 */
export function checkHostnameBlocked(hostname) {
  let host = String(hostname || "").toLowerCase().trim();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }

  if (!host) {
    return {
      blocked: true,
      code: "INVALID_URL",
      message: "URL is missing a hostname.",
    };
  }

  if (BLOCKED_HOSTNAMES.has(host)) {
    return {
      blocked: true,
      code: "SSRF_BLOCKED",
      message: "Requests to this host are not allowed.",
    };
  }

  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (host.endsWith(suffix)) {
      return {
        blocked: true,
        code: "SSRF_BLOCKED",
        message: "Requests to internal hostnames are not allowed.",
      };
    }
  }

  if (isBlockedIpLiteral(host)) {
    return {
      blocked: true,
      code: "PRIVATE_ADDRESS_BLOCKED",
      message: "Requests to private or reserved IP addresses are not allowed.",
    };
  }

  return { blocked: false };
}

/**
 * Resolve A/AAAA via DoH and ensure all answers are public.
 * @param {string} hostname
 * @returns {Promise<{ ok: true, addresses: string[] } | { ok: false, code: string, message: string }>}
 */
export async function assertPublicDns(hostname) {
  let host = hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);

  // IP literals already checked in checkHostnameBlocked
  if (isIPv4Literal(host) || host.includes(":")) {
    if (isBlockedIpLiteral(host)) {
      return {
        ok: false,
        code: "PRIVATE_ADDRESS_BLOCKED",
        message: "Requests to private or reserved IP addresses are not allowed.",
      };
    }
    return { ok: true, addresses: [host] };
  }

  const addresses = [];
  const types = [
    { name: "A", code: 1 },
    { name: "AAAA", code: 28 },
  ];

  for (const t of types) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOH_TIMEOUT_MS);
    try {
      const u = new URL(DOH_ENDPOINT);
      u.searchParams.set("name", host);
      u.searchParams.set("type", String(t.code));
      const res = await fetch(u.toString(), {
        method: "GET",
        headers: { Accept: "application/dns-json" },
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const body = await res.json();
      const answers = Array.isArray(body.Answer) ? body.Answer : [];
      for (const a of answers) {
        if (a && a.type === t.code && typeof a.data === "string") {
          const data = a.data.replace(/\.$/, "");
          addresses.push(data);
          if (isBlockedIpLiteral(data)) {
            return {
              ok: false,
              code: "PRIVATE_ADDRESS_BLOCKED",
              message:
                "Hostname resolves to a private or reserved address and cannot be checked.",
            };
          }
        }
      }
    } catch (err) {
      if (err && err.name === "AbortError") {
        return {
          ok: false,
          code: "UPSTREAM_DNS_ERROR",
          message: "DNS resolution timed out for this host.",
        };
      }
      // Continue; may still have other record types
    } finally {
      clearTimeout(timer);
    }
  }

  // No answers is not necessarily private — target may still fail at fetch
  // (NXDOMAIN). Allow fetch to surface UPSTREAM_DNS_ERROR / connection error.
  return { ok: true, addresses };
}

/**
 * Full pre-request SSRF gate for a URL instance.
 * @param {URL} url
 * @returns {Promise<{ ok: true } | { ok: false, code: string, message: string }>}
 */
export async function assertUrlSafeToFetch(url) {
  const hostCheck = checkHostnameBlocked(url.hostname);
  if (hostCheck.blocked) {
    return { ok: false, code: hostCheck.code, message: hostCheck.message };
  }

  const dns = await assertPublicDns(url.hostname);
  if (!dns.ok) return dns;

  return { ok: true };
}
