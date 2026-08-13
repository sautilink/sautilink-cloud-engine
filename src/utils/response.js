/**
 * Consistent API response helpers.
 *
 * Success: { success: true, data }
 * Error:   { success: false, error: { code, message }, requestId? }
 *
 * Health keeps its legacy schema and does not use these helpers for the body.
 */

import {
  API_SECURITY_HEADERS,
  resolveCorsOrigin,
} from "./security.js";

/**
 * @param {object} data
 * @param {number} [status=200]
 * @param {object} [options]
 * @param {Request} [options.request]
 * @param {string} [options.requestId]
 * @param {string} [options.cacheControl] - default no-store
 * @returns {Response}
 */
export function success(data, status = 200, options = {}) {
  return json({ success: true, data }, status, options);
}

/**
 * @param {string} code
 * @param {string} message
 * @param {number} [status=400]
 * @param {object} [options]
 * @param {Request} [options.request]
 * @param {string} [options.requestId]
 * @returns {Response}
 */
export function error(code, message, status = 400, options = {}) {
  const body = {
    success: false,
    error: { code, message },
  };
  if (options.requestId) {
    body.requestId = options.requestId;
  }
  return json(body, status, {
    ...options,
    cacheControl: "no-store",
  });
}

/**
 * 405 Method Not Allowed
 * @param {string[]} allowedMethods
 * @param {object} [options]
 * @returns {Response}
 */
export function methodNotAllowed(allowedMethods, options = {}) {
  const allow = allowedMethods.join(", ");
  const res = error(
    "METHOD_NOT_ALLOWED",
    `Method not allowed. Allowed: ${allow}.`,
    405,
    options
  );
  const headers = new Headers(res.headers);
  headers.set("Allow", allow);
  return new Response(res.body, { status: 405, headers });
}

/**
 * 404 for unknown API routes
 * @param {object} [options]
 * @returns {Response}
 */
export function notFound(options = {}) {
  return error(
    "NOT_FOUND",
    "The requested API endpoint does not exist.",
    404,
    options
  );
}

/**
 * @param {object} body
 * @param {number} status
 * @param {object} [options]
 * @returns {Response}
 */
function json(body, status, options = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": options.cacheControl || "no-store",
    ...API_SECURITY_HEADERS,
  };

  if (options.requestId) {
    headers["X-Request-Id"] = options.requestId;
  }

  if (options.request) {
    const origin = resolveCorsOrigin(options.request);
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Vary"] = "Origin";
      headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
      headers["Access-Control-Allow-Headers"] =
        "Content-Type, X-Request-Id";
    }
  }

  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers,
  });
}

/**
 * Standard CORS preflight response.
 * @param {Request} [request]
 * @returns {Response}
 */
export function corsPreflight(request) {
  const headers = {
    ...API_SECURITY_HEADERS,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Request-Id",
    "Access-Control-Max-Age": "86400",
  };

  if (request) {
    const origin = resolveCorsOrigin(request);
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Vary"] = "Origin";
    }
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}
