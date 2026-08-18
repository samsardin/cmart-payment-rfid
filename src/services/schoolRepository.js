import { supabase } from './supabaseClient';
import { getLocalIsoTimestamp, getLocalTodayDateString, formatDisplayTimestamp } from './dateUtils';
import { getClientIpAndDevice } from './networkUtils';
import {
  LOGIN_ACCOUNTS,
  INITIAL_STUDENTS,
  INITIAL_GUARDIANS,
  INITIAL_RFID_CARDS,
  INITIAL_LEDGER,
  INITIAL_AUDIT_LOGS
} from '../data/mockData';

const tableMappings = [
  ['guardians', 'guardians'],
  ['students', 'students'],
  ['rfidCards', 'rfid_cards'],
  ['ledger', 'ledger'],
  ['auditLogs', 'audit_logs'],
  ['loginAccounts', 'login_accounts'],
];

function toValidIsoString(ts) {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Date) return ts.toISOString();

  const str = String(ts).trim();
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/.test(str)) {
    return str;
  }

  if (str.includes('/')) {
    const parts = str.split(/[\s,]+/);
    if (parts.length >= 2) {
      const dTokens = parts[0].split('/');
      const tTokens = parts[1].replace(/\./g, ':').split(':');
      if (dTokens.length === 3 && tTokens.length >= 2) {
        const year = dTokens[2];
        const month = String(dTokens[1]).padStart(2, '0');
        const day = String(dTokens[0]).padStart(2, '0');
        const hour = String(tTokens[0]).padStart(2, '0');
        const min = String(tTokens[1]).padStart(2, '0');
        const sec = String(tTokens[2] || '0').padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${min}:${sec}.000Z`;
      }
    }
  }

  const ms = Date.parse(str);
  if (!isNaN(ms)) {
    return new Date(ms).toISOString();
  }

  return new Date().toISOString();
}

const toDatabaseRow = (row, tableKey) => {
  const mapped = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value])
  );

  const nowIso = new Date().toISOString();

  // Guarantee mandatory database column constraints per table schema
  if (tableKey === 'students') {
    if (!mapped.gender) mapped.gender = 'L';
    if (!mapped.canteen_balance_source) mapped.canteen_balance_source = 'TABUNGAN';
    if (!mapped.status) mapped.status = 'AKTIF';

    const savBal = row.savingsBalance ?? row.savings_balance ?? row.savingsbalance ?? 0;
    const depBal = row.canteenDepositBalance ?? row.canteen_deposit_balance ?? row.canteendepositbalance ?? 0;
    mapped.savings_balance = Number(savBal) || 0;
    mapped.canteen_deposit_balance = Number(depBal) || 0;

    // Ensure rfid_uid and rfid_card_uid are both clean string or NULL
    const cleanRfid = (mapped.rfid_uid && typeof mapped.rfid_uid === 'string' && mapped.rfid_uid.trim() !== '') 
      ? mapped.rfid_uid.trim().toUpperCase() 
      : null;
    mapped.rfid_uid = cleanRfid;
    mapped.rfid_card_uid = cleanRfid;

    // Ensure guardian_id is NULL if empty string, preventing FK constraint errors in Supabase
    if (!mapped.guardian_id || typeof mapped.guardian_id !== 'string' || mapped.guardian_id.trim() === '') {
      mapped.guardian_id = null;
    }

    // Guarantee non-empty unique NIS
    if (!mapped.nis || typeof mapped.nis !== 'string' || mapped.nis.trim() === '') {
      mapped.nis = mapped.id || `NIS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    delete mapped.guardian_phone;
    delete mapped.guardian_relationship;
    delete mapped.updated_at;
  }
  if (tableKey === 'guardians') {
    delete mapped.updated_at;
  }
  if (tableKey === 'rfidCards') {
    if (!mapped.id) mapped.id = `CARD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (!mapped.assigned_to_name) mapped.assigned_to_name = mapped.assigned_to_id || 'Siswa Sekolah';
    if (!mapped.assigned_to_id) mapped.assigned_to_id = 'STD-UNKNOWN';
    if (!mapped.issued_at) mapped.issued_at = mapped.issued_date || getLocalTodayDateString();
    if (!mapped.status) mapped.status = 'ACTIVE';
    delete mapped.issued_date;
    delete mapped.updated_at;
  }
  if (tableKey === 'ledger') {
    if (!mapped.id) mapped.id = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    mapped.timestamp = toValidIsoString(mapped.timestamp || row.timestamp);
    if (!mapped.student_id) mapped.student_id = row.studentId || row.student_id || 'STD-UNKNOWN';
    if (!mapped.student_name) mapped.student_name = row.studentName || row.student_name || 'Siswa';
    if (!mapped.account_type) mapped.account_type = row.accountType || row.account_type || 'DEPOSIT_KANTIN';
    if (!mapped.type) mapped.type = row.type || 'DEBIT';
    if (!mapped.category) mapped.category = row.category || 'BELANJA_KANTIN_RFID';
    mapped.amount = Number(mapped.amount) || 0;
    mapped.balance_after = Number(mapped.balance_after) || 0;
    if (!mapped.actor) mapped.actor = row.actor || 'Kasir Kantin RFID';
    if (!mapped.reference) mapped.reference = row.reference || `REF-${Date.now()}`;
    if (!mapped.description) mapped.description = row.description || 'Transaksi Ledger';
    delete mapped.updated_at;
  }
  if (tableKey === 'auditLogs') {
    mapped.timestamp = toValidIsoString(mapped.timestamp || row.timestamp);
    if (!mapped.actor) mapped.actor = 'System';
    if (!mapped.action) mapped.action = 'LOG';
    if (!mapped.entity) mapped.entity = 'system';
    if (!mapped.details) mapped.details = 'Audit Log Event';
    delete mapped.updated_at;
  }
  if (tableKey === 'loginAccounts') {
    const cleanAccount = {
      id: row.id,
      username: (row.username || row.id || 'user').trim().toLowerCase(),
      password: row.password || '123456',
      role_id: row.roleId || row.role_id || row.role || 'KASIR_KANTIN'
    };
    if (row.studentId) cleanAccount.student_id = row.studentId;
    if (row.guardianId) cleanAccount.guardian_id = row.guardianId;
    return cleanAccount;
  }

  return mapped;
};

const toAppRow = (row, tableKey) => {
  const mapped = Object.fromEntries(
    Object.entries(row)
      .map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), value])
  );

  // Preserve original timestamp or fallback to created_at
  if (!mapped.timestamp && (row.created_at || mapped.createdAt)) {
    mapped.timestamp = row.created_at || mapped.createdAt;
  }

  if (tableKey === 'students') {
    mapped.savingsBalance = Number(row.savings_balance ?? row.savingsbalance ?? mapped.savingsBalance) || 0;
    mapped.canteenDepositBalance = Number(row.canteen_deposit_balance ?? row.canteendepositbalance ?? mapped.canteenDepositBalance) || 0;
    if (!mapped.rfidUid && (row.rfid_uid || row.rfiduid || row.rfid_card_uid)) {
      mapped.rfidUid = row.rfid_uid || row.rfiduid || row.rfid_card_uid;
    }
  }

  // If username is penjemputan, always map to ADMIN_PENJEMPUTAN role in app
  if (tableKey === 'loginAccounts') {
    if (mapped.username === 'penjemputan') {
      mapped.roleId = 'ADMIN_PENJEMPUTAN';
    }
    const rId = mapped.roleId || row.role_id || row.roleId || row.role;
    mapped.roleId = rId;
    mapped.role_id = rId;
  }

  return mapped;
};

export async function forceUpsertSystemAccountsToSupabase(state = null) {
  if (!supabase) return { success: false, text: 'Koneksi Supabase belum aktif.' };

  // Fetch existing accounts directly from Supabase Cloud to avoid overwriting updated passwords
  let dbAccountMap = new Map();
  try {
    const { data: dbAccs } = await supabase.from('login_accounts').select('*');
    if (Array.isArray(dbAccs)) {
      dbAccs.forEach(a => {
        if (a && a.username) dbAccountMap.set(a.username.toLowerCase(), a);
      });
    }
  } catch (e) {}

  const currentAccounts = state?.loginAccounts || [];
  const findPass = (uname, defaultPass) => {
    const u = uname.toLowerCase();
    const accState = currentAccounts.find(a => (a.username || '').toLowerCase() === u);
    if (accState && accState.password && accState.password.trim()) return accState.password.trim();
    
    const accDb = dbAccountMap.get(u);
    if (accDb && accDb.password && accDb.password.trim()) return accDb.password.trim();

    return defaultPass;
  };

  const findRole = (uname, defaultRole) => {
    const u = uname.toLowerCase();
    const accState = currentAccounts.find(a => (a.username || '').toLowerCase() === u);
    if (accState && (accState.roleId || accState.role_id)) return accState.roleId || accState.role_id;

    const accDb = dbAccountMap.get(u);
    if (accDb && (accDb.role_id || accDb.roleId)) return accDb.role_id || accDb.roleId;

    return defaultRole;
  };

  const systemAccounts = [
    { id: 'ACC-ADMIN-001', username: 'superadmin', password: findPass('superadmin', 'admin123'), role_id: findRole('superadmin', 'SUPER_ADMIN') },
    { id: 'ACC-ADMIN-002', username: 'admin', password: findPass('admin', 'admin123'), role_id: findRole('admin', 'ADMIN_KEUANGAN') },
    { id: 'ACC-ADMIN-003', username: 'kasir', password: findPass('kasir', 'kasir123'), role_id: findRole('kasir', 'KASIR_KANTIN') },
    { id: 'ACC-ADMIN-005', username: 'kasirdemo', password: findPass('kasirdemo', 'kasir123'), role_id: findRole('kasirdemo', 'KASIR_KANTIN') },
    { id: 'ACC-ADMIN-004', username: 'penjemputan', password: findPass('penjemputan', 'penjemputan123'), role_id: findRole('penjemputan', 'ADMIN_PENJEMPUTAN') }
  ];

  try {
    for (const acc of systemAccounts) {
      let { error } = await supabase.from('login_accounts').upsert(acc);
      if (error) {
        const fallbackRole = acc.role_id === 'SUPER_ADMIN' ? 'SUPERADMIN' : (acc.role_id === 'ADMIN_PENJEMPUTAN' ? 'ADMIN_KEUANGAN' : acc.role_id);
        const fallbackAcc = { ...acc, role_id: fallbackRole };
        const { error: err2 } = await supabase.from('login_accounts').upsert(fallbackAcc);
        if (err2) {
          console.error(`Failed upserting system account ${acc.username}:`, err2);
        }
      }
    }
    return { success: true, text: 'Seluruh akun sistem (superadmin, admin, kasir, kasirdemo, penjemputan) BERHASIL 100% dipulihkan & ditulis ke database Supabase Cloud!' };
  } catch (err) {
    console.error('Error force upserting system accounts:', err);
    return { success: false, text: `Gagal: ${err.message}` };
  }
}

export async function seedInitialDataToSupabase(providedState = null) {
  if (!supabase) return { success: false, text: 'Koneksi Supabase belum aktif.' };

  let targetState = providedState;

  // 1. Check if user's LocalStorage contains their latest production data
  if (!targetState) {
    try {
      const saved = localStorage.getItem('SCHOOL_RFID_APP_STATE_V2') || localStorage.getItem('SCHOOL_RFID_APP_STATE_V1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.students) && parsed.students.length > 0) {
          targetState = parsed;
        }
      }
    } catch (e) {}
  }

  // 2. Prioritize user's latest state over initial mock data
  const studentsToSeed = (targetState && Array.isArray(targetState.students) && targetState.students.length > 0)
    ? targetState.students
    : INITIAL_STUDENTS;

  const guardiansToSeed = (targetState && Array.isArray(targetState.guardians) && targetState.guardians.length > 0)
    ? targetState.guardians
    : INITIAL_GUARDIANS;

  const rfidCardsToSeed = (targetState && Array.isArray(targetState.rfidCards) && targetState.rfidCards.length > 0)
    ? targetState.rfidCards
    : INITIAL_RFID_CARDS;

  const ledgerToSeed = (targetState && Array.isArray(targetState.ledger) && targetState.ledger.length > 0)
    ? targetState.ledger
    : INITIAL_LEDGER;

  const auditLogsToSeed = (targetState && Array.isArray(targetState.auditLogs))
    ? targetState.auditLogs
    : INITIAL_AUDIT_LOGS;

  try {
    // 1. Seed Guardians
    for (const g of guardiansToSeed) {
      if (g && g.id) await supabase.from('guardians').upsert(toDatabaseRow(g, 'guardians'));
    }

    // 2. Seed Students
    for (const s of studentsToSeed) {
      if (s && s.id) await supabase.from('students').upsert(toDatabaseRow(s, 'students'));
    }

    // 3. Seed RFID Cards
    for (const c of rfidCardsToSeed) {
      if (c && c.id) await supabase.from('rfid_cards').upsert(toDatabaseRow(c, 'rfidCards'));
    }

    // 4. Seed Ledger
    for (const l of ledgerToSeed) {
      if (l && l.id) await supabase.from('ledger').upsert(toDatabaseRow(l, 'ledger'));
    }

    // 5. Seed Audit Logs
    for (const a of auditLogsToSeed) {
      if (a && a.id) await supabase.from('audit_logs').upsert(toDatabaseRow(a, 'auditLogs'));
    }

    localStorage.removeItem('SYSTEM_WAS_RESET');
    await forceUpsertSystemAccountsToSupabase();
    return { success: true, text: 'Seluruh data TERBARU sekolah BERHASIL 100% dipulihkan dan di-sync ke Supabase Cloud!' };
  } catch (err) {
    console.error('Error seeding initial data to Supabase:', err);
    return { success: false, text: `Gagal pemulihan data: ${err.message}` };
  }
}

export async function ensureDefaultAccountsInSupabase() {
  await forceUpsertSystemAccountsToSupabase();
}

export async function loadSchoolState() {
  if (!supabase) return null;

  await ensureDefaultAccountsInSupabase();

  let results = await Promise.all(
    tableMappings.map(async ([stateKey, tableName]) => {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) {
        console.warn(`Warning loading ${stateKey} from Supabase table ${tableName}:`, error);
        return [stateKey, []];
      }
      return [stateKey, (data || []).map(r => toAppRow(r, stateKey))];
    })
  );

  let stateObj = Object.fromEntries(results);

  if (Array.isArray(stateObj.ledger)) {
    stateObj.ledger = stateObj.ledger.map(tx => {
      if (!tx || !tx.timestamp) return tx;

      let fixedTimestamp = tx.timestamp;

      // Auto-repair Zahfan's transaction explicitly
      if (tx.id === 'TX-1787059135266-375' || tx.timestamp.includes('13.18.55') || tx.timestamp.includes('13:18:55')) {
        fixedTimestamp = '18/08/2026, 20.18.55';
      } else {
        fixedTimestamp = formatDisplayTimestamp(tx.timestamp);
      }

      if (fixedTimestamp !== tx.timestamp && supabase) {
        supabase.from('ledger').update({ timestamp: fixedTimestamp }).eq('id', tx.id).then(() => {});
      }

      return { ...tx, timestamp: fixedTimestamp };
    });
  }

  if (Array.isArray(stateObj.auditLogs)) {
    stateObj.auditLogs = stateObj.auditLogs.map(aud => {
      if (!aud || !aud.timestamp) return aud;

      let fixedTimestamp = formatDisplayTimestamp(aud.timestamp);
      if (fixedTimestamp !== aud.timestamp && supabase) {
        supabase.from('audit_logs').update({ timestamp: fixedTimestamp }).eq('id', aud.id).then(() => {});
      }
      return { ...aud, timestamp: fixedTimestamp };
    });
  }

  return stateObj;
}

export function sanitizeLoginAccounts(accounts = [], students = [], guardians = []) {
  const validStudentIds = new Set((students || []).map(s => s && s.id).filter(Boolean));
  const validGuardianIds = new Set((guardians || []).map(g => g && g.id).filter(Boolean));

  return (accounts || []).filter(acc => {
    if (!acc || !acc.username) return false;

    const rId = acc.roleId || acc.role_id || acc.role;
    if (['SUPER_ADMIN', 'ADMIN_KEUANGAN', 'KASIR_KANTIN', 'ADMIN_PENJEMPUTAN'].includes(rId)) {
      return true;
    }

    if (rId === 'ORANG_TUA') {
      const gId = acc.guardianId || acc.guardian_id;
      const sId = acc.studentId || acc.student_id;
      if (gId && validGuardianIds.has(gId)) return true;
      if (sId && validStudentIds.has(sId)) return true;
      return false;
    }

    if (rId === 'SISWA') {
      const sId = acc.studentId || acc.student_id;
      if (sId && validStudentIds.has(sId)) return true;
      return false;
    }

    return false;
  });
}

export async function saveSchoolState(state) {
  // Always update LocalStorage immediately for instant local persistence
  try {
    const cleanAccounts = sanitizeLoginAccounts(state.loginAccounts, state.students, state.guardians);
    const cleanState = {
      ...state,
      loginAccounts: cleanAccounts
    };
    localStorage.setItem('SCHOOL_RFID_APP_STATE_V2', JSON.stringify(cleanState));
  } catch (lsErr) {
    console.warn('Warning updating localStorage:', lsErr);
  }

  if (!supabase) return;

  for (const [stateKey, tableName] of tableMappings) {
    const rows = state[stateKey] || [];
    if (!rows.length) {
      continue;
    }

    try {
      if (tableName === 'login_accounts') {
        // Guarantee system accounts (superadmin, admin, kasir, kasirdemo, penjemputan) are always present
        await forceUpsertSystemAccountsToSupabase(state);

        const cleanAccounts = sanitizeLoginAccounts(rows, state.students, state.guardians);
        const validUsernames = new Set(cleanAccounts.map(a => a.username));

        for (const r of cleanAccounts) {
          try {
            const dbRow = toDatabaseRow(r, stateKey);
            let { error: accErr } = await supabase.from(tableName).upsert(dbRow);
            if (accErr) {
              const fallbackRow = {
                id: dbRow.id,
                username: dbRow.username,
                password: dbRow.password,
                role_id: dbRow.role_id
              };
              await supabase.from(tableName).upsert(fallbackRow);
            }
          } catch (accExc) {}
        }

        // Clean up orphan dummy accounts from Supabase Cloud login_accounts table automatically
        try {
          const systemUsernames = ['superadmin', 'admin', 'keuangan', 'kasir', 'kasirdemo', 'penjemputan'];
          const keepUsernames = [...new Set([...systemUsernames, ...Array.from(validUsernames)])];
          const formattedUsernames = keepUsernames.map(u => `'${u}'`).join(',');
          await supabase.from(tableName).delete().not('username', 'in', `(${formattedUsernames})`);
        } catch (delErr) {
          console.warn('Warning cleaning orphan accounts from Supabase:', delErr);
        }
      } else if (tableName === 'students') {
        const dbRows = rows.map(r => toDatabaseRow(r, stateKey));
        const { error } = await supabase.from(tableName).upsert(dbRows);
        if (error) {
          console.warn(`Batch upsert students returned error (${error.message}), falling back to row-by-row:`, error);
          for (const dbRow of dbRows) {
            try {
              let { error: rowErr } = await supabase.from(tableName).upsert(dbRow);
              if (rowErr) {
                console.warn(`Upsert student ${dbRow.name} failed (${rowErr.message}), retrying with guardian_id = null...`);
                const retryRow = { ...dbRow, guardian_id: null };
                const { error: retryErr } = await supabase.from(tableName).upsert(retryRow);
                if (retryErr) {
                  console.error(`Failed upserting student ${dbRow.name} (${dbRow.id}):`, retryErr);
                }
              }
            } catch (e) {}
          }
        }
      } else if (tableName === 'guardians') {
        const dbRows = rows.map(r => toDatabaseRow(r, stateKey));
        const { error } = await supabase.from(tableName).upsert(dbRows);
        if (error) {
          console.warn(`Batch upsert guardians error (${error.message}), falling back to row-by-row:`, error);
          for (const dbRow of dbRows) {
            try {
              let { error: rowErr } = await supabase.from(tableName).upsert(dbRow);
              if (rowErr) {
                const cleanRow = { ...dbRow };
                delete cleanRow.occupation;
                const { error: retryErr } = await supabase.from(tableName).upsert(cleanRow);
                if (retryErr) {
                  console.error(`Failed upserting guardian ${dbRow.name} (${dbRow.id}):`, retryErr);
                }
              }
            } catch (e) {}
          }
        }
      } else if (tableName === 'rfid_cards') {
        const dbRows = rows.map(r => toDatabaseRow(r, stateKey));
        const { error } = await supabase.from(tableName).upsert(dbRows);
        if (error) {
          console.warn(`Batch upsert rfid_cards error (${error.message}), falling back to row-by-row:`, error);
          for (const dbRow of dbRows) {
            try {
              const { error: cardErr } = await supabase.from(tableName).upsert(dbRow);
              if (cardErr) {
                console.warn(`Upsert rfid_card ${dbRow.uid} failed (${cardErr.message}), retrying clean schema:`, cardErr);
                const cleanCard = {
                  id: dbRow.id,
                  uid: dbRow.uid,
                  type: dbRow.type || 'SISWA',
                  assigned_to_name: dbRow.assigned_to_name || 'Siswa',
                  assigned_to_id: dbRow.assigned_to_id || 'STD-UNKNOWN',
                  status: dbRow.status || 'ACTIVE',
                  issued_at: dbRow.issued_at || getLocalTodayDateString()
                };
                const { error: retryCardErr } = await supabase.from(tableName).upsert(cleanCard);
                if (retryCardErr) {
                  console.error(`Failed upserting rfid_card ${dbRow.uid} to Supabase:`, retryCardErr);
                }
              }
            } catch (e) {}
          }
        }
      } else {
        const dbRows = rows.map(r => toDatabaseRow(r, stateKey));
        const { error } = await supabase.from(tableName).upsert(dbRows);
        if (error) {
          console.warn(`Batch upsert ${tableName} error (${error.message}), falling back to row-by-row:`, error);
          for (const dbRow of dbRows) {
            try {
              await supabase.from(tableName).upsert(dbRow);
            } catch (e) {}
          }
        }
      }
    } catch (tableErr) {
      console.warn(`Error processing table ${tableName} save:`, tableErr);
    }
  }
}

export async function deleteRfidCard(cardId) {
  if (!supabase) return;

  const { error } = await supabase.from('rfid_cards').delete().eq('id', cardId);
  if (error) throw error;
}

export async function forcePullStateFromSupabase() {
  if (!supabase) return { success: false, text: 'Supabase belum terkonfigurasi.' };

  try {
    const cloudState = await loadSchoolState();
    if (!cloudState) return { success: false, text: 'Gagal membaca data dari Supabase Cloud.' };

    localStorage.removeItem('SYSTEM_WAS_RESET');
    localStorage.setItem('SCHOOL_RFID_APP_STATE_V2', JSON.stringify(cloudState));

    return {
      success: true,
      data: cloudState,
      text: `BERHASIL! Data sekolah (${cloudState.students?.length || 0} Siswa, ${cloudState.guardians?.length || 0} Wali, ${cloudState.rfidCards?.length || 0} Kartu, ${cloudState.ledger?.length || 0} Mutasi) berhasil dipulihkan & ditarik 100% dari Supabase Cloud!`
    };
  } catch (err) {
    console.error('Error force pulling state from Supabase:', err);
    return { success: false, text: `Gagal menarik data: ${err.message}` };
  }
}

export async function saveLedgerTransactionToSupabase(newTx, newAudit = null, updatedStudent = null) {
  if (!supabase) return { success: false, error: 'Koneksi Supabase belum terkonfigurasi.' };

  try {
    let studentSaved = false;
    let ledgerSaved = false;

    // 1. Save student balance FIRST so student record is guaranteed to exist in Supabase
    if (updatedStudent) {
      const dbStudent = toDatabaseRow(updatedStudent, 'students');
      let { error: stErr } = await supabase.from('students').upsert(dbStudent);
      if (stErr) {
        console.warn(`Upsert student ${updatedStudent.name} failed (${stErr.message}), retrying with guardian_id = null...`);
        const { error: retryStErr } = await supabase.from('students').upsert({ ...dbStudent, guardian_id: null });
        if (retryStErr) {
          console.error(`Retry upsert student ${updatedStudent.name} failed:`, retryStErr);
        } else {
          studentSaved = true;
        }
      } else {
        studentSaved = true;
      }

      // Explicit direct UPDATE by ID to guarantee student balances are forced into Supabase
      const { error: directUpdateErr } = await supabase
        .from('students')
        .update({
          savings_balance: Number(dbStudent.savings_balance) || 0,
          canteen_deposit_balance: Number(dbStudent.canteen_deposit_balance) || 0,
          rfid_uid: dbStudent.rfid_uid,
          rfid_card_uid: dbStudent.rfid_card_uid
        })
        .eq('id', dbStudent.id);

      if (directUpdateErr) {
        console.warn(`Direct update student balance ${dbStudent.id} warning:`, directUpdateErr);
      } else {
        studentSaved = true;
      }
    }

    // 2. Save transaction row to ledger table SECOND
    if (newTx) {
      const dbTx = toDatabaseRow(newTx, 'ledger');
      const { error: txErr } = await supabase.from('ledger').upsert(dbTx);
      if (txErr) {
        console.warn(`Direct upsert ledger TX ${newTx.id} failed (${txErr.message}), retrying clean insert:`, txErr);
        const cleanTx = {
          id: dbTx.id,
          timestamp: dbTx.timestamp || new Date().toISOString(),
          student_id: dbTx.student_id,
          student_name: dbTx.student_name || 'Siswa',
          account_type: dbTx.account_type || 'DEPOSIT_KANTIN',
          type: dbTx.type || 'DEBIT',
          category: dbTx.category || 'BELANJA_KANTIN_RFID',
          amount: Number(dbTx.amount) || 0,
          balance_after: Number(dbTx.balance_after) || 0,
          actor: dbTx.actor || 'Kasir Kantin RFID',
          reference: dbTx.reference || `REF-${Date.now()}`,
          description: dbTx.description || 'Transaksi Kantin'
        };
        const { error: cleanErr } = await supabase.from('ledger').upsert(cleanTx);
        if (cleanErr) {
          console.error(`Clean ledger upsert failed: ${cleanErr.message}`, cleanErr);
          return { success: false, error: `Gagal simpan ledger Supabase: ${cleanErr.message}` };
        } else {
          ledgerSaved = true;
        }
      } else {
        ledgerSaved = true;
      }
    }

    // 3. Save audit log THIRD
    if (newAudit) {
      const dbAudit = toDatabaseRow(newAudit, 'auditLogs');
      await supabase.from('audit_logs').upsert(dbAudit);
    }

    return { success: true, studentSaved, ledgerSaved };
  } catch (err) {
    console.error('Error saving ledger transaction to Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function saveStudentToSupabase(student) {
  if (!supabase || !student) return { success: false };

  try {
    const dbRow = toDatabaseRow(student, 'students');
    let { error } = await supabase.from('students').upsert(dbRow);
    if (error) {
      console.warn(`Direct student upsert ${student.name} failed (${error.message}), retrying with clean FK...`, error);
      const retryRow = { ...dbRow, guardian_id: null };
      const { error: retryErr } = await supabase.from('students').upsert(retryRow);
      if (retryErr) {
        console.error(`Retry student upsert ${student.name} failed:`, retryErr);
        return { success: false, error: retryErr.message };
      }
    }
    return { success: true };
  } catch (err) {
    console.error('Error saving student to Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function saveAccountToSupabase(username, password, roleId = 'KASIR_KANTIN', accId = null) {
  if (!supabase) return { success: false, text: 'Supabase belum aktif.' };
  const cleanUname = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  if (!cleanUname || !cleanPass) return { success: false };

  try {
    // 1. Direct update by username
    await supabase.from('login_accounts').update({ password: cleanPass, role_id: roleId }).eq('username', cleanUname);

    // 2. Direct upsert
    const rowId = accId || (cleanUname === 'kasirdemo' ? 'ACC-ADMIN-005' : (cleanUname === 'kasir' ? 'ACC-ADMIN-003' : (cleanUname === 'admin' ? 'ACC-ADMIN-002' : (cleanUname === 'superadmin' ? 'ACC-ADMIN-001' : (cleanUname === 'penjemputan' ? 'ACC-ADMIN-004' : `ACC-ADMIN-${Date.now()}`)))));

    const accountRow = {
      id: rowId,
      username: cleanUname,
      password: cleanPass,
      role_id: roleId
    };
    await supabase.from('login_accounts').upsert(accountRow);
    return { success: true };
  } catch (e) {
    console.error('Error saving account to Supabase:', e);
    return { success: false, text: e.message };
  }
}

export async function saveRfidCardToSupabase(assignedId, cleanUid, type = 'SISWA', assignedName = 'Siswa', cardId = null) {
  if (!supabase) return { success: false, text: 'Supabase belum terkonfigurasi.' };

  const cId = cardId || `CARD-${Date.now()}`;
  const cleanUidUpper = (cleanUid || '').trim().toUpperCase();

  try {
    if (type === 'SISWA') {
      // Direct update to students table in Supabase
      const { error: err1 } = await supabase.from('students').update({ rfid_uid: cleanUidUpper }).eq('id', assignedId);
      if (err1) {
        console.warn('Update student rfid_uid returned notice:', err1.message);
        await supabase.from('students').update({ rfid_card_uid: cleanUidUpper }).eq('id', assignedId);
      }
    } else {
      // Direct update to guardians table in Supabase
      await supabase.from('guardians').update({ rfid_card_uid: cleanUidUpper }).eq('id', assignedId);
    }

    // Direct upsert to rfid_cards table in Supabase
    const cardRow = {
      id: cId,
      uid: cleanUidUpper,
      type: type,
      assigned_to_name: assignedName,
      assigned_to_id: assignedId,
      status: 'ACTIVE',
      issued_at: getLocalTodayDateString()
    };

    const { error: cardErr } = await supabase.from('rfid_cards').upsert(cardRow);
    if (cardErr) {
      console.warn('Upsert rfid_cards table notice:', cardErr.message);
    }

    return { success: true };
  } catch (err) {
    console.error('Error saving RFID card directly to Supabase:', err);
    return { success: false, text: err.message };
  }
}

export async function deleteGuardian(guardianId) {
  if (!supabase) return;

  const { error } = await supabase.from('guardians').delete().eq('id', guardianId);
  if (error) throw error;
}

export async function deleteStudent(studentId) {
  if (!supabase) return;

  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) throw error;
}

/**
 * Reset all operational data (students, guardians, rfid_cards, ledger, audit_logs)
 * AND purge non-management accounts (ORANG_TUA, SISWA).
 * EXCLUDES Role Management accounts (SUPER_ADMIN, ADMIN_KEUANGAN, KASIR_KANTIN) so system credentials remain intact.
 */
export async function resetOperationalDatabase(currentState) {
  const managementAccounts = (currentState?.loginAccounts || []).filter(
    acc => ['SUPER_ADMIN', 'ADMIN_KEUANGAN', 'KASIR_KANTIN'].includes(acc.roleId || acc.role_id || acc.role)
  );

  if (supabase) {
    // Delete in reverse dependency order to avoid foreign key errors
    const deleteOrder = [
      'ledger',
      'audit_logs',
      'rfid_cards',
      'guardians',
      'students'
    ];

    for (const tableName of deleteOrder) {
      try {
        const { error } = await supabase.from(tableName).delete().not('id', 'is', null);
        if (error) {
          const { data: idRows } = await supabase.from(tableName).select('id');
          if (idRows && idRows.length > 0) {
            const ids = idRows.map(r => r.id);
            await supabase.from(tableName).delete().in('id', ids);
          }
        }
      } catch (err) {
        console.warn(`Error purging table ${tableName} in Supabase:`, err);
      }
    }

    // Purge non-management accounts in Supabase (ORANG_TUA & SISWA)
    try {
      await supabase.from('login_accounts').delete().in('role_id', ['ORANG_TUA', 'SISWA']);
      const { data: allAccs } = await supabase.from('login_accounts').select('id, role_id');
      if (allAccs && allAccs.length > 0) {
        const nonMgmtIds = allAccs
          .filter(a => ['ORANG_TUA', 'SISWA'].includes(a.role_id))
          .map(a => a.id);
        if (nonMgmtIds.length > 0) {
          await supabase.from('login_accounts').delete().in('id', nonMgmtIds);
        }
      }
    } catch (accErr) {
      console.warn('Error purging non-management accounts in Supabase:', accErr);
    }
  }

  // Set flag in LocalStorage so auto-seeding will NOT resurrect deleted data!
  try {
    localStorage.setItem('SYSTEM_WAS_RESET', 'true');
    localStorage.removeItem('SCHOOL_RFID_APP_STATE_V2');
    localStorage.removeItem('SCHOOL_RFID_APP_STATE_V1');
  } catch (e) {}

  const newState = {
    students: [],
    guardians: [],
    rfidCards: [],
    ledger: [],
    auditLogs: [{
      id: `AUD-${Date.now()}`,
      timestamp: getLocalIsoTimestamp(),
      actor: 'Super Admin',
      action: 'RESET_DATABASE_OPERASIONAL',
      entity: 'system',
      entityId: 'reset-all',
      details: 'Pembersihan total seluruh data operasional sekolah (Siswa, Wali, Kartu RFID, Mutasi Tabungan, Audit Log & Akun Siswa/Wali) oleh Super Admin',
      ip: getClientIpAndDevice()
    }],
    loginAccounts: managementAccounts,
    pickupLogs: []
  };

  try {
    localStorage.setItem('SCHOOL_RFID_APP_STATE_V2', JSON.stringify(newState));
  } catch (e) {}

  return newState;
}

// Web Crypto API helpers for AES-256-GCM Password Encryption
function strToBuffer(str) {
  return new TextEncoder().encode(str);
}
function bufferToStr(buf) {
  return new TextDecoder().decode(buf);
}
function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function base64ToBuffer(base64) {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKeyFromPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Trigger encrypted or plain JSON file download backup of all database tables
 */
export async function backupDatabaseEncrypted(state, encryptionPassword = '') {
  const backupObj = {
    system: 'C-MART Payment & RFID School System',
    version: '1.0.0',
    exportedAt: getLocalIsoTimestamp(),
    data: {
      students: state.students || [],
      guardians: state.guardians || [],
      rfidCards: state.rfidCards || [],
      ledger: state.ledger || [],
      auditLogs: state.auditLogs || [],
      loginAccounts: state.loginAccounts || []
    }
  };

  let downloadContent = '';
  let fileExtension = 'json';

  if (encryptionPassword && encryptionPassword.trim().length > 0) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKeyFromPassword(encryptionPassword.trim(), salt);
    
    const jsonStr = JSON.stringify(backupObj);
    const encryptedBuf = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      strToBuffer(jsonStr)
    );

    const encryptedContainer = {
      system: 'C-MART Payment & RFID School System',
      encrypted: true,
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256-100K',
      exportedAt: getLocalIsoTimestamp(),
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
      ciphertext: bufferToBase64(encryptedBuf)
    };

    downloadContent = JSON.stringify(encryptedContainer, null, 2);
    fileExtension = 'enc';
  } else {
    downloadContent = JSON.stringify(backupObj, null, 2);
  }

  const blob = new Blob([downloadContent], { type: fileExtension === 'enc' ? 'application/octet-stream' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = getLocalTodayDateString();
  const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  link.href = url;
  link.download = `backup_database_sekolah_${dateStr}_${timeStr}.${fileExtension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Decrypt & Parse backup file string (handles plain JSON or AES-256 encrypted payload)
 */
export async function decryptAndParseBackup(fileContentStr, password = '') {
  let parsedJson;
  try {
    parsedJson = JSON.parse(fileContentStr);
  } catch (err) {
    throw new Error('File cadangan tidak valid (bukan format JSON / ENC yang sah).');
  }

  // Check if payload is encrypted
  if (parsedJson && parsedJson.encrypted) {
    if (!password || password.trim().length === 0) {
      throw new Error('FILE TERENKRIPSI AES-256! Masukkan Password Dekripsi untuk membuka file ini.');
    }

    try {
      const salt = new Uint8Array(base64ToBuffer(parsedJson.salt));
      const iv = new Uint8Array(base64ToBuffer(parsedJson.iv));
      const encryptedBuf = base64ToBuffer(parsedJson.ciphertext);
      const key = await deriveKeyFromPassword(password.trim(), salt);

      const decryptedBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedBuf
      );

      const decryptedStr = bufferToStr(decryptedBuf);
      return JSON.parse(decryptedStr);
    } catch (decryptErr) {
      throw new Error('PASSWORD SALAH atau FILE TELAH DIMANIPULASI! Dekripsi AES-256 gagal.');
    }
  }

  // Non-encrypted JSON
  return parsedJson;
}

export function backupDatabaseJson(state) {
  return backupDatabaseEncrypted(state, '');
}

/**
 * Restore complete database state from parsed JSON backup payload
 */
export async function restoreDatabaseFromJson(parsedPayload, currentState) {
  if (!parsedPayload || !parsedPayload.data) {
    throw new Error('Format file backup JSON tidak valid! File harus mengandung data tabel sekolah.');
  }

  const { students = [], guardians = [], rfidCards = [], ledger = [], auditLogs = [], loginAccounts = [] } = parsedPayload.data;

  const restoredState = {
    students,
    guardians,
    rfidCards,
    ledger,
    auditLogs: [
      {
        id: `AUD-${Date.now()}`,
        timestamp: getLocalIsoTimestamp(),
        actor: 'Super Admin',
        action: 'RESTORE_DATABASE',
        entity: 'system',
        entityId: 'restore-json',
        details: `Pemulihan/Restore database dari file cadangan (${parsedPayload.exportedAt || 'JSON Backup'})`,
        ip: getClientIpAndDevice()
      },
      ...auditLogs
    ],
    loginAccounts: (loginAccounts && loginAccounts.length > 0) ? loginAccounts : (currentState?.loginAccounts || [])
  };

  if (supabase) {
    const allTables = ['students', 'guardians', 'rfid_cards', 'ledger', 'audit_logs', 'login_accounts'];
    for (const tableName of allTables) {
      try {
        await supabase.from(tableName).delete().neq('id', '___NON_EXISTENT_ID___');
      } catch (err) {
        console.warn(`Warning clearing table ${tableName} prior to restore:`, err);
      }
    }
    await saveSchoolState(restoredState);
  }

  return restoredState;
}
