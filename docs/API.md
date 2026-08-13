# API Reference — SautiLink Cloud Engine

Base URL (production): `https://cloudengine.sautilink.com`

Tool endpoints use `{ success, data }` / `{ success, error }` except `/api/health` (legacy schema).

---

## Implemented endpoints

### `GET /api/health`

```json
{ "status": "ok", "service": "SautiLink Cloud Engine", "timestamp": "..." }
```

### `GET /api/dns?domain=example.com`

Live DNS (A, AAAA, CNAME, MX, NS, TXT) via Cloudflare DoH. See prior docs for full schema.

### `GET /api/http-status?url=https://example.com`

Safe HTTP/HTTPS status probe with SSRF protections. Target 4xx/5xx still yield API `success: true`.

### `GET /api/email?domain=example.com`

MX + SPF email infrastructure check via DNS-over-HTTPS.

**Methods:** GET, OPTIONS  
**Authentication:** none

**Success (200):**

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "mx": {
      "found": true,
      "records": [{ "priority": 0, "host": "." }]
    },
    "spf": {
      "found": true,
      "valid": true,
      "recordCount": 1,
      "record": "v=spf1 -all",
      "policy": "hardfail",
      "mechanisms": [{ "type": "all", "qualifier": "-", "value": null, "raw": "-all" }],
      "warnings": []
    }
  }
}
```

**MX:** `found` is false when no MX answers (not an engine error). Records sorted by priority ascending.

**SPF:**

- Collects all TXT records starting with `v=spf1`
- `recordCount > 1` → `valid: false`, `error: "MULTIPLE_SPF_RECORDS"`
- Policy from terminal `all`: `-all` hardfail, `~all` softfail, `?all` neutral, `+all` pass, missing → none
- Mechanisms detected (non-recursive): ip4, ip6, a, mx, include, redirect, all, and others as tokens
- Warnings for missing SPF, multiple records, weak/permissive `all`, include/redirect present

**Does not** expand `include:` / `redirect:` or enforce the RFC 10-lookup limit (planned later).

**Error codes:** `MISSING_DOMAIN`, `INVALID_DOMAIN`, `DNS_LOOKUP_FAILED` (502), `METHOD_NOT_ALLOWED` (405), `INTERNAL_ERROR` (500)

**Caching:** `public, max-age=30` on success (same short TTL as DNS); errors `no-store`.

---

## CORS & rate limiting

Controlled CORS allowlist. Global rate limits via Cloudflare dashboard. See [SECURITY.md](SECURITY.md).
