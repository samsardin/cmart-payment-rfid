// Audio Pickup Service for School RFID Student Pickup System
// Features: Web Audio API Ding-Dong Chime Synth + Web Speech Synthesis (id-ID) + Announcement Queue

class AudioPickupService {
  constructor() {
    this.queue = [];
    this.isSpeaking = false;
    this.speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];

    // Default Voice Settings
    this.settings = {
      volume: 1.0,  // 0.0 - 1.0
      rate: 0.92,   // 0.5 - 1.5 (Slightly slower for clear Indonesian pronunciation)
      pitch: 1.0,  // 0.5 - 1.5
      enableChime: true,
      voiceName: null
    };

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (!this.speechSynthesis) return;
    this.voices = this.speechSynthesis.getVoices();
    // Auto-select Indonesian voice if available
    const idVoice = this.voices.find(v => v.lang === 'id-ID' || v.lang.startsWith('id'));
    if (idVoice) {
      this.settings.voiceName = idVoice.name;
    }
  }

  getIndonesianVoice() {
    if (!this.speechSynthesis) return null;
    const voices = this.speechSynthesis.getVoices();
    if (this.settings.voiceName) {
      const match = voices.find(v => v.name === this.settings.voiceName);
      if (match) return match;
    }
    return (
      voices.find(v => v.lang === 'id-ID' || v.lang === 'id_ID' || v.lang.startsWith('id')) ||
      voices.find(v => v.name.toLowerCase().includes('indonesia')) ||
      voices[0] ||
      null
    );
  }

  // Pure Web Audio API Synthesizer for School / Airport Chime Bell (Ding-Dong)
  playChimeDingDong() {
    return new Promise((resolve) => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          resolve();
          return;
        }
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const now = ctx.currentTime;

        // Tone 1: High Pitch (Ding - 659.25 Hz / E5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.4, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.75);

        // Tone 2: Low Pitch (Dong - 523.25 Hz / C5) after 300ms delay
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(523.25, now + 0.32);
        gain2.gain.setValueAtTime(0, now + 0.32);
        gain2.gain.linearRampToValueAtTime(0.45, now + 0.37);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.32);
        osc2.stop(now + 1.25);

        setTimeout(() => {
          try { ctx.close(); } catch (e) {}
          resolve();
        }, 1200);
      } catch (err) {
        console.warn('Web Audio Chime failed:', err);
        resolve();
      }
    });
  }

  // Construct Natural Speech Text for Student Pickup Announcement
  generateAnnouncementText(data) {
    const { student, guardian, children, isRepeat } = data;
    const gName = guardian?.name || student?.guardianName || 'Orang Tua';

    const childList = (children && children.length > 0) ? children : (student ? [student] : []);

    let text = '';
    if (isRepeat) {
      text += 'Panggilan ulang penjemputan. ';
    } else {
      text += 'Panggilan penjemputan. ';
    }

    if (childList.length === 1) {
      const c = childList[0];
      text += `Diberitahukan kepada siswa ${c.name} dari kelas ${c.class}. Penjemput Anda, ${gName}, telah tiba di lokasi penjemputan. Harap segera menuju ke area penjemputan.`;
    } else if (childList.length > 1) {
      const namesWithClass = childList.map(c => `${c.name} dari kelas ${c.class}`).join(' serta ');
      text += `Diberitahukan kepada siswa ${namesWithClass}. Penjemput Anda, ${gName}, telah tiba di lokasi penjemputan. Harap segera menuju ke area penjemputan.`;
    } else {
      text += `Penjemput atas nama ${gName} telah tiba di lokasi penjemputan.`;
    }

    return text;
  }

  // Queue Announcement for Smooth Non-overlapping Playback
  enqueueAnnouncement(pickupData) {
    this.queue.push(pickupData);
    this.processQueue();
  }

  async processQueue() {
    if (this.isSpeaking || this.queue.length === 0) return;
    this.isSpeaking = true;

    const data = this.queue.shift();

    // 1. Play Chime Bell first if enabled
    if (this.settings.enableChime) {
      await this.playChimeDingDong();
      await new Promise(r => setTimeout(r, 200));
    }

    // 2. Speak the announcement
    const textToSpeak = this.generateAnnouncementText(data);
    await this.speakText(textToSpeak);

    this.isSpeaking = false;
    // Process next item in queue after short pause
    setTimeout(() => this.processQueue(), 400);
  }

  speakText(text) {
    return new Promise((resolve) => {
      if (!this.speechSynthesis) {
        console.warn('Speech synthesis not available in this browser.');
        resolve();
        return;
      }

      // Cancel ongoing speech if any
      try {
        this.speechSynthesis.cancel();
      } catch (e) {}

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.volume = this.settings.volume;
      utterance.rate = this.settings.rate;
      utterance.pitch = this.settings.pitch;

      const voice = this.getIndonesianVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = (err) => {
        console.warn('Speech synthesis utterance error:', err);
        resolve();
      };

      try {
        this.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Failed to start speech synthesis:', e);
        resolve();
      }
    });
  }

  stopAll() {
    this.queue = [];
    this.isSpeaking = false;
    if (this.speechSynthesis) {
      try {
        this.speechSynthesis.cancel();
      } catch (e) {}
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
}

export const audioPickupService = new AudioPickupService();
