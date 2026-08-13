# API Reference — SautiLink Cloud Engine

Base URL (production): `https://cloudengine.sautilink.com`

All tool endpoints (when implemented) should follow the response conventions below.

---

## Response conventions

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DOMAIN",
    "message": "Please provide a valid domain."
  }
}
```

Do not expose internal stack traces or infrastructure details.

---

## Implemented endpoints

### `GET /api/health`

Health check for deployment verification and connectivity tests (web, Telegram, monitoring).

**Authentication:** none  

**Response (200):**

```json
{
  "status": "ok",
  "service": "SautiLink Cloud Engine",
  "timestamp": "2026-08-13T00:00:00.000Z"
}
```

Note: This endpoint currently returns a compact shape focused on status. Future consistency may wrap it in `{ success, data }` if desired; keep backward compatible.

**CORS:** `Access-Control-Allow-Origin: *` (GET, OPTIONS)

---

## Planned endpoint map

These routes are **not implemented** in Phase 1. They define the intended structure.

### DNS & Email

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/dns` | General DNS lookup |
| GET/POST | `/api/dns/mx` | MX records |
| GET/POST | `/api/dns/spf` | SPF record analysis |
| GET/POST | `/api/dns/dkim` | DKIM selector check |
| GET/POST | `/api/dns/dmarc` | DMARC policy |
| GET/POST | `/api/dns/ns` | Nameservers |

### Website & SEO

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/website/http-status` | Status codes & redirects |
| GET/POST | `/api/website/robots` | robots.txt |
| GET/POST | `/api/website/sitemap` | Sitemap analysis |
| GET/POST | `/api/website/seo` | Basic SEO signals |
| GET/POST | `/api/website/performance` | Performance-related signals |

### Security

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/security/ssl` | TLS/certificate |
| GET/POST | `/api/security/headers` | Security headers |
| GET/POST | `/api/security/blacklist` | Blacklist status |
| GET/POST | `/api/security/waf` | WAF detection |
| GET/POST | `/api/security/cdn` | CDN / Cloudflare detection |

### Infrastructure

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/infrastructure/ip` | IP details |
| GET/POST | `/api/infrastructure/asn` | ASN lookup |
| GET/POST | `/api/infrastructure/rdns` | Reverse DNS |
| GET/POST | `/api/infrastructure/headers` | HTTP response headers |
| GET/POST | `/api/infrastructure/hosting` | Hosting provider hints |

---

## Common parameters (planned)

- `domain` — normalized public domain (required for DNS tools)
- `url` — public HTTP(S) URL (required for website tools)
- `type` — DNS record type filter where applicable

All inputs must pass through validation helpers (`src/utils/validation.js`).

---

## Rate limiting

Not enforced in Phase 1. Before public tool endpoints go live:

- Define per-IP and per-route limits (Cloudflare rate limiting rules or Workers KV/Durable Objects later).
- Document limits in this file.
- Return a consistent error code, e.g. `RATE_LIMITED`.

---

## Versioning

No version prefix yet (`/api/v1/...`). Introduce versioning when breaking changes are required or a public API program starts.
