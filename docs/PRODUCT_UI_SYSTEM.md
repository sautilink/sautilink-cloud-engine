# SautiLink Product UI System

This document records the reusable product-shell decisions introduced during the Cloud Engine brand and account UX pass. It is intended to be reused by future SautiLink web products rather than recreated from screenshots.

## Product identity

- Corporate identity: SautiLink Corporation.
- Corporate logo: `https://sautilink.com/logo.png`.
- Product name remains a secondary label such as `Cloud Engine` or `Account`.
- Cloud Engine product mark: `/assets/brand/product-mark.svg`.
- Do not replace the SautiLink corporate identity with a generic product glyph in the primary header.
- Keep interfaces emoji-free. Use typography, SVG icons and status styling instead.

## Typography and color

Cloud Engine uses the self-hosted Manrope variable family through `/assets/brand/typography-manrope.css`.

Canonical product colors:

- Primary blue: `#2563EB`
- Primary hover: `#1D4ED8`
- Light blue: `#60A5FA`
- Dark product background: `#0B0F19`
- White: `#FFFFFF`

Use neutral surfaces and borders to create hierarchy. Avoid oversized decorative gradients, floating decorative cards and visual effects that compete with the product task.

## Header pattern

The shared header should:

1. show the official SautiLink logo first;
2. show the product name as a smaller secondary label;
3. keep primary navigation short;
4. place the most important account/product action at the right;
5. collapse navigation cleanly on smaller screens.

The reusable styling lives in `/assets/brand/product-shell.css`.

## Account entry pattern

Account login, signup and verification use a two-column desktop layout:

- left: concise identity/value context;
- right: focused form card;
- tablet/mobile: one centered column;
- mobile form inputs use at least 16px text to avoid browser zoom behavior;
- optional explanatory benefit cards may be hidden on small screens to keep authentication focused.

The account polish layer lives in `/account/account-polish.css`.

### Username availability

Username availability is a visible product state, not helper text.

Required states:

- neutral/instruction;
- checking;
- available;
- taken/invalid;
- network/unconfirmed.

The browser may provide immediate feedback, but the server remains authoritative. Signup performs a fresh same-origin availability request immediately before submission through `/account/username-guard.js`.

## Legal and data language

Whenever a surface describes SautiLink web/app data handling, account creation or account access, link the relevant terms directly:

- Privacy Policy: `https://sautilink.com/privacy`
- Terms: `https://sautilink.com/terms`

Do not render Privacy Policy or Terms as non-clickable text when they are presented as legal references.

## Footer pattern

The product footer uses grouped navigation rather than a single centered copyright line.

Recommended groups:

- Product: workspace, tools, product FAQ;
- SautiLink: corporate home, about, SautiNote/blog, contact;
- Legal: Privacy Policy, Terms;
- Companion/services: Telegram bot, SautiLink Account when relevant;
- social icons as SVG links with accessible labels.

Keep footer links explicit and destination-backed. Do not use placeholder links.

## Social and companion destinations

Current confirmed product destinations:

- Facebook: `https://facebook.com/sautilink`
- X/link hub: `https://linktr.ee/sautilink`
- TikTok: `https://tiktok.com/@sautilink`
- Cloud Engine Telegram companion: `https://t.me/sautilinkcloud_bot`

Until a direct Instagram URL is confirmed, use the official SautiLink link hub rather than inventing a handle.

## Product assets

Cloud Engine keeps first-party product assets in the repository:

- `/assets/brand/product-mark.svg`
- `/assets/brand/cloud-engine-share.png` — 1200x630 social preview
- `/favicon/favicon.svg`
- `/favicon/favicon-32.png`
- `/favicon/apple-touch-icon.png`
- `/favicon/icon-192.png`
- `/favicon/icon-512.png`

The corporate SautiLink logo remains owned by the SautiLink corporate site and is referenced through the first-party `sautilink.com` URL.

## Search and machine discovery

Public product pages should provide:

- a unique descriptive title;
- meta description;
- canonical URL;
- Open Graph metadata;
- large social preview image;
- sitemap entry where appropriate;
- crawler-safe robots rules;
- structured data where it accurately describes visible product content.

Account, verification and authenticated surfaces should not be search-index targets.

`/llms.txt` provides a concise machine-readable product map; it supplements, but does not replace, normal HTML metadata, sitemap and robots behavior.

## Design principle

The visual reference is established consumer technology rather than a generic AI dashboard. Prioritize familiar hierarchy, stable spacing, clear status language, purposeful controls and responsive behavior. Distinctiveness should come from SautiLink identity and product usefulness, not decorative novelty.
