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

The temporary `/admin` configuration diagnostic reports only presence/format booleans and never returns environment variable values or secret fragments.
