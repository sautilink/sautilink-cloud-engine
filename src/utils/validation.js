/**
 * Input validation & normalization utilities.
 * Prevents obvious SSRF and invalid domain/URL usage.
 */

const DOMAIN_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^localhost$/i,
];

/**
 * Normalize a domain: lowercase, strip protocol/path/port/trailing dot.
 * @param {string} input
 * @returns {string|null} normalized domain or null if invalid
 */
export function normalizeDomain(input) {
  if (!input || typeof input !== "string") return null;

  let value = input.trim().toLowerCase();

  // Strip protocol
  value = value.replace(/^https?:\/\//, "");
  // Strip path, query, fragment
  value = value.split("/")[0].split("?")[0].split("#")[0];
  // Strip port
  value = value.split(":")[0];
  // Strip trailing dot
  value = value.replace(/\.$/, "");

  if (!value || value.length > 253) return null;
  if (!DOMAIN_REGEX.test(value)) return null;

  // Block obvious private/localhost
  if (PRIVATE_IP_PATTERNS.some((re) => re.test(value))) return null;

  return value;
}

/**
 * Basic check whether a string looks like a public domain.
 * @param {string} domain
 * @returns {boolean}
 */
export function isValidDomain(domain) {
  return normalizeDomain(domain) !== null;
}

/**
 * Normalize URL and reject private/internal targets (SSRF guard).
 * Returns normalized URL string or null.
 * @param {string} input
 * @returns {string|null}
 */
export function normalizePublicUrl(input) {
  if (!input || typeof input !== "string") return null;

  let value = input.trim();
  if (!/^https?:\/\//i.test(value)) {
    value = "https://" + value;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(url.protocol)) return null;

  const host = url.hostname.toLowerCase();

  if (PRIVATE_IP_PATTERNS.some((re) => re.test(host))) return null;
  if (host === "localhost" || host.endsWith(".local")) return null;

  // Reject raw IPs that look private (simple heuristic)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (PRIVATE_IP_PATTERNS.some((re) => re.test(host))) return null;
  }

  return url.toString();
}
