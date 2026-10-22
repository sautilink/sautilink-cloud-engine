/**
 * Unified audit orchestration limits.
 *
 * Designed to bound fan-out across existing analyzers (each may do
 * DoH + HTTP). Reassess worst-case network activity and the overall
 * wall-clock budget before increasing concurrency or timeout limits.
 */

/** Wall-clock budget for the entire audit. */
export const AUDIT_DEADLINE_MS = 18_000;

/** Soft timeout per analyzer wrapper. */
export const ANALYZER_TIMEOUT_MS = 9_000;

/** Max concurrent analyzer invocations. */
export const MAX_CONCURRENCY = 3;

/** Ordered list of analyzers executed by the audit. */
export const AUDIT_ANALYZERS = [
  "httpStatus",
  "headers",
  "ssl",
  "website",
  "mobile",
  "robots",
  "dns",
  "email",
  "sitemap",
];
