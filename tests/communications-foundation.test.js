import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COMMUNICATION_CLASSES,
  COMMUNICATION_CHANNELS,
  canUseZeptoMailApiForClass,
  communicationStatus,
  resolveCommunicationPolicy,
  sendTransactionalEmail,
} from "../src/communications/index.js";
import { accountVerifiedEmail } from "../src/communications/templates.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const handler = read("functions/api/account/[[path]].js");
const communicationsDoc = read("docs/COMMUNICATIONS.md");
const whatsappMigration = read("supabase/migrations/20260817135750_add_account_whatsapp_verification_guard.sql");
const templatePaths = [
  "supabase/templates/confirmation.html",
  "supabase/templates/invite.html",
  "supabase/templates/magic_link.html",
  "supabase/templates/email_change.html",
  "supabase/templates/recovery.html",
  "supabase/templates/reauthentication.html",
  "supabase/templates/password_changed_notification.html",
  "supabase/templates/email_changed_notification.html",
  "supabase/templates/identity_linked_notification.html",
  "supabase/templates/identity_unlinked_notification.html",
  "supabase/templates/mfa_factor_enrolled_notification.html",
  "supabase/templates/mfa_factor_unenrolled_notification.html",
];

test("ZeptoMail API is reserved for security and transactional app messages", () => {
  assert.equal(canUseZeptoMailApiForClass(COMMUNICATION_CLASSES.SECURITY), true);
  assert.equal(canUseZeptoMailApiForClass(COMMUNICATION_CLASSES.TRANSACTIONAL), true);
  assert.equal(canUseZeptoMailApiForClass(COMMUNICATION_CLASSES.AUTH), false);
  assert.equal(canUseZeptoMailApiForClass(COMMUNICATION_CLASSES.PRODUCT_UPDATES), false);
});

test("public communication status does not claim hosted SMTP configuration", () => {
  const status = communicationStatus({});
  assert.equal(status.authEmailTransport, "supabase_auth");
  assert.equal(status.transactionalEmailReady, false);
});

test("product updates cannot accidentally use ZeptoMail transactional API", async () => {
  let fetched = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetched = true; throw new Error("should not fetch"); };
  try {
    const result = await sendTransactionalEmail({
      messageClass: COMMUNICATION_CLASSES.PRODUCT_UPDATES,
      to: "user@example.com",
      subject: "Product news",
      textbody: "News",
    }, { ZEPTOMAIL_SEND_TOKEN: "secret-token-that-should-not-be-used" });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "marketing_provider_required");
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("communication consent policy separates security, marketing, and WhatsApp", () => {
  assert.equal(resolveCommunicationPolicy({
    messageClass: COMMUNICATION_CLASSES.SECURITY,
    channel: COMMUNICATION_CHANNELS.EMAIL,
    profile: { email_updates: false },
  }).allowed, true);

  assert.equal(resolveCommunicationPolicy({
    messageClass: COMMUNICATION_CLASSES.PRODUCT_UPDATES,
    channel: COMMUNICATION_CHANNELS.EMAIL,
    profile: { email_updates: false },
  }).allowed, false);

  assert.equal(resolveCommunicationPolicy({
    messageClass: COMMUNICATION_CLASSES.PRODUCT_UPDATES,
    channel: COMMUNICATION_CHANNELS.EMAIL,
    profile: { email_updates: true },
  }).allowed, true);

  assert.equal(resolveCommunicationPolicy({
    messageClass: COMMUNICATION_CLASSES.PRODUCT_UPDATES,
    channel: COMMUNICATION_CHANNELS.WHATSAPP,
    profile: { whatsapp_e164: "+255712345678", whatsapp_updates: true },
  }).allowed, false);

  assert.equal(resolveCommunicationPolicy({
    messageClass: COMMUNICATION_CLASSES.PRODUCT_UPDATES,
    channel: COMMUNICATION_CHANNELS.WHATSAPP,
    profile: { whatsapp_e164: "+255712345678", whatsapp_verified_at: "2026-08-17T13:00:00Z", whatsapp_updates: true },
  }).allowed, true);
});

test("WhatsApp verification is server-owned and resets when the number changes", () => {
  assert.match(whatsappMigration, /whatsapp_verified_at timestamptz/i);
  assert.match(whatsappMigration, /revoke update on table public\.account_profiles from authenticated/i);
  assert.match(whatsappMigration, /grant update \(username, full_name, avatar_url, email_updates, whatsapp_e164, whatsapp_updates, updated_at\)/i);
  assert.doesNotMatch(whatsappMigration, /grant update \([^)]*whatsapp_verified_at/i);
  assert.match(whatsappMigration, /new\.whatsapp_verified_at := null/i);
  assert.match(whatsappMigration, /new\.whatsapp_updates := false/i);
});

test("verified account transactional notice is post-response and fail-open", () => {
  assert.match(handler, /context\.waitUntil\(/);
  assert.match(handler, /sendTransactionalEmail\(/);
  assert.match(handler, /COMMUNICATION_CLASSES\.TRANSACTIONAL/);
  assert.match(handler, /\.catch\(\(\) => null\)/);
  assert.doesNotMatch(handler, /ZEPTOMAIL_SEND_TOKEN\s*=/);
});

test("account verified message is transactional, branded, and does not imply marketing consent", () => {
  const message = accountVerifiedEmail({ fullName: "Charles Alex", username: "charles" });
  assert.match(message.subject, /verified/i);
  assert.match(message.htmlbody, /https:\/\/sautilink\.com\/logo\.png/);
  assert.match(message.htmlbody, /noreply@sautilink\.com/);
  assert.match(message.htmlbody, /not a marketing email/i);
  assert.match(message.textbody, /@charles/);
});

test("all reviewed auth and security templates use first-party SautiLink identity", () => {
  for (const path of templatePaths) {
    const html = read(path);
    assert.match(html, /https:\/\/sautilink\.com\/logo\.png/);
    assert.match(html, /SautiLink Corporation/);
    assert.match(html, /noreply@sautilink\.com/);
    assert.match(html, /@sautilink\.com/);
    assert.doesNotMatch(html, /raw\.githubusercontent\.com/i);
  }
});

test("auth templates use the expected Supabase token variables", () => {
  assert.match(read("supabase/templates/confirmation.html"), /\{\{ \.Token \}\}/);
  assert.match(read("supabase/templates/email_change.html"), /\{\{ \.Token \}\}/);
  assert.match(read("supabase/templates/email_change.html"), /\{\{ \.NewEmail \}\}/);
  assert.match(read("supabase/templates/reauthentication.html"), /\{\{ \.Token \}\}/);
  assert.match(read("supabase/templates/invite.html"), /\{\{ \.ConfirmationURL \}\}/);
  assert.match(read("supabase/templates/magic_link.html"), /\{\{ \.ConfirmationURL \}\}/);
  assert.match(read("supabase/templates/recovery.html"), /\{\{ \.ConfirmationURL \}\}/);
  assert.match(read("supabase/templates/email_changed_notification.html"), /\{\{ \.OldEmail \}\}/);
  assert.match(read("supabase/templates/email_changed_notification.html"), /\{\{ \.Email \}\}/);
  assert.match(read("supabase/templates/identity_linked_notification.html"), /\{\{ \.Provider \}\}/);
  assert.match(read("supabase/templates/mfa_factor_enrolled_notification.html"), /\{\{ \.FactorType \}\}/);
});

test("communications documentation preserves provider and consent boundaries", () => {
  assert.match(communicationsDoc, /Supabase Auth -> ZeptoMail SMTP/);
  assert.match(communicationsDoc, /ZeptoMail API must not be used as the marketing\/newsletter transport/i);
  assert.match(communicationsDoc, /whatsapp_verified_at/);
  assert.match(communicationsDoc, /does not introduce a communications outbox/i);
});
