import React, { useState, useMemo } from 'react';
import {
  Users, UserPlus, UserCheck, Edit3, Trash2, KeyRound, ShieldCheck,
  Plus, Search, CheckCircle2, XCircle, Store, Wallet, Lock, X, Volume2
} from 'lucide-react';

export default function RoleManagementModule({ state, setState }) {
  // Sub-tabs: 'STUDENTS' | 'FINANCE_ADMIN' | 'PICKUP_ADMIN' | 'CASHIER'
  const [activeSubTab, setActiveSubTab] = useState('STUDENTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Modal State for Forms
  const [modalType, setModalType] = useState(null); // 'ADD_STUDENT' | 'EDIT_STUDENT' | 'ADD_ACCOUNT' | 'EDIT_ACCOUNT'
  const [selectedItem, setSelectedItem] = useState(null);

  // Student Form State
  const [studentForm, setStudentForm] = useState({
    name: '',
    nis: '',
    class: '',
    rfidUid: '',
    status: 'AKTIF',
    savingsBalance: 0,
    canteenDepositBalance: 0
  });

  // User Account Form State (Admin Keuangan / Admin Penjemputan / Kasir Kantin)
  const [accountForm, setAccountForm] = useState({
    username: '',
    name: '',
    password: '',
    roleId: 'ADMIN_KEUANGAN'
  });

  // Filtered Students
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (state.students || []).filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.nis || '').toLowerCase().includes(q) ||
      (s.class || '').toLowerCase().includes(q) ||
      (s.rfidUid || '').toLowerCase().includes(q)
    );
  }, [state.students, searchQuery]);

  // Filtered Finance Admins
  const financeAdmins = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (state.loginAccounts || []).filter(a =>
      a.roleId === 'ADMIN_KEUANGAN' &&
      ((a.username || '').toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q))
    );
  }, [state.loginAccounts, searchQuery]);

  // Filtered Pickup Admins
  const pickupAdmins = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (state.loginAccounts || []).filter(a =>
      a.roleId === 'ADMIN_PENJEMPUTAN' &&
      ((a.username || '').toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q))
    );
  }, [state.loginAccounts, searchQuery]);

  // Filtered Cashiers
  const cashiers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (state.loginAccounts || []).filter(a =>
      a.roleId === 'KASIR_KANTIN' &&
      ((a.username || '').toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q))
    );
  }, [state.loginAccounts, searchQuery]);

  // -------------------------------------------------------------
  // HANDLERS: STUDENT CRUD
  // -------------------------------------------------------------
  const handleOpenAddStudent = () => {
    setStudentForm({
      name: '',
      nis: `2026${Math.floor(1000 + Math.random() * 9000)}`,
      class: '5-A Tahfidz',
      rfidUid: '',
      status: 'AKTIF',
      savingsBalance: 0,
      canteenDepositBalance: 0
    });
    setSelectedItem(null);
    setModalType('ADD_STUDENT');
  };

  const handleOpenEditStudent = (student) => {
    setSelectedItem(student);
    setStudentForm({
      name: student.name || '',
      nis: student.nis || '',
      class: student.class || '',
      rfidUid: student.rfidUid || '',
      status: student.status || 'AKTIF',
      savingsBalance: student.savingsBalance || 0,
      canteenDepositBalance: student.canteenDepositBalance || 0
    });
    setModalType('EDIT_STUDENT');
  };

  const handleSaveStudent = (e) => {
    e.preventDefault();
    if (!studentForm.name.trim() || !studentForm.nis.trim()) {
      setFeedback({ type: 'error', text: 'Nama dan NIS wajib diisi!' });
      return;
    }

    if (modalType === 'ADD_STUDENT') {
      const newStudentId = `STD-${Date.now()}`;
      const newStudent = {
        id: newStudentId,
        nis: studentForm.nis.trim(),
        name: studentForm.name.trim(),
        class: studentForm.class.trim(),
        rfidUid: studentForm.rfidUid.trim().toUpperCase(),
        savingsBalance: Number(studentForm.savingsBalance) || 0,
        canteenDepositBalance: Number(studentForm.canteenDepositBalance) || 0,
        canteenBalanceSource: 'TABUNGAN',
        photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        status: studentForm.status
      };

      // Also create login account for student if needed
      const newAccount = {
        id: `ACC-${newStudentId}`,
        username: studentForm.nis.trim(),
        password: `${studentForm.nis.trim()}123`,
        roleId: 'SISWA',
        studentId: newStudentId
      };

      setState(prev => ({
        ...prev,
        students: [newStudent, ...prev.students],
        loginAccounts: [...(prev.loginAccounts || []), newAccount]
      }));

      setFeedback({ type: 'success', text: `Berhasil menambah siswa baru: ${newStudent.name}` });
    } else if (modalType === 'EDIT_STUDENT' && selectedItem) {
      const updatedStudents = state.students.map(s => {
        if (s.id === selectedItem.id) {
          return {
            ...s,
            name: studentForm.name.trim(),
            nis: studentForm.nis.trim(),
            class: studentForm.class.trim(),
            rfidUid: studentForm.rfidUid.trim().toUpperCase(),
            status: studentForm.status
          };
        }
        return s;
      });

      setState(prev => ({
        ...prev,
        students: updatedStudents
      }));

      setFeedback({ type: 'success', text: `Berhasil memperbarui data siswa: ${studentForm.name}` });
    }

    setModalType(null);
  };

  const handleDeleteStudent = (studentId, studentName) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus data siswa "${studentName}"?`)) {
      setState(prev => ({
        ...prev,
        students: prev.students.filter(s => s.id !== studentId),
        loginAccounts: (prev.loginAccounts || []).filter(a => a.studentId !== studentId)
      }));
      setFeedback({ type: 'success', text: `Siswa "${studentName}" berhasil dihapus.` });
    }
  };

  // -------------------------------------------------------------
  // HANDLERS: USER ACCOUNTS CRUD (ADMIN KEUANGAN & KASIR KANTIN)
  // -------------------------------------------------------------
  const handleOpenAddAccount = (targetRole) => {
    setAccountForm({
      username: '',
      name: '',
      password: '',
      roleId: targetRole
    });
    setSelectedItem(null);
    setModalType('ADD_ACCOUNT');
  };

  const handleOpenEditAccount = (account) => {
    setSelectedItem(account);
    setAccountForm({
      username: account.username || '',
      name: account.name || account.username || '',
      password: account.password || '',
      roleId: account.roleId
    });
    setModalType('EDIT_ACCOUNT');
  };

  const handleSaveAccount = (e) => {
    e.preventDefault();
    if (!accountForm.username.trim() || !accountForm.password.trim()) {
      setFeedback({ type: 'error', text: 'Username dan Password wajib diisi!' });
      return;
    }

    const cleanUsername = accountForm.username.trim().toLowerCase();

    if (modalType === 'ADD_ACCOUNT') {
      // Check duplicate username
      const exists = (state.loginAccounts || []).some(a => a.username === cleanUsername);
      if (exists) {
        setFeedback({ type: 'error', text: `Username "${cleanUsername}" sudah digunakan!` });
        return;
      }

      const newAccount = {
        id: `ACC-ADMIN-${Date.now()}`,
        username: cleanUsername,
        name: accountForm.name.trim() || cleanUsername,
        password: accountForm.password.trim(),
        roleId: accountForm.roleId
      };

      setState(prev => ({
        ...prev,
        loginAccounts: [...(prev.loginAccounts || []), newAccount]
      }));

      const roleLabel = accountForm.roleId === 'ADMIN_KEUANGAN' ? 'Admin Keuangan' : 'Kasir Kantin';
      setFeedback({ type: 'success', text: `Berhasil menambahkan akun ${roleLabel}: ${cleanUsername}` });
    } else if (modalType === 'EDIT_ACCOUNT' && selectedItem) {
      const updatedAccounts = (state.loginAccounts || []).map(a => {
        if (a.id === selectedItem.id) {
          return {
            ...a,
            username: cleanUsername,
            name: accountForm.name.trim() || cleanUsername,
            password: accountForm.password.trim()
          };
        }
        return a;
      });

      setState(prev => ({
        ...prev,
        loginAccounts: updatedAccounts
      }));

      setFeedback({ type: 'success', text: `Berhasil memperbarui data akun: ${cleanUsername}` });
    }

    setModalType(null);
  };

  const handleDeleteAccount = (accId, username) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus akun "${username}"?`)) {
      setState(prev => ({
        ...prev,
        loginAccounts: (prev.loginAccounts || []).filter(a => a.id !== accId)
      }));
      setFeedback({ type: 'success', text: `Akun "${username}" berhasil dihapus.` });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header Banner */}
      <div className="glass-card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f3e8ff 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
          <ShieldCheck size={24} style={{ color: '#6b21a8' }} />
          <h2 style={{ fontSize: '1.35rem', color: '#581c87' }}>Role & User Management</h2>
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--slate-600)' }}>
          Pusat pengelolaan akun & CRUD data Siswa, Admin Keuangan, serta Kasir Kantin.
        </p>
      </div>

      {/* Feedback Alert Bar */}
      {feedback && (
        <div style={{
          padding: '0.85rem 1.2rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          fontWeight: 700,
          background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
          color: feedback.type === 'success' ? '#065f46' : '#991b1b',
          border: feedback.type === 'success' ? '1px solid #a7f3d0' : '1px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Navigation Segmented Toggles */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          
          {/* Sub Tab Buttons */}
          <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--slate-100)', padding: '4px', borderRadius: '12px', border: '1px solid var(--slate-200)' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeSubTab === 'STUDENTS' ? 'btn-primary' : ''}`}
              onClick={() => { setActiveSubTab('STUDENTS'); setSearchQuery(''); }}
              style={{
                fontSize: '0.82rem',
                padding: '0.4rem 0.85rem',
                background: activeSubTab === 'STUDENTS' ? undefined : 'transparent',
                color: activeSubTab === 'STUDENTS' ? undefined : 'var(--slate-700)',
                boxShadow: activeSubTab === 'STUDENTS' ? undefined : 'none',
                fontWeight: activeSubTab === 'STUDENTS' ? 800 : 600
              }}
            >
              <Users size={16} /> Data Siswa ({state.students.length})
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeSubTab === 'FINANCE_ADMIN' ? 'btn-primary' : ''}`}
              onClick={() => { setActiveSubTab('FINANCE_ADMIN'); setSearchQuery(''); }}
              style={{
                fontSize: '0.82rem',
                padding: '0.4rem 0.85rem',
                background: activeSubTab === 'FINANCE_ADMIN' ? undefined : 'transparent',
                color: activeSubTab === 'FINANCE_ADMIN' ? undefined : 'var(--slate-700)',
                boxShadow: activeSubTab === 'FINANCE_ADMIN' ? undefined : 'none',
                fontWeight: activeSubTab === 'FINANCE_ADMIN' ? 800 : 600
              }}
            >
              <Wallet size={16} /> Admin Keuangan ({financeAdmins.length})
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeSubTab === 'PICKUP_ADMIN' ? 'btn-primary' : ''}`}
              onClick={() => { setActiveSubTab('PICKUP_ADMIN'); setSearchQuery(''); }}
              style={{
                fontSize: '0.82rem',
                padding: '0.4rem 0.85rem',
                background: activeSubTab === 'PICKUP_ADMIN' ? undefined : 'transparent',
                color: activeSubTab === 'PICKUP_ADMIN' ? undefined : 'var(--slate-700)',
                boxShadow: activeSubTab === 'PICKUP_ADMIN' ? undefined : 'none',
                fontWeight: activeSubTab === 'PICKUP_ADMIN' ? 800 : 600
              }}
            >
              <Volume2 size={16} /> Admin Penjemputan ({pickupAdmins.length})
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeSubTab === 'CASHIER' ? 'btn-primary' : ''}`}
              onClick={() => { setActiveSubTab('CASHIER'); setSearchQuery(''); }}
              style={{
                fontSize: '0.82rem',
                padding: '0.4rem 0.85rem',
                background: activeSubTab === 'CASHIER' ? undefined : 'transparent',
                color: activeSubTab === 'CASHIER' ? undefined : 'var(--slate-700)',
                boxShadow: activeSubTab === 'CASHIER' ? undefined : 'none',
                fontWeight: activeSubTab === 'CASHIER' ? 800 : 600
              }}
            >
              <Store size={16} /> Kasir Kantin ({cashiers.length})
            </button>
          </div>

          {/* Add Button depending on active sub tab */}
          {activeSubTab === 'STUDENTS' && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenAddStudent} style={{ fontWeight: 700 }}>
              <UserPlus size={16} /> Tambah Siswa Baru
            </button>
          )}

          {activeSubTab === 'FINANCE_ADMIN' && (
            <button className="btn btn-primary btn-sm" onClick={() => handleOpenAddAccount('ADMIN_KEUANGAN')} style={{ fontWeight: 700 }}>
              <UserPlus size={16} /> Tambah Admin Keuangan
            </button>
          )}

          {activeSubTab === 'PICKUP_ADMIN' && (
            <button className="btn btn-gold btn-sm" onClick={() => handleOpenAddAccount('ADMIN_PENJEMPUTAN')} style={{ fontWeight: 700 }}>
              <UserPlus size={16} /> Tambah Admin Penjemputan
            </button>
          )}

          {activeSubTab === 'CASHIER' && (
            <button className="btn btn-gold btn-sm" onClick={() => handleOpenAddAccount('KASIR_KANTIN')} style={{ fontWeight: 700 }}>
              <UserPlus size={16} /> Tambah Kasir Kantin
            </button>
          )}

        </div>

        {/* Search Input Bar */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px', borderRadius: '10px' }}
            placeholder={
              activeSubTab === 'STUDENTS'
                ? "Cari nama siswa, NIS, kelas, atau UID RFID..."
                : activeSubTab === 'FINANCE_ADMIN'
                ? "Cari username atau nama admin keuangan..."
                : "Cari username atau nama kasir kantin..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* ------------------------------------------------------------- */}
        {/* SUB TAB 1: DATA SISWA TABLE */}
        {/* ------------------------------------------------------------- */}
        {activeSubTab === 'STUDENTS' && (
          <div className="table-container" style={{ maxHeight: '520px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>NIS & Kelas</th>
                  <th>Kartu RFID UID</th>
                  <th>Saldo Tabungan</th>
                  <th>Saldo Deposit</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi CRUD</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                      Tidak ada data siswa ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <img
                            src={s.photo}
                            alt={s.name}
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--slate-300)' }}
                          />
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{s.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>ID: {s.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>NIS: {s.nis}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{s.class}</div>
                      </td>
                      <td>
                        {s.rfidUid ? (
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.78rem', color: 'var(--primary-800)' }}>
                            {s.rfidUid}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)', italic: 'true' }}>
                            Belum Ada RFID
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: '#047857' }}>
                        Rp {(Number(s.savingsBalance) || 0).toLocaleString('id-ID')}
                      </td>
                      <td style={{ fontWeight: 700, color: '#b45309' }}>
                        Rp {(Number(s.canteenDepositBalance) || 0).toLocaleString('id-ID')}
                      </td>
                      <td>
                        <span className={`badge ${s.status === 'AKTIF' ? 'badge-emerald' : 'badge-red'}`}>
                          {s.status || 'AKTIF'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEditStudent(s)}
                            title="Edit Siswa"
                          >
                            <Edit3 size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeleteStudent(s.id, s.name)}
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            title="Hapus Siswa"
                          >
                            <Trash2 size={14} /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SUB TAB 2: ADMIN KEUANGAN TABLE */}
        {/* ------------------------------------------------------------- */}
        {activeSubTab === 'FINANCE_ADMIN' && (
          <div className="table-container" style={{ maxHeight: '520px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID Akun</th>
                  <th>Username Login</th>
                  <th>Nama Pengguna</th>
                  <th>Peran (Role)</th>
                  <th>Password (Demo)</th>
                  <th style={{ textAlign: 'center' }}>Aksi CRUD</th>
                </tr>
              </thead>
              <tbody>
                {financeAdmins.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                      Belum ada akun Admin Keuangan.
                    </td>
                  </tr>
                ) : (
                  financeAdmins.map(acc => (
                    <tr key={acc.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem' }}>{acc.id}</td>
                      <td style={{ fontWeight: 800, color: 'var(--primary-800)' }}>@{acc.username}</td>
                      <td style={{ fontWeight: 700 }}>{acc.name || acc.username}</td>
                      <td>
                        <span className="badge badge-emerald">Admin Keuangan</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--slate-500)' }}>{acc.password}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEditAccount(acc)}
                            title="Edit Account"
                          >
                            <Edit3 size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeleteAccount(acc.id, acc.username)}
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            title="Hapus Akun"
                          >
                            <Trash2 size={14} /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SUB TAB 3: ADMIN PENJEMPUTAN TABLE */}
        {/* ------------------------------------------------------------- */}
        {activeSubTab === 'PICKUP_ADMIN' && (
          <div className="table-container" style={{ maxHeight: '520px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID Akun</th>
                  <th>Username Login</th>
                  <th>Nama Petugas Pos</th>
                  <th>Peran (Role)</th>
                  <th>Password (Demo)</th>
                  <th style={{ textAlign: 'center' }}>Aksi CRUD</th>
                </tr>
              </thead>
              <tbody>
                {pickupAdmins.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                      Belum ada akun Admin Penjemputan.
                    </td>
                  </tr>
                ) : (
                  pickupAdmins.map(acc => (
                    <tr key={acc.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem' }}>{acc.id}</td>
                      <td style={{ fontWeight: 800, color: 'var(--primary-800)' }}>@{acc.username}</td>
                      <td style={{ fontWeight: 700 }}>{acc.name || acc.username}</td>
                      <td>
                        <span className="badge badge-gold">Admin Penjemputan</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--slate-500)' }}>{acc.password}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEditAccount(acc)}
                            title="Edit Account"
                          >
                            <Edit3 size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeleteAccount(acc.id, acc.username)}
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            title="Hapus Akun"
                          >
                            <Trash2 size={14} /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SUB TAB 4: KASIR KANTIN TABLE */}
        {/* ------------------------------------------------------------- */}
        {activeSubTab === 'CASHIER' && (
          <div className="table-container" style={{ maxHeight: '520px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID Akun</th>
                  <th>Username Login</th>
                  <th>Nama Kasir / Loket</th>
                  <th>Peran (Role)</th>
                  <th>Password (Demo)</th>
                  <th style={{ textAlign: 'center' }}>Aksi CRUD</th>
                </tr>
              </thead>
              <tbody>
                {cashiers.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                      Belum ada akun Kasir Kantin.
                    </td>
                  </tr>
                ) : (
                  cashiers.map(acc => (
                    <tr key={acc.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem' }}>{acc.id}</td>
                      <td style={{ fontWeight: 800, color: 'var(--accent-gold-700)' }}>@{acc.username}</td>
                      <td style={{ fontWeight: 700 }}>{acc.name || acc.username}</td>
                      <td>
                        <span className="badge badge-gold">Kasir Kantin</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--slate-500)' }}>{acc.password}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEditAccount(acc)}
                            title="Edit Kasir"
                          >
                            <Edit3 size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeleteAccount(acc.id, acc.username)}
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            title="Hapus Kasir"
                          >
                            <Trash2 size={14} /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL DIALOGS FOR CRUD OPERATIONS */}
      {/* ------------------------------------------------------------- */}
      {modalType && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', padding: '1.75rem', background: 'white', border: '1px solid var(--slate-200)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {modalType === 'ADD_STUDENT' && 'Tambah Siswa Baru'}
                {modalType === 'EDIT_STUDENT' && 'Edit Data Siswa'}
                {modalType === 'ADD_ACCOUNT' && `Tambah Akun ${accountForm.roleId === 'ADMIN_KEUANGAN' ? 'Admin Keuangan' : 'Kasir Kantin'}`}
                {modalType === 'EDIT_ACCOUNT' && `Edit Akun ${accountForm.roleId === 'ADMIN_KEUANGAN' ? 'Admin Keuangan' : 'Kasir Kantin'}`}
              </h3>
              <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)' }}>
                <X size={20} />
              </button>
            </div>

            {/* FORM SISWA */}
            {(modalType === 'ADD_STUDENT' || modalType === 'EDIT_STUDENT') && (
              <form onSubmit={handleSaveStudent} style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Nama Lengkap Siswa *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Masukkan nama lengkap siswa..."
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">NIS (Nomor Induk) *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={studentForm.nis}
                      onChange={(e) => setStudentForm({ ...studentForm, nis: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Kelas *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: 5-A Tahfidz"
                      value={studentForm.class}
                      onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">UID Kartu RFID Siswa (Opsional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tempelkan/ketik UID RFID kartu..."
                    value={studentForm.rfidUid}
                    onChange={(e) => setStudentForm({ ...studentForm, rfidUid: e.target.value.toUpperCase() })}
                    style={{ fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status Keaktifan</label>
                  <select
                    className="form-select"
                    value={studentForm.status}
                    onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value })}
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="NON-AKTIF">NON-AKTIF / ALUMNI</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>
                    Simpan Data Siswa
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>
                    Batal
                  </button>
                </div>
              </form>
            )}

            {/* FORM ACCOUNT (ADMIN KEUANGAN & KASIR) */}
            {(modalType === 'ADD_ACCOUNT' || modalType === 'EDIT_ACCOUNT') && (
              <form onSubmit={handleSaveAccount} style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Nama Pengguna / Nama Loket *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: Admin Utama Keuangan / Kasir Kantin 1"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Username Login *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Username untuk login..."
                    value={accountForm.username}
                    onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Password..."
                    value={accountForm.password}
                    onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>
                    Simpan Akun
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>
                    Batal
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
