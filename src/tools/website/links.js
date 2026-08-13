import { MAX_LINKS_SAMPLE } from "./limits.js";

/**
 * Classify anchors without fetching.
 * @param {Array<{href:string|null,rel:string|null,text:string}>} anchors
 * @param {string} finalUrl
 */
export function analyzeLinks(anchors, finalUrl) {
  let base;
  try {
    base = new URL(finalUrl);
  } catch {
    base = null;
  }

  let total = 0;
  let internal = 0;
  let external = 0;
  let nofollow = 0;
  let fragment = 0;
  let mailto = 0;
  let tel = 0;
  let javascript = 0;
  let other = 0;
  const sample = [];

  for (const a of anchors) {
    total += 1;
    const rel = (a.rel || "").toLowerCase();
    if (rel.includes("nofollow")) nofollow += 1;

    const href = a.href;
    if (href == null || href === "") {
      other += 1;
      continue;
    }
    const h = href.trim();
    if (h.startsWith("#")) {
      fragment += 1;
      continue;
    }
    if (/^mailto:/i.test(h)) {
      mailto += 1;
      continue;
    }
    if (/^tel:/i.test(h)) {
      tel += 1;
      continue;
    }
    if (/^javascript:/i.test(h)) {
      javascript += 1;
      continue;
    }

    try {
      const u = new URL(h, base || undefined);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        other += 1;
        continue;
      }
      if (base && u.hostname === base.hostname) internal += 1;
      else external += 1;
      if (sample.length < MAX_LINKS_SAMPLE) {
        sample.push({
          href: u.toString(),
          internal: Boolean(base && u.hostname === base.hostname),
          nofollow: rel.includes("nofollow"),
        });
      }
    } catch {
      other += 1;
    }
  }

  return {
    total,
    internal,
    external,
    nofollow,
    anchors: fragment,
    mailto,
    tel,
    javascript,
    other,
    sample,
  };
}
