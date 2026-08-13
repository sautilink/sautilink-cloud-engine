# Architecture

Website analyzer: `src/tools/website/*` → `functions/api/website.js`. Reuses `prepareUrl` + `assertUrlSafeToFetch`. Lightweight HTML tag extraction (no DOM library, no script execution).
