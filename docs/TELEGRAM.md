# Telegram Bot

Thin client over Cloud Engine APIs with menus and enhanced audit reports.

## Audit report UX

`/audit` shows overall score, Unicode score bars, top findings/recommendations, and buttons:

- `audit:rerun` `audit:summary` `audit:priorities`
- category: `audit:security|seo|mobile|email|https`
- `audit:back` restores the full audit view

Target is recovered from the message text (e.g. `🌐 example.com`). Callback data never contains URLs.

Views may re-fetch a single `/api/audit` — they do not fan out individual analyzers.

## Menus

Fixed `menu:*` / `tool:*` callbacks. Tool buttons only show usage prompts.
