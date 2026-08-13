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

## `GET /api/audit?url=`

Orchestrates existing analyzers (HTTP status, headers, SSL, website, mobile, robots, DNS, email, sitemap) with:

- global deadline **18s**
- per-analyzer timeout **9s**
- concurrency **3**

Partial failures return `analyzers[id].status` of `timeout` / `error` / `deadline_skipped` without failing the whole audit.

Unified Score **v1.0** renormalizes when categories are unavailable. Cache: `no-store`.
