-- CafeOS Phase 02: fail-closed RLS guard for first-login password changes.
-- Additive and safe for existing tenant data. The signed JWT claim supplements
-- the server-controlled mapping flag during cross-system partial failures.
create or replace function private.is_tenant_member(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = target_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and t.status = 'active'
  )
  and coalesce((select auth.jwt()->'app_metadata'->>'must_change_password'), 'false') <> 'true'
  and not exists (
    select 1 from public.restaurant_auth_accounts a
    where a.auth_user_id = (select auth.uid())
      and (a.status <> 'active' or a.must_change_password)
  )
$function$;

revoke all on function private.is_tenant_member(uuid) from public, anon;
grant execute on function private.is_tenant_member(uuid) to authenticated;
