/**
 * Sitemap.xml Analyzer — bounded, SSRF-safe.
 */

import { prepareUrl } from "../http-status/url.js";
import { fetchTextResource } from "./fetch.js";
import {
  parseSitemapXml,
  extractSitemapRefsFromRobots,
  validateLoc,
} from "./parser.js";
import { analyzeParsedSitemap } from "./analyzer.js";
import { calculateSitemapScore } from "./score.js";
import {
  MAX_CHILD_SITEMAPS,
  MAX_RECURSION_DEPTH,
  GLOBAL_DEADLINE_MS,
  MAX_URLS_IN_RESPONSE,
  MAX_URLS,
} from "./limits.js";

/**
 * @param {string} input
 */
export async function analyzeSitemap(input) {
  const prepared = prepareUrl(input);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
      httpStatus: 400,
    };
  }

  const deadlineAt = Date.now() + GLOBAL_DEADLINE_MS;
  const visited = new Set();
  const discovery = { source: "direct", url: prepared.url.toString() };

  let primary = await fetchTextResource(prepared.url, { deadlineAt });
  let sourceUrl = prepared.url.toString();

  // Optional robots discovery if direct miss and path isn't already robots
  if (!primary.found && !/\/robots\.txt$/i.test(prepared.url.pathname)) {
    try {
      const origin = new URL(prepared.url.origin + "/robots.txt");
      const robots = await fetchTextResource(origin, {
        deadlineAt,
        maxBytes: 256 * 1024,
      });
      if (robots.found && robots.body) {
        const refs = extractSitemapRefsFromRobots(robots.body);
        for (const ref of refs.slice(0, MAX_CHILD_SITEMAPS)) {
          const v = validateLoc(ref);
          if (!v.ok) continue;
          const childUrl = new URL(v.href);
          primary = await fetchTextResource(childUrl, { deadlineAt });
          sourceUrl = v.href;
          discovery.source = "robots";
          discovery.url = v.href;
          if (primary.found) break;
        }
      }
    } catch {
      /* keep primary miss */
    }
  }

  if (!primary.found) {
    const analysis = analyzeParsedSitemap(
      { type: "unknown", entries: [], xmlValid: false, error: "not_found" },
      {}
    );
    analysis.findings.unshift({
      code: "SITEMAP_NOT_FOUND",
      severity: "warning",
      category: "availability",
      title: "Sitemap not found",
      message: `HTTP ${primary.status} when requesting the sitemap.`,
    });
    const score = calculateSitemapScore(
      { found: false, status: primary.status },
      { xmlValid: false, type: "unknown" },
      analysis
    );
    return {
      url: sourceUrl,
      finalUrl: primary.finalUrl,
      type: "unknown",
      found: false,
      status: primary.status,
      statusText: primary.statusText,
      responseTimeMs: primary.responseTimeMs,
      stats: analysis.stats,
      sitemaps: [],
      urls: [],
      discovery,
      score,
      limits: exposeLimits(false, false),
    };
  }

  visited.add(normalizeKey(primary.finalUrl));

  const parsed = parseSitemapXml(primary.body || "");
  let analysis = analyzeParsedSitemap(parsed, {
    truncatedUrls: parsed.entries.length > MAX_URLS,
  });

  const collectedUrls = analysis.urls.slice();
  const indexChildren = [];
  let truncatedChildren = false;

  if (parsed.type === "sitemapindex" && MAX_RECURSION_DEPTH >= 1) {
    const children = analysis.childSitemaps.slice(0, MAX_CHILD_SITEMAPS);
    if (analysis.childSitemaps.length > MAX_CHILD_SITEMAPS) {
      truncatedChildren = true;
    }
    for (const child of children) {
      if (Date.now() >= deadlineAt) {
        analysis.findings.push({
          code: "SITEMAP_FETCH_TIMEOUT",
          severity: "warning",
          category: "availability",
          title: "Deadline reached",
          message: "Stopped fetching child sitemaps due to global deadline.",
        });
        truncatedChildren = true;
        break;
      }
      const key = normalizeKey(child.loc);
      if (visited.has(key)) continue;
      visited.add(key);

      let childFetch;
      try {
        childFetch = await fetchTextResource(new URL(child.loc), { deadlineAt });
      } catch (err) {
        if (err && err.code) {
          analysis.findings.push({
            code: err.code,
            severity: "warning",
            category: "availability",
            title: "Child sitemap fetch issue",
            message: err.message || "Could not fetch child sitemap.",
          });
          continue;
        }
        continue;
      }

      indexChildren.push({
        loc: child.loc,
        status: childFetch.status,
        found: childFetch.found,
      });

      if (!childFetch.found || !childFetch.body) continue;

      const childParsed = parseSitemapXml(childFetch.body);
      const childAnalysis = analyzeParsedSitemap(childParsed, {
        truncatedUrls: childParsed.entries.length > MAX_URLS,
      });
      for (const u of childAnalysis.urls) {
        if (collectedUrls.length >= MAX_URLS) {
          truncatedChildren = true;
          break;
        }
        collectedUrls.push(u);
      }
      analysis.findings.push(...childAnalysis.findings.filter((f) => f.code === "INVALID_URL").slice(0, 3));
      analysis.stats.validUrls += childAnalysis.stats.validUrls;
      analysis.stats.invalidUrls += childAnalysis.stats.invalidUrls;
      analysis.stats.duplicates += childAnalysis.stats.duplicates;
      analysis.stats.urls =
        analysis.stats.validUrls + analysis.stats.invalidUrls;
    }
    discovery.source = discovery.source === "robots" ? "robots" : "index";
  }

  if (truncatedChildren) {
    analysis = analyzeParsedSitemap(parsed, {
      truncatedUrls: parsed.entries.length > MAX_URLS,
      truncatedChildren: true,
    });
    // re-merge collected stats roughly
    analysis.stats.validUrls = collectedUrls.length;
    analysis.stats.urls = collectedUrls.length;
  }

  const score = calculateSitemapScore(
    { found: true, status: primary.status },
    parsed,
    analysis
  );

  return {
    url: sourceUrl,
    finalUrl: primary.finalUrl,
    type: parsed.type,
    found: true,
    status: primary.status,
    statusText: primary.statusText,
    responseTimeMs: primary.responseTimeMs,
    contentType: primary.contentType,
    stats: {
      ...analysis.stats,
      urls: collectedUrls.length,
      validUrls: collectedUrls.length,
    },
    sitemaps: indexChildren,
    urls: collectedUrls.slice(0, MAX_URLS_IN_RESPONSE),
    discovery,
    score,
    limits: exposeLimits(
      collectedUrls.length >= MAX_URLS || parsed.entries.length > MAX_URLS,
      truncatedChildren
    ),
  };
}

function normalizeKey(u) {
  try {
    const x = new URL(u);
    x.hash = "";
    return x.toString().toLowerCase();
  } catch {
    return String(u).toLowerCase();
  }
}

function exposeLimits(urlCap, childCap) {
  return {
    maxSitemapSize: 512 * 1024,
    maxUrls: MAX_URLS,
    maxChildSitemaps: MAX_CHILD_SITEMAPS,
    maxRecursionDepth: MAX_RECURSION_DEPTH,
    globalDeadlineMs: GLOBAL_DEADLINE_MS,
    truncatedUrls: urlCap,
    truncatedChildren: childCap,
  };
}
