# Testing

## Usage (offline)

- cost registry: every public command has cost cheap|expensive
- under limit → allowed; at limit → rejected; admin → bypass
- max tracked chats bounded
- language/menu callbacks remain cheap

## Phase 7M localization

Offline checks should cover:

- `resolveLocale`: `en`, `en-US`, `sw`, `sw-TZ`, other/missing → English fallback
- explicit choices: `en`, `english`, `sw`, `swahili`, `kiswahili`
- invalid `/lang` input does not change locale
- missing Kiswahili key falls back to English
- interpolation preserves technical values
- `menu:lang`, `lang:en`, `lang:sw` are allowlisted
- existing `audit:*`, `diag:*`, `result:*`, `tool:*`, `menu:*` callbacks remain valid
- English and Kiswahili menus use identical callback_data
- guided invalid inputs remain rejected in both languages
- audit/domain recovery still works with English and Kiswahili report headings
- usage/cooldown/dedup/admin/in-flight mechanics are unchanged

## Live Telegram smoke for Phase 7M

After deployment:

1. `/lang sw` then `/start`, `/help`, `/about`, `/status`
2. Language menu → English → verify main menu returns to English
3. Language menu → Kiswahili → Check a Website → `example.com`
4. Run SEO, DNS, and Full Audit; verify localized chrome and unchanged technical values
5. Test Summary, Priorities, category view, Re-run, Back, Check Another
6. Test invalid URL/protocol messaging in Kiswahili
7. Switch back with `/lang en` and repeat a basic audit

## Phase 7N durable preferences

Focused checks should cover:

- missing `SUPABASE_URL` or `SUPABASE_SECRET_KEY` → preference storage reports not configured and bot falls back safely
- malformed Supabase URL or secret format → no outbound preference request
- valid Telegram numeric user ID + `en`/`sw` → durable read/write path allowed
- invalid/non-numeric user ID → no database request
- invalid locale input never reaches durable storage
- read with no matching row → Telegram `language_code`, then English fallback
- read success → durable locale hydrates the isolate cache
- write success → explicit `/lang` choice is upserted by Telegram user ID
- timeout/network/HTTP failure → bot remains usable and explicit local choice still applies in the current isolate
- cache remains bounded to 500 entries and expires after 5 minutes
- no secret value appears in callback data, user-visible output, or logs

## Live Telegram smoke for Phase 7N

Production validation completed:

1. Cloudflare runtime confirmed `SUPABASE_URL` and `SUPABASE_SECRET_KEY` were present and valid via admin boolean-only diagnostics.
2. `/lang sw` returned the Kiswahili UI.
3. Supabase row was confirmed with the Telegram numeric user ID and `locale = 'sw'`.
4. Production was redeployed to clear isolate-local preference state.
5. Without sending `/lang sw` again, `/start` opened directly in Kiswahili, confirming durable read/hydration from Supabase.
6. Language menu remained available and functional.

## Phase 7O automated preference tests

Run:

```bash
npm test
```

The Node test suite covers:

- preference configuration readiness
- fail-open behavior when Supabase is not configured
- invalid Telegram user IDs never reaching Supabase
- allowlisted durable locale reads
- rejection of unexpected stored locales
- strict `en`/`sw` write allowlist and upsert request shape
- network failure fallback with secret-leak assertion
- isolate cache precedence while fresh
- 5-minute cache expiry fallback
- 500-entry cache bound

The Phase 7O implementation was validated locally with 10/10 automated tests passing before PR creation.

## Production regression

- valid tool APIs remain HTTP 200
- webhook GET remains 405
- webhook POST with bad secret remains 401
- Cloud Engine schemas and scoring are unchanged
- Supabase preference failure must never block analyzer/API execution
