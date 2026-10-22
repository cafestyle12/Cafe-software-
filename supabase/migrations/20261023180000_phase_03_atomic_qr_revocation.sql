-- Revoking a QR must also invalidate every active session created from it.
create or replace function public.revoke_table_qr(p_tenant_id uuid, p_branch_id uuid, p_credential_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  qr_row public.table_qr_credentials%rowtype;
begin
  if auth.uid() is null or not private.has_tenant_permission(p_tenant_id,'branch.manage') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  select * into qr_row from public.table_qr_credentials q
    where q.id=p_credential_id and q.tenant_id=p_tenant_id and q.branch_id=p_branch_id and q.status='active'
    for update;
  if not found then raise exception 'qr_unavailable' using errcode='P0002'; end if;
  update public.table_sessions set status='revoked',revoked_at=now()
    where qr_credential_id=qr_row.id and tenant_id=p_tenant_id and branch_id=p_branch_id and status='active';
  update public.table_qr_credentials set status='revoked',revoked_at=now()
    where id=qr_row.id and tenant_id=p_tenant_id and branch_id=p_branch_id;
end;
$$;
revoke all on function public.revoke_table_qr(uuid,uuid,uuid) from public,anon;
grant execute on function public.revoke_table_qr(uuid,uuid,uuid) to authenticated;
