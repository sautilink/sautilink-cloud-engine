# Testing notes

## Telegram (offline)

- Dedup: same `update_id` skipped within isolate TTL; different ids processed
- Callback allowlist rejects URL-like payloads
- Normalize rejects `ftp://`, `file://`, domain-vs-URL rules

## Production probes

Tool APIs should return HTTP 200 for valid public targets. Webhook: GET 405; bad secret 401 when configured.

Live Telegram chat tests require operator-configured secrets and webhook registration.
