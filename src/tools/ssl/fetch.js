/**
 * Observable HTTPS probes via fetch only.
 *
 * Cloudflare Pages Functions does NOT expose outbound TLS certificate fields,
 * TLS version, or cipher suite on the Response object. This module only collects
 * what Web fetch can observe: protocol, status, redirects, and response headers.
 */

import { assertUrlSafeToFetch } from "../http-status/ssrf.js";
import { headersToSafeObject } from "../http-status/fetch.js";
import { REQUEST_TIMEOUT_MS, MAX_REDIRECTS, MAX_BODY_BYTES } from "./limits.js";

const USER_AGENT =
  "SautiLinkCloudEngine/1.0 (+https://cloudengine.sautilink.com)";

/**
 * HEAD preferred, GET fallback; follows redirects manually with SSRF on each hop.
 * @param {URL} startUrl
 * @param {{ deadlineAt?: number }} [opts]
 */
export async function probeUrl(startUrl, opts = {}) {
  const redirectChain = [];
  let current = new URL(startUrl.toString());
  let redirectCount = 0;
  const started = performance.now();

  const remaining = opts.deadlineAt
    ? Math.max(500, opts.deadlineAt - Date.now())
    : REQUEST_TIMEOUT_MS;
  const timeoutMs = Math.min(REQUEST_TIMEOUT_MS, remaining);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (opts.deadlineAt != null && Date.now() >= opts.deadlineAt) {
        throw {
          code: "REQUEST_TIMEOUT",
          message: "The HTTPS probe timed out.",
          httpStatus: 504,
        };
      }

      const safe = await assertUrlSafeToFetch(current);
      if (!safe.ok) {
        throw {
          code: safe.code,
          message: safe.message,
          httpStatus:
            safe.code === "PRIVATE_ADDRESS_BLOCKED" ||
            safe.code === "SSRF_BLOCKED"
              ? 403
              : 400,
        };
      }

      let res;
      try {
        res = await fetch(current.toString(), {
          method: "HEAD",
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
        });
        if (res.status === 405 || res.status === 501) {
          res = await fetch(current.toString(), {
            method: "GET",
            redirect: "manual",
            signal: controller.signal,
            headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
          });
        }
      } catch (err) {
        if (err && err.name === "AbortError") {
          throw {
            code: "REQUEST_TIMEOUT",
            message: "The request timed out.",
            httpStatus: 504,
          };
        }
        // Connection refused / TLS handshake failure surfaces as TypeError in Workers
        throw {
          code: "UPSTREAM_CONNECTION_ERROR",
          message:
            "Could not complete a connection to the target (network or TLS failure).",
          httpStatus: 502,
          protocolAttempt: current.protocol,
        };
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) {
          return finalize(startUrl, current, res, redirectChain, redirectCount, started);
        }
        if (redirectCount >= MAX_REDIRECTS) {
          throw {
            code: "REDIRECT_LIMIT",
            message: `Too many redirects (maximum ${MAX_REDIRECTS}).`,
            httpStatus: 400,
          };
        }
        let next;
        try {
          next = new URL(loc, current);
        } catch {
          throw {
            code: "INVALID_URL",
            message: "Redirect target was not a valid URL.",
            httpStatus: 400,
          };
        }
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          throw {
            code: "UNSUPPORTED_PROTOCOL",
            message: "Redirect target uses an unsupported protocol.",
            httpStatus: 400,
          };
        }
        if (next.username || next.password) {
          throw {
            code: "CREDENTIALS_NOT_ALLOWED",
            message: "Redirect target must not contain credentials.",
            httpStatus: 400,
          };
        }
        redirectChain.push({
          from: current.toString(),
          to: next.toString(),
          status: res.status,
          fromProtocol: current.protocol,
          toProtocol: next.protocol,
        });
        redirectCount += 1;
        current = next;
        continue;
      }

      // Drain body if any (GET fallback) within small cap
      if (res.body) {
        try {
          const reader = res.body.getReader();
          let total = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value ? value.byteLength : 0;
            if (total > MAX_BODY_BYTES) {
              try {
                await reader.cancel();
              } catch {
                /* ignore */
              }
              break;
            }
          }
        } catch {
          /* ignore */
        }
      }

      return finalize(startUrl, current, res, redirectChain, redirectCount, started);
    }
  } finally {
    clearTimeout(timer);
  }
}

function finalize(startUrl, current, res, redirectChain, redirectCount, started) {
  const headers = headersToSafeObject(res.headers);
  return {
    url: startUrl.toString(),
    finalUrl: current.toString(),
    status: res.status,
    statusText: res.statusText || "",
    protocol: current.protocol,
    redirected: redirectCount > 0,
    redirectCount,
    redirectChain: redirectChain.slice(),
    responseTimeMs: Math.round(performance.now() - started),
    headers,
    hstsRaw: res.headers.get("strict-transport-security"),
  };
}
