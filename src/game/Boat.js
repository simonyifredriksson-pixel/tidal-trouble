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

import * as THREE from '../../lib/three.module.js';
import { buildBoat } from '../art/BoatArt.js';
import { boatStats, HULL_BY_ID, ANCHORS, anchorLoad } from '../data/BoatData.js';
import { buildAnchor, buildWindlass, Rope } from '../art/AnchorArt.js';
import { heightAt, iceAt, ICE_Y } from '../world/Terrain.js';
import { waveAmp, WORLD, HOME_CENTRE, stormAt } from '../world/MapData.js';
import { clamp, damp, wrapAngle, lerp, rng, smoothstep } from '../core/Util.js';
import { MeshBuilder } from '../art/Geo.js';
import { MAT } from '../art/Materials.js';
import { Bus } from '../core/Bus.js';

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const ST_CODE = ['stow', 'fly', 'sink', 'hang', 'set'];
const UP = new THREE.Vector3(0, 1, 0);
const MAT_HOLE = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
let _holeGeo = null;
/** A ragged hole punched through planks: a dark gap ringed with splinters. */
let _breakGeo = null;
/** A snapped rail: two jagged stumps and a hanging splintered plank. */
function breakGeo() {
  if (_breakGeo) return _breakGeo;
  const b = new MeshBuilder(rng(12));
  b.color(0xc8a070);
  for (const z of [-0.5, 0.5]) { b.box(0.08, 0.35, 0.08, 0, 0.17, z); b.cone(0.06, 0.35, 0.5, 4, 0, z); }
  b.color(0x8a6848).push(0.05, 0.1, 0.1, 0, 0, 0.9); b.box(0.06, 0.8, 0.12, 0, -0.3, 0); b.pop();
  b.color(0xe8c898); for (let k = 0; k < 5; k++) b.cone(0.03, 0.3, 0.42 + k * 0.03, 3, 0, -0.1 + k * 0.05);
  _breakGeo = b.build();
  return _breakGeo;
}
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
    this.anchor = { st: 'stow', p: new THREE.Vector3(), v: new THREE.Vector3(), len: 0, reelT: 0, drag: 0, crank: 0 };
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
    this.holes = []; this.breakMeshes = [];
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
    for (const [mx, mz] of H.masts || []) this.obstacles.push({ x: mx, z: mz, hw: 0.25, hd: 0.25 });
    if (H.hold) {
      const Hd = H.hold;
      // below deck: the mast feet, the pillars, the shelves, the workbench, the barrels
      this.holdObstacles = [
        ...(H.masts || []).filter(([, mz]) => mz > Hd.z0 && mz < Hd.z1).map(([mx, mz]) => ({ x: mx, z: mz, hw: 0.22, hd: 0.22 })),
        { x: 0, z: Hd.z0 + 2.2, hw: 0.16, hd: 0.16 }, { x: 0, z: Hd.z0 + 5.4, hw: 0.16, hd: 0.16 },
        { x: -Hd.hw + 0.3, z: -4, hw: 0.28, hd: 1.1 }, { x: -Hd.hw + 0.3, z: -1.4, hw: 0.28, hd: 1.1 },
        { x: Hd.hw - 0.5, z: -3.8, hw: 0.45, hd: 0.9 }, { x: Hd.hw - 0.9, z: Hd.z0 + 0.6, hw: 0.8, hd: 0.38 },
      ];
    }
    this.breaks = this.breaks || [];
    if (H.fuel) this.obstacles.push({ x: H.fuel[0], z: H.fuel[2], hw: 0.28, hd: 0.2 });
    // the anchor gear: a windlass on the foredeck, a roller on the stem, the
    // anchor hung on the rail beside it, and the rope for when it is out
    const alv = this.stats.anchor || 0, asc = clamp(0.45 + H.hl * 0.09, 0.55, 1.3);
    const [ax, az] = H.anchor;
    const wl = buildWindlass(alv, clamp(0.7 + H.hl * 0.05, 0.75, 1.2));
    wl.group.position.set(ax, H.deck, az);
    this.group.add(wl.group);
    this.windlass = wl; this.windlassR = wl.drumR;
    this.obstacles.push({ x: ax, z: az, hw: 0.3, hd: 0.2 });
    const rb = new MeshBuilder(rng(5)), rz = H.hl * 0.86, ry = this.railY(rz);
    rb.color(0x3a3a40).box(0.2, 0.06, 0.3, 0, ry - 0.02, rz);
    for (const s of [-1, 1]) rb.box(0.03, 0.14, 0.2, s * 0.09, ry + 0.04, rz);
    rb.color(0x9aa0a8).push(0, ry + 0.05, rz, 0, 0, Math.PI / 2); rb.cyl(0.04, 0.04, -0.07, 0.07, 6, true); rb.pop();
    this.group.add(new THREE.Mesh(rb.build(), MAT.solid));
    const sz = az - 0.1, side = ax > 0.05 ? 1 : ax < -0.05 ? -1 : 1;
    this.anchorStowed = buildAnchor(alv, asc);
    this.anchorStowed.position.set(side * (this.halfWidth(sz) / 0.9 + 0.05), this.railY(sz) - 0.02, sz);
    this.group.add(this.anchorStowed);
    if (this.anchorMesh) { this.game.scene.remove(this.anchorMesh); this.anchorMesh.traverse(o => o.geometry && o.geometry.dispose()); }
    this.anchorMesh = buildAnchor(alv, asc);
    this.anchorMesh.visible = false;
    this.game.scene.add(this.anchorMesh);
    if (!this.rope) this.rope = new Rope(this.game.scene, 20);
    this.rope.set(ANCHORS[alv].rope2, (ANCHORS[alv].chain ? 0.075 : 0.055) * asc);
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
  /** Not built yet (a new castaway has only the plans): not in the water, not boardable. */
  get absent() { return this.game.state?.s?.boat?.built === false; }
  simulate(dt, world) {
    if (this.absent) { this.group.visible = false; return; }
    this.group.visible = true;
    if (this.sinking > 0) return this._sinkStep(dt, world);
    const H = this.hull, st = this.stats;
    const load = clamp(this.cargoKg() / Math.max(1, st.cargoKg), 0, 2);
    const over = Math.max(0, load - 1);
    const sh = Math.sin(this.heading), ch = Math.cos(this.heading);
    let vf = this.vel.x * sh + this.vel.y * ch;
    let vr = this.vel.x * ch - this.vel.y * sh;
    // THE SEA MOVES: the current and the wind set a drift, and the engine and
    // the drag work in the water's frame, so a boat nobody drives goes where
    // the water goes and a driven one is set sideways as it crosses
    const cur = world.current ? world.current(this.pos.x, this.pos.z) : { x: 0, z: 0 };
    const wind = world.wind || { x: 0, z: 0 };
    const wk = 0.03 * (H.windage || 1) / Math.sqrt(H.mass / 900);
    // a keel, or a hull built for deep water, bites into it and is carried off far less
    const far = smoothstep(2500, 4000, Math.hypot(this.pos.x - HOME_CENTRE.x, this.pos.z - HOME_CENTRE.z));
    const grip = 1 - (st.keel || 0) * 0.22 - (st.deep || 0) * 0.3 * far;
    const fx = (cur.x + wind.x * wk) * grip, fz = (cur.z + wind.z * wk) * grip;
    this.flow = this.flow || new THREE.Vector2();
    this.flow.set(fx, fz);
    vf = (this.vel.x - fx) * sh + (this.vel.y - fz) * ch;
    vr = (this.vel.x - fx) * ch - (this.vel.y - fz) * sh;
    const hurt = (this.hp < st.hp * 0.25 ? 0.6 : 1) * (this.broken('engine') ? 0.45 : 1);
    const maxSp = st.speed * hurt * (1 - over * 0.45) * (1 - this.water * 0.6) * (1 + (st.deep || 0) * 0.08 * far);
    const acc = st.accel * hurt;
    const thr = this.driver || this.autopilot ? this.throttle : 0;
    const drag = acc / Math.max(1, maxSp);
    vf += (thr * acc - vf * drag * (thr === 0 ? 1.4 : 1)) * dt;
    if (thr < 0) vf = Math.max(vf, -maxSp * 0.35);
    vr *= Math.exp(-2.8 * dt);
    const steer = this.driver || this.autopilot ? this.steer : 0;
    const turnF = clamp(Math.abs(vf) / 3.5, 0.2, 1) * (vf < -0.2 ? -1 : 1);
    // a flooded boat is heavy and slow to answer the helm
    this.yawRate = damp(this.yawRate, steer * st.turn * turnF * (1 - over * 0.3) * (1 - this.water * 0.6) * (this.broken('wheel') ? 0.3 : 1), 3.5 * (1 - this.water * 0.5), dt);
    this.heading = wrapAngle(this.heading + this.yawRate * dt);
    this.vel.set(vf * sh + vr * ch + fx, vf * ch - vr * sh + fz);
    // external pulls: towing fish, whirlpools, thieves
    this.vel.x += this.tow.x * dt; this.vel.y += this.tow.y * dt;
    this.tow.set(0, 0);
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.y * dt;
    this.pos.x = nx; this.pos.z = nz;
    this._anchorStep(dt, world);
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

  /* ---------------- the anchor ----------------
     stow   on the bow rail
     fly    thrown: a projectile trailing its rope
     sink   dropping through the water, the rope paying out
     set    on the bottom. The boat may swing round it on `len` metres of
            rope; push harder than the anchor holds and it drags
     hang   off the bottom, swinging under the bow roller: it was hauled
            free, or the rope ran out before it found the bottom
     Hauling (reelT > 0) shortens the rope: first the boat is dragged up to
     the anchor, then it breaks out of the sea bed and comes up. */
  get anchorSpec() { return ANCHORS[this.stats.anchor || 0]; }
  get anchorOut() { return this.anchor.st !== 'stow'; }
  /** The bow roller the rope runs over, in world space. */
  rollerWorld(out = new THREE.Vector3()) { const z = this.hull.hl * 0.86; return this.toWorld(out.set(0, this.railY(z) + 0.05, z), out); }

  throwAnchor(p, v) {
    const A = this.anchor;
    if (A.st !== 'stow' || this.docked) return false;
    A.st = 'fly'; A.p.copy(p); A.v.copy(v); A.len = 0.5; A.drag = 0; A.reelT = 0;
    Bus.emit('anchor:throw', { boat: this });
    return true;
  }
  /** Let a hanging anchor drop again. */
  dropAnchor() { const A = this.anchor; if (A.st === 'hang' && A.len < this.anchorSpec.rope - 0.5) { A.st = 'sink'; A.v.set(0, 0, 0); return true; } return false; }
  haulAnchor(t = 0.3) { if (this.anchor.st !== 'stow') this.anchor.reelT = t; }
  stowAnchor() { const A = this.anchor; A.st = 'stow'; A.len = 0; A.reelT = 0; A.drag = 0; A.v.set(0, 0, 0); }

  _anchorStep(dt, world) {
    const A = this.anchor;
    if (A.st === 'stow') return;
    const S = this.anchorSpec, H = this.hull;
    const R = this.rollerWorld(_a);
    const was = A.len;
    A.reelT -= dt;
    const reeling = A.reelT > 0;
    const floorAt = (x, z) => heightAt(x, z) + 0.12;
    const flow = this.flow || { x: 0, y: 0 };
    if (A.st === 'fly') {
      A.v.y -= 9.8 * dt;
      A.p.addScaledVector(A.v, dt);
      const f = floorAt(A.p.x, A.p.z);
      if (A.p.y <= f) { A.p.y = f; A.st = 'set'; A.len = Math.min(S.rope, R.distanceTo(A.p) + 1); Bus.emit('anchor:set', { boat: this, dry: f > 0 }); }
      else if (A.p.y < world.sea(A.p.x, A.p.z)) { A.st = 'sink'; A.v.set(A.v.x * 0.15, 0, A.v.z * 0.15); Bus.emit('anchor:splash', { boat: this }); }
      A.len = Math.max(A.len, R.distanceTo(A.p));
      if (A.len > S.rope) { A.len = S.rope; A.st = 'hang'; }
    } else if (A.st === 'sink') {
      A.v.multiplyScalar(Math.exp(-1.5 * dt));
      A.p.x += (A.v.x + flow.x * 0.3) * dt; A.p.z += (A.v.z + flow.y * 0.3) * dt;
      A.p.y -= S.sink * dt;
      const f = floorAt(A.p.x, A.p.z);
      const d = R.distanceTo(A.p);
      if (A.p.y <= f) {
        // on the bottom: pay out a little scope so it can dig in
        A.p.y = f; A.st = 'set';
        A.len = Math.min(S.rope, d + 1 + Math.max(0, R.y - f) * 0.15);
        Bus.emit('anchor:set', { boat: this, depth: R.y - f });
      } else if (d >= S.rope) {
        A.len = S.rope; A.st = 'hang';
        Bus.emit('anchor:short', { boat: this, rope: S.rope });
      } else A.len = d;
      if (reeling && A.st === 'sink') { A.st = 'hang'; A.len = d; }
    } else if (A.st === 'hang') {
      if (reeling) A.len -= S.reel * dt;
      if (A.len <= 0.4) { this.stowAnchor(); Bus.emit('anchor:stowed', { boat: this }); A.crank += was / Math.max(0.05, this.windlassR || 0.1); return; }
      // it swings under the roller, trailing back from the way the boat moves through the water
      const rx = this.vel.x - flow.x, rz = this.vel.y - flow.y;
      const trail = Math.min(0.8, Math.hypot(rx, rz) * 0.25);
      const tx = -rx, tz = -rz, tl = Math.hypot(tx, tz) || 1;
      const hx = tx / tl * trail, hz = tz / tl * trail, hy = -Math.sqrt(Math.max(0.05, 1 - trail * trail));
      const k = 1 - Math.exp(-3 * dt);
      A.p.x += (R.x + hx * A.len - A.p.x) * k; A.p.y += (R.y + hy * A.len - A.p.y) * k; A.p.z += (R.z + hz * A.len - A.p.z) * k;
      const f = floorAt(A.p.x, A.p.z);
      if (A.p.y < f) {
        A.p.y = f;
        // drifting into shallower water with the anchor down: it catches
        if (!reeling) { A.st = 'set'; A.len = Math.min(S.rope, A.len + 1); Bus.emit('anchor:set', { boat: this, depth: R.y - f }); }
      }
    } else if (A.st === 'set') {
      if (reeling) A.len -= S.reel * dt;
      const dy = R.y - A.p.y, hx = R.x - A.p.x, hz = R.z - A.p.z, hd = Math.hypot(hx, hz) || 0.001;
      // hauled short: the anchor breaks out of the bottom and comes up
      if (A.len < dy + 0.5) { A.len = Math.max(0.5, Math.min(A.len, Math.hypot(dy, hd))); A.st = 'hang'; Bus.emit('anchor:break', { boat: this }); }
      else {
        const rad = Math.sqrt(Math.max(0.01, A.len * A.len - dy * dy));
        A.drag = Math.max(0, A.drag - dt);
        if (hd > rad) {
          const nx = hx / hd, nz = hz / hd;
          // how hard the boat leans on it: the drift, plus the engine if someone is driving against it
          const eng = (this.driver || this.autopilot) ? Math.abs(this.throttle) * this.stats.speed * 0.3 : 0;
          const load = (Math.hypot(flow.x, flow.y) + eng) * anchorLoad(H.mass);
          // too much for it: the boat drags the anchor along the bottom, but no faster than slipV
          const slipV = load > S.hold && !reeling ? Math.min(3, (load - S.hold) * 0.45) : 0;
          let over = hd - rad;
          if (slipV > 0) {
            const m = Math.min(over, slipV * dt);
            A.p.x += nx * m; A.p.z += nz * m; A.p.y = floorAt(A.p.x, A.p.z);
            over -= m; A.drag = 0.6;
          }
          this.pos.x -= nx * over; this.pos.z -= nz * over;
          const vn = this.vel.x * nx + this.vel.y * nz;
          if (vn > slipV) { this.vel.x -= nx * (vn - slipV); this.vel.y -= nz * (vn - slipV); }
          // it swings round to face the anchor, bow first
          const want = Math.atan2(-nx, -nz);
          this.yawRate += wrapAngle(want - this.heading) * 1.1 * dt / (1 + H.mass / 8000);
          this.yawRate *= Math.exp(-0.8 * dt);
        }
      }
    }
    A.crank += (was - A.len) / Math.max(0.05, this.windlassR || 0.1);
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
    // a stable hull rides the swell flatter
    const calm = 1 - (this.stats.stability ?? 0.5) * 0.45;
    const tp = -Math.atan2(hb - hs, 2 * L) * 0.9 * calm;
    const tr = Math.atan2(hp - hsb, 2 * W) * 0.9 * calm;
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
    // the rim of the world: the sea stands up in a wall and will not let you through
    const ex = this.pos.x - HOME_CENTRE.x, ez = this.pos.z - HOME_CENTRE.z, ed = Math.hypot(ex, ez), E = WORLD.rim - 15;
    if (ed > E) { px -= ex / ed * (ed - E); pz -= ez / ed * (ed - E); n++; }
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
    if (amount > 8 && this.leaks.length < 6 && Math.random() < Math.min(0.9, amount / 30)) this.addHole();
    // really heavy hits break equipment too: a rail, the wheel, the engine, the harpoon mount
    if (amount > 12 && this.breaks.length < 4 && Math.random() < Math.min(0.55, amount / 50)) this.breakSomething();
    Bus.emit('boat:damage', { boat: this, amount, why });
  }

  /** Break one piece of equipment. Returns what broke. */
  /** Knock a hole in the hull (a leak you can see, and hammer shut). */
  addHole(size = 0.5 + Math.random() * 0.7) {
    const H = this.hull;
    const z = (Math.random() * 2 - 1) * H.hl * 0.8, side = Math.random() < 0.5 ? -1 : 1;
    const L = { x: side * this.halfWidth(z) * 0.95, y: H.deck + 0.05, z, size, fix: 0 };
    this.leaks.push(L);
    Bus.emit('boat:leak', { boat: this });
    return L;
  }

  breakSomething(kind = null) {
    const H = this.hull, have = new Set(this.breaks.map(b => b.kind));
    const pool = ['rail', 'rail', 'wheel', 'engine'];
    if (this.stats.mount) pool.push('mount');
    const avail = pool.filter(k => k === 'rail' || !have.has(k));
    kind = kind || avail[Math.floor(Math.random() * avail.length)] || 'rail';
    let x = 0, z = 0;
    if (kind === 'rail') { z = (Math.random() * 1.6 - 0.8) * H.hl; x = (Math.random() < 0.5 ? -1 : 1) * this.halfWidth(z) / 0.9; }
    else if (kind === 'wheel') { x = H.helm[0]; z = H.helm[2]; }
    else if (kind === 'engine') { x = 0; z = -H.hl + 0.6; }
    else if (kind === 'mount' && H.mount) { x = H.mount[0]; z = H.mount[2]; }
    const B = { kind, x, z, fix: 0 };
    this.breaks.push(B);
    Bus.emit('boat:break', { boat: this, b: B });
    return B;
  }
  broken(kind) { return this.breaks.some(b => b.kind === kind); }
  /** Local height of the water in the hold (the hold fills first), or -Infinity. */
  holdWaterLocal() {
    const Hd = this.hull.hold;
    if (!Hd || this.water < 0.02) return -Infinity;
    return Hd.floor + 0.02 + Math.min(1, this.water / 0.75) * (this.deck - Hd.floor - 0.12);
  }

  /** Is there a snapped rail near this local point? (you can fall through it) */
  railGap(lx, lz) { return this.breaks.some(b => b.kind === 'rail' && Math.sign(b.x) === Math.sign(lx) && Math.abs(b.z - lz) < 1.1); }

  ignite(lx, lz) {
    if (this.fires.length >= 6 || this.sinking) return;
    this.fires.push({ x: lx, z: lz, t: 0, i: 0.4 });
    Bus.emit('boat:fire', { boat: this });
  }

  _hazards(dt, world) {
    const st = this.stats;
    // heavy seas
    // (a place that is always stormy counts as a storm, a little)
    const amp = waveAmp(this.pos.x, this.pos.z) * (1 + Math.max(world.storm, stormAt(this.pos.x, this.pos.z) * 0.5) * 1.6);
    const excess = amp - st.waves;
    if (excess > 0) {
      this.water += excess * 0.02 * dt;
      this.seaT = (this.seaT || 0) - dt;
      if (this.seaT <= 0) {
        this.seaT = 3 + Math.random() * 3;
        this.damage(excess * 9 * (1.3 - (st.stability ?? 0.5) * 0.6), 'waves');
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
    this.sinking = 0; this.water = 0; this.fires = []; this.leaks = []; this.breaks = [];
    this.hp = Math.max(this.hp, Math.round(this.stats.hp * (towed ? 0.6 : 1)));
    this.docked = true; this.driver = null; this.stolen = false; this.autopilot = null;
    this.stowAnchor();
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
  _anchorVisuals(dt, fx, world) {
    const A = this.anchor, S = this.anchorSpec, au = this.game.audio;
    if (!this.game.isHost && world.current) {
      // a client does not simulate, but its HUD still wants to know which way the water runs
      const c = world.current(this.pos.x, this.pos.z), w = world.wind || { x: 0, z: 0 }, wk = 0.03 * (this.hull.windage || 1) / Math.sqrt(this.hull.mass / 900);
      (this.flow = this.flow || new THREE.Vector2()).set(c.x + w.x * wk, c.z + w.z * wk);
    }
    const prev = this._aSt || 'stow'; this._aSt = A.st;
    const out = A.st !== 'stow';
    this.anchorStowed.visible = !out;
    this.anchorMesh.visible = out;
    const W = this.windlass;
    if (W.crank) W.crank.rotation.x = -A.crank;
    if (W.drum) W.drum.rotation.x = -A.crank;
    // the rope rattles out and clanks in, link by link
    const L = au && au.listener, near = !L || Math.hypot(L.x - this.pos.x, L.z - this.pos.z) < 45;
    const dl = Math.abs(A.len - (this._aLen ?? A.len)); this._aLen = A.len;
    this._clink = (this._clink || 0) + dl;
    if (this._clink > (S.chain ? 0.3 : 0.7)) { this._clink = 0; if (near && au) { au.chain(S.chain, A.st === 'sink' || A.st === 'fly' ? 1 : 0.7); if (A.reelT > 0 && S.winch !== 'hand') au.ratchet(); } }
    if (!out) { this.rope.hide(); if (prev !== 'stow' && near && au) au.clunk(); return; }
    const m = this.anchorMesh;
    m.position.copy(A.p);
    const R = this.rollerWorld(_b);
    if (A.st === 'fly') { m.rotation.x += dt * 6; m.rotation.z += dt * 3.5; }
    else if (A.st === 'set') { if (prev !== 'set') { this._aYaw = Math.random() * 6.28; } m.rotation.set(0, this._aYaw || 0, 1.3, 'YXZ'); }
    else { _c.subVectors(R, A.p); if (_c.lengthSq() > 1e-4) { _c.normalize(); m.quaternion.setFromUnitVectors(UP, _c); } }
    const sea = world.sea(A.p.x, A.p.z);
    if (prev === 'fly' && A.st === 'sink') { fx.splash(A.p.x, sea, A.p.z, 0.9 + S.sink * 0.1); if (near && au) au.splash(1.1, A.p); }
    if (A.st === 'sink' && Math.random() < 0.6) fx.bubbles(A.p.x, A.p.y + 0.2, A.p.z, 2);
    const mud = n => { for (let i = 0; i < n; i++) fx.smoke(A.p.x + (Math.random() - 0.5), A.p.y + 0.1, A.p.z + (Math.random() - 0.5), 0x7a6a4a); };
    if (A.st === 'set' && prev !== 'set') { mud(6); if (near && au) au.anchorSet(); }
    if (prev === 'set' && A.st === 'hang') mud(5);
    if (A.drag > 0 && Math.random() < 0.3) { mud(1); if (near && au && Math.random() < 0.08) au.scrape(); }
    // coming up: water pouring off it as it breaks the surface
    if (A.st === 'hang' && A.p.y > sea - 0.3 && A.p.y < sea + 3 && Math.random() < 0.5) fx.wake(A.p.x, A.p.y - 0.3, A.p.z, 0, 0, 1);
    if (A.st === 'hang' && this._aWet && A.p.y > sea) { fx.splash(A.p.x, sea, A.p.z, 0.5); }
    this._aWet = A.p.y < sea;
    // the rope: off the drum, over the roller, then down to the anchor with a sag when it is slack
    const P = this.rope.pts, n = P.length - 1;
    this.toWorld(P[0].set(this.hull.anchor[0], this.deck + (W.top || 0.3) * 0.62 + W.drumR, this.hull.anchor[1]), P[0]);
    P[1].copy(R);
    const dist = R.distanceTo(A.p);
    let sag = A.st === 'fly' ? dist * 0.12 : A.st === 'set' ? Math.max(0, A.len - dist) * 0.45 : 0;
    sag = Math.min(sag, dist * 0.5);
    for (let i = 2; i <= n; i++) {
      const t = (i - 1) / (n - 1);
      P[i].lerpVectors(R, A.p, t);
      P[i].y -= sag * 4 * t * (1 - t);
      const f = heightAt(P[i].x, P[i].z) + 0.05;
      if (P[i].y < f) P[i].y = f;
    }
    this.rope.draw();
  }

  visuals(dt, fx, world, night) {
    if (this.absent) { this.group.visible = false; if (this.rope?.mesh) this.rope.mesh.visible = false; return; }
    this._anchorVisuals(dt, fx, world);
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
    if (this.parts.holdFlood) {
      // a ship floods from the bottom: the hold fills first, then the deck goes under
      const Hd = this.hull.hold, span = this.deck - Hd.floor;
      const lvl = Math.min(1, this.water / 0.75);
      this.parts.holdFlood.visible = this.water > 0.02;
      this.parts.holdFlood.position.y = Hd.floor + 0.02 + lvl * (span - 0.12);
      fl.visible = this.water > 0.78;
      fl.position.y = this.deck + 0.02 + (this.water - 0.75) * 1.6;
    } else {
      fl.visible = this.water > 0.02;
      fl.position.y = this.deck + 0.02 + this.water * Math.min(0.5, this.art.rail * 0.8);
    }
    // broken equipment: splinters where a rail was, smoke from a dead engine, sparks off a jammed wheel
    this.breakMeshes = this.breakMeshes || [];
    while (this.breakMeshes.length < this.breaks.length) { const m = new THREE.Mesh(breakGeo(), MAT.solid); this.group.add(m); this.breakMeshes.push(m); }
    this.breakMeshes.forEach((m, i) => {
      const B = this.breaks[i];
      m.visible = !!B && B.kind === 'rail';
      if (!B) return;
      const w = this.toWorld(_v.set(B.x, this.deck + 0.6, B.z));
      if (B.kind === 'rail') { m.position.set(B.x, this.railY(B.z) - 0.35, B.z); m.rotation.y = B.x > 0 ? 0 : Math.PI; m.scale.setScalar(1 - B.fix * 0.6); }
      else if (B.kind === 'engine' && Math.random() < 0.3) fx.smoke(w.x, w.y + 0.5, w.z, 0x2a2a2a);
      else if (B.kind === 'wheel' && Math.random() < 0.06) fx.sparks(w.x, w.y + 0.3, w.z, 4, 0xffd27a);
      else if (B.kind === 'mount' && Math.random() < 0.1) fx.smoke(w.x, w.y + 0.3, w.z, 0x5a5a5a);
    });
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
      dk: this.docked ? 1 : 0, cfg: this.cfgKey(), bk: this.breaks.map(B => [B.kind, +B.x.toFixed(2), +B.z.toFixed(2), +B.fix.toFixed(2)]),
      an: this.anchor.st === 'stow' ? 0 : [ST_CODE.indexOf(this.anchor.st), +this.anchor.p.x.toFixed(2), +this.anchor.p.y.toFixed(2), +this.anchor.p.z.toFixed(2), +this.anchor.len.toFixed(2), this.anchor.drag > 0 ? 1 : 0, this.anchor.reelT > 0 ? 1 : 0],
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
    this.breaks = (s.bk || []).map(a => ({ kind: a[0], x: a[1], z: a[2], fix: a[3] }));
    const A = this.anchor;
    if (!s.an) { if (A.st !== 'stow') A.crank += A.len / Math.max(0.05, this.windlassR || 0.1); A.st = 'stow'; A.len = 0; }
    else {
      const st = ST_CODE[s.an[0]] || 'hang';
      if (A.st === 'stow') A.p.set(s.an[1], s.an[2], s.an[3]);
      A.st = st;
      A.p.x += (s.an[1] - A.p.x) * k; A.p.y += (s.an[2] - A.p.y) * k; A.p.z += (s.an[3] - A.p.z) * k;
      A.crank += (A.len - s.an[4]) / Math.max(0.05, this.windlassR || 0.1);
      A.len = s.an[4]; A.drag = s.an[5] ? 0.3 : 0; A.reelT = s.an[6] ? 0.3 : 0;
    }
    this._updateMatrix();
  }
}
