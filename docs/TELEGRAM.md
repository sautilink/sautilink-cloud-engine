# Telegram Bot

Thin client over Cloud Engine APIs.

## Guided diagnostics (Phase 7K)

1. **Check a Website** → send `example.com`
2. Diagnostic menu (fixed `diag:*` callbacks only)
3. One selected tool → one existing API

Target stored isolate-local (TTL 5 min, max 200 chats). No URLs in callback data.

| Button | Endpoint |
|--------|----------|
| Security | `/api/headers` |
| SEO | `/api/website` |
| Mobile | `/api/mobile` |
| Email | `/api/email` |
| HTTPS | `/api/ssl` |
| DNS | `/api/dns` |
| Robots | `/api/robots` |
| Sitemap | `/api/sitemap` |
| Full Audit | `/api/audit` |
