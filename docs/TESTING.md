# Testing

## Usage (offline)

- cost registry: every public command has cost cheap|expensive
- under limit → allowed; at limit → rejected; admin → bypass
- max tracked chats bounded
- language/menu/settings callbacks remain cheap

## Localization regression

Offline checks cover:

- `resolveLocale`: `en`, `en-US`, `sw`, `sw-TZ`, other/missing → English fallback
- explicit choices: `en`, `english`, `sw`, `swahili`, `kiswahili`
- invalid `/lang` input does not change locale
- missing Kiswahili key falls back to English
- interpolation preserves technical values
- existing `audit:*`, `diag:*`, `result:*`, `tool:*`, `menu:*` callbacks remain valid
- guided invalid inputs remain rejected in both languages
- audit/domain recovery still works with English and Kiswahili report headings
- usage/cooldown/dedup/admin/in-flight mechanics remain unchanged

## Durable preference regression

Focused checks cover:

- missing/invalid server-side durable-store configuration → bot falls back safely
- valid Telegram numeric user ID → durable preference read/write path allowed
- invalid/non-numeric user ID → no durable request
- invalid locale/report-detail/developer-mode/default-view values never reach durable storage
- durable read hydrates locale and presentation caches
- timeout/network/HTTP failure → bot remains usable
- caches remain bounded to 500 entries and expire after 5 minutes
- no credential value appears in callback data, user-visible output, or logs

## Settings regression

The Settings suite covers:

- `/settings` remains a cheap general command
- `menu:settings` is fixed and allowlisted while arbitrary suffixes are rejected
- the main menu retains direct Language access and Settings
- Settings shows Telegram User ID and Chat ID
- Settings shows active English/Kiswahili locale
- Settings shows Report Detail, Developer Mode, and Default `/start`
- privacy copy does not claim Chat ID or checked-site history is persisted
- public Settings output remains SautiLink-branded and vendor-neutral

## Phase 7S personalisation tests

Automated tests cover:

- default presentation = Compact + Developer Mode Off
- personalisation cache hydration/update/expiry/500-entry bound
- fixed Report Detail and Developer Mode callbacks
- arbitrary callback suffixes are rejected
- durable profile read maps locale, report detail, and developer mode correctly
- durable personalisation writes require strict full values
- Detailed mode returns more DNS records/findings/recommendations than Compact
- Developer Mode adds target-facing technical metadata and machine finding codes
- Developer Mode output remains free of infrastructure-vendor branding
- audit Compact/Detailed modes use different item limits
- Settings callback integration persists the new value before updating the local cache/UI

## Phase 7T Default Experience tests

Automated tests cover:

- safe default = `main`
- cache hydration/update/expiry retains `defaultView`
- invalid cached or durable values normalize to `main`
- fixed callbacks only:
  - `pref:view:main`
  - `pref:view:quick`
  - `pref:view:tools`
  - `menu:tools`
- `/start` with `main` keeps the existing branded home experience
- `/start` with `quick` returns branded Quick Check and arms existing ephemeral guided target capture
- `/start` with `tools` returns vendor-neutral SautiLink Tools Hub
- Tools Hub uses only fixed existing tool/menu callbacks
- durable writes include strict `default_view`
- `default_view` cannot change analyzer/API/SSRF/scoring behavior

Run the Node suite with:

```bash
npm test
```

GitHub Actions is the merge gate for the Node suite. Branch deployment must also succeed before merge.

## Live Telegram smoke for Phase 7T

After production deployment:

1. `/settings` → confirm **Default /start** is visible and currently `Main Menu` unless previously changed.
2. Select **Quick** → send `/start`; it must open **SautiLink Quick Check** and accept a domain directly.
3. Return to Settings → select **Tools** → `/start`; it must open **SautiLink Tools Hub** with Website Tools, Infrastructure, Quick Check, Settings, and Back navigation.
4. Select **Main** → `/start`; the existing SautiLink Cloud Engine home must return.
5. Reopen `/settings` after each choice; the selected value must remain checked.
6. Redeploy production, then `/start`; the last selected default view must still be remembered.
7. Switch English/Kiswahili; default view must remain unchanged and the surrounding copy must localize.
8. Run one DNS, Website, and Full Audit check to verify analyzers, scores, and SSRF behavior are unchanged.
9. Verify no public start/tools/settings output mentions infrastructure vendors or architecture.

## Production regression

- valid tool APIs remain HTTP 200
- webhook GET remains 405
- webhook POST with bad secret remains 401
- Cloud Engine schemas and scoring remain unchanged
- SSRF behavior remains unchanged
- durable-preference failure must never block analyzer/API execution
- normal user-facing bot output must remain SautiLink-first and vendor-neutral
