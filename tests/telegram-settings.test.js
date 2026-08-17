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

test("settings callback is fixed and allowlisted", () => {
  assert.equal(parseCallbackAction("menu:settings"), "menu:settings");
  assert.equal(parseCallbackAction("menu:settings:123"), null);
});

test("main menu keeps direct language access and adds settings", () => {
  const keyboard = mainMenuKeyboard("en");
  const callbacks = keyboard.inline_keyboard.flat().map((button) => button.callback_data);
  assert.ok(callbacks.includes("menu:lang"));
  assert.ok(callbacks.includes("menu:settings"));
});

test("settings menu shows the active English locale", () => {
  const text = settingsMenuText("en");
  assert.match(text, /Settings/);
  assert.match(text, /Current language: .*English/);
  const callbacks = settingsKeyboard("en").inline_keyboard.flat().map((button) => button.callback_data);
  assert.deepEqual(callbacks, ["menu:lang", "menu:main"]);
});

test("settings menu shows the active Kiswahili locale", () => {
  const text = settingsMenuText("sw");
  assert.match(text, /Mipangilio/);
  assert.match(text, /Lugha ya sasa: .*Kiswahili/);
});

test("language menu explains durable persistence", () => {
  assert.match(languageMenuText("en"), /saved and remembered/i);
  assert.match(languageMenuText("sw"), /linahifadhiwa na kukumbukwa/i);
});
