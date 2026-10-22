create or replace function private.is_protected_owner_membership(target_tenant uuid, target_membership uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
  select 1 from public.memberships m
  join public.membership_roles mr on mr.tenant_id = m.tenant_id and mr.membership_id = m.id
  join public.roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id
  where m.tenant_id = target_tenant and m.id = target_membership
    and m.status = 'active' and r.role_key = 'owner'
 )
$$;
revoke all on function private.is_protected_owner_membership(uuid,uuid) from public, anon;
grant execute on function private.is_protected_owner_membership(uuid,uuid) to authenticated;

drop policy if exists "membership roles update by owners" on public.membership_roles;
create policy "membership roles update by owners" on public.membership_roles for update to authenticated
using (private.has_tenant_permission(tenant_id,'roles.manage') and not private.is_protected_owner_membership(tenant_id,membership_id))
with check (private.has_tenant_permission(tenant_id,'roles.manage'));
drop policy if exists "membership roles delete by owners" on public.membership_roles;
create policy "membership roles delete by owners" on public.membership_roles for delete to authenticated
using (private.has_tenant_permission(tenant_id,'roles.manage') and not private.is_protected_owner_membership(tenant_id,membership_id));

drop policy if exists "invites insert admins" on public.membership_invites;
create policy "invites insert admins" on public.membership_invites for insert to authenticated
with check (private.has_tenant_permission(tenant_id,'members.manage') and (
 private.has_tenant_permission(tenant_id,'roles.manage')
 or not exists (select 1 from public.role_permissions rp where rp.tenant_id = membership_invites.tenant_id and rp.role_id = membership_invites.role_id and rp.permission_key = 'roles.manage')
));
drop policy if exists "invites update admins" on public.membership_invites;
create policy "invites update admins" on public.membership_invites for update to authenticated
using (private.has_tenant_permission(tenant_id,'members.manage'))
with check (private.has_tenant_permission(tenant_id,'members.manage') and (
 private.has_tenant_permission(tenant_id,'roles.manage')
 or not exists (select 1 from public.role_permissions rp where rp.tenant_id = membership_invites.tenant_id and rp.role_id = membership_invites.role_id and rp.permission_key = 'roles.manage')
));
