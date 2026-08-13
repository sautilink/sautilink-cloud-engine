/**
 * Safe GET of /robots.txt with shared SSRF + redirect controls.
 */

import { assertUrlSafeToFetch } from "../http-status/ssrf.js";
import { MAX_REDIRECTS, REQUEST_TIMEOUT_MS } from "../http-status/fetch.js";

/** Max robots.txt body size (bytes). */
export const MAX_ROBOTS_BYTES = 256 * 1024;

const USER_AGENT = "SautiLinkCloudEngine/1.0 (+https://cloudengine.sautilink.com)";

/**
 * @param {URL} startUrl - already validated robots.txt URL
 * @returns {Promise<object>}
 */
export async function fetchRobotsTxt(startUrl) {
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
          httpStatus:
            safe.code === "PRIVATE_ADDRESS_BLOCKED" || safe.code === "SSRF_BLOCKED"
              ? 403
              : 400,
        };
      }

      let res;
      try {
        res = await fetch(current.toString(), {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/plain,text/*;q=0.9,*/*;q=0.1",
          },
        });
      } catch (err) {
        if (err && err.name === "AbortError") {
          throw {
            code: "REQUEST_TIMEOUT",
            message: "The request for robots.txt timed out.",
            httpStatus: 504,
          };
        }
        throw {
          code: "UPSTREAM_CONNECTION_ERROR",
          message: "Could not connect to fetch robots.txt.",
          httpStatus: 502,
        };
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) {
          break;
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

      const contentType = res.headers.get("content-type") || null;
      const elapsed = Math.round(performance.now() - started);

      if (res.status === 404 || res.status === 410) {
        return {
          robotsUrl: startUrl.toString(),
          finalUrl: current.toString(),
          status: res.status,
          statusText: res.statusText || "",
          responseTimeMs: elapsed,
          redirected: redirectCount > 0,
          redirectCount,
          redirectChain,
          contentType,
          found: false,
          body: null,
          bodyBytes: 0,
        };
      }

      if (res.status === 403) {
        return {
          robotsUrl: startUrl.toString(),
          finalUrl: current.toString(),
          status: 403,
          statusText: res.statusText || "Forbidden",
          responseTimeMs: elapsed,
          redirected: redirectCount > 0,
          redirectCount,
          redirectChain,
          contentType,
          found: false,
          forbidden: true,
          body: null,
          bodyBytes: 0,
        };
      }

      if (res.status < 200 || res.status >= 300) {
        return {
          robotsUrl: startUrl.toString(),
          finalUrl: current.toString(),
          status: res.status,
          statusText: res.statusText || "",
          responseTimeMs: elapsed,
          redirected: redirectCount > 0,
          redirectCount,
          redirectChain,
          contentType,
          found: false,
          body: null,
          bodyBytes: 0,
          upstreamError: true,
        };
      }

      let body = "";
      let bodyBytes = 0;
      if (res.body) {
        const reader = res.body.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bodyBytes += value ? value.byteLength : 0;
          if (bodyBytes > MAX_ROBOTS_BYTES) {
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            throw {
              code: "ROBOTS_TOO_LARGE",
              message: `robots.txt exceeds the maximum size of ${MAX_ROBOTS_BYTES} bytes.`,
              httpStatus: 502,
            };
          }
          if (value) chunks.push(value);
        }
        const merged = new Uint8Array(bodyBytes);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        body = new TextDecoder("utf-8").decode(merged);
      }

      return {
        robotsUrl: startUrl.toString(),
        finalUrl: current.toString(),
        status: res.status,
        statusText: res.statusText || "",
        responseTimeMs: elapsed,
        redirected: redirectCount > 0,
        redirectCount,
        redirectChain,
        contentType,
        found: true,
        body,
        bodyBytes,
      };
    }
  } finally {
    clearTimeout(timer);
  }

  throw {
    code: "UPSTREAM_CONNECTION_ERROR",
    message: "Unexpected end of robots.txt fetch.",
    httpStatus: 502,
  };
}

/**
 * @param {URL} siteUrl
 * @returns {URL}
 */
export function robotsUrlFromSite(siteUrl) {
  const u = new URL(siteUrl.toString());
  u.pathname = "/robots.txt";
  u.search = "";
  u.hash = "";
  return u;
}
