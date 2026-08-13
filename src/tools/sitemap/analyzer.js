import {
  validateLoc,
  validateLastmod,
  validateChangefreq,
  validatePriority,
} from "./parser.js";
import { MAX_URLS } from "./limits.js";

function finding(code, severity, category, title, message) {
  return { code, severity, category, title, message };
}

/**
 * Analyze parsed entries into stats + findings (no network).
 * @param {{ type: string, entries: object[], xmlValid: boolean, error?: string }}
 * @param {{ truncatedUrls?: boolean, truncatedChildren?: boolean, depth?: number }}
 */
export function analyzeParsedSitemap(parsed, meta = {}) {
  const findings = [];
  const recommendations = [];
  const urls = [];
  const childSitemaps = [];
  const seen = new Set();
  let duplicates = 0;
  let validUrls = 0;
  let invalidUrls = 0;
  let lastmodOk = 0;
  let lastmodBad = 0;
  let changefreqOk = 0;
  let changefreqBad = 0;
  let priorityOk = 0;
  let priorityBad = 0;

  if (!parsed.xmlValid) {
    findings.push(
      finding(
        "INVALID_XML",
        "error",
        "xml",
        "Invalid or unrecognized XML",
        parsed.error
          ? `Could not parse sitemap XML (${parsed.error}).`
          : "Could not parse sitemap XML."
      )
    );
    recommendations.push({
      code: "FIX_XML",
      priority: "high",
      category: "xml",
      title: "Fix sitemap XML",
      message: "Ensure the document is well-formed XML with urlset or sitemapindex root.",
    });
  }

  if (parsed.type === "sitemapindex") {
    findings.push(
      finding(
        "SITEMAP_INDEX_DETECTED",
        "success",
        "structure",
        "Sitemap index",
        "Document is a sitemap index."
      )
    );
  }

  if (!parsed.entries.length && parsed.xmlValid) {
    findings.push(
      finding(
        "SITEMAP_EMPTY",
        "warning",
        "coverage",
        "Empty sitemap",
        "No URL or child sitemap entries were found."
      )
    );
  }

  const limit = Math.min(parsed.entries.length, MAX_URLS);
  if (parsed.entries.length > MAX_URLS) {
    findings.push(
      finding(
        "URL_LIMIT_REACHED",
        "warning",
        "coverage",
        "URL limit reached",
        `Only the first ${MAX_URLS} entries were analyzed.`
      )
    );
  }

  for (let i = 0; i < limit; i++) {
    const e = parsed.entries[i];
    const locCheck = validateLoc(e.loc);
    if (!locCheck.ok) {
      invalidUrls += 1;
      if (invalidUrls <= 5) {
        findings.push(
          finding(
            "INVALID_URL",
            "warning",
            "urls",
            "Invalid loc",
            e.loc
              ? `Invalid loc value: ${String(e.loc).slice(0, 120)}`
              : "Entry missing <loc>."
          )
        );
      }
      continue;
    }

    const href = locCheck.href;
    const key = href.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    validUrls += 1;

    if (parsed.type === "sitemapindex") {
      childSitemaps.push({ loc: href, lastmod: e.lastmod || null });
    } else {
      const lm = validateLastmod(e.lastmod);
      if (lm.present && lm.ok) lastmodOk += 1;
      else if (lm.present && !lm.ok) lastmodBad += 1;

      const cf = validateChangefreq(e.changefreq);
      if (cf.present && cf.ok) changefreqOk += 1;
      else if (cf.present && !cf.ok) changefreqBad += 1;

      const pr = validatePriority(e.priority);
      if (pr.present && pr.ok) priorityOk += 1;
      else if (pr.present && !pr.ok) priorityBad += 1;

      urls.push({
        loc: href,
        lastmod: e.lastmod || null,
        changefreq: e.changefreq || null,
        priority: e.priority != null ? e.priority : null,
      });
    }
  }

  if (duplicates) {
    findings.push(
      finding(
        "DUPLICATE_URL",
        "warning",
        "coverage",
        "Duplicate URLs",
        `${duplicates} duplicate loc value(s) detected.`
      )
    );
    recommendations.push({
      code: "REMOVE_DUPLICATES",
      priority: "medium",
      category: "coverage",
      title: "Remove duplicate URLs",
      message: "Each URL should appear once in the sitemap.",
    });
  }

  if (lastmodBad) {
    findings.push(
      finding(
        "INVALID_LASTMOD",
        "info",
        "metadata",
        "Invalid lastmod",
        `${lastmodBad} lastmod value(s) are not valid W3C dates.`
      )
    );
  }
  if (changefreqBad) {
    findings.push(
      finding(
        "INVALID_CHANGEFREQ",
        "info",
        "metadata",
        "Invalid changefreq",
        `${changefreqBad} changefreq value(s) are not standard.`
      )
    );
  }
  if (priorityBad) {
    findings.push(
      finding(
        "INVALID_PRIORITY",
        "info",
        "metadata",
        "Invalid priority",
        `${priorityBad} priority value(s) are outside 0.0–1.0.`
      )
    );
  }

  if (meta.truncatedUrls) {
    findings.push(
      finding(
        "URL_LIMIT_REACHED",
        "warning",
        "coverage",
        "Analysis truncated",
        "URL processing stopped due to configured limits."
      )
    );
  }
  if (meta.truncatedChildren) {
    findings.push(
      finding(
        "CHILD_SITEMAP_LIMIT_REACHED",
        "warning",
        "structure",
        "Child sitemap limit",
        "Not all child sitemaps were fetched due to limits."
      )
    );
  }

  return {
    findings,
    recommendations,
    stats: {
      urls: parsed.type === "urlset" ? validUrls + invalidUrls : 0,
      validUrls: parsed.type === "urlset" ? validUrls : 0,
      invalidUrls: parsed.type === "urlset" ? invalidUrls : 0,
      duplicates,
      lastmod: lastmodOk,
      lastmodInvalid: lastmodBad,
      changefreq: changefreqOk,
      changefreqInvalid: changefreqBad,
      priority: priorityOk,
      priorityInvalid: priorityBad,
      childSitemaps: childSitemaps.length,
      truncated: Boolean(meta.truncatedUrls || meta.truncatedChildren),
    },
    urls,
    childSitemaps,
  };
}
