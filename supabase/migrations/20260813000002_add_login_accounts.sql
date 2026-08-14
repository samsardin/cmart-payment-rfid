-- Akun login prototipe. Untuk produksi, gunakan Supabase Auth dan simpan hanya
-- auth.users.id serta metadata peran di tabel profil; jangan menyimpan password teks biasa.
create table if not exists public.login_accounts (
  id text primary key,
  username text not null unique,
  password text not null,
  role_id text not null check (role_id in ('SUPER_ADMIN', 'ADMIN_KEUANGAN', 'KASIR_KANTIN', 'ORANG_TUA', 'SISWA')),
  guardian_id text references public.guardians(id) on delete set null,
  student_id text references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (role_id = 'ORANG_TUA' and guardian_id is not null and student_id is not null)
    or (role_id = 'SISWA' and student_id is not null)
    or role_id in ('SUPER_ADMIN', 'ADMIN_KEUANGAN', 'KASIR_KANTIN')
  )
);

create index if not exists login_accounts_student_id_idx on public.login_accounts (student_id);
create index if not exists login_accounts_guardian_id_idx on public.login_accounts (guardian_id);

alter table public.login_accounts enable row level security;

-- Selaras dengan kebijakan prototipe sebelumnya. Wajib diganti dengan Supabase Auth dan
-- RLS berbasis pengguna sebelum aplikasi dipublikasikan.
drop policy if exists "prototype public access" on public.login_accounts;
create policy "prototype public access" on public.login_accounts
  for all to anon, authenticated using (true) with check (true);
