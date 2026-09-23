/* Audio.js - every sound in Hooked is synthesised. No files.

   Ambience (sea, wind, rain, birds, crickets) and the boat engine are
   long-running nodes whose gains are set each frame from the world; sound
   effects are one-shot graphs built on demand. Music is generative: a
   gentle plucked pentatonic by day, minor at night, and a tense low pulse
   whenever something enormous is in the water.

   The context is created on the first user gesture (browsers insist). */

let ctx = null;

export class Audio {
  constructor() {
    this.enabled = false;
    this.vol = 0.8; this.musicVol = 0.5;
    this.listener = { x: 0, y: 0, z: 0 };
    this.beat = 0; this.nextNote = 0; this.mood = 'day';
    this.reelT = 0; this.tenT = 0;
  }

  unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.enabled = true;
    this.master = ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(this.master);
    // shared noise
    const n = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // ambience beds
    this.sea = this._bed('lowpass', 520, 0.6);
    this.wind = this._bed('bandpass', 900, 1.2);
    this.rain = this._bed('highpass', 3000, 0.4);
    // engine
    this.eng = ctx.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 40;
    this.eng2 = ctx.createOscillator(); this.eng2.type = 'square'; this.eng2.frequency.value = 20;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 380;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.eng.connect(ef); this.eng2.connect(ef); ef.connect(this.engGain); this.engGain.connect(this.sfx);
    this.eng.start(); this.eng2.start();
    this.engFilter = ef;
  }

  _bed(type, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start();
    return { src, f, g };
  }

  setVolume(v, m) {
    this.vol = v; this.musicVol = m;
    if (!ctx) return;
    this.master.gain.value = v;
    this.music.gain.value = m * 0.5;
  }

  /* ---------------- helpers ---------------- */
  _att(pos, ref = 14) {
    if (!pos) return 1;
    const L = this.listener;
    const d = Math.hypot(pos.x - L.x, pos.y - L.y, pos.z - L.z);
    return 1 / (1 + d / ref);
  }
  tone(freq, dur, type = 'sine', vol = 0.2, att = 0.005, slide = 0, delay = 0, dest = null) {
    if (!ctx || vol < 0.002) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, type = 'lowpass', freq = 1000, q = 1, sweep = 0, delay = 0) {
    if (!ctx || vol < 0.002) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  /* ---------------- effects ---------------- */
  click() { this.tone(900, 0.05, 'triangle', 0.08); }
  hover() { this.tone(1300, 0.03, 'sine', 0.03); }
  buy() { this.tone(660, 0.1, 'triangle', 0.12); this.tone(990, 0.16, 'triangle', 0.12, 0.005, 0, 0.08); }
  coin() { this.tone(1320, 0.08, 'square', 0.05); this.tone(1760, 0.2, 'square', 0.05, 0.005, 0, 0.06); }
  deny() { this.tone(200, 0.15, 'square', 0.08, 0.005, 0.7); }
  splash(p = 1, pos = null) { const a = this._att(pos); this.noise(0.25 + p * 0.3, 0.25 * Math.min(2, p) * a, 'lowpass', 1400, 0.8, 0.3); this.noise(0.12, 0.12 * a, 'highpass', 3000, 0.5); }
  plop(pos) { const a = this._att(pos, 20); this.tone(520, 0.12, 'sine', 0.2 * a, 0.002, 0.4); this.noise(0.15, 0.1 * a, 'bandpass', 1800, 2); }
  nibble(pos) { const a = this._att(pos, 25); this.tone(800, 0.06, 'sine', 0.12 * a, 0.002, 0.6); }
  bite(pos) { const a = this._att(pos, 30); this.tone(300, 0.2, 'sine', 0.3 * a, 0.002, 0.3); this.noise(0.3, 0.25 * a, 'lowpass', 900, 1, 0.4); this.tone(1200, 0.1, 'triangle', 0.12, 0.002, 0, 0.02); }
  hook() { this.tone(180, 0.18, 'triangle', 0.2, 0.002, 1.6); this.noise(0.12, 0.15, 'bandpass', 2400, 3); }
  cast(c) { this.noise(0.35, 0.18 + c * 0.1, 'bandpass', 1500 + c * 1500, 2, 0.4); }
  reel(t) {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now < this.reelT) return;
    this.reelT = now + 0.045;
    this.tone(2600 + Math.random() * 200, 0.02, 'square', 0.025);
  }
  tension(t) {
    if (!ctx || t < 0.75) return;
    const now = ctx.currentTime;
    if (now < this.tenT) return;
    this.tenT = now + 0.25 - Math.min(0.15, (t - 0.75) * 0.3);
    this.tone(90 + t * 120, 0.2, 'sawtooth', 0.04 + (t - 0.75) * 0.12, 0.02, 1.05);
  }
  snap() { this.tone(1900, 0.08, 'square', 0.15, 0.002, 0.2); this.noise(0.2, 0.2, 'highpass', 2000, 1); }
  flop(pos) { const a = this._att(pos, 8); this.noise(0.07, 0.12 * a, 'lowpass', 700, 1); }
  jump() { this.noise(0.08, 0.04, 'lowpass', 500, 1); }
  step(wood) { this.noise(0.06, wood ? 0.05 : 0.03, wood ? 'bandpass' : 'lowpass', wood ? 700 : 400, 2); }
  throw() { this.noise(0.3, 0.2, 'bandpass', 900, 1.5, 3); }
  swoosh() { this.noise(0.35, 0.15, 'bandpass', 600, 1.2, 3); }
  thunk() { this.tone(140, 0.12, 'triangle', 0.25, 0.002, 0.5); this.noise(0.08, 0.15, 'lowpass', 800, 1); }
  drill() { if (Math.random() < 0.3) this.noise(0.1, 0.06, 'bandpass', 2400, 4); }
  hammer() { this.tone(420, 0.05, 'square', 0.1, 0.002, 0.5); this.noise(0.06, 0.1, 'bandpass', 1800, 3); }
  slosh() { this.noise(0.45, 0.25, 'lowpass', 1100, 0.7, 0.4); }
  shutter() { this.noise(0.05, 0.25, 'highpass', 3000, 1); this.noise(0.05, 0.2, 'highpass', 2500, 1, 1, 0.08); }
  grapple() { this.noise(0.3, 0.2, 'bandpass', 1800, 2, 0.5); this.tone(300, 0.2, 'square', 0.06, 0.002, 2); }
  bell() { this.tone(1760, 0.8, 'sine', 0.2); this.tone(2640, 0.6, 'sine', 0.1, 0.005, 0, 0.02); this.tone(1760, 0.8, 'sine', 0.15, 0.005, 0, 0.3); }
  crash() { this.noise(0.6, 0.45, 'lowpass', 900, 1, 0.3); this.tone(70, 0.5, 'triangle', 0.3, 0.005, 0.5); }
  explosion(p = 1, pos = null) { const a = this._att(pos, 25); this.noise(1.4 * p, 0.7 * a, 'lowpass', 1200, 0.7, 0.1); this.tone(55, 0.9, 'sine', 0.6 * a, 0.005, 0.4); }
  zap() { for (let i = 0; i < 6; i++) this.tone(200 + Math.random() * 1400, 0.05, 'sawtooth', 0.08, 0.002, 1, i * 0.04); }
  roar(v = 1) { this.tone(70, 1.6, 'sawtooth', 0.22 * v, 0.2, 0.6); this.tone(52, 1.8, 'sawtooth', 0.18 * v, 0.3, 0.7); this.noise(1.6, 0.2 * v, 'lowpass', 400, 1, 0.5); }
  thunder(d = 200) { const a = 1 / (1 + d / 250); this.noise(2.5, 0.6 * a, 'lowpass', 300, 0.7, 0.3, d / 340 * 0.3); this.tone(40, 2, 'sine', 0.3 * a, 0.05, 0.6, d / 340 * 0.3); }
  fanfare(tier = 1) {
    const notes = tier >= 3 ? [523, 659, 784, 1047, 1319] : tier >= 2 ? [523, 659, 784, 1047] : [587, 740, 880];
    notes.forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.13, 0.005, 0, i * 0.09, this.music));
  }
  radio() { this.noise(0.25, 0.12, 'bandpass', 2200, 3); this.tone(1000, 0.08, 'square', 0.03, 0.005, 1, 0.2); }
  eventSting(k) {
    if (k === 'giant' || k === 'lev') { this.tone(98, 1.2, 'sawtooth', 0.12, 0.02, 1, 0, this.music); this.tone(92.5, 1.2, 'sawtooth', 0.12, 0.02, 1, 0.6, this.music); }
    else if (k === 'storm') this.thunder(120);
    else if (k === 'meteor') { this.tone(1200, 2, 'sine', 0.1, 0.05, 0.1); }
    else this.tone(784, 0.3, 'triangle', 0.1, 0.005, 0, 0, this.music), this.tone(988, 0.4, 'triangle', 0.1, 0.005, 0, 0.12, this.music);
  }
  shock() { this.zap(); }
  ouch() { this.tone(300, 0.2, 'triangle', 0.12, 0.005, 0.6); }
  flame() { if (Math.random() < 0.3) this.noise(0.15, 0.05, 'bandpass', 1500 + Math.random() * 1500, 2); }
  stroke() { this.noise(0.35, 0.09, 'lowpass', 900, 0.8, 0.5); this.noise(0.15, 0.04, 'highpass', 2500, 1, 1, 0.1); }
  /** The kraken: a tearing, rising scream with a wet rattle under it. */
  shriek(v = 1) {
    this.tone(320, 1.3, 'sawtooth', 0.16 * v, 0.05, 2.6);
    this.tone(410, 1.1, 'square', 0.07 * v, 0.08, 2.2, 0.05);
    this.tone(90, 1.4, 'sawtooth', 0.2 * v, 0.05, 0.6);
    this.noise(1.3, 0.3 * v, 'bandpass', 1400, 1.5, 2.5);
    this.noise(0.9, 0.2 * v, 'lowpass', 500, 1, 0.5, 0.3);
  }
  /** A world event: a long, low fog horn, twice. */
  horn() {
    for (const d of [0, 2.2]) {
      this.tone(73.4, 1.9, 'sawtooth', 0.22, 0.25, 1, d, this.music);
      this.tone(110, 1.9, 'triangle', 0.12, 0.25, 1, d, this.music);
      this.tone(146.8, 1.6, 'sine', 0.06, 0.3, 1, d + 0.1, this.music);
    }
    this.noise(4.5, 0.08, 'lowpass', 260, 0.8, 1, 0);
  }
  /** The Graveback surfacing: a breath like a storm through a keyhole. */
  blow(dist = 50) {
    const a = 1 / (1 + dist / 120);
    this.noise(2.2, 0.5 * a, 'bandpass', 700, 0.6, 0.3);
    this.tone(55, 2.4, 'sine', 0.25 * a, 0.3, 0.8);
  }
  bubble() { this.tone(400 + Math.random() * 500, 0.06, 'sine', 0.04, 0.002, 1.8); }

  /* ---------------- continuous: ambience, engine, music ---------------- */
  update(dt, env) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const k = 1 - Math.exp(-dt * 3);
    const set = (g, v) => { g.gain.value += (v - g.gain.value) * k; };
    set(this.sea.g, (env.nearWater ? 0.16 : 0.05) + env.storm * 0.18);
    this.sea.f.frequency.value = 380 + Math.sin(t * 0.3) * 120 + env.storm * 300;
    set(this.wind.g, 0.02 + env.storm * 0.12 + (env.frost ? 0.04 : 0) + (env.height > 25 ? 0.05 : 0));
    this.wind.f.frequency.value = 700 + Math.sin(t * 0.17) * 300;
    set(this.rain.g, env.storm * 0.12);
    // Vigil's End: the wind drops to a low hum and the fog swallows the birds
    const mist = env.mist || 0;
    if (!this.drone) {
      this.drone = ctx.createOscillator(); this.drone.type = 'sine'; this.drone.frequency.value = 49;
      this.drone2 = ctx.createOscillator(); this.drone2.type = 'triangle'; this.drone2.frequency.value = 73.5;
      this.droneG = ctx.createGain(); this.droneG.gain.value = 0;
      this.drone.connect(this.droneG); this.drone2.connect(this.droneG); this.droneG.connect(this.sfx);
      this.drone.start(); this.drone2.start();
    }
    set(this.droneG, mist * 0.05);
    this.drone2.frequency.value = 73.5 + Math.sin(t * 0.13) * 1.5;
    if (mist > 0.5 && Math.random() < dt * 0.02) this.tone(38 + Math.random() * 10, 4, 'sine', 0.12 * mist, 1.2, 0.8);   // something far away, very big
    const th = Math.abs(env.throttle || 0);
    set(this.engGain, env.engine ? 0.035 + th * 0.07 : 0);
    this.eng.frequency.value = 38 + th * 70 + (env.speed || 0) * 2;
    this.eng2.frequency.value = (38 + th * 70) / 2;
    this.engFilter.frequency.value = 300 + th * 700;
    // critters
    if (!env.underwater) {
      if (!env.night && env.nearLand && (env.mist || 0) < 0.4 && Math.random() < dt * 0.35) this._bird();
      if (env.night && env.nearLand && Math.random() < dt * 2) this.tone(4200 + Math.random() * 400, 0.04, 'sine', 0.012);
      if (env.fire && Math.random() < dt * 8) this.flame();
    }
    if (env.underwater && Math.random() < dt * 2) this.bubble();
    this._music(env);
  }

  _bird() {
    const base = 1800 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.tone(base * (1 + Math.random() * 0.3), 0.08, 'sine', 0.025, 0.01, 1.3, i * 0.11);
  }

  _music(env) {
    const t = ctx.currentTime;
    const tense = env.tense;
    const bpm = tense ? 112 : 76;
    const beatLen = 60 / bpm / 2;
    if (this.nextNote < t) this.nextNote = t + 0.1;
    while (this.nextNote < t + 0.2) {
      const b = this.beat++;
      const when = this.nextNote - t;
      if (tense) {
        if (b % 4 === 0) this.tone(55, 0.35, 'sine', 0.25, 0.005, 0.5, when, this.music);
        if (b % 8 === 6) this.tone(55, 0.25, 'sine', 0.18, 0.005, 0.5, when, this.music);
        if (b % 2 === 1) this.tone([220, 207.6, 233.1, 196][Math.floor(b / 8) % 4], 0.18, 'sawtooth', 0.03, 0.005, 0.98, when, this.music);
      } else {
        const scale = env.night ? [220, 261.6, 293.7, 329.6, 392, 440, 523.3] : [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
        const bar = Math.floor(b / 16) % 4;
        const roots = env.night ? [0, 3, 4, 2] : [0, 4, 5, 3];
        if (b % 8 === 0) this.tone(scale[roots[bar]] / 2, 1.6, 'triangle', 0.07, 0.01, 1, when, this.music);
        if (Math.random() < 0.45 * (1 - (env.mist || 0) * 0.8) && b % 2 === 0) {
          const f = scale[(roots[bar] + [0, 2, 4, 1, 3][Math.floor(Math.random() * 5)]) % scale.length];
          this.tone(f, 0.9, 'triangle', 0.045, 0.004, 1, when, this.music);
          this.tone(f * 2, 0.5, 'sine', 0.012, 0.004, 1, when + 0.01, this.music);
        }
      }
      this.nextNote += beatLen;
    }
  }
}
