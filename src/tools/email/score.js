/**
 * Email Security Score Engine v1.0
 *
 * Pure, deterministic scoring from MX/SPF/DMARC/DKIM analyzer output.
 * No network I/O. Not a guarantee of email security.
 */

export const SCORE_VERSION = "1.0";

/** Central weights (must sum to 100). */
export const WEIGHTS = {
  mx: 15,
  spf: 25,
  dmarc: 35,
  dkim: 25,
};

const GRADE_BANDS = [
  { min: 90, grade: "A", label: "Excellent" },
  { min: 80, grade: "B", label: "Good" },
  { min: 70, grade: "C", label: "Fair" },
  { min: 60, grade: "D", label: "Weak" },
  { min: 0, grade: "F", label: "Poor" },
];

function clamp(n, min, max) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function gradeFor(total) {
  for (const band of GRADE_BANDS) {
    if (total >= band.min) return { grade: band.grade, label: band.label };
  }
  return { grade: "F", label: "Poor" };
}

function finding(code, severity, category, title, message) {
  return { code, severity, category, title, message };
}

function recommendation(code, priority, category, title, message) {
  return { code, priority, category, title, message };
}

function scoreMx(mx) {
  const max = WEIGHTS.mx;
  const findings = [];
  const recommendations = [];
  const reasons = [];
  let score = 0;

  if (!mx || !mx.found) {
    score = 0;
    findings.push(
      finding(
        "MX_MISSING",
        "info",
        "mx",
        "No MX records",
        "This domain does not publish MX records. It may not receive email."
      )
    );
    reasons.push("No MX records published");
    return { score, max, reasons, findings, recommendations };
  }

  const records = Array.isArray(mx.records) ? mx.records : [];
  const nullOnly =
    records.length > 0 && records.every((r) => r.host === "." || r.host === "");

  if (nullOnly) {
    score = 0;
    findings.push(
      finding(
        "MX_NULL",
        "info",
        "mx",
        "Null MX (no mail)",
        "A null MX (priority host \'.\') indicates intentional non-acceptance of mail."
      )
    );
    reasons.push("Null MX — no mail delivery advertised");
    return { score, max, reasons, findings, recommendations };
  }

  score = 15;
  findings.push(
    finding(
      "MX_FOUND",
      "success",
      "mx",
      "MX records present",
      `Published ${records.length} MX record(s).`
    )
  );
  reasons.push("MX records present and structured");
  return { score, max, reasons, findings, recommendations };
}

function scoreSpf(spf) {
  const max = WEIGHTS.spf;
  const findings = [];
  const recommendations = [];
  const reasons = [];
  let score = 0;

  if (!spf || !spf.found) {
    score = 0;
    findings.push(
      finding(
        "SPF_MISSING",
        "error",
        "spf",
        "SPF missing",
        "No SPF (v=spf1) TXT record was found."
      )
    );
    recommendations.push(
      recommendation(
        "PUBLISH_SPF",
        "high",
        "spf",
        "Publish an SPF record",
        "Add a single v=spf1 TXT record listing authorized senders, typically ending with -all."
      )
    );
    reasons.push("SPF not found");
    return { score, max, reasons, findings, recommendations };
  }

  if (spf.valid === false || spf.error === "MULTIPLE_SPF_RECORDS") {
    score = 0;
    findings.push(
      finding(
        "SPF_MULTIPLE_RECORDS",
        "error",
        "spf",
        "Invalid SPF",
        spf.error === "MULTIPLE_SPF_RECORDS"
          ? "Multiple SPF records are published; SPF requires exactly one."
          : "SPF configuration is invalid."
      )
    );
    recommendations.push(
      recommendation(
        "FIX_SPF",
        "critical",
        "spf",
        "Fix SPF configuration",
        "Publish exactly one valid v=spf1 record."
      )
    );
    reasons.push("SPF invalid or multiple records");
    return { score, max, reasons, findings, recommendations };
  }

  const policy = spf.policy || "none";

  if (policy === "pass") {
    score = 5;
    findings.push(
      finding(
        "SPF_WEAK_POLICY",
        "error",
        "spf",
        "SPF uses +all",
        "+all allows any host to send as this domain."
      )
    );
    recommendations.push(
      recommendation(
        "RESTRICT_SPF_ALL",
        "critical",
        "spf",
        "Remove +all",
        "Replace +all with -all (or ~all during testing) after listing authorized mechanisms."
      )
    );
    reasons.push("Valid SPF but dangerous +all policy");
  } else if (policy === "neutral") {
    score = 12;
    findings.push(
      finding(
        "SPF_WEAK_POLICY",
        "warning",
        "spf",
        "SPF uses ?all",
        "Neutral all provides little protection against spoofing."
      )
    );
    recommendations.push(
      recommendation(
        "STRENGTHEN_SPF",
        "high",
        "spf",
        "Strengthen SPF terminal",
        "Prefer -all once authorized senders are fully listed."
      )
    );
    reasons.push("Valid SPF with weak ?all");
  } else if (policy === "none") {
    score = 14;
    findings.push(
      finding(
        "SPF_WEAK_POLICY",
        "warning",
        "spf",
        "SPF missing terminal all",
        "SPF has no terminating all mechanism."
      )
    );
    recommendations.push(
      recommendation(
        "ADD_SPF_ALL",
        "medium",
        "spf",
        "Add a terminal all mechanism",
        "End the SPF record with -all (or ~all while testing)."
      )
    );
    reasons.push("Valid SPF without terminal all");
  } else if (policy === "softfail") {
    score = 20;
    findings.push(
      finding(
        "SPF_STRONG_POLICY",
        "success",
        "spf",
        "SPF soft-fail",
        "SPF uses ~all (softfail)."
      )
    );
    recommendations.push(
      recommendation(
        "CONSIDER_SPF_HARDFAIL",
        "low",
        "spf",
        "Consider -all when ready",
        "After monitoring, -all provides stronger protection than ~all."
      )
    );
    reasons.push("Valid SPF with ~all");
  } else if (policy === "hardfail") {
    score = 25;
    findings.push(
      finding(
        "SPF_STRONG_POLICY",
        "success",
        "spf",
        "Strong SPF policy",
        "SPF uses -all."
      )
    );
    reasons.push("Valid SPF with -all");
  } else {
    score = 15;
    reasons.push("Valid SPF with unrecognized policy label");
  }

  // Minor deduction for include/redirect not expanded (info only, small)
  if (Array.isArray(spf.warnings)) {
    const hasInclude = spf.warnings.some((w) => /include/i.test(w));
    if (hasInclude && score >= 22) {
      score = Math.min(score, 22);
      reasons.push("Includes present (not expanded in this phase)");
    }
  }

  score = clamp(score, 0, max);
  return { score, max, reasons, findings, recommendations };
}

function scoreDmarc(dmarc) {
  const max = WEIGHTS.dmarc;
  const findings = [];
  const recommendations = [];
  const reasons = [];
  let score = 0;

  if (!dmarc || !dmarc.found) {
    score = 0;
    findings.push(
      finding(
        "DMARC_MISSING",
        "error",
        "dmarc",
        "DMARC missing",
        "No DMARC record was found at _dmarc.<domain>."
      )
    );
    recommendations.push(
      recommendation(
        "PUBLISH_DMARC",
        "high",
        "dmarc",
        "Publish a DMARC policy",
        "Start with p=none and rua reporting, then move toward quarantine/reject."
      )
    );
    reasons.push("DMARC not found");
    return { score, max, reasons, findings, recommendations };
  }

  if (dmarc.valid === false) {
    score = 5;
    findings.push(
      finding(
        "DMARC_INVALID",
        "error",
        "dmarc",
        "DMARC invalid",
        dmarc.error
          ? `DMARC record is invalid (${dmarc.error}).`
          : "DMARC record failed validation."
      )
    );
    recommendations.push(
      recommendation(
        "FIX_DMARC",
        "critical",
        "dmarc",
        "Fix DMARC record",
        "Ensure a single v=DMARC1 record with a valid p= policy."
      )
    );
    reasons.push("DMARC present but invalid");
    return { score, max, reasons, findings, recommendations };
  }

  const policy = dmarc.policy;
  const pct = dmarc.percentage == null ? 100 : Number(dmarc.percentage);
  const hasRua =
    Array.isArray(dmarc.reporting?.aggregate) &&
    dmarc.reporting.aggregate.length > 0;

  if (policy === "none") {
    score = 18;
    findings.push(
      finding(
        "DMARC_MONITORING_ONLY",
        "warning",
        "dmarc",
        "DMARC monitoring only",
        "DMARC publishes p=none (monitor mode)."
      )
    );
    recommendations.push(
      recommendation(
        "ENABLE_DMARC_ENFORCEMENT",
        "high",
        "dmarc",
        "Strengthen DMARC policy",
        "After reviewing aggregate reports, move toward p=quarantine or p=reject."
      )
    );
    reasons.push("Valid DMARC with p=none");
  } else if (policy === "quarantine") {
    score = 28;
    findings.push(
      finding(
        "DMARC_QUARANTINE_POLICY",
        "success",
        "dmarc",
        "DMARC quarantine",
        "DMARC publishes p=quarantine."
      )
    );
    recommendations.push(
      recommendation(
        "CONSIDER_DMARC_REJECT",
        "medium",
        "dmarc",
        "Consider p=reject",
        "When ready, p=reject provides stronger enforcement than quarantine."
      )
    );
    reasons.push("Valid DMARC with p=quarantine");
  } else if (policy === "reject") {
    score = 32;
    findings.push(
      finding(
        "DMARC_REJECT_POLICY",
        "success",
        "dmarc",
        "Strong DMARC enforcement",
        "DMARC publishes p=reject."
      )
    );
    reasons.push("Valid DMARC with p=reject");
  } else {
    score = 10;
    reasons.push("Valid DMARC with unexpected policy");
  }

  if (pct < 100) {
    score = Math.max(0, score - 4);
    findings.push(
      finding(
        "DMARC_PARTIAL_ENFORCEMENT",
        "warning",
        "dmarc",
        "Partial DMARC enforcement",
        `pct=${pct} means enforcement applies to only ${pct}% of messages.`
      )
    );
    recommendations.push(
      recommendation(
        "INCREASE_DMARC_PCT",
        "medium",
        "dmarc",
        "Increase pct to 100",
        "When monitoring confirms legitimacy, set pct=100."
      )
    );
    reasons.push(`pct=${pct} partial enforcement`);
  } else if (policy === "reject") {
    score = Math.min(max, score + 2); // room toward 34–35
    reasons.push("pct=100 full coverage");
  }

  if (hasRua) {
    if (policy === "reject" && pct >= 100) score = Math.min(max, score + 1);
    findings.push(
      finding(
        "DMARC_RUA_CONFIGURED",
        "success",
        "dmarc",
        "Aggregate reporting configured",
        "rua destinations are present."
      )
    );
    reasons.push("rua reporting configured");
  } else {
    score = Math.max(0, score - 1);
    recommendations.push(
      recommendation(
        "ADD_DMARC_RUA",
        "medium",
        "dmarc",
        "Configure aggregate reporting",
        "Add rua=mailto:... to receive aggregate DMARC reports."
      )
    );
    reasons.push("No rua aggregate reporting");
  }

  score = clamp(score, 0, max);
  return { score, max, reasons, findings, recommendations };
}

function scoreDkim(dkim) {
  const max = WEIGHTS.dkim;
  const findings = [];
  const recommendations = [];
  const reasons = [];
  let score = 0;

  if (!dkim || !dkim.found) {
    score = 0;
    const heuristic = dkim?.confidence === "heuristic";
    findings.push(
      finding(
        heuristic ? "DKIM_NOT_DETECTED" : "DKIM_NOT_DETECTED",
        "warning",
        "dkim",
        heuristic ? "DKIM not detected (heuristic)" : "DKIM not found for selector",
        heuristic
          ? "No DKIM public key was found among the tested selectors. The domain may use another selector."
          : "No DKIM public key was found for the requested selector."
      )
    );
    if (heuristic) {
      findings.push(
        finding(
          "DKIM_HEURISTIC_DISCOVERY",
          "info",
          "dkim",
          "Heuristic selector discovery",
          "Automatic discovery is not exhaustive; provide an explicit selector if known."
        )
      );
    }
    recommendations.push(
      recommendation(
        "CONFIGURE_DKIM",
        "high",
        "dkim",
        "Verify DKIM with your mail provider",
        "Confirm the selector used by your ESP and re-check with ?selector=."
      )
    );
    reasons.push(
      heuristic
        ? "DKIM not detected among tested selectors"
        : "DKIM not found for explicit selector"
    );
    return { score, max, reasons, findings, recommendations };
  }

  if (dkim.revoked) {
    score = 8;
    findings.push(
      finding(
        "DKIM_REVOKED",
        "warning",
        "dkim",
        "DKIM key revoked",
        "Selector exists but p= is empty (revoked key)."
      )
    );
    recommendations.push(
      recommendation(
        "ROTATE_DKIM",
        "high",
        "dkim",
        "Publish an active DKIM key",
        "Rotate or republish a non-empty DKIM public key for active selectors."
      )
    );
    reasons.push("DKIM selector revoked (empty p=)");
    return { score, max, reasons, findings, recommendations };
  }

  if (dkim.valid === false) {
    score = 5;
    findings.push(
      finding(
        "DKIM_INVALID",
        "error",
        "dkim",
        "DKIM record invalid",
        dkim.error
          ? `DKIM public-key record invalid (${dkim.error}).`
          : "DKIM public-key record failed validation."
      )
    );
    recommendations.push(
      recommendation(
        "FIX_DKIM",
        "high",
        "dkim",
        "Fix DKIM DNS record",
        "Ensure a single valid TXT at selector._domainkey with p=<key>."
      )
    );
    reasons.push("DKIM found but invalid");
    return { score, max, reasons, findings, recommendations };
  }

  // Valid usable key
  score = 25;
  findings.push(
    finding(
      "DKIM_FOUND",
      "success",
      "dkim",
      "DKIM public key configured",
      `Valid DKIM public-key record for selector “${dkim.selector}” (${dkim.keyType || "rsa"}).`
    )
  );
  reasons.push(`Valid DKIM key for selector ${dkim.selector}`);

  if (Array.isArray(dkim.warnings) && dkim.warnings.length) {
    const shortKey = dkim.warnings.some((w) => /short/i.test(w));
    if (shortKey) {
      score = 20;
      reasons.push("Public key unusually short");
    }
  }

  if (dkim.confidence === "heuristic") {
    findings.push(
      finding(
        "DKIM_HEURISTIC_DISCOVERY",
        "info",
        "dkim",
        "Found via heuristic discovery",
        "Selector was discovered from a common list; other selectors may also exist."
      )
    );
  }

  score = clamp(score, 0, max);
  return { score, max, reasons, findings, recommendations };
}

/**
 * @param {{ mx: object, spf: object, dmarc: object, dkim: object }}
 * @returns {object}
 */
export function calculateEmailSecurityScore({ mx, spf, dmarc, dkim }) {
  const mxR = scoreMx(mx);
  const spfR = scoreSpf(spf);
  const dmarcR = scoreDmarc(dmarc);
  const dkimR = scoreDkim(dkim);

  const total = clamp(
    mxR.score + spfR.score + dmarcR.score + dkimR.score,
    0,
    100
  );
  const { grade, label } = gradeFor(total);

  const findings = [
    ...mxR.findings,
    ...spfR.findings,
    ...dmarcR.findings,
    ...dkimR.findings,
  ];
  const recommendations = [
    ...mxR.recommendations,
    ...spfR.recommendations,
    ...dmarcR.recommendations,
    ...dkimR.recommendations,
  ];

  if (recommendations.length === 0 && total >= 90) {
    recommendations.push(
      recommendation(
        "NO_MAJOR_ISSUES",
        "info",
        "general",
        "No major email security improvements detected",
        "Published configuration looks strong under score model v1.0. This is not a guarantee of absolute security."
      )
    );
  }

  return {
    total,
    max: 100,
    percentage: total,
    grade,
    label,
    version: SCORE_VERSION,
    categories: {
      mx: { score: mxR.score, max: mxR.max, reasons: mxR.reasons },
      spf: { score: spfR.score, max: spfR.max, reasons: spfR.reasons },
      dmarc: { score: dmarcR.score, max: dmarcR.max, reasons: dmarcR.reasons },
      dkim: { score: dkimR.score, max: dkimR.max, reasons: dkimR.reasons },
    },
    findings,
    recommendations,
  };
}
