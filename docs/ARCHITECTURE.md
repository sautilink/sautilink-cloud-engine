# Architecture — SautiLink Cloud Engine

## High-level flow

```
Web UI (public/)  →  Cloud Engine API (functions/api/)  →  Tool modules (src/tools/)
                              ↑
              Future Telegram Bot (same API only)
                              ↓
                    External services / DoH
```

The **API is the single source of truth**. The Telegram Bot must not duplicate business logic. Future clients (mobile app, public API) will also call this API.

---

## Runtime

- **Frontend:** static HTML/CSS/JS served from `public/` via Cloudflare Pages.
- **Backend:** Cloudflare Pages Functions under `functions/`.
- **Shared modules:** `src/` (validation, responses, tool helpers). Functions import from `src` via relative paths.

Prefer **Web APIs** (`fetch`, `Request`, `Response`, `URL`) over Node-specific APIs so the same code runs on the Cloudflare edge.

---

## Stateless design

The product **does not use a database** in current phases.

- No user accounts
- No scan history
- No sessions
- No stored API keys

Every request is independent. This simplifies deployment, scaling, and privacy.

### Future database candidates

When persistence is required, candidates may include user accounts, scan history, saved domains, monitoring, API keys, analytics, and subscriptions. Introduce a database only when a concrete feature needs it.

---

## Tool modules

Tools live under `src/tools/<category>/`.

```js
// src/tools/dns/index.js
export function prepareDomain(input) { /* validate + normalize */ }
export async function lookupDns(domain, types) { /* DoH implementation */ }
```

API routes under `functions/api/` call these modules and return consistent JSON via `src/utils/response.js`.

---

## DNS implementation (Phase 2)

Cloudflare Pages Functions **do not** provide Node’s `dns` module. Live lookups use **DNS-over-HTTPS (DoH)**:

1. Client → `GET /api/dns?domain=…` (Pages Function: `functions/api/dns.js`)
2. Function validates domain via `prepareDomain` (rejects URLs, localhost, private targets)
3. `lookupDns` in `src/tools/dns/index.js` queries Cloudflare DoH (`https://cloudflare-dns.com/dns-query`) with `fetch()` + `Accept: application/dns-json`
4. Parallel queries for A, AAAA, CNAME, MX, NS, TXT (8s timeout per type via `AbortController`)
5. Structured JSON returned; empty record sets are success, not errors

The API **never** fetches arbitrary user-supplied URLs — only the fixed DoH endpoint with a validated domain name parameter. No Node-only packages.

---

## Security boundaries

- **Input validation:** domains and URLs are normalized; private/localhost targets rejected.
- **SSRF:** DNS tool accepts domain names only; DoH URL is fixed. Future URL-based tools must refuse private IP ranges.
- **Secrets:** never embed API keys in frontend JavaScript.
- **Errors:** return structured `{ success: false, error: { code, message } }` — no stack traces to clients.
- **CORS:** health and tools use shared response helpers; tighten further if needed.
- **Sensitive tools** (port scan, arbitrary URL fetch): design with strict allowlists, timeouts, and rate limits before shipping.

---

## Telegram future architecture

```
User → Telegram → Bot → Cloud Engine API → Tool → Result → Telegram
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
