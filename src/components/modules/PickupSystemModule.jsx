import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Tv, 
  Radio, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  Search, 
  Filter, 
  Sliders, 
  Play, 
  Square, 
  ShieldCheck, 
  User, 
  Users, 
  Bell, 
  Maximize2, 
  Sparkles,
  Award,
  AlertCircle
} from 'lucide-react';
import { audioPickupService } from '../../services/audioPickupService';
import { verifyRfidCard, playRfidBeep } from '../../services/rfidService';

export default function PickupSystemModule({ state, setState, onOpenRfidModal }) {
  const [viewMode, setViewMode] = useState('OPERATOR'); // 'OPERATOR' or 'DISPLAY_TV'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Audio Settings Modal & State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [rate, setRate] = useState(0.92);
  const [pitch, setPitch] = useState(1.0);
  const [enableChime, setEnableChime] = useState(true);

  // Auto Refresh Clock for Display Mode
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync audio settings with service
  useEffect(() => {
    audioPickupService.updateSettings({
      volume: Number(volume),
      rate: Number(rate),
      pitch: Number(pitch),
      enableChime
    });
  }, [volume, rate, pitch, enableChime]);

  const uniqueClasses = Array.from(new Set(state.students.map(s => s.class))).filter(Boolean).sort();
  const pickupLogs = state.pickupLogs || [];

  // Filter pickup logs for operator table and TV screen
  const filteredLogs = pickupLogs.filter(item => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || 
      (item.studentName && item.studentName.toLowerCase().includes(q)) ||
      (item.guardianName && item.guardianName.toLowerCase().includes(q)) ||
      (item.className && item.className.toLowerCase().includes(q)) ||
      (item.rfidUid && item.rfidUid.toLowerCase().includes(q));
    
    const matchesClass = selectedClass === 'ALL' || item.className === selectedClass;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchesSearch && matchesClass && matchesStatus;
  });

  // Handle Manual/Simulated Tap Card at Security Gate
  const handleSimulateGateTap = (uid) => {
    const res = verifyRfidCard(uid, state.rfidCards, state.students, state.guardians);
    if (!res.success) {
      alert(`Gagal Tap: ${res.message}`);
      return;
    }

    const gObj = res.guardian || state.guardians.find(g => g.id === res.student?.guardianId);
    const childrenList = res.students || (res.student ? [res.student] : []);

    if (childrenList.length === 0) {
      alert('Kartu terverifikasi namun data siswa tidak ditemukan.');
      return;
    }

    const timestamp = new Date().toISOString();
    const newLogs = [];

    childrenList.forEach((st, idx) => {
      newLogs.push({
        id: `PICKUP-${Date.now()}-${idx}`,
        studentId: st.id,
        studentName: st.name,
        studentPhoto: st.photo,
        className: st.class,
        nis: st.nis,
        guardianId: gObj?.id || '',
        guardianName: gObj?.name || st.guardianName || 'Orang Tua / Wali',
        guardianPhone: gObj?.phone || '',
        guardianRelationship: gObj?.relationship || 'Ayah/Ibu',
        rfidUid: uid,
        timestamp,
        status: 'DIPANGGIL', // 'DIPANGGIL' or 'SUDAH_DIJEMPUT'
        calledCount: 1
      });
    });

    // Enqueue Voice Announcement
    audioPickupService.enqueueAnnouncement({
      student: childrenList[0],
      children: childrenList,
      guardian: gObj,
      isRepeat: false
    });

    // Add to global state pickupLogs
    setState(prev => ({
      ...prev,
      pickupLogs: [...newLogs, ...(prev.pickupLogs || [])]
    }));
  };

  // Re-announce Voice Call for a Pickup Item
  const handleRepeatCall = (item) => {
    const st = state.students.find(s => s.id === item.studentId) || {
      id: item.studentId,
      name: item.studentName,
      class: item.className
    };

    const gObj = state.guardians.find(g => g.id === item.guardianId) || {
      id: item.guardianId,
      name: item.guardianName,
      relationship: item.guardianRelationship
    };

    // Find siblings called at the same timestamp
    const siblings = (state.pickupLogs || []).filter(p => p.rfidUid === item.rfidUid && p.timestamp === item.timestamp)
      .map(p => state.students.find(s => s.id === p.studentId) || { id: p.studentId, name: p.studentName, class: p.className });

    audioPickupService.enqueueAnnouncement({
      student: st,
      children: siblings.length > 0 ? siblings : [st],
      guardian: gObj,
      isRepeat: true
    });

    // Update called count in logs
    setState(prev => ({
      ...prev,
      pickupLogs: (prev.pickupLogs || []).map(p => {
        if (p.id === item.id) {
          return { ...p, calledCount: (p.calledCount || 1) + 1 };
        }
        return p;
      })
    }));
  };

  // Mark Student as Completed Pickup (Pulang)
  const handleCompletePickup = (logId) => {
    setState(prev => ({
      ...prev,
      pickupLogs: (prev.pickupLogs || []).map(p => {
        if (p.id === logId) {
          return { ...p, status: 'SUDAH_DIJEMPUT', completedAt: new Date().toISOString() };
        }
        return p;
      })
    }));
  };

  // Test Chime Sound
  const handleTestChime = () => {
    audioPickupService.playChimeDingDong();
  };

  // Test Full Voice Call
  const handleTestVoiceCall = () => {
    audioPickupService.enqueueAnnouncement({
      student: { name: 'Muhammad Rayhan Subagyo', class: '2-A Tahfidz' },
      guardian: { name: 'Bapak Ahmad Subagyo' },
      isRepeat: false
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header Toolbar & Mode Switcher */}
      <div
        className="glass-card"
        style={{
          padding: '1.1rem 1.5rem',
          borderRadius: '16px',
          background: viewMode === 'DISPLAY_TV' ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : '#ffffff',
          color: viewMode === 'DISPLAY_TV' ? '#ffffff' : 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '0.65rem',
            borderRadius: '14px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}>
            <Volume2 size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Sistem Penjemputan Audio MP3 & Voice Call
            </h2>
            <p style={{ fontSize: '0.78rem', color: viewMode === 'DISPLAY_TV' ? '#94a3b8' : 'var(--slate-500)', margin: 0, marginTop: '2px' }}>
              Pemanggilan suara otomatis Bahasa Indonesia dengan bel chime ding-dong & antrean teratur
            </p>
          </div>
        </div>

        {/* View Mode Buttons */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          <button
            className={`btn ${viewMode === 'OPERATOR' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('OPERATOR')}
            style={{ fontWeight: 800, fontSize: '0.84rem' }}
          >
            <ShieldCheck size={16} /> Mode Operator Pos Satpam
          </button>

          <button
            className={`btn ${viewMode === 'DISPLAY_TV' ? 'btn-gold' : 'btn-secondary'}`}
            onClick={() => setViewMode('DISPLAY_TV')}
            style={{ fontWeight: 800, fontSize: '0.84rem' }}
          >
            <Tv size={16} /> Mode TV Display Ruang Tunggu
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setShowSettingsModal(true)}
            title="Pengaturan Suara Audio & Volume"
          >
            <Sliders size={16} /> Setting Suara
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleTestVoiceCall}
            title="Uji Coba Suara Panggilan"
            style={{ color: '#0284c7' }}
          >
            <Volume2 size={16} /> Uji Suara
          </button>
        </div>
      </div>

      {/* MODE 1: OPERATOR POS SATPAM */}
      {viewMode === 'OPERATOR' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '1.25rem', alignItems: 'start' }}>
          
          {/* Left Column: Quick RFID Scan Gate & Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Gate Scanner Simulator Box */}
            <div className="glass-card" style={{ background: '#f0fdf4', border: '1.5px solid #a7f3d0' }}>
              <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#065f46', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Radio size={20} className="pulse-rfid" style={{ color: '#059669' }} />
                <span>Simulasi Tap Gerbang Penjemputan</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#047857', marginBottom: '0.85rem' }}>
                Tempelkan Kartu RFID Penjemput pada USB Reader atau klik tombol di bawah untuk menyuarakan panggilan otomatis.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {state.rfidCards.filter(c => c.type === 'PENJEMPUT').map(card => {
                  const g = state.guardians.find(g => g.id === card.assignedToId || g.rfidCardUid?.toUpperCase() === card.uid.toUpperCase());
                  const label = g?.name || card.assignedToName || 'Orang Tua / Penjemput';
                  return (
                    <button
                      key={card.id}
                      className="btn btn-gold btn-sm"
                      onClick={() => handleSimulateGateTap(card.uid)}
                      style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 800 }}
                    >
                      ⚡ Tap {label} (UID: {card.uid})
                    </button>
                  );
                })}

                <button
                  className="btn btn-primary btn-sm"
                  onClick={onOpenRfidModal}
                  style={{ marginTop: '0.35rem', fontWeight: 700 }}
                >
                  <Radio size={14} /> Scanner RFID Universal
                </button>
              </div>
            </div>

            {/* Stats Summary Box */}
            <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div style={{ background: '#fffbeb', padding: '0.85rem', borderRadius: '12px', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309' }}>Siswa Dipanggil</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#92400e' }}>
                  {pickupLogs.filter(p => p.status === 'DIPANGGIL').length}
                </div>
              </div>

              <div style={{ background: '#ecfdf5', padding: '0.85rem', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857' }}>Selesai Dijemput</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#065f46' }}>
                  {pickupLogs.filter(p => p.status === 'SUDAH_DIJEMPUT').length}
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Live Pickup Logs & Queue Management Table */}
          <div className="glass-card">
            
            <div className="flex-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                  Antrean Panggilan Penjemputan Siswa
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', margin: 0, marginTop: '2px' }}>
                  Daftar siswa yang dipanggil secara otomatis melalui pengeras suara audio MP3
                </p>
              </div>

              {/* Status Filter Buttons */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStatusFilter('ALL')}
                >
                  Semua ({pickupLogs.length})
                </button>
                <button
                  className={`btn btn-sm ${statusFilter === 'DIPANGGIL' ? 'btn-gold' : 'btn-secondary'}`}
                  onClick={() => setStatusFilter('DIPANGGIL')}
                >
                  Sedang Dipanggil ({pickupLogs.filter(p => p.status === 'DIPANGGIL').length})
                </button>
                <button
                  className={`btn btn-sm ${statusFilter === 'SUDAH_DIJEMPUT' ? 'btn-emerald' : 'btn-secondary'}`}
                  onClick={() => setStatusFilter('SUDAH_DIJEMPUT')}
                >
                  Selesai ({pickupLogs.filter(p => p.status === 'SUDAH_DIJEMPUT').length})
                </button>
              </div>
            </div>

            {/* Search & Class Filter */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Cari nama siswa, kelas, penjemput, atau UID..."
                  style={{ paddingLeft: '36px', borderRadius: '10px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="form-select"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{ fontSize: '0.82rem', fontWeight: 700, borderRadius: '10px' }}
              >
                <option value="ALL">Semua Kelas</option>
                {uniqueClasses.map(cls => (
                  <option key={cls} value={cls}>Kelas {cls}</option>
                ))}
              </select>
            </div>

            {/* Table of Pickup Logs */}
            <div className="table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Siswa & Kelas</th>
                    <th>Penjemput</th>
                    <th>Waktu Tap</th>
                    <th>Status Audio</th>
                    <th style={{ textAlign: 'center' }}>Aksi Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--slate-400)' }}>
                        <Volume2 size={36} style={{ color: 'var(--slate-300)', marginBottom: '0.5rem' }} />
                        <div>Belum ada aktivitas penjemputan siswa.</div>
                        <div style={{ fontSize: '0.78rem', marginTop: '0.2rem' }}>Tempelkan Kartu Penjemput RFID untuk melakukan panggilan suara otomatis.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(item => (
                      <tr key={item.id} style={{ background: item.status === 'DIPANGGIL' ? '#fefce8' : undefined }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <img src={item.studentPhoto} alt={item.studentName} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--slate-300)' }} />
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{item.studentName}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="badge badge-emerald" style={{ padding: '1px 6px', fontSize: '0.68rem' }}>{item.className}</span>
                                <span>NIS: {item.nis}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--slate-800)', fontSize: '0.84rem' }}>{item.guardianName}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                            {item.guardianRelationship || 'Penjemput'} {item.guardianPhone ? `• ${item.guardianPhone}` : ''}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate-700)' }}>
                            {new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)', fontFamily: 'monospace' }}>
                            {item.rfidUid}
                          </div>
                        </td>
                        <td>
                          {item.status === 'DIPANGGIL' ? (
                            <span className="badge badge-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 800 }}>
                              <Volume2 size={12} className="pulse-rfid" /> Dipanggil ({item.calledCount || 1}x)
                            </span>
                          ) : (
                            <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 800 }}>
                              <CheckCircle2 size={12} /> Pulang / Selesai
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            {item.status === 'DIPANGGIL' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleRepeatCall(item)}
                                  title="Panggil ulang nama siswa lewat suara audio"
                                  style={{ color: '#d97706', borderColor: '#fde68a' }}
                                >
                                  <RotateCcw size={13} /> Panggil Ulang
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-emerald btn-sm"
                                  onClick={() => handleCompletePickup(item.id)}
                                  title="Tandai siswa telah dijemput / pulang"
                                >
                                  <CheckCircle2 size={13} /> Selesai Pulang
                                </button>
                              </>
                            )}
                            {item.status === 'SUDAH_DIJEMPUT' && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                                Selesai {new Date(item.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* MODE 2: DISPLAY LIVE TV MONITOR RUANG TUNGGU SISWA */}
      {viewMode === 'DISPLAY_TV' && (
        <div style={{
          background: 'linear-gradient(135deg, #0b1329 0%, #111827 60%, #1f2937 100%)',
          borderRadius: '24px',
          padding: '2rem',
          color: '#ffffff',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          minHeight: '680px',
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between',
          gap: '1.75rem'
        }}>
          {/* Top Banner Live TV Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid rgba(255,255,255,0.12)', paddingBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                padding: '0.75rem 1rem',
                borderRadius: '16px',
                color: '#ffffff',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)'
              }}>
                <Tv size={32} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #fef08a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  MONITOR LIVE PENJEMPUTAN SISWA
                </h1>
                <p style={{ fontSize: '0.92rem', color: '#94a3b8', margin: 0, marginTop: '2px' }}>
                  Layar Panggilan Suara & Status Penjemputan Real-Time
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.6rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.15)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Waktu Real-Time</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'monospace', color: '#38bdf8' }}>
                  {currentTime.toLocaleTimeString('id-ID')}
                </div>
              </div>
            </div>
          </div>

          {/* Active Live Pickup Cards Grid */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fef08a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} style={{ color: '#f59e0b' }} />
              <span>SISWA DENGAN PENJEMPUT DI GERBANG ({pickupLogs.filter(p => p.status === 'DIPANGGIL').length} SISWA):</span>
            </div>

            {pickupLogs.filter(p => p.status === 'DIPANGGIL').length === 0 ? (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '20px',
                padding: '4rem 2rem',
                textAlign: 'center',
                border: '1.5px dashed rgba(255,255,255,0.15)'
              }}>
                <CheckCircle2 size={56} style={{ color: '#10b981', marginBottom: '1rem', opacity: 0.8 }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>Semua Antrean Penjemputan Selesai</h2>
                <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                  Tidak ada siswa yang sedang dalam status dipanggil. Saat kartu di-tap, nama siswa akan tampil otomatis di layar ini.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                {pickupLogs.filter(p => p.status === 'DIPANGGIL').map(item => (
                  <div
                    key={item.id}
                    style={{
                      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                      border: '2px solid #f59e0b',
                      boxShadow: '0 10px 30px rgba(245, 158, 11, 0.25)',
                      borderRadius: '20px',
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.1rem',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Glowing Live Call Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '12px',
                      background: '#d97706',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Volume2 size={12} className="pulse-rfid" /> DIPANGGIL
                    </div>

                    <img
                      src={item.studentPhoto}
                      alt={item.studentName}
                      style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid #f59e0b',
                        boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
                      }}
                    />

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em', marginBottom: '0.2rem' }}>
                        {item.studentName}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <span className="badge badge-emerald" style={{ fontSize: '0.78rem', fontWeight: 800, padding: '2px 8px' }}>
                          Kelas {item.className}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                          NIS: {item.nis}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <User size={14} style={{ color: '#f59e0b' }} />
                        Penjemput: <b style={{ color: '#ffffff' }}>{item.guardianName}</b>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Running Footer Bar */}
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.85rem 1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.84rem', color: '#cbd5e1' }}>
              <Volume2 size={18} style={{ color: '#38bdf8' }} />
              <span>Sistem Panggilan Audio Otomatis Aktif • Harap siswa yang dipanggil segera bersiap menuju pintu gerbang utama.</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              C-Mart RFID Smart School System &copy; 2026
            </div>
          </div>

        </div>
      )}

      {/* MODAL SETTING AUDIO VOICE SYNTHESIS */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '1.75rem', background: '#ffffff', borderRadius: '20px', border: '1px solid var(--slate-200)', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Sliders size={20} style={{ color: 'var(--primary-600)' }} />
                Pengaturan Suara Panggilan Audio MP3
              </h3>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)' }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              
              {/* Enable Bell Chime Toggle */}
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--slate-800)' }}>Bel Chime Ding-Dong MP3</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Bunyi nada bel sekolah/bandara sebelum panggilan suara</div>
                </div>
                <input
                  type="checkbox"
                  checked={enableChime}
                  onChange={(e) => setEnableChime(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
              </div>

              {/* Volume Slider */}
              <div className="form-group">
                <div className="flex-between" style={{ marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Volume Suara</label>
                  <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--primary-700)' }}>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Speed / Rate Slider */}
              <div className="form-group">
                <div className="flex-between" style={{ marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Kecepatan Bicara (*Speech Rate*)</label>
                  <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--primary-700)' }}>{rate}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.3"
                  step="0.05"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Pitch Slider */}
              <div className="form-group">
                <div className="flex-between" style={{ marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Tinggi Nada (*Pitch*)</label>
                  <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--primary-700)' }}>{pitch}</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.3"
                  step="0.05"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleTestChime}
                  style={{ flex: 1, fontWeight: 700 }}
                >
                  <Bell size={15} /> Tes Bel Chime
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleTestVoiceCall}
                  style={{ flex: 1, fontWeight: 700 }}
                >
                  <Volume2 size={15} /> Tes Panggilan Suara
                </button>
              </div>

              <button
                type="button"
                className="btn btn-gold"
                onClick={() => setShowSettingsModal(false)}
                style={{ width: '100%', fontWeight: 800, marginTop: '0.25rem' }}
              >
                Simpan & Tutup
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
