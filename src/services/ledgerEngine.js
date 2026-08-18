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

/**
 * Recalculates exact balanceAfter for every transaction in ledger chronologically per student & accountType.
 * This guarantees 100% mathematical consistency across all modules (Admin, Kasir, Portal Wali, Dashboard).
 */
export function recalculateLedgerRunningBalances(ledger = []) {
  if (!Array.isArray(ledger) || !ledger.length) return [];

  const indexedLedger = ledger.map((tx, idx) => ({ ...tx, _origIndex: idx }));

  // Sort chronological (timestamp ASC)
  indexedLedger.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  const runningBalances = new Map();

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

  return updatedLedger.sort((a, b) => a._origIndex - b._origIndex).map(({ _origIndex, ...tx }) => tx);
}

/**
 * Automatically harmonizes student balances (savingsBalance & canteenDepositBalance)
 * with ledger transactions to eliminate any discrepancies between Green Card balance
 * and ledger transaction history.
 */
export function harmonizeStudentBalancesWithLedger(students = [], ledger = []) {
  if (!Array.isArray(students) || !students.length) return students || [];
  if (!Array.isArray(ledger)) return students;

  const latestSavingsBalance = new Map();
  const latestDepositBalance = new Map();
  const savingsSum = new Map();
  const depositSum = new Map();
  const hasSavingsTx = new Set();
  const hasDepositTx = new Set();

  const fixedLedger = recalculateLedgerRunningBalances(ledger);

  const sortedLedger = [...fixedLedger].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  sortedLedger.forEach((tx) => {
    const sId = tx.studentId || tx.student_id;
    if (!sId) return;

    const amt = Number(tx.amount) || 0;
    const isCredit = tx.type === 'CREDIT';

    if (tx.accountType === 'TABUNGAN') {
      hasSavingsTx.add(sId);
      const curr = savingsSum.get(sId) || 0;
      savingsSum.set(sId, isCredit ? curr + amt : Math.max(0, curr - amt));
      latestSavingsBalance.set(sId, Number(tx.balanceAfter));
    } else if (tx.accountType === 'DEPOSIT_KANTIN') {
      hasDepositTx.add(sId);
      const curr = depositSum.get(sId) || 0;
      depositSum.set(sId, isCredit ? curr + amt : Math.max(0, curr - amt));
      latestDepositBalance.set(sId, Number(tx.balanceAfter));
    }
  });

  return students.map((student) => {
    let savingsBalance = Number(student.savingsBalance) || 0;
    let canteenDepositBalance = Number(student.canteenDepositBalance) || 0;

    if (latestSavingsBalance.has(student.id)) {
      savingsBalance = latestSavingsBalance.get(student.id);
    } else if (hasSavingsTx.has(student.id)) {
      savingsBalance = Math.max(0, savingsSum.get(student.id) || 0);
    }

    if (latestDepositBalance.has(student.id)) {
      canteenDepositBalance = latestDepositBalance.get(student.id);
    } else if (hasDepositTx.has(student.id)) {
      canteenDepositBalance = Math.max(0, depositSum.get(student.id) || 0);
    }

    return {
      ...student,
      savingsBalance,
      canteenDepositBalance
    };
  });
}
