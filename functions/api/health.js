/**
 * GET /api/health
 * Basic health check endpoint for deployment verification and future Telegram/API connectivity.
 * Stateless — no database, no authentication.
 *
 * Response body schema is fixed and must not change:
 * { status, service, timestamp }
 */

import { corsPreflight, methodNotAllowed, error } from "../../src/utils/response.js";
import { getRequestId } from "../../src/utils/request.js";
import { API_SECURITY_HEADERS, resolveCorsOrigin } from "../../src/utils/security.js";

const ALLOWED = ["GET", "OPTIONS"];

export async function onRequest(context) {
  const { request } = context;
  const requestId = getRequestId(request);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return corsPreflight(request);
  }

  if (method !== "GET") {
    return methodNotAllowed(ALLOWED, { request, requestId });
  }

  try {
    const body = {
      status: "ok",
      service: "SautiLink Cloud Engine",
      timestamp: new Date().toISOString(),
    };

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...API_SECURITY_HEADERS,
    };

    const origin = resolveCorsOrigin(request);
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Vary"] = "Origin";
      headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type, X-Request-Id";
    }

    return new Response(JSON.stringify(body, null, 2), {
      status: 200,
      headers,
    });
  } catch {
    return error(
      "INTERNAL_ERROR",
      "Health check failed unexpectedly.",
      500,
      { request, requestId }
    );
  }
}
