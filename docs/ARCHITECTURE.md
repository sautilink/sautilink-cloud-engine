# Architecture — SautiLink Cloud Engine

## High-level flow

```
Web UI (public/)  →  Cloud Engine API (functions/api/)  →  Tool modules (src/tools/)
                              ↑
              Future Telegram Bot (same API only)
                              ↓
                    External services / DoH / outbound HTTP
```

The **API is the single source of truth**. The Telegram Bot must not duplicate business logic.

---

## Runtime

- **Frontend:** static HTML/CSS/JS from `public/` (Cloudflare Pages).
- **Backend:** Cloudflare Pages Functions under `functions/`.
- **Shared modules:** `src/` (validation, responses, security, tools).

Prefer Web APIs (`fetch`, `Request`, `Response`, `URL`, `crypto`, `AbortController`, `performance`).

---

## Stateless design

No database, accounts, sessions, or stored API keys in current phases. Every request is independent.

---

## Tool modules

| Tool | Module | Function route |
|------|--------|----------------|
| DNS Lookup | `src/tools/dns/` | `functions/api/dns.js` |
| HTTP Status | `src/tools/http-status/` | `functions/api/http-status.js` |

HTTP status is split into `url.js`, `ssrf.js`, `fetch.js`, and `index.js` for validation, SSRF, probing, and orchestration.

---

## DNS implementation

DoH to Cloudflare only. See Phase 2 notes. No Node `dns` module.

---

## HTTP status implementation

1. Validate/normalize URL (`prepareUrl`)
2. SSRF gate: hostname denylist + IP literal ranges + DoH A/AAAA privacy check
3. `fetch` with `redirect: "manual"`, HEAD then optional GET
4. Re-run SSRF gate on every redirect (max 5)
5. 8s timeout; 64 KiB body cap; safe header subset only

DNS rebinding TOCTOU limitation is documented in [SECURITY.md](SECURITY.md).

---

## API hardening

Shared: `response.js`, `request.js`, `security.js`, catch-all `functions/api/[[path]].js`, `public/_headers`.

Global rate limits: Cloudflare dashboard, not in-memory Maps.

---

## Deployment topology

```
GitHub (main)
  → Cloudflare Pages (build: public/)
    → Static assets (+ _headers)
    → Pages Functions (functions/)
Custom domain: cloudengine.sautilink.com
```
