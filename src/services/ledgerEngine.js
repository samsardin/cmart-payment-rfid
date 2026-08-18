import { getLocalIsoTimestamp } from './dateUtils';
import { getClientIpAndDevice } from './networkUtils';

// Ledger Accounting Engine for Student Savings & Canteen Accounts

export const executeLedgerTransaction = (state, {
  studentId,
  accountType = 'TABUNGAN', // 'TABUNGAN' | 'DEPOSIT_KANTIN'
  type, // 'CREDIT' (Top up / Setoran) | 'DEBIT' (Penarikan / Belanja)
  category,
  amount,
  actor = 'System',
  reference = '',
  description = ''
}) => {
  const amountNumber = Number(amount);
  if (isNaN(amountNumber) || amountNumber <= 0) {
    throw new Error('Nominal transaksi harus berupa angka positif.');
  }

  // Find target student
  const studentIndex = state.students.findIndex(s => s.id === studentId);
  if (studentIndex === -1) {
    throw new Error(`Siswa dengan ID ${studentId} tidak ditemukan.`);
  }

  const student = state.students[studentIndex];
  
  // Current balance check
  const currentSavings = Number(student.savingsBalance) || 0;
  const currentDeposit = Number(student.canteenDepositBalance) || 0;
  const currentBalance = accountType === 'TABUNGAN' ? currentSavings : currentDeposit;

  let newBalance = currentBalance;
  if (type === 'CREDIT') {
    newBalance = currentBalance + amountNumber;
  } else if (type === 'DEBIT') {
    if (currentBalance < amountNumber) {
      throw new Error(`Saldo ${accountType === 'TABUNGAN' ? 'Tabungan' : 'Deposit Kantin'} tidak mencukupi (Saldo: Rp ${currentBalance.toLocaleString('id-ID')}, Dibutuhkan: Rp ${amountNumber.toLocaleString('id-ID')}).`);
    }
    newBalance = currentBalance - amountNumber;
  } else {
    throw new Error(`Tipe transaksi '${type}' tidak valid.`);
  }

  // Create immutable ledger record with local timezone offset
  const newTransaction = {
    id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: getLocalIsoTimestamp(),
    studentId,
    studentName: student.name,
    accountType,
    type,
    category,
    amount: amountNumber,
    balanceAfter: newBalance,
    actor,
    reference: reference || `REF-${Date.now().toString().slice(-6)}`,
    description
  };

  // Clone updated students array
  const updatedStudents = [...state.students];
  updatedStudents[studentIndex] = {
    ...student,
    savingsBalance: accountType === 'TABUNGAN' ? newBalance : currentSavings,
    canteenDepositBalance: accountType === 'DEPOSIT_KANTIN' ? newBalance : currentDeposit
  };

  // Create Audit Log with local timezone offset
  const newAudit = {
    id: `AUD-${Date.now()}`,
    timestamp: getLocalIsoTimestamp(),
    actor,
    action: category,
    entity: 'students',
    entityId: studentId,
    details: `${type === 'CREDIT' ? 'Setoran/Topup' : 'Penarikan/Belanja'} Rp ${amountNumber.toLocaleString('id-ID')} (${accountType}) - Saldo Akhir: Rp ${newBalance.toLocaleString('id-ID')}`,
    ip: getClientIpAndDevice()
  };

  return {
    updatedStudents,
    newTransaction,
    newAudit,
    newBalance
  };
};

export function parseSafeTimestamp(ts) {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;

  const str = String(ts).trim();

  // 1. Check for wall-clock ISO string YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/);
  if (isoMatch) {
    const [, y, m, d, hh, mm, ss, ms, tz] = isoMatch;
    if (tz) {
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) return parsed;
    } else {
      const date = new Date(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        parseInt(hh, 10),
        parseInt(mm, 10),
        parseInt(ss, 10),
        ms ? parseInt(ms.slice(0, 3).padEnd(3, '0'), 10) : 0
      );
      if (!isNaN(date.getTime())) return date.getTime();
    }
  }

  // 2. Check for Indonesian string format "18/8/2026, 16.34.59"
  try {
    const parts = str.split(/[,\s]+/);
    if (parts.length >= 2) {
      const dateParts = parts[0].split('/');
      const timeParts = parts[1].replace(/\./g, ':').split(':');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        const hours = parseInt(timeParts[0] || '0', 10);
        const minutes = parseInt(timeParts[1] || '0', 10);
        const seconds = parseInt(timeParts[2] || '0', 10);
        const parsedDate = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(parsedDate.getTime())) return parsedDate.getTime();
      }
    }
  } catch (e) {}

  const standardParse = Date.parse(str);
  if (!isNaN(standardParse)) return standardParse;

  return 0;
}

/**
 * Recalculates exact balanceAfter for every transaction in ledger chronologically per student & accountType.
 * This guarantees 100% mathematical consistency across all modules (Admin, Kasir, Portal Wali, Dashboard).
 */
export function recalculateLedgerRunningBalances(ledger = [], students = []) {
  if (!Array.isArray(ledger) || !ledger.length) return [];

  const indexedLedger = ledger.map((tx, idx) => ({ ...tx, _origIndex: idx, _parsedTime: parseSafeTimestamp(tx.timestamp) }));

  // Sort chronological (timestamp ASC)
  indexedLedger.sort((a, b) => (a._parsedTime || 0) - (b._parsedTime || 0));

  const studentMap = new Map();
  if (Array.isArray(students)) {
    students.forEach((s) => {
      if (s && s.id) studentMap.set(s.id, s);
    });
  }

  // Calculate total credit & debit in ledger per (studentId + '_' + accountType)
  const ledgerCredits = new Map();
  const ledgerDebits = new Map();
  const hasCreditTx = new Set();

  indexedLedger.forEach((tx) => {
    const sId = tx.studentId || tx.student_id;
    const accType = tx.accountType || 'TABUNGAN';
    const key = `${sId}_${accType}`;

    const amt = Number(tx.amount) || 0;
    if (tx.type === 'CREDIT') {
      hasCreditTx.add(key);
      ledgerCredits.set(key, (ledgerCredits.get(key) || 0) + amt);
    } else {
      ledgerDebits.set(key, (ledgerDebits.get(key) || 0) + amt);
    }
  });

  const runningBalances = new Map();

  studentMap.forEach((student, sId) => {
    const savingsKey = `${sId}_TABUNGAN`;
    const depositKey = `${sId}_DEPOSIT_KANTIN`;

    const savingsVal = Number(student.savingsBalance) || 0;
    const depositVal = Number(student.canteenDepositBalance) || 0;

    const savCredits = ledgerCredits.get(savingsKey) || 0;
    const savDebits = ledgerDebits.get(savingsKey) || 0;

    if (hasCreditTx.has(savingsKey)) {
      runningBalances.set(savingsKey, 0);
    } else {
      runningBalances.set(savingsKey, Math.max(0, savingsVal + savDebits - savCredits));
    }

    const depCredits = ledgerCredits.get(depositKey) || 0;
    const depDebits = ledgerDebits.get(depositKey) || 0;

    if (hasCreditTx.has(depositKey)) {
      runningBalances.set(depositKey, 0);
    } else {
      runningBalances.set(depositKey, Math.max(0, depositVal + depDebits - depCredits));
    }
  });

  const updatedLedger = indexedLedger.map((tx) => {
    const sId = tx.studentId || tx.student_id;
    const accType = tx.accountType || 'TABUNGAN';
    const key = `${sId}_${accType}`;

    const currentRunning = runningBalances.get(key) || 0;
    const amt = Number(tx.amount) || 0;
    const isCredit = tx.type === 'CREDIT';
    const nextRunning = isCredit ? currentRunning + amt : Math.max(0, currentRunning - amt);

    runningBalances.set(key, nextRunning);

    return {
      ...tx,
      balanceAfter: nextRunning
    };
  });

  return updatedLedger.sort((a, b) => a._origIndex - b._origIndex).map(({ _origIndex, _parsedTime, ...tx }) => tx);
}

/**
 * Automatically harmonizes student balances (savingsBalance & canteenDepositBalance)
 * with ledger transactions to eliminate any discrepancies between Green Card balance
 * and ledger transaction history.
 */
export function harmonizeStudentBalancesWithLedger(students = [], ledger = []) {
  if (!Array.isArray(students) || !students.length) return students || [];
  if (!Array.isArray(ledger)) return students;

  const fixedLedger = recalculateLedgerRunningBalances(ledger, students);

  // CRITICAL FIX: Sort fixedLedger ASCENDING by timestamp (oldest first, newest last)
  // so the last iteration sets the true LATEST balanceAfter for each student.
  const sortedLedger = [...fixedLedger].sort((a, b) => parseSafeTimestamp(a.timestamp) - parseSafeTimestamp(b.timestamp));

  const latestSavingsBalance = new Map();
  const latestDepositBalance = new Map();

  sortedLedger.forEach((tx) => {
    const sId = tx.studentId || tx.student_id;
    if (!sId) return;

    if (tx.accountType === 'TABUNGAN') {
      latestSavingsBalance.set(sId, Number(tx.balanceAfter));
    } else if (tx.accountType === 'DEPOSIT_KANTIN') {
      latestDepositBalance.set(sId, Number(tx.balanceAfter));
    }
  });

  return students.map((student) => {
    let savingsBalance = Number(student.savingsBalance) || 0;
    let canteenDepositBalance = Number(student.canteenDepositBalance) || 0;

    if (latestSavingsBalance.has(student.id)) {
      savingsBalance = latestSavingsBalance.get(student.id);
    }

    if (latestDepositBalance.has(student.id)) {
      canteenDepositBalance = latestDepositBalance.get(student.id);
    }

    return {
      ...student,
      savingsBalance: Math.max(0, savingsBalance),
      canteenDepositBalance: Math.max(0, canteenDepositBalance)
    };
  });
}
