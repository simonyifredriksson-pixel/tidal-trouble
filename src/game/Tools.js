/* Tools.js - everything on the hotbar that is not the rod, plus the rod
   holders and the bow harpoon gun.

     harpoon  a spear on a rope: thrown, it flies, hits, and reels back
     net      a swing that scoops anything floating in front of you
     trap     a buoyed cage you leave in the water and come back to
     hammer   hold on a leak to fix it; on the deck it patches the hull
     bucket   throws water: fires go out, flooding goes overboard
     camera   takes a photo for your cabin wall
     grapple  fire at rock, wood or a hull and get yanked across
     auger    drills a hole in the ice for ice fishing
     holders  extra lines on the boat; a bell rings when one bites */

import * as THREE from '../../lib/three.module.js?v=1790185859';
import { MeshBuilder } from '../art/Geo.js?v=1790185859';
import { MAT } from '../art/Materials.js?v=1790185859';
import { buildRod, buildBobber } from '../art/RodArt.js?v=1790185859';
import { ROD_BY_ID } from '../data/GearData.js?v=1790185859';
import { pickSpecies, rollCatch } from './Fishing.js?v=1790185859';
import { zoneAt } from '../world/MapData.js?v=1790185859';
import { FISH_BY_ID } from '../data/FishData.js?v=1790185859';
import { clamp, damp, uid } from '../core/Util.js?v=1790185859';
import { Bus } from '../core/Bus.js?v=1790185859';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

function spearMesh(big = false) {
  const b = new MeshBuilder();
  const L = big ? 2.2 : 1.6;
  b.color(0x6a4a30).cyl(0.022, 0.022, 0, L, 5, true);
  b.color(0xa8aeb4).cone(big ? 0.08 : 0.05, L, L + (big ? 0.45 : 0.3), 4);
  b.color(0xa8aeb4).beam([0, L + 0.1, 0], [0.08, L - 0.02, 0], 0.014, 0.014);
  b.color(0xa8aeb4).beam([0, L + 0.1, 0], [-0.08, L - 0.02, 0], 0.014, 0.014);
  const m = new THREE.Mesh(b.build(), MAT.solid);
  m.castShadow = true;
  const g = new THREE.Group();
  m.rotation.x = Math.PI / 2;      // point along +Z
  g.add(m);
  return g;
}

function buoyMesh() {
  const b = new MeshBuilder();
  b.color(0xe03a2a).blob(0.22, 0.2, 0.22, 0, 0.1, 0, 7, 3);
  b.color(0xf4f0e8).cyl(0.2, 0.16, -0.15, 0.02, 7, true);
  b.color(0x3a3a3a).cyl(0.02, 0.02, 0.2, 0.9, 4, true);
  b.color(0xf2c14a).card([0, 0.9, 0], [0, 0.72, 0], [0.28, 0.82, 0]);
  const m = new THREE.Mesh(b.build(), MAT.solid);
  m.castShadow = true;
  return m;
}

function holeMesh() {
  const b = new MeshBuilder();
  b.color(0x0e2a38);
  for (let i = 0; i < 9; i++) { const a0 = i / 9 * Math.PI * 2, a1 = (i + 1) / 9 * Math.PI * 2; b.tri([0, 0, 0], [Math.cos(a1) * 0.55, 0, Math.sin(a1) * 0.55], [Math.cos(a0) * 0.55, 0, Math.sin(a0) * 0.55]); }
  b.color(0xf4fafc);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; b.lump(0.12, Math.cos(a) * 0.62, 0.02, Math.sin(a) * 0.62, 0.3, 0.5); }
  return new THREE.Mesh(b.build(), MAT.solid);
}

export class Tools {
  constructor(game) {
    this.game = game;
    this.spears = [];
    this.traps = new Map();     // id -> {id,x,z,t0,mesh}
    this.holes = new Map();
    this.cool = 0;
    this.busyT = 0;
    this.rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xc8b48a }));
    this.rope.frustumCulled = false; this.rope.visible = false;
    game.scene.add(this.rope);
    this.grap = null;
    this.holderRigs = [];
    this.holderState = [];      // host: per holder {t, biting, fish, bellT}
    this.flash = 0;
  }

  /* ---------------- per-frame (local player) ---------------- */
  update(dt, input, blocked) {
    const G = this.game, P = G.player;
    this.cool -= dt;
    const tool = P.tool;
    const click = !blocked && input.click(0);
    const hold = !blocked && input.btn(0);
    this.busy = false;

    if (P.mode === 'mount' && P.boat) { this._mount(dt, input, blocked); }
    else if (P.held) { /* hands full: LMB throws, handled by Game */ }
    else if (tool === 'harpoon' && click && this.cool <= 0) this.throwSpear(false);
    else if (tool === 'net' && click && this.cool <= 0) this._net();
    else if (tool === 'trap' && click && this.cool <= 0) this._placeTrap();
    else if (tool === 'camera' && click && this.cool <= 0) this._photo();
    else if (tool === 'grapple' && click && this.cool <= 0) this._grapple();
    else if (tool === 'bucket' && click && this.cool <= 0) this._bucket();
    else if (tool === 'hammer' && hold) this._hammer(dt);
    else if (tool === 'auger' && hold) this._auger(dt);
    else this.augerT = 0;

    this._spears(dt);
    this._grappleStep(dt);
    this._drawHolders(dt);
  }

  /* ---------------- harpoon ---------------- */
  throwSpear(fromMount, origin = null, dir = null, power = 1) {
    const G = this.game, P = G.player;
    const o = origin || G.vm.handWorld(G.camera, new THREE.Vector3());
    const d = dir || P.forward(new THREE.Vector3()).clone();
    const sp = { mesh: spearMesh(fromMount), pos: o.clone(), vel: d.clone().multiplyScalar(fromMount ? 46 : 26).add(new THREE.Vector3(0, fromMount ? 0.5 : 2, 0)), t: 0, back: false, hit: null, dmg: (fromMount ? 6 + power * 6 : 4), owner: P.id, mount: fromMount };
    if (P.boat) { sp.vel.x += P.boat.vel.x; sp.vel.z += P.boat.vel.y; }
    G.scene.add(sp.mesh);
    this.spears.push(sp);
    this.cool = fromMount ? 1.4 : 1.8;
    G.vm.play('throw');
    G.audio.throw();
    G.net?.sendEvent({ t: 'spear', o: o.toArray().map(v => +v.toFixed(2)), d: d.toArray().map(v => +v.toFixed(3)), m: fromMount ? 1 : 0 });
  }

  /** A spear thrown by a remote player: purely visual on our side. */
  ghostSpear(o, d, mount) {
    const sp = { mesh: spearMesh(mount), pos: new THREE.Vector3(...o), vel: new THREE.Vector3(...d).multiplyScalar(mount ? 46 : 26), t: 0, back: false, ghost: true };
    this.game.scene.add(sp.mesh);
    this.spears.push(sp);
  }

  _spears(dt) {
    const G = this.game;
    for (let i = this.spears.length - 1; i >= 0; i--) {
      const S = this.spears[i];
      S.t += dt;
      if (!S.back) {
        S.vel.y -= 9.8 * dt * (S.mount ? 0.4 : 1);
        const prev = S.pos.clone();
        S.pos.addScaledVector(S.vel, dt);
        const sea = G.world.waterAt(S.pos.x, S.pos.z);
        const gnd = G.world.ground(S.pos.x, S.pos.z);
        if (!S.ghost) {
          // creatures first: giants, leviathans, thieves, fish shadows
          const hit = G.creatures?.spearHit(prev, S.pos, S);
          if (hit) { S.back = true; S.hit = hit; G.fx.splash(S.pos.x, Math.max(sea, S.pos.y - 0.5), S.pos.z, 1.2); G.audio.thunk(); }
          const it = !hit && G.loot.nearest(S.pos, 1.0, it => !it.held);
          if (it) { S.back = true; S.carry = it; G.audio.thunk(); }
          const npc = !hit && G.events?.spearHitThief(S.pos);
          if (npc) S.back = true;
        }
        if (!S.back && sea > -Infinity && S.pos.y < sea) { G.fx.splash(S.pos.x, sea, S.pos.z, 0.6); S.vel.multiplyScalar(0.25); }
        if (!S.back && S.pos.y < gnd) { S.pos.y = gnd; S.back = true; G.audio.thunk(); }
        if (S.t > 1.6) S.back = true;
      } else {
        const home = S.ghost ? S.pos.clone().add(new THREE.Vector3(0, -50, 0)) : G.vm.handWorld(G.camera, _w);
        const to = _v.copy(home).sub(S.pos);
        const L = to.length();
        S.pos.addScaledVector(to.normalize(), Math.min(L, 22 * dt));
        if (S.carry && G.isHost) { S.carry.pos.copy(S.pos); S.carry.vel.set(0, 0, 0); S.carry.boat = null; }
        if (L < 1 || S.t > 4) {
          G.scene.remove(S.mesh);
          this.spears.splice(i, 1);
          if (S.carry) G.dropAtFeet(S.carry);
          continue;
        }
      }
      S.mesh.position.copy(S.pos);
      const v = S.back ? _v.copy(S.pos).sub(G.player.eye) : S.vel;
      if (v.lengthSq() > 0.01) S.mesh.lookAt(_w.copy(S.pos).add(v));
    }
    // the rope of our most recent spear
    const mine = this.spears.find(s => !s.ghost);
    this.rope.visible = !!mine || !!this.grap;
    if (mine) {
      const a = this.game.vm.handWorld(this.game.camera, _v);
      this.rope.geometry.setFromPoints([a.clone(), mine.pos.clone()]);
    }
  }

  _mount(dt, input, blocked) {
    const G = this.game, P = G.player, b = P.boat;
    const M = b.parts.mount;
    if (!M) { P.mode = 'walk'; return; }
    M.yaw.rotation.y = P.yaw - b.heading + Math.PI;
    M.pitch.rotation.x = -P.pitch;
    if (!blocked && input.click(0) && this.cool <= 0) {
      const muzzle = new THREE.Vector3();
      M.pitch.getWorldPosition(muzzle);
      this.throwSpear(true, muzzle.addScaledVector(P.forward(_v), 1.4), P.forward(new THREE.Vector3()).clone(), b.stats.mount);
      G.fx.smoke(muzzle.x, muzzle.y, muzzle.z, 0x8a8a8a);
    }
  }

  /* ---------------- net ---------------- */
  _net() {
    const G = this.game, P = G.player;
    this.cool = 0.7;
    G.vm.play('swing');
    G.audio.swoosh();
    const at = P.pos.clone().addScaledVector(P.flatForward(_v), 2);
    setTimeout(() => {
      let got = 0;
      // anything floating in front of you
      for (const it of [...G.loot.items.values()]) {
        if (it.held || it.boat || it.state === 'cooler') continue;
        if (it.pos.distanceTo(at) < 2.6) { G.act({ t: 'netLoot', id: it.id }); got++; }
      }
      if (G.creatures?.netHit(at)) got++;
      const sea = G.world.waterAt(at.x, at.z);
      if (sea > -Infinity && G.events.near('migration', at, 90) && Math.random() < 0.55) {
        const sp = pickSpecies({ region: G.world.region(at.x, at.z), water: G.isLake(at.x, at.z) ? 'lake' : 'sea', bait: 'worm', night: G.isNight(), migration: true });
        if (sp.rarity !== 'junk') { G.act({ t: 'netFish', c: rollCatch(sp, Math.random, 0, zoneAt(at.x, at.z)), x: at.x, z: at.z }); got++; }
      }
      if (sea > -Infinity) G.fx.splash(at.x, sea, at.z, 0.7);
      if (!got) G.ui.toast(sea > -Infinity ? 'Nothing in the net.' : 'You wave the net at the air.', 'info');
    }, 250);
  }

  /* ---------------- traps ---------------- */
  _placeTrap() {
    const G = this.game, P = G.player;
    const at = P.pos.clone().addScaledVector(P.flatForward(_v), 3.5);
    const sea = G.world.waterAt(at.x, at.z);
    if (sea === -Infinity || G.world.height(at.x, at.z) > -1) { G.ui.toast('Traps need water at least a metre deep.', 'warn'); return; }
    let mine = 0;
    for (const t of this.traps.values()) if (t.owner === P.id) mine++;
    if (mine >= 3) { G.ui.toast('You already have three traps out. Haul one in first.', 'warn'); return; }
    this.cool = 1;
    G.act({ t: 'trapPlace', x: at.x, z: at.z });
    G.fx.splash(at.x, sea, at.z, 0.7);
    G.audio.splash(0.5);
    G.ui.toast('Trap set. Come back in a few minutes.', 'good');
  }
  addTrap(o) {
    if (this.traps.has(o.id)) return;
    const m = buoyMesh();
    this.game.scene.add(m);
    this.traps.set(o.id, { ...o, mesh: m });
  }
  removeTrap(id) {
    const t = this.traps.get(id);
    if (!t) return;
    this.game.scene.remove(t.mesh);
    this.traps.delete(id);
  }
  nearestTrap(pos, r = 3.2) {
    let best = null, bd = r;
    for (const t of this.traps.values()) { const d = Math.hypot(t.x - pos.x, t.z - pos.z); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  trapReady(t) { return this.game.world.time - t.t0 > 150; }

  /* ---------------- ice holes ---------------- */
  _auger(dt) {
    const G = this.game, P = G.player;
    if (!G.world.onIce(P.pos.x, P.pos.z)) { if (!this.warned) G.ui.toast('The auger is for ice.', 'warn'); this.warned = true; return; }
    this.warned = false;
    this.busy = true;
    this.augerT = (this.augerT || 0) + dt;
    const at = P.pos.clone().addScaledVector(P.flatForward(_v), 1.2);
    if (Math.random() < 0.5) G.fx.sparks(at.x, 0.2, at.z, 1, 0xf4fafc);
    G.audio.drill();
    if (this.augerT > 1.4) {
      this.augerT = 0;
      if (this.nearestHole(at, 1.5)) { G.ui.toast('There is already a hole here.', 'info'); return; }
      G.act({ t: 'hole', x: at.x, z: at.z });
      G.fx.splash(at.x, 0.1, at.z, 0.4);
      G.ui.toast('Hole drilled. Fish it with your rod.', 'good');
    }
  }
  addHole(o) {
    if (this.holes.has(o.id)) return;
    const m = holeMesh();
    m.position.set(o.x, 0.155, o.z);
    this.game.scene.add(m);
    this.holes.set(o.id, { ...o, mesh: m });
  }
  nearestHole(pos, r = 3.5) {
    let best = null, bd = r;
    for (const h of this.holes.values()) { const d = Math.hypot(h.x - pos.x, h.z - pos.z); if (d < bd) { bd = d; best = h; } }
    return best;
  }

  /* ---------------- hammer and bucket ---------------- */
  _hammer(dt) {
    const G = this.game, P = G.player, b = P.boat;
    this.busy = true;
    if (!b) { if (!this.warned) G.ui.toast('Nothing to fix here.', 'info'); this.warned = true; return; }
    this.warned = false;
    const L = P.local;
    let leak = null, bd = 2.2;
    b.leaks.forEach((l, i) => { const d = Math.hypot(l.x - L.x, l.z - L.z); if (d < bd) { bd = d; leak = i; } });
    this.hamT = (this.hamT || 0) + dt;
    if (this.hamT > 0.2) { this.hamT = 0; G.audio.hammer(); const w = b.toWorld(_v.set(L.x, b.deck + 0.2, L.z)); G.fx.sparks(w.x, w.y, w.z, 3, 0xd8b890); }
    if (leak !== null) G.act({ t: 'fix', leak, dt });
    else if (b.hp < b.stats.hp) G.act({ t: 'patch', dt });
  }
  _bucket() {
    const G = this.game, P = G.player, b = P.boat;
    this.cool = 0.75;
    G.vm.play('throw');
    const f = P.forward(_v).clone();
    const hp = G.vm.handWorld(G.camera, new THREE.Vector3());
    G.fx.water(hp.x, hp.y, hp.z, f.x, f.y + 0.3, f.z);
    G.audio.slosh();
    G.act({ t: 'bucket', x: P.pos.x + f.x * 2, z: P.pos.z + f.z * 2 });
  }

  /* ---------------- camera ---------------- */
  _photo() {
    const G = this.game;
    this.cool = 1.2;
    const data = G.takePhoto();
    this.flash = 1;
    G.audio.shutter();
    if (data) { G.act({ t: 'photo', data }); G.ui.toast('Photo taken. It is on the wall of your cabin.', 'good'); }
  }

  /* ---------------- grapple ---------------- */
  _grapple() {
    const G = this.game, P = G.player;
    const o = P.eye.clone(), d = P.forward(new THREE.Vector3()).clone();
    let hit = null;
    for (let s = 1; s < 36; s += 0.5) {
      const p = o.clone().addScaledVector(d, s);
      const it = G.loot.nearest(p, 0.8);
      if (it) { hit = { p, item: it }; break; }
      if (p.y < G.world.ground(p.x, p.z) + 0.1) { hit = { p }; break; }
      const b = G.boatAt(p, 0.2);
      if (b && b !== P.boat) { hit = { p, boat: b }; break; }
      const near = G.world.colliders.near(p.x, p.z, 0.5);
      for (const c of near) if (p.y > c.y0 && p.y < c.y1 && (c.t === 'c' ? Math.hypot(p.x - c.x, p.z - c.z) < c.r : Math.abs(p.x - c.x) < c.hw + 0.2 && Math.abs(p.z - c.z) < c.hd + 0.2)) { hit = { p }; break; }
      if (hit) break;
    }
    this.cool = 1.5;
    G.vm.play('throw');
    G.audio.grapple();
    if (!hit) { G.ui.toast('Nothing to hook onto.', 'info'); return; }
    this.grap = { p: hit.p, t: 0, item: hit.item || null };
    if (!hit.item) { P.detach(); P.mode = 'walk'; }
  }
  _grappleStep(dt) {
    const g = this.grap;
    if (!g) return;
    const G = this.game, P = G.player;
    g.t += dt;
    const a = G.vm.handWorld(G.camera, _v);
    this.rope.geometry.setFromPoints([a.clone(), (g.item ? g.item.pos : g.p).clone()]);
    if (g.item) {
      G.act({ t: 'yank', id: g.item.id, to: P.pos.toArray() });
      if (g.t > 0.5) this.grap = null;
      return;
    }
    const to = _w.copy(g.p).sub(P.pos);
    const L = to.length();
    if (L < 1.5 || g.t > 1.3) { this.grap = null; P.vel.multiplyScalar(0.4); return; }
    to.normalize();
    P.vel.set(to.x * 18, to.y * 18 + 3, to.z * 18);
    P.onGround = false;
    if (P.mode === 'swim') P.mode = 'walk';
  }

  /* ---------------- rod holders (drawn by everyone, bitten on the host) ---------------- */
  hostHolders(dt) {
    const G = this.game;
    for (const b of G.boats) {
      const n = b.stats.holders;
      if (!b.holders) b.holders = [];
      while (b.holders.length < n) b.holders.push({ t: 25 + Math.random() * 30, bite: 0, c: null });
      b.holders.length = n;
      const crew = G.allPlayers().some(p => p.boat === b);
      for (const H of b.holders) {
        if (H.bite > 0) {
          H.bite -= dt;
          if (H.bite <= 0) { H.c = null; H.t = 25 + Math.random() * 30; Bus.emit('holder:missed', {}); }
          continue;
        }
        if (!crew || b.speed() > 1.2 || (G.state.s.baits[G.state.s.bait] || 0) <= 0) continue;
        H.t -= dt;
        if (H.t <= 0) {
          const w = b.toWorld(_v.set(0, 0, -b.hull.hl - 8));
          const water = G.isLake(w.x, w.z) ? 'lake' : 'sea';
          const sp = pickSpecies({ region: G.world.region(w.x, w.z), water, bait: G.state.s.bait, night: G.isNight(), lucky: G.state.has('lucky') });
          H.c = rollCatch(sp, Math.random, 0, zoneAt(w.x, w.z, -G.world.height(w.x, w.z)));
          H.bite = 8;
          G.audio.bell();
          G.ui.toast('A rod holder is bending! Press E at the holder.', 'good');
          Bus.emit('holder:bite', {});
        }
      }
    }
  }
  _drawHolders(dt) {
    const G = this.game;
    let k = 0;
    for (const b of G.boats) {
      const spots = b.parts.rodHolders || [];
      for (let i = 0; i < spots.length; i++) {
        let R = this.holderRigs[k];
        if (!R) {
          const rod = buildRod(ROD_BY_ID.basic);
          rod.group.scale.setScalar(0.9);
          const bob = buildBobber();
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xe8e8e0, transparent: true, opacity: 0.7 }));
          line.frustumCulled = false;
          G.scene.add(rod.group, bob, line);
          R = this.holderRigs[k] = { rod, bob, line };
        }
        const s = spots[i];
        const H = b.holders?.[i];
        const bite = H && H.bite > 0;
        R.rod.group.position.copy(b.toWorld(_v.set(s[0], s[1] - 0.3, s[2])));
        R.rod.group.quaternion.copy(b.group.quaternion);
        R.rod.group.rotateX(-0.9);
        R.rod.group.rotateZ(s[0] > 0 ? -0.35 : 0.35);
        R.rod.bend(bite ? 0.8 + Math.sin(G.world.time * 30) * 0.2 : 0.1, 0);
        R.rod.group.visible = true;
        R.rod.tip.getWorldPosition(_w);
        const bw = b.toWorld(new THREE.Vector3(s[0] * 3, 0, -b.hull.hl - 6 - i * 2));
        bw.y = G.world.sea(bw.x, bw.z) - (bite ? 0.3 : 0);
        R.bob.position.copy(bw);
        R.bob.visible = true; R.line.visible = true;
        R.line.geometry.setFromPoints([_w.clone(), bw]);
        R.spot = { boat: b, i, pos: R.rod.group.position.clone() };
        k++;
      }
    }
    for (let j = k; j < this.holderRigs.length; j++) { const R = this.holderRigs[j]; R.rod.group.visible = false; R.bob.visible = false; R.line.visible = false; R.spot = null; }
  }
  nearestHolder(pos) {
    let best = null, bd = 1.8;
    for (const R of this.holderRigs) {
      if (!R.spot) continue;
      const d = R.spot.pos.distanceTo(pos);
      if (d < bd) { bd = d; best = R.spot; }
    }
    return best;
  }
}
