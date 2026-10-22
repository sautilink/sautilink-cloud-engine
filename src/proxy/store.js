import { POOL_SIZE, RECOVERY_RETENTION_MS, VERIFICATION_TTL_MS } from "./config.js";

export class ProxyStore {
  constructor(database) { this.db = database; }

  async acquire(now, token) {
    const row = await this.db.prepare("UPDATE proxy_monitor SET lease_token = ?, lease_until = ? WHERE id = 1 AND lease_until <= ? RETURNING *")
      .bind(token, now + 90_000, now).first();
    return row?.lease_token === token ? row : null;
  }

  async release(token, errorCode = null) {
    await this.db.prepare("UPDATE proxy_monitor SET lease_token = NULL, lease_until = 0, last_error_code = ? WHERE id = 1 AND lease_token = ?")
      .bind(errorCode, token).run();
  }

  async importCandidates(candidates, observations, now, previousSources = [], token) {
    if (!token) throw new Error("MONITOR_LEASE_REQUIRED");
    if (candidates.length) {
      // One bounded statement, not hundreds of D1 queries on each source refresh.
      await this.db.prepare(`INSERT INTO proxy_candidates
        (id, host, port, secret, transport, source_id, source_seen_at, created_at)
        SELECT json_extract(value, '$.id'), json_extract(value, '$.host'), json_extract(value, '$.port'),
          json_extract(value, '$.secret'), json_extract(value, '$.transport'), json_extract(value, '$.source_id'),
          json_extract(value, '$.source_seen_at'), ? FROM json_each(?)
        WHERE EXISTS(SELECT 1 FROM proxy_monitor WHERE id = 1 AND lease_token = ? AND lease_until > ?)
        ON CONFLICT(id) DO UPDATE SET source_seen_at = MAX(proxy_candidates.source_seen_at, excluded.source_seen_at)`)
        .bind(now, JSON.stringify(candidates.slice(0, POOL_SIZE)), token, now).run();
      // Retain recently working fallbacks through a transient failure instead
      // of evicting them as soon as the next source window adds new candidates.
      await this.db.prepare(`DELETE FROM proxy_candidates WHERE EXISTS(SELECT 1 FROM proxy_monitor WHERE id = 1 AND lease_token = ? AND lease_until > ?)
        AND id NOT IN (
        SELECT id FROM proxy_candidates ORDER BY CASE WHEN status = 'active' AND success_at > ? THEN 0
        WHEN success_at > ? THEN 1 ELSE 2 END,
        source_seen_at DESC, created_at DESC, id LIMIT ?)`)
        .bind(token, now, now - VERIFICATION_TTL_MS, now - RECOVERY_RETENTION_MS, POOL_SIZE).run();
    }
    return observations.map(source => {
      const { reason_code, http_status, ...previous } = previousSources.find(old => old.id === source.id) || {};
      return { ...previous, ...source };
    });
  }

  async list() {
    const result = await this.db.prepare("SELECT * FROM proxy_candidates ORDER BY id").all();
    return result.results || [];
  }

  async saveObservations(rows, token, now) {
    if (!rows.length) return;
    if (!token || !Number.isFinite(now)) throw new Error("MONITOR_LEASE_REQUIRED");
    await this.db.batch(rows.map(row => this.db.prepare(`UPDATE proxy_candidates SET checked_at = ?, success_at = ?, status = ?,
      failures = ?, checks = ?, successes = ?, latency_ms = ?, reason_code = ?, check_location = ?, history = ?, next_check_at = ?
      WHERE id = ? AND (checked_at IS NULL OR checked_at <= ?) AND EXISTS(SELECT 1 FROM proxy_monitor WHERE id = 1 AND lease_token = ? AND lease_until > ?)`)
      .bind(row.checked_at, row.success_at || null, row.status, row.failures, row.checks, row.successes, row.latency_ms, row.reason_code,
        row.check_location, row.history, row.next_check_at, row.id, row.checked_at, token, now)));
  }

  async publish(snapshot, sources, sourceRefreshAt, token, now) {
    await this.db.batch([
      this.db.prepare(`INSERT INTO proxy_snapshots(id, generated_at, payload)
        SELECT 1, ?, ? WHERE EXISTS(SELECT 1 FROM proxy_monitor WHERE id = 1 AND lease_token = ? AND lease_until > ?)
        ON CONFLICT(id) DO UPDATE SET generated_at = excluded.generated_at, payload = excluded.payload
        WHERE excluded.generated_at >= proxy_snapshots.generated_at`)
        .bind(now, JSON.stringify(snapshot), token, now),
      this.db.prepare(`UPDATE proxy_monitor SET sources = ?, source_refresh_at = ?, last_run_at = ?, last_error_code = NULL,
        lease_token = NULL, lease_until = 0 WHERE id = 1 AND lease_token = ? AND lease_until > ?`)
        .bind(JSON.stringify(sources), sourceRefreshAt, now, token, now),
    ]);
  }

  async snapshot() {
    const row = await this.db.prepare("SELECT payload FROM proxy_snapshots WHERE id = 1").first();
    if (!row) return null;
    try { return JSON.parse(row.payload); } catch { return null; }
  }
}
