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

## `GET /api/mobile?url=`

Primary-HTML mobile heuristics (viewport, fixed-width signals, images, SEO). **Not** Google Mobile-Friendly Test, Lighthouse, or Core Web Vitals. Score **v1.0**. Cache: `no-store`. Limits: ~8s, 512 KiB HTML.
