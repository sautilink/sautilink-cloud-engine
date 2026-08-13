# SautiLink Cloud Engine

**Site:** [https://cloudengine.sautilink.com](https://cloudengine.sautilink.com)

Cloudflare Pages + Pages Functions. Stateless.

## Live tools

| Tool | API | UI |
|------|-----|----|
| Health | `/api/health` | — |
| DNS | `/api/dns?domain=` | `/tools/dns` |
| HTTP Status | `/api/http-status?url=` | `/tools/http-status` |
| Email (MX+SPF+DMARC+DKIM) | `/api/email?domain=&selector=` | `/tools/email` |

```bash
npm install && npm run dev
```

Docs: [API](docs/API.md) · [Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md)

UNLICENSED — proprietary to SautiLink.
