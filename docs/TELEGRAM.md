# Telegram Bot

Thin client over Cloud Engine APIs. Cloud Engine remains the source of truth for analyzers and SSRF protection.

## Guided diagnostics (Phase 7K)

1. **Check a Website** → send `example.com`
2. Diagnostic menu (fixed `diag:*` callbacks only)
3. One selected tool → one existing API

Target state is isolate-local (TTL 5 min, max 200 chats). No URLs are stored in callback data.

| Button | Endpoint |
|--------|----------|
| Security | `/api/headers` |
| SEO | `/api/website` |
| Mobile | `/api/mobile` |
| Email | `/api/email` |
| HTTPS | `/api/ssl` |
| DNS | `/api/dns` |
| Robots | `/api/robots` |
| Sitemap | `/api/sitemap` |
| Full Audit | `/api/audit` |

## Result actions (Phase 7L)

Diagnostic results support Re-run, Full Audit, Check Another, and Back. Full Audit keeps Summary, Priorities, category details, Re-run, and Back. Target recovery never trusts callback data.

The guided diagnostic runner has a fail-safe path so formatter/API failures replace loading text with a user-facing error and Retry/Back actions.

## Localization (Phase 7M)

Supported locales:

- `en` — English (default and universal fallback)
- `sw` — Kiswahili

Users can switch with `/lang en`, `/lang sw`, `/lang english`, `/lang swahili`, `/lang kiswahili`, or the **Language / Lugha** main-menu button.

Localization changes Telegram presentation only: menus, prompts, loading/errors, report labels, audit categories, grade explanations, and navigation. Domains, URLs, scores, HTTP codes, DNS records, headers, SPF/DMARC values, and arbitrary analyzer findings/recommendations remain language-neutral/pass-through.

Callback data remains fixed and language-neutral. Language callbacks are only `menu:lang`, `lang:en`, and `lang:sw`.

## Durable language preferences (Phase 7N)

Explicit language choices are durable through Supabase while a bounded isolate-local cache keeps normal bot interactions fast.

Locale resolution order:

1. Explicit isolate-local override for the chat, if present and not expired.
2. Durable Supabase preference for the Telegram numeric user ID, if one exists.
3. Telegram `from.language_code`: `sw-*` → `sw`, `en-*` → `en`.
4. English fallback for all other/missing values.

Storage behavior:

- Table: `public.telegram_user_preferences`
- Durable key: Telegram numeric user ID
- Stored preference: allowlisted locale (`en` or `sw`)
- Metadata: `created_at` and `updated_at`
- Isolate cache: max 500 entries, 5-minute TTL
- Server access: `SUPABASE_URL` + `SUPABASE_SECRET_KEY`
- Supabase timeout/network/config failures fail open to cached/Telegram/English fallback behavior
- No usernames, display names, checked targets, diagnostic results, or browsing history are stored for language preferences

Phase 7N was live-verified by saving `/lang sw` to Supabase, redeploying production to clear isolate state, then confirming `/start` still opened in Kiswahili from the durable preference.

## Preference reliability and observability (Phase 7O)

- Durable writes accept only strict persisted values `en` and `sw`.
- Unexpected locale values are rejected before an outbound Supabase request.
- Durable reads and writes emit sanitized structured operational events without secrets, user IDs, URLs, or payload bodies.
- Supabase configuration/network/HTTP failures remain fail-open so Telegram and Cloud Engine checks continue working.
- `/admin` reports only `Durable preferences: Active (Supabase)` or `Durable preferences: Fallback only` instead of detailed environment diagnostics.
- Automated Node tests cover the preference store and isolate cache behavior.
