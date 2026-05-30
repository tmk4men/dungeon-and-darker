// ============================================================
// audio.js — WebAudio によるSFX合成（アセット不要）
// ============================================================
const Audio2 = {
  ctx: null, master: null, muted: false, _last: {},

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  // 単音
  tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  // ノイズ（打撃・爆発）
  noise(dur, vol = 0.3, freq = 1200, type = 'lowpass') {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur);
  },

  // スロットリング付き再生
  play(name) {
    if (!this.ctx) return;
    this.resume();
    const now = (this.ctx.currentTime);
    if (this._last[name] && now - this._last[name] < 0.04) return;
    this._last[name] = now;
    switch (name) {
      case 'swing': this.noise(0.12, 0.18, 2600, 'bandpass'); this.tone(420, 0.1, 'triangle', 0.12, 180); break;
      case 'shoot': this.tone(700, 0.12, 'square', 0.12, 300); this.noise(0.06, 0.1, 3000); break;
      case 'magic': this.tone(520, 0.18, 'sine', 0.16, 1100); this.tone(780, 0.16, 'sine', 0.08, 1300); break;
      case 'hit': this.noise(0.08, 0.22, 1400); this.tone(160, 0.08, 'square', 0.12, 80); break;
      case 'crit': this.noise(0.12, 0.3, 1800); this.tone(300, 0.14, 'sawtooth', 0.16, 120); break;
      case 'hurt': this.tone(220, 0.18, 'sawtooth', 0.22, 90); this.noise(0.12, 0.18, 800); break;
      case 'die': this.tone(300, 0.22, 'square', 0.16, 70); this.noise(0.18, 0.2, 900); break;
      case 'bossdie': this.tone(200, 0.6, 'sawtooth', 0.24, 50); this.noise(0.5, 0.25, 600); break;
      case 'heal': this.tone(520, 0.3, 'sine', 0.16, 880); this.tone(660, 0.3, 'sine', 0.1, 990, 0.05); break;
      case 'potion': this.tone(440, 0.18, 'sine', 0.16, 760); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.18, null, i * 0.09)); break;
      case 'coin': this.tone(900, 0.08, 'square', 0.14, 1300); this.tone(1300, 0.1, 'square', 0.1, 1600, 0.04); break;
      case 'chest': this.tone(300, 0.12, 'sawtooth', 0.12, 500); this.tone(700, 0.2, 'triangle', 0.12, 900, 0.06); break;
      case 'door': this.noise(0.3, 0.16, 500, 'lowpass'); this.tone(120, 0.25, 'sawtooth', 0.1, 80); break;
      case 'extract': [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.16, null, i * 0.1)); break;
      case 'death': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.18, null, i * 0.18)); break;
      case 'trap': this.noise(0.16, 0.26, 1600, 'highpass'); this.tone(180, 0.12, 'square', 0.14, 90); break;
      case 'zone': this.tone(110, 0.6, 'sawtooth', 0.2, 70); this.noise(0.5, 0.12, 300); break;
      case 'ui': this.tone(660, 0.05, 'square', 0.08, 880); break;
      case 'select': this.tone(880, 0.06, 'triangle', 0.1); break;
    }
  },

  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; },
};
