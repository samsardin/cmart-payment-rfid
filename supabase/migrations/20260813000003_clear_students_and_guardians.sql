-- PERMANENT: Menghapus seluruh data siswa dan orang tua/wali beserta data akun
-- login, kartu RFID, serta riwayat transaksi yang terhubung. Struktur tabel tetap ada.
begin;

delete from public.login_accounts
where student_id is not null or guardian_id is not null;

delete from public.rfid_cards
where type in ('SISWA', 'PENJEMPUT');

delete from public.ledger;

delete from public.guardians;

delete from public.students;

commit;
