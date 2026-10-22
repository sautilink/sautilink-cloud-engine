# SautiLink Cloud Engine

**Site:** https://cloudengine.sautilink.com

Cloudflare Pages tools + Telegram bot with isolate-local usage protection.

Telegram UI supports English and Kiswahili presentation while Cloud Engine APIs remain language-neutral.

```bash
npm install && npm run dev
```

Telegram: `docs/TELEGRAM.md`

Telegram proxy directory: `docs/PROXY_DIRECTORY.md` (dedicated Worker/D1 must be provisioned before deploying its Pages service binding).

Development and tests require Node.js 24 or later. Use `npm ci` for the committed dependency versions.
