# Server Information

`/tools/server` is an observational infrastructure view over the existing SSRF-protected `/api/headers` probe.

## Product scope

The page may present only response information Cloud Engine directly observes from the inspected public URL, including:

- HTTP protocol, status, and response time
- final URL and redirect count/chain
- `Server`, `Content-Type`, and `Cache-Control` values when exposed
- cookie metadata count
- browser-facing security response signals such as HSTS and CSP
- response headers that may indicate caching, proxying, or an edge delivery layer

## Edge / proxy signals

Edge-related headers are hints, not attribution proof. Examples include `Via`, `Server-Timing`, `CF-Ray`, `CF-Cache-Status`, `X-Cache`, `X-Served-By`, `X-Amz-Cf-*`, `X-Vercel-*`, `X-Nf-*`, Akamai-prefixed headers, and Fly request identifiers.

The UI must not turn one observed header into a definitive hosting, ownership, CDN, WAF, or infrastructure-provider claim. A missing edge header also does not prove that no intermediary exists.

## Safety and privacy

- The tool reuses `/api/headers`; it does not introduce a second outbound-fetch implementation.
- Existing URL validation, DNS public-address gating, redirect revalidation, request timeout, and SSRF controls remain authoritative.
- The browser page stores no inspected target, result, or history in local/session/durable storage.
- No database migration is required.
- No external infrastructure-attribution provider is contacted by this feature.
- Telegram behavior is unchanged.

## Related tools

Use the dedicated HTTP Headers Analyzer for the full header/security score, HTTP Status Checker for redirect/status diagnostics, IP Lookup for DNS-derived address context, and SSL/HTTPS Analyzer for HTTPS posture.
