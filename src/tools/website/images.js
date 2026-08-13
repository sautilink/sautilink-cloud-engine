import { MAX_IMAGES_SAMPLE } from "./limits.js";

export function analyzeImages(images) {
  let total = 0;
  let withAlt = 0;
  let missingAlt = 0;
  let emptyAlt = 0;
  let missingDimensions = 0;
  const sample = [];

  for (const img of images) {
    total += 1;
    if (!img.hasAlt) missingAlt += 1;
    else if (img.emptyAlt) emptyAlt += 1;
    else withAlt += 1;

    if (!img.width || !img.height) missingDimensions += 1;

    if (sample.length < MAX_IMAGES_SAMPLE) {
      sample.push({
        src: img.src,
        hasAlt: img.hasAlt,
        emptyAlt: img.emptyAlt,
        altLength: img.hasAlt && img.alt != null ? String(img.alt).length : null,
      });
    }
  }

  return {
    total,
    withAlt,
    missingAlt,
    emptyAlt,
    missingDimensions,
    sample,
  };
}
