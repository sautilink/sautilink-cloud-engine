/**
 * robots.txt configuration score v1.0
 */

export const ROBOTS_SCORE_VERSION = "1.0";

export const WEIGHTS = {
  availability: 20,
  syntax: 20,
  crawl: 30,
  sitemap: 15,
  quality: 15,
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
 * @param {object} fetchResult
 * @param {object|null} parsed
 * @param {{ findings: object[], recommendations: object[] }} analysis
 */
export function calculateRobotsScore(fetchResult, parsed, analysis) {
  const findings = analysis.findings || [];
  const recommendations = analysis.recommendations || [];

  // Availability 20
  let availability = 10;
  const aReasons = [];
  if (fetchResult.found) {
    availability = 20;
    aReasons.push("robots.txt returned");
  } else if (fetchResult.status === 404 || fetchResult.status === 410) {
    availability = 12;
    aReasons.push("not found (allowed)");
  } else if (fetchResult.forbidden) {
    availability = 6;
    aReasons.push("forbidden");
  } else {
    availability = 4;
    aReasons.push("unavailable");
  }

  // Syntax 20
  let syntax = 10;
  const sReasons = [];
  if (!fetchResult.found) {
    syntax = 12;
    sReasons.push("no file to parse");
  } else if (parsed) {
    syntax = 18;
    sReasons.push("parsed");
    if (parsed.malformedLines?.length) {
      syntax -= Math.min(6, parsed.malformedLines.length);
      sReasons.push("malformed lines");
    }
    if (parsed.unknownDirectives?.length) {
      syntax -= 1;
      sReasons.push("unknown directives");
    }
    syntax = clamp(syntax, 0, 20);
  }

  // Crawl rules 30
  let crawl = 15;
  const cReasons = [];
  if (!fetchResult.found) {
    crawl = 18;
    cReasons.push("default crawl behavior (no robots)");
  } else if (parsed) {
    crawl = 22;
    cReasons.push("rules present");
    const blocksAll = findings.some((f) => f.code === "ROBOTS_BLOCKS_ALL");
    if (blocksAll) {
      crawl = 10;
      cReasons.push("blocks all for *");
    } else if (parsed.groups.length) {
      crawl = 28;
      cReasons.push("structured groups");
    }
    if (parsed.groups.some((g) => g.userAgents.includes("*") && g.disallow.includes(""))) {
      crawl = Math.max(crawl, 26);
      cReasons.push("empty disallow for *");
    }
  }
  crawl = clamp(crawl, 0, 30);

  // Sitemap 15 — not critical if missing
  let sitemap = 8;
  const mReasons = [];
  if (!fetchResult.found) {
    sitemap = 8;
    mReasons.push("no robots file");
  } else if (parsed?.sitemaps?.length) {
    const valid = parsed.sitemaps.filter((s) => {
      try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    });
    if (valid.length) {
      sitemap = 15;
      mReasons.push("valid sitemap URL(s)");
    } else {
      sitemap = 4;
      mReasons.push("invalid sitemap URL(s)");
    }
  } else {
    sitemap = 8;
    mReasons.push("no sitemap directive");
  }

  // Quality 15
  let quality = 10;
  const qReasons = [];
  if (fetchResult.found && parsed) {
    quality = 12;
    if (parsed.groups.length && !parsed.malformedLines?.length) {
      quality = 14;
      qReasons.push("clean structure");
    }
    if (findings.some((f) => f.code === "ROBOTS_NONSTANDARD_HOST")) {
      quality -= 1;
      qReasons.push("non-standard Host");
    }
  } else {
    quality = 10;
    qReasons.push("baseline");
  }
  quality = clamp(quality, 0, 15);

  const total = clamp(
    availability + syntax + crawl + sitemap + quality,
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
    version: ROBOTS_SCORE_VERSION,
    categories: {
      availability: {
        score: availability,
        max: WEIGHTS.availability,
        reasons: aReasons,
      },
      syntax: { score: syntax, max: WEIGHTS.syntax, reasons: sReasons },
      crawl: { score: crawl, max: WEIGHTS.crawl, reasons: cReasons },
      sitemap: { score: sitemap, max: WEIGHTS.sitemap, reasons: mReasons },
      quality: { score: quality, max: WEIGHTS.quality, reasons: qReasons },
    },
    findings,
    recommendations,
  };
}
