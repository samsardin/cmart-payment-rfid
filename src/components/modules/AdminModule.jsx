import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldCheck, Users, CreditCard, Activity, Search, Lock, Unlock, Plus,
  AlertCircle, Zap, CheckCircle2, Usb, Trash2, Upload, FileSpreadsheet,
  Edit3, Filter, XCircle, X, Download, Camera, User
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportToExcelXlsx } from '../../services/excelExporter';
import { getLocalIsoTimestamp, getLocalTodayDateString } from '../../services/dateUtils';
import { getClientIpAndDevice } from '../../services/networkUtils';
import { resetOperationalDatabase, backupDatabaseJson, backupDatabaseEncrypted, decryptAndParseBackup, restoreDatabaseFromJson, forceUpsertSystemAccountsToSupabase, deleteGuardian, saveSchoolState } from '../../services/schoolRepository';

export default function AdminModule({ state, setState, scannedCardUid, currentRole, onDeleteRfidCard, onNavigateToSavings, externalSubTab, onSubTabChange }) {
  const [internalSubTab, setInternalSubTab] = useState(() => (currentRole?.id === 'SUPER_ADMIN' ? 'database' : 'rfid'));
  const activeSubTab = externalSubTab || internalSubTab;
  const setActiveSubTab = (val) => {
    setInternalSubTab(val);
    if (onSubTabChange) onSubTabChange(val);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [newCardUid, setNewCardUid] = useState(scannedCardUid || '');
  const [newCardType, setNewCardType] = useState('SISWA');
  const [newCardAssignedTo, setNewCardAssignedTo] = useState(state.students[0]?.id || '');
  const [isNewOwner, setIsNewOwner] = useState(true);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerNis, setNewOwnerNis] = useState('');
  const [newOwnerClass, setNewOwnerClass] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newOwnerRelationship, setNewOwnerRelationship] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [lastScannedUid, setLastScannedUid] = useState(scannedCardUid || null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);

  // Guardian Master Data State & Handlers
  const [guardianSearch, setGuardianSearch] = useState('');
  const [showGuardianModal, setShowGuardianModal] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState(null);
  const [guardianFormName, setGuardianFormName] = useState('');
  const [guardianFormPhone, setGuardianFormPhone] = useState('');
  const [guardianFormOccupation, setGuardianFormOccupation] = useState('');
  const [guardianFormAddress, setGuardianFormAddress] = useState('');
  const [guardianFormRelationship, setGuardianFormRelationship] = useState('Ayah Kandung');
  const guardianFileInputRef = useRef(null);

  const filteredGuardiansList = useMemo(() => {
    const list = state.guardians || [];
    if (!guardianSearch.trim()) return list;
    const q = guardianSearch.trim().toLowerCase();
    return list.filter(g =>
      (g.name && g.name.toLowerCase().includes(q)) ||
      (g.phone && g.phone.toLowerCase().includes(q)) ||
      (g.occupation && g.occupation.toLowerCase().includes(q)) ||
      (g.address && g.address.toLowerCase().includes(q)) ||
      (g.relationship && g.relationship.toLowerCase().includes(q)) ||
      (g.id && g.id.toLowerCase().includes(q))
    );
  }, [state.guardians, guardianSearch]);

  const handleOpenAddGuardianModal = () => {
    setEditingGuardian(null);
    setGuardianFormName('');
    setGuardianFormPhone('');
    setGuardianFormOccupation('');
    setGuardianFormAddress('');
    setGuardianFormRelationship('Ayah Kandung');
    setShowGuardianModal(true);
  };

  const handleOpenEditGuardianModal = (gdr) => {
    setEditingGuardian(gdr);
    setGuardianFormName(gdr.name || '');
    setGuardianFormPhone(gdr.phone || '');
    setGuardianFormOccupation(gdr.occupation || '');
    setGuardianFormAddress(gdr.address || '');
    setGuardianFormRelationship(gdr.relationship || 'Wali');
    setShowGuardianModal(true);
  };

  const handleSaveGuardian = async (e) => {
    e.preventDefault();
    if (!guardianFormName.trim()) {
      setFeedback({ type: 'error', text: 'Nama Orang Tua / Wali wajib diisi!' });
      return;
    }

    const cleanPhone = guardianFormPhone.trim();
    const cleanName = guardianFormName.trim();
    const cleanOccupation = guardianFormOccupation.trim();
    const cleanAddress = guardianFormAddress.trim();
    const cleanRel = guardianFormRelationship.trim() || 'Wali';

    let updatedGuardians = [...(state.guardians || [])];
    let targetGdrId = editingGuardian?.id;

    if (editingGuardian) {
      updatedGuardians = updatedGuardians.map(g => {
        if (g.id === editingGuardian.id) {
          return {
            ...g,
            name: cleanName,
            phone: cleanPhone,
            occupation: cleanOccupation,
            address: cleanAddress,
            relationship: cleanRel
          };
        }
        return g;
      });
    } else {
      targetGdrId = `GDR-${Date.now()}`;
      const newGdr = {
        id: targetGdrId,
        name: cleanName,
        phone: cleanPhone,
        occupation: cleanOccupation,
        address: cleanAddress,
        relationship: cleanRel
      };
      updatedGuardians.push(newGdr);
    }

    // Also update student's guardianName if linked
    const updatedStudents = (state.students || []).map(s => {
      if (s.guardianId === targetGdrId || (editingGuardian && s.guardianName === editingGuardian.name)) {
        return { ...s, guardianName: cleanName, guardianId: targetGdrId };
      }
      return s;
    });

    const newState = {
      ...state,
      guardians: updatedGuardians,
      students: updatedStudents,
      auditLogs: [
        {
          id: `AUD-${Date.now()}`,
          timestamp: getLocalIsoTimestamp(),
          actor: currentRole?.name || 'Admin',
          action: editingGuardian ? 'UPDATE_GUARDIAN' : 'CREATE_GUARDIAN',
          entity: 'guardians',
          entityId: targetGdrId,
          details: `${editingGuardian ? 'Update' : 'Tambah'} data Orang Tua '${cleanName}' (${cleanRel})`,
          ip: getClientIpAndDevice()
        },
        ...(state.auditLogs || [])
      ]
    };

    setState(newState);
    setShowGuardianModal(false);
    setFeedback({
      type: 'success',
      text: `Data Orang Tua '${cleanName}' BERHASIL ${editingGuardian ? 'diperbarui' : 'ditambahkan'}!`
    });

    try {
      await saveSchoolState(newState);
    } catch (err) {
      console.warn('Failed syncing guardian to Supabase:', err);
    }
  };

  const handleDeleteGuardianSingle = async (gdrId, gdrName) => {
    const linkedStudents = (state.students || []).filter(s => s.guardianId === gdrId || s.guardianName === gdrName);
    const linkedMsg = linkedStudents.length > 0 ? ` (Terhubung dengan ${linkedStudents.length} siswa)` : '';
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data Orang Tua '${gdrName}'${linkedMsg}?`)) {
      return;
    }

    const updatedGuardians = (state.guardians || []).filter(g => g.id !== gdrId);
    const updatedStudents = (state.students || []).map(s => {
      if (s.guardianId === gdrId) {
        return { ...s, guardianId: null };
      }
      return s;
    });

    const newState = {
      ...state,
      guardians: updatedGuardians,
      students: updatedStudents,
      auditLogs: [
        {
          id: `AUD-${Date.now()}`,
          timestamp: getLocalIsoTimestamp(),
          actor: currentRole?.name || 'Admin',
          action: 'DELETE_GUARDIAN',
          entity: 'guardians',
          entityId: gdrId,
          details: `Hapus data Orang Tua '${gdrName}' dari sistem`,
          ip: getClientIpAndDevice()
        },
        ...(state.auditLogs || [])
      ]
    };

    setState(newState);
    setFeedback({ type: 'success', text: `Data Orang Tua '${gdrName}' BERHASIL dihapus.` });

    try {
      await deleteGuardian(gdrId);
      await saveSchoolState(newState);
    } catch (err) {
      console.warn('Warning deleting guardian from Supabase:', err);
    }
  };

  // Excel Export for Guardians
  const handleExportExcelWali = () => {
    const columns = [
      'ID Wali',
      'Nama Lengkap Wali',
      'Hubungan',
      'No. Telepon / WA',
      'Pekerjaan',
      'Alamat Rumah',
      'Jumlah Anak',
      'Daftar Anak (Siswa)'
    ];

    const dataRows = (state.guardians || []).map(g => {
      const children = (state.students || []).filter(s => s.guardianId === g.id || s.guardianName === g.name);
      const childNames = children.map(c => `${c.name} (${c.class})`).join(', ');
      return [
        g.id || '',
        g.name || '',
        g.relationship || 'Wali',
        g.phone || '',
        g.occupation || '-',
        g.address || '-',
        children.length,
        childNames || '-'
      ];
    });

    exportToExcelXlsx({
      filename: `master_data_orang_tua_${getLocalTodayDateString()}.xlsx`,
      sheetName: 'Master Data Orang Tua',
      title: 'DATA MASTER ORANG TUA / WALI SISWA',
      summaryRows: [
        ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
        ['Total Orang Tua / Wali', (state.guardians || []).length]
      ],
      columns,
      dataRows
    });
  };

  // Excel Template Download for Guardians
  const handleDownloadTemplateWali = () => {
    const columns = ['Nama Wali', 'Hubungan', 'No HP WA', 'Pekerjaan', 'Alamat Rumah'];
    const dataRows = [
      ['Bpk. Rahmat Hidayat', 'Ayah Kandung', '081298765432', 'Wiraswasta', 'Jl. Mawar No. 12, Jakarta'],
      ['Ibu Ratna Sari', 'Ibu Kandung', '081311223344', 'PNS', 'Jl. Anggrek No. 45, Jakarta']
    ];

    exportToExcelXlsx({
      filename: 'template_import_orang_tua.xlsx',
      sheetName: 'Template Orang Tua',
      title: 'TEMPLATE IMPORT DATA ORANG TUA / WALI',
      summaryRows: [
        ['Petunjuk', 'Isi data orang tua sesuai kolom di bawah ini. Upload file ini di menu Master Orang Tua.']
      ],
      columns,
      dataRows
    });
  };

  // Excel File Upload for Guardians
  const handleFileUploadWali = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);

        if (!rawData || rawData.length === 0) {
          setFeedback({ type: 'error', text: 'File Excel kosong atau format tidak sesuai.' });
          return;
        }

        let updatedGuardians = [...(state.guardians || [])];
        let addedCount = 0;
        let updatedCount = 0;

        rawData.forEach((row, idx) => {
          const name = row['Nama Wali'] || row['Nama'] || row['Nama Lengkap'] || row['NAMA_WALI'];
          if (!name) return;

          const phone = String(row['No HP WA'] || row['No HP'] || row['No. Telepon'] || row['WA'] || row['Telepon'] || '').trim();
          const occupation = String(row['Pekerjaan'] || row['Jabatan'] || '').trim();
          const address = String(row['Alamat Rumah'] || row['Alamat'] || '').trim();
          const relationship = String(row['Hubungan'] || row['Relasi'] || 'Wali').trim();

          const existingIndex = updatedGuardians.findIndex(g => g.name.trim().toLowerCase() === String(name).trim().toLowerCase());
          if (existingIndex >= 0) {
            updatedGuardians[existingIndex] = {
              ...updatedGuardians[existingIndex],
              name: String(name).trim(),
              phone: phone || updatedGuardians[existingIndex].phone,
              occupation: occupation || updatedGuardians[existingIndex].occupation,
              address: address || updatedGuardians[existingIndex].address,
              relationship: relationship || updatedGuardians[existingIndex].relationship
            };
            updatedCount++;
          } else {
            const newGdr = {
              id: `GDR-${Date.now()}-${idx}`,
              name: String(name).trim(),
              phone,
              occupation,
              address,
              relationship
            };
            updatedGuardians.push(newGdr);
            addedCount++;
          }
        });

        const newState = {
          ...state,
          guardians: updatedGuardians,
          auditLogs: [
            {
              id: `AUD-${Date.now()}`,
              timestamp: getLocalIsoTimestamp(),
              actor: currentRole?.name || 'Admin',
              action: 'IMPORT_GUARDIANS_EXCEL',
              entity: 'guardians',
              entityId: 'batch-import',
              details: `Import Batch Excel Data Orang Tua: ${addedCount} baru, ${updatedCount} diperbarui`,
              ip: getClientIpAndDevice()
            },
            ...(state.auditLogs || [])
          ]
        };

        setState(newState);
        setFeedback({
          type: 'success',
          text: `Import Data Orang Tua BERHASIL! (${addedCount} orang tua baru ditambahkan, ${updatedCount} diperbarui)`
        });

        try {
          await saveSchoolState(newState);
        } catch (err) {
          console.warn('Failed saving imported guardians to Supabase:', err);
        }
      } catch (err) {
        console.error('Failed reading guardian import file:', err);
        setFeedback({ type: 'error', text: 'Gagal membaca file Excel. Pastikan format file .xlsx/.csv valid.' });
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  // Database Backup, Restore, and Reset State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [restorePasswordInput, setRestorePasswordInput] = useState('');
  const [isDecryptModalOpen, setIsDecryptModalOpen] = useState(false);
  const [rawRestoreFileStr, setRawRestoreFileStr] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const restoreFileInputRef = useRef(null);

  const handleBackupDatabase = async (usePassword = false) => {
    setIsProcessingAction(true);
    try {
      const pwd = usePassword ? backupPassword.trim() : '';
      await backupDatabaseEncrypted(state, pwd);
      setFeedback({
        type: 'success',
        text: pwd ? 'File backup terenkripsi AES-256 (.enc) berhasil diunduh!' : 'File cadangan (backup database .json) berhasil diunduh.'
      });
      setBackupPassword('');
    } catch (err) {
      setFeedback({ type: 'error', text: `Gagal mencadangkan database: ${err.message}` });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRestoreFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingAction(true);
    setFeedback(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileStr = event.target.result;
      setRawRestoreFileStr(fileStr);

      try {
        const parsedObj = JSON.parse(fileStr);
        if (parsedObj && parsedObj.encrypted) {
          setIsDecryptModalOpen(true);
          setRestorePasswordInput('');
          setIsProcessingAction(false);
          return;
        }

        // Plain unencrypted JSON restore
        if (!window.confirm(`PERINGATAN: Memulihkan database dari file '${file.name}' akan memperbarui seluruh tabel sekolah. Lanjutkan?`)) {
          if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
          setIsProcessingAction(false);
          return;
        }

        const restoredState = await restoreDatabaseFromJson(parsedObj, state);
        setState(restoredState);
        setFeedback({
          type: 'success',
          text: `Pemulihan Database BERHASIL! (Siswa: ${restoredState.students.length}, Kartu: ${restoredState.rfidCards.length}, Transaksi: ${restoredState.ledger.length})`
        });
      } catch (err) {
        setFeedback({ type: 'error', text: `Gagal membaca/memulihkan file backup: ${err.message}` });
      } finally {
        setIsProcessingAction(false);
        if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setFeedback({ type: 'error', text: 'Gagal membaca file backup.' });
      setIsProcessingAction(false);
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleExecuteDecryptAndRestore = async () => {
    if (!restorePasswordInput.trim()) {
      alert('Masukkan password dekripsi file backup!');
      return;
    }

    setIsProcessingAction(true);
    try {
      const parsedPayload = await decryptAndParseBackup(rawRestoreFileStr, restorePasswordInput.trim());
      const restoredState = await restoreDatabaseFromJson(parsedPayload, state);
      setState(restoredState);
      setIsDecryptModalOpen(false);
      setRestorePasswordInput('');
      setRawRestoreFileStr('');
      setFeedback({
        type: 'success',
        text: `Pemulihan Database TERENKRIPSI BERHASIL! (Siswa: ${restoredState.students.length}, Kartu: ${restoredState.rfidCards.length}, Transaksi: ${restoredState.ledger.length})`
      });
    } catch (err) {
      alert(`GAGAL MEMULIHKAN DATABASE: ${err.message}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleForceSyncSupabaseAccounts = async () => {
    setIsProcessingAction(true);
    setFeedback(null);
    try {
      const res = await forceUpsertSystemAccountsToSupabase();
      if (res.success) {
        setFeedback({ type: 'success', text: res.text });
      } else {
        setFeedback({ type: 'error', text: res.text });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: `Gagal sinkronisasi Supabase: ${err.message}` });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleExecuteResetOperational = async () => {
    if (resetConfirmText.trim() !== 'RESET DATA SEKOLAH') {
      alert("Teks konfirmasi salah! Ketik 'RESET DATA SEKOLAH' dengan huruf kapital sesuai petunjuk.");
      return;
    }

    setIsProcessingAction(true);
    setFeedback(null);

    try {
      const emptyState = await resetOperationalDatabase(state);
      try {
        localStorage.setItem('sistem_sekolah_rfid_v1', JSON.stringify(emptyState));
      } catch (lsErr) {
        console.warn('Warning updating localStorage on reset:', lsErr);
      }
      setState(emptyState);
      setIsResetModalOpen(false);
      setResetConfirmText('');
      setFeedback({
        type: 'success',
        text: `DATABASE OPERASIONAL BERHASIL DIRESET! Seluruh data Siswa, Wali, Kartu RFID, Mutasi Ledger, dan Akun Siswa/Wali telah dibersihkan. Akun Role Management (${emptyState.loginAccounts?.length || 0} Akun) tetap aman.`
      });
    } catch (err) {
      setFeedback({ type: 'error', text: `Gagal melakukan reset database: ${err.message}` });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Filtered owner search list for RFID registration
  const searchedOwnersList = useMemo(() => {
    const q = ownerSearchQuery.toLowerCase().trim();
    if (newCardType === 'SISWA') {
      if (!q) return state.students || [];
      return (state.students || []).filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.nis || '').toLowerCase().includes(q) ||
        (s.class || '').toLowerCase().includes(q)
      );
    } else {
      if (!q) return state.guardians || [];
      return (state.guardians || []).filter(g =>
        (g.name || '').toLowerCase().includes(q) ||
        (g.phone || '').toLowerCase().includes(q) ||
        (g.relationship || '').toLowerCase().includes(q)
      );
    }
  }, [state.students, state.guardians, newCardType, ownerSearchQuery]);

  // Selected owner object memo for display badge
  const selectedOwnerObj = useMemo(() => {
    if (!newCardAssignedTo) return null;
    if (newCardType === 'SISWA') {
      return (state.students || []).find(s => s.id === newCardAssignedTo);
    } else {
      return (state.guardians || []).find(g => g.id === newCardAssignedTo);
    }
  }, [newCardAssignedTo, newCardType, state.students, state.guardians]);

  // Sync ownerSearchQuery text when assigned owner is selected
  useEffect(() => {
    if (newCardAssignedTo && newCardType === 'SISWA') {
      const st = (state.students || []).find(s => s.id === newCardAssignedTo);
      if (st) {
        setOwnerSearchQuery(`${st.name} (${st.class}) - NIS: ${st.nis}`);
      }
    } else if (newCardAssignedTo && newCardType === 'PENJEMPUT') {
      const gd = (state.guardians || []).find(g => g.id === newCardAssignedTo);
      if (gd) {
        setOwnerSearchQuery(`${gd.name} (${gd.relationship})`);
      }
    }
  }, [newCardAssignedTo, newCardType, state.students, state.guardians]);

  // Master Student Management State
  const [studentSearch, setStudentSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [studentModalType, setStudentModalType] = useState(null); // 'ADD' | 'EDIT'
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({
    name: '',
    nis: '',
    class: '',
    rfidUid: '',
    guardianName: '',
    status: 'AKTIF'
  });

  const uidInputRef = useRef(null);
  const newOwnerNameInputRef = useRef(null);
  const ownerSearchInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-focus Nama Pemilik Baru input field when isNewOwner is active
  useEffect(() => {
    if (isNewOwner) {
      const timer = setTimeout(() => {
        if (newOwnerNameInputRef.current) {
          newOwnerNameInputRef.current.focus();
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        if (ownerSearchInputRef.current) {
          ownerSearchInputRef.current.focus();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isNewOwner, newCardUid, activeSubTab]);

  // Auto-fill UID & focus input when card is tapped on RFID Reader / Simulator
  useEffect(() => {
    if (scannedCardUid) {
      const clean = scannedCardUid.trim().toUpperCase();
      setNewCardUid(clean);
      setLastScannedUid(clean);
      setActiveSubTab('rfid');

      // Check if card is unregistered -> default isNewOwner to true ("Buat pemilik baru")
      const existingCard = (state.rfidCards || []).find(c => c.uid.toUpperCase() === clean);
      if (!existingCard) {
        setIsNewOwner(true);
      }
    }
  }, [scannedCardUid, state.rfidCards]);

  // Direct simulator tap inside Admin Module
  const handleDirectTapNewCard = (uid) => {
    const clean = uid.trim().toUpperCase();
    setNewCardUid(clean);
    setLastScannedUid(clean);
    setIsNewOwner(true);
    setActiveSubTab('rfid');
    if (uidInputRef.current) {
      uidInputRef.current.focus();
    }
  };

  // Toggle RFID Card Status (Active / Blocked)
  const toggleCardStatus = (cardId) => {
    setState(prev => {
      const card = prev.rfidCards.find(c => c.id === cardId);
      const newStatus = card.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
      const updatedCards = prev.rfidCards.map(c => c.id === cardId ? { ...c, status: newStatus } : c);

      const newAudit = {
        id: `AUD-${Date.now()}`,
        timestamp: getLocalIsoTimestamp(),
        actor: currentRole?.name || 'Admin',
        action: newStatus === 'BLOCKED' ? 'BLOKIR_KARTU_RFID' : 'AKTIFKAN_KARTU_RFID',
        entity: 'rfid_cards',
        entityId: cardId,
        details: `Perubahan status kartu ${card.uid} (${card.assignedToName}) menjadi ${newStatus}`,
        ip: getClientIpAndDevice()
      };

      return {
        ...prev,
        rfidCards: updatedCards,
        auditLogs: [newAudit, ...prev.auditLogs]
      };
    });
  };

  const deleteCard = (card) => {
    if (!['SUPER_ADMIN', 'ADMIN_KEUANGAN'].includes(currentRole?.id)) return;
    if (!window.confirm(`Hapus kartu RFID UID ${card.uid}? Tindakan ini tidak dapat dibatalkan.`)) return;

    setState((prev) => {
      const auditLog = {
        id: `AUD-${Date.now()}`,
        timestamp: getLocalIsoTimestamp(),
        actor: currentRole?.name || 'Admin',
        action: 'HAPUS_KARTU_RFID',
        entity: 'rfid_cards',
        entityId: card.id,
        details: `Menghapus kartu RFID UID ${card.uid} milik ${card.assignedToName}`,
        ip: getClientIpAndDevice()
      };

      return {
        ...prev,
        rfidCards: prev.rfidCards.filter((item) => item.id !== card.id),
        auditLogs: [auditLog, ...prev.auditLogs]
      };
    });

    if (onDeleteRfidCard) {
      onDeleteRfidCard(card.id);
    }
  };

  // Register New RFID Card
  const handleAddCard = (e) => {
    if (e) e.preventDefault();
    const cleanUid = newCardUid.trim().toUpperCase();

    if (!cleanUid) {
      setFeedback({ type: 'error', text: 'Nomor UID RFID tidak boleh kosong.' });
      return;
    }

    const existingCard = state.rfidCards.find(c => c.uid.toUpperCase() === cleanUid);
    if (existingCard) {
      setFeedback({ type: 'error', text: `Kartu dengan UID '${cleanUid}' sudah terdaftar untuk: ${existingCard.assignedToName}` });
      return;
    }

    let assignedId = newCardAssignedTo;
    let assignedName = '';
    let newStudent = null;
    let newGuardian = null;

    if (isNewOwner) {
      if (!newOwnerName.trim()) {
        setFeedback({ type: 'error', text: 'Nama pemilik baru tidak boleh kosong.' });
        return;
      }

      if (newCardType === 'SISWA') {
        if (!newOwnerNis.trim() || !newOwnerClass.trim()) {
          setFeedback({ type: 'error', text: 'NIS dan Kelas wajib diisi untuk registrasi siswa baru.' });
          return;
        }

        assignedId = `STD-${Date.now().toString().slice(-4)}`;
        assignedName = newOwnerName.trim();
        newStudent = {
          id: assignedId,
          nis: newOwnerNis.trim(),
          name: assignedName,
          class: newOwnerClass.trim(),
          guardianId: '',
          guardianName: '',
          savingsBalance: 0,
          canteenDepositBalance: 0,
          canteenBalanceSource: 'TABUNGAN',
          rfidUid: cleanUid,
          photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
          status: 'AKTIF',
          gender: 'L'
        };
      } else {
        if (!newOwnerPhone.trim() || !newOwnerRelationship.trim()) {
          setFeedback({ type: 'error', text: 'Nomor HP dan Hubungan wajib diisi untuk registrasi wali baru.' });
          return;
        }

        assignedId = `GDR-${Date.now().toString().slice(-4)}`;
        assignedName = `${newOwnerName.trim()} (${newOwnerRelationship.trim()})`;
        newGuardian = {
          id: assignedId,
          name: newOwnerName.trim(),
          phone: newOwnerPhone.trim(),
          relationship: newOwnerRelationship.trim(),
          studentId: '',
          rfidCardUid: cleanUid,
          address: 'Alamat belum diatur'
        };
      }
    } else {
      if (newCardType === 'SISWA') {
        const s = state.students.find(st => st.id === newCardAssignedTo);
        if (!s) {
          setFeedback({ type: 'error', text: 'Data siswa pemilik kartu tidak ditemukan.' });
          return;
        }
        assignedName = s.name;
      } else {
        const g = state.guardians.find(gr => gr.id === newCardAssignedTo);
        if (!g) {
          setFeedback({ type: 'error', text: 'Data orang tua/wali pemilik kartu tidak ditemukan.' });
          return;
        }
        assignedName = `${g.name} (${g.relationship})`;
      }
    }

    // Find existing RFID card belonging to this assigned owner to update in-place
    const existingOwnerCard = state.rfidCards.find(c => c.assignedToId === assignedId);
    const cardIdToUse = (isNewOwner || !existingOwnerCard)
      ? `CARD-${Date.now().toString().slice(-4)}`
      : existingOwnerCard.id;

    const newCard = {
      id: cardIdToUse,
      uid: cleanUid,
      type: newCardType,
      assignedToName: assignedName,
      assignedToId: assignedId,
      status: 'ACTIVE',
      issuedAt: getLocalTodayDateString()
    };

    const newAudit = {
      id: `AUD-${Date.now()}`,
      timestamp: getLocalIsoTimestamp(),
      actor: currentRole?.name || 'Admin',
      action: 'REGISTRASI_KARTU_RFID',
      entity: 'rfid_cards',
      entityId: newCard.id,
      details: `Penerbitan kartu baru UID ${cleanUid} untuk ${assignedName}`,
      ip: getClientIpAndDevice()
    };

    setState(prev => {
      // 1. Update Student's rfidUid or Add new student (NO DUPLICATES)
      let updatedStudents = prev.students;
      if (newCardType === 'SISWA') {
        if (newStudent) {
          updatedStudents = [...prev.students, { ...newStudent, rfidUid: cleanUid }];
        } else {
          updatedStudents = prev.students.map(s =>
            s.id === assignedId ? { ...s, rfidUid: cleanUid } : s
          );
        }
      }

      // 2. Update Guardian's rfidCardUid or Add new guardian
      let updatedGuardians = prev.guardians;
      if (newCardType === 'PENJEMPUT') {
        if (newGuardian) {
          updatedGuardians = [...prev.guardians, { ...newGuardian, rfidCardUid: cleanUid }];
        } else {
          updatedGuardians = prev.guardians.map(g =>
            g.id === assignedId ? { ...g, rfidCardUid: cleanUid } : g
          );
        }
      }

      // 3. Remove old RFID card record of this assigned owner (replace with new UID)
      const filteredCards = prev.rfidCards.filter(c => c.assignedToId !== assignedId && c.uid.toUpperCase() !== cleanUid);
      const updatedRfidCards = [newCard, ...filteredCards];

      return {
        ...prev,
        students: updatedStudents,
        guardians: updatedGuardians,
        rfidCards: updatedRfidCards,
        auditLogs: [newAudit, ...prev.auditLogs]
      };
    });

    setFeedback({
      type: 'success',
      text: `Kartu RFID UID ${cleanUid} berhasil ditambahkan dan dipetakan ke ${assignedName}!`
    });

    // Find mapped student object to navigate to Tabungan & Ledger
    let targetStudent = newStudent;
    if (!targetStudent && newCardType === 'SISWA') {
      const found = state.students.find(s => s.id === assignedId);
      if (found) targetStudent = { ...found, rfidUid: cleanUid };
    }

    setNewCardUid('');
    setLastScannedUid(null);
    setIsNewOwner(true);
    setNewOwnerName('');
    setNewOwnerNis('');
    setNewOwnerClass('');
    setNewOwnerPhone('');
    setNewOwnerRelationship('');

    if (newCardType === 'SISWA' && targetStudent && onNavigateToSavings) {
      setTimeout(() => {
        onNavigateToSavings(targetStudent, cleanUid);
      }, 300);
    }
  };

  // -------------------------------------------------------------
  // MASTER SISWA: FILTER & LIST LOGIC
  // -------------------------------------------------------------
  const uniqueClasses = useMemo(() => {
    const set = new Set();
    (state.students || []).forEach(s => {
      if (s.class) set.add(s.class);
    });
    return Array.from(set).sort();
  }, [state.students]);

  const filteredStudentsList = useMemo(() => {
    return (state.students || []).filter(s => {
      const q = studentSearch.toLowerCase();
      const matchesSearch =
        (s.name || '').toLowerCase().includes(q) ||
        (s.nis || '').toLowerCase().includes(q) ||
        (s.class || '').toLowerCase().includes(q) ||
        (s.rfidUid || '').toLowerCase().includes(q);

      const matchesClass = classFilter === 'ALL' || s.class === classFilter;
      return matchesSearch && matchesClass;
    });
  }, [state.students, studentSearch, classFilter]);

  // -------------------------------------------------------------
  // MASTER SISWA: SINGLE STUDENT CRUD HANDLERS
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // MASTER SISWA: SINGLE STUDENT CRUD HANDLERS
  // -------------------------------------------------------------
  const handlePhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', text: 'File yang dipilih harus berupa gambar (JPG/PNG/WEBP/GIF)!' });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'Ukuran file gambar maksimal 3 MB!' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setStudentForm(prev => ({ ...prev, photo: uploadEvent.target?.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddStudentModal = () => {
    setEditingStudent(null);
    const autoNis = `2026${Math.floor(1000 + Math.random() * 9000)}`;
    setStudentForm({
      name: '',
      nis: autoNis,
      class: uniqueClasses[0] || '5-A Tahfidz',
      gender: 'L',
      photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
      rfidUid: '',
      guardianName: '',
      guardianPhone: '',
      guardianRelationship: 'Ayah',
      status: 'AKTIF',
      username: autoNis,
      password: `${autoNis}123`
    });
    setStudentModalType('ADD');
  };

  const handleOpenEditStudentModal = (student) => {
    setEditingStudent(student);
    const acc = (state.loginAccounts || []).find(a => a.studentId === student.id || a.username === student.nis);
    const gdr = (state.guardians || []).find(g => g.id === student.guardianId || g.studentId === student.id || g.name === student.guardianName);
    
    const initialGdrName = student.guardianName || gdr?.name || '';
    const initialGdrPhone = student.guardianPhone || gdr?.phone || '';
    const initialGdrRel = student.guardianRelationship || gdr?.relationship || 'Ayah';

    setStudentForm({
      name: student.name || '',
      nis: student.nis || '',
      class: student.class || '',
      gender: student.gender || 'L',
      photo: student.photo || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
      rfidUid: student.rfidUid || '',
      guardianName: initialGdrName,
      guardianPhone: initialGdrPhone,
      guardianRelationship: initialGdrRel,
      status: student.status || 'AKTIF',
      username: acc?.username || student.nis,
      password: acc?.password || `${student.nis}123`
    });
    setStudentModalType('EDIT');
  };

  const handleSaveStudentSubmit = async (e) => {
    e.preventDefault();
    if (!studentForm.name.trim() || !studentForm.nis.trim() || !studentForm.class.trim()) {
      setFeedback({ type: 'error', text: 'Nama, NIS, dan Kelas wajib diisi!' });
      return;
    }

    const targetUsername = (studentForm.username || studentForm.nis).trim().toLowerCase();
    const targetPassword = (studentForm.password || `${studentForm.nis}123`).trim();

    const inputGdrName = studentForm.guardianName.trim();
    const inputGdrPhone = studentForm.guardianPhone.trim();
    const inputGdrRel = studentForm.guardianRelationship || 'Ayah';

    let updatedGuardians = [...(state.guardians || [])];
    let newState = null;

    if (studentModalType === 'ADD') {
      const newStudentId = `STD-${Date.now()}`;
      let targetGuardianId = '';

      if (inputGdrName || inputGdrPhone) {
        const effectiveName = (inputGdrName && !inputGdrName.toLowerCase().includes('orang tua')) ? inputGdrName : `Wali dari ${studentForm.name.trim()}`;
        const existingGdr = updatedGuardians.find(g =>
          (inputGdrPhone && g.phone && g.phone.trim() === inputGdrPhone) ||
          (g.name && g.name.trim().toLowerCase() === effectiveName.toLowerCase())
        );

        if (existingGdr) {
          targetGuardianId = existingGdr.id;
          existingGdr.name = effectiveName;
          existingGdr.phone = inputGdrPhone;
          existingGdr.relationship = inputGdrRel;
        } else {
          targetGuardianId = `GDR-${Date.now()}`;
          const newGuardianObj = {
            id: targetGuardianId,
            name: effectiveName,
            phone: inputGdrPhone,
            relationship: inputGdrRel,
            studentId: newStudentId,
            rfidCardUid: '',
            address: ''
          };
          updatedGuardians.push(newGuardianObj);
        }
      }

      const newStudentObj = {
        id: newStudentId,
        nis: studentForm.nis.trim(),
        name: studentForm.name.trim(),
        class: studentForm.class.trim(),
        gender: studentForm.gender || 'L',
        guardianId: targetGuardianId,
        guardianName: (inputGdrName && !inputGdrName.toLowerCase().includes('orang tua')) ? inputGdrName : '',
        guardianPhone: inputGdrPhone,
        guardianRelationship: inputGdrRel,
        savingsBalance: 0,
        canteenDepositBalance: 0,
        canteenBalanceSource: 'TABUNGAN',
        rfidUid: studentForm.rfidUid.trim().toUpperCase(),
        photo: studentForm.photo || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
        status: studentForm.status
      };

      const newAccountObj = {
        id: `ACC-${newStudentId}`,
        username: targetUsername,
        password: targetPassword,
        roleId: 'SISWA',
        studentId: newStudentId
      };

      newState = {
        ...state,
        students: [newStudentObj, ...(state.students || [])],
        guardians: updatedGuardians,
        loginAccounts: [...(state.loginAccounts || []), newAccountObj]
      };

      setState(newState);
      setFeedback({ type: 'success', text: `Siswa baru "${newStudentObj.name}" & data orang tua berhasil disimpan!` });

    } else if (studentModalType === 'EDIT' && editingStudent) {
      const targetStudentId = editingStudent.id;
      const existingAccIdx = (state.loginAccounts || []).findIndex(a => a.studentId === targetStudentId || a.username === editingStudent.nis);

      let updatedAccounts = [...(state.loginAccounts || [])];
      if (existingAccIdx >= 0) {
        updatedAccounts[existingAccIdx] = {
          ...updatedAccounts[existingAccIdx],
          username: targetUsername,
          password: targetPassword,
          roleId: 'SISWA',
          studentId: targetStudentId
        };
      } else {
        updatedAccounts.push({
          id: `ACC-${targetStudentId}`,
          username: targetUsername,
          password: targetPassword,
          roleId: 'SISWA',
          studentId: targetStudentId
        });
      }

      let targetGdrId = editingStudent.guardianId;
      const effectiveName = (inputGdrName && !inputGdrName.toLowerCase().includes('orang tua'))
        ? inputGdrName
        : (editingStudent.guardianName || '');

      if (targetGdrId || effectiveName || inputGdrPhone) {
        const gIdx = updatedGuardians.findIndex(g =>
          (targetGdrId && g.id === targetGdrId) ||
          (inputGdrPhone && g.phone && g.phone.trim() === inputGdrPhone) ||
          (effectiveName && g.name && g.name.trim().toLowerCase() === effectiveName.toLowerCase())
        );

        if (gIdx >= 0) {
          targetGdrId = updatedGuardians[gIdx].id;
          updatedGuardians[gIdx] = {
            ...updatedGuardians[gIdx],
            name: effectiveName || updatedGuardians[gIdx].name || 'Orang Tua / Wali',
            phone: inputGdrPhone,
            relationship: inputGdrRel
          };
        } else if (effectiveName || inputGdrPhone) {
          targetGdrId = `GDR-${Date.now()}`;
          updatedGuardians.push({
            id: targetGdrId,
            name: effectiveName || `Wali ${studentForm.name.trim()}`,
            phone: inputGdrPhone,
            relationship: inputGdrRel,
            studentId: targetStudentId,
            rfidCardUid: '',
            address: ''
          });
        }
      }

      const updatedStudents = (state.students || []).map(s => {
        if (s.id === editingStudent.id) {
          return {
            ...s,
            name: studentForm.name.trim(),
            nis: studentForm.nis.trim(),
            class: studentForm.class.trim(),
            gender: studentForm.gender || 'L',
            photo: studentForm.photo || s.photo,
            rfidUid: studentForm.rfidUid.trim().toUpperCase(),
            guardianId: targetGdrId || s.guardianId,
            guardianName: effectiveName,
            guardianPhone: inputGdrPhone,
            guardianRelationship: inputGdrRel,
            status: studentForm.status
          };
        }
        return s;
      });

      newState = {
        ...state,
        students: updatedStudents,
        guardians: updatedGuardians,
        loginAccounts: updatedAccounts
      };

      setState(newState);
      setFeedback({ type: 'success', text: `Data siswa "${studentForm.name}" & data orang tua (No WA: ${inputGdrPhone || '-'}, Relasi: ${inputGdrRel}) BERHASIL disimpan!` });
    }

    setStudentModalType(null);

    if (newState) {
      saveSchoolState(newState).catch(err => {
        console.warn('Background sync error saving student:', err);
      });
    }
  };

  const handleDeleteStudentSingle = (studentId, studentName) => {
    if (window.confirm(`Hapus data siswa "${studentName}"? Riwayat tabungan & ledger akan tetap tersimpan.`)) {
      setState(prev => ({
        ...prev,
        students: prev.students.filter(s => s.id !== studentId)
      }));
      setFeedback({ type: 'success', text: `Siswa "${studentName}" berhasil dihapus.` });
    }
  };

  // -------------------------------------------------------------
  // MASTER SISWA: EXPORT DATA TO .XLSX
  // -------------------------------------------------------------
  const handleExportExcelSiswa = () => {
    const columns = [
      'ID Siswa',
      'NIS',
      'Nama Lengkap',
      'Kelas',
      'UID RFID',
      'Status Keaktifan',
      'Nama Orang Tua/Wali',
      'Saldo Tabungan (Rp)',
      'Saldo Deposit Kantin (Rp)'
    ];

    const dataRows = (state.students || []).map(s => [
      s.id,
      s.nis,
      s.name,
      s.class,
      s.rfidUid || '',
      s.status || 'AKTIF',
      s.guardianName || '',
      Number(s.savingsBalance) || 0,
      Number(s.canteenDepositBalance) || 0
    ]);

    exportToExcelXlsx({
      filename: `master_data_siswa_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Data Siswa',
      title: 'MASTER DATA SISWA & PEMETAAN KELAS',
      summaryRows: [
        ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
        ['Total Siswa', (state.students || []).length]
      ],
      columns,
      dataRows
    });

    setFeedback({ type: 'success', text: 'Master data siswa berhasil diunduh dalam format Microsoft Excel (.xlsx).' });
  };

  // Download Template for Excel Import/Update (Row 1 starts with Column Headers)
  const handleDownloadTemplateSiswa = () => {
    const columns = [
      'ID Siswa',
      'NIS',
      'Nama Lengkap',
      'Kelas',
      'UID RFID',
      'Status'
    ];

    // Include existing student data as template rows so admins can easily modify class names!
    const dataRows = (state.students || []).map(s => [
      s.id,
      s.nis,
      s.name,
      s.class,
      s.rfidUid || '',
      s.status || 'AKTIF'
    ]);

    exportToExcelXlsx({
      filename: `template_update_kelas_siswa_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Update Kelas Siswa',
      title: null,
      summaryRows: [],
      columns,
      dataRows
    });
  };

  // -------------------------------------------------------------
  // MASTER SISWA: IMPORT & BATCH UPDATE FROM .XLSX FILE
  // -------------------------------------------------------------
  const handleFileUploadSiswa = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target.result;
        const data = new Uint8Array(arrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];

        // 1. Get 2D array representation of worksheet
        const sheet2D = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!sheet2D || sheet2D.length === 0) {
          setFeedback({ type: 'error', text: 'File Excel kosong atau tidak dapat dibaca.' });
          return;
        }

        // 2. Find Header Row index in 2D array
        let headerRowIndex = -1;
        for (let i = 0; i < sheet2D.length; i++) {
          const rowCells = sheet2D[i];
          if (Array.isArray(rowCells) && rowCells.length > 0) {
            const rowStr = rowCells.map(c => String(c || '').toLowerCase()).join(' ');
            if (rowStr.includes('nis') || rowStr.includes('nama') || rowStr.includes('kelas') || rowStr.includes('id siswa') || rowStr.includes('rfid')) {
              headerRowIndex = i;
              break;
            }
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0; // Default to row 0 if no explicit header row detected
        }

        const headerRow = (sheet2D[headerRowIndex] || []).map(c => String(c || '').trim());

        // 3. Precise Two-Pass Column Index Matcher
        const findColIdx = (exactKeywords, fallbackKeywords = []) => {
          // Pass 1: Exact Alphanumeric Match
          for (const kw of exactKeywords) {
            const cleanKw = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
            const idx = headerRow.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanKw);
            if (idx !== -1) return idx;
          }
          // Pass 2: Substring Match
          for (const kw of fallbackKeywords) {
            const cleanKw = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
            const idx = headerRow.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanKw));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const idColIdx = findColIdx(['idsiswa', 'id_siswa', 'studentid', 'student_id', 'id']);
        const nisColIdx = findColIdx(['nis', 'nisn', 'nomorinduk', 'nonis'], ['nis', 'induk']);
        const nameColIdx = findColIdx(['namalengkap', 'namasiswa', 'nama', 'fullname', 'name'], ['nama', 'name']);
        const classColIdx = findColIdx(['kelas', 'class', 'kls'], ['kelas', 'class', 'kls']);
        const rfidColIdx = findColIdx(['uidrfid', 'rfiduid', 'rfid', 'uid'], ['rfid', 'uid']);
        const statusColIdx = findColIdx(['status'], ['status']);

        let updatedCount = 0;
        let addedCount = 0;

        const currentStudents = [...(state.students || [])];

        const cleanStr = (val) => {
          if (val === undefined || val === null) return '';
          let s = String(val).trim();
          if (s.endsWith('.0')) s = s.slice(0, -2);
          return s;
        };

        const cleanAlphaNum = (val) => cleanStr(val).toLowerCase().replace(/[^a-z0-9]/g, '');

        // 4. Process data rows starting from headerRowIndex + 1
        for (let r = headerRowIndex + 1; r < sheet2D.length; r++) {
          const row = sheet2D[r];
          if (!Array.isArray(row) || row.length === 0) continue;

          let id = idColIdx !== -1 && row[idColIdx] !== undefined ? cleanStr(row[idColIdx]) : '';
          let nis = nisColIdx !== -1 && row[nisColIdx] !== undefined ? cleanStr(row[nisColIdx]) : '';
          let name = nameColIdx !== -1 && row[nameColIdx] !== undefined ? cleanStr(row[nameColIdx]) : '';
          let cls = classColIdx !== -1 && row[classColIdx] !== undefined ? cleanStr(row[classColIdx]) : '';
          let rfid = rfidColIdx !== -1 && row[rfidColIdx] !== undefined ? cleanStr(row[rfidColIdx]).toUpperCase() : '';
          let status = statusColIdx !== -1 && row[statusColIdx] !== undefined ? cleanStr(row[statusColIdx]).toUpperCase() : 'AKTIF';

          // POSITIONAL / CELL-BY-CELL FALLBACK IF HEADER MATCHING WAS PARTIAL
          if (!id && !nis && !name) {
            // Scan all cells in the row to auto-detect roles
            row.forEach(cell => {
              const strCell = cleanStr(cell);
              if (!strCell) return;
              if (strCell.toUpperCase().startsWith('STD-')) id = strCell;
              else if (strCell.toUpperCase().startsWith('RFID-')) rfid = strCell.toUpperCase();
              else if (/^\d{5,12}$/.test(strCell) && !nis) nis = strCell; // Numeric 5-12 digits is NIS
              else if (/[a-zA-Z]/.test(strCell) && strCell.length > 2 && !name) name = strCell;
              else if ((strCell.length <= 15 || strCell.toLowerCase().includes('kelas')) && !cls) cls = strCell;
            });
          }

          if (!name && !nis && !id) continue; // Skip empty rows

          const cleanTargetId = cleanAlphaNum(id);
          const cleanTargetNis = cleanAlphaNum(nis);
          const cleanTargetName = cleanAlphaNum(name);

          // Ultra Flexible Student Matcher
          const targetIndex = currentStudents.findIndex(s => {
            if (cleanTargetId && cleanAlphaNum(s.id) === cleanTargetId) return true;
            if (cleanTargetNis && cleanAlphaNum(s.nis) === cleanTargetNis) return true;
            if (cleanTargetName && cleanAlphaNum(s.name) === cleanTargetName) return true;
            if (cleanTargetName && cleanTargetName.length > 3 && cleanAlphaNum(s.name).includes(cleanTargetName)) return true;
            return false;
          });

          if (targetIndex >= 0) {
            // SELECTIVE UPDATE: Update class, name, nis, rfid, status ONLY!
            currentStudents[targetIndex] = {
              ...currentStudents[targetIndex],
              class: cls || currentStudents[targetIndex].class,
              name: name || currentStudents[targetIndex].name,
              nis: nis || currentStudents[targetIndex].nis,
              rfidUid: rfid || currentStudents[targetIndex].rfidUid,
              status: status || currentStudents[targetIndex].status
            };
            updatedCount++;
          } else if (name && nis) {
            // Add new student if not matched
            const newId = id || `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            currentStudents.push({
              id: newId,
              nis,
              name,
              class: cls || 'Kelas Baru',
              guardianId: '',
              guardianName: '',
              savingsBalance: 0,
              canteenDepositBalance: 0,
              canteenBalanceSource: 'TABUNGAN',
              rfidUid: rfid,
              photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80',
              status: status || 'AKTIF'
            });
            addedCount++;
          }
        }

        const auditLog = {
          id: `AUD-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: currentRole?.name || 'Admin Keuangan',
          action: 'IMPORT_BATCH_DATA_SISWA',
          entity: 'students',
          entityId: 'BATCH',
          details: `Import/Update batch data siswa via Excel: ${updatedCount} siswa di-update (termasuk kelas) & ${addedCount} siswa baru. Saldo & mutasi utuh!`,
          ip: getClientIpAndDevice()
        };

        setState(prev => ({
          ...prev,
          students: currentStudents,
          auditLogs: [auditLog, ...(prev.auditLogs || [])]
        }));

        if (updatedCount > 0 || addedCount > 0) {
          setFeedback({
            type: 'success',
            text: `✅ Import Sukses! ${updatedCount} data kelas/nama siswa berhasil diperbarui & ${addedCount} siswa baru ditambahkan. Seluruh saldo tabungan & deposit tetap utuh!`
          });
        } else {
          const sampleHeaders = headerRow.join(', ');
          setFeedback({
            type: 'warning',
            text: `⚠️ Dibaca ${sheet2D.length - headerRowIndex - 1} baris dari Excel (Header: [${sampleHeaders}]). Tidak ada data NIS/Nama yang cocok dengan data siswa di sistem.`
          });
        }

      } catch (err) {
        console.error('Failed to parse Excel import file', err);
        setFeedback({ type: 'error', text: 'Gagal membaca file Excel. Pastikan format file .xlsx/.xls valid.' });
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      <div className="glass-card flex-between" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f3e8ff 100%)', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <ShieldCheck size={24} style={{ color: '#6b21a8' }} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--slate-900)' }}>Modul Admin Master Data & Registrasi RFID</h2>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--slate-600)' }}>
            Pengelolaan Master Data Siswa, Kenaikan Kelas Batch (.xlsx), Pemetaan Kartu RFID, dan Log Audit.
          </p>
        </div>

        {/* Subtab Navigation */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeSubTab === 'rfid' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('rfid')}
          >
            <CreditCard size={15} /> Pemetaan RFID ({state.rfidCards.length})
          </button>
          <button
            className={`btn ${activeSubTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('students')}
          >
            <Users size={15} /> Master Siswa ({state.students.length})
          </button>
          <button
            className={`btn ${activeSubTab === 'guardians' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('guardians')}
          >
            <Users size={15} /> Master Orang Tua ({(state.guardians || []).length})
          </button>
          <button
            className={`btn ${activeSubTab === 'audit' ? 'btn-gold' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('audit')}
          >
            <Activity size={15} /> Audit Log ({state.auditLogs.length})
          </button>
          {currentRole?.id === 'SUPER_ADMIN' && (
            <button
              className="btn"
              onClick={() => setActiveSubTab('database')}
              style={{
                background: activeSubTab === 'database' ? '#be123c' : '#fff1f2',
                color: activeSubTab === 'database' ? '#ffffff' : '#be123c',
                border: '1px solid #fecaca',
                fontWeight: 700
              }}
            >
              <ShieldCheck size={15} /> Pemeliharaan & Backup Database
            </button>
          )}
        </div>
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

      {/* Subtab 1: RFID Cards Management */}
      {activeSubTab === 'rfid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

          {/* Register Card Form */}
          <div className="glass-card" style={{ border: lastScannedUid ? '2px solid var(--accent-gold-500)' : 'var(--glass-border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} style={{ color: 'var(--primary-600)' }} />
              Registrasi Kartu RFID Baru
            </h3>

            {/* USB RFID Status Bar */}
            <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-300)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Usb size={20} style={{ color: 'var(--primary-700)' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--primary-950)' }}>
                  Perangkat USB RFID Reader Ready (13.56 MHz MF1 S50 PnP)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                  Tempelkan kartu baru di mana saja pada layar ini untuk mengisi UID otomatis!
                </div>
              </div>
            </div>

            <form onSubmit={handleAddCard}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  UID Kartu RFID (Otomatis Terisi dari USB Reader):
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={uidInputRef}
                    type="text"
                    className="form-input"
                    placeholder="Tempelkan kartu pada USB RFID Reader..."
                    value={newCardUid}
                    onChange={(e) => setNewCardUid(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newCardUid.trim()) handleAddCard();
                      }
                    }}
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      background: lastScannedUid ? '#fefce8' : 'white',
                      border: lastScannedUid ? '2px solid var(--accent-gold-500)' : '1px solid var(--slate-300)'
                    }}
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tipe Peruntukan Kartu:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${newCardType === 'SISWA' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setNewCardType('SISWA');
                      setNewCardAssignedTo(state.students[0]?.id || '');
                    }}
                  >
                    Kartu Siswa
                  </button>
                  <button
                    type="button"
                    className={`btn ${newCardType === 'PENJEMPUT' ? 'btn-gold' : 'btn-secondary'}`}
                    onClick={() => {
                      setNewCardType('PENJEMPUT');
                      setNewCardAssignedTo(state.guardians[0]?.id || '');
                    }}
                  >
                    Kartu Orang Tua / Wali
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Petakan ke Pemilik:</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${!isNewOwner ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setIsNewOwner(false)}
                  >
                    Pilih dari daftar
                  </button>
                  <button
                    type="button"
                    className={`btn ${isNewOwner ? 'btn-gold' : 'btn-secondary'}`}
                    onClick={() => setIsNewOwner(true)}
                  >
                    Buat pemilik baru
                  </button>
                </div>

                {!isNewOwner ? (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                      <input
                        ref={ownerSearchInputRef}
                        type="text"
                        className="form-input"
                        placeholder={newCardType === 'SISWA' ? "ketik nama/nis" : "ketik nama/hp"}
                        style={{ paddingLeft: '36px', paddingRight: ownerSearchQuery ? '36px' : '12px', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
                        value={ownerSearchQuery}
                        onFocus={(e) => {
                          e.target.select();
                          setIsOwnerDropdownOpen(true);
                        }}
                        onChange={(e) => {
                          setOwnerSearchQuery(e.target.value);
                          setIsOwnerDropdownOpen(true);
                        }}
                        autoFocus
                      />
                      {ownerSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setOwnerSearchQuery('');
                            setNewCardAssignedTo('');
                            setIsOwnerDropdownOpen(true);
                          }}
                          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    {/* Search Results Panel */}
                    {isOwnerDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 100,
                          marginTop: '4px',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          background: 'white',
                          border: '1px solid var(--slate-300)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                          padding: '0.35rem'
                        }}
                      >
                        {searchedOwnersList.length === 0 ? (
                          <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--slate-400)' }}>
                            Tidak ada {newCardType === 'SISWA' ? 'siswa' : 'orang tua'} ditemukan untuk kata kunci "{ownerSearchQuery}"
                          </div>
                        ) : (
                          searchedOwnersList.map(item => {
                            const isSelected = item.id === newCardAssignedTo;
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  setNewCardAssignedTo(item.id);
                                  setIsNewOwner(false); // Map to existing student (don't create new duplicate student!)
                                  if (newCardType === 'SISWA') {
                                    setOwnerSearchQuery(`${item.name} (${item.class}) - NIS: ${item.nis}`);
                                  } else {
                                    setOwnerSearchQuery(`${item.name} (${item.relationship})`);
                                  }
                                  setIsOwnerDropdownOpen(false);
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                  background: isSelected ? '#ecfdf5' : 'transparent',
                                  borderBottom: '1px solid #f1f5f9',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.5rem',
                                  transition: 'background 0.15s ease'
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                  {newCardType === 'SISWA' ? (
                                    <img src={item.photo} alt={item.name} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                                  ) : (
                                    <Users size={18} style={{ color: 'var(--primary-600)' }} />
                                  )}
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--slate-900)' }}>{item.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                                      {newCardType === 'SISWA' ? `NIS: ${item.nis} • Kelas ${item.class}` : `HP: ${item.phone} (${item.relationship})`}
                                    </div>
                                  </div>
                                </div>

                                {isSelected && (
                                  <CheckCircle2 size={16} style={{ color: 'var(--primary-600)' }} />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <input
                      ref={newOwnerNameInputRef}
                      type="text"
                      className="form-input"
                      placeholder="Nama Pemilik Baru *"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                    />
                    {newCardType === 'SISWA' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="NIS *"
                          value={newOwnerNis}
                          onChange={(e) => setNewOwnerNis(e.target.value)}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Kelas *"
                          value={newOwnerClass}
                          onChange={(e) => setNewOwnerClass(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <input
                          type="tel"
                          className="form-input"
                          placeholder="Nomor telepon *"
                          value={newOwnerPhone}
                          onChange={(e) => setNewOwnerPhone(e.target.value)}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Hubungan (Ayah/Ibu/Wali) *"
                          value={newOwnerRelationship}
                          onChange={(e) => setNewOwnerRelationship(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Terbitkan & Petakan Kartu RFID
              </button>
            </form>
          </div>

          {/* Cards List Table */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Daftar Pemetaan Kartu RFID Aktif & Blokir</h3>

            <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>UID RFID</th>
                    <th>Tipe</th>
                    <th>Pemilik</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rfidCards.map(card => (
                    <tr key={card.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800 }}>{card.uid}</td>
                      <td>
                        <span className={`badge ${card.type === 'SISWA' ? 'badge-emerald' : 'badge-blue'}`}>
                          {card.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{card.assignedToName}</td>
                      <td>
                        <span className={`badge ${card.status === 'ACTIVE' ? 'badge-emerald' : 'badge-red'}`}>
                          {card.status === 'ACTIVE' ? 'Aktif' : 'Diblokir'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button
                            className={`btn btn-sm ${card.status === 'ACTIVE' ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => toggleCardStatus(card.id)}
                            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                          >
                            {card.status === 'ACTIVE' ? <Lock size={12} /> : <Unlock size={12} />}
                            {card.status === 'ACTIVE' ? 'Blokir' : 'Buka Blokir'}
                          </button>
                          {['SUPER_ADMIN', 'ADMIN_KEUANGAN'].includes(currentRole?.id) && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => deleteCard(card)}
                              title={`Hapus UID ${card.uid}`}
                              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                            >
                              <Trash2 size={12} /> Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUBTAB 2: MASTER STUDENTS WITH FULL CRUD & EXCEL IMPORT/EXPORT */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'students' && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          
          {/* Header Action Bar */}
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} style={{ color: 'var(--primary-700)' }} />
                Master Data Siswa & Rekening Ledger
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>
                Kelola data siswa, lakukan CRUD tunggal, serta import/update batch kelas via file Excel (.xlsx).
              </p>
            </div>

            {/* Action Buttons Row */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleOpenAddStudentModal}
                style={{ fontWeight: 700 }}
              >
                <Plus size={16} /> Tambah Siswa Baru
              </button>

              <button
                className="btn btn-gold btn-sm"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{ fontWeight: 700 }}
                title="Import/Update massal data kelas siswa dari file Excel"
              >
                <Upload size={16} /> Import / Update Kelas (.xlsx)
              </button>

              <button
                className="btn btn-outline btn-sm"
                onClick={handleExportExcelSiswa}
                style={{ fontWeight: 700 }}
                title="Ekspor seluruh data siswa ke format Excel .xlsx"
              >
                <FileSpreadsheet size={16} /> Ekspor Data Siswa (.xlsx)
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadTemplateSiswa}
                title="Unduh file template Excel untuk update kelas siswa"
                style={{ fontSize: '0.75rem' }}
              >
                <Download size={14} /> Template
              </button>

              {/* Hidden File Input for Excel Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                onChange={handleFileUploadSiswa}
              />
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px', borderRadius: '10px' }}
                placeholder="Cari siswa berdasarkan nama, NIS, kelas, atau UID RFID..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} style={{ color: 'var(--slate-500)' }} />
              <select
                className="form-select"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                style={{ fontSize: '0.82rem', fontWeight: 700, borderRadius: '10px' }}
              >
                <option value="ALL">Semua Kelas ({state.students.length})</option>
                {uniqueClasses.map(cls => (
                  <option key={cls} value={cls}>Kelas {cls}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Student Table */}
          <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>NIS</th>
                  <th>JK</th>
                  <th>Kelas</th>
                  <th>Orang Tua / Wali</th>
                  <th>UID RFID</th>
                  <th style={{ textAlign: 'right' }}>Saldo Tabungan</th>
                  <th style={{ textAlign: 'right' }}>Saldo Deposit</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi CRUD</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudentsList.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                      Tidak ada data siswa ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredStudentsList.map(s => {
                    const gdrObj = (state.guardians || []).find(g => g.id === s.guardianId || g.studentId === s.id || g.name === s.guardianName);
                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <img src={s.photo} alt={s.name} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--slate-300)', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }} />
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{s.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)', fontFamily: 'monospace' }}>{s.id}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{s.nis}</td>
                        <td>
                          <span className={`badge ${s.gender === 'P' ? 'badge-purple' : 'badge-emerald'}`} style={{ fontWeight: 800 }}>
                            {s.gender === 'P' ? 'P (Perempuan)' : 'L (Laki-laki)'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-gold" style={{ fontWeight: 800 }}>{s.class}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--slate-800)', fontSize: '0.82rem' }}>{s.guardianName || gdrObj?.name || 'Belum Diisi'}</div>
                          {(s.guardianRelationship || s.guardianPhone || gdrObj) && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                              {s.guardianRelationship || gdrObj?.relationship || 'Wali'} {(s.guardianPhone || gdrObj?.phone) ? `• ${s.guardianPhone || gdrObj?.phone}` : ''}
                            </div>
                          )}
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
                        <td style={{ fontWeight: 800, color: '#047857', textAlign: 'right' }}>
                          Rp {(Number(s.savingsBalance) || 0).toLocaleString('id-ID')}
                        </td>
                        <td style={{ fontWeight: 800, color: '#b45309', textAlign: 'right' }}>
                          Rp {(Number(s.canteenDepositBalance) || 0).toLocaleString('id-ID')}
                        </td>
                      <td>
                        <span className={`badge ${s.status === 'AKTIF' ? 'badge-emerald' : 'badge-red'}`}>
                          {s.status || 'AKTIF'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEditStudentModal(s)}
                            title="Edit Data Siswa / Kelas"
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeleteStudentSingle(s.id, s.name)}
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            title="Hapus Siswa"
                          >
                            <Trash2 size={13} /> Hapus
                          </button>
                        </div>
                      </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUBTAB: MASTER DATA ORANG TUA / WALI SISWA                    */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'guardians' && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          
          {/* Header Action Bar */}
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} style={{ color: 'var(--primary-700)' }} />
                Master Data Orang Tua / Wali Siswa
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>
                Pengelolaan data orang tua/wali siswa, kontak WhatsApp, pekerjaan, alamat, serta ekspor & import Excel (.xlsx).
              </p>
            </div>

            {/* Action Buttons Row */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleOpenAddGuardianModal}
                style={{ fontWeight: 700 }}
              >
                <Plus size={16} /> Tambah Orang Tua Baru
              </button>

              <button
                className="btn btn-gold btn-sm"
                onClick={() => guardianFileInputRef.current && guardianFileInputRef.current.click()}
                style={{ fontWeight: 700 }}
                title="Import / update massal data orang tua dari file Excel (.xlsx)"
              >
                <Upload size={16} /> Import Excel (.xlsx)
              </button>

              <button
                className="btn btn-outline btn-sm"
                onClick={handleExportExcelWali}
                style={{ fontWeight: 700 }}
                title="Ekspor seluruh data orang tua ke format Excel .xlsx"
              >
                <FileSpreadsheet size={16} /> Ekspor Data (.xlsx)
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadTemplateWali}
                title="Unduh file template Excel untuk import data orang tua"
                style={{ fontSize: '0.75rem' }}
              >
                <Download size={14} /> Template
              </button>

              {/* Hidden File Input for Excel Upload */}
              <input
                ref={guardianFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                onChange={handleFileUploadWali}
              />
            </div>
          </div>

          {/* Search Toolbar */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px', borderRadius: '10px' }}
                placeholder="Cari orang tua berdasarkan nama, no. WA, pekerjaan, atau alamat..."
                value={guardianSearch}
                onChange={(e) => setGuardianSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Guardian Table */}
          <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID / Nama Orang Tua</th>
                  <th>Hubungan</th>
                  <th>No. Telepon / WA</th>
                  <th>Pekerjaan</th>
                  <th>Alamat Rumah</th>
                  <th>Anak Terhubung</th>
                  <th style={{ textAlign: 'center' }}>Aksi CRUD</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuardiansList.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                      Tidak ada data orang tua / wali ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredGuardiansList.map(g => {
                    const children = (state.students || []).filter(s => s.guardianId === g.id || s.guardianName === g.name);
                    return (
                      <tr key={g.id}>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{g.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)', fontFamily: 'monospace' }}>{g.id}</div>
                        </td>
                        <td>
                          <span className="badge badge-gold" style={{ fontWeight: 800 }}>
                            {g.relationship || 'Wali'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#047857' }}>
                          {g.phone || '-'}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--slate-700)' }}>
                          {g.occupation || '-'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--slate-600)', maxWidth: '200px' }}>
                          {g.address || '-'}
                        </td>
                        <td>
                          {children.length > 0 ? (
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: '0.82rem' }}>
                                {children.length} Siswa
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                                {children.map(c => c.name).join(', ')}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                              Belum Terhubung
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenEditGuardianModal(g)}
                              title="Edit Data Orang Tua"
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDeleteGuardianSingle(g.id, g.name)}
                              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                              title="Hapus Data Orang Tua"
                            >
                              <Trash2 size={13} /> Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Subtab 3: Audit Logs */}
      {activeSubTab === 'audit' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Jejak Audit Keamanan (Security Audit Logs)</h3>
          <div className="table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID / Waktu</th>
                  <th>Aktor</th>
                  <th>Aksi (Action)</th>
                  <th>Detail Aktivitas</th>
                  <th>IP / Device</th>
                </tr>
              </thead>
              <tbody>
                {state.auditLogs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--slate-700)' }}>{log.id}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{log.actor}</td>
                    <td>
                      <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--slate-700)' }}>{log.details}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--slate-500)' }}>{log.ip && log.ip !== '127.0.0.1' ? log.ip : getClientIpAndDevice()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 4: Pemeliharaan Database & System Safety */}
      {activeSubTab === 'database' && currentRole?.id === 'SUPER_ADMIN' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header Card */}
          <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #be123c' }}>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#be123c', marginBottom: '0.4rem' }}>
              <ShieldCheck size={22} />
              Pemeliharaan & Keamanan Database Sekolah
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--slate-600)', margin: 0 }}>
              Fitur khusus <b>Super Admin & Pengelola Sistem</b> untuk melakukan cadangan data (backup), pemulihan (restore), serta reset total seluruh data operasional sekolah.
            </p>
          </div>

          {/* Grid 2 Column: Backup & Restore vs Reset Total */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            
            {/* Panel 1: Backup & Restore (Plain & AES-256 Encrypted) */}
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--slate-800)' }}>
                  <ShieldCheck size={18} style={{ color: 'var(--primary-600)' }} />
                  1. Backup & Restore Database (Plain JSON / Encrypted AES-256)
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--slate-600)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  Unduh data tabel sekolah. Gunakan **Password Enkripsi AES-256** untuk menjamin file cadangan disandi 100% aman dan tidak dapat dibuka/dibaca tanpa kata sandi.
                </p>

                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.78rem', color: '#475569' }}>
                  <div style={{ fontWeight: 700, color: 'var(--slate-700)', marginBottom: '0.3rem' }}>📊 Ringkasan Data Saat Ini:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem' }}>
                    <div>• <b>Siswa:</b> {state.students?.length || 0} Data</div>
                    <div>• <b>Kartu RFID:</b> {state.rfidCards?.length || 0} Kartu</div>
                    <div>• <b>Mutasi Ledger:</b> {state.ledger?.length || 0} Transaksi</div>
                    <div>• <b>Audit Log:</b> {state.auditLogs?.length || 0} Log</div>
                  </div>
                </div>

                {/* Password Encryption Option Box */}
                <div style={{ background: '#eff6ff', padding: '0.85rem', borderRadius: '10px', border: '1px solid #bfdbfe', marginBottom: '1.2rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e40af', display: 'block', marginBottom: '0.35rem' }}>
                    🔒 Password Enkripsi Tambahan (Opsional):
                  </label>
                  <input
                    type="password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    placeholder="Masukkan password enkripsi..."
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #93c5fd',
                      fontSize: '0.82rem',
                      background: '#ffffff'
                    }}
                  />
                  <div style={{ fontSize: '0.7rem', color: '#1e3a8a', marginTop: '0.3rem' }}>
                    * Jika diisi, file cadangan akan disandi dengan **AES-256-GCM** (`.enc`) dan hanya bisa dipulihkan dengan password ini.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleBackupDatabase(false)}
                    className="btn btn-secondary"
                    style={{ justifyContent: 'center', padding: '0.65rem', fontSize: '0.78rem', fontWeight: 700 }}
                    disabled={isProcessingAction}
                  >
                    <Download size={15} /> Unduh (.json)
                  </button>
                  <button
                    onClick={() => handleBackupDatabase(true)}
                    className="btn btn-primary"
                    style={{ justifyContent: 'center', padding: '0.65rem', fontSize: '0.78rem', fontWeight: 700 }}
                    disabled={isProcessingAction || !backupPassword.trim()}
                  >
                    <Lock size={15} /> Backup Terenkripsi (.enc)
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="file"
                    ref={restoreFileInputRef}
                    accept=".json,.enc"
                    onChange={handleRestoreFileChange}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => restoreFileInputRef.current?.click()}
                    className="btn btn-gold"
                    style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700 }}
                    disabled={isProcessingAction}
                  >
                    <Upload size={18} /> {isProcessingAction ? 'Memulihkan...' : 'Restore Database (.json / .enc)'}
                  </button>
                </div>
              </div>
            </div>

            {/* Panel 2: Reset Total Operasional */}
            <div className="glass-card" style={{ padding: '1.5rem', background: '#fff5f5', border: '1.5px solid #fecaca', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Trash2 size={18} style={{ color: '#dc2626' }} />
                  2. Reset Total Data Operasional
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#7f1d1d', marginBottom: '1rem', lineHeight: 1.5 }}>
                  Fitur ini akan membersihkan <b>seluruh data operasional sekolah</b> (Siswa, Kartu RFID, Mutasi Tabungan & Log Audit).
                </p>

                <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '10px', border: '1px solid #fca5a5', marginBottom: '1.2rem', fontSize: '0.78rem', color: '#991b1b', lineHeight: 1.4 }}>
                  <b>🛡️ Keamanan Akun Terjamin:</b>
                  <div style={{ marginTop: '0.35rem' }}>
                    Data <b>Akun Login (Role Management) TIDAK AKAN DIHAPUS</b>. Anda tetap dapat login dengan username & password Super Admin, Admin Keuangan, dan Kasir Kantin yang ada saat ini.
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsResetModalOpen(true);
                  setResetConfirmText('');
                }}
                className="btn"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '0.75rem',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 800,
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
                disabled={isProcessingAction}
              >
                <Trash2 size={18} /> Reset Seluruh Data Operasional
              </button>
            </div>

            {/* Panel 3: Force Sync Akun Penjemputan ke Supabase */}
            <div className="glass-card" style={{ padding: '1.5rem', background: '#f0fdf4', border: '1.5px solid #bbf7d0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#166534', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={18} style={{ color: '#16a34a' }} />
                  3. Sinkronkan Akun Penjemputan ke Supabase
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#15803d', marginBottom: '1rem', lineHeight: 1.5 }}>
                  Tulis ulang & paksa kirim baris akun <b>`penjemputan` (`penjemputan123`)</b> langsung ke dalam tabel <b>`login_accounts`</b> pada database Supabase Cloud.
                </p>

                <div style={{ background: '#dcfce7', padding: '0.85rem', borderRadius: '10px', border: '1px solid #86efac', marginBottom: '1.2rem', fontSize: '0.78rem', color: '#14532d' }}>
                  <b>⚡ Tindakan Langsung (Direct Write):</b>
                  <div style={{ marginTop: '0.3rem', fontFamily: 'monospace', fontWeight: 700 }}>
                    id: ACC-ADMIN-004<br />
                    username: penjemputan<br />
                    password: penjemputan123<br />
                    role_id: ADMIN_PENJEMPUTAN
                  </div>
                </div>
              </div>

              <button
                onClick={handleForceSyncSupabaseAccounts}
                className="btn btn-emerald"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '0.75rem',
                  fontWeight: 800
                }}
                disabled={isProcessingAction}
              >
                <Zap size={18} /> {isProcessingAction ? 'Mengirim ke Supabase...' : '⚡ Paksa Tulis Akun Penjemputan ke Supabase'}
              </button>
            </div>

          </div>

        </div>
      )}

      {/* Modal Dialog Konfirmasi Reset Database */}
      {isResetModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            border: '2px solid #ef4444'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#dc2626' }}>
              <AlertCircle size={28} />
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Konfirmasi Reset Total Database</h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, marginBottom: '1rem' }}>
              Tindakan ini akan <b>MENGHAPUS PERMANEN</b> seluruh data Siswa, Kartu RFID, Mutasi Ledger Tabungan, dan Log Audit dari Supabase Cloud & Browser.
              <br /><br />
              <b>Data akun login (Role Management) tidak akan dihapus.</b>
            </p>

            <div style={{ background: '#fef2f2', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '1.2rem', fontSize: '0.8rem', color: '#991b1b' }}>
              Untuk mengonfirmasi, ketik kalimat di bawah ini:
              <div style={{ fontWeight: 800, marginTop: '0.3rem', fontFamily: 'monospace', fontSize: '0.9rem', color: '#b91c1c' }}>
                RESET DATA SEKOLAH
              </div>
            </div>

            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="Ketik: RESET DATA SEKOLAH"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.9rem',
                marginBottom: '1.2rem',
                fontFamily: 'monospace'
              }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isProcessingAction}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleExecuteResetOperational}
                disabled={isProcessingAction || resetConfirmText.trim() !== 'RESET DATA SEKOLAH'}
                style={{
                  background: resetConfirmText.trim() === 'RESET DATA SEKOLAH' ? '#dc2626' : '#f87171',
                  color: '#ffffff',
                  fontWeight: 800,
                  border: 'none',
                  cursor: resetConfirmText.trim() === 'RESET DATA SEKOLAH' ? 'pointer' : 'not-allowed'
                }}
              >
                {isProcessingAction ? 'Memproses Reset...' : 'Ya, Hapus & Reset Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Dekripsi File Backup Terenkripsi */}
      {isDecryptModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '440px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            border: '2px solid #3b82f6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#1d4ed8' }}>
              <Lock size={28} />
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>File Backup Terenkripsi AES-256</h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, marginBottom: '1rem' }}>
              File backup ini dilindungi dengan **Sandi Enkripsi AES-256**. Masukkan password yang digunakan saat mengunduh file ini untuk melanjutkan restore.
            </p>

            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e3a8a' }}>
                Password Dekripsi File:
              </label>
              <input
                type="password"
                value={restorePasswordInput}
                onChange={(e) => setRestorePasswordInput(e.target.value)}
                placeholder="Masukkan password dekripsi..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1.5px solid #93c5fd',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsDecryptModalOpen(false);
                  setRestorePasswordInput('');
                  setRawRestoreFileStr('');
                }}
                disabled={isProcessingAction}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteDecryptAndRestore}
                disabled={isProcessingAction || !restorePasswordInput.trim()}
                style={{ fontWeight: 700 }}
              >
                {isProcessingAction ? 'Mendekripsi...' : 'Dekripsi & Restore Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM FOR SINGLE STUDENT ADD / EDIT */}
      {studentModalType && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '540px', width: '100%', padding: '1.75rem', background: 'white', border: '1px solid var(--slate-200)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {studentModalType === 'ADD' ? 'Tambah Siswa Baru' : 'Edit Data Siswa & Kelas'}
              </h3>
              <button onClick={() => setStudentModalType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStudentSubmit} style={{ display: 'grid', gap: '1rem' }}>
              
              {/* UPLOAD FOTO PROFIL SISWA */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1px solid var(--slate-200)' }}>
                <div style={{ position: 'relative' }}>
                  <img
                    src={studentForm.photo}
                    alt="Preview Foto Siswa"
                    style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #ffffff', boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}
                  />
                  <label
                    htmlFor="student-photo-file-input"
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '0',
                      background: '#3b82f6',
                      color: '#ffffff',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                    }}
                    title="Upload Foto Profil Siswa"
                  >
                    <Camera size={15} />
                  </label>
                  <input
                    id="student-photo-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    style={{ display: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <label htmlFor="student-photo-file-input" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', fontSize: '0.78rem' }}>
                    <Upload size={13} /> Upload Foto Profil
                  </label>
                  {studentForm.photo && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setStudentForm({ ...studentForm, photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80' })}
                      style={{ fontSize: '0.78rem', color: '#64748b' }}
                    >
                      Reset Default
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nama siswa..."
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
                    placeholder="Contoh: 6-A Tahfidz"
                    value={studentForm.class}
                    onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* JENIS KELAMIN & STATUS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Jenis Kelamin *</label>
                  <select
                    className="form-select"
                    value={studentForm.gender || 'L'}
                    onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                    required
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Status Siswa</label>
                  <select
                    className="form-select"
                    value={studentForm.status}
                    onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value })}
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="NON-AKTIF">NON-AKTIF / ALUMNI</option>
                  </select>
                </div>
              </div>

              {/* AKUN LOGIN SISWA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--slate-200)' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Username Login Siswa</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Username..."
                    value={studentForm.username || ''}
                    onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Password Login Siswa</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Password..."
                    value={studentForm.password || ''}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">UID Kartu RFID (Opsional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tempelkan/ketik UID RFID kartu..."
                  value={studentForm.rfidUid}
                  onChange={(e) => setStudentForm({ ...studentForm, rfidUid: e.target.value.toUpperCase() })}
                  style={{ fontFamily: 'monospace', fontWeight: 700 }}
                />
              </div>

              {/* DATA ORANG TUA / WALI LENGKAP */}
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--slate-200)', display: 'grid', gap: '0.75rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={15} style={{ color: '#f59e0b' }} />
                  <span>Data Orang Tua / Wali Siswa</span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Nama Orang Tua / Wali</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nama lengkap Ayah/Ibu/Wali..."
                    value={
                      (studentForm.guardianName && (
                        studentForm.guardianName.toLowerCase().includes('orang tua') ||
                        studentForm.guardianName.toLowerCase().includes('wali') ||
                        studentForm.guardianName.trim() === 'Orang Tua / Wali'
                      ))
                        ? ''
                        : (studentForm.guardianName || '')
                    }
                    onChange={(e) => {
                      let text = e.target.value;
                      if (text.toLowerCase().includes('orang tua') || text.toLowerCase().includes('wali')) {
                        text = text.replace(/orang\s*tua\s*\/?\s*wali/gi, '').replace(/orang\s*tua/gi, '').replace(/wali/gi, '').trim();
                      }
                      setStudentForm(prev => ({ ...prev, guardianName: text }));
                    }}
                    onFocus={(e) => {
                      const cur = e.target.value || studentForm.guardianName || '';
                      if (cur.toLowerCase().includes('orang tua') || cur.toLowerCase().includes('wali') || cur.trim() === 'Orang Tua / Wali') {
                        setStudentForm(prev => ({ ...prev, guardianName: '' }));
                      } else {
                        e.target.select();
                      }
                    }}
                    onClick={(e) => {
                      const cur = e.target.value || studentForm.guardianName || '';
                      if (cur.toLowerCase().includes('orang tua') || cur.toLowerCase().includes('wali') || cur.trim() === 'Orang Tua / Wali') {
                        setStudentForm(prev => ({ ...prev, guardianName: '' }));
                      }
                    }}
                    onMouseDown={(e) => {
                      const cur = e.target.value || studentForm.guardianName || '';
                      if (cur.toLowerCase().includes('orang tua') || cur.toLowerCase().includes('wali') || cur.trim() === 'Orang Tua / Wali') {
                        setStudentForm(prev => ({ ...prev, guardianName: '' }));
                      }
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Hubungan / Relasi</label>
                    <select
                      className="form-select"
                      value={studentForm.guardianRelationship || 'Ayah'}
                      onChange={(e) => setStudentForm({ ...studentForm, guardianRelationship: e.target.value })}
                    >
                      <option value="Ayah">Ayah</option>
                      <option value="Ibu">Ibu</option>
                      <option value="Wali">Wali</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>No. HP / WA Wali</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="0812xxxxxxx"
                      value={studentForm.guardianPhone}
                      onChange={(e) => setStudentForm({ ...studentForm, guardianPhone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>
                  Simpan Data Siswa
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setStudentModalType(null)}>
                  Batal
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT DATA ORANG TUA / WALI */}
      {showGuardianModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', padding: '1.75rem', background: '#ffffff', borderRadius: '20px', border: '1px solid var(--slate-200)', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Users size={20} style={{ color: 'var(--primary-600)' }} />
                {editingGuardian ? 'Edit Data Orang Tua / Wali' : 'Tambah Orang Tua / Wali Baru'}
              </h3>
              <button onClick={() => setShowGuardianModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveGuardian} style={{ display: 'grid', gap: '1rem' }}>
              
              <div className="form-group">
                <label className="form-label">Nama Lengkap Orang Tua / Wali *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Contoh: Bpk. Rahmat Hidayat"
                  value={guardianFormName}
                  onChange={(e) => setGuardianFormName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hubungan dengan Siswa</label>
                <select
                  className="form-select"
                  value={guardianFormRelationship}
                  onChange={(e) => setGuardianFormRelationship(e.target.value)}
                >
                  <option value="Ayah Kandung">Ayah Kandung</option>
                  <option value="Ibu Kandung">Ibu Kandung</option>
                  <option value="Wali Siswa">Wali Siswa</option>
                  <option value="Kakek / Nenek">Kakek / Nenek</option>
                  <option value="Paman / Bibi">Paman / Bibi</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">No. Telepon / WhatsApp (No. WA)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: 081298765432"
                  value={guardianFormPhone}
                  onChange={(e) => setGuardianFormPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pekerjaan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Wiraswasta, PNS, Dokter, Karyawan"
                  value={guardianFormOccupation}
                  onChange={(e) => setGuardianFormOccupation(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Alamat Rumah</label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="Contoh: Jl. Mawar No. 12 RT 01/RW 05"
                  value={guardianFormAddress}
                  onChange={(e) => setGuardianFormAddress(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowGuardianModal(false)}
                  style={{ flex: 1, fontWeight: 700 }}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, fontWeight: 800 }}
                >
                  {editingGuardian ? 'Simpan Perubahan' : 'Tambah Orang Tua'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
