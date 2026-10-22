-- CafeOS Phase 02: restaurant-credential identity mapping and server-side auth throttling.
-- Additive migration: preserves existing auth users, tenant data, and existing policies.
create table public.restaurant_auth_accounts (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  restaurant_id text not null unique check (restaurant_id ~ '^CAFE-[A-Z0-9]{4}-[A-Z0-9]{8}$'),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  auth_email text not null unique check (auth_email ~ '^[a-f0-9]{32}@auth[.]cafeos[.]invalid$'),
  status text not null default 'active' check (status in ('active','suspended','deactivated')),
  must_change_password boolean not null default true,
  credential_reset_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.restaurant_auth_accounts enable row level security;
revoke all on table public.restaurant_auth_accounts from public, anon, authenticated;
grant all on table public.restaurant_auth_accounts to service_role;

create table public.auth_attempt_windows (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.auth_attempt_windows enable row level security;
revoke all on table public.auth_attempt_windows from public, anon, authenticated;
grant all on table public.auth_attempt_windows to service_role;

create or replace function public.consume_cafeos_auth_attempts(p_key_hashes text[])
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_key text;
  v_row public.auth_attempt_windows%rowtype;
  v_allowed boolean := true;
  v_remaining integer := 5;
  v_retry integer := 0;
begin
  if p_key_hashes is null or cardinality(p_key_hashes) < 1 or cardinality(p_key_hashes) > 3 then
    raise exception 'Invalid rate-limit keys' using errcode = '22023';
  end if;
  foreach v_key in array p_key_hashes loop
    if v_key !~ '^[a-f0-9]{64}$' then
      raise exception 'Invalid rate-limit key' using errcode = '22023';
    end if;
    insert into public.auth_attempt_windows(key_hash, attempts, window_started_at, locked_until)
    values (v_key, 1, now(), null)
    on conflict (key_hash) do update
      set attempts = case
            when public.auth_attempt_windows.window_started_at < now() - interval '15 minutes'
              then 1
            else public.auth_attempt_windows.attempts + 1
          end,
          window_started_at = case
            when public.auth_attempt_windows.window_started_at < now() - interval '15 minutes'
              then now()
            else public.auth_attempt_windows.window_started_at
          end,
          locked_until = case
            when public.auth_attempt_windows.window_started_at < now() - interval '15 minutes'
              then null
            when public.auth_attempt_windows.locked_until > now()
              then public.auth_attempt_windows.locked_until
            when public.auth_attempt_windows.attempts + 1 >= 6
              then now() + interval '15 minutes'
            else null
          end
    returning * into v_row;

    if v_row.locked_until is not null and v_row.locked_until > now() then
      v_allowed := false;
      v_retry := greatest(v_retry, ceil(extract(epoch from (v_row.locked_until - now())))::integer);
    end if;
    v_remaining := least(v_remaining, greatest(0, 5 - v_row.attempts));
  end loop;
  return query select v_allowed, case when v_allowed then v_remaining else 0 end, v_retry;
end;
$function$;

create or replace function public.clear_cafeos_auth_attempts(p_key_hashes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.auth_attempt_windows where key_hash = any(p_key_hashes);
end;
$function$;

create or replace function public.admin_provision_restaurant(
  p_restaurant_id text,
  p_auth_user_id uuid,
  p_auth_email text,
  p_name text,
  p_slug text,
  p_branch_name text,
  p_display_name text
)
returns table(tenant_id uuid, branch_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid;
  v_branch_id uuid;
  v_membership_id uuid;
begin
  if p_restaurant_id !~ '^CAFE-[A-Z0-9]{4}-[A-Z0-9]{8}$'
     or p_auth_email !~ '^[a-f0-9]{32}@auth[.]cafeos[.]invalid$'
     or p_name is null or length(trim(p_name)) not between 2 and 120
     or p_branch_name is null or length(trim(p_branch_name)) not between 2 and 120
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 2 and 80
     or not exists (select 1 from auth.users u where u.id = p_auth_user_id and u.email = p_auth_email)
  then
    raise exception 'Invalid provisioning request' using errcode = '22023';
  end if;

  insert into public.tenants(name, slug, created_by)
  values (trim(p_name), p_slug, p_auth_user_id)
  returning id into v_tenant_id;

  insert into public.branches(tenant_id, name)
  values (v_tenant_id, trim(p_branch_name))
  returning id into v_branch_id;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id = v_tenant_id and m.user_id = p_auth_user_id and m.status = 'active';

  if v_membership_id is null then
    raise exception 'Owner membership was not seeded' using errcode = '23514';
  end if;

  insert into public.branch_memberships(tenant_id, branch_id, user_id, status)
  values (v_tenant_id, v_branch_id, p_auth_user_id, 'active');

  insert into public.restaurant_auth_accounts(
    tenant_id, restaurant_id, auth_user_id, auth_email, status, must_change_password
  ) values (
    v_tenant_id, p_restaurant_id, p_auth_user_id, p_auth_email, 'active', true
  );

  insert into public.audit_events(tenant_id, branch_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_tenant_id, v_branch_id, null, 'platform.restaurant_provisioned', 'restaurant_auth_account', p_restaurant_id,
    jsonb_build_object('provisioning_method', 'platform_admin', 'first_login_password_change', true)
  );

  return query select v_tenant_id, v_branch_id;
end;
$function$;

revoke all on function public.consume_cafeos_auth_attempts(text[]) from public, anon, authenticated;
grant execute on function public.consume_cafeos_auth_attempts(text[]) to service_role;
revoke all on function public.clear_cafeos_auth_attempts(text[]) from public, anon, authenticated;
grant execute on function public.clear_cafeos_auth_attempts(text[]) to service_role;
revoke all on function public.admin_provision_restaurant(text, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_provision_restaurant(text, uuid, text, text, text, text, text) to service_role;


-- Existing RLS policies call these helpers. Gate owner data access against the
-- authoritative mapping row so suspended accounts and first-login owners cannot
-- reach normal tenant data, even if they manually request a protected URL.
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
  and not exists (
    select 1 from public.restaurant_auth_accounts a
    where a.auth_user_id = (select auth.uid())
      and (a.status <> 'active' or a.must_change_password)
  )
$function$;

create or replace function private.has_tenant_permission(target_tenant uuid, needed_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.is_tenant_member(target_tenant)
  and exists (
    select 1
    from public.memberships m
    join public.membership_roles mr on mr.tenant_id = m.tenant_id and mr.membership_id = m.id
    join public.role_permissions rp on rp.tenant_id = mr.tenant_id and rp.role_id = mr.role_id
    where m.tenant_id = target_tenant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and rp.permission_key = needed_permission
  )
$function$;

revoke all on function private.is_tenant_member(uuid) from public, anon;
grant execute on function private.is_tenant_member(uuid) to authenticated;
revoke all on function private.has_tenant_permission(uuid, text) from public, anon;
grant execute on function private.has_tenant_permission(uuid, text) to authenticated;


create or replace function public.admin_set_restaurant_status(p_tenant_id uuid, p_status text)
returns table(tenant_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_status not in ('active', 'suspended', 'deactivated') then
    raise exception 'Invalid restaurant status' using errcode = '22023';
  end if;
  update public.restaurant_auth_accounts
    set status = p_status, updated_at = now()
    where public.restaurant_auth_accounts.tenant_id = p_tenant_id;
  if not found then raise exception 'Restaurant account not found' using errcode = 'P0002'; end if;

  update public.tenants
    set status = case when p_status = 'deactivated' then 'closed' else p_status end,
        updated_at = now()
    where public.tenants.id = p_tenant_id;

  insert into public.audit_events(tenant_id, actor_id, action, entity_type, entity_id)
  values (p_tenant_id, null, 'platform.restaurant_status_changed', 'restaurant_auth_account', p_status);

  return query select p_tenant_id;
end;
$function$;
revoke all on function public.admin_set_restaurant_status(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_restaurant_status(uuid, text) to service_role;
