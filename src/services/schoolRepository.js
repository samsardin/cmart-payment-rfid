import { supabase } from './supabaseClient';

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
    if (!mapped.issued_at) mapped.issued_at = mapped.issued_date || new Date().toISOString().slice(0, 10);
    if (!mapped.status) mapped.status = 'ACTIVE';
    delete mapped.issued_date;
  }
  if (tableKey === 'ledger') {
    if (!mapped.timestamp) mapped.timestamp = new Date().toISOString();
    if (!mapped.student_name) mapped.student_name = 'Siswa';
    if (!mapped.actor) mapped.actor = 'Admin Keuangan';
    if (!mapped.description) mapped.description = 'Transaksi Ledger';
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
