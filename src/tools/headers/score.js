/**
 * HTTP security headers score model v1.0
 * Configuration assessment only — not a security guarantee.
 */

export const HEADERS_SCORE_VERSION = "1.0";

export const WEIGHTS = {
  hsts: 15,
  csp: 25,
  contentType: 10,
  clickjacking: 15,
  referrer: 10,
  permissions: 10,
  cookies: 15,
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

function recommendation(code, priority, category, title, message) {
  return { code, priority, category, title, message };
}

/**
 * @param {object} analysis - output of analyzeHeaders
 * @param {{ protocol: string }} meta
 */
export function calculateHeadersSecurityScore(analysis, meta = {}) {
  const findings = [];
  const recommendations = [];
  const protocol = (meta.protocol || "").toLowerCase();
  const isHttps = protocol === "https";

  // --- HSTS (15) ---
  let hstsScore = 0;
  const hstsReasons = [];
  if (!isHttps) {
    hstsScore = 0;
    hstsReasons.push("HSTS only applies to HTTPS responses");
    findings.push(
      finding(
        "HSTS_HTTP_CONTEXT",
        "info",
        "hsts",
        "HTTP response",
        "HSTS is evaluated on HTTPS responses; this target used HTTP."
      )
    );
  } else if (!analysis.hsts.present) {
    hstsScore = 0;
    hstsReasons.push("Strict-Transport-Security missing");
    findings.push(
      finding(
        "HSTS_MISSING",
        "warning",
        "hsts",
        "HSTS missing",
        "No Strict-Transport-Security header on this HTTPS response."
      )
    );
    recommendations.push(
      recommendation(
        "ADD_HSTS",
        "high",
        "hsts",
        "Add Strict-Transport-Security",
        "Publish HSTS with a sufficient max-age (e.g. 15552000 or higher) after confirming HTTPS is stable."
      )
    );
  } else {
    hstsScore = 10;
    hstsReasons.push("HSTS present");
    if (analysis.hsts.maxAge != null && analysis.hsts.maxAge >= 15552000) {
      hstsScore += 3;
      hstsReasons.push(`max-age=${analysis.hsts.maxAge}`);
    } else if (analysis.hsts.maxAge != null && analysis.hsts.maxAge < 86400) {
      hstsScore = Math.min(hstsScore, 8);
      hstsReasons.push("max-age is very short");
      findings.push(
        finding(
          "HSTS_SHORT_MAX_AGE",
          "warning",
          "hsts",
          "Short HSTS max-age",
          `HSTS max-age is ${analysis.hsts.maxAge} seconds.`
        )
      );
    }
    if (analysis.hsts.includeSubDomains) {
      hstsScore += 1;
      hstsReasons.push("includeSubDomains");
    }
    if (analysis.hsts.preload) {
      hstsScore += 1;
      hstsReasons.push("preload");
    }
    hstsScore = clamp(hstsScore, 0, WEIGHTS.hsts);
    findings.push(
      finding(
        "HSTS_PRESENT",
        "success",
        "hsts",
        "HSTS configured",
        "Strict-Transport-Security is present."
      )
    );
  }

  // --- CSP (25) ---
  let cspScore = 0;
  const cspReasons = [];
  if (!analysis.csp.present) {
    cspScore = 0;
    cspReasons.push("Content-Security-Policy missing");
    findings.push(
      finding(
        "CSP_MISSING",
        "warning",
        "csp",
        "CSP missing",
        "No Content-Security-Policy header (heuristic analysis only)."
      )
    );
    recommendations.push(
      recommendation(
        "ADD_CSP",
        "high",
        "csp",
        "Add Content-Security-Policy",
        "Start with a restrictive CSP and expand as needed. This tool performs basic heuristic checks only."
      )
    );
  } else {
    cspScore = 15;
    cspReasons.push("CSP present");
    if (analysis.csp.hasUnsafeInline) {
      cspScore -= 4;
      cspReasons.push("contains unsafe-inline");
      findings.push(
        finding(
          "CSP_UNSAFE_INLINE",
          "warning",
          "csp",
          "CSP allows unsafe-inline",
          "Policy includes 'unsafe-inline' (heuristic)."
        )
      );
    }
    if (analysis.csp.hasUnsafeEval) {
      cspScore -= 4;
      cspReasons.push("contains unsafe-eval");
      findings.push(
        finding(
          "CSP_UNSAFE_EVAL",
          "warning",
          "csp",
          "CSP allows unsafe-eval",
          "Policy includes 'unsafe-eval' (heuristic)."
        )
      );
    }
    if (analysis.csp.hasWildcard) {
      cspScore -= 3;
      cspReasons.push("wildcard sources");
      findings.push(
        finding(
          "CSP_WILDCARD",
          "info",
          "csp",
          "CSP uses wildcards",
          "Policy appears to include broad wildcard sources (heuristic)."
        )
      );
    }
    if (analysis.csp.directives?.["frame-ancestors"]) {
      cspScore += 2;
      cspReasons.push("frame-ancestors set");
    }
    if (analysis.csp.directives?.["default-src"] || analysis.csp.directives?.["script-src"]) {
      cspScore += 2;
      cspReasons.push("default-src or script-src present");
    }
    cspScore = clamp(cspScore, 0, WEIGHTS.csp);
    findings.push(
      finding(
        "CSP_PRESENT",
        "success",
        "csp",
        "CSP present",
        "Content-Security-Policy header is present (basic parse only)."
      )
    );
  }

  // --- X-Content-Type-Options (10) ---
  let ctScore = 0;
  const ctReasons = [];
  if (analysis.xContentTypeOptions === "nosniff") {
    ctScore = 10;
    ctReasons.push("nosniff");
    findings.push(
      finding(
        "XCTO_NOSNIFF",
        "success",
        "contentType",
        "X-Content-Type-Options: nosniff",
        "MIME sniffing protection is enabled."
      )
    );
  } else if (analysis.xContentTypeOptions) {
    ctScore = 4;
    ctReasons.push(`present: ${analysis.xContentTypeOptions}`);
    recommendations.push(
      recommendation(
        "SET_NOSNIFF",
        "medium",
        "contentType",
        "Use nosniff",
        "Set X-Content-Type-Options to nosniff."
      )
    );
  } else {
    ctScore = 0;
    ctReasons.push("missing");
    findings.push(
      finding(
        "XCTO_MISSING",
        "warning",
        "contentType",
        "X-Content-Type-Options missing",
        "Consider adding X-Content-Type-Options: nosniff."
      )
    );
    recommendations.push(
      recommendation(
        "ADD_NOSNIFF",
        "medium",
        "contentType",
        "Add X-Content-Type-Options",
        "Set X-Content-Type-Options: nosniff."
      )
    );
  }

  // --- Clickjacking (15): XFO or CSP frame-ancestors ---
  let cjScore = 0;
  const cjReasons = [];
  const hasFa = Boolean(analysis.csp.directives?.["frame-ancestors"]);
  const xfo = (analysis.xFrameOptions || "").toUpperCase();
  if (hasFa || xfo === "DENY" || xfo === "SAMEORIGIN") {
    cjScore = hasFa && (xfo === "DENY" || xfo === "SAMEORIGIN") ? 15 : 13;
    cjReasons.push(hasFa ? "CSP frame-ancestors" : `X-Frame-Options: ${xfo}`);
    findings.push(
      finding(
        "CLICKJACKING_PROTECTED",
        "success",
        "clickjacking",
        "Framing protection present",
        hasFa
          ? "CSP frame-ancestors provides modern clickjacking protection."
          : `X-Frame-Options is ${xfo}.`
      )
    );
  } else if (xfo.startsWith("ALLOW-FROM")) {
    cjScore = 6;
    cjReasons.push("legacy ALLOW-FROM");
    findings.push(
      finding(
        "XFO_LEGACY",
        "warning",
        "clickjacking",
        "Legacy X-Frame-Options",
        "ALLOW-FROM is obsolete; prefer CSP frame-ancestors."
      )
    );
  } else {
    cjScore = 0;
    cjReasons.push("no framing protection detected");
    findings.push(
      finding(
        "CLICKJACKING_MISSING",
        "warning",
        "clickjacking",
        "No framing protection",
        "Neither CSP frame-ancestors nor effective X-Frame-Options was detected."
      )
    );
    recommendations.push(
      recommendation(
        "ADD_FRAME_PROTECTION",
        "high",
        "clickjacking",
        "Add framing protection",
        "Set CSP frame-ancestors and/or X-Frame-Options (DENY or SAMEORIGIN)."
      )
    );
  }

  // --- Referrer-Policy (10) ---
  let refScore = 0;
  const refReasons = [];
  const rp = (analysis.referrerPolicy || "").toLowerCase();
  const strongRp = new Set([
    "no-referrer",
    "same-origin",
    "strict-origin",
    "strict-origin-when-cross-origin",
  ]);
  if (!rp) {
    refScore = 3;
    refReasons.push("missing (browser default)");
    findings.push(
      finding(
        "REFERRER_MISSING",
        "info",
        "referrer",
        "Referrer-Policy missing",
        "Browsers apply a default; explicit policy is clearer."
      )
    );
    recommendations.push(
      recommendation(
        "ADD_REFERRER_POLICY",
        "low",
        "referrer",
        "Set Referrer-Policy",
        "Consider strict-origin-when-cross-origin or stricter."
      )
    );
  } else if (strongRp.has(rp)) {
    refScore = 10;
    refReasons.push(rp);
    findings.push(
      finding(
        "REFERRER_STRONG",
        "success",
        "referrer",
        "Referrer-Policy set",
        `Referrer-Policy is ${analysis.referrerPolicy}.`
      )
    );
  } else if (rp === "no-referrer-when-downgrade" || rp === "unsafe-url") {
    refScore = 4;
    refReasons.push(`weaker policy: ${rp}`);
    findings.push(
      finding(
        "REFERRER_WEAK",
        "info",
        "referrer",
        "Weaker Referrer-Policy",
        `Policy is ${analysis.referrerPolicy}.`
      )
    );
  } else {
    refScore = 7;
    refReasons.push(rp);
  }

  // --- Permissions-Policy (10) ---
  let ppScore = 0;
  const ppReasons = [];
  if (analysis.permissionsPolicy.present) {
    ppScore = 10;
    ppReasons.push("present");
    findings.push(
      finding(
        "PERMISSIONS_POLICY_PRESENT",
        "success",
        "permissions",
        "Permissions-Policy present",
        "Permissions-Policy (or Feature-Policy) header is present."
      )
    );
  } else {
    ppScore = 4;
    ppReasons.push("missing");
    findings.push(
      finding(
        "PERMISSIONS_POLICY_MISSING",
        "info",
        "permissions",
        "Permissions-Policy missing",
        "Optional but useful to restrict powerful browser features."
      )
    );
    recommendations.push(
      recommendation(
        "ADD_PERMISSIONS_POLICY",
        "low",
        "permissions",
        "Consider Permissions-Policy",
        "Restrict camera, microphone, geolocation, etc. as appropriate."
      )
    );
  }

  // --- Cookies (15) ---
  let cookieScore = 15;
  const cookieReasons = [];
  const cookies = analysis.cookies || [];
  if (cookies.length === 0) {
    cookieScore = 15;
    cookieReasons.push("no Set-Cookie on this response");
    findings.push(
      finding(
        "COOKIES_NONE",
        "info",
        "cookies",
        "No cookies set",
        "This response did not include Set-Cookie headers."
      )
    );
  } else {
    let issues = 0;
    for (const c of cookies) {
      if (isHttps && !c.secure) {
        issues += 1;
        findings.push(
          finding(
            "COOKIE_MISSING_SECURE",
            "warning",
            "cookies",
            `Cookie “${c.name}” missing Secure`,
            "Cookie on HTTPS response without Secure flag (value not disclosed)."
          )
        );
      }
      if (!c.httpOnly) {
        issues += 1;
        findings.push(
          finding(
            "COOKIE_MISSING_HTTPONLY",
            "info",
            "cookies",
            `Cookie “${c.name}” missing HttpOnly`,
            "Consider HttpOnly for session cookies (value not disclosed)."
          )
        );
      }
      if (!c.sameSite) {
        issues += 1;
        findings.push(
          finding(
            "COOKIE_MISSING_SAMESITE",
            "info",
            "cookies",
            `Cookie “${c.name}” missing SameSite`,
            "Consider SameSite=Lax or Strict (value not disclosed)."
          )
        );
      }
    }
    if (issues === 0) {
      cookieScore = 15;
      cookieReasons.push("cookie flags look reasonable");
    } else {
      cookieScore = clamp(15 - issues * 3, 0, 15);
      cookieReasons.push(`${issues} flag issue(s)`);
      recommendations.push(
        recommendation(
          "HARDEN_COOKIES",
          "medium",
          "cookies",
          "Harden cookie flags",
          "Prefer Secure (on HTTPS), HttpOnly, and SameSite for sensitive cookies."
        )
      );
    }
  }

  const total = clamp(
    hstsScore + cspScore + ctScore + cjScore + refScore + ppScore + cookieScore,
    0,
    100
  );
  const { grade, label } = gradeFor(total);

  if (recommendations.length === 0 && total >= 90) {
    recommendations.push(
      recommendation(
        "HEADERS_LOOK_STRONG",
        "info",
        "general",
        "No major header gaps detected",
        "HTTP security configuration score is high under model v1.0. This is not a proof of overall site security."
      )
    );
  }

  return {
    score: total,
    max: 100,
    percentage: total,
    grade,
    label,
    version: HEADERS_SCORE_VERSION,
    categories: {
      hsts: { score: hstsScore, max: WEIGHTS.hsts, reasons: hstsReasons },
      csp: { score: cspScore, max: WEIGHTS.csp, reasons: cspReasons },
      contentType: { score: ctScore, max: WEIGHTS.contentType, reasons: ctReasons },
      clickjacking: { score: cjScore, max: WEIGHTS.clickjacking, reasons: cjReasons },
      referrer: { score: refScore, max: WEIGHTS.referrer, reasons: refReasons },
      permissions: { score: ppScore, max: WEIGHTS.permissions, reasons: ppReasons },
      cookies: { score: cookieScore, max: WEIGHTS.cookies, reasons: cookieReasons },
    },
    findings,
    recommendations,
  };
}
