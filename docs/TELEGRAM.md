# Telegram Bot (Phase 7A / 7B)

Thin client over Cloud Engine HTTP APIs. **Does not** reimplement DNS, SSRF, scoring, or analyzers.

## Endpoint

`POST /api/telegram/webhook`

- GET/others → **405** `Allow: POST`
- Optional header: `X-Telegram-Bot-Api-Secret-Token` when `TELEGRAM_WEBHOOK_SECRET` is set
- Without `TELEGRAM_BOT_TOKEN` → **503** `BOT_NOT_CONFIGURED`

## Production activation (operator)

Code is deployed. Live bot operation requires Cloudflare Pages **encrypted secrets**:

1. Cloudflare Dashboard → Workers & Pages → `sautilink-cloud-engine` → **Settings** → **Variables and Secrets**
2. Add (Encrypt):
   - `TELEGRAM_BOT_TOKEN` — from @BotFather (never commit)
   - `TELEGRAM_WEBHOOK_SECRET` — strong random string (never commit)
   - `CLOUD_ENGINE_BASE_URL` — optional; defaults to `https://cloudengine.sautilink.com`
3. **Redeploy** the Pages project so Functions pick up secrets
4. Register webhook (replace placeholders; do not log the token):

```bash
curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://cloudengine.sautilink.com/api/telegram/webhook\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\"]}"

curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

5. Smoke-test in Telegram: `/start`, `/help`, `/audit https://example.com`

## Commands

`/start` `/help` `/id` `/audit` `/dns` `/email` `/headers` `/ssl` `/website` `/mobile` `/robots` `/sitemap` `/http`

## Rate limits

Cloudflare edge rate limiting is the global control. HTTP **429** from Cloud Engine is mapped to a plain-text “temporarily rate-limited” Telegram reply. No in-memory global limiter in the bot.

## Stateless retries

No update deduplication store. Telegram may retry; users may rarely see duplicate replies.

## Live status (Phase 7B check)

As of the last automated verification, production returned **503 BOT_NOT_CONFIGURED** because secrets were not present in the Pages environment. Until secrets + setWebhook + getWebhookInfo succeed, the bot is **not operational**.
