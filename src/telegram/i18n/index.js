import en from "./en.js";
import sw from "./sw.js";
import { DEFAULT_LOCALE, normalizeLocale } from "./locales.js";

const catalogs={en,sw};
const PREF_TTL_MS=5*60*1000;
const MAX_PREFS=500;
const preferences=new Map();
function prune(now=Date.now()){for(const[k,v]of preferences){if(!v||v.expiresAt<=now)preferences.delete(k);}while(preferences.size>MAX_PREFS)preferences.delete(preferences.keys().next().value);}
export function t(locale,key,params={}){const loc=normalizeLocale(locale);const template=catalogs[loc]?.[key]??catalogs.en?.[key]??key;return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g,(_,name)=>Object.prototype.hasOwnProperty.call(params,name)?String(params[name]):`{${name}}`);}
export function getLocaleOverride(chatId){prune();if(chatId==null)return null;const p=preferences.get(String(chatId));return p&&p.expiresAt>Date.now()?p.locale:null;}
export function resolveLocale({chatId,languageCode}={}){return getLocaleOverride(chatId)||normalizeLocale(languageCode||DEFAULT_LOCALE);}
export function setLocaleOverride(chatId,locale){const loc=normalizeLocale(locale);if(chatId!=null){prune();preferences.set(String(chatId),{locale:loc,expiresAt:Date.now()+PREF_TTL_MS});prune();}return loc;}
export function parseLocaleChoice(value){const raw=String(value||"").trim().toLowerCase();if(raw==="en"||raw==="english")return"en";if(raw==="sw"||raw==="swahili"||raw==="kiswahili")return"sw";return null;}
export function _resetI18nForTests(){preferences.clear();}
export { DEFAULT_LOCALE, normalizeLocale } from "./locales.js";
