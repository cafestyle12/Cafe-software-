-- Atomic batch QR issuance: all requested table credentials are inserted or none are.
create or replace function public.issue_table_qr_batch(p_tenant_id uuid, p_branch_id uuid, p_items jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  item jsonb;
  table_uuid uuid;
  hash_value text;
  inserted_count integer := 0;
  seen uuid[] := array[]::uuid[];
begin
  if auth.uid() is null or not private.has_tenant_permission(p_tenant_id, 'branch.manage') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_batch_size' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    begin table_uuid := (item->>'table_id')::uuid;
    exception when others then raise exception 'invalid_table_id' using errcode='22023'; end;
    hash_value := item->>'token_hash';
    if hash_value is null or hash_value !~ '^[a-f0-9]{64}$' or table_uuid = any(seen) then
      raise exception 'invalid_batch_item' using errcode='22023';
    end if;
    seen := array_append(seen, table_uuid);
    perform 1 from public.cafe_tables t where t.id=table_uuid and t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.status='active' for update;
    if not found then raise exception 'table_unavailable' using errcode='P0002'; end if;
    if exists (select 1 from public.table_qr_credentials q where q.table_id=table_uuid and q.tenant_id=p_tenant_id and q.branch_id=p_branch_id and q.status='active') then
      raise exception 'active_qr_exists' using errcode='55000';
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_items) loop
    table_uuid := (item->>'table_id')::uuid;
    hash_value := item->>'token_hash';
    insert into public.table_qr_credentials(tenant_id,branch_id,table_id,token_hash,created_by,status)
    values(p_tenant_id,p_branch_id,table_uuid,hash_value,auth.uid(),'active');
    inserted_count := inserted_count + 1;
  end loop;
  return inserted_count;
end;
$$;
revoke all on function public.issue_table_qr_batch(uuid,uuid,jsonb) from public, anon;
grant execute on function public.issue_table_qr_batch(uuid,uuid,jsonb) to authenticated;
