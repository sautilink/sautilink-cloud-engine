# Architecture — SautiLink Cloud Engine

## High-level flow

```
┌─────────────┐     ┌───────────────────────┐     ┌────────────────┐
│  Web UI     │────▶│  Cloud Engine API    │────▶│  Tool modules   │
│  (public/)  │     │  (functions/api/)    │     │  (src/tools/)   │
└─────────────┘     └───────────────────────┘     └────────┘────────┘
                                                           │
┌─────────────┐     ┌───────────────────────┐              ▼
│  Telegram   │────▶│  Same Cloud Engine   │     External network
│  Bot (later)│     │  API                 │     services / DoH / etc.
└─────────────┘     └───────────────────────┘
```

The **API is the single source of truth**. The Telegram Bot must not duplicate business logic. Future clients (mobile app, public API) will also call this API.

---

## Runtime

- **Frontend:** static HTML/CSS/JS served from `public/` via Cloudflare Pages.
- **Backend:** Cloudflare Pages Functions under `functions/`.
- **Shared modules:** `src/` (validation, responses, tool helpers). Functions can import from `src` when needed (path-relative or via build configuration).

Prefer **Web APIs** (`fetch`, `Request`, `Response`, `URL`) over Node-specific APIs so the same code runs on the Cloudflare edge.

---

## Stateless design

The initial product **does not use a database**.

- No user accounts
- No scan history
- No sessions
- No stored API keys

Every request is independent. This simplifies deployment, scaling, and privacy.

### Future database candidates

When persistence is required, candidates may include:

- User accounts
- Scan / query history
- Saved domains
- Monitoring schedules
- API keys for public API consumers
- Usage analytics
- Subscriptions

Introduce a database only when a concrete feature needs it. Document the boundary clearly at that time.

---

## Tool modules

Tools live under `src/tools/<category>/`.

Example interface pattern:

```js
// src/tools/dns/index.js
export function prepareDomain(input) { /* validate + normalize */ }
export async function lookupDns(domain, types) { /* implementation */ }
```

API routes under `functions/api/` call these modules and return consistent JSON via `src/utils/response.js`.

---

## DNS implementation note

Cloudflare Workers / Pages Functions **do not** provide Node’s `dns` module.

**Recommended approach (Phase 2):**

1. Use **DNS-over-HTTPS (DoH)** against a public resolver (e.g. Cloudflare `cloudflare-dns.com` or Google).
2. Validate and normalize the domain with `src/utils/validation.js` first.
3. Apply rate limiting and caching considerations at the edge.
4. Never return fabricated DNS data.

Do not introduce Node-only packages (`dns`, `dns-packet` used with raw sockets, etc.) that cannot run on the Workers runtime.

---

## Security boundaries

- **Input validation:** domains and URLs are normalized; private/localhost targets rejected.
- **SSRF:** URL-based tools must refuse private IP ranges and link-local addresses.
- **Secrets:** never embed API keys in frontend JavaScript. Use Cloudflare secrets / environment bindings when needed.
- **Errors:** return structured `{ success: false, error: { code, message } }` — no stack traces to clients.
- **CORS:** currently open for simplicity on health; tighten for production tool endpoints as needed.
- **Sensitive tools** (port scan, arbitrary URL fetch): design with strict allowlists, timeouts, and rate limits. Document safe boundaries before shipping.

---

## Telegram future architecture

```
User
  → Telegram
    → SautiLink Cloud Engine Bot
      → Cloud Engine API  (/api/...)
        → Tool module
          → Result
            → Bot formats message
              → Telegram
```

The bot is a thin client. All analysis logic remains in the API.

---

## Deployment topology

```
GitHub (main)
  → Cloudflare Pages (build: public/)
    → Static assets
    → Pages Functions (functions/)
Custom domain: cloudengine.sautilink.com
```

DNS records for the custom domain are managed in the Cloudflare dashboard, not by this application.
