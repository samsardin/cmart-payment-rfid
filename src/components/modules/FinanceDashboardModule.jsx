import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard, Wallet, CreditCard, Users, Activity,
  TrendingUp, TrendingDown, ArrowDownRight, ArrowUpRight,
  PiggyBank, BadgeDollarSign, Calendar, FileSpreadsheet, Download, Filter
} from 'lucide-react';
import { exportToExcelXlsx } from '../../services/excelExporter';
import { recalculateLedgerRunningBalances, parseSafeTimestamp } from '../../services/ledgerEngine';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function FinanceDashboardModule({ state }) {
  const currentDate = new Date();
  
  // Time period filter: 'TODAY' (Harian), 'WEEKLY' (Pekanan), 'MONTHLY' (Bulanan), 'ALL' (Semua Waktu)
  const [timeRange, setTimeRange] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth()); // 0 - 11
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [searchQuery, setSearchQuery] = useState('');

  // Extract available years from ledger timestamps + current year
  const yearOptions = useMemo(() => {
    const yearsSet = new Set([currentDate.getFullYear()]);
    (state.ledger || []).forEach(tx => {
      if (tx.timestamp) {
        const ms = parseSafeTimestamp(tx.timestamp);
        if (ms) {
          const y = new Date(ms).getFullYear();
          if (!isNaN(y)) yearsSet.add(y);
        }
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [state.ledger, currentDate]);

  // Calculate filtered ledger transactions based on time range and selected month/year
  const filteredLedger = useMemo(() => {
    if (!Array.isArray(state.ledger)) return [];
    const fixedLedger = recalculateLedgerRunningBalances(state.ledger, state.students);
    const now = new Date();

    return fixedLedger.filter(tx => {
      if (!tx.timestamp) return false;
      const txMs = parseSafeTimestamp(tx.timestamp);
      if (!txMs) return false;
      const txDate = new Date(txMs);

      if (timeRange === 'TODAY') {
        return txDate.toDateString() === now.toDateString();
      } else if (timeRange === 'WEEKLY') {
        const diffDays = (now.getTime() - txMs) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7;
      } else if (timeRange === 'MONTHLY') {
        return txDate.getMonth() === Number(selectedMonth) && txDate.getFullYear() === Number(selectedYear);
      }
      return true; // 'ALL'
    });
  }, [state.ledger, state.students, timeRange, selectedMonth, selectedYear]);

  // Overall and Filtered Statistics
  const stats = useMemo(() => {
    const totalSavings = state.students.reduce((sum, s) => sum + (Number(s.savingsBalance) || 0), 0);
    const totalDeposit = state.students.reduce((sum, s) => sum + (Number(s.canteenDepositBalance) || 0), 0);
    const totalStudents = state.students.length;

    // Filtered Metrics for Tabungan & Deposit (Masuk vs Keluar)
    const savingsIn = filteredLedger
      .filter(tx => tx.accountType === 'TABUNGAN' && tx.type === 'CREDIT')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const savingsOut = filteredLedger
      .filter(tx => tx.accountType === 'TABUNGAN' && tx.type === 'DEBIT')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const depositIn = filteredLedger
      .filter(tx => tx.accountType === 'DEPOSIT_KANTIN' && tx.type === 'CREDIT')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const depositOut = filteredLedger
      .filter(tx => tx.accountType === 'DEPOSIT_KANTIN' && tx.type === 'DEBIT')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const searchMatches = filteredLedger.filter(tx => {
      const q = searchQuery.toLowerCase();
      return (tx.studentName || '').toLowerCase().includes(q) ||
             (tx.id || '').toLowerCase().includes(q) ||
             (tx.description || '').toLowerCase().includes(q);
    });

    const recentTransactions = [...searchMatches]
      .sort((a, b) => parseSafeTimestamp(b.timestamp) - parseSafeTimestamp(a.timestamp));

    return {
      totalSavings,
      totalDeposit,
      totalStudents,
      savingsIn,
      savingsOut,
      depositIn,
      depositOut,
      recentTransactions,
      filteredCount: filteredLedger.length
    };
  }, [state.students, state.ledger, filteredLedger, searchQuery]);

  // Export Financial Report to Native Excel (.xlsx)
  const handleExportExcel = () => {
    const monthName = MONTH_NAMES[selectedMonth];
    const rangeLabel = timeRange === 'TODAY' 
      ? 'harian' 
      : timeRange === 'WEEKLY' 
      ? 'pekanan' 
      : timeRange === 'MONTHLY' 
      ? `bulanan_${monthName.toLowerCase()}_${selectedYear}` 
      : 'semua_waktu';

    const timeRangeDescription = timeRange === 'TODAY' 
      ? 'Harian (Hari Ini)' 
      : timeRange === 'WEEKLY' 
      ? 'Pekanan (7 Hari Terakhir)' 
      : timeRange === 'MONTHLY' 
      ? `Bulanan (${monthName} ${selectedYear})` 
      : 'Semua Waktu';

    const filename = `laporan_keuangan_${rangeLabel}_${new Date().toISOString().slice(0,10)}.xlsx`;

    const summaryRows = [
      ['Rentang Waktu Laporan', timeRangeDescription],
      ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
      ['Total Tabungan Masuk (+)', Number(stats.savingsIn)],
      ['Total Tabungan Keluar (-)', Number(stats.savingsOut)],
      ['Total Deposit Masuk (+)', Number(stats.depositIn)],
      ['Total Deposit Keluar (-)', Number(stats.depositOut)],
    ];

    const columns = [
      'ID Mutasi',
      'Waktu Transaksi',
      'Nama Siswa',
      'Tipe Akun Target',
      'Jenis Mutasi',
      'Nominal (Rp)',
      'Saldo Akhir (Rp)',
      'Keterangan'
    ];

    const dataRows = filteredLedger.map(tx => [
      tx.id,
      new Date(tx.timestamp).toLocaleString('id-ID'),
      tx.studentName,
      tx.accountType === 'TABUNGAN' ? 'Tabungan Utama' : 'Deposit Kantin',
      tx.type === 'CREDIT' ? 'MASUK (+)' : 'KELUAR (-)',
      Number(tx.amount) || 0,
      Number(tx.balanceAfter) || 0,
      tx.description || ''
    ]);

    exportToExcelXlsx({
      filename,
      sheetName: 'Ringkasan Keuangan',
      title: `LAPORAN KEUANGAN SEKOLAH (${timeRangeDescription.toUpperCase()})`,
      summaryRows,
      columns,
      dataRows
    });
  };

  const getPeriodLabel = () => {
    if (timeRange === 'TODAY') return 'hari ini';
    if (timeRange === 'WEEKLY') return '7 hari terakhir';
    if (timeRange === 'MONTHLY') return `bulan ${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    return 'keseluruhan';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Banner & Title */}
      <div className="glass-card flex-between" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <LayoutDashboard size={24} style={{ color: 'var(--primary-700)' }} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--primary-900)' }}>Dashboard Keuangan Admin</h2>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--slate-600)' }}>
            Monitoring saldo tabungan, deposit kantin, arus mutasi (masuk/keluar), dan rekapan laporan keuangan.
          </p>
        </div>

        {/* Export Excel Button */}
        <button
          className="btn btn-primary"
          onClick={handleExportExcel}
          style={{ boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)', fontWeight: 700 }}
        >
          <FileSpreadsheet size={18} /> Ekspor Laporan Excel (.csv)
        </button>
      </div>

      {/* Primary Overall Balances Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>

        {/* Card 1: Total Saldo Tabungan */}
        <div className="glass-card" style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          padding: '1.35rem',
          boxShadow: '0 10px 25px -5px rgba(4, 120, 87, 0.35)'
        }}>
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.12, color: 'white' }}>
            <PiggyBank size={90} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '0.45rem', borderRadius: '10px', backdropFilter: 'blur(8px)' }}>
              <Wallet size={20} color="white" />
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Saldo Tabungan
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
            Rp {stats.totalSavings.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#d1fae5', marginTop: '0.35rem' }}>
            Akumulasi saldo tabungan utama seluruh siswa
          </div>
        </div>

        {/* Card 2: Total Saldo Deposit Kantin */}
        <div className="glass-card" style={{
          background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          padding: '1.35rem',
          boxShadow: '0 10px 25px -5px rgba(217, 119, 6, 0.35)'
        }}>
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.12, color: 'white' }}>
            <BadgeDollarSign size={90} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '0.45rem', borderRadius: '10px', backdropFilter: 'blur(8px)' }}>
              <CreditCard size={20} color="white" />
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fde68a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Saldo Deposit Kantin
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
            Rp {stats.totalDeposit.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#fef3c7', marginTop: '0.35rem' }}>
            Akumulasi saldo deposit kantin seluruh siswa
          </div>
        </div>

        {/* Card 3: Total Siswa Aktif */}
        <div className="glass-card" style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          padding: '1.35rem',
          boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.35)'
        }}>
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.12, color: 'white' }}>
            <Users size={90} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '0.45rem', borderRadius: '10px', backdropFilter: 'blur(8px)' }}>
              <Users size={20} color="white" />
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#bfdbfe', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Siswa Aktif
            </span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
            {stats.totalStudents} <span style={{ fontSize: '1rem', fontWeight: 600 }}>Siswa</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#dbeafe', marginTop: '0.35rem' }}>
            Jumlah siswa aktif pemilik rekening
          </div>
        </div>

      </div>

      {/* Filter Waktu & Arus Mutasi Section Header */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} style={{ color: 'var(--primary-700)' }} />
              Filter Waktu Mutasi Laporan
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '0.1rem' }}>
              Pilih rentang waktu untuk mengamati arus uang masuk (+) dan keluar (-) pada tabungan & deposit kantin.
            </p>
          </div>

          {/* Time Range Filter Buttons - Responsive Segmented Pill Control */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
              background: '#f1f5f9',
              padding: '6px',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}
          >
            {[
              { id: 'TODAY', label: 'Hari Ini' },
              { id: 'WEEKLY', label: '7 Hari' },
              { id: 'MONTHLY', label: 'Bulanan' },
              { id: 'ALL', label: 'Semua Waktu' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTimeRange(item.id)}
                style={{
                  flex: '1 1 auto',
                  minWidth: '70px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: timeRange === item.id ? 800 : 600,
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  background: timeRange === item.id
                    ? 'linear-gradient(135deg, #047857 0%, #10b981 100%)'
                    : 'transparent',
                  color: timeRange === item.id ? '#ffffff' : 'var(--slate-600)',
                  boxShadow: timeRange === item.id
                    ? '0 3px 10px rgba(4, 120, 87, 0.25)'
                    : 'none'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Month & Year Picker Bar (Visible when MONTHLY filter is active) */}
        {timeRange === 'MONTHLY' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'linear-gradient(135deg, #ecfdf5 0%, #e0f2fe 100%)',
            border: '1.5px solid var(--primary-300)',
            padding: '0.65rem 1rem',
            borderRadius: '12px',
            marginBottom: '1.2rem',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--primary-900)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={18} style={{ color: 'var(--primary-700)' }} /> Pilih Bulan & Tahun Filter:
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{ width: 'auto', fontSize: '0.85rem', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: '8px' }}
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    Bulan {name}
                  </option>
                ))}
              </select>

              <select
                className="form-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{ width: 'auto', fontSize: '0.85rem', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: '8px' }}
              >
                {yearOptions.map(yr => (
                  <option key={yr} value={yr}>
                    Tahun {yr}
                  </option>
                ))}
              </select>
            </div>

            <span className="badge badge-emerald" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
              Menampilkan {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
          </div>
        )}

        {/* 4 Cards Breakdown Grid for Filtered Period */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>

          {/* 1. Tabungan Masuk (+) */}
          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #dcfce7 100%)',
            border: '1.5px solid #86efac',
            borderRadius: 'var(--radius-sm)',
            padding: '1.15rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>Tabungan Masuk (+)</span>
              <span className="badge badge-emerald" style={{ fontSize: '0.68rem' }}>Setoran</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#166534' }}>
              Rp {stats.savingsIn.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <ArrowDownRight size={14} /> Total setoran tabungan ({getPeriodLabel()})
            </div>
          </div>

          {/* 2. Tabungan Keluar (-) */}
          <div style={{
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            border: '1.5px solid #fca5a5',
            borderRadius: 'var(--radius-sm)',
            padding: '1.15rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b91c1c' }}>Tabungan Keluar (-)</span>
              <span className="badge badge-red" style={{ fontSize: '0.68rem' }}>Penarikan</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#991b1b' }}>
              Rp {stats.savingsOut.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <ArrowUpRight size={14} /> Total penarikan tabungan ({getPeriodLabel()})
            </div>
          </div>

          {/* 3. Deposit Masuk (+) */}
          <div style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1.5px solid #fde68a',
            borderRadius: 'var(--radius-sm)',
            padding: '1.15rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b45309' }}>Deposit Masuk (+)</span>
              <span className="badge badge-gold" style={{ fontSize: '0.68rem' }}>Top-Up</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#92400e' }}>
              Rp {stats.depositIn.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <ArrowDownRight size={14} /> Total setoran deposit kantin ({getPeriodLabel()})
            </div>
          </div>

          {/* 4. Deposit Keluar (-) */}
          <div style={{
            background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
            border: '1.5px solid #d8b4fe',
            borderRadius: 'var(--radius-sm)',
            padding: '1.15rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b21a8' }}>Deposit Keluar (-)</span>
              <span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>Belanja Kantin</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#581c87' }}>
              Rp {stats.depositOut.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b21a8', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <ArrowUpRight size={14} /> Total belanja/debit kantin ({getPeriodLabel()})
            </div>
          </div>

        </div>
      </div>

      {/* Filtered Mutasi Table */}
      <div className="glass-card">
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: 'var(--primary-600)' }} />
              Daftar Mutasi Transaksi ({stats.filteredCount} Record)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '0.1rem' }}>
              Menampilkan mutasi sesuai filter waktu ({timeRange === 'TODAY' ? 'Harian / Hari Ini' : timeRange === 'WEEKLY' ? 'Pekanan / 7 Hari' : timeRange === 'MONTHLY' ? `Bulanan (${MONTH_NAMES[selectedMonth]} ${selectedYear})` : 'Semua Waktu'}).
            </p>
          </div>

          <button className="btn btn-outline btn-sm" onClick={handleExportExcel}>
            <Download size={15} /> Unduh CSV/Excel ({timeRange === 'MONTHLY' ? `${MONTH_NAMES[selectedMonth]} ${selectedYear}` : timeRange})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px', borderRadius: '10px' }}
            placeholder="Cari transaksi berdasarkan nama siswa, ID mutasi, atau deskripsi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="table-container" style={{ maxHeight: '460px', overflowY: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID / Waktu</th>
                <th>Siswa</th>
                <th>Akun Target</th>
                <th>Tipe Mutasi</th>
                <th style={{ textAlign: 'right' }}>Nominal</th>
                <th style={{ textAlign: 'right' }}>Saldo Akhir</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--slate-400)', padding: '2.5rem' }}>
                    Tidak ada transaksi mutasi tercatat pada rentang waktu ini ({getPeriodLabel()}).
                  </td>
                </tr>
              ) : (
                stats.recentTransactions.map(tx => (
                  <tr key={tx.id}>
                    <td>
                      <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--slate-800)', fontFamily: 'monospace' }}>{tx.id}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>
                        {new Date(tx.timestamp).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{tx.studentName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>{tx.description}</div>
                    </td>
                    <td>
                      <span className={`badge ${tx.accountType === 'TABUNGAN' ? 'badge-emerald' : 'badge-gold'}`}>
                        {tx.accountType === 'TABUNGAN' ? 'Tabungan' : 'Deposit'}
                      </span>
                    </td>
                    <td>
                      {tx.type === 'CREDIT' ? (
                        <span style={{ color: '#047857', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: '#ecfdf5', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                          <ArrowDownRight size={14} /> +MASUK (CREDIT)
                        </span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: '#fef2f2', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                          <ArrowUpRight size={14} /> -KELUAR (DEBIT)
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 800, textAlign: 'right', color: tx.type === 'CREDIT' ? '#047857' : '#dc2626' }}>
                      {tx.type === 'CREDIT' ? '+' : '-'}Rp {tx.amount.toLocaleString('id-ID')}
                    </td>
                    <td style={{ fontWeight: 700, textAlign: 'right', color: 'var(--slate-800)' }}>
                      Rp {tx.balanceAfter.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
