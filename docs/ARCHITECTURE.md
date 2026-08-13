# Architecture

Robots: `src/tools/robots/{fetch,parser,analyzer,score,index}.js` → `functions/api/robots.js`.

Fetch derives `origin/robots.txt`, validates each hop via shared `assertUrlSafeToFetch`. Parser is pure; Sitemap lines are not fetched.
