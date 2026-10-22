# CafeOS Authentication — Phase 02 Restaurant Credentials

Last updated: 2026-10-22

## Supported identity model

Supabase Auth password authentication supports email/password or phone/password; it does not natively accept a custom Restaurant ID as a username. CafeOS therefore keeps Supabase Auth as the password verifier/session issuer and resolves Restaurant ID on the server.

- Each owner receives a stable Restaurant ID in the CAFE-XXXX-XXXXXXXX format. IDs contain 48 bits of random material and have a database unique constraint; collisions fail safely.
- Provisioning generates a random 128-bit internal email alias such as <32 lowercase hex chars>@auth.cafeos.invalid. The .invalid special-use domain is deliberately non-deliverable; it is not a real customer address and is never displayed to the browser or owner.
- The internal alias is stored only in public.restaurant_auth_accounts, which has RLS enabled and no privileges for anon/authenticated. Only the server-side Supabase secret can query it.
- Supabase's supported Admin API creates the user with email_confirm: true and a random temporary password. This avoids a confirmation email for provisioned accounts without changing the project's global email-confirmation setting.
- Public signup, email recovery, resend-confirmation action and the old confirmation callback are removed from the UI/code path. Existing member email invitations are disabled because they depended on email-based authentication; existing rows are preserved, not deleted.
- Passwords are never written to the application database. Supabase Auth stores/verifies the password hash. Temporary passwords are returned only in the successful provisioning response; the app does not persist them or log them.

## Platform administrator bootstrap

The /platform-admin page is restricted by a server-only CAFEOS_PLATFORM_ADMIN_TOKEN (at least 32 random characters) and an HttpOnly, Secure-in-production, SameSite=Strict, one-hour cookie. It is a controlled bootstrap mechanism, not a public default account. Rotate the token if an administrator device is lost.

Required server-only Vercel Preview variables:
- SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY
- CAFEOS_PLATFORM_ADMIN_TOKEN
- Optional CAFEOS_RATE_LIMIT_SECRET (otherwise the server-only Supabase secret salts rate-limit keys)

Never use NEXT_PUBLIC_ for these values. Do not paste them into chat, source files, GitHub issues or logs. The platform administrator must set these variables in Vercel before provisioning/login can work.

## Provisioning, resets and account status

1. Administrator enters restaurant name, first branch name and owner name.
2. Server generates Restaurant ID, a 24-byte random temporary password plus guaranteed complexity characters, and an internal alias.
3. Server creates the Auth user through POST /auth/v1/admin/users, then calls the restricted admin_provision_restaurant RPC. If the database operation fails, the newly created Auth user is deleted as rollback.
4. The database RPC creates the tenant, first branch, owner membership/role (via the existing tenant trigger), branch membership, mapping row and audit event transactionally.
5. Owner logs in with Restaurant ID/password. Login is rate-limited in the database by hashed Restaurant ID and IP keys; five attempts are allowed, and the next attempt is blocked for 15 minutes. Errors do not reveal whether the Restaurant ID exists.
6. First login is forced to /change-password. Middleware and the tenant RLS helper deny ordinary workspace access while must_change_password is true.
7. Password change validates the new password server-side, updates Auth password and app metadata through the Admin API, then clears the database first-login flag. If the database update fails, RLS remains closed.
8. Later password changes require the current password to reauthenticate. Global sign-out is requested after change and the browser cookies are cleared.
9. Lost passwords are reset by the platform administrator. The mapping row is marked must_change_password before the Auth password update, so a partial failure fails closed. The temporary password is displayed briefly in the protected admin page and should be handed directly to the owner.
10. Suspend/deactivate updates the mapping and tenant status in a restricted database RPC and updates Auth app metadata. RLS checks tenant status and the mapping row, so the tenant data remains inaccessible if metadata refresh fails.

## Existing accounts and migration risk

The currently inspected database has two profiles rows but zero tenant rows. Existing Auth users are not deleted or silently converted. Accounts without a restaurant_auth_accounts mapping cannot use Restaurant ID login; if they are intended to own a restaurant, provision a new restaurant credential account through the administrator workflow. Existing business data is preserved. Do not backfill or delete old users without an explicit mapping plan.

The existing membership-invitation email flow is disabled at the action boundary because the new login model does not resolve arbitrary email identities. Pending invitation records are preserved for audit/history, but cannot be accepted through the removed confirmation callback.

## Provider configuration

The global Supabase Auth email-confirmation setting has not been changed. The new owner workflow uses the supported Admin API with email_confirm: true; no confirmation/recovery email is required for the new Restaurant ID login. This is preferable to blindly disabling email confirmation project-wide. Verify behavior after setting the required server secret by provisioning a controlled test restaurant.

## Security notes

- Browser code only sees the publishable key; all admin API and mapping queries run server-side.
- Restaurant ID is an identifier, not authorization. A valid Supabase session, active membership, active tenant and RLS predicates are still required.
- restaurant_auth_accounts and auth_attempt_windows are not granted to public roles.
- SQL admin RPCs are executable only by service_role, not anon or authenticated.
- The platform admin bootstrap token is a shared administrative secret; protect it like a password and rotate it after suspected exposure.
- No production deployment or main-branch merge is authorized by this change.


## Current approved architecture — Restaurant ID + password (2026-10-22)

Supabase Auth's password grant is based on an email or phone identity; it does not provide native arbitrary username/password sign-in. CafeOS therefore resolves the submitted Restaurant ID on the server using the restricted `restaurant_auth_accounts` mapping, then authenticates against Supabase Auth using the mapped internal identity and submitted password. The browser never receives the mapped identity or a privileged key.

- The internal identity is generated from 128 random bits and uses the reserved `.invalid` domain (`<random>@auth.cafeos.invalid`), which is explicitly non-deliverable. It is not a user-supplied email and is never shown in the UI. Restaurant ID uniqueness and alias uniqueness are enforced by database constraints.
- Provisioning uses the supported Supabase Auth Admin API to create the user with `email_confirm: true`; this marks the internal identity confirmed without requiring a confirmation email. The project-wide email-confirmation setting is deliberately left unchanged because it may affect unrelated Auth users and is not required by this controlled provisioning flow.
- No public signup, email recovery, resend-confirmation or email-confirmation callback is part of the restaurant-owner UI. The owner receives Restaurant ID and a high-entropy temporary password through a one-time administrator response.
- Password change requires reauthentication using the current/temporary password, requires the new password to differ, updates Auth before clearing the mapping flag, and globally signs out the current user's sessions. The Auth metadata and mapping remain restrictive until the next successful login. RLS checks both the authoritative mapping and the signed `app_metadata.must_change_password` claim to fail closed during partial failures.
- Provisioning, administrator resets, status changes and password changes rotate the database-backed `session_version`; the Auth metadata is kept aligned with it. HttpOnly session-version cookies and middleware reject stale tokens instead of silently refreshing them into a new session.\n- The platform admin route requires a server-only `CAFEOS_PLATFORM_ADMIN_TOKEN` and server-only Supabase secret. Never expose either to browser code or source control.

## Migration and acceptance status

The additive migration `20261022091308_phase_02_restaurant_id_auth` is applied to the selected Supabase project. The additional additive migration at `supabase/migrations/20261022151000_phase_02_auth_first_login_claim_guard.sql` strengthens RLS against stale/partial first-login state while preserving the live `session_version` predicate. Supabase migration history records it as version `20261022093414` (`phase_02_auth_first_login_claim_guard_v2`). Existing Auth users and business data are preserved; unmapped legacy users are not automatically converted. The database inspected earlier had zero tenant rows, but existing profile/Auth users still require an explicit migration decision before production.

Live provisioning/login is not accepted until the required server-only Vercel Preview variables are confirmed present and a controlled Auth Admin API test verifies the internal `.invalid` identity is accepted. Supabase Auth global settings and the latest Vercel deployment are not confirmed changed/deployed by this code change.


## Session revocation hardening — 2026-10-22
- Mapping rows include a random session_version. It is copied into the Supabase Auth app_metadata at provisioning, reset and status changes. RLS requires the JWT's session_version to match the database mapping; middleware verifies the access token with Supabase and compares the token claim, current Auth metadata and mapping row on every request.
- Password changes rotate session_version before clearing the first-login flag and request global sign-out. Old access JWTs are rejected at RLS even if they remain cryptographically valid until expiry. Suspensions, deactivations and reactivation also rotate the version so prior sessions do not silently resume.
- The first-login form asks the owner to re-enter the temporary password and validates that the new password differs from it. Password updates and flag changes are sequenced to fail closed on partial failure.
