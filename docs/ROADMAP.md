# Roadmap

## Completed
- Phase 7J: Guided Telegram website checks
- Phase 7K: Guided diagnostics over existing Cloud Engine APIs
- Phase 7L: Result actions (Re-run, Full Audit, Check Another, Back) + guided SEO fail-safe hotfix
- Phase 7M: Telegram English/Kiswahili localization — live verified

## In progress
- Phase 7N: Durable Telegram user preferences with Supabase
  - persist explicit language choice across Cloudflare isolates/recycles
  - Telegram `language_code` + English remain safe fallbacks
  - bounded 5-minute isolate cache reduces database reads
  - Supabase failures fail open and never block Cloud Engine checks
  - server-side `SUPABASE_SECRET_KEY` only; no secret in clients/callbacks/logs
  - `telegram_user_preferences` is RLS-enabled and inaccessible to anon/authenticated roles
  - no analyzer, scoring, SSRF, or `/api/*` contract changes

## Future
- Phase 7O+: to be defined after Phase 7N live verification
