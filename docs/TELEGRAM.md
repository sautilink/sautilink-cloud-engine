# Telegram Bot

Thin client over Cloud Engine APIs.

## Public usage protection (Phase 7I)

Isolate-local quotas (not global):

| Setting | Env | Default |
|---------|-----|--------|
| Window | `TELEGRAM_PUBLIC_RATE_WINDOW_SECONDS` | 60 |
| Expensive cmds | `TELEGRAM_PUBLIC_EXPENSIVE_LIMIT` | 5 |
| Cheap cmds | `TELEGRAM_PUBLIC_CHEAP_LIMIT` | 20 |
| Max tracked chats | (code) | 500 |

**Cloudflare edge rate limiting remains the global control.**

Admins listed in `TELEGRAM_ADMIN_IDS` (comma-separated user ids) bypass public quotas only — not Cloudflare edge limits.

Admin command: `/admin` (not listed in public `/help`).

Expensive: analyzer commands + audit detail callbacks.  
Cheap: start/help/about/status/id/admin, menus, tool prompts.
