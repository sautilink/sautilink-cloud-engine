/**
 * Telegram bot configuration from environment secrets.
 * Never log or return token values.
 */

export const DEFAULT_CLOUD_ENGINE_BASE_URL =
  "https://cloudengine.sautilink.com";

/** Upstream Cloud Engine HTTP timeout (ms). */
export const ENGINE_TIMEOUT_MS = 20_000;

/** Max command argument length. */
export const MAX_ARG_LENGTH = 2048;

/** Max Telegram outbound message length (safety margin under 4096). */
export const MAX_TELEGRAM_TEXT = 3900;

/**
 * @param {Record<string, string|undefined>|undefined} env
 */
export function getTelegramConfig(env = {}) {
  const token =
    typeof env.TELEGRAM_BOT_TOKEN === "string"
      ? env.TELEGRAM_BOT_TOKEN.trim()
      : "";
  const webhookSecret =
    typeof env.TELEGRAM_WEBHOOK_SECRET === "string"
      ? env.TELEGRAM_WEBHOOK_SECRET.trim()
      : "";
  let base =
    typeof env.CLOUD_ENGINE_BASE_URL === "string"
      ? env.CLOUD_ENGINE_BASE_URL.trim()
      : "";
  if (!base) base = DEFAULT_CLOUD_ENGINE_BASE_URL;
  // strip trailing slash
  base = base.replace(/\/+$/, "");

  return {
    token,
    webhookSecret,
    cloudEngineBaseUrl: base,
    configured: Boolean(token),
  };
}
