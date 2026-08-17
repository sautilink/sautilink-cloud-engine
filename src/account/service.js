const REQUEST_TIMEOUT_MS = 6000;
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_omJ-5Mem-K4vgm6WLXRzJQ_jeGs65ca";

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "support", "security", "sautilink",
  "cloudengine", "official", "api", "help", "about", "settings", "login",
  "signup", "account",
]);

function config(env = {}) {
  const url = String(env.SUPABASE_URL || "https://rggpyiterdbbugluejcs.supabase.co")
    .trim()
    .replace(/\/$/, "");
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY).trim();
  const secretKey = String(env.SUPABASE_SECRET_KEY || "").trim();
  return {
    url,
    publishableKey,
    secretKey,
    publicReady: /^https:\/\//i.test(url) && publishableKey.startsWith("sb_publishable_"),
    adminReady: /^https:\/\//i.test(url) && secretKey.startsWith("sb_secret_"),
  };
}

async function request(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let body = null;
    const text = await response.text();
    if (text) {
      try { body = JSON.parse(text); } catch { body = { message: text }; }
    }
    return { ok: response.ok, status: response.status, body, response };
  } catch (error) {
    return { ok: false, status: 0, body: null, reason: error?.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(cfg, accessToken) {
  const headers = {
    apikey: cfg.publishableKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function authCall(env, path, options = {}) {
  const cfg = config(env);
  if (!cfg.publicReady) return { ok: false, status: 503, reason: "not_configured" };
  return request(`${cfg.url}/auth/v1/${path}`, {
    ...options,
    headers: {
      ...authHeaders(cfg, options.accessToken),
      ...(options.headers || {}),
    },
  });
}

async function adminRest(env, path, options = {}) {
  const cfg = config(env);
  if (!cfg.adminReady) return { ok: false, status: 503, reason: "admin_not_configured" };
  return request(`${cfg.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: cfg.secretKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
}

async function userRest(env, accessToken, path, options = {}) {
  const cfg = config(env);
  if (!cfg.publicReady) return { ok: false, status: 503, reason: "not_configured" };
  return request(`${cfg.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...authHeaders(cfg, accessToken),
      ...(options.headers || {}),
    },
  });
}

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9][a-z0-9._]{2,29}$/.test(username)) {
    return { ok: false, username, message: "Username must be 3–30 characters and use lowercase letters, numbers, dots, or underscores." };
  }
  if (RESERVED_USERNAMES.has(username)) {
    return { ok: false, username, message: "That username is reserved by SautiLink." };
  }
  return { ok: true, username };
}

export function validateFullName(value) {
  const fullName = String(value || "").trim().replace(/\s+/g, " ");
  return fullName.length >= 1 && fullName.length <= 80
    ? { ok: true, fullName }
    : { ok: false, fullName, message: "Name must be between 1 and 80 characters." };
}

export function validateEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
    ? { ok: true, email }
    : { ok: false, email, message: "Enter a valid email address." };
}

export function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 10) return { ok: false, message: "Use at least 10 characters for your password." };
  if (password.length > 128) return { ok: false, message: "Password is too long." };
  return { ok: true, password };
}

export async function usernameAvailable(username, env) {
  const checked = validateUsername(username);
  if (!checked.ok) return { available: false, invalid: true, message: checked.message };
  const result = await adminRest(
    env,
    `account_profiles?username=eq.${encodeURIComponent(checked.username)}&select=id&limit=1`,
    { method: "GET" }
  );
  if (!result.ok) return { available: null, reason: result.reason || `http_${result.status}` };
  return { available: !Array.isArray(result.body) || result.body.length === 0, username: checked.username };
}

export async function signUpAccount(input, env) {
  const email = validateEmail(input?.email);
  const password = validatePassword(input?.password);
  const username = validateUsername(input?.username);
  const fullName = validateFullName(input?.fullName);
  if (!email.ok || !password.ok || !username.ok || !fullName.ok) {
    return { ok: false, status: 400, reason: "invalid_input", message: email.message || password.message || username.message || fullName.message };
  }

  const availability = await usernameAvailable(username.username, env);
  if (availability.available === false) {
    return { ok: false, status: 409, reason: availability.invalid ? "invalid_username" : "username_taken", message: availability.message || "That username is already taken." };
  }
  if (availability.available == null) {
    return { ok: false, status: 503, reason: "profile_store_unavailable", message: "Account setup is temporarily unavailable." };
  }

  return authCall(env, "signup", {
    method: "POST",
    body: JSON.stringify({
      email: email.email,
      password: password.password,
      data: {
        username: username.username,
        full_name: fullName.fullName,
        email_updates: input?.emailUpdates === true,
      },
    }),
  });
}

export async function verifySignupCode(emailValue, tokenValue, env) {
  const email = validateEmail(emailValue);
  const token = String(tokenValue || "").trim();
  if (!email.ok || !/^\d{6}$/.test(token)) {
    return { ok: false, status: 400, reason: "invalid_code", message: "Enter the 6-digit verification code." };
  }
  const verified = await authCall(env, "verify", {
    method: "POST",
    body: JSON.stringify({ type: "email", email: email.email, token }),
  });
  if (!verified.ok) return verified;

  const user = verified.body?.user;
  if (user?.id) {
    const profile = await bootstrapVerifiedProfile(user, env);
    verified.profile = profile;
  }
  return verified;
}

export async function resendSignupCode(emailValue, env) {
  const email = validateEmail(emailValue);
  if (!email.ok) return { ok: false, status: 400, reason: "invalid_email", message: email.message };
  return authCall(env, "resend", {
    method: "POST",
    body: JSON.stringify({ type: "signup", email: email.email }),
  });
}

export async function loginWithPassword(emailValue, passwordValue, env) {
  const email = validateEmail(emailValue);
  const password = String(passwordValue || "");
  if (!email.ok || !password) return { ok: false, status: 400, reason: "invalid_credentials" };
  return authCall(env, "token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: email.email, password }),
  });
}

export async function refreshSession(refreshToken, env) {
  if (!refreshToken) return { ok: false, status: 401, reason: "missing_refresh_token" };
  return authCall(env, "token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function getAuthUser(accessToken, env) {
  if (!accessToken) return { ok: false, status: 401, reason: "missing_access_token" };
  return authCall(env, "user", { method: "GET", accessToken });
}

export async function logoutSession(accessToken, env) {
  if (!accessToken) return { ok: true, status: 204, body: null };
  return authCall(env, "logout", { method: "POST", accessToken });
}

export async function readOwnProfile(accessToken, env) {
  return userRest(
    env,
    accessToken,
    "account_profiles?select=id,username,full_name,avatar_url,email_updates,whatsapp_e164,whatsapp_updates,created_at,updated_at&limit=1",
    { method: "GET" }
  );
}

export async function updateOwnProfile(userId, accessToken, input, env) {
  const payload = { updated_at: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(input || {}, "fullName")) {
    const name = validateFullName(input.fullName);
    if (!name.ok) return { ok: false, status: 400, reason: "invalid_name", message: name.message };
    payload.full_name = name.fullName;
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, "username")) {
    const username = validateUsername(input.username);
    if (!username.ok) return { ok: false, status: 400, reason: "invalid_username", message: username.message };
    payload.username = username.username;
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, "emailUpdates")) {
    payload.email_updates = input.emailUpdates === true;
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, "whatsappE164")) {
    const phone = String(input.whatsappE164 || "").trim();
    if (phone && !/^\+[1-9][0-9]{7,14}$/.test(phone)) {
      return { ok: false, status: 400, reason: "invalid_whatsapp", message: "Use international WhatsApp format, for example +2557…" };
    }
    payload.whatsapp_e164 = phone || null;
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, "whatsappUpdates")) {
    payload.whatsapp_updates = input.whatsappUpdates === true;
  }

  return userRest(env, accessToken, `account_profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

async function bootstrapVerifiedProfile(user, env) {
  const id = String(user?.id || "");
  const username = validateUsername(user?.user_metadata?.username);
  const fullName = validateFullName(user?.user_metadata?.full_name);
  if (!id || !username.ok || !fullName.ok) {
    return { ok: false, reason: "profile_metadata_invalid" };
  }

  const existing = await adminRest(
    env,
    `account_profiles?id=eq.${encodeURIComponent(id)}&select=id,username&limit=1`,
    { method: "GET" }
  );
  if (existing.ok && Array.isArray(existing.body) && existing.body.length) {
    return { ok: true, existing: true };
  }

  const inserted = await adminRest(env, "account_profiles", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id,
      username: username.username,
      full_name: fullName.fullName,
      email_updates: user?.user_metadata?.email_updates === true,
      whatsapp_updates: false,
    }),
  });
  if (!inserted.ok && inserted.status === 409) {
    return { ok: false, reason: "username_taken_after_verification" };
  }
  return { ok: inserted.ok, reason: inserted.ok ? undefined : inserted.reason || `http_${inserted.status}` };
}

export function accountServiceStatus(env) {
  const cfg = config(env);
  return { publicReady: cfg.publicReady, adminReady: cfg.adminReady };
}
