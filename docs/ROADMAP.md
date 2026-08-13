# Roadmap — SautiLink Cloud Engine

## Phase 1 — Foundation

- [x] Project structure (Cloudflare Pages + Functions)
- [x] Homepage UI, health API, docs, SEO basics
- [x] Stateless, no database, no auth

## Phase 2 — DNS tools

- [x] DNS Lookup (DoH-based) + `/tools/dns`
- [ ] MX / SPF / DKIM / DMARC / Nameserver checkers

## Phase 3 — API hardening

- [x] Standardized responses, method handling, JSON 404
- [x] Request guards, request ID, CORS allowlist, security headers
- [x] Documented rate-limiting strategy + `docs/SECURITY.md`

## Phase 4 — Website tools (HTTP status)

- [x] Professional HTTP/HTTPS Status Checker with SSRF protection
- [x] UI at `/tools/http-status`
- [ ] Robots.txt Analyzer
- [ ] Sitemap Analyzer
- [ ] SEO Checker (basic)
- [ ] Performance-related endpoints

## Phase 5 — Security tools

- SSL/TLS Checker, Security Headers, Blacklist, WAF/CDN detectors
- Basic port scanner (strict limits)

## Phase 6 — Infrastructure tools

- IP / ASN / Hosting / rDNS / Headers / Server info

## Phase 7 — Telegram Bot integration

- Thin bot client calling the same Cloud Engine API

## Phase 8 — Optional accounts / history / monitoring

- Database only when required

---

## Guiding principles

1. API is the single engine for web + bot + future clients.
2. Stay Cloudflare Pages + Functions compatible.
3. Prefer simplicity over premature infrastructure.
4. Never ship fake tool results.
5. Validate inputs and guard against SSRF; document limitations honestly.
6. Do not claim global rate limiting without edge infrastructure support.
