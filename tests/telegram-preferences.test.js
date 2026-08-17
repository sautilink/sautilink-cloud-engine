import test from "node:test";
import assert from "node:assert/strict";
import {
  preferenceStorageStatus,
  readLocalePreference,
  writeLocalePreference,
} from "../src/telegram/preferences.js";

const goodEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
};
const originalFetch = globalThis.fetch;
const originalLog = console.log;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  console.log = originalLog;
});

test("storage status requires valid URL and secret format", () => {
  assert.equal(preferenceStorageStatus({}).configured, false);
  assert.equal(
    preferenceStorageStatus({
      SUPABASE_URL: "http://bad",
      SUPABASE_SECRET_KEY: "sb_secret_x",
    }).configured,
    false
  );
  assert.equal(preferenceStorageStatus(goodEnv).configured, true);
});

test("read fails open without configuration and does not fetch", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("should not fetch");
  };
  assert.equal(await readLocalePreference(123, {}), null);
  assert.equal(called, false);
});

test("invalid user id never reaches Supabase", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("[]");
  };
  assert.equal(await readLocalePreference("abc", goodEnv), null);
  assert.equal(await writeLocalePreference("abc", "sw", goodEnv), false);
  assert.equal(called, false);
});

test("read returns allowlisted durable locale", async () => {
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /telegram_user_id=eq\.123/);
    assert.equal(options.method, "GET");
    assert.equal(options.headers.apikey, goodEnv.SUPABASE_SECRET_KEY);
    assert.equal(options.headers.Authorization, undefined);
    return new Response(JSON.stringify([{ locale: "sw" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  assert.equal(await readLocalePreference(123, goodEnv), "sw");
});

test("read rejects unexpected stored locale", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ locale: "fr" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  assert.equal(await readLocalePreference(123, goodEnv), null);
});

test("write upserts only strict en/sw values", async () => {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls += 1;
    assert.match(String(url), /on_conflict=telegram_user_id/);
    assert.equal(options.method, "POST");
    assert.equal(options.headers.apikey, goodEnv.SUPABASE_SECRET_KEY);
    assert.equal(options.headers.Authorization, undefined);
    const body = JSON.parse(options.body);
    assert.equal(body.telegram_user_id, "123");
    assert.equal(body.locale, "sw");
    return new Response(null, { status: 204 });
  };
  assert.equal(await writeLocalePreference(123, "sw", goodEnv), true);
  assert.equal(await writeLocalePreference(123, "french", goodEnv), false);
  assert.equal(calls, 1);
});

test("network failure fails open without leaking secret in logs", async () => {
  const logs = [];
  console.log = (line) => logs.push(String(line));
  globalThis.fetch = async () => {
    throw new Error(`do not leak ${goodEnv.SUPABASE_SECRET_KEY}`);
  };

  assert.equal(await readLocalePreference(123, goodEnv), null);
  assert.equal(await writeLocalePreference(123, "en", goodEnv), false);

  const joined = logs.join("\n");
  assert.doesNotMatch(joined, /sb_secret_test_only/);
  assert.match(joined, /telegram_preference_read/);
  assert.match(joined, /telegram_preference_write/);
});
