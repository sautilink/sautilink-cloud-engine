# Roadmap — SautiLink Cloud Engine

## Phase 1 — Foundation (current)

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

- DNS Lookup (DoH-based)
- MX Record Checker
- SPF Checker
- DKIM Checker
- DMARC Checker
- Nameserver Lookup
- Dedicated tool pages under `/tools/...`
- Rate-limiting considerations documented and enforced where needed

## Phase 3 — Website tools

- HTTP Status Checker
- Robots.txt Analyzer
- Sitemap Analyzer
- SEO Checker (basic)
- Mobile-friendly signals
- Performance-related endpoints (careful with external dependencies)

## Phase 4 — Security tools

- SSL/TLS Checker
- Security Headers
- Blacklist Checker
- WAF / Cloudflare / CDN detectors
- Basic port scanner (strict limits, ethical constraints, documentation)

## Phase 5 — Infrastructure tools

- IP Lookup
- ASN Lookup
- Hosting Provider Detector
- Reverse DNS
- HTTP Headers
- Server Information

## Phase 6 — Telegram Bot integration

- Official SautiLink Cloud Engine Telegram Bot
- Thin bot client calling the same Cloud Engine API
- No duplicated business logic
- Document bot username and deep-link on the website

```
User → Telegram → Bot → Cloud Engine API → Tool → Result → Telegram
```

## Phase 7 — Optional accounts / history / monitoring

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
