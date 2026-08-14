# Menghubungkan aplikasi ke Supabase

1. Buat project baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Buka **SQL Editor**, lalu jalankan isi file `supabase/migrations/20260813000000_create_school_schema.sql`, kemudian `supabase/migrations/20260813000002_add_login_accounts.sql`.
3. Jalankan isi file `supabase/seed.sql` untuk memasukkan data siswa, wali, kartu RFID, ledger, audit, serta akun login.
4. Salin `.env.example` menjadi `.env.local`, lalu isi nilai dari **Project Settings > API**:

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
   ```

5. Jalankan ulang aplikasi dengan `npm.cmd run dev`.

Aplikasi akan mengambil data dari Supabase saat dimulai dan menyimpan perubahan siswa, wali, kartu RFID, transaksi ledger, audit, serta akun login ke database. Jika environment belum diisi, aplikasi tetap menggunakan cadangan `localStorage` seperti sebelumnya.

## Keamanan

Migration awal menyediakan kebijakan RLS yang terbuka untuk `anon` dan `authenticated` agar prototipe dapat berjalan tanpa sistem login. Tabel `login_accounts` juga menyimpan password teks biasa agar sesuai mekanisme login prototipe saat ini. Jangan gunakan rancangan ini pada produksi. Tahap berikutnya adalah menggantinya dengan Supabase Auth dan kebijakan RLS berbasis peran (admin, kasir, petugas penjemputan, orang tua, dan siswa).

Jangan pernah memasukkan `service_role` key ke file `.env.local` frontend atau ke browser.

## Mengosongkan data siswa dan orang tua

Untuk menghapus seluruh data siswa dan orang tua/wali, termasuk akun login mereka, kartu RFID, dan riwayat transaksi terkait, jalankan `supabase/migrations/20260813000003_clear_students_and_guardians.sql` melalui **SQL Editor** Supabase. Struktur tabel dan akun staf tetap dipertahankan. Tindakan ini permanen.
