/**
 * Website SEO & Performance Analyzer — primary HTML only, no crawling.
 */

import { prepareUrl } from "../http-status/url.js";
import { fetchHtmlDocument } from "./fetch.js";
import { parseHtmlDocument } from "./parser.js";
import { analyzeSeo } from "./seo.js";
import { analyzeLinks } from "./links.js";
import { analyzeImages } from "./images.js";
import { analyzeSocial } from "./social.js";
import { analyzePerformance } from "./performance.js";
import { calculateWebsiteScore } from "./score.js";
import { MAX_HEADINGS_SAMPLE } from "./limits.js";

/**
 * @param {string} input
 */
export async function analyzeWebsite(input) {
  const prepared = prepareUrl(input);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
      httpStatus: 400,
    };
  }

  const fetchResult = await fetchHtmlDocument(prepared.url);
  const parsed = parseHtmlDocument(fetchResult.body || "");

  const seo = analyzeSeo(parsed, fetchResult.finalUrl);
  const images = analyzeImages(parsed.images);
  const links = analyzeLinks(parsed.anchors, fetchResult.finalUrl);
  const social = analyzeSocial(parsed.metas);
  const performance = analyzePerformance(fetchResult);

  const security = compactSecurity(fetchResult);

  const headings = {
    h1: parsed.headings.h1.slice(0, MAX_HEADINGS_SAMPLE),
    h2: parsed.headings.h2.slice(0, MAX_HEADINGS_SAMPLE),
    h3: parsed.headings.h3.slice(0, MAX_HEADINGS_SAMPLE),
    counts: {
      h1: parsed.headings.h1.length,
      h2: parsed.headings.h2.length,
      h3: parsed.headings.h3.length,
    },
  };

  const html = {
    doctype: parsed.hasDoctype,
    html: parsed.hasHtml,
    head: parsed.hasHead,
    body: parsed.hasBody,
    charset: parsed.charset,
    contentType: fetchResult.contentType,
  };

  const score = calculateWebsiteScore({
    seo,
    headings: parsed.headings,
    images,
    social,
    html: {
      hasDoctype: parsed.hasDoctype,
      hasHtml: parsed.hasHtml,
      hasHead: parsed.hasHead,
      hasBody: parsed.hasBody,
      charset: parsed.charset,
    },
    security,
    performance,
    status: fetchResult.status,
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
    contentLength: fetchResult.contentLength,
    seo,
    headings,
    images: {
      total: images.total,
      withAlt: images.withAlt,
      missingAlt: images.missingAlt,
      emptyAlt: images.emptyAlt,
      missingDimensions: images.missingDimensions,
    },
    links: {
      total: links.total,
      internal: links.internal,
      external: links.external,
      nofollow: links.nofollow,
      anchors: links.anchors,
    },
    social,
    html,
    security,
    performance,
    score,
  };
}

function compactSecurity(fetchResult) {
  const h = fetchResult.headers || {};
  const https = String(fetchResult.protocol || "").startsWith("https");
  return {
    https,
    hsts: Boolean(h["strict-transport-security"]),
    csp: Boolean(h["content-security-policy"]),
    xContentTypeOptions: Boolean(h["x-content-type-options"]),
    xFrameOptions: Boolean(h["x-frame-options"]),
    frameAncestors: /frame-ancestors/i.test(h["content-security-policy"] || ""),
    referrerPolicy: Boolean(h["referrer-policy"]),
    permissionsPolicy: Boolean(
      h["permissions-policy"] || h["feature-policy"]
    ),
  };
}
