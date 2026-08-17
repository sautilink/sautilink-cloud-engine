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

## Corporate typography

SautiLink web products use a shared two-family typography system:

- **Primary / content font: Lora**
  - Used for normal page content, headings, navigation, buttons, forms, cards, reports, and other product UI text.
  - Variable normal and italic faces are self-hosted.
  - Supported weight range: `400–700`.
- **Secondary / corporate font: Zalando Sans SemiExpanded**
  - Used for SautiLink brand names, product labels, footer branding, copyright lines, and other deliberate corporate/signature surfaces.
  - Variable normal and italic faces are self-hosted.
  - Supported weight range: `200–900`.

Implementation tokens:

- `--font-primary` → Lora
- `--font-brand` → Zalando Sans SemiExpanded
- `--font` → `--font-primary` for compatibility with the existing shared stylesheet
- `[data-brand-font]` may be used when a new corporate/signature element needs the secondary family.

Web font files live under `public/assets/fonts/` and the shared mapping lives in `public/assets/brand/typography.css`. Pages must self-host the font assets rather than depending on a runtime request to an external font stylesheet/provider. Form controls explicitly inherit the primary font so mobile browsers do not silently fall back to their system UI font. Monospace technical output remains monospace for readability.

Both families are distributed under the SIL Open Font License 1.1. Their original license files must remain alongside the vendored font assets. Do not rename or modify the font software in a way that violates Reserved Font Name restrictions.

This typography contract is intended to be reused across SautiLink Corporation web products so desktop and mobile surfaces maintain a consistent visual identity.

## Regression protection

Automated branding tests should fail if normal user-facing start, about, settings, or admin output reintroduces known infrastructure-vendor branding. Web typography tests should also fail if the self-hosted font assets, license files, primary/brand mappings, or page wiring are removed. New user-facing features must follow the same SautiLink-first rule.
