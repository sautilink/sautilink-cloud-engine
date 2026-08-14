/** Command handlers — thin wrappers over Cloud Engine APIs. */

import { callCloudEngine } from "./engine.js";
import { normalizeUrlArg, normalizeDomainArg } from "./normalize.js";
import {
  formatHelp,
  formatStart,
  formatAbout,
  formatStatus,
  formatId,
  formatAudit,
  formatDns,
  formatEmail,
  formatHeaders,
  formatSsl,
  formatWebsite,
  formatMobile,
  formatRobots,
  formatSitemap,
  formatHttp,
  formatEngineError,
  auditKeyboard,
} from "./format.js";
import {
  mainMenuKeyboard,
  helpMenuKeyboard,
  statusKeyboard,
} from "./menu.js";

function requireArg(arg, usage) {
  if (!arg) return { errorText: `Usage: ${usage}` };
  return { arg };
}

export async function handleCommand(ctx, config) {
  const { command, arg, chat, from } = ctx;
  const base = config.cloudEngineBaseUrl;

  switch (command) {
    case "start":
      return { text: formatStart(), reply_markup: mainMenuKeyboard() };
    case "help":
      return { text: formatHelp(), reply_markup: helpMenuKeyboard() };
    case "about":
      return { text: formatAbout() };
    case "id":
      return { text: formatId(chat, from) };
    case "status": {
      const result = await callCloudEngine(base, "/api/health", {});
      return {
        text: formatStatus(result.ok, result.data),
        reply_markup: statusKeyboard(),
      };
    }
    case "audit": {
      const r = requireArg(arg, "/audit <url>");
      if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg);
      if (!n.ok) return { text: `❌ ${n.message}\nUsage: /audit <url>` };
      return run(base, "/api/audit", { url: n.url }, formatAudit, true, {
        reply_markup: auditKeyboard(),
      });
    }
    case "dns": {
      const r = requireArg(arg, "/dns <domain>");
      if (r.errorText) return { text: r.errorText };
      const n = normalizeDomainArg(r.arg);
      if (!n.ok) return { text: `❌ ${n.message}\nUsage: /dns <domain>` };
      return run(base, "/api/dns", { domain: n.domain }, formatDns, true);
    }
    case "email": {
      const r = requireArg(arg, "/email <domain>");
      if (r.errorText) return { text: r.errorText };
      const n = normalizeDomainArg(r.arg);
      if (!n.ok) return { text: `❌ ${n.message}\nUsage: /email <domain>` };
      return run(base, "/api/email", { domain: n.domain }, formatEmail, true);
    }
    case "headers": {
      const r = requireArg(arg, "/headers <url>");
      if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg);
      if (!n.ok) return { text: `❌ ${n.message}\nUsage: /headers <url>` };
      return run(base, "/api/headers", { url: n.url }, formatHeaders, true);
    }
    case "ssl": {
      const r = requireArg(arg, "/ssl <url>");
      if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg);
      if (!n.ok) return { text: `❌ ${n.message}\nUsage: /ssl <url>` };
      return run(base, "/api/ssl", { url: n.url }, formatSsl, true);
    }
    case "website": {
      const r = requireArg(arg, "/website <url>");
      if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg);
      if (!n.ok) return { text: `❌ ${n.message}\nUsage: /website <url>` };
      return run(base, "/api/website", { url: n.url }, formatWebsite, true);
    }
    case "mobile": {
      const r = requireArg(arg, "/mobile <url>");
      if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg);
      if (!n.ok) return { text: `❌ ${n.message}\nUsage: /mobile <url>` };
      return run(base, "/api/mobile", { url: n.url }, formatMobile, true);
    }
    case "robots": {
      const r = requireArg(arg, "/robots <url>");
      if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg);
      if (!n.ok) return { text: `❌ ${n.message}\nUsage: /robots <url>` };
      return run(base, "/api/robots", { url: n.url }, formatRobots, true);
    }
    case "sitemap": {
      const r = requireArg(arg, "/sitemap <url>");
      if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg);
      if (!n.ok) return { text: `❌ ${n.message}\nUsage: /sitemap <url>` };
      return run(base, "/api/sitemap", { url: n.url }, formatSitemap, true);
    }
    case "http": {
      const r = requireArg(arg, "/http <url>");
      if (r.errorText) return { text: r.errorText };
      const n = normalizeUrlArg(r.arg);
      if (!n.ok) return { text: `❌ ${n.message}\nUsage: /http <url>` };
      return run(base, "/api/http-status", { url: n.url }, formatHttp, true);
    }
    default:
      return { text: "Unknown command. Try /help." };
  }
}

async function run(base, path, query, formatter, slow, extra = {}) {
  const result = await callCloudEngine(base, path, query);
  if (!result.ok) {
    return { text: formatEngineError(result.error), slow };
  }
  try {
    return {
      text: formatter(result.data || {}),
      slow,
      reply_markup: extra.reply_markup,
    };
  } catch {
    return { text: "❌ Received data but failed to format the reply.", slow };
  }
}
