const ZEPTO_ENDPOINT = "https://api.zeptomail.com/v1.1/email";
const DEFAULT_SENDER = "noreply@sautilink.com";
const DEFAULT_SENDER_NAME = "SautiLink";
const REQUEST_TIMEOUT_MS = 8000;

export const COMMUNICATION_CLASSES = Object.freeze({
  AUTH: "auth",
  SECURITY: "security",
  TRANSACTIONAL: "transactional",
  PRODUCT_UPDATES: "product_updates",
});

export const COMMUNICATION_CHANNELS = Object.freeze({
  EMAIL: "email",
  WHATSAPP: "whatsapp",
});

export function communicationStatus(env = {}) {
  const zeptoToken = String(env.ZEPTOMAIL_SEND_TOKEN || "").trim();
  return {
    authEmailTransport: "supabase_custom_smtp",
    transactionalEmailReady: /^Zoho-enczapikey\s+/i.test(zeptoToken) || zeptoToken.length >= 20,
    transactionalEmailProvider: "zeptomail_api",
    whatsappReady: false,
    marketingProviderConfigured: false,
  };
}

export function canUseZeptoMailApiForClass(messageClass) {
  return messageClass === COMMUNICATION_CLASSES.SECURITY || messageClass === COMMUNICATION_CLASSES.TRANSACTIONAL;
}

function validRecipient(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : "";
}

function providerToken(env = {}) {
  const token = String(env.ZEPTOMAIL_SEND_TOKEN || "").trim();
  if (!token) return "";
  return /^Zoho-enczapikey\s+/i.test(token) ? token : `Zoho-enczapikey ${token}`;
}

export async function sendTransactionalEmail(input, env = {}) {
  const messageClass = String(input?.messageClass || "");
  if (!canUseZeptoMailApiForClass(messageClass)) {
    return {
      ok: false,
      status: 400,
      reason: messageClass === COMMUNICATION_CLASSES.PRODUCT_UPDATES
        ? "marketing_provider_required"
        : "unsupported_message_class",
    };
  }

  const to = validRecipient(input?.to);
  const subject = String(input?.subject || "").trim();
  const htmlbody = String(input?.htmlbody || "").trim();
  const textbody = String(input?.textbody || "").trim();
  if (!to || !subject || (!htmlbody && !textbody)) {
    return { ok: false, status: 400, reason: "invalid_message" };
  }

  const authorization = providerToken(env);
  if (!authorization) {
    return { ok: false, status: 503, reason: "zeptomail_not_configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ZEPTO_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({
        from: {
          address: String(env.ZEPTOMAIL_FROM_ADDRESS || DEFAULT_SENDER).trim() || DEFAULT_SENDER,
          name: String(env.ZEPTOMAIL_FROM_NAME || DEFAULT_SENDER_NAME).trim() || DEFAULT_SENDER_NAME,
        },
        to: [{ email_address: { address: to, name: String(input?.toName || "").trim() } }],
        subject,
        ...(htmlbody ? { htmlbody } : {}),
        ...(textbody ? { textbody } : {}),
      }),
    });

    let body = null;
    try { body = await response.json(); } catch { body = null; }
    return {
      ok: response.ok,
      status: response.status,
      provider: "zeptomail",
      requestId: String(body?.request_id || body?.requestId || "") || null,
      reason: response.ok ? undefined : "provider_rejected",
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      provider: "zeptomail",
      reason: error?.name === "AbortError" ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function resolveCommunicationPolicy({ messageClass, channel, profile } = {}) {
  const selectedClass = String(messageClass || "");
  const selectedChannel = String(channel || "");

  if (selectedChannel === COMMUNICATION_CHANNELS.EMAIL) {
    if (selectedClass === COMMUNICATION_CLASSES.AUTH || selectedClass === COMMUNICATION_CLASSES.SECURITY) {
      return { allowed: true, consentRequired: false, reason: "account_security" };
    }
    if (selectedClass === COMMUNICATION_CLASSES.TRANSACTIONAL) {
      return { allowed: true, consentRequired: false, reason: "requested_service" };
    }
    if (selectedClass === COMMUNICATION_CLASSES.PRODUCT_UPDATES) {
      return profile?.email_updates === true
        ? { allowed: true, consentRequired: true, reason: "email_opt_in" }
        : { allowed: false, consentRequired: true, reason: "email_opt_out" };
    }
  }

  if (selectedChannel === COMMUNICATION_CHANNELS.WHATSAPP) {
    const verifiedNumber = typeof profile?.whatsapp_e164 === "string" && /^\+[1-9][0-9]{7,14}$/.test(profile.whatsapp_e164);
    if (!verifiedNumber) return { allowed: false, consentRequired: true, reason: "whatsapp_not_verified" };
    return profile?.whatsapp_updates === true
      ? { allowed: true, consentRequired: true, reason: "whatsapp_opt_in" }
      : { allowed: false, consentRequired: true, reason: "whatsapp_opt_out" };
  }

  return { allowed: false, consentRequired: false, reason: "unsupported_channel" };
}
