# SautiLink Account

SautiLink Account is the shared identity foundation for Cloud Engine and future SautiLink products. Cloud Engine remains usable without an account; account features add optional personal continuity such as saved history and communication preferences.

## Identity model

- Supabase Auth UUID is the durable account identifier.
- Email is an authentication/contact address, not the database primary key.
- `public.account_profiles.username` is a lowercase, globally unique future-facing SautiLink handle.
- `full_name` is profile presentation data.
- Authorization must never use user-editable profile or user-metadata fields.
- Email verification is authoritative from Auth (`email_confirmed_at`), not from a writable profile boolean.

## Signup and verification

1. User submits full name, username, email and password.
2. Product-news email consent is optional and off by default.
3. The account service starts email/password signup.
4. The confirmation email uses `{{ .Token }}` to deliver the configured email OTP. SautiLink currently uses eight digits; the application contract supports Supabase email OTP lengths from 6 to 10 digits.
5. User enters the OTP on `/account/verify`.
6. The server verifies the OTP and establishes an HttpOnly web session.
7. Only after successful verification is the durable `account_profiles` row created.
8. The account dashboard may show a blue check with the explicit label **Email verified** when Auth confirms the address.

The blue check in Cloud Engine is not a public notability or platform-verification badge. Future public SautiLink verification must use a separate model and meaning.

## Username reservation behavior

Unverified signups do not create profile rows, so they cannot indefinitely squat usernames in `account_profiles`. Username availability is checked at signup and again when the verified profile is created. If another verified account claims the handle first, the newly verified user is asked to choose another username before profile setup is completed.

Reserved system names include account, admin, support, security, SautiLink and related product/system identifiers.

## Web session model

The browser calls same-origin `/api/account/*` routes. Pages Functions communicate with the Auth service and keep web access/refresh tokens in cookies with:

- `HttpOnly`
- `Secure`
- `SameSite=Lax`
- `Path=/`

Browser JavaScript never receives or persists access or refresh tokens. Mutating account routes reject a mismatched `Origin` header. Account responses use `Cache-Control: no-store`.

## Profile access

`public.account_profiles` has RLS enabled. Authenticated users may select and update only the row whose `id` matches `auth.uid()`. Anonymous users have no profile-table privileges. Server-only administrative access is used only for bounded identity operations such as verified profile creation and exact username availability checks.

## Communication preferences

- `email_updates` is explicit non-essential product-news consent and defaults to false.
- Transactional/security email does not depend on this marketing preference.
- WhatsApp communication requires a separate verified-number and explicit opt-in flow; it is not collected during initial signup.

## Scan history boundary

Phase 8I does **not** save scan history yet. Existing anonymous scans remain unsaved server-side. The next account phase will add a 30-day rolling scan-history model with account ownership, sanitized result snapshots and automatic expiry.
