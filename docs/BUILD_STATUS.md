# CafeOS Build Status

Last updated: 2026-10-22

## Current phase
- Phase 00 — Complete.
- Phase 01 — Complete. Engineering foundation and CI acceptance checks passed.
- Phase 02 — In progress. Authentication routes, workspace onboarding, tenant/branch schema, permission model, RLS, invitation acceptance, member disable/revoke actions, and audit foundation are implemented; CI run #47 passed (install, lint, typecheck, unit tests, production build); transactional RLS negative tests also passed. TinyFish browser smoke test passed on the public preview for landing, auth pages, and unauthenticated protected-route redirects. Real email-flow tests and session-revocation checks remain open.
- Phase 03 — In progress; do not treat as complete until the acceptance gate in the Phase 03 section below passes.
- Phases 04–16 — Not started.

## Verified environment facts
- GitHub repository: cafestyle12/Cafe-software-; public; default branch main.
- Phase 02 work is isolated on branch phase-02/auth-multitenancy pending review.
- Supabase project selected for CafeOS: pryajliswtltcnbvcoiw; region ap-south-1.
- Vercel preview deployed from `phase-02/auth-multitenancy`; preview branch alias: https://cafe-software-git-phase-02-auth-multitenancy-edityyp.vercel.app. The user authorized preview deployment, not production release.
- Vercel platform SSO protection was disabled so the requested public preview and TinyFish smoke tests could access the app. CafeOS's own authentication remains responsible for protecting application routes.
- Branch-scoped Preview environment variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` are configured. No server-only Supabase secret key is configured yet.
- No production credentials or customer data were committed. The Phase 02 schema contains no tenant/member/customer rows; the global permission catalogue contains eight entries.

## Phase 02 implementation
- Supabase Auth sign-in, registration, sign-out, email confirmation, password recovery, and password update flows.
- HttpOnly session cookies; request middleware validates access tokens and refreshes expired sessions; server-side requests use no-store caching.
- Atomic workspace + first-branch onboarding; India-first defaults (Asia/Kolkata, INR).
- Profiles, tenants, branches, memberships, branch memberships, roles, granular permissions, membership invitations with email delivery/acceptance actions, member disable/revoke actions, and append-only audit events.
- RLS enabled and forced on all eleven public tables. Policies use tenant membership, permission checks, and branch scope.
- Tenant owner and default roles are provisioned by a database trigger. System roles are protected from ordinary role CRUD; role assignment changes require roles.manage; manager invitation policies cannot assign roles carrying roles.manage.
- Security helper functions are in the private schema with fixed search paths and restricted execute grants.
- SQL migration history in the connected Supabase project: phase_02_auth_tenants_rbac, phase_02_fix_tenant_owner_seed, phase_02_atomic_onboarding_and_role_guard, phase_02_security_performance_hardening, phase_02_protect_owner_membership, phase_02_invite_acceptance_rpc, phase_02_tenant_profile_visibility, phase_02_consolidate_profile_read_policy, phase_02_strict_branch_scope, phase_02_restrict_profile_updates.
- Security advisor returned no findings after the Phase 02 migrations. Performance advisor has only unused-index informational notices, expected before any tenant data/query workload exists.
- Transactional SQL security test passed against the connected project: tenant A/B isolation, cross-tenant branch insert denial, explicit branch-scope enforcement, owner-membership protection, manager role-assignment boundary, and prevention of manager-created owner invitations. All fixture rows were rolled back.

## Verification still required before Phase 02 acceptance
- Latest CI run #72 passed on commit 0c8530b902f41715ba6a0be5ab6707f4d309efbc: install, lint, typecheck, unit tests, and production build all passed. Phase 02 login UI and confirmation callback compatibility changes are included.
- Supabase Auth Site URL and allowed redirect URL match `https://cafe-software-git-phase-02-auth-multitenancy-edityyp.vercel.app` and `/auth/confirm`. Recovery email end-to-end remains BLOCKED: app currently shows `Could not send the recovery email. Try again later`; Auth logs show `/recover` requests but earlier `/verify` attempts failed with `403: Email link is invalid or has expired`. The recovery template and actual SMTP/email delivery still require a verified end-to-end run.
- Transactional RLS tests passed using three simulated authenticated identities. Full browser/session integration and branch-scoped membership tests remain open.
- Invitation delivery/acceptance and member disable/revoke workflows are implemented but still require `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) configured as a server-only Vercel Preview environment variable and end-to-end tests with a test inbox.
- Session revocation, role-boundary tests, and production abuse/rate-limit review remain open.

## Browser and deployment verification
- TinyFish public smoke test passed on the branch alias for `/`, `/login`, `/signup`, `/forgot-password`, `/auth/confirm`, `/app`, `/onboarding`, and `/app/members`; protected routes correctly redirected unauthenticated visitors to `/login`. The animated split-layout login redesign is live on the branch preview, with orbital café modules, large circular centerpiece, entrance/bounce/float/rotate/pulse transitions, responsive CSS breakpoints, and reduced-motion support. Recovery request still displays an error and is not accepted.
- Preview redeployment is READY on Vercel after adding the three branch-scoped public environment variables. Latest preview deployment uses the Phase 02 branch commit.
- Project-level Vercel SSO protection was disabled to make the preview publicly testable; production has not been deployed.

## Operational notes
- Production deployment is not yet authorized/ready; preview only.
- Do not treat this engineering preview as a production launch. Ordering, payments, live café operations, and integrations remain disabled.
- Dependency vulnerability review remains a separate security task; do not force breaking framework upgrades to silence advisories.


## Audit refresh — 2026-10-22

### Confirmed root causes / blockers
- Supabase Auth logs show `POST /auth/v1/resend` failing with HTTP 400 `validation_failed`: `Missing one of these types: signup, email_change, sms, phone_change`. The Auth REST API expects the resend `type=signup` in the query string. The branch implementation was corrected to send `type=signup` and `redirect_to=<configured-site>/auth/confirm` as query parameters, with the email in the request body.
- Supabase Auth logs also show HTTP 429 `over_email_send_rate_limit` for signup and recovery requests. This is a provider-side throttle; application code cannot safely or truthfully make Supabase delivery unlimited. Do not bypass the provider limit. Configure custom SMTP and appropriate quotas for production capacity.
- Logs include a `mail.send` event for a confirmation message, but log acceptance does not prove inbox delivery or successful callback completion. Delivery remains unverified end-to-end.
- Previous recovery testing showed an expired/invalid verification link; confirmation/recovery template and callback still need an end-to-end test with a fresh test account/inbox.
- Supabase and Vercel configuration can be partially inspected via connected tools, but the actual SMTP provider credentials, sender-domain verification, DNS status, and email-template settings were not readable through the available connected API. Do not infer they are configured.
- Vercel API deployment listing was denied by the connected integration (403). Existing project notes identify the preview alias, but this audit did not independently verify a fresh deployment of the latest commit. Production deployment remains unauthorized and untouched.

### Current CI evidence
- A previous CI run passed install, ESLint, TypeScript, Vitest and production build.
- After the current resend API correction, a new run for the latest commit was not returned by the connected PR-only workflow lookup at audit time. Do not mark the latest commit CI-verified until a run is visible and green.

### Current phase gate
Phase 00 documentation/environment inventory is substantially present; SMTP/provider inventory remains blocked by dashboard/provider visibility. Phase 01 scripts, lockfile, example env and CI exist; latest code still requires CI evidence. Phase 02 database/RLS work has prior positive evidence, but auth/email E2E, invitation server secret setup, real session tests and latest deployment verification remain open. Phase 02 is NOT accepted. Phase 03 has not been started.


### Verification update after resend fix — 2026-10-22
- GitHub Actions CI run #117 completed successfully on the resend-fix commit lineage: dependency install, ESLint, TypeScript type-check, Vitest, and production build all passed. The run is at https://github.com/cafestyle12/Cafe-software-/actions/runs/39735158907.
- The latest resend request now sends `type=signup` in the Auth REST query string and `email` in the request body, matching the endpoint contract. This is code-level verification only; no new confirmation email was sent as part of this audit.
- The current Vercel commit status is **failure** with the Vercel URL indicating `build-rate-limit`. Therefore the current preview may not contain the fix; latest deployment is not verified.
- Current Supabase Security Advisor warning: leaked-password protection is disabled. Enable it in Supabase Auth password-security settings.
- The Vercel deployment listing API returned 403 and no deployment was changed or forced. Production was not deployed.
- Overall Phase 02 acceptance remains **blocked** on email provider/template configuration and real controlled-inbox E2E, current deployment availability, authenticated session/tenant checks, and server-only secret setup for invitation administration.


## Auth retry and persistent-session update — 2026-10-22
- Added a browser-cookie UX guard allowing five login attempts and five signup attempts in a 15-minute window before a cooldown. This is an additional usability guard, not a substitute for server-side/IP rate limiting; Supabase Auth's own protections remain enabled.
- Extended the CafeOS refresh-token cookie lifetime to one year and kept automatic access-token refresh in middleware. A user remains signed in across normal browser visits until sign-out or until Supabase expires/revokes the underlying session; the app cannot override Supabase's project-level session lifetime policy.
- Improved signup and recovery messages to point toward SMTP, sender verification, Auth logs, and provider rate limits when email delivery fails.
- Email delivery still requires a real test inbox. Source HTML templates in `supabase/templates/` must be copied into Supabase Dashboard → Authentication → Email Templates; committing the templates alone does not change Supabase's live mail configuration.


## Restaurant ID authentication rebuild — 2026-10-22
- Architecture chosen after repository, Supabase schema, migration history, Auth logs and current Supabase password-auth documentation were inspected: Restaurant ID maps server-side to a random internal non-deliverable Auth email alias; Supabase Auth remains the password verifier and session issuer.
- Branch code now includes a server-only platform admin console, one-time credential provisioning, Restaurant ID login, DB-backed hashed login throttling, first-login password-change UI, owner password change, admin reset/suspend/deactivate actions, middleware account gates, and RLS-helper enforcement.
- Public signup, email recovery UI/action, resend-confirmation action and the email confirmation callback were removed. Email-based member invitations are disabled; existing invitation rows are retained.
- Additive migration 20261022091308_phase_02_restaurant_id_auth.sql adds mapping/rate-limit tables and service-role-only RPCs. It must be applied and verified in the selected Supabase project before login/provisioning can work.
- Vercel Preview requires SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY, CAFEOS_PLATFORM_ADMIN_TOKEN, and optionally CAFEOS_RATE_LIMIT_SECRET. The available Vercel environment listing returned 404 for project lookup, so these values are not confirmed configured. Never read or publish secret values in chat.
- Latest CI was failing lint on three Next.js anchor errors; those were fixed and a new CI run was observed in progress. Update this note after that run completes; do not infer green CI.
- Production deployment and merge to main remain unauthorized. Phase 03 is not started.


## Verification update — 2026-10-22 09:20 UTC
- GitHub Actions run #209 for commit cc7a4faea20a27a16cc526ee4b95357f46f58935 passed install, lint, typecheck, unit tests and production build: https://github.com/cafestyle12/Cafe-software-/actions/runs/39754502909.
- Applied migration phase_02_restaurant_id_auth to Supabase project pryajliswtltcnbvcoiw; migration history reports version 20261022091308. New tables exist with RLS enabled; table grants are limited to service_role and SQL admin/rate-limit RPC execution is granted to service_role only. A transactional SQL check confirmed attempts 1–5 are allowed and attempt 6 is blocked; the test transaction was rolled back.
- Supabase Security Advisor now reports two informational RLS-enabled/no-policy notices for the intentionally service-role-only mapping/rate-limit tables and one warning that leaked-password protection is disabled.
- Vercel refused a Preview deployment with 403 permission denied. The latest READY preview is still commit 5d9b907c5f8f8b2ea9cb87fe4e22c02351aef6cd, not the current branch head. Do not claim the latest auth rebuild is deployed.
- Live provisioning/login remains blocked until server-only Supabase secret and CAFEOS_PLATFORM_ADMIN_TOKEN are configured in Vercel Preview, and Vercel Preview deployment permission is restored. The .invalid identity alias must be confirmed accepted by the real Supabase Auth Admin API using a controlled test account.


- Additional security fix: applied migration version 20261022092809 to revoke authenticated/anon/public execution of the legacy create_tenant_with_branch RPC. Routine grants were re-queried and confirmed service_role-only for tenant provisioning and rate-limit/admin RPCs.

- Additional RLS hardening applied as migration 20261022093023: legacy email-only sessions and users without a Restaurant ID mapping are denied tenant data access even if they call Supabase REST directly. A rollback-only SQL test passed for first-login and suspended-state gates.


## Current Restaurant ID auth rebuild — 2026-10-22 (supersedes earlier email-auth plan)

- Architecture: server-side Restaurant ID lookup to a random `@auth.cafeos.invalid` Supabase Auth email identity, then the normal Supabase password grant. Supabase's documented password auth accepts email or phone identity, not arbitrary username; CafeOS keeps the mapping private and does not expose the alias.
- Owner login UI uses Restaurant ID + password. Public signup and email-based recovery/confirmation routes redirect to a notice; email invitation acceptance is disabled at the action boundary while existing invitation records remain preserved.
- Platform admin console provisions the Auth identity, tenant, first branch, owner membership, mapping and audit event using server-only credentials. Temporary passwords are cryptographically generated, shown in the provisioning/reset response only, and not stored in application tables or audit logs.
- The password-change action now reauthenticates with the current/temporary password, rejects reuse of that password, rotates the database-backed session version, and keeps first-login state restrictive across partial failures. The additive RLS migration preserves the mapped-owner and session-version checks and also checks the signed JWT first-login claim.
- Applied Supabase migrations include `20261022091308_phase_02_restaurant_id_auth` and the first-login JWT guard (history version `20261022093414`, name `phase_02_auth_first_login_claim_guard_v2`; repository file `supabase/migrations/20261022151000_phase_02_auth_first_login_claim_guard.sql`). The latter is additive and does not drop or rewrite business data.
- CI, controlled provisioning, owner login, live Auth password update, suspension/revocation, and browser tenant-isolation acceptance must be reported only after the latest run/deployment and a safe controlled test are confirmed. The Vercel production deployment remains unauthorized.
- Supabase global email-confirmation settings have not been changed; the new admin-provisioned identities use `email_confirm: true` and do not require verification emails. Do not state that project-wide email confirmation is disabled.
- Known external blockers to resolve before production acceptance: confirm `SUPABASE_SECRET_KEY` (or legacy service-role key) and a random 32+ character `CAFEOS_PLATFORM_ADMIN_TOKEN` are set in Vercel Preview; verify Vercel Preview deployment permission; enable Supabase leaked-password protection; run controlled end-to-end tests. Phase 03 remains not started.


## Session revocation verification — 2026-10-22
- Applied migration version 20261022093302 (session_version column, updated provisioning/status RPC signatures and RLS session-version match) and version 20261022093414 (first-login JWT claim gate). The matching SQL files are checked into the branch. Migration 20261022093033 first-login guard is also represented in the repository so the local migration sequence matches remote history.
- A rollback-only SQL test passed for first-login, active mapped owner, stale JWT session-version, suspended-account and suspended-tenant RLS cases.
- The currently READY Vercel Preview renders the Restaurant ID login and restricted platform-admin page, but the UI explicitly reports missing server-only Supabase secret / platform-admin token. Its deployed commit is older than the current branch head; live provisioning/login is not yet accepted.


## Final audit snapshot — 2026-10-22 09:45 UTC

- Confirmed Supabase Auth's supported password identity is email/phone, not an arbitrary Restaurant ID. The chosen design maps Restaurant ID server-side to a random internal `.invalid` alias and uses Supabase's normal password grant. New provisioned users are marked confirmed via the Admin API; global email-confirmation configuration remains unchanged.
- Applied first-login RLS guard to Supabase; live function inspection confirms it retains the restaurant-owner claim, active tenant/membership/mapping predicates, and `session_version` equality while also denying JWTs with `must_change_password=true`. Admin provisioning/status RPCs are restricted to `service_role`.
- Code updates now rotate `session_version` during provisioning, administrator resets/status changes and owner password changes; middleware compares session JWT/current Auth metadata/session-version cookie. Password-change partial failures are designed to fail closed.
- The latest CI result actually inspected was run #353 on commit `881aeba92f77b9c09a6032ee9274c35fac6c46b9`; type-check failed due to a duplicate `randomUUID` import, nullable Auth payload access, and an unused variable. Those defects were corrected in later commits, but this audit could not retrieve a newer push-triggered CI run; do not claim the current head passes CI until a new green run is visible.
- Latest READY Vercel preview observed was commit `7bcbd2f2d35cb0260b373085dd7695267ef1dea6`, which is behind the current branch head. The latest commit's Vercel check reports a build-rate-limit failure. No production deployment or merge was performed.
- Live provisioning/login and actual `.invalid` alias acceptance remain unverified because the server-only Supabase secret and platform-admin token are not confirmed configured, and the latest branch head is not deployed.
- Phase 03 has not started.

- Additional database security checks: migration 20261022094252 revoked direct tenant INSERT and gated same-tenant profile visibility; migration 20261022094402 removed TRUNCATE/REFERENCES/TRIGGER from browser roles and removed all anon table grants. Post-migration privilege queries confirmed no browser-role TRUNCATE grants and no browser-role tenant INSERT.


## Current status — 2026-10-22 09:47 UTC
- Branch-head CI run #431 for commit b189c1394cc2ec17189a3315c711a67ac6fca1c8 completed successfully: install, lint, typecheck, unit tests and production build all passed. Run: https://github.com/cafestyle12/Cafe-software-/actions/runs/39758002003.
- Supabase migration history is aligned with checked-in migration versions through 20261022094402. The connected project has the restaurant mapping, DB rate limiter, admin-only provisioning/status RPCs, owner-only RLS/session-version gates, direct tenant INSERT revoked, and RLS-bypassing table privileges revoked.
- Rollback-only SQL tests passed for five attempts allowed/sixth blocked; first-login owner denied; active mapped owner allowed; stale session-version denied; suspended owner and tenant denied; legacy email-only session denied; colleague-profile sharing follows the owner gate. All test tenant/mapping changes were rolled back.
- Current latest READY Vercel Preview is https://cafe-software-95s0eecl9-edityyp.vercel.app, deployed at commit 6a42f35a99e13c4dd953d98cd061a5dfe4056a2d, which is older than the current branch head. The Vercel deployment API returned 403 for a new Preview deployment. Do not claim current code is deployed.
- The current Preview UI reports missing server-only Supabase secret/platform admin token. Configure SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY and CAFEOS_PLATFORM_ADMIN_TOKEN in Preview, then obtain permission to deploy a Preview before attempting live provisioning. Do not configure Production or merge without authorization.
- Supabase leaked-password protection remains disabled and must be enabled before production. The internal .invalid alias and full Admin API flow remain unverified because the server secret is not configured/available to this run.


## Phase 03 — current implementation and acceptance gate (2026-10-22)

Implementation is isolated on `phase-03/branches-tables-floor-qr`, based on the Phase 02 Restaurant ID + password foundation. Phase 04 has not started. No merge to `main` or production deployment was performed.

### Implemented

- Restaurant profile editor: restaurant display name, contact phone/email (contact-only; never used for login), address and default timezone.
- Branch create/edit/deactivate. Deactivation is an atomic database operation: it refuses while active table sessions exist, revokes QR credentials, inactivates tables/zones, then inactivates the branch.
- Seating zone create/rename/deactivate. A zone with active tables cannot be deactivated.
- Table create/edit/deactivate, capacity, zone assignment, shape, dimensions, position and rotation. Table deactivation refuses while active sessions exist and revokes QR credentials atomically.
- Interactive drag/keyboard movement, rotation, width/height controls, save/discard, server-side validation and optimistic layout-version conflict detection.
- Individual QR issue/revoke and atomic batch issuance for up to 50 tables. QR codes are generated locally in SVG (no third-party QR image service), can be downloaded and printed individually or as a multi-card print sheet. Only SHA-256 token hashes are stored. The raw QR URL is shown once after issuance; an active QR must be revoked before replacement.
- Database-enforced one-active-QR-per-table constraint. Revoking a QR also revokes sessions created from it.
- Public QR landing page returns only public-safe restaurant/branch/table fields. Table session initialization uses an opaque random session token, hash-at-rest storage, four-hour expiry, idempotency handling, serialization against duplicate concurrent creation, and a maximum of 25 active sessions per table.
- Restaurant ID remains custom: 3–32 characters; letters, numbers, hyphens and underscores; first character must be a letter or number; no spaces; normalized uppercase and unique mapping enforced.
- Public QR routes set no-store and no-referrer headers to reduce token caching/referrer leakage.
- Additive Supabase migrations are applied to project `pryajliswtltcnbvcoiw`: `phase_03_branches_tables_floor_qr`, `phase_03_floor_plan_optimistic_save`, `phase_03_table_session_initialization`, `phase_03_table_session_initialization_idempotency_fix`, `phase_03_safe_lifecycle_rpcs`, `phase_03_batch_qr_issuance`, `phase_03_qr_session_abuse_guard`, `phase_03_single_active_qr`, `phase_03_floor_plan_resize`, `phase_03_atomic_qr_revocation`, `phase_03_session_idempotency_reuse`, and `phase_03_database_hardening`.
- Database checks confirm RLS and FORCE RLS for all five operational tables, anonymous direct table SELECT denied, authenticated direct access to private `table_sessions` denied, only intended QR/session RPCs callable by anonymous users, batch QR RPC restricted to authenticated users, and one-active-QR uniqueness index present. Invalid QR resolution returned a generic invalid result without private data.

### Verification and remaining gate

- The CI workflow runs install, ESLint, TypeScript type-check, Vitest and production build. Branch-head CI run #518 passed install, ESLint, TypeScript type-check, Vitest and production build on commit `0d90db7dd24b8eace3fd8cfc1d2faef5545c98e0`. A Preview deployment attempt was explicitly denied by Vercel with `403: you don't have permission to create a Preview Deployment` for project `cafe-software`; browser verification therefore remains blocked pending authorized Vercel access.
- Supabase advisors still flag the intentionally public `resolve_table_qr` and `initialize_table_session` SECURITY DEFINER RPCs, which are deliberately narrow, use an empty search path, return only safe fields/opaque session credentials, and validate tokens. Authenticated management RPCs are also SECURITY DEFINER but enforce `auth.uid()` plus tenant permission checks. Advisor also reports three RLS-enabled/no-policy tables (`auth_attempt_windows`, `restaurant_auth_accounts`, `table_sessions`); these are intentionally private/service-only.
- The existing project-level leaked-password protection warning remains from the Phase 02 Auth configuration and must be enabled in Supabase Auth settings before production.
- Vercel's recent check has reported `build-rate-limit`, and the Vercel deployment-list API returned 403. The latest Phase 03 commit is not yet confirmed deployed to Preview. A fresh Preview deployment and browser E2E smoke test are still required; authenticated tenant-isolation and real QR scan/print workflows cannot be claimed verified until tested there.
- Phase 03 is **not accepted** until the latest CI run passes and Preview/browser verification is completed. Phase 04 remains unstarted; production merge/deployment remains unauthorized.


## Phase 03 continuation — 2026-10-22

Additional hardening after the earlier status block:
- Branch records now expose contact phone and free-form opening-hours notes in create/edit; restaurant and branch management screens remain email-free to preserve the Restaurant ID + password requirement.
- Server-side timezone allow-list validation is applied on branch create/edit.
- Floor-plan saves use the returned optimistic version for repeated saves without requiring a page reload.
- Lifecycle RPCs now lock QR credentials before table rows, matching public session initialization order to avoid a QR/table lock-order deadlock.
- Database trigger `validate_cafe_table_parent_status` validates active branch and active seating zone under row locks, preventing a concurrent table create/update from attaching an active table to a deactivated branch or zone.
- Latest applied migration: `phase_03_parent_status_invariants` (migration file `20261023220000_phase_03_parent_status_invariants.sql`).

### Current hard acceptance blockers
- GitHub Actions #520 passed, but #521–#532 were still in progress when last checked; latest branch-head CI must finish green after the last commits.
- Vercel deployment API returned HTTP 403: the connected Vercel identity does not have permission to create a Preview deployment for project `cafe-software`. No Phase 03 preview URL has been verified, so browser end-to-end acceptance cannot truthfully be marked complete. This requires the project owner to grant Preview deployment permission or to deploy this branch from an authorized Vercel account.
- No production merge or production deployment has been performed.


### Latest verification correction — 2026-10-22
- GitHub Actions run #532 for the latest code commit `77d3349` completed successfully: dependency installation, lint, TypeScript type-check, unit tests, and production build all passed.
- Documentation-only follow-up run #533 also completed successfully with the same five checks.
- Connected Supabase confirms all 12 Phase 03 migrations, including parent-status invariants, are applied. SQL smoke checks confirmed invalid QR tokens return only a generic invalid result, all five operational tables have RLS + FORCE RLS, anonymous direct table reads are denied, and table-session rows are not directly selectable by authenticated clients.
- **Preview/browser acceptance remains blocked solely by Vercel permissions**: the connected identity received HTTP 403 when attempting to create a Preview deployment for `cafe-software`. Phase 03 is code/CI complete, but cannot be declared end-to-end accepted until an authorized Preview deployment can be created and exercised.
