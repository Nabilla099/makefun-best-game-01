// Emberward — sound, synthesized live with the Web Audio API.
// No audio files are shipped: every effect is an oscillator or a filtered
// noise burst, and the music is a quiet arpeggio scheduled on a lookahead
// timer. Audio starts only after the first user gesture (browser policy),
// and M toggles mute at any time.

import { MUTE_KEY } from './config.js';

function loadMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = loadMuted();
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
  }

  // Call from a click / keydown handler. Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      window.localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // storage unavailable; mute still applies for this session
    }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, cutoff) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shoot() { this.tone(720 + Math.random() * 120, 0.09, 'square', 0.10, 240); }
  spit() { this.tone(300, 0.12, 'sine', 0.07, 140); }
  hit() { this.noise(0.05, 0.12, 2400); }
  die() { this.tone(320, 0.22, 'sawtooth', 0.14, 70); this.noise(0.12, 0.10, 1200); }
  hurt() { this.tone(180, 0.25, 'sawtooth', 0.20, 60); }
  pickup() { this.tone(880, 0.10, 'sine', 0.14, 1320); }
  heart() { this.tone(520, 0.16, 'sine', 0.16, 780); this.tone(780, 0.2, 'sine', 0.10, 1040); }
  star() {
    [660, 880, 1100, 1320].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.14, 'triangle', 0.14), i * 55);
    });
  }
  wave() { this.tone(262, 0.3, 'triangle', 0.16); this.tone(392, 0.34, 'triangle', 0.14); }
  upgrade() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.18, 'triangle', 0.14), i * 70);
    });
  }
  dash() { this.noise(0.14, 0.10, 3200); }
  over() {
    [392, 330, 262, 196].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.4, 'triangle', 0.16), i * 160);
    });
  }
  click() { this.tone(600, 0.06, 'sine', 0.10, 900); }

  // A slow, quiet arpeggio over a low drone. Runs on a 100 ms lookahead
  // timer; the notes are soft so they sit under the effects.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scale = [220.0, 261.63, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const bass = [110.0, 87.31, 98.0, 130.81];
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
        const step = this.musicStep;
        const note = scale[(step * 3 + 2) % scale.length];
        const t0 = this.nextNoteTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = note;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.045, t0 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t0);
        osc.stop(t0 + 0.6);
        if (step % 8 === 0) {
          const b = this.ctx.createOscillator();
          const bg = this.ctx.createGain();
          b.type = 'triangle';
          b.frequency.value = bass[(step / 8) % bass.length];
          bg.gain.setValueAtTime(0.0001, t0);
          bg.gain.linearRampToValueAtTime(0.05, t0 + 0.1);
          bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
          b.connect(bg);
          bg.connect(this.master);
          b.start(t0);
          b.stop(t0 + 1.7);
        }
        this.musicStep += 1;
        this.nextNoteTime += 0.42;
      }
    }, 100);
  }
}
