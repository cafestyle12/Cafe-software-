-- CafeOS Phase 03: branch operations, seating zones, tables, floor-plan versions and QR credentials.
-- Additive only: preserve Phase 02 tenants, branches, memberships and audit history.
create extension if not exists pgcrypto;

alter table public.tenants
  add column if not exists restaurant_id text,
  add column if not exists logo_url text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists address jsonb not null default '{}'::jsonb,
  add column if not exists business_hours jsonb not null default '{}'::jsonb,
  add column if not exists default_timezone text not null default 'Asia/Kolkata';

-- Restaurant IDs may be human-selected. Enforce canonical uniqueness without constraining the brand prefix.
create unique index if not exists tenants_restaurant_id_unique
  on public.tenants (upper(trim(restaurant_id))) where restaurant_id is not null;

alter table public.branches
  add column if not exists branch_code text,
  add column if not exists address jsonb not null default '{}'::jsonb,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists opening_hours jsonb not null default '{}'::jsonb;

create unique index if not exists branches_tenant_branch_code_unique
  on public.branches (tenant_id, upper(trim(branch_code))) where branch_code is not null;

create table if not exists public.seating_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '',
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, id),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict
);

create unique index if not exists seating_zones_name_unique on public.seating_zones(tenant_id, branch_id, lower(trim(name)));

create table if not exists public.cafe_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null,
  zone_id uuid,
  label text not null check (length(trim(label)) between 1 and 40),
  capacity integer not null default 2 check (capacity between 1 and 100),
  shape text not null default 'round' check (shape in ('round','square','rectangle','booth')),
  width numeric(8,2) not null default 90 check (width between 30 and 500),
  height numeric(8,2) not null default 90 check (height between 30 and 500),
  x numeric(10,2) not null default 40 check (x between 0 and 10000),
  y numeric(10,2) not null default 40 check (y between 0 and 10000),
  rotation smallint not null default 0 check (rotation between 0 and 359),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, id),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, branch_id, zone_id) references public.seating_zones(tenant_id, branch_id, id) on delete restrict
);
create unique index if not exists cafe_tables_label_unique on public.cafe_tables(tenant_id, branch_id, lower(trim(label)));
create index if not exists cafe_tables_branch_status_idx on public.cafe_tables(tenant_id, branch_id, status);
create index if not exists seating_zones_branch_status_idx on public.seating_zones(tenant_id, branch_id, status);

create table if not exists public.floor_plan_layouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null,
  name text not null default 'Main floor',
  coordinate_system text not null default 'logical-1000' check (coordinate_system = 'logical-1000'),
  canvas_width integer not null default 1000 check (canvas_width between 400 and 5000),
  canvas_height integer not null default 700 check (canvas_height between 300 and 5000),
  version integer not null default 1 check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete restrict
);

create table if not exists public.table_qr_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null,
  table_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'active' check (status in ('active','revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  replaced_by uuid references public.table_qr_credentials(id) on delete set null,
  foreign key (tenant_id, branch_id, table_id) references public.cafe_tables(tenant_id, branch_id, id) on delete restrict
);
create index if not exists table_qr_active_lookup_idx on public.table_qr_credentials(token_hash) where status = 'active';

create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  branch_id uuid not null,
  table_id uuid not null,
  qr_credential_id uuid not null references public.table_qr_credentials(id) on delete restrict,
  session_token_hash text not null unique check (session_token_hash ~ '^[a-f0-9]{64}$'),
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '4 hours'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (tenant_id, branch_id, table_id) references public.cafe_tables(tenant_id, branch_id, id) on delete restrict,
  unique (qr_credential_id, idempotency_key)
);
create index if not exists table_sessions_active_idx on public.table_sessions(tenant_id, branch_id, table_id, expires_at) where status = 'active';

-- RLS policies are permission-based and tenant-scoped. No anonymous direct table access.
alter table public.seating_zones enable row level security;
alter table public.seating_zones force row level security;
alter table public.cafe_tables enable row level security;
alter table public.cafe_tables force row level security;
alter table public.floor_plan_layouts enable row level security;
alter table public.floor_plan_layouts force row level security;
alter table public.table_qr_credentials enable row level security;
alter table public.table_qr_credentials force row level security;
alter table public.table_sessions enable row level security;
alter table public.table_sessions force row level security;

revoke all on public.seating_zones, public.cafe_tables, public.floor_plan_layouts, public.table_qr_credentials, public.table_sessions from public, anon;
grant select, insert, update, delete on public.seating_zones, public.cafe_tables, public.floor_plan_layouts to authenticated;
grant select, insert, update on public.table_qr_credentials to authenticated;
revoke all on public.table_sessions from authenticated;

drop policy if exists seating_zones_read on public.seating_zones;
create policy seating_zones_read on public.seating_zones for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'branch.read'));
drop policy if exists seating_zones_write on public.seating_zones;
create policy seating_zones_write on public.seating_zones for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'branch.manage'))
  with check (private.has_tenant_permission(tenant_id, 'branch.manage'));

drop policy if exists cafe_tables_read on public.cafe_tables;
create policy cafe_tables_read on public.cafe_tables for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'branch.read'));
drop policy if exists cafe_tables_write on public.cafe_tables;
create policy cafe_tables_write on public.cafe_tables for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'branch.manage'))
  with check (private.has_tenant_permission(tenant_id, 'branch.manage'));

drop policy if exists floor_plan_read on public.floor_plan_layouts;
create policy floor_plan_read on public.floor_plan_layouts for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'branch.read'));
drop policy if exists floor_plan_write on public.floor_plan_layouts;
create policy floor_plan_write on public.floor_plan_layouts for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'branch.manage'))
  with check (private.has_tenant_permission(tenant_id, 'branch.manage'));

drop policy if exists table_qr_read on public.table_qr_credentials;
create policy table_qr_read on public.table_qr_credentials for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'branch.manage'));
drop policy if exists table_qr_write on public.table_qr_credentials;
create policy table_qr_write on public.table_qr_credentials for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'branch.manage'))
  with check (private.has_tenant_permission(tenant_id, 'branch.manage'));

-- Only the narrow QR-resolution RPC is executable by anonymous clients; it returns public-safe labels only.
create or replace function public.resolve_table_qr(p_token text)
returns table (restaurant_name text, branch_name text, table_label text, table_capacity integer, session_status text)
language plpgsql security definer set search_path = ''
as $$
declare
  token_digest text;
begin
  if p_token is null or length(p_token) < 40 or length(p_token) > 200 then
    return query select null::text, null::text, null::text, null::integer, 'invalid'::text;
    return;
  end if;
  token_digest := encode(extensions.digest(p_token, 'sha256'), 'hex');
  return query
    select t.name, b.name, ct.label, ct.capacity, 'valid'::text
    from public.table_qr_credentials q
    join public.cafe_tables ct on ct.id = q.table_id and ct.tenant_id = q.tenant_id and ct.branch_id = q.branch_id
    join public.branches b on b.id = q.branch_id and b.tenant_id = q.tenant_id
    join public.tenants t on t.id = q.tenant_id
    where q.token_hash = token_digest and q.status = 'active'
      and ct.status = 'active' and b.status = 'active' and t.status = 'active'
    limit 1;
  if not found then
    return query select null::text, null::text, null::text, null::integer, 'invalid'::text;
  end if;
end;
$$;
revoke all on function public.resolve_table_qr(text) from public;
grant execute on function public.resolve_table_qr(text) to anon, authenticated;

-- Keep table-session records private; initialization is performed by a server route that validates the QR,
-- creates a random opaque session token, and stores only its SHA-256 hash.
revoke all on public.table_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.table_sessions to service_role;

-- Audit new operational entities with append-only event rows using the existing tenant audit table.
create index if not exists audit_events_branch_entity_idx on public.audit_events(tenant_id, branch_id, entity_type, created_at desc);
