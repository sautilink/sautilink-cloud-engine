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

Live DNS (A, AAAA, CNAME, MX, NS, TXT) via Cloudflare DoH.

### `GET /api/http-status?url=https://example.com`

Safe HTTP/HTTPS status probe with SSRF protections.

### `GET /api/email?domain=example.com`

MX + SPF + DMARC email infrastructure check via DNS-over-HTTPS.

**Methods:** GET, OPTIONS  
**Authentication:** none

**Success (200):**

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "mx": { "found": true, "records": [{ "priority": 0, "host": "." }] },
    "spf": {
      "found": true,
      "valid": true,
      "recordCount": 1,
      "record": "v=spf1 -all",
      "policy": "hardfail",
      "mechanisms": [],
      "warnings": []
    },
    "dmarc": {
      "found": true,
      "valid": true,
      "record": "v=DMARC1; p=reject; ...",
      "policy": "reject",
      "subdomainPolicy": null,
      "percentage": 100,
      "alignment": { "dkim": "relaxed", "spf": "relaxed" },
      "reporting": { "aggregate": [], "forensic": [] },
      "options": {},
      "warnings": []
    }
  }
}
```

**MX / SPF:** unchanged from Phase 5A (backwards compatible; `dmarc` is additive).

**DMARC:**

- Queries TXT at `_dmarc.<domain>`
- Requires `v=DMARC1` and `p=` (`none` | `quarantine` | `reject`)
- Multiple DMARC TXT → `valid: false`, `error: "MULTIPLE_DMARC_RECORDS"`
- Tags: `v`, `p`, `sp`, `pct` (default 100), `rua`, `ruf`, `adkim`/`aspf` (`r`→relaxed, `s`→strict; default relaxed), `fo`, `rf`, `ri`
- `rua`/`ruf`: only `mailto:` destinations collected (no callbacks)
- Unknown tags preserved under `options` with a warning
- Missing record → `found: false` (not an engine error)

**Error codes (engine):** `MISSING_DOMAIN`, `INVALID_DOMAIN`, `DNS_LOOKUP_FAILED` (502), `METHOD_NOT_ALLOWED` (405), `INTERNAL_ERROR` (500)

DMARC structural issues are returned inside `data.dmarc` (`valid: false`, optional `error`), not as top-level API failures.

**Caching:** `public, max-age=30` on success; errors `no-store`.

**Not included:** DKIM, Email Security Score, recursive SPF.

---

## CORS & rate limiting

Controlled CORS allowlist. Global rate limits via Cloudflare dashboard. See [SECURITY.md](SECURITY.md).
