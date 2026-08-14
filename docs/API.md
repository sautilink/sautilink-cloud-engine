# API Reference

| Method | Path |
|--------|------|
| GET | `/api/health` |
| GET | `/api/dns?domain=` |
| GET | `/api/http-status?url=` |
| GET | `/api/email?domain=&selector=` |
| GET | `/api/headers?url=` |
| GET | `/api/robots?url=` |
| GET | `/api/sitemap?url=` |
| GET | `/api/website?url=` |
| GET | `/api/mobile?url=` |
| GET | `/api/ssl?url=` |
| GET | `/api/audit?url=` |
| POST | `/api/telegram/webhook` |

## Telegram webhook

`POST /api/telegram/webhook` only. Other methods → 405 `Allow: POST`.

Requires Cloudflare secret `TELEGRAM_BOT_TOKEN`. Optional `TELEGRAM_WEBHOOK_SECRET` (header `X-Telegram-Bot-Api-Secret-Token`). Without token → 503 `BOT_NOT_CONFIGURED`.

See `docs/TELEGRAM.md`.

Health uses a legacy schema without a top-level `success` field. Tool endpoints use `{ success, data | error }`.
