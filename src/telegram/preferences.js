import { logTelegram } from "./log.js";

const TIMEOUT_MS = 1500;

function config(env = {}) {
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = String(env.SUPABASE_SECRET_KEY || "").trim();
  const urlOk = /^https:\/\//i.test(url);
  const keyOk = key.startsWith("sb_secret_");
  return { url, key, urlOk, keyOk, configured: urlOk && keyOk };
}

function telegramId(value) {
  const raw = String(value ?? "").trim();
  return /^\d{1,20}$/.test(raw) ? raw : null;
}

function durableLocale(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "en" || raw === "sw" ? raw : null;
}

function durableReportDetail(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "compact" || raw === "detailed" ? raw : null;
}

function durableDeveloperMode(value) {
  return typeof value === "boolean" ? value : null;
}

function durableDefaultView(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "main" || raw === "quick" || raw === "tools" ? raw : null;
}

async function request(env, path, options = {}) {
  const cfg = config(env);
  if (!cfg.configured) return { ok: false, reason: "not_configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${cfg.url}/rest/v1/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: cfg.key,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) return { ok: false, reason: `http_${response.status}` };
    return { ok: true, response };
  } catch {
    return { ok: false, reason: "request_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function readUserPreferences(userId, env) {
  const started = Date.now();
  const id = telegramId(userId);
  if (!id) {
    logTelegram({ event: "telegram_preference_profile_read", status: "skipped", error_code: "invalid_user_id", duration_ms: Date.now() - started });
    return null;
  }

  const result = await request(
    env,
    `telegram_user_preferences?telegram_user_id=eq.${id}&select=locale,report_detail,developer_mode,default_view&limit=1`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (!result.ok) {
    logTelegram({ event: "telegram_preference_profile_read", status: "fallback", error_code: result.reason, duration_ms: Date.now() - started });
    return null;
  }

  try {
    const rows = await result.response.json();
    const row = rows && rows[0];
    if (!row) {
      logTelegram({ event: "telegram_preference_profile_read", status: "miss", duration_ms: Date.now() - started });
      return null;
    }

    const profile = {
      locale: durableLocale(row.locale),
      reportDetail: durableReportDetail(row.report_detail) || "compact",
      developerMode: durableDeveloperMode(row.developer_mode) === true,
      defaultView: durableDefaultView(row.default_view) || "main",
    };
    logTelegram({ event: "telegram_preference_profile_read", status: "hit", duration_ms: Date.now() - started });
    return profile;
  } catch {
    logTelegram({ event: "telegram_preference_profile_read", status: "fallback", error_code: "invalid_response", duration_ms: Date.now() - started });
    return null;
  }
}

export async function readLocalePreference(userId, env) {
  const profile = await readUserPreferences(userId, env);
  return profile && profile.locale ? profile.locale : null;
}

export async function writeLocalePreference(userId, locale, env) {
  const started = Date.now();
  const id = telegramId(userId);
  const selected = durableLocale(locale);
  if (!id || !selected) {
    logTelegram({ event: "telegram_preference_write", status: "skipped", error_code: !id ? "invalid_user_id" : "invalid_locale", duration_ms: Date.now() - started });
    return false;
  }

  const result = await request(env, "telegram_user_preferences?on_conflict=telegram_user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ telegram_user_id: id, locale: selected, updated_at: new Date().toISOString() }),
  });

  logTelegram({ event: "telegram_preference_write", status: result.ok ? "ok" : "fallback", error_code: result.ok ? undefined : result.reason, duration_ms: Date.now() - started });
  return result.ok;
}

export async function writePresentationPreferences(userId, preferences, env) {
  const started = Date.now();
  const id = telegramId(userId);
  const locale = durableLocale(preferences && preferences.locale);
  const reportDetail = durableReportDetail(preferences && preferences.reportDetail);
  const developerMode = durableDeveloperMode(preferences && preferences.developerMode);
  const defaultView = durableDefaultView(preferences && preferences.defaultView);

  let errorCode = null;
  if (!id) errorCode = "invalid_user_id";
  else if (!locale) errorCode = "invalid_locale";
  else if (!reportDetail) errorCode = "invalid_report_detail";
  else if (developerMode == null) errorCode = "invalid_developer_mode";
  else if (!defaultView) errorCode = "invalid_default_view";

  if (errorCode) {
    logTelegram({ event: "telegram_personalisation_write", status: "skipped", error_code: errorCode, duration_ms: Date.now() - started });
    return false;
  }

  const result = await request(env, "telegram_user_preferences?on_conflict=telegram_user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      telegram_user_id: id,
      locale,
      report_detail: reportDetail,
      developer_mode: developerMode,
      default_view: defaultView,
      updated_at: new Date().toISOString(),
    }),
  });

  logTelegram({ event: "telegram_personalisation_write", status: result.ok ? "ok" : "fallback", error_code: result.ok ? undefined : result.reason, duration_ms: Date.now() - started });
  return result.ok;
}

export function preferenceStorageConfigured(env) {
  return config(env).configured;
}

export function preferenceStorageStatus(env) {
  const cfg = config(env);
  return {
    urlPresent: !!cfg.url,
    urlValid: cfg.urlOk,
    secretPresent: !!cfg.key,
    secretFormatValid: cfg.keyOk,
    configured: cfg.configured,
  };
}
