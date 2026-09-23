/* Creatures.js - things that live in the water and are not (yet) loot.

   shadows   ambient fish under the surface near you. Cosmetic, per-client,
             but real enough to spear: a harpoon through a shadow is a catch
   thieves   the Thieffish that just stole your bait, running for it
   giants    world-event fish, 3-5 m long, host-simulated. They circle,
             breach, bump boats, and take any bait near them
   leviathan the encounter: RISE -> RAMPAGE (harpoon it while it surfaces,
             it rams and slams) -> TIRED (hook it now) -> HOOKED (the
             fight, harpoons still help) -> LANDED. Lose it and it goes
             back to rampaging; run far enough and it sinks away. */

import * as THREE from '../../lib/three.module.js?v=1790183165';
import { fishShadowGeo, shadowMat, buildLeviathan, swimMaterial } from '../art/CreatureArt.js?v=1790183165';
import { buildFish, fishMesh } from '../art/FishArt.js?v=1790183165';
import { GIANTS, FISH_BY_ID } from '../data/FishData.js?v=1790183165';
import { LEVIATHANS, LEV_BY_ID } from '../data/LeviathanData.js?v=1790183165';
import { pickSpecies, rollCatch } from './Fishing.js?v=1790183165';
import { clamp, damp, wrapAngle, lerp, uid } from '../core/Util.js?v=1790183165';
import { Bus } from '../core/Bus.js?v=1790183165';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

// leviathans fight through the ordinary rod code, so each gets a pseudo-species
for (const L of LEVIATHANS) {
  FISH_BY_ID['lev:' + L.id] = {
    id: 'lev:' + L.id, name: L.name, rarity: 'legendary', lev: true, beh: null, where: [L.region], water: 'any', time: 'any', bait: {},
    kg: [1, 1], cm: [L.size * 100, L.size * 100], value: L.reward,
    fight: { power: 1.6 + L.power * 0.28, stamina: (25 + L.stamina * 0.12) / 8, erratic: 0.45, jump: 0 },
    art: { h: 0.2, w: 0.14, back: L.colors.back, belly: L.colors.belly, fin: L.colors.fin, pat: 'none', patCol: L.colors.glow, tail: 'fork', extras: [] },
    blurb: L.story,
  };
}

export class Creatures {
  constructor(game) {
    this.game = game;
    this.shadows = [];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(fishShadowGeo(), shadowMat);
      m.visible = false; m.renderOrder = 1;
      game.scene.add(m);
      this.shadows.push({ m, pos: new THREE.Vector3(), h: 0, sp: 1, size: 0.5, t: 0, alive: false, target: null });
    }
    this.thieves = [];
    this.giants = new Map();
    this.lev = null;          // the current leviathan encounter
    this.meshes = new Map();  // id -> Object3D (for giants/lev on all peers)
  }

  /* ================= ambient shadows ================= */
  _shadows(dt) {
    const G = this.game, P = G.player;
    const c = P.pos;
    const ghostNight = G.isNight();
    for (const S of this.shadows) {
      if (!S.alive) {
        if (Math.random() > dt * 2) continue;
        const a = Math.random() * Math.PI * 2, d = 12 + Math.random() * 32;
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        const h = G.world.height(x, z);
        if (h > -1.2 || G.world.onIce(x, z)) continue;
        const reg = G.world.region(x, z);
        S.alive = true; S.pos.set(x, 0, z); S.h = Math.random() * 6.28; S.sp = 0.6 + Math.random() * 1.2; S.t = 0;
        S.size = reg === 'open' ? 0.6 + Math.random() * 1.6 : reg === 'black' ? 0.3 + Math.random() : 0.3 + Math.random() * 0.8;
        if (G.events.near('migration', S.pos, 120)) S.size *= 0.8;
        S.ghost = ghostNight && Math.random() < 0.08;
        S.depth = 0.4 + Math.random() * 1.5;
        S.m.scale.set(S.size, 1, S.size);
        S.m.visible = true;
      }
      S.t += dt;
      // steer: toward a lure if given, away from boats, otherwise wander
      let th = S.h + Math.sin(S.t * 0.7 + S.size) * 0.4;
      if (S.target && S.t < 6) { th = Math.atan2(S.target.x - S.pos.x, S.target.z - S.pos.z); if (S.pos.distanceTo(S.target) < 0.8) S.target = null; }
      for (const b of G.boats) {
        const d = Math.hypot(b.pos.x - S.pos.x, b.pos.z - S.pos.z);
        if (d < 6 + b.speed()) th = Math.atan2(S.pos.x - b.pos.x, S.pos.z - b.pos.z), S.sp = Math.max(S.sp, 3);
      }
      S.h += wrapAngle(th - S.h) * Math.min(1, dt * 2);
      S.sp = damp(S.sp, 0.8, 0.5, dt);
      S.pos.x += Math.sin(S.h) * S.sp * dt; S.pos.z += Math.cos(S.h) * S.sp * dt;
      const sea = G.world.waterAt(S.pos.x, S.pos.z);
      const far = Math.hypot(S.pos.x - c.x, S.pos.z - c.z) > 55;
      if (sea === -Infinity || G.world.height(S.pos.x, S.pos.z) > -0.8 || far || S.t > 40) { S.alive = false; S.m.visible = false; continue; }
      S.m.position.set(S.pos.x, sea - Math.min(S.depth, -G.world.height(S.pos.x, S.pos.z) - 0.2) * 0.35, S.pos.z);
      S.m.rotation.y = S.h - Math.PI / 2;
      const pd = Math.hypot(S.pos.x - c.x, S.pos.z - c.z);
      S.m.material = shadowMat;
      S.m.visible = !(S.ghost && pd < 10);
    }
  }

  /** A bobber landed: send a shadow or two over to look at it. */
  lureAt(pos) {
    let n = 0;
    for (const S of this.shadows) {
      if (!S.alive || n > 1) continue;
      if (S.pos.distanceTo(_v.set(pos.x, 0, pos.z)) < 25) { S.target = new THREE.Vector3(pos.x, 0, pos.z); S.t = 0; n++; }
    }
  }

  /* ================= thieves ================= */
  thiefRun(pos, bait) {
    const m = new THREE.Mesh(fishShadowGeo(), shadowMat);
    m.scale.set(0.5, 1, 0.5);
    this.game.scene.add(m);
    const h = Math.random() * 6.28;
    this.thieves.push({ m, pos: pos.clone(), h, t: 0, bait });
  }
  _thieves(dt) {
    const G = this.game;
    for (let i = this.thieves.length - 1; i >= 0; i--) {
      const T = this.thieves[i];
      T.t += dt;
      T.h += Math.sin(T.t * 3) * dt * 1.5;
      const nx = T.pos.x + Math.sin(T.h) * 2.4 * dt, nz = T.pos.z + Math.cos(T.h) * 2.4 * dt;
      if (G.world.waterAt(nx, nz) === -Infinity) T.h += Math.PI * dt * 4; else { T.pos.x = nx; T.pos.z = nz; }
      const sea = G.world.waterAt(T.pos.x, T.pos.z);
      T.m.position.set(T.pos.x, (sea > -Infinity ? sea : 0) - 0.3, T.pos.z);
      T.m.rotation.y = T.h - Math.PI / 2;
      if (Math.random() < dt * 6) G.fx.glint(T.pos.x, (sea > -Infinity ? sea : 0) + 0.05, T.pos.z, 0xfff0a0);
      if (T.t > 28) { G.scene.remove(T.m); this.thieves.splice(i, 1); }
    }
  }
  _catchThief(i) {
    const G = this.game, T = this.thieves[i];
    G.scene.remove(T.m);
    this.thieves.splice(i, 1);
    const sp = FISH_BY_ID.thief;
    G.act({ t: 'netFish', c: rollCatch(sp), x: T.pos.x, z: T.pos.z, thief: T.bait });
  }

  /* ================= hits from tools ================= */
  spearHit(a, b, spear) {
    const G = this.game;
    // thieves
    for (let i = 0; i < this.thieves.length; i++) if (segDist(this.thieves[i].pos, a, b) < 1.4) { this._catchThief(i); return { kind: 'thief' }; }
    // giants and leviathans (host decides the damage)
    for (const [id, g] of this.giants) if (segDist(g.pos, a, b) < g.len * 0.45) { G.act({ t: 'harpoon', id, dmg: spear.dmg }); return { kind: 'giant' }; }
    const L = this.lev;
    if (L && L.alive && segDist(L.pos, a, b) < L.size * 0.4 + 1.5) { G.act({ t: 'harpoon', id: 'lev', dmg: spear.dmg }); return { kind: 'lev' }; }
    // shadows: spearfishing
    for (const S of this.shadows) {
      if (!S.alive || S.m.visible === false) continue;
      if (segDist(S.m.position, a, b) < 0.6 + S.size * 0.3) {
        S.alive = false; S.m.visible = false;
        const x = S.pos.x, z = S.pos.z;
        const sp = pickSpecies({ region: G.world.region(x, z), water: G.isLake(x, z) ? 'lake' : 'sea', bait: 'pieces', night: G.isNight() });
        if (sp.rarity !== 'junk') G.act({ t: 'netFish', c: rollCatch(sp), x, z, spear: true });
        return { kind: 'shadow' };
      }
    }
    return null;
  }
  netHit(at) {
    for (let i = 0; i < this.thieves.length; i++) if (this.thieves[i].pos.distanceTo(_v.set(at.x, this.thieves[i].pos.y, at.z)) < 3) { this._catchThief(i); return true; }
    return false;
  }

  /* ================= giants (host) ================= */
  spawnGiant(near) {
    const G = this.game;
    const region = G.world.region(near.x, near.z);
    const pool = GIANTS.filter(g => g.where.includes(region));
    const sp = pool.length ? pool[Math.floor(Math.random() * pool.length)] : GIANTS[0];
    // find deep water near the target
    let pos = null;
    for (let k = 0; k < 40 && !pos; k++) {
      const a = Math.random() * 6.28, d = 25 + Math.random() * 30;
      const x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
      if (G.world.height(x, z) < -6 && !G.world.onIce(x, z)) pos = new THREE.Vector3(x, -3, z);
    }
    if (!pos) return null;
    const c = rollCatch(sp);
    const id = uid('g');
    const g = { id, sp: sp.id, kg: c.kg, cm: c.cm, len: c.cm / 100, pos, h: Math.random() * 6.28, t: 0, state: 'circle', target: near.clone(), bumpT: 6 + Math.random() * 6, breachT: 3, hooked: null, stun: 0, life: 150, rod: sp.rod };
    this.giants.set(id, g);
    G.fx.eruption(pos.x, 0, pos.z, 5);
    G.audio.roar(0.8);
    return g;
  }
  _hostGiants(dt) {
    const G = this.game;
    for (const [id, g] of this.giants) {
      g.t += dt; g.life -= dt; g.stun = Math.max(0, g.stun - dt);
      if (g.hooked) { g.life = Math.max(g.life, 20); continue; }        // position comes from the fisher
      const tgt = this.nearestCrew(g.pos) || g.target;
      g.target.copy(tgt);
      const dx = g.target.x - g.pos.x, dz = g.target.z - g.pos.z, d = Math.hypot(dx, dz) || 1;
      let want;
      if (g.state === 'charge') {
        want = Math.atan2(dx, dz);
        if (d < 3) { g.state = 'circle'; this._bump(g); }
      } else {
        // circle at ~18 m
        want = Math.atan2(dx, dz) + (d > 18 ? 0.8 : 1.9);
        g.bumpT -= dt;
        if (g.bumpT <= 0 && g.stun <= 0) { g.state = 'charge'; g.bumpT = 12 + Math.random() * 10; }
      }
      g.h += wrapAngle(want - g.h) * Math.min(1, dt * 1.2);
      const sp = g.state === 'charge' ? 9 : 5;
      const nx = g.pos.x + Math.sin(g.h) * sp * dt, nz = g.pos.z + Math.cos(g.h) * sp * dt;
      if (G.world.height(nx, nz) < -3) { g.pos.x = nx; g.pos.z = nz; } else g.h += 2 * dt;
      g.pos.y = damp(g.pos.y, g.state === 'charge' ? -0.6 : -2.2, 2, dt);
      g.breachT -= dt;
      if (g.breachT <= 0) { g.breachT = 10 + Math.random() * 12; g.breach = 1.4; G.net?.sendEvent({ t: 'fx', k: 'erupt', p: g.pos.toArray(), s: 4 }); G.fx.eruption(g.pos.x, 0, g.pos.z, 4); G.audio.roar(0.5); }
      if (g.breach > 0) g.breach -= dt;
      if (g.life <= 0) { this.giants.delete(id); Bus.emit('giant:left', { g }); }
    }
  }
  _bump(g) {
    const G = this.game;
    for (const b of G.boats) {
      if (Math.hypot(b.pos.x - g.pos.x, b.pos.z - g.pos.z) > 7) continue;
      const dx = b.pos.x - g.pos.x, dz = b.pos.z - g.pos.z, d = Math.hypot(dx, dz) || 1;
      b.impulse(dx / d * 3, dz / d * 3, 0.6, 1.5);
      b.damage(12, 'giant');
      G.fx.eruption(g.pos.x, 0, g.pos.z, 3);
      G.audio.crash();
      G.shakeAll(0.6);
      for (const p of G.allPlayers()) if (p.boat === b && Math.random() < 0.5) G.knockPlayer(p, new THREE.Vector3(dx / d, 0, dz / d), 4.2, 'giant');
      Bus.emit('giant:bump', { g, b });
    }
  }
  nearestCrew(pos) {
    let best = null, bd = 80;
    for (const p of this.game.allPlayers()) { const d = p.pos.distanceTo(pos); if (d < bd) { bd = d; best = p.pos; } }
    return best;
  }

  /** A bobber is waiting: does something big want it? Returns a catch spec or null. */
  claimBite(pos, fishing) {
    const G = this.game;
    for (const [id, g] of this.giants) {
      if (g.hooked) continue;
      if (Math.hypot(g.pos.x - pos.x, g.pos.z - pos.z) < 24) {
        const sp = FISH_BY_ID[g.sp];
        G.act({ t: 'giantHook', id, by: G.player.id });
        g.hooked = G.player.id;
        return { sp: g.sp, kg: g.kg, cm: g.cm, size: 0.5, giant: true, rod: g.rod, creature: id, power: sp.fight.power, staminaMax: sp.fight.stamina * 8 };
      }
    }
    const L = this.lev;
    if (L && L.phase === 'tired' && Math.hypot(L.pos.x - pos.x, L.pos.z - pos.z) < 30) {
      G.act({ t: 'levHook', by: G.player.id });
      return { sp: 'lev:' + L.id, kg: L.kg, cm: L.size * 100, size: 1, giant: true, lev: L.id, creature: 'lev', rod: L.def.rod, power: 1.6 + L.def.power * 0.28, staminaMax: 25 + L.def.stamina * 0.12 };
    }
    // lure points: all clues found, right place, right time
    if (!L && G.isHost !== false) {
      const ready = G.levAt(pos);
      if (ready) { G.act({ t: 'levRise', id: ready.id, x: pos.x, z: pos.z }); fishing._lose('Something ENORMOUS just took your line!'); return null; }
    }
    return null;
  }
  released(creatureId) {
    this.game.act({ t: 'creatureLost', id: creatureId });
  }
  landed(creatureId, F) {
    this.game.act({ t: 'creatureLanded', id: creatureId, kg: F.kg, cm: F.cm, sp: F.sp });
  }

  /* ================= leviathan (host) ================= */
  startLev(id, x, z) {
    const G = this.game;
    const def = LEV_BY_ID[id];
    if (!def || this.lev) return;
    this.lev = {
      id, def, size: def.size, kg: Math.round(def.size * def.size * def.size * 1.4), pos: new THREE.Vector3(x, -def.size * 0.3, z), h: Math.random() * 6.28,
      phase: 'rise', t: 0, armor: def.hp, armorMax: def.hp, stamina: 1, surface: 0, attackT: 5, alive: true, hooked: null, grab: null, lost: 0,
    };
    Bus.emit('lev:rise', { lev: this.lev });
  }
  _hostLev(dt) {
    const L = this.lev;
    if (!L) return;
    const G = this.game;
    L.t += dt;
    const crew = this.nearestCrew(L.pos);
    const tgt = crew ? crew.clone() : L.pos.clone();
    const dx = tgt.x - L.pos.x, dz = tgt.z - L.pos.z, d = Math.hypot(dx, dz) || 1;
    if (!crew || d > 320) { L.away = (L.away || 0) + dt; if (L.away > 8) return this._levEscape('It sank back into the deep.'); } else L.away = 0;
    const size = L.size;
    const turn = (want, rate) => { L.h += wrapAngle(want - L.h) * Math.min(1, dt * rate); };
    const move = (sp) => {
      const nx = L.pos.x + Math.sin(L.h) * sp * dt, nz = L.pos.z + Math.cos(L.h) * sp * dt;
      if (G.world.height(nx, nz) < -4 || L.def.water === 'ice') { L.pos.x = nx; L.pos.z = nz; } else L.h += dt * 1.5;
    };
    if (L.phase === 'rise') {
      L.pos.y = damp(L.pos.y, -size * 0.04, 1.2, dt);
      if (L.t < 0.1) { G.fx.eruption(L.pos.x, 0, L.pos.z, size * 0.4); G.audio.roar(1); }
      if (L.t > 4) { L.phase = 'rampage'; L.t = 0; }
    } else if (L.phase === 'rampage') {
      // circle, surface to be harpooned, then attack
      L.attackT -= dt;
      L.surface = Math.max(0, L.surface - dt);
      const ring = 24 + size * 0.4;
      if (L.charging) {
        turn(Math.atan2(dx, dz), 2.2); move(12 + size * 0.15);
        L.pos.y = damp(L.pos.y, -size * 0.05, 3, dt);
        if (d < size * 0.35 + 3) { L.charging = false; this._levAttack(L); }
        if (L.t > 8) L.charging = false;
      } else {
        turn(Math.atan2(dx, dz) + (d > ring ? 0.6 : 1.7), 1.0); move(6 + size * 0.05);
        L.pos.y = damp(L.pos.y, L.surface > 0 ? size * 0.01 : -size * 0.075, 1.5, dt);
        if (L.attackT <= 0) {
          L.attackT = 9 + Math.random() * 6;
          if (Math.random() < 0.5) { L.surface = 5; G.fx.eruption(L.pos.x, 0, L.pos.z, size * 0.25); G.ui.toast('It surfaced - harpoon it now!', 'good'); }
          else { L.charging = true; L.t = 0; G.ui.toast('It is coming straight for you!', 'bad'); }
        }
      }
      if (L.armor <= 0) { L.phase = 'tired'; L.t = 0; Bus.emit('lev:tired', { lev: L }); }
    } else if (L.phase === 'tired') {
      turn(Math.atan2(dx, dz) + 1.5, 0.6); move(3);
      L.pos.y = damp(L.pos.y, -size * 0.03, 1.5, dt);
      if (L.t > 70) { L.armor = L.armorMax * 0.5; L.phase = 'rampage'; G.ui.toast('It got its strength back!', 'bad'); }
    } else if (L.phase === 'hooked') {
      L.pos.y = damp(L.pos.y, -size * 0.06, 2, dt);
      // the fisher reports the fish position; we just drag the boat around
      L.attackT -= dt;
      if (L.attackT <= 0) { L.attackT = 14 + Math.random() * 8; if (d < size + 20) this._levAttack(L, true); }
    }
    // the kraken's arms and big creatures slapping the water
    if (L.grab) {
      L.grab.t += dt;
      const p = G.playerById(L.grab.pid);
      if (!p || L.grab.t > 3) { if (p) G.throwPlayer(p, L.pos, 8); L.grab = null; }
    }
  }
  _levAttack(L, light = false) {
    const G = this.game;
    const kind = L.def.kind;
    for (const b of G.boats) {
      const d = Math.hypot(b.pos.x - L.pos.x, b.pos.z - L.pos.z);
      if (d > L.size * 0.5 + 14) continue;
      const dx = b.pos.x - L.pos.x, dz = b.pos.z - L.pos.z, dl = Math.hypot(dx, dz) || 1;
      const hard = light ? 0.5 : 1;
      b.impulse(dx / dl * 5 * hard, dz / dl * 5 * hard, 0.9 * hard, 2.5 * hard);
      b.damage((14 + L.def.power * 3) * hard, 'leviathan');
      b.water = Math.min(1, b.water + 0.06 * hard);
      if (Math.random() < 0.25 && b.hull.fuel) { const f = b.hull.fuel; b.ignite(f[0], f[2]); G.ui.toast('The fuel tank is on fire!', 'bad'); }
      G.fx.eruption(b.pos.x, 0, b.pos.z, 6);
      G.audio.crash(); G.audio.roar(0.9);
      G.shakeAll(1);
      const crew = G.allPlayers().filter(p => p.boat === b);
      for (const p of crew) if (Math.random() < 0.6 * hard) G.knockPlayer(p, new THREE.Vector3(dx / dl, 0, dz / dl), 5, 'leviathan');
      if (kind === 'kraken' && crew.length && !L.grab && !light) {
        const victim = crew[Math.floor(Math.random() * crew.length)];
        L.grab = { pid: victim.id, t: 0 };
        G.ui.banner('A TENTACLE!', victim.id === G.player.id ? 'It has got you!' : (victim.name || 'Someone') + ' has been grabbed!');
      }
    }
  }
  _levEscape(text) {
    const L = this.lev;
    if (!L) return;
    this.game.ui.banner(L.def.name.toUpperCase(), text);
    this.lev = null;
    Bus.emit('lev:gone', {});
  }
  levHit(dmg) {
    const L = this.lev;
    if (!L) return;
    const vuln = L.surface > 0 || L.charging || L.phase !== 'rampage';
    const d = dmg * (vuln ? 1 : 0.3);
    if (L.phase === 'rampage') L.armor = Math.max(0, L.armor - d);
    if (L.phase === 'hooked') this.game.act({ t: 'staminaHit', by: L.hooked, n: d * 0.8 });
    this.game.fx.sparks(L.pos.x, 0.5, L.pos.z, 20, L.def.colors.glow);
    this.game.fx.splash(L.pos.x, 0, L.pos.z, 1.5);
  }

  /* ================= per frame ================= */
  update(dt, host) {
    this._shadows(dt);
    this._thieves(dt);
    if (host) { this._hostGiants(dt); this._hostLev(dt); }
    this._drawBig(dt);
  }

  _drawBig(dt) {
    const G = this.game;
    const live = new Set();
    for (const [id, g] of this.giants) {
      live.add(id);
      let m = this.meshes.get(id);
      if (!m) {
        const sp = FISH_BY_ID[g.sp];
        const geos = buildFish(sp.art, g.sp.length * 7);
        const mat = swimMaterial({ amp: 0.05, k: 7, speed: 4 });
        const body = new THREE.Mesh(geos.solid, mat);
        body.scale.setScalar(g.len);
        body.castShadow = true;
        m = new THREE.Group(); m.add(body);
        const sh = new THREE.Mesh(fishShadowGeo(), shadowMat); sh.scale.set(g.len * 1.2, 1, g.len * 1.2); sh.rotation.y = 0; m.add(sh); m.userData.shadow = sh;
        G.scene.add(m);
        this.meshes.set(id, m);
      }
      if (g.hooked === G.player.id && G.fishing.fish) { g.pos.x = G.fishing.bpos.x; g.pos.z = G.fishing.bpos.z; }
      const sea = G.world.sea(g.pos.x, g.pos.z);
      const y = g.breach > 0 ? sea + Math.sin((1.4 - g.breach) / 1.4 * Math.PI) * g.len * 0.9 - g.len * 0.2 : sea + g.pos.y;
      m.position.set(g.pos.x, y, g.pos.z);
      m.rotation.set(0, g.h - Math.PI / 2, g.breach > 0 ? Math.cos((1.4 - g.breach) / 1.4 * Math.PI) * 0.8 : 0);
      m.userData.shadow.position.y = sea - y - 0.3;
    }
    const L = this.lev;
    if (L) {
      live.add('lev');
      let m = this.meshes.get('lev');
      if (!m || m.userData.levId !== L.id) {
        if (m) G.scene.remove(m);
        const built = buildLeviathan(L.def);
        m = built.group; m.userData.built = built; m.userData.levId = L.id;
        G.scene.add(m);
        this.meshes.set('lev', m);
      }
      const B = m.userData.built;
      if (L.hooked === G.player.id && G.fishing.fish) { L.pos.x = G.fishing.bpos.x; L.pos.z = G.fishing.bpos.z; }
      const sea = G.world.sea(L.pos.x, L.pos.z);
      m.position.set(L.pos.x, sea + L.pos.y, L.pos.z);
      m.rotation.set(0, L.h - Math.PI / 2, 0);
      if (B.heart) { B.heart.material.opacity = 0.5 + Math.sin(G.world.time * 4) * 0.3 + (L.surface > 0 ? 0.3 : 0); }
      if (B.tentacles) {
        const t = G.world.time;
        B.tentacles.forEach((segs, i) => segs.forEach((s, k) => { s.rotation.x = Math.sin(t * 1.4 + i + k * 0.6) * 0.25 + 0.05 * k; s.rotation.z = Math.cos(t * 1.1 + i * 2 + k * 0.5) * 0.2; }));
      }
      if (B.flippers) B.flippers.forEach((f, i) => { f.rotation.x = Math.sin(G.world.time * 1.3 + i) * 0.4; });
      if (Math.random() < dt * 3) G.fx.splash(L.pos.x + (Math.random() - 0.5) * L.size * 0.5, sea, L.pos.z + (Math.random() - 0.5) * L.size * 0.5, 1.5);
    }
    for (const [id, m] of this.meshes) if (!live.has(id)) { G.scene.remove(m); this.meshes.delete(id); }
  }

  /* ================= sync ================= */
  snapshot() {
    const g = [];
    for (const [id, x] of this.giants) g.push([id, x.sp, +x.pos.x.toFixed(1), +x.pos.y.toFixed(2), +x.pos.z.toFixed(1), +x.h.toFixed(2), x.hooked || 0, +(x.breach || 0).toFixed(2), +x.len.toFixed(2)]);
    const L = this.lev;
    return { g, l: L ? [L.id, +L.pos.x.toFixed(1), +L.pos.y.toFixed(2), +L.pos.z.toFixed(1), +L.h.toFixed(2), L.phase, +L.armor.toFixed(1), L.armorMax, L.hooked || 0, +L.surface.toFixed(1)] : null };
  }
  applySnapshot(s, dt) {
    const seen = new Set();
    for (const a of s.g) {
      const [id, sp, x, y, z, h, hooked, breach, len] = a;
      seen.add(id);
      let g = this.giants.get(id);
      if (!g) { g = { id, sp, pos: new THREE.Vector3(x, y, z), h, len, kg: 0, cm: len * 100 }; this.giants.set(id, g); }
      if (hooked !== this.game.player.id) { g.pos.lerp(_v.set(x, y, z), 0.3); g.h = h; }
      g.hooked = hooked || null; g.breach = breach;
    }
    for (const id of [...this.giants.keys()]) if (!seen.has(id)) this.giants.delete(id);
    if (s.l) {
      const [id, x, y, z, h, phase, armor, armorMax, hooked, surface] = s.l;
      if (!this.lev || this.lev.id !== id) { const def = LEV_BY_ID[id]; this.lev = { id, def, size: def.size, kg: 0, pos: new THREE.Vector3(x, y, z), h, alive: true }; }
      const L = this.lev;
      if (hooked !== this.game.player.id) { L.pos.lerp(_v.set(x, y, z), 0.3); L.h = h; }
      L.phase = phase; L.armor = armor; L.armorMax = armorMax; L.hooked = hooked || null; L.surface = surface;
    } else this.lev = null;
  }
}

function segDist(p, a, b) {
  const ab = _w.copy(b).sub(a);
  const t = clamp(_v.copy(p).sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1);
  return _v.copy(a).addScaledVector(ab, t).distanceTo(p);
}
