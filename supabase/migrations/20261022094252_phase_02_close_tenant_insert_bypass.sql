-- Phase 02: remove remaining client-side tenant creation bypasses and make
-- profile colleague visibility honor the restaurant-owner account gate.
revoke insert on table public.tenants from public, anon, authenticated;
grant insert on table public.tenants to service_role;

create or replace function private.shares_tenant(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = target_user
      and theirs.status = 'active'
      and private.is_tenant_member(mine.tenant_id)
  )
$function$;
revoke all on function private.shares_tenant(uuid) from public, anon;
grant execute on function private.shares_tenant(uuid) to authenticated;
