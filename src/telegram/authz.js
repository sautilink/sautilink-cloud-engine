/**
 * Access-control foundation.
 *
 * Optional env:
 *   TELEGRAM_ADMIN_IDS — comma-separated Telegram user ids (no hard-coded ids)
 */

/**
 * @param {{ from?: { id?: number|string }, chat?: { id?: number|string }, env?: Record<string,string|undefined> }}
 * @returns {{ allowed: boolean, role: 'public'|'admin', reason?: string }}
 */
export function authorizeUser(context = {}) {
  const role = isAdmin(context.from && context.from.id, context.env)
    ? "admin"
    : "public";
  return { allowed: true, role };
}

/**
 * Normalize a single id token from env or Telegram payload.
 * Handles whitespace, surrounding quotes, and numeric strings.
 */
function normalizeIdToken(value) {
  if (value == null || value === "") return "";
  let s = String(value).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * @param {number|string|null|undefined} telegramUserId
 * @param {Record<string,string|undefined>|undefined} env
 */
export function isAdmin(telegramUserId, env = {}) {
  if (telegramUserId == null || telegramUserId === "") return false;
  const id = normalizeIdToken(telegramUserId);
  if (!id) return false;

  const raw =
    env && typeof env.TELEGRAM_ADMIN_IDS === "string"
      ? env.TELEGRAM_ADMIN_IDS
      : "";
  if (!raw || !String(raw).trim()) return false;

  const set = new Set(
    String(raw)
      .split(/[,\s]+/)
      .map((s) => normalizeIdToken(s))
      .filter(Boolean)
  );
  return set.has(id);
}
