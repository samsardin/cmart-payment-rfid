// Initial Mock Data according to PRD Entitas Inti

export const ROLES = {
  SUPER_ADMIN: { id: 'SUPER_ADMIN', name: 'Super Admin', badge: 'badge-purple' },
  ADMIN_KEUANGAN: { id: 'ADMIN_KEUANGAN', name: 'Admin Keuangan', badge: 'badge-emerald' },
  ADMIN_PENJEMPUTAN: { id: 'ADMIN_PENJEMPUTAN', name: 'Admin Penjemputan', badge: 'badge-gold' },
  KASIR_KANTIN: { id: 'KASIR_KANTIN', name: 'Kasir Kantin', badge: 'badge-gold' },
  ORANG_TUA: { id: 'ORANG_TUA', name: 'Orang Tua / Wali', badge: 'badge-gold' },
  SISWA: { id: 'SISWA', name: 'Siswa Digital', badge: 'badge-gray' },
};

// Akun demo untuk prototipe. Ganti dengan Supabase Auth sebelum produksi.
export const LOGIN_ACCOUNTS = [
  { id: 'ACC-ADMIN-001', username: 'superadmin', password: 'admin123', roleId: 'SUPER_ADMIN' },
  { id: 'ACC-ADMIN-002', username: 'keuangan', password: 'keuangan123', roleId: 'ADMIN_KEUANGAN' },
  { id: 'ACC-ADMIN-004', username: 'penjemputan', password: 'penjemputan123', roleId: 'ADMIN_PENJEMPUTAN' },
  { id: 'ACC-ADMIN-003', username: 'kasir', password: 'kasir123', roleId: 'KASIR_KANTIN' },
  { id: 'ACC-GDR-001', username: 'ahmad', password: 'ahmad123', roleId: 'ORANG_TUA', guardianId: 'GDR-001', studentId: 'STD-101' },
  { id: 'ACC-GDR-002', username: 'ratna', password: 'ratna123', roleId: 'ORANG_TUA', guardianId: 'GDR-002', studentId: 'STD-102' },
  { id: 'ACC-GDR-003', username: 'hendra', password: 'hendra123', roleId: 'ORANG_TUA', guardianId: 'GDR-003', studentId: 'STD-103' },
  { id: 'ACC-STD-101', username: 'rayhan', password: 'rayhan123', roleId: 'SISWA', studentId: 'STD-101' },
  { id: 'ACC-STD-102', username: 'aisyah', password: 'aisyah123', roleId: 'SISWA', studentId: 'STD-102' },
  { id: 'ACC-STD-103', username: 'fatih', password: 'fatih123', roleId: 'SISWA', studentId: 'STD-103' },
];

export const INITIAL_GUARDIANS = [
  {
    id: 'GDR-001',
    name: 'Bapak Ahmad Subagyo',
    phone: '0812-3456-7890',
    relationship: 'Ayah',
    studentId: 'STD-101',
    rfidCardUid: 'RFID-JMP-001',
    address: 'Jl. Melati No. 12, Jakarta'
  },
  {
    id: 'GDR-002',
    name: 'Ibu Ratna Dewi',
    phone: '0813-9876-5432',
    relationship: 'Ibu',
    studentId: 'STD-102',
    rfidCardUid: 'RFID-JMP-002',
    address: 'Jl. Anggrek No. 45, Jakarta'
  },
  {
    id: 'GDR-003',
    name: 'Bapak Hendra Gunawan',
    phone: '0857-1122-3344',
    relationship: 'Ayah',
    studentId: 'STD-103',
    rfidCardUid: 'RFID-JMP-003',
    address: 'Jl. Mawar No. 8, Jakarta'
  }
];

export const INITIAL_STUDENTS = [
  {
    id: 'STD-101',
    nis: '20260101',
    name: 'Muhammad Rayhan',
    class: '5-A Tahfidz',
    guardianId: 'GDR-001',
    guardianName: 'Bapak Ahmad Subagyo',
    savingsBalance: 350000,
    canteenDepositBalance: 75000,
    canteenBalanceSource: 'TABUNGAN', // 'TABUNGAN' or 'DEPOSIT'
    rfidUid: 'RFID-STD-101',
    photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
    status: 'AKTIF',
    gender: 'L'
  },
  {
    id: 'STD-102',
    nis: '20260102',
    name: 'Aisyah Humaira',
    class: '5-A Tahfidz',
    guardianId: 'GDR-002',
    guardianName: 'Ibu Ratna Dewi',
    savingsBalance: 520000,
    canteenDepositBalance: 120000,
    canteenBalanceSource: 'DEPOSIT',
    rfidUid: 'RFID-STD-102',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'AKTIF',
    gender: 'P'
  },
  {
    id: 'STD-103',
    nis: '20260103',
    name: 'Fatih Al-Faruq',
    class: '5-B Reguler',
    guardianId: 'GDR-003',
    guardianName: 'Bapak Hendra Gunawan',
    savingsBalance: 180000,
    canteenDepositBalance: 40000,
    canteenBalanceSource: 'TABUNGAN',
    rfidUid: 'RFID-STD-103',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'AKTIF',
    gender: 'L'
  }
];

export const INITIAL_RFID_CARDS = [
  { id: 'CARD-01', uid: 'RFID-STD-101', type: 'SISWA', assignedToName: 'Muhammad Rayhan', assignedToId: 'STD-101', status: 'ACTIVE', issuedAt: '2026-01-10' },
  { id: 'CARD-02', uid: 'RFID-STD-102', type: 'SISWA', assignedToName: 'Aisyah Humaira', assignedToId: 'STD-102', status: 'ACTIVE', issuedAt: '2026-01-10' },
  { id: 'CARD-03', uid: 'RFID-STD-103', type: 'SISWA', assignedToName: 'Fatih Al-Faruq', assignedToId: 'STD-103', status: 'ACTIVE', issuedAt: '2026-01-12' },
  { id: 'CARD-04', uid: 'RFID-JMP-001', type: 'PENJEMPUT', assignedToName: 'Bapak Ahmad Subagyo (Penjemput Rayhan)', assignedToId: 'GDR-001', status: 'ACTIVE', issuedAt: '2026-01-10' },
  { id: 'CARD-05', uid: 'RFID-JMP-002', type: 'PENJEMPUT', assignedToName: 'Ibu Ratna Dewi (Penjemput Aisyah)', assignedToId: 'GDR-002', status: 'ACTIVE', issuedAt: '2026-01-10' },
  { id: 'CARD-06', uid: 'RFID-JMP-003', type: 'PENJEMPUT', assignedToName: 'Bapak Hendra Gunawan (Penjemput Fatih)', assignedToId: 'GDR-003', status: 'ACTIVE', issuedAt: '2026-01-12' }
];

export const CANTEEN_PRODUCTS = [
  { id: 'PRD-01', name: 'Nasi Goreng Sehat', category: 'Makanan Utama', price: 15000, stock: 45, icon: '🍛' },
  { id: 'PRD-02', name: 'Soto Ayam Madura', category: 'Makanan Utama', price: 16000, stock: 30, icon: '🍲' },
  { id: 'PRD-03', name: 'Roti Bakar Keju', category: 'Snack', price: 8000, stock: 50, icon: '🍞' },
  { id: 'PRD-04', name: 'Jus Alpukat Organik', category: 'Minuman', price: 10000, stock: 25, icon: '🥤' },
  { id: 'PRD-05', name: 'Susu UHT Kurma 250ml', category: 'Minuman', price: 7000, stock: 60, icon: '🥛' },
  { id: 'PRD-06', name: 'Buah Potong Segar', category: 'Snack', price: 6000, stock: 40, icon: '🍎' },
];

// 114 Surah Al-Qur'an Dataset
export const SURAH_LIST = [
  { number: 1, name: 'Al-Fatihah', verses: 7, juz: 1 },
  { number: 2, name: 'Al-Baqarah', verses: 286, juz: 1 },
  { number: 3, name: 'Ali Imran', verses: 200, juz: 3 },
  { number: 36, name: 'Yasin', verses: 83, juz: 22 },
  { number: 55, name: 'Ar-Rahman', verses: 78, juz: 27 },
  { number: 56, name: 'Al-Waqi\'ah', verses: 96, juz: 27 },
  { number: 67, name: 'Al-Mulk', verses: 30, juz: 29 },
  { number: 78, name: 'An-Naba\'', verses: 40, juz: 30 },
  { number: 79, name: 'An-Nazi\'at', verses: 46, juz: 30 },
  { number: 80, name: '‘Abasa', verses: 42, juz: 30 },
  { number: 81, name: 'At-Takwir', verses: 29, juz: 30 },
  { number: 82, name: 'Al-Infitar', verses: 19, juz: 30 },
  { number: 83, name: 'Al-Mutaffifin', verses: 36, juz: 30 },
  { number: 84, name: 'Al-Inshiqaq', verses: 25, juz: 30 },
  { number: 85, name: 'Al-Buruj', verses: 22, juz: 30 },
  { number: 86, name: 'At-Tariq', verses: 17, juz: 30 },
  { number: 87, name: 'Al-A‘la', verses: 19, juz: 30 },
  { number: 88, name: 'Al-Ghashiyah', verses: 26, juz: 30 },
  { number: 89, name: 'Al-Fajr', verses: 30, juz: 30 },
  { number: 90, name: 'Al-Balad', verses: 20, juz: 30 },
  { number: 91, name: 'Ash-Shams', verses: 15, juz: 30 },
  { number: 92, name: 'Al-Layl', verses: 21, juz: 30 },
  { number: 93, name: 'Ad-Duha', verses: 11, juz: 30 },
  { number: 94, name: 'Ash-Sharh', verses: 8, juz: 30 },
  { number: 95, name: 'At-Tin', verses: 8, juz: 30 },
  { number: 96, name: 'Al-‘Alaq', verses: 19, juz: 30 },
  { number: 97, name: 'Al-Qadr', verses: 5, juz: 30 },
  { number: 98, name: 'Al-Bayyinah', verses: 8, juz: 30 },
  { number: 99, name: 'Az-Zalzalah', verses: 8, juz: 30 },
  { number: 100, name: 'Al-‘Adiyat', verses: 11, juz: 30 },
  { number: 101, name: 'Al-Qari‘ah', verses: 11, juz: 30 },
  { number: 102, name: 'At-Takathur', verses: 8, juz: 30 },
  { number: 103, name: 'Al-‘Asr', verses: 3, juz: 30 },
  { number: 104, name: 'Al-Humazah', verses: 9, juz: 30 },
  { number: 105, name: 'Al-Fil', verses: 5, juz: 30 },
  { number: 106, name: 'Quraysh', verses: 4, juz: 30 },
  { number: 107, name: 'Al-Ma‘un', verses: 7, juz: 30 },
  { number: 108, name: 'Al-Kawthar', verses: 3, juz: 30 },
  { number: 109, name: 'Al-Kafirun', verses: 6, juz: 30 },
  { number: 110, name: 'An-Nasr', verses: 3, juz: 30 },
  { number: 111, name: 'Al-Masad', verses: 5, juz: 30 },
  { number: 112, name: 'Al-Ikhlas', verses: 4, juz: 30 },
  { number: 113, name: 'Al-Falaq', verses: 5, juz: 30 },
  { number: 114, name: 'An-Nas', verses: 6, juz: 30 },
];

export const INITIAL_LEDGER = [
  {
    id: 'TX-1001',
    timestamp: '2026-08-10T08:30:00.000Z',
    studentId: 'STD-101',
    studentName: 'Muhammad Rayhan',
    accountType: 'TABUNGAN', // 'TABUNGAN' | 'DEPOSIT_KANTIN'
    type: 'CREDIT', // 'CREDIT' (setoran/topup) | 'DEBIT' (penarikan/belanja)
    category: 'SETORAN_AWAL',
    amount: 400000,
    balanceAfter: 400000,
    actor: 'Admin Keuangan',
    reference: 'REF-DEP-001',
    description: 'Setoran awal tabungan siswa'
  },
  {
    id: 'TX-1002',
    timestamp: '2026-08-10T10:15:00.000Z',
    studentId: 'STD-101',
    studentName: 'Muhammad Rayhan',
    accountType: 'TABUNGAN',
    type: 'DEBIT',
    category: 'BELANJA_KANTIN_RFID',
    amount: 22000,
    balanceAfter: 378000,
    actor: 'Kasir Kantin Utama',
    reference: 'REF-KNT-901',
    description: 'Pembayaran Kantin via Tap RFID (Nasi Goreng + Jus Alpukat)'
  },
  {
    id: 'TX-1003',
    timestamp: '2026-08-11T07:45:00.000Z',
    studentId: 'STD-102',
    studentName: 'Aisyah Humaira',
    accountType: 'DEPOSIT_KANTIN',
    type: 'CREDIT',
    category: 'DEPOSIT_KANTIN',
    amount: 150000,
    balanceAfter: 150000,
    actor: 'Admin Keuangan',
    reference: 'REF-DEP-002',
    description: 'Deposit Khusus Kantin oleh Orang Tua'
  },
  {
    id: 'TX-1004',
    timestamp: '2026-08-11T09:30:00.000Z',
    studentId: 'STD-102',
    studentName: 'Aisyah Humaira',
    accountType: 'DEPOSIT_KANTIN',
    type: 'DEBIT',
    category: 'BELANJA_KANTIN_RFID',
    amount: 30000,
    balanceAfter: 120000,
    actor: 'Kasir Kantin Utama',
    reference: 'REF-KNT-902',
    description: 'Pembayaran Kantin via Tap RFID (Soto Ayam + Susu Kurma)'
  }
];

export const INITIAL_HAFALAN_RECORDS = [
  {
    id: 'HAF-501',
    timestamp: '2026-08-10T07:30:00.000Z',
    studentId: 'STD-101',
    studentName: 'Muhammad Rayhan',
    className: '5-A Tahfidz',
    surahNumber: 67,
    surahName: 'Al-Mulk',
    ayatFrom: 1,
    ayatTo: 15,
    status: 'LANCAR', // LANCAR | MURAJAAH | MENGULANG
    teacherName: 'Ustadz H. Farhan, M.Pd.',
    note: 'Tajwid dan makhraj sangat baik. Lanjutkan ayat 16-30.',
    rating: 5
  },
  {
    id: 'HAF-502',
    timestamp: '2026-08-10T08:00:00.000Z',
    studentId: 'STD-102',
    studentName: 'Aisyah Humaira',
    className: '5-A Tahfidz',
    surahNumber: 78,
    surahName: 'An-Naba\'',
    ayatFrom: 1,
    ayatTo: 40,
    status: 'LANCAR',
    teacherName: 'Ustadzah Maryam, S.Ag.',
    note: 'Selesai Surah An-Naba full. Mumtaz!',
    rating: 5
  },
  {
    id: 'HAF-503',
    timestamp: '2026-08-11T07:45:00.000Z',
    studentId: 'STD-103',
    studentName: 'Fatih Al-Faruq',
    className: '5-B Reguler',
    surahNumber: 87,
    surahName: 'Al-A‘la',
    ayatFrom: 1,
    ayatTo: 19,
    status: 'MURAJAAH',
    teacherName: 'Ustadz H. Farhan, M.Pd.',
    note: 'Perlu pengulangan kelancaran di ayat 10-15.',
    rating: 4
  }
];

export const INITIAL_AUDIT_LOGS = [
  {
    id: 'AUD-001',
    timestamp: '2026-08-10T08:30:00.000Z',
    actor: 'Admin Keuangan',
    action: 'SETORAN_TABUNGAN',
    entity: 'students',
    entityId: 'STD-101',
    details: 'Mencatat setoran tabungan awal Rp 400,000 untuk Muhammad Rayhan',
    ip: '192.168.1.45'
  },
  {
    id: 'AUD-002',
    timestamp: '2026-08-10T10:15:00.000Z',
    actor: 'Kasir Kantin Utama',
    action: 'TRANSAKSI_KANTIN_RFID',
    entity: 'canteen_transactions',
    entityId: 'TX-1002',
    details: 'Tap RFID Muhammad Rayhan (RFID-STD-101) memotong Rp 22,000 dari Tabungan',
    ip: '192.168.1.88'
  }
];
