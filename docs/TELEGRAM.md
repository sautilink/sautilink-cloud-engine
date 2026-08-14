# Telegram Bot (Phase 7A / 7B)

Thin client over Cloud Engine HTTP APIs. **Does not** reimplement DNS, SSRF, scoring, or analyzers.

## Endpoint

`POST /api/telegram/webhook`

- GET/others → **405** `Allow: POST`
- Header `X-Telegram-Bot-Api-Secret-Token` required when `TELEGRAM_WEBHOOK_SECRET` is set
- Without `TELEGRAM_BOT_TOKEN` → **503** `BOT_NOT_CONFIGURED`

## Production activation (operator)

1. Cloudflare Dashboard → Workers & Pages → project → **Settings** → **Variables and Secrets**
2. Add **encrypted** secrets for the **Production** environment:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET` (strong random)
   - `CLOUD_ENGINE_BASE_URL` (optional; defaults to `https://cloudengine.sautilink.com`)
3. **Redeploy production** after saving secrets (required for Functions to see them)
4. Register webhook using the token **only on your machine** (never paste into Git/chat logs):

```bash
# Token and secret must come from your local shell env — do not commit them
curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://cloudengine.sautilink.com/api/telegram/webhook\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\"]}"

curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

5. Smoke-test in Telegram: `/start`, `/help`, `/audit https://example.com`

### Important

Secrets set in the dashboard do **not** apply to already-running deployments until a **new production deployment** completes.

## Commands

`/start` `/help` `/id` `/audit` `/dns` `/email` `/headers` `/ssl` `/website` `/mobile` `/robots` `/sitemap` `/http`

## Rate limits

Cloudflare edge rate limiting is the global control. HTTP **429** from Cloud Engine maps to a plain-text temporary rate-limit reply.

## Stateless retries

No update deduplication store. Telegram may retry; users may rarely see duplicate replies.

## Live status

Automated checks treat the bot as configured only when `POST /api/telegram/webhook` no longer returns `BOT_NOT_CONFIGURED`.
