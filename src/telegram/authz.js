/**
 * Access-control foundation (Phase 7E).
 *
 * Currently public: everyone allowed. No user storage.
 * Future: allowlists, tiers (public / registered / premium / admin).
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
  // Public product: all roles allowed for existing commands
  return { allowed: true, role };
}

/**
 * @param {number|string|null|undefined} telegramUserId
 * @param {Record<string,string|undefined>|undefined} env
 */
export function isAdmin(telegramUserId, env = {}) {
  if (telegramUserId == null || telegramUserId === "") return false;
  const raw =
    typeof env.TELEGRAM_ADMIN_IDS === "string" ? env.TELEGRAM_ADMIN_IDS : "";
  if (!raw.trim()) return false;
  const id = String(telegramUserId);
  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  return set.has(id);
}
