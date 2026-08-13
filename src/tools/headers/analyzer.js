/**
 * Parse response headers into structured security signals (heuristic).
 */

/**
 * @param {Record<string, string>} headers - lowercase keys, no Set-Cookie values
 * @param {Array<{name:string,secure:boolean,httpOnly:boolean,sameSite:string|null,path:string|null}>} cookies
 */
export function analyzeHeaders(headers, cookies = []) {
  const h = headers || {};

  const hstsRaw = h["strict-transport-security"] || null;
  const hsts = parseHsts(hstsRaw);

  const cspRaw = h["content-security-policy"] || null;
  const csp = parseCsp(cspRaw);

  const xcto = (h["x-content-type-options"] || "").trim().toLowerCase() || null;
  const xfo = (h["x-frame-options"] || "").trim() || null;
  const referrerPolicy = (h["referrer-policy"] || "").trim() || null;

  const ppRaw =
    h["permissions-policy"] || h["feature-policy"] || null;
  const permissionsPolicy = {
    present: Boolean(ppRaw),
    raw: ppRaw,
  };

  const coop = h["cross-origin-opener-policy"] || null;
  const corp = h["cross-origin-resource-policy"] || null;
  const coep = h["cross-origin-embedder-policy"] || null;

  return {
    hsts,
    csp,
    xContentTypeOptions: xcto,
    xFrameOptions: xfo,
    referrerPolicy,
    permissionsPolicy,
    crossOrigin: {
      coop,
      corp,
      coep,
    },
    cookies: Array.isArray(cookies) ? cookies : [],
    server: h.server || null,
    contentType: h["content-type"] || null,
    cacheControl: h["cache-control"] || null,
  };
}

function parseHsts(raw) {
  if (!raw) {
    return {
      present: false,
      maxAge: null,
      includeSubDomains: false,
      preload: false,
      raw: null,
    };
  }
  const lower = raw.toLowerCase();
  let maxAge = null;
  const m = /max-age\s*=\s*(\d+)/i.exec(raw);
  if (m) maxAge = Number(m[1]);
  return {
    present: true,
    maxAge,
    includeSubDomains: /includesubdomains/i.test(lower),
    preload: /preload/i.test(lower),
    raw,
  };
}

function parseCsp(raw) {
  if (!raw) {
    return {
      present: false,
      directives: {},
      hasUnsafeInline: false,
      hasUnsafeEval: false,
      hasWildcard: false,
      raw: null,
    };
  }
  const directives = {};
  const parts = raw.split(";");
  for (const part of parts) {
    const seg = part.trim();
    if (!seg) continue;
    const sp = seg.indexOf(" ");
    const name = (sp === -1 ? seg : seg.slice(0, sp)).trim().toLowerCase();
    const value = sp === -1 ? "" : seg.slice(sp + 1).trim();
    if (name) directives[name] = value;
  }
  const lower = raw.toLowerCase();
  return {
    present: true,
    directives,
    hasUnsafeInline: /'unsafe-inline'/.test(lower),
    hasUnsafeEval: /'unsafe-eval'/.test(lower),
    hasWildcard: /\s\*(\s|;|$)/.test(` ${lower} `) || /\s\*\./.test(lower),
    raw,
  };
}
