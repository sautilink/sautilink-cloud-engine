/**
 * DMARC TXT analyzer for _dmarc.<domain>.
 * DNS-only; does not send reports or fetch destinations.
 */

const KNOWN_TAGS = new Set([
  "v",
  "p",
  "sp",
  "pct",
  "rua",
  "ruf",
  "adkim",
  "aspf",
  "fo",
  "rf",
  "ri",
]);

const POLICIES = new Set(["none", "quarantine", "reject"]);

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeTxt(raw) {
  let s = String(raw).trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  s = s.replace(/"\s*"/g, "");
  return s.trim();
}

/**
 * Parse semicolon-separated DMARC tags into a map (lowercase keys).
 * @param {string} record
 * @returns {Record<string, string>}
 */
function parseTags(record) {
  const tags = {};
  const parts = record.split(";");
  for (const part of parts) {
    const segment = part.trim();
    if (!segment) continue;
    const eq = segment.indexOf("=");
    if (eq <= 0) continue;
    const key = segment.slice(0, eq).trim().toLowerCase();
    const value = segment.slice(eq + 1).trim();
    if (!key) continue;
    // First occurrence wins for duplicate tags within one record
    if (tags[key] === undefined) {
      tags[key] = value;
    }
  }
  return tags;
}

/**
 * @param {string} value
 * @returns {string[]}
 */
function parseMailtoList(value) {
  if (!value) return [];
  const out = [];
  for (const piece of value.split(",")) {
    const dest = piece.trim();
    if (!dest) continue;
    if (/^mailto:/i.test(dest)) {
      out.push(dest);
    }
    // Non-mailto destinations are ignored for safety (no HTTP callbacks)
  }
  return out;
}

/**
 * @param {string} value
 * @returns {string[]}
 */
function parseFo(value) {
  if (value == null || value === "") return [];
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * @param {string[]} txtRecords - TXT answers for _dmarc.<domain>
 * @returns {object}
 */
export function analyzeDmarc(txtRecords) {
  const list = Array.isArray(txtRecords) ? txtRecords : [];
  const dmarcRecords = [];

  for (const raw of list) {
    const text = normalizeTxt(raw);
    if (/^v\s*=\s*DMARC1(\s|;|$)/i.test(text) || /^v=DMARC1(\s|;|$)/i.test(text)) {
      // Normalize leading v tag spacing for storage
      dmarcRecords.push(text.replace(/^\s*v\s*=\s*/i, "v=").replace(/^v=dmarc1/i, "v=DMARC1"));
    }
  }

  if (dmarcRecords.length === 0) {
    return {
      found: false,
      valid: false,
      record: null,
      policy: null,
      subdomainPolicy: null,
      percentage: null,
      alignment: { dkim: null, spf: null },
      reporting: { aggregate: [], forensic: [] },
      options: {},
      warnings: ["No DMARC record found at _dmarc.<domain>."],
    };
  }

  if (dmarcRecords.length > 1) {
    return {
      found: true,
      valid: false,
      record: dmarcRecords[0],
      records: dmarcRecords,
      policy: null,
      subdomainPolicy: null,
      percentage: null,
      alignment: { dkim: null, spf: null },
      reporting: { aggregate: [], forensic: [] },
      options: {},
      warnings: [
        "Multiple DMARC records detected — only one v=DMARC1 record is allowed.",
      ],
      error: "MULTIPLE_DMARC_RECORDS",
    };
  }

  const record = dmarcRecords[0];
  const tags = parseTags(record);
  const warnings = [];
  const options = {};

  // Version
  if (!tags.v || String(tags.v).toUpperCase() !== "DMARC1") {
    return {
      found: true,
      valid: false,
      record,
      policy: null,
      subdomainPolicy: null,
      percentage: null,
      alignment: { dkim: null, spf: null },
      reporting: { aggregate: [], forensic: [] },
      options: {},
      warnings: ["DMARC record is missing a valid v=DMARC1 tag."],
      error: "INVALID_VERSION",
    };
  }

  // Policy p= (required)
  if (tags.p == null || tags.p === "") {
    return {
      found: true,
      valid: false,
      record,
      policy: null,
      subdomainPolicy: null,
      percentage: null,
      alignment: { dkim: null, spf: null },
      reporting: { aggregate: [], forensic: [] },
      options: {},
      warnings: ["DMARC record is missing the required p= policy tag."],
      error: "MISSING_POLICY",
    };
  }

  const policy = String(tags.p).toLowerCase();
  if (!POLICIES.has(policy)) {
    return {
      found: true,
      valid: false,
      record,
      policy: null,
      subdomainPolicy: null,
      percentage: null,
      alignment: { dkim: null, spf: null },
      reporting: { aggregate: [], forensic: [] },
      options: {},
      warnings: [`Invalid DMARC policy p=${tags.p}. Allowed: none, quarantine, reject.`],
      error: "INVALID_POLICY",
    };
  }

  // sp=
  let subdomainPolicy = null;
  if (tags.sp != null && tags.sp !== "") {
    const sp = String(tags.sp).toLowerCase();
    if (!POLICIES.has(sp)) {
      return {
        found: true,
        valid: false,
        record,
        policy,
        subdomainPolicy: null,
        percentage: null,
        alignment: { dkim: null, spf: null },
        reporting: { aggregate: [], forensic: [] },
        options: {},
        warnings: [`Invalid subdomain policy sp=${tags.sp}.`],
        error: "INVALID_SUBDOMAIN_POLICY",
      };
    }
    subdomainPolicy = sp;
  } else {
    warnings.push(
      "Subdomain policy (sp) is not set; subdomains inherit the organizational policy (p)."
    );
  }

  // pct=
  let percentage = 100;
  if (tags.pct != null && tags.pct !== "") {
    if (!/^\d{1,3}$/.test(String(tags.pct).trim())) {
      return {
        found: true,
        valid: false,
        record,
        policy,
        subdomainPolicy,
        percentage: null,
        alignment: { dkim: null, spf: null },
        reporting: { aggregate: [], forensic: [] },
        options: {},
        warnings: [`Invalid pct value: ${tags.pct}.`],
        error: "INVALID_PERCENTAGE",
      };
    }
    percentage = Number(String(tags.pct).trim());
    if (percentage < 0 || percentage > 100) {
      return {
        found: true,
        valid: false,
        record,
        policy,
        subdomainPolicy,
        percentage: null,
        alignment: { dkim: null, spf: null },
        reporting: { aggregate: [], forensic: [] },
        options: {},
        warnings: [`pct must be between 0 and 100 (got ${percentage}).`],
        error: "INVALID_PERCENTAGE",
      };
    }
  }

  // Alignment defaults: relaxed
  let adkim = "relaxed";
  let aspf = "relaxed";

  if (tags.adkim != null && tags.adkim !== "") {
    const v = String(tags.adkim).toLowerCase();
    if (v === "r") adkim = "relaxed";
    else if (v === "s") adkim = "strict";
    else {
      return {
        found: true,
        valid: false,
        record,
        policy,
        subdomainPolicy,
        percentage,
        alignment: { dkim: null, spf: null },
        reporting: { aggregate: [], forensic: [] },
        options: {},
        warnings: [`Invalid adkim=${tags.adkim}. Use r or s.`],
        error: "INVALID_ADKIM",
      };
    }
  }

  if (tags.aspf != null && tags.aspf !== "") {
    const v = String(tags.aspf).toLowerCase();
    if (v === "r") aspf = "relaxed";
    else if (v === "s") aspf = "strict";
    else {
      return {
        found: true,
        valid: false,
        record,
        policy,
        subdomainPolicy,
        percentage,
        alignment: { dkim: adkim, spf: null },
        reporting: { aggregate: [], forensic: [] },
        options: {},
        warnings: [`Invalid aspf=${tags.aspf}. Use r or s.`],
        error: "INVALID_ASPF",
      };
    }
  }

  const aggregate = parseMailtoList(tags.rua || "");
  const forensic = parseMailtoList(tags.ruf || "");

  // Unknown / extra known tags into options
  for (const [key, value] of Object.entries(tags)) {
    if (key === "v" || key === "p" || key === "sp" || key === "pct") continue;
    if (key === "rua" || key === "ruf" || key === "adkim" || key === "aspf") continue;
    if (key === "fo" || key === "rf" || key === "ri") {
      options[key] = value;
      continue;
    }
    if (!KNOWN_TAGS.has(key)) {
      options[key] = value;
      warnings.push(`Unknown DMARC tag preserved: ${key}=${value}`);
    }
  }

  if (tags.fo != null && tags.fo !== "") {
    options.fo = parseFo(tags.fo);
  }
  if (tags.rf != null && tags.rf !== "") {
    options.rf = String(tags.rf);
  }
  if (tags.ri != null && tags.ri !== "") {
    if (!/^\d+$/.test(String(tags.ri).trim())) {
      warnings.push(`ri value is not a valid integer: ${tags.ri}`);
    } else {
      options.ri = Number(String(tags.ri).trim());
    }
  }

  // Policy / reporting warnings
  if (policy === "none") {
    warnings.push("DMARC policy is monitoring-only (p=none).");
  } else if (policy === "quarantine") {
    warnings.push("DMARC policy quarantines failing messages but does not reject them (p=quarantine).");
  }
  // p=reject is strong enforcement — no negative warning

  if (percentage < 100) {
    warnings.push(
      `DMARC enforcement applies to only ${percentage}% of messages (pct=${percentage}).`
    );
  }

  if (aggregate.length === 0) {
    warnings.push("No aggregate reporting destination (rua) configured.");
  }

  if (forensic.length === 0) {
    // Informational only — not framed as a vulnerability
    warnings.push("No forensic reporting destination (ruf) configured.");
  }

  if (adkim === "strict") {
    warnings.push("Strict DKIM alignment enabled (adkim=s).");
  }
  if (aspf === "strict") {
    warnings.push("Strict SPF alignment enabled (aspf=s).");
  }

  return {
    found: true,
    valid: true,
    record,
    policy,
    subdomainPolicy,
    percentage,
    alignment: {
      dkim: adkim,
      spf: aspf,
    },
    reporting: {
      aggregate,
      forensic,
    },
    options,
    warnings,
  };
}
