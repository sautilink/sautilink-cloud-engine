# Security

- Headers analyzer uses the same SSRF gates as HTTP status (DoH public-IP check, private ranges, redirect validation).
- Response maps omit Set-Cookie values and auth challenge headers.
- DNS rebinding TOCTOU remains a platform limitation for outbound fetch.
- Global rate limits: Cloudflare dashboard.
