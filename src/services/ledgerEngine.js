import { getLocalIsoTimestamp } from './dateUtils';

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
    ip: '127.0.0.1'
  };

  return {
    updatedStudents,
    newTransaction,
    newAudit,
    newBalance
  };
};
