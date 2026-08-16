import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/layout/Navbar';
import RfidQuickScannerModal from './components/layout/RfidQuickScannerModal';
import FinanceDashboardModule from './components/modules/FinanceDashboardModule';
import SavingsModule from './components/modules/SavingsModule';
import CanteenModule from './components/modules/CanteenModule';
import ParentPortalModule from './components/modules/ParentPortalModule';
import AdminModule from './components/modules/AdminModule';
import RoleManagementModule from './components/modules/RoleManagementModule';
import LoginPage from './components/layout/LoginPage';

import { useRfidWedge } from './services/useRfidWedge';
import { verifyRfidCard, playRfidBeep } from './services/rfidService';
import { isSupabaseConfigured } from './services/supabaseClient';
import { deleteRfidCard, loadSchoolState, saveSchoolState } from './services/schoolRepository';
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
      const mergedStudents = cloudRows.map((cloudStudent) => {
        const localStudent = localMap.get(cloudStudent.id);
        if (!localStudent) return cloudStudent;
        return {
          ...cloudStudent,
          ...localStudent,
          savingsBalance: Math.max(Number(cloudStudent.savingsBalance) || 0, Number(localStudent.savingsBalance) || 0),
          canteenDepositBalance: Math.max(Number(cloudStudent.canteenDepositBalance) || 0, Number(localStudent.canteenDepositBalance) || 0),
          rfidUid: localStudent.rfidUid || cloudStudent.rfidUid
        };
      });

      const cloudIds = new Set(cloudRows.map((row) => row.id));
      const brandNewLocalStudents = localRows.filter((row) => !cloudIds.has(row.id));

      return {
        ...mergedState,
        students: [...mergedStudents, ...brandNewLocalStudents]
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
  // Load state from LocalStorage or fallback to Mock Data
  const [state, setState] = useState(() => {
    try {
      localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const savedState = JSON.parse(saved);
        const cleanState = {
          ...savedState,
          students: (savedState.students && savedState.students.length > 0) ? savedState.students : INITIAL_STUDENTS,
          guardians: (savedState.guardians && savedState.guardians.length > 0) ? savedState.guardians : INITIAL_GUARDIANS,
          rfidCards: (savedState.rfidCards && savedState.rfidCards.length > 0) ? savedState.rfidCards : INITIAL_RFID_CARDS,
          ledger: (savedState.ledger && savedState.ledger.length > 0) ? savedState.ledger : INITIAL_LEDGER,
          auditLogs: (savedState.auditLogs && savedState.auditLogs.length > 0) ? savedState.auditLogs : INITIAL_AUDIT_LOGS,
          loginAccounts: savedState.loginAccounts || LOGIN_ACCOUNTS
        };

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanState));
        return cleanState;
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage', e);
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
  // RFID Quick Scanner Modal Open State
  const [isRfidModalOpen, setIsRfidModalOpen] = useState(false);
  // Scanned Unregistered Card UID for Admin auto-fill
  const [scannedCardUid, setScannedCardUid] = useState('');
  // Scanned card result for routing modules (e.g. canteen)
  const [scannedCardResult, setScannedCardResult] = useState(null);

  // Global Keyboard Wedge Listener for Physical USB PnP RFID Readers (e.g. Hassel 13.56 MHz)
  useRfidWedge((scannedUid) => {
    const cleanUid = scannedUid.toUpperCase();
    const cardResult = verifyRfidCard(cleanUid, state.rfidCards, state.students, state.guardians);

    if (!authenticatedSession) {
      handleRfidLogin(cleanUid, cardResult);
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

  // Ref tracking the baseline JSON signature of state synced with Supabase Cloud
  const lastSyncedStateRef = useRef(null);

  // Load the shared database state once Supabase has been configured.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    loadSchoolState()
      .then((cloudState) => {
        if (isMounted && cloudState && Object.keys(cloudState).length > 0) {
          setState((currentState) => {
            const merged = mergeLocalDataIntoCloud(cloudState, currentState);
            // Establish the initial cloud sync baseline to prevent immediate stale write-backs
            lastSyncedStateRef.current = JSON.stringify(merged);
            return merged;
          });
        }
      })
      .catch((error) => console.error('Failed to load Supabase data:', error))
      .finally(() => {
        if (isMounted) setCloudStateLoaded(true);
      });

    return () => {
      isMounted = false;
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
    const account = (state.loginAccounts || LOGIN_ACCOUNTS).find((item) => item.username === username.trim().toLowerCase() && item.password === password);
    if (!account) return { success: false, text: 'Username atau password tidak sesuai.' };
    setCurrentRole(ROLES[account.roleId]);
    setActiveTab(account.roleId === 'ORANG_TUA' || account.roleId === 'SISWA' ? 'parent_portal' : account.roleId === 'KASIR_KANTIN' ? 'canteen' : account.roleId === 'ADMIN_KEUANGAN' ? 'dashboard' : 'dashboard');
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
    const roleId = result.cardType === 'SISWA' ? 'SISWA' : 'ORANG_TUA';
    setCurrentRole(ROLES[roleId]);
    setActiveTab('parent_portal');
    setScannedCardResult(result);
    setAuthenticatedSession({ roleId, studentId: result.student.id });
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
      
      {/* Top Navbar */}
      <Navbar
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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

      {/* Main Content Area */}
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

        {activeTab === 'admin' && (
          <AdminModule 
            state={state} 
            setState={setState} 
            scannedCardUid={scannedCardUid}
            currentRole={currentRole}
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
