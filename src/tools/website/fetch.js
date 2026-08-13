/**
 * Safe GET of HTML document with shared SSRF + redirect controls.
 */

import { assertUrlSafeToFetch } from "../http-status/ssrf.js";
import { headersToSafeObject } from "../http-status/fetch.js";
import { MAX_HTML_BYTES, REQUEST_TIMEOUT_MS, MAX_REDIRECTS } from "./limits.js";

const USER_AGENT = "SautiLinkCloudEngine/1.0 (+https://cloudengine.sautilink.com)";

/**
 * @param {URL} startUrl
 */
export async function fetchHtmlDocument(startUrl) {
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
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
      } catch (err) {
        if (err && err.name === "AbortError") {
          throw {
            code: "REQUEST_TIMEOUT",
            message: "The request to the target site timed out.",
            httpStatus: 504,
          };
        }
        throw {
          code: "UPSTREAM_CONNECTION_ERROR",
          message: "Could not connect to the target site.",
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
      const cl = res.headers.get("content-length");
      let contentLength = null;
      if (cl != null && /^\d+$/.test(cl)) contentLength = Number(cl);

      let body = "";
      let bodyBytes = 0;
      let truncated = false;

      if (res.body) {
        const reader = res.body.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bodyBytes += value ? value.byteLength : 0;
          if (bodyBytes > MAX_HTML_BYTES) {
            truncated = true;
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            break;
          }
          if (value) chunks.push(value);
        }
        const size = truncated
          ? chunks.reduce((n, c) => n + c.byteLength, 0)
          : bodyBytes;
        const merged = new Uint8Array(size);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        body = new TextDecoder("utf-8").decode(merged);
        if (truncated) bodyBytes = MAX_HTML_BYTES + 1;
      }

      const elapsed = Math.round(performance.now() - started);

      return {
        url: startUrl.toString(),
        finalUrl: current.toString(),
        status: res.status,
        statusText: res.statusText || "",
        protocol: current.protocol,
        redirected: redirectCount > 0,
        redirectCount,
        redirectChain,
        responseTimeMs: elapsed,
        contentType,
        contentLength,
        bodyBytes: Math.min(bodyBytes, MAX_HTML_BYTES),
        truncated,
        body,
        headers: headersToSafeObject(res.headers),
      };
    }
  } finally {
    clearTimeout(timer);
  }

  throw {
    code: "UPSTREAM_CONNECTION_ERROR",
    message: "Unexpected end of document fetch.",
    httpStatus: 502,
  };
}
