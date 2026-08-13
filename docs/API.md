# API Reference — SautiLink Cloud Engine

Base URL (production): `https://cloudengine.sautilink.com`

All tool endpoints follow the response conventions below.

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

Health check for deployment verification and connectivity tests.

**Authentication:** none

**Response (200):**

```json
{
  "status": "ok",
  "service": "SautiLink Cloud Engine",
  "timestamp": "2026-08-13T00:00:00.000Z"
}
```

**CORS:** GET, OPTIONS

---

### `GET /api/dns`

Live DNS lookup via DNS-over-HTTPS (Cloudflare DoH). No authentication.

**Query parameters:**

| Name | Required | Description |
|------|----------|-------------|
| `domain` | yes | Public domain name only (e.g. `example.com`) |

**Example:** `/api/dns?domain=example.com`

**Success (200):**

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "records": {
      "A": ["93.184.216.34"],
      "AAAA": ["2606:2800:220:1:248:1893:25c8:1946"],
      "CNAME": [],
      "MX": [],
      "NS": ["a.iana-servers.net", "b.iana-servers.net"],
      "TXT": ["v=spf1 -all"]
    }
  }
}
```

Empty arrays mean no records of that type (not an error).

**Error codes:**

| Code | HTTP | Meaning |
|------|------|---------|
| `MISSING_DOMAIN` | 400 | No `domain` parameter |
| `INVALID_DOMAIN` | 400 | Malformed domain, URL, localhost, or private target |
| `DNS_RESOLVER_ERROR` | 502 | DoH upstream unreachable / failed for all types |
| `INTERNAL_ERROR` | 500 | Unexpected failure (no stack traces) |

**Supported record types:** A, AAAA, CNAME, MX, NS, TXT

**Validation:** Rejects protocols (`https://`), paths, queries, fragments, `localhost`, private IPs, and bare IPv4. Normalizes case and trailing dots (`Example.COM.` → `example.com`).

**Architecture:** Queries are sent only to Cloudflare DoH (`https://cloudflare-dns.com/dns-query`). The API never fetches arbitrary user-supplied URLs.

---

## Planned endpoint map

### DNS & Email

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/dns` | General DNS lookup **(implemented)** |
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

## Rate limiting

Not enforced in application code yet. Before heavy public traffic:

- Prefer Cloudflare dashboard rate limiting rules
- Document limits here
- Return `RATE_LIMITED` when enforced

---

## Versioning

No version prefix yet (`/api/v1/...`). Introduce versioning when breaking changes are required or a public API program starts.
