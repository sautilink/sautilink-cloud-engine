# Architecture

Sitemap: `src/tools/sitemap/*` → `functions/api/sitemap.js`. Reuses `prepareUrl` + `assertUrlSafeToFetch`. Child sitemaps and robots `Sitemap:` refs are validated before fetch. No XXE.
