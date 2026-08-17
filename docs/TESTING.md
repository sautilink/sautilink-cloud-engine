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

## Production regression

- valid tool APIs remain HTTP 200
- webhook GET remains 405
- webhook POST with bad secret remains 401
- Cloud Engine schemas and scoring are unchanged
