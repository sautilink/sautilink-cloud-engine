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
