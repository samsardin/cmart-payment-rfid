import React, { useState } from 'react';
import { Users, Wallet, Radio, CreditCard, KeyRound, LockKeyhole } from 'lucide-react';

export default function ParentPortalModule({ state, authenticatedSession, onOpenRfidModal, view, onChangePassword }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState(null);

  const student = state.students.find((item) => item.id === authenticatedSession?.studentId);
  const guardian = state.guardians.find((item) => item.id === authenticatedSession?.guardianId || item.id === student?.guardianId);
  const isPasswordMenu = view === 'account';

  const submitPasswordChange = (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ success: false, text: 'Konfirmasi password baru belum sama.' });
      return;
    }
    const result = onChangePassword(currentPassword, newPassword);
    setPasswordFeedback(result);
    if (result.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  // Student specific data
  const studentLedger = state.ledger.filter(l => l.studentId === student?.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>



      {isPasswordMenu && (
        <div className="glass-card" style={{ width: 'min(520px, 100%)', alignSelf: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <KeyRound size={21} style={{ color: 'var(--primary-700)' }} />
            <div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--slate-900)' }}>Ubah Password</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>Gunakan minimal 6 karakter untuk password baru.</p>
            </div>
          </div>
          {passwordFeedback && <div style={{ marginBottom: '0.9rem', padding: '0.7rem', borderRadius: '8px', background: passwordFeedback.success ? '#dcfce7' : '#fee2e2', color: passwordFeedback.success ? '#166534' : '#991b1b', fontSize: '0.82rem' }}>{passwordFeedback.text}</div>}
          <form onSubmit={submitPasswordChange} style={{ display: 'grid', gap: '0.85rem' }}>
            <label className="form-label">Password saat ini</label>
            <div style={{ position: 'relative' }}><LockKeyhole size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--slate-400)' }} /><input type="password" className="form-input" style={{ paddingLeft: '34px' }} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></div>
            <label className="form-label">Password baru</label>
            <div style={{ position: 'relative' }}><LockKeyhole size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--slate-400)' }} /><input type="password" className="form-input" style={{ paddingLeft: '34px' }} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength="6" required /></div>
            <label className="form-label">Konfirmasi password baru</label>
            <div style={{ position: 'relative' }}><LockKeyhole size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--slate-400)' }} /><input type="password" className="form-input" style={{ paddingLeft: '34px' }} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="6" required /></div>
            <button className="btn btn-primary" type="submit"><KeyRound size={16} /> Simpan Password Baru</button>
          </form>
        </div>
      )}

      {!isPasswordMenu && student && (
        <>
          {/* Top Profile Card - Modern Luxury Fintech Banner */}
          <div
            className="glass-card"
            style={{
              padding: '1.4rem 1.75rem',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 60%, #ecfdf5 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              boxShadow: '0 10px 30px -5px rgba(6, 95, 70, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.5rem'
            }}
          >
            {/* Student Info Left Section */}
            <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <img
                  src={student.photo}
                  alt={student.name}
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #10b981',
                    boxShadow: '0 6px 16px rgba(16, 185, 129, 0.25)'
                  }}
                />
                <span style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid #ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }} title="Status Siswa Aktif" />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.02em', margin: 0 }}>
                    {student.name}
                  </h3>
                  <span className="badge badge-emerald" style={{ fontSize: '0.7rem', padding: '2px 8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <GraduationCap size={12} /> Kelas {student.class}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', fontSize: '0.84rem', color: 'var(--slate-600)' }}>
                  <div>NIS: <b style={{ color: 'var(--slate-800)', fontFamily: 'monospace' }}>{student.nis}</b></div>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--slate-300)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--slate-600)' }}>
                    <UserCheck size={14} style={{ color: 'var(--primary-600)' }} />
                    Wali: <b style={{ color: 'var(--slate-800)' }}>{guardian?.name || student.guardianName || 'Orang Tua / Wali'}</b>
                    {guardian?.phone && <span style={{ color: 'var(--slate-400)', fontSize: '0.78rem' }}>({guardian.phone})</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Balances Right Section */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              
              {/* Saldo Tabungan Utama Card */}
              <div style={{
                background: '#ffffff',
                padding: '0.9rem 1.4rem',
                borderRadius: '16px',
                border: '1.5px solid #a7f3d0',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.08)',
                minWidth: '170px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#065f46', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <Wallet size={15} style={{ color: '#059669' }} />
                  <span>Saldo Tabungan</span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#064e3b', letterSpacing: '-0.02em' }}>
                  Rp {student.savingsBalance.toLocaleString('id-ID')}
                </div>
              </div>

              {/* Saldo Deposit Kantin Card */}
              <div style={{
                background: '#ffffff',
                padding: '0.9rem 1.4rem',
                borderRadius: '16px',
                border: '1.5px solid #fde68a',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.08)',
                minWidth: '170px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#92400e', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <ShoppingBag size={15} style={{ color: '#d97706' }} />
                  <span>Deposit Kantin</span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#78350f', letterSpacing: '-0.02em' }}>
                  Rp {student.canteenDepositBalance.toLocaleString('id-ID')}
                </div>
              </div>

            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr)', gap: '1.5rem' }}>
            
            {/* Column 1: Financial Mutations */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wallet size={18} style={{ color: 'var(--primary-700)' }} />
                Mutasi Keuangan Anak
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '350px', overflowY: 'auto' }}>
                {studentLedger.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--slate-400)' }}>Belum ada mutasi transaksi.</div>
                ) : (
                  studentLedger.map(tx => (
                    <div key={tx.id} className="flex-between" style={{ padding: '0.6rem 0.8rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{tx.description}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>
                          {new Date(tx.timestamp).toLocaleString('id-ID')} ({tx.accountType})
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: tx.type === 'CREDIT' ? 'var(--primary-700)' : '#dc2626' }}>
                          {tx.type === 'CREDIT' ? '+' : '-'} Rp {tx.amount.toLocaleString('id-ID')}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>
                          Sisa: Rp {tx.balanceAfter.toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {!isPasswordMenu && !student && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1px dashed var(--primary-300)' }}>
          <CreditCard size={42} style={{ color: 'var(--primary-600)', marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>Data siswa tidak ditemukan</h3>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.88rem' }}>Hubungi admin untuk menghubungkan akun login dengan data siswa.</p>
        </div>
      )}

    </div>
  );
}
