/** Telegram bot entry — durable preference hydration + settings routing. */

import { processUpdate as processCoreUpdate } from "./bot_core.js";
import {
  getLocaleOverride,
  parseLocaleChoice,
  resolveLocale,
  setLocaleOverride,
} from "./i18n/index.js";
import {
  readUserPreferences,
  writeLocalePreference,
  writePresentationPreferences,
} from "./preferences.js";
import {
  getPresentationPreferences,
  hasPresentationPreferences,
  presentationDefaults,
  setPresentationPreferences,
} from "./personalisation.js";
import { answerCallbackQuery, editMessageText, sendMessage } from "./telegram.js";
import { settingsKeyboard, settingsMenuText } from "./menu.js";
import { authorizeUser } from "./authz.js";
import { clearPending } from "./guided.js";

const SETTINGS_ACTIONS = new Set([
  "menu:settings",
  "pref:detail:compact",
  "pref:detail:detailed",
  "pref:dev:off",
  "pref:dev:on",
  "pref:view:main",
  "pref:view:quick",
  "pref:view:tools",
]);

export async function processUpdate(update, config) {
  const env = (config && config.env) || {};
  const identity = extractIdentity(update);

  if (identity.chatId != null) {
    const selected = explicitLocaleChoice(update);
    const needsLocale = !getLocaleOverride(identity.chatId);
    const needsPresentation = identity.userId != null && !hasPresentationPreferences(identity.userId);

    if (selected) {
      setLocaleOverride(identity.chatId, selected);
      if (identity.userId != null) await writeLocalePreference(identity.userId, selected, env);
    }

    if (identity.userId != null && (needsPresentation || (!selected && needsLocale))) {
      const durable = await readUserPreferences(identity.userId, env);
      if (durable) {
        if (!selected && needsLocale && durable.locale) setLocaleOverride(identity.chatId, durable.locale);
        if (needsPresentation) setPresentationPreferences(identity.userId, durable);
      } else if (needsPresentation) {
        setPresentationPreferences(identity.userId, presentationDefaults());
      }
    }
  }

  const callbackAction = update && update.callback_query && update.callback_query.data;
  if (SETTINGS_ACTIONS.has(callbackAction)) {
    return handleSettingsCallback(update.callback_query, config);
  }

  return processCoreUpdate(update, config);
}

async function handleSettingsCallback(cq, config) {
  const cqId = cq && cq.id;
  const message = cq && cq.message;
  const chat = message && message.chat;
  const chatId = chat && chat.id;
  if (chatId == null) {
    if (cqId) await answerCallbackQuery(config.token, cqId);
    return { handled: true, reason: "no_chat" };
  }

  const env = (config && config.env) || {};
  const auth = authorizeUser({ from: cq.from, chat, env });
  if (!auth.allowed) {
    if (cqId) await answerCallbackQuery(config.token, cqId);
    return { handled: true, reason: "denied" };
  }

  clearPending(chatId);
  const userId = cq.from && cq.from.id;
  const locale = resolveLocale({ chatId, languageCode: cq.from && cq.from.language_code });
  const action = cq && cq.data;
  let presentation = getPresentationPreferences(userId);
  let callbackText = null;

  const patch = settingsPreferencePatch(action);
  if (patch) {
    const next = { ...presentation, ...patch };
    const saved = userId != null && await writePresentationPreferences(userId, {
      locale,
      reportDetail: next.reportDetail,
      developerMode: next.developerMode,
      defaultView: next.defaultView,
    }, env);

    if (saved) {
      presentation = setPresentationPreferences(userId, next);
      callbackText = locale === "sw" ? "✅ Mpangilio umehifadhiwa." : "✅ Preference saved.";
    } else {
      callbackText = locale === "sw" ? "⚠️ Haikuweza kuhifadhi mpangilio. Jaribu tena." : "⚠️ Could not save the preference. Try again.";
    }
  }

  if (cqId) await answerCallbackQuery(config.token, cqId, callbackText);

  const text = settingsMenuText(locale, { chatId, userId }, presentation);
  const extra = { reply_markup: settingsKeyboard(locale, presentation) };
  const messageId = message && message.message_id;

  if (messageId != null) {
    const edited = await editMessageText(config.token, chatId, messageId, text, extra);
    if (edited.ok) return { handled: true, action };
  }

  await sendMessage(config.token, chatId, text, extra);
  return { handled: true, action };
}

function settingsPreferencePatch(action) {
  switch (action) {
    case "pref:detail:compact": return { reportDetail: "compact" };
    case "pref:detail:detailed": return { reportDetail: "detailed" };
    case "pref:dev:off": return { developerMode: false };
    case "pref:dev:on": return { developerMode: true };
    case "pref:view:main": return { defaultView: "main" };
    case "pref:view:quick": return { defaultView: "quick" };
    case "pref:view:tools": return { defaultView: "tools" };
    default: return null;
  }
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
