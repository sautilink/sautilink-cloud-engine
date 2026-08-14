# Telegram Bot

Thin client over Cloud Engine APIs.

## UX (Phase 7H)

- Audit categories use full labels on their own line (no truncated “Infrastructure”).
- Score bars are always 10 cells (0–100).
- Shared Unicode-safe truncation helper.
- Consistent user-facing errors (no internal code names as primary text).

## Menus

Fixed `menu:*` / `tool:*` / `audit:*` callbacks only.

## Security

Webhook secret, POST-only, SSRF in Cloud Engine, no secrets in callback data.
