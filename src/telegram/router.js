/**
 * Parse Telegram message text into a command + argument.
 */

import { MAX_ARG_LENGTH } from "./config.js";

const COMMAND_RE = /^\/([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9_]+))?([\s\S]*)$/;

/**
 * @param {string} text
 * @returns {{ command: string, arg: string } | null}
 */
export function parseCommand(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const m = trimmed.match(COMMAND_RE);
  if (!m) return null;
  const command = m[1].toLowerCase();
  let arg = (m[3] || "").trim();
  if (arg.length > MAX_ARG_LENGTH) {
    arg = arg.slice(0, MAX_ARG_LENGTH);
  }
  return { command, arg };
}

export const KNOWN_COMMANDS = new Set([
  "start",
  "help",
  "id",
  "audit",
  "dns",
  "email",
  "headers",
  "ssl",
  "website",
  "mobile",
  "robots",
  "sitemap",
  "http",
]);
