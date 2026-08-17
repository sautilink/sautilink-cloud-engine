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
- Phase 7O: Telegram preference reliability and observability
  - sanitized structured logging for durable preference reads/writes
  - strict persisted-locale allowlist (`en`, `sw`)
  - focused automated tests for configuration, read, upsert, failure, fallback, and cache behavior
  - concise `/admin` durable-preference status
  - production language-persistence regression verified after deployment
  - no analyzer/API scoring changes

## In progress
- Phase 7P: Telegram Settings & Preferences foundation
  - add `/settings` as a cheap general command
  - add a fixed `menu:settings` main-menu action
  - show the currently active language inside Settings
  - retain the direct Language/Lugha shortcut on the main menu
  - move durable-language messaging from the old temporary-state wording to the verified Supabase behavior
  - keep Settings extensible for future preferences without adding new stored fields yet
  - store no usernames, display names, targets, results, or history
  - no analyzer, scoring, SSRF, or `/api/*` contract changes

## Future
- Phase 7Q+: to be defined after Phase 7P live verification
