/**
 * Unified Audit Score v1.0
 *
 * Weighted categories (sum = 100). Missing categories are excluded and
 * remaining weights are renormalized — missing data is not treated as zero.
 */

export const AUDIT_SCORE_VERSION = "1.0";

export const CATEGORY_WEIGHTS = {
  security: 25,
  seo: 20,
  mobile: 15,
  infrastructure: 15,
  email: 10,
  https: 10,
  technical: 5,
};

function clamp(n, min, max) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export function gradeFor(total) {
  if (total >= 90) return { grade: "A", label: "Excellent" };
  if (total >= 80) return { grade: "B", label: "Good" };
  if (total >= 70) return { grade: "C", label: "Fair" };
  if (total >= 60) return { grade: "D", label: "Weak" };
  return { grade: "F", label: "Poor" };
}

/**
 * @param {Record<string, { available: boolean, score: number|null, max?: number, findings?: object[], recommendations?: object[] }>}
 */
export function calculateUnifiedScore(categoriesInput) {
  const categories = {};
  let weightSum = 0;
  let weighted = 0;

  for (const [key, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const cat = categoriesInput[key] || { available: false, score: null };
    const available = Boolean(cat.available) && cat.score != null;
    const score = available ? clamp(cat.score, 0, 100) : null;
    const { grade, label } = available
      ? gradeFor(score)
      : { grade: null, label: "Unavailable" };

    categories[key] = {
      score: available ? score : null,
      max: 100,
      percentage: available ? score : null,
      grade,
      label,
      weight,
      available,
      status: available ? "ok" : cat.status || "unavailable",
      findings: cat.findings || [],
      recommendations: cat.recommendations || [],
      sources: cat.sources || [],
    };

    if (available) {
      weightSum += weight;
      weighted += (score / 100) * weight;
    }
  }

  let total = null;
  if (weightSum > 0) {
    total = clamp((weighted / weightSum) * 100, 0, 100);
  }

  const g = total != null ? gradeFor(total) : { grade: null, label: "Incomplete" };

  return {
    total,
    max: 100,
    percentage: total,
    grade: g.grade,
    label: g.label,
    version: AUDIT_SCORE_VERSION,
    weights: { ...CATEGORY_WEIGHTS },
    weightSumUsed: weightSum,
    renormalized: weightSum > 0 && weightSum < 100,
    disclaimer:
      "SautiLink Cloud Engine configuration assessment. Not a Google ranking score, penetration test, or Lighthouse report.",
    categories,
  };
}

/**
 * Normalize a finding from a source analyzer.
 */
export function normalizeFinding(f, source, defaultCategory) {
  if (!f || typeof f !== "object") return null;
  return {
    code: String(f.code || "UNKNOWN"),
    severity: String(f.severity || "info"),
    category: String(f.category || defaultCategory || "general"),
    title: String(f.title || f.code || "Finding"),
    message: String(f.message || ""),
    source: String(source),
  };
}

export function normalizeRecommendation(r, source, defaultCategory) {
  if (!r || typeof r !== "object") return null;
  return {
    code: String(r.code || "UNKNOWN"),
    priority: String(r.priority || "info"),
    category: String(r.category || defaultCategory || "general"),
    title: String(r.title || r.code || "Recommendation"),
    message: String(r.message || ""),
    source: String(source),
  };
}
