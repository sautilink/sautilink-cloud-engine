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

## `GET /api/website?url=https://example.com`

Fetches **primary HTML only** (no crawl, no assets). SSRF via shared stack. Score **v1.0** (technical / on-page / request performance / security summary / social / HTML quality). Performance is **server/request-level**, not Lighthouse or Core Web Vitals. Cache: `no-store`.

Limits: ~8s timeout, 512 KiB HTML body, existing redirect max.
