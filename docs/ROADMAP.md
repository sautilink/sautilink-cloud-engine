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

## In progress
- Phase 7O: Telegram preference reliability and observability
  - add sanitized structured logging for durable preference reads/writes
  - add focused tests for configuration, read, upsert, timeout/failure, fallback, and cache behavior
  - replace temporary verbose `/admin` Supabase diagnostics with a concise durable-preference status
  - keep preference storage minimal; do not store usernames, names, checked targets, or result history
  - no analyzer/API scoring changes

## Future
- Phase 7P+: to be defined after Phase 7O live verification
