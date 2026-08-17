import { supabase } from './supabaseClient';
import { getLocalIsoTimestamp, getLocalTodayDateString } from './dateUtils';

const tableMappings = [
  ['students', 'students'],
  ['guardians', 'guardians'],
  ['rfidCards', 'rfid_cards'],
  ['ledger', 'ledger'],
  ['auditLogs', 'audit_logs'],
  ['loginAccounts', 'login_accounts'],
];

const toDatabaseRow = (row, tableKey) => {
  const mapped = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value])
  );

  // Guarantee mandatory database column constraints
  if (tableKey === 'students') {
    if (!mapped.gender) mapped.gender = 'L';
    if (!mapped.canteen_balance_source) mapped.canteen_balance_source = 'TABUNGAN';
    if (!mapped.status) mapped.status = 'AKTIF';
    if (mapped.savings_balance === undefined || mapped.savings_balance === null) mapped.savings_balance = 0;
    if (mapped.canteen_deposit_balance === undefined || mapped.canteen_deposit_balance === null) mapped.canteen_deposit_balance = 0;
  }
  if (tableKey === 'rfidCards') {
    if (!mapped.id) mapped.id = `CARD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (!mapped.assigned_to_name) mapped.assigned_to_name = mapped.assigned_to_id || 'Siswa Sekolah';
    if (!mapped.assigned_to_id) mapped.assigned_to_id = 'STD-UNKNOWN';
    if (!mapped.issued_at) mapped.issued_at = mapped.issued_date || getLocalTodayDateString();
    if (!mapped.status) mapped.status = 'ACTIVE';
    delete mapped.issued_date;
  }
  if (tableKey === 'ledger') {
    if (!mapped.timestamp) mapped.timestamp = getLocalIsoTimestamp();
    if (!mapped.student_name) mapped.student_name = 'Siswa';
    if (!mapped.actor) mapped.actor = 'Admin Keuangan';
    if (!mapped.description) mapped.description = 'Transaksi Ledger';
  }
  if (tableKey === 'auditLogs') {
    if (!mapped.timestamp) mapped.timestamp = getLocalIsoTimestamp();
    if (!mapped.actor) mapped.actor = 'System';
    if (!mapped.action) mapped.action = 'LOG';
    if (!mapped.entity) mapped.entity = 'system';
    if (!mapped.details) mapped.details = 'Audit Log Event';
  }
  if (tableKey === 'loginAccounts') {
    if (!mapped.username) mapped.username = mapped.id || 'user';
    if (!mapped.role_id && mapped.role) mapped.role_id = mapped.role;
    if (!mapped.role_id) mapped.role_id = 'KASIR_KANTIN';
  }
  return mapped;
};

const toAppRow = (row) => Object.fromEntries(
  Object.entries(row)
    .filter(([key]) => key !== 'created_at')
    .map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), value])
);

export async function loadSchoolState() {
  if (!supabase) return null;

  const results = await Promise.all(
    tableMappings.map(async ([stateKey, tableName]) => {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) {
        console.warn(`Warning loading ${stateKey} from Supabase table ${tableName}:`, error);
        return [stateKey, []];
      }
      return [stateKey, (data || []).map(toAppRow)];
    })
  );

  return Object.fromEntries(results);
}

export async function saveSchoolState(state) {
  if (!supabase) return;

  for (const [stateKey, tableName] of tableMappings) {
    const rows = state[stateKey] || [];
    if (!rows.length) continue;

    const dbRows = rows.map(r => toDatabaseRow(r, stateKey));
    const { error } = await supabase.from(tableName).upsert(dbRows);
    if (error) {
      console.error(`Error saving ${stateKey} to Supabase table ${tableName}:`, error);
      throw error;
    }

    // Purge obsolete card rows in Supabase so old cards are replaced cleanly
    if (stateKey === 'rfidCards') {
      try {
        const activeIds = rows.map(r => r.id).filter(Boolean);
        if (activeIds.length > 0) {
          const formattedIds = activeIds.join(',');
          await supabase.from('rfid_cards').delete().not('id', 'in', `(${formattedIds})`);
        }
      } catch (purgeErr) {
        console.warn('Non-fatal warning purging obsolete cards in Supabase:', purgeErr);
      }
    }
  }
}

export async function deleteRfidCard(cardId) {
  if (!supabase) return;

  const { error } = await supabase.from('rfid_cards').delete().eq('id', cardId);
  if (error) throw error;
}

/**
 * Reset all operational data (students, guardians, rfid_cards, ledger, audit_logs)
 * EXCLUDES login_accounts so role management credentials remain intact.
 */
export async function resetOperationalDatabase(currentState) {
  if (supabase) {
    const operationalTables = ['students', 'guardians', 'rfid_cards', 'ledger', 'audit_logs'];
    for (const tableName of operationalTables) {
      try {
        await supabase.from(tableName).delete().neq('id', '___NON_EXISTENT_ID___');
      } catch (err) {
        console.warn(`Warning resetting table ${tableName} in Supabase:`, err);
      }
    }
  }

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
      details: 'Pembersihan total seluruh data operasional sekolah (Siswa, Kartu RFID, Mutasi Tabungan & Audit Log) oleh Super Admin',
      ip: '127.0.0.1'
    }],
    loginAccounts: currentState?.loginAccounts || []
  };

  if (supabase) {
    try {
      await saveSchoolState(newState);
    } catch (saveErr) {
      console.warn('Warning saving post-reset state to Supabase:', saveErr);
    }
  }

  return newState;
}

/**
 * Trigger JSON file download backup of all database tables
 */
export function backupDatabaseJson(state) {
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

  const jsonString = JSON.stringify(backupObj, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = getLocalTodayDateString();
  const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  link.href = url;
  link.download = `backup_database_sekolah_${dateStr}_${timeStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
        ip: '127.0.0.1'
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
