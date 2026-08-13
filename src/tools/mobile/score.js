export const MOBILE_SCORE_VERSION = "1.0";

export const WEIGHTS = {
  viewportResponsive: 25,
  mobileSeo: 20,
  contentReadability: 20,
  imagesMedia: 15,
  navigationUsability: 10,
  technicalQuality: 10,
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
 * Mobile Score v1.0 — heuristic/configuration assessment only.
 * Not Google Mobile-Friendly Test, Lighthouse, or Core Web Vitals.
 */
export function calculateMobileScore(ctx) {
  const findings = [];
  const recommendations = [];
  const { viewport, signals, seo, html, truncated } = ctx;

  // Viewport & Responsive 25
  let vr = 0;
  if (!viewport.found) {
    findings.push(
      finding(
        "VIEWPORT_MISSING",
        "error",
        "viewport",
        "Missing viewport",
        "No viewport meta tag was found. Mobile browsers may render a desktop-width layout."
      )
    );
    recommendations.push({
      code: "ADD_VIEWPORT",
      priority: "critical",
      category: "viewport",
      title: "Add a mobile viewport",
      message:
        'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    });
    vr = 4;
  } else if (viewport.quality === "good") {
    vr = 22;
    if (!viewport.userScalableNo) vr = 25;
    else {
      vr = 20;
      findings.push(
        finding(
          "VIEWPORT_USER_SCALABLE_DISABLED",
          "warning",
          "viewport",
          "Zoom disabled",
          "Viewport disables user scaling, which can hurt accessibility on mobile."
        )
      );
    }
  } else if (viewport.quality === "fair") {
    vr = 14;
  } else {
    vr = 8;
    findings.push(
      finding(
        "VIEWPORT_POOR",
        "warning",
        "viewport",
        "Weak viewport configuration",
        "Viewport is present but missing device-width or uses a fixed width."
      )
    );
    recommendations.push({
      code: "FIX_VIEWPORT",
      priority: "high",
      category: "viewport",
      title: "Use width=device-width",
      message: "Prefer width=device-width and initial-scale=1 over fixed pixel widths.",
    });
  }
  if (signals.fixedWidthSignals.length) {
    vr = Math.min(vr, 16);
    findings.push(
      finding(
        "FIXED_WIDTH_LAYOUT",
        "warning",
        "viewport",
        "Fixed-width layout signals",
        `Detected: ${signals.fixedWidthSignals.slice(0, 3).join("; ")}.`
      )
    );
  }
  if (signals.overflowRisk) {
    findings.push(
      finding(
        "OVERFLOW_RISK",
        "info",
        "viewport",
        "Possible horizontal overflow risk",
        "Wide fixed dimensions or many wide images/tables may cause horizontal scrolling on small screens."
      )
    );
  }
  vr = clamp(vr, 0, 25);

  // Mobile SEO 20
  let mse = 8;
  if (seo.canonical.found && !seo.canonical.malformed) mse += 5;
  else if (!seo.canonical.found) {
    findings.push(
      finding(
        "MISSING_CANONICAL",
        "info",
        "seo",
        "Missing canonical",
        "No canonical link detected (informational for mobile SEO)."
      )
    );
  }
  if (seo.robots.found && seo.robots.noindex) {
    mse += 2;
    findings.push(
      finding(
        "META_NOINDEX",
        "warning",
        "seo",
        "noindex meta",
        "Robots meta includes noindex."
      )
    );
  } else mse += 5;
  if (seo.language) mse += 2;
  if (seo.mobileAlternate) {
    mse += 0; // separate mobile URL pattern — informational
    findings.push(
      finding(
        "MOBILE_ALTERNATE",
        "info",
        "seo",
        "Mobile alternate link",
        "A media-based mobile alternate was found. Prefer responsive design when possible."
      )
    );
  }
  mse = clamp(mse, 0, 20);

  // Content & Readability 20
  let cr = 14;
  if (signals.readability.riskSmallText) {
    cr = 8;
    findings.push(
      finding(
        "SMALL_TEXT",
        "warning",
        "readability",
        "Small font sizes",
        "Multiple sub-12px font-size declarations were found in HTML/CSS text."
      )
    );
    recommendations.push({
      code: "INCREASE_BASE_FONT",
      priority: "medium",
      category: "readability",
      title: "Avoid tiny text",
      message: "Use a readable base font size (often 16px equivalent) for body text on mobile.",
    });
  }
  if (signals.mediaRisks.tables > 5) {
    cr = Math.min(cr, 10);
    findings.push(
      finding(
        "MANY_TABLES",
        "info",
        "readability",
        "Many tables",
        "Several tables detected; wide tables can be hard to use on narrow screens."
      )
    );
  }
  cr = clamp(cr, 0, 20);

  // Images & Media 15
  let im = 8;
  const imgs = signals.images;
  if (imgs.total === 0) im = 10;
  else {
    const ratio = imgs.withSrcset / imgs.total;
    im = clamp(Math.round(6 + ratio * 7), 4, 13);
    if (imgs.withDimensions / imgs.total > 0.5) im = Math.min(15, im + 2);
    if (imgs.fixedWidthCount > 3) {
      im = Math.min(im, 9);
      findings.push(
        finding(
          "WIDE_IMAGES",
          "info",
          "images",
          "Wide fixed image widths",
          `${imgs.fixedWidthCount} image(s) declare width ≥ 800 without relying solely on responsive techniques.`
        )
      );
    }
    if (imgs.withSrcset === 0 && imgs.total > 2) {
      recommendations.push({
        code: "ADD_SRCSET",
        priority: "low",
        category: "images",
        title: "Consider responsive images",
        message: "srcset/sizes help serve appropriately sized images on mobile networks.",
      });
    }
  }
  if (signals.mediaRisks.iframes > 0) {
    im = Math.min(im, 12);
    findings.push(
      finding(
        "IFRAMES_PRESENT",
        "info",
        "images",
        "iframes present",
        `${signals.mediaRisks.iframes} iframe(s) found — ensure they are responsive (not fixed desktop widths).`
      )
    );
  }
  im = clamp(im, 0, 15);

  // Navigation & Usability 10
  let nav = 7;
  if (signals.navigation.density === "high") {
    nav = 4;
    findings.push(
      finding(
        "HIGH_LINK_DENSITY",
        "info",
        "navigation",
        "High link density",
        "Many links on one page can make tap targets harder on mobile."
      )
    );
  } else if (signals.navigation.density === "medium") nav = 6;
  else nav = 9;
  nav = clamp(nav, 0, 10);

  // Technical Quality 10
  let tq = 0;
  if (html.hasDoctype) tq += 3;
  if (html.hasHtml) tq += 2;
  if (html.hasHead) tq += 2;
  if (html.hasBody) tq += 2;
  if (html.https) tq += 1;
  if (truncated) {
    tq = Math.min(tq, 6);
    findings.push(
      finding(
        "HTML_TRUNCATED",
        "info",
        "technical",
        "HTML truncated",
        "Document exceeded the analyzer body limit; mobile analysis may be incomplete."
      )
    );
  }
  tq = clamp(tq, 0, 10);

  const total = clamp(vr + mse + cr + im + nav + tq, 0, 100);
  const { grade, label } = gradeFor(total);

  return {
    total,
    max: 100,
    percentage: total,
    grade,
    label,
    version: MOBILE_SCORE_VERSION,
    disclaimer:
      "Heuristic configuration assessment from primary HTML only. Not Google Mobile-Friendly Test, Lighthouse, or Core Web Vitals.",
    categories: {
      viewportResponsive: {
        score: vr,
        max: WEIGHTS.viewportResponsive,
        reasons: [],
      },
      mobileSeo: { score: mse, max: WEIGHTS.mobileSeo, reasons: [] },
      contentReadability: {
        score: cr,
        max: WEIGHTS.contentReadability,
        reasons: [],
      },
      imagesMedia: { score: im, max: WEIGHTS.imagesMedia, reasons: [] },
      navigationUsability: {
        score: nav,
        max: WEIGHTS.navigationUsability,
        reasons: [],
      },
      technicalQuality: {
        score: tq,
        max: WEIGHTS.technicalQuality,
        reasons: [],
      },
    },
    findings,
    recommendations,
  };
}
