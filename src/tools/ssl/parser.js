/**
 * Parse Strict-Transport-Security header values.
 * Does not validate HSTS against RFC edge cases beyond common production usage.
 */

/**
 * @param {string|null|undefined} raw
 */
export function parseHsts(raw) {
  if (raw == null || String(raw).trim() === "") {
    return {
      present: false,
      raw: null,
      maxAge: null,
      includeSubDomains: false,
      preload: false,
      directives: [],
      malformed: false,
    };
  }

  const text = String(raw).trim();
  const directives = [];
  let maxAge = null;
  let includeSubDomains = false;
  let preload = false;
  let malformed = false;
  let sawMaxAge = false;

  for (const part of text.split(";")) {
    const piece = part.trim();
    if (!piece) continue;
    const eq = piece.indexOf("=");
    let name;
    let value = null;
    if (eq === -1) {
      name = piece.toLowerCase();
    } else {
      name = piece.slice(0, eq).trim().toLowerCase();
      value = piece.slice(eq + 1).trim();
    }
    directives.push({ name, value });

    if (name === "max-age") {
      sawMaxAge = true;
      if (value == null || !/^\d+$/.test(value)) {
        malformed = true;
      } else {
        maxAge = Number(value);
      }
    } else if (name === "includesubdomains") {
      includeSubDomains = true;
    } else if (name === "preload") {
      preload = true;
    }
  }

  if (!sawMaxAge) malformed = true;

  return {
    present: true,
    raw: text.slice(0, 500),
    maxAge,
    includeSubDomains,
    preload,
    directives,
    malformed,
  };
}
