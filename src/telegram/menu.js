/** Stateless interactive menus — fixed callback_data only. */

export function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🔎 Check a Website", callback_data: "tool:audit" }],
      [
        { text: "🌐 Website Tools", callback_data: "menu:website" },
        { text: "📡 Infrastructure", callback_data: "menu:infrastructure" },
      ],
      [
        { text: "ℹ️ About", callback_data: "menu:about" },
        { text: "🟢 Status", callback_data: "menu:status" },
      ],
      [{ text: "❓ Help", callback_data: "menu:help" }],
    ],
  };
}

export function websiteMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🔎 Check a Website", callback_data: "tool:audit" }],
      [
        { text: "🔍 SEO", callback_data: "tool:website" },
        { text: "📱 Mobile", callback_data: "tool:mobile" },
      ],
      [
        { text: "🛡 Headers", callback_data: "tool:headers" },
        { text: "🔐 SSL", callback_data: "tool:ssl" },
      ],
      [
        { text: "🤖 Robots", callback_data: "tool:robots" },
        { text: "🗺 Sitemap", callback_data: "tool:sitemap" },
      ],
      [{ text: "⬅️ Back", callback_data: "menu:main" }],
    ],
  };
}

export function infrastructureMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🌐 DNS", callback_data: "tool:dns" },
        { text: "✉️ Email", callback_data: "tool:email" },
      ],
      [{ text: "📡 HTTP Status", callback_data: "tool:http" }],
      [{ text: "⬅️ Back", callback_data: "menu:main" }],
    ],
  };
}

export function backToMainKeyboard() {
  return { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "menu:main" }]] };
}

export function statusKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "status:refresh" },
        { text: "⬅️ Back", callback_data: "menu:main" },
      ],
    ],
  };
}

export function helpMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📋 Open Tool Menu", callback_data: "menu:main" }],
      [{ text: "⬅️ Back", callback_data: "menu:main" }],
    ],
  };
}

export function toolPromptKeyboard(parentMenu) {
  const back =
    parentMenu === "infrastructure"
      ? "menu:infrastructure"
      : parentMenu === "website"
        ? "menu:website"
        : "menu:main";
  return { inline_keyboard: [[{ text: "⬅️ Back", callback_data: back }]] };
}

export function guidedAuditKeyboard() {
  return {
    inline_keyboard: [[{ text: "⬅️ Back", callback_data: "menu:main" }]],
  };
}

export function mainMenuText() {
  return [
    "🚀 SautiLink Cloud Engine",
    "",
    "Website, DNS, email, security and infrastructure checks.",
    "",
    "Choose a tool below or use /help.",
    "Try: Check a Website, then send example.com",
  ].join("\n");
}

export function websiteMenuText() {
  return [
    "🌐 Website Tools",
    "",
    "Pick a tool. For a full check, use Check a Website and send the address.",
  ].join("\n");
}

export function infrastructureMenuText() {
  return [
    "📡 Infrastructure",
    "",
    "DNS, email, and HTTP checks. Select a tool to see usage.",
  ].join("\n");
}

export function toolPrompt(tool) {
  const map = {
    // audit is handled as guided flow in bot.js — keep fallback text aligned
    audit: {
      parent: "website",
      text: [
        "🔎 Check a Website",
        "",
        "Send the website address you want to check.",
        "",
        "Example: example.com",
        "Or: https://example.com",
      ].join("\n"),
    },
    website: { parent: "website", text: "🔍 Website SEO\n\nSend:\n/website example.com" },
    mobile: { parent: "website", text: "📱 Mobile heuristics\n\nSend:\n/mobile example.com" },
    headers: { parent: "website", text: "🛡 Security Headers\n\nSend:\n/headers example.com" },
    ssl: { parent: "website", text: "🔐 SSL / HTTPS\n\nSend:\n/ssl example.com" },
    robots: { parent: "website", text: "🤖 Robots.txt\n\nSend:\n/robots example.com" },
    sitemap: {
      parent: "website",
      text: "🗺 Sitemap.xml\n\nSend:\n/sitemap https://example.com/sitemap.xml",
    },
    dns: { parent: "infrastructure", text: "🌐 DNS Lookup\n\nSend:\n/dns example.com" },
    email: { parent: "infrastructure", text: "✉️ Email infrastructure\n\nSend:\n/email example.com" },
    http: { parent: "infrastructure", text: "📡 HTTP Status\n\nSend:\n/http example.com" },
  };
  return map[tool] || null;
}
