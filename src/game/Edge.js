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

const PH = { omen: 4, hunt: 60, surround: 5.5, crush: 3.2, drag: 4.5, signs: 7, radio: 23, still: 3, under: 4.5, rise: 6 };
/* The first time: it lets you know. The radio is someone who got this far once. */
export const RADIO = [
  [0.0, '...'],
  [2.6, 'If you are hearing this... turn around.'],
  [5.4, "Don't look for it."],
  [7.8, 'It knows you are there.'],
  [10.6, 'We made it this far once.'],
  [13.2, 'We thought the ocean ended here.'],
  [15.6, "It doesn't."],
  [18.0, 'Whatever you do...'],
  [20.4, "Don't let it see y-"],
];
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
    if (['omen', 'signs', 'radio', 'still', 'under', 'rise', 'hunt'].includes(E.ph)) { E.tx = T.x; E.tz = T.z; }
    if (E.ph === 'under' && T.b) { T.b.vel.multiplyScalar(0.96); }
    if (E.ph === 'omen' && E.t > (E.n ? PH.omen : 6)) this._phase(E.n ? 'hunt' : 'signs');
    else if (E.ph === 'signs' && E.t > PH.signs) this._phase('radio');
    else if (E.ph === 'radio' && E.t > PH.radio) this._phase('still');
    else if (E.ph === 'still' && E.t > PH.still) this._phase('under');
    else if (E.ph === 'under' && E.t > PH.under) { this._phase('rise'); E.x = E.tx - Math.sin(E.a) * 150; E.z = E.tz - Math.cos(E.a) * 150; }
    else if (E.ph === 'rise' && E.t > PH.rise) this._phase('hunt');
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
    this.dark = lerp(this.dark, E && near < 1400 ? (E.ph === 'omen' ? 0.35 : ['signs', 'radio', 'still'].includes(E.ph) ? 0.5 : 0.62) : 0, Math.min(1, dt * 0.6));
    // the sea goes quiet, the music stops: from the first omen until it is over
    this.hush = lerp(this.hush || 0, E && near < 1400 && E.ph !== 'drag' ? 1 : 0, Math.min(1, dt * 0.7));
    if (!E) { if (this.w) { this.w.group.visible = false; this.ring.visible = false; } return; }
    const w = this._mesh();
    const t = E.t, sea = G.world.sea(E.x, E.z);
    w.group.visible = E.ph !== 'omen';
    w.group.position.set(E.x, 0, E.z);
    w.group.rotation.y = E.a;
    let y = -80, ringY = -90, curl = 0.3, wave = 0.3;
    this._shadow(E, t, dt);
    if (E.ph === 'signs') {
      // something moving, very far off: a ridge breaks the surface for a moment, and goes
      const far = 560, a = E.a + 0.6;
      w.group.position.set(E.tx + Math.sin(a) * far, 0, E.tz + Math.cos(a) * far);
      y = -34 + Math.max(0, Math.sin(t / PH.signs * Math.PI)) * 16;
      if (Math.random() < dt * 2) G.fx.eruption(w.group.position.x, sea, w.group.position.z, 12);
    } else if (E.ph === 'radio' || E.ph === 'still') { y = -140; }
    else if (E.ph === 'under') { y = -140; }
    else if (E.ph === 'rise') {
      // up it comes, slowly, far bigger than anything should be
      const k = smoothstep(0, PH.rise, t);
      y = lerp(-70, -2, k);
      if (Math.random() < dt * 4) G.fx.eruption(E.x + (Math.random() - 0.5) * 60, sea, E.z + (Math.random() - 0.5) * 60, 14);
      if (Math.random() < 0.8) { const a2 = Math.random() * 6.28, r = 20 + Math.random() * 20; G.fx.water(E.x + Math.cos(a2) * r, sea + 10 + Math.random() * 30, E.z + Math.sin(a2) * r, 0, -1, 0); }
    } else if (E.ph === 'hunt') {
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
    if (E.ph !== 'signs') w.group.position.set(E.x, 0, E.z);
    w.group.position.y = y;
    w.group.visible = E.ph !== 'omen' && E.ph !== 'radio' && E.ph !== 'still' && E.ph !== 'under';
    this._radio(E, t, near < 1400);
    this.ring.visible = E.ph === 'surround' || E.ph === 'crush' || E.ph === 'drag';
    this.ring.position.set(E.tx, ringY, E.tz);
    w.arms.forEach((A, i) => curlArm(A, G.world.time, curl * (0.85 + (i % 3) * 0.1), wave, i * 0.9, (i % 2 ? 1 : -1) * 0.4));
    // water pours off the arms as they come up
    if (this.ring.visible && ringY > -40 && Math.random() < 0.7) { const a = Math.random() * 6.28; G.fx.water(E.tx + Math.cos(a) * RING, sea + 6 + Math.random() * 20, E.tz + Math.sin(a) * RING, 0, -1, 0); }
  }

  /* A shape under the water: a dark blot on the sea, much bigger than the boat, drifting past - or right underneath. */
  _shadow(E, t, dt) {
    const G = this.game;
    if (!this.shade) {
      const g = new THREE.CircleGeometry(1, 24);
      this.shade = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x02060a, transparent: true, opacity: 0, depthWrite: false }));
      this.shade.rotation.x = -Math.PI / 2; this.shade.renderOrder = 3;
      G.scene.add(this.shade);
    }
    const S = this.shade;
    let op = 0, x = E.tx, z = E.tz, sx = 60, sz = 22, ry = 0;
    const px = Math.cos(E.a), pz = -Math.sin(E.a);
    if (E.ph === 'signs') { const u = t / PH.signs; op = Math.sin(u * Math.PI) * 0.55; x = E.tx + px * lerp(-180, 180, u) + Math.sin(E.a) * 40; z = E.tz + pz * lerp(-180, 180, u) + Math.cos(E.a) * 40; ry = E.a + Math.PI / 2; }
    else if (E.ph === 'under') { const u = t / PH.under; op = Math.sin(u * Math.PI) * 0.75; x = E.tx + px * lerp(-120, 120, u); z = E.tz + pz * lerp(-120, 120, u); sx = 90; sz = 34; ry = E.a + Math.PI / 2; }
    S.visible = op > 0.01;
    S.material.opacity = op;
    S.position.set(x, G.world.sea(x, z) + 0.15, z);
    S.scale.set(sx, sz, 1);
    S.rotation.z = ry;
    // passing under the boat, it lifts the whole sea
    if (E.ph === 'under' && Math.abs(t - PH.under / 2) < 0.9) { G.addShake(0.02); const b = G.player.boat; if (b && G.isHost) b.impulse(0, 0, 1.2 * dt * 6, 0.3); }
  }
  /* The radio. Static, then a voice - every line on screen, because it matters what it says. */
  _radio(E, t, close) {
    const G = this.game;
    if (E.ph !== 'radio' || !close) return;
    E.said = E.said || 0;
    if (E.t < 0.1 && !E.crackled) { E.crackled = true; G.audio.staticNoise(2.4, 1); G.audio.radio(); }
    while (E.said < RADIO.length && t >= RADIO[E.said][0] + 1.5) {
      const [, line] = RADIO[E.said++];
      if (line !== '...') { G.ui.radio('Radio: ' + line); G.audio.radioVoice(line.split(' ').length, 1); G.audio.staticNoise(0.4, 0.5); }
      else G.audio.staticNoise(1.2, 0.8);
    }
    if (t > PH.radio - 1.2 && !E.cut) { E.cut = true; G.audio.staticNoise(1.6, 1.4); }
  }

  /** What each phase sounds and feels like, wherever you are. */
  onEvent(e) {
    const G = this.game, P = G.player;
    const d = this.E ? Math.hypot(P.pos.x - this.E.tx, P.pos.z - this.E.tz) : 0;
    const close = d < 900;
    switch (e.k) {
      case 'omen': if (close) G.ui.toast('The sea has gone very quiet.', 'warn'); break;
      case 'signs': if (close) setTimeout(() => G.audio.groan(0.35), 2500); break;
      case 'still': break;
      case 'under': if (close) { G.audio.groan(1.3); setTimeout(() => G.addShake(0.6), 1500); } break;
      case 'rise': if (close) { G.audio.roar(1.6); G.audio.groan(1.6); G.addShake(1.4); G.world.sky.strikeAt(e.x + 80, e.z + 30, 1); G.ui.banner('', '', null, 0.1); } break;
      case 'hunt': if (close) { G.audio.groan(1); G.addShake(0.4); G.ui.banner('SOMETHING IS COMING', 'Out of the dark, from further out. Faster than anything should be.', 'wave', 4); } break;
      case 'surround': if (close) { G.audio.roar(1.8); G.audio.groan(1.4); G.addShake(1.2); G.ui.banner('', '', null, 0.1); G.world.sky.strikeAt(e.x + 60, e.z - 40, 1); } break;
      case 'crush': if (close) { G.audio.roar(2); G.addShake(1.5); } break;
      case 'crushfx': if (close) { G.audio.crack(); G.audio.crash(); G.audio.explosion(1.5); G.addShake(2); G.fx.eruption(e.x, 0, e.z, 36); G.fx.explosion(e.x, 1, e.z, 1.5); } break;
      case 'drag': if (close) { G.audio.groan(1.6); G.fx.eruption(e.x, 0, e.z, 40); } break;
      case 'gone': break;
    }
  }
}
