/** Telegram bot entry — durable preference hydration + settings routing. */

import { processUpdate as processCoreUpdate } from "./bot_core.js";
import {
  getLocaleOverride,
  parseLocaleChoice,
  resolveLocale,
  setLocaleOverride,
} from "./i18n/index.js";
import { readLocalePreference, writeLocalePreference } from "./preferences.js";
import { answerCallbackQuery, editMessageText, sendMessage } from "./telegram.js";
import { settingsKeyboard, settingsMenuText } from "./menu.js";
import { authorizeUser } from "./authz.js";
import { clearPending } from "./guided.js";

export async function processUpdate(update, config) {
  const env = (config && config.env) || {};
  const identity = extractIdentity(update);

  if (identity.chatId != null) {
    const selected = explicitLocaleChoice(update);
    if (selected) {
      setLocaleOverride(identity.chatId, selected);
      if (identity.userId != null) await writeLocalePreference(identity.userId, selected, env);
    } else if (!getLocaleOverride(identity.chatId) && identity.userId != null) {
      const durable = await readLocalePreference(identity.userId, env);
      if (durable) setLocaleOverride(identity.chatId, durable);
    }
  }

  if (update && update.callback_query && update.callback_query.data === "menu:settings") {
    return handleSettingsCallback(update.callback_query, config);
  }

  return processCoreUpdate(update, config);
}

async function handleSettingsCallback(cq, config) {
  const cqId = cq && cq.id;
  if (cqId) await answerCallbackQuery(config.token, cqId);

  const message = cq && cq.message;
  const chat = message && message.chat;
  const chatId = chat && chat.id;
  if (chatId == null) return { handled: true, reason: "no_chat" };

  const env = (config && config.env) || {};
  const auth = authorizeUser({ from: cq.from, chat, env });
  if (!auth.allowed) return { handled: true, reason: "denied" };

  clearPending(chatId);
  const locale = resolveLocale({ chatId, languageCode: cq.from && cq.from.language_code });
  const text = settingsMenuText(locale);
  const extra = { reply_markup: settingsKeyboard(locale) };
  const messageId = message && message.message_id;

  if (messageId != null) {
    const edited = await editMessageText(config.token, chatId, messageId, text, extra);
    if (edited.ok) return { handled: true, action: "menu:settings" };
  }

  await sendMessage(config.token, chatId, text, extra);
  return { handled: true, action: "menu:settings" };
}

function extractIdentity(update) {
  const callback = update && update.callback_query;
  const message = (update && (update.message || update.edited_message)) || (callback && callback.message);
  const from = (callback && callback.from) || (message && message.from);
  return {
    chatId: message && message.chat && message.chat.id,
    userId: from && from.id,
  };
}

function explicitLocaleChoice(update) {
  const callbackData = update && update.callback_query && update.callback_query.data;
  if (callbackData === "lang:en") return "en";
  if (callbackData === "lang:sw") return "sw";

  const message = update && (update.message || update.edited_message);
  const text = message && typeof message.text === "string" ? message.text.trim() : "";
  const match = text.match(/^\/lang(?:@[A-Za-z0-9_]+)?(?:\s+(.+))?$/i);
  return match && match[1] ? parseLocaleChoice(match[1]) : null;
}
