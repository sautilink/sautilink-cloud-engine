import test from "node:test";
import assert from "node:assert/strict";

import { formatAbout, formatAdmin, formatStart } from "../src/telegram/format.js";
import { settingsMenuText } from "../src/telegram/menu.js";
import { handleCommand } from "../src/telegram/commands.js";

const VENDOR_NAMES = /\b(?:Supabase|Cloudflare|GitHub)\b/i;

function assertSautiLinkBranded(text) {
  assert.doesNotMatch(text, VENDOR_NAMES);
  assert.match(text, /SautiLink/i);
}

test("public start and about surfaces are SautiLink-branded and vendor-neutral", () => {
  assertSautiLinkBranded(formatStart("en"));
  assertSautiLinkBranded(formatStart("sw"));
  assertSautiLinkBranded(formatAbout("en"));
  assertSautiLinkBranded(formatAbout("sw"));
});

test("settings privacy copy is SautiLink-branded and vendor-neutral", () => {
  assertSautiLinkBranded(settingsMenuText("en", { userId: 123, chatId: 456 }));
  assertSautiLinkBranded(settingsMenuText("sw", { userId: 123, chatId: 456 }));
});

test("generic admin formatter exposes no infrastructure vendor", () => {
  const text = formatAdmin({
    engineOk: true,
    trackedChats: 0,
    maxTracked: 500,
    windowSeconds: 60,
    expensiveLimit: 5,
    cheapLimit: 20,
  }, "en");
  assertSautiLinkBranded(text);
});

test("full admin command keeps preference provider vendor-neutral", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ status: "ok", version: "test" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

  try {
    const result = await handleCommand(
      { command: "admin", arg: "", chat: { id: 1 }, from: { id: 123 }, locale: "en" },
      {
        cloudEngineBaseUrl: "https://cloudengine.sautilink.com",
        env: {
          TELEGRAM_ADMIN_IDS: "123",
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SECRET_KEY: "sb_secret_test",
        },
      }
    );
    assertSautiLinkBranded(result.text);
    assert.match(result.text, /Durable preferences: Active \(SautiLink managed\)/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
