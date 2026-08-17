// RFID Service for audio feedback, card verification & debounce protection

// Audio Synthesizer Beep Feedback (Web Audio API)
export const playRfidBeep = (type = 'success') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.warn('Audio feedback failed or muted by browser', e);
  }
};

// Debounce / Idempotency protection map (UID -> timestamp)
const recentTaps = new Map();

export const checkIdempotency = (uid, cooldownMs = 3000) => {
  const now = Date.now();
  const lastTap = recentTaps.get(uid);
  if (lastTap && (now - lastTap < cooldownMs)) {
    const remainingSec = Math.ceil((cooldownMs - (now - lastTap)) / 1000);
    return {
      allowed: false,
      reason: `Kartu baru saja di-tap! Silakan tunggu ${remainingSec} detik untuk mencegah double-charge.`
    };
  }
  recentTaps.set(uid, now);
  return { allowed: true };
};

export const verifyRfidCard = (uid, cards, students, guardians) => {
  const cleanUid = uid.trim().toUpperCase();
  const card = cards.find(c => c.uid.toUpperCase() === cleanUid);

  if (!card) {
    playRfidBeep('error');
    return {
      success: false,
      isUnregistered: true,
      uid: cleanUid,
      message: `Kartu RFID '${cleanUid}' belum terdaftar dalam sistem sekolah!`
    };
  }

  if (card.status !== 'ACTIVE') {
    playRfidBeep('error');
    return {
      success: false,
      message: `Kartu RFID '${cleanUid}' dalam status DIBLOKIR/TIDAK AKTIF!`
    };
  }

  playRfidBeep('success');

  if (card.type === 'SISWA') {
    const student = (students || []).find(s => 
      (s.id && s.id === card.assignedToId) || 
      (s.rfidUid && s.rfidUid.toUpperCase() === cleanUid) ||
      (card.assignedToName && s.name && s.name.trim().toLowerCase() === card.assignedToName.trim().toLowerCase())
    );

    if (!student) {
      playRfidBeep('error');
      return {
        success: false,
        message: `Kartu Siswa '${cleanUid}' terdaftar tetapi data siswa pemilik tidak ditemukan.`
      };
    }

    return {
      success: true,
      cardType: 'SISWA',
      student,
      card
    };
  } else if (card.type === 'PENJEMPUT') {
    let guardian = (guardians || []).find(g =>
      (g.id && g.id === card.assignedToId) ||
      (g.rfidCardUid && g.rfidCardUid.toUpperCase() === cleanUid) ||
      (card.assignedToName && g.name && g.name.trim().toLowerCase() === card.assignedToName.trim().toLowerCase())
    );

    const studentDirect = (students || []).find(s => s.id === card.assignedToId || (s.rfidUid && s.rfidUid.toUpperCase() === cleanUid));
    if (!guardian && studentDirect) {
      guardian = (guardians || []).find(g => 
        (g.id && g.id === studentDirect.guardianId) || 
        (g.name && studentDirect.guardianName && g.name.trim().toLowerCase() === studentDirect.guardianName.trim().toLowerCase())
      );
    }

    const childrenList = (students || []).filter(s => {
      if (guardian && guardian.id && s.guardianId === guardian.id) return true;
      if (guardian && guardian.studentId && s.id === guardian.studentId) return true;
      if (guardian && guardian.name && s.guardianName && s.guardianName.trim().toLowerCase() === guardian.name.trim().toLowerCase()) return true;
      if (card.assignedToId && (s.id === card.assignedToId || s.guardianId === card.assignedToId)) return true;
      if (card.assignedToName && s.guardianName && s.guardianName.trim().toLowerCase() === card.assignedToName.trim().toLowerCase()) return true;
      return false;
    });

    if (childrenList.length === 0) {
      playRfidBeep('error');
      return {
        success: false,
        message: `Kartu Penjemput '${cleanUid}' terdaftar, tetapi belum ada data siswa yang terhubung.`
      };
    }

    const primaryStudent = childrenList[0];

    return {
      success: true,
      cardType: 'PENJEMPUT',
      guardian: guardian || { 
        id: card.assignedToId || 'GDR-TEMP', 
        name: card.assignedToName || primaryStudent.guardianName || 'Orang Tua / Wali' 
      },
      student: primaryStudent,
      students: childrenList,
      card
    };
  }

  return {
    success: false,
    message: 'Tipe kartu tidak dikenali.'
  };
};
