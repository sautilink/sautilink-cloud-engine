import test from "node:test";
import assert from "node:assert/strict";

import { settingsMenuText } from "../src/telegram/menu.js";
import { handleCommand } from "../src/telegram/commands.js";

test("settings shows Telegram user and chat IDs in English", () => {
  const text = settingsMenuText("en", { userId: 12345, chatId: 67890 });
  assert.match(text, /Account/);
  assert.match(text, /User ID: 12345/);
  assert.match(text, /Chat ID: 67890/);
  assert.match(text, /Personalisation/);
  assert.match(text, /Status: Saved/);
  assert.match(text, /Privacy/);
});

test("settings shows Telegram user and chat IDs in Kiswahili", () => {
  const text = settingsMenuText("sw", { userId: 12345, chatId: 67890 });
  assert.match(text, /Akaunti/);
  assert.match(text, /User ID: 12345/);
  assert.match(text, /Chat ID: 67890/);
  assert.match(text, /Ubinafsishaji/);
  assert.match(text, /Hali: Imehifadhiwa/);
  assert.match(text, /Faragha/);
});

test("settings command passes live Telegram IDs into the settings view", async () => {
  const result = await handleCommand(
    {
      command: "settings",
      arg: "",
      chat: { id: 67890 },
      from: { id: 12345 },
      locale: "sw",
    },
    { cloudEngineBaseUrl: "https://example.invalid", env: {} }
  );

  assert.match(result.text, /User ID: 12345/);
  assert.match(result.text, /Chat ID: 67890/);
  assert.equal(result.reply_markup.inline_keyboard[0][0].callback_data, "menu:lang");
});

test("settings privacy copy accurately describes durable preference data", () => {
  const text = settingsMenuText("en", { userId: 12345, chatId: 67890 });
  assert.match(text, /Telegram User ID as the preference key/i);
  assert.match(text, /Chat ID and checked-site history are not stored/i);
});
