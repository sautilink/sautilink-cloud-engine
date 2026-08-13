# API Reference — SautiLink Cloud Engine

Base URL: `https://cloudengine.sautilink.com`

## `GET /api/email?domain=example.com&selector=`

MX + SPF + DMARC + DKIM via Cloudflare DoH.

**Query:**

| Param | Required | Description |
|-------|----------|-------------|
| `domain` | yes | Public domain name |
| `selector` | no | DKIM selector (DNS label). If omitted, heuristic discovery runs |

**DKIM (`data.dkim`):**

- **Explicit:** only `selector._domainkey.domain` is queried; `confidence: "explicit"`
- **Heuristic:** up to **25** common selectors; stops at first found record; `confidence: "heuristic"`
- `found: false` → `valid: null` (not determined), never claimed as “no DKIM on domain” for heuristic mode
- Empty `p=` → `revoked: true`, selector exists but key deactivated
- Missing `p` tag → `valid: false`, `MISSING_PUBLIC_KEY`
- Multiple candidate TXT → `MULTIPLE_DKIM_RECORDS`
- **Does not** verify message signatures — DNS public-key record inspection only

**Selector validation:** DNS label, max 63 chars; no paths, protocols, dots, or whitespace.

MX / SPF / DMARC semantics unchanged (backwards compatible).

**Caching:** success `public, max-age=30`.

Other endpoints: `/api/health`, `/api/dns`, `/api/http-status` — see prior phases.
