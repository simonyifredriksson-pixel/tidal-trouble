/* Edge.js - the Warden. What is waiting past the edge of every chart.

   The charts say the sea ends at WORLD.edge. It does not: it goes on, the
   swell gets bigger and the sky gets darker, and the first boat (or
   swimmer) to cross WORLD.beyond is found by the Warden. It cannot be
   fought, hooked, harpooned, outrun or escaped. It is not an encounter; it
   is the reason nobody leaves.

     omen      the sea goes quiet and dark; something very far off groans
     hunt      a wake the size of an island comes in from further out,
               always faster than whatever you are sailing
     surround  it stops a hundred and forty metres off and comes up; twelve
               arms rise out of the sea in a ring round you. The boat will
               not move.
     crush     the arms close. The boat breaks. Everyone goes into the sea.
     drag      it goes down, and the sea goes with it
   ...and you wake on the beach at Driftwood Bay, like the first time.

   The host runs it; everyone sees it from the world snapshot. */

import * as THREE from '../../lib/three.module.js';
import { buildWarden, curlArm } from '../art/AbyssArt.js';
import { MAT } from '../art/Materials.js';
import { WORLD, HOME_CENTRE, distHome } from '../world/MapData.js';
import { clamp, lerp, smoothstep } from '../core/Util.js';

const PH = { omen: 4, hunt: 60, surround: 5.5, crush: 3.2, drag: 4.5 };
const RING = 26;

export class Edge {
  constructor(game) {
    this.game = game;
    this.E = null;
    this.cool = 0;
    this.scanT = 0;
    this.dark = 0;
    this.w = null;
  }

  _mesh() {
    if (this.w) return this.w;
    const G = this.game;
    const w = this.w = buildWarden();
    G.scene.add(w.group);
    // the fog does not hide it: it is too big, and too close
    const solid = MAT.solid.clone(); solid.fog = false; const glow = MAT.glow.clone(); glow.fog = false;
    w.group.traverse(o => { if (o.material === MAT.solid) o.material = solid; else if (o.material === MAT.glow) o.material = glow; });
    // the arms come up round YOU, not round it
    this.ring = new THREE.Group();
    G.scene.add(this.ring);
    w.arms.forEach((A, i) => {
      w.group.remove(A.group);
      const a = i / w.arms.length * Math.PI * 2;
      A.group.position.set(Math.cos(a) * RING, 0, Math.sin(a) * RING);
      A.group.rotation.set(0, -a, 0);
      A.group.scale.setScalar(0.55);
      this.ring.add(A.group);
    });
    w.group.visible = false; this.ring.visible = false;
    return w;
  }

  /** Where the one it is after is right now. */
  _target(E) {
    const G = this.game;
    if (E.boat) { const b = G.boatById(E.boat); if (b) return { x: b.pos.x, z: b.pos.z, v: Math.hypot(b.vel.x, b.vel.y), b }; }
    const P = E.pid ? G.playerById(E.pid) : null;
    if (P) return { x: P.pos.x, z: P.pos.z, v: Math.hypot(P.vel.x, P.vel.z), P };
    return { x: E.tx, z: E.tz, v: 0 };
  }

  /* ---------------- host ---------------- */
  hostUpdate(dt) {
    const G = this.game;
    if (!this.E) {
      this.cool -= dt; this.scanT -= dt;
      if (this.cool > 0 || this.scanT > 0) return;
      this.scanT = 0.5;
      // a boat, crewed or drifting, or a swimmer, past the edge of every chart
      for (const b of G.boats) if (!b.sinking && distHome(b.pos.x, b.pos.z) > WORLD.beyond) return this._begin({ boat: b.id }, b.pos.x, b.pos.z);
      for (const P of G.allPlayers()) if (!P.boat && P.pos && distHome(P.pos.x, P.pos.z) > WORLD.beyond) return this._begin({ pid: P.id }, P.pos.x, P.pos.z);
      return;
    }
    const E = this.E;
    E.t += dt;
    // a staged screenshot holds it at one moment
    if (this.hold) { E.ph = this.hold.ph; E.t = this.hold.t; return; }
    const T = this._target(E);
    if (E.ph === 'omen' || E.ph === 'hunt') { E.tx = T.x; E.tz = T.z; }
    if (E.ph === 'omen' && E.t > PH.omen) this._phase('hunt');
    else if (E.ph === 'hunt') {
      // nothing on the sea is faster
      const dx = E.tx - E.x, dz = E.tz - E.z, d = Math.hypot(dx, dz);
      const v = Math.max(58, T.v * 1.8);
      if (d > 110) { E.x += dx / d * v * dt; E.z += dz / d * v * dt; }
      E.a = Math.atan2(dx, dz);
      if (d <= 115 || E.t > PH.hunt) { this._phase('surround'); if (d > 115) { E.x = E.tx - dx / d * 110; E.z = E.tz - dz / d * 110; } }
    } else if (E.ph === 'surround' || E.ph === 'crush') {
      // nothing moves inside the ring
      if (T.b) { T.b.vel.set(0, 0); T.b.pos.x = E.tx; T.b.pos.z = E.tz; T.b.throttle = 0; T.b._updateMatrix && T.b._updateMatrix(); }
      if (T.P === G.player && !G.player.boat) { G.player.pos.x = lerp(G.player.pos.x, E.tx, 0.1); G.player.pos.z = lerp(G.player.pos.z, E.tz, 0.1); }
      if (E.ph === 'surround' && E.t > PH.surround) this._phase('crush');
      if (E.ph === 'crush' && E.t > 1.3 && !E.hit) { E.hit = true; this._crush(E, T); }
      if (E.ph === 'crush' && E.t > PH.crush) this._phase('drag');
    } else if (E.ph === 'drag' && E.t > PH.drag) this._end(E);
  }

  _begin(who, x, z) {
    const G = this.game;
    const dx = x - HOME_CENTRE.x, dz = z - HOME_CENTRE.z, d = Math.hypot(dx, dz) || 1;
    // it comes from further out, from where you were trying to go
    const sx = x + dx / d * 650, sz = z + dz / d * 650;
    this.E = { ...who, ph: 'omen', t: 0, x: sx, z: sz, tx: x, tz: z, a: Math.atan2(-dx, -dz), n: (G.state.s.flags.warden || 0) };
    G._everyone({ t: 'edge', k: 'omen' });
  }
  _phase(ph) { this.E.ph = ph; this.E.t = 0; this.game._everyone({ t: 'edge', k: ph, x: this.E.tx, z: this.E.tz }); }

  _crush(E, T) {
    const G = this.game;
    // everyone within reach goes into the sea
    const victims = G.allPlayers().filter(P => P.pos && Math.hypot(P.pos.x - E.tx, P.pos.z - E.tz) < 60);
    E.victims = victims.map(P => P.id);
    if (T.b) {
      T.b.hp = 0; T.b.water = 1;
      for (const k of ['rail', 'rail', 'wheel', 'engine', 'mount']) T.b.breakSomething(k);
      T.b.startSinking();
    }
    for (const P of victims) {
      if (P === G.player) {
        if (P.boat) P.detach();
        P.mode = 'swim';
        P.vel.set((Math.random() - 0.5) * 8, 6, (Math.random() - 0.5) * 8);
        P.hurt(25, 'warden');
      } else G.net?.sendEvent({ t: 'overboard', to: P.id });
    }
    G._everyone({ t: 'edge', k: 'crushfx', x: E.tx, z: E.tz });
  }

  _end(E) {
    const G = this.game, s = G.state.s;
    s.flags.warden = (s.flags.warden || 0) + 1;
    s.flags.wardenDay = s.day;
    G.award('warden');
    for (const id of E.victims || []) G._everyone({ t: 'edgeWake', to: id === G.player.id ? undefined : id });
    // if nobody was there (a boat drifted out on its own) it is simply gone - Marge will tow what is left
    this.E = null;
    this.cool = 25;
    G._everyone({ t: 'edge', k: 'gone' });
    G._saveDirty = true;
  }

  snapshot() {
    const E = this.E;
    return E ? { ph: E.ph, t: +E.t.toFixed(2), x: +E.x.toFixed(1), z: +E.z.toFixed(1), tx: +E.tx.toFixed(1), tz: +E.tz.toFixed(1), a: +E.a.toFixed(3) } : null;
  }
  applySnapshot(s) {
    if (!s) { this.E = null; return; }
    if (!this.E || this.E.ph !== s.ph) this.E = { ...s };
    else Object.assign(this.E, { x: s.x, z: s.z, tx: s.tx, tz: s.tz, a: s.a, t: Math.abs(this.E.t - s.t) > 0.6 ? s.t : this.E.t });
  }

  /* ---------------- everyone: what it looks like ---------------- */
  update(dt, host) {
    if (host) this.hostUpdate(dt);
    const E = this.E, G = this.game;
    if (!host && E) E.t += dt;
    const P = G.player;
    const near = E ? Math.hypot(P.pos.x - E.tx, P.pos.z - E.tz) : 9999;
    this.dark = lerp(this.dark, E && near < 1400 ? (E.ph === 'omen' ? 0.35 : 0.6) : 0, Math.min(1, dt * 0.8));
    if (!E) { if (this.w) { this.w.group.visible = false; this.ring.visible = false; } return; }
    const w = this._mesh();
    const t = E.t, sea = G.world.sea(E.x, E.z);
    w.group.visible = E.ph !== 'omen';
    w.group.position.set(E.x, 0, E.z);
    w.group.rotation.y = E.a;
    let y = -80, ringY = -90, curl = 0.3, wave = 0.3;
    if (E.ph === 'hunt') {
      y = -52 + Math.sin(t * 0.6) * 2;
      // the wake of something that size
      if (Math.random() < 0.8) for (let k = 0; k < 3; k++) { const s = (Math.random() - 0.5) * 60; G.fx.foam(E.x + Math.cos(E.a) * s, sea + 0.1, E.z - Math.sin(E.a) * s, Math.sin(E.a) * 6, Math.cos(E.a) * 6); }
      if (Math.random() < dt * 3) G.fx.eruption(E.x + (Math.random() - 0.5) * 50, sea, E.z + (Math.random() - 0.5) * 50, 8);
    } else if (E.ph === 'surround') {
      const k = smoothstep(0, PH.surround, t);
      y = lerp(-52, -6, k);
      ringY = lerp(-90, -4, smoothstep(0.5, 4, t));
      curl = lerp(0.3, 0.9, k); wave = 0.35;
    } else if (E.ph === 'crush') {
      y = -6 + Math.sin(t * 2) * 1.5;
      ringY = -4;
      curl = lerp(0.9, 3.3, smoothstep(0, 1.3, t)); wave = 0.15;
    } else if (E.ph === 'drag') {
      const k = smoothstep(0, PH.drag, t);
      y = lerp(-6, -120, k); ringY = lerp(-4, -130, k); curl = 3.3; wave = 0.1;
    }
    w.group.position.y = y;
    this.ring.visible = E.ph === 'surround' || E.ph === 'crush' || E.ph === 'drag';
    this.ring.position.set(E.tx, ringY, E.tz);
    w.arms.forEach((A, i) => curlArm(A, G.world.time, curl * (0.85 + (i % 3) * 0.1), wave, i * 0.9, (i % 2 ? 1 : -1) * 0.4));
    // water pours off the arms as they come up
    if (this.ring.visible && ringY > -40 && Math.random() < 0.7) { const a = Math.random() * 6.28; G.fx.water(E.tx + Math.cos(a) * RING, sea + 6 + Math.random() * 20, E.tz + Math.sin(a) * RING, 0, -1, 0); }
  }

  /** What each phase sounds and feels like, wherever you are. */
  onEvent(e) {
    const G = this.game, P = G.player;
    const d = this.E ? Math.hypot(P.pos.x - this.E.tx, P.pos.z - this.E.tz) : 0;
    const close = d < 900;
    switch (e.k) {
      case 'omen': if (close) { G.audio.groan(0.6); G.ui.toast('The sea has gone very quiet.', 'warn'); } break;
      case 'hunt': if (close) { G.audio.groan(1); G.addShake(0.4); G.ui.banner('SOMETHING IS COMING', 'Out of the dark, from further out. Faster than anything should be.', 'wave', 4); } break;
      case 'surround': if (close) { G.audio.roar(1.8); G.audio.groan(1.4); G.addShake(1.2); G.ui.banner('', '', null, 0.1); G.world.sky.strikeAt(e.x + 60, e.z - 40, 1); } break;
      case 'crush': if (close) { G.audio.roar(2); G.addShake(1.5); } break;
      case 'crushfx': if (close) { G.audio.crack(); G.audio.crash(); G.audio.explosion(1.5); G.addShake(2); G.fx.eruption(e.x, 0, e.z, 36); G.fx.explosion(e.x, 1, e.z, 1.5); } break;
      case 'drag': if (close) { G.audio.groan(1.6); G.fx.eruption(e.x, 0, e.z, 40); } break;
      case 'gone': break;
    }
  }
}
