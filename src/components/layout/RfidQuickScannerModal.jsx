import React, { useState } from 'react';
import { CreditCard, Zap, CheckCircle2, XCircle, Volume2, PlusCircle, ArrowRight } from 'lucide-react';
import { verifyRfidCard, checkIdempotency } from '../../services/rfidService';

export default function RfidQuickScannerModal({ isOpen, onClose, cards, students, guardians, onScanSuccess, onRegisterNewCard, cashierMode = false }) {
  const [manualUid, setManualUid] = useState('');
  const [scanResult, setScanResult] = useState(null);

  if (!isOpen) return null;

  const handleTap = (uid) => {
    const cleanUid = uid.trim().toUpperCase();
    const idCheck = checkIdempotency(cleanUid, 1500);
    if (!idCheck.allowed) {
      setScanResult({
        success: false,
        message: idCheck.reason
      });
      return;
    }

    const result = verifyRfidCard(cleanUid, cards, students, guardians);
    setScanResult(result);

    // Kartu baru hanya dapat diarahkan ke form Admin di luar mode kasir.
    if (!cashierMode && onRegisterNewCard) {
      onRegisterNewCard(cleanUid);
    }

    if (result.success && onScanSuccess) {
      onScanSuccess(result);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualUid.trim()) return;
    handleTap(manualUid.trim());
    setManualUid('');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '620px', background: 'white', position: 'relative' }}>
        
        {/* Modal Header */}
        <div className="flex-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--slate-200)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: 'var(--primary-100)', color: 'var(--primary-800)', padding: '0.5rem', borderRadius: '50%' }}>
              <Zap size={22} className="pulse-rfid" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Simulator Terminal Scanner RFID</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>Tap kartu baru / registered &rarr; UID langsung terisi otomatis di Form Admin</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm">✕ Tutup</button>
        </div>

        {/* Scan Result Feedback Box */}
        {scanResult && (
          <div style={{
            marginBottom: '1.25rem',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            border: scanResult.success ? '1px solid var(--primary-500)' : scanResult.isUnregistered ? '2px solid var(--accent-gold-500)' : '1px solid var(--danger-500)',
            background: scanResult.success ? 'var(--primary-50)' : scanResult.isUnregistered ? '#fffbeb' : '#fef2f2',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            {scanResult.success ? (
              <CheckCircle2 size={24} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
            ) : (
              <XCircle size={24} style={{ color: scanResult.isUnregistered ? 'var(--accent-gold-600)' : 'var(--danger-500)', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: scanResult.success ? 'var(--primary-900)' : scanResult.isUnregistered ? 'var(--accent-gold-700)' : '#991b1b' }}>
                {scanResult.success ? `Scan Berhasil [${scanResult.cardType}]` : scanResult.isUnregistered ? '⚡ KARTU BARU TERDETEKSI!' : 'Scan Gagal!'}
              </div>
              <div style={{ fontSize: '0.84rem', color: scanResult.success ? 'var(--slate-700)' : scanResult.isUnregistered ? 'var(--slate-800)' : '#b91c1c', marginTop: '0.2rem' }}>
                {scanResult.success ? (
                  <>
                    {scanResult.cardType === 'SISWA' ? (
                      <>Siswa: <b>{scanResult.student?.name}</b> ({scanResult.student?.class}) | Saldo: <b>Rp {(scanResult.student?.savingsBalance || 0).toLocaleString('id-ID')}</b></>
                    ) : (
                      <div>
                        Penjemput: <b>{scanResult.guardian?.name || 'Orang Tua / Wali'}</b> ({scanResult.guardian?.relationship || 'Wali'})
                        <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {(scanResult.students && scanResult.students.length > 0 ? scanResult.students : [scanResult.student]).map((st, idx) => (
                            st && (
                              <div key={st.id || idx} style={{ background: '#ffffff', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '0.78rem', fontWeight: 700, color: '#1e3a8a' }}>
                                🧒 Anak {idx + 1}: <b>{st.name}</b> (Kelas {st.class})
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  scanResult.isUnregistered && cashierMode ? 'Kartu tidak terdaftar. Silakan hubungi bagian Admin Keuangan.' : scanResult.message
                )}
              </div>

              {/* Direct Fill Alert */}
              <div style={{ display: cashierMode ? 'none' : undefined, marginTop: '0.5rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-800)', background: 'var(--primary-100)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                ✓ UID <b>{scanResult.uid || 'Terbaca'}</b> telah diisikan langsung ke Form Admin!
              </div>
            </div>
          </div>
        )}

        {/* Quick Tap for NEW UNREGISTERED Cards */}
        <div style={{ marginBottom: '1.25rem', background: '#fffbeb', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--accent-gold-500)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-gold-700)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <PlusCircle size={16} /> Tap Kartu BARU (Belum Terdaftar) &rarr; Langsung Masuk Form Admin:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              className="btn btn-gold btn-sm"
              onClick={() => handleTap('RFID-BARU-8899')}
              style={{ fontSize: '0.8rem', fontWeight: 800 }}
            >
              ⚡ Tap Kartu Baru (UID: RFID-BARU-8899)
            </button>
            <button
              className="btn btn-gold btn-sm"
              onClick={() => handleTap('RFID-BARU-7744')}
              style={{ fontSize: '0.8rem', fontWeight: 800 }}
            >
              ⚡ Tap Kartu Baru (UID: RFID-BARU-7744)
            </button>
          </div>
        </div>

        {/* Preset Cards Quick Tap */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: '0.6rem' }}>
            💳 Tap Kartu Terdaftar (Registered Cards):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.6rem' }}>
            {cards.map(card => (
              <button
                key={card.id}
                onClick={() => handleTap(card.uid)}
                style={{
                  textAlign: 'left',
                  padding: '0.7rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: card.type === 'SISWA' ? '1px solid var(--primary-200)' : '1px solid #bfdbfe',
                  background: card.type === 'SISWA' ? 'var(--primary-50)' : '#eff6ff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem'
                }}
                className="glass-card-hover"
              >
                <CreditCard size={18} style={{ color: card.type === 'SISWA' ? 'var(--primary-700)' : '#1e40af' }} />
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.81rem', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {card.assignedToName}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                    UID: {card.uid} ({card.type})
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Manual UID Input */}
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Ketik UID RFID manual (contoh: RFID-BARU-9900)..."
            value={manualUid}
            onChange={(e) => setManualUid(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Tap Manual
          </button>
        </form>

        <div style={{ marginTop: '0.85rem', fontSize: '0.75rem', color: 'var(--slate-400)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Volume2 size={13} /> Dilengkapi efek audio beep synth hardware & auto-populate ke Form Admin jika kartu baru.
        </div>

      </div>
    </div>
  );
}
