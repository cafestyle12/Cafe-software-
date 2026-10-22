# CafeOS Auth & Email Operations

Last audited: 2026-10-22

## Architecture
- Supabase Auth email/password authentication.
- Server actions call Supabase Auth REST endpoints using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Signup callback: `/auth/confirm`; the callback client accepts supported query-token or implicit-flow hash parameters and delegates verification/session setup to server actions.
- Password recovery starts at `/forgot-password`, uses Supabase `/auth/v1/recover`, and should return to the same confirmation callback before reaching the password-update route.
- Resend is a Supabase Auth operation, not a custom mail-sending service.

## Root cause found
Supabase Auth logs recorded `POST /auth/v1/resend` returning HTTP 400 with `validation_failed` and message `Missing one of these types: signup, email_change, sms, phone_change`. The resend handler had placed the type in the JSON body, while the Auth REST endpoint expects it as the query parameter. The branch handler now sends:
- Query: `type=signup` and `redirect_to=<configured-site>/auth/confirm`
- JSON body: `{"email":"<address>" }`

The latest query correction is committed to `phase-02/auth-multitenancy`; a green CI run and a fresh controlled-inbox test are still required before acceptance.

## Provider limits and delivery
Supabase logs also show HTTP 429 `over_email_send_rate_limit` for signup/recovery. The UI must respect cooldown and provider limits. Do not remove rate limiting or promise unlimited sends. For production-scale reliable email, configure a custom SMTP provider supported by Supabase, verify sender identity/domain and DNS records with that provider, then set the SMTP host, port, username, password and sender identity in Supabase Auth settings. Use the provider's exact documented values; none are invented in this document.
Check inbox, spam and promotions. Review Supabase Auth logs and the SMTP provider's delivery/bounce logs. A `mail.send` log event is not proof of inbox delivery.

## Template guidance
In Supabase Dashboard → Authentication → Email Templates (wording may vary):
- Confirmation template: use Supabase's `{{ .ConfirmationURL }}` for a standard verification link, or a correctly implemented `{{ .TokenHash }}` flow that matches the app callback. Do not mix token types or use a localhost redirect in deployed templates.
- Recovery template: use the correct confirmation/recovery URL for the configured callback and recovery type.
- Use a branded HTML design with CafeOS wordmark, concise instructions, a clear primary action button, fallback plain URL, expiry/security note and mobile-friendly responsive layout.
- Preserve valid Supabase template variables and verify a fresh link end-to-end after each change.

## Manual setup still required
1. In Supabase, inspect Authentication → SMTP settings and determine whether custom SMTP is configured; the connected API did not expose this setting.
2. If using custom SMTP, verify the sender address/domain with the provider and publish the provider-specified SPF/DKIM (and DMARC as appropriate) DNS records.
3. Check provider sending quota and the Supabase Auth email rate limits. Increase supported limits only in accordance with provider capacity; do not bypass throttles.
4. Inspect and update confirmation and recovery templates with a branded, tested callback link.
5. Wait for the current cooldown, test once with a controlled inbox, inspect Auth/provider logs, click the fresh link, and confirm the app creates the expected session.
6. Do not share SMTP passwords, service-role keys, confirmation tokens or session tokens in chat or Git.
