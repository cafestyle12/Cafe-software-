-- Atomic optimistic floor-plan save: prevents silent overwrites and validates all table IDs/coordinates.
create or replace function public.save_cafeos_floor_plan(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_expected_version integer,
  p_positions jsonb
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  current_version integer;
  next_version integer;
  item jsonb;
  table_uuid uuid;
  x_value numeric;
  y_value numeric;
  rotation_value integer;
  table_count integer := 0;
begin
  if auth.uid() is null or not private.has_tenant_permission(p_tenant_id, 'branch.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_positions is null or jsonb_typeof(p_positions) <> 'array' or jsonb_array_length(p_positions) > 200 then
    raise exception 'invalid_positions' using errcode = '22023';
  end if;

  insert into public.floor_plan_layouts(tenant_id, branch_id, version, updated_by)
  values (p_tenant_id, p_branch_id, 1, auth.uid())
  on conflict (tenant_id, branch_id) do nothing;

  select l.version into current_version
  from public.floor_plan_layouts l
  where l.tenant_id = p_tenant_id and l.branch_id = p_branch_id
  for update;
  if current_version is null or current_version <> p_expected_version then
    raise exception 'layout_conflict' using errcode = '40001';
  end if;

  for item in select value from jsonb_array_elements(p_positions) loop
    table_uuid := (item->>'id')::uuid;
    x_value := (item->>'x')::numeric;
    y_value := (item->>'y')::numeric;
    rotation_value := (item->>'rotation')::integer;
    if x_value is null or y_value is null or x_value < 0 or y_value < 0 or x_value > 10000 or y_value > 10000
       or rotation_value is null or rotation_value < 0 or rotation_value > 359 then
      raise exception 'invalid_position' using errcode = '22023';
    end if;
    update public.cafe_tables
      set x = x_value, y = y_value, rotation = rotation_value, updated_at = now()
      where id = table_uuid and tenant_id = p_tenant_id and branch_id = p_branch_id and status = 'active';
    if not found then raise exception 'table_not_in_branch' using errcode = '42501'; end if;
    table_count := table_count + 1;
  end loop;

  next_version := current_version + 1;
  update public.floor_plan_layouts
    set version = next_version, updated_by = auth.uid(), updated_at = now()
    where tenant_id = p_tenant_id and branch_id = p_branch_id;
  return next_version;
end;
$$;
revoke all on function public.save_cafeos_floor_plan(uuid,uuid,integer,jsonb) from public, anon;
grant execute on function public.save_cafeos_floor_plan(uuid,uuid,integer,jsonb) to authenticated;
