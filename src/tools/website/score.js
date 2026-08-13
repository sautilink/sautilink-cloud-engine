export const WEBSITE_SCORE_VERSION = "1.0";

export const WEIGHTS = {
  technicalSeo: 25,
  onPageSeo: 25,
  performance: 15,
  security: 15,
  social: 10,
  htmlQuality: 10,
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

function finding(code, severity, category, title, message) {
  return { code, severity, category, title, message };
}

/**
 * @param {object} ctx
 */
export function calculateWebsiteScore(ctx) {
  const findings = [];
  const recommendations = [];
  const { seo, headings, images, social, html, security, performance, status } =
    ctx;

  // Technical SEO 25
  let technical = 0;
  const tReasons = [];
  if (seo.viewport.found) {
    technical += 6;
    tReasons.push("viewport");
  } else {
    findings.push(
      finding("MISSING_VIEWPORT", "warning", "technical", "Missing viewport", "No viewport meta tag detected.")
    );
    recommendations.push({
      code: "ADD_VIEWPORT",
      priority: "high",
      category: "technical",
      title: "Add viewport meta",
      message: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    });
  }
  if (seo.language.found) {
    technical += 5;
    tReasons.push("lang");
  } else {
    findings.push(
      finding("MISSING_LANG", "info", "technical", "Missing html lang", "html lang attribute not found.")
    );
  }
  if (seo.canonical.found && !seo.canonical.malformed) {
    technical += 7;
    tReasons.push("canonical");
  } else if (!seo.canonical.found) {
    findings.push(
      finding("MISSING_CANONICAL", "info", "technical", "Missing canonical", "No canonical link detected.")
    );
    recommendations.push({
      code: "ADD_CANONICAL",
      priority: "medium",
      category: "technical",
      title: "Add canonical URL",
      message: "Consider a rel=canonical link for duplicate-content control.",
    });
  } else {
    technical += 2;
    findings.push(
      finding("MALFORMED_CANONICAL", "warning", "technical", "Malformed canonical", "Canonical href could not be parsed.")
    );
  }
  if (seo.robots.found && seo.robots.noindex) {
    technical += 2;
    findings.push(
      finding("META_NOINDEX", "warning", "technical", "noindex meta", "Robots meta includes noindex.")
    );
  } else {
    technical += 5;
    tReasons.push("indexable_meta");
  }
  if (html.hasDoctype) technical += 2;
  technical = clamp(technical, 0, 25);

  // On-page 25
  let onPage = 0;
  if (seo.title.found) {
    if (seo.title.status === "ok") onPage += 10;
    else onPage += 6;
  } else {
    findings.push(
      finding("MISSING_TITLE", "error", "onpage", "Missing title", "No <title> tag found.")
    );
    recommendations.push({
      code: "ADD_TITLE",
      priority: "critical",
      category: "onpage",
      title: "Add a title tag",
      message: "Every page should have a unique descriptive title.",
    });
  }
  if (seo.description.found) {
    if (seo.description.status === "ok") onPage += 8;
    else onPage += 5;
  } else {
    findings.push(
      finding("MISSING_DESCRIPTION", "warning", "onpage", "Missing meta description", "No meta description found.")
    );
    recommendations.push({
      code: "ADD_DESCRIPTION",
      priority: "high",
      category: "onpage",
      title: "Add meta description",
      message: "Add a concise meta description for search snippets.",
    });
  }
  const h1c = (headings.h1 || []).length;
  if (h1c === 1) onPage += 5;
  else if (h1c === 0) {
    findings.push(
      finding("MISSING_H1", "warning", "onpage", "Missing H1", "No H1 heading detected.")
    );
    onPage += 1;
  } else {
    findings.push(
      finding("MULTIPLE_H1", "info", "onpage", "Multiple H1s", `${h1c} H1 headings found (informational).`)
    );
    onPage += 3;
  }
  if (images.total > 0) {
    if (images.missingAlt === 0) onPage += 2;
    else {
      findings.push(
        finding("IMAGES_MISSING_ALT", "warning", "onpage", "Images missing alt", `${images.missingAlt} image(s) missing alt attribute.`)
      );
    }
  } else onPage += 1;
  onPage = clamp(onPage, 0, 25);

  // Performance 15 (request-level only)
  let perf = 8;
  const ms = performance.responseTimeMs || 0;
  if (ms < 500) perf = 15;
  else if (ms < 1500) perf = 12;
  else if (ms < 3000) perf = 9;
  else perf = 5;
  if (performance.truncated) {
    perf = Math.min(perf, 7);
    findings.push(
      finding("HTML_TRUNCATED", "info", "performance", "HTML truncated", "Response exceeded the analyzer body size limit; analysis may be incomplete.")
    );
  }
  if (status >= 400) perf = Math.min(perf, 6);

  // Security 15
  let sec = 0;
  if (security.https) sec += 5;
  else {
    findings.push(
      finding("NOT_HTTPS", "warning", "security", "Not HTTPS", "Final URL is not HTTPS.")
    );
  }
  if (security.hsts) sec += 3;
  if (security.csp) sec += 3;
  if (security.xContentTypeOptions) sec += 2;
  if (security.xFrameOptions || security.frameAncestors) sec += 2;
  sec = clamp(sec, 0, 15);

  // Social 10
  let socialScore = 0;
  if (social.openGraph.present) socialScore += 6;
  else {
    findings.push(
      finding("MISSING_OG", "info", "social", "Missing Open Graph", "No Open Graph tags detected.")
    );
    recommendations.push({
      code: "ADD_OG",
      priority: "low",
      category: "social",
      title: "Add Open Graph tags",
      message: "og:title, og:description, and og:image improve link previews.",
    });
  }
  if (social.twitter.present) socialScore += 4;
  else socialScore += 1;
  socialScore = clamp(socialScore, 0, 10);

  // HTML quality 10
  let htmlQ = 0;
  if (html.hasDoctype) htmlQ += 3;
  if (html.hasHtml) htmlQ += 2;
  if (html.hasHead) htmlQ += 2;
  if (html.hasBody) htmlQ += 2;
  if (html.charset) htmlQ += 1;
  htmlQ = clamp(htmlQ, 0, 10);

  const total = clamp(
    technical + onPage + perf + sec + socialScore + htmlQ,
    0,
    100
  );
  const { grade, label } = gradeFor(total);

  return {
    total,
    max: 100,
    percentage: total,
    grade,
    label,
    version: WEBSITE_SCORE_VERSION,
    categories: {
      technicalSeo: { score: technical, max: WEIGHTS.technicalSeo, reasons: tReasons },
      onPageSeo: { score: onPage, max: WEIGHTS.onPageSeo, reasons: [] },
      performance: { score: perf, max: WEIGHTS.performance, reasons: ["request-level only"] },
      security: { score: sec, max: WEIGHTS.security, reasons: [] },
      social: { score: socialScore, max: WEIGHTS.social, reasons: [] },
      htmlQuality: { score: htmlQ, max: WEIGHTS.htmlQuality, reasons: [] },
    },
    findings,
    recommendations,
  };
}
