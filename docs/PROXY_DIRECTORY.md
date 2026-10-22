# Telegram proxy directory

Cloud Engine exposes a shared, read-only MTProto directory through `/api/proxies`, `/tools/proxy`, and the Telegram bot's `/proxy` command. A separate scheduled Cloudflare Worker checks candidates and publishes results. Requests from visitors never start network probes.

The directory targets **20 recently verified Active entries**. This is an operational target, not a fabricated minimum or a guarantee about third-party availability. The UI and bot display the actual count even when it is below 20. Community proxy operation, the user's network, and the monitor's network can differ.

## Components

| Component | Responsibility |
| --- | --- |
| `workers/proxy.js` / `wrangler.proxy.jsonc` | Dedicated Worker, one-minute Cron Trigger, read-only `/v1/proxies` and `/health` |
| `PROXY_DB` | Dedicated D1 catalog, check history, lease and published snapshot |
| `src/proxy/protocol/` | Classic, padded (`dd`) and Fake TLS (`ee`) MTProto transport checks |
| `src/proxy/monitor.js` | Bounded discovery, scheduling, validation, recovery and publication |
| Pages `PROXY_DIRECTORY` service binding | Fixed internal connection to the directory Worker |
| `functions/api/proxies.js` | Shared public read API with a 2.5-second upstream deadline |
| `src/telegram/proxies.js` | Five results per Telegram page, fixed callbacks, EN/SW presentation |
| `public/tools/proxy.*` | Responsive public directory, filters, sorting and connection guidance |

This D1 database contains no Cloud Engine accounts, Telegram preferences or Pilot moderation records. The checker needs no Telegram bot token, Telegram login, Supabase credential or Telegram API ID/hash. The existing Telegram webhook remains the only bot-token consumer.

## What a check establishes

1. Normalize the published configuration and secret; reject malformed or non-public targets.
2. Resolve with the fixed DNS-over-HTTPS resolver. Validate all returned addresses and connect to a validated literal IP, preventing a second DNS resolution from changing the target.
3. Establish the selected obfuscated MTProto transport. Fake TLS additionally verifies its response HMAC.
4. Send an accountless `req_pq` with a fresh nonce and require a valid, matching `resPQ` response.
5. Close the connection, including failure and timeout paths.

TCP reachability alone never creates an Active entry. This is a protocol liveness check, not Telegram's full authorization-key exchange, proof of the operator's identity, a bandwidth test, or a privacy certification. No messages, user sessions or files travel through these checks.

Unencrypted response bodies may include 0–252 bytes of random word-aligned padding. The parser accepts that range without imposing encrypted-message AES block alignment, while retaining the nonce, constructor, frame, PQ and fingerprint checks. Inner body padding and the padded transport's separate 0–15 bytes remain bounded independently. Fixed diagnostic codes identify the failed guard without logging response bytes.

## Status and freshness

| Status | Meaning | Connect |
| --- | --- | --- |
| Active | Latest MTProto check passed and both result and monitor snapshot remain fresh | Yes |
| Unstable | A previously verified configuration failed a subsequent check; fewer than three failures | No |
| Offline | At least three failed checks; subsequent attempts use backoff | No |
| Unverified | Not checked, or the checker cannot establish a reliable result | No |
| Stale | Last success or the overall monitor snapshot expired | No |

A failed check removes Connect immediately. Protocol/runtime restrictions and DNS service failures are kept distinct from confirmed proxy failures. A later success restores Active and resets the consecutive-failure count.

An Active result expires after **10 minutes**; the monitor snapshot expires after **3 minutes** without publication. The Worker recalculates expiry on every GET, even while its raw snapshot remains in its 15-second isolate cache. Public responses use `Cache-Control: no-store`. The web page also expires individual buttons locally; Telegram renders fresh results when a user opens or refreshes a page. Already-sent Telegram messages cannot expire their buttons autonomously; Refresh loads current connection choices.

The latency value is the monitor's measured protocol-check latency. The success percentage is the fraction of observed checks that passed; it is not a time-based uptime SLA.

## Discovery, scheduling and resource bounds

Only the fixed community feeds configured in `src/proxy/config.js` are used. Their provenance remains available to monitor operations and is omitted from public product views.

Each discovery tick reads at most 1 MiB per feed and considers at most 1,200 raw official Telegram proxy links. It validates a rotating window of **16 links per source**, yielding at most 32 new candidates per discovery. Canonical host, port and secret identify a configuration; a changed secret starts unverified. Source metadata distinguishes the raw feed count, scanned window and valid candidates. No upstream code is copied into the application.

The catalog is capped at **240 configurations**. Fresh Active entries have first retention priority; configurations verified within the previous 24 hours have second priority so a transient failure does not immediately evict a useful fallback. Older failures are replaced by new candidates. Source windows advance every five minutes. Source errors retain the existing catalog and cannot label all existing proxies Offline.

Cron runs every minute. Discovery and probes use separate ticks to avoid combining their CPU peaks. On probe ticks the default is **8 checks**, with at most **3 connections in flight** and a **6-second whole-probe deadline**. Work stops starting new checks after 55 seconds. Active entries are normally due again after four minutes, with room reserved for discovery/recovery; overdue entries queue fairly and still expire if not rechecked in time.

Under the default budget, four slots are reserved for due Active entries and two for previously verified recovery candidates; the rest admit other candidates. Unused allocations are reused. A previously verified configuration with an inconclusive check is due again after two minutes, while confirmed failures retain their existing backoff. These priorities do not relax verification or increase the total probe budget.

The lease lasts 90 seconds. Imports, pruning, observations and snapshot publication are fenced by both the lease token and its expiry. Older results cannot overwrite newer results. History is bounded to 12 observations per configuration. Initial filling takes several scheduled ticks, rather than blocking a visitor's request.

`PROXY_MAX_CHECKS_PER_RUN` defaults to `8` and is clamped to `1..16`. Do not raise it blindly: validate the account's CPU, subrequest and D1 quotas first. The bounded design reduces usage but does not establish that every invocation fits a particular Cloudflare plan. Review actual Worker metrics after deployment; no paid upgrade is implicit in this feature.

## Public API

```text
GET /api/proxies?status=active&page=1&per_page=20&sort=latency
```

- `status`: `active` (default), `all`, `unstable`, `offline`, `unverified`, `stale`.
- `page`: positive page number, clamped to the last page.
- `per_page`: 1–100, default 20; Telegram uses 5.
- `sort`: `latency` (default) or `reliability`.
- `id`: optional exact configuration ID.

The usual Cloud Engine success envelope contains `data.schema_version`, `generated_at`, `expires_at`, `monitor_status`, `counts`, `target_active`, pagination, `discovery`, and `proxies`. Each row includes status, transport, last check/success, latency, observed success percentage and short history. `discovery` provides aggregate feed availability and the latest successful fetch time; feed names, IDs and URLs remain in the monitor store. Only fresh Active rows have a `connect_url`. A raw `secret` field is not exposed; an Active Telegram connection URL necessarily contains the published proxy secret required by the Telegram client.

Arbitrary host, URL and refresh/probe inputs are ignored. An absent binding reports an honest unavailable/empty directory. Worker failures return a sanitized 503. This endpoint does not initiate checks or modify settings.

## Telegram and web behavior

- `/proxy` shows up to five current Active entries as numbered **Connect Proxy** buttons, with a short community label, actual count and page number.
- `/proxy <page>` and Previous/Next paginate the same saved catalog.
- `/proxy status` shows counts, monitor state and freshness.
- `/proxy help` explains connecting and choosing a replacement.
- Refresh reads the latest results and uses the existing bot usage protection.
- Bot and web views use **Powered by SautiLink Corporation** and link **Follow Updates** to `https://t.me/drcharlesofficial`. Public views do not advertise upstream feed brands or URLs.
- English is the default; the existing Swahili preference is respected.
- `/tools/proxy` provides status filters, latency/reliability sorting, pagination, last-check information and automatic refresh using the shared SautiLink visual system.

The directory updates its offered configurations automatically. It does not remotely change a user's Telegram settings or install proxies on their behalf. Users confirm a connection in Telegram; Telegram can manage proxies already added to its own list.

## Deployment order

Use Node **24 or later**, the committed lockfile, and an authenticated Cloudflare session for the account that owns the existing `sautilink-cloud-engine` Pages project. The checker Worker and Pages service binding must be in that same account.

1. Run `npm ci`, `npm test`, and `npm run proxy:runtime-check`.
2. Confirm the account with `npx wrangler whoami`. Do not place API tokens in source, public variables, logs or chat.
3. Check whether the dedicated database already exists. For a first deployment, create it and let Wrangler record its real ID:

   ```bash
   npx wrangler d1 create sautilink-cloud-engine-proxies --config wrangler.proxy.jsonc --binding PROXY_DB --update-config
   ```

   If it already exists, use its verified ID in `wrangler.proxy.jsonc`; do not replace an existing database. This account's provisioned database ID is already committed. A deployment to a different account must use that account's own verified resource ID.

4. Apply only this feature's migrations with `npm run proxy:migrate`.
5. Deploy the dedicated Worker with `npm run proxy:deploy`. Inspect the returned Worker URL's `/health` and `/v1/proxies?status=all`. Give Cron several ticks to discover and check candidates. Check logs/CPU for real protocol successes and any platform restrictions.
6. Once the Worker exists and its binding is valid, deploy/merge the Pages changes. The existing `wrangler.jsonc` binds `PROXY_DIRECTORY` to `sautilink-cloud-engine-proxies`. Do not merge a reference to a nonexistent Worker into production.
7. Verify the public `/api/proxies` and `/tools/proxy` response, EN/SW, theme, mobile layout and pagination. Verify `/proxy`, `/proxy status` and Refresh in the actual Telegram bot. The existing `/proxy` command now serves the directory and is included in in-bot menus/help; no replacement bot or token is needed.

No production readiness claim should be based on fixture counts. Record the real deployed Active count and observation time. A count below 20 remains visible as such; diagnose/replenish the pool without inventing entries.

### Dashboard deployment with Workers Builds

When provisioning through the dashboard, create the dedicated D1 database and execute `migrations/proxy/0001_proxy_directory.sql` in its Console. Verify that `proxy_candidates`, `proxy_monitor`, and `proxy_snapshots` exist before deploying the checker. Record the database's real ID in `wrangler.proxy.jsonc`.

Connect the `sautilink-cloud-engine-proxies` Worker to `sautilink/sautilink-cloud-engine` with these settings:

| Setting | Value |
| --- | --- |
| Production branch during initial provisioning | `feat/active-mtproto-proxies` |
| Build command | Empty |
| Deploy command | `npm run proxy:deploy` |
| Root directory | `/` |

The initial production branch must contain the checker files and the `proxy:deploy` package script. If a build reports `Missing script: "proxy:deploy"`, check its recorded branch and commit. Change the Worker's production branch under **Settings > Build > Branch control**, save it, then push a new commit to that branch to start a build from the intended source. Do not assume retrying an older build changes its source branch or commit.

The deploy script explicitly selects `wrangler.proxy.jsonc`, whose Worker name is `sautilink-cloud-engine-proxies`. The root `wrangler.jsonc` configures the existing `sautilink-cloud-engine` Pages project. Keep each name in its corresponding configuration; a dashboard suggestion based on the default file is not a reason to rename the Pages project.

Workers Builds uses its configured Cloudflare API token to deploy. If the dashboard reports **Configured API token unavailable**, inspect the actual build result: the warning alone does not establish whether the token was revoked or belongs to another account member. If deployment fails to authenticate, use the Builds API token control to select a valid deployment token or create one through **Create new token**, then save the settings. This is separate from the Telegram bot token. Keep credentials out of repository files, logs, and chat.

After the checker is deployed and the feature is merged, change its production branch to `main`. Continue with the real `/health`, `/v1/proxies`, Cron and Pages checks in the deployment order above.

## Verification commands

```bash
npm test
npm run proxy:check
npm run proxy:runtime-check
```

The runtime check compiles the actual Worker and Pages entry points and exercises their service binding against real local D1. It checks scheduled source discovery through the runtime's native fetch, rejected redirects, migrations, exact storage queries, pagination and expiry while the raw snapshot remains cached. All data is synthetic; external network requests are replaced with fixed local fixtures or rejected.

An optional, explicitly networked diagnostic uses the same fixed feeds, DNS resolver and protocol checker:

```bash
node scripts/proxy-smoke.mjs --live --limit=30
```

It never contacts the Bot API, requires no Telegram account and prints aggregate counts only. It is capped at 60 requested candidates and three concurrent probes; actual discovery may provide fewer. `--live` is mandatory. TCP failures from a restricted execution environment do not establish global proxy downtime; the deployed Cloudflare monitor is the decisive check for this deployment.

## Operations and rollback

Worker logs contain bounded aggregate counts (`checked`, `active`, `candidates`, `source_refresh`, `duration_ms`) or a fixed error code. They do not contain proxy secrets, Telegram identities or credentials. Use `/health` and source status to distinguish a paused/failed checker from failed third-party endpoints.

- **Warming:** confirm the migration, source availability and first probe tick.
- **Stale:** inspect Cron delivery, D1 errors and CPU/subrequest limits. Stale entries already lose Connect.
- **Unverified:** inspect aggregate protocol/restriction reasons; do not relabel them Active merely because a TCP port opens.
- **Fewer than 20 Active:** let subsequent windows add candidates; inspect source freshness and the monitor network. Do not increase quotas or purchase infrastructure without review.

The stored `sources` observations retain fixed diagnostic codes for operations without upstream response bodies or exception text. Public responses expose aggregate `discovery` health only:

| Source reason | Meaning |
| --- | --- |
| `SOURCE_HTTP_ERROR` | The source returned a non-2xx response; `http_status` records its numeric status |
| `SOURCE_FETCH_ERROR` | The runtime failed before returning an HTTP response |
| `SOURCE_READ_ERROR` | The response body could not be read |
| `SOURCE_TIMEOUT` | The source deadline expired |
| `SOURCE_EMPTY` | No recognized Telegram proxy links were present |
| `SOURCE_TOO_LARGE` | The bounded feed-size limit was exceeded |

Feed and DNS requests use `redirect: "manual"` and reject non-2xx responses. They never follow a source or resolver redirect. The pinned local Workers runtime rejects `redirect: "error"` before outbound I/O; Node-only fetch mocks do not detect that incompatibility. The scheduled runtime fixture protects this path. New source observations remove previous error/status details while preserving the last successful fetch time.

For rollback, revert the Pages feature/binding first, then disable the dedicated Cron/Worker if needed. Keep the isolated D1 database for diagnosis; do not delete it as part of a normal rollback. Existing Cloud Engine account, bot preference and Pilot stores are unaffected.

## Primary protocol and platform references

- [Telegram MTProto transports](https://core.telegram.org/mtproto/mtproto-transports)
- [Telegram deep links](https://core.telegram.org/api/links#mtproxy-links)
- [Official MTProxy implementation](https://github.com/TelegramMessenger/MTProxy)
- [Official TDLib implementation](https://github.com/tdlib/td)
- [Telegram Desktop unencrypted response parsing and padding](https://github.com/telegramdesktop/tdesktop/blob/52a47639d9aa38713098974dd2ce07e631cb3381/Telegram/SourceFiles/mtproto/connection_abstract.cpp)
- [Telegram Desktop unencrypted message construction](https://github.com/telegramdesktop/tdesktop/blob/52a47639d9aa38713098974dd2ce07e631cb3381/Telegram/SourceFiles/mtproto/connection_abstract.h)
- [Cloudflare outbound TCP sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/#service-bindings)
- [Cloudflare Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Cloudflare Workers production branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)
