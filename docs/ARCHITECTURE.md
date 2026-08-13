# Architecture

Headers tool: `src/tools/headers/{index,analyzer,score}.js` + `functions/api/headers.js`.

Reuses `prepareUrl` and `probeHttpStatus(..., { fullHeaders: true })` from `src/tools/http-status/` (same SSRF path). Cookie values stripped; auth-related headers omitted from maps.
