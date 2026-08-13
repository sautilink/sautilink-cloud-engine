# API Reference — SautiLink Cloud Engine

Base URL (production): `https://cloudengine.sautilink.com`

All tool endpoints follow the response conventions below (except `/api/health`, which keeps a fixed legacy body).

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
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

- `requestId` is present on tool error responses when available.
- Response header `X-Request-Id` is always set on hardened endpoints.
- Do not expose internal stack traces or infrastructure details.

### HTTP status codes (Cloud Engine API)

| Status | Meaning |
|--------|---------|
| 200 | Success (including when the *target* site returns 4xx/5xx) |
| 400 | Bad request (validation) |
| 403 | SSRF / private destination blocked |
| 404 | Unknown API route |
| 405 | Method not allowed |
| 413 | Request input too large |
| 429 | Rate limited (Cloudflare edge rules, when configured) |
| 500 | Unexpected internal error |
| 502 | Upstream/network failure |
| 504 | Upstream timeout |

---

## Implemented endpoints

### `GET /api/health`

Health check for deployment verification and connectivity tests.

**Authentication:** none  
**Methods:** GET, OPTIONS  
**Body schema (unchanged):**

```json
{
  "status": "ok",
  "service": "SautiLink Cloud Engine",
  "timestamp": "2026-08-13T00:00:00.000Z"
}
```

**Caching:** `Cache-Control: no-store`

---

### `GET /api/dns`

Live DNS lookup via DNS-over-HTTPS (Cloudflare DoH). No authentication.

**Query parameters:**

| Name | Required | Description |
|------|----------|-------------|
| `domain` | yes | Public domain name only (e.g. `example.com`) |

**Example:** `/api/dns?domain=example.com`

**Success (200):** structured A/AAAA/CNAME/MX/NS/TXT records. Empty arrays mean no records of that type.

**Caching:** successful responses may use `public, max-age=30`. Errors use `no-store`.

See earlier Phase 2 documentation for full error codes.

---

### `GET /api/http-status`

Safe HTTP/HTTPS status probe with SSRF protections. No authentication.

**Query parameters:**

| Name | Required | Description |
|------|----------|-------------|
| `url` | yes | Public `http` or `https` URL (max 2048 chars) |

**Example:** `/api/http-status?url=https://example.com`

**Success (200)** — engine contacted the target (target status may be any code):

```json
{
  "success": true,
  "data": {
    "url": "https://example.com/",
    "finalUrl": "https://example.com/",
    "status": 200,
    "statusText": "OK",
    "protocol": "https",
    "redirected": false,
    "redirectCount": 0,
    "redirectChain": [],
    "responseTimeMs": 123,
    "contentType": "text/html; charset=UTF-8",
    "contentLength": null,
    "server": "EO-Server",
    "location": null
  }
}
```

**Important:** A target `404` or `403` is still `success: true` with API HTTP 200. Engine failures use `success: false`.

**Behavior:**

- Protocols: `http`, `https` only
- Credentials in URL rejected
- HEAD first; GET fallback on 405/501
- Manual redirects, max 5; each hop re-validated for SSRF
- Timeout: 8 seconds (not user-controllable)
- Response body cap: 64 KiB when GET is used
- Safe headers only: content-type, content-length, server, location
- Caching: `no-store`

**Error codes:**

| Code | HTTP | Meaning |
|------|------|---------|
| `MISSING_URL` | 400 | No `url` parameter |
| `INVALID_URL` | 400 | Malformed URL |
| `UNSUPPORTED_PROTOCOL` | 400 | Not http/https |
| `CREDENTIALS_NOT_ALLOWED` | 400 | Userinfo in URL |
| `PRIVATE_ADDRESS_BLOCKED` | 403 | Private/reserved IP or resolution |
| `SSRF_BLOCKED` | 403 | Blocked hostname class |
| `REDIRECT_LIMIT` | 400 | More than 5 redirects |
| `REQUEST_TIMEOUT` | 504 | Target did not respond in time |
| `UPSTREAM_DNS_ERROR` | 502 | Hostname could not be resolved |
| `UPSTREAM_CONNECTION_ERROR` | 502 | Connection failed |
| `RESPONSE_TOO_LARGE` | 502 | Body exceeded size limit |
| `METHOD_NOT_ALLOWED` | 405 | Non-GET/OPTIONS |
| `REQUEST_TOO_LARGE` | 413 | Oversized request input |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

---

### Unknown routes

`GET /api/<unknown>` → JSON 404 with code `NOT_FOUND`.

---

## CORS

Allowlisted origins only (production + local Wrangler/dev). See [SECURITY.md](SECURITY.md).

---

## Rate limiting

Application code does not enforce a global request quota. Configure Cloudflare Rate Limiting / WAF on expensive paths (`/api/dns*`, `/api/http-status*`). See [SECURITY.md](SECURITY.md).

---

## Versioning

No version prefix yet (`/api/v1/...`).
