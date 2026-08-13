# Security

## SSRF

URL tools share `prepareUrl` + `assertUrlSafeToFetch` (DoH public-IP gate, hop-by-hop redirects).

`/api/audit` applies the same gate **before** analyzer fan-out.

Blocked classes include localhost, private/reserved IPv4/IPv6, link-local, CGNAT, and known metadata hostnames.

## Rate limiting

Application code does not implement global in-memory rate limiting. Cloudflare dashboard rate limiting is the operational layer (may return 429 under load).

## DNS rebinding

TOCTOU remains a platform limitation between DoH check and fetch.

## Phase 6H verification

See `docs/TESTING.md` for the production security matrix summary.
