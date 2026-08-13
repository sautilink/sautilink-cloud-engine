# Roadmap — SautiLink Cloud Engine

## Phase 1 — Foundation

- [x] Project structure (Cloudflare Pages + Functions)
- [x] Homepage UI (hero, tools, API, about)
- [x] Tool category cards with Coming Soon states
- [x] `GET /api/health`
- [x] Shared validation & response utilities
- [x] DNS module interface (no live resolver yet)
- [x] Documentation (Architecture, API, Development, Roadmap)
- [x] SEO basics (title, meta, OG, robots, sitemap, favicon)
- [x] Stateless, no database, no auth

## Phase 2 — DNS tools

- [x] DNS Lookup (DoH-based)
- [x] Dedicated `/tools/dns` page
- [ ] MX Record Checker
- [ ] SPF Checker
- [ ] DKIM Checker
- [ ] DMARC Checker
- [ ] Nameserver Lookup
- [ ] Dedicated tool pages under `/tools/...`

## Phase 3 — API hardening

- [x] Standardized error/success responses
- [x] Method handling (405)
- [x] Unknown `/api/*` JSON 404
- [x] Request size guards
- [x] Request ID (`X-Request-Id`)
- [x] Controlled CORS allowlist
- [x] Security headers + CSP for static assets
- [x] Conservative DNS response caching
- [x] Documented rate-limiting strategy (Cloudflare-native for global limits)
- [x] `docs/SECURITY.md`

## Phase 4 — Website tools

- HTTP Status Checker
- Robots.txt Analyzer
- Sitemap Analyzer
- SEO Checker (basic)
- Mobile-friendly signals
- Performance-related endpoints (careful with external dependencies)

## Phase 5 — Security tools

- SSL/TLS Checker
- Security Headers
- Blacklist Checker
- WAF / Cloudflare / CDN detectors
- Basic port scanner (strict limits, ethical constraints, documentation)

## Phase 6 — Infrastructure tools

- IP Lookup
- ASN Lookup
- Hosting Provider Detector
- Reverse DNS
- HTTP Headers
- Server Information

## Phase 7 — Telegram Bot integration

- Official SautiLink Cloud Engine Telegram Bot
- Thin bot client calling the same Cloud Engine API
- No duplicated business logic
- Document bot username and deep-link on the website

```
User → Telegram → Bot → Cloud Engine API → Tool → Result → Telegram
```

## Phase 8 — Optional accounts / history / monitoring

- Introduce database only when required
- User accounts (optional)
- Scan history / saved domains
- Monitoring & alerts
- API keys for programmatic access
- Subscriptions (if product strategy requires)

---

## Guiding principles for every phase

1. Keep the API the single engine for web + bot + future clients.
2. Stay Cloudflare-compatible.
3. Prefer simplicity over premature infrastructure.
4. Never ship fake tool results.
5. Validate inputs and guard against SSRF.
6. Document security boundaries for sensitive tools before release.
7. Do not claim global rate limiting without edge infrastructure support.
