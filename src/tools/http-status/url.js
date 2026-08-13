/**
 * URL preparation for the HTTP status tool.
 */

import { LIMITS } from "../../utils/security.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Prepare and validate a user-supplied URL for outbound checks.
 * Does not perform DNS/SSRF IP checks (see ssrf.js).
 *
 * @param {string|null|undefined} input
 * @returns {{ url: URL, href: string } | { error: { code: string, message: string } }}
 */
export function prepareUrl(input) {
  if (input === undefined || input === null || typeof input !== "string") {
    return {
      error: {
        code: "MISSING_URL",
        message: "Please provide a url query parameter.",
      },
    };
  }

  const raw = input.trim();
  if (!raw) {
    return {
      error: {
        code: "MISSING_URL",
        message: "Please provide a url query parameter.",
      },
    };
  }

  if (raw.length > LIMITS.MAX_URL_LENGTH) {
    return {
      error: {
        code: "INVALID_URL",
        message: "URL exceeds the maximum allowed length.",
      },
    };
  }

  // Reject obvious non-http schemes before URL parser normalizes oddly
  const schemeMatch = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase() + ":";
    if (!ALLOWED_PROTOCOLS.has(scheme)) {
      return {
        error: {
          code: "UNSUPPORTED_PROTOCOL",
          message: "Only http and https URLs are supported.",
        },
      };
    }
  }

  let normalized = raw;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized)) {
    normalized = "https://" + normalized;
  }

  let url;
  try {
    url = new URL(normalized);
  } catch {
    return {
      error: {
        code: "INVALID_URL",
        message: "Please provide a valid URL.",
      },
    };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return {
      error: {
        code: "UNSUPPORTED_PROTOCOL",
        message: "Only http and https URLs are supported.",
      },
    };
  }

  if (url.username || url.password) {
    return {
      error: {
        code: "CREDENTIALS_NOT_ALLOWED",
        message: "URLs must not contain usernames or passwords.",
      },
    };
  }

  if (!url.hostname) {
    return {
      error: {
        code: "INVALID_URL",
        message: "Please provide a valid URL with a hostname.",
      },
    };
  }

  // Normalize hostname case; keep path/query as provided by URL parser
  url.hostname = url.hostname.toLowerCase();

  return { url, href: url.toString() };
}
