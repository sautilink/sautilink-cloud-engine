# API Reference — SautiLink Cloud Engine

## `GET /api/email?domain=example.com&selector=`

Returns `mx`, `spf`, `dmarc`, `dkim`, and **`score`** (model **v1.0**).

### DKIM discovery

| Mode | Behavior |
|------|----------|
| Explicit `selector=` | Single TXT lookup at `selector._domainkey.domain` |
| Heuristic (no selector) | Up to **25** common selectors, batches of **4**, shared **12s** discovery deadline, stop when first hit (list-order deterministic) |

Individual DoH queries retain the DNS module timeout. Discovery is intentionally limited and non-exhaustive. DNS public-key inspection only — no signature verification.

### Score object

Weights: MX 15 · SPF 25 · DMARC 35 · DKIM 25. Grades: 90–100 A · 80–89 B · 70–79 C · 60–69 D · 0–59 F. Version `1.0`.

Configuration assessment only — not a guarantee of email security.
