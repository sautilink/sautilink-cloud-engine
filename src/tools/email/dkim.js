/**
 * DKIM public-key DNS analyzer.
 *
 * Inspects selector._domainkey.<domain> TXT records only.
 * Does NOT verify message signatures.
 *
 * Heuristic discovery uses bounded concurrency (not fully sequential and not
 * unbounded parallel) plus a shared overall deadline so worst-case latency is
 * not ~MAX_SELECTORS × per-query timeout.
 */

import { lookupDns } from "../dns/index.js";

/** Maximum selectors for automatic discovery (inclusive). */
export const MAX_DKIM_SELECTORS = 25;

/** Parallel DoH queries per discovery batch. */
export const DKIM_DISCOVERY_CONCURRENCY = 4;

/**
 * Shared wall-clock budget for the entire heuristic discovery pass (ms).
 * Individual DoH queries still use the DNS module timeout (~8s each).
 * This prevents effective worst-case ≈ 25 × 8s sequential latency.
 */
export const DKIM_DISCOVERY_DEADLINE_MS = 12_000;

/**
 * Curated common selectors for heuristic discovery.
 * Keep short and documented; extend carefully.
 */
export const COMMON_DKIM_SELECTORS = [
  "default",
  "google",
  "selector1",
  "selector2",
  "k1",
  "k2",
  "dkim",
  "mail",
  "email",
  "smtp",
  "s1",
  "s2",
  "mx",
  "mandrill",
  "sendgrid",
  "smtpapi",
  "zoho",
  "zmail",
  "protonmail",
  "protonmail2",
  "amazonses",
  "ses",
  "everlytickey1",
  "cm",
  "m1",
];

if (COMMON_DKIM_SELECTORS.length > MAX_DKIM_SELECTORS) {
  throw new Error("COMMON_DKIM_SELECTORS exceeds MAX_DKIM_SELECTORS");
}

/**
 * Validate a user-supplied selector label.
 * @param {string|null|undefined} input
 * @returns {{ selector: string } | { error: { code: string, message: string } } | { selector: null }}
 */
export function prepareSelector(input) {
  if (input === undefined || input === null || input === "") {
    return { selector: null };
  }
  if (typeof input !== "string") {
    return {
      error: {
        code: "INVALID_SELECTOR",
        message: "Selector must be a string.",
      },
    };
  }

  const raw = input.trim();
  if (!raw) {
    return { selector: null };
  }

  if (raw.length > 63) {
    return {
      error: {
        code: "INVALID_SELECTOR",
        message: "Selector exceeds the maximum length (63 characters).",
      },
    };
  }

  // DNS label-safe: letters, digits, hyphen; no dots/paths/protocols
  if (/[:/\\?#@\s]/.test(raw) || /\./.test(raw)) {
    return {
      error: {
        code: "INVALID_SELECTOR",
        message: "Selector contains invalid characters.",
      },
    };
  }

  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(raw)) {
    return {
      error: {
        code: "INVALID_SELECTOR",
        message: "Selector must be a valid DNS label.",
      },
    };
  }

  return { selector: raw.toLowerCase() };
}

function normalizeTxt(raw) {
  let s = String(raw).trim();
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  s = s.replace(/"\s*"/g, "");
  return s.replace(/\s+/g, "").length ? s.replace(/\s+/g, " ").trim() : s.trim();
}

/** Flatten TXT for key parsing (remove whitespace inside base64). */
function flattenKeySpaces(s) {
  return String(s).replace(/\s+/g, "");
}

function parseTags(record) {
  const tags = {};
  for (const part of record.split(";")) {
    const segment = part.trim();
    if (!segment) continue;
    const eq = segment.indexOf("=");
    if (eq <= 0) continue;
    const key = segment.slice(0, eq).trim().toLowerCase();
    const value = segment.slice(eq + 1).trim();
    if (!key) continue;
    if (tags[key] === undefined) tags[key] = value;
  }
  return tags;
}

function isDkimCandidate(text) {
  const t = text.trim();
  if (/\bp=/i.test(t)) return true;
  if (/\bv\s*=\s*DKIM1\b/i.test(t)) return true;
  return false;
}

/**
 * Analyze one selector's TXT answers.
 * @param {string[]} txtRecords
 * @param {string} selector
 * @param {"explicit"|"heuristic"} confidence
 */
export function analyzeDkimRecords(txtRecords, selector, confidence) {
  const list = Array.isArray(txtRecords) ? txtRecords : [];
  const candidates = [];

  for (const raw of list) {
    const text = normalizeTxt(raw);
    if (!text) continue;
    if (isDkimCandidate(text)) candidates.push(text);
  }

  if (candidates.length === 0) {
    return {
      status: "not_found",
      found: false,
      valid: null,
      selector,
      confidence,
      record: null,
      version: null,
      keyType: null,
      publicKey: null,
      revoked: false,
      warnings: [],
    };
  }

  if (candidates.length > 1) {
    return {
      status: "invalid",
      found: true,
      valid: false,
      selector,
      confidence,
      record: candidates[0],
      records: candidates,
      version: null,
      keyType: null,
      publicKey: null,
      revoked: false,
      warnings: ["Multiple DKIM candidate TXT records for this selector."],
      error: "MULTIPLE_DKIM_RECORDS",
    };
  }

  const record = candidates[0];
  const tags = parseTags(record);
  const warnings = [];

  let version = null;
  if (tags.v != null && tags.v !== "") {
    version = String(tags.v).toUpperCase();
    if (version !== "DKIM1") {
      return {
        status: "invalid",
        found: true,
        valid: false,
        selector,
        confidence,
        record,
        version,
        keyType: null,
        publicKey: null,
        revoked: false,
        warnings: [`Unsupported or invalid DKIM version: ${tags.v}.`],
        error: "INVALID_VERSION",
      };
    }
  } else {
    warnings.push(
      "DKIM record does not include v=DKIM1 (accepted because p= is present)."
    );
    version = null;
  }

  let keyType = "rsa";
  if (tags.k != null && tags.k !== "") {
    keyType = String(tags.k).toLowerCase();
    if (keyType !== "rsa" && keyType !== "ed25519") {
      warnings.push(`Unknown or uncommon DKIM key type: ${keyType}.`);
    }
  }

  if (tags.p === undefined) {
    return {
      status: "invalid",
      found: true,
      valid: false,
      selector,
      confidence,
      record,
      version: version || "DKIM1",
      keyType,
      publicKey: null,
      revoked: false,
      warnings: ["DKIM record is missing the p= public key tag."],
      error: "MISSING_PUBLIC_KEY",
    };
  }

  const pRaw = flattenKeySpaces(tags.p);
  if (pRaw === "") {
    return {
      status: "revoked",
      found: true,
      valid: true,
      selector,
      confidence,
      record,
      version: version || "DKIM1",
      keyType,
      publicKey: "",
      revoked: true,
      warnings: [
        "The selector exists but its public key is empty (p=), indicating key revocation.",
      ],
    };
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(pRaw)) {
    return {
      status: "invalid",
      found: true,
      valid: false,
      selector,
      confidence,
      record,
      version: version || "DKIM1",
      keyType,
      publicKey: pRaw,
      revoked: false,
      warnings: [
        "Public key contains characters outside the expected Base64 alphabet.",
      ],
      error: "INVALID_PUBLIC_KEY",
    };
  }

  if (pRaw.length < 32) {
    warnings.push("Public key is unusually short; verify this is intentional.");
  }

  const options = {};
  for (const [k, v] of Object.entries(tags)) {
    if (["v", "k", "p"].includes(k)) continue;
    options[k] = v;
  }

  return {
    status: "found",
    found: true,
    valid: true,
    selector,
    confidence,
    record,
    version: version || "DKIM1",
    keyType,
    publicKey: pRaw,
    revoked: false,
    options,
    warnings,
  };
}

/**
 * Lookup a single selector (one TXT DoH query).
 * @param {string} domain
 * @param {string} selector
 * @param {"explicit"|"heuristic"} confidence
 */
async function checkOneSelector(domain, selector, confidence) {
  const name = `${selector}._domainkey.${domain}`;
  const dns = await lookupDns(name, ["TXT"]);
  return analyzeDkimRecords(dns.records.TXT || [], selector, confidence);
}

/**
 * Run one discovery batch with bounded concurrency.
 * Returns results in the same order as `batch` (deterministic).
 *
 * @param {string} domain
 * @param {string[]} batch
 * @returns {Promise<Array<{ selector: string, result: object|null, error: object|null }>>}
 */
async function runDiscoveryBatch(domain, batch) {
  const settled = await Promise.all(
    batch.map(async (sel) => {
      try {
        const result = await checkOneSelector(domain, sel, "heuristic");
        return { selector: sel, result, error: null };
      } catch (err) {
        return { selector: sel, result: null, error: err };
      }
    })
  );
  return settled;
}

/**
 * Heuristic discovery: batches of DKIM_DISCOVERY_CONCURRENCY, early stop when
 * a candidate is found, deterministic pick by list order, shared deadline.
 *
 * @param {string} domain
 * @returns {Promise<object>}
 */
async function discoverDkimHeuristic(domain) {
  const list = COMMON_DKIM_SELECTORS.slice(0, MAX_DKIM_SELECTORS);
  const checked = [];
  const startedAt = Date.now();
  let timedOut = false;

  for (let i = 0; i < list.length; i += DKIM_DISCOVERY_CONCURRENCY) {
    if (Date.now() - startedAt >= DKIM_DISCOVERY_DEADLINE_MS) {
      timedOut = true;
      break;
    }

    const batch = list.slice(i, i + DKIM_DISCOVERY_CONCURRENCY);
    for (const sel of batch) checked.push(sel);

    const outcomes = await runDiscoveryBatch(domain, batch);

    // Propagate total resolver failure if every item failed the same way
    let resolverDeaths = 0;
    for (const o of outcomes) {
      if (o.error && o.error.code === "DNS_RESOLVER_ERROR") resolverDeaths += 1;
    }
    if (resolverDeaths === outcomes.length && outcomes.length > 0) {
      throw outcomes[0].error;
    }

    // Deterministic: first in COMMON_DKIM_SELECTORS order with found === true
    for (const o of outcomes) {
      if (o.result && o.result.found) {
        return {
          ...o.result,
          checkedSelectors: checked.slice(),
          confidence: "heuristic",
        };
      }
    }
  }

  const warnings = [
    "No DKIM record was found among the tested selectors. The domain may use a selector not included in automatic discovery.",
  ];
  if (timedOut) {
    warnings.push(
      `Heuristic discovery stopped after the shared deadline (${DKIM_DISCOVERY_DEADLINE_MS}ms); not all candidate selectors may have been checked.`
    );
  }

  return {
    status: "not_found",
    found: false,
    valid: null,
    selector: null,
    confidence: "heuristic",
    record: null,
    version: null,
    keyType: null,
    publicKey: null,
    revoked: false,
    checkedSelectors: checked,
    warnings,
  };
}

/**
 * @param {string} domain - normalized public domain
 * @param {string|null} selector - null for heuristic discovery
 * @returns {Promise<object>}
 */
export async function checkDkim(domain, selector) {
  if (selector) {
    const result = await checkOneSelector(domain, selector, "explicit");
    return {
      ...result,
      checkedSelectors: [selector],
    };
  }

  return discoverDkimHeuristic(domain);
}
