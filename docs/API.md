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

## `GET /api/ssl?url=`

Observable HTTPS configuration: HTTPS reachability, HTTP→HTTPS redirects, HSTS parsing.

**Not available in Pages Functions fetch:** certificate issuer, SANs, expiry, chain, fingerprint, TLS version, cipher. Those fields are returned as `not_observable`.

Score **v1.0** (HTTPS / redirect / HSTS / HSTS quality / consistency). Cache: `no-store`.
