/**
 * Cloud Engine HTTP API client for the Telegram layer.
 * No business logic — fetch + parse only.
 */

import { ENGINE_TIMEOUT_MS } from "./config.js";

/**
 * @param {string} baseUrl
 * @param {string} path - e.g. /api/dns
 * @param {Record<string, string>} query
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function callCloudEngine(baseUrl, path, query = {}, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? ENGINE_TIMEOUT_MS;
  let url;
  try {
    url = new URL(path, baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
  } catch {
    return {
      ok: false,
      status: 0,
      error: {
        code: "ENGINE_CONFIG_ERROR",
        message: "Cloud Engine base URL is invalid.",
      },
    };
  }

  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    let body = null;
    const text = await res.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return {
        ok: false,
        status: res.status,
        error: {
          code: "ENGINE_BAD_JSON",
          message: "Cloud Engine returned an unreadable response.",
        },
      };
    }

    if (!res.ok) {
      const err =
        body && body.error && typeof body.error === "object"
          ? body.error
          : {
              code: "ENGINE_HTTP_ERROR",
              message: `Cloud Engine returned HTTP ${res.status}.`,
            };
      return {
        ok: false,
        status: res.status,
        error: {
          code: String(err.code || "ENGINE_HTTP_ERROR"),
          message: String(err.message || "Request failed."),
        },
        raw: body,
      };
    }

    // health uses legacy schema without success
    if (path.includes("/api/health")) {
      return { ok: true, status: res.status, data: body };
    }

    if (body && body.success === true) {
      return { ok: true, status: res.status, data: body.data };
    }

    if (body && body.success === false && body.error) {
      return {
        ok: false,
        status: res.status,
        error: {
          code: String(body.error.code || "ENGINE_ERROR"),
          message: String(body.error.message || "Request failed."),
        },
      };
    }

    return {
      ok: false,
      status: res.status,
      error: {
        code: "ENGINE_UNEXPECTED",
        message: "Unexpected Cloud Engine response.",
      },
    };
  } catch (err) {
    if (err && err.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        error: {
          code: "ENGINE_TIMEOUT",
          message: "Cloud Engine request timed out. Please try again.",
        },
      };
    }
    return {
      ok: false,
      status: 0,
      error: {
        code: "ENGINE_NETWORK",
        message: "Could not reach Cloud Engine.",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
