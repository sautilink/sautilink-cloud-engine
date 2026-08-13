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

Health uses a legacy schema without a top-level `success` field. All other listed tools use `{ success, data | error, requestId? }`.

`/api/audit` limits: deadline 18s, analyzer timeout 9s, concurrency 3. Cache-Control: `no-store` on active-fetch tools.

See `docs/TESTING.md` for Phase 6H regression notes.
