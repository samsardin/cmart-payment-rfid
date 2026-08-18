import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/layout/Navbar';
import SidebarNav from './components/layout/SidebarNav';
import RfidQuickScannerModal from './components/layout/RfidQuickScannerModal';
import FinanceDashboardModule from './components/modules/FinanceDashboardModule';
import SavingsModule from './components/modules/SavingsModule';
import CanteenModule from './components/modules/CanteenModule';
import ParentPortalModule from './components/modules/ParentPortalModule';
import AdminModule from './components/modules/AdminModule';
import RoleManagementModule from './components/modules/RoleManagementModule';
import PickupSystemModule from './components/modules/PickupSystemModule';
import LoginPage from './components/layout/LoginPage';

import { useRfidWedge } from './services/useRfidWedge';
import { verifyRfidCard, playRfidBeep } from './services/rfidService';
import { isSupabaseConfigured } from './services/supabaseClient';
import { deleteRfidCard, loadSchoolState, saveSchoolState, ensureDefaultAccountsInSupabase } from './services/schoolRepository';
import { exportToExcelXlsx } from './services/excelExporter';

import {
  ROLES,
  LOGIN_ACCOUNTS,
  INITIAL_STUDENTS,
  INITIAL_GUARDIANS,
  INITIAL_RFID_CARDS,
  INITIAL_LEDGER,
  INITIAL_AUDIT_LOGS
} from './data/mockData';

const LOCAL_STORAGE_KEY = 'SCHOOL_RFID_APP_STATE_V2';
const LEGACY_LOCAL_STORAGE_KEY = 'SCHOOL_RFID_APP_STATE_V1';
const STATE_COLLECTIONS = ['students', 'guardians', 'rfidCards', 'ledger', 'auditLogs', 'loginAccounts'];

function mergeLocalDataIntoCloud(cloudState, localState) {
  return STATE_COLLECTIONS.reduce((mergedState, collection) => {
    const cloudRows = cloudState[collection] || [];
    const localRows = localState[collection] || [];
    const localMap = new Map(localRows.map((row) => [row.id, row]));

    if (collection === 'students') {
      const mergedStudentsMap = new Map();
      cloudRows.forEach(cStudent => {
        if (cStudent && cStudent.id) {
          mergedStudentsMap.set(cStudent.id, cStudent);
        }
      });
      localRows.forEach(lStudent => {
        if (lStudent && lStudent.id) {
          const existingCloud = mergedStudentsMap.get(lStudent.id) || {};
          mergedStudentsMap.set(lStudent.id, {
            ...existingCloud,
            ...lStudent,
            savingsBalance: lStudent.savingsBalance !== undefined ? Number(lStudent.savingsBalance) : Number(existingCloud.savingsBalance || 0),
            canteenDepositBalance: lStudent.canteenDepositBalance !== undefined ? Number(lStudent.canteenDepositBalance) : Number(existingCloud.canteenDepositBalance || 0),
            rfidUid: lStudent.rfidUid || existingCloud.rfidUid
          });
        }
      });

      return {
        ...mergedState,
        students: Array.from(mergedStudentsMap.values())
      };
    }

    if (collection === 'ledger' || collection === 'auditLogs') {
      const rowMap = new Map();
      cloudRows.forEach(r => { if (r && r.id) rowMap.set(r.id, r); });
      localRows.forEach(r => { if (r && r.id) rowMap.set(r.id, r); });

      const sortedRows = Array.from(rowMap.values()).sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
      });

      return {
        ...mergedState,
        [collection]: sortedRows
      };
    }

    const cloudIds = new Set(cloudRows.map((row) => row.id));
    const newLocalRows = localRows.filter((row) => !cloudIds.has(row.id));

    return {
      ...mergedState,
      [collection]: [...cloudRows, ...newLocalRows],
    };
  }, { ...cloudState });
}

export default function App() {
  // Load state from LocalStorage or fallback to Mock Data / Empty State
  const [state, setState] = useState(() => {
    try {
      localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const savedState = JSON.parse(saved);
        const savedAccounts = Array.isArray(savedState.loginAccounts) ? savedState.loginAccounts : [];
        const savedUsernames = new Set(savedAccounts.map(a => a.username));
        const mergedLoginAccounts = [
          ...savedAccounts,
          ...LOGIN_ACCOUNTS.filter(defaultAcc => !savedUsernames.has(defaultAcc.username))
        ];

        const cleanState = {
          ...savedState,
          students: Array.isArray(savedState.students) ? savedState.students : (isSupabaseConfigured ? [] : INITIAL_STUDENTS),
          guardians: Array.isArray(savedState.guardians) ? savedState.guardians : (isSupabaseConfigured ? [] : INITIAL_GUARDIANS),
          rfidCards: Array.isArray(savedState.rfidCards) ? savedState.rfidCards : (isSupabaseConfigured ? [] : INITIAL_RFID_CARDS),
          ledger: Array.isArray(savedState.ledger) ? savedState.ledger : (isSupabaseConfigured ? [] : INITIAL_LEDGER),
          auditLogs: Array.isArray(savedState.auditLogs) ? savedState.auditLogs : (isSupabaseConfigured ? [] : INITIAL_AUDIT_LOGS),
          loginAccounts: mergedLoginAccounts
        };

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanState));
        return cleanState;
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage', e);
    }

    if (isSupabaseConfigured) {
      return {
        students: [],
        guardians: [],
        rfidCards: [],
        ledger: [],
        auditLogs: [],
        loginAccounts: LOGIN_ACCOUNTS,
      };
    }

    return {
      students: INITIAL_STUDENTS,
      guardians: INITIAL_GUARDIANS,
      rfidCards: INITIAL_RFID_CARDS,
      ledger: INITIAL_LEDGER,
      auditLogs: INITIAL_AUDIT_LOGS,
      loginAccounts: LOGIN_ACCOUNTS,
    };
  });
  const [cloudStateLoaded, setCloudStateLoaded] = useState(!isSupabaseConfigured);
  const [authenticatedSession, setAuthenticatedSession] = useState(null);
  const [loginRfidFeedback, setLoginRfidFeedback] = useState(null);

  // Active Role State
  const [currentRole, setCurrentRole] = useState(ROLES.SUPER_ADMIN);
  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState('savings');
  // Active Admin SubTab
  const [adminSubTab, setAdminSubTab] = useState('rfid');
  // Active Pickup Action / SubTab
  const [pickupAction, setPickupAction] = useState('operator_mode');
  // RFID Quick Scanner Modal Open State
  const [isRfidModalOpen, setIsRfidModalOpen] = useState(false);
  // Scanned Unregistered Card UID for Admin auto-fill
  const [scannedCardUid, setScannedCardUid] = useState('');
  // Scanned card result for routing modules (e.g. canteen)
  const [scannedCardResult, setScannedCardResult] = useState(null);

  // Ensure non-penjemputan roles cannot access 'pickup' tab
  useEffect(() => {
    if (currentRole?.id !== 'ADMIN_PENJEMPUTAN' && activeTab === 'pickup') {
      if (currentRole?.id === 'KASIR_KANTIN') {
        setActiveTab('canteen');
      } else if (currentRole?.id === 'ORANG_TUA' || currentRole?.id === 'SISWA') {
        setActiveTab('parent_portal');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [currentRole, activeTab]);

  // Global Keyboard Wedge Listener for Physical USB PnP RFID Readers (e.g. Hassel 13.56 MHz)
  useRfidWedge((scannedUid) => {
    const cleanUid = scannedUid.toUpperCase();
    const cardResult = verifyRfidCard(cleanUid, state.rfidCards, state.students, state.guardians);

    if (!authenticatedSession) {
      handleRfidLogin(cleanUid, cardResult);
      return;
    }

    if (activeTab === 'pickup') {
      setScannedCardResult({ ...cardResult, uid: cleanUid, scanTimestamp: Date.now() });
      return;
    }

    // If card is unregistered OR user is in Admin module, route to Admin & auto-fill form immediately!
    if (currentRole.id === 'KASIR_KANTIN' && cardResult.isUnregistered) {
      setScannedCardResult(cardResult);
      playRfidBeep('error');
      return;
    }

    if (!cardResult.success || cardResult.isUnregistered || activeTab === 'admin') {
      playRfidBeep('error');
      setScannedCardUid(cleanUid);
      setActiveTab('admin');
    } else {
      playRfidBeep('success');
      handleGlobalRfidScan(cardResult);
    }
  });

  // Ref tracking the latest state in memory to prevent stale localState reads during cloud sync
  const latestStateRef = useRef(state);
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  // Ref tracking the baseline JSON signature of state synced with Supabase Cloud
  const lastSyncedStateRef = useRef(null);

  const syncWithCloudDatabase = () => {
    if (!isSupabaseConfigured) return;
    ensureDefaultAccountsInSupabase()
      .then(() => loadSchoolState())
      .then((cloudState) => {
        if (cloudState) {
          const localState = latestStateRef.current || state;
          const merged = mergeLocalDataIntoCloud(cloudState, localState || {});

          const cloudAccounts = merged.loginAccounts || [];
          const cloudUsernames = new Set(cloudAccounts.map(a => a.username));
          const mergedAccounts = [
            ...cloudAccounts,
            ...LOGIN_ACCOUNTS.filter(defaultAcc => !cloudUsernames.has(defaultAcc.username))
          ];

          const freshState = {
            students: merged.students || [],
            guardians: merged.guardians || [],
            rfidCards: merged.rfidCards || [],
            ledger: merged.ledger || [],
            auditLogs: merged.auditLogs || [],
            loginAccounts: mergedAccounts
          };

          lastSyncedStateRef.current = JSON.stringify(freshState);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(freshState));
          } catch (e) {}

          setState(freshState);
        }
      })
      .catch((error) => console.error('Failed to load Supabase data:', error))
      .finally(() => {
        setCloudStateLoaded(true);
      });
  };

  // Initial Cloud Fetch
  useEffect(() => {
    syncWithCloudDatabase();
  }, []);

  // Auto-sync refresh listener when smartphone/browser regains focus or visibility
  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && isSupabaseConfigured) {
        syncWithCloudDatabase();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Network Status Event Listeners for Automatic Re-sync on Connection Re-established
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isSupabaseConfigured && cloudStateLoaded) {
        const currentStateJson = JSON.stringify(state);
        if (lastSyncedStateRef.current !== currentStateJson) {
          setIsSyncingCloud(true);
          saveSchoolState(state)
            .then(() => {
              lastSyncedStateRef.current = currentStateJson;
            })
            .catch((error) => console.error('Failed to auto-sync to Supabase on reconnect:', error))
            .finally(() => setIsSyncingCloud(false));
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state, cloudStateLoaded]);

  // Keep a local backup, then synchronize changes to Supabase when configured.
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }

    if (isSupabaseConfigured && cloudStateLoaded && isOnline) {
      const currentStateJson = JSON.stringify(state);

      // Prevent redundant network calls or overwriting cloud state if state hasn't changed since last sync/load
      if (lastSyncedStateRef.current === currentStateJson) {
        return;
      }

      setIsSyncingCloud(true);
      saveSchoolState(state)
        .then(() => {
          lastSyncedStateRef.current = currentStateJson;
        })
        .catch((error) => {
          console.error('Failed to save Supabase data', error);
        })
        .finally(() => {
          setIsSyncingCloud(false);
        });
    }
  }, [state, cloudStateLoaded, isOnline]);

  const handlePasswordLogin = (username, password) => {
    const cleanUsername = username.trim().toLowerCase();
    const existingAccounts = state.loginAccounts || [];
    const existingUsernames = new Set(existingAccounts.map(a => a.username));
    const allAccounts = [
      ...existingAccounts,
      ...LOGIN_ACCOUNTS.filter(defaultAcc => !existingUsernames.has(defaultAcc.username))
    ];

    const account = allAccounts.find((item) => item.username === cleanUsername && item.password === password);
    if (!account) return { success: false, text: 'Username atau password tidak sesuai.' };
    setCurrentRole(ROLES[account.roleId]);
    setActiveTab(
      account.roleId === 'ADMIN_PENJEMPUTAN' ? 'pickup' :
      account.roleId === 'ORANG_TUA' || account.roleId === 'SISWA' ? 'parent_portal' :
      account.roleId === 'KASIR_KANTIN' ? 'canteen' :
      'dashboard'
    );
    setAuthenticatedSession({ roleId: account.roleId, accountId: account.id, studentId: account.studentId, guardianId: account.guardianId });
    return { success: true };
  };

  const handleRfidLogin = (uid, existingResult = null) => {
    const result = existingResult || verifyRfidCard(uid, state.rfidCards, state.students, state.guardians);
    if (!result.success || !result.student) {
      const feedback = { success: false, text: result.message || 'Kartu RFID belum terhubung ke akun siswa atau orang tua.' };
      setLoginRfidFeedback(feedback);
      return feedback;
    }
    const isSiswaCard = result.cardType === 'SISWA';
    const roleId = isSiswaCard ? 'SISWA' : 'ORANG_TUA';
    setCurrentRole(ROLES[roleId]);
    setActiveTab('parent_portal');
    setScannedCardResult(result);
    setAuthenticatedSession({
      roleId,
      studentId: result.student?.id,
      guardianId: isSiswaCard ? null : (result.guardian?.id || result.student?.guardianId)
    });
    setLoginRfidFeedback(null);
    return { success: true };
  };

  if (!authenticatedSession) {
    return <LoginPage onPasswordLogin={handlePasswordLogin} onRfidLogin={handleRfidLogin} rfidFeedback={loginRfidFeedback} />;
  }

  // Handle global RFID scan callback from simulator modal
  const handleGlobalRfidScan = (scanResult) => {
    setScannedCardResult(scanResult);
    // If user is currently on Savings module, keep them there so they can top-up / setoran
    if (activeTab === 'savings') return;
    // Keep the parent/student portal open so it can show the tapped card holder's profile.
    if (activeTab === 'parent_portal') return;

    if (scanResult.cardType === 'SISWA') {
      // Admin Keuangan: route to Tabungan & Ledger for top-up / setoran deposit
      if (currentRole.id === 'ADMIN_KEUANGAN' || currentRole.id === 'SUPER_ADMIN') {
        setActiveTab('savings');
      } else {
        setActiveTab('canteen');
      }
    }
  };

  // Handle unregistered card tap -> route to Admin & auto-fill UID
  const handleRegisterNewCard = (uid) => {
    setScannedCardUid(uid);
    setActiveTab('admin');
    setIsRfidModalOpen(false);
  };

  // Handle Native Excel (.xlsx) export of ledger transactions
  const handleExportLedgerCsv = () => {
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

    const dataRows = (state.ledger || []).map(l => [
      l.id,
      new Date(l.timestamp).toLocaleString('id-ID'),
      l.studentName,
      l.accountType === 'TABUNGAN' ? 'Tabungan Utama' : 'Deposit Kantin',
      l.type === 'CREDIT' ? 'MASUK (+)' : 'KELUAR (-)',
      Number(l.amount) || 0,
      Number(l.balanceAfter) || 0,
      l.description || ''
    ]);

    exportToExcelXlsx({
      filename: `rekap_ledger_tabungan_${new Date().toISOString().slice(0,10)}.xlsx`,
      sheetName: 'Rekap Ledger Tabungan',
      title: 'REKAPITULASI JURNAL LEDGER TABUNGAN SEKOLAH',
      summaryRows: [
        ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
        ['Total Jurnal Ledger', (state.ledger || []).length]
      ],
      columns,
      dataRows
    });
  };

  return (
    <div className="app-container">
      
      {/* Left Sidebar (Desktop) & Top Header Garis 3 Drawer (Mobile/Tablet) */}
      <SidebarNav
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        adminSubTab={adminSubTab}
        setAdminSubTab={setAdminSubTab}
        pickupAction={pickupAction}
        setPickupAction={setPickupAction}
        onOpenRfidModal={() => setIsRfidModalOpen(true)}
        onExportLedger={handleExportLedgerCsv}
        onLogout={() => {
          setAuthenticatedSession(null);
          setScannedCardResult(null);
          setLoginRfidFeedback(null);
        }}
        allowRoleSwitch={authenticatedSession?.roleId === 'SUPER_ADMIN'}
        isOnline={isOnline}
        isSyncingCloud={isSyncingCloud}
        isSupabaseConfigured={isSupabaseConfigured}
      />

      {/* Main Content & Footer Layout Wrapper */}
      <div className="app-main-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <main style={{ flex: 1, maxWidth: '1240px', width: '100%', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
          
          {/* Module Content Rendering */}
          {activeTab === 'dashboard' && (
            <FinanceDashboardModule state={state} />
          )}

          {activeTab === 'savings' && (
            <SavingsModule 
              state={state} 
              setState={setState}
              onOpenRfidModal={() => setIsRfidModalOpen(true)}
              scannedCardResult={scannedCardResult}
            />
          )}

          {activeTab === 'canteen' && (
            <CanteenModule
              state={state}
              setState={setState}
              onOpenRfidModal={() => setIsRfidModalOpen(true)}
              scannedCardResult={scannedCardResult}
            />
          )}

          {(activeTab === 'parent_portal' || activeTab === 'account') && (
            <ParentPortalModule
              state={state}
              authenticatedSession={authenticatedSession}
              onOpenRfidModal={() => setIsRfidModalOpen(true)}
              view={activeTab}
              onChangePassword={(currentPassword, newPassword) => {
                const account = state.loginAccounts?.find((item) => item.id === authenticatedSession.accountId);
                if (!account) return { success: false, text: 'Ubah password hanya tersedia setelah login dengan username dan password.' };
                if (account.password !== currentPassword) return { success: false, text: 'Password saat ini tidak sesuai.' };
                if (newPassword.length < 6) return { success: false, text: 'Password baru minimal 6 karakter.' };
                setState((previous) => ({
                  ...previous,
                  loginAccounts: (previous.loginAccounts || LOGIN_ACCOUNTS).map((item) => item.id === account.id ? { ...item, password: newPassword } : item),
                }));
                return { success: true, text: 'Password berhasil diperbarui.' };
              }}
            />
          )}

          {activeTab === 'role_management' && (
            <RoleManagementModule
              state={state}
              setState={setState}
            />
          )}

          {activeTab === 'pickup' && currentRole?.id === 'ADMIN_PENJEMPUTAN' && (
            <PickupSystemModule
              state={state}
              setState={setState}
              onOpenRfidModal={() => setIsRfidModalOpen(true)}
              scannedCardResult={scannedCardResult}
              pickupAction={pickupAction}
              setPickupAction={setPickupAction}
            />
          )}

          {activeTab === 'admin' && (
            <AdminModule 
              state={state} 
              setState={setState} 
              scannedCardUid={scannedCardUid}
              currentRole={currentRole}
              externalSubTab={adminSubTab}
              onSubTabChange={setAdminSubTab}
              onDeleteRfidCard={(cardId) => {
                if (!['SUPER_ADMIN', 'ADMIN_KEUANGAN'].includes(currentRole.id)) return;
                deleteRfidCard(cardId).catch((error) => console.error('Failed to delete RFID card from Supabase', error));
              }}
              onNavigateToSavings={(student, cardUid) => {
                setActiveTab('savings');
                setScannedCardResult({
                  success: true,
                  student: student,
                  uid: cardUid,
                  isUnregistered: false,
                  message: `Kartu RFID UID ${cardUid} berhasil dipetakan ke ${student.name}! Siap untuk transaksi.`
                });
              }}
            />
          )}

        </main>

        {/* Footer */}
        <footer style={{ background: '#0f172a', color: '#94a3b8', padding: '1.25rem', textAlign: 'center', fontSize: '0.8rem', borderTop: '1px solid #1e293b' }}>
          <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
            <b>Sistem Terintegrasi Siswa, RFID, Tabungan & Kantin</b> — Platform Digital Sekolah Responsif | Baseline PRD v1.0
          </div>
        </footer>
      </div>

      {/* RFID Hardware Simulator Modal */}
      <RfidQuickScannerModal
        isOpen={isRfidModalOpen}
        onClose={() => setIsRfidModalOpen(false)}
        cards={state.rfidCards}
        students={state.students}
        guardians={state.guardians}
        onScanSuccess={handleGlobalRfidScan}
        onRegisterNewCard={handleRegisterNewCard}
        cashierMode={currentRole.id === 'KASIR_KANTIN'}
      />

    </div>
  );
}
