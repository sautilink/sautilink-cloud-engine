# API Reference

| Method | Path |
|--------|------|
| GET | `/api/health` |
| GET | `/api/dns?domain=` |
| GET | `/api/http-status?url=` |
| GET | `/api/email?domain=&selector=` |
| GET | `/api/headers?url=` |
| GET | `/api/robots?url=` |

## `GET /api/robots?url=https://example.com`

Fetches **only** `/robots.txt` for the given site origin (path/query stripped). Reuses HTTP-status SSRF/redirect stack. Does **not** fetch Sitemap URLs.

- 200 body analysis when robots.txt is returned
- 404/403 treated as structured outcomes (`robots.found: false`), not engine failures
- `ROBOTS_TOO_LARGE` if body exceeds 256 KiB
- Score model **v1.0** (availability / syntax / crawl / sitemap / quality)
- Cache: `no-store`
