/** Centralized sitemap analyzer limits (production-safe). */

export const MAX_SITEMAP_SIZE = 512 * 1024; // 512 KiB
export const MAX_URLS = 5000;
export const MAX_CHILD_SITEMAPS = 25;
export const MAX_RECURSION_DEPTH = 2;
export const GLOBAL_DEADLINE_MS = 10_000;
export const MAX_URLS_IN_RESPONSE = 100; // sample in API payload
