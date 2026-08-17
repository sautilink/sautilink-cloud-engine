import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeUsername,
  validateEmail,
  validateFullName,
  validatePassword,
  validateUsername,
} from "../src/account/service.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const handler = read("functions/api/account/[[path]].js");
const browser = read("public/account/account.js");
const dashboard = read("public/account/index.html");
const signup = read("public/account/signup.html");
const verify = read("public/account/verify.html");
const login = read("public/account/login.html");
const migration = read("supabase/migrations/20260817064949_create_sautilink_account_profiles.sql");
const deferMigration = read("supabase/migrations/20260817065148_defer_account_profile_until_email_verification.sql");
const template = read("supabase/templates/confirmation.html");

const accountPages = [dashboard, signup, verify, login];

test("SautiLink Account validates future-facing usernames and profile input", () => {
  assert.equal(normalizeUsername(" Charles.Alex "), "charles.alex");
  assert.equal(validateUsername("charles_alex").ok, true);
  assert.equal(validateUsername("admin").ok, false);
  assert.equal(validateUsername("UPPERCASE").username, "uppercase");
  assert.equal(validateFullName("Charles Alex").ok, true);
  assert.equal(validateEmail("user@example.com").ok, true);
  assert.equal(validatePassword("1234567890").ok, true);
  assert.equal(validatePassword("short").ok, false);
});

test("account profile schema is auth-owned and protected by RLS", () => {
  assert.match(migration, /id uuid primary key references auth\.users\(id\) on delete cascade/i);
  assert.match(migration, /alter table public\.account_profiles enable row level security/i);
  assert.match(migration, /revoke all on table public\.account_profiles from anon/i);
  assert.match(migration, /for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = id\)/i);
  assert.match(migration, /for update\s+to authenticated[\s\S]*with check \(\(select auth\.uid\(\)\) = id\)/i);
});

test("unverified signups do not permanently reserve profile usernames", () => {
  assert.match(deferMigration, /drop trigger if exists on_auth_user_created_sautilink_account/i);
  assert.match(deferMigration, /Rows are created only after successful email verification/i);
});

test("account sessions use secure HttpOnly cookies and rotate refresh sessions", () => {
  assert.match(handler, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(handler, /sl_ce_access/);
  assert.match(handler, /sl_ce_refresh/);
  assert.match(handler, /refreshSession\(refresh, env\)/);
  assert.match(handler, /Cache-Control": "no-store"/);
  assert.doesNotMatch(handler, /localStorage/);
});

test("mutating account routes enforce same-origin requests", () => {
  assert.match(handler, /sameOriginAllowed\(request\)/);
  assert.match(handler, /ORIGIN_NOT_ALLOWED/);
  assert.match(handler, /\["POST", "PATCH", "PUT", "DELETE"\]/);
});

test("signup verification is a six-digit email OTP and profile bootstrap follows verification", () => {
  const service = read("src/account/service.js");
  assert.match(service, /\^\\d\{6\}\$/);
  assert.match(service, /body: JSON\.stringify\(\{ type: "email", email: email\.email, token \}\)/);
  assert.match(service, /const profile = await bootstrapVerifiedProfile\(user, env\)/);
  assert.match(handler, /route === "verify"/);
  assert.match(handler, /profileReady/);
});

test("verified profile completion handles a post-verification username race", () => {
  const service = read("src/account/service.js");
  assert.match(service, /setupVerifiedProfile/);
  assert.match(service, /email_confirmed_at/);
  assert.match(service, /username_taken/);
  assert.match(handler, /route === "profile\/setup"/);
});

test("browser account code uses only same-origin account APIs and stores no auth tokens", () => {
  assert.match(browser, /fetch\(`\/api\/account\/\$\{path\}`/);
  assert.doesNotMatch(browser, /supabase\.co/i);
  assert.doesNotMatch(browser, /sb_publishable_/i);
  assert.doesNotMatch(browser, /access_token|refresh_token/i);
  assert.doesNotMatch(browser, /localStorage/);
  assert.match(browser, /sessionStorage\.setItem\(PENDING_EMAIL_KEY, email\)/);
});

test("signup keeps ecosystem email updates optional and off by default", () => {
  assert.match(signup, /id="email-updates"[^>]*type="checkbox"/i);
  assert.doesNotMatch(signup, /id="email-updates"[^>]*checked/i);
  assert.match(signup, /optional SautiLink ecosystem product news/i);
});

test("verification UI is a six-digit code workflow with resend", () => {
  const digitInputs = verify.match(/aria-label="Digit [1-6]"/g) || [];
  assert.equal(digitInputs.length, 6);
  assert.match(verify, /id="resend-code"/);
  assert.match(browser, /Resend in \$\{left\}s/);
});

test("account dashboard blue check means Email verified, not public notability", () => {
  assert.match(dashboard, /id="verified-badge"[^>]*title="Email verified"[^>]*aria-label="Email verified"/i);
  assert.match(dashboard, /id="verified-chip"[^>]*>✓ Email verified</i);
  assert.match(browser, /verifiedBadge\.hidden = !me\.emailVerified/);
  assert.match(browser, /securityState\.textContent = me\.emailVerified \? "Verified" : "Unverified"/);
});

test("account pages preserve the self-hosted Manrope product contract", () => {
  for (const html of accountPages) {
    assert.match(html, /Manrope-Variable\.woff2\?v=1/);
    assert.match(html, /typography-manrope\.css\?v=1/);
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/i);
  }
});

test("signup email template delivers the Auth six-digit token with official SautiLink branding", () => {
  assert.match(template, /\{\{ \.Token \}\}/);
  assert.match(template, /Verify your email/);
  assert.match(template, /raw\.githubusercontent\.com\/sautilink\/sautilink\/bd4ba79b05989c1a8b68d40f0e368c17f3d33a92\/assets\/logo\.png/i);
  assert.match(template, /Never share this verification code or your password/i);
  assert.match(template, /Official SautiLink email addresses use the <strong>@sautilink\.com<\/strong> domain/i);
  assert.match(template, /noreply@sautilink\.com/i);
  assert.match(template, /Uhuru Street/i);
  assert.match(template, /Mwanza, Tanzania/i);
  assert.match(template, /SautiLink Corporation/);
  assert.doesNotMatch(template, /ConfirmationURL/);
});

test("homepage exposes SautiLink Account while anonymous scanning remains allowed", () => {
  const home = read("public/index.html");
  assert.match(home, /href="\/account\/login"[^>]*>Account</);
  assert.match(home, />No account required</);
});
