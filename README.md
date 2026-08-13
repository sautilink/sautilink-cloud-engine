# SautiLink Cloud Engine

**Powerful Tools for the Modern Web**

SautiLink Cloud Engine is a modern, cloud-powered toolkit for website analysis, SEO, DNS, email authentication, security checks, network diagnostics, infrastructure detection, and developer utilities.

**Product site:** [https://cloudengine.sautilink.com](https://cloudengine.sautilink.com)  
**Parent ecosystem:** SautiLink

This repository contains the **web platform and API foundation**. The Telegram Bot (SautiLink Cloud Engine) will consume the same API later — business logic lives only in the Cloud Engine API.

---

## Current scope (Phase 1 — Foundation)

- Polished, responsive homepage
- Tool category UI with modular cards (Coming Soon markers)
- Stateless architecture (no database, no auth, no accounts)
- Cloudflare Pages + Pages Functions compatible
- `GET /api/health` endpoint
- Shared validation & response helpers
- DNS tool module interface (implementation deferred — see Architecture)
- Full documentation set

**Not included yet:** individual tool backends, Telegram Bot, database, authentication, payments, advertising.

---

## Project structure

```
sautilink-cloud-engine/
├── public/                 # Static assets (Cloudflare Pages output)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── site.webmanifest
│   └── favicon/
├── functions/              # Cloudflare Pages Functions
│   └── api/
│       └── health.js       # GET /api/health
├── src/                    # Shared logic (imported by Functions later)
│   ├── tools/
│   │   └── dns/
│   ├── utils/
│   │   ├── response.js
│   │   └── validation.js
│   └── config/
│       └── tools.js
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEVELOPMENT.md
│   └── ROADMAP.md
├── package.json
├── wrangler.jsonc
├── .gitignore
└── README.md
```

---

## Requirements

- Node.js 18+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (installed via `npm`)

---

## Local development

```bash
# Install dependencies
npm install

# Start local Pages + Functions environment
npm run dev
```

Open the URL printed by Wrangler (typically `http://localhost:8788`).

- Homepage: `/`
- Health API: `/api/health`

No build step is required for the static frontend.

---

## Deploy to Cloudflare

1. Connect the GitHub repository to **Cloudflare Pages**.
2. Set:
   - **Build command:** leave empty (or `npm run check`)
   - **Build output directory:** `public`
   - **Root directory:** `/` (repository root)
3. Pages Functions are picked up automatically from the `functions/` directory.
4. Custom domain: `cloudengine.sautilink.com` (configure DNS in the Cloudflare dashboard — not from this application).

Alternatively from the CLI (after `npx wrangler login`):

```bash
npm run deploy
```

---

## API

### `GET /api/health`

```json
{
  "status": "ok",
  "service": "SautiLink Cloud Engine",
  "timestamp": "2026-08-13T00:00:00.000Z"
}
```

No authentication. See [docs/API.md](docs/API.md) for the planned endpoint map.

---

## Architecture principles

- **Stateless** — no database in Phase 1.
- **Shared API** — web UI and future Telegram Bot use the same backend.
- **Cloudflare-native** — Pages + Functions, Web APIs, no Node-only DNS libraries.
- **Security-first** — input validation, domain normalization, SSRF guards, controlled errors.
- **Modular tools** — add tools without rewriting the core.

Full details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Limitations (current)

- Individual tools are UI-only (Coming Soon).
- DNS resolution is not implemented yet (Cloudflare runtime has no Node `dns` module; DoH approach documented).
- No rate limiting enforced in code yet (documented for later).
- Telegram Bot not integrated.

---

## License

UNLICENSED — proprietary to SautiLink.
