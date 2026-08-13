# API Reference — SautiLink Cloud Engine

## `GET /api/email?domain=example.com&selector=`

Returns `mx`, `spf`, `dmarc`, `dkim`, and **`score`** (model **v1.0**).

### Score object

| Field | Description |
|-------|-------------|
| `total` / `max` / `percentage` | Integers, 0–100 |
| `grade` | A–F |
| `label` | Excellent / Good / Fair / Weak / Poor |
| `version` | `"1.0"` |
| `categories` | Per-area `{ score, max, reasons[] }` |
| `findings` | `{ code, severity, category, title, message }` |
| `recommendations` | `{ code, priority, category, title, message }` |

**Weights:** MX 15 · SPF 25 · DMARC 35 · DKIM 25 = 100.

**Grades:** 90–100 A · 80–89 B · 70–79 C · 60–69 D · 0–59 F.

Score is a **configuration assessment**, not a guarantee of email security. Pure computation on analyzer output (no extra DNS).

DKIM heuristic non-detection scores as not detected (0 DKIM points) without claiming DKIM is impossible on the domain.
