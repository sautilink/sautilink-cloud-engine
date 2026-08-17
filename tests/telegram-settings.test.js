import test from "node:test";
import assert from "node:assert/strict";

import {
  languageMenuText,
  mainMenuKeyboard,
  settingsKeyboard,
  settingsMenuText,
} from "../src/telegram/menu.js";
import { parseCallbackAction } from "../src/telegram/normalize.js";
import { getCommandMeta } from "../src/telegram/registry.js";
import { parseCommand } from "../src/telegram/router.js";

test("settings command is registered as a cheap general command", () => {
  const meta = getCommandMeta("settings");
  assert.ok(meta);
  assert.equal(meta.name, "settings");
  assert.equal(meta.category, "general");
  assert.equal(meta.cost, "cheap");
  assert.equal(parseCommand("/settings").command, "settings");
});

test("settings and personalisation callbacks are fixed and allowlisted", () => {
  assert.equal(parseCallbackAction("menu:settings"), "menu:settings");
  assert.equal(parseCallbackAction("pref:detail:compact"), "pref:detail:compact");
  assert.equal(parseCallbackAction("pref:detail:detailed"), "pref:detail:detailed");
  assert.equal(parseCallbackAction("pref:dev:off"), "pref:dev:off");
  assert.equal(parseCallbackAction("pref:dev:on"), "pref:dev:on");
  assert.equal(parseCallbackAction("pref:dev:on:123"), null);
  assert.equal(parseCallbackAction("menu:settings:123"), null);
});

test("main menu keeps direct language access and adds settings", () => {
  const keyboard = mainMenuKeyboard("en");
  const callbacks = keyboard.inline_keyboard.flat().map((button) => button.callback_data);
  assert.ok(callbacks.includes("menu:lang"));
  assert.ok(callbacks.includes("menu:settings"));
});

test("settings menu shows active English personalisation defaults", () => {
  const text = settingsMenuText("en", {}, { reportDetail: "compact", developerMode: false });
  assert.match(text, /Settings/);
  assert.match(text, /Current language: .*English/);
  assert.match(text, /Report detail: Compact/);
  assert.match(text, /Developer Mode: Off/);

  const callbacks = settingsKeyboard("en", { reportDetail: "compact", developerMode: false })
    .inline_keyboard.flat().map((button) => button.callback_data);
  assert.deepEqual(callbacks, [
    "menu:lang",
    "pref:detail:compact",
    "pref:detail:detailed",
    "pref:dev:off",
    "pref:dev:on",
    "menu:main",
  ]);
});

test("settings menu shows detailed developer mode in Kiswahili", () => {
  const text = settingsMenuText("sw", {}, { reportDetail: "detailed", developerMode: true });
  assert.match(text, /Mipangilio/);
  assert.match(text, /Lugha ya sasa: .*Kiswahili/);
  assert.match(text, /Muundo wa report: Kina/);
  assert.match(text, /Developer Mode: Imewashwa/);
});

test("language menu explains durable persistence", () => {
  assert.match(languageMenuText("en"), /saved and remembered/i);
  assert.match(languageMenuText("sw"), /linahifadhiwa na kukumbukwa/i);
});
