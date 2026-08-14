insert into public.guardians (id, name, phone, relationship, student_id, rfid_card_uid, address) values
  ('GDR-001', 'Bapak Ahmad Subagyo', '0812-3456-7890', 'Ayah', 'STD-101', 'RFID-JMP-001', 'Jl. Melati No. 12, Jakarta'),
  ('GDR-002', 'Ibu Ratna Dewi', '0813-9876-5432', 'Ibu', 'STD-102', 'RFID-JMP-002', 'Jl. Anggrek No. 45, Jakarta'),
  ('GDR-003', 'Bapak Hendra Gunawan', '0857-1122-3344', 'Ayah', 'STD-103', 'RFID-JMP-003', 'Jl. Mawar No. 8, Jakarta')
on conflict (id) do update set name = excluded.name, phone = excluded.phone, relationship = excluded.relationship, student_id = excluded.student_id, rfid_card_uid = excluded.rfid_card_uid, address = excluded.address;

insert into public.students (id, nis, name, class, guardian_id, guardian_name, savings_balance, canteen_deposit_balance, canteen_balance_source, rfid_uid, photo, status, gender) values
  ('STD-101', '20260101', 'Muhammad Rayhan', '5-A Tahfidz', 'GDR-001', 'Bapak Ahmad Subagyo', 350000, 75000, 'TABUNGAN', 'RFID-STD-101', 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80', 'AKTIF', 'L'),
  ('STD-102', '20260102', 'Aisyah Humaira', '5-A Tahfidz', 'GDR-002', 'Ibu Ratna Dewi', 520000, 120000, 'DEPOSIT', 'RFID-STD-102', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'AKTIF', 'P'),
  ('STD-103', '20260103', 'Fatih Al-Faruq', '5-B Reguler', 'GDR-003', 'Bapak Hendra Gunawan', 180000, 40000, 'TABUNGAN', 'RFID-STD-103', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 'AKTIF', 'L')
on conflict (id) do update set nis = excluded.nis, name = excluded.name, class = excluded.class, guardian_id = excluded.guardian_id, guardian_name = excluded.guardian_name, savings_balance = excluded.savings_balance, canteen_deposit_balance = excluded.canteen_deposit_balance, canteen_balance_source = excluded.canteen_balance_source, rfid_uid = excluded.rfid_uid, photo = excluded.photo, status = excluded.status, gender = excluded.gender;

insert into public.rfid_cards (id, uid, type, assigned_to_name, assigned_to_id, status, issued_at) values
  ('CARD-01', 'RFID-STD-101', 'SISWA', 'Muhammad Rayhan', 'STD-101', 'ACTIVE', '2026-01-10'),
  ('CARD-02', 'RFID-STD-102', 'SISWA', 'Aisyah Humaira', 'STD-102', 'ACTIVE', '2026-01-10'),
  ('CARD-03', 'RFID-STD-103', 'SISWA', 'Fatih Al-Faruq', 'STD-103', 'ACTIVE', '2026-01-12'),
  ('CARD-04', 'RFID-JMP-001', 'PENJEMPUT', 'Bapak Ahmad Subagyo (Penjemput Rayhan)', 'GDR-001', 'ACTIVE', '2026-01-10'),
  ('CARD-05', 'RFID-JMP-002', 'PENJEMPUT', 'Ibu Ratna Dewi (Penjemput Aisyah)', 'GDR-002', 'ACTIVE', '2026-01-10'),
  ('CARD-06', 'RFID-JMP-003', 'PENJEMPUT', 'Bapak Hendra Gunawan (Penjemput Fatih)', 'GDR-003', 'ACTIVE', '2026-01-12')
on conflict (id) do update set uid = excluded.uid, type = excluded.type, assigned_to_name = excluded.assigned_to_name, assigned_to_id = excluded.assigned_to_id, status = excluded.status, issued_at = excluded.issued_at;

insert into public.ledger (id, timestamp, student_id, student_name, account_type, type, category, amount, balance_after, actor, reference, description) values
  ('TX-1001', '2026-08-10T08:30:00.000Z', 'STD-101', 'Muhammad Rayhan', 'TABUNGAN', 'CREDIT', 'SETORAN_AWAL', 400000, 400000, 'Admin Keuangan', 'REF-DEP-001', 'Setoran awal tabungan siswa'),
  ('TX-1002', '2026-08-10T10:15:00.000Z', 'STD-101', 'Muhammad Rayhan', 'TABUNGAN', 'DEBIT', 'BELANJA_KANTIN_RFID', 22000, 378000, 'Kasir Kantin Utama', 'REF-KNT-901', 'Pembayaran Kantin via Tap RFID (Nasi Goreng + Jus Alpukat)'),
  ('TX-1003', '2026-08-11T07:45:00.000Z', 'STD-102', 'Aisyah Humaira', 'DEPOSIT_KANTIN', 'CREDIT', 'DEPOSIT_KANTIN', 150000, 150000, 'Admin Keuangan', 'REF-DEP-002', 'Deposit Khusus Kantin oleh Orang Tua'),
  ('TX-1004', '2026-08-11T09:30:00.000Z', 'STD-102', 'Aisyah Humaira', 'DEPOSIT_KANTIN', 'DEBIT', 'BELANJA_KANTIN_RFID', 30000, 120000, 'Kasir Kantin Utama', 'REF-KNT-902', 'Pembayaran Kantin via Tap RFID (Soto Ayam + Susu Kurma)')
on conflict (id) do update set timestamp = excluded.timestamp, student_id = excluded.student_id, student_name = excluded.student_name, account_type = excluded.account_type, type = excluded.type, category = excluded.category, amount = excluded.amount, balance_after = excluded.balance_after, actor = excluded.actor, reference = excluded.reference, description = excluded.description;

insert into public.audit_logs (id, timestamp, actor, action, entity, entity_id, details, ip) values
  ('AUD-001', '2026-08-10T08:30:00.000Z', 'Admin Keuangan', 'SETORAN_TABUNGAN', 'students', 'STD-101', 'Mencatat setoran tabungan awal Rp 400,000 untuk Muhammad Rayhan', '192.168.1.45'),
  ('AUD-002', '2026-08-10T10:15:00.000Z', 'Kasir Kantin Utama', 'TRANSAKSI_KANTIN_RFID', 'canteen_transactions', 'TX-1002', 'Tap RFID Muhammad Rayhan (RFID-STD-101) memotong Rp 22,000 dari Tabungan', '192.168.1.88')
on conflict (id) do update set timestamp = excluded.timestamp, actor = excluded.actor, action = excluded.action, entity = excluded.entity, entity_id = excluded.entity_id, details = excluded.details, ip = excluded.ip;

insert into public.login_accounts (id, username, password, role_id, guardian_id, student_id) values
  ('ACC-ADMIN-001', 'superadmin', 'admin123', 'SUPER_ADMIN', null, null),
  ('ACC-ADMIN-002', 'keuangan', 'keuangan123', 'ADMIN_KEUANGAN', null, null),
  ('ACC-ADMIN-003', 'kasir', 'kasir123', 'KASIR_KANTIN', null, null),
  ('ACC-GDR-001', 'ahmad', 'ahmad123', 'ORANG_TUA', 'GDR-001', 'STD-101'),
  ('ACC-GDR-002', 'ratna', 'ratna123', 'ORANG_TUA', 'GDR-002', 'STD-102'),
  ('ACC-GDR-003', 'hendra', 'hendra123', 'ORANG_TUA', 'GDR-003', 'STD-103'),
  ('ACC-STD-101', 'rayhan', 'rayhan123', 'SISWA', null, 'STD-101'),
  ('ACC-STD-102', 'aisyah', 'aisyah123', 'SISWA', null, 'STD-102'),
  ('ACC-STD-103', 'fatih', 'fatih123', 'SISWA', null, 'STD-103')
on conflict (id) do update set username = excluded.username, password = excluded.password, role_id = excluded.role_id, guardian_id = excluded.guardian_id, student_id = excluded.student_id;
