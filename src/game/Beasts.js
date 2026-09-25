/* Beasts.js - the ten ocean beasts, as things that happen to the sea.

   A director (host) looks at every crewed boat every few seconds and asks
   each beast whether this is its kind of water (BeastData.where). If the
   odds come up, the beast is simply THERE - no marker, no quest. Each one
   runs its own little cycle of phases (a shadow, a rise, a dive...), bends
   the sea around it (storms, currents, waves, darkness, thuds) and only
   becomes hookable in one particular phase or condition - the rule the
   refusal text hints at, and the rule a journal page spells out.

   One beast at a time, and never over the top of a Leviathan or Kraken
   encounter. Fishing goes through the ordinary catch bar (Fishing.js),
   with a pseudo-species so the fight, the rod rating and the pace all work
   the same way as for everything else. Peers render from the snapshot. */

import * as THREE from '../../lib/three.module.js?v=1790358905';
import { BEASTS, BEAST_BY_ID, WHALE_ROUTE } from '../data/BeastData.js?v=1790358905';
import { FISH_BY_ID } from '../data/FishData.js?v=1790358905';
import { buildBeast } from '../art/BeastArt.js?v=1790358905';
import { zoneAt } from '../world/MapData.js?v=1790358905';
import { clamp, damp, wrapAngle, lerp, smoothstep } from '../core/Util.js?v=1790358905';

const _v = new THREE.Vector3(), _e = new THREE.Euler();

for (const D of BEASTS) {
  FISH_BY_ID['beast:' + D.id] = {
    id: 'beast:' + D.id, name: D.name, rarity: 'legendary', great: D.id, beast: true, beh: null, where: [], water: 'any', time: 'any', bait: {},
    kg: [1, 1], cm: [D.size * 100, D.size * 100], value: D.reward, fight: { power: 5, stamina: 9, erratic: 0.9, jump: 0 },
    art: { h: 0.2, w: 0.12, back: 0x3a3e44, belly: 0xa8a8a8, fin: 0x2a2e34, pat: 'none', patCol: 0xffffff, tail: 'fork', extras: [] }, blurb: D.blurb,
  };
}

/* The cycle each beast runs: [phase, seconds, how high it rides (x size, 0 = at the surface)]. */
const CYCLE = {
  cthulhu:      [['omen', 18, -0.9], ['rising', 16, -0.25], ['risen', 45, -0.08], ['sinking', 12, -0.5], ['risen', 45, -0.08]],
  skymaw:       [['sky', 28, 0.7], ['dive', 3.5, 0], ['under', 55, -0.12], ['rise', 5, 0.3]],
  drownedking:  [['debris', 35, -0.6], ['rising', 12, -0.2], ['risen', 60, -0.1], ['sinking', 12, -0.5]],
  serpent:      [['far', 35, -0.012], ['close', 30, -0.008], ['far', 30, -0.012], ['close', 30, -0.008]],
  glassback:    [['drift', 90, -0.12], ['above', 60, -0.01]],
  stormeater:   [['drift', 12, -0.05], ['fed', 30, -0.03]],
  whalefall:    [['deep', 26, -0.25], ['surfaced', 28, -0.075]],
  mirrorfish:   [['swim', 60, -0.18]],
  trenchwalker: [['walk', 22, -0.95], ['reaching', 18, -0.95]],
  colossus:     [['walk', 30, -0.36], ['surfaced', 22, -0.235]],
};
const LIFE = { cthulhu: 280, skymaw: 360, drownedking: 360, serpent: 300, glassback: 400, stormeater: 300, whalefall: 420, mirrorfish: 300, trenchwalker: 320, colossus: 420 };

export class Beasts {
  constructor(game) {
    this.game = game;
    this.b = null;                 // the beast that is out right now
    this.checkT = 8;
    this.cool = 120;
    this.m = null; this.mId = null;
    this.dark = 0; this.stormForce = 0;
    this.wrecks = game.world.settlement.wrecks || [];
  }

  stormy() { return this.stormForce > 0.4; }

  /* ================= the director (host) ================= */
  _ctx(b) {
    const G = this.game, x = b.pos.x, z = b.pos.z, depth = -G.world.height(x, z);
    return {
      zone: zoneAt(x, z, depth), depth, night: G.isNight(), storm: G.world.storm > 0.45, region: G.world.region(x, z),
      nearWreck: this.wrecks.some(w => Math.hypot(w.x - x, w.z - z) < 160),
      onRoute: routeDist(x, z) < 160,
    };
  }

  spawn(id, near) {
    const G = this.game, D = BEAST_BY_ID[id];
    if (!D || !near) return null;
    let x = near.x, z = near.z, h = Math.random() * 6.28;
    const away = (d) => { for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, px = near.x + Math.cos(a) * d, pz = near.z + Math.sin(a) * d; if (G.world.height(px, pz) < -12) return [px, pz, a]; } return [near.x + d, near.z, 0]; };
    if (id === 'colossus') { x = near.x - 260; z = near.z + (Math.random() - 0.5) * 80; h = Math.PI / 2; }
    else if (id === 'whalefall') { const p = routeNearest(near.x, near.z); x = p.x; z = p.z; h = p.h; }
    else if (id === 'mirrorfish' || id === 'glassback') { [x, z] = away(70 + Math.random() * 50); }
    else if (id === 'serpent') { x = near.x; z = near.z; }
    else { [x, z] = away(id === 'cthulhu' ? 260 : id === 'skymaw' ? 60 : 180); }
    this.b = { id, def: D, x, z, h, t: 0, ci: 0, pt: 0, hooked: null, life: LIFE[id], wary: 0, cx: near.x, cz: near.z, orbit: Math.random() * 6.28, fedT: 0, seen: {} };
    this.b.phase = CYCLE[id][0][0];
    this.cool = 360;
    return this.b;
  }

  _director(dt) {
    const G = this.game, s = G.state.s;
    this.cool = Math.max(0, this.cool - dt);
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = 6;
    if (this.b || this.cool > 0 || s.tut < 3 || G.great?.lev || G.great?.kraken) return;
    for (const boat of G.boats) {
      if (boat.sinking || !G.allPlayers().some(p => p.boat === boat)) continue;
      const c = this._ctx(boat);
      for (const D of BEASTS) {
        if (!D.where(c)) continue;
        const k = (s.beastClues?.[D.id] ? 3 : 1);
        if (Math.random() < D.odds * k) { this.spawn(D.id, boat.pos); return; }
      }
    }
  }

  /* ================= each beast's own life (host) ================= */
  _host(dt) {
    const B = this.b;
    if (!B) return;
    const G = this.game, D = B.def;
    B.t += dt; B.pt += dt; B.wary = Math.max(0, B.wary - dt); B.fedT = Math.max(0, B.fedT - dt);
    if (B.hooked && !G.playerById(B.hooked)) B.hooked = null;
    if (!B.hooked) B.life -= dt;
    if (B.life <= 0 && B.phase !== 'leave') { B.phase = 'leave'; B.pt = 0; }
    if (B.phase === 'leave') { if (B.pt > 14) { this.b = null; return; } }
    else if (!B.hooked || D.drags) {
      const C = CYCLE[B.id], cur = C[B.ci % C.length];
      if (B.pt > cur[1] && !(B.hooked && D.drags)) {
        B.ci++; B.pt = 0;
        B.phase = C[B.ci % C.length][0];
        this._onPhase(B);
      }
    }
    this._move(B, dt);
    this._effects(B, dt);
  }

  _onPhase(B) {
    const G = this.game;
    if (B.id === 'skymaw' && B.phase === 'dive') {
      // it falls out of the sky onto a shoal next to you
      const t = this._nearestBoat(B) || { pos: new THREE.Vector3(B.x, 0, B.z) };
      const a = Math.random() * 6.28; B.x = t.pos.x + Math.cos(a) * 55; B.z = t.pos.z + Math.sin(a) * 55;
      setTimeout(() => { if (this.b === B) { G._everyone({ t: 'beastFx', k: 'splash', x: B.x, z: B.z, s: 22 }); this._wave(B, 140, 3, 4); } }, 3000);
    }
    if (B.id === 'whalefall' && B.phase === 'deep' && B.t > 5) G.ocean?.addHotspot('bubbles', B.x, B.z, 150);   // it leaves a feeding ground behind
    G._everyone({ t: 'beastPhase', id: B.id, ph: B.phase, x: +B.x.toFixed(1), z: +B.z.toFixed(1) });
    void G;
  }

  _nearestBoat(B, r = 1e9) {
    let best = null, bd = r;
    for (const b of this.game.boats) { const d = Math.hypot(b.pos.x - B.x, b.pos.z - B.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  _move(B, dt) {
    const G = this.game, D = B.def;
    const tb = this._nearestBoat(B);
    const tx = tb ? tb.pos.x : B.cx, tz = tb ? tb.pos.z : B.cz;
    const steer = (wx, wz, rate, speed) => {
      const want = Math.atan2(wx - B.x, wz - B.z);
      B.h += wrapAngle(want - B.h) * Math.min(1, dt * rate);
      const nx = B.x + Math.sin(B.h) * speed * dt, nz = B.z + Math.cos(B.h) * speed * dt;
      if (G.world.height(nx, nz) < -6 || speed < 0.1) { B.x = nx; B.z = nz; } else B.h += dt * 1.2;
    };
    const ring = (R, speed) => { B.orbit += speed / R * dt; steer(tx + Math.cos(B.orbit) * R, tz + Math.sin(B.orbit) * R, 0.8, speed * 1.1); };
    if (B.hooked && !D.drags && B.hooked === G.player.id && G.fishing.fish) { B.x = G.fishing.bpos.x; B.z = G.fishing.bpos.z; return; }
    if (B.phase === 'leave') { steer(B.x + Math.sin(B.h) * 100, B.z + Math.cos(B.h) * 100, 0.2, 6); return; }
    switch (B.id) {
      case 'cthulhu': { const d = Math.hypot(tx - B.x, tz - B.z); steer(tx, tz, 0.15, d > 170 ? 2.5 : 0); break; }  // comes near, never at you
      case 'skymaw': if (B.phase === 'sky') ring(90, 16); else if (B.phase === 'under') ring(60, 4); break;
      case 'drownedking': steer(tx, tz, 0.2, Math.hypot(tx - B.x, tz - B.z) > 70 ? 1.6 : 0.2); break;
      case 'serpent': ring(B.phase === 'close' ? 42 : 120, B.phase === 'close' ? 11 : 16); break;
      case 'glassback': steer(tx, tz, 0.1, Math.hypot(tx - B.x, tz - B.z) > (B.phase === 'above' ? 8 : 60) ? 2 : 0.3); break;
      case 'stormeater': ring(150, 7); break;
      case 'whalefall': { const p = routeAhead(B.x, B.z, 120); steer(p.x, p.z, 0.2, 4.5); break; }
      case 'mirrorfish': ring(55, 3); break;
      case 'trenchwalker': steer(tx, tz, 0.15, Math.hypot(tx - B.x, tz - B.z) > 60 ? 2 : 0.3); break;
      case 'colossus': { B.h += wrapAngle(Math.PI / 2 - B.h) * Math.min(1, dt * 0.2); B.x += Math.sin(B.h) * 3 * dt; B.z += Math.cos(B.h) * 3 * dt; break; }  // it simply walks, west to east
    }
  }

  /** A wave out from the beast: boats rock, take water, and can be holed. */
  _wave(B, R, push, dmg) {
    const G = this.game;
    for (const b of G.boats) {
      const dx = b.pos.x - B.x, dz = b.pos.z - B.z, d = Math.hypot(dx, dz) || 1;
      if (d > R) continue;
      const f = 1 - d / R;
      b.impulse(dx / d * push * f, dz / d * push * f, (Math.random() - 0.5) * 1.6 * f, 2 * f);
      if (dmg > 0) { b.damage(dmg * f * (0.7 + Math.random() * 0.6), 'beast'); b.water = Math.min(1, b.water + 0.04 * f); }
      for (const p of G.allPlayers()) if (p.boat === b && Math.random() < 0.45 * f) G.knockPlayer(p, new THREE.Vector3(dx / d, 0, dz / d), 4, 'wave');
    }
  }

  _effects(B, dt) {
    const G = this.game, D = B.def;
    B.fxT = (B.fxT || 3) - dt;
    const due = B.fxT <= 0;
    switch (B.id) {
      case 'cthulhu':
        if (due && B.phase !== 'omen') { B.fxT = 6 + Math.random() * 4; G._everyone({ t: 'beastFx', k: 'bigwave', x: B.x, z: B.z }); this._wave(B, 420, 5, 16); }
        else if (due) B.fxT = 4;
        break;
      case 'serpent':
        // the circling drags the sea round with it
        for (const b of G.boats) { const dx = b.pos.x - B.x, dz = b.pos.z - B.z, d = Math.hypot(dx, dz) || 1; if (d < 190) { const f = (1 - d / 190) * 3.4; b.tow.x += Math.cos(B.h) * f; b.tow.y += -Math.sin(B.h) * f; } }
        break;
      case 'stormeater':
        if (due) { B.fxT = 9 + Math.random() * 6; B.fedT = 30; B.phase = 'fed'; B.pt = 0; B.ci = 1; G._everyone({ t: 'beastFx', k: 'bolt', x: B.x, z: B.z }); this._wave(B, 180, 2.5, 5); }
        break;
      case 'whalefall':
        if (B.phase === 'surfaced' && due) { B.fxT = 7; G._everyone({ t: 'beastFx', k: 'spout', x: B.x, z: B.z }); this._wave(B, 80, 0.8, 0); }
        break;
      case 'trenchwalker':
        if (due) { B.fxT = 5 + Math.random() * 3; G._everyone({ t: 'beastFx', k: 'thud', x: B.x, z: B.z }); for (const b of G.boats) { const d = Math.hypot(b.pos.x - B.x, b.pos.z - B.z); if (d < 260) b.impulse(0, 0, (Math.random() - 0.5) * (1 - d / 260) * 1.5, 3 * (1 - d / 260)); } }
        break;
      case 'colossus':
        for (const b of G.boats) { const d = Math.hypot(b.pos.x - B.x, b.pos.z - B.z); if (d < 240) { const f = (1 - d / 240) * 2.6; b.tow.x += Math.sin(B.h) * f; b.tow.y += Math.cos(B.h) * f; } }
        if (due) { B.fxT = 8; G._everyone({ t: 'beastFx', k: 'shock', x: B.x, z: B.z }); this._wave(B, 260, 1.5, 3); }
        break;
      case 'drownedking':
        if (B.phase === 'risen') for (const b of G.boats) { const d = Math.hypot(b.pos.x - B.x, b.pos.z - B.z); if (d < D.size * 0.45 + 6 && (b.bumpT || 0) <= 0) { b.bumpT = 3; this._wave(B, D.size * 0.5 + 12, 3, 12); G._everyone({ t: 'beastFx', k: 'splash', x: b.pos.x, z: b.pos.z, s: 6 }); } }
        if (due && B.phase === 'rising') { B.fxT = 3; G._everyone({ t: 'beastFx', k: 'splash', x: B.x, z: B.z, s: 14 }); }
        break;
      case 'skymaw':
        break;
    }
    // hooked monsters that drag you: the whole boat is towed behind it
    if (B.hooked && D.drags) {
      const P = G.playerById(B.hooked), b = P && P.boat;
      if (b) { const dx = B.x - b.pos.x, dz = B.z - b.pos.z, d = Math.hypot(dx, dz) || 1; const k = 3.2 + Math.max(0, d - 60) * 0.1; b.tow.x += dx / d * k; b.tow.y += dz / d * k; }
    }
    if (B.hooked && B.id === 'serpent') {
      const P = G.playerById(B.hooked), b = P && P.boat;
      if (b) { b.tow.x += Math.sin(B.h) * 3.5; b.tow.y += Math.cos(B.h) * 3.5; }
    }
  }

  /* ================= what everyone sees ================= */
  /** Is the beast visible to someone standing at `eye` looking along `dir`? (the Mirrorfish) */
  mirrorSeen(eye) {
    const B = this.b, sun = this.game.world.sky.state.sunDir;
    if (!B || B.id !== 'mirrorfish') return true;
    const vx = B.x - eye.x, vz = B.z - eye.z, l = Math.hypot(vx, vz) || 1;
    return (vx / l) * sun.x + (vz / l) * sun.z < -0.1;      // the sun at your back
  }

  _draw(dt) {
    const G = this.game, B = this.b, t = G.world.time;
    let dark = 0, storm = 0;
    if (B) {
      if (!this.m || this.mId !== B.id) {
        if (this.m) G.scene.remove(this.m.group);
        this.m = buildBeast(B.def); this.mId = B.id;
        this.m.group.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
        G.scene.add(this.m.group);
        this.m._y = undefined;
      }
      const M = this.m, D = B.def, S = D.size;
      const C = CYCLE[B.id], cur = C[B.ci % C.length], nxt = C[(B.ci + 1) % C.length];
      const f = clamp(B.pt / cur[1], 0, 1);
      let y = cur[2];
      if (B.phase === 'rising' || B.phase === 'sinking' || B.phase === 'rise' || B.phase === 'dive') y = lerp(cur[2], nxt[2], smoothstep(0, 1, f));
      if (B.phase === 'dive') y = lerp(0.7, -0.05, f * f);
      if (B.phase === 'leave') y = B.id === 'skymaw' ? 0.9 : -1.2;
      if (B.hooked) y = Math.min(y, B.id === 'skymaw' ? -0.1 : y);
      const d = Math.hypot(G.player.pos.x - B.x, G.player.pos.z - B.z);
      const sea = G.world.sea(B.x, B.z);
      M._y = M._y === undefined ? y * S : damp(M._y, y * S, 1.1, dt);
      M.group.position.set(B.x, sea + M._y, B.z);
      let pitch = 0;
      if (B.id === 'skymaw' && B.phase === 'dive') pitch = 0.9;
      if (B.id === 'skymaw' && B.phase === 'rise') pitch = -0.7;
      _e.set(pitch, B.h, 0, 'YXZ'); M.group.quaternion.setFromEuler(_e);
      // per beast: animation and the things only it does
      const P = G.player;
      switch (B.id) {
        case 'cthulhu': M.animate(t, { spread: B.phase === 'risen' ? 1 : 0.2, look: Math.atan2(P.pos.x - B.x, P.pos.z - B.z) - B.h }); dark = (1 - smoothstep(250, 900, d)) * (B.phase === 'omen' ? smoothstep(0, 1, f) : 1) * 0.75; storm = 1; break;
        case 'skymaw': M.animate(t, { flap: B.phase === 'sky' ? 0.35 : 0.08, speed: 1.2 }); if (B.phase === 'sky' && d < 200 && Math.random() < dt * 0.4) G.audio.beastCall('skymaw', 0.5); break;
        case 'drownedking': M.animate(t, { swing: B.phase === 'risen' ? 1.5 : 0.5 }); break;
        case 'serpent': M.animate(t, { wave: 0.014, coil: B.phase === 'close' ? 1 : 0.4 }); break;
        case 'glassback': M.animate(t, { fade: G.isNight() ? 1 : 0.35 }); break;
        case 'stormeater': M.animate(t, { flap: B.fedT > 0 ? 0.06 : 0.2 }); storm = 1; dark = (1 - smoothstep(200, 700, d)) * 0.35; break;
        case 'mirrorfish': { const seen = this.mirrorSeen(P.eye); M._vis = damp(M._vis ?? 0, seen ? 1 : 0, 2, dt); M.animate(t, { vis: M._vis }); break; }
        case 'trenchwalker': M._reach = damp(M._reach ?? 0, B.phase === 'reaching' ? 1 : 0, 0.7, dt); M.animate(t, { reach: M._reach }); break;
        default: M.animate(t, {});
      }
      // splashes where it breaks the surface
      if (M._y > -S * 0.15 && M._y < S * 0.05 && Math.random() < dt * 5) G.fx.splash(B.x + (Math.random() - 0.5) * S * 0.4, sea, B.z + (Math.random() - 0.5) * S * 0.4, 2);
      if (B.id === 'skymaw' && B.phase === 'sky') { const sh = this._shadow(); sh.visible = true; sh.position.set(B.x, G.world.sea(B.x, B.z) + 0.1, B.z); sh.scale.setScalar(S * 0.7); sh.rotation.y = B.h; }
      else if (this._sh) this._sh.visible = false;
      // first sighting: a quiet name card, and the journal page opens
      if (d < 320 && !this._seenNow) { this._seenNow = B.id; if (!G.state.s.beastSeen?.[B.id]) G.act({ t: 'beastSeen', id: B.id }); G.ui.banner(D.name.toUpperCase(), D.title, 'leviathan', 4); G.audio.beastCall(B.id, 1); }
      if (d < 600 && Math.random() < dt * 0.05) G.audio.beastCall(B.id, 0.4 * (1 - d / 600));
    } else {
      this._seenNow = null;
      if (this.m) { G.scene.remove(this.m.group); this.m = null; this.mId = null; }
      if (this._sh) this._sh.visible = false;
    }
    this.dark = damp(this.dark, dark, 0.6, dt);
    this.stormForce = storm;
  }

  _shadow() {
    if (this._sh) return this._sh;
    const g = new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2);
    this._sh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    this._sh.scale.set(1, 1, 1); this._sh.renderOrder = 3;
    this.game.scene.add(this._sh);
    return this._sh;
  }

  /* ================= fishing ================= */
  /** Can the beast be hooked at `pos` right now, by this fisher? */
  _fishable(B, pos) {
    const G = this.game, D = B.def;
    if (D.bait && G.state.s.bait !== D.bait) return false;
    switch (D.fishWhen) {
      case 'risen': return B.phase === 'risen';
      case 'under': return B.phase === 'under';
      case 'close': return B.phase === 'close';
      case 'above': return G.isNight() && Math.hypot(pos.x - B.x, pos.z - B.z) < 35;
      case 'fed': return B.fedT > 0;
      case 'surfaced': return B.phase === 'surfaced';
      case 'seen': return this.mirrorSeen(G.player.eye);
      case 'reaching': return B.phase === 'reaching';
    }
    return true;
  }
  claim(pos) {
    const G = this.game, B = this.b;
    if (!B || B.hooked || B.phase === 'leave') return null;
    const D = B.def;
    if (Math.hypot(pos.x - B.x, pos.z - B.z) > D.size * 0.6 + 50) return null;
    const auto = !!G.admin?.autoCatch;
    if (!auto && (!this._fishable(B, pos) || B.wary > 0)) return { refused: true, quiet: true, text: B.wary > 0 ? D.name + ' is wary of your line after the last one.' : D.tell };
    if (auto || Math.random() < D.hook) {
      G.act({ t: 'beastHook', by: G.player.id });
      B.hooked = G.player.id;
      return { sp: 'beast:' + D.id, kg: Math.round(D.size * D.size * D.size * 0.5), cm: D.size * 100, size: 1, giant: true, great: D.id, creature: 'beast', fight: D.fight, pace: D.pace, cap: D.cap, power: 5 };
    }
    return { refused: true, quiet: true, text: D.name + ' takes an interest in your bait... then lets it go. Keep trying.' };
  }
  landed(from) {
    const G = this.game, s = G.state.s, B = this.b;
    if (!B) return;
    const D = B.def;
    s.beasts = s.beasts || {};
    const first = !s.beasts[D.id];
    s.beasts[D.id] = { n: (s.beasts[D.id]?.n || 0) + 1, day: s.day };
    (s.beastSeen = s.beastSeen || {})[D.id] = s.day;
    this.b = null; this.cool = 600;
    G.award('beast:' + D.id, from);
    const pay = first ? D.reward : Math.round(D.reward * 0.35);
    G.state.earn(pay, 'beast');
    G._everyone({ t: 'greatCaught', id: D.id, beast: true, first, by: G.playerById(from)?.name || 'Someone', reward: pay });
    G._changed();
  }
  released() { const B = this.b; if (B) { B.hooked = null; B.wary = 30; } }

  /* ================= per frame ================= */
  update(dt, host) {
    if (host) { this._director(dt); this._host(dt); }
    // a dragging monster pulls the line toward itself, not the other way round
    const B = this.b, F = this.game.fishing;
    if (B && B.hooked === this.game.player.id && B.def.drags && F.fish) { const P = this.game.player; F.fish.bearing = Math.atan2(B.x - P.pos.x, B.z - P.pos.z); }
    this._draw(dt);
  }

  snapshot() { const B = this.b; return B ? [B.id, +B.x.toFixed(1), +B.z.toFixed(1), +B.h.toFixed(3), B.phase, B.ci, +B.pt.toFixed(2), B.hooked || 0, +B.fedT.toFixed(1)] : null; }
  applySnapshot(s) {
    if (s === undefined) return;
    if (!s) { this.b = null; return; }
    const [id, x, z, h, phase, ci, pt, hooked, fedT] = s;
    if (!this.b || this.b.id !== id) this.b = { id, def: BEAST_BY_ID[id], x, z, h, t: 0 };
    const B = this.b;
    if (B.hooked !== this.game.player.id || B.def.drags) { B.x = lerp(B.x, x, 0.3); B.z = lerp(B.z, z, 0.3); B.h = h; }
    Object.assign(B, { phase, ci, pt, hooked: hooked || null, fedT });
  }
}

/* ---------------- the Whalefall's road ---------------- */
function segD(px, pz, a, b) {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const t = clamp(((px - a[0]) * vx + (pz - a[1]) * vz) / (vx * vx + vz * vz), 0, 1);
  return { d: Math.hypot(px - a[0] - vx * t, pz - a[1] - vz * t), t, x: a[0] + vx * t, z: a[1] + vz * t };
}
export function routeDist(x, z) {
  let best = 1e9;
  for (let i = 0; i < WHALE_ROUTE.length; i++) best = Math.min(best, segD(x, z, WHALE_ROUTE[i], WHALE_ROUTE[(i + 1) % WHALE_ROUTE.length]).d);
  return best;
}
function routeNearest(x, z) {
  let best = null;
  for (let i = 0; i < WHALE_ROUTE.length; i++) {
    const a = WHALE_ROUTE[i], b = WHALE_ROUTE[(i + 1) % WHALE_ROUTE.length], s = segD(x, z, a, b);
    if (!best || s.d < best.d) best = { ...s, h: Math.atan2(b[0] - a[0], b[1] - a[1]), i };
  }
  return best;
}
function routeAhead(x, z, ahead) {
  const n = routeNearest(x, z);
  return { x: n.x + Math.sin(n.h) * ahead, z: n.z + Math.cos(n.h) * ahead };
}
