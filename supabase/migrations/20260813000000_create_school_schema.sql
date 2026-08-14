create table if not exists public.students (
  id text primary key,
  nis text not null unique,
  name text not null,
  class text not null,
  guardian_id text,
  guardian_name text,
  savings_balance numeric(14, 2) not null default 0,
  canteen_deposit_balance numeric(14, 2) not null default 0,
  canteen_balance_source text not null check (canteen_balance_source in ('TABUNGAN', 'DEPOSIT')),
  rfid_uid text unique,
  photo text,
  status text not null default 'AKTIF',
  gender text not null check (gender in ('L', 'P')),
  created_at timestamptz not null default now()
);

create table if not exists public.guardians (
  id text primary key,
  name text not null,
  phone text,
  relationship text,
  student_id text,
  rfid_card_uid text unique,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.rfid_cards (
  id text primary key,
  uid text not null unique,
  type text not null check (type in ('SISWA', 'PENJEMPUT')),
  assigned_to_name text not null,
  assigned_to_id text not null,
  status text not null default 'ACTIVE',
  issued_at date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ledger (
  id text primary key,
  timestamp timestamptz not null,
  student_id text not null,
  student_name text not null,
  account_type text not null check (account_type in ('TABUNGAN', 'DEPOSIT_KANTIN')),
  type text not null check (type in ('CREDIT', 'DEBIT')),
  category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  balance_after numeric(14, 2) not null,
  actor text not null,
  reference text,
  description text not null
);

create table if not exists public.audit_logs (
  id text primary key,
  timestamp timestamptz not null,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  details text,
  ip text
);

create index if not exists ledger_student_timestamp_idx on public.ledger (student_id, timestamp desc);
create index if not exists audit_logs_timestamp_idx on public.audit_logs (timestamp desc);

alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.rfid_cards enable row level security;
alter table public.ledger enable row level security;
alter table public.audit_logs enable row level security;

-- Temporary policies for this prototype. Replace with role-based policies before production.
drop policy if exists "prototype public access" on public.students;
drop policy if exists "prototype public access" on public.guardians;
drop policy if exists "prototype public access" on public.rfid_cards;
drop policy if exists "prototype public access" on public.ledger;
drop policy if exists "prototype public access" on public.audit_logs;
create policy "prototype public access" on public.students for all to anon, authenticated using (true) with check (true);
create policy "prototype public access" on public.guardians for all to anon, authenticated using (true) with check (true);
create policy "prototype public access" on public.rfid_cards for all to anon, authenticated using (true) with check (true);
create policy "prototype public access" on public.ledger for all to anon, authenticated using (true) with check (true);
create policy "prototype public access" on public.audit_logs for all to anon, authenticated using (true) with check (true);
