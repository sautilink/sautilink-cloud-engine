/** Deliberately fixed public sources. Visitors cannot choose probe destinations. */
export const SOURCES = Object.freeze([
  Object.freeze({ id: "shablin", name: "shablin/mtproto-proxy", url: "https://github.com/shablin/mtproto-proxy", feed: "https://raw.githubusercontent.com/shablin/mtproto-proxy/main/data/valid_proxy.txt" }),
  Object.freeze({ id: "aliilapro", name: "ALIILAPRO/MTProtoProxy", url: "https://github.com/ALIILAPRO/MTProtoProxy", feed: "https://raw.githubusercontent.com/ALIILAPRO/MTProtoProxy/main/mtproto.txt" }),
]);

export const TARGET_ACTIVE = 20;
export const POOL_SIZE = 240;
export const SNAPSHOT_TTL_MS = 180_000;
export const VERIFICATION_TTL_MS = 600_000;
export const ACTIVE_INTERVAL_MS = 240_000;
// Discovery advances a small raw-link window every five minutes. Parsing and
// normalizing whole public feeds in one scheduled run can exhaust CPU budgets.
export const SOURCE_INTERVAL_MS = 300_000;
export const DISCOVERY_WINDOW_SIZE = 16;
export const PROBE_TIMEOUT_MS = 6_000;
export const MAX_CHECKS_PER_RUN = 8;
export const MAX_FEED_BYTES = 1_048_576;
export const MAX_FEED_LINKS = 1200;
export const MAX_HISTORY = 12;
export const PUBLIC_STATUSES = Object.freeze(["active", "unstable", "offline", "unverified", "stale"]);

export function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}
