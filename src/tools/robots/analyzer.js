/**
 * Structured findings from parsed robots.txt + fetch metadata.
 */

import { validateSitemapUrl } from "./parser.js";

function finding(code, severity, category, title, message) {
  return { code, severity, category, title, message };
}

/**
 * @param {object} fetchResult
 * @param {object|null} parsed
 */
export function analyzeRobots(fetchResult, parsed) {
  const findings = [];
  const recommendations = [];

  if (!fetchResult.found) {
    if (fetchResult.forbidden) {
      findings.push(
        finding(
          "ROBOTS_FORBIDDEN",
          "warning",
          "availability",
          "robots.txt forbidden",
          "The server returned HTTP 403 for robots.txt."
        )
      );
    } else if (fetchResult.status === 404 || fetchResult.status === 410) {
      findings.push(
        finding(
          "ROBOTS_NOT_FOUND",
          "info",
          "availability",
          "robots.txt not found",
          "No robots.txt was returned (HTTP " +
            fetchResult.status +
            "). Sites may operate without one."
        )
      );
      recommendations.push({
        code: "CONSIDER_ROBOTS",
        priority: "low",
        category: "availability",
        title: "Consider adding robots.txt",
        message:
          "Optional: publish robots.txt to declare crawl preferences and sitemap location.",
      });
    } else {
      findings.push(
        finding(
          "ROBOTS_UNAVAILABLE",
          "warning",
          "availability",
          "robots.txt unavailable",
          `HTTP ${fetchResult.status} when requesting robots.txt.`
        )
      );
    }
    return { findings, recommendations, summary: buildSummary(null, fetchResult) };
  }

  const body = fetchResult.body || "";
  if (!body.trim()) {
    findings.push(
      finding(
        "ROBOTS_EMPTY",
        "info",
        "syntax",
        "Empty robots.txt",
        "robots.txt was returned but contains no directives."
      )
    );
  }

  const ct = (fetchResult.contentType || "").toLowerCase();
  if (ct && !ct.includes("text/plain") && !ct.includes("text/html")) {
    findings.push(
      finding(
        "ROBOTS_CONTENT_TYPE",
        "info",
        "syntax",
        "Unusual Content-Type",
        `Content-Type is “${fetchResult.contentType}” (informational).`
      )
    );
  }

  if (!parsed) {
    return { findings, recommendations, summary: buildSummary(null, fetchResult) };
  }

  const { groups, sitemaps, hosts, unknownDirectives, malformedLines } = parsed;

  let blocksAll = false;
  for (const g of groups) {
    const hasStar = g.userAgents.some((ua) => ua === "*");
    if (hasStar && g.disallow.some((d) => d === "/" || d === "/*")) {
      blocksAll = true;
    }
    if (g.disallow.some((d) => d === "")) {
      findings.push(
        finding(
          "ROBOTS_EMPTY_DISALLOW",
          "info",
          "crawl",
          "Empty Disallow",
          "An empty Disallow rule is present (often means allow all for that group)."
        )
      );
    }
    const hasDisallow = g.disallow.some((d) => d && d !== "");
    const hasAllow = g.allow.some((d) => d && d !== "");
    if (hasDisallow && hasAllow) {
      findings.push(
        finding(
          "ROBOTS_ALLOW_DISALLOW_OVERLAP",
          "info",
          "crawl",
          "Overlapping Allow/Disallow",
          "A group has both Allow and Disallow rules; crawlers apply their own precedence rules."
        )
      );
    }
    if (g.userAgents.length && !hasDisallow && !hasAllow && g.crawlDelay == null) {
      findings.push(
        finding(
          "ROBOTS_EMPTY_GROUP",
          "info",
          "crawl",
          "Group without rules",
          `User-agent group (${g.userAgents.join(", ")}) has no Allow/Disallow rules.`
        )
      );
    }
  }

  if (blocksAll) {
    findings.push(
      finding(
        "ROBOTS_BLOCKS_ALL",
        "warning",
        "crawl",
        "Root path disallowed for *",
        "The wildcard user-agent group includes Disallow: / (or /*). This requests matching crawlers not to crawl the site root. This is not the same as guaranteed de-indexing."
      )
    );
    recommendations.push({
      code: "REVIEW_BLOCKS_ALL",
      priority: "high",
      category: "crawl",
      title: "Review full-site Disallow",
      message:
        "Confirm that blocking all crawlers for * is intentional for this site.",
    });
  }

  if (sitemaps.length === 0) {
    findings.push(
      finding(
        "ROBOTS_SITEMAP_MISSING",
        "info",
        "sitemap",
        "No Sitemap directive",
        "No Sitemap: lines were found in robots.txt."
      )
    );
    recommendations.push({
      code: "ADD_SITEMAP",
      priority: "medium",
      category: "sitemap",
      title: "Declare your sitemap",
      message:
        "Consider adding Sitemap: https://example.com/sitemap.xml (URL only — not fetched in this phase).",
    });
  } else {
    findings.push(
      finding(
        "ROBOTS_SITEMAP_PRESENT",
        "success",
        "sitemap",
        "Sitemap declared",
        `${sitemaps.length} Sitemap directive(s) found (URLs are not fetched).`
      )
    );
    for (const sm of sitemaps) {
      const v = validateSitemapUrl(sm);
      if (!v.ok) {
        findings.push(
          finding(
            "ROBOTS_SITEMAP_INVALID",
            "warning",
            "sitemap",
            "Invalid Sitemap URL",
            `Sitemap value is not a valid http(s) URL: ${sm.slice(0, 120)}`
          )
        );
      }
    }
  }

  if (hosts.length) {
    findings.push(
      finding(
        "ROBOTS_NONSTANDARD_HOST",
        "info",
        "syntax",
        "Non-standard Host directive",
        "Host: is not a universal robots.txt standard; support varies by crawler."
      )
    );
  }

  if (unknownDirectives.length) {
    findings.push(
      finding(
        "ROBOTS_UNKNOWN_DIRECTIVE",
        "info",
        "syntax",
        "Unknown directives",
        `${unknownDirectives.length} unrecognized directive line(s).`
      )
    );
  }

  if (malformedLines.length) {
    findings.push(
      finding(
        "ROBOTS_MALFORMED_LINE",
        "info",
        "syntax",
        "Malformed lines",
        `${malformedLines.length} line(s) could not be parsed as directives.`
      )
    );
  }

  return {
    findings,
    recommendations,
    summary: buildSummary(parsed, fetchResult),
  };
}

function buildSummary(parsed, fetchResult) {
  if (!parsed) {
    return {
      groups: 0,
      userAgents: 0,
      wildcard: false,
      sitemapCount: 0,
      found: Boolean(fetchResult.found),
    };
  }
  const uas = new Set();
  let wildcard = false;
  for (const g of parsed.groups) {
    for (const ua of g.userAgents) {
      uas.add(ua);
      if (ua === "*") wildcard = true;
    }
  }
  return {
    groups: parsed.groups.length,
    userAgents: uas.size,
    wildcard,
    sitemapCount: parsed.sitemaps.length,
    found: true,
  };
}
