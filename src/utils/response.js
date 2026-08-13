/**
 * Consistent API response helpers.
 * Success: { success: true, data: {} }
 * Error:   { success: false, error: { code, message } }
 */

/**
 * @param {object} data
 * @param {number} [status=200]
 * @returns {Response}
 */
export function success(data, status = 200) {
  return json({ success: true, data }, status);
}

/**
 * @param {string} code
 * @param {string} message
 * @param {number} [status=400]
 * @returns {Response}
 */
export function error(code, message, status = 400) {
  return json(
    {
      success: false,
      error: { code, message },
    },
    status
  );
}

/**
 * @param {object} body
 * @param {number} status
 * @returns {Response}
 */
function json(body, status) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/**
 * Standard CORS preflight response.
 * @returns {Response}
 */
export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
