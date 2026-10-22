# Phase 02 — Authentication and Tenant Security

## Authentication flow
- Supabase Auth is accessed over HTTPS using the project's publishable key and user-scoped bearer tokens.
- Passwords are never stored by CafeOS. Supabase Auth owns password hashing, email verification, recovery, and account identity.
- Access and refresh tokens are stored in HttpOnly, SameSite=Lax cookies; Secure is enabled in production.
- Request middleware validates the access token and attempts refresh only for a 401/403 response. Transient network failures do not clear the session.
- Server components revalidate the access token against the Auth API before rendering user-specific data. Authenticated fetches use cache: no-store.
- Configure Supabase Auth's Site URL and allowed redirect URLs for each local/staging origin. The /auth/confirm endpoint accepts supported Auth token types and delegates token verification to Supabase.
- Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and NEXT_PUBLIC_SITE_URL. Only the URL and publishable key are public configuration. Never put a secret/service-role key in a NEXT_PUBLIC_ variable.

## Tenant boundaries
- tenants.created_by is checked against auth.uid() on insert. A database trigger creates the initial active owner membership, workspace roles, and audit event.
- create_tenant_with_branch is a security-invoker RPC so table RLS remains active. It creates the workspace and first branch atomically.
- All tenant-owned rows use tenant_id; branches and audit_events enforce composite tenant/branch foreign keys.
- Every public-schema business table has RLS enabled and forced. Policies explicitly allow authenticated members.
- Private helper functions use a fixed empty search path and are not executable by anon or public. They centralize membership, permission, and branch-scope checks without recursive RLS lookups.
- Owner permissions are seeded from the permission catalogue. Manager permissions are narrower. Role assignment writes require roles.manage, and active owner memberships cannot be disabled by the ordinary membership-management policy.
- Branch-scoped members can only see explicitly assigned branches once they have at least one active branch assignment. Users without branch assignments and with an active tenant membership can access all active branches in that tenant.
- Audit events are append-only for authenticated users; no update/delete policy is provided.

## Current limitations / next checks
- Email delivery depends on the Supabase Auth SMTP and email-template settings.
- Invitation delivery and acceptance need end-to-end tests with a real test inbox before being considered production-ready.
- Role-management UI, branch assignment UI, account disabling/revocation flows, rate limits, abuse monitoring, and production key rotation remain acceptance items.
- Test with at least two users in different tenants: tenant A must never read, mutate, or infer tenant B's rows. Also test disabled/revoked memberships, role escalation attempts, branch-scope enforcement, expired confirmation links, recovery-link replay, and session refresh.
