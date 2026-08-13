# Security — SautiLink Cloud Engine

## Application protections

- Input validation (domains/URLs); private/localhost rejected
- Request size limits; method allowlist; JSON 404 for unknown `/api/*`
- Structured errors without stack traces; `X-Request-Id`
- CORS allowlist; security headers + CSP on static assets
- DNS tools: fixed Cloudflare DoH only
- HTTP status: SSRF hostname/IP/DoH gates, manual redirects, timeout, body cap
- Email/DMARC: DNS-only; no report sending; only `mailto:` kept from rua/ruf

## Rate limiting

No global in-memory limiter (isolates are not shared). Use Cloudflare dashboard Rate Limiting / WAF on `/api/*`.

## DNS rebinding (HTTP status)

DoH pre-check cannot pin `fetch` to the resolved address (TOCTOU). Documented limitation — strong but not absolute.

## Caching

| Endpoint | Success |
|----------|---------|
| `/api/health` | no-store |
| `/api/dns`, `/api/email` | public, max-age=30 |
| `/api/http-status` | no-store |
