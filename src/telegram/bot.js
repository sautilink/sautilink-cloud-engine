/** Telegram bot entry — Phase 7N durable preference hydration. */

import { processUpdate as processCoreUpdate } from "./bot_core.js";
import { getLocaleOverride, parseLocaleChoice, setLocaleOverride } from "./i18n/index.js";
import { readLocalePreference, writeLocalePreference } from "./preferences.js";

export async function processUpdate(update,config){const env=(config&&config.env)||{};const identity=extractIdentity(update);if(identity.chatId!=null){const selected=explicitLocaleChoice(update);if(selected){setLocaleOverride(identity.chatId,selected);if(identity.userId!=null)await writeLocalePreference(identity.userId,selected,env);}else if(!getLocaleOverride(identity.chatId)&&identity.userId!=null){const durable=await readLocalePreference(identity.userId,env);if(durable)setLocaleOverride(identity.chatId,durable);}}return processCoreUpdate(update,config);}
function extractIdentity(update){const callback=update&&update.callback_query;const message=(update&&(update.message||update.edited_message))||(callback&&callback.message);const from=(callback&&callback.from)||(message&&message.from);return{chatId:message&&message.chat&&message.chat.id,userId:from&&from.id};}
function explicitLocaleChoice(update){const callbackData=update&&update.callback_query&&update.callback_query.data;if(callbackData==="lang:en")return"en";if(callbackData==="lang:sw")return"sw";const message=update&&(update.message||update.edited_message);const text=message&&typeof message.text==="string"?message.text.trim():"";const match=text.match(/^\/lang(?:@[A-Za-z0-9_]+)?(?:\s+(.+))?$/i);return match&&match[1]?parseLocaleChoice(match[1]):null;}
