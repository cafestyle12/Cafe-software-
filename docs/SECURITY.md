# CafeOS Security Notes

Last audited: 2026-10-22

## Security boundary
- Public repository: `cafestyle12/Cafe-software-`.
- Phase branch: `phase-02/auth-multitenancy`; PR #1 remains open/draft and is not merged to `main`.
- Supabase Auth handles passwords and verification tokens. Do not implement a bypass or disable confirmation to mask email-delivery failures.
- Application session tokens are stored in HttpOnly cookies by server-side actions. The access token is checked against Supabase Auth; middleware attempts refresh on an expired/unauthorized access token.
- Database authorization depends on RLS and tenant/membership/permission checks. UI visibility alone is not authorization.
- The Phase 02 migrations enable and force RLS across eleven public tables. Previous SQL negative tests covered tenant A/B isolation, branch scope, cross-tenant branch insertion, owner membership protection, and manager role escalation. These tests are evidence for those tested cases only, not a substitute for end-to-end security review.
- Service-role/secret keys must remain server-only environment variables. Never use `NEXT_PUBLIC_` for them, commit them, or paste them into chat.
- Vercel platform SSO protection was previously disabled to permit preview smoke testing. Keep application routes protected and reassess platform protection before sharing preview URLs broadly.

## Known security/acceptance gaps
- Real authenticated browser tests for session revocation, role boundaries and tenant/branch access remain outstanding.
- Invitation/member administrative actions require `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` configured server-side in the correct Preview environment; presence has not been verified.
- SMTP configuration, sender verification, DNS authentication and email templates were not readable through the available connected API.
- Supabase Auth logs recorded 429 email throttling. Do not bypass rate limits or make a public email sender unlimited.
- Current Vercel deployment status could not be independently fetched because the connected deployment listing returned 403.

## Operational checklist
1. Use a custom SMTP provider with verified sender/domain and SPF/DKIM (and DMARC policy appropriate to the domain).
2. Keep Supabase Auth confirmation and recovery links pointed to an exact allow-listed CafeOS callback URL.
3. Test only with controlled inboxes and low volume.
4. Review logs without recording passwords, tokens, session cookies, SMTP credentials or secret keys.
5. Re-run CI and authenticated RLS/session tests before merging or deploying production.


## Latest advisor recheck — 2026-10-22
- Supabase Security Advisor now reports a warning: **Leaked Password Protection Disabled**. Enable the HaveIBeenPwned-based leaked-password protection in Supabase Auth password-security settings before production acceptance.
- The performance advisor reports nine unused-index informational notices on the currently empty/low-workload schema. Keep the indexes unless workload evidence justifies removal; unused does not mean unsafe.


## Restaurant ID authentication rebuild — 2026-10-22
- Supabase password auth still uses a provider identity internally. CafeOS resolves Restaurant ID server-side to a random, non-deliverable @auth.cafeos.invalid alias and never sends that alias to the browser.
- The platform admin token and Supabase secret must be configured as server-only Vercel Preview variables. They are not currently confirmed configured, so live provisioning/login cannot yet be accepted.
- The new mapping and rate-limit tables have no grants to anon/authenticated. Admin provisioning/status RPCs are restricted to service_role. Review and apply the additive migration before using the new routes.
- First-login change and account status are checked by middleware and by the tenant RLS helper. RLS blocks mapped owners while password change is required or the account/tenant is inactive.
- Public signup, password-recovery email route, resend-confirmation action and confirmation callback are removed. Existing email invitations are disabled at the action boundary; pending invitation records are preserved.
- Global Supabase email-confirmation settings were not changed blindly. Provisioned Auth users use the supported admin create-user API with email_confirm: true.
- Remaining known issue: leaked-password protection is disabled in Supabase Auth; enable it before production.


## Verification snapshot — 2026-10-22
- Additive restaurant-auth migration applied to the selected Supabase project. Mapping and attempt-window tables have RLS enabled with no public policies (default-deny); direct grants and admin/rate-limit RPCs were checked as service_role-only.
- A rollback-only database test passed for five allowed auth attempts and sixth-attempt lockout.
- Latest GitHub CI passed at commit cc7a4faea20a27a16cc526ee4b95357f46f58935. Vercel Preview deployment for the current branch was denied with HTTP 403, so the latest code is not confirmed deployed.
- Do not use the new admin provisioning page until the server-only Supabase secret and CAFEOS_PLATFORM_ADMIN_TOKEN are set in Preview and the .invalid alias is validated with a controlled Auth Admin API test.


## Additional provisioning boundary check — 2026-10-22
- A direct-RPC audit found the legacy create_tenant_with_branch function still had EXECUTE for authenticated even after the onboarding UI was disabled. Migration 20261022092809 revokes client execution and grants only service_role. Post-migration routine privilege inspection confirmed no anon/authenticated grants remain for that RPC or the new admin/rate-limit RPCs.


- Migration 20261022093023 further tightens private.is_tenant_member: a session must carry the restaurant_owner app_metadata claim and match an active mapping row with the first-login flag cleared. A transaction-only SQL test confirmed first-login, suspended-account, and suspended-tenant denials while an active mapped owner passed.


## Restaurant ID auth hardening update — 2026-10-22

- Supabase's supported password identity remains email/phone. Restaurant ID resolution is server-only and mapped to a cryptographically random, non-deliverable `.invalid` alias; no public request can select an arbitrary auth email or user UUID.
- The new `private.is_tenant_member` definition now also denies data access when the verified JWT carries `app_metadata.must_change_password=true`, in addition to checking the account mapping and tenant/membership status. This protects direct PostgREST/RLS access if the Auth metadata and mapping update do not complete together.
- Password change now requires the current/temporary password, rejects reuse, and keeps the Auth first-login flag set until the mapping update succeeds. The Auth metadata is then cleared; if that step fails, the mapping is re-locked and the JWT claim remains a deny condition.
- Migration `20261022151000_phase_02_auth_first_login_claim_guard` was applied additively to Supabase. It replaces only the private membership helper and reasserts restricted execute grants; it does not modify tenant records.
- Live login/provisioning remains unverified until Vercel Preview has the server-only Supabase secret and platform-admin bootstrap token and a controlled test is run. Do not mark the authentication acceptance gate complete from static code review alone.


## Session revocation update — 2026-10-22
- Session-version rotation is enforced in both middleware and RLS. Old JWTs cannot regain access merely because an account is reactivated; a new login must use the current Auth metadata version.
- The first-login password form reauthenticates the temporary password and rejects reusing it as the new password. Partial password/metadata failures leave RLS or middleware closed.


## RLS bypass privilege audit — 2026-10-22
- Discovered and fixed dangerous default table grants: TRUNCATE bypasses RLS. Migration 20261022094402 removes TRUNCATE/REFERENCES/TRIGGER from public browser roles across public tables, removes all anon table grants, and changes postgres default privileges for future tables. Verification returned no dangerous grants for anon/authenticated.
- Migration 20261022094252 also revoked direct tenant INSERT from browser roles and gated colleague-profile visibility through the mapped-owner RLS helper.


## Phase 03 QR and seating security notes
- New seating tables use forced RLS and tenant permission checks. Cross-tenant table references are blocked by composite foreign keys.
- QR secrets are 32-byte random opaque tokens; only SHA-256 hashes are stored. Revocation marks credentials inactive and the public resolver ignores inactive credentials and inactive tables/branches/tenants.
- Public QR resolver returns only restaurant name, branch name, table label and capacity. Invalid inputs return a generic invalid response. Public route does not grant staff access or create orders/payments.
- The public table-session schema exists but the secure session-creation/reuse/revocation endpoint is not implemented yet. Do not treat QR landing as a completed customer session.
- Raw QR URL is returned through an authenticated server action state and is not placed in admin query parameters. Copy/share only through the intended customer QR medium.


## Phase 03 security controls — 2026-10-22

- QR token material is generated with cryptographic randomness; only SHA-256 hashes are persisted. The raw URL is returned once to the issuing owner and is never included in the administrative URL. QR SVGs are generated locally; token data is not sent to a third-party QR image service.
- QR revocation atomically invalidates active sessions. Branch/table deactivation is blocked while active sessions exist and performs QR/session-related state changes transactionally. One-active-QR-per-table is enforced by a partial unique index.
- Public RPCs use an empty search path and fully qualified object references. `resolve_table_qr` returns public-safe labels only; `initialize_table_session` requires a valid bearer QR token and strict idempotency-key format, serializes same-key creation, and limits active sessions to 25 per table. Public table routes are no-store and use Referrer-Policy: no-referrer.
- Supabase advisor's anonymous SECURITY DEFINER warnings for these two public RPCs are intentional: anonymous QR scanning is a product requirement; the functions have narrow outputs and explicit token checks. Authenticated management SECURITY DEFINER RPCs verify `auth.uid()` and tenant permissions. `table_sessions`, `restaurant_auth_accounts`, and `auth_attempt_windows` intentionally have no browser-facing RLS policies.
- Remaining external security item: enable Supabase Auth leaked-password protection before production. Full authenticated tenant-isolation and browser E2E testing is still gated on a fresh Preview deployment.
