/**
 * Basic SPF analyzer (not full recursive RFC evaluation).
 *
 * Detects multiple SPF TXT records, policy terminal, and common mechanisms.
 * Does NOT expand include:/redirect: or enforce the 10-DNS-lookup limit.
 */

/**
 * Unquote / flatten a single TXT string from DoH.
 * @param {string} raw
 * @returns {string}
 */
function normalizeTxt(raw) {
  let s = String(raw).trim();
  // Cloudflare may return quoted chunks
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  s = s.replace(/"\s*"/g, "");
  return s.trim();
}

/**
 * @param {string} record - full v=spf1 ... string
 * @returns {{ mechanisms: object[], policy: string, warnings: string[] }}
 */
function analyzeSpfRecord(record) {
  const mechanisms = [];
  const warnings = [];
  let policy = "none";

  // Tokenize on whitespace; keep qualifier with mechanism
  const tokens = record.split(/\s+/).filter(Boolean);
  // Skip leading v=spf1
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^v=spf1$/i.test(token)) continue;

    const m = token.match(/^([+~?-]?)([a-zA-Z0-9]+)(?::(.*))?$/);
    if (!m) {
      mechanisms.push({ raw: token, type: "unknown" });
      continue;
    }

    const qualifier = m[1] || "+";
    const type = m[2].toLowerCase();
    const value = m[3] != null ? m[3] : null;

    if (type === "all") {
      const q = qualifier === "" ? "+" : qualifier;
      if (q === "-") policy = "hardfail";
      else if (q === "~") policy = "softfail";
      else if (q === "?") policy = "neutral";
      else policy = "pass";

      mechanisms.push({
        type: "all",
        qualifier: q,
        value: null,
        raw: token,
      });
      continue;
    }

    mechanisms.push({
      type,
      qualifier: qualifier || "+",
      value,
      raw: token,
    });
  }

  const types = new Set(mechanisms.map((x) => x.type));

  if (policy === "pass") {
    warnings.push("SPF uses +all, which allows any sender — serious security risk.");
  } else if (policy === "softfail") {
    warnings.push("SPF uses ~all (softfail). Consider -all for stronger protection once testing is complete.");
  } else if (policy === "neutral") {
    warnings.push("SPF uses ?all (neutral), which provides little protection.");
  } else if (policy === "none") {
    warnings.push("SPF has no terminating all mechanism.");
  }

  if (types.has("include")) {
    warnings.push("SPF includes one or more include: mechanisms (not expanded in this phase).");
  }
  if (types.has("redirect")) {
    warnings.push("SPF uses redirect: (not followed in this phase).");
  }

  return { mechanisms, policy, warnings };
}

/**
 * Analyze TXT records for SPF.
 * @param {string[]} txtRecords
 * @returns {object}
 */
export function analyzeSpf(txtRecords) {
  const list = Array.isArray(txtRecords) ? txtRecords : [];
  const spfRecords = [];

  for (const raw of list) {
    const text = normalizeTxt(raw);
    if (/^v=spf1(\s|$)/i.test(text)) {
      spfRecords.push(text);
    }
  }

  const recordCount = spfRecords.length;

  if (recordCount === 0) {
    return {
      found: false,
      valid: false,
      recordCount: 0,
      record: null,
      policy: "none",
      mechanisms: [],
      warnings: ["SPF record missing."],
    };
  }

  if (recordCount > 1) {
    return {
      found: true,
      valid: false,
      recordCount,
      record: spfRecords[0],
      records: spfRecords,
      policy: "none",
      mechanisms: [],
      warnings: ["Multiple SPF records detected — SPF is invalid when more than one v=spf1 record exists."],
      error: "MULTIPLE_SPF_RECORDS",
    };
  }

  const record = spfRecords[0];
  const { mechanisms, policy, warnings } = analyzeSpfRecord(record);

  return {
    found: true,
    valid: true,
    recordCount: 1,
    record,
    policy,
    mechanisms,
    warnings,
  };
}
