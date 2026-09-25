/* Boat.js - a boat you can stand in, drive, overload, set on fire and sink.

   Conventions (pinned, used everywhere):
     mesh.rotation.y = heading, Euler order YXZ
     forward (bow) = local +Z = (sin h, cos h) in world XZ
     local +X is PORT (left when facing the bow)
     steer input +1 = turn LEFT = heading increases

   The host simulates; clients receive snapshots and interpolate. Players
   aboard store their position in the boat's LOCAL frame, so the boat moving
   under them carries them with it for free.

   Floating: the wave function is sampled at bow, stern, port and starboard.
   Height is the average, pitch and roll come from the differences, and all
   three chase their targets through a spring, so a boat rides a swell
   instead of snapping to it. */

import * as THREE from '../../lib/three.module.js?v=1790356418';
import { buildBoat } from '../art/BoatArt.js?v=1790356418';
import { boatStats, HULL_BY_ID } from '../data/BoatData.js?v=1790356418';
import { heightAt, iceAt, ICE_Y } from '../world/Terrain.js?v=1790356418';
import { waveAmp } from '../world/MapData.js?v=1790356418';
import { clamp, damp, wrapAngle, lerp, rng } from '../core/Util.js?v=1790356418';
import { MeshBuilder } from '../art/Geo.js?v=1790356418';
import { Bus } from '../core/Bus.js?v=1790356418';

const _v = new THREE.Vector3();
const MAT_HOLE = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
let _holeGeo = null;
/** A ragged hole punched through planks: a dark gap ringed with splinters. */
function holeGeo() {
  if (_holeGeo) return _holeGeo;
  const b = new MeshBuilder(rng(9));
  const n = 11, r = rng(4);
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = 0.2 + r() * 0.12; pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.75]); }
  b.color(0x0a0806);
  for (let i = 0; i < n; i++) b.tri([0, 0, 0.012], [pts[i][0], pts[i][1], 0.012], [pts[(i + 1) % n][0], pts[(i + 1) % n][1], 0.012]);
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i], l = Math.hypot(x, y);
    b.color(i % 2 ? 0xc8a070 : 0xa87a4a).card([x, y, 0.014], [x + x / l * 0.1 + (r() - 0.5) * 0.04, y + y / l * 0.1, 0.05 + r() * 0.06], [pts[(i + 1) % n][0], pts[(i + 1) % n][1], 0.014]);
  }
  _holeGeo = b.build();
  return _holeGeo;
}

export class Boat {
  constructor(game, cfg, id = 'boat') {
    this.game = game;
    this.id = id;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector2();
    this.heading = 0;
    this.yawRate = 0;
    this.y = 0; this.vy = 0;
    this.pitch = 0; this.roll = 0; this.vp = 0; this.vr = 0;
    this.throttle = 0; this.steer = 0;
    this.driver = null;
    this.docked = true;
    this.mooring = null;
    this.fires = [];
    this.leaks = [];
    this.water = 0;
    this.sinking = 0;
    this.tow = new THREE.Vector2();
    this.bumpT = 0;
    this.stolen = false;
    this.group = null;
    this.setConfig(cfg);
    this.hp = this.stats.hp;
  }

  setConfig(cfg) {
    const keep = this.group ? { hp: this.hp / this.stats.hp } : null;
    if (this.group) {
      this.game.scene.remove(this.group);
      this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    this.cfg = JSON.parse(JSON.stringify(cfg));
    this.holes = [];
    const art = buildBoat(this.cfg);
    this.art = art;
    this.group = art.group;
    this.group.rotation.order = 'YXZ';
    this.parts = art.parts;
    this.hull = art.hull;
    this.stats = art.stats;
    this.sections = art.sections;
    this.game.scene.add(this.group);
    if (keep) this.hp = Math.round(this.stats.hp * keep.hp);
    // lights
    if (this.spot) { this.group.remove(this.spot); this.spot = null; }
    if (this.stats.lights >= 2) {
      const sp = new THREE.SpotLight(0xfff2d0, 0, 90, 0.42, 0.4, 1.2);
      const L = this.hull.lights[0];
      sp.position.set(L[0], this.hull.deck + L[1], L[2]);
      sp.target.position.set(0, -2, 40);
      this.group.add(sp); this.group.add(sp.target);
      this.spot = sp;
    }
    this.lampSrc = { pos: new THREE.Vector3(), color: 0xffe0a8, intensity: 0.8 + this.stats.lights * 0.9, dist: 10 + this.stats.lights * 10 };
    // local obstacles on deck (for players walking about)
    const H = this.hull;
    this.obstacles = [];
    if (H.cabin && H.cabin.open) this.obstacles.push({ x: 0, z: H.cabin.z, hw: H.cabin.hw * 0.55, hd: H.cabin.hl * 0.6 });
    else if (H.cabin) {
      // walk-in wheelhouse: walls, and a door in the back
      const C = H.cabin, t = 0.12, d = 0.6;
      this.obstacles.push({ x: 0, z: C.z + C.hl - 0.35, hw: C.hw * 0.6, hd: 0.28 });          // console
      for (const sx of [-1, 1]) this.obstacles.push({ x: sx * (C.hw - t / 2), z: C.z, hw: t, hd: C.hl });
      for (const sx of [-1, 1]) this.obstacles.push({ x: sx * (d + (C.hw - d) / 2), z: C.z - C.hl, hw: (C.hw - d) / 2, hd: t });
    }
    this.obstacles.push({ x: H.cooler[0], z: H.cooler[2], hw: 0.45, hd: 0.35 });
    if (H.fuel) this.obstacles.push({ x: H.fuel[0], z: H.fuel[2], hw: 0.28, hd: 0.2 });
    this._updateMatrix();
  }

  get deck() { return this.hull.deck; }

  /** Half-width of the walkable deck at local z. */
  halfWidth(lz) {
    const S = this.sections;
    const t = clamp((lz + this.hull.hl) / (this.hull.hl * 2), 0, 1) * (S.length - 1);
    const i = Math.min(S.length - 2, Math.floor(t)), f = t - i;
    return lerp(S[i].w, S[i + 1].w, f) * 0.9;
  }
  railY(lz) {
    const S = this.sections;
    const t = clamp((lz + this.hull.hl) / (this.hull.hl * 2), 0, 1) * (S.length - 1);
    const i = Math.min(S.length - 2, Math.floor(t)), f = t - i;
    return lerp(S[i].g, S[i + 1].g, f);
  }
  /** Is a local point over the deck? */
  over(lx, lz, margin = 0) {
    if (lz < -this.hull.hl + 0.1 || lz > this.hull.hl - 0.2) return false;
    return Math.abs(lx) < this.halfWidth(lz) - margin;
  }

  forward() { return _v.set(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  speed() { return this.vel.length(); }
  fwdSpeed() { return this.vel.x * Math.sin(this.heading) + this.vel.y * Math.cos(this.heading); }

  _updateMatrix() {
    const g = this.group;
    g.position.set(this.pos.x, this.y, this.pos.z);
    g.rotation.set(this.pitch, this.heading, this.roll);
    g.updateMatrixWorld(true);
    this.inv = this.inv || new THREE.Matrix4();
    this.inv.copy(g.matrixWorld).invert();
  }
  toWorld(v, out = new THREE.Vector3()) { return out.copy(v).applyMatrix4(this.group.matrixWorld); }
  toLocal(v, out = new THREE.Vector3()) { return out.copy(v).applyMatrix4(this.inv); }

  /** Cargo mass in kg (fish on deck + in the cooler). */
  cargoKg() { return this.game.loot ? this.game.loot.massOn(this) : 0; }

  /* ---------------- simulation (host) ---------------- */
  simulate(dt, world) {
    if (this.sinking > 0) return this._sinkStep(dt, world);
    const H = this.hull, st = this.stats;
    const load = clamp(this.cargoKg() / Math.max(1, st.cargoKg), 0, 2);
    const over = Math.max(0, load - 1);
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    let vf = this.vel.x * sh + this.vel.y * ch;
    let vr = this.vel.x * ch - this.vel.y * sh;
    const hurt = this.hp < st.hp * 0.25 ? 0.6 : 1;
    const maxSp = st.speed * hurt * (1 - over * 0.45) * (1 - this.water * 0.6);
    const acc = st.accel * hurt;
    const thr = this.driver || this.autopilot ? this.throttle : 0;
    const drag = acc / Math.max(1, maxSp);
    vf += (thr * acc - vf * drag * (thr === 0 ? 1.4 : 1)) * dt;
    if (thr < 0) vf = Math.max(vf, -maxSp * 0.35);
    vr *= Math.exp(-2.8 * dt);
    const steer = this.driver || this.autopilot ? this.steer : 0;
    const turnF = clamp(Math.abs(vf) / 3.5, 0.2, 1) * (vf < -0.2 ? -1 : 1);
    // a flooded boat is heavy and slow to answer the helm
    this.yawRate = damp(this.yawRate, steer * st.turn * turnF * (1 - over * 0.3) * (1 - this.water * 0.6), 3.5 * (1 - this.water * 0.5), dt);
    this.heading = wrapAngle(this.heading + this.yawRate * dt);
    this.vel.set(vf * sh + vr * ch, vf * ch - vr * sh);
    // external pulls: towing fish, whirlpools, thieves
    this.vel.x += this.tow.x * dt; this.vel.y += this.tow.y * dt;
    this.tow.set(0, 0);
    // anchored when nobody is driving: kill drift
    if (!this.driver && !this.autopilot) this.vel.multiplyScalar(Math.exp(-0.8 * dt));
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.y * dt;
    this.pos.x = nx; this.pos.z = nz;
    this._collide(dt, world);
    // docking
    if (!this.driver && !this.autopilot && this.mooring && this.docked) {
      const m = this.mooringTarget();
      this.pos.x = damp(this.pos.x, m.x, 2, dt); this.pos.z = damp(this.pos.z, m.z, 2, dt);
      this.heading = this.heading + wrapAngle(m.h - this.heading) * (1 - Math.exp(-2 * dt));
      this.vel.set(0, 0);
    }
    this._float(dt, world, load);
    this._hazards(dt, world);
    this._updateMatrix();
  }

  mooringTarget() {
    const m = this.mooring;
    const side = Math.sign(m.pos.x - m.board.x) || 1;
    return { x: m.pos.x + side * (this.hull.hw - 0.85), z: m.pos.z, h: m.heading };
  }

  _float(dt, world, load) {
    const H = this.hull;
    const f = this.forward();
    const lx = Math.cos(this.heading), lz = -Math.sin(this.heading);   // local +X (port) in world
    const L = H.hl * 0.8, W = H.hw * 0.9;
    const px = this.pos.x, pz = this.pos.z;
    const hb = world.sea(px + f.x * L, pz + f.z * L);
    const hs = world.sea(px - f.x * L, pz - f.z * L);
    const hp = world.sea(px + lx * W, pz + lz * W);
    const hsb = world.sea(px - lx * W, pz - lz * W);
    const sink = this.water * H.deck * 0.9 + clamp(load, 0, 2) * 0.12 + (this.hp <= 0 ? 0.3 : 0);
    const ty = (hb + hs + hp + hsb) / 4 - sink;
    const tp = -Math.atan2(hb - hs, 2 * L) * 0.9;
    const tr = Math.atan2(hp - hsb, 2 * W) * 0.9;
    // spring toward the targets; heavier boats respond slower
    const k = 40 / Math.sqrt(H.mass / 250), c = 7;
    this.vy += ((ty - this.y) * k - this.vy * c) * dt;
    this.vp += ((tp - this.pitch) * k * 1.2 - this.vp * c) * dt;
    this.vr += ((tr + this.yawRate * this.fwdSpeed() * 0.012 - this.roll) * k * 1.2 - this.vr * c) * dt;
    this.y += this.vy * dt; this.pitch += this.vp * dt; this.roll += this.vr * dt;
    // speed lifts the bow a little
    this.pitch -= clamp(this.fwdSpeed() / this.stats.speed, 0, 1) * 0.04 * dt * 10 * dt;
  }

  /** A shove from outside: ram, wave, explosion. */
  impulse(dx, dz, spin = 0, lift = 0) {
    this.vel.x += dx; this.vel.y += dz;
    this.vr += spin; this.vy += lift; this.vp += (Math.random() - 0.5) * Math.abs(spin);
  }

  _collide(dt, world) {
    const H = this.hull;
    const f = this.forward();
    const lx = Math.cos(this.heading), lz = -Math.sin(this.heading);
    const pts = [
      [0, H.hl * 0.95], [H.hw * 0.7, H.hl * 0.5], [-H.hw * 0.7, H.hl * 0.5],
      [H.hw * 0.9, 0], [-H.hw * 0.9, 0], [H.hw * 0.85, -H.hl * 0.9], [-H.hw * 0.85, -H.hl * 0.9],
    ];
    let px = 0, pz = 0, n = 0;
    for (const [ax, az] of pts) {
      const wx = this.pos.x + lx * ax + f.x * az, wz = this.pos.z + lz * ax + f.z * az;
      let g = heightAt(wx, wz);
      if (g < ICE_Y && iceAt(wx, wz)) g = 1;
      const lim = -H.draft * 0.7;
      if (g > lim) {
        // push away from this contact, toward the hull centre
        const dx = this.pos.x - wx, dz = this.pos.z - wz, d = Math.hypot(dx, dz) || 1;
        const pen = Math.min(1.5, (g - lim) * 0.6 + 0.05);
        px += dx / d * pen; pz += dz / d * pen; n++;
      }
    }
    // static colliders (rocks, piers, wrecks) with three circles along the keel
    for (const k of [-0.6, 0, 0.6]) {
      const cx = this.pos.x + f.x * H.hl * k, cz = this.pos.z + f.z * H.hl * k;
      const r = world.colliders.resolve(cx, cz, H.hw * 0.85, this.y - H.draft, H.deck + 0.4);
      if (r.hit) { px += r.x - cx; pz += r.z - cz; n++; }
    }
    // world edge
    const E = 1290;
    if (Math.abs(this.pos.x) > E) { px -= Math.sign(this.pos.x) * (Math.abs(this.pos.x) - E); n++; }
    if (Math.abs(this.pos.z) > E) { pz -= Math.sign(this.pos.z) * (Math.abs(this.pos.z) - E); n++; }
    if (n) {
      this.pos.x += px; this.pos.z += pz;
      const l = Math.hypot(px, pz) || 1;
      const nx = px / l, nz = pz / l;
      const vn = this.vel.x * nx + this.vel.y * nz;
      if (vn < 0) {
        const hit = -vn;
        this.vel.x -= vn * nx * 1.3; this.vel.y -= vn * nz * 1.3;
        if (hit > 3.2 && this.bumpT <= 0) {
          this.bumpT = 0.8;
          const dmg = (hit - 3) * 6 * (H.id === 'dinghy' ? 1.2 : 1);
          this.damage(dmg, 'crash');
          this.vr += (Math.random() - 0.5) * 0.4;
          Bus.emit('boat:crash', { boat: this, force: hit });
        }
      }
    }
    this.bumpT -= dt;
  }

  damage(amount, why = '') {
    if (this.sinking > 0 || amount <= 0 || !isFinite(amount)) return;
    this.hp = Math.max(0, this.hp - amount);
    // heavy hits open leaks
    if (amount > 8 && this.leaks.length < 6 && Math.random() < Math.min(0.9, amount / 30)) {
      const H = this.hull;
      const z = (Math.random() * 2 - 1) * H.hl * 0.8, side = Math.random() < 0.5 ? -1 : 1;
      this.leaks.push({ x: side * this.halfWidth(z) * 0.95, y: H.deck + 0.05, z, size: 0.5 + Math.random() * 0.7, fix: 0 });
      Bus.emit('boat:leak', { boat: this });
    }
    Bus.emit('boat:damage', { boat: this, amount, why });
  }

  ignite(lx, lz) {
    if (this.fires.length >= 6 || this.sinking) return;
    this.fires.push({ x: lx, z: lz, t: 0, i: 0.4 });
    Bus.emit('boat:fire', { boat: this });
  }

  _hazards(dt, world) {
    const st = this.stats;
    // heavy seas
    const amp = waveAmp(this.pos.x, this.pos.z) * (1 + world.storm * 1.6);
    const excess = amp - st.waves;
    if (excess > 0) {
      this.water += excess * 0.02 * dt;
      this.seaT = (this.seaT || 0) - dt;
      if (this.seaT <= 0) {
        this.seaT = 3 + Math.random() * 3;
        this.damage(excess * 9, 'waves');
        Bus.emit('boat:wave', { boat: this, excess });
      }
    }
    // leaks
    // holes below the waterline: small ones seep, big ones pour
    for (const L of this.leaks) this.water += (L.size * L.size * 0.012 + 0.002) * (1 - L.fix * 0.6) * dt;
    // fires
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const F = this.fires[i];
      F.t += dt;
      F.i = Math.min(1.6, F.i + dt * 0.05);
      this.damage(F.i * 2.2 * dt, 'fire');
      if (world.storm > 0.3) F.i -= dt * 0.08 * world.storm;
      if (this.water > 0.35) F.i -= dt * 0.3;
      if (F.i <= 0) { this.fires.splice(i, 1); continue; }
      if (F.t > 7 && Math.random() < dt * 0.12 * F.i) {
        const nz = clamp(F.z + (Math.random() - 0.5) * 2.4, -this.hull.hl * 0.8, this.hull.hl * 0.8);
        this.ignite(clamp(F.x + (Math.random() - 0.5) * 1.6, -this.halfWidth(nz) * 0.8, this.halfWidth(nz) * 0.8), nz);
        F.t = 0;
      }
    }
    this.water = clamp(this.water, 0, 1.05);
    if ((this.water >= 1 || this.hp <= 0) && !this.sinking) this.startSinking();
  }

  startSinking() {
    this.sinking = 0.001;
    this.driver = null;
    Bus.emit('boat:sink', { boat: this });
  }

  _sinkStep(dt, world) {
    this.sinking += dt;
    this.y -= dt * 0.9;
    this.pitch += dt * 0.12;
    this.roll += dt * 0.08;
    this._updateMatrix();
    if (this.sinking > 7) this.respawn(true);
  }

  respawn(towed = false) {
    const m = this.game.homeMooring();
    this.mooring = m;
    const t = this.mooringTarget();
    this.pos.set(t.x, 0, t.z);
    this.heading = t.h;
    this.vel.set(0, 0); this.yawRate = 0;
    this.y = 0; this.vy = 0; this.pitch = 0; this.roll = 0; this.vp = 0; this.vr = 0;
    this.sinking = 0; this.water = 0; this.fires = []; this.leaks = [];
    this.hp = Math.max(this.hp, Math.round(this.stats.hp * (towed ? 0.6 : 1)));
    this.docked = true; this.driver = null; this.stolen = false; this.autopilot = null;
    this._updateMatrix();
    if (towed) Bus.emit('boat:towed', { boat: this });
  }

  /** Called by players/driver input. */
  control(throttle, steer) {
    this.throttle = clamp(throttle, -0.5, 1);
    this.steer = clamp(steer, -1, 1);
    if (Math.abs(throttle) > 0.05) this.docked = false;
  }

  /** Visual per-frame work, run on every peer. */
  visuals(dt, fx, world, night) {
    const sp = this.speed();
    // propeller
    if (this.parts.prop) this.parts.prop.rotation.z += dt * (4 + Math.abs(this.throttle) * 40);
    if (this.parts.prop2) this.parts.prop2.rotation.z -= dt * (4 + Math.abs(this.throttle) * 40);
    if (this.parts.engine && this.hull.engine === 'outboard') this.parts.engine.rotation.y = -this.steer * 0.35;
    if (this.parts.wheel) this.parts.wheel.children[0] && (this.parts.wheel.children[0].rotation.z = this.steer * 1.4);
    // wake and spray
    if (sp > 1.5 && this.sinking === 0) {
      const f = this.forward();
      const H = this.hull;
      for (const side of [-1, 1]) {
        const lx = Math.cos(this.heading) * side * H.hw, lz = -Math.sin(this.heading) * side * H.hw;
        fx.wake(this.pos.x - f.x * H.hl * 0.9 + lx, this.y, this.pos.z - f.z * H.hl * 0.9 + lz, this.vel.x, this.vel.y, Math.min(1, sp / 8));
      }
      if (sp > 6 && Math.random() < 0.4) fx.wake(this.pos.x + f.x * H.hl, this.y + 0.2, this.pos.z + f.z * H.hl, this.vel.x, this.vel.y, 1);
    }
    // fires
    for (const F of this.fires) {
      const w = this.toWorld(_v.set(F.x, this.deck + 0.05, F.z));
      fx.fire(w.x, w.y, w.z, F.i);
    }
    // leaks: a real hole in the side - splintered planks, a dark gap, and
    // sea water spraying in; the bigger the hole, the harder it comes
    this.holes = this.holes || [];
    while (this.holes.length < this.leaks.length) { const m = new THREE.Mesh(holeGeo(), MAT_HOLE); this.group.add(m); this.holes.push(m); }
    this.holes.forEach((m, i) => {
      const L = this.leaks[i];
      m.visible = !!L;
      if (!L) return;
      const side = Math.sign(L.x) || 1;
      m.position.set(side * (this.halfWidth(L.z) / 0.9 - 0.02), this.deck - 0.05, L.z);
      m.rotation.set(0, side * Math.PI / 2, 0);
      m.scale.setScalar((0.55 + L.size * 0.7) * (1 - L.fix * 0.7));
      if (Math.random() < 0.5 + L.size * 0.4) {
        const w = this.toWorld(_v.set(L.x * 0.92, this.deck + 0.05 + this.water * this.deck * 0.9, L.z));
        fx.water(w.x, w.y, w.z, -Math.cos(this.heading) * side * 0.35, 0.25, Math.sin(this.heading) * side * 0.35);
      }
    });
    // flooding sheet
    const fl = this.parts.flood;
    fl.visible = this.water > 0.02;
    fl.position.y = this.deck + 0.02 + this.water * Math.min(0.5, this.art.rail * 0.8);
    // lights
    const dark = world.darkAt ? world.darkAt(this.pos.x, this.pos.z) : 0;
    const want = this.stats.lights > 0 ? Math.min(1, night * 1.4 + dark) : 0;
    this.lampSrc.pos.set(0, this.deck + 1.6, this.hull.hl * 0.3).applyMatrix4(this.group.matrixWorld);
    this.lampOn = want > 0.05;
    this.lampSrc.intensity = (0.8 + this.stats.lights * 0.9) * want;
    if (this.spot) this.spot.intensity = want * (this.stats.lights >= 3 ? 90 : 45);
  }

  /* ---------------- sync ---------------- */
  snapshot() {
    return {
      id: this.id, x: +this.pos.x.toFixed(2), z: +this.pos.z.toFixed(2), h: +this.heading.toFixed(3), y: +this.y.toFixed(3),
      p: +this.pitch.toFixed(3), r: +this.roll.toFixed(3), vx: +this.vel.x.toFixed(2), vz: +this.vel.y.toFixed(2),
      hp: Math.round(this.hp), w: +this.water.toFixed(3), sk: +this.sinking.toFixed(2), th: +this.throttle.toFixed(2), st: +this.steer.toFixed(2),
      dr: this.driver, f: this.fires.map(F => [+F.x.toFixed(2), +F.z.toFixed(2), +F.i.toFixed(2)]), l: this.leaks.map(L => [+L.x.toFixed(2), +L.z.toFixed(2), +L.size.toFixed(2), +L.fix.toFixed(2)]),
      dk: this.docked ? 1 : 0, cfg: this.cfgKey(),
    };
  }
  cfgKey() { return JSON.stringify(this.cfg); }
  applySnapshot(s, dt) {
    if (s.cfg && s.cfg !== this.cfgKey()) { try { this.setConfig(JSON.parse(s.cfg)); } catch (e) { /* ignore bad cfg */ } }
    // interpolate toward the host's state
    const k = 1 - Math.exp(-12 * dt);
    const dx = s.x - this.pos.x, dz = s.z - this.pos.z;
    if (Math.hypot(dx, dz) > 12) { this.pos.x = s.x; this.pos.z = s.z; }
    else { this.pos.x += dx * k + s.vx * dt; this.pos.z += dz * k + s.vz * dt; }
    this.heading += wrapAngle(s.h - this.heading) * k;
    this.y += (s.y - this.y) * k; this.pitch += (s.p - this.pitch) * k; this.roll += (s.r - this.roll) * k;
    this.vel.set(s.vx, s.vz);
    this.hp = s.hp; this.water = s.w; this.sinking = s.sk; this.throttle = s.th; this.steer = s.st; this.driver = s.dr; this.docked = !!s.dk;
    this.fires = s.f.map(a => ({ x: a[0], z: a[1], i: a[2], t: 0 }));
    this.leaks = s.l.map(a => ({ x: a[0], y: this.deck + 0.05, z: a[1], size: a[2], fix: a[3] }));
    this._updateMatrix();
  }
}
