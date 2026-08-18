import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ShoppingBag, CreditCard, Radio, AlertTriangle, CheckCircle, RefreshCw, 
  Calculator, DollarSign, UserCheck, Search, ArrowRight, Receipt, ShieldCheck, Zap, X
} from 'lucide-react';
import { verifyRfidCard, checkIdempotency } from '../../services/rfidService';
import { executeLedgerTransaction } from '../../services/ledgerEngine';
import { saveSchoolState } from '../../services/schoolRepository';

export default function CanteenModule({ state, setState, onOpenRfidModal, scannedCardResult }) {
  const [activeStudent, setActiveStudent] = useState(null);
  const [nominal, setNominal] = useState('');
  const [balanceSource, setBalanceSource] = useState('DEPOSIT'); // 'DEPOSIT' | 'TABUNGAN'
  const [feedback, setFeedback] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [isManualSearchOpen, setIsManualSearchOpen] = useState(false);

  const nominalInputRef = useRef(null);

  // Preset Nominals
  const PRESET_NOMINALS = [5000, 10000, 15000, 20000, 25000, 50000];

  const handleAddPreset = (value) => {
    const current = Number(nominal) || 0;
    setNominal(String(current + value));
    if (nominalInputRef.current) nominalInputRef.current.focus();
  };

  // Tap Card RFID handler
  const handleScanCard = (uid) => {
    setFeedback(null);
    setReceipt(null);
    setNominal('');

    const idCheck = checkIdempotency(uid, 3000);
    if (!idCheck.allowed) {
      setFeedback({ type: 'error', text: idCheck.reason });
      return;
    }

    const result = verifyRfidCard(uid, state.rfidCards, state.students, state.guardians);
    if (!result.success) {
      setFeedback({ type: 'error', text: result.isUnregistered ? 'Kartu tidak terdaftar. Silakan daftarkan di menu Admin/Kasir.' : result.message });
      setActiveStudent(null);
      return;
    }

    if (result.cardType !== 'SISWA' || !result.student) {
      setFeedback({ type: 'error', text: 'Kartu RFID ini milik penjemput/orang tua, bukan kartu identitas siswa!' });
      setActiveStudent(null);
      return;
    }

    setActiveStudent(result.student);
    setTimeout(() => {
      if (nominalInputRef.current) nominalInputRef.current.focus();
    }, 80);
  };

  // React to scanned card result from parent / global listener
  useEffect(() => {
    if (!scannedCardResult) return;
    setNominal('');
    setReceipt(null);
    setFeedback(null);

    if (scannedCardResult.isUnregistered) {
      setActiveStudent(null);
      setFeedback({ type: 'error', text: 'Kartu RFID belum terdaftar di sistem.' });
      return;
    }

    if (scannedCardResult.success && scannedCardResult.cardType === 'SISWA' && scannedCardResult.student) {
      setActiveStudent(scannedCardResult.student);
      setTimeout(() => {
        if (nominalInputRef.current) nominalInputRef.current.focus();
      }, 80);
    }
  }, [scannedCardResult]);

  // Derived current active student directly from state.students single source of truth
  const currentActiveStudent = useMemo(() => {
    if (!activeStudent?.id) return null;
    return state.students.find(s => s.id === activeStudent.id) || activeStudent;
  }, [state.students, activeStudent]);

  // Keep activeStudent synced with latest state.students
  useEffect(() => {
    if (activeStudent?.id) {
      const fresh = state.students.find(s => s.id === activeStudent.id);
      if (fresh && (fresh.savingsBalance !== activeStudent.savingsBalance || fresh.canteenDepositBalance !== activeStudent.canteenDepositBalance)) {
        setActiveStudent({ ...fresh });
      }
    }
  }, [state.students, activeStudent?.id]);

  // Process Canteen Payment
  const handleProcessPayment = (e) => {
    if (e) e.preventDefault();

    if (!activeStudent) {
      setFeedback({ type: 'error', text: 'Silakan tap kartu RFID siswa terlebih dahulu!' });
      return;
    }

    const paymentAmount = Number(nominal);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setFeedback({ type: 'error', text: 'Masukkan nominal pembayaran yang valid (> 0)!' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);

    const targetStudent = currentActiveStudent || activeStudent;
    const accountType = balanceSource === 'DEPOSIT' ? 'DEPOSIT_KANTIN' : 'TABUNGAN';
    const currentBalance = balanceSource === 'DEPOSIT' 
      ? (Number(targetStudent?.canteenDepositBalance) || 0) 
      : (Number(targetStudent?.savingsBalance) || 0);

    if (currentBalance < paymentAmount) {
      setIsProcessing(false);
      setFeedback({
        type: 'error',
        text: `Transaksi DITOLAK! Saldo ${balanceSource === 'DEPOSIT' ? 'Deposit Kantin' : 'Tabungan Utama'} tidak mencukupi. (Saldo: Rp ${currentBalance.toLocaleString('id-ID')}, Dibutuhkan: Rp ${paymentAmount.toLocaleString('id-ID')})`
      });
      return;
    }

    try {
      const result = executeLedgerTransaction(state, {
        studentId: targetStudent.id,
        accountType,
        type: 'DEBIT',
        category: 'BELANJA_KANTIN_RFID',
        amount: paymentAmount,
        actor: 'Kasir Kantin RFID',
        reference: `REF-KNT-${Date.now().toString().slice(-6)}`,
        description: `Pembayaran Kantin RFID Rp ${paymentAmount.toLocaleString('id-ID')}`
      });

      const newState = {
        ...state,
        students: result.updatedStudents,
        ledger: [result.newTransaction, ...state.ledger],
        auditLogs: [result.newAudit, ...state.auditLogs]
      };

      setState(newState);
      saveSchoolState(newState).catch(err => console.warn('Sync error saving canteen transaction:', err));

      const updatedStudent = result.updatedStudents.find(s => s.id === targetStudent.id);
      if (updatedStudent) {
        setActiveStudent({ ...updatedStudent });
      }

      // Generate Digital Receipt
      setReceipt({
        id: result.newTransaction.id,
        studentName: targetStudent.name,
        className: targetStudent.class,
        nis: targetStudent.nis,
        rfidUid: targetStudent.rfidUid,
        total: paymentAmount,
        source: accountType === 'DEPOSIT_KANTIN' ? 'Saldo Deposit Kantin' : 'Saldo Tabungan Utama',
        remainingBalance: result.newBalance,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      });

      // Reset nominal
      setNominal('');

      setFeedback({
        type: 'success',
        text: `Pembayaran Rp ${paymentAmount.toLocaleString('id-ID')} BERHASIL! Sisa ${balanceSource === 'DEPOSIT' ? 'Deposit Kantin' : 'Tabungan'}: Rp ${result.newBalance.toLocaleString('id-ID')}`
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Manual search student filter
  const filteredStudents = (state.students || []).filter(s => {
    const q = manualSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (s.name || '').toLowerCase().includes(q) || (s.nis || '').includes(q) || (s.class || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Terminal Kasir Modern */}
      <div className="canteen-header-bar" style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: '18px',
        padding: '1.25rem 1.5rem',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 12px 28px -6px rgba(15, 23, 42, 0.35)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(245, 158, 11, 0.35)'
          }}>
            <ShoppingBag size={24} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Terminal Kasir Kantin Digital
              </h2>
              <span style={{ background: '#f59e0b', color: '#78350f', fontSize: '0.68rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '999px', textTransform: 'uppercase' }}>
                RFID Cashless
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0 0', fontWeight: 500 }}>
              Sistem Pembayaran Cepat Tap Kartu Siswa & Potong Saldo Otomatis
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn"
            onClick={onOpenRfidModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
              padding: '0.55rem 1rem',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)'
            }}
          >
            <Radio size={16} style={{ color: '#f59e0b' }} />
            <span>Simulasi Tap RFID</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column POS Grid Layout */}
      <div className="canteen-pos-grid" style={{ display: 'grid', gap: '1.25rem', alignItems: 'stretch' }}>
        
        {/* ======================================================== */}
        {/* KOLOM 1: PROFIL SISWA & TANGKAPAN RFID */}
        {/* ======================================================== */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.25rem',
          border: '1px solid var(--slate-200)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--slate-800)', fontWeight: 800, fontSize: '0.9rem' }}>
                <UserCheck size={18} style={{ color: '#f59e0b' }} />
                <span>Identitas Siswa</span>
              </div>
              {activeStudent && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveStudent(null);
                    setFeedback(null);
                    setReceipt(null);
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    color: 'var(--slate-500)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Ganti Siswa
                </button>
              )}
            </div>

            {(currentActiveStudent || activeStudent) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Avatar & Identitas Card */}
                <div style={{
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                  borderRadius: '14px',
                  padding: '1rem',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem'
                }}>
                  <img
                    src={(currentActiveStudent || activeStudent).photo}
                    alt={(currentActiveStudent || activeStudent).name}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #ffffff',
                      boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)'
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#78350f', truncate: true, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(currentActiveStudent || activeStudent).name}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 600, marginTop: '2px' }}>
                      Kelas {(currentActiveStudent || activeStudent).class} • NIS: {(currentActiveStudent || activeStudent).nis}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, color: '#b45309', marginTop: '4px', border: '1px solid #fef3c7' }}>
                      <Radio size={10} style={{ color: '#d97706' }} />
                      <span style={{ fontFamily: 'monospace' }}>{(currentActiveStudent || activeStudent).rfidUid}</span>
                    </div>
                  </div>
                </div>

                {/* Sisa Saldo Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {/* Deposit Kantin */}
                  <div style={{
                    background: balanceSource === 'DEPOSIT' ? '#fef3c7' : '#fafafa',
                    border: balanceSource === 'DEPOSIT' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '0.75rem 0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Saldo Deposit Kantin
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#b45309', marginTop: '2px' }}>
                        Rp {(Number((currentActiveStudent || activeStudent).canteenDepositBalance) || 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                    {balanceSource === 'DEPOSIT' && (
                      <div style={{ background: '#f59e0b', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 800 }}>
                        AKTIF
                      </div>
                    )}
                  </div>

                  {/* Tabungan Utama */}
                  <div style={{
                    background: balanceSource === 'TABUNGAN' ? '#ecfdf5' : '#fafafa',
                    border: balanceSource === 'TABUNGAN' ? '2px solid #10b981' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '0.75rem 0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Saldo Tabungan Utama
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                        Rp {(Number((currentActiveStudent || activeStudent).savingsBalance) || 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                    {balanceSource === 'TABUNGAN' && (
                      <div style={{ background: '#10b981', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 800 }}>
                        AKTIF
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                background: '#f8fafc',
                borderRadius: '14px',
                border: '2px dashed var(--slate-300)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Radio size={28} className="pulse-icon" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-800)' }}>
                    Menunggu Tap Kartu RFID
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--slate-500)', marginTop: '4px', maxWidth: '220px' }}>
                    Tempelkan kartu RFID siswa pada alat scanner untuk memulai transaksi kasir.
                  </div>
                </div>

                {/* Manual Student Selector Dropdown Toggle */}
                <div style={{ width: '100%', marginTop: '0.5rem', position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setIsManualSearchOpen(!isManualSearchOpen)}
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid var(--slate-300)',
                      borderRadius: '8px',
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: 'var(--slate-700)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Search size={13} />
                    <span>Pilih Siswa Manual (Tanpa Kartu)</span>
                  </button>

                  {isManualSearchOpen && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      right: 0,
                      marginBottom: '6px',
                      background: 'white',
                      border: '1px solid var(--slate-300)',
                      borderRadius: '10px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      padding: '0.5rem',
                      zIndex: 50,
                      maxHeight: '220px',
                      overflowY: 'auto'
                    }}>
                      <input
                        type="text"
                        placeholder="Cari nama/NIS..."
                        value={manualSearchQuery}
                        onChange={(e) => setManualSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid var(--slate-300)',
                          fontSize: '0.76rem',
                          marginBottom: '0.4rem'
                        }}
                      />
                      {filteredStudents.map(st => (
                        <div
                          key={st.id}
                          onClick={() => {
                            setActiveStudent(st);
                            setIsManualSearchOpen(false);
                            setFeedback(null);
                            setTimeout(() => { if (nominalInputRef.current) nominalInputRef.current.focus(); }, 80);
                          }}
                          style={{
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            display: 'flex',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid #f1f5f9'
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <span style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{st.name} ({st.class})</span>
                          <span style={{ color: '#d97706', fontWeight: 800 }}>Rp {st.canteenDepositBalance.toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '10px', fontSize: '0.72rem', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--slate-200)' }}>
            <ShieldCheck size={14} style={{ color: '#10b981' }} />
            <span>Mode Keamanan Cepat: Idempotensi Transaksi Aktif</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* KOLOM 2: FORM PEMBAYARAN & NOMINAL INPUT */}
        {/* ======================================================== */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.25rem',
          border: '1px solid var(--slate-200)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <form onSubmit={handleProcessPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', justifyContent: 'space-between' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--slate-800)', fontWeight: 800, fontSize: '0.9rem' }}>
                  <Calculator size={18} style={{ color: '#f59e0b' }} />
                  <span>Input Nominal Belanja</span>
                </div>
                {nominal && (
                  <button
                    type="button"
                    onClick={() => setNominal('')}
                    style={{
                      background: '#fee2e2',
                      border: 'none',
                      color: '#ef4444',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Reset Nominal
                  </button>
                )}
              </div>

              {/* Display Input Nominal Utama Oversized */}
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 900,
                  color: 'var(--slate-400)',
                  fontSize: '1.2rem'
                }}>Rp</span>
                <input
                  ref={nominalInputRef}
                  type="number"
                  placeholder="0"
                  value={nominal}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNominal(val.replace(/^0+(?=\d)/, ''));
                  }}
                  disabled={!activeStudent}
                  min="500"
                  step="500"
                  style={{
                    width: '100%',
                    height: '56px',
                    paddingLeft: '48px',
                    paddingRight: '14px',
                    fontSize: '1.6rem',
                    fontWeight: 900,
                    color: '#78350f',
                    background: activeStudent ? '#fffdfa' : '#f8fafc',
                    border: activeStudent ? '2px solid #f59e0b' : '1px solid var(--slate-300)',
                    borderRadius: '12px',
                    outline: 'none',
                    boxShadow: activeStudent ? '0 0 0 4px rgba(245, 158, 11, 0.12)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                />
              </div>

              {/* Quick Preset Nominal Buttons */}
              <div>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--slate-500)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Tombol Nominal Cepat (+):
                </div>
                <div className="canteen-preset-grid" style={{ display: 'grid', gap: '0.5rem' }}>
                  {PRESET_NOMINALS.map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleAddPreset(val)}
                      disabled={!activeStudent}
                      style={{
                        background: activeStudent ? '#fef3c7' : '#f1f5f9',
                        border: activeStudent ? '1px solid #fde68a' : '1px solid #e2e8f0',
                        color: activeStudent ? '#92400e' : '#94a3b8',
                        padding: '0.5rem 0.4rem',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: activeStudent ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s ease',
                        textAlign: 'center'
                      }}
                    >
                      + Rp {val.toLocaleString('id-ID')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Segmented Control Sumber Saldo Pemotongan */}
              <div>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--slate-500)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Sumber Potongan Saldo:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setBalanceSource('DEPOSIT')}
                    disabled={!activeStudent}
                    style={{
                      background: balanceSource === 'DEPOSIT' ? '#f59e0b' : 'transparent',
                      color: balanceSource === 'DEPOSIT' ? '#ffffff' : 'var(--slate-600)',
                      border: 'none',
                      padding: '0.55rem 0.5rem',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: activeStudent ? 'pointer' : 'not-allowed',
                      boxShadow: balanceSource === 'DEPOSIT' ? '0 2px 8px rgba(245, 158, 11, 0.3)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Deposit Kantin
                  </button>

                  <button
                    type="button"
                    onClick={() => setBalanceSource('TABUNGAN')}
                    disabled={!activeStudent}
                    style={{
                      background: balanceSource === 'TABUNGAN' ? '#10b981' : 'transparent',
                      color: balanceSource === 'TABUNGAN' ? '#ffffff' : 'var(--slate-600)',
                      border: 'none',
                      padding: '0.55rem 0.5rem',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: activeStudent ? 'pointer' : 'not-allowed',
                      boxShadow: balanceSource === 'TABUNGAN' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Tabungan Utama
                  </button>
                </div>
              </div>
            </div>

            {/* Tombol Eksekusi Bayar / Potong Saldo */}
            <button
              type="submit"
              disabled={isProcessing || !activeStudent || !nominal || Number(nominal) <= 0}
              style={{
                width: '100%',
                minHeight: '54px',
                background: (!activeStudent || !nominal || Number(nominal) <= 0)
                  ? '#e2e8f0'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: (!activeStudent || !nominal || Number(nominal) <= 0) ? '#94a3b8' : '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 900,
                cursor: (!activeStudent || !nominal || Number(nominal) <= 0) ? 'not-allowed' : 'pointer',
                boxShadow: (!activeStudent || !nominal || Number(nominal) <= 0)
                  ? 'none'
                  : '0 8px 20px rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                marginTop: '0.5rem'
              }}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={18} className="spin-icon" />
                  <span>Memproses Pembayaran...</span>
                </>
              ) : (
                <>
                  <Zap size={18} />
                  <span>
                    {nominal && Number(nominal) > 0
                      ? `Potong Rp ${Number(nominal).toLocaleString('id-ID')} (${balanceSource === 'DEPOSIT' ? 'Deposit' : 'Tabungan'})`
                      : 'Bayar Sekarang'
                    }
                  </span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* ======================================================== */}
        {/* KOLOM 3: NOTIFIKASI FEEDBACK & STRUK DIGITAL KASIR */}
        {/* ======================================================== */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.25rem',
          border: '1px solid var(--slate-200)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--slate-800)', fontWeight: 800, fontSize: '0.9rem' }}>
            <Receipt size={18} style={{ color: '#f59e0b' }} />
            <span>Struk & Status Transaksi</span>
          </div>

          {/* Alert Feedback Pesan Sukses / Gagal */}
          {feedback && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: feedback.type === 'success' ? '#047857' : '#991b1b',
              border: feedback.type === 'success' ? '1px solid #a7f3d0' : '1px solid #fecaca'
            }}>
              {feedback.type === 'success' ? (
                <CheckCircle size={18} style={{ color: '#059669', flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Struk Cetak Digital Result */}
          {receipt ? (
            <div style={{
              background: '#fffdfa',
              border: '1px dashed #f59e0b',
              borderRadius: '14px',
              padding: '1.1rem',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '0.8rem',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.08)'
            }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 900, fontSize: '0.92rem', color: 'var(--slate-900)' }}>
                  🏫 STRUK KASIR KANTIN RFID
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                  {receipt.date} • {receipt.timestamp}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.35rem', color: 'var(--slate-700)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>No. Ref:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--slate-900)' }}>{receipt.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Siswa:</span>
                  <span style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{receipt.studentName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kelas / NIS:</span>
                  <span style={{ fontWeight: 600 }}>{receipt.className} ({receipt.nis})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sumber Saldo:</span>
                  <span style={{ fontWeight: 700, color: '#b45309' }}>{receipt.source}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #cbd5e1', margin: '0.75rem 0' }}></div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--slate-800)' }}>TOTAL POTONG</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#dc2626' }}>
                  - Rp {receipt.total.toLocaleString('id-ID')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', background: '#fef3c7', padding: '0.4rem 0.6rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#78350f' }}>SISA SALDO</span>
                <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#b45309' }}>
                  Rp {receipt.remainingBalance.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          ) : !feedback && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '1.5rem',
              color: 'var(--slate-400)',
              border: '2px dashed var(--slate-200)',
              borderRadius: '14px',
              gap: '0.5rem'
            }}>
              <Receipt size={36} style={{ color: 'var(--slate-300)' }} />
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Struk pembayaran digital akan tampil di sini setelah transaksi selesai.
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ======================================================== */}
      {/* RIWAYAT TRANSAKSI PEMBAYARAN KANTIN TERAKHIR */}
      {/* ======================================================== */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Receipt size={20} style={{ color: '#f59e0b' }} />
            Riwayat Transaksi Pembayaran Kasir Kantin
          </h3>
          <span className="badge badge-gold" style={{ fontWeight: 800 }}>
            {state.ledger.filter(l => l.category === 'BELANJA_KANTIN_RFID' || l.accountType === 'DEPOSIT_KANTIN').length} Transaksi
          </span>
        </div>

        <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. Referensi / Waktu</th>
                <th>Siswa</th>
                <th>Akun Potongan</th>
                <th>Kategori</th>
                <th>Nominal Pembayaran</th>
                <th>Sisa Saldo</th>
                <th>Petugas Kasir</th>
              </tr>
            </thead>
            <tbody>
              {state.ledger.filter(l => l.category === 'BELANJA_KANTIN_RFID' || l.accountType === 'DEPOSIT_KANTIN').length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-400)' }}>
                    Belum ada riwayat transaksi pembayaran kasir kantin tercatat.
                  </td>
                </tr>
              ) : (
                state.ledger
                  .filter(l => l.category === 'BELANJA_KANTIN_RFID' || l.accountType === 'DEPOSIT_KANTIN')
                  .map(t => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8rem', color: 'var(--slate-900)' }}>
                          {t.reference || t.id}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>
                          {new Date(t.timestamp).toLocaleString('id-ID')}
                        </div>
                      </td>
                      <td style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{t.studentName}</td>
                      <td>
                        <span className={`badge ${t.accountType === 'DEPOSIT_KANTIN' ? 'badge-gold' : 'badge-emerald'}`}>
                          {t.accountType === 'DEPOSIT_KANTIN' ? 'Deposit Kantin' : 'Tabungan Utama'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                          {t.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 900, color: '#dc2626' }}>
                        - Rp {(Number(t.amount) || 0).toLocaleString('id-ID')}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--slate-800)' }}>
                        Rp {(Number(t.balanceAfter) || 0).toLocaleString('id-ID')}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--slate-600)' }}>{t.actor}</td>
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
