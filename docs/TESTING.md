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
- invalid locale/report-detail/developer-mode values never reach durable storage
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
- privacy copy does not claim Chat ID or checked-site history is persisted
- public Settings output remains SautiLink-branded and vendor-neutral

## Phase 7S personalisation tests

Automated tests cover:

- default presentation = Compact + Developer Mode Off
- personalisation cache hydration/update/expiry/500-entry bound
- fixed allowlisted callbacks:
  - `pref:detail:compact`
  - `pref:detail:detailed`
  - `pref:dev:off`
  - `pref:dev:on`
- arbitrary callback suffixes are rejected
- durable profile read maps locale, report detail, and developer mode correctly
- durable personalisation writes require strict full values
- Detailed mode returns more DNS records/findings/recommendations than Compact
- Developer Mode adds target-facing technical metadata and machine finding codes
- Developer Mode output remains free of infrastructure-vendor branding
- audit Compact/Detailed modes use different item limits
- Settings callback integration persists the new value before updating the local cache/UI

Run the Node suite with:

```bash
npm test
```

The connected execution environment used during Phase 7S cannot resolve GitHub from the local container, so local clone-based execution is not treated as a validation signal. Branch/PR deployment plus live Telegram smoke are required before marking the phase live verified.

## Live Telegram smoke for Phase 7S

After production deployment:

1. `/settings` → confirm defaults/current saved values are visible.
2. Select **Detailed** → reopen `/settings`; it must still show Detailed.
3. Run DNS or Website check → confirm more findings/records are shown than Compact.
4. Switch to **Compact** → rerun the same target; output should be shorter while scores remain unchanged.
5. Enable **Developer Mode** → rerun Website/HTTP/Audit; confirm additional target metadata/finding codes appear.
6. Confirm Developer Mode output does not mention infrastructure providers, secrets, deployment topology, or SautiLink architecture.
7. Disable Developer Mode → technical extras disappear.
8. Redeploy production, then `/settings` again → Report Detail and Developer Mode must remain remembered.
9. Switch language and confirm presentation preferences remain unchanged.
10. Run Full Audit → Summary → Priorities → category view → Re-run; all views must respect the same presentation preference.

## Production regression

- valid tool APIs remain HTTP 200
- webhook GET remains 405
- webhook POST with bad secret remains 401
- Cloud Engine schemas and scoring remain unchanged
- SSRF behavior remains unchanged
- durable-preference failure must never block analyzer/API execution
- normal user-facing bot output must remain SautiLink-first and vendor-neutral
