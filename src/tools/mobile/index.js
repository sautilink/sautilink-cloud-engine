/**
 * Mobile-Friendly / Mobile SEO Analyzer — primary HTML only.
 */

import { prepareUrl } from "../http-status/url.js";
import { fetchHtmlDocument } from "./fetch.js";
import { parseMobileHtml } from "./parser.js";
import { analyzeMobileSignals } from "./analyzer.js";
import { analyzeMobileSeo } from "./seo.js";
import { calculateMobileScore } from "./score.js";

/**
 * @param {string} input
 */
export async function analyzeMobile(input) {
  const prepared = prepareUrl(input);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
      httpStatus: 400,
    };
  }

  const fetchResult = await fetchHtmlDocument(prepared.url);
  const parsed = parseMobileHtml(fetchResult.body || "");
  const signals = analyzeMobileSignals(parsed);
  const seo = analyzeMobileSeo(parsed, fetchResult.finalUrl);

  const html = {
    hasDoctype: parsed.hasDoctype,
    hasHtml: parsed.hasHtml,
    hasHead: parsed.hasHead,
    hasBody: parsed.hasBody,
    lang: parsed.lang,
    https: String(fetchResult.protocol || "").startsWith("https"),
  };

  const score = calculateMobileScore({
    viewport: signals.viewport,
    signals,
    seo,
    html,
    truncated: fetchResult.truncated,
  });

  return {
    url: fetchResult.url,
    finalUrl: fetchResult.finalUrl,
    status: fetchResult.status,
    statusText: fetchResult.statusText,
    protocol: fetchResult.protocol,
    redirected: fetchResult.redirected,
    redirectCount: fetchResult.redirectCount,
    redirectChain: fetchResult.redirectChain,
    responseTimeMs: fetchResult.responseTimeMs,
    contentType: fetchResult.contentType,
    bodyBytes: fetchResult.bodyBytes,
    truncated: Boolean(fetchResult.truncated),
    viewport: signals.viewport,
    responsive: {
      webAppMeta: signals.responsiveMeta,
      fixedWidthSignals: signals.fixedWidthSignals,
      overflowRisk: signals.overflowRisk,
    },
    seo,
    images: {
      total: signals.images.total,
      withSrcset: signals.images.withSrcset,
      withSizes: signals.images.withSizes,
      withDimensions: signals.images.withDimensions,
      fixedWidthCount: signals.images.fixedWidthCount,
      missingAlt: signals.images.missingAlt,
    },
    navigation: signals.navigation,
    readability: signals.readability,
    media: signals.mediaRisks,
    html,
    score,
  };
}
