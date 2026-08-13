export const SITEMAP_SCORE_VERSION = "1.0";

export const WEIGHTS = {
  availability: 15,
  xml: 20,
  urls: 25,
  coverage: 20,
  metadata: 10,
  structure: 10,
};

function clamp(n, min, max) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function gradeFor(total) {
  if (total >= 90) return { grade: "A", label: "Excellent" };
  if (total >= 80) return { grade: "B", label: "Good" };
  if (total >= 70) return { grade: "C", label: "Fair" };
  if (total >= 60) return { grade: "D", label: "Weak" };
  return { grade: "F", label: "Poor" };
}

/**
 * @param {{ found: boolean, status?: number }}
 * @param {{ xmlValid: boolean, type: string }}
 * @param {{ stats: object, findings: object[], recommendations: object[] }}
 */
export function calculateSitemapScore(fetchMeta, parsed, analysis) {
  const findings = analysis.findings || [];
  const recommendations = analysis.recommendations || [];
  const stats = analysis.stats || {};

  let availability = 5;
  if (fetchMeta.found) availability = 15;
  else if (fetchMeta.status === 404) availability = 6;
  else availability = 4;

  let xml = 8;
  if (!fetchMeta.found) xml = 8;
  else if (parsed.xmlValid) xml = 20;
  else xml = 4;

  let urls = 12;
  if (fetchMeta.found && parsed.type === "urlset") {
    const total = (stats.validUrls || 0) + (stats.invalidUrls || 0);
    if (total === 0) urls = 8;
    else {
      const ratio = (stats.validUrls || 0) / total;
      urls = clamp(Math.round(ratio * 25), 5, 25);
    }
  } else if (parsed.type === "sitemapindex") {
    urls = 18;
  }

  let coverage = 12;
  if (stats.duplicates) coverage = clamp(18 - stats.duplicates, 5, 18);
  else if ((stats.validUrls || 0) > 0 || (stats.childSitemaps || 0) > 0)
    coverage = 18;
  if (stats.truncated) coverage = Math.min(coverage, 14);

  let metadata = 6;
  if (parsed.type === "urlset" && (stats.validUrls || 0) > 0) {
    const withMeta =
      (stats.lastmod || 0) + (stats.changefreq || 0) + (stats.priority || 0);
    metadata = withMeta > 0 ? 9 : 6;
    if ((stats.lastmodInvalid || 0) + (stats.priorityInvalid || 0) > 0)
      metadata = Math.min(metadata, 7);
  } else if (parsed.type === "sitemapindex") {
    metadata = 8;
  }

  let structure = 8;
  if (parsed.type === "sitemapindex" || parsed.type === "urlset") structure = 10;
  if (!parsed.xmlValid) structure = 3;

  const total = clamp(
    availability + xml + urls + coverage + metadata + structure,
    0,
    100
  );
  const { grade, label } = gradeFor(total);

  if (recommendations.length === 0 && total >= 90) {
    recommendations.push({
      code: "SITEMAP_LOOKS_GOOD",
      priority: "info",
      category: "general",
      title: "No major sitemap issues detected",
      message:
        "Configuration score is high under model v1.0. This is not a ranking guarantee.",
    });
  }

  return {
    total,
    max: 100,
    percentage: total,
    grade,
    label,
    version: SITEMAP_SCORE_VERSION,
    categories: {
      availability: {
        score: availability,
        max: WEIGHTS.availability,
        reasons: [],
      },
      xml: { score: xml, max: WEIGHTS.xml, reasons: [] },
      urls: { score: urls, max: WEIGHTS.urls, reasons: [] },
      coverage: { score: coverage, max: WEIGHTS.coverage, reasons: [] },
      metadata: { score: metadata, max: WEIGHTS.metadata, reasons: [] },
      structure: { score: structure, max: WEIGHTS.structure, reasons: [] },
    },
    findings,
    recommendations,
  };
}
