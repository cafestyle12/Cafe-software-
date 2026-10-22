# CafeOS Build Status

Last updated: 2026-10-22

## Current phase
- Phase 00 — Complete.
- Phase 01 — Complete. Engineering foundation and CI acceptance checks passed.
- Phase 02 — In progress. Authentication routes, workspace onboarding, tenant/branch schema, permission model, RLS, invitation acceptance, member disable/revoke actions, and audit foundation are implemented; CI run #47 passed (install, lint, typecheck, unit tests, production build); transactional RLS negative tests also passed. TinyFish browser smoke test passed on the public preview for landing, auth pages, and unauthenticated protected-route redirects. Real email-flow tests and session-revocation checks remain open.
- Phases 03–16 — Not started.

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
- Latest recorded CI run #47 passed on commit 9ba1e7a8b51e013fc3d4c4d8fecd889cfd2e9077. Subsequent changes are SQL migration/test and documentation updates; TypeScript runtime code is unchanged since that passing run.
- Configure Supabase Auth Site URL and allowed redirect URL for `https://cafe-software-git-phase-02-auth-multitenancy-edityyp.vercel.app`, then complete end-to-end tests with confirmation and recovery emails.
- Transactional RLS tests passed using three simulated authenticated identities. Full browser/session integration and branch-scoped membership tests remain open.
- Invitation delivery/acceptance and member disable/revoke workflows are implemented but still require `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) configured as a server-only Vercel Preview environment variable and end-to-end tests with a test inbox.
- Session revocation, role-boundary tests, and production abuse/rate-limit review remain open.

## Browser and deployment verification
- TinyFish public smoke test passed on the branch alias for `/`, `/login`, `/signup`, `/forgot-password`, `/auth/confirm`, `/app`, `/onboarding`, and `/app/members`; protected routes correctly redirected unauthenticated visitors to `/login`, the Supabase configuration warning disappeared, and no runtime errors were observed.
- Preview redeployment is READY on Vercel after adding the three branch-scoped public environment variables. Latest preview deployment uses the Phase 02 branch commit.
- Project-level Vercel SSO protection was disabled to make the preview publicly testable; production has not been deployed.

## Operational notes
- Production deployment is not yet authorized/ready; preview only.
- Do not treat this engineering preview as a production launch. Ordering, payments, live café operations, and integrations remain disabled.
- Dependency vulnerability review remains a separate security task; do not force breaking framework upgrades to silence advisories.
