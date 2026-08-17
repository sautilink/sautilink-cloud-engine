import test from "node:test";
import assert from "node:assert/strict";

import { processUpdate } from "../src/telegram/bot.js";
import { _resetI18nForTests } from "../src/telegram/i18n/index.js";
import {
  _resetPersonalisationForTests,
  getPresentationPreferences,
} from "../src/telegram/personalisation.js";

const originalFetch = globalThis.fetch;

const config = {
  token: "telegram-test-token",
  cloudEngineBaseUrl: "https://cloudengine.sautilink.com",
  env: {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_test_only",
  },
};

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  _resetI18nForTests();
  _resetPersonalisationForTests();
});

test("Detailed preference callback persists then updates the active Settings view", async () => {
  const durableWrites = [];
  const telegramCalls = [];

  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);

    if (target.includes("/rest/v1/telegram_user_preferences") && options.method === "GET") {
      return new Response(JSON.stringify([{
        locale: "en",
        report_detail: "compact",
        developer_mode: false,
        default_view: "main",
      }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (target.includes("/rest/v1/telegram_user_preferences") && options.method === "POST") {
      durableWrites.push(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    }

    if (target.includes("api.telegram.org")) {
      telegramCalls.push({ target, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch: ${target}`);
  };

  const result = await processUpdate({
    update_id: 7001,
    callback_query: {
      id: "cq-7s",
      data: "pref:detail:detailed",
      from: { id: 123, language_code: "en" },
      message: { message_id: 55, chat: { id: 123 }, text: "Settings" },
    },
  }, config);

  assert.equal(result.handled, true);
  assert.equal(result.action, "pref:detail:detailed");
  assert.equal(durableWrites.length, 1);
  assert.equal(durableWrites[0].telegram_user_id, "123");
  assert.equal(durableWrites[0].locale, "en");
  assert.equal(durableWrites[0].report_detail, "detailed");
  assert.equal(durableWrites[0].developer_mode, false);
  assert.equal(durableWrites[0].default_view, "main");
  assert.deepEqual(getPresentationPreferences(123), {
    reportDetail: "detailed",
    developerMode: false,
    defaultView: "main",
  });

  const edit = telegramCalls.find((call) => call.target.includes("/editMessageText"));
  assert.ok(edit);
  assert.match(edit.body.text, /Report detail: Detailed/);
  const callbacks = edit.body.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
  assert.ok(callbacks.includes("pref:detail:detailed"));
});
