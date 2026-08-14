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
    if (!mapped.issued_at) mapped.issued_at = new Date().toISOString().slice(0, 10);
    if (!mapped.status) mapped.status = 'ACTIVE';
  }
  if (tableKey === 'ledger') {
    if (!mapped.timestamp) mapped.timestamp = new Date().toISOString();
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
      const activeIds = rows.map(r => r.id);
      if (activeIds.length > 0) {
        const formattedIds = activeIds.map(id => `"${id}"`).join(',');
        await supabase.from('rfid_cards').delete().not('id', 'in', `(${formattedIds})`);
      }
    }
  }
}

export async function deleteRfidCard(cardId) {
  if (!supabase) return;

  const { error } = await supabase.from('rfid_cards').delete().eq('id', cardId);
  if (error) throw error;
}
