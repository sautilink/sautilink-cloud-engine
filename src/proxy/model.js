import { ACTIVE_INTERVAL_MS, MAX_HISTORY, PUBLIC_STATUSES, SNAPSHOT_TTL_MS, SOURCES, TARGET_ACTIVE, VERIFICATION_TTL_MS, boundedInteger } from "./config.js";

const iso = value => Number.isFinite(Number(value)) && Number(value) > 0 ? new Date(Number(value)).toISOString() : null;
const timestamp = value => typeof value === "string" ? Date.parse(value) : NaN;

export function observeCandidate(candidate, observation, now = Date.now()) {
  // A socket alone can never promote a candidate into the public Active pool.
  const verified = observation.status === "active" && observation.check_level === "mtproto";
  const failed = observation.status === "offline";
  const failures = verified ? 0 : failed ? (candidate.failures || 0) + 1 : candidate.failures || 0;
  const status = verified ? "active" : failed ? (failures >= 3 ? "offline" : candidate.success_at ? "unstable" : "unverified") : "unverified";
  let history = [];
  try { history = JSON.parse(candidate.history || "[]"); } catch { /* Start fresh if an old record is damaged. */ }
  if (!Array.isArray(history)) history = [];
  const latency = verified && Number.isFinite(observation.latency_ms) && observation.latency_ms >= 0 ? Math.round(observation.latency_ms) : null;
  const nextDelay = verified ? ACTIVE_INTERVAL_MS : failed ? (failures < 3 ? 60_000 : Math.min(3_600_000, 300_000 * 2 ** Math.min(failures - 3, 4))) : 900_000;
  return {
    ...candidate,
    checked_at: now,
    success_at: verified ? now : candidate.success_at,
    status, failures,
    checks: (candidate.checks || 0) + (verified || failed ? 1 : 0),
    successes: (candidate.successes || 0) + (verified ? 1 : 0),
    latency_ms: latency,
    reason_code: verified ? "MT_PROTO_RESPONSE" : String(observation.reason_code || "CHECK_UNAVAILABLE").slice(0, 80),
    check_location: observation.check_location || null,
    history: JSON.stringify([...history, { checked_at: iso(now), status, latency_ms: latency }].slice(-MAX_HISTORY)),
    next_check_at: now + nextDelay,
  };
}

export function selectDueCandidates(candidates, now, limit) {
  const due = candidates.filter(row => row.next_check_at <= now);
  const sort = (a, b) => a.next_check_at - b.next_check_at || a.created_at - b.created_at || a.id.localeCompare(b.id);
  const active = due.filter(row => row.status === "active").sort(sort);
  const other = due.filter(row => row.status !== "active").sort(sort);
  const activeQuota = Math.ceil(limit / 2);
  const selected = active.splice(0, activeQuota);
  selected.push(...other.splice(0, limit - selected.length));
  // Fill unused slots without starving discovery when established entries are due.
  for (const row of [...other, ...active]) {
    if (selected.length >= limit) break;
    selected.push(row);
  }
  return selected.slice(0, limit);
}

function publicRow(row, now) {
  const source = SOURCES.find(item => item.id === row.source_id);
  const fresh = row.status === "active" && row.success_at > now - VERIFICATION_TTL_MS && row.success_at <= now + 5000;
  let history = [];
  try { history = JSON.parse(row.history || "[]"); } catch { /* No history is preferable to invented measurements. */ }
  const connect = new URL("https://t.me/proxy");
  connect.searchParams.set("server", row.host);
  connect.searchParams.set("port", String(row.port));
  connect.searchParams.set("secret", row.secret);
  return {
    id: row.id,
    label: row.host,
    host: row.host,
    port: row.port,
    type: "mtproto",
    transport: row.transport,
    status: row.status === "active" && !fresh ? "stale" : row.status,
    latency_ms: fresh ? row.latency_ms : null,
    last_checked_at: iso(row.checked_at),
    last_success_at: iso(row.success_at),
    check_location: row.check_location || "Cloudflare monitoring network",
    source: source ? { name: source.name, url: source.url } : { name: "Community source", url: null },
    operator: "community",
    connect_url: fresh ? connect.toString() : null,
    availability_pct: row.checks ? Math.round(1000 * row.successes / row.checks) / 10 : null,
    checks: row.checks || 0,
    check_level: row.success_at ? "mtproto" : "none",
    reason_code: row.reason_code,
    history: Array.isArray(history) ? history.slice(-MAX_HISTORY) : [],
  };
}

export function createSnapshot(candidates, sources, now = Date.now()) {
  return {
    schema_version: 1,
    generated_at: iso(now),
    expires_at: iso(now + SNAPSHOT_TTL_MS),
    monitor_status: candidates.some(row => Number.isFinite(row.checked_at) && row.checked_at > 0) ? "ready" : "warming",
    target_active: TARGET_ACTIVE,
    refresh_interval_seconds: 60,
    verification_ttl_seconds: VERIFICATION_TTL_MS / 1000,
    proxies: candidates.map(row => publicRow(row, now)),
    sources,
  };
}

export function emptySnapshot(monitorStatus = "warming") {
  return { schema_version: 1, generated_at: null, expires_at: null, monitor_status: monitorStatus, target_active: TARGET_ACTIVE, refresh_interval_seconds: 60, verification_ttl_seconds: VERIFICATION_TTL_MS / 1000, proxies: [], sources: [] };
}

/** Recheck expiry on every read, even if the scheduler itself has stopped. */
export function listSnapshot(snapshot, parameters = new URLSearchParams(), now = Date.now()) {
  const data = snapshot?.schema_version === 1 ? snapshot : emptySnapshot();
  const expired = !Number.isFinite(timestamp(data.expires_at)) || timestamp(data.expires_at) <= now;
  const stopped = data.monitor_status === "unavailable" || data.monitor_status === "stale";
  const rows = (Array.isArray(data.proxies) ? data.proxies : []).map(row => {
    const lastSuccess = timestamp(row.last_success_at);
    const stale = row.status === "active" && (expired || stopped || !Number.isFinite(lastSuccess) || lastSuccess <= now - VERIFICATION_TTL_MS || lastSuccess > now + 5000);
    return { ...row, status: stale ? "stale" : row.status, connect_url: !stale && row.status === "active" ? row.connect_url : null, latency_ms: !stale && row.status === "active" ? row.latency_ms : null };
  });
  const counts = Object.fromEntries([...PUBLIC_STATUSES.map(status => [status, rows.filter(row => row.status === status).length]), ["total", rows.length]]);
  const requestedStatus = parameters.get("status") || "active";
  const filter = requestedStatus === "all" || PUBLIC_STATUSES.includes(requestedStatus) ? requestedStatus : "active";
  let filtered = rows.filter(row => filter === "all" || row.status === filter);
  const id = parameters.get("id");
  if (id) filtered = rows.filter(row => row.id === id);
  const reliability = parameters.get("sort") === "reliability";
  filtered.sort((a, b) => PUBLIC_STATUSES.indexOf(a.status) - PUBLIC_STATUSES.indexOf(b.status) || (reliability ? (b.availability_pct || 0) - (a.availability_pct || 0) : (a.latency_ms ?? Infinity) - (b.latency_ms ?? Infinity)) || a.id.localeCompare(b.id));
  const perPage = boundedInteger(parameters.get("per_page"), 20, 1, 100);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const page = Math.min(boundedInteger(parameters.get("page"), 1, 1, 10000), totalPages);
  return {
    ...data,
    monitor_status: stopped ? data.monitor_status : expired && data.generated_at ? "stale" : data.monitor_status,
    counts,
    target_active: TARGET_ACTIVE,
    filter,
    page,
    per_page: perPage,
    total: filtered.length,
    total_pages: totalPages,
    proxies: filtered.slice((page - 1) * perPage, page * perPage),
  };
}
