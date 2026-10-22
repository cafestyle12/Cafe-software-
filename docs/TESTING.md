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
