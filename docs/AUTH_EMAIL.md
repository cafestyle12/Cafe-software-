# CafeOS Auth & Email Operations

Last audited: 2026-10-22

## Architecture
- Supabase Auth email/password authentication.
- Server actions call Supabase Auth REST endpoints using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Signup and recovery callbacks use `/auth/confirm?token_hash=...&type=signup|recovery`; the callback verifies the single-use token hash server-side and creates the CafeOS HttpOnly session.
- Password recovery verifies with type `recovery`, then routes to `/reset-password`.
- Resend is a Supabase Auth operation, not a custom mail-sending service.

## Confirmation-link failure and mitigation
The callback accepts Supabase token-hash query parameters and implicit-flow access/refresh tokens. A raw `?code=...` callback is not supported by this custom REST flow; avoid templates that send users through a PKCE code callback. Use the supplied `supabase/templates/confirmation.html` and `supabase/templates/recovery.html` templates, which link directly to CafeOS with Supabase's `{{ .TokenHash }}` and the appropriate `type`. The callback calls `/auth/v1/verify` with that token hash and type.

The confirmation client also guards against duplicate verification attempts and provides a clearer path to request a fresh link. Supabase links are single-use; after a link has expired or been used, request a new email rather than re-opening the old link.

## Resend endpoint correction
Supabase Auth logs recorded `POST /auth/v1/resend` returning HTTP 400 with `validation_failed` and a message indicating that the resend type was missing. The Auth REST endpoint expects `type=signup` in the query, not the JSON body. The handler now sends:
- Query: `type=signup` and `redirect_to=<configured-site>/auth/confirm`
- JSON body: `{"email":"<address>" }`

## Branded templates — required dashboard step
The repository now includes:
- `supabase/templates/confirmation.html`
- `supabase/templates/recovery.html`

To activate them, open Supabase Dashboard → Authentication → Email Templates:
1. Open **Confirm signup** and paste the contents of `supabase/templates/confirmation.html` into its HTML/message editor.
2. Open **Reset password** and paste `supabase/templates/recovery.html`.
3. Set the Supabase Auth Site URL to the actual deployed CafeOS origin and allow that origin's `/auth/confirm` callback in redirect URL settings.
4. Ensure the template variables `{{ .SiteURL }}` and `{{ .TokenHash }}` remain unchanged. The templates intentionally link directly to the app callback using the token hash and matching type.
5. Save and test with a newly requested email. Do not reuse an old token or expose token values in logs/screenshots.

The templates use a responsive CafeOS green-and-cream visual system, a clear primary action, a visible fallback link, and expiry/security guidance. They are source templates; committing them to Git does not automatically update the Supabase Dashboard's email templates.

## Provider limits and delivery
Supabase logs previously showed HTTP 429 `over_email_send_rate_limit` for signup/recovery. Respect cooldown and provider limits; do not remove rate limiting or promise unlimited sends. For production-scale delivery, configure a supported custom SMTP provider in Supabase, verify sender identity/domain and publish the provider's required DNS records. SMTP credentials and sender configuration are not managed by this repository.

Check inbox, spam and promotions. Review Supabase Auth logs and the SMTP provider's delivery/bounce logs. A `mail.send` log event is not proof of inbox delivery.

## Acceptance checklist
1. Wait for any active email cooldown to expire.
2. Request one fresh signup confirmation to a controlled inbox and click the newest link once.
3. Verify it lands on `/welcome` with a valid authenticated session; then sign out and sign in again.
4. Request one recovery email, click the newest link, confirm `/reset-password` opens, and complete a password change.
5. Check Auth/provider logs for send, bounce, throttling, and verification errors.
6. If delivery fails, verify SMTP settings, sender identity, domain DNS, quotas, Site URL, redirect allowlist, and the saved Dashboard templates.

Never commit or share SMTP passwords, service-role keys, confirmation tokens, or session tokens.


## Latest delivery investigation — 2026-10-22
- Supabase Auth logs show a `mail.send` event for a confirmation message from the default sender `noreply@mail.app.supabase.io`. This proves Supabase attempted/sent through its mail pipeline, not that the message reached the inbox.
- Recovery requests returned HTTP 429 `over_email_send_rate_limit`; repeated requests will not fix delivery and can extend the cooldown. Wait for the limit to reset before one controlled test.
- Logs also show repeated signup events for an existing account. Supabase may respond successfully without sending another confirmation email for an already-registered address. The app now detects the documented empty-`identities` response and directs the user to **Resend confirmation** rather than treating another signup as a new account.
- For reliable inbox delivery, the project owner must configure supported custom SMTP in Supabase Auth settings, verify the sender/domain, and publish the provider's required DNS records. The available connected management tools do not expose writable SMTP/template settings, and no SMTP credentials were supplied. Do not claim this provider-side step is complete until verified.
