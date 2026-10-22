-- Phase 02 hardening: immutable system roles, safer role assignments, and FK indexes.
drop policy if exists "roles manage owners" on public.roles;
create policy "roles insert custom roles" on public.roles for insert to authenticated
with check (private.has_tenant_permission(tenant_id,'roles.manage') and is_system = false);
create policy "roles update custom roles" on public.roles for update to authenticated
using (private.has_tenant_permission(tenant_id,'roles.manage') and is_system = false)
with check (private.has_tenant_permission(tenant_id,'roles.manage') and is_system = false);
create policy "roles delete custom roles" on public.roles for delete to authenticated
using (private.has_tenant_permission(tenant_id,'roles.manage') and is_system = false);

drop policy if exists "role permissions manage owners" on public.role_permissions;
create policy "role permissions insert custom roles" on public.role_permissions for insert to authenticated
with check (private.has_tenant_permission(tenant_id,'roles.manage') and exists (select 1 from public.roles r where r.tenant_id = role_permissions.tenant_id and r.id = role_permissions.role_id and r.is_system = false));
create policy "role permissions update custom roles" on public.role_permissions for update to authenticated
using (private.has_tenant_permission(tenant_id,'roles.manage') and exists (select 1 from public.roles r where r.tenant_id = role_permissions.tenant_id and r.id = role_permissions.role_id and r.is_system = false))
with check (private.has_tenant_permission(tenant_id,'roles.manage') and exists (select 1 from public.roles r where r.tenant_id = role_permissions.tenant_id and r.id = role_permissions.role_id and r.is_system = false));
create policy "role permissions delete custom roles" on public.role_permissions for delete to authenticated
using (private.has_tenant_permission(tenant_id,'roles.manage') and exists (select 1 from public.roles r where r.tenant_id = role_permissions.tenant_id and r.id = role_permissions.role_id and r.is_system = false));

drop policy if exists "membership roles manage owners" on public.membership_roles;
create policy "membership roles insert by owners" on public.membership_roles for insert to authenticated with check (private.has_tenant_permission(tenant_id,'roles.manage'));
create policy "membership roles update by owners" on public.membership_roles for update to authenticated using (private.has_tenant_permission(tenant_id,'roles.manage')) with check (private.has_tenant_permission(tenant_id,'roles.manage'));
create policy "membership roles delete by owners" on public.membership_roles for delete to authenticated using (private.has_tenant_permission(tenant_id,'roles.manage'));

drop policy if exists "branch memberships manage admins" on public.branch_memberships;
create policy "branch memberships insert admins" on public.branch_memberships for insert to authenticated with check (private.has_tenant_permission(tenant_id,'members.manage'));
create policy "branch memberships update admins" on public.branch_memberships for update to authenticated using (private.has_tenant_permission(tenant_id,'members.manage')) with check (private.has_tenant_permission(tenant_id,'members.manage'));
create policy "branch memberships delete admins" on public.branch_memberships for delete to authenticated using (private.has_tenant_permission(tenant_id,'members.manage'));

drop policy if exists "invites manage admins" on public.membership_invites;
create policy "invites insert admins" on public.membership_invites for insert to authenticated with check (private.has_tenant_permission(tenant_id,'members.manage'));
create policy "invites update admins" on public.membership_invites for update to authenticated using (private.has_tenant_permission(tenant_id,'members.manage')) with check (private.has_tenant_permission(tenant_id,'members.manage'));
create policy "invites delete admins" on public.membership_invites for delete to authenticated using (private.has_tenant_permission(tenant_id,'members.manage'));

create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id);
create index if not exists audit_events_tenant_branch_idx on public.audit_events(tenant_id, branch_id);
create index if not exists branch_memberships_tenant_user_idx on public.branch_memberships(tenant_id, user_id);
create index if not exists membership_invites_invited_by_idx on public.membership_invites(invited_by);
create index if not exists membership_invites_tenant_role_idx on public.membership_invites(tenant_id, role_id);
create index if not exists membership_roles_tenant_membership_idx on public.membership_roles(tenant_id, membership_id);
create index if not exists membership_roles_tenant_role_idx on public.membership_roles(tenant_id, role_id);
create index if not exists role_permissions_permission_idx on public.role_permissions(permission_key);
create index if not exists role_permissions_tenant_role_idx on public.role_permissions(tenant_id, role_id);
create index if not exists tenants_created_by_idx on public.tenants(created_by);
