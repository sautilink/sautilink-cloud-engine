# Security

Telegram usage tracking is isolate-local and ephemeral. No DB/KV is required for the Telegram client.

Admin identity uses Telegram user id via `TELEGRAM_ADMIN_IDS` only.

SSRF authority remains Cloud Engine.

## Phase 7M localization

- Supported locale identifiers are allowlisted to `en` and `sw`.
- Language callbacks are fixed values only: `menu:lang`, `lang:en`, `lang:sw`.
- Locale values never influence API URLs, tool routing, authorization, SSRF decisions, or secrets.
- Explicit language preference is bounded isolate-local state (max 500 chats, 24h TTL), not durable identity data.
- Telegram remains plain text; translation interpolation uses simple named placeholders and does not evaluate code.
- Technical analyzer payloads are not machine-translated.
- Existing webhook secret validation, callback allowlist, usage controls, cooldown, deduplication, audit in-flight guard, admin authorization, and Cloudflare edge controls remain unchanged.
