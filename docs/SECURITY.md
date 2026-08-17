# Security

Telegram usage tracking remains isolate-local and ephemeral. Durable preferences store only the minimal presentation record described below.

Admin identity uses Telegram user id via `TELEGRAM_ADMIN_IDS` only.

SSRF authority remains Cloud Engine.

## Localization

- Supported locale identifiers are allowlisted to `en` and `sw`.
- Language callbacks are fixed values only: `menu:lang`, `lang:en`, `lang:sw`.
- Locale values never influence API URLs, tool routing, authorization, SSRF decisions, or secrets.
- Telegram remains plain text; translation interpolation uses simple named placeholders and does not evaluate code.
- Technical analyzer payloads are not machine-translated.
- Existing webhook secret validation, callback allowlist, usage controls, cooldown, deduplication, audit in-flight guard, admin authorization, and SautiLink global controls remain unchanged.

## Durable preferences

- Durable Telegram preferences use one existing server-managed preference record keyed by Telegram numeric user ID.
- Stored user attributes are limited to:
  - Telegram numeric user ID
  - locale (`en` or `sw`)
  - report detail (`compact` or `detailed`)
  - developer mode (`false` or `true`)
  - creation/update timestamps
- Row Level Security is enabled on the preference table.
- Public application roles have no table privileges.
- Durable-store credentials remain server-side only and must never be committed, exposed in client code, placed in callback data, or printed in logs/admin output.
- Telegram user IDs are validated as numeric before durable preference queries.
- Every persisted preference value is strictly allowlisted before write.
- Preference reads/writes use a bounded timeout and fail open; storage failure must not block Telegram commands or Cloud Engine checks.
- Isolate-local preference caches are bounded to 500 entries with a 5-minute TTL.
- No Telegram username, display name, Chat ID, checked domain/URL, diagnostic result, or browsing history is persisted by the preference layer.
- Preference persistence does not alter analyzer routing, Cloud Engine scoring, authorization, SSRF boundaries, or `/api/*` contracts.

## Preference observability

- Durable reads/writes emit sanitized structured operational events.
- Preference log events expose only operational status, bounded error codes, and duration; they do not include credentials, request URLs, Telegram user IDs, or preference payload bodies.
- Network/HTTP/config failures remain fail-open and are logged as fallback/skipped states rather than thrown into the bot flow.
- `/admin` exposes only a concise SautiLink-managed durable-preference status.

## Settings callbacks

- `menu:settings` is fixed and allowlisted.
- Phase 7S adds only these fixed preference callbacks:
  - `pref:detail:compact`
  - `pref:detail:detailed`
  - `pref:dev:off`
  - `pref:dev:on`
- Arbitrary callback suffixes or user-supplied preference payloads are rejected.
- Settings callbacks perform normal Telegram authorization before returning or changing user-facing content.
- Opening Settings clears pending guided-input state so later text is not accidentally interpreted as an earlier website target.

## Developer Mode boundary

Developer Mode changes presentation only. It may expose additional technical information about the target that the user asked Cloud Engine to inspect, such as response metadata, DNS result counts, and analyzer finding codes.

Developer Mode must never expose:

- SautiLink infrastructure providers
- internal service topology
- deployment/runtime details
- database/provider identifiers
- environment variables or secrets
- internal architecture decisions

The analyzer payload and SSRF/security trust boundaries remain unchanged whether Developer Mode is on or off.
