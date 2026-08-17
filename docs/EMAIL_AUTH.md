# SautiLink Account Email Authentication

Authentication email is transactional account-security traffic. Cloud Engine uses the Auth email flow and a custom SMTP provider for production delivery.

## Production sender

- Sender name: `SautiLink`
- Sender address: `noreply@sautilink.com`
- Purpose: signup verification, recovery and account-security messages

Do not use authentication SMTP for bulk promotional campaigns. Product-news consent is stored separately and should use an appropriate communications service when that phase is implemented.

## Verification code flow

The Confirm signup template must include the Auth template variable:

```text
{{ .Token }}
```

This produces the configured email OTP entered on `/account/verify` and verified server-side as an email OTP. SautiLink currently uses eight digits. Cloud Engine accepts `SUPABASE_EMAIL_OTP_LENGTH` values from 6 to 10 and defaults to 8 so the UI and API stay aligned with Auth. The repository reference template is `supabase/templates/confirmation.html`.

Recommended subject:

```text
Your SautiLink verification code
```

## ZeptoMail SMTP configuration

The ZeptoMail domain/sender must be verified before production use. Configure the hosted Auth project with the SMTP credentials shown in the ZeptoMail agent dashboard:

- Host: `smtp.zeptomail.com`
- Port: `587`
- Encryption: TLS / STARTTLS
- Username: use the exact SMTP username shown by ZeptoMail (commonly `emailapikey`)
- Password: use the ZeptoMail SMTP password generated for the agent
- Sender name: `SautiLink`
- Sender email: `noreply@sautilink.com`

Never commit the SMTP password, send-mail token, or other ZeptoMail secret to this repository. Copy credentials directly from the provider dashboard into the Auth SMTP settings.

The ZeptoMail HTTP API token is not required for the signup OTP delivery described here.

## Auth configuration checklist

Before enabling production signup:

1. Keep email/password signup enabled.
2. Require email confirmation before normal password sign-in.
3. Configure the Site URL for `https://cloudengine.sautilink.com` and approved redirect URLs.
4. Configure custom SMTP with `noreply@sautilink.com`.
5. Replace the Confirm signup template with the branded OTP template containing `{{ .Token }}`.
6. Use a short OTP lifetime appropriate for account verification; ten minutes is the SautiLink target unless product requirements change.
7. Keep resend/rate limits enabled to reduce abuse.
8. Disable email-link tracking for authentication templates if a mail provider would otherwise rewrite auth links. The signup OTP template itself does not rely on a confirmation link.

## Separation of responsibilities

- Auth generates/verifies the OTP and owns the authoritative email-confirmation timestamp.
- ZeptoMail delivers the transactional message.
- Cloud Engine presents the code-entry UI and proxies account calls over same-origin APIs.
- `account_profiles` stores SautiLink profile/personalisation data, not verification truth or passwords.
