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
