export const SSL_SCORE_VERSION = "1.0";

/** Observable HTTPS configuration only — no certificate points. */
export const WEIGHTS = {
  httpsProtocol: 25,
  httpsRedirect: 15,
  hsts: 35,
  hstsQuality: 15,
  consistency: 10,
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
 * Score only observable HTTPS/HSTS configuration.
 * Certificate-level properties intentionally award 0 points (not observable).
 */
export function calculateSslScore(analysis) {
  const findings = [];
  const recommendations = [];

  // HTTPS / protocol 25
  let httpsPts = 0;
  if (analysis.https.available && analysis.https.protocol === "https:") {
    httpsPts = 25;
  } else if (analysis.https.available) {
    httpsPts = 10;
    findings.push(
      finding(
        "FINAL_NOT_HTTPS",
        "warning",
        "https",
        "Final protocol is not HTTPS",
        "A connection completed but the final URL protocol was not https:."
      )
    );
  } else {
    findings.push(
      finding(
        "HTTPS_UNAVAILABLE",
        "error",
        "https",
        "HTTPS not available",
        analysis.https.error?.message ||
          "Could not complete an HTTPS request to the target."
      )
    );
    recommendations.push({
      code: "ENABLE_HTTPS",
      priority: "critical",
      category: "https",
      title: "Enable HTTPS",
      message: "Serve the site over HTTPS with a valid certificate trusted by clients.",
    });
  }

  // HTTPS redirect 15 (HTTP→HTTPS when HTTP was checked)
  let redirPts = 8;
  if (analysis.httpUpgrade.checked) {
    if (analysis.httpUpgrade.redirectsToHttps) {
      redirPts = 15;
    } else if (analysis.httpUpgrade.finalProtocol === "http:") {
      redirPts = 3;
      findings.push(
        finding(
          "NO_HTTPS_REDIRECT",
          "warning",
          "redirect",
          "HTTP does not upgrade to HTTPS",
          "The HTTP endpoint did not redirect to HTTPS."
        )
      );
      recommendations.push({
        code: "REDIRECT_HTTP_TO_HTTPS",
        priority: "high",
        category: "redirect",
        title: "Redirect HTTP to HTTPS",
        message: "Configure a permanent redirect from http:// to https://.",
      });
    } else {
      redirPts = 10;
    }
  } else {
    redirPts = 10; // neutral when HTTP not probed (e.g. only https input path failed early)
  }

  // HSTS presence 35
  let hstsPts = 0;
  const h = analysis.hsts;
  if (!h.present) {
    hstsPts = 5;
    findings.push(
      finding(
        "HSTS_MISSING",
        "warning",
        "hsts",
        "HSTS not present",
        "Strict-Transport-Security header was not observed on the HTTPS response."
      )
    );
    recommendations.push({
      code: "ADD_HSTS",
      priority: "high",
      category: "hsts",
      title: "Enable HSTS",
      message:
        "Send Strict-Transport-Security with a sufficient max-age on HTTPS responses.",
    });
  } else if (h.malformed || h.maxAge == null) {
    hstsPts = 12;
    findings.push(
      finding(
        "HSTS_MALFORMED",
        "warning",
        "hsts",
        "HSTS malformed or missing max-age",
        "HSTS header was present but max-age was missing or not a valid number."
      )
    );
  } else {
    hstsPts = 30;
    if (h.maxAge >= 31536000) hstsPts = 35;
    else if (h.maxAge >= 86400) hstsPts = 28;
    else {
      hstsPts = 20;
      findings.push(
        finding(
          "HSTS_SHORT_MAX_AGE",
          "info",
          "hsts",
          "Short HSTS max-age",
          `max-age is ${h.maxAge} seconds; longer values (e.g. 31536000) are common for production.`
        )
      );
    }
  }

  // HSTS quality 15
  let qualityPts = 5;
  if (h.present && !h.malformed && h.maxAge != null) {
    qualityPts = 8;
    if (h.includeSubDomains) qualityPts += 4;
    else {
      findings.push(
        finding(
          "HSTS_NO_SUBDOMAINS",
          "info",
          "hsts",
          "includeSubDomains not set",
          "HSTS does not include includeSubDomains (optional depending on site structure)."
        )
      );
    }
    if (h.preload) qualityPts += 3;
    qualityPts = clamp(qualityPts, 0, 15);
  } else {
    qualityPts = 2;
  }

  // Security consistency 10
  let consPts = 8;
  if (analysis.redirects.httpsToHttpDowngrade) {
    consPts = 2;
    findings.push(
      finding(
        "HTTPS_TO_HTTP_DOWNGRADE",
        "error",
        "consistency",
        "HTTPS → HTTP redirect",
        "A redirect from HTTPS to HTTP was observed, which weakens transport security."
      )
    );
    recommendations.push({
      code: "AVOID_HTTPS_DOWNGRADE",
      priority: "critical",
      category: "consistency",
      title: "Do not redirect HTTPS to HTTP",
      message: "Keep users on HTTPS end-to-end.",
    });
  } else if (analysis.https.available) {
    consPts = 10;
  }

  const total = clamp(
    httpsPts + redirPts + hstsPts + qualityPts + consPts,
    0,
    100
  );
  const { grade, label } = gradeFor(total);

  findings.push(
    finding(
      "TLS_CERT_NOT_OBSERVABLE",
      "info",
      "tls",
      "Certificate details not observable",
      "Issuer, SANs, expiry, chain, TLS version, and cipher are not exposed by Pages Functions fetch and are not scored."
    )
  );

  return {
    total,
    max: 100,
    percentage: total,
    grade,
    label,
    version: SSL_SCORE_VERSION,
    disclaimer:
      "This score evaluates observable HTTPS/TLS configuration. It does not perform a raw TLS handshake or independently validate the certificate chain unless supported by the runtime.",
    categories: {
      httpsProtocol: { score: httpsPts, max: WEIGHTS.httpsProtocol, reasons: [] },
      httpsRedirect: { score: redirPts, max: WEIGHTS.httpsRedirect, reasons: [] },
      hsts: { score: hstsPts, max: WEIGHTS.hsts, reasons: [] },
      hstsQuality: { score: qualityPts, max: WEIGHTS.hstsQuality, reasons: [] },
      consistency: { score: consPts, max: WEIGHTS.consistency, reasons: [] },
    },
    findings,
    recommendations,
  };
}
