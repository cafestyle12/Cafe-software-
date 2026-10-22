# CafeOS Database — Phase 02 Restaurant Authentication

## Existing schema preserved

The existing Phase 02 schema remains in place: profiles, tenants, branches, memberships, branch_memberships, roles, permissions, role_permissions, membership_roles, membership_invites and audit_events. The migration is additive and does not drop or truncate existing records.

## New objects

- public.restaurant_auth_accounts: one Restaurant ID-to-Supabase Auth identity mapping per tenant; unique Restaurant ID, Auth user ID and internal alias; status and first-login/password-reset metadata. RLS is enabled and privileges are revoked from public, anon and authenticated. Server service role only.
- public.auth_attempt_windows: hashed per-restaurant/per-IP rate-limit buckets. It stores only a one-way hash, attempt count and time window/lock metadata; no raw IP or Restaurant ID.
- public.consume_cafeos_auth_attempts(text[]): service-role-only atomic attempt counter, 5 allowed attempts per 15-minute window followed by a 15-minute lock.
- public.clear_cafeos_auth_attempts(text[]): service-role-only cleanup after successful login.
- public.admin_provision_restaurant(...): service-role-only transactional tenant + branch + owner mapping provisioning. It relies on the existing tenant trigger to seed owner membership and role, then creates owner branch membership and audit event.
- public.admin_set_restaurant_status(uuid,text): service-role-only atomic update of mapping and tenant status plus an audit event.
- private.is_tenant_member(uuid) and private.has_tenant_permission(uuid,text) are replaced so RLS denies inactive tenants and restaurant owner accounts that are suspended/deactivated or still require a first-login password change.

## Migration safety

Migration file: supabase/migrations/20261022091308_phase_02_restaurant_id_auth.sql

The migration adds tables, functions, grants and function replacements only. It does not change existing tenant data or Auth users. Existing email users without a mapping remain present but cannot sign in through the Restaurant ID flow until an administrator provisions a mapped owner account. The currently inspected database has zero tenant rows and two profile rows.

Rollback should not drop the new tables while accounts have been provisioned. A rollback plan must first disable Restaurant ID login and retain identity mappings/audit history; only remove new objects after confirming no restaurant accounts depend on them. Never delete Auth users as a general rollback step.

## Apply and verify

After code review and green CI, apply the migration to the intended Supabase project using the migration runner, then verify:
1. The migration appears in migration history.
2. restaurant_auth_accounts and auth_attempt_windows have RLS enabled.
3. anon/authenticated have no table privileges; service_role can execute the three admin/rate-limit RPCs.
4. A controlled test provisioning creates tenant, branch, owner membership, branch membership, mapping and audit event in one transaction.
5. A transaction with duplicate Restaurant ID fails without partial tenant or Auth-user residue.
6. First-login and suspended-account RLS checks deny access to tenant data.

Do not manually edit auth.users or store passwords in public tables.


## Applied migration verification — 2026-10-22
- Migration history contains version 20261022091308 named phase_02_restaurant_id_auth.
- Both new tables report RLS enabled; no anon/authenticated table grants were returned. Admin and rate-limit RPCs have EXECUTE for service_role only (plus postgres owner privileges).
- A transaction-only rate-limit test passed for five allowed attempts and a blocked sixth attempt; the transaction was rolled back so no test bucket remains.
- Supabase advisor notes no-policy informational findings for these intentional default-deny tables. This is expected; do not add public policies to make the warning disappear.


## Self-service tenant creation lockout
- Applied migration version 20261022092809 (phase_02_disable_self_service_tenant_creation) revokes EXECUTE on public.create_tenant_with_branch(text,text,text) from public, anon and authenticated, granting it only to service_role. This closes the direct-RPC bypass left behind when the UI onboarding route was disabled.
- Post-migration grant verification shows all four admin/rate-limit RPCs and the legacy tenant-creation RPC are executable only by service_role (plus postgres owner privileges, omitted from the role filter).


## Owner-only RLS boundary — migration 20261022093023
- The final RLS hardening migration requires both a verified Restaurant ID owner app_metadata claim and a matching active restaurant_auth_accounts row with must_change_password=false, plus active membership and active tenant status. This blocks legacy email-only sessions from reaching tenant data through direct Supabase REST calls.
- A rollback-only SQL test passed for: first-login owner denied; mapped active owner allowed; suspended owner denied; suspended tenant denied. The test tenant and mapping were rolled back and no test tenant was retained.


## First-login JWT guard migration — 2026-10-22

- Applied additive migration `20261022151000_phase_02_auth_first_login_claim_guard`.
- It updates `private.is_tenant_member(uuid)` to deny tenant membership when the signed JWT `app_metadata.must_change_password` claim is true, while preserving the required restaurant-owner claim, active tenant/membership/mapping checks, and `session_version` match.
- Reasserts execute grants: `private.is_tenant_member(uuid)` is not executable by public/anon and remains executable by authenticated users for policy evaluation.
- The migration is reversible by restoring the prior function definition from migration `20261022091308_phase_02_restaurant_id_auth`; no table or tenant data is dropped. Avoid rollback while restaurant credential accounts depend on the stricter guard without first reviewing their state.
