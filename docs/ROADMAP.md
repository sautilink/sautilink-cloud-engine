# Roadmap

## Completed
- Phase 7J: Guided Telegram website checks
- Phase 7K: Guided diagnostics over existing Cloud Engine APIs
- Phase 7L: Result actions (Re-run, Full Audit, Check Another, Back) + guided SEO fail-safe hotfix
- Phase 7M: Telegram English/Kiswahili localization — live verified
- Phase 7N: Durable Telegram language preferences — live verified
  - explicit language choice persists across runtime changes/redeploys
  - Telegram numeric user ID is the durable preference key
  - bounded 5-minute isolate cache reduces durable-store reads
  - Telegram `language_code` + English remain safe fallbacks
  - preference failures fail open and never block Cloud Engine checks
  - server-side secret only; no secret in clients/callbacks/logs
  - durable preference table is RLS-enabled and inaccessible to public application roles
  - live write and live read confirmed after production redeploy
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
- Phase 7R: SautiLink-first corporate branding and public architecture abstraction
  - SautiLink Cloud Engine presents as a SautiLink Corporation product
  - third-party infrastructure/provider branding removed from normal Telegram UX
  - provider-specific operational copy replaced with SautiLink-owned wording
  - architecture/integration enquiries directed to SautiLink Corporation
  - branding policy and automated vendor-name regression checks added
  - open technical standards remain visible where useful (DNS, HTTP, HTTPS, SSL/TLS, SPF, DMARC, DKIM, etc.)
  - no analyzer, scoring, SSRF, or `/api/*` contract changes
- Phase 7S: Personalisation v1 — live verified
  - durable Report Detail preference: `compact` or `detailed`
  - durable Developer Mode preference: `off` or `on`
  - defaults remain conservative: Compact + Developer Mode Off
  - Settings exposes fixed allowlisted callbacks only; no preference values are accepted from arbitrary callback payloads
  - Compact reduces findings/records shown; Detailed expands findings, recommendations, and DNS records within Telegram limits
  - Developer Mode adds target-facing technical metadata and machine finding codes only
  - Developer Mode never exposes SautiLink infrastructure, vendors, secrets, internal topology, or architecture
  - presentation preferences use a bounded 5-minute per-user isolate cache plus durable fallback
  - Telegram User ID remains the durable key; Chat ID and checked-site history are not persisted in the preference profile
  - existing preference storage is extended; no new user/profile/history table is created
  - automated CI passed 33/33 tests with zero failures
  - production Settings behavior confirmed live and durable preference write verified in the preference store
  - no analyzer, scoring, SSRF, or `/api/*` contract changes

## In progress
- Phase 7T: define the next user-visible experience improvement

## Future
- Phase 7T+: default landing experience and additional personalisation only when each option has real user-visible behavior and a clear persistence/privacy model
