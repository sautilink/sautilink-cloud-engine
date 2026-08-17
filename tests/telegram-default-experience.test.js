import test from "node:test";
import assert from "node:assert/strict";

import { handleCommand } from "../src/telegram/commands.js";
import {
  _resetPersonalisationForTests,
  setPresentationPreferences,
} from "../src/telegram/personalisation.js";
import { _resetGuidedForTests, peekPending } from "../src/telegram/guided.js";
import { toolsHomeKeyboard, toolsHomeText } from "../src/telegram/menu.js";

const config = { cloudEngineBaseUrl: "https://example.invalid", env: {} };
const ctx = {
  command: "start",
  arg: "",
  chat: { id: 67890 },
  from: { id: 12345 },
  locale: "en",
};

test.afterEach(() => {
  _resetPersonalisationForTests();
  _resetGuidedForTests();
});

test("main remains the conservative default start experience", async () => {
  const result = await handleCommand(ctx, config);
  assert.match(result.text, /SautiLink Cloud Engine/);
  const callbacks = result.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
  assert.ok(callbacks.includes("tool:audit"));
  assert.equal(peekPending(ctx.chat.id), null);
});

test("quick default opens branded guided target capture and arms pending state", async () => {
  setPresentationPreferences(ctx.from.id, {
    reportDetail: "compact",
    developerMode: false,
    defaultView: "quick",
  });
  const result = await handleCommand(ctx, config);
  assert.match(result.text, /SautiLink Quick Check/);
  assert.equal(peekPending(ctx.chat.id), "audit");
  assert.equal(result.reply_markup.inline_keyboard[0][0].callback_data, "menu:main");
});

test("tools default opens a vendor-neutral SautiLink tools hub", async () => {
  setPresentationPreferences(ctx.from.id, {
    reportDetail: "compact",
    developerMode: false,
    defaultView: "tools",
  });
  const result = await handleCommand(ctx, config);
  assert.equal(result.text, toolsHomeText("en"));
  assert.doesNotMatch(result.text, /Supabase|Cloudflare|GitHub/i);
  const callbacks = result.reply_markup.inline_keyboard.flat().map((button) => button.callback_data);
  assert.ok(callbacks.includes("tool:audit"));
  assert.ok(callbacks.includes("menu:website"));
  assert.ok(callbacks.includes("menu:infrastructure"));
  assert.ok(callbacks.includes("menu:settings"));
  assert.equal(peekPending(ctx.chat.id), null);
});

test("tools hub uses fixed callback values only", () => {
  const callbacks = toolsHomeKeyboard("sw").inline_keyboard.flat().map((button) => button.callback_data);
  assert.deepEqual(callbacks, [
    "tool:audit",
    "menu:website",
    "menu:infrastructure",
    "menu:settings",
    "menu:main",
  ]);
});
