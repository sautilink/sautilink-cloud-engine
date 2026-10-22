# Cloud Engine public API

Base URL: `https://cloudengine.sautilink.com`

Use the supported public endpoints below. Values in query strings must be
URL-encoded. Inspect the HTTP status and returned JSON before using a result.

| Method | Path | Input |
| --- | --- | --- |
| GET | `/api/health` | Service readiness |
| GET | `/api/dns?domain=` | Public domain |
| GET | `/api/http-status?url=` | Public website URL |
| GET | `/api/email?domain=&selector=` | Domain; optional DKIM selector |
| GET | `/api/email-check?domain=&check=&selector=` | Check: `mx`, `spf`, `dmarc` or `dkim` |
| GET | `/api/ip?query=` | Public domain or public IPv4/IPv6 address |
| GET | `/api/rdns?ip=` | Public IPv4/IPv6 address |
| GET | `/api/headers?url=` | Public website URL |
| GET | `/api/robots?url=` | Public website URL |
| GET | `/api/sitemap?url=` | Public website URL |
| GET | `/api/website?url=` | Public website URL |
| GET | `/api/mobile?url=` | Public website URL |
| GET | `/api/ssl?url=` | Public HTTPS URL |
| GET | `/api/audit?url=` | Public website URL |
| GET | `/api/proxies?status=active&page=1&per_page=20&sort=latency` | [Proxy directory options](PROXY_DIRECTORY.md) |

Example:

```sh
curl 'https://cloudengine.sautilink.com/api/dns?domain=example.com'
```

## Integration guidance

- Send only public targets that you are permitted to inspect.
- Do not place access tokens, passwords, private links or personal data in targets.
- Handle validation failures, unavailable targets and rate limits in your interface.
- Use reasonable request intervals; avoid retry loops.
- Report findings as observations, not guarantees of security or availability.
- Account, administrative and bot-delivery interfaces are not public integration APIs.

Use of the API is subject to the
[service terms](https://cloudengine.sautilink.com/terms).
For a supported integration arrangement, contact
[SautiLink Corporation](https://sautilink.com/contact).
