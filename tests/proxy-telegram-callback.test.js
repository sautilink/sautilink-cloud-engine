import test from "node:test";
import assert from "node:assert/strict";
import { processUpdate } from "../src/telegram/bot.js";
import { renderProxySnapshot } from "../src/telegram/proxies.js";
import { _resetUsageForTests, commandCost } from "../src/telegram/usage.js";
import { _resetI18nForTests } from "../src/telegram/i18n/index.js";
import { _resetPersonalisationForTests } from "../src/telegram/personalisation.js";
import { _resetCooldownForTests } from "../src/telegram/cooldown.js";

const originalFetch = globalThis.fetch;
const config = { token: "telegram-test-token", cloudEngineBaseUrl: "https://cloudengine.example", env: {} };
let updateId = 81_000;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  _resetUsageForTests(); _resetI18nForTests(); _resetPersonalisationForTests(); _resetCooldownForTests();
});

function data(now = Date.now()) {
  return {
    schema_version: 1, generated_at: new Date(now - 5_000).toISOString(), expires_at: new Date(now + 175_000).toISOString(),
    monitor_status: "ready", target_active: 20, refresh_interval_seconds: 300,
    counts: { active: 1, unstable: 0, offline: 0, unverified: 0, stale: 0, total: 1 },
    page: 1, per_page: 5, total_pages: 1, total: 1, sources: [],
    proxies: [{
      id: "p1", label: "Example", host: "proxy.example.com", port: 443,
      type: "mtproto", transport: "classic", status: "active", latency_ms: 140,
      last_checked_at: new Date(now - 8_000).toISOString(), last_success_at: new Date(now - 8_000).toISOString(),
      check_location: "AMS", source: { name: "Test feed", url: "https://example.com" },
      operator: "community", connect_url: "https://t.me/proxy?server=proxy.example.com&port=443&secret=1234567890abcdef1234567890abcdef",
      availability_pct: null, history: [],
    }],
  };
}

function callback(action = "proxy:list:1", patch = {}) {
  return {
    update_id: updateId++, callback_query: {
      id: `proxy-callback-${updateId}`, data: action,
      from: { id: 55, language_code: "en" },
      message: { message_id: 99, chat: { id: 55, type: "private" }, text: "Choose a tool" }, ...patch,
    },
  };
}

function mockFetch(snapshot = data()) {
  const calls = [];
  globalThis.fetch = async (raw, options = {}) => {
    const url = new URL(raw);
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null, options });
    if (url.hostname === "api.telegram.org") {
      return new Response(JSON.stringify({ ok: true, result: { message_id: 99 } }), { status: 200 });
    }
    assert.equal(url.origin, config.cloudEngineBaseUrl);
    assert.equal(url.pathname, "/api/proxies");
    return new Response(JSON.stringify({ success: true, data: snapshot }), { status: 200 });
  };
  return calls;
}

test("proxy callback acknowledges promptly and edits a plain-text snapshot without querying proxy hosts", async () => {
  const calls = mockFetch();
  const result = await processUpdate(callback(), config);
  assert.equal(result.action, "proxy:list:1");
  assert.match(calls[0].url.pathname, /answerCallbackQuery$/);
  assert.equal(calls[1].url.pathname, "/api/proxies");
  const edit = calls.find(({ url }) => /editMessageText$/.test(url.pathname));
  assert.ok(edit);
  assert.equal(edit.body.chat_id, 55);
  assert.equal(edit.body.message_id, 99);
  assert.equal(edit.body.parse_mode, undefined);
  assert.equal(edit.body.disable_web_page_preview, true);
  const buttons = edit.body.reply_markup.inline_keyboard.flat();
  assert.equal(buttons.filter((button) => button.url?.startsWith("https://t.me/proxy?")).length, 1);
  assert.ok(buttons.some((button) => button.url === "https://t.me/drcharlesofficial"));
  assert.equal(calls.filter(({ url }) => /sendMessage$/.test(url.pathname)).length, 0);
  assert.equal(calls.length, 3);
});

test("refresh of an unchanged stored snapshot is a no-op after acknowledgement", async () => {
  const snapshot = data();
  const rendered = renderProxySnapshot(snapshot);
  const calls = mockFetch(snapshot);
  const result = await processUpdate(callback("proxy:refresh:1", {
    message: { message_id: 99, chat: { id: 55, type: "private" }, text: rendered.text, reply_markup: rendered.reply_markup },
  }), config);
  assert.equal(result.action, "proxy:refresh:1");
  assert.equal(calls.length, 2);
  assert.match(calls[0].url.pathname, /answerCallbackQuery$/);
  assert.equal(calls[1].url.pathname, "/api/proxies");
});

test("forged pagination callbacks and inaccessible chat contexts cannot invoke the API", async () => {
  const calls = mockFetch();
  const forged = await processUpdate(callback("proxy:list:1&url=http://127.0.0.1"), config);
  assert.equal(forged.reason, "unknown_callback");
  const noChat = await processUpdate(callback("proxy:list:1", { message: undefined, inline_message_id: "untrusted" }), config);
  assert.equal(noChat.reason, "no_chat");
  assert.equal(calls.filter(({ url }) => url.pathname === "/api/proxies").length, 0);
});

test("proxy reads share the existing cheap-command quota including callback refreshes", async () => {
  assert.equal(commandCost("proxy"), "cheap");
  assert.equal(commandCost("proxy:refresh:1"), "cheap");
  const calls = mockFetch();
  const limitedConfig = { ...config, env: { TELEGRAM_PUBLIC_CHEAP_LIMIT: "1" } };
  await processUpdate(callback(), limitedConfig);
  await processUpdate(callback("proxy:refresh:1"), limitedConfig);
  assert.equal(calls.filter(({ url }) => url.pathname === "/api/proxies").length, 1);
  const warning = calls.find(({ url }) => /sendMessage$/.test(url.pathname));
  assert.ok(warning);
  assert.match(warning.body.text, /temporary usage limit/);
});

test("/proxy help and help callbacks remain available without backend traffic", async () => {
  const calls = mockFetch();
  await processUpdate({ update_id: updateId++, message: { message_id: 100, chat: { id: 55, type: "private" }, from: { id: 55, language_code: "sw" }, text: "/proxy help" } }, config);
  await processUpdate(callback("proxy:help", { from: { id: 55, language_code: "sw" } }), config);
  assert.equal(calls.filter(({ url }) => url.pathname === "/api/proxies").length, 0);
  const send = calls.find(({ url }) => /sendMessage$/.test(url.pathname));
  assert.match(send.body.text, /Bonyeza Unganisha Proxy/);
  assert.ok(send.body.reply_markup.inline_keyboard.flat().some((button) => button.callback_data === "proxy:list:1"));
});
