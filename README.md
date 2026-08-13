# SautiLink Cloud Engine

**Powerful Tools for the Modern Web**

SautiLink Cloud Engine is a modern, cloud-powered toolkit for website analysis, SEO, DNS, email authentication, security checks, network diagnostics, infrastructure detection, and developer utilities.

**Product site:** [https://cloudengine.sautilink.com](https://cloudengine.sautilink.com)  
**Parent ecosystem:** SautiLink

This repository contains the **web platform and API**. The Telegram Bot will consume the same API later — business logic lives only in the Cloud Engine API.

---

## Current scope (Phase 2 — DNS Engine)

- Polished, responsive homepage
- Tool category UI with modular cards
- **Live DNS Lookup** (`GET /api/dns` + `/tools/dns`) via DNS-over-HTTPS
- Stateless architecture (no database, no auth, no accounts)
- Cloudflare Pages + Pages Functions compatible
- `GET /api/health` endpoint
- Shared validation & response helpers
- Full documentation set

**Not included yet:** remaining tool backends, Telegram Bot, database, authentication, payments, advertising.

---

## Project structure

```
sautilink-cloud-engine/
├── public/                 # Static assets (Cloudflare Pages output)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── tools/dns.*           # DNS Lookup UI
│   └── …
├── functions/              # Cloudflare Pages Functions
│   └── api/
│       ├── health.js           # GET /api/health
│       └── dns.js              # GET /api/dns
├── src/
│   ├── tools/dns/             # DoH lookup module
│   ├── utils/
│   └── config/
├── docs/
├── package.json
├── wrangler.jsonc
└── README.md
```

---

## Local development

```bash
npm install
npm run dev
```

- Homepage: `/`
- Health: `/api/health`
- DNS API: `/api/dns?domain=example.com`
- DNS UI: `/tools/dns`

---

## API

### `GET /api/health`

```json
{
  "status": "ok",
  "service": "SautiLink Cloud Engine"
}
```

### `GET /api/dns?domain=example.com`

Live DNS lookup (A, AAAA, CNAME, MX, NS, TXT) via Cloudflare DNS-over-HTTPS.

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "records": { "A": ["..."], "AAAA": [], "CNAME": [], "MX": [], "NS": [], "TXT": [] }
  }
}
```

See [docs/API.md](docs/API.md).

---

## Limitations

- Most tools remain Coming Soon (DNS Lookup is live).
- DNS uses public DoH only (fixed Cloudflare resolver).
- No application-level rate limiting yet (use Cloudflare dashboard rules if needed).
- Telegram Bot not integrated.

---

## License

UNLICENSED — proprietary to SautiLink.
