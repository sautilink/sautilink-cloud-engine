/**
 * Command handlers — thin wrappers over Cloud Engine APIs.
 */

import { callCloudEngine } from "./engine.js";
import {
  formatHelp,
  formatStart,
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
} from "./format.js";

function requireArg(arg, usage) {
  if (!arg) return { errorText: `Usage: ${usage}` };
  return { arg };
}

/**
 * @param {{ command: string, arg: string, chat: object, from: object }}
 * @param {{ cloudEngineBaseUrl: string }}
 */
export async function handleCommand(ctx, config) {
  const { command, arg, chat, from } = ctx;
  const base = config.cloudEngineBaseUrl;

  switch (command) {
    case "start":
      return { text: formatStart() };
    case "help":
      return { text: formatHelp() };
    case "id":
      return { text: formatId(chat, from) };

    case "audit": {
      const r = requireArg(arg, "/audit <url>");
      if (r.errorText) return { text: r.errorText };
      return run(base, "/api/audit", { url: r.arg }, formatAudit, true);
    }
    case "dns": {
      const r = requireArg(arg, "/dns <domain>");
      if (r.errorText) return { text: r.errorText };
      return run(base, "/api/dns", { domain: r.arg }, formatDns, true);
    }
    case "email": {
      const r = requireArg(arg, "/email <domain>");
      if (r.errorText) return { text: r.errorText };
      return run(base, "/api/email", { domain: r.arg }, formatEmail, true);
    }
    case "headers": {
      const r = requireArg(arg, "/headers <url>");
      if (r.errorText) return { text: r.errorText };
      return run(base, "/api/headers", { url: r.arg }, formatHeaders, true);
    }
    case "ssl": {
      const r = requireArg(arg, "/ssl <url>");
      if (r.errorText) return { text: r.errorText };
      return run(base, "/api/ssl", { url: r.arg }, formatSsl, true);
    }
    case "website": {
      const r = requireArg(arg, "/website <url>");
      if (r.errorText) return { text: r.errorText };
      return run(base, "/api/website", { url: r.arg }, formatWebsite, true);
    }
    case "mobile": {
      const r = requireArg(arg, "/mobile <url>");
      if (r.errorText) return { text: r.errorText };
      return run(base, "/api/mobile", { url: r.arg }, formatMobile, true);
    }
    case "robots": {
      const r = requireArg(arg, "/robots <url>");
      if (r.errorText) return { text: r.errorText };
      return run(base, "/api/robots", { url: r.arg }, formatRobots, true);
    }
    case "sitemap": {
      const r = requireArg(arg, "/sitemap <url>");
      if (r.errorText) return { text: r.errorText };
      return run(base, "/api/sitemap", { url: r.arg }, formatSitemap, true);
    }
    case "http": {
      const r = requireArg(arg, "/http <url>");
      if (r.errorText) return { text: r.errorText };
      return run(
        base,
        "/api/http-status",
        { url: r.arg },
        formatHttp,
        true
      );
    }
    default:
      return {
        text: "Unknown command. Try /help.",
      };
  }
}

async function run(base, path, query, formatter, slow) {
  const result = await callCloudEngine(base, path, query);
  if (!result.ok) {
    return { text: formatEngineError(result.error), slow };
  }
  try {
    return { text: formatter(result.data || {}), slow };
  } catch {
    return {
      text: "❌ Received data but failed to format the reply.",
      slow,
    };
  }
}
