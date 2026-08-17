import test from "node:test";
import assert from "node:assert/strict";
import {
  _resetI18nForTests,
  getLocaleOverride,
  resolveLocale,
  setLocaleOverride,
} from "../src/telegram/i18n/index.js";

const realNow = Date.now;

test.afterEach(() => {
  Date.now = realNow;
  _resetI18nForTests();
});

test("explicit locale override wins while cache entry is fresh", () => {
  Date.now = () => 1_000_000;
  setLocaleOverride(42, "sw");
  assert.equal(getLocaleOverride(42), "sw");
  assert.equal(resolveLocale({ chatId: 42, languageCode: "en-US" }), "sw");
});

test("expired cache falls back to Telegram language code", () => {
  let now = 1_000_000;
  Date.now = () => now;
  setLocaleOverride(42, "sw");
  now += 5 * 60 * 1000 + 1;
  assert.equal(getLocaleOverride(42), null);
  assert.equal(resolveLocale({ chatId: 42, languageCode: "en-US" }), "en");
});

test("cache remains bounded to 500 entries", () => {
  Date.now = () => 1_000_000;
  for (let i = 0; i < 501; i += 1) setLocaleOverride(i, "sw");
  assert.equal(getLocaleOverride(0), null);
  assert.equal(getLocaleOverride(500), "sw");
});
