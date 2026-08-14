# Telegram Bot (Phase 7A)

Thin client over Cloud Engine HTTP APIs. **Does not** reimplement DNS, SSRF, scoring, or analyzers.

## Endpoint

`POST /api/telegram/webhook`

- GET/others → **405** `Allow: POST`
- Optional header: `X-Telegram-Bot-Api-Secret-Token` when `TELEGRAM_WEBHOOK_SECRET` is set

## Environment (Cloudflare Pages secrets)

| Name | Required | Purpose |
|------|----------|--------|
| `TELEGRAM_BOT_TOKEN` | yes | Bot API token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | recommended | Shared secret for webhook verification |
| `CLOUD_ENGINE_BASE_URL` | no | Defaults to `https://cloudengine.sautilink.com` |

Never commit these values.

## Set webhook (operator)

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://cloudengine.sautilink.com/api/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message"]
  }'
```

## Commands

`/start` `/help` `/id` `/audit` `/dns` `/email` `/headers` `/ssl` `/website` `/mobile` `/robots` `/sitemap` `/http`

## Stateless retries

There is no update deduplication store. Telegram may retry; users may see duplicate replies under rare failure conditions.

## Live status

Bot code is deployed with the Pages project. **Live verification requires secrets + webhook registration** — until then the webhook returns **503** `BOT_NOT_CONFIGURED`.
