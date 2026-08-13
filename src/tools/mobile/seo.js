import { metaByName } from "./parser.js";

/**
 * Mobile-relevant SEO signals from parsed HTML.
 */
export function analyzeMobileSeo(parsed, finalUrl) {
  const robotsRaw = metaByName(parsed.metas, "robots");
  const directives = robotsRaw
    ? String(robotsRaw)
        .split(/[,\s]+/)
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean)
    : [];

  let canonical = {
    found: false,
    value: null,
    absolute: false,
    malformed: false,
  };
  const can = parsed.linkTags.find((l) =>
    (l.rel || "").toLowerCase().split(/\s+/).includes("canonical")
  );
  if (can && can.href) {
    canonical.found = true;
    canonical.value = can.href;
    try {
      new URL(can.href, finalUrl);
      canonical.absolute = /^https?:/i.test(can.href);
    } catch {
      canonical.malformed = true;
    }
  }

  const alternates = [];
  for (const l of parsed.linkTags) {
    const rel = (l.rel || "").toLowerCase();
    if (rel.includes("alternate") && (l.media || l.hreflang || l.href)) {
      alternates.push({
        href: l.href || null,
        media: l.media || null,
        hreflang: l.hreflang || null,
      });
    }
  }

  const mobileAlt = alternates.filter(
    (a) =>
      a.media &&
      /only screen and \(max-width/i.test(a.media)
  );

  return {
    robots: {
      found: Boolean(robotsRaw),
      content: robotsRaw,
      directives,
      noindex: directives.includes("noindex"),
      nofollow: directives.includes("nofollow"),
    },
    canonical,
    alternates,
    mobileAlternate: mobileAlt.length > 0,
    mobileAlternateLinks: mobileAlt,
    language: parsed.lang,
  };
}
