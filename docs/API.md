# API Reference — SautiLink Cloud Engine

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | Legacy body schema |
| GET | `/api/dns?domain=` | DoH lookups |
| GET | `/api/http-status?url=` | Status probe, `no-store` |
| GET | `/api/email?domain=&selector=` | MX/SPF/DMARC/DKIM + email score v1.0 |
| GET | `/api/headers?url=` | Headers + HTTP security score v1.0, `no-store` |

### `GET /api/headers?url=https://example.com`

Reuses HTTP-status SSRF/redirect/timeout stack. Returns sanitized headers (no `Set-Cookie` values), cookie **metadata only**, heuristic CSP/HSTS analysis, and configuration score.

**Score weights (v1.0):** HSTS 15 · CSP 25 · Content-Type 10 · Clickjacking 15 · Referrer 10 · Permissions 10 · Cookies 15.

CSP analysis is **heuristic**. Score is not proof of security. Cookie values are never returned.
