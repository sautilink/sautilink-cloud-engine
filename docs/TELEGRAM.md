# Telegram Bot

Thin client over Cloud Engine HTTP APIs.

## Endpoint

`POST /api/telegram/webhook` — POST only; `X-Telegram-Bot-Api-Secret-Token` when configured.

## Reliability (Phase 7D)

- **Update dedup:** best-effort `update_id` cache **within one isolate** (~60s). **Not durable** across isolates; Telegram retries may still process twice.
- **Cooldowns:** best-effort per-chat delay on expensive commands in the same isolate. **Cloudflare edge rate limiting is authoritative.**
- **Audit in-flight:** soft guard against rapid Re-run clicks in the same isolate.
- **Telegram API errors:** mapped to safe categories (auth, rate limit, client, upstream, timeout). No raw API bodies to users.
- **Logging:** structured JSON metadata only (event, update_id, command, status, duration). Never tokens/secrets.

## Callbacks

Allowlist only: `audit:rerun|security|seo|mobile|email|https`. Target recovered from message text.

## Secrets

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` — Cloudflare encrypted secrets only.
