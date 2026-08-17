import React, { useState } from 'react';
import { CreditCard, LockKeyhole, LogIn, UserRound } from 'lucide-react';
import cmartLogo from '../../assets/cmart-logo.png';

export default function LoginPage({ onPasswordLogin, onRfidLogin, rfidFeedback }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [uid, setUid] = useState('');
  const [feedback, setFeedback] = useState(null);

  const submitPasswordLogin = (event) => {
    event.preventDefault();
    const result = onPasswordLogin(username, password);
    setFeedback(result.success ? null : result);
  };

  const submitRfidLogin = (event) => {
    event.preventDefault();
    const result = onRfidLogin(uid);
    setFeedback(result.success ? null : result);
    if (!result.success) return;
    setUid('');
  };

  const message = rfidFeedback || feedback;

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.25rem', background: 'var(--bg-gradient)' }}>
      <section style={{ width: 'min(920px, 100%)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', background: '#ffffff', overflow: 'hidden', borderRadius: '24px', boxShadow: '0 20px 60px -15px rgba(15, 23, 42, 0.12)', border: '1px solid var(--slate-200)' }}>
        <div style={{ padding: '3rem 2.5rem', background: 'linear-gradient(155deg, #022c22, #047857)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem 1.1rem', borderRadius: '18px', background: '#ffffff', marginBottom: '1.5rem', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25), 0 0 20px rgba(255, 255, 255, 0.8)', border: '2px solid rgba(255, 255, 255, 0.9)' }}>
            <img src={cmartLogo} alt="C-Mart Cendikia Mart" style={{ display: 'block', width: '200px', maxWidth: '100%', height: 'auto', filter: 'drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.9))' }} />
          </div>
          <h1 style={{ color: '#ffffff', fontSize: '1.65rem', lineHeight: 1.2, fontWeight: 800 }}>C-Mart Payment</h1>
          <p style={{ color: '#d1fae5', marginTop: '0.5rem', fontSize: '0.88rem', lineHeight: 1.6 }}>Sistem Pembayaran CMart berbasis kartu RFID melalui Deposit atau Tabungan</p>
          <div className="login-rfid-info-box" style={{ width: '100%', marginTop: '2rem', padding: '1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.2)', fontSize: '0.84rem', color: '#ecfdf5', lineHeight: 1.6, textAlign: 'left' }}>
            <b style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <CreditCard size={16} style={{ color: '#34d399' }} /> Login Kartu RFID
            </b>
            Siswa dan orang tua/wali dapat tap kartu RFID di halaman ini untuk masuk langsung ke portal masing-masing.
          </div>
        </div>

        <div style={{ padding: '3rem 2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--slate-900)', fontWeight: 900, letterSpacing: '0.05em', marginBottom: '1.25rem' }}>LOGIN</h2>
          {message && <div style={{ marginBottom: '1rem', padding: '0.7rem', borderRadius: '8px', background: '#fee2e2', color: '#991b1b', fontSize: '0.82rem' }}>{message.text}</div>}
          <form onSubmit={submitPasswordLogin} style={{ display: 'grid', gap: '0.85rem' }}>
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}><UserRound size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--slate-400)' }} /><input className="form-input" style={{ paddingLeft: '34px' }} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}><LockKeyhole size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--slate-400)' }} /><input type="password" className="form-input" style={{ paddingLeft: '34px' }} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div>
            <button className="btn btn-primary" type="submit" style={{ padding: '0.75rem', fontSize: '0.9rem' }}><LogIn size={16} /> Masuk</button>
          </form>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', margin: '1.5rem 0 1rem', color: 'var(--slate-400)', fontSize: '0.76rem', fontWeight: 600 }}><span style={{ height: '1px', background: 'var(--slate-200)', flex: 1 }} />ATAU TAP RFID<span style={{ height: '1px', background: 'var(--slate-200)', flex: 1 }} /></div>
          <form onSubmit={submitRfidLogin} style={{ display: 'flex', gap: '0.5rem' }}>
            <input className="form-input" placeholder="UID kartu RFID" value={uid} onChange={(event) => setUid(event.target.value)} />
            <button className="btn btn-gold" type="submit" title="Masuk dengan kartu"><CreditCard size={17} /></button>
          </form>
        </div>
      </section>
    </main>
  );
}
