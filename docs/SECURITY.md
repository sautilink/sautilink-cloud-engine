# Security

## SSRF

URL tools and Telegram URL commands rely on Cloud Engine `prepareUrl` + `assertUrlSafeToFetch`.

## Telegram

- Webhook secret header verification
- Callback allowlist (no arbitrary URLs in callback_data)
- Bot is a thin client; no second SSRF path that weakens engine checks
- Best-effort in-isolate dedup/cooldown is **not** a global control plane

## Rate limiting

Cloudflare dashboard/edge rate limiting is the production global control. Application code must not claim global in-memory rate limiting.
