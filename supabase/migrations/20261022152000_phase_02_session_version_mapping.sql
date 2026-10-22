-- Add server-controlled session-version revocation for Restaurant ID accounts.
-- Additive: existing accounts receive a fresh version during administrator reset/provisioning.
alter table public.restaurant_auth_accounts
  add column if not exists session_version uuid not null default gen_random_uuid();

create or replace function public.admin_provision_restaurant(
  p_restaurant_id text,
  p_auth_user_id uuid,
  p_auth_email text,
  p_name text,
  p_slug text,
  p_branch_name text,
  p_display_name text,
  p_session_version uuid
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
     or p_session_version is null
     or p_name is null or length(trim(p_name)) not between 2 and 120
     or p_branch_name is null or length(trim(p_branch_name)) not between 2 and 120
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 2 and 80
     or not exists (select 1 from auth.users u where u.id = p_auth_user_id and u.email = p_auth_email)
  then raise exception 'Invalid provisioning request' using errcode = '22023'; end if;

  insert into public.tenants(name, slug, created_by)
  values (trim(p_name), p_slug, p_auth_user_id)
  returning id into v_tenant_id;

  insert into public.branches(tenant_id, name)
  values (v_tenant_id, trim(p_branch_name))
  returning id into v_branch_id;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id = v_tenant_id and m.user_id = p_auth_user_id and m.status = 'active';
  if v_membership_id is null then raise exception 'Owner membership was not seeded' using errcode = '23514'; end if;

  insert into public.branch_memberships(tenant_id, branch_id, user_id, status)
  values (v_tenant_id, v_branch_id, p_auth_user_id, 'active');

  insert into public.restaurant_auth_accounts(tenant_id, restaurant_id, auth_user_id, auth_email, status, must_change_password, session_version)
  values (v_tenant_id, p_restaurant_id, p_auth_user_id, p_auth_email, 'active', true, p_session_version);

  insert into public.audit_events(tenant_id, branch_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_tenant_id, v_branch_id, null, 'platform.restaurant_provisioned', 'restaurant_auth_account', p_restaurant_id,
    jsonb_build_object('provisioning_method', 'platform_admin', 'first_login_password_change', true));

  return query select v_tenant_id, v_branch_id;
end;
$function$;

revoke all on function public.admin_provision_restaurant(text, uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_provision_restaurant(text, uuid, text, text, text, text, text, uuid) to service_role;

create or replace function public.admin_set_restaurant_status(p_tenant_id uuid, p_status text, p_session_version uuid)
returns table(tenant_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_status not in ('active', 'suspended', 'deactivated') or p_session_version is null then
    raise exception 'Invalid restaurant status' using errcode = '22023';
  end if;
  update public.restaurant_auth_accounts
    set status = p_status, session_version = p_session_version, updated_at = now()
    where public.restaurant_auth_accounts.tenant_id = p_tenant_id;
  if not found then raise exception 'Restaurant account not found' using errcode = 'P0002'; end if;
  update public.tenants
    set status = case when p_status = 'deactivated' then 'closed' else p_status end, updated_at = now()
    where public.tenants.id = p_tenant_id;
  insert into public.audit_events(tenant_id, actor_id, action, entity_type, entity_id)
  values (p_tenant_id, null, 'platform.restaurant_status_changed', 'restaurant_auth_account', p_status);
  return query select p_tenant_id;
end;
$function$;
revoke all on function public.admin_set_restaurant_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_set_restaurant_status(uuid, text, uuid) to service_role;
