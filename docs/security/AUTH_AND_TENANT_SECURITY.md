# Phase 02 — Authentication and Tenant Security

## Authentication flow
- Supabase Auth is accessed over HTTPS using the project's publishable key and user-scoped bearer tokens.
- Passwords are never stored by CafeOS. Supabase Auth owns password hashing, email verification, recovery, and account identity.
- Access and refresh tokens are stored in HttpOnly, SameSite=Lax cookies; Secure is enabled in production.
- Request middleware validates the access token and attempts refresh only for a 401/403 response. Transient network failures do not clear the session.
- Server components revalidate the access token against the Auth API before rendering user-specific data. Authenticated fetches use cache: no-store.
- For the current preview, configure Supabase Auth Site URL and allowed redirect URLs for `https://cafe-software-git-phase-02-auth-multitenancy-edityyp.vercel.app`. The `/auth/confirm` endpoint validates token fragments with the Auth API or verifies a token hash server-side.
- Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and NEXT_PUBLIC_SITE_URL. Invite delivery/acceptance also requires SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY, server-only. Never put a secret/service-role key in a NEXT_PUBLIC_ variable.

## Tenant boundaries
- tenants.created_by is checked against auth.uid() on insert. A database trigger creates the initial active owner membership, workspace roles, and audit event.
- create_tenant_with_branch is a security-invoker RPC so table RLS remains active. It creates the workspace and first branch atomically.
- All tenant-owned rows use tenant_id; branches and audit_events enforce composite tenant/branch foreign keys.
- Every public-schema business table has RLS enabled and forced. Policies explicitly allow authenticated members.
- Private helper functions use a fixed empty search path and are not executable by anon or public. They centralize membership, permission, and branch-scope checks without recursive RLS lookups.
- Owner permissions are seeded from the permission catalogue. Manager permissions are narrower. Role assignment writes require roles.manage, and active owner memberships cannot be disabled by the ordinary membership-management policy.
- Branch-scoped members can only see explicitly assigned active branches. Users with no branch-assignment records and an active tenant membership can access all active branches in that tenant; disabled or revoked assignment records do not widen access.
- Audit events are append-only for authenticated users; no update/delete policy is provided.

## Current limitations / next checks
- Email delivery depends on the Supabase Auth SMTP and email-template settings. The preview branch URL and public Supabase environment variables are configured; the allowed redirect URL still needs confirmation in Supabase Auth settings.
- Invitation delivery/acceptance and member disable/revoke actions are implemented but need a server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in Vercel Preview plus end-to-end tests with a real test inbox.
- Custom role management and branch assignment UI, rate limits, abuse monitoring, session revocation, and production key rotation remain acceptance items.
- Transactional RLS negative tests were executed against the connected project with two tenant owners and a manager identity; cross-tenant reads/writes, unassigned-branch reads, and manager-to-owner escalation attempts were denied. Fixtures were rolled back.\n- Still test disabled/revoked memberships, explicit branch-scope assignments, expired confirmation links, recovery-link replay, invitation acceptance, and session refresh with actual browser sessions.
