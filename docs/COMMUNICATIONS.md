# SautiLink Account Communications

SautiLink Account communication is split by message purpose so authentication, security, transactional service notices, product marketing, and future WhatsApp delivery do not accidentally share the wrong consent or provider rules.

## Channel architecture

### Authentication and account-security email

Owner: Supabase Auth

Delivery transport: ZeptoMail custom SMTP

Sender: `SautiLink <noreply@sautilink.com>`

Examples:

- Confirm sign up
- Invite user
- Magic Link
- Change email verification
- Password recovery
- Reauthentication
- Password changed notification
- Email changed notification
- Sign-in method linked / removed
- Verification method added / removed

These messages are account/security operations. They do not depend on the optional `email_updates` marketing preference.

Supabase Auth remains authoritative for token generation, token validation, confirmation state, password recovery, and security-notification events. Cloud Engine must not recreate those security events in application code.

## Application transactional email

Owner: SautiLink server-side application code

Provider: ZeptoMail REST API

Endpoint: ZeptoMail single transactional email API

Server secret: `ZEPTOMAIL_SEND_TOKEN`

Default sender: `noreply@sautilink.com`

The browser never receives the ZeptoMail token. The token must be configured only as a server-side Cloudflare secret.

The first connected event is the post-verification account notice. Email verification itself succeeds independently of that notice. Pages Functions schedules the optional transactional notice through `context.waitUntil()` so a ZeptoMail API outage does not make a correctly verified SautiLink Account fail.

## Product and ecosystem updates

Examples:

- New SautiLink features
- SautiNote or ecosystem product announcements
- Promotional campaigns

These are explicitly separate from authentication/security/transactional email.

Requirements:

- `account_profiles.email_updates = true`
- A dedicated marketing-capable provider must be selected before delivery is implemented.
- ZeptoMail API must not be used as the marketing/newsletter transport.
- Unsubscribe and preference controls must remain available.

## WhatsApp

WhatsApp delivery is not active in this phase.

A WhatsApp message is not eligible merely because a number has valid E.164 syntax. Delivery requires both:

- a current number with server-owned `whatsapp_verified_at`
- explicit `whatsapp_updates = true`

Changing `whatsapp_e164` automatically clears verification and disables WhatsApp updates. Clients cannot write `whatsapp_verified_at`.

A provider, verification flow, approved message-template policy, and operational limits must be chosen before WhatsApp sending is enabled.

## Message policy

| Message class | Email consent required | Current transport |
| --- | --- | --- |
| Auth | No | Supabase Auth -> ZeptoMail SMTP |
| Security | No | Supabase Auth -> ZeptoMail SMTP; application security messages may use ZeptoMail API only when explicitly implemented |
| Transactional | No | ZeptoMail API |
| Product updates | Yes | Not configured; marketing provider required |
| WhatsApp updates | Yes + verified number | Not configured |

## Source-of-truth templates

Hosted Supabase email templates are configured in the Supabase dashboard. Repository files under `supabase/templates/` are the reviewed source of truth for SautiLink branding and security copy.

Authentication templates:

- `confirmation.html`
- `invite.html`
- `magic_link.html`
- `email_change.html`
- `recovery.html`
- `reauthentication.html`

Security notifications:

- `password_changed_notification.html`
- `email_changed_notification.html`
- `identity_linked_notification.html`
- `identity_unlinked_notification.html`
- `mfa_factor_enrolled_notification.html`
- `mfa_factor_unenrolled_notification.html`

All templates use the first-party logo URL `https://sautilink.com/logo.png` and identify official mail as coming from the `@sautilink.com` domain.

## Production configuration gates

Before Phase 8I is considered live-complete:

1. Configure ZeptoMail custom SMTP in Supabase Auth with `noreply@sautilink.com`.
2. Copy the reviewed repository templates into the matching hosted Supabase Auth template slots.
3. Enable the desired Supabase security notifications at project level.
4. Disable link tracking for authentication emails if the SMTP provider can rewrite single-use authentication URLs.
5. Configure `ZEPTOMAIL_SEND_TOKEN` as a Cloudflare server-side secret only if application transactional email is enabled.
6. Run a live signup -> OTP -> verified account -> login smoke test.

## Privacy and retention

This phase does not introduce a communications outbox, delivery-history table, email-open tracking, click tracking, or marketing audience table. Delivery telemetry should not be persisted until an explicit retention and privacy design is approved.
