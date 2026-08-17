import {
  accountServiceStatus,
  getAuthUser,
  loginWithPassword,
  logoutSession,
  readOwnProfile,
  refreshSession,
  resendSignupCode,
  signUpAccount,
  updateOwnProfile,
  usernameAvailable,
  verifySignupCode,
} from "../../../src/account/service.js";
import { API_SECURITY_HEADERS } from "../../../src/utils/security.js";
import { getRequestId } from "../../../src/utils/request.js";

const ACCESS_COOKIE = "sl_ce_access";
const REFRESH_COOKIE = "sl_ce_refresh";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
const MAX_BODY_BYTES = 16 * 1024;

function routeName(context) {
  const value = context.params?.path;
  if (Array.isArray(value)) return value.join("/");
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function cookieMap(request) {
  const raw = request.headers.get("Cookie") || "";
  const map = new Map();
  raw.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) map.set(key, decodeURIComponent(value));
  });
  return map;
}

function sessionCookies(body) {
  const access = String(body?.access_token || "");
  const refresh = String(body?.refresh_token || "");
  if (!access || !refresh) return [];
  const accessAge = Math.max(60, Number(body?.expires_in) || 3600);
  return [
    `${ACCESS_COOKIE}=${encodeURIComponent(access)}; Path=/; Max-Age=${accessAge}; HttpOnly; Secure; SameSite=Lax`,
    `${REFRESH_COOKIE}=${encodeURIComponent(refresh)}; Path=/; Max-Age=${REFRESH_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
  ];
}

function clearCookies() {
  return [
    `${ACCESS_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    `${REFRESH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  ];
}

function json(body, status = 200, requestId, cookies = []) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...API_SECURITY_HEADERS,
  });
  if (requestId) headers.set("X-Request-Id", requestId);
  cookies.forEach((value) => headers.append("Set-Cookie", value));
  return new Response(JSON.stringify(body), { status, headers });
}

function ok(data, requestId, status = 200, cookies = []) {
  return json({ success: true, data }, status, requestId, cookies);
}

function fail(code, message, status, requestId, cookies = []) {
  return json({ success: false, error: { code, message }, requestId }, status, requestId, cookies);
}

function providerMessage(result, fallback) {
  const message = String(result?.body?.msg || result?.body?.message || result?.body?.error_description || "").trim();
  if (/already registered/i.test(message)) return "An account already exists for this email address.";
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Verify your email before signing in.";
  if (/token.*expired|expired.*token|invalid.*token/i.test(message)) return "That verification code is invalid or has expired.";
  if (/rate limit/i.test(message)) return "Too many requests. Please try again shortly.";
  return fallback;
}

function sameOriginAllowed(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

async function bodyJson(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) return { ok: false, reason: "too_large" };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return { ok: false, reason: "too_large" };
    return { ok: true, value: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

async function authenticatedSession(request, env) {
  const cookies = cookieMap(request);
  const access = cookies.get(ACCESS_COOKIE) || "";
  const refresh = cookies.get(REFRESH_COOKIE) || "";
  if (access) {
    const user = await getAuthUser(access, env);
    if (user.ok && user.body?.id) return { ok: true, access, user: user.body, cookies: [] };
  }
  if (!refresh) return { ok: false, status: 401, reason: "not_authenticated", cookies: clearCookies() };

  const refreshed = await refreshSession(refresh, env);
  if (!refreshed.ok || !refreshed.body?.access_token) {
    return { ok: false, status: 401, reason: "session_expired", cookies: clearCookies() };
  }
  const user = refreshed.body.user || (await getAuthUser(refreshed.body.access_token, env)).body;
  if (!user?.id) return { ok: false, status: 401, reason: "session_expired", cookies: clearCookies() };
  return {
    ok: true,
    access: refreshed.body.access_token,
    user,
    cookies: sessionCookies(refreshed.body),
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const requestId = getRequestId(request);
  const route = routeName(context);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: API_SECURITY_HEADERS });
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method) && !sameOriginAllowed(request)) {
    return fail("ORIGIN_NOT_ALLOWED", "Cross-origin account changes are not allowed.", 403, requestId);
  }

  if (route === "status" && method === "GET") {
    const status = accountServiceStatus(env);
    return ok({ available: status.publicReady && status.adminReady }, requestId);
  }

  if (route === "username" && method === "GET") {
    const username = new URL(request.url).searchParams.get("username") || "";
    const result = await usernameAvailable(username, env);
    if (result.invalid) return fail("INVALID_USERNAME", result.message, 400, requestId);
    if (result.available == null) return fail("ACCOUNT_SERVICE_UNAVAILABLE", "Account setup is temporarily unavailable.", 503, requestId);
    return ok({ username: result.username, available: result.available }, requestId);
  }

  if (route === "signup" && method === "POST") {
    const parsed = await bodyJson(request);
    if (!parsed.ok) return fail("INVALID_REQUEST", parsed.reason === "too_large" ? "Request is too large." : "Invalid JSON body.", 400, requestId);
    const result = await signUpAccount(parsed.value, env);
    if (!result.ok) {
      const code = result.reason === "username_taken" ? "USERNAME_TAKEN" : result.reason === "invalid_input" ? "INVALID_SIGNUP" : "SIGNUP_FAILED";
      return fail(code, result.message || providerMessage(result, "Unable to create this account."), result.status || 400, requestId);
    }
    return ok({ verificationRequired: true, email: String(parsed.value?.email || "").trim().toLowerCase() }, requestId, 201);
  }

  if (route === "verify" && method === "POST") {
    const parsed = await bodyJson(request);
    if (!parsed.ok) return fail("INVALID_REQUEST", "Invalid verification request.", 400, requestId);
    const result = await verifySignupCode(parsed.value?.email, parsed.value?.code, env);
    if (!result.ok || !result.body?.access_token) {
      return fail("VERIFICATION_FAILED", result.message || providerMessage(result, "That verification code could not be verified."), result.status || 400, requestId);
    }
    const profileReady = result.profile?.ok === true;
    const profileIssue = result.profile?.reason || null;
    return ok({
      verified: true,
      profileReady,
      profileIssue,
      next: profileReady ? "/account/" : "/account/?setup=profile",
    }, requestId, 200, sessionCookies(result.body));
  }

  if (route === "resend" && method === "POST") {
    const parsed = await bodyJson(request);
    if (!parsed.ok) return fail("INVALID_REQUEST", "Invalid resend request.", 400, requestId);
    const result = await resendSignupCode(parsed.value?.email, env);
    if (!result.ok) return fail("RESEND_FAILED", providerMessage(result, "Unable to send another verification code yet."), result.status || 400, requestId);
    return ok({ sent: true }, requestId);
  }

  if (route === "login" && method === "POST") {
    const parsed = await bodyJson(request);
    if (!parsed.ok) return fail("INVALID_REQUEST", "Invalid login request.", 400, requestId);
    const result = await loginWithPassword(parsed.value?.email, parsed.value?.password, env);
    if (!result.ok || !result.body?.access_token) {
      return fail("LOGIN_FAILED", providerMessage(result, "Unable to sign in."), result.status === 400 ? 401 : (result.status || 401), requestId);
    }
    return ok({ signedIn: true, next: "/account/" }, requestId, 200, sessionCookies(result.body));
  }

  if (route === "logout" && method === "POST") {
    const cookies = cookieMap(request);
    await logoutSession(cookies.get(ACCESS_COOKIE), env);
    return ok({ signedOut: true }, requestId, 200, clearCookies());
  }

  if (route === "me" && method === "GET") {
    const session = await authenticatedSession(request, env);
    if (!session.ok) return fail("NOT_AUTHENTICATED", "Sign in to continue.", 401, requestId, session.cookies);
    const user = session.user;
    return ok({
      id: user.id,
      email: user.email || "",
      emailVerified: Boolean(user.email_confirmed_at),
      emailVerifiedAt: user.email_confirmed_at || null,
      createdAt: user.created_at || null,
    }, requestId, 200, session.cookies);
  }

  if (route === "profile" && method === "GET") {
    const session = await authenticatedSession(request, env);
    if (!session.ok) return fail("NOT_AUTHENTICATED", "Sign in to continue.", 401, requestId, session.cookies);
    const result = await readOwnProfile(session.access, env);
    if (!result.ok) return fail("PROFILE_UNAVAILABLE", "Unable to load your SautiLink Account profile.", result.status || 500, requestId, session.cookies);
    const profile = Array.isArray(result.body) ? result.body[0] || null : null;
    return ok({ profile }, requestId, 200, session.cookies);
  }

  if (route === "profile" && method === "PATCH") {
    const session = await authenticatedSession(request, env);
    if (!session.ok) return fail("NOT_AUTHENTICATED", "Sign in to continue.", 401, requestId, session.cookies);
    const parsed = await bodyJson(request);
    if (!parsed.ok) return fail("INVALID_REQUEST", "Invalid profile update.", 400, requestId, session.cookies);
    const result = await updateOwnProfile(session.user.id, session.access, parsed.value, env);
    if (!result.ok) {
      const message = result.status === 409 ? "That username is already taken." : (result.message || "Unable to update your profile.");
      return fail(result.status === 409 ? "USERNAME_TAKEN" : "PROFILE_UPDATE_FAILED", message, result.status || 400, requestId, session.cookies);
    }
    const profile = Array.isArray(result.body) ? result.body[0] || null : null;
    return ok({ profile }, requestId, 200, session.cookies);
  }

  return fail("NOT_FOUND", "The requested account endpoint does not exist.", 404, requestId);
}
