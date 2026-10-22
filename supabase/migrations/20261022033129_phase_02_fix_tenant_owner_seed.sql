-- Follow-up applied to the connected project to correct multi-row RETURNING behavior.
create or replace function private.seed_tenant_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare owner_membership_id uuid; owner_role_id uuid; manager_role_id uuid; staff_role_id uuid;
begin
 insert into public.roles(tenant_id,role_key,name) values (new.id,'owner','Owner') returning id into owner_role_id;
 insert into public.roles(tenant_id,role_key,name) values (new.id,'manager','Manager') returning id into manager_role_id;
 insert into public.roles(tenant_id,role_key,name) values (new.id,'staff','Staff') returning id into staff_role_id;
 insert into public.role_permissions(tenant_id,role_id,permission_key) select new.id,owner_role_id,permission_key from public.permissions;
 insert into public.role_permissions(tenant_id,role_id,permission_key) values
 (new.id,manager_role_id,'tenant.read'),(new.id,manager_role_id,'branch.read'),
 (new.id,manager_role_id,'branch.manage'),(new.id,manager_role_id,'members.read'),
 (new.id,manager_role_id,'members.manage'),(new.id,manager_role_id,'audit.read'),
 (new.id,staff_role_id,'tenant.read'),(new.id,staff_role_id,'branch.read');
 insert into public.memberships(tenant_id,user_id,status) values (new.id,new.created_by,'active') returning id into owner_membership_id;
 insert into public.membership_roles(tenant_id,membership_id,role_id) values (new.id,owner_membership_id,owner_role_id);
 insert into public.audit_events(tenant_id,actor_id,action,entity_type,entity_id) values (new.id,new.created_by,'tenant.created','tenant',new.id::text);
 return new;
end
$$;
revoke all on function private.seed_tenant_owner() from public, anon, authenticated;
