# Architecture — SautiLink Cloud Engine

Email module (`src/tools/email/`): `mx.js`, `spf.js`, `dmarc.js`, `dkim.js`, `index.js`.

DKIM queries `selector._domainkey.<domain>` via shared `lookupDns`. Automatic discovery uses a fixed list (`COMMON_DKIM_SELECTORS`, max 25) and stops on first hit. Explicit `selector` query param skips discovery.

All DNS uses Cloudflare DoH only.
