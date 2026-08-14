# Telegram Bot

Public thin client for Cloud Engine APIs.

## Commands

Generated from `src/telegram/registry.js`.

**Aliases:** `/check` → `/audit`, `/site` → `/website`

## Access control foundation

`authorizeUser()` currently allows everyone (`role: public`).  
Optional secret `TELEGRAM_ADMIN_IDS` (comma-separated user ids) enables `isAdmin()` for **future** admin tools — no admin commands in this phase.

No user database. No subscriptions or payments yet.

## Reliability

Best-effort isolate-local dedup/cooldowns only. Cloudflare edge rate limiting is authoritative.
