const PREF_TTL_MS = 5 * 60 * 1000;
const MAX_PREFS = 500;

const DEFAULTS = Object.freeze({
  reportDetail: "compact",
  developerMode: false,
  defaultView: "main",
});

const preferences = new Map();

function keyFor(userId) {
  if (userId == null) return null;
  const key = String(userId).trim();
  return /^\d{1,20}$/.test(key) ? key : null;
}

function normalizeReportDetail(value) {
  return value === "detailed" ? "detailed" : "compact";
}

function normalizeDeveloperMode(value) {
  return value === true;
}

function normalizeDefaultView(value) {
  return value === "quick" || value === "tools" ? value : "main";
}

function normalizePreferences(value = {}) {
  return {
    reportDetail: normalizeReportDetail(value.reportDetail),
    developerMode: normalizeDeveloperMode(value.developerMode),
    defaultView: normalizeDefaultView(value.defaultView),
  };
}

function prune(now = Date.now()) {
  for (const [key, value] of preferences) {
    if (!value || value.expiresAt <= now) preferences.delete(key);
  }
  while (preferences.size > MAX_PREFS) {
    preferences.delete(preferences.keys().next().value);
  }
}

export function hasPresentationPreferences(userId) {
  prune();
  const key = keyFor(userId);
  if (!key) return false;
  const value = preferences.get(key);
  return Boolean(value && value.expiresAt > Date.now());
}

export function getPresentationPreferences(userId) {
  prune();
  const key = keyFor(userId);
  if (!key) return { ...DEFAULTS };
  const value = preferences.get(key);
  if (!value || value.expiresAt <= Date.now()) return { ...DEFAULTS };
  return { ...value.preferences };
}

export function setPresentationPreferences(userId, value = {}) {
  const key = keyFor(userId);
  const normalized = normalizePreferences(value);
  if (!key) return normalized;
  prune();
  preferences.set(key, {
    preferences: normalized,
    expiresAt: Date.now() + PREF_TTL_MS,
  });
  prune();
  return { ...normalized };
}

export function updatePresentationPreferences(userId, patch = {}) {
  const current = getPresentationPreferences(userId);
  return setPresentationPreferences(userId, { ...current, ...patch });
}

export function presentationDefaults() {
  return { ...DEFAULTS };
}

export function _resetPersonalisationForTests() {
  preferences.clear();
}
