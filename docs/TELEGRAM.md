# Telegram Bot

Thin client over Cloud Engine APIs.

## Guided check (Phase 7J)

Main menu → **Check a Website** (`tool:audit`) → bot asks for an address → user sends `example.com` or `https://example.com` → same `/api/audit` report + keyboard.

Pending state is **isolate-local**, TTL **3 minutes**, max **200** chats. No URLs in `callback_data`. Commands cancel pending. SSRF remains in Cloud Engine.

## Public usage protection (Phase 7I)

Isolate-local quotas; Cloudflare edge remains global. Admins (`TELEGRAM_ADMIN_IDS`) bypass public quotas/cooldown only.
