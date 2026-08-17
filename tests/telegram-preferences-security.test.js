import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260817205106_make_telegram_preferences_server_only_explicit.sql", import.meta.url),
  "utf8",
);

test("Telegram preferences migration explicitly denies direct client access", () => {
  assert.match(migration, /create policy "telegram_preferences_server_only"/i);
  assert.match(migration, /as restrictive\s+for all\s+to anon, authenticated/i);
  assert.match(migration, /using \(false\)/i);
  assert.match(migration, /with check \(false\)/i);
});
