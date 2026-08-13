# Development Guide — SautiLink Cloud Engine

## Prerequisites

- Node.js 18 or newer
- npm
- Cloudflare account (for deployment)
- Wrangler CLI (installed as a dev dependency)

## Setup

```bash
git clone https://github.com/sautilink/sautilink-cloud-engine.git
cd sautilink-cloud-engine
npm install
```

## Local server

```bash
npm run dev
```

This runs `wrangler pages dev public`, which:

- Serves static files from `public/`
- Executes Pages Functions from `functions/`
- Emulates the Cloudflare edge environment

Default URL is usually `http://localhost:8788`.

### Manual checks

1. Open `/` — homepage should load, tool cards visible, responsive layout.
2. Open `/api/health` — JSON health response.
3. Use the “Try it live” button on the homepage API section.

## Project conventions

- **No database** in this phase.
- **No secrets** in the repository. Use `.dev.vars` locally (gitignored) and Cloudflare dashboard secrets in production when needed.
- Prefer pure JavaScript modules and Web APIs.
- Keep Functions handlers small; put reusable logic in `src/`.
- Mark unfinished tools as `coming_soon` in the tool registry (see `src/config/tools.js` and the inlined registry in `public/app.js`).

## Adding a new tool (checklist)

1. Add metadata to `src/config/tools.js` (and mirror in `public/app.js` until a shared build step exists).
2. Create module under `src/tools/<category>/`.
3. Create Pages Function under `functions/api/<path>.js` (or directory route).
4. Validate inputs with `src/utils/validation.js`.
5. Return responses via `src/utils/response.js` helpers.
6. Document the endpoint in `docs/API.md`.
7. Update UI route if a dedicated page is added under `public/tools/`.

## Cloudflare-specific notes

- `wrangler.jsonc` sets `pages_build_output_dir` to `public`.
- Compatibility date is pinned in `wrangler.jsonc`.
- Do not rely on Node built-ins that are unavailable on Workers (e.g. `dns`, `fs`, `net` for arbitrary sockets).
- For DNS tools, use DNS-over-HTTPS (see `docs/ARCHITECTURE.md`).

## Testing

There is no automated test suite in Phase 1. Before merging tool implementations:

- Manual request tests against local Wrangler.
- Confirm validation rejects private/localhost targets.
- Confirm error responses never include stack traces.

## Git workflow

- `main` is the production branch.
- Prefer small, focused commits.
- Never commit `.env`, `.dev.vars`, keys, or tokens.
