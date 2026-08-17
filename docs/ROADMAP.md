# Roadmap

## Completed
- Phase 7J: Guided Telegram website checks
- Phase 7K: Guided diagnostics over existing Cloud Engine APIs
- Phase 7L: Result actions (Re-run, Full Audit, Check Another, Back) + guided SEO fail-safe hotfix
- Phase 7M: Telegram English/Kiswahili localization — live verified
- Phase 7N: Durable Telegram language preferences with Supabase — live verified
  - explicit language choice persists across Cloudflare isolate changes/redeploys
  - Telegram numeric user ID is the durable preference key
  - bounded 5-minute isolate cache reduces database reads
  - Telegram `language_code` + English remain safe fallbacks
  - Supabase reads/writes fail open and never block Cloud Engine checks
  - server-side `SUPABASE_SECRET_KEY` only; no secret in clients/callbacks/logs
  - `telegram_user_preferences` is RLS-enabled and inaccessible to anon/authenticated roles
  - live write confirmed in Supabase and live read confirmed after production redeploy
  - no analyzer, scoring, SSRF, or `/api/*` contract changes
- Phase 7O: Telegram preference reliability and observability — live verified
  - sanitized structured logging for durable preference reads/writes
  - strict persisted-locale allowlist (`en`, `sw`)
  - focused automated tests for configuration, read, upsert, failure, fallback, and cache behavior
  - concise `/admin` durable-preference status
  - production language-persistence regression verified after deployment
  - no analyzer/API scoring changes
- Phase 7P: Telegram Settings & Preferences foundation — live verified
  - `/settings` and fixed `menu:settings` action
  - direct Language/Lugha shortcut retained
  - active language visible in Settings
  - durable-language messaging reflects verified persistence
  - no new stored preference fields
- Phase 7Q: Settings account + personalisation summary — live verified
  - Telegram User ID and Chat ID visible directly inside Settings
  - `/id` retained as an optional shortcut
  - Account, Personalisation, and Privacy sections
  - active saved language shown under Personalisation
  - checked-site history is not stored in the preference profile
  - no new database tables or columns
  - no analyzer, scoring, SSRF, or `/api/*` contract changes

## In progress
- Phase 7R: SautiLink-first corporate branding and public architecture abstraction
  - present SautiLink Cloud Engine as a SautiLink Corporation product
  - remove third-party infrastructure/provider branding from normal Telegram UX
  - replace provider-specific operational copy with SautiLink-owned wording
  - direct architecture/integration enquiries to SautiLink Corporation
  - add a durable branding policy for future public surfaces
  - add automated regression checks against vendor-name leaks in start/about/settings/admin output
  - keep open technical standards visible where useful (DNS, HTTP, HTTPS, SSL/TLS, SPF, DMARC, DKIM, etc.)
  - no analyzer, scoring, SSRF, or `/api/*` contract changes

## Future
- Phase 7S+: additional real personalisation preferences only when they have user-visible behavior and a clear persistence/privacy model
