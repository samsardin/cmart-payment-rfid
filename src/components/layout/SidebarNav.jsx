import React, { useState, useEffect } from 'react';
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
  Menu,
  X,
  CreditCard,
  Activity,
  Upload,
  Database,
  ChevronRight,
  ChevronDown,
  LogOut
} from 'lucide-react';
import { ROLES } from '../../data/mockData';
import cmartLogo from '../../assets/cmart-logo.png';

export default function SidebarNav({
  currentRole,
  setCurrentRole,
  activeTab,
  setActiveTab,
  adminSubTab,
  setAdminSubTab,
  onOpenRfidModal,
  onExportLedger,
  onLogout,
  allowRoleSwitch = false,
  notificationCount = 2,
  isOnline = true,
  isSyncingCloud = false,
  isSupabaseConfigured = false
}) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Close mobile drawer automatically when window resizes to desktop width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Build navigation items with submenus according to role
  const getNavTree = (roleId) => {
    switch (roleId) {
      case 'SUPER_ADMIN':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { 
            id: 'savings', 
            label: 'Tabungan & Ledger', 
            icon: Wallet 
          },
          { 
            id: 'admin', 
            label: 'Master Data & Database', 
            icon: ShieldCheck,
            submenus: [
              { id: 'rfid', label: 'Master Kartu RFID', icon: CreditCard },
              { id: 'students', label: 'Master Siswa & Wali', icon: Users },
              { id: 'import', label: 'Import Batch Excel', icon: Upload },
              { id: 'audit', label: 'Audit Log System', icon: Activity },
              { id: 'database', label: '🛡️ Pemeliharaan Database', icon: Database }
            ]
          },
          { id: 'role_management', label: 'Role Management', icon: Users }
        ];

      case 'ADMIN_KEUANGAN':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { 
            id: 'savings', 
            label: 'Tabungan & Ledger', 
            icon: Wallet 
          },
          { 
            id: 'admin', 
            label: 'Master Data', 
            icon: Users,
            submenus: [
              { id: 'rfid', label: 'Master Kartu RFID', icon: CreditCard },
              { id: 'students', label: 'Master Siswa & Wali', icon: Users },
              { id: 'import', label: 'Import Batch Excel', icon: Upload },
              { id: 'audit', label: 'Audit Log System', icon: Activity }
            ]
          }
        ];

      case 'KASIR_KANTIN':
        return [
          { id: 'canteen', label: 'Terminal Kasir Kantin', icon: ShoppingBag }
        ];

      case 'ORANG_TUA':
      case 'SISWA':
        return [
          { id: 'parent_portal', label: 'Profil & Saldo Siswa', icon: Users },
          { id: 'account', label: 'Akun & Password', icon: KeyRound }
        ];

      default:
        return [];
    }
  };

  const navTree = getNavTree(currentRole.id);

  const handleMenuClick = (tabId, subTabId = null) => {
    setActiveTab(tabId);
    if (subTabId && setAdminSubTab) {
      setAdminSubTab(subTabId);
    }
    setIsMobileDrawerOpen(false);
  };

  // Reusable Sidebar Inner Content Render
  const renderSidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'white' }}>
      
      {/* Brand Header */}
      <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ background: 'white', padding: '0.25rem 0.45rem', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            <img src={cmartLogo} alt="C-Mart Logo" style={{ display: 'block', width: '84px', height: 'auto' }} />
          </div>
          <div>
            <h1 style={{ color: 'white', fontSize: '1.1rem', letterSpacing: '-0.02em', margin: 0 }}>
              C-Mart <span className="badge badge-gold" style={{ fontSize: '0.62rem', padding: '1px 6px' }}>v1.0</span>
            </h1>
            <p style={{ fontSize: '0.72rem', color: '#a7f3d0', opacity: 0.9, margin: 0 }}>
              Sistem Tabungan & Kantin RFID
            </p>
          </div>
        </div>

        {/* Supabase Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.73rem',
          fontWeight: 700,
          padding: '0.3rem 0.6rem',
          borderRadius: '8px',
          background: !isSupabaseConfigured
            ? 'rgba(245, 158, 11, 0.25)'
            : isOnline
              ? (isSyncingCloud ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)')
              : 'rgba(239, 68, 68, 0.25)',
          border: !isSupabaseConfigured
            ? '1px solid #f59e0b'
            : isOnline
              ? (isSyncingCloud ? '1px solid #f59e0b' : '1px solid #34d399')
              : '1px solid #f87171'
        }}>
          {!isSupabaseConfigured ? (
            <>
              <WifiOff size={13} style={{ color: '#fbbf24' }} />
              <span>Mode Lokal (Tanpa Supabase)</span>
            </>
          ) : isOnline ? (
            isSyncingCloud ? (
              <>
                <RefreshCw size={13} className="spin-icon" style={{ color: '#fbbf24' }} />
                <span>Syncing Database...</span>
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
              <span>Offline (Tersimpan Lokal)</span>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tree Section */}
      <div style={{ flex: 1, padding: '1rem 0.85rem', overflowY: 'auto' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem', paddingLeft: '0.5rem' }}>
          NAVIGASI MENU
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {navTree.map(item => {
            const IconComponent = item.icon;
            const isMainActive = activeTab === item.id;
            const hasSubmenus = Array.isArray(item.submenus) && item.submenus.length > 0;

            return (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
                
                {/* Main Item Button */}
                <button
                  type="button"
                  onClick={() => handleMenuClick(item.id, hasSubmenus ? item.submenus[0].id : null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: isMainActive
                      ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                      : 'transparent',
                    color: isMainActive ? '#ffffff' : '#d1fae5',
                    fontWeight: isMainActive ? 800 : 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isMainActive ? '0 4px 14px rgba(5, 150, 105, 0.35)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <IconComponent size={18} style={{ color: isMainActive ? '#ffffff' : '#34d399' }} />
                    <span>{item.label}</span>
                  </div>

                  {hasSubmenus && (
                    isMainActive ? <ChevronDown size={15} /> : <ChevronRight size={15} style={{ opacity: 0.6 }} />
                  )}
                </button>

                {/* Submenus Render (Accordion under active module) */}
                {hasSubmenus && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      marginTop: '0.3rem',
                      marginBottom: '0.3rem',
                      paddingLeft: '1.25rem',
                      borderLeft: '2px solid rgba(52, 211, 153, 0.25)',
                      marginLeft: '1.1rem'
                    }}
                  >
                    {item.submenus.map(sub => {
                      const SubIcon = sub.icon;
                      const isSubActive = isMainActive && adminSubTab === sub.id;

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleMenuClick(item.id, sub.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: isSubActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                            color: isSubActive ? '#ffffff' : '#a7f3d0',
                            fontWeight: isSubActive ? 800 : 500,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textAlign: 'left'
                          }}
                        >
                          <SubIcon size={14} style={{ color: isSubActive ? '#ffffff' : '#6ee7b7' }} />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })}
        </nav>
      </div>

      {/* Control Panel Footer */}
      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        
        {/* RFID Quick Scanner Trigger */}
        <button
          onClick={() => {
            onOpenRfidModal();
            setIsMobileDrawerOpen(false);
          }}
          className="btn btn-gold btn-sm"
          style={{ width: '100%', justifyContent: 'center', padding: '0.55rem', borderRadius: '10px', fontWeight: 700 }}
        >
          <Radio size={16} className="pulse-rfid" />
          <span>Scan Kartu RFID</span>
        </button>

        {/* Export Excel Button (Visible on Savings tab) */}
        {activeTab === 'savings' && onExportLedger && (
          <button
            onClick={() => {
              onExportLedger();
              setIsMobileDrawerOpen(false);
            }}
            className="btn btn-sm"
            style={{
              width: '100%',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.18)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              fontWeight: 700,
              borderRadius: '10px'
            }}
          >
            <FileSpreadsheet size={15} /> Export Rekap Excel
          </button>
        )}

        {/* Role Selector Card */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '10px',
          padding: '0.45rem 0.75rem',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#a7f3d0' }}>
            <RefreshCw size={13} color="#a7f3d0" />
            <span>Peran:</span>
          </div>

          <select
            value={currentRole.id}
            disabled={!allowRoleSwitch}
            onChange={(e) => {
              const roleObj = ROLES[e.target.value];
              setCurrentRole(roleObj);
              const newNav = getNavTree(roleObj.id);
              if (newNav.length > 0) {
                setActiveTab(newNav[0].id);
              }
              setIsMobileDrawerOpen(false);
            }}
            style={{
              background: 'transparent',
              color: 'white',
              border: 'none',
              outline: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: allowRoleSwitch ? 'pointer' : 'default',
              maxWidth: '130px'
            }}
          >
            {Object.values(ROLES).map(r => (
              <option key={r.id} value={r.id} style={{ background: '#0f172a', color: 'white' }}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Logout Button */}
        <button
          onClick={() => {
            onLogout();
            setIsMobileDrawerOpen(false);
          }}
          className="btn btn-secondary btn-sm"
          style={{
            width: '100%',
            justifyContent: 'center',
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#fca5a5',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '10px',
            fontWeight: 700
          }}
        >
          <LogOut size={15} /> Keluar Sistem
        </button>

      </div>

    </div>
  );

  return (
    <>
      {/* 1. PC / DESKTOP LEFT PERMANENT SIDEBAR (>= 1024px) */}
      <aside
        className="desktop-sidebar-nav"
        style={{
          width: '270px',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 200,
          background: 'linear-gradient(180deg, #022c22 0%, #064e3b 50%, #022c22 100%)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.25)'
        }}
      >
        {renderSidebarContent()}
      </aside>

      {/* 2. SMARTPHONE & TABLET TOP HEADER BAR (< 1024px) WITH HAMBURGER MENU GARIS 3 */}
      <header
        className="mobile-header-nav"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 150,
          background: 'linear-gradient(115deg, #022c22 0%, #065f46 52%, #047857 100%)',
          color: 'white',
          padding: '0.65rem 1rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Left: Hamburger Button (Garis 3) + Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Buka Menu Garis 3"
          >
            {isMobileDrawerOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src={cmartLogo} alt="C-Mart Logo" style={{ width: '70px', height: 'auto' }} />
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'white' }}>C-Mart</span>
          </div>
        </div>

        {/* Right: Quick Action Scan RFID + Bell */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onOpenRfidModal}
            className="btn btn-gold btn-sm"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderRadius: '8px' }}
          >
            <Radio size={14} className="pulse-rfid" />
            <span>Scan RFID</span>
          </button>

          <div style={{ position: 'relative', padding: '0.3rem', cursor: 'pointer' }}>
            <Bell size={18} color="white" />
            {notificationCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
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
      </header>

      {/* 3. MOBILE SLIDE-OUT DRAWER OVERLAY (< 1024px) */}
      {isMobileDrawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex' }}>
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsMobileDrawerOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)'
            }}
          />

          {/* Drawer Container */}
          <div
            style={{
              position: 'relative',
              width: 'min(300px, 85vw)',
              height: '100%',
              background: 'linear-gradient(180deg, #022c22 0%, #064e3b 50%, #022c22 100%)',
              boxShadow: '8px 0 30px rgba(0,0,0,0.5)',
              zIndex: 100000,
              overflowY: 'auto'
            }}
          >
            {/* Drawer Close Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.75rem 0.75rem 0' }}>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {renderSidebarContent()}
          </div>
        </div>
      )}
    </>
  );
}
