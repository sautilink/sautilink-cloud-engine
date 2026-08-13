/**
 * Catch-all for unknown /api/* routes.
 * More specific handlers (health.js, dns.js) take precedence.
 * Ensures unknown API paths return JSON 404 instead of static HTML.
 */

import {
  notFound,
  corsPreflight,
  methodNotAllowed,
} from "../../src/utils/response.js";
import { getRequestId } from "../../src/utils/request.js";

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

  return notFound({ request, requestId });
}
