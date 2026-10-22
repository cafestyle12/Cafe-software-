-- Phase 03 lifecycle RPCs: perform dependency checks and credential revocation atomically.
create or replace function public.deactivate_cafe_table(p_tenant_id uuid, p_branch_id uuid, p_table_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_tenant_permission(p_tenant_id, 'branch.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  perform 1 from public.branches b where b.id=p_branch_id and b.tenant_id=p_tenant_id and b.status='active' for update;
  if not found then raise exception 'branch_unavailable' using errcode='P0002'; end if;
  perform 1 from public.cafe_tables t where t.id=p_table_id and t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.status='active' for update;
  if not found then raise exception 'table_unavailable' using errcode='P0002'; end if;
  if exists (select 1 from public.table_sessions s where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.table_id=p_table_id and s.status='active' and s.expires_at>now()) then
    raise exception 'active_table_session' using errcode='55000';
  end if;
  update public.table_qr_credentials q set status='revoked', revoked_at=now()
    where q.tenant_id=p_tenant_id and q.branch_id=p_branch_id and q.table_id=p_table_id and q.status='active';
  update public.cafe_tables set status='inactive', updated_at=now()
    where id=p_table_id and tenant_id=p_tenant_id and branch_id=p_branch_id;
end;
$$;
revoke all on function public.deactivate_cafe_table(uuid,uuid,uuid) from public, anon;
grant execute on function public.deactivate_cafe_table(uuid,uuid,uuid) to authenticated;

create or replace function public.deactivate_seating_zone(p_tenant_id uuid, p_branch_id uuid, p_zone_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_tenant_permission(p_tenant_id, 'branch.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if exists (select 1 from public.cafe_tables t where t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.zone_id=p_zone_id and t.status='active') then
    raise exception 'zone_has_active_tables' using errcode='55000';
  end if;
  update public.seating_zones set status='inactive', updated_at=now()
    where id=p_zone_id and tenant_id=p_tenant_id and branch_id=p_branch_id and status='active';
  if not found then raise exception 'zone_unavailable' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.deactivate_seating_zone(uuid,uuid,uuid) from public, anon;
grant execute on function public.deactivate_seating_zone(uuid,uuid,uuid) to authenticated;

create or replace function public.deactivate_cafe_branch(p_tenant_id uuid, p_branch_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_tenant_permission(p_tenant_id, 'branch.manage') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  perform 1 from public.branches b where b.id=p_branch_id and b.tenant_id=p_tenant_id and b.status='active' for update;
  if not found then raise exception 'branch_unavailable' using errcode='P0002'; end if;
  if exists (select 1 from public.table_sessions s where s.tenant_id=p_tenant_id and s.branch_id=p_branch_id and s.status='active' and s.expires_at>now()) then
    raise exception 'active_table_session' using errcode='55000';
  end if;
  update public.table_qr_credentials set status='revoked', revoked_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and status='active';
  update public.cafe_tables set status='inactive', updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and status='active';
  update public.seating_zones set status='inactive', updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and status='active';
  update public.branches set status='inactive', updated_at=now()
    where id=p_branch_id and tenant_id=p_tenant_id;
end;
$$;
revoke all on function public.deactivate_cafe_branch(uuid,uuid) from public, anon;
grant execute on function public.deactivate_cafe_branch(uuid,uuid) to authenticated;
