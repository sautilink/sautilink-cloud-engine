import { metaByName } from "./parser.js";
import { MAX_SAMPLE } from "./limits.js";

/**
 * Core mobile heuristics from primary HTML only.
 */
export function analyzeMobileSignals(parsed) {
  const viewportRaw = metaByName(parsed.metas, "viewport");
  const viewport = analyzeViewport(viewportRaw);

  const responsiveMeta = Boolean(
    metaByName(parsed.metas, "mobile-web-app-capable") ||
      metaByName(parsed.metas, "apple-mobile-web-app-capable")
  );

  const images = analyzeImages(parsed.images);
  const navigation = analyzeNavigation(parsed.anchors);
  const readability = analyzeReadability(parsed);
  const mediaRisks = {
    iframes: parsed.iframes.length,
    iframeSample: parsed.iframes.slice(0, 5),
    tables: parsed.tables,
  };

  return {
    viewport,
    responsiveMeta,
    fixedWidthSignals: parsed.fixedWidth.slice(),
    overflowRisk:
      parsed.fixedWidth.length > 0 ||
      parsed.tables > 3 ||
      images.fixedWidthCount > 2,
    images,
    navigation,
    readability,
    mediaRisks,
  };
}

export function analyzeViewport(raw) {
  if (raw == null || String(raw).trim() === "") {
    return {
      found: false,
      content: null,
      hasWidthDevice: false,
      hasInitialScale: false,
      userScalableNo: false,
      quality: "missing",
      issues: ["VIEWPORT_MISSING"],
    };
  }

  const content = String(raw).trim();
  const lower = content.toLowerCase();
  const parts = {};
  for (const piece of lower.split(",")) {
    const [k, v] = piece.split("=").map((s) => s.trim());
    if (k) parts[k] = v != null ? v : true;
  }

  const hasWidthDevice =
    parts.width === "device-width" || parts["width"] === "device-width";
  const hasInitialScale = Object.prototype.hasOwnProperty.call(
    parts,
    "initial-scale"
  );
  const userScalableNo =
    parts["user-scalable"] === "no" ||
    parts["user-scalable"] === "0" ||
    Number(parts["maximum-scale"]) <= 1;

  const issues = [];
  if (!hasWidthDevice) issues.push("VIEWPORT_NO_DEVICE_WIDTH");
  if (!hasInitialScale) issues.push("VIEWPORT_NO_INITIAL_SCALE");
  if (userScalableNo) issues.push("VIEWPORT_USER_SCALABLE_DISABLED");

  // fixed pixel width in viewport
  if (parts.width && /^\d+$/.test(String(parts.width))) {
    issues.push("VIEWPORT_FIXED_WIDTH");
  }

  let quality = "good";
  if (issues.includes("VIEWPORT_FIXED_WIDTH") || !hasWidthDevice) {
    quality = "poor";
  } else if (issues.length) quality = "fair";

  return {
    found: true,
    content,
    hasWidthDevice,
    hasInitialScale,
    userScalableNo,
    quality,
    issues,
  };
}

function analyzeImages(images) {
  let total = 0;
  let withSrcset = 0;
  let withSizes = 0;
  let withDimensions = 0;
  let fixedWidthCount = 0;
  let missingAlt = 0;
  const sample = [];

  for (const img of images) {
    total += 1;
    if (img.srcset) withSrcset += 1;
    if (img.sizes) withSizes += 1;
    if (img.width && img.height) withDimensions += 1;
    if (img.width && /^\d+$/.test(String(img.width)) && Number(img.width) >= 800) {
      fixedWidthCount += 1;
    }
    if (!img.hasAlt) missingAlt += 1;
    if (sample.length < MAX_SAMPLE) {
      sample.push({
        hasSrcset: Boolean(img.srcset),
        hasSizes: Boolean(img.sizes),
        width: img.width,
        height: img.height,
      });
    }
  }

  return {
    total,
    withSrcset,
    withSizes,
    withDimensions,
    fixedWidthCount,
    missingAlt,
    sample,
  };
}

function analyzeNavigation(anchors) {
  const total = anchors.length;
  let shortLabels = 0;
  for (const a of anchors) {
    if (a.text && a.text.length > 0 && a.text.length < 2) shortLabels += 1;
  }
  return {
    total,
    density: total > 100 ? "high" : total > 40 ? "medium" : "low",
    shortLabels,
  };
}

function analyzeReadability(parsed) {
  const smallPx = parsed.fonts.filter(
    (f) => f.unit === "px" && f.value > 0 && f.value < 12
  ).length;
  return {
    inlineFontSamples: parsed.fonts.length,
    smallFontPxCount: smallPx,
    riskSmallText: smallPx >= 3,
  };
}
