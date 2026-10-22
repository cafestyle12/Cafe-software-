# CafeOS Deployment Notes

Last audited: 2026-10-22

## Targets
- Repository: `cafestyle12/Cafe-software-`
- Default branch: `main`
- Active Phase 02 branch: `phase-02/auth-multitenancy`
- PR: https://github.com/cafestyle12/Cafe-software-/pull/1 (draft/open; not merged)
- Intended preview alias: https://cafe-software-git-phase-02-auth-multitenancy-edityyp.vercel.app
- Preview login: https://cafe-software-git-phase-02-auth-multitenancy-edityyp.vercel.app/login
- Supabase project ref: `pryajliswtltcnbvcoiw`, region `ap-south-1`.

## Environment variable names
Browser-safe:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL` (example file compatibility)

Server-only, only if required by invitation/member administrative operations:
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

The Phase 02 notes say the three public Preview variables are configured, but this audit did not read secret values (and must not). The server-only secret is not confirmed configured. `.env.example` contains variable names and blank values only.

## Auth URL configuration
Set Supabase Auth Site URL to the exact intended application origin and add the exact callback URL `https://cafe-software-git-phase-02-auth-multitenancy-edityyp.vercel.app/auth/confirm` to allowed redirect URLs for Preview testing. Use the real production origin only when production is authorized and configured. Do not use wildcard redirect rules unless there is a reviewed reason.

## Build/deploy
1. Review the Phase 02 pull request and ensure latest CI is green.
2. Confirm Vercel preview build commit matches the branch head.
3. Confirm Preview environment variable names are configured for the correct environment; never expose values in logs.
4. Verify callback, recovery and resend against a controlled inbox.
5. Do not merge to main or deploy production without explicit authorization.

## Current limitations
The connected Vercel deployment-list API returned 403 during the 2026-10-22 audit, so the latest deployment status/commit could not be independently verified. A previous note identifies the preview alias and a READY deployment, but that is not evidence the latest email fix has deployed.


## Restaurant ID authentication environment setup
Required for Preview before owner login or provisioning can work:
- SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY — server-only, never NEXT_PUBLIC.
- CAFEOS_PLATFORM_ADMIN_TOKEN — generate a random token of at least 32 characters and keep it private.
- CAFEOS_RATE_LIMIT_SECRET — optional; if omitted, the server-only Supabase secret salts rate-limit keys.

Set these only in Vercel Preview for branch phase-02/auth-multitenancy first. The connected Vercel environment-variable API did not permit inspection during this run, so presence is unverified. After configuration, redeploy the preview, apply the additive migration, then use a controlled test restaurant. Do not set Production variables or deploy production without explicit authorization.

The new protected platform admin console is at /platform-admin; owner login is /login; forced first-login password change is /change-password; later password changes are at /account-settings.


## Restaurant ID authentication rebuild deployment gate — 2026-10-22

The current code expects these variables in Vercel **Preview only** for the Phase 02 branch:
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` (server-only).
- `CAFEOS_PLATFORM_ADMIN_TOKEN` (random, at least 32 characters).
- Optional `CAFEOS_RATE_LIMIT_SECRET` (server-only).

Do not send secret values through chat or commit them. The connected environment tooling has not verified these values. The code change is not accepted until the latest CI is green and the deployed Preview SHA matches the branch.

Restaurant ID login is a server-side mapping to a random `.invalid` Supabase Auth email identity, because Supabase password auth requires email or phone. Provisioned identities are marked confirmed using the supported Admin API; this does not mean global email confirmation is disabled. Provisioning, resets, status changes and password changes must keep the Auth `app_metadata.session_version` aligned with `restaurant_auth_accounts.session_version`; stale version cookies/JWTs must be rejected. No production deployment or merge is authorized. Phase 03 has not started.


## Phase 03 Preview deployment
- Development branch: `phase-03/branches-tables-floor-qr`.
- Supabase migration `phase_03_branches_tables_floor_qr` is applied to the connected project. The app needs `NEXT_PUBLIC_SITE_URL` set to the intended public application origin for QR URLs; do not substitute localhost or assume the production domain.
- No Phase 03 Vercel deployment has been verified. Do not merge or deploy production without explicit authorization. Verify CI and deploy the branch to Preview before end-to-end QR testing.


## Phase 03 preview deployment gate — 2026-10-22

Deploy only the `phase-03/branches-tables-floor-qr` branch to Vercel Preview after latest CI is green. Do not merge or deploy Production. Recent Vercel status reported `build-rate-limit`; the connected deployment-list API returned 403, so no successful deployment of the latest Phase 03 commit is confirmed. After a fresh Preview is available, verify environment variables, public QR invalid-token behavior, owner profile/branch/table workflows, QR issue/revoke/batch print, and session initialization before accepting Phase 03.
