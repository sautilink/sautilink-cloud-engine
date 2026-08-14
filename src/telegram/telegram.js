/**
 * Minimal Telegram Bot API helpers with hardened error handling.
 * Token is never included in returned error objects.
 */

const TG_API = "https://api.telegram.org";
const TG_TIMEOUT_MS = 12_000;

/**
 * @param {string} token
 * @param {string} method
 * @param {object} body
 */
async function tgCall(token, method, body) {
  if (!token) {
    return {
      ok: false,
      error: {
        code: "BOT_NOT_CONFIGURED",
        message: "Bot token is not configured.",
      },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TG_TIMEOUT_MS);

  try {
    const res = await fetch(`${TG_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return {
        ok: false,
        status: res.status,
        error: {
          code: "TELEGRAM_BAD_JSON",
          message: "Telegram API returned an unreadable response.",
        },
      };
    }

    if (res.status === 429) {
      const retryAfter =
        data && data.parameters && typeof data.parameters.retry_after === "number"
          ? data.parameters.retry_after
          : null;
      return {
        ok: false,
        status: 429,
        retry_after: retryAfter,
        error: {
          code: "TELEGRAM_RATE_LIMITED",
          message: "Telegram is temporarily rate-limiting responses.",
        },
      };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        status: res.status,
        error: {
          code: "TELEGRAM_AUTH_ERROR",
          message: "Telegram authentication failed.",
        },
      };
    }

    if (res.status === 400 || res.status === 404 || res.status === 409) {
      // e.g. message to edit not found / not modified
      return {
        ok: false,
        status: res.status,
        error: {
          code: "TELEGRAM_CLIENT_ERROR",
          message: "Telegram rejected the request.",
        },
      };
    }

    if (res.status >= 500) {
      return {
        ok: false,
        status: res.status,
        error: {
          code: "TELEGRAM_UPSTREAM_ERROR",
          message: "Telegram service is temporarily unavailable.",
        },
      };
    }

    if (!data || data.ok !== true) {
      return {
        ok: false,
        status: res.status,
        error: {
          code: "TELEGRAM_API_ERROR",
          message: "Telegram API request failed.",
        },
      };
    }

    return { ok: true, result: data.result, status: res.status };
  } catch (err) {
    if (err && err.name === "AbortError") {
      return {
        ok: false,
        error: {
          code: "TELEGRAM_TIMEOUT",
          message: "Telegram API timed out.",
        },
      };
    }
    return {
      ok: false,
      error: {
        code: "TELEGRAM_NETWORK",
        message: "Could not reach Telegram API.",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export function sendMessage(token, chatId, text, extra = {}) {
  return tgCall(token, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
  });
}

export function editMessageText(token, chatId, messageId, text, extra = {}) {
  return tgCall(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: true,
    ...extra,
  });
}

export function answerCallbackQuery(token, callbackQueryId, text) {
  const body = { callback_query_id: callbackQueryId };
  if (text) body.text = String(text).slice(0, 200);
  return tgCall(token, "answerCallbackQuery", body);
}
