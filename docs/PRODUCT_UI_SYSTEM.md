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

Cloud Engine uses the self-hosted Inter variable family from the SautiLink corporate web brand system. The existing `/assets/brand/typography-manrope.css` path is retained only to avoid changing stable page wiring.

Canonical product colors:

- Primary blue: `#2563EB`
- Primary hover: `#1D4ED8`
- Light blue: `#60A5FA`
- Public page background: `#FFFFFF`
- Neutral public surface: `#F5F5F7`
- Primary public text: `#1D1D1F`
- White: `#FFFFFF`

Use neutral surfaces and borders to create hierarchy. Avoid oversized decorative gradients, floating decorative cards and visual effects that compete with the product task.

## Header pattern

The shared header should:

1. show the official SautiLink logo first;
2. show the product name as a smaller secondary label;
3. keep primary navigation short;
4. place the most important account/product action at the right;
5. collapse navigation cleanly on smaller screens.

The reusable brand chrome lives in `/assets/brand/product-shell.css`. The current public presentation is supplied by the versioned `/assets/brand/ios-ui.css` layer loaded after page styles.

## Account entry pattern

Account login, signup and verification use a two-column desktop layout:

- left: concise identity/value context;
- right: focused form card;
- tablet/mobile: one centered column;
- mobile form inputs use at least 16px text to avoid browser zoom behavior;
- optional explanatory benefit cards may be hidden on small screens to keep authentication focused.

The account layout and polish layers live in `/account/account.css` and `/account/account-polish.css`. The shared `ios-ui.css` layer updates their visual surfaces while preserving the account forms and clients.

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

- Privacy Policy: `https://cloudengine.sautilink.com/privacy`
- Terms: `https://cloudengine.sautilink.com/terms`
- Account & Data Deletion: `https://cloudengine.sautilink.com/account-deletion`

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


## Light public presentation — October 17, 2026

All 29 app-facing HTML routes load `/assets/brand/ios-ui.css?v=20261017-1` after their existing stylesheets and identify the presentation with `data-product-design="ios"` on the body. The domain-verification HTML file is not a product page and stays unchanged. The shared layer provides white and neutral surfaces, readable success/warning/error states, responsive forms and reports, grouped footers and continuous legal-document layouts.

The homepage audit form is the primary action. An original decorative cloud illustration is served in two WebP sizes; it does not represent a real report or service-health result. The available-tool counts and health indicator continue to use their existing client behavior.

The versioned `/assets/brand/ios-ui.js?v=20261017-1` helper adds Escape/outside-click navigation dismissal, a mobile legal-contents disclosure, and FAQ search across questions and answers. Clearing search restores the reader's disclosure choices. Answers support fragment links. Search stays disabled until its enhancement initializes, while the underlying native questions remain readable without JavaScript. Existing page clients retain ownership of menu toggles except on the FAQ, which has no diagnostic client.

### Functional and copy boundaries

Existing form markup, diagnostic clients, account clients, policy document bodies and effective dates remain unchanged. The presentation helper does not call an API or read account credentials. Device-local data clearing remains owned by the existing legal client. Geographic origin slogans are not part of product copy; company address information belongs in formal controller/contact sections, rather than every footer.

### Cache versions and verification

The current service worker caches asset requests by URL. When changing either shared presentation file after release, change its version query in every HTML reference. Keep existing compatibility stylesheets and clients available; presentation releases do not require changing the service worker.

Run `npm test` for the source and behavioral checks. `tests/ios-ui-interactions.test.js` exercises help search, disclosure state and menu dismissal using DOM event doubles. Preserve form markup and policy bodies when changing presentation. Homepage and FAQ JSON-LD blocks are explicitly hashed by the strict Content Security Policy, so their script bytes must remain aligned with those hashes. Rendered Safari/iPhone review is a separate check; source checks do not substitute for visual verification.
