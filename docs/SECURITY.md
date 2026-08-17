# Security

Telegram usage tracking remains isolate-local and ephemeral. Durable language preferences use Supabase only for the minimal preference record described below.

Admin identity uses Telegram user id via `TELEGRAM_ADMIN_IDS` only.

SSRF authority remains Cloud Engine.

## Phase 7M localization

- Supported locale identifiers are allowlisted to `en` and `sw`.
- Language callbacks are fixed values only: `menu:lang`, `lang:en`, `lang:sw`.
- Locale values never influence API URLs, tool routing, authorization, SSRF decisions, or secrets.
- Telegram remains plain text; translation interpolation uses simple named placeholders and does not evaluate code.
- Technical analyzer payloads are not machine-translated.
- Existing webhook secret validation, callback allowlist, usage controls, cooldown, deduplication, audit in-flight guard, admin authorization, and Cloudflare edge controls remain unchanged.

## Phase 7N durable preferences

- Durable language preferences are stored in `public.telegram_user_preferences`.
- The table stores only Telegram numeric user ID, allowlisted locale (`en` or `sw`), `created_at`, and `updated_at`.
- Row Level Security is enabled.
- `anon` and `authenticated` have no table privileges.
- Backend access uses the Supabase secret key through Cloudflare server-side environment bindings only.
- `SUPABASE_SECRET_KEY` must never be committed, exposed in browser/client code, placed in callback data, or printed in logs/admin output.
- Supabase REST requests authenticate with the server-side `apikey` header.
- Telegram user IDs are validated as numeric before they are used in preference queries.
- Locale input is normalized/allowlisted before persistence.
- Preference reads/writes use a bounded timeout and fail open; Supabase failure must not block Telegram commands or Cloud Engine checks.
- The isolate-local preference cache is bounded to 500 entries with a 5-minute TTL.
- No Telegram username, display name, checked domain/URL, diagnostic result, or browsing history is stored by the preference layer.
- Locale persistence does not alter analyzer routing, Cloud Engine scoring, authorization, SSRF boundaries, or `/api/*` contracts.

## Phase 7O preference hardening

- Durable writes accept only strict persisted locale values `en` and `sw`; unexpected locale values are rejected before any Supabase request.
- Preference read/write observability uses sanitized structured events: `telegram_preference_read` and `telegram_preference_write`.
- Preference log events expose only operational status, bounded error codes, and duration; they do not include Supabase keys, request URLs, Telegram user IDs, or preference payload bodies.
- Network/HTTP/config failures remain fail-open and are logged as fallback/skipped states rather than thrown into the bot flow.
- `/admin` exposes only a concise `Active (Supabase)` or `Fallback only` durable-preference status. The temporary detailed environment presence/format diagnostic is removed from user-visible output.

## Phase 7P settings foundation

- Settings adds no new database table, column, or durable user attribute.
- The only durable preference remains the allowlisted `en`/`sw` locale from Phase 7N.
- The new `menu:settings` callback is a fixed, allowlisted action and carries no identifiers, domains, URLs, secrets, or preference payloads.
- The Settings callback checks normal Telegram authorization before returning user-facing content.
- Opening Settings clears pending guided-input state so a later text message is not accidentally treated as an earlier website target flow.
- Settings only displays the current presentation locale and routes to the existing fixed language selector.
- Analyzer routing, scoring, SSRF validation, webhook secret validation, and `/api/*` contracts remain unchanged.
