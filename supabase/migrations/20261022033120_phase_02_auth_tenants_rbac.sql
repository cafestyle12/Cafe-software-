-- CafeOS Phase 02: authentication, tenant boundaries, branches, memberships and RBAC.
-- Applied to the connected Supabase project as phase_02_auth_tenants_rbac.
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  locale text not null default 'en-IN',
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 80),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  timezone text not null default 'Asia/Kolkata',
  currency char(3) not null default 'INR' check (currency = 'INR'),
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id), unique (tenant_id, name)
);
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('invited','active','disabled','revoked')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, user_id), unique (tenant_id, id)
);
create table public.branch_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, branch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','disabled','revoked')),
  created_at timestamptz not null default now(),
  unique (tenant_id, branch_id, user_id),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete cascade,
  foreign key (tenant_id, user_id) references public.memberships(tenant_id, user_id) on delete cascade
);
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role_key text not null check (role_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null, is_system boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, role_key), unique (tenant_id, id)
);
create table public.permissions (
  permission_key text primary key check (permission_key ~ '^[a-z][a-z0-9_.]{1,80}$'),
  description text not null
);
create table public.role_permissions (
  tenant_id uuid not null, role_id uuid not null,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(), primary key (role_id, permission_key),
  foreign key (tenant_id, role_id) references public.roles(tenant_id, id) on delete cascade
);
create table public.membership_roles (
  tenant_id uuid not null, membership_id uuid not null, role_id uuid not null,
  created_at timestamptz not null default now(), primary key (membership_id, role_id),
  foreign key (tenant_id, membership_id) references public.memberships(tenant_id, id) on delete cascade,
  foreign key (tenant_id, role_id) references public.roles(tenant_id, id) on delete cascade
);
create table public.membership_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null check (length(email) <= 320 and email = lower(trim(email))),
  role_id uuid not null, invited_by uuid not null references auth.users(id),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz, created_at timestamptz not null default now(),
  foreign key (tenant_id, role_id) references public.roles(tenant_id, id) on delete cascade
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid, actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 2 and 100),
  entity_type text not null check (length(entity_type) between 2 and 80),
  entity_id text, reason text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id)
);

create index memberships_user_status_idx on public.memberships(user_id, status);
create index branches_tenant_status_idx on public.branches(tenant_id, status);
create index branch_memberships_user_idx on public.branch_memberships(user_id, tenant_id, status);
create index membership_invites_tenant_status_idx on public.membership_invites(tenant_id, status, expires_at);
create index audit_events_tenant_created_idx on public.audit_events(tenant_id, created_at desc);

insert into public.permissions(permission_key, description) values
 ('tenant.read','View café workspace settings'),('tenant.manage','Manage café workspace settings'),
 ('branch.read','View branch configuration'),('branch.manage','Create and update branches'),
 ('members.read','View workspace members'),('members.manage','Invite, disable and revoke members'),
 ('roles.manage','Manage member roles and permissions'),('audit.read','View workspace audit events')
on conflict (permission_key) do nothing;

create or replace function private.is_tenant_member(target_tenant uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.memberships m where m.tenant_id = target_tenant and m.user_id = (select auth.uid()) and m.status = 'active') $$;
create or replace function private.has_tenant_permission(target_tenant uuid, needed_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.memberships m
   join public.membership_roles mr on mr.tenant_id = m.tenant_id and mr.membership_id = m.id
   join public.role_permissions rp on rp.tenant_id = mr.tenant_id and rp.role_id = mr.role_id
   where m.tenant_id = target_tenant and m.user_id = (select auth.uid())
     and m.status = 'active' and rp.permission_key = needed_permission
 )
$$;
create or replace function private.can_access_branch(target_tenant uuid, target_branch uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select private.is_tenant_member(target_tenant)
 and exists (select 1 from public.branches b where b.tenant_id = target_tenant and b.id = target_branch and b.status = 'active')
 and (
   not exists (select 1 from public.branch_memberships bm where bm.tenant_id = target_tenant and bm.user_id = (select auth.uid()) and bm.status = 'active')
   or exists (select 1 from public.branch_memberships bm where bm.tenant_id = target_tenant and bm.branch_id = target_branch and bm.user_id = (select auth.uid()) and bm.status = 'active')
 )
$$;
revoke all on function private.is_tenant_member(uuid) from public, anon;
revoke all on function private.has_tenant_permission(uuid,text) from public, anon;
revoke all on function private.can_access_branch(uuid,uuid) from public, anon;
grant execute on function private.is_tenant_member(uuid) to authenticated;
grant execute on function private.has_tenant_permission(uuid,text) to authenticated;
grant execute on function private.can_access_branch(uuid,uuid) to authenticated;

create or replace function private.seed_tenant_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare owner_membership_id uuid; owner_role_id uuid; manager_role_id uuid; staff_role_id uuid;
begin
 insert into public.roles(tenant_id, role_key, name) values (new.id,'owner','Owner') returning id into owner_role_id;
 insert into public.roles(tenant_id, role_key, name) values (new.id,'manager','Manager') returning id into manager_role_id;
 insert into public.roles(tenant_id, role_key, name) values (new.id,'staff','Staff') returning id into staff_role_id;
 insert into public.role_permissions(tenant_id, role_id, permission_key) select new.id, owner_role_id, permission_key from public.permissions;
 insert into public.role_permissions(tenant_id, role_id, permission_key) values
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
create trigger tenants_seed_owner_after_insert after insert on public.tenants for each row execute function private.seed_tenant_owner();

create or replace function private.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.profiles(user_id,display_name)
 values (new.id,coalesce(new.raw_user_meta_data ->> 'full_name',new.raw_user_meta_data ->> 'name',''))
 on conflict (user_id) do nothing;
 return new;
end
$$;
revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
create trigger auth_user_profile_after_insert after insert on auth.users for each row execute function private.create_profile_for_auth_user();

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.branches enable row level security;
alter table public.memberships enable row level security;
alter table public.branch_memberships enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_roles enable row level security;
alter table public.membership_invites enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles read self" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles update self" on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tenants read member" on public.tenants for select to authenticated using (private.is_tenant_member(id));
create policy "tenants create own" on public.tenants for insert to authenticated with check (created_by = (select auth.uid()));
create policy "tenants update managers" on public.tenants for update to authenticated using (private.has_tenant_permission(id,'tenant.manage')) with check (private.has_tenant_permission(id,'tenant.manage'));
create policy "branches read allowed" on public.branches for select to authenticated using (private.can_access_branch(tenant_id,id));
create policy "branches create managers" on public.branches for insert to authenticated with check (private.has_tenant_permission(tenant_id,'branch.manage'));
create policy "branches update managers" on public.branches for update to authenticated using (private.has_tenant_permission(tenant_id,'branch.manage')) with check (private.has_tenant_permission(tenant_id,'branch.manage'));
create policy "memberships read self or admins" on public.memberships for select to authenticated using (user_id = (select auth.uid()) or private.has_tenant_permission(tenant_id,'members.read'));
create policy "memberships update admins" on public.memberships for update to authenticated using (private.has_tenant_permission(tenant_id,'members.manage')) with check (private.has_tenant_permission(tenant_id,'members.manage'));
create policy "branch memberships read allowed" on public.branch_memberships for select to authenticated using (user_id = (select auth.uid()) or private.has_tenant_permission(tenant_id,'members.read'));
create policy "branch memberships manage admins" on public.branch_memberships for all to authenticated using (private.has_tenant_permission(tenant_id,'members.manage')) with check (private.has_tenant_permission(tenant_id,'members.manage'));
create policy "roles read members" on public.roles for select to authenticated using (private.is_tenant_member(tenant_id));
create policy "roles manage owners" on public.roles for all to authenticated using (private.has_tenant_permission(tenant_id,'roles.manage')) with check (private.has_tenant_permission(tenant_id,'roles.manage'));
create policy "permissions read authenticated" on public.permissions for select to authenticated using (true);
create policy "role permissions read members" on public.role_permissions for select to authenticated using (private.is_tenant_member(tenant_id));
create policy "role permissions manage owners" on public.role_permissions for all to authenticated using (private.has_tenant_permission(tenant_id,'roles.manage')) with check (private.has_tenant_permission(tenant_id,'roles.manage'));
create policy "membership roles read members" on public.membership_roles for select to authenticated using (private.is_tenant_member(tenant_id));
create policy "membership roles manage admins" on public.membership_roles for all to authenticated using (private.has_tenant_permission(tenant_id,'members.manage')) with check (private.has_tenant_permission(tenant_id,'members.manage'));
create policy "invites read admins" on public.membership_invites for select to authenticated using (private.has_tenant_permission(tenant_id,'members.read'));
create policy "invites manage admins" on public.membership_invites for all to authenticated using (private.has_tenant_permission(tenant_id,'members.manage')) with check (private.has_tenant_permission(tenant_id,'members.manage'));
create policy "audit read allowed" on public.audit_events for select to authenticated using (private.has_tenant_permission(tenant_id,'audit.read'));
create policy "audit insert as actor" on public.audit_events for insert to authenticated with check (actor_id = (select auth.uid()) and private.is_tenant_member(tenant_id));

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.tenants to authenticated;
grant select, insert, update on public.branches to authenticated;
grant select, update on public.memberships to authenticated;
grant select, insert, update, delete on public.branch_memberships to authenticated;
grant select, insert, update, delete on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant select, insert, update, delete on public.membership_roles to authenticated;
grant select, insert, update, delete on public.membership_invites to authenticated;
grant select, insert on public.audit_events to authenticated;

alter table public.profiles force row level security;
alter table public.tenants force row level security;
alter table public.branches force row level security;
alter table public.memberships force row level security;
alter table public.branch_memberships force row level security;
alter table public.roles force row level security;
alter table public.permissions force row level security;
alter table public.role_permissions force row level security;
alter table public.membership_roles force row level security;
alter table public.membership_invites force row level security;
alter table public.audit_events force row level security;
