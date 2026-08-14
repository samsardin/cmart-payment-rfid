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
    const student = students.find(s => s.id === card.assignedToId || s.rfidUid?.toUpperCase() === cleanUid);
    return {
      success: true,
      cardType: 'SISWA',
      student,
      card
    };
  } else if (card.type === 'PENJEMPUT') {
    const guardian = guardians.find(g => g.id === card.assignedToId || g.rfidCardUid?.toUpperCase() === cleanUid);
    const student = students.find(s => s.guardianId === guardian?.id || s.id === guardian?.studentId);
    return {
      success: true,
      cardType: 'PENJEMPUT',
      guardian,
      student,
      card
    };
  }

  return {
    success: false,
    message: 'Tipe kartu tidak dikenali.'
  };
};
