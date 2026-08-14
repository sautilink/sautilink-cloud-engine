/**
 * POST /api/telegram/webhook
 * Telegram Bot webhook — thin client over Cloud Engine APIs.
 */

import { getTelegramConfig } from "../../../src/telegram/config.js";
import { processUpdate } from "../../../src/telegram/bot.js";

const ALLOWED = "POST";

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Only POST is allowed for the Telegram webhook.",
        },
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Allow: ALLOWED,
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const config = getTelegramConfig(env || {});

  if (!config.configured) {
    // Do not reveal secret names beyond what operators already know
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "BOT_NOT_CONFIGURED",
          message: "Telegram bot is not configured on this deployment.",
        },
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // Optional secret-token verification (Telegram setWebhook secret_token)
  if (config.webhookSecret) {
    const header =
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
    if (header !== config.webhookSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid webhook secret.",
          },
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }
  }

  let update;
  try {
    const text = await request.text();
    if (text.length > 256_000) {
      return json(413, {
        success: false,
        error: { code: "PAYLOAD_TOO_LARGE", message: "Update too large." },
      });
    }
    update = JSON.parse(text);
  } catch {
    return json(400, {
      success: false,
      error: { code: "INVALID_JSON", message: "Body must be JSON." },
    });
  }

  try {
    await processUpdate(update, {
      token: config.token,
      cloudEngineBaseUrl: config.cloudEngineBaseUrl,
    });
  } catch {
    // Always 200 to Telegram after accept to reduce retries storms;
    // processing errors are swallowed (stateless).
  }

  return json(200, { ok: true });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
