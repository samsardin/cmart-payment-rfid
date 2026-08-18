import { supabase } from './supabaseClient';
import { getLocalIsoTimestamp, getLocalTodayDateString } from './dateUtils';
import { getClientIpAndDevice } from './networkUtils';
import { LOGIN_ACCOUNTS } from '../data/mockData';

const tableMappings = [
  ['guardians', 'guardians'],
  ['students', 'students'],
  ['rfidCards', 'rfid_cards'],
  ['ledger', 'ledger'],
  ['auditLogs', 'audit_logs'],
  ['loginAccounts', 'login_accounts'],
];

const toDatabaseRow = (row, tableKey) => {
  const mapped = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value])
  );

  const nowIso = getLocalIsoTimestamp();

  // Guarantee mandatory database column constraints per table schema
  if (tableKey === 'students') {
    if (!mapped.gender) mapped.gender = 'L';
    if (!mapped.canteen_balance_source) mapped.canteen_balance_source = 'TABUNGAN';
    if (!mapped.status) mapped.status = 'AKTIF';
    if (mapped.savings_balance === undefined || mapped.savings_balance === null) mapped.savings_balance = 0;
    if (mapped.canteen_deposit_balance === undefined || mapped.canteen_deposit_balance === null) mapped.canteen_deposit_balance = 0;
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
    if (!mapped.timestamp) mapped.timestamp = nowIso;
    if (!mapped.student_name) mapped.student_name = 'Siswa';
    if (!mapped.actor) mapped.actor = 'Admin Keuangan';
    if (!mapped.description) mapped.description = 'Transaksi Ledger';
    delete mapped.updated_at;
  }
  if (tableKey === 'auditLogs') {
    if (!mapped.timestamp) mapped.timestamp = nowIso;
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
      .filter(([key]) => key !== 'created_at')
      .map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), value])
  );

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

export async function forceUpsertSystemAccountsToSupabase() {
  if (!supabase) return { success: false, text: 'Koneksi Supabase belum aktif.' };

  try {
    const penjemputanRowNative = {
      id: 'ACC-ADMIN-004',
      username: 'penjemputan',
      password: 'penjemputan123',
      role_id: 'ADMIN_PENJEMPUTAN'
    };

    const penjemputanRowFallback = {
      id: 'ACC-ADMIN-004',
      username: 'penjemputan',
      password: 'penjemputan123',
      role_id: 'ADMIN_KEUANGAN'
    };

    // First attempt with native ADMIN_PENJEMPUTAN
    let { error } = await supabase.from('login_accounts').upsert(penjemputanRowNative);

    // If constraint error occurs, retry with DB-compatible role_id ADMIN_KEUANGAN
    if (error) {
      console.warn('Upsert ADMIN_PENJEMPUTAN returned error, attempting fallback to ADMIN_KEUANGAN:', error);
      const retryRes = await supabase.from('login_accounts').upsert(penjemputanRowFallback);
      error = retryRes.error;
    }

    if (error) {
      console.error('Failed to write penjemputan row to Supabase:', error);
      return { success: false, text: `Error Supabase: ${error.message}` };
    }

    return { success: true, text: 'Akun penjemputan (penjemputan123) BERHASIL 100% ditulis langsung ke database Supabase Cloud!' };
  } catch (err) {
    console.error('Error force upserting system accounts:', err);
    return { success: false, text: `Gagal: ${err.message}` };
  }
}

export async function ensureDefaultAccountsInSupabase() {
  await forceUpsertSystemAccountsToSupabase();
}

export async function loadSchoolState() {
  if (!supabase) return null;

  await ensureDefaultAccountsInSupabase();

  const results = await Promise.all(
    tableMappings.map(async ([stateKey, tableName]) => {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) {
        console.warn(`Warning loading ${stateKey} from Supabase table ${tableName}:`, error);
        return [stateKey, []];
      }
      return [stateKey, (data || []).map(r => toAppRow(r, stateKey))];
    })
  );

  return Object.fromEntries(results);
}

export async function saveSchoolState(state) {
  // Always update LocalStorage immediately for instant local persistence
  try {
    localStorage.setItem('SCHOOL_RFID_APP_STATE_V2', JSON.stringify(state));
  } catch (lsErr) {
    console.warn('Warning updating localStorage:', lsErr);
  }

  if (!supabase) return;

  for (const [stateKey, tableName] of tableMappings) {
    const rows = state[stateKey] || [];
    if (!rows.length) {
      try {
        if (tableName === 'login_accounts') {
          await supabase.from(tableName).delete().in('role_id', ['ORANG_TUA', 'SISWA']);
        } else {
          await supabase.from(tableName).delete().not('id', 'is', null);
        }
      } catch (emptyErr) {
        console.warn(`Warning clearing empty table ${tableName} in Supabase:`, emptyErr);
      }
      continue;
    }

    try {
      if (tableName === 'login_accounts') {
        for (const r of rows) {
          try {
            const dbRow = toDatabaseRow(r, stateKey);
            let { error: accErr } = await supabase.from(tableName).upsert(dbRow);
            if (accErr) {
              console.warn(`Upsert account ${dbRow.username} returned error, attempting clean fallback:`, accErr);
              const fallbackRow = {
                id: dbRow.id,
                username: dbRow.username,
                password: dbRow.password,
                role_id: dbRow.role_id
              };
              const { error: retryErr } = await supabase.from(tableName).upsert(fallbackRow);
              if (retryErr) {
                console.error(`Failed upserting account ${dbRow.username}:`, retryErr);
              }
            }
          } catch (accExc) {
            console.warn(`Exception upserting account ${r.username}:`, accExc);
          }
        }
      } else if (tableName === 'students') {
        const dbRows = rows.map(r => toDatabaseRow(r, stateKey));
        const { error } = await supabase.from(tableName).upsert(dbRows);
        if (error) {
          console.warn(`Batch upsert students returned error (${error.message}), falling back to row-by-row:`, error);
          for (const dbRow of dbRows) {
            try {
              const { error: rowErr } = await supabase.from(tableName).upsert(dbRow);
              if (rowErr) {
                console.error(`Failed upserting student ${dbRow.name} (${dbRow.id}):`, rowErr);
              }
            } catch (e) {}
          }
        } else {
          const activeIds = rows.map(r => r.id).filter(Boolean);
          if (activeIds.length > 0) {
            const formattedIds = activeIds.join(',');
            await supabase.from(tableName).delete().not('id', 'in', `(${formattedIds})`);
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
    loginAccounts: managementAccounts
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
