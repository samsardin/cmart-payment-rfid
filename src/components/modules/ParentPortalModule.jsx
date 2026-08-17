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
          {/* Top Profile Card */}
          <div className="glass-card flex-between" style={{ flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid var(--primary-600)' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <img
                src={student.photo}
                alt={student.name}
                style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-500)' }}
              />
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--slate-900)' }}>{student.name}</h3>
                <div style={{ fontSize: '0.84rem', color: 'var(--slate-600)' }}>
                  Kelas: <b>{student.class}</b> | NIS: <b>{student.nis}</b>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>
                  Orang Tua / Wali: <b>{guardian?.name || student.guardianName}</b> ({guardian?.phone})
                </div>
              </div>
            </div>

            {/* Quick Balances */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ background: 'var(--primary-50)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-200)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary-800)', fontWeight: 600 }}>Saldo Tabungan Utama</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--primary-900)' }}>
                  Rp {student.savingsBalance.toLocaleString('id-ID')}
                </div>
              </div>

              <div style={{ background: 'var(--accent-gold-100)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold-700)', fontWeight: 600 }}>Saldo Deposit Kantin</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--accent-gold-700)' }}>
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
