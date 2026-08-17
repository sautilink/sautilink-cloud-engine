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
  for (const action of [
    "menu:settings", "menu:tools",
    "pref:detail:compact", "pref:detail:detailed",
    "pref:dev:off", "pref:dev:on",
    "pref:view:main", "pref:view:quick", "pref:view:tools",
  ]) assert.equal(parseCallbackAction(action), action);
  assert.equal(parseCallbackAction("pref:view:tools:123"), null);
  assert.equal(parseCallbackAction("pref:dev:on:123"), null);
  assert.equal(parseCallbackAction("menu:settings:123"), null);
});

test("main menu keeps direct language access and settings", () => {
  const keyboard = mainMenuKeyboard("en");
  const callbacks = keyboard.inline_keyboard.flat().map((button) => button.callback_data);
  assert.ok(callbacks.includes("menu:lang"));
  assert.ok(callbacks.includes("menu:settings"));
});

test("settings menu shows active English defaults including main start view", () => {
  const prefs = { reportDetail: "compact", developerMode: false, defaultView: "main" };
  const text = settingsMenuText("en", {}, prefs);
  assert.match(text, /Settings/);
  assert.match(text, /Current language: .*English/);
  assert.match(text, /Report detail: Compact/);
  assert.match(text, /Developer Mode: Off/);
  assert.match(text, /Default \/start: Main Menu/);

  const callbacks = settingsKeyboard("en", prefs).inline_keyboard.flat().map((button) => button.callback_data);
  assert.deepEqual(callbacks, [
    "menu:lang",
    "pref:detail:compact", "pref:detail:detailed",
    "pref:dev:off", "pref:dev:on",
    "pref:view:main", "pref:view:quick", "pref:view:tools",
    "menu:main",
  ]);
});

test("settings menu shows detailed developer tools view in Kiswahili", () => {
  const text = settingsMenuText("sw", {}, {
    reportDetail: "detailed", developerMode: true, defaultView: "tools",
  });
  assert.match(text, /Mipangilio/);
  assert.match(text, /Lugha ya sasa: .*Kiswahili/);
  assert.match(text, /Muundo wa report: Kina/);
  assert.match(text, /Developer Mode: Imewashwa/);
  assert.match(text, /\/start ya kawaida: Tools Hub/);
});

test("language menu explains durable persistence", () => {
  assert.match(languageMenuText("en"), /saved and remembered/i);
  assert.match(languageMenuText("sw"), /linahifadhiwa na kukumbukwa/i);
});
