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
