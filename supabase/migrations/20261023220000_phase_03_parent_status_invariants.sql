-- Enforce active branch/zone invariants inside the database, including concurrent inserts.
create or replace function public.validate_cafe_table_parent_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  branch_status text;
  zone_status text;
begin
  select b.status into branch_status
    from public.branches b
    where b.id=new.branch_id and b.tenant_id=new.tenant_id
    for key share;
  if branch_status is distinct from 'active' then
    raise exception 'branch_unavailable' using errcode='23514';
  end if;

  if new.zone_id is not null then
    select z.status into zone_status
      from public.seating_zones z
      where z.id=new.zone_id and z.tenant_id=new.tenant_id and z.branch_id=new.branch_id
      for key share;
    if zone_status is distinct from 'active' then
      raise exception 'zone_unavailable' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_cafe_table_parent_status() from public, anon, authenticated;
drop trigger if exists cafe_tables_validate_parent_status on public.cafe_tables;
create trigger cafe_tables_validate_parent_status
before insert or update of tenant_id,branch_id,zone_id,status
on public.cafe_tables
for each row execute function public.validate_cafe_table_parent_status();

create or replace function public.deactivate_seating_zone(p_tenant_id uuid, p_branch_id uuid, p_zone_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_tenant_permission(p_tenant_id,'branch.manage') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  perform 1 from public.branches b where b.id=p_branch_id and b.tenant_id=p_tenant_id and b.status='active' for update;
  if not found then raise exception 'branch_unavailable' using errcode='P0002'; end if;
  -- Table inserts take KEY SHARE on the zone in the trigger; this lock closes the deactivation race.
  perform 1 from public.seating_zones z where z.id=p_zone_id and z.tenant_id=p_tenant_id and z.branch_id=p_branch_id and z.status='active' for update;
  if not found then raise exception 'zone_unavailable' using errcode='P0002'; end if;
  if exists(select 1 from public.cafe_tables t where t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.zone_id=p_zone_id and t.status='active') then
    raise exception 'zone_has_active_tables' using errcode='55000';
  end if;
  update public.seating_zones set status='inactive',updated_at=now()
    where id=p_zone_id and tenant_id=p_tenant_id and branch_id=p_branch_id;
end;
$$;
revoke all on function public.deactivate_seating_zone(uuid,uuid,uuid) from public,anon;
grant execute on function public.deactivate_seating_zone(uuid,uuid,uuid) to authenticated;
