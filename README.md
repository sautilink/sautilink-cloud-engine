# SautiLink Cloud Engine

**Powerful Tools for the Modern Web**

SautiLink Cloud Engine is a modern, cloud-powered toolkit for website analysis, SEO, DNS, email authentication, security checks, network diagnostics, infrastructure detection, and developer utilities.

**Product site:** [https://cloudengine.sautilink.com](https://cloudengine.sautilink.com)  
**Parent ecosystem:** SautiLink

This repository contains the **web platform and API**. The Telegram Bot will consume the same API later — business logic lives only in the Cloud Engine API.

Cloudflare Pages Git deployment connection verified.

---

## Current scope (Phase 4 — HTTP Status Checker)

- Polished, responsive homepage
- **Live DNS Lookup** (`GET /api/dns` + `/tools/dns`)
- **HTTP/HTTPS Status Checker** (`GET /api/http-status` + `/tools/http-status`) with SSRF protections
- Stateless architecture (no database, no auth)
- Cloudflare Pages + Pages Functions
- Hardened API foundation (CORS, headers, request IDs, JSON 404s)
- Documentation including [docs/SECURITY.md](docs/SECURITY.md)

**Not included yet:** remaining tool backends, Telegram Bot, database, authentication, payments, advertising.

---

## Local development

```bash
npm install
npm run dev
```

- Homepage: `/`
- Health: `/api/health`
- DNS: `/api/dns?domain=example.com` · UI `/tools/dns`
- HTTP status: `/api/http-status?url=https://example.com` · UI `/tools/http-status`

---

## Rate limiting

Application code applies validation and size limits only. **Global quotas require Cloudflare dashboard Rate Limiting / WAF** on `/api/dns*` and `/api/http-status*`.

---

## Limitations

- Most tools remain Coming Soon.
- HTTP status SSRF protection is strong but not a perfect guarantee against DNS rebinding races (see Security docs).
- No application-level global rate limiter (by design).
- Telegram Bot not integrated.

---

## License

UNLICENSED — proprietary to SautiLink.
