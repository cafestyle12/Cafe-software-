-- Public QR session initialization: opaque, hashed session credentials, bounded lifetime, idempotent retry key.
create or replace function public.initialize_table_session(p_qr_token text, p_idempotency_key text)
returns table(session_token text, expires_at timestamptz, table_label text, branch_name text)
language plpgsql security definer set search_path = ''
as $$
declare
  qr_row public.table_qr_credentials%rowtype;
  table_row public.cafe_tables%rowtype;
  branch_label text;
  existing public.table_sessions%rowtype;
  raw_session text;
  session_hash text;
  idem text;
begin
  if p_qr_token is null or length(p_qr_token) < 40 or length(p_qr_token) > 200
     or p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 128
     or p_idempotency_key !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  select * into qr_row from public.table_qr_credentials q
    where q.token_hash = encode(extensions.digest(p_qr_token,'sha256'),'hex')
      and q.status='active' for share;
  if not found then raise exception 'invalid_qr' using errcode='P0002'; end if;
  select * into table_row from public.cafe_tables t
    where t.id=qr_row.table_id and t.tenant_id=qr_row.tenant_id
      and t.branch_id=qr_row.branch_id and t.status='active';
  if not found then raise exception 'invalid_qr' using errcode='P0002'; end if;
  select b.name into branch_label from public.branches b
    join public.tenants n on n.id=b.tenant_id
    where b.id=qr_row.branch_id and b.tenant_id=qr_row.tenant_id
      and b.status='active' and n.status='active';
  if branch_label is null then raise exception 'invalid_qr' using errcode='P0002'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(qr_row.id::text || ':' || p_idempotency_key, 0));
  select * into existing from public.table_sessions s
    where s.qr_credential_id=qr_row.id and s.idempotency_key=p_idempotency_key
      and s.status='active' and s.expires_at>now();
  if found then
    -- Do not return an old plaintext token; clients should retain the first response.
    return query select null::text, existing.expires_at, table_row.label, branch_label;
    return;
  end if;

  raw_session := rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'), E'+/=', '-_.'),'.');
  session_hash := encode(extensions.digest(raw_session,'sha256'),'hex');
  idem := p_idempotency_key;
  insert into public.table_sessions(tenant_id,branch_id,table_id,qr_credential_id,session_token_hash,idempotency_key,status,expires_at)
  values(qr_row.tenant_id,qr_row.branch_id,qr_row.table_id,qr_row.id,session_hash,idem,'active',now()+interval '4 hours')
  on conflict(qr_credential_id,idempotency_key) do nothing;

  return query select raw_session, now()+interval '4 hours', table_row.label, branch_label;
end;
$$;
revoke all on function public.initialize_table_session(text,text) from public;
grant execute on function public.initialize_table_session(text,text) to anon, authenticated;
