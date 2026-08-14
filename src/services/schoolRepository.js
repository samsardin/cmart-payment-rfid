import { supabase } from './supabaseClient';

const tableMappings = [
  ['students', 'students'],
  ['guardians', 'guardians'],
  ['rfidCards', 'rfid_cards'],
  ['ledger', 'ledger'],
  ['auditLogs', 'audit_logs'],
  ['loginAccounts', 'login_accounts'],
];

const toDatabaseRow = (row) => Object.fromEntries(
  Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value])
);

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
      if (error) throw error;
      return [stateKey, data.map(toAppRow)];
    })
  );

  return Object.fromEntries(results);
}

export async function saveSchoolState(state) {
  if (!supabase) return;

  for (const [stateKey, tableName] of tableMappings) {
    const rows = state[stateKey] || [];
    if (!rows.length) continue;
    const { error } = await supabase.from(tableName).upsert(rows.map(toDatabaseRow));
    if (error) throw error;

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
