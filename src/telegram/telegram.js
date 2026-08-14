/**
 * Minimal Telegram Bot API helpers.
 * Token is never included in returned error objects.
 */

const TG_API = "https://api.telegram.org";

/**
 * @param {string} token
 * @param {string} method
 * @param {object} body
 */
async function tgCall(token, method, body) {
  if (!token) {
    return {
      ok: false,
      error: { code: "BOT_NOT_CONFIGURED", message: "Bot token is not configured." },
    };
  }
  try {
    const res = await fetch(`${TG_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      return {
        ok: false,
        error: {
          code: "TELEGRAM_BAD_JSON",
          message: "Telegram API returned an unreadable response.",
        },
      };
    }
    if (!data || data.ok !== true) {
      return {
        ok: false,
        error: {
          code: "TELEGRAM_API_ERROR",
          message: "Telegram API request failed.",
        },
      };
    }
    return { ok: true, result: data.result };
  } catch {
    return {
      ok: false,
      error: {
        code: "TELEGRAM_NETWORK",
        message: "Could not reach Telegram API.",
      },
    };
  }
}

export function sendMessage(token, chatId, text, extra = {}) {
  const body = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
  };
  return tgCall(token, "sendMessage", body);
}

export function editMessageText(token, chatId, messageId, text, extra = {}) {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: true,
    ...extra,
  };
  return tgCall(token, "editMessageText", body);
}

export function answerCallbackQuery(token, callbackQueryId, text) {
  const body = { callback_query_id: callbackQueryId };
  if (text) body.text = String(text).slice(0, 200);
  return tgCall(token, "answerCallbackQuery", body);
}
