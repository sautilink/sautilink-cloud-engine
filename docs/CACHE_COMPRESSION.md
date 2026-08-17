# Cache & Compression Inspector

`/tools/cache` is a web-only observational view over the existing SSRF-protected `/api/headers` probe.

## Observed signals

The tool may present response metadata such as:

- `Cache-Control` and parsed directives
- `Expires` and `Age`
- `ETag` and `Last-Modified` validators
- `Vary`
- `Content-Encoding`
- `Content-Length` and `Transfer-Encoding`
- `Accept-Ranges`

The browser performs lightweight interpretation of well-known cache directives such as `no-store`, `private`, `no-cache`, `public`, `max-age`, `s-maxage`, `immutable`, `must-revalidate`, `stale-while-revalidate`, and `stale-if-error`.

## Interpretation boundary

This tool is not Lighthouse, a synthetic benchmark, a compression-ratio test, or proof of the response every client receives. Negotiated representations can vary with request headers, intermediaries, user state, geography, and platform behavior.

In particular, absence of `Content-Encoding` on the Cloud Engine response must not be presented as proof that every browser receives uncompressed content.

Cache-policy interpretation is informational. Whether a response should be public, private, stored, revalidated, or immutable depends on application semantics that Cloud Engine cannot infer from headers alone.

## Safety and privacy

- Reuses `/api/headers`; no second outbound HTTP implementation is introduced.
- Existing URL validation, DNS public-address gating, redirect revalidation, timeout, and SSRF controls remain authoritative.
- No inspected target or result is persisted by this page.
- No database migration is required.
- No external performance, CDN, or infrastructure provider is contacted.
- Telegram behavior is unchanged.
