/**
 * Controlled outbound HTTP probe: redirects, timeouts, HEAD/GET, size limits.
 */

import { assertUrlSafeToFetch } from "./ssrf.js";

export const MAX_REDIRECTS = 5;
export const REQUEST_TIMEOUT_MS = 8000;
/** Max bytes read when GET fallback is used (headers-only preference). */
export const MAX_BODY_BYTES = 64 * 1024;

const USER_AGENT = "SautiLinkCloudEngine/1.0 (+https://cloudengine.sautilink.com)";

/**
 * @param {Headers} headers
 * @returns {{ contentType: string|null, contentLength: number|null, server: string|null, location: string|null }}
 */
function pickSafeHeaders(headers) {
  const contentType = headers.get("content-type");
  const cl = headers.get("content-length");
  let contentLength = null;
  if (cl != null && /^\d+$/.test(cl)) {
    contentLength = Number(cl);
  }
  return {
    contentType: contentType || null,
    contentLength,
    server: headers.get("server") || null,
    location: headers.get("location") || null,
  };
}

/**
 * Drain or cancel body with a hard size cap.
 * @param {Response} res
 * @returns {Promise<{ truncated: boolean }>}
 */
async function consumeBodyLimited(res) {
  if (!res.body) return { truncated: false };
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
        return { truncated: true };
      }
    }
    return { truncated: false };
  } catch {
    return { truncated: false };
  }
}

/**
 * Single hop with timeout and manual redirect handling.
 * @param {URL} url
 * @param {string} method
 * @param {AbortSignal} signal
 * @returns {Promise<Response>}
 */
async function probeOnce(url, method, signal) {
  return fetch(url.toString(), {
    method,
    redirect: "manual",
    signal,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "*/*",
    },
  });
}

/**
 * @param {URL} startUrl - already validated structure
 * @returns {Promise<object>} data payload for success response
 * @throws {{ code: string, message: string, httpStatus?: number }}
 */
export async function probeHttpStatus(startUrl) {
  const redirectChain = [];
  let current = new URL(startUrl.toString());
  let redirectCount = 0;
  const started = performance.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const safe = await assertUrlSafeToFetch(current);
      if (!safe.ok) {
        throw {
          code: safe.code,
          message: safe.message,
          httpStatus: safe.code === "PRIVATE_ADDRESS_BLOCKED" || safe.code === "SSRF_BLOCKED" ? 403 : 400,
        };
      }

      let res;
      try {
        res = await probeOnce(current, "HEAD", controller.signal);
        // Some servers mishandle HEAD → try GET for 405/501
        if (res.status === 405 || res.status === 501) {
          res = await probeOnce(current, "GET", controller.signal);
        }
      } catch (err) {
        if (err && err.name === "AbortError") {
          throw {
            code: "REQUEST_TIMEOUT",
            message: "The request to the target site timed out.",
            httpStatus: 504,
          };
        }
        const msg = String(err && err.message ? err.message : err);
        if (/dns|getaddrinfo|name not resolved|nxdomain/i.test(msg)) {
          throw {
            code: "UPSTREAM_DNS_ERROR",
            message: "Could not resolve the target hostname.",
            httpStatus: 502,
          };
        }
        throw {
          code: "UPSTREAM_CONNECTION_ERROR",
          message: "Could not connect to the target site.",
          httpStatus: 502,
        };
      }

      // Redirects: 3xx with Location
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) {
          // Redirect without location — treat as final response
          const elapsed = Math.round(performance.now() - started);
          const headers = pickSafeHeaders(res.headers);
          return {
            url: startUrl.toString(),
            finalUrl: current.toString(),
            status: res.status,
            statusText: res.statusText || "",
            protocol: current.protocol.replace(":", ""),
            redirected: redirectCount > 0,
            redirectCount,
            redirectChain: redirectChain.slice(),
            responseTimeMs: elapsed,
            contentType: headers.contentType,
            contentLength: headers.contentLength,
            server: headers.server,
            location: headers.location,
          };
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
        });
        redirectCount += 1;
        current = next;
        continue;
      }

      // Final non-redirect response — limit body if GET was used
      if (res.body) {
        const { truncated } = await consumeBodyLimited(res);
        if (truncated) {
          throw {
            code: "RESPONSE_TOO_LARGE",
            message: "The target response body exceeded the safe size limit.",
            httpStatus: 502,
          };
        }
      }

      const elapsed = Math.round(performance.now() - started);
      const headers = pickSafeHeaders(res.headers);

      return {
        url: startUrl.toString(),
        finalUrl: current.toString(),
        status: res.status,
        statusText: res.statusText || "",
        protocol: current.protocol.replace(":", ""),
        redirected: redirectCount > 0,
        redirectCount,
        redirectChain: redirectChain.slice(),
        responseTimeMs: elapsed,
        contentType: headers.contentType,
        contentLength: headers.contentLength,
        server: headers.server,
        location: headers.location,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}
