# Architecture — SautiLink Cloud Engine

## Flow

```
Web UI → Pages Functions → src/tools/* → Cloudflare DoH / outbound HTTP
              ↑
   Future Telegram Bot (same API)
```

## Tools

| Tool | Module | Route |
|------|--------|-------|
| DNS | `src/tools/dns/` | `/api/dns` |
| HTTP Status | `src/tools/http-status/` | `/api/http-status` |
| Email (MX+SPF+DMARC) | `src/tools/email/` | `/api/email` |

Email module: `mx.js`, `spf.js`, `dmarc.js`, `index.js`. DMARC queries `_dmarc.<domain>` TXT in parallel with domain MX/TXT.

## Resolution

Fixed Cloudflare DoH only. No Node DNS. 8s timeout per query type.

## Security

See [SECURITY.md](SECURITY.md). Domain tools reject URLs/IPs/localhost. HTTP status has SSRF gates. DMARC does not contact `rua`/`ruf` destinations.
