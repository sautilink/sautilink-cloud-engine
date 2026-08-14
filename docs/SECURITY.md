# Security

Telegram usage tracking is isolate-local and ephemeral. No DB/KV.

Admin identity uses Telegram user id via `TELEGRAM_ADMIN_IDS` only.

SSRF authority remains Cloud Engine.
