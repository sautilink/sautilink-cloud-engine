# Telegram Bot

Thin client over Cloud Engine HTTP APIs.

## Endpoint

`POST /api/telegram/webhook` — POST only; optional `X-Telegram-Bot-Api-Secret-Token`.

## Commands

**General:** `/start` `/help` `/about` `/status` `/id`  
**Website:** `/audit` `/website` `/mobile` `/robots` `/sitemap` `/http` `/headers` `/ssl`  
**Infrastructure:** `/dns` `/email`

URL commands accept `example.com` (normalized to `https://example.com`).  
Domain commands (`/dns`, `/email`) reject full URLs.

## Audit buttons

Successful `/audit` attaches fixed callback actions only:
`audit:rerun`, `audit:security`, `audit:seo`, `audit:mobile`, `audit:email`, `audit:https`.

Target host is recovered from the message text (no URLs in callback_data, no database).

## Secrets

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (encrypted Pages secrets). Never commit values.
