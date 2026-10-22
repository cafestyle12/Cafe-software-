create or replace function private.can_access_branch(target_tenant uuid, target_branch uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select private.is_tenant_member(target_tenant)
 and exists (select 1 from public.branches b where b.tenant_id=target_tenant and b.id=target_branch and b.status='active')
 and (
   not exists (select 1 from public.branch_memberships bm where bm.tenant_id=target_tenant and bm.user_id=(select auth.uid()))
   or exists (select 1 from public.branch_memberships bm where bm.tenant_id=target_tenant and bm.branch_id=target_branch and bm.user_id=(select auth.uid()) and bm.status='active')
 )
$$;
revoke all on function private.can_access_branch(uuid,uuid) from public, anon;
grant execute on function private.can_access_branch(uuid,uuid) to authenticated;
