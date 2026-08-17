export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = new Set(["en", "sw"]);

export function normalizeLocale(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "sw" || raw === "swahili" || raw === "kiswahili") return "sw";
  if (raw === "en" || raw === "english") return "en";
  if (raw.startsWith("sw-")) return "sw";
  if (raw.startsWith("en-")) return "en";
  return DEFAULT_LOCALE;
}
