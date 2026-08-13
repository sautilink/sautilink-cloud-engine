/**
 * Lightweight sitemap XML parser (no XXE / no external entities).
 * Regex/tag extraction — not a full DOM; sufficient for sitemap structures.
 */

const CHANGEFREQ = new Set([
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
]);

/**
 * @param {string} xml
 * @returns {{ type: 'urlset'|'sitemapindex'|'unknown', entries: object[], xmlValid: boolean, error?: string }}
 */
export function parseSitemapXml(xml) {
  const text = typeof xml === "string" ? xml : "";
  if (!text.trim()) {
    return { type: "unknown", entries: [], xmlValid: false, error: "empty" };
  }

  // Reject obvious entity bombs / doctype external refs
  if (/<!DOCTYPE/i.test(text) && /<!ENTITY/i.test(text)) {
    return {
      type: "unknown",
      entries: [],
      xmlValid: false,
      error: "entities_not_allowed",
    };
  }

  const lower = text.toLowerCase();
  const isIndex = lower.includes("<sitemapindex");
  const isUrlset = lower.includes("<urlset");

  if (!isIndex && !isUrlset) {
    // Still try to extract <loc> if present
    const locs = extractTags(text, "loc");
    if (!locs.length) {
      return {
        type: "unknown",
        entries: [],
        xmlValid: false,
        error: "unrecognized_root",
      };
    }
  }

  if (isIndex) {
    const blocks = extractBlocks(text, "sitemap");
    const entries = blocks.map((block) => {
      const loc = firstTag(block, "loc");
      const lastmod = firstTag(block, "lastmod");
      return { loc, lastmod };
    });
    return { type: "sitemapindex", entries, xmlValid: true };
  }

  const blocks = extractBlocks(text, "url");
  const entries = blocks.map((block) => {
    const loc = firstTag(block, "loc");
    const lastmod = firstTag(block, "lastmod");
    const changefreq = firstTag(block, "changefreq");
    const priority = firstTag(block, "priority");
    return { loc, lastmod, changefreq, priority };
  });

  return {
    type: isUrlset || entries.length ? "urlset" : "unknown",
    entries,
    xmlValid: true,
  };
}

function extractBlocks(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
    if (out.length > 20000) break;
  }
  return out;
}

function firstTag(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(block);
  if (!m) return null;
  return decodeXmlText(m[1].trim());
}

function extractTags(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push(decodeXmlText(m[1].trim()));
  }
  return out;
}

function decodeXmlText(s) {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * @param {string|null} loc
 */
export function validateLoc(loc) {
  if (!loc) return { ok: false, reason: "missing" };
  try {
    const u = new URL(loc);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, reason: "scheme" };
    }
    if (u.username || u.password) return { ok: false, reason: "credentials" };
    return { ok: true, href: u.toString() };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function validateLastmod(v) {
  if (v == null || v === "") return { ok: true, present: false };
  // W3C datetime subset
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v)) {
    return { ok: true, present: true };
  }
  return { ok: false, present: true };
}

export function validateChangefreq(v) {
  if (v == null || v === "") return { ok: true, present: false };
  if (CHANGEFREQ.has(String(v).toLowerCase())) return { ok: true, present: true };
  return { ok: false, present: true };
}

export function validatePriority(v) {
  if (v == null || v === "") return { ok: true, present: false };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) return { ok: false, present: true };
  return { ok: true, present: true, value: n };
}

/** Extract Sitemap: lines from robots.txt body (no fetch). */
export function extractSitemapRefsFromRobots(body) {
  const refs = [];
  const lines = String(body || "").split(/\r?\n/);
  for (const raw of lines) {
    let line = raw;
    const hash = line.indexOf("#");
    if (hash !== -1) line = line.slice(0, hash);
    line = line.trim();
    const m = /^sitemap\s*:\s*(.+)$/i.exec(line);
    if (m && m[1]) refs.push(m[1].trim());
  }
  return refs;
}
