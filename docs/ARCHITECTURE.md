# Architecture

Email: `src/tools/email/{mx,spf,dmarc,dkim,score,index}.js`.

DKIM heuristic discovery (`dkim.js`):

1. Cap list at `MAX_DKIM_SELECTORS` (25)
2. Process in batches of `DKIM_DISCOVERY_CONCURRENCY` (4)
3. Shared `DKIM_DISCOVERY_DEADLINE_MS` (12000)
4. After each batch, if any `found`, pick the earliest selector in the curated list (deterministic)
5. Explicit `selector` skips discovery entirely

All DNS uses Cloudflare DoH only.
