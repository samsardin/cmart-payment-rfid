import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Wallet, ArrowDownRight, ArrowUpRight, PlusCircle, CreditCard, Radio, 
  FileSpreadsheet, Search, AlertCircle, CheckCircle, History, TrendingUp, 
  Coins, Receipt, UserCheck, UserPlus, XCircle, RotateCcw, Sparkles, BookOpen 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { executeLedgerTransaction, recalculateLedgerRunningBalances } from '../../services/ledgerEngine';
import { verifyRfidCard, checkIdempotency, playRfidBeep } from '../../services/rfidService';
import { getLocalIsoTimestamp, getLocalTodayDateString, formatDisplayTimestamp, parseTimestampMs } from '../../services/dateUtils';
import { getClientIpAndDevice } from '../../services/networkUtils';
import { saveSchoolState, saveLedgerTransactionToSupabase } from '../../services/schoolRepository';

export default function SavingsModule({ state, setState, onOpenRfidModal, scannedCardResult }) {
  // activeStudent is null by default until an RFID card is scanned or student is selected manually
  const [activeStudent, setActiveStudent] = useState(null);
  const [unregisteredUid, setUnregisteredUid] = useState(null);
  const [selectedManualStudentId, setSelectedManualStudentId] = useState('');
  const [manualStudentSearch, setManualStudentSearch] = useState('');
  
  // Registration form state for unregistered cards
  const [regStudentId, setRegStudentId] = useState('');
  const [regCardType, setRegCardType] = useState('SISWA');

  // Transaction form state
  const [accountType, setAccountType] = useState('DEPOSIT_KANTIN'); // Default: 'DEPOSIT_KANTIN'
  const [transactionType, setTransactionType] = useState('CREDIT'); // 'CREDIT' or 'DEBIT'
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccountType, setFilterAccountType] = useState('ALL');
  const [feedback, setFeedback] = useState(null);
  const amountInputRef = useRef(null);

  const PRESET_AMOUNTS = [10000, 20000, 50000, 100000, 200000, 500000];

  // Global Ledger Metrics
  const globalMetrics = useMemo(() => {
    const totalSavings = state.students.reduce((acc, s) => acc + (s.savingsBalance || 0), 0);
    const totalDeposit = state.students.reduce((acc, s) => acc + (s.canteenDepositBalance || 0), 0);
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTxs = state.ledger.filter(l => l.timestamp && l.timestamp.startsWith(todayStr));
    const todayVol = todayTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);

    return {
      totalSavings,
      totalDeposit,
      todayCount: todayTxs.length,
      todayVol,
      ledgerCount: state.ledger.length
    };
  }, [state.students, state.ledger]);

  // Derived current active student directly from state.students single source of truth
  const currentActiveStudent = useMemo(() => {
    if (!activeStudent?.id) return null;
    return state.students.find(s => s.id === activeStudent.id) || activeStudent;
  }, [state.students, activeStudent?.id]);

  // Keep activeStudent synced with latest state.students
  useEffect(() => {
    if (activeStudent?.id) {
      const fresh = state.students.find(s => s.id === activeStudent.id);
      if (fresh && (fresh.savingsBalance !== activeStudent.savingsBalance || fresh.canteenDepositBalance !== activeStudent.canteenDepositBalance)) {
        setActiveStudent(fresh);
      }
    }
  }, [state.students, activeStudent?.id]);

  // Auto-focus nominal input field cleanly after student card is identified
  useEffect(() => {
    if (activeStudent) {
      setAmount('');
      const timer = setTimeout(() => {
        setAmount('');
        if (amountInputRef.current) {
          amountInputRef.current.focus();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeStudent?.id]);

  // Handle scanned card result from App props or direct scan
  useEffect(() => {
    if (!scannedCardResult) return;
    setFeedback(null);

    // Blur focused inputs so scanner input doesn't leak into amount input
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setAmount('');
    setDescription('');

    if (scannedCardResult.success && scannedCardResult.student) {
      const freshStudent = state.students.find(s => s.id === scannedCardResult.student.id) || scannedCardResult.student;
      setActiveStudent(freshStudent);
      setUnregisteredUid(null);
      setFeedback({
        type: 'success',
        text: `Siswa Teridentifikasi via RFID: ${freshStudent.name} (${freshStudent.class})`
      });
    } else if (scannedCardResult.isUnregistered && scannedCardResult.uid) {
      setActiveStudent(null);
      setUnregisteredUid(scannedCardResult.uid);
      setRegStudentId(state.students[0]?.id || '');
      setFeedback({
        type: 'warning',
        text: `Kartu RFID '${scannedCardResult.uid}' belum terdaftar dalam sistem sekolah. Silakan lengkapi pendaftaran di bawah ini.`
      });
    } else if (!scannedCardResult.success) {
      setActiveStudent(null);
      setUnregisteredUid(null);
      setFeedback({
        type: 'error',
        text: scannedCardResult.message || 'Kartu RFID tidak valid atau tidak dapat digunakan.'
      });
    }
  }, [scannedCardResult]);

  // Handle manual RFID scan simulation inside component
  const handleScanCard = (uid) => {
    setFeedback(null);
    if (!uid) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setAmount('');
    setDescription('');

    const idCheck = checkIdempotency(uid, 1500);
    if (!idCheck.allowed) {
      setFeedback({ type: 'error', text: idCheck.reason });
      return;
    }

    const result = verifyRfidCard(uid, state.rfidCards, state.students, state.guardians);
    
    if (result.success && result.student) {
      setActiveStudent(result.student);
      setUnregisteredUid(null);
      setFeedback({
        type: 'success',
        text: `Siswa Teridentifikasi via RFID: ${result.student.name} (${result.student.class})`
      });
    } else if (result.isUnregistered) {
      setActiveStudent(null);
      setUnregisteredUid(result.uid);
      setRegStudentId(state.students[0]?.id || '');
      setFeedback({
        type: 'warning',
        text: `Kartu RFID '${result.uid}' belum terdaftar dalam sistem sekolah. Silakan daftarkan kartu di bawah ini.`
      });
    } else {
      setActiveStudent(null);
      setUnregisteredUid(null);
      setFeedback({ type: 'error', text: result.message });
    }
  };

  // Submit Registration of New Unregistered RFID Card
  const handleRegisterCardSubmit = (e) => {
    e.preventDefault();
    if (!unregisteredUid) return;
    if (!regStudentId) {
      setFeedback({ type: 'error', text: 'Pilih siswa yang akan dihubungkan dengan kartu RFID ini!' });
      return;
    }

    const targetStudent = state.students.find(s => s.id === regStudentId);
    if (!targetStudent) {
      setFeedback({ type: 'error', text: 'Siswa tidak ditemukan.' });
      return;
    }

    const newCard = {
      id: `CARD-${Date.now()}`,
      uid: unregisteredUid,
      type: regCardType,
      assignedToName: targetStudent.name,
      assignedToId: targetStudent.id,
      status: 'ACTIVE',
      issuedAt: getLocalTodayDateString()
    };

    const updatedStudents = state.students.map(s => 
      s.id === targetStudent.id ? { ...s, rfidUid: unregisteredUid } : s
    );

    const newAudit = {
      id: `AUD-${Date.now()}`,
      timestamp: getLocalIsoTimestamp(),
      actor: 'Admin Keuangan',
      action: 'REGISTER_RFID_CARD',
      entity: 'rfidCards',
      entityId: unregisteredUid,
      details: `Pendaftaran Kartu RFID Siswa Baru: ${unregisteredUid} untuk ${targetStudent.name} (${targetStudent.class})`,
      ip: getClientIpAndDevice()
    };

    setState(prev => ({
      ...prev,
      students: updatedStudents,
      rfidCards: [...prev.rfidCards, newCard],
      auditLogs: [newAudit, ...prev.auditLogs]
    }));

    playRfidBeep('success');
    const updatedStudent = updatedStudents.find(s => s.id === targetStudent.id);
    setActiveStudent(updatedStudent);
    setUnregisteredUid(null);
    setAmount('');
    setDescription('');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setFeedback({
      type: 'success',
      text: `Kartu RFID '${unregisteredUid}' berhasil didaftarkan untuk ${targetStudent.name}! Anda kini dapat memproses setoran / top up.`
    });
  };

  // Submit Ledger Top Up / Transaction
  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!activeStudent) {
      setFeedback({ type: 'error', text: 'Tap kartu RFID siswa terlebih dahulu untuk memproses transaksi!' });
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setFeedback({ type: 'error', text: 'Masukkan nominal transaksi yang valid!' });
      return;
    }

    try {
      const result = executeLedgerTransaction(state, {
        studentId: activeStudent.id,
        accountType,
        type: transactionType,
        category: transactionType === 'CREDIT' 
          ? (accountType === 'TABUNGAN' ? 'SETORAN_TABUNGAN' : 'DEPOSIT_KANTIN')
          : (accountType === 'TABUNGAN' ? 'PENARIKAN_TABUNGAN' : 'PENARIKAN_DEPOSIT_KANTIN'),
        amount: Number(amount),
        actor: 'Admin Keuangan',
        reference: `REF-${Date.now().toString().slice(-6)}`,
        description: description || (transactionType === 'CREDIT' ? 'Setoran Tabungan/Deposit' : 'Penarikan Tunai')
      });

      const newState = {
        ...state,
        students: result.updatedStudents,
        ledger: [result.newTransaction, ...state.ledger],
        auditLogs: [result.newAudit, ...state.auditLogs]
      };

      setState(newState);

      const updatedActive = result.updatedStudents.find(s => s.id === activeStudent.id);
      if (updatedActive) {
        setActiveStudent({ ...updatedActive });
      }

      await saveLedgerTransactionToSupabase(result.newTransaction, result.newAudit, updatedActive);
      saveSchoolState(newState, { skipStudents: true }).catch(err => console.warn('Sync error saving transaction:', err));

      if (transactionType === 'CREDIT') {
        try {
          confetti({
            particleCount: 75,
            spread: 65,
            origin: { y: 0.6 }
          });
        } catch (e) {}
      }

      setFeedback({
        type: 'success',
        text: `Transaksi ${transactionType === 'CREDIT' ? 'Setoran (+)' : 'Penarikan (-)'} Rp ${Number(amount).toLocaleString('id-ID')} Berhasil! Saldo ${accountType === 'TABUNGAN' ? 'Tabungan' : 'Deposit Kantin'} Baru: Rp ${result.newBalance.toLocaleString('id-ID')}`
      });

      setAmount('');
      setDescription('');
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleClearSession = () => {
    setActiveStudent(null);
    setUnregisteredUid(null);
    setSelectedManualStudentId('');
    setManualStudentSearch('');
    setFeedback(null);
    setAmount('');
    setDescription('');
  };

  const filteredLedger = state.ledger.filter(tx => {
    const matchesSearch = (tx.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (tx.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (tx.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (tx.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterAccountType === 'ALL' || tx.accountType === filterAccountType;
    return matchesSearch && matchesType;
  });

  const [studentHistoryTab, setStudentHistoryTab] = useState('ALL');

  const studentTransactionHistory = useMemo(() => {
    if (!currentActiveStudent) return [];
    const fixedLedger = recalculateLedgerRunningBalances(state.ledger, state.students);
    return fixedLedger
      .filter((transaction) => (transaction.studentId === currentActiveStudent.id || transaction.student_id === currentActiveStudent.id))
      .sort((a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp));
  }, [state.ledger, state.students, currentActiveStudent]);

  const studentSavingsHistory = useMemo(() => (
    studentTransactionHistory.filter(t => t.accountType === 'TABUNGAN')
  ), [studentTransactionHistory]);

  const studentDepositHistory = useMemo(() => (
    studentTransactionHistory.filter(t => t.accountType === 'DEPOSIT_KANTIN')
  ), [studentTransactionHistory]);

  const studentSavingsSummary = useMemo(() => (
    studentSavingsHistory.reduce((acc, t) => ({
      credit: acc.credit + (t.type === 'CREDIT' ? Number(t.amount) : 0),
      debit: acc.debit + (t.type === 'DEBIT' ? Number(t.amount) : 0),
      count: acc.count + 1
    }), { credit: 0, debit: 0, count: 0 })
  ), [studentSavingsHistory]);

  const studentDepositSummary = useMemo(() => (
    studentDepositHistory.reduce((acc, t) => ({
      credit: acc.credit + (t.type === 'CREDIT' ? Number(t.amount) : 0),
      debit: acc.debit + (t.type === 'DEBIT' ? Number(t.amount) : 0),
      count: acc.count + 1
    }), { credit: 0, debit: 0, count: 0 })
  ), [studentDepositHistory]);

  const filteredStudentHistory = useMemo(() => {
    if (studentHistoryTab === 'TABUNGAN') return studentSavingsHistory;
    if (studentHistoryTab === 'DEPOSIT_KANTIN') return studentDepositHistory;
    return studentTransactionHistory;
  }, [studentHistoryTab, studentSavingsHistory, studentDepositHistory, studentTransactionHistory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      




      {/* Dynamic Main Work Area: Unregistered Card Form OR Active Student Top-Up Form OR Full Ledger View */}
      {unregisteredUid ? (
        
        /* Form Pendaftaran Kartu RFID Baru */
        <div className="glass-card" style={{ padding: '1.75rem', border: '2px solid var(--accent-gold-500)', background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', color: '#b45309' }}>
            <UserPlus size={24} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Pendaftaran Kartu RFID Siswa Baru</h3>
          </div>

          <form onSubmit={handleRegisterCardSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem', marginBottom: '1.25rem' }}>
              
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>UID Kartu RFID Scanned:</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={unregisteredUid} 
                  readOnly 
                  style={{ background: '#f1f5f9', fontWeight: 800, fontFamily: 'monospace', color: 'var(--slate-800)' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Pilih Siswa yang Dihubungkan:</label>
                <select
                  className="form-select"
                  value={regStudentId}
                  onChange={(e) => setRegStudentId(e.target.value)}
                  style={{ fontWeight: 700 }}
                >
                  <option value="">-- Pilih Siswa --</option>
                  {state.students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.class}) — NIS: {s.nis} {s.rfidUid ? `(Sudah ada RFID: ${s.rfidUid})` : '(Belum ada RFID)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Tipe Kartu Identitas:</label>
                <select
                  className="form-select"
                  value={regCardType}
                  onChange={(e) => setRegCardType(e.target.value)}
                  style={{ fontWeight: 700 }}
                >
                  <option value="SISWA">Kartu Utama Siswa (SISWA)</option>
                  <option value="PENJEMPUT">Kartu Wali / Penjemput (PENJEMPUT)</option>
                </select>
              </div>

            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-gold btn-lg" style={{ flex: 1, boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)' }}>
                <UserPlus size={18} /> Daftarkan & Hubungkan Kartu RFID
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClearSession}>
                Batal
              </button>
            </div>
          </form>
        </div>

      ) : currentActiveStudent ? (
        
        /* Identified Student Top-Up & Transaction Form */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={20} style={{ color: 'var(--primary-600)' }} />
                Loket Transaksi Siswa (Active Session)
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <select
                  className="form-select"
                  style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '8px', borderColor: 'var(--primary-300)', maxWidth: '200px' }}
                  value={currentActiveStudent.id}
                  onChange={(e) => {
                    const sId = e.target.value;
                    if (sId) {
                      const found = state.students.find(s => s.id === sId);
                      if (found) {
                        setActiveStudent(found);
                        setSelectedManualStudentId(sId);
                        setFeedback({
                          type: 'success',
                          text: `Siswa Dipilih Manual: ${found.name} (${found.class}) - NIS: ${found.nis}`
                        });
                      }
                    }
                  }}
                >
                  {state.students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.class}) — NIS: {s.nis}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary btn-sm" onClick={handleClearSession} style={{ fontSize: '0.75rem' }}>
                  <RotateCcw size={14} /> Ganti / Reset
                </button>
              </div>
            </div>

            {/* Student Digital Fintech Card */}
            <div className="fintech-card" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div className="fintech-chip" />
                  <span style={{ fontSize: '0.7rem', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                    RFID Smartcard Student Pass
                  </span>
                </div>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', fontSize: '0.7rem' }}>
                  {currentActiveStudent.class}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', marginBottom: '1.2rem' }}>
                <img
                  src={currentActiveStudent.photo}
                  alt={currentActiveStudent.name}
                  style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #34d399', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white', letterSpacing: '-0.01em' }}>{currentActiveStudent.name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#d1fae5' }}>NIS: {currentActiveStudent.nis} | Kartu Terdaftar</div>
                  <div style={{ fontSize: '0.72rem', color: '#a7f3d0', fontFamily: 'monospace' }}>UID: {currentActiveStudent.rfidUid}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', background: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 600 }}>Saldo Tabungan Utama</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#34d399' }}>
                    Rp {(Number(currentActiveStudent.savingsBalance) || 0).toLocaleString('id-ID')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#fde68a', textTransform: 'uppercase', fontWeight: 600 }}>Saldo Deposit Kantin</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fbbf24' }}>
                    Rp {(Number(currentActiveStudent.canteenDepositBalance) || 0).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction Form */}
            <form onSubmit={handleTransactionSubmit}>
              
              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>Tujuan Akun Target:</label>
                <div className="segmented-toggle">
                  <button
                    type="button"
                    className={`segmented-toggle-btn ${accountType === 'TABUNGAN' ? 'active-primary' : ''}`}
                    onClick={() => setAccountType('TABUNGAN')}
                  >
                    <Wallet size={16} /> Saldo Tabungan Utama
                  </button>
                  <button
                    type="button"
                    className={`segmented-toggle-btn ${accountType === 'DEPOSIT_KANTIN' ? 'active-gold' : ''}`}
                    onClick={() => setAccountType('DEPOSIT_KANTIN')}
                  >
                    <Coins size={16} /> Deposit Kantin
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>Jenis Mutasi Keuangan:</label>
                <div className="segmented-toggle">
                  <button
                    type="button"
                    className={`segmented-toggle-btn ${transactionType === 'CREDIT' ? 'active-primary' : ''}`}
                    onClick={() => setTransactionType('CREDIT')}
                  >
                    <ArrowDownRight size={16} /> Setoran / Top-Up (+)
                  </button>
                  <button
                    type="button"
                    className={`segmented-toggle-btn ${transactionType === 'DEBIT' ? 'active-danger' : ''}`}
                    onClick={() => setTransactionType('DEBIT')}
                  >
                    <ArrowUpRight size={16} /> Penarikan Tunai (-)
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label className="form-label" style={{ fontSize: '0.84rem', fontWeight: 700 }}>Nominal Transaksi (Rp):</label>
                  {amount && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-700)' }}>
                      Rp {Number(amount).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Masukkan nominal, contoh: 50000"
                  ref={amountInputRef}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1000"
                  step="1000"
                  style={{ fontSize: '1.05rem', fontWeight: 700, padding: '0.75rem 1rem' }}
                />

                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Preset Cepat:
                  </div>
                  <div className="preset-grid">
                    {PRESET_AMOUNTS.map(val => (
                      <button
                        key={val}
                        type="button"
                        className={`preset-chip ${Number(amount) === val ? 'active' : ''}`}
                        onClick={() => setAmount(val.toString())}
                      >
                        +Rp {(val / 1000).toLocaleString('id-ID')}rb
                      </button>
                    ))}
                  </div>
                </div>
              </div>



              <button 
                type="submit" 
                className={`btn ${transactionType === 'CREDIT' ? 'btn-primary' : 'btn-danger'}`} 
                style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', boxShadow: 'var(--shadow-md)' }}
              >
                {transactionType === 'CREDIT' ? (
                  <><PlusCircle size={18} /> Eksekusi Setoran (+) Rp {Number(amount || 0).toLocaleString('id-ID')}</>
                ) : (
                  <><ArrowUpRight size={18} /> Eksekusi Penarikan (-) Rp {Number(amount || 0).toLocaleString('id-ID')}</>
                )}
              </button>

            </form>
          </div>

          {/* Student Passbook View: Rekap & History Tabungan & Deposit Kantin */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen size={20} style={{ color: 'var(--primary-700)' }} />
                  Buku Rekap & Mutasi: {currentActiveStudent.name}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '0.1rem' }}>
                  Rincian saldo & riwayat transaksi lengkap untuk Akun Tabungan dan Deposit Kantin.
                </p>
              </div>

              {/* History Filter Segmented Tabs */}
              <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--slate-100)', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${studentHistoryTab === 'ALL' ? 'btn-primary' : ''}`}
                  onClick={() => setStudentHistoryTab('ALL')}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: studentHistoryTab === 'ALL' ? undefined : 'transparent', color: studentHistoryTab === 'ALL' ? undefined : 'var(--slate-600)', boxShadow: studentHistoryTab === 'ALL' ? undefined : 'none' }}
                >
                  Semua ({studentTransactionHistory.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${studentHistoryTab === 'TABUNGAN' ? 'btn-primary' : ''}`}
                  onClick={() => setStudentHistoryTab('TABUNGAN')}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: studentHistoryTab === 'TABUNGAN' ? undefined : 'transparent', color: studentHistoryTab === 'TABUNGAN' ? undefined : 'var(--slate-600)', boxShadow: studentHistoryTab === 'TABUNGAN' ? undefined : 'none' }}
                >
                  Tabungan ({studentSavingsHistory.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${studentHistoryTab === 'DEPOSIT_KANTIN' ? 'btn-gold' : ''}`}
                  onClick={() => setStudentHistoryTab('DEPOSIT_KANTIN')}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: studentHistoryTab === 'DEPOSIT_KANTIN' ? undefined : 'transparent', color: studentHistoryTab === 'DEPOSIT_KANTIN' ? undefined : 'var(--slate-600)', boxShadow: studentHistoryTab === 'DEPOSIT_KANTIN' ? undefined : 'none' }}
                >
                  Deposit ({studentDepositHistory.length})
                </button>
              </div>
            </div>

            {/* Account Summary Cards Side-by-Side */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
              
              {/* Card Akun Tabungan Utama */}
              <div style={{ padding: '0.9rem', borderRadius: '12px', background: '#ecfdf5', border: '1.5px solid #a7f3d0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#047857', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Wallet size={15} /> Akun Tabungan Utama
                  </div>
                  <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>{studentSavingsSummary.count} Tx</span>
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#064e3b', marginBottom: '0.4rem' }}>
                  Rp {(Number(currentActiveStudent.savingsBalance) || 0).toLocaleString('id-ID')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#047857', borderTop: '1px dashed #a7f3d0', paddingTop: '0.35rem' }}>
                  <span>Setoran (+): <b>Rp {studentSavingsSummary.credit.toLocaleString('id-ID')}</b></span>
                  <span>Penarikan (-): <b>Rp {studentSavingsSummary.debit.toLocaleString('id-ID')}</b></span>
                </div>
              </div>

              {/* Card Akun Deposit Kantin */}
              <div style={{ padding: '0.9rem', borderRadius: '12px', background: '#fffbeb', border: '1.5px solid #fde68a' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Coins size={15} /> Akun Deposit Kantin
                  </div>
                  <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>{studentDepositSummary.count} Tx</span>
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#92400e', marginBottom: '0.4rem' }}>
                  Rp {(Number(currentActiveStudent.canteenDepositBalance) || 0).toLocaleString('id-ID')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#b45309', borderTop: '1px dashed #fde68a', paddingTop: '0.35rem' }}>
                  <span>Top-Up (+): <b>Rp {studentDepositSummary.credit.toLocaleString('id-ID')}</b></span>
                  <span>Belanja (-): <b>Rp {studentDepositSummary.debit.toLocaleString('id-ID')}</b></span>
                </div>
              </div>

            </div>

            {/* Passbook History Table */}
            <div className="table-container" style={{ maxHeight: '360px', overflowY: 'auto', borderRadius: '10px' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Ref</th>
                    <th>Akun</th>
                    <th>Tipe Mutasi</th>
                    <th style={{ textAlign: 'right' }}>Nominal</th>
                    <th style={{ textAlign: 'right' }}>Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudentHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--slate-400)', padding: '1.75rem' }}>
                        Belum ada riwayat mutasi untuk kategori ini.
                      </td>
                    </tr>
                  ) : (
                    filteredStudentHistory.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                          {formatDisplayTimestamp(tx.timestamp)}
                        </td>
                        <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>{tx.id}</td>
                        <td>
                          <span className={`badge ${tx.accountType === 'TABUNGAN' ? 'badge-emerald' : 'badge-gold'}`} style={{ fontSize: '0.68rem' }}>
                            {tx.accountType === 'TABUNGAN' ? 'Tabungan' : 'Deposit'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: tx.type === 'CREDIT' ? '#047857' : '#dc2626', fontSize: '0.75rem' }}>
                          {tx.type === 'CREDIT' ? '+Setoran' : '-Penarikan / Belanja'}
                        </td>
                        <td style={{ fontWeight: 800, textAlign: 'right', color: tx.type === 'CREDIT' ? '#047857' : '#dc2626' }}>
                          {tx.type === 'CREDIT' ? '+' : '-'}Rp {tx.amount.toLocaleString('id-ID')}
                        </td>
                        <td style={{ fontWeight: 700, textAlign: 'right' }}>
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

      ) : (
        /* Manual Student Selection Card (Top-Up Without RFID Tap) */
        <div className="glass-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1.5px solid var(--primary-300)', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: '#ecfdf5', padding: '0.55rem', borderRadius: '12px', color: '#047857', border: '1px solid #a7f3d0' }}>
                <UserCheck size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--slate-800)', fontWeight: 800 }}>
                  Loket Top-Up & Setoran Siswa (Tanpa Tap Kartu)
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--slate-500)' }}>
                  Pilih atau cari nama/NIS siswa di bawah ini untuk langsung memproses setoran Tabungan Utama & Deposit Kantin.
                </p>
              </div>
            </div>
            
            <button className="btn btn-secondary btn-sm" onClick={onOpenRfidModal} style={{ fontWeight: 700, color: 'var(--primary-700)', borderColor: 'var(--primary-300)' }}>
              <Radio size={16} /> Tap / Simulasi Kartu RFID
            </button>
          </div>

          {/* Search & Select Control */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--primary-900)' }}>
                <Search size={14} style={{ display: 'inline', marginRight: '4px', color: 'var(--primary-600)' }} />
                1. Cari & Pilih Siswa dari Dropdown:
              </label>
              <select
                className="form-select"
                value={selectedManualStudentId}
                onChange={(e) => {
                  const sId = e.target.value;
                  setSelectedManualStudentId(sId);
                  if (sId) {
                    const found = state.students.find(s => s.id === sId);
                    if (found) {
                      setActiveStudent(found);
                      setFeedback({
                        type: 'success',
                        text: `Siswa Dipilih Manual: ${found.name} (${found.class}) - NIS: ${found.nis}`
                      });
                    }
                  }
                }}
                style={{ fontSize: '0.95rem', fontWeight: 700, padding: '0.7rem 0.9rem', borderRadius: '10px', borderColor: 'var(--primary-400)', background: '#f0fdf4' }}
              >
                <option value="">-- Klik di sini untuk cari nama / NIS siswa --</option>
                {state.students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.class}) — NIS: {s.nis} | Saldo Tabungan: Rp {(s.savingsBalance || 0).toLocaleString('id-ID')} | Deposit: Rp {(s.canteenDepositBalance || 0).toLocaleString('id-ID')}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                2. Filter Cepat Daftar Siswa:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ketik nama atau NIS untuk memperkecil daftar..."
                value={manualStudentSearch}
                onChange={(e) => setManualStudentSearch(e.target.value)}
                style={{ fontSize: '0.9rem', padding: '0.7rem 0.9rem', borderRadius: '10px' }}
              />
            </div>

          </div>

          {/* Quick Select Student Cards */}
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--slate-600)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={14} style={{ color: 'var(--accent-gold-600)' }} />
              Atau Klik Kartu Siswa di Bawah Ini:
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {(state.students || [])
                .filter(s => {
                  const q = manualStudentSearch.toLowerCase().trim();
                  if (!q) return true;
                  return (s.name || '').toLowerCase().includes(q) || (s.nis || '').toLowerCase().includes(q) || (s.class || '').toLowerCase().includes(q);
                })
                .slice(0, 8)
                .map(s => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveStudent(s);
                      setSelectedManualStudentId(s.id);
                      setFeedback({
                        type: 'success',
                        text: `Siswa Dipilih Manual: ${s.name} (${s.class}) - NIS: ${s.nis}`
                      });
                    }}
                    className="glass-card"
                    style={{
                      padding: '0.85rem',
                      cursor: 'pointer',
                      border: '1.5px solid var(--slate-200)',
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      background: 'white'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-500)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--slate-200)';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <img
                        src={s.photo}
                        alt={s.name}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-400)' }}
                      />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
                          {s.class} • NIS: {s.nis}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.6rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--slate-200)', fontSize: '0.72rem' }}>
                      <span style={{ color: 'var(--primary-700)', fontWeight: 700 }}>
                        Tabungan: Rp {(s.savingsBalance || 0).toLocaleString('id-ID')}
                      </span>
                      <span style={{ color: 'var(--accent-gold-700)', fontWeight: 700 }}>
                        Deposit: Rp {(s.canteenDepositBalance || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

        </div>
      )}

      {/* Main Full Ledger Transaction Table */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Receipt size={20} style={{ color: 'var(--primary-700)' }} />
              Jurnal Ledger Mutasi Seluruh Sekolah (Immutable Audit Trail)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '0.1rem' }}>
              Pencatatan keuangan terpusat seluruh siswa & kantin terverifikasi secara realtime.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--slate-100)', padding: '3px', borderRadius: '10px' }}>
            {['ALL', 'TABUNGAN', 'DEPOSIT_KANTIN'].map(type => (
              <button
                key={type}
                className={`btn btn-sm ${filterAccountType === type ? 'btn-primary' : ''}`}
                onClick={() => setFilterAccountType(type)}
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.75rem',
                  background: filterAccountType === type ? undefined : 'transparent',
                  color: filterAccountType === type ? undefined : 'var(--slate-600)',
                  boxShadow: filterAccountType === type ? undefined : 'none'
                }}
              >
                {type === 'ALL' ? 'Semua Akun' : type === 'TABUNGAN' ? 'Tabungan Utama' : 'Deposit Kantin'}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px', borderRadius: '12px' }}
            placeholder="Cari transaksi ledger (Nama siswa, ID Jurnal, Deskripsi)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Full Ledger Table */}
        <div className="table-container" style={{ maxHeight: '550px', overflowY: 'auto', borderRadius: '12px' }}>
          <table className="custom-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <tr>
                <th>ID Ref / Waktu</th>
                <th>Nama Siswa</th>
                <th>Akun Target</th>
                <th>Tipe Mutasi</th>
                <th style={{ textAlign: 'right' }}>Nominal</th>
                <th style={{ textAlign: 'right' }}>Saldo Akhir</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--slate-400)', padding: '2.5rem' }}>
                    <Receipt size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                    <div>Belum ada transaksi ledger yang memenuhi kriteria pencarian.</div>
                  </td>
                </tr>
              ) : (
                filteredLedger.map(tx => (
                  <tr key={tx.id} style={{ transition: 'background 0.15s ease' }}>
                    <td>
                      <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--slate-800)', fontFamily: 'monospace' }}>
                        {tx.id}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>
                        {formatDisplayTimestamp(tx.timestamp)}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{tx.studentName}</div>
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
                          <ArrowDownRight size={14} /> +CREDIT
                        </span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: '#fef2f2', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                          <ArrowUpRight size={14} /> -DEBIT
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
