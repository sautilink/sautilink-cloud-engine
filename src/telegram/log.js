/**
 * Safe structured logging for Telegram operations.
 * Never log tokens, secrets, or credential-bearing URLs.
 */

export function newCorrelationId() {
  return `tg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {Record<string, unknown>} fields
 */
export function logTelegram(fields) {
  try {
    const safe = {
      event: fields.event || "telegram",
      correlation_id: fields.correlation_id || undefined,
      update_id: fields.update_id != null ? String(fields.update_id) : undefined,
      command: fields.command || undefined,
      callback_action: fields.callback_action || undefined,
      status: fields.status || undefined,
      duration_ms:
        typeof fields.duration_ms === "number" ? fields.duration_ms : undefined,
      error_code: fields.error_code || undefined,
      chat_id:
        fields.chat_id != null ? String(fields.chat_id).slice(0, 32) : undefined,
    };
    // Drop undefined keys
    for (const k of Object.keys(safe)) {
      if (safe[k] === undefined) delete safe[k];
    }
    console.log(JSON.stringify(safe));
  } catch {
    // never throw from logger
  }
}
