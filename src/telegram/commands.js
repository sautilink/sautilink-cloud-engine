/** Command handlers — thin wrappers over Cloud Engine APIs. */

import { callCloudEngine } from "./engine.js";
import { normalizeUrlArg, normalizeDomainArg } from "./normalize.js";
import { parseLocaleChoice, setLocaleOverride, t } from "./i18n/index.js";
import {
  formatHelp, formatStart, formatAbout, formatStatus, formatId, formatAdmin,
  formatAudit, formatDns, formatEmail, formatHeaders, formatSsl, formatWebsite,
  formatMobile, formatRobots, formatSitemap, formatHttp, formatEngineError, auditKeyboard,
} from "./format.js";
import { mainMenuKeyboard, helpMenuKeyboard, statusKeyboard, languageKeyboard, languageMenuText } from "./menu.js";
import { isAdmin } from "./authz.js";
import { getUsageStats, getUsageConfig } from "./usage.js";

function requireArg(arg, usage) {
  if (!arg) return { errorText: `Usage: ${usage}` };
  return { arg };
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
      return { text: formatAdmin({ engineOk: health.ok, trackedChats: stats.trackedChats, maxTracked: stats.maxTracked, windowSeconds: cfg.windowSeconds, expensiveLimit: cfg.expensiveLimit, cheapLimit: cfg.cheapLimit }, locale) };
    }
    case "audit": {
      const r = requireArg(arg, "/audit <url>"); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: `⚠️ ${n.message}\nUsage: /audit <url>` };
      return run(base, "/api/audit", { url: n.url }, formatAudit, locale, true, { reply_markup: auditKeyboard(locale) });
    }
    case "dns": {
      const r = requireArg(arg, "/dns <domain>"); if (r.errorText) return { text: r.errorText };
      const n = normalizeDomainArg(r.arg); if (!n.ok) return { text: `⚠️ ${n.message}\nUsage: /dns <domain>` };
      return run(base, "/api/dns", { domain: n.domain }, formatDns, locale, true);
    }
    case "email": {
      const r = requireArg(arg, "/email <domain>"); if (r.errorText) return { text: r.errorText };
      const n = normalizeDomainArg(r.arg); if (!n.ok) return { text: `⚠️ ${n.message}\nUsage: /email <domain>` };
      return run(base, "/api/email", { domain: n.domain }, formatEmail, locale, true);
    }
    case "headers": {
      const r = requireArg(arg, "/headers <url>"); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: `⚠️ ${n.message}\nUsage: /headers <url>` };
      return run(base, "/api/headers", { url: n.url }, formatHeaders, locale, true);
    }
    case "ssl": {
      const r = requireArg(arg, "/ssl <url>"); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: `⚠️ ${n.message}\nUsage: /ssl <url>` };
      return run(base, "/api/ssl", { url: n.url }, formatSsl, locale, true);
    }
    case "website": {
      const r = requireArg(arg, "/website <url>"); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: `⚠️ ${n.message}\nUsage: /website <url>` };
      return run(base, "/api/website", { url: n.url }, formatWebsite, locale, true);
    }
    case "mobile": {
      const r = requireArg(arg, "/mobile <url>"); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: `⚠️ ${n.message}\nUsage: /mobile <url>` };
      return run(base, "/api/mobile", { url: n.url }, formatMobile, locale, true);
    }
    case "robots": {
      const r = requireArg(arg, "/robots <url>"); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: `⚠️ ${n.message}\nUsage: /robots <url>` };
      return run(base, "/api/robots", { url: n.url }, formatRobots, locale, true);
    }
    case "sitemap": {
      const r = requireArg(arg, "/sitemap <url>"); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: `⚠️ ${n.message}\nUsage: /sitemap <url>` };
      return run(base, "/api/sitemap", { url: n.url }, formatSitemap, locale, true);
    }
    case "http": {
      const r = requireArg(arg, "/http <url>"); if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg); if (!n.ok) return { text: `⚠️ ${n.message}\nUsage: /http <url>` };
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
