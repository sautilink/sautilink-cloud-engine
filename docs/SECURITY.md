# Security — SautiLink Cloud Engine

This document describes application-level protections and the honest boundary between what the code enforces and what must be configured on Cloudflare infrastructure.

---

## Threat model (current phase)

- Public, unauthenticated read-mostly tools (DNS, health).
- No user accounts, no secrets in client code, no database.
- Primary risks: abuse (volume), invalid/malicious input, SSRF via future URL tools, information leakage in errors.

---

## Application-level protections

| Control | Behavior |
|---------|----------|
| Input validation | Domains normalized; URLs/paths/localhost/private targets rejected for DNS |
| Request size | Max URL length 2048; max query value 512 chars |
| Method handling | Only GET and OPTIONS on tool endpoints; others → 405 |
| Unknown API routes | JSON 404 (`NOT_FOUND`), not HTML |
| Error responses | Structured `{ success, error: { code, message } }`; no stack traces |
| Request ID | `X-Request-Id` on responses; echoed if client sends a valid one |
| CORS | Allowlist: production origin + local Wrangler/dev ports; not `*` |
| Security headers | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` on API; CSP via `public/_headers` for static |
| DNS upstream | Fixed Cloudflare DoH endpoint only; never fetches user-supplied URLs |
| DNS timeouts | 8s per record type via `AbortController` |

---

## Rate limiting — important distinction

### What this repository does **not** claim

There is **no** durable, globally consistent application-level rate limiter in code.

Cloudflare Pages Functions run across many isolates. An in-memory `Map` of IP → counters:

- is not shared across isolates or data centers,
- resets on isolate recycle,
- cannot enforce a true global quota.

Implementing such a map and calling it “production rate limiting” would be misleading.

### What to use for real global limits

Configure **Cloudflare-native** controls in the dashboard (outside this repo):

1. **Rate limiting rules** (Security → Rate limiting) on paths such as `/api/dns*`
2. **WAF custom rules** for abusive patterns
3. Optional **Bot Fight Mode** / managed challenges if abuse appears

Recommended starting point for DNS (tune after observing traffic):

- Path: `/api/dns*`
- Threshold: e.g. 30–60 requests per minute per IP
- Action: Block or Managed Challenge
- Response: ensure clients can treat HTTP 429 as rate limited

When dashboard rules return 429, clients should see that status. Application code may later map a platform 429 into `{ success: false, error: { code: "RATE_LIMITED", message: "..." } }` if a Workers binding or transform makes that practical; it is not required for this phase.

### Application-level “soft” guards

Request size limits and method restrictions reduce cheap abuse vectors but are **not** a substitute for edge rate limiting.

---

## CORS policy

Allowed origins:

- `https://cloudengine.sautilink.com`
- `http://localhost:8788`, `8787`, `3000`
- `http://127.0.0.1` with the same ports

Same-origin fetches from the production site do not require CORS. Cross-origin browser clients only receive `Access-Control-Allow-Origin` when their `Origin` is on the allowlist.

**Rationale for not using `*`:** future authenticated or cookie-based endpoints must not inherit a wildcard policy. Public unauthenticated tools still work for allowlisted frontends and non-browser clients (curl, Telegram server-side) which are not subject to CORS.

---

## HTTP security headers

### Static site (`public/_headers`)

- `Content-Security-Policy`: `'self'` for scripts/styles; `connect-src 'self'` (API same-origin); `frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy`: disable camera, microphone, geolocation

**CSP exceptions:** none required today — no external CDNs, fonts, or analytics scripts. If a future tool needs an external script, document the exception here before relaxing CSP.

### API responses

Same baseline headers except CSP is primarily enforced on HTML documents.

---

## Caching

| Endpoint | Success | Errors |
|----------|---------|--------|
| `/api/health` | `no-store` | `no-store` |
| `/api/dns` | `public, max-age=30` | `no-store` |

DNS answers change slowly enough that a 30-second browser/CDN cache is safe and reduces repeated DoH load. Errors are never cached aggressively.

No KV or database is used for caching.

---

## Request ID

- Header: `X-Request-Id`
- Generated with `crypto.randomUUID()` when the client does not send one
- Included on error JSON as top-level `requestId` (tool endpoints)
- **Not** authentication; never treat as a secret or capability token

---

## Status codes

| Code | Use |
|------|-----|
| 200 | Success |
| 400 | Invalid / missing input, oversized request |
| 404 | Unknown API route |
| 405 | Unsupported method |
| 429 | Reserved for edge rate limiting (dashboard) |
| 500 | Unexpected internal error (no details leaked) |
| 502 | Upstream DoH failure for all record types |

Empty DNS record sets are **200** with empty arrays, not errors.

---

## Secrets & deployment

- No API keys required for health or DNS
- Never commit `.env`, `.dev.vars`, tokens, or credentials
- Custom domain and Pages Git integration are managed in the Cloudflare dashboard, not by application code
