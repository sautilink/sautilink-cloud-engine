# Phase 6H — Regression & Security Notes

## API regression (production)

All of the following returned HTTP 200 on 2026-08-14 against `https://cloudengine.sautilink.com`:

| Endpoint | Notes |
|----------|--------|
| `/api/health` | Legacy shape `{ status, service, timestamp }` (no `success` field) |
| `/api/dns` | `success: true` |
| `/api/http-status` | `success: true` |
| `/api/email` | `success: true` |
| `/api/headers` | `success: true` |
| `/api/robots` | `success: true` |
| `/api/sitemap` | `success: true` |
| `/api/website` | `success: true` |
| `/api/mobile` | `success: true` |
| `/api/ssl` | `success: true` |
| `/api/audit` | `success: true` |

## Security matrix (URL tools)

| Input | Expected |
|-------|----------|
| `localhost` | 403 `SSRF_BLOCKED` |
| `127.0.0.1` | 403 `PRIVATE_ADDRESS_BLOCKED` |
| `169.254.169.254` | 403 `PRIVATE_ADDRESS_BLOCKED` |
| Private IPv4 / IPv6 / CGNAT | 403 `PRIVATE_ADDRESS_BLOCKED` |
| Metadata hostnames | 403 `SSRF_BLOCKED` |
| Credentials in URL | 400 `CREDENTIALS_NOT_ALLOWED` |
| `ftp://` | 400 `UNSUPPORTED_PROTOCOL` |
| Unknown `/api/*` | 404 `NOT_FOUND` JSON |
| Unsupported methods | 405 + `Allow` (where not rate-limited) |

**Note:** Aggressive parallel probing may receive Cloudflare **429** (dashboard rate limiting). That is operational protection, not application SSRF failure.

**Scheme-less hostnames** such as `not-a-url` are normalized by `prepareUrl` to `https://not-a-url/` (URL API behavior). They are not private-IP SSRF; resolution may succeed or fail upstream.

## Audit limits (source of truth)

| Limit | Value |
|-------|-------|
| Global deadline | 18_000 ms |
| Per-analyzer timeout | 9_000 ms |
| Max concurrency | 3 |
| Analyzer count | 9 (fixed list) |

Partial analyzer failure uses `analyzers[id].status` ∈ `ok` \| `timeout` \| `error` \| `blocked` \| `deadline_skipped` without failing the whole audit.

Missing category scores are **excluded** and weights **renormalized** (`score.renormalized`).

## Score grade boundaries

| Grade | Range |
|-------|-------|
| A | 90–100 |
| B | 80–89 |
| C | 70–79 |
| D | 60–69 |
| F | 0–59 |
