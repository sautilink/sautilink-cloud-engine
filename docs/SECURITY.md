# Security — SautiLink Cloud Engine

- Domain/selector validation; fixed Cloudflare DoH; no Node DNS
- DKIM: DNS-only public key inspection; heuristic discovery capped at 25 selectors, concurrency 4, shared 12s deadline (no unbounded fan-out)
- HTTP status: SSRF hostname/IP/DoH gates; hop-by-hop redirects; timeout; body cap. DNS-rebinding TOCTOU remains a documented platform limit
- Email/DMARC: no report sending; mailto-only rua/ruf parsing
- Global rate limits: configure in Cloudflare dashboard (isolates are not a global counter)
