# Architecture

Cloudflare Pages + Pages Functions. Stateless. No database.

## Unified audit

`src/tools/audit/*` → `functions/api/audit.js`

Limits: deadline 18s, per-analyzer 9s, concurrency 3, fixed analyzer list (no unbounded fan-out).

Score objects from tools may expose `total` or `score` (headers uses `security.score`); the audit layer accepts both.

## Fan-out budget

Documented in Phase 6G notes: concurrent analyzers capped at 3; each analyzer retains its own body/redirect/DoH caps.
