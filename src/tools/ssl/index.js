/**
 * SSL/TLS & HTTPS Analyzer — observable configuration only.
 */

import { prepareUrl } from "../http-status/url.js";
import { probeUrl } from "./fetch.js";
import { analyzeHttpsConfig } from "./analyzer.js";
import { calculateSslScore } from "./score.js";

const GLOBAL_DEADLINE_MS = 12_000;

const BLOCK_CODES = new Set([
  "PRIVATE_ADDRESS_BLOCKED",
  "SSRF_BLOCKED",
  "CREDENTIALS_NOT_ALLOWED",
  "UNSUPPORTED_PROTOCOL",
  "INVALID_URL",
  "MISSING_URL",
]);

/**
 * @param {string} input
 */
export async function analyzeSsl(input) {
  const prepared = prepareUrl(input);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
      httpStatus: 400,
    };
  }

  const deadlineAt = Date.now() + GLOBAL_DEADLINE_MS;
  const site = prepared.url;

  const httpsUrl = new URL(site.toString());
  httpsUrl.protocol = "https:";

  let httpsProbe = null;
  let httpsError = null;
  try {
    httpsProbe = await probeUrl(httpsUrl, { deadlineAt });
  } catch (err) {
    if (err && err.code) httpsError = err;
    else {
      httpsError = {
        code: "UPSTREAM_CONNECTION_ERROR",
        message: "HTTPS probe failed.",
      };
    }
  }

  // Security policy failures must not become soft analysis results
  if (httpsError && BLOCK_CODES.has(httpsError.code)) {
    throw {
      code: httpsError.code,
      message: httpsError.message,
      httpStatus:
        typeof httpsError.httpStatus === "number"
          ? httpsError.httpStatus
          : httpsError.code === "PRIVATE_ADDRESS_BLOCKED" ||
              httpsError.code === "SSRF_BLOCKED"
            ? 403
            : 400,
    };
  }

  let httpProbe = null;
  let httpError = null;
  try {
    const httpUrl = new URL(site.toString());
    httpUrl.protocol = "http:";
    httpProbe = await probeUrl(httpUrl, { deadlineAt });
  } catch (err) {
    if (err && err.code) httpError = err;
    else {
      httpError = {
        code: "UPSTREAM_CONNECTION_ERROR",
        message: "HTTP probe failed.",
      };
    }
  }

  if (httpError && BLOCK_CODES.has(httpError.code)) {
    // Same host blocked on HTTP — treat as hard failure if HTTPS also failed
    if (!httpsProbe) {
      throw {
        code: httpError.code,
        message: httpError.message,
        httpStatus:
          typeof httpError.httpStatus === "number"
            ? httpError.httpStatus
            : httpError.code === "PRIVATE_ADDRESS_BLOCKED" ||
                httpError.code === "SSRF_BLOCKED"
              ? 403
              : 400,
      };
    }
    // HTTPS succeeded but HTTP blocked (unusual); ignore HTTP upgrade data
    httpError = null;
    httpProbe = null;
  }

  const analysis = analyzeHttpsConfig({
    httpsProbe,
    httpProbe,
    httpsError,
    httpError,
  });
  const score = calculateSslScore(analysis);

  return {
    url: site.toString(),
    httpsUrl: httpsUrl.toString(),
    analysis,
    score,
    observability: {
      runtime: "cloudflare-pages-functions",
      certificateInspection: false,
      tlsHandshakeDetails: false,
      method: "fetch-headers-redirects",
      note:
        "Only protocol success, redirects, and response headers (including HSTS) are observable. Certificate and cipher fields are not_observable.",
    },
  };
}
