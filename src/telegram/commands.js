/** Command handlers — thin wrappers over Cloud Engine APIs. */

import { callCloudEngine } from "./engine.js";
import { normalizeUrlArg, normalizeDomainArg } from "./normalize.js";
import { parseLocaleChoice, setLocaleOverride, t } from "./i18n/index.js";
import { localizeValidationMessage } from "./i18n/validation.js";
import { preferenceStorageConfigured } from "./preferences.js";
import {
  formatHelp, formatStart, formatAbout, formatStatus, formatId, formatAdmin,
  formatAudit, formatDns, formatEmail, formatHeaders, formatSsl, formatWebsite,
  formatMobile, formatRobots, formatSitemap, formatHttp, formatEngineError, auditKeyboard,
} from "./format.js";
import {
  mainMenuKeyboard,
  helpMenuKeyboard,
  statusKeyboard,
  languageKeyboard,
  languageMenuText,
  settingsKeyboard,
  settingsMenuText,
} from "./menu.js";
import { isAdmin } from "./authz.js";
import { getUsageStats, getUsageConfig } from "./usage.js";

function requireArg(arg, usage, locale) {
  if (!arg) return { errorText: `${locale === "sw" ? "Matumizi" : "Usage"}: ${usage}` };
  return { arg };
}
function invalid(n, usage, locale) {
  return `⚠️ ${localizeValidationMessage(n.message, locale)}\n${locale === "sw" ? "Matumizi" : "Usage"}: ${usage}`;
}

export async function handleCommand(ctx, config) {
  const { command, arg, chat, from } = ctx;
  let locale = ctx.locale || "en";
  const base = config.cloudEngineBaseUrl;
  const env = config.env || {};

  switch (command) {
    case "start": return { text: formatStart(locale), reply_markup: mainMenuKeyboard(locale) };
    case "help": return { text: formatHelp(locale), reply_markup: helpMenuKeyboard(locale) };
    case "about": return { text: formatAbout(locale) };
    case "id": return { text: formatId(chat, from, locale) };
    case "settings": return { text: settingsMenuText(locale, { chatId: chat && chat.id, userId: from && from.id }), reply_markup: settingsKeyboard(locale) };
    case "lang": {
      if (!arg) return { text: languageMenuText(locale), reply_markup: languageKeyboard(locale) };
      const selected = parseLocaleChoice(arg);
      if (!selected) return { text: t(locale, "lang.usage"), reply_markup: languageKeyboard(locale) };
      locale = setLocaleOverride(chat && chat.id, selected);
      return { text: t(locale, selected === "sw" ? "lang.changed_sw" : "lang.changed_en"), reply_markup: mainMenuKeyboard(locale), locale };
    }
    case "status": {
      const result = await callCloudEngine(base, "/api/health", {});
      return { text: formatStatus(result.ok, result.data, locale), reply_markup: statusKeyboard(locale) };
    }
    case "admin": {
      if (!isAdmin(from && from.id, env)) return { text: t(locale, "admin.denied") };
      const health = await callCloudEngine(base, "/api/health", {});
      const stats = getUsageStats();
      const cfg = getUsageConfig(env);
      const preferenceStatus = preferenceStorageConfigured(env)
        ? "Active (SautiLink managed)"
        : "Fallback only";
      const text = formatAdmin({
        engineOk: health.ok,
        trackedChats: stats.trackedChats,
        maxTracked: stats.maxTracked,
        windowSeconds: cfg.windowSeconds,
        expensiveLimit: cfg.expensiveLimit,
        cheapLimit: cfg.cheapLimit,
      }, locale);
      return { text: `${text}\nDurable preferences: ${preferenceStatus}` };
    }
    case "audit": {
      const usage = "/audit <url>"; const r = requireArg(arg, usage, locale); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: invalid(n, usage, locale) };
      return run(base, "/api/audit", { url: n.url }, formatAudit, locale, true, { reply_markup: auditKeyboard(locale) });
    }
    case "dns": {
      const usage = "/dns <domain>"; const r = requireArg(arg, usage, locale); if (r.errorText) return { text: r.errorText };
      const n = normalizeDomainArg(r.arg); if (!n.ok) return { text: invalid(n, usage, locale) };
      return run(base, "/api/dns", { domain: n.domain }, formatDns, locale, true);
    }
    case "email": {
      const usage = "/email <domain>"; const r = requireArg(arg, usage, locale); if (r.errorText) return { text: r.errorText };
      const n = normalizeDomainArg(r.arg); if (!n.ok) return { text: invalid(n, usage, locale) };
      return run(base, "/api/email", { domain: n.domain }, formatEmail, locale, true);
    }
    case "headers": {
      const usage = "/headers <url>"; const r = requireArg(arg, usage, locale); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: invalid(n, usage, locale) };
      return run(base, "/api/headers", { url: n.url }, formatHeaders, locale, true);
    }
    case "ssl": {
      const usage = "/ssl <url>"; const r = requireArg(arg, usage, locale); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: invalid(n, usage, locale) };
      return run(base, "/api/ssl", { url: n.url }, formatSsl, locale, true);
    }
    case "website": {
      const usage = "/website <url>"; const r = requireArg(arg, usage, locale); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: invalid(n, usage, locale) };
      return run(base, "/api/website", { url: n.url }, formatWebsite, locale, true);
    }
    case "mobile": {
      const usage = "/mobile <url>"; const r = requireArg(arg, usage, locale); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: invalid(n, usage, locale) };
      return run(base, "/api/mobile", { url: n.url }, formatMobile, locale, true);
    }
    case "robots": {
      const usage = "/robots <url>"; const r = requireArg(arg, usage, locale); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: invalid(n, usage, locale) };
      return run(base, "/api/robots", { url: n.url }, formatRobots, locale, true);
    }
    case "sitemap": {
      const usage = "/sitemap <url>"; const r = requireArg(arg, usage, locale); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: invalid(n, usage, locale) };
      return run(base, "/api/sitemap", { url: n.url }, formatSitemap, locale, true);
    }
    case "http": {
      const usage = "/http <url>"; const r = requireArg(arg, usage, locale); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: invalid(n, usage, locale) };
      return run(base, "/api/http-status", { url: n.url }, formatHttp, locale, true);
    }
    default: return { text: t(locale, "error.unknown_command") };
  }
}

async function run(base, path, query, formatter, locale, slow, extra = {}) {
  const result = await callCloudEngine(base, path, query);
  if (!result.ok) return { text: formatEngineError(result.error, locale), slow };
  try {
    return { text: formatter(result.data || {}, locale), slow, reply_markup: extra.reply_markup };
  } catch {
    return { text: t(locale, "error.format"), slow };
  }
}
