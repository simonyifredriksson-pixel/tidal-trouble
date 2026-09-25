/* Voice.js - voice chat for the crew, over the same PeerJS peer as the game.

   PROXIMITY by default: your microphone is open while you are in a room, and
   how loud a friend sounds depends on how far away they are - clear inside
   five metres, gone past thirty. Shout across the deck, whisper on the pier.

   THE WALKIE-TALKIE: hold C and you lift the radio to your mouth. While you
   hold it everyone in the crew hears you at full volume wherever they are,
   through a crackly band-passed radio filter with a squelch click at each
   end - so you always know when a voice is coming over the radio and when
   someone is standing right behind you.

   Topology: a mesh of audio calls. Every pair of players has one call,
   placed by whichever id sorts lower, so nobody calls twice. A player with
   no microphone (or who said no) still hears everyone: they call with a
   silent stream. V mutes your own mic.

   Browsers only let WebRTC audio into WebAudio if the stream is also
   attached to a media element, so each remote stream plays through a muted
   <audio> as well as the gain graph. */

import { clamp } from '../core/Util.js?v=1790354328';

const NEAR = 5, FAR = 30;

export class Voice {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.stream = null;          // what we send (mic, or silence)
    this.mic = false;            // a real microphone is live
    this.muted = false;
    this.walkie = false;         // holding C right now
    this.peers = new Map();      // id -> { call, el, prox, radio, an, level, speaking, walkie }
    this.status = 'off';
    this.started = false;
  }

  get available() { return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia; }

  _ctx() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /** Called once we are in a room (host or client). */
  async start(net) {
    if (this.started) return;
    this.net = net;
    const peer = net.peer;
    if (!peer || typeof peer.call !== 'function') { this.status = 'unavailable'; return; }
    this.started = true;
    peer.on('call', call => {
      this._ensureStream().then(() => { call.answer(this.stream); this._wire(call); });
    });
    await this._ensureStream();
    this.connectAll();
  }

  async _ensureStream() {
    if (this.stream) return this.stream;
    if (this._pending) return this._pending;
    this._pending = (async () => {
      if (this.available) {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
          this.mic = true; this.status = 'on';
        } catch (e) { this.status = 'no microphone'; }
      } else this.status = 'no microphone';
      if (!this.stream) {
        // listen-only: a silent track so calls still connect
        const c = this._ctx();
        if (c) { const d = c.createMediaStreamDestination(); this.stream = d.stream; }
      }
      this.setMuted(this.muted);
      return this.stream;
    })();
    return this._pending;
  }

  /** Place a call to everyone we do not have one with yet. */
  connectAll() {
    if (!this.started || !this.stream || !this.net?.isOnline) return;
    for (const id of this.net.profiles.keys()) {
      if (this.peers.has(id)) continue;
      if (!(String(this.net.selfId) < String(id))) continue;        // the lower id dials
      try { const call = this.net.peer.call(id, this.stream); if (call) this._wire(call); } catch (e) { /* retried on next join */ }
    }
  }

  _wire(call) {
    const id = call.peer;
    const old = this.peers.get(id);
    if (old && old.call !== call) try { old.call.close(); } catch (e) { /* */ }
    const P = { call, el: null, prox: null, radio: null, an: null, level: 0, speaking: false, walkie: false, buf: null };
    this.peers.set(id, P);
    call.on('stream', s => this._attach(P, s));
    call.on('close', () => this.drop(id, call));
    call.on('error', () => this.drop(id, call));
  }

  _attach(P, s) {
    const c = this._ctx();
    const el = new Audio();
    el.srcObject = s; el.muted = true; el.play().catch(() => {});
    P.el = el;
    if (!c) { el.muted = false; return; }
    const src = c.createMediaStreamSource(s);
    // near: plain voice, scaled by distance
    P.prox = c.createGain(); P.prox.gain.value = 0;
    src.connect(P.prox).connect(c.destination);
    // radio: band-passed, a touch of drive, full volume anywhere
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1400; pk.gain.value = 7;
    P.radio = c.createGain(); P.radio.gain.value = 0;
    src.connect(hp).connect(lp).connect(pk).connect(P.radio).connect(c.destination);
    P.an = c.createAnalyser(); P.an.fftSize = 256;
    P.buf = new Uint8Array(P.an.fftSize);
    src.connect(P.an);
  }

  drop(id, call = null) {
    const P = this.peers.get(id);
    if (!P || (call && P.call !== call)) return;
    try { P.call.close(); } catch (e) { /* */ }
    if (P.el) { P.el.srcObject = null; }
    try { P.prox && P.prox.disconnect(); P.radio && P.radio.disconnect(); } catch (e) { /* */ }
    this.peers.delete(id);
  }

  stop() { for (const id of [...this.peers.keys()]) this.drop(id); }

  setMuted(m) {
    this.muted = m;
    if (this.stream) for (const t of this.stream.getAudioTracks()) t.enabled = !m;
  }

  /** How loud a friend at distance d sounds without the radio. */
  static proximity(d) { const f = clamp(1 - (d - NEAR) / (FAR - NEAR), 0, 1); return f * f; }

  /** Per frame: distance gains, the walkie-talkie, who is talking. */
  update(dt) {
    const G = this.game, me = G.player;
    for (const [id, P] of this.peers) {
      const r = G.remotes.get(id);
      const walkie = !!(r && r.walkie);
      if (walkie !== P.walkie) { P.walkie = walkie; G.audio.radio(); }
      const d = r ? r.pos.distanceTo(me.pos) : 999;
      const k = 1 - Math.exp(-dt * 10);
      if (P.prox) P.prox.gain.value += ((walkie ? 0 : Voice.proximity(d)) - P.prox.gain.value) * k;
      if (P.radio) P.radio.gain.value += ((walkie ? 1.25 : 0) - P.radio.gain.value) * k;
      if (P.an) {
        P.an.getByteTimeDomainData(P.buf);
        let s = 0; for (let i = 0; i < P.buf.length; i++) { const v = (P.buf[i] - 128) / 128; s += v * v; }
        P.level = Math.sqrt(s / P.buf.length);
      }
      P.speaking = P.level > 0.03 && (walkie || Voice.proximity(d) > 0.02);
    }
  }

  /** Who is talking right now, for the HUD. */
  talking() {
    const out = [];
    for (const [id, P] of this.peers) if (P.speaking) { const r = this.game.remotes.get(id); out.push({ name: r ? r.name : 'Friend', color: r ? r.color : '#fff', radio: P.walkie }); }
    return out;
  }
}
