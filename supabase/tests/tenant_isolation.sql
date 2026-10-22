-- Transactional RLS negative tests for Phase 02.
-- Safe to run against a test project: all fixture rows are rolled back.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
 ('a1000000-0000-4000-8000-000000000001','authenticated','authenticated','cafeos-rls-owner-a@example.invalid','',now(),'{"full_name":"RLS Owner A"}',now(),now()),
 ('b2000000-0000-4000-8000-000000000002','authenticated','authenticated','cafeos-rls-owner-b@example.invalid','',now(),'{"full_name":"RLS Owner B"}',now(),now()),
 ('c3000000-0000-4000-8000-000000000003','authenticated','authenticated','cafeos-rls-manager-a@example.invalid','',now(),'{"full_name":"RLS Manager A"}',now(),now());

insert into public.tenants (id,name,slug,created_by)
values
 ('a1000000-0000-4000-8000-000000000101','RLS Test Workspace A','rls-test-workspace-a','a1000000-0000-4000-8000-000000000001'),
 ('b2000000-0000-4000-8000-000000000202','RLS Test Workspace B','rls-test-workspace-b','b2000000-0000-4000-8000-000000000002');

insert into public.branches (id,tenant_id,name)
values
 ('a1000000-0000-4000-8000-000000000111','a1000000-0000-4000-8000-000000000101','Branch A'),
 ('b2000000-0000-4000-8000-000000000222','b2000000-0000-4000-8000-000000000202','Branch B'),
 ('a1000000-0000-4000-8000-000000000112','a1000000-0000-4000-8000-000000000101','Branch A2');

insert into public.memberships (tenant_id,user_id,status)
values ('a1000000-0000-4000-8000-000000000101','c3000000-0000-4000-8000-000000000003','active');

insert into public.membership_roles (tenant_id,membership_id,role_id)
select m.tenant_id,m.id,r.id
from public.memberships m
join public.roles r on r.tenant_id=m.tenant_id and r.role_key='manager'
where m.tenant_id='a1000000-0000-4000-8000-000000000101'
  and m.user_id='c3000000-0000-4000-8000-000000000003';

insert into public.branch_memberships (tenant_id,branch_id,user_id,status)
values ('a1000000-0000-4000-8000-000000000101','a1000000-0000-4000-8000-000000000111','c3000000-0000-4000-8000-000000000003','active');

set local role authenticated;
set local request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000001';
do $$
begin
 if (select count(*) from public.tenants) <> 1 then raise exception 'FAIL: owner A did not see exactly one tenant'; end if;
 if exists (select 1 from public.tenants where id='b2000000-0000-4000-8000-000000000202') then raise exception 'FAIL: owner A can read tenant B'; end if;
 if exists (select 1 from public.branches where tenant_id='b2000000-0000-4000-8000-000000000202') then raise exception 'FAIL: owner A can read tenant B branches'; end if;
end
$$;

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b2000000-0000-4000-8000-000000000002';
do $$
begin
 if (select count(*) from public.tenants) <> 1 then raise exception 'FAIL: owner B did not see exactly one tenant'; end if;
 if exists (select 1 from public.tenants where id='a1000000-0000-4000-8000-000000000101') then raise exception 'FAIL: owner B can read tenant A'; end if;
end
$$;

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'c3000000-0000-4000-8000-000000000003';
do $$
declare affected integer; owner_membership uuid; owner_role uuid;
begin
 if (select count(*) from public.tenants) <> 1 then raise exception 'FAIL: manager A did not see exactly one tenant'; end if;
 if exists (select 1 from public.branches where tenant_id='b2000000-0000-4000-8000-000000000202') then raise exception 'FAIL: manager A can read tenant B branches'; end if;
 if exists (select 1 from public.branches where id='a1000000-0000-4000-8000-000000000112') then raise exception 'FAIL: branch-scoped manager can read an unassigned branch'; end if;
 if not exists (select 1 from public.branches where id='a1000000-0000-4000-8000-000000000111') then raise exception 'FAIL: branch-scoped manager cannot read assigned branch'; end if;

 begin
  insert into public.branches (tenant_id,name) values ('b2000000-0000-4000-8000-000000000202','Unauthorized branch');
  raise exception 'FAIL: cross-tenant branch insert unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;

 update public.memberships set status='disabled'
 where tenant_id='a1000000-0000-4000-8000-000000000101'
   and user_id='a1000000-0000-4000-8000-000000000001';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'FAIL: manager disabled the workspace owner'; end if;

 select id into owner_membership from public.memberships
 where tenant_id='a1000000-0000-4000-8000-000000000101'
   and user_id='a1000000-0000-4000-8000-000000000001';
 select id into owner_role from public.roles
 where tenant_id='a1000000-0000-4000-8000-000000000101' and role_key='owner';
 update public.membership_roles set role_id=owner_role
 where tenant_id='a1000000-0000-4000-8000-000000000101' and membership_id=owner_membership;
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'FAIL: manager modified owner role assignments'; end if;

 begin
  insert into public.membership_invites (tenant_id,email,role_id,invited_by,token_hash)
  values ('a1000000-0000-4000-8000-000000000101','rls-escalation@example.invalid',owner_role,'c3000000-0000-4000-8000-000000000003','rls-test-owner-role-escalation-token');
  raise exception 'FAIL: manager invited a new owner';
 exception when insufficient_privilege then null;
 end;
end
$$;
reset role;
rollback;
select 'PASS: tenant isolation, branch scoping, cross-tenant write denial, owner protection, and role escalation checks' as result;
