/**
 * HTTP/HTTPS Status Checker — public tool module.
 */

import { prepareUrl } from "./url.js";
import { probeHttpStatus } from "./fetch.js";

export { prepareUrl } from "./url.js";
export { MAX_REDIRECTS, REQUEST_TIMEOUT_MS, MAX_BODY_BYTES } from "./fetch.js";

/**
 * Run a full HTTP status check for a user-supplied URL string.
 * @param {string} input
 * @returns {Promise<object>} data for success() helper
 * @throws {{ code: string, message: string, httpStatus?: number }}
 */
export async function checkHttpStatus(input) {
  const prepared = prepareUrl(input);
  if (prepared.error) {
    const err = {
      code: prepared.error.code,
      message: prepared.error.message,
      httpStatus: 400,
    };
    throw err;
  }

  return probeHttpStatus(prepared.url);
}
