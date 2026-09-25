/* Great.js - the two encounters at the top of the game.

   THE GREAT LEVIATHAN (Vigil's End). Extremely rare: the host rolls for one
   every half minute, only once someone has found Vigil's End, and the odds
   are about one an hour (three times better if you are waiting at the
   island). When one comes up the whole sea is told. It patrols a wide ring
   round the island through the rock field and the fog, and you only ever
   see pieces of it:
       deep    a shadow and a wake
       rise    the back breaks the surface - plates, arches, wingtips
       breach  it comes partly or completely out of the water
       dive    the tail goes up and it is gone again
   Fish near it and it may take the bait: fifteen percent of bites. The rest
   of the time it noses your line and turns away. Hook it and the fight is
   the hardest in the game; lose it and it dives and carries on.

   THE KRAKEN (Offshore, the third zone). No legend, no warning. It comes up
   under a crewed boat and three arms come over the rail. It holds the boat,
   slams the deck and knocks people over. Get the axe out (0), walk up to an
   arm and press E - two good chops each and it lets go with a shriek. When
   all three are gone, the head comes up once, screams, and dives; for two
   and a half minutes the water where it went down can be fished, and
   one bite in ten there is the kraken itself.

   Host-simulated; peers render the snapshot. */

import * as THREE from '../../lib/three.module.js?v=1790354328';
import { GREAT, GREAT_BY_ID, KRAKEN, rollGreat } from '../data/GreatData.js?v=1790354328';
import { FISH_BY_ID } from '../data/FishData.js?v=1790354328';
import { buildGreat, buildTentacle, buildKrakenHead } from '../art/GreatArt.js?v=1790354328';
import { VIGIL, zoneAt } from '../world/MapData.js?v=1790354328';
import { clamp, damp, wrapAngle, lerp, smoothstep } from '../core/Util.js?v=1790354328';

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

// both fight through the ordinary rod code, so each gets a pseudo-species
for (const D of [...GREAT, KRAKEN]) {
  FISH_BY_ID['great:' + D.id] = {
    id: 'great:' + D.id, name: D.name, rarity: 'legendary', great: D.id, lev: false, beh: null, where: [], water: 'any', time: 'any', bait: {},
    kg: [1, 1], cm: [D.size * 100, D.size * 100], value: D.reward,
    fight: { power: 5, stamina: 9, erratic: 0.9, jump: 0 },
    art: { h: 0.2, w: 0.12, back: 0x3a3e44, belly: 0xa8a8a8, fin: 0x2a2e34, pat: 'none', patCol: 0xffffff, tail: 'fork', extras: [] },
    blurb: D.blurb,
  };
}

const PHASES = { deep: [12, 22], rise: [10, 16], breach: [5, 5], dive: [4, 4] };

export class Great {
  constructor(game) {
    this.game = game;
    this.lev = null;          // the Great Leviathan, if one is up
    this.kraken = null;       // the kraken encounter, if one is on
    this.rollT = 30;
    this.krakenT = 20;
    this.krakenCool = 0;
    this.m = { lev: null, levId: null, arms: [], head: null };
  }

  /* ================= spawning (host) ================= */
  spawnLev(id = null) {
    const G = this.game;
    const D = id ? GREAT_BY_ID[id] : rollGreat();
    if (!D) return null;
    const a = Math.random() * Math.PI * 2;
    const R = 230 + Math.random() * 50;
    this.lev = { id: D.id, def: D, x: VIGIL.x + Math.cos(a) * R, z: VIGIL.z + Math.sin(a) * R, h: a + Math.PI / 2, orbit: a, R, dir: Math.random() < 0.5 ? 1 : -1,
      phase: 'rise', pt: 0, pdur: 12, life: 520, hooked: null, wary: 0, breach: 0, t: 0 };
    G._everyone({ t: 'greatSpawn', id: D.id });
    return this.lev;
  }

  startKraken(boat) {
    const G = this.game;
    if (!boat || this.kraken) return null;
    const first = !G.state.s.kraken.met;
    const n = first ? KRAKEN.arms : 3 + Math.floor(Math.random() * 2);
    const H = boat.hull;
    const zs = n === 3 ? [-0.5, 0.1, 0.6] : [-0.6, -0.15, 0.3, 0.65];
    const arms = zs.map((f, i) => ({ id: i, side: i % 2 ? -1 : 1, z: f * H.hl, hp: KRAKEN.armHp, st: 'rise', t: 0, recoil: 0, slam: 0 }));
    this.kraken = { phase: 'attack', boat: boat.id, arms, t: 0, slamT: 3.5, spot: null, hooked: null };
    G.state.s.kraken.met++;
    G._everyone({ t: 'krakenAttack', first });
    return this.kraken;
  }

  /* ================= per frame ================= */
  update(dt, host) {
    if (host) { this._hostRolls(dt); this._hostLev(dt); this._hostKraken(dt); }
    this._draw(dt);
  }

  _hostRolls(dt) {
    const G = this.game, s = G.state.s;
    // the leviathan: rare, only once someone has seen Vigil's End
    this.rollT -= dt;
    if (this.rollT <= 0) {
      this.rollT = 30;
      if (!this.lev && s.flags.vigil) {
        const near = G.allPlayers().some(p => Math.hypot(p.pos.x - VIGIL.x, p.pos.z - VIGIL.z) < 700);
        if (Math.random() < (near ? 1 / 40 : 1 / 120)) this.spawnLev();
      }
    }
    // the kraken: offshore, under a crewed boat, no warning
    this.krakenCool = Math.max(0, this.krakenCool - dt);
    this.krakenT -= dt;
    if (this.krakenT <= 0) {
      this.krakenT = 5;
      if (this.kraken || this.krakenCool > 0 || s.tut < 3) return;
      for (const b of G.boats) {
        if (b.sinking || !G.allPlayers().some(p => p.boat === b)) continue;
        if (zoneAt(b.pos.x, b.pos.z) !== KRAKEN.zone || G.world.height(b.pos.x, b.pos.z) > -12) continue;
        if (Math.random() < (s.kraken.met ? 1 / 150 : 1 / 45)) { this.startKraken(b); break; }
      }
    }
  }

  _hostLev(dt) {
    const L = this.lev;
    if (!L) return;
    const G = this.game;
    L.t += dt; L.pt += dt; L.life -= dt; L.wary = Math.max(0, L.wary - dt);
    if (L.hooked) {
      L.phase = 'fight';
      if (!G.playerById(L.hooked)) L.hooked = null;
      return;                                   // the fisher reports where it is
    }
    if (L.life <= 0 && L.phase !== 'leave') { L.phase = 'leave'; L.pt = 0; G._everyone({ t: 'greatLeave', id: L.id }); }
    if (L.phase === 'leave') { if (L.pt > 8) this.lev = null; this._swim(L, dt, 0.6); return; }
    // the phase wheel: deep -> rise -> (breach) -> dive -> deep
    if (L.pt > L.pdur) {
      const next = L.phase === 'deep' ? 'rise' : L.phase === 'rise' ? (Math.random() < 0.35 ? 'breach' : 'dive') : L.phase === 'breach' ? 'dive' : L.phase === 'fight' ? 'dive' : 'deep';
      L.phase = next; L.pt = 0;
      const [a, b] = PHASES[next]; L.pdur = a + Math.random() * (b - a);
      G._everyone({ t: 'greatFx', k: next, id: L.id, x: +L.x.toFixed(1), z: +L.z.toFixed(1) });
    }
    // drift towards whoever is near the island, so it comes to be seen
    const crew = G.allPlayers().filter(p => Math.hypot(p.pos.x - VIGIL.x, p.pos.z - VIGIL.z) < 520);
    if (crew.length) {
      const p = crew[0].pos, dp = Math.hypot(p.x - VIGIL.x, p.z - VIGIL.z);
      L.R = damp(L.R, clamp(dp + 40, 150, 330), 0.05, dt);
    }
    this._swim(L, dt, 1);
  }

  _swim(L, dt, k) {
    const G = this.game, D = L.def;
    L.orbit += L.dir * D.speed * k / L.R * dt;
    const tx = VIGIL.x + Math.cos(L.orbit) * L.R, tz = VIGIL.z + Math.sin(L.orbit) * L.R;
    const want = Math.atan2(tx - L.x, tz - L.z);
    L.h += wrapAngle(want - L.h) * Math.min(1, dt * 0.4);
    const sp = D.speed * k * (L.phase === 'breach' ? 1.6 : 1);
    L.x += Math.sin(L.h) * sp * dt; L.z += Math.cos(L.h) * sp * dt;
    if (G.world.height(L.x, L.z) > -8) L.orbit += L.dir * 0.02;      // it knows where the rocks are
  }

  _hostKraken(dt) {
    const K = this.kraken;
    if (!K) return;
    const G = this.game;
    K.t += dt;
    const b = G.boatById(K.boat);
    const crewed = b && G.allPlayers().some(p => p.boat === b);
    if (K.phase === 'attack') {
      if (!b || b.sinking || (!crewed && K.t > 6)) { this._krakenLeave('The arms slide back into the sea. It has lost interest.'); return; }
      // it holds the boat
      b.vel.multiplyScalar(Math.exp(-2.5 * dt)); b.throttle *= 0.5;
      b.vr += Math.sin(K.t * 1.7) * 0.05 * dt; b.vp += Math.cos(K.t * 1.3) * 0.04 * dt;
      for (const A of K.arms) {
        A.t += dt; A.recoil = Math.max(0, A.recoil - dt * 2.2); A.slam = Math.max(0, A.slam - dt);
        if (A.st === 'rise' && A.t > 1.6) { A.st = 'grip'; A.t = 0; }
        if (A.st === 'retract' && A.t > 1.6) A.st = 'gone';
      }
      K.slamT -= dt;
      const live = K.arms.filter(A => A.st === 'grip');
      if (K.slamT <= 0 && live.length) {
        K.slamT = 3.5 + Math.random() * 3;
        const A = live[Math.floor(Math.random() * live.length)];
        A.slam = 1.1;
        setTimeout(() => this._slamHit(A), 650);
      }
      if (K.arms.every(A => A.st === 'gone' || A.st === 'retract') && K.arms.every(A => A.hp <= 0)) {
        // all three chopped: it screams, shows its face once, and dives
        K.phase = 'dive'; K.t = 0;
        const side = b.toWorld(_v.set(0, 0, -b.hull.hl - 14));
        K.spot = { x: side.x, z: side.z };
        G._everyone({ t: 'krakenDive', x: +side.x.toFixed(1), z: +side.z.toFixed(1) });
        for (const p of G.allPlayers()) if (p.boat === b) G.award('survivor', p.id);
      }
    } else if (K.phase === 'dive') {
      if (K.t > 5) { K.phase = 'window'; K.t = 0; }
    } else if (K.phase === 'window') {
      if (K.hooked) { if (!G.playerById(K.hooked)) K.hooked = null; return; }
      if (K.t > 150) this._krakenLeave('The ink thins out. The water goes still. It is gone - for now.');
    }
  }

  _slamHit(A) {
    const G = this.game, K = this.kraken;
    if (!K || A.st !== 'grip') return;
    const b = G.boatById(K.boat);
    if (!b) return;
    b.damage(7, 'kraken');
    b.impulse((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0.7 * A.side, 1.2);
    const hit = b.toWorld(_v.set(-A.side * 0.3, b.deck, A.z));
    G._everyone({ t: 'krakenSlam', p: hit.toArray().map(v => +v.toFixed(2)) });
    for (const p of G.allPlayers()) {
      if (p.boat !== b || p.pos.distanceTo(hit) > 3.2) continue;
      G.knockPlayer(p, p.pos.clone().sub(hit).setY(0).normalize(), 5, 'kraken');
      G.hurtPlayer(p, 6, 'kraken');
    }
  }

  _krakenLeave(text) {
    if (!this.kraken) return;
    this.kraken = null;
    this.krakenCool = 420;
    this.game._everyone({ t: 'banner', title: 'THE KRAKEN', sub: text, icon: 'tentacle' });
  }

  /** Host: an axe hit on an arm. */
  chop(armId, from) {
    const K = this.kraken, G = this.game;
    if (!K || K.phase !== 'attack') return;
    const A = K.arms.find(a => a.id === armId);
    if (!A || A.hp <= 0 || A.st !== 'grip') return;
    A.hp--; A.recoil = 1;
    const b = G.boatById(K.boat);
    const p = b ? b.toWorld(_v.set(A.side * (b.hull.hw + 0.2), b.deck + 1, A.z)) : G.player.pos;
    G._everyone({ t: 'krakenChop', p: p.toArray().map(v => +v.toFixed(2)), left: A.hp, arms: K.arms.filter(a => a.hp > 0).length - (A.hp > 0 ? 0 : 0) });
    if (A.hp <= 0) { A.st = 'retract'; A.t = 0; }
    void from;
  }

  /* ================= fishing hooks ================= */
  /** A bite is about to happen at `pos`: does one of the monsters want it?
      Returns a pending catch, {refused, text} or null. */
  claim(pos) {
    const G = this.game, auto = !!G.admin?.autoCatch;
    const L = this.lev;
    if (L && !L.hooked && L.phase !== 'leave') {
      const d = Math.hypot(pos.x - L.x, pos.z - L.z);
      if (d < L.def.size * 0.6 + 45) {
        if (auto || (L.wary <= 0 && Math.random() < L.def.hook)) {
          G.act({ t: 'greatHook', by: G.player.id });
          L.hooked = G.player.id;
          return this._pending(L.def, 'great');
        }
        return { refused: true, text: L.def.name + ' circles your bait... and turns away.' };
      }
    }
    const K = this.kraken;
    if (K && K.phase === 'window' && K.spot && !K.hooked && Math.hypot(pos.x - K.spot.x, pos.z - K.spot.z) < 45) {
      if (auto || Math.random() < KRAKEN.hook) {
        G.act({ t: 'krakenHook', by: G.player.id });
        K.hooked = G.player.id;
        return this._pending(KRAKEN, 'kraken');
      }
      return { refused: true, text: 'Something enormous brushes past your line in the ink.' };
    }
    return null;
  }
  _pending(D, creature) {
    return { sp: 'great:' + D.id, kg: Math.round(D.size * D.size * D.size * 0.9), cm: D.size * 100, size: 1, giant: true, great: D.id, creature, fight: D.fight, pace: D.pace, cap: D.cap, power: 5 };
  }
  /** Host: the fight ended one way or the other. */
  landed(creature, from) {
    const G = this.game, s = G.state.s;
    const D = creature === 'kraken' ? KRAKEN : this.lev?.def;
    if (!D) return;
    const first = creature === 'kraken' ? !s.kraken.caught : !s.great[D.id];
    if (creature === 'kraken') { s.kraken.caught++; this.kraken = null; this.krakenCool = 600; G.award('kraken', from); }
    else { s.great[D.id] = { n: (s.great[D.id]?.n || 0) + 1, day: s.day }; this.lev = null; G.award('great:' + D.id, from); }
    G.state.earn(first ? D.reward : Math.round(D.reward * 0.35), 'legend');
    G._everyone({ t: 'greatCaught', id: D.id, first, by: G.playerById(from)?.name || 'Someone', reward: first ? D.reward : Math.round(D.reward * 0.35) });
    G._changed();
  }
  released(creature) {
    if (creature === 'kraken') { if (this.kraken) this.kraken.hooked = null; return; }
    const L = this.lev;
    if (!L) return;
    L.hooked = null; L.phase = 'dive'; L.pt = 0; L.pdur = 4; L.wary = 25;
  }

  /* ================= drawing (every peer) ================= */
  _draw(dt) {
    const G = this.game, t = G.world.time;
    // --- the leviathan ---
    const L = this.lev;
    if (L) {
      if (!this.m.lev || this.m.levId !== L.id) {
        if (this.m.lev) G.scene.remove(this.m.lev.group);
        this.m.lev = buildGreat(L.def);
        this.m.levId = L.id;
        this.m.lev.group.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
        G.scene.add(this.m.lev.group);
        L._y = -L.def.size * 0.2;
      }
      const M = this.m.lev, D = L.def, S = D.size;
      if (L.hooked === G.player.id && G.fishing.fish && G.fishing.fish.creature === 'great') { L.x = G.fishing.bpos.x; L.z = G.fishing.bpos.z; L.phase = 'fight'; }
      const sea = G.world.sea(L.x, L.z);
      const f = clamp(L.pt / Math.max(0.1, L.pdur || 1), 0, 1);
      // how high it rides, per creature and phase
      const surf = D.id === 'graveback' ? -0.045 : D.id === 'ninefold' ? -0.02 : -0.025;
      const deep = -0.16;
      let y = deep, pitch = 0, roll = 0, anim = {};
      if (L.phase === 'rise' || L.phase === 'fight') y = lerp(deep, surf, smoothstep(0, 0.25, L.phase === 'fight' ? 1 : f)) - (L.phase === 'rise' ? smoothstep(0.8, 1, f) * 0.02 : 0);
      else if (L.phase === 'dive' || L.phase === 'leave') { y = lerp(surf, deep, smoothstep(0, 1, L.phase === 'leave' ? clamp(L.pt / 8, 0, 1) : f)); pitch = Math.sin(f * Math.PI) * (D.id === 'graveback' ? 0.45 : 0.25); }
      else if (L.phase === 'breach') {
        const H = D.id === 'graveback' ? 0.2 : D.id === 'ninefold' ? 0.06 : 0.45;
        y = surf + Math.sin(f * Math.PI) * H;
        pitch = -Math.cos(f * Math.PI) * (D.id === 'hushwing' ? 0.5 : 0.7);
        if (D.id === 'hushwing') roll = Math.sin(f * Math.PI * 2) * 0.15;
      }
      if (L.phase === 'deep') y = deep;
      L._y = damp(L._y ?? y * S, y * S, 2.5, dt);
      M.group.position.set(L.x, sea + L._y, L.z);
      _e.set(pitch, L.h, roll, 'YXZ');
      M.group.quaternion.setFromEuler(_e);
      // the body's own motion
      if (D.id === 'graveback') M.animate(t, L.phase === 'breach' ? 2 : L.phase === 'fight' ? 2.5 : 1);
      else if (D.id === 'ninefold') M.animate(t, { wave: L.phase === 'deep' ? 0.02 : L.phase === 'fight' ? 0.05 : 0.045, rear: L.phase === 'rise' ? smoothstep(0.35, 0.6, f) * (1 - smoothstep(0.8, 1, f)) : L.phase === 'breach' ? Math.sin(f * Math.PI) : 0, speed: L.phase === 'fight' ? 3 : 1.4 });
      else M.animate(t, { flap: L.phase === 'breach' ? 0.15 : L.phase === 'fight' ? 0.5 : 0.3, speed: L.phase === 'breach' ? 0.6 : 1.1, glide: L.phase === 'breach' });
      // spray, wake and the sound of something breathing
      if (L.phase !== 'deep' && L.phase !== 'leave' && Math.random() < dt * 6) G.fx.splash(L.x + (Math.random() - 0.5) * S * 0.4, sea, L.z + (Math.random() - 0.5) * S * 0.4, 2.5);
      if (D.id === 'graveback' && L.phase === 'rise' && Math.random() < dt * 0.3) { const hp = M.head.getWorldPosition(_v); G.fx.water(hp.x, sea + 2, hp.z, 0, 1.4, 0); G.audio.blow(G.player.pos.distanceTo(hp)); }
    } else if (this.m.lev) { G.scene.remove(this.m.lev.group); this.m.lev = null; this.m.levId = null; }

    // --- the kraken ---
    const K = this.kraken;
    const b = K ? G.boatById(K.boat) : null;
    if (K && b && K.phase === 'attack') {
      while (this.m.arms.length < K.arms.length) {
        const T = buildTentacle(8 + b.hull.hw * 1.6, this.m.arms.length + 1);
        T.group.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
        G.scene.add(T.group);
        this.m.arms.push(T);
      }
      K.arms.forEach((A, i) => {
        const T = this.m.arms[i];
        const H = b.hull;
        const rise = A.st === 'rise' ? smoothstep(0, 1.6, A.t) : A.st === 'retract' ? 1 - smoothstep(0, 1.6, A.t) : A.st === 'gone' ? 0 : 1;
        T.group.visible = rise > 0.01;
        const root = b.toWorld(_v.set(A.side * (H.hw + 0.7), -6 + rise * 5.4, A.z));
        T.group.position.copy(root);
        T.group.quaternion.copy(b.group.quaternion);
        T.group.rotateY(A.side > 0 ? Math.PI : 0);
        const n = T.segs.length;
        const slamLift = A.slam > 0.45 ? smoothstep(1.1, 0.45, A.slam) : 0, slamDown = A.slam > 0 && A.slam <= 0.45 ? 1 : 0;
        for (let k = 0; k < n; k++) {
          const s = k / n;
          // straight up out of the sea, a hard bend over the rail, the tip across the deck
          let c = (s < 0.34 ? 0.035 : s < 0.72 ? 0.27 : 0.11) * (A.st === 'grip' || A.st === 'rise' ? rise : 0.3);
          c -= slamLift * 0.16; c += slamDown * 0.09;
          c += Math.sin(t * 3 + k * 0.7 + i) * 0.04 + A.recoil * Math.sin(t * 30 + k) * 0.12;
          T.segs[k].rotation.z = -c;
          T.segs[k].rotation.x = Math.sin(t * 1.6 + k * 0.5 + i * 2) * 0.05;
        }
        A._grip = T.segs[Math.floor(n * 0.62)].getWorldPosition(A._grip || new THREE.Vector3());
        if (rise > 0.5 && Math.random() < dt * 2) G.fx.splash(root.x, G.world.sea(root.x, root.z), root.z, 1.2);
      });
    } else if (this.m.arms.length) { for (const T of this.m.arms) G.scene.remove(T.group); this.m.arms = []; }
    // the head, once, as it dives
    if (K && K.phase === 'dive' && K.spot) {
      if (!this.m.head) { this.m.head = buildKrakenHead(KRAKEN.size * 0.5); G.scene.add(this.m.head); }
      const f = clamp(K.t / 5, 0, 1);
      const sea = G.world.sea(K.spot.x, K.spot.z);
      this.m.head.position.set(K.spot.x, sea - 10 + Math.sin(f * Math.PI) * 12, K.spot.z);
      const pp = G.player.pos;
      this.m.head.rotation.y = Math.atan2(pp.x - K.spot.x, pp.z - K.spot.z);
      if (Math.random() < dt * 8) G.fx.splash(K.spot.x + (Math.random() - 0.5) * 10, sea, K.spot.z + (Math.random() - 0.5) * 10, 2.5);
    } else if (this.m.head) { G.scene.remove(this.m.head); this.m.head = null; }
    // the ink slick while it can be fished
    if (K && K.phase === 'window' && K.spot && Math.random() < dt * 5) {
      const a = Math.random() * 6.28, d = Math.random() * 35;
      const x = K.spot.x + Math.cos(a) * d, z = K.spot.z + Math.sin(a) * d;
      G.fx.bubbles(x, G.world.sea(x, z), z, 3);
      if (Math.random() < 0.3) G.fx.ripple(x, G.world.sea(x, z), z, 4, 2);
    }
  }

  /** The kraken arm the player can reach with an axe, if any. */
  armNear(pos, r = 2.6) {
    const K = this.kraken;
    if (!K || K.phase !== 'attack') return null;
    let best = null, bd = r;
    for (const A of K.arms) {
      if (A.st !== 'grip' || A.hp <= 0 || !A._grip) continue;
      const d = Math.hypot(A._grip.x - pos.x, A._grip.z - pos.z);
      if (d < bd) { bd = d; best = A; }
    }
    return best;
  }

  /* ================= sync ================= */
  snapshot() {
    const L = this.lev, K = this.kraken;
    return {
      l: L ? [L.id, +L.x.toFixed(1), +L.z.toFixed(1), +L.h.toFixed(3), L.phase, +L.pt.toFixed(2), +(L.pdur || 1).toFixed(2), L.hooked || 0] : null,
      k: K ? { ph: K.phase, b: K.boat, t: +K.t.toFixed(2), s: K.spot, h: K.hooked || 0, a: K.arms.map(A => [A.id, A.side, +A.z.toFixed(2), A.hp, A.st, +A.t.toFixed(2), +A.recoil.toFixed(2), +A.slam.toFixed(2)]) } : null,
    };
  }
  applySnapshot(s) {
    if (!s) return;
    if (s.l) {
      const [id, x, z, h, phase, pt, pdur, hooked] = s.l;
      if (!this.lev || this.lev.id !== id) this.lev = { id, def: GREAT_BY_ID[id], x, z, h, phase, pt, pdur, hooked: hooked || null };
      const L = this.lev;
      if (L.hooked !== this.game.player.id) { L.x = lerp(L.x, x, 0.3); L.z = lerp(L.z, z, 0.3); L.h = h; }
      L.phase = phase; L.pt = pt; L.pdur = pdur; L.hooked = hooked || null;
    } else this.lev = null;
    if (s.k) {
      const K = this.kraken || (this.kraken = { arms: [] });
      K.phase = s.k.ph; K.boat = s.k.b; K.t = s.k.t; K.spot = s.k.s; K.hooked = s.k.h || null;
      K.arms = s.k.a.map(([id, side, z, hp, st, t, recoil, slam], i) => Object.assign(K.arms[i] || {}, { id, side, z, hp, st, t, recoil, slam }));
    } else this.kraken = null;
  }
}
