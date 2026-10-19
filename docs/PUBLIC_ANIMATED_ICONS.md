# Public animated icons

The public Cloud Engine pages use the same pinned AnimateIcons catalog as the
SautiLink public websites. The corporate logo, Cloud Engine product mark and
official social brand glyphs keep their original artwork.

## Scope

The icon layer is explicitly enabled by `body[data-public-icons]` on 25 pages:
the workspace homepage, FAQ, Privacy Policy, Terms, Account & Data Deletion
information, and all 20 public analyzer pages under `public/tools/`.

No account/dashboard, login, signup or verification page enables or loads the
layer. All existing analyzer clients, Pages Functions, auth code, APIs, forms,
request parameters, storage and result logic remain unchanged.

## Rendering and motion

- Every static icon is a real, decorative SVG in the page HTML. Its paths render
  when JavaScript is unavailable. Text labels and accessible control names remain.
- `assets/public-icons/adapter.js` enhances only SVGs explicitly marked with
  `data-public-icon`. It plays the original icon animation on hover, focus or
  activation, settles hidden/offscreen icons, and respects reduced motion.
- `assets/brand/public-icon-surfaces.js` decorates the existing workspace tool
  directory and audit category controls when their original clients render them.
  It also restores a button's decorative icon after its client resets the label.
  It adds no click handler and makes no network request.
- Public icon styles are separate from the shared account styles. Scripts and
  styles are local and external, keeping the existing strict CSP.

The full shared runtime, source manifest, license and third-party notices are in
`public/assets/public-icons/`. No CDN or build step is needed for deployment.

## Review checks

The normal test command remains `npm test`.

`tools/public-icons/preview.mjs` serves this repository at
`http://127.0.0.1:4184` for static review with its existing CSP. It deliberately
does not proxy live API requests. Run it from the repository root with Node.

`tools/public-icons/qa.mjs` uses Playwright against that preview, with fixture-only
API responses, to check all public layouts, static fallback, reduced motion,
keyboard animation, menus, search, form submission and audit interactions. It
accepts an optional node_modules directory and Chromium executable as arguments;
otherwise it uses locally installed Playwright and its bundled browser.

`tools/public-icons/verify_preservation.py` compares text, control attributes,
destinations, IDs, image/brand attributes and client script URLs against main
revision `8aaaedcfdd512f2b33e97d894b48e57396ab3dc2`. Review outputs are local in
`tools/public-icons/qa-results/` and are not deployed.

The one-time markup migration is `tools/public-icons/apply.mjs`. It takes the
shared SautiLink `static-helper.mjs` path, whose `iconMarkup` function renders the
canonical catalog; the migration contains no SVG geometry. An optional
`--base=<revision>` reads original public HTML from a pinned revision when
refreshing the migration before review. It is not a production build step.

## Deployment

Cloudflare Pages serves `public/`, with the existing Pages Functions alongside
it. The configured project is `sautilink-cloud-engine`; the existing deployment
command remains `wrangler pages deploy public --project-name=sautilink-cloud-engine`.
No deploy configuration, backend or authenticated surface is changed here.
