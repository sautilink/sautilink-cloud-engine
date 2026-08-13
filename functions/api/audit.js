/**
 * GET /api/audit?url=https://example.com
 * Unified orchestration over existing analyzers.
 */

import { runWebsiteAudit } from "../../src/tools/audit/index.js";
import {
  success,
  error,
  corsPreflight,
  methodNotAllowed,
} from "../../src/utils/response.js";
import { getRequestId, guardRequestSize } from "../../src/utils/request.js";

const ALLOWED = ["GET", "OPTIONS"];

export async function onRequest(context) {
  const { request } = context;
  const requestId = getRequestId(request);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return corsPreflight(request);
  if (method !== "GET") {
    return methodNotAllowed(ALLOWED, { request, requestId });
  }

  try {
    const sizeGuard = guardRequestSize(request);
    if (!sizeGuard.ok) {
      const status = sizeGuard.code === "REQUEST_TOO_LARGE" ? 413 : 400;
      return error(sizeGuard.code, sizeGuard.message, status, {
        request,
        requestId,
      });
    }

    const target = new URL(request.url).searchParams.get("url");
    const data = await runWebsiteAudit(target);
    return success(data, 200, {
      request,
      requestId,
      cacheControl: "no-store",
    });
  } catch (err) {
    if (err && typeof err === "object" && err.code && err.message) {
      const status =
        typeof err.httpStatus === "number"
          ? err.httpStatus
          : err.code === "PRIVATE_ADDRESS_BLOCKED" || err.code === "SSRF_BLOCKED"
            ? 403
            : 400;
      return error(err.code, err.message, status, { request, requestId });
    }
    return error(
      "INTERNAL_ERROR",
      "An unexpected error occurred while running the website audit.",
      500,
      { request, requestId }
    );
  }
}
