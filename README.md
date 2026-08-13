# SautiLink Cloud Engine

**Powerful Tools for the Modern Web**

**Product site:** [https://cloudengine.sautilink.com](https://cloudengine.sautilink.com)

Cloudflare Pages + Pages Functions. Stateless. No database, no auth.

## Live tools

| Tool | API | UI |
|------|-----|----|
| Health | `GET /api/health` | — |
| DNS Lookup | `GET /api/dns?domain=` | `/tools/dns` |
| HTTP Status | `GET /api/http-status?url=` | `/tools/http-status` |
| Email (MX+SPF) | `GET /api/email?domain=` | `/tools/email` |

## Local development

```bash
npm install
npm run dev
```

## Rate limiting

Use Cloudflare dashboard rules for global limits. Application code validates input and sizes only.

## Docs

- [docs/API.md](docs/API.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)

## License

UNLICENSED — proprietary to SautiLink.
