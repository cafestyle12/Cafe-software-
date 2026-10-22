-- Phase 02: tenant access requires a provisioned restaurant-owner identity.
-- This prevents legacy email-only sessions or unprovisioned users from bypassing
-- the Restaurant ID login UI by calling Supabase REST/RLS directly.
create or replace function private.is_tenant_member(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (auth.jwt() -> 'app_metadata' ->> 'cafeos_account_type') = 'restaurant_owner'
  and exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    join public.restaurant_auth_accounts a
      on a.tenant_id = m.tenant_id
     and a.auth_user_id = m.user_id
    where m.tenant_id = target_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and t.status = 'active'
      and a.status = 'active'
      and a.must_change_password = false
  )
$function$;

revoke all on function private.is_tenant_member(uuid) from public, anon;
grant execute on function private.is_tenant_member(uuid) to authenticated;
