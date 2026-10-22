-- Final Phase 03 database hardening: index operational foreign keys and narrow table policies/RPC grants.
create index if not exists cafe_tables_tenant_branch_zone_fk_idx on public.cafe_tables(tenant_id,branch_id,zone_id);
create index if not exists floor_plan_layouts_updated_by_fk_idx on public.floor_plan_layouts(updated_by) where updated_by is not null;
create index if not exists table_qr_credentials_created_by_fk_idx on public.table_qr_credentials(created_by) where created_by is not null;
create index if not exists table_qr_credentials_replaced_by_fk_idx on public.table_qr_credentials(replaced_by) where replaced_by is not null;

drop policy if exists seating_zones_write on public.seating_zones;
create policy seating_zones_insert on public.seating_zones for insert to authenticated
  with check (private.has_tenant_permission(tenant_id,'branch.manage'));
create policy seating_zones_update on public.seating_zones for update to authenticated
  using (private.has_tenant_permission(tenant_id,'branch.manage'))
  with check (private.has_tenant_permission(tenant_id,'branch.manage'));
create policy seating_zones_delete on public.seating_zones for delete to authenticated
  using (private.has_tenant_permission(tenant_id,'branch.manage'));

drop policy if exists cafe_tables_write on public.cafe_tables;
create policy cafe_tables_insert on public.cafe_tables for insert to authenticated
  with check (private.has_tenant_permission(tenant_id,'branch.manage'));
create policy cafe_tables_update on public.cafe_tables for update to authenticated
  using (private.has_tenant_permission(tenant_id,'branch.manage'))
  with check (private.has_tenant_permission(tenant_id,'branch.manage'));
create policy cafe_tables_delete on public.cafe_tables for delete to authenticated
  using (private.has_tenant_permission(tenant_id,'branch.manage'));

drop policy if exists floor_plan_write on public.floor_plan_layouts;
create policy floor_plan_insert on public.floor_plan_layouts for insert to authenticated
  with check (private.has_tenant_permission(tenant_id,'branch.manage'));
create policy floor_plan_update on public.floor_plan_layouts for update to authenticated
  using (private.has_tenant_permission(tenant_id,'branch.manage'))
  with check (private.has_tenant_permission(tenant_id,'branch.manage'));
create policy floor_plan_delete on public.floor_plan_layouts for delete to authenticated
  using (private.has_tenant_permission(tenant_id,'branch.manage'));

drop policy if exists table_qr_write on public.table_qr_credentials;
create policy table_qr_insert on public.table_qr_credentials for insert to authenticated
  with check (private.has_tenant_permission(tenant_id,'branch.manage'));
create policy table_qr_update on public.table_qr_credentials for update to authenticated
  using (private.has_tenant_permission(tenant_id,'branch.manage'))
  with check (private.has_tenant_permission(tenant_id,'branch.manage'));
create policy table_qr_delete on public.table_qr_credentials for delete to authenticated
  using (private.has_tenant_permission(tenant_id,'branch.manage'));

revoke execute on function public.resolve_table_qr(text) from authenticated;
grant execute on function public.resolve_table_qr(text) to anon;
revoke execute on function public.initialize_table_session(text,text) from authenticated;
grant execute on function public.initialize_table_session(text,text) to anon;
