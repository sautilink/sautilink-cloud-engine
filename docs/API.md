# API Reference

| Method | Path |
|--------|------|
| GET | `/api/health` |
| GET | `/api/dns?domain=` |
| GET | `/api/http-status?url=` |
| GET | `/api/email?domain=&selector=` |
| GET | `/api/email-check?domain=&check=mx|spf|dmarc|dkim&selector=` |
| GET | `/api/headers?url=` |
| GET | `/api/robots?url=` |
| GET | `/api/sitemap?url=` |
| GET | `/api/website?url=` |
| GET | `/api/mobile?url=` |
| GET | `/api/ssl?url=` |
| GET | `/api/audit?url=` |
| POST | `/api/telegram/webhook` |

`/api/email-check` is the focused single-check orchestration endpoint for the standalone MX, SPF, DMARC, and DKIM web tools. The `check` value is strictly allowlisted. `selector` is used only for DKIM. The route reuses the existing analyzer modules and performs only the DNS work needed for the selected check; it does not create report history or a second scoring model.

Telegram is a thin client; tool semantics are unchanged. See `docs/TELEGRAM.md`.
