# Architecture

## Unified audit

`src/tools/audit/*` → `functions/api/audit.js`

Orchestration only — reuses existing tool modules. No duplicated SSRF.

### Network fan-out (approximate upper bound)

| Analyzer | Typical outbound |
|----------|------------------|
| httpStatus | 1 HTTP + DoH |
| headers | 1 HTTP + DoH |
| ssl | 2 HTTP + DoH |
| website | 1 HTML GET + DoH |
| mobile | 1 HTML GET + DoH |
| robots | 1 GET + DoH |
| sitemap | 1+ GETs (capped) + DoH |
| dns | ≤4 DoH |
| email | multiple DoH (DKIM capped) |

Concurrency 3 and 18s deadline limit simultaneous amplification.
