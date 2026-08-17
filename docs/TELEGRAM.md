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

Locale resolution order:

1. Explicit isolate-local override for the chat, if present and not expired.
2. Telegram `from.language_code`: `sw-*` → `sw`, `en-*` → `en`.
3. English fallback for all other/missing values.

Users can switch with `/lang en`, `/lang sw`, `/lang english`, `/lang swahili`, `/lang kiswahili`, or the **Language / Lugha** main-menu button.

Explicit preferences are isolate-local, bounded (max 500 chats) and expire after 24 hours. They are not durable across isolate changes/recycles; the bot safely falls back to Telegram `language_code` and then English. No DB/KV/Durable Objects are used for Phase 7M.

Localization changes Telegram presentation only: menus, prompts, loading/errors, report labels, audit categories, grade explanations, and navigation. Domains, URLs, scores, HTTP codes, DNS records, headers, SPF/DMARC values, and arbitrary analyzer findings/recommendations remain language-neutral/pass-through.

Callback data remains fixed and language-neutral. New callbacks are only `menu:lang`, `lang:en`, and `lang:sw`.
