# CafeOS Testing Guide

Last audited: 2026-10-22

## Automated checks
Run with Node.js >=20.19.0:
```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```
CI workflow: `.github/workflows/ci.yml`. The scripts are `lint`, `typecheck`, `test`, and `build`.

A previous GitHub Actions run passed dependency installation, ESLint, TypeScript, Vitest and production build. The newest resend-query correction needs its own visible green CI run; do not assume a previous run validates later commits.

## Authentication acceptance matrix
Run with a controlled test account and inbox, after provider throttling cools down. Never run high-volume email tests.

1. Valid signup: verify a pending-confirmation state without treating API acceptance as inbox delivery.
2. Confirmation pending: show the next step and allow safe resend.
3. Resend: verify request uses `POST /auth/v1/resend?type=signup&redirect_to=<allow-listed callback>` and body `{"email":"<controlled test address>"}`.
4. Confirmation: use a newly generated link and verify callback creates a valid session and routes to welcome/onboarding.
5. Invalid credentials: show safe actionable error.
6. Successful login: session cookie is HttpOnly and protected page loads.
7. Logout: server session/cookies cleared and protected page returns to login.
8. Password recovery: request reset, follow a fresh link, verify recovery session, update password, and sign in with the new password.
9. Malformed/expired/duplicate callback: reject safely with no session privilege.
10. Network/provider failure and HTTP 429: show accurate retry-later messaging, not a fake delivered state.
11. Tenant isolation: two users in separate tenants cannot read or mutate each other's protected rows.
12. Role/branch boundary: staff/manager cannot perform owner-only actions or access an unauthorized branch.
13. Session expiry/revocation: expired/revoked session cannot access protected data.
14. Preview deployment: confirm exact deployed commit and run smoke checks against it.

## Evidence currently available
- Historical CI green runs for install, lint, typecheck, tests and production build.
- Supabase transactional SQL negative tests passed for tenant/branch/role-boundary cases documented in `docs/BUILD_STATUS.md`.
- Supabase security advisor previously reported no findings.
- Supabase logs show resend request validation error (missing required `type` query parameter), plus 429 email rate limits. The query parameter was corrected in the branch.
- Real confirmation/recovery delivery and fresh callback behavior are not yet accepted end-to-end.


## Restaurant ID authentication rebuild test matrix — 2026-10-22
1. Generate 100 Restaurant IDs; validate format and uniqueness in the sample; verify DB unique constraint rejects duplicate IDs.
2. Provision with platform admin; confirm Auth user, tenant, first branch, owner membership/role, branch membership, mapping and audit event are created transactionally.
3. Confirm invalid admin token, missing server secret and non-admin action are rejected.
4. Login with valid Restaurant ID/password; verify session cookies are HttpOnly and tenant workspace loads only after first-login password change.
5. Invalid Restaurant ID and wrong password return the same generic response.
6. Five failed attempts are allowed; the sixth triggers a 15-minute lockout keyed by hashed Restaurant ID and IP. Success clears the counters.
7. New owner is forced to change temporary password; old temporary password fails; dashboard and tenant REST data remain blocked until mapping flag is cleared.
8. Later password change requires current-password reauthentication and global logout request.
9. Admin reset marks the account must-change before password update; suspension/deactivation closes RLS access and prevents login; reactivation restores eligible access.
10. Verify no public signup form, forgot-password form, resend-verification action or email confirmation callback remains.
11. Verify tenant A/B RLS isolation, cross-tenant access denial and existing RLS negative tests still pass.
12. Run install, lint, typecheck, unit tests and production build; inspect the exact latest run and deployment SHA.

Unit tests added for Restaurant ID format/normalization, generated temporary-password complexity, and collision-resistant internal aliases. Live Auth tests require the server-only Supabase secret and a safe test tenant; do not claim them passed before execution.


## Current rebuild verification notes — 2026-10-22

- Unit tests cover Restaurant ID normalization/format, temporary password complexity, random internal alias format, and password-change policy including strength, confirmation mismatch, and rejecting reuse of the temporary/current password. Provisioning, reset, suspension/reactivation and password changes must also be checked for session-version rotation.
- Supabase migration `20261022151000_phase_02_auth_first_login_claim_guard` was applied successfully. This is not equivalent to an end-to-end owner login test.
- The current identity design is Restaurant ID lookup on the server followed by Supabase's standard email/password grant with the private mapped alias. Supabase does not offer arbitrary username/password as a native password identity.
- Still required before acceptance: green CI for the latest commit; verify Preview deployment SHA; controlled admin provisioning and login; first-login change and old-password rejection; later change/re-auth; reset/suspension behavior; two-tenant RLS negative tests using current code; confirm no owner-facing email auth flow remains. These checks must not be marked passed until actually run.


## Latest actual CI result and blockers — 2026-10-22

The last workflow run inspected was run #353 at commit `881aeba92f77b9c09a6032ee9274c35fac6c46b9`. Install and lint passed; TypeScript failed on a duplicate `randomUUID` import, nullable Auth response access, and an unused variable, so tests and production build were skipped. These issues were fixed in later branch commits, but a fresh green CI result for the current head has not been verified. Do not infer success from earlier green runs.

The latest READY Vercel preview inspected is behind the current branch head, and Vercel reports a build-rate-limit failure for the current commit. Live owner provisioning, login, first-login password change, session revocation, and Auth Admin API acceptance of the internal `.invalid` alias remain unverified.
