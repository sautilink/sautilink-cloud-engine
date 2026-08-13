/**
 * robots.txt parser — groups, allow/disallow, sitemap, unknown directives.
 */

const KNOWN = new Set([
  "user-agent",
  "allow",
  "disallow",
  "sitemap",
  "host",
  "crawl-delay",
]);

/**
 * @param {string} body
 * @returns {object}
 */
export function parseRobotsTxt(body) {
  const text = typeof body === "string" ? body : "";
  const lines = text.split(/\r?\n/);
  const groups = [];
  const sitemaps = [];
  const hosts = [];
  const unknownDirectives = [];
  const malformedLines = [];
  let current = null;

  function flush() {
    if (current && current.userAgents.length) {
      groups.push({
        userAgents: current.userAgents.slice(),
        allow: current.allow.slice(),
        disallow: current.disallow.slice(),
        crawlDelay: current.crawlDelay,
      });
    }
    current = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let line = lines[i];
    const hash = line.indexOf("#");
    if (hash !== -1) line = line.slice(0, hash);
    line = line.trim();
    if (!line) continue;

    const colon = line.indexOf(":");
    if (colon <= 0) {
      if (malformedLines.length < 20) {
        malformedLines.push({
          line: lineNo,
          content: line.slice(0, 200),
        });
      }
      continue;
    }

    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (!name) {
      if (malformedLines.length < 20) {
        malformedLines.push({ line: lineNo, content: line.slice(0, 200) });
      }
      continue;
    }

    if (name === "user-agent") {
      const ua = value || "*";
      // New group if previous group already has rules
      if (
        current &&
        (current.allow.length ||
          current.disallow.length ||
          current.crawlDelay != null)
      ) {
        flush();
      }
      if (!current) {
        current = {
          userAgents: [],
          allow: [],
          disallow: [],
          crawlDelay: null,
        };
      }
      current.userAgents.push(ua);
      continue;
    }

    if (name === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    if (name === "host") {
      if (value) hosts.push(value);
      continue;
    }

    if (name === "allow" || name === "disallow" || name === "crawl-delay") {
      if (!current) {
        current = {
          userAgents: ["*"],
          allow: [],
          disallow: [],
          crawlDelay: null,
        };
      }
      if (name === "allow") current.allow.push(value);
      else if (name === "disallow") current.disallow.push(value);
      else if (name === "crawl-delay") {
        const n = Number(value);
        current.crawlDelay = Number.isFinite(n) ? n : value;
      }
      continue;
    }

    if (!KNOWN.has(name)) {
      if (unknownDirectives.length < 30) {
        unknownDirectives.push({
          line: lineNo,
          directive: name,
          value: value.slice(0, 200),
        });
      }
    }
  }

  flush();

  return {
    groups,
    sitemaps,
    hosts,
    unknownDirectives,
    malformedLines,
    lineCount: lines.length,
  };
}

/**
 * @param {string} sitemapUrl
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateSitemapUrl(sitemapUrl) {
  try {
    const u = new URL(sitemapUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, reason: "non_http_scheme" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
}
