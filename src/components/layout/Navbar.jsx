import React from 'react';
import { 
  Wallet, 
  ShoppingBag, 
  Users, 
  ShieldCheck, 
  Radio, 
  RefreshCw,
  Bell,
  KeyRound,
  LayoutDashboard,
  FileSpreadsheet,
  Wifi,
  WifiOff
} from 'lucide-react';
import { ROLES } from '../../data/mockData';
import cmartLogo from '../../assets/cmart-logo.png';

export default function Navbar({ 
  currentRole, 
  setCurrentRole, 
  activeTab, 
  setActiveTab, 
  onOpenRfidModal,
  onExportLedger,
  onLogout,
  allowRoleSwitch = false,
  notificationCount = 2,
  isOnline = true,
  isSyncingCloud = false,
  isSupabaseConfigured = false
}) {

  // Define tabs available per role
  const getRoleTabs = (roleId) => {
    switch (roleId) {
      case 'SUPER_ADMIN':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'savings', label: 'Tabungan & Ledger', icon: Wallet },
          { id: 'admin', label: 'Master Data & Database', icon: ShieldCheck },
          { id: 'role_management', label: 'Role Management', icon: Users },
        ];
      case 'ADMIN_KEUANGAN':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'savings', label: 'Tabungan & Ledger', icon: Wallet },
          { id: 'admin', label: 'Master Data', icon: Users },
        ];
      case 'KASIR_KANTIN':
        return [
          { id: 'canteen', label: 'Terminal Kasir Kantin', icon: ShoppingBag },
        ];
      case 'ORANG_TUA':
        return [
          { id: 'parent_portal', label: 'Dashboard Orang Tua', icon: Users },
          { id: 'account', label: 'Akun & Password', icon: KeyRound },
        ];
      case 'SISWA':
        return [
          { id: 'parent_portal', label: 'Profil & Saldo Siswa', icon: Users },
          { id: 'account', label: 'Akun & Password', icon: KeyRound },
        ];
      default:
        return [];
    }
  };

  const currentTabs = getRoleTabs(currentRole.id);

  return (
    <header style={{
      background: 'var(--header-gradient)',
      color: 'white',
      boxShadow: '0 4px 20px rgba(6, 78, 59, 0.25)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0.75rem 1.25rem' }}>
        
        {/* Top Header Bar */}
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.6rem' }}>
          
          {/* Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'white',
              padding: '0.3rem 0.45rem',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              <img src={cmartLogo} alt="C-Mart Cendikia Mart" style={{ display: 'block', width: '96px', height: 'auto' }} />
            </div>
            <div>
              <h1 style={{ color: 'white', fontSize: '1.2rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                C-Mart Payment <span className="badge badge-gold" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>v1.0 PRD</span>
              </h1>
              <p style={{ fontSize: '0.75rem', color: '#a7f3d0', opacity: 0.9 }}>
                Sistem Terintegrasi Tabungan & Kantin RFID
              </p>
            </div>
          </div>

          {/* Controls: Role Switcher & RFID Simulator Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            
            {/* Online / Offline & Cloud Sync Status Badge */}
            <div
              style={{
                background: !isSupabaseConfigured
                  ? 'rgba(245, 158, 11, 0.28)'
                  : isOnline
                    ? (isSyncingCloud ? 'rgba(245, 158, 11, 0.22)' : 'rgba(16, 185, 129, 0.22)')
                    : 'rgba(239, 68, 68, 0.28)',
                border: !isSupabaseConfigured
                  ? '1px solid #f59e0b'
                  : isOnline
                    ? (isSyncingCloud ? '1px solid #f59e0b' : '1px solid #34d399')
                    : '1px solid #f87171',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'white',
                backdropFilter: 'blur(8px)'
              }}
              title={
                !isSupabaseConfigured
                  ? 'PERHATIAN: Environment variables Supabase belum dikonfigurasi di Vercel (Project Settings > Environment Variables). Data saat ini tersimpan lokal di browser.'
                  : isOnline
                    ? (isSyncingCloud ? 'Mengunggah data ke Supabase Cloud...' : 'Terhubung & Tersinkron ke Supabase Cloud')
                    : 'Mode Offline: Transaksi tersimpan lokal'
              }
            >
              {!isSupabaseConfigured ? (
                <>
                  <WifiOff size={13} style={{ color: '#fbbf24' }} />
                  <span>Mode Lokal (Tanpa Supabase)</span>
                </>
              ) : isOnline ? (
                isSyncingCloud ? (
                  <>
                    <RefreshCw size={13} className="spin-icon" style={{ color: '#fbbf24' }} />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <Wifi size={13} style={{ color: '#34d399' }} />
                    <span>Supabase Connected</span>
                  </>
                )
              ) : (
                <>
                  <WifiOff size={13} style={{ color: '#f87171' }} />
                  <span>Offline (Lokal)</span>
                </>
              )}
            </div>

            {/* RFID Terminal Button */}
            <button
              onClick={onOpenRfidModal}
              className="btn btn-gold btn-sm"
              style={{ fontWeight: 700, letterSpacing: '0.01em' }}
            >
              <Radio size={16} className="pulse-rfid" />
              Scan Kartu RFID
            </button>

            {/* Export Excel Button in Navbar menu bar */}
            {activeTab === 'savings' && onExportLedger && (
              <button
                onClick={onExportLedger}
                className="btn btn-sm"
                style={{
                  background: 'rgba(255, 255, 255, 0.18)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  backdropFilter: 'blur(8px)',
                  fontWeight: 700
                }}
                title="Export Rekap Excel (.xlsx) Mutasi Ledger Tabungan"
              >
                <FileSpreadsheet size={15} /> Export Rekap Excel (.xlsx)
              </button>
            )}

            {/* Role Switcher */}
            <div style={{ background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(8px)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.25)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={14} color="#a7f3d0" />
              <span style={{ fontSize: '0.75rem', color: '#d1fae5' }}>Peran:</span>
              <select
                value={currentRole.id}
                disabled={!allowRoleSwitch}
                onChange={(e) => {
                  const roleObj = ROLES[e.target.value];
                  setCurrentRole(roleObj);
                  const newTabs = getRoleTabs(roleObj.id);
                  if (newTabs.length > 0) {
                    setActiveTab(newTabs[0].id);
                  }
                }}
                style={{
                  background: 'transparent',
                  color: 'white',
                  border: 'none',
                  outline: 'none',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: allowRoleSwitch ? 'pointer' : 'default'
                }}
              >
                {Object.values(ROLES).map(r => (
                  <option key={r.id} value={r.id} style={{ background: '#0f172a', color: 'white' }}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notification Badge */}
            <div style={{ position: 'relative', background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
              <Bell size={18} color="white" />
              {notificationCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  fontSize: '10px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {notificationCount}
                </span>
              )}
            </div>
            <button onClick={onLogout} className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.14)', color: 'white', borderColor: 'rgba(255,255,255,0.25)' }}>
              Keluar
            </button>

          </div>

        </div>

        {/* Tab Navigation Menu */}
        {currentTabs.length > 0 && (
          <nav style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid rgba(255, 255, 255, 0.15)', paddingTop: '0.5rem', overflowX: 'auto' }}>
            {currentTabs.map(tab => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: isActive ? 'white' : 'transparent',
                    color: isActive ? 'var(--primary-900)' : 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    padding: '0.5rem 1rem',
                    fontSize: '0.84rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    boxShadow: isActive ? '0 -2px 10px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  <IconComponent size={16} color={isActive ? 'var(--primary-700)' : '#d1fae5'} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        )}

      </div>
    </header>
  );
}
