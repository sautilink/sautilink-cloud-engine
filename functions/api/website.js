/**
 * GET /api/website?url=https://example.com
 */

import { analyzeWebsite } from "../../src/tools/website/index.js";
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
    const data = await analyzeWebsite(target);
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
          : err.code === "REQUEST_TIMEOUT"
            ? 504
            : err.code === "PRIVATE_ADDRESS_BLOCKED" || err.code === "SSRF_BLOCKED"
              ? 403
              : err.code === "UPSTREAM_CONNECTION_ERROR" ||
                  err.code === "UPSTREAM_DNS_ERROR" ||
                  err.code === "RESPONSE_TOO_LARGE"
                ? 502
                : 400;
      return error(err.code, err.message, status, { request, requestId });
    }
    return error(
      "INTERNAL_ERROR",
      "An unexpected error occurred while analyzing the website.",
      500,
      { request, requestId }
    );
  }
}
