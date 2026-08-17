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

## Corporate color system

SautiLink Corporation web products use the same core brand palette:

- **Primary Blue:** `#2563EB` — main brand/action/accent color.
- **Light Blue:** `#60A5FA` — secondary accent, hover/highlight, and softer brand emphasis.
- **White:** `#FFFFFF` — primary brand neutral for light surfaces, reversed text, and logo-friendly contrast.

Neutral dark/light colors may still be used for backgrounds, borders, text hierarchy, code blocks, and accessibility. Product accents and deliberate brand emphasis should resolve to the SautiLink blue family rather than legacy red accents.

Implementation tokens:

- `--brand-primary` → `#2563EB`
- `--brand-primary-hover` → `#1D4ED8`
- `--brand-light` → `#60A5FA`
- `--brand-white` → `#FFFFFF`

Cloud Engine maps its existing `--accent`, `--accent-hover`, and `--accent-soft` tokens onto this corporate palette so feature styles remain compatible while the public visual identity stays consistent.

## Corporate typography

SautiLink web products use **Inter as the single font family** across the entire product experience.

- **Inter**
  - Used for normal page content, headings, navigation, buttons, forms, cards, reports, brand names, product labels, footer branding, and copyright/signature surfaces.
  - Variable normal and italic faces are self-hosted.
  - Supported weight range: `100–900`.
  - Brand distinction should come from weight, scale, spacing, color, layout, and the SautiLink logo rather than a secondary typeface.

Implementation tokens:

- `--font-primary` → Inter
- `--font` → `--font-primary` for compatibility with the existing shared stylesheet
- `[data-brand-font]` remains supported for semantic brand markup but resolves to Inter like all other product text.

Web font files live under `public/assets/fonts/inter/` and the shared mapping lives in `public/assets/brand/typography.css`. Pages must self-host the font assets rather than depending on a runtime request to an external font stylesheet/provider. Form controls explicitly inherit Inter so mobile browsers do not silently fall back to a different UI family. Monospace technical output may remain monospace where required for readability.

Inter is distributed under the SIL Open Font License 1.1. The original license file must remain alongside the vendored font assets.

This single-family typography and color contract is intended to be reused across SautiLink Corporation web products so desktop and mobile surfaces maintain a consistent, product-first visual identity.

## Regression protection

Automated branding tests should fail if normal user-facing start, about, settings, or admin output reintroduces known infrastructure-vendor branding. Web brand tests should also fail if the self-hosted Inter assets, license file, single-family mapping, corporate color tokens, or page wiring are removed. New user-facing features must follow the same SautiLink-first rule.
