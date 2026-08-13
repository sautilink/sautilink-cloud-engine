/**
 * Safe sitemap / robots body fetch with shared SSRF controls.
 */

import { assertUrlSafeToFetch } from "../http-status/ssrf.js";
import { MAX_REDIRECTS, REQUEST_TIMEOUT_MS } from "../http-status/fetch.js";
import { MAX_SITEMAP_SIZE } from "./limits.js";

const USER_AGENT = "SautiLinkCloudEngine/1.0 (+https://cloudengine.sautilink.com)";

/**
 * @param {URL} startUrl
 * @param {{ maxBytes?: number, deadlineAt?: number }} [opts]
 */
export async function fetchTextResource(startUrl, opts = {}) {
  const maxBytes = opts.maxBytes ?? MAX_SITEMAP_SIZE;
  const redirectChain = [];
  let current = new URL(startUrl.toString());
  let redirectCount = 0;
  const started = performance.now();

  if (opts.deadlineAt != null && Date.now() >= opts.deadlineAt) {
    throw {
      code: "SITEMAP_FETCH_TIMEOUT",
      message: "Global sitemap analysis deadline exceeded.",
      httpStatus: 504,
    };
  }

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
          code: "SITEMAP_FETCH_TIMEOUT",
          message: "Global sitemap analysis deadline exceeded.",
          httpStatus: 504,
        };
      }

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
            Accept: "application/xml,text/xml,application/xhtml+xml,text/plain,*/*;q=0.1",
          },
        });
      } catch (err) {
        if (err && err.name === "AbortError") {
          throw {
            code: "SITEMAP_FETCH_TIMEOUT",
            message: "The sitemap request timed out.",
            httpStatus: 504,
          };
        }
        throw {
          code: "UPSTREAM_CONNECTION_ERROR",
          message: "Could not connect to fetch the sitemap.",
          httpStatus: 502,
        };
      }

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
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
          url: startUrl.toString(),
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

      if (res.status < 200 || res.status >= 300) {
        return {
          url: startUrl.toString(),
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
          if (bodyBytes > maxBytes) {
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            throw {
              code: "SITEMAP_SIZE_LIMIT",
              message: `Document exceeds the maximum size of ${maxBytes} bytes.`,
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
        url: startUrl.toString(),
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
    message: "Unexpected end of sitemap fetch.",
    httpStatus: 502,
  };
}
