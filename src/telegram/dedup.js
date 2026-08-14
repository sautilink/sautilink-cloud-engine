/**
 * Best-effort update_id deduplication within a single isolate.
 *
 * NOT durable across Cloudflare isolates or deploys. Telegram retries may
 * still be processed more than once in production. Do not claim global dedup.
 */

const seen = new Map();
const MAX_ENTRIES = 200;
const TTL_MS = 60_000;

function prune(now) {
  for (const [id, exp] of seen) {
    if (exp <= now) seen.delete(id);
  }
  while (seen.size > MAX_ENTRIES) {
    const first = seen.keys().next().value;
    seen.delete(first);
  }
}

/**
 * @param {number|string|null|undefined} updateId
 * @returns {boolean} true if this update should be skipped as a recent duplicate
 */
export function isDuplicateUpdate(updateId) {
  if (updateId == null || updateId === "") return false;
  const id = String(updateId);
  if (!/^\d{1,20}$/.test(id)) return false;

  const now = Date.now();
  prune(now);

  const exp = seen.get(id);
  if (exp != null && exp > now) return true;

  seen.set(id, now + TTL_MS);
  return false;
}
