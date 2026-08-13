# Roadmap — SautiLink Cloud Engine

## Phase 1 — Foundation
- [x] Pages + Functions, homepage, health, docs

## Phase 2 — DNS
- [x] DNS Lookup (DoH) + `/tools/dns`

## Phase 3 — API hardening
- [x] Responses, methods, 404, CORS, headers, SECURITY.md

## Phase 4 — HTTP status
- [x] HTTP/HTTPS Status Checker + SSRF protections

## Phase 5A — Email (MX + SPF)
- [x] Email Infrastructure Checker (`/api/email`, `/tools/email`)
- [x] MX structured records
- [x] SPF detection, multi-record invalid, basic policy/mechanisms/warnings
- [ ] Recursive SPF evaluation / 10-lookup limit
- [ ] DMARC
- [ ] DKIM

## Phase 5B+ — DMARC / DKIM / score
- Planned after 5A

## Later phases
- Website tools (robots, sitemap, SEO)
- Security tools
- Infrastructure tools
- Telegram Bot (same API)
- Optional accounts / DB when required
