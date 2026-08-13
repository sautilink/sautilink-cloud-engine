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

## `GET /api/sitemap?url=`

Fetches and analyzes XML sitemaps / sitemap indexes.

**Limits:** 512 KiB/doc · 5000 URLs · 25 child sitemaps · depth 2 · 10s global deadline.

Every URL (including children and robots-discovered refs) passes shared SSRF checks. Score model **v1.0**. Cache: `no-store`.
