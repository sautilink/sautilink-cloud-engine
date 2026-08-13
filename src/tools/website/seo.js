import { metaByName } from "./parser.js";

export function analyzeSeo(parsed, finalUrl) {
  const titleVal = parsed.titles[0] || null;
  const titleLen = titleVal ? titleVal.length : 0;
  let titleStatus = "missing";
  const titleWarnings = [];
  if (titleVal) {
    if (titleLen < 30) {
      titleStatus = "short";
      titleWarnings.push("Title is shorter than common guidance (~30–60 characters).");
    } else if (titleLen > 60) {
      titleStatus = "long";
      titleWarnings.push("Title is longer than common guidance (~30–60 characters).");
    } else titleStatus = "ok";
    if (parsed.titles.length > 1) titleWarnings.push("Multiple <title> tags found.");
  }

  const desc = metaByName(parsed.metas, "description");
  const descLen = desc ? desc.length : 0;
  let descStatus = "missing";
  const descWarnings = [];
  if (desc) {
    if (descLen < 70) {
      descStatus = "short";
      descWarnings.push("Description is shorter than common guidance (~70–160 characters).");
    } else if (descLen > 160) {
      descStatus = "long";
      descWarnings.push("Description is longer than common guidance (~70–160 characters).");
    } else descStatus = "ok";
  }

  const viewport = metaByName(parsed.metas, "viewport");
  const robotsRaw = metaByName(parsed.metas, "robots");
  const robots = parseRobotsMeta(robotsRaw);

  let canonical = {
    found: false,
    value: null,
    absolute: false,
    relative: false,
    malformed: false,
  };
  if (parsed.canonicalHref) {
    canonical.found = true;
    canonical.value = parsed.canonicalHref;
    try {
      const u = new URL(parsed.canonicalHref, finalUrl);
      canonical.absolute = /^https?:/i.test(parsed.canonicalHref);
      canonical.relative = !canonical.absolute;
      canonical.resolved = u.toString();
    } catch {
      canonical.malformed = true;
    }
  }

  return {
    title: {
      found: Boolean(titleVal),
      value: titleVal,
      length: titleLen,
      status: titleStatus,
      warnings: titleWarnings,
    },
    description: {
      found: Boolean(desc),
      value: desc,
      length: descLen,
      status: descStatus,
      warnings: descWarnings,
    },
    viewport: {
      found: Boolean(viewport),
      value: viewport,
    },
    language: {
      found: Boolean(parsed.lang),
      value: parsed.lang,
    },
    canonical,
    robots,
  };
}

function parseRobotsMeta(raw) {
  if (!raw) {
    return { found: false, content: null, directives: [] };
  }
  const directives = String(raw)
    .split(/[,\s]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return {
    found: true,
    content: raw,
    directives,
    noindex: directives.includes("noindex"),
    nofollow: directives.includes("nofollow"),
  };
}
