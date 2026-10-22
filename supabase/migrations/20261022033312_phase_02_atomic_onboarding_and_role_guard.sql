-- CafeOS Phase 02 follow-up: atomic first-workspace onboarding and role escalation guard.
create or replace function public.create_tenant_with_branch(tenant_name text, tenant_slug text, branch_name text)
returns uuid language plpgsql security invoker set search_path = public
as $$
declare new_tenant_id uuid; new_branch_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if length(trim(tenant_name)) not between 2 and 120 then raise exception 'Workspace name must be 2 to 120 characters'; end if;
 if length(trim(branch_name)) not between 2 and 120 then raise exception 'Branch name must be 2 to 120 characters'; end if;
 if tenant_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(tenant_slug) not between 2 and 80 then raise exception 'Workspace slug must be lowercase letters, numbers and hyphens'; end if;
 insert into public.tenants(name,slug,created_by) values (trim(tenant_name),tenant_slug,auth.uid()) returning id into new_tenant_id;
 insert into public.branches(tenant_id,name) values (new_tenant_id,trim(branch_name)) returning id into new_branch_id;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity_type,entity_id)
 values (new_tenant_id,new_branch_id,auth.uid(),'branch.created','branch',new_branch_id::text);
 return new_tenant_id;
end
$$;
revoke all on function public.create_tenant_with_branch(text,text,text) from public, anon;
grant execute on function public.create_tenant_with_branch(text,text,text) to authenticated;

drop policy if exists "membership roles manage admins" on public.membership_roles;
create policy "membership roles manage owners" on public.membership_roles for all to authenticated
using (private.has_tenant_permission(tenant_id,'roles.manage'))
with check (private.has_tenant_permission(tenant_id,'roles.manage'));

create or replace function private.is_protected_owner(target_tenant uuid,target_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
  select 1 from public.memberships m
  join public.membership_roles mr on mr.tenant_id=m.tenant_id and mr.membership_id=m.id
  join public.roles r on r.tenant_id=mr.tenant_id and r.id=mr.role_id
  where m.tenant_id=target_tenant and m.user_id=target_user and m.status='active' and r.role_key='owner'
 )
$$;
revoke all on function private.is_protected_owner(uuid,uuid) from public, anon;
grant execute on function private.is_protected_owner(uuid,uuid) to authenticated;
drop policy if exists "memberships update admins" on public.memberships;
create policy "memberships update admins" on public.memberships for update to authenticated
using (private.has_tenant_permission(tenant_id,'members.manage') and not private.is_protected_owner(tenant_id,user_id))
with check (private.has_tenant_permission(tenant_id,'members.manage') and not private.is_protected_owner(tenant_id,user_id));
