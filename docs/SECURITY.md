# Security — SautiLink Cloud Engine

- Domain/selector validation; no Node DNS; fixed DoH
- DKIM: DNS-only public key inspection; no signature verification; no report callbacks
- Selector labels sanitized (no path/protocol injection into DNS names)
- Heuristic DKIM discovery capped at 25 sequential lookups
- Global rate limits: Cloudflare dashboard (not in-app Map)
- HTTP status SSRF: strong but DNS-rebinding TOCTOU remains a documented limit
