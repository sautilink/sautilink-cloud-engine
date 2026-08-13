# Architecture — SautiLink Cloud Engine

## Flow

```
Web UI (public/) → Pages Functions (functions/api/) → src/tools/* → DoH / outbound HTTP
                         ↑
              Future Telegram Bot (same API)
```

## Runtime

Cloudflare Pages + Pages Functions. Shared logic in `src/`. Stateless; no database.

## Tools

| Tool | Module | Route |
|------|--------|-------|
| DNS Lookup | `src/tools/dns/` | `/api/dns` |
| HTTP Status | `src/tools/http-status/` | `/api/http-status` |
| Email (MX+SPF) | `src/tools/email/` | `/api/email` |

Email reuses `prepareDomain` + `lookupDns` from the DNS module (MX + TXT only), then `mx.js` / `spf.js` analyzers.

## DNS / email resolution

Fixed Cloudflare DoH (`https://cloudflare-dns.com/dns-query`). 8s timeout. No Node `dns`.

## Security

See [SECURITY.md](SECURITY.md). HTTP status has SSRF gates; domain tools reject URLs, IPs, localhost.
