# Security — SautiLink Cloud Engine

This document describes application-level protections and the honest boundary between what the code enforces and what must be configured on Cloudflare infrastructure.

---

## Threat model (current phase)

- Public, unauthenticated read-mostly tools (DNS, health, HTTP status).
- No user accounts, no secrets in client code, no database.
- Primary risks: abuse (volume), invalid/malicious input, SSRF via outbound URL tools, information leakage in errors.

---

## Application-level protections

| Control | Behavior |
|---------|----------|
| Input validation | Domains/URLs normalized; private targets rejected |
| Request size | Max URL length 2048; max query value 2048 |
| Method handling | Only GET and OPTIONS on tool endpoints; others → 405 |
| Unknown API routes | JSON 404 (`NOT_FOUND`), not HTML |
| Error responses | Structured `{ success, error: { code, message } }`; no stack traces |
| Request ID | `X-Request-Id` on responses |
| CORS | Allowlist: production origin + local Wrangler/dev ports |
| Security headers | nosniff, referrer-policy, frame deny, permissions-policy; CSP on static |
| DNS upstream | Fixed Cloudflare DoH endpoint only |
| HTTP status upstream | Controlled `fetch` with SSRF gates (below) |

---

## HTTP status checker — SSRF

Outbound requests are untrusted-input driven. Protections:

1. **URL parse:** only `http:` / `https:`; reject credentials; length limit.
2. **Hostname denylist:** `localhost`, `*.local`, `*.internal`, cloud metadata hostnames, etc.
3. **IP literal checks:** IPv4/IPv6 private, loopback, link-local, CGNAT, multicast, reserved ranges (including IPv4-mapped IPv6).
4. **Pre-fetch DNS:** resolve A/AAAA via Cloudflare DoH; reject if any answer is private/reserved.
5. **Redirects:** `redirect: "manual"`; every `Location` re-validated (parse + hostname + DNS) up to 5 hops.
6. **Timeout:** 8s hard limit via `AbortController`.
7. **Body cap:** 64 KiB when GET fallback is used; HEAD preferred.

### DNS rebinding limitation (honest)

Application code **cannot** pin the TCP connection to the exact address returned by DoH. Between resolution and `fetch()`, a hostile DNS server could change answers (TOCTOU / rebinding).

Cloudflare’s network still blocks many internal destinations at the platform layer, but that is not a substitute for application policy and is not fully controllable from this repository.

**Claimed protection level:** strong against static private IPs, localhost, metadata hostnames, and private DNS answers observed at check time. **Not** a perfect guarantee against sophisticated rebinding races.

---

## Rate limiting

There is **no** durable global application-level rate limiter in code (isolates do not share memory).

Use Cloudflare dashboard Rate Limiting / WAF on `/api/dns*` and `/api/http-status*` before heavy traffic.

---

## CORS policy

Allowed origins: production `https://cloudengine.sautilink.com` and local Wrangler/dev ports. No wildcard.

---

## HTTP security headers

Static CSP is `'self'`-oriented via `public/_headers`. API responses reuse shared security headers from `src/utils/security.js`.

---

## Caching

| Endpoint | Success | Errors |
|----------|---------|--------|
| `/api/health` | `no-store` | `no-store` |
| `/api/dns` | `public, max-age=30` | `no-store` |
| `/api/http-status` | `no-store` | `no-store` |

HTTP status is intentionally not cached: results change quickly and must stay accurate.

---

## Status codes (engine vs target)

Target site status (200/403/404/500/…) is returned inside `data.status` with Cloud Engine API **200** and `success: true` when the probe completed.

Engine-level blocks (SSRF, timeout, invalid URL) use `success: false` and appropriate API status codes (400/403/502/504).

---

## Secrets & deployment

- No API keys required for current tools
- Never commit `.env`, `.dev.vars`, tokens, or credentials
- Custom domain and Pages Git integration managed in the Cloudflare dashboard
