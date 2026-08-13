# SautiLink Cloud Engine

**Product site:** [https://cloudengine.sautilink.com](https://cloudengine.sautilink.com)

Cloudflare Pages + Pages Functions. Stateless. No database, no auth.

## Live tools

| Tool | API | UI |
|------|-----|----|
| Health | `GET /api/health` | — |
| DNS Lookup | `GET /api/dns?domain=` | `/tools/dns` |
| HTTP Status | `GET /api/http-status?url=` | `/tools/http-status` |
| Email (MX+SPF+DMARC) | `GET /api/email?domain=` | `/tools/email` |

## Local development

```bash
npm install
npm run dev
```

## Docs

[API](docs/API.md) · [Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Roadmap](docs/ROADMAP.md)

## License

UNLICENSED — proprietary to SautiLink.
