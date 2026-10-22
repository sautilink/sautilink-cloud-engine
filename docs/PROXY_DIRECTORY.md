# Telegram proxy guide

Open [Telegram proxies](https://cloudengine.sautilink.com/tools/proxy) or send
`/proxy` to [@sautilinkcloud_bot](https://t.me/sautilinkcloud_bot).

## Connect

1. Select an available **Connect Proxy** button.
2. Review the details Telegram shows and confirm if you want to connect.
3. If the connection does not work from your network, select another available
   proxy or refresh the list.

Use **Previous**, **Next** and **Refresh** to browse current choices.
`/proxy status` shows directory status; `/proxy help` opens connection help.

## What the status means

| Status | Meaning |
| --- | --- |
| Active | Passed a recent connection check and remains eligible to display |
| Unstable | A previously successful proxy failed a subsequent check |
| Offline | Repeated checks failed |
| Unverified | A reliable result is not yet available |
| Stale | The previous result is no longer current |

Only currently eligible Active entries offer a connection link. Counts change
as checks and availability change. A recent successful check is not a guarantee
of performance, operator identity, privacy or access from your location.
If an older Telegram message still contains buttons, use Refresh for current
choices.

These are community proxies. They are offered through Cloud Engine, powered by
SautiLink Corporation. Follow [official updates](https://t.me/drcharlesofficial).

## Public API

```text
GET https://cloudengine.sautilink.com/api/proxies?status=active&page=1&per_page=20&sort=latency
```

| Parameter | Values |
| --- | --- |
| `status` | `active` (default), `all`, `unstable`, `offline`, `unverified`, `stale` |
| `page` | Positive page number |
| `per_page` | 1–100; default 20 |
| `sort` | `latency` (default) or `reliability` |
| `id` | Optional exact configuration identifier |

The response includes directory counts, freshness information, pagination and
proxy rows. A row's `connect_url` is present only when it is currently eligible.
Check the returned status and expiry before presenting a connection. The
published connection URL includes the configuration Telegram needs; it is not
a private account credential.

Latency describes the service's observed check. A success percentage describes
observed checks, not a guaranteed uptime level. Requests retrieve current
results; the API does not accept arbitrary targets to probe.

The directory does not change a user's Telegram settings automatically. Users
choose and confirm their own connections.
