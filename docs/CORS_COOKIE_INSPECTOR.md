# CORS & Cookie Inspector

`/tools/cors` is a web-only focused view over the existing SSRF-protected `/api/headers` probe.

## What it shows

The page reports CORS response headers observed during the Cloud Engine GET request, including:

- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Credentials`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`
- `Access-Control-Expose-Headers`
- `Access-Control-Max-Age`
- `Vary`

It also shows cookie metadata already parsed by the headers engine:

- cookie name
- `Secure`
- `HttpOnly`
- `SameSite`
- `Path`

Cookie values are not rendered by this tool.

## Passive-observation boundary

This phase is deliberately not a full CORS validation harness. Cloud Engine does not send a user-selected `Origin`, custom request-header set, alternate HTTP method, or an OPTIONS preflight from this page. A target can therefore return different CORS headers in a real browser flow.

The UI must describe the result as the response policy observed for the Cloud Engine GET request, not as proof that all cross-origin requests will succeed or fail.

A wildcard `Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Credentials: true` is surfaced for review because browsers do not permit credentialed CORS with the wildcard allow-origin value.

## Safety and privacy

- Reuses `/api/headers`; no second outbound-fetch implementation is introduced.
- Existing URL validation, DNS public-address checks, redirect revalidation, timeouts, and SSRF controls remain authoritative.
- No target, result, cookie metadata, or history is persisted by this page.
- No database migration is required.
- No external CORS/security provider is contacted.
- Telegram behavior is unchanged.
