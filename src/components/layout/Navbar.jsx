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
  WifiOff,
  Volume2
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
          { id: 'pickup', label: 'Penjemputan Audio MP3', icon: Volume2 },
          { id: 'savings', label: 'Tabungan & Ledger', icon: Wallet },
          { id: 'admin', label: 'Master Data & Database', icon: ShieldCheck },
          { id: 'role_management', label: 'Role Management', icon: Users },
        ];
      case 'ADMIN_KEUANGAN':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'pickup', label: 'Penjemputan Audio MP3', icon: Volume2 },
          { id: 'savings', label: 'Tabungan & Ledger', icon: Wallet },
          { id: 'admin', label: 'Master Data', icon: Users },
        ];
      case 'ADMIN_PENJEMPUTAN':
        return [
          { id: 'pickup', label: 'Penjemputan Audio MP3', icon: Volume2 },
        ];
      case 'KASIR_KANTIN':
        return [
          { id: 'canteen', label: 'Terminal Kasir Kantin', icon: ShoppingBag },
          { id: 'pickup', label: 'Penjemputan Audio MP3', icon: Volume2 },
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
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.6rem', paddingBottom: '0.5rem' }}>
          
          {/* Logo & Title */}
          {currentRole !== 'ADMIN_PENJEMPUTAN' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                background: 'white',
                padding: '0.25rem 0.4rem',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)'
              }}>
                <img src={cmartLogo} alt="C-Mart Cendikia Mart" style={{ display: 'block', width: '88px', height: 'auto' }} />
              </div>
              <div>
                <h1 style={{ color: 'white', fontSize: '1.15rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  C-Mart Payment <span className="badge badge-gold" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>v1.0 PRD</span>
                </h1>
                <p style={{ fontSize: '0.72rem', color: '#a7f3d0', opacity: 0.95, margin: 0 }}>
                  Sistem Tabungan & Kantin RFID
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                padding: '0.45rem',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                <Volume2 size={24} />
              </div>
              <div>
                <h1 style={{ color: 'white', fontSize: '1.15rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  Sistem Penjemputan Siswa <span className="badge badge-gold" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>Audio MP3</span>
                </h1>
                <p style={{ fontSize: '0.72rem', color: '#a7f3d0', opacity: 0.95, margin: 0 }}>
                  Modul Penjemputan & Voice Call RFID
                </p>
              </div>
            </div>
          )}

          {/* Controls Container - Responsive Modern Layout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            
            {/* RFID Terminal Button */}
            <button
              onClick={onOpenRfidModal}
              className="btn btn-gold btn-sm"
              style={{ fontWeight: 700, padding: '0.38rem 0.85rem', fontSize: '0.78rem', borderRadius: '10px' }}
            >
              <Radio size={14} className="pulse-rfid" />
              <span>Scan Kartu RFID</span>
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
                  fontWeight: 700,
                  padding: '0.38rem 0.75rem',
                  fontSize: '0.78rem',
                  borderRadius: '10px'
                }}
                title="Export Rekap Excel (.xlsx) Mutasi Ledger Tabungan"
              >
                <FileSpreadsheet size={14} /> <span>Export Excel</span>
              </button>
            )}

            {/* Unified Status, Role, & Notification Glass Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(10px)',
                padding: '0.25rem 0.5rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                flexWrap: 'wrap'
              }}
            >
              {/* Online / Offline & Cloud Sync Status Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'white',
                  padding: '0.2rem 0.45rem',
                  borderRadius: '8px',
                  background: !isSupabaseConfigured
                    ? 'rgba(245, 158, 11, 0.3)'
                    : isOnline
                      ? (isSyncingCloud ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)')
                      : 'rgba(239, 68, 68, 0.3)'
                }}
                title={
                  !isSupabaseConfigured
                    ? 'Mode Lokal (Tanpa Supabase)'
                    : isOnline
                      ? (isSyncingCloud ? 'Syncing...' : 'Terhubung ke Supabase Cloud')
                      : 'Mode Offline'
                }
              >
                {!isSupabaseConfigured ? (
                  <>
                    <WifiOff size={12} style={{ color: '#fbbf24' }} />
                    <span>Lokal</span>
                  </>
                ) : isOnline ? (
                  isSyncingCloud ? (
                    <>
                      <RefreshCw size={12} className="spin-icon" style={{ color: '#fbbf24' }} />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <Wifi size={12} style={{ color: '#34d399' }} />
                      <span>Connected</span>
                    </>
                  )
                ) : (
                  <>
                    <WifiOff size={12} style={{ color: '#f87171' }} />
                    <span>Offline</span>
                  </>
                )}
              </div>

              <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)' }} />

              {/* Role Switcher Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <RefreshCw size={12} color="#a7f3d0" />
                <span style={{ fontSize: '0.72rem', color: '#d1fae5' }}>Peran:</span>
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
                    fontSize: '0.78rem',
                    cursor: allowRoleSwitch ? 'pointer' : 'default',
                    paddingRight: '4px'
                  }}
                >
                  {Object.values(ROLES).map(r => (
                    <option key={r.id} value={r.id} style={{ background: '#0f172a', color: 'white' }}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)' }} />

              {/* Notification Badge */}
              <div style={{ position: 'relative', padding: '0.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Bell size={16} color="white" />
                {notificationCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-4px',
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: '50%',
                    width: '15px',
                    height: '15px',
                    fontSize: '9px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {notificationCount}
                  </span>
                )}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="btn btn-secondary btn-sm"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: 'white',
                borderColor: 'rgba(255,255,255,0.25)',
                padding: '0.38rem 0.75rem',
                fontSize: '0.78rem',
                borderRadius: '10px'
              }}
            >
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
