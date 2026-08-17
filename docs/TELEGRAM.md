# Telegram Bot

Thin client over Cloud Engine APIs. Cloud Engine remains the source of truth for analyzers and SSRF protection.

## Guided diagnostics (Phase 7K)

1. **Check a Website** → send `example.com`
2. Diagnostic menu (fixed `diag:*` callbacks only)
3. One selected tool → one existing API

Target state is isolate-local (TTL 5 min, max 200 chats). No URLs are stored in callback data.

| Button | Endpoint |
|--------|----------|
| Security | `/api/headers` |
| SEO | `/api/website` |
| Mobile | `/api/mobile` |
| Email | `/api/email` |
| HTTPS | `/api/ssl` |
| DNS | `/api/dns` |
| Robots | `/api/robots` |
| Sitemap | `/api/sitemap` |
| Full Audit | `/api/audit` |

## Result actions (Phase 7L)

Diagnostic results support Re-run, Full Audit, Check Another, and Back. Full Audit keeps Summary, Priorities, category details, Re-run, and Back. Target recovery never trusts callback data.

The guided diagnostic runner has a fail-safe path so formatter/API failures replace loading text with a user-facing error and Retry/Back actions.

## Localization (Phase 7M)

Supported locales:

- `en` — English (default and universal fallback)
- `sw` — Kiswahili

Users can switch with `/lang en`, `/lang sw`, `/lang english`, `/lang swahili`, `/lang kiswahili`, or the **Language / Lugha** main-menu button.

Localization changes Telegram presentation only: menus, prompts, loading/errors, report labels, audit categories, grade explanations, and navigation. Domains, URLs, scores, HTTP codes, DNS records, headers, SPF/DMARC values, and arbitrary analyzer findings/recommendations remain language-neutral/pass-through.

Callback data remains fixed and language-neutral. Language callbacks are only `menu:lang`, `lang:en`, and `lang:sw`.

## Durable preferences (Phase 7N+)

Explicit user choices are durable while bounded isolate-local caches keep normal bot interactions fast.

Locale resolution order:

1. Explicit isolate-local override for the chat, if present and not expired.
2. Durable preference for the Telegram numeric user ID, if one exists.
3. Telegram `from.language_code`: `sw-*` → `sw`, `en-*` → `en`.
4. English fallback for all other/missing values.

Storage behavior:

- Durable key: Telegram numeric user ID
- Stored preferences: allowlisted presentation choices only
- Metadata: creation/update timestamps
- Isolate caches: max 500 entries, 5-minute TTL
- Server-side access only; preference storage is not exposed to Telegram clients
- Timeout/network/config failures fail open to cached/default behavior
- No usernames, display names, checked targets, diagnostic results, or browsing history are stored by the preference layer

Phase 7N was live-verified by saving a language choice, redeploying production to clear isolate state, then confirming `/start` still opened in the selected language from durable preference storage.

## Preference reliability and observability (Phase 7O)

- Durable writes accept only strict allowlisted preference values.
- Unexpected values are rejected before an outbound preference request.
- Durable reads and writes emit sanitized structured operational events without secrets, user IDs, URLs, or payload bodies.
- Preference-storage failures remain fail-open so Telegram and Cloud Engine checks continue working.
- `/admin` reports only a concise SautiLink-managed durable-preference status.
- Automated Node tests cover the preference store and isolate caches.

## Settings & Preferences (Phase 7P–7Q)

- `/settings` opens the Settings screen.
- The main menu keeps the direct **Language / Lugha** shortcut and also adds **Settings / Mipangilio**.
- Settings shows Telegram User ID and Chat ID, the active language, and privacy/personalisation context.
- `/id` remains an optional shortcut.
- The Settings callback is the fixed value `menu:settings`; it carries no user IDs, URLs, secrets, or arbitrary preference values.
- Opening Settings clears pending guided-input state so later text is not accidentally treated as an earlier website target.
- Chat ID and checked-site history are not persisted in the preference profile.

## Personalisation v1 (Phase 7S)

Two real presentation preferences are available:

- **Report Detail**
  - `Compact` — fewer findings/records for fast scanning.
  - `Detailed` — more findings, recommendations, priorities, and DNS records within Telegram message limits.
- **Developer Mode**
  - `Off` — normal user-facing report presentation.
  - `On` — adds target-facing technical metadata and machine finding codes where available.

Defaults are **Compact + Developer Mode Off**.

Fixed callback values:

- `pref:detail:compact`
- `pref:detail:detailed`
- `pref:dev:off`
- `pref:dev:on`

Personalisation is applied consistently to direct commands, guided diagnostic actions, audit re-runs, summaries, priorities, and category views. Developer Mode is explicitly limited to information about the target being checked; it must not expose SautiLink infrastructure, providers, secrets, topology, or internal architecture.

The existing durable preference record is extended rather than creating a separate profile/history store. Telegram User ID remains the durable key. Chat ID and checked-site history remain non-durable.

Cloud Engine analyzers, scoring, SSRF controls, and `/api/*` contracts remain unchanged.

## Default Experience (Phase 7T)

Users can choose what a normal `/start` opens:

- **Main Menu (`main`)** — the existing branded home experience and the safe default.
- **Quick Check (`quick`)** — immediately opens branded guided website target capture and arms the existing short-lived guided state.
- **Tools Hub (`tools`)** — opens a SautiLink-owned tools launcher with Quick Check, Website Tools, Infrastructure, Settings, and Back.

The setting is durable and stored in the existing preference record as `default_view`. Existing users receive `main` automatically; no migration requires user action.

Fixed preference callbacks:

- `pref:view:main`
- `pref:view:quick`
- `pref:view:tools`

The Help menu may open the same Tools Hub through fixed callback `menu:tools`. No URL, Telegram ID, provider name, secret, or arbitrary value is placed in callback data.

`default_view` affects presentation/navigation only. It does not change analyzers, scoring, authorization, SSRF validation, API routes, usage accounting, or stored browsing data.
