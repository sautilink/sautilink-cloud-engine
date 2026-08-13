/**
 * HTTP/HTTPS Headers Analyzer — reuses HTTP-status SSRF + probe.
 */

import { prepareUrl } from "../http-status/url.js";
import { probeHttpStatus } from "../http-status/fetch.js";
import { analyzeHeaders } from "./analyzer.js";
import { calculateHeadersSecurityScore } from "./score.js";

export { prepareUrl };

/**
 * @param {string} input
 * @returns {Promise<object>}
 */
export async function analyzeHttpHeaders(input) {
  const prepared = prepareUrl(input);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
      httpStatus: 400,
    };
  }

  const probe = await probeHttpStatus(prepared.url, { fullHeaders: true });
  const analysis = analyzeHeaders(probe.headers || {}, probe.cookies || []);
  const security = calculateHeadersSecurityScore(analysis, {
    protocol: probe.protocol,
  });

  return {
    url: probe.url,
    finalUrl: probe.finalUrl,
    status: probe.status,
    statusText: probe.statusText,
    protocol: probe.protocol,
    redirected: probe.redirected,
    redirectCount: probe.redirectCount,
    redirectChain: probe.redirectChain,
    responseTimeMs: probe.responseTimeMs,
    headers: probe.headers || {},
    cookies: probe.cookies || [],
    analysis,
    security,
  };
}
