# API Reference

| Method | Path |
|--------|------|
| GET | `/api/health` |
| GET | `/api/dns?domain=` |
| GET | `/api/http-status?url=` |
| GET | `/api/email?domain=&selector=` |
| GET | `/api/email-check?domain=&check=mx|spf|dmarc|dkim&selector=` |
| GET | `/api/ip?query=` |
| GET | `/api/rdns?ip=` |
| GET | `/api/headers?url=` |
| GET | `/api/robots?url=` |
| GET | `/api/sitemap?url=` |
| GET | `/api/website?url=` |
| GET | `/api/mobile?url=` |
| GET | `/api/ssl?url=` |
| GET | `/api/audit?url=` |
| POST | `/api/telegram/webhook` |

`/api/email-check` is the focused single-check orchestration endpoint for the standalone MX, SPF, DMARC, and DKIM web tools. The `check` value is strictly allowlisted. `selector` is used only for DKIM. The route reuses the existing analyzer modules and performs only the DNS work needed for the selected check; it does not create report history or a second scoring model.

`/api/ip` accepts a public domain or public IPv4/IPv6 address. Domains are resolved through the shared DNS engine using A/AAAA only. Direct public IP input may include reverse-DNS context. Private, reserved, documentation, loopback, multicast, and other blocked address ranges are rejected when used as IP targets.

`/api/rdns` accepts a public IPv4/IPv6 address and performs an explicit PTR lookup. PTR support is available in the shared DNS engine only when requested; PTR was not added to the normal `/api/dns` default record set.

Telegram is a thin client; tool semantics are unchanged. See `docs/TELEGRAM.md`.
