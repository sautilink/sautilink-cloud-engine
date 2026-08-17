# SautiLink Cloud Engine Branding Policy

## Product identity

- Product: **SautiLink Cloud Engine**
- Parent organization: **SautiLink Corporation**
- Corporate site: `sautilink.com`
- Product site: `cloudengine.sautilink.com`

SautiLink Cloud Engine must present itself publicly as a SautiLink Corporation product.

## Public-surface rule

User-facing Telegram messages, menus, settings, status screens, help/about content, error copy, and other public product surfaces must not expose third-party infrastructure or implementation-provider names.

Public output should use SautiLink-owned wording such as:

- SautiLink Cloud Engine
- SautiLink Corporation
- SautiLink-managed service
- SautiLink global protection

Do not expose internal environment-variable names, database/deployment providers, source-control providers, infrastructure topology, or internal architecture decisions in normal user-facing output.

## Technical vocabulary

Open technical standards and analyzer concepts are part of the product and may remain visible where useful, including DNS, HTTP, HTTPS, SSL/TLS, HSTS, MX, SPF, DMARC, DKIM, robots.txt, sitemap.xml, SEO, and security headers. These describe what Cloud Engine analyzes rather than how SautiLink deploys the product.

## Architecture enquiries

Normal product UX should not explain the implementation architecture. Integration or architecture enquiries should be directed to **SautiLink Corporation** through `sautilink.com` or the company's official contact channels.

## Open-source boundary

This policy protects normal product UX from unnecessary infrastructure disclosure. It does not claim that implementation details are undiscoverable when source code or maintainer documentation is intentionally published as open source. Public source visibility and public product UX are separate concerns.

## Regression protection

Automated Telegram branding tests should fail if normal user-facing start, about, settings, or admin output reintroduces known infrastructure-vendor branding. New user-facing features must follow the same SautiLink-first rule.
