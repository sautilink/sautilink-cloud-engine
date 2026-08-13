/** SSL/HTTPS analyzer limits */
export const REQUEST_TIMEOUT_MS = 8000;
export const MAX_REDIRECTS = 5;
export const MAX_BODY_BYTES = 16 * 1024; // headers-focused; drain small body only
