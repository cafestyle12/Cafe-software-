-- Enforce one active QR credential per table at the database boundary.
create unique index if not exists table_qr_one_active_per_table
  on public.table_qr_credentials(tenant_id, branch_id, table_id)
  where status='active';
