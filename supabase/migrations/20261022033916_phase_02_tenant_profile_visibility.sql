create or replace function private.shares_tenant(target_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.memberships mine
   join public.memberships theirs on theirs.tenant_id = mine.tenant_id
   where mine.user_id = (select auth.uid()) and mine.status = 'active'
     and theirs.user_id = target_user and theirs.status = 'active'
 )
$$;
revoke all on function private.shares_tenant(uuid) from public, anon;
grant execute on function private.shares_tenant(uuid) to authenticated;
create policy "profiles read tenant colleagues" on public.profiles
for select to authenticated using (private.shares_tenant(user_id));
