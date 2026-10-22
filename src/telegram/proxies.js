/**
 * Telegram proxy directory: read stored checks only, never probe proxy hosts.
 * Replies are plain text (no HTML/Markdown parse mode). Callback payloads carry
 * only a bounded page number; hosts and connection URLs always come from the API.
 */

import { callCloudEngine } from "./engine.js";
import { formatProxy } from "./format.js";
import { t } from "./i18n/index.js";

export const PROXY_TIMEOUT_MS = 4_000;
export const PROXY_PAGE_SIZE = 5;
export const PROXY_SUCCESS_FRESH_MS = 600_000;
const MAX_PAGE = 9_999;
const STATUSES = ["active", "unstable", "offline", "unverified", "stale"];
const MONITORS = new Set(["ready", "warming", "stale", "unavailable"]);

export async function handleProxyCommand(arg, baseUrl, locale = "en") {
  const value = typeof arg === "string" ? arg.trim().toLowerCase() : "";
  if (value === "help") return proxyHelp(locale);
  if (value === "status") return loadProxyView(baseUrl, locale, { view: "status" });
  if (!value) return loadProxyView(baseUrl, locale);
  if (/^[1-9]\d{0,3}$/.test(value)) return loadProxyView(baseUrl, locale, { page: Number(value) });
  return proxyHelp(locale, true);
}

export async function handleProxyCallback(action, baseUrl, locale = "en") {
  if (action === "proxy:help") return proxyHelp(locale);
  if (action === "proxy:status") return loadProxyView(baseUrl, locale, { view: "status" });
  const match = /^proxy:(?:list|refresh):([1-9]\d{0,3})$/.exec(action);
  if (!match) return null;
  return loadProxyView(baseUrl, locale, { page: Number(match[1]) });
}

function proxyHelp(locale, invalid = false) {
  return {
    text: [invalid ? t(locale, "proxy.usage") : "", formatProxy(locale)].filter(Boolean).join("\n\n"),
    reply_markup: navigation(locale, { view: "help" }),
  };
}

export async function loadProxyView(baseUrl, locale = "en", options = {}) {
  const view = options.view === "status" ? "status" : "list";
  const page = boundedInteger(options.page, 1, MAX_PAGE) ?? 1;
  const result = await callCloudEngine(baseUrl, "/api/proxies", {
    status: view === "status" ? "all" : "active",
    page: view === "status" ? 1 : page,
    per_page: PROXY_PAGE_SIZE,
    sort: "latency",
  }, { timeoutMs: PROXY_TIMEOUT_MS });
  if (!result.ok) return failure(locale, view, page, result.error?.code);
  return renderProxySnapshot(result.data, locale, { view, page });
}

/** Exported for deterministic freshness and malformed-data tests. */
export function renderProxySnapshot(data, locale = "en", options = {}) {
  const view = options.view === "status" ? "status" : "list";
  const requestedPage = boundedInteger(options.page, 1, MAX_PAGE) ?? 1;
  const now = options.now ?? Date.now();
  const snapshot = normalizeSnapshot(data, now);
  if (!snapshot) return failure(locale, view, requestedPage);
  const lines = [t(locale, "proxy.title"), "", t(locale, "proxy.community")];

  if (view === "status") {
    lines.push(t(locale, `proxy.monitor.${snapshot.monitor}`));
    if (snapshot.generated) lines.push(t(locale, "proxy.snapshot_time", { time: timestampLabel(snapshot.generated) }));
    lines.push("", t(locale, !snapshot.generated && snapshot.monitor === "warming" ? "proxy.no_snapshot" : snapshot.fresh ? "proxy.counts" : "proxy.old_counts"));
    for (const status of STATUSES) lines.push(`${statusLabel(locale, status)}: ${snapshot.counts[status]}`);
    lines.push(t(locale, "proxy.total", { count: snapshot.counts.total }));
    if (snapshot.target != null) lines.push("", t(locale, "proxy.target", { count: snapshot.target }));
    lines.push("", t(locale, "proxy.powered_by"));
    return { text: lines.join("\n"), reply_markup: navigation(locale, { view }) };
  }

  const buttons = [];
  for (const [index, row] of snapshot.proxies.slice(0, PROXY_PAGE_SIZE).entries()) {
    const connection = snapshot.fresh && rowFresh(row, now) ? safeProxyConnectUrl(row) : null;
    if (!connection) continue;
    const number = (snapshot.page - 1) * PROXY_PAGE_SIZE + index + 1;
    buttons.push([{ text: t(locale, "proxy.connect", { number }), url: connection }]);
  }
  if (snapshot.fresh) {
    lines.push(t(locale, "proxy.active_count", { count: snapshot.counts.active }));
    if (buttons.length) lines.push(t(locale, "proxy.page", { page: snapshot.page, pages: Math.max(1, snapshot.totalPages) }));
    else lines.push("", t(locale, snapshot.monitor === "warming" ? "proxy.empty_warming" : "proxy.empty"));
  } else {
    lines.push("", t(locale, `proxy.monitor.${snapshot.monitor}`));
  }
  lines.push("", t(locale, "proxy.powered_by"));
  return {
    text: lines.join("\n"),
    reply_markup: navigation(locale, { view, page: snapshot.page, totalPages: snapshot.totalPages, buttons }),
  };
}

function normalizeSnapshot(data, now) {
  if (!data || data.schema_version !== 1 || !MONITORS.has(data.monitor_status)
    || !Array.isArray(data.proxies) || !data.counts || typeof data.counts !== "object") return null;
  const counts = {};
  for (const key of [...STATUSES, "total"]) {
    const value = boundedInteger(data.counts[key], 0, 1_000_000);
    if (value == null) return null;
    counts[key] = value;
  }
  const page = boundedInteger(data.page, 1, MAX_PAGE);
  const totalPages = boundedInteger(data.total_pages, 0, MAX_PAGE);
  if (page == null || totalPages == null || data.per_page !== PROXY_PAGE_SIZE) return null;
  const generated = parseTimestamp(data.generated_at);
  const expiry = parseTimestamp(data.expires_at);
  const fresh = Boolean(generated && expiry && generated <= now + 30_000 && generated <= expiry
    && expiry > now && ["ready", "warming"].includes(data.monitor_status));
  const initial = !generated && data.monitor_status === "warming" && data.proxies.length === 0;
  const monitor = !fresh && !initial && ["ready", "warming"].includes(data.monitor_status) ? "stale" : data.monitor_status;
  return {
    counts, page, totalPages, generated, fresh, monitor, proxies: data.proxies,
    target: boundedInteger(data.target_active, 1, 10_000),
  };
}

function rowFresh(row, now) {
  const checked = parseTimestamp(row?.last_checked_at);
  const success = parseTimestamp(row?.last_success_at);
  return row?.status === "active" && row?.type === "mtproto" && checked != null && success != null
    && checked >= success && checked <= now + 30_000 && success <= now + 30_000
    && now - success <= PROXY_SUCCESS_FRESH_MS;
}

/** Never forward arbitrary backend/feed URLs as Telegram inline URL buttons. */
export function safeProxyConnectUrl(row) {
  if (row?.status !== "active" || row?.type !== "mtproto" || typeof row.connect_url !== "string"
    || row.connect_url.length > 1_400) return null;
  const host = safeHost(row.host);
  const port = boundedInteger(row.port, 1, 65535);
  if (!host || port == null) return null;
  try {
    const url = new URL(row.connect_url);
    if (url.protocol !== "https:" || url.hostname !== "t.me" || url.port || url.username || url.password
      || url.pathname !== "/proxy" || url.hash) return null;
    const params = url.searchParams;
    const keys = [...params.keys()];
    if (keys.length !== 3 || !["server", "port", "secret"].every((key) => params.getAll(key).length === 1)
      || keys.some((key) => !["server", "port", "secret"].includes(key))) return null;
    if (params.get("server")?.toLowerCase() !== host.toLowerCase() || params.get("port") !== String(port)) return null;
    const secret = params.get("secret");
    if (!secret || !/^[a-zA-Z0-9_+\/=\-]{22,600}$/.test(secret)) return null;
    const safe = new URL("https://t.me/proxy");
    safe.searchParams.set("server", host);
    safe.searchParams.set("port", String(port));
    safe.searchParams.set("secret", secret);
    return safe.toString();
  } catch { return null; }
}

function safeHost(value) {
  if (typeof value !== "string" || !value || value.length > 253) return null;
  // The API owns public-address validation; this layer prevents display/URL injection.
  if (!/^[a-zA-Z0-9.:[\]-]+$/.test(value) || /\.\./.test(value)) return null;
  return value;
}

function parseTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function timestampLabel(value) { return new Date(value).toISOString().replace("T", " ").slice(0, 19) + " UTC"; }
function boundedInteger(value, min, max) { return Number.isInteger(value) && value >= min && value <= max ? value : null; }
function statusLabel(locale, status) { return t(locale, `proxy.state.${status}`); }

function failure(locale, view, page, code) {
  const key = code === "ENGINE_TIMEOUT" ? "proxy.timeout" : code === "RATE_LIMITED" ? "proxy.rate" : "proxy.unavailable";
  return {
    text: [t(locale, "proxy.title"), "", t(locale, key), "", t(locale, "proxy.powered_by")].join("\n"),
    reply_markup: navigation(locale, { view, page }),
  };
}

function navigation(locale, { view = "list", page = 1, totalPages = 0, buttons = [] } = {}) {
  const rows = [...buttons];
  if (view === "list") {
    const pages = [];
    if (page > 1) pages.push({ text: t(locale, "proxy.previous"), callback_data: `proxy:list:${page - 1}` });
    if (page < totalPages && page < MAX_PAGE) pages.push({ text: t(locale, "proxy.next"), callback_data: `proxy:list:${page + 1}` });
    if (pages.length) rows.push(pages);
    rows.push([{ text: t(locale, "menu.refresh"), callback_data: `proxy:refresh:${page}` }]);
  } else {
    rows.push([{ text: t(locale, "proxy.browse"), callback_data: "proxy:list:1" }]);
    if (view === "status") rows.push([{ text: t(locale, "menu.refresh"), callback_data: "proxy:status" }]);
  }
  const info = [];
  if (view !== "status") info.push({ text: t(locale, "proxy.status_button"), callback_data: "proxy:status" });
  if (view !== "help") info.push({ text: t(locale, "proxy.help_button"), callback_data: "proxy:help" });
  if (info.length) rows.push(info);
  rows.push([{ text: t(locale, "proxy.updates"), url: "https://t.me/drcharlesofficial" }]);
  rows.push([{ text: t(locale, "menu.back"), callback_data: "menu:main" }]);
  return { inline_keyboard: rows };
}
