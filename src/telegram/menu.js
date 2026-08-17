import { t } from "./i18n/index.js";

export function mainMenuKeyboard(locale = "en") {
  return {
    inline_keyboard: [
      [{ text: t(locale, "menu.check_website"), callback_data: "tool:audit" }],
      [
        { text: t(locale, "menu.website_tools"), callback_data: "menu:website" },
        { text: t(locale, "menu.infrastructure"), callback_data: "menu:infrastructure" },
      ],
      [
        { text: t(locale, "menu.about"), callback_data: "menu:about" },
        { text: t(locale, "menu.status"), callback_data: "menu:status" },
      ],
      [
        { text: t(locale, "menu.language"), callback_data: "menu:lang" },
        { text: t(locale, "menu.settings"), callback_data: "menu:settings" },
      ],
      [{ text: t(locale, "menu.help"), callback_data: "menu:help" }],
    ],
  };
}

export function languageKeyboard(locale = "en") {
  return {
    inline_keyboard: [
      [
        { text: t(locale, "lang.english"), callback_data: "lang:en" },
        { text: t(locale, "lang.swahili"), callback_data: "lang:sw" },
      ],
      [{ text: t(locale, "menu.back"), callback_data: "menu:main" }],
    ],
  };
}

export function languageMenuText(locale = "en") {
  return [t(locale, "lang.title"), "", t(locale, "lang.prompt"), "", t(locale, "lang.note")].join("\n");
}

export function settingsKeyboard(locale = "en") {
  return {
    inline_keyboard: [
      [{ text: t(locale, "menu.language"), callback_data: "menu:lang" }],
      [{ text: t(locale, "menu.back"), callback_data: "menu:main" }],
    ],
  };
}

export function settingsMenuText(locale = "en", profile = {}) {
  const currentLanguage = t(locale, locale === "sw" ? "lang.swahili" : "lang.english");
  const userId = profile.userId != null ? String(profile.userId) : t(locale, "report.unavailable");
  const chatId = profile.chatId != null ? String(profile.chatId) : t(locale, "report.unavailable");
  const sw = locale === "sw";

  return [
    t(locale, "settings.title"),
    "",
    t(locale, "settings.body"),
    "",
    sw ? "👤 Akaunti" : "👤 Account",
    sw ? `• User ID: ${userId}` : `• User ID: ${userId}`,
    sw ? `• Chat ID: ${chatId}` : `• Chat ID: ${chatId}`,
    "",
    sw ? "🎛 Ubinafsishaji" : "🎛 Personalisation",
    t(locale, "settings.current_language", { language: currentLanguage }),
    sw ? "• Hali: Imehifadhiwa" : "• Status: Saved",
    "",
    sw ? "🔒 Faragha" : "🔒 Privacy",
    sw
      ? "• Tunahifadhi chaguo la lugha pekee; hatuhifadhi historia ya tovuti ulizokagua kwenye preference profile."
      : "• We store only your language choice; checked-site history is not stored in your preference profile.",
    "",
    t(locale, "settings.choose"),
  ].join("\n");
}

export function websiteMenuKeyboard(locale = "en") {
  return {
    inline_keyboard: [
      [{ text: t(locale, "menu.check_website"), callback_data: "tool:audit" }],
      [
        { text: "🔍 SEO", callback_data: "tool:website" },
        { text: t(locale, "menu.mobile"), callback_data: "tool:mobile" },
      ],
      [
        { text: "🛡 Headers", callback_data: "tool:headers" },
        { text: "🔐 SSL", callback_data: "tool:ssl" },
      ],
      [
        { text: t(locale, "menu.robots"), callback_data: "tool:robots" },
        { text: t(locale, "menu.sitemap"), callback_data: "tool:sitemap" },
      ],
      [{ text: t(locale, "menu.back"), callback_data: "menu:main" }],
    ],
  };
}

export function infrastructureMenuKeyboard(locale = "en") {
  return {
    inline_keyboard: [
      [
        { text: t(locale, "menu.dns"), callback_data: "tool:dns" },
        { text: t(locale, "menu.email"), callback_data: "tool:email" },
      ],
      [{ text: "📡 HTTP Status", callback_data: "tool:http" }],
      [{ text: t(locale, "menu.back"), callback_data: "menu:main" }],
    ],
  };
}

export function backToMainKeyboard(locale = "en") {
  return { inline_keyboard: [[{ text: t(locale, "menu.back"), callback_data: "menu:main" }]] };
}

export function statusKeyboard(locale = "en") {
  return {
    inline_keyboard: [[
      { text: t(locale, "menu.refresh"), callback_data: "status:refresh" },
      { text: t(locale, "menu.back"), callback_data: "menu:main" },
    ]],
  };
}

export function helpMenuKeyboard(locale = "en") {
  return {
    inline_keyboard: [
      [{ text: t(locale, "menu.open_tools"), callback_data: "menu:main" }],
      [{ text: t(locale, "menu.back"), callback_data: "menu:main" }],
    ],
  };
}

export function toolPromptKeyboard(parentMenu, locale = "en") {
  const back = parentMenu === "infrastructure" ? "menu:infrastructure" : parentMenu === "website" ? "menu:website" : "menu:main";
  return { inline_keyboard: [[{ text: t(locale, "menu.back"), callback_data: back }]] };
}

export function guidedAuditKeyboard(locale = "en") {
  return { inline_keyboard: [[{ text: t(locale, "menu.back"), callback_data: "menu:main" }]] };
}

export function mainMenuText(locale = "en") {
  return ["🚀 SautiLink Cloud Engine", "", t(locale, "main.body"), "", t(locale, "main.choose"), t(locale, "main.try")].join("\n");
}

export function websiteMenuText(locale = "en") {
  return [t(locale, "website.title"), "", t(locale, "website.body")].join("\n");
}

export function infrastructureMenuText(locale = "en") {
  return [t(locale, "infra.title"), "", t(locale, "infra.body")].join("\n");
}

export function toolPrompt(tool, locale = "en") {
  const map = {
    audit: { parent: "website", text: [t(locale, "guided.title"), "", t(locale, "guided.prompt"), "", t(locale, "guided.example"), t(locale, "guided.or")].join("\n") },
    website: { parent: "website", text: `🔍 ${t(locale, "report.website_seo")}\n\n/website example.com` },
    mobile: { parent: "website", text: `${t(locale, "menu.mobile")}\n\n/mobile example.com` },
    headers: { parent: "website", text: `${t(locale, "report.http_headers")}\n\n/headers example.com` },
    ssl: { parent: "website", text: `🔐 SSL / HTTPS\n\n/ssl example.com` },
    robots: { parent: "website", text: `${t(locale, "menu.robots")}\n\n/robots example.com` },
    sitemap: { parent: "website", text: `${t(locale, "menu.sitemap")}\n\n/sitemap https://example.com/sitemap.xml` },
    dns: { parent: "infrastructure", text: `${t(locale, "menu.dns")}\n\n/dns example.com` },
    email: { parent: "infrastructure", text: `${t(locale, "menu.email")}\n\n/email example.com` },
    http: { parent: "infrastructure", text: `${t(locale, "report.http_status")}\n\n/http example.com` },
  };
  return map[tool] || null;
}
