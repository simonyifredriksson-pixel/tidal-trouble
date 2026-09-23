/* Loot.js - every catch is a physical object.

   A fish you land stays where it lands: flopping on the deck, sliding to
   the low side when the boat rolls, going over the rail if something
   explodes next to it. Thirty fish and your boat looks like a disaster,
   exactly as promised. The cooler holds a few out of the way; the rest is
   your problem.

   The host simulates, peers render snapshots. Items on a boat keep LOCAL
   coordinates so they ride the boat.

   Behaviours (FishData `beh`):
     bomb    fuse lights when it lands; explodes; throw it in the water and
             it goes off underwater instead, stunning fish that float up
     puffer  inflates and floats away into the sky unless someone grabs it
     mimic   lands as a chest; open it and it bites
     chest   a real chest: coins and bait
     eel     touching it electrocutes you (gloves help)
     bottle  a message; reading it adds a page to the story
     slap    handled at landing: it goes for your face */

import * as THREE from '../../lib/three.module.js?v=1790185859';
import { FISH_BY_ID, fishValue } from '../data/FishData.js?v=1790185859';
import { fishMesh, buildJunk } from '../art/FishArt.js?v=1790185859';
import { MAT } from '../art/Materials.js?v=1790185859';
import { clamp, uid } from '../core/Util.js?v=1790185859';
import { Bus } from '../core/Bus.js?v=1790185859';

const G = 9.8;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
let chestGeo = null;

export class Loot {
  constructor(game) {
    this.game = game;
    this.items = new Map();
    this.group = new THREE.Group();
    this.group.name = 'loot';
    game.scene.add(this.group);
  }

  /* ---------------- creation ---------------- */
  spawn(o) {
    const sp = FISH_BY_ID[o.sp];
    if (!sp) return null;
    const it = {
      id: o.id || uid('l'), sp: o.sp, kg: o.kg, cm: o.cm, mult: o.mult || 1,
      pos: new THREE.Vector3().copy(o.pos), vel: new THREE.Vector3().copy(o.vel || _v.set(0, 0, 0)),
      yaw: o.yaw ?? Math.random() * 6.28, roll: 0, spinY: (Math.random() - 0.5) * 6, spinR: (Math.random() - 0.5) * 8,
      boat: null, local: new THREE.Vector3(), held: null, state: 'free', t: 0, flop: o.flop ?? (sp.junk ? 0 : 22),
      inWater: 0, fuse: -1, puff: 0, mimic: sp.beh === 'mimic', opened: false, shockT: 0, stunned: !!o.stunned,
      caughtBy: o.by || null, grounded: false, owner: o.owner || null, v: o.v || null, zone: o.zone || 0,
    };
    it.r = sp.junk ? 0.3 : clamp(it.cm / 200, 0.12, 2.5);
    this._mesh(it);
    this.items.set(it.id, it);
    if (o.boat) this._attach(it, o.boat);
    return it;
  }

  _mesh(it) {
    const sp = FISH_BY_ID[it.sp];
    if (it.mesh) this.group.remove(it.mesh);
    let m;
    if (it.mimic && !it.opened) {
      // the disguise: a treasure chest
      if (!chestGeo) chestGeo = buildJunk('chest');
      m = new THREE.Group();
      const c = new THREE.Mesh(chestGeo.solid, MAT.solid);
      c.castShadow = true;
      m.add(c);
      m.scale.setScalar(0.75);
    } else {
      m = fishMesh(sp, it.cm / 100, { variant: it.v });
    }
    it.mesh = m;
    it.baseScale = m.scale.x;
    this.group.add(m);
  }

  get(id) { return this.items.get(id); }

  remove(it, fx = null) {
    if (!it) return;
    this.group.remove(it.mesh);
    this.items.delete(it.id);
    if (fx === 'splash') this.game.fx.splash(it.pos.x, it.pos.y, it.pos.z, 0.6);
  }

  _attach(it, boat) {
    it.boat = boat;
    boat.toLocal(it.pos, it.local);
    // velocity into boat frame (rotation only)
    const inv = new THREE.Matrix3().setFromMatrix4(boat.inv);
    it.vel.applyMatrix3(inv);
    it.vel.x -= 0; it.state = 'free';
  }
  _detach(it) {
    const b = it.boat;
    if (!b) return;
    b.toWorld(it.local, it.pos);
    const rot = new THREE.Matrix3().setFromMatrix4(b.group.matrixWorld);
    it.vel.applyMatrix3(rot);
    it.vel.x += b.vel.x; it.vel.z += b.vel.y;
    it.boat = null;
  }

  massOn(boat) {
    let kg = 0;
    for (const it of this.items.values()) if (it.boat === boat) kg += it.kg;
    return kg;
  }
  onBoat(boat, includeCooler = true) {
    const out = [];
    for (const it of this.items.values()) if (it.boat === boat && (includeCooler || it.state !== 'cooler')) out.push(it);
    return out;
  }
  coolerCount(boat) {
    let n = 0;
    for (const it of this.items.values()) if (it.boat === boat && it.state === 'cooler') n++;
    return n;
  }

  nearest(pos, r = 2.5, filter = null) {
    let best = null, bd = r;
    for (const it of this.items.values()) {
      if (it.held || it.state === 'cooler') continue;
      if (filter && !filter(it)) continue;
      const d = it.pos.distanceTo(pos) - it.r * 0.5;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  /* ---------------- actions (host) ---------------- */
  pickUp(it, pid) {
    if (!it || it.held) return false;
    if (it.kg > 450) return false;
    it.held = pid;
    it.puff = Math.min(it.puff, 0.5);
    return true;
  }
  drop(it, pos, vel) {
    if (!it) return;
    it.held = null;
    it.pos.copy(pos); it.vel.copy(vel);
    it.boat = null;
    it.t = Math.min(it.t, 1);
    it.grounded = false;
    const b = this.game.boatAt(pos, 1.2);
    if (b) this._attach(it, b);
  }
  toCooler(it, boat) {
    const cap = [6, 12, 24, 48][boat.cfg.parts?.storage || 0];
    if (this.coolerCount(boat) >= cap) return false;
    if (it.kg > 60) return false;
    it.held = null; it.boat = boat; it.state = 'cooler';
    boat.toLocal(boat.toWorld(_v.set(...boat.hull.cooler)), it.local);
    it.mesh.visible = false;
    return true;
  }

  /* ---------------- simulation ---------------- */
  update(dt, host) {
    const world = this.game.world;
    for (const it of [...this.items.values()]) {
      it.t += dt;
      it.shockT = Math.max(0, it.shockT - dt);
      if (it.held) { this._held(it); continue; }
      if (it.state === 'cooler') { it.mesh.visible = false; continue; }
      it.mesh.visible = true;
      if (!host) { this._pose(it); continue; }
      if (it.boat) this._simBoat(it, dt);
      else this._simWorld(it, dt, world);
      this._behave(it, dt);
      if (this.items.has(it.id)) this._pose(it);
    }
  }

  _held(it) {
    const holder = this.game.playerById(it.held);
    if (!holder) { it.held = null; return; }
    const hp = holder.holdPoint(it);
    it.pos.copy(hp.pos);
    it.yaw = hp.yaw;
    it.boat = null;
    it.mesh.position.copy(it.pos);
    it.mesh.rotation.set(0, it.yaw, hp.roll || 0);
    it.mesh.visible = !hp.hidden;
  }

  _simBoat(it, dt) {
    const b = it.boat;
    const L = it.local, V = it.vel;
    const deck = b.deck + it.r * 0.25;
    // gravity and the slope of the deck
    V.y -= G * dt;
    const onFloor = L.y <= deck + 0.02;
    if (onFloor) {
      V.x += -G * Math.sin(b.roll) * 0.7 * dt;
      V.z += G * Math.sin(b.pitch) * 0.7 * dt;
      const fr = Math.exp(-(it.flop > 0 ? 2 : 4) * dt);
      V.x *= fr; V.z *= fr;
    }
    L.addScaledVector(V, dt);
    if (L.y < deck) { L.y = deck; if (V.y < 0) V.y = -V.y * 0.25; }
    // hull walls
    const hw = b.halfWidth(L.z) - it.r * 0.3;
    const rail = b.railY(L.z);
    if (Math.abs(L.x) > hw) {
      if (L.y < rail + 0.1) { L.x = Math.sign(L.x) * hw; V.x *= -0.3; }
      else if (Math.abs(L.x) > hw + 0.5) { this._detach(it); return; }       // over the side
    }
    const hl = b.hull.hl - 0.3;
    if (Math.abs(L.z) > hl) {
      if (L.y < rail + 0.1) { L.z = Math.sign(L.z) * hl; V.z *= -0.3; }
      else if (Math.abs(L.z) > hl + 0.6) { this._detach(it); return; }
    }
    // deck obstacles
    for (const o of b.obstacles) {
      const dx = L.x - o.x, dz = L.z - o.z;
      if (Math.abs(dx) < o.hw + 0.1 && Math.abs(dz) < o.hd + 0.1 && L.y < deck + 0.8) {
        if (o.hw - Math.abs(dx) < o.hd - Math.abs(dz)) { L.x = o.x + Math.sign(dx) * (o.hw + 0.1); V.x *= -0.3; }
        else { L.z = o.z + Math.sign(dz) * (o.hd + 0.1); V.z *= -0.3; }
      }
    }
    b.toWorld(L, it.pos);
    if (b.sinking > 1.5) { this._detach(it); }
  }

  _simWorld(it, dt, world) {
    const P = it.pos, V = it.vel;
    const sp = FISH_BY_ID[it.sp];
    const sea = world.waterAt(P.x, P.z);
    const inWater = P.y < sea;
    if (inWater) {
      it.inWater += dt;
      const floaty = sp.junk || it.stunned || sp.beh === 'puffer' || sp.beh === 'bomb';
      V.y += (floaty ? (sea - P.y) * 25 - V.y * 4 : -2) * dt;
      V.x *= Math.exp(-2 * dt); V.z *= Math.exp(-2 * dt);
      if (it.inWater < dt * 1.5 && Math.abs(V.y) > 2) this.game.fx.splash(P.x, sea, P.z, clamp(it.kg / 20, 0.4, 3));
      // a live fish that goes back in the water swims away
      if (!floaty && it.inWater > 1.2) { Bus.emit('loot:escaped', { it }); this.remove(it, 'splash'); return; }
      if (it.stunned && it.t > 45) { this.remove(it, 'splash'); return; }
    } else {
      it.inWater = 0;
      V.y -= G * dt;
    }
    P.addScaledVector(V, dt);
    let g = world.ground(P.x, P.z);
    const fl = world.colliders.floorAt(P.x, P.z, P.y + 0.3, 0.8);
    if (fl > g) g = fl;
    const floor = g + it.r * 0.25;
    if (P.y < floor && !(inWater && g < sea)) {
      P.y = floor;
      if (V.y < 0) { if (V.y < -3) this.game.fx.smoke(P.x, P.y, P.z, 0xb8a888); V.y = -V.y * 0.2; }
      V.x *= Math.exp(-5 * dt); V.z *= Math.exp(-5 * dt);
      it.grounded = true;
    }
    if (inWater && P.y < g + it.r * 0.25) P.y = g + it.r * 0.25;
    // landing on a boat
    if (V.y <= 0) {
      const b = this.game.boatAt(P, 0.3);
      if (b) {
        const L = b.toLocal(P, _w);
        if (L.y < b.deck + 2.5 && L.y > b.deck - 0.4) this._attach(it, b);
      }
    }
    // cap lifetime of items abandoned on land far from anyone
    if (it.t > 900 && !it.boat) this.remove(it);
  }

  _behave(it, dt) {
    const sp = FISH_BY_ID[it.sp];
    const G2 = this.game;
    // flopping
    if (it.flop > 0 && !sp.junk && !(it.mimic && !it.opened) && !it.stunned) {
      it.flop -= dt;
      if (Math.random() < dt * (0.9 + it.flop * 0.05) && it.kg < 300) {
        const f = clamp(4 / Math.sqrt(it.kg + 1), 0.4, 3.2);
        const up = f * (0.8 + Math.random() * 0.8);
        if (it.boat) { it.vel.y += up * 0.5; it.vel.x += (Math.random() - 0.5) * f * 0.45; it.vel.z += (Math.random() - 0.5) * f * 0.45; }
        else if (it.grounded) { it.vel.y += up; it.vel.x += (Math.random() - 0.5) * f; it.vel.z += (Math.random() - 0.5) * f; it.grounded = false; }
        it.spinR = (Math.random() - 0.5) * 14; it.spinY = (Math.random() - 0.5) * 6;
        if (Math.random() < 0.5) G2.audio?.flop(it.pos);
      }
    }
    it.yaw += it.spinY * dt; it.spinY *= Math.exp(-3 * dt);
    it.roll += it.spinR * dt; it.spinR *= Math.exp(-4 * dt);
    if (it.flop <= 0 || it.stunned) it.roll += ((it.stunned ? Math.PI : Math.PI / 2) - it.roll) * Math.min(1, dt * 3);
    else it.roll += (Math.PI / 2 - it.roll) * Math.min(1, dt * 1.2);

    if (sp.beh === 'bomb') {
      const wet = it.inWater > 0;
      if (it.fuse < 0 && it.t > 0.4 && !wet) { it.fuse = 4.5; Bus.emit('bomb:lit', { it }); }
      if (it.fuse >= 0) {
        it.fuse -= dt;
        if (Math.random() < 0.6) G2.fx.sparks(it.pos.x, it.pos.y + it.r * 0.4, it.pos.z, 1, 0xffd24a);
        if (wet && it.fuse > 0.8) it.fuse = 0.8;
        if (it.fuse <= 0) { G2.explode(it.pos.clone(), wet ? 'water' : 'air', it); this.remove(it); return; }
      }
    }
    if (sp.beh === 'puffer' && !it.held) {
      if (it.t > 1.5 && it.puff < 1) it.puff = Math.min(1, it.puff + dt * 1.5);
      if (it.puff >= 1) {
        if (it.boat) this._detach(it);
        it.vel.y = 0.9 + Math.sin(it.t * 2) * 0.2; it.vel.x += Math.sin(it.t * 1.3) * dt; it.vel.z += Math.cos(it.t) * dt;
        it.pos.y += it.vel.y * dt * 0.1;
        if (it.t > 25) { G2.fx.sparks(it.pos.x, it.pos.y, it.pos.z, 12, 0xf0ecd0); Bus.emit('loot:floataway', { it }); this.remove(it); return; }
      }
    }
    if (sp.beh === 'eel') {
      for (const p of G2.allPlayers()) {
        if (it.shockT > 0) break;
        if (p.pos.distanceTo(it.pos) < 0.9 + it.r * 0.4) { it.shockT = 3; G2.shock(p, it); }
      }
    }
  }

  _pose(it) {
    const m = it.mesh;
    m.position.copy(it.pos);
    const sp = FISH_BY_ID[it.sp];
    const b = it.boat;
    const yaw = it.yaw + (b ? b.heading : 0);
    m.rotation.set(0, yaw, 0);
    m.rotateX(0);
    m.rotateZ(0);
    // lie on the side: rotate about the fish's own long axis (local X)
    if (!sp.junk && !(it.mimic && !it.opened)) m.rotateX(it.roll);
    const s = it.baseScale * (sp.beh === 'puffer' ? 1 + it.puff * 0.9 : 1);
    m.scale.setScalar(s);
  }

  /* ---------------- sync ---------------- */
  snapshot() {
    const out = [];
    for (const it of this.items.values()) {
      out.push([it.id, it.sp, +it.kg.toFixed(2), Math.round(it.cm), +it.pos.x.toFixed(2), +it.pos.y.toFixed(2), +it.pos.z.toFixed(2), +it.yaw.toFixed(2), +it.roll.toFixed(2),
        it.boat ? it.boat.id : 0, it.held || 0, it.state === 'cooler' ? 1 : 0, it.opened ? 1 : 0, +it.puff.toFixed(2), it.fuse > 0 ? 1 : 0, it.stunned ? 1 : 0, it.v || 0, +it.mult.toFixed(2), it.zone]);
    }
    return out;
  }
  applySnapshot(arr) {
    const seen = new Set();
    for (const a of arr) {
      const [id, sp, kg, cm, x, y, z, yaw, roll, boatId, held, cool, opened, puff, fuse, stunned, v, mult, zone] = a;
      seen.add(id);
      let it = this.items.get(id);
      if (!it) it = this.spawn({ id, sp, kg, cm, pos: _v.set(x, y, z), flop: 0, v: v || null, mult: mult || 1, zone: zone || 0 });
      if (!it) continue;
      it.pos.lerp(_w.set(x, y, z), 0.5);
      it.yaw = yaw; it.roll = roll; it.boat = boatId ? this.game.boatById(boatId) : null;
      it.held = held || null; it.state = cool ? 'cooler' : 'free'; it.puff = puff; it.stunned = !!stunned;
      if (!!opened !== it.opened) { it.opened = !!opened; this._mesh(it); }
      if (fuse && Math.random() < 0.5) this.game.fx.sparks(x, y + 0.2, z, 1, 0xffd24a);
    }
    for (const it of [...this.items.values()]) if (!seen.has(it.id)) this.remove(it);
  }

  /* ---------------- persistence (host) ---------------- */
  saveOnBoat(boat) {
    return this.onBoat(boat).map(it => ({ sp: it.sp, kg: it.kg, cm: it.cm, x: +it.local.x.toFixed(2), y: +it.local.y.toFixed(2), z: +it.local.z.toFixed(2), c: it.state === 'cooler' ? 1 : 0, m: it.mult, v: it.v, zn: it.zone }));
  }
  loadOnBoat(boat, list) {
    for (const o of list || []) {
      const it = this.spawn({ sp: o.sp, kg: o.kg, cm: o.cm, pos: boat.toWorld(_v.set(o.x, o.y, o.z)), flop: 0, mult: o.m, v: o.v, zone: o.zn });
      if (!it) continue;
      it.boat = boat; it.local.set(o.x, Math.max(o.y, boat.deck + 0.05), o.z); it.vel.set(0, 0, 0);
      if (o.c) { it.state = 'cooler'; it.mesh.visible = false; }
      it.roll = Math.PI / 2;
    }
  }

  value(it) { return fishValue(FISH_BY_ID[it.sp], it.kg, it.mult); }
}
