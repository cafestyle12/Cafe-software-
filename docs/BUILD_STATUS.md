# CafeOS Build Status

Last updated: 2026-10-22

## Current phase
- Phase 00 — Complete.
- Phase 01 — Complete. Engineering foundation and CI acceptance checks passed.
- Phase 02 — In progress. Authentication routes, workspace onboarding, tenant/branch schema, permission model, RLS, invitation acceptance, member disable/revoke actions, and audit foundation are implemented; CI run #38 passed (install, lint, typecheck, unit tests, production build); transactional RLS negative tests also passed. Email-flow end-to-end testing and session-revocation checks remain open.
- Phases 03–16 — Not started.

## Verified environment facts
- GitHub repository: cafestyle12/Cafe-software-; public; default branch main.
- Phase 02 work is isolated on branch phase-02/auth-multitenancy pending review.
- Supabase project selected for CafeOS: pryajliswtltcnbvcoiw; region ap-south-1.
- User confirmed Vercel is connected. Deployment remains explicitly deferred; no deployment or production environment configuration was triggered.
- No production credentials or customer data were committed. The Phase 02 schema contains no tenant/member/customer rows; the global permission catalogue contains eight entries.

## Phase 02 implementation
- Supabase Auth sign-in, registration, sign-out, email confirmation, password recovery, and password update flows.
- HttpOnly session cookies; request middleware validates access tokens and refreshes expired sessions; server-side requests use no-store caching.
- Atomic workspace + first-branch onboarding; India-first defaults (Asia/Kolkata, INR).
- Profiles, tenants, branches, memberships, branch memberships, roles, granular permissions, membership invitations with email delivery/acceptance actions, member disable/revoke actions, and append-only audit events.
- RLS enabled and forced on all eleven public tables. Policies use tenant membership, permission checks, and branch scope.
- Tenant owner and default roles are provisioned by a database trigger. System roles are protected from ordinary role CRUD; role assignment changes require roles.manage; manager invitation policies cannot assign roles carrying roles.manage.
- Security helper functions are in the private schema with fixed search paths and restricted execute grants.
- SQL migration history in the connected Supabase project: phase_02_auth_tenants_rbac, phase_02_fix_tenant_owner_seed, phase_02_atomic_onboarding_and_role_guard, phase_02_security_performance_hardening, phase_02_protect_owner_membership, phase_02_invite_acceptance_rpc, phase_02_tenant_profile_visibility, phase_02_consolidate_profile_read_policy.
- Security advisor returned no findings after the Phase 02 migrations. Performance advisor has only unused-index informational notices, expected before any tenant data/query workload exists.
- Transactional SQL security test passed against the connected project: tenant A/B isolation, cross-tenant branch insert denial, owner-membership protection, manager role-assignment boundary, and prevention of manager-created owner invitations. All fixture rows were rolled back.

## Verification still required before Phase 02 acceptance
- Latest recorded CI run #38 passed on commit 8d6eeaca5bd739a9d22e2307085d4d4d94ece825. A later commit adds only the transactional SQL test script and does not change TypeScript runtime code.
- Complete end-to-end test with email confirmation and recovery links using the actual Supabase Auth email configuration.
- Transactional RLS tests passed using three simulated authenticated identities. Full browser/session integration and branch-scoped membership tests remain open.
- Invitation delivery/acceptance and member disable/revoke workflows are implemented but still require end-to-end tests with a configured server-only Supabase secret key and a test inbox.
- Session revocation, role-boundary tests, and production abuse/rate-limit review remain open.

## Operational notes
- Deployment is intentionally deferred.
- Do not treat this engineering preview as a production launch. Ordering, payments, live café operations, and integrations remain disabled.
- Dependency vulnerability review remains a separate security task; do not force breaking framework upgrades to silence advisories.
