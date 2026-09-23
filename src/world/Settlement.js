/* Settlement.js - puts every man-made thing into the world: Driftwood Bay
   village, the docks, your cabin, the outposts, wrecks, the lighthouse, the
   Drowned Gate and every leviathan clue.

   Builders work in their own frame (see BuildingArt); `place` stamps them
   into the world at a position and heading and transforms their colliders
   the same way, so an art change can never leave an invisible wall behind.

   Output:
     blockers      circles the scatter must not plant trees in
     anchors       named world points (NPC stands, mooring, spawn...)
     interact      things you can press E on
     cabin         the mount slots of your cabin museum
     clues         world objects for leviathan clues (by clue id) */

import * as THREE from '../../lib/three.module.js?v=1790185859';
import { MeshBuilder, shadeHex } from '../art/Geo.js?v=1790185859';
import { MAT } from '../art/Materials.js?v=1790185859';
import * as BA from '../art/BuildingArt.js?v=1790185859';
import { heightAt, groundAt, ICE_Y } from './Terrain.js?v=1790185859';
import { LEVIATHANS } from '../data/LeviathanData.js?v=1790185859';
import { ZONES, HOME_CENTRE } from './MapData.js?v=1790185859';
import { rng, TAU } from '../core/Util.js?v=1790185859';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Settlement {
  constructor(scene, colliders) {
    this.scene = scene;
    this.C = colliders;
    this.group = new THREE.Group();
    this.group.name = 'settlement';
    scene.add(this.group);
    this.blockers = [];
    this.anchors = {};
    this.interact = [];
    this.clues = {};
    this.glowMeshes = [];
    this.lights = [];     // {pos, color, intensity, dist, night}
    this.cabin = { slots: [], photos: [], shelf: [], yard: [], rack: null };
    this.moorings = [];
    this.animated = [];
    this._build();
  }

  /* ---------------- helpers ---------------- */
  _w(lx, lz, X, Z, rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return [X + lx * c + lz * s, Z - lx * s + lz * c];
  }

  place(res, X, Z, rot = 0, Y = null, mat = MAT.solid) {
    const y = Y === null ? heightAt(X, Z) : Y;
    const m = new THREE.Mesh(res.geo, mat);
    m.position.set(X, y, Z);
    m.rotation.y = rot;
    m.castShadow = true; m.receiveShadow = true;
    m.matrixAutoUpdate = false; m.updateMatrix();
    this.group.add(m);
    for (const c of res.cols || []) {
      const [wx, wz] = this._w(c.x, c.z, X, Z, rot);
      const col = this.C.box(wx, wz, c.hw, c.hd, rot, y + c.y0, y + c.y1, c.floor ? 'floor' : 'wall');
      col.floor = !!c.floor;
    }
    const A = {};
    for (const k in res.anchors || {}) {
      const a = res.anchors[k];
      if (!Array.isArray(a)) { A[k] = a; continue; }
      const [wx, wz] = this._w(a[0], a[2], X, Z, rot);
      A[k] = V(wx, y + a[1], wz);
    }
    return { mesh: m, y, A };
  }

  _props(fn, X, Z, rot = 0, Y = null, seed = 1) {
    const b = new MeshBuilder(rng(seed));
    fn(b);
    return this.place({ geo: b.build() }, X, Z, rot, Y);
  }

  /** Walk south (or along dir) from a point until the ground drops into the sea. */
  _shore(x, z, dx, dz, maxD = 200) {
    for (let d = 0; d < maxD; d += 0.5) {
      if (heightAt(x + dx * d, z + dz * d) < 0.2) return [x + dx * d, z + dz * d];
    }
    return [x + dx * maxD, z + dz * maxD];
  }

  /** Nearest point to (x,z) with ground in [lo, hi]. */
  _findGround(x, z, lo = 0.6, hi = 5, maxR = 70) {
    for (let r = 0; r < maxR; r += 1.5) {
      const n = Math.max(1, Math.round(r * 1.2));
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const h = heightAt(px, pz);
        if (h >= lo && h <= hi) return [px, pz, h];
      }
    }
    return [x, z, heightAt(x, z)];
  }

  _lamp(x, z, y = null) {
    const r = this._props(b => BA.buildLamp(b, 0, 0, 0), x, z, 0, y);
    this.C.circle(x, z, 0.15, r.y - 1, r.y + 2.6);
    this.lights.push({ pos: V(x + 0.6, r.y + 2.2, z), color: 0xffc070, intensity: 1.6, dist: 12, night: true });
    this.blockers.push({ x, z, r: 1 });
  }

  _npcAnchor(key, pos, face) { this.anchors[key] = { pos, face }; }

  /* ---------------- the world ---------------- */
  _build() {
    this._village();
    this._lakes();
    this._frost();
    this._tropic();
    this._open();
    this._black();
    this._clues();
    this._zoneBuoys();
  }

  _house(spec, X, Z, rot, key = null) {
    const res = BA.buildHouse(spec);
    const Y = heightAt(X, Z) - 0.1;
    const p = this.place(res, X, Z, rot, Y);
    this.blockers.push({ x: X, z: Z, r: Math.max(spec.w, spec.d) * 0.62 + 1.5 });
    if (key) this.anchors[key + 'Door'] = { pos: p.A.door, face: rot };
    return p;
  }

  _village() {
    const r = rng(42);
    // --- the main pier ---
    const [sx, sz] = this._shore(18, 170, 0, 1);
    const pierLen = 30;
    const pier = BA.buildPier(pierLen, 3.2, 1.25, 7);
    const pp = this.place(pier, sx, sz - 5, 0, 0);
    this.blockers.push({ x: sx, z: sz, r: 4 });
    this.anchors.pierEnd = V(sx, 1.25, sz - 5 + pierLen - 1.5);
    this.anchors.pierBase = V(sx, 1.25, sz - 4);
    // mooring spots either side of the pier's far end
    this.moorings.push({ pos: V(sx + 4.2, 0, sz + pierLen - 12), heading: 0, board: V(sx + 1.4, 1.25, sz + pierLen - 12) });
    this.moorings.push({ pos: V(sx - 4.4, 0, sz + pierLen - 12), heading: 0, board: V(sx - 1.4, 1.25, sz + pierLen - 12) });
    this.anchors.mooring = this.moorings[0];
    // market stall on the pier
    this._props(b => {
      b.color(0x7a5836).box(3, 1.0, 1.1, 0, 1.25 + 0.5, 0);
      b.color(0x9a7446).box(3.2, 0.08, 1.3, 0, 1.25 + 1.04, 0);
      // crates of ice with fish in them
      for (let i = 0; i < 3; i++) {
        b.color(0xd8e8f0).box(0.8, 0.1, 0.9, -1 + i, 1.25 + 1.12, 0);
        b.color([0x8a9aa8, 0xc88a5a, 0x5a7a4a][i]);
        for (let k = 0; k < 3; k++) b.blob(0.22, 0.05, 0.07, -1 + i + (k - 1) * 0.02, 1.25 + 1.2 + k * 0.03, (k - 1) * 0.22, 5, 2);
      }
      // awning poles and striped canvas
      b.color(0x5a4230);
      for (const px of [-1.5, 1.5]) for (const pz of [-0.6, 0.6]) b.box(0.1, 2.6, 0.1, px, 1.25 + 1.3, pz);
      for (let i = 0; i < 8; i++) b.color(i % 2 ? 0xf2eee2 : 0xc8412e).box(0.42, 0.06, 1.6, -1.47 + i * 0.42, 1.25 + 2.6 - 0.05, 0);
      BA.buildBarrel(b, 1.9, 1.25, 0.2);
      BA.buildCrate(b, -2.1, 1.25, 0.3, 0.7);
    }, sx - 0.1, sz + 6, Math.PI / 2, 0);
    this.C.box(sx - 0.1, sz + 6, 0.55, 1.5, Math.PI / 2, 0, 2.3);
    this._npcAnchor('market', V(sx + 1.1, 1.25, sz + 6), -Math.PI / 2);
    const mk = BA.signBoard('FISH MARKET', 2.2, 0.5);
    mk.position.set(sx - 0.1 - 0.62, 1.25 + 2.2, sz + 6); mk.rotation.y = Math.PI / 2;
    this.group.add(mk);
    // pier clutter
    this._props(b => {
      BA.buildCrate(b, 0.9, 1.25, 12, 0.75, 0x9a7446, 0.3);
      BA.buildCrate(b, 0.9, 2.0, 12.1, 0.6, 0xa88456, 0.9);
      BA.buildBarrel(b, -1.0, 1.25, 16);
      BA.buildBarrel(b, -1.1, 1.25, 16.8, 0x5a6a7a);
      b.color(0xc4b48a).cyl(0.35, 0.35, 1.25, 1.45, 8, true, 1.0, 22);
    }, sx, sz - 5, 0, 0);
    this.C.box(sx + 0.9, sz + 7, 0.4, 0.4, 0, 0, 2.6);
    this.C.circle(sx - 1.0, sz + 11, 0.4, 0, 2.2);
    this.C.circle(sx - 1.1, sz + 11.8, 0.4, 0, 2.2);
    for (let z = 2; z < pierLen; z += 9) this._lampOn(sx + 1.5, sz - 5 + z, 1.25);

    // second pier west, for the boatyard
    const [yx, yz] = this._shore(60, 185, 0, 1);
    const yp = BA.buildPier(16, 2.6, 1.2, 9);
    this.place(yp, yx, yz - 4, 0, 0);
    this.blockers.push({ x: yx, z: yz, r: 3 });
    this.moorings.push({ pos: V(yx + 3.8, 0, yz + 8), heading: 0, board: V(yx + 1.2, 1.2, yz + 8) });

    // --- Melvin's Bait & Tackle (the reference cabin) with Gus on the porch ---
    const tx = 0, tz = 172;
    const tack = this._house({ w: 5.6, d: 4.6, h: 2.9, rise: 1.8, seed: 3, wall: 0x7a5236, roof: 0x6a3a2e, doorX: 0.7, doorOpen: false, windows: [{ side: 'front', x: -1.3 }, { side: 'left', x: 0 }], porch: true, floorH: 0.4 }, tx, tz, 0, 'tackle');
    this._npcAnchor('tackleDoor', V(tx + 2.2, tack.y + 0.4, tz + 3.6), 0);
    this.anchors.gusChair = { pos: V(tx - 1.3, tack.y + 0.4 + 0.02, tz + 3.4), face: 0.25 };
    this._props(b => BA.buildRockingChair(b, 0, 0, 0, 0), tx - 1.3, tz + 3.4, 0.25, tack.y + 0.4);
    this._props(b => BA.buildLureBoard(b, 0, 0, 0, 0), tx - 4.3, tz + 4.8, 0.5);
    this.C.circle(tx - 4.3, tz + 4.8, 0.3, tack.y - 1, tack.y + 3);
    const ts = BA.signBoard('BAIT & TACKLE', 2.6, 0.55);
    ts.position.set(tx, tack.y + 0.4 + 3.05, tz + 2.42); this.group.add(ts);
    this._props(b => { BA.buildBarrel(b, 0, 0, 0); BA.buildCrate(b, 0.8, 0, 0.3, 0.6, 0x9a7446, 0.4); BA.buildCrate(b, 0.8, 0.6, 0.3, 0.45, 0x8a6a40, 0.9); }, tx + 3.6, tz + 2.2, 0);
    this.C.circle(tx + 3.6, tz + 2.2, 0.45, 0, 20); this.C.circle(tx + 4.4, tz + 2.5, 0.45, 0, 20);

    // --- the boatyard ---
    const bx = yx - 7, bz = yz - 12;
    const yard = BA.buildHouse({ w: 8, d: 6, h: 3.6, rise: 2.2, seed: 8, wall: 0x6a4a34, roof: 0x3e4a52, doorX: 0, doorW: 5.4, doorH: 3.2, doorOpen: true, windows: [{ side: 'left', x: 0 }, { side: 'right', x: 0 }], floorH: 0.15 });
    const yd = this.place(yard, bx, bz, 0, heightAt(bx, bz) - 0.1);
    this.blockers.push({ x: bx, z: bz, r: 7 });
    this._npcAnchor('yardDoor', V(bx - 2.2, yd.y + 0.2, bz + 3.8), 0);
    const ys = BA.signBoard('BOATYARD', 2.4, 0.55);
    ys.position.set(bx, yd.y + 3.9, bz + 3.05); this.group.add(ys);
    this._props(b => {
      // a boat on trestles inside, half-painted
      b.color(0x5a4230);
      for (const z of [-1.4, 1.4]) { b.box(0.14, 0.8, 0.14, -0.9, 0.4, z); b.box(0.14, 0.8, 0.14, 0.9, 0.4, z); b.box(2, 0.12, 0.14, 0, 0.8, z); }
      b.color(0x2e5a86);
      b.lathe([[0.02, 0.8], [0.7, 0.95], [0.9, 1.3], [0.92, 1.45]], 8, 0, 0, 0);
      BA.buildNetRack(b, 2.8, 0, -2, Math.PI / 2);
      b.color(0x7a7a7a).box(0.8, 0.9, 0.5, -3, 0.45, -2.2);
      b.color(0x5a5a5a).box(0.1, 0.1, 0.4, -3, 1.0, -2.2);
    }, bx, bz - 0.5, 0, yd.y + 0.15);

    // --- the guild hall ---
    const gx = -40, gz = 126;
    const guild = this._house({ w: 12, d: 8, h: 4.4, rise: 3.2, seed: 12, wall: 0x5e3e2a, roof: 0x2e3e4e, trim: 0x2e2218, doorX: 0, doorW: 1.8, doorH: 2.6, doorOpen: true,
      windows: [{ side: 'front', x: -3.6 }, { side: 'front', x: 3.6 }, { side: 'left', x: -1.5 }, { side: 'left', x: 1.5 }, { side: 'right', x: -1.5 }, { side: 'right', x: 1.5 }], floorH: 0.5, chimney: true, interior: true }, gx, gz, 0, 'guild');
    this.anchors.guildDoor = { pos: V(gx - 1.8, guild.y + 0.5, gz + 5), face: 0 };
    const gsn = BA.signBoard('DRIFTWOOD FISHING GUILD', 4.6, 0.7);
    gsn.position.set(gx, guild.y + 0.5 + 4.9, gz + 4.08); this.group.add(gsn);
    // inside: the great map on the back wall and the shard table
    const gfy = guild.y + 0.5;
    this._props(b => {
      b.color(0x3a2a1c).box(7.4, 3.2, 0.12, 0, 2.3, 0);
      b.color(0xe8dcb8).box(7.0, 2.8, 0.05, 0, 2.3, 0.08);

    }, gx, gz - 3.85, 0, gfy);
    this._props(b => {
      b.color(0x6a4a30).box(3, 0.1, 1.4, 0, 0.95, 0);
      for (const px of [-1.3, 1.3]) for (const pz of [-0.55, 0.55]) b.box(0.12, 0.95, 0.12, px, 0.47, pz);
      b.color(0x3a2a1c).box(2.6, 0.06, 1.0, 0, 1.03, 0);
    }, gx, gz - 0.5, 0, gfy);
    this.C.box(gx, gz - 0.5, 1.5, 0.7, 0, gfy - 1, gfy + 1.1);
    this.anchors.shardTable = V(gx, gfy + 1.08, gz - 0.5);
    this.anchors.guildInside = V(gx, gfy, gz + 1.8);
    this.anchors.guildMap = V(gx, gfy + 2.3, gz - 3.85 + 0.12);
    this.interact.push({ id: 'guildmap', kind: 'guildmap', pos: V(gx, gfy + 1.6, gz - 2.8), r: 3.2, label: 'Study the Guild Map' });
    // leviathan trophy pedestals round the hall
    this.anchors.guildPedestals = [];
    for (let i = 0; i < 12; i++) {
      const side = i < 6 ? -1 : 1, k = i % 6;
      const px = gx + side * 4.9, pz = gz - 3 + k * 1.15;
      this.anchors.guildPedestals.push(V(px, gfy + 0.9, pz));
    }
    this._props(b => { for (const p of this.anchors.guildPedestals) b.color(0x5a4a3a).box(0.7, 0.9, 0.7, p.x - gx, 0.45, p.z - gz); }, gx, gz, 0, gfy);
    for (const p of this.anchors.guildPedestals) this.C.box(p.x, p.z, 0.35, 0.35, 0, gfy - 1, gfy + 0.9);
    this.lights.push({ pos: V(gx, gfy + 3.6, gz), color: 0xffc890, intensity: 2.4, dist: 14, night: false, interior: true });

    // --- your cabin ---
    const cx = 92, cz = 136;
    const cab = this._house({ w: 7, d: 5.6, h: 3.0, rise: 2.0, seed: 21, wall: 0x84583a, roof: 0x5a3a2e, doorX: 1.8, doorW: 1.1, doorOpen: true,
      windows: [{ side: 'front', x: -1.4 }, { side: 'left', x: 0 }, { side: 'back', x: 0.6 }], porch: true, floorH: 0.4, chimney: true, interior: true }, cx, cz, 0, 'cabin');
    const cfy = cab.y + 0.4;
    this.anchors.cabinInside = V(cx, cfy, cz);
    this.anchors.cabinDoor = { pos: V(cx + 1.8, cfy, cz + 3.6), face: 0 };
    this.anchors.spawn = V(cx + 1.8, cfy, cz + 4.4);
    const cs = BA.signBoard('HOME', 1.2, 0.36, { bg: '#6a4a30' });
    cs.position.set(cx + 1.8, cfy + 2.45, cz + 2.93); this.group.add(cs);
    this.lights.push({ pos: V(cx + 0.4, cfy + 1.9, cz + 0.3), color: 0xffc890, intensity: 1.6, dist: 9, night: false, interior: true });
    // furniture
    this._props(b => {
      // bed
      b.color(0x5a3e28).box(1.1, 0.45, 2.1, -2.8, 0.22, -1.4);
      b.color(0xc84a3a).box(1.05, 0.14, 1.6, -2.8, 0.52, -1.15);
      b.color(0xf2eee2).box(0.8, 0.12, 0.4, -2.8, 0.52, -2.2);
      // stove
      b.color(0x2a2a2e).box(0.8, 0.9, 0.7, -2.9, 0.45, 1.6);
      b.color(0x3a3a40).cyl(0.1, 0.1, 0.9, 3, 6, true, -2.9, 1.6);
      b.color(0xff8a3a).box(0.3, 0.2, 0.02, -2.9, 0.4, 1.96);
      // table and chairs
      b.color(0x7a5836).box(1.2, 0.08, 0.8, 0.2, 0.78, 0.4);
      for (const px of [-0.45, 0.85]) for (const pz of [0.1, 0.7]) b.box(0.07, 0.78, 0.07, px, 0.39, pz);
      b.color(0x6a4a30).box(0.45, 0.06, 0.45, 0.2, 0.46, 1.2);
      b.color(0x6a4a30).box(0.45, 0.5, 0.06, 0.2, 0.75, 1.42);
      // rug
      b.color(0x8a3a2e).box(2.4, 0.02, 1.6, 0.4, 0.01, 0);
      b.color(0xd8b060).box(2.0, 0.025, 1.2, 0.4, 0.01, 0);
      // lamp on the table
      b.color(0xffd27a).box(0.14, 0.2, 0.14, 0.4, 0.92, 0.3);
      // shelf along the back wall (strange objects)
      b.color(0x5a3e28).box(3.2, 0.06, 0.34, 1.2, 1.05, -2.58);
      // rod rack by the door
      b.color(0x5a3e28).box(1.4, 0.1, 0.12, 3.2, 1.5, 1.0);
      b.color(0x5a3e28).box(1.4, 0.1, 0.12, 3.2, 0.3, 1.0);
    }, cx, cz, 0, cfy);
    this.C.box(cx - 2.8, cz - 1.4, 0.55, 1.05, 0, cfy - 1, cfy + 0.6);
    this.C.box(cx - 2.9, cz + 1.6, 0.4, 0.35, 0, cfy - 1, cfy + 1);
    this.C.box(cx + 0.2, cz + 0.4, 0.6, 0.4, 0, cfy - 1, cfy + 0.8);
    this.interact.push({ id: 'bed', kind: 'bed', pos: V(cx - 2.8, cfy + 0.5, cz - 1.4), r: 1.8, label: 'Sleep until morning' });
    this.interact.push({ id: 'journal', kind: 'journal', pos: V(cx + 0.2, cfy + 0.8, cz + 0.4), r: 1.6, label: 'Read your fishing journal' });
    // mount slots: 4 on the back wall, 3 on each side wall (fish mounts)
    const hw = 3.5 - 0.2, hd = 2.8 - 0.2;
    const slots = [];
    for (const x of [-2.4, -0.9]) slots.push({ p: [x, 1.75, -hd], face: 0 });
    for (const x of [0.4, 1.4, 2.4]) slots.push({ p: [x, 2.2, -hd], face: 0 });
    for (const z of [-1.5, 0, 1.4]) slots.push({ p: [-hw, 1.9, z], face: Math.PI / 2 });
    for (const z of [-1.6, -0.3]) slots.push({ p: [hw, 1.9, z], face: -Math.PI / 2 });
    this.cabin.slots = slots.map((s, i) => ({ i, pos: V(cx + s.p[0], cfy + s.p[1], cz + s.p[2]), face: s.face }));
    // photos: right wall and front wall
    const photos = [];
    for (const z of [-1.8, -1.0, -0.2, 0.6]) photos.push({ p: [hw + 0.05, 1.25, z], face: -Math.PI / 2 });
    for (const x of [-2.6, -2.0]) photos.push({ p: [x, 2.3, hd + 0.05], face: Math.PI });
    for (const x of [-0.4, 0.3]) photos.push({ p: [x, 2.3, hd + 0.05], face: Math.PI });
    this.cabin.photos = photos.map((s, i) => ({ i, pos: V(cx + s.p[0], cfy + s.p[1], cz + s.p[2]), face: s.face }));
    // shelf spots for strange objects
    for (let i = 0; i < 8; i++) this.cabin.shelf.push({ i, pos: V(cx - 0.2 + i * 0.4, cfy + 1.1, cz - 2.55) });
    this.cabin.rack = { pos: V(cx + 3.2, cfy, cz + 1.0) };
    // the trophy yard outside: 12 stands for giants and leviathan skulls
    for (let i = 0; i < 12; i++) {
      const a = -0.9 + i * 0.16;
      const px = cx + Math.sin(a) * 13, pz = cz + 12 + Math.cos(a) * -2.5 + (i % 2) * 2.5;
      const py = heightAt(px, pz);
      this.cabin.yard.push({ i, pos: V(px, py + 0.6, pz), ground: py, face: 0 });
    }
    this.interact.push({ id: 'trophyboard', kind: 'trophyboard', pos: V(cx - 1.2, cfy + 1.2, cz + 2.4), r: 2.6, label: 'Arrange your trophies' });

    // --- villager cottages ---
    const homes = [[-8, 132, 0.1], [22, 118, -0.15], [52, 124, 0.05], [-22, 188, 0.4], [-60, 170, 0.6], [118, 162, -0.4]];
    homes.forEach(([x, z, rot], i) => {
      const walls = [0x7a5236, 0x6a4a34, 0x8a6a4a, 0x5a6a7a, 0x7a3a2e, 0x6a7a5a][i];
      this._house({ w: 4.6 + (i % 2), d: 4.0, h: 2.6, rise: 1.6, seed: 30 + i, wall: walls, roof: [0x5a3a2e, 0x3e4a52, 0x6a3a2e][i % 3], doorX: 0.5, doorOpen: false, windows: [{ side: 'front', x: -1.2 }], porch: i % 2 === 0, floorH: 0.35, chimney: i % 3 === 0 }, x, z, rot);
    });
    // lamps along the paths and the waterfront
    for (const [x, z] of [[12, 150], [-12, 140], [40, 145], [70, 140], [-30, 150], [30, 180], [-24, 110], [60, 105], [84, 150]]) this._lamp(x, z);
    // benches, campfire, fences
    this._props(b => {
      BA.buildCampfire(b, 0, 0, 0);
      BA.buildBench(b, 0, 0, 2.2, 0);
      BA.buildBench(b, 2.0, 0, 0, Math.PI / 2);
      BA.buildBench(b, -2.0, 0, 0, -Math.PI / 2);
    }, 30, 158, 0);
    this.anchors.campfire = V(30, heightAt(30, 158), 158);
    this.lights.push({ pos: V(30, heightAt(30, 158) + 0.8, 158), color: 0xff8a3a, intensity: 2.2, dist: 10, night: true, flicker: true });
    this.C.circle(30, 158, 0.7, 0, 20);
    this._props(b => { BA.buildFence(b, 0, 0, 12, 0); BA.buildFence(b, 12, 0, 12, 8); }, 96, 124, 0);
    this.C.box(102, 124, 6, 0.1, 0, 0, 20); this.C.box(108, 128, 0.1, 4, 0, 0, 20);
    this.anchors.villageCentre = V(25, heightAt(25, 150), 150);
    this.anchors.wander = [[25, 150], [0, 140], [40, 130], [-20, 160], [60, 150], [10, 180], [-40, 140], [80, 150]].map(([x, z]) => V(x, heightAt(x, z), z));
  }

  _lampOn(x, z, y) {
    this._props(b => BA.buildLamp(b, 0, 0, 0), x, z, 0, y);
    this.lights.push({ pos: V(x + 0.6, y + 2.2, z), color: 0xffc070, intensity: 1.6, dist: 12, night: true });
  }

  _lakes() {
    // Mirror Lake: a little pier on the east shore, into the water
    const [lx, lz] = this._shore(-20, -45, -1, 0, 60);
    const lp = BA.buildPier(9, 2.2, 0.8, 17, -4);
    this.place(lp, lx + 2, lz, -Math.PI / 2, 0);
    this.blockers.push({ x: lx + 2, z: lz, r: 3 });
    this.anchors.lakePier = V(lx - 6, 0.8, lz);
    this.anchors.lakePierBase = V(lx + 2, 0.8, lz);
    // the pier the Gloop has been chewing on: gouges in the end posts
    this.clueSpot('gloop1', V(lx - 6.5, 0.9, lz), 'Teeth marks in the lake pier');
    this._props(b => {
      b.color(0xe8d8b8);
      for (let i = 0; i < 6; i++) b.box(0.08, 0.35, 0.06, 0, 0.6 - (i % 2) * 0.15, -1 + i * 0.35);
    }, lx - 6.9, lz, 0, 0.3);
    // Reed Pond: a bench and a rowboat hauled up on the bank
    const [rx, rz, rh] = this._findGround(88, -62, 0.8, 3);
    this._props(b => { BA.buildBench(b, 0, 0, 0, 0); }, rx, rz, 0, rh);
  }

  _frost() {
    // the landing beach camp
    const fx = 44, fz = -520;
    const [dx, dz] = this._shore(fx, fz + 4, 0, 1, 60);
    this.place(BA.buildPier(14, 2.6, 1.2, 23), dx, dz - 3, 0, 0);
    this.moorings.push({ pos: V(dx + 3.6, 0, dz + 7), heading: 0, board: V(dx + 1.1, 1.2, dz + 7) });
    this.anchors.frostLanding = V(dx, 1.2, dz);
    this._props(b => { BA.buildCampfire(b, 0, 0, 0); BA.buildBench(b, 0, 0, 1.8, 0); b.color(0xa8452e).box(1.6, 1.4, 1.2, 3, 0.7, -1); }, fx, fz, 0);
    this.C.circle(fx, fz, 0.6, 0, 20);
    this.lights.push({ pos: V(fx, heightAt(fx, fz) + 0.8, fz), color: 0xff8a3a, intensity: 2, dist: 10, night: true, flicker: true });
    const sg = BA.signBoard('FROSTBITE LAKE  -  THIS WAY', 3, 0.5);
    sg.position.set(fx + 3, heightAt(fx + 3, fz - 4) + 1.6, fz - 4); sg.rotation.y = 0.2; this.group.add(sg);
    this._props(b => b.color(0x4a3526).box(0.14, 1.8, 0.14, 0, 0.9, 0), fx + 3, fz - 4.1, 0);
    // Ingrid's ice hut on the lake shore
    const hx = 64, hz = -612;
    const hut = BA.buildIceHut(4);
    const hp = this.place(hut, hx, hz, -0.6, heightAt(hx, hz) - 0.05);
    this.blockers.push({ x: hx, z: hz, r: 4 });
    this.anchors.iceHut = { pos: hp.A.door, face: -0.6 };
    this.clueSpot('maw1', V(hx + 1.6, hp.y + 1.2, hz - 1.2), 'Claw gouges on the ice hut');
    this._props(b => {
      b.color(0xe0e8ee);
      for (let i = 0; i < 4; i++) b.beam([0, 0.3 + i * 0.1, i * 0.25], [0, 1.9 + i * 0.1, 0.35 + i * 0.25], 0.07, 0.03);
    }, hx + 2.02, hz - 1.4, -0.6, hp.y + 0.1);
    this.lights.push({ pos: V(hx, hp.y + 2, hz), color: 0xffb070, intensity: 1.6, dist: 9, night: true });
    this.anchors.iceCentre = V(0, ICE_Y, -700);
    // the north cliffs, where the whale sings
    const [nx, nz, nh] = this._findGround(80, -1085, 0.7, 4, 90);
    this.clueSpot('aur2', V(nx, nh + 0.6, nz), 'A barnacle the size of a bathtub');
    this._props(b => { b.color(0xb8b0a0).lump(1.3, 0, 0.4, 0, 0.3, 0.7); b.color(0x8a847a); for (let i = 0; i < 6; i++) b.cone(0.3, 0.5, 1.2, 5, Math.cos(i) * 0.7, Math.sin(i) * 0.7); }, nx, nz, 0, nh);
  }

  _tropic() {
    // Coco's tiki bar
    const kx = 690, kz = 90;
    const hut = BA.buildTikiHut(3);
    const hp = this.place(hut, kx, kz, 0, heightAt(kx, kz));
    this.blockers.push({ x: kx, z: kz, r: 5 });
    this.anchors.tiki = { pos: V(kx, hp.y, kz + 1.2), face: Math.PI };
    this.anchors.tikiFront = V(kx, hp.y, kz + 4);
    const [dx, dz] = this._shore(kx + 6, kz, 0, 1, 80);
    this.place(BA.buildPier(16, 2.6, 1.2, 31), dx, dz - 3, 0, 0);
    this.moorings.push({ pos: V(dx + 3.6, 0, dz + 9), heading: 0, board: V(dx + 1.1, 1.2, dz + 9) });
    this.lights.push({ pos: V(kx, hp.y + 2.4, kz), color: 0xffa060, intensity: 1.8, dist: 10, night: true });
    const ts = BA.signBoard("COCO'S", 1.6, 0.45, { bg: '#c9a860', ink: '#5a2e1a' });
    ts.position.set(kx, hp.y + 2.3, kz + 2.3); this.group.add(ts);
    // wrecks
    this.wreckAt(742, 132, 0.4, 20, true, 'wj1');
    this.wreckAt(880, 100, 2.2, 16, false);
    this.wreckAt(820, -40, 4.0, 22, false);
    // a tooth on the beach, a shell fragment on Palm Cay
    const [tx, tz, th] = this._findGround(860, 215, 0.7, 3);
    this._props(b => { b.color(0xf4f0e0); b.push(0, 0, 0, 0.3, 0, 0.2); b.cyl(0.35, 0.02, 0, 2.2, 5); b.pop(); }, tx, tz, 0, th - 0.2);
    this.clueSpot('wj2', V(tx, th + 1, tz), 'A tooth taller than your leg');
    const [sx, sz, sh] = this._findGround(770, 300, 0.7, 3);
    this._props(b => { b.color(0x6a7a3a).blob(1.6, 0.4, 1.2, 0, 0.1, 0, 7, 3, 0.2); b.color(0xf07a6a).lump(0.3, 0.6, 0.35, 0.2, 0.4); }, sx, sz, 0.8, sh);
    this.clueSpot('sb1', V(sx, sh + 0.6, sz), 'A shell fragment, green with coral');
  }

  _open() {
    // the lighthouse
    const lx = -820, lz = -60;
    const lh = BA.buildLighthouse(9);
    const lp = this.place(lh, lx, lz, 0, heightAt(lx, lz) - 0.2);
    this.blockers.push({ x: lx, z: lz, r: 5 });
    this.anchors.lighthouse = { pos: V(lx, lp.y, lz + 3.4), face: 0 };
    this.anchors.lighthouseLamp = V(lx, lp.y + lh.lampY, lz);
    this.lights.push({ pos: V(lx, lp.y + lh.lampY, lz), color: 0xfff0b0, intensity: 3, dist: 60, night: true, beacon: true });
    this.clueSpot('kr1', V(lx + 1.6, lp.y + 4, lz + 1.6), 'Sucker marks all the way up the lighthouse');
    this._props(b => {
      b.color(0xd8a0a8);
      for (let i = 0; i < 9; i++) { const y = 1 + i * 1.5, a = 0.6 + Math.sin(i) * 0.3; b.cyl(0.35 - i * 0.02, 0.35 - i * 0.02, y, y + 0.05, 7, true, Math.cos(a) * 2.36, Math.sin(a) * 2.36); }
    }, lx, lz, 0, lp.y);
    const [dx, dz] = this._shore(lx, lz + 6, 0, 1, 40);
    this.place(BA.buildPier(10, 2.4, 1.3, 37), dx, dz - 2, 0, 0);
    this.moorings.push({ pos: V(dx + 3.4, 0, dz + 6), heading: 0, board: V(dx + 1, 1.3, dz + 6) });
    // stack wreck and the blue scale
    this.wreckAt(-712, 360, 1.0, 14, true, 'im2');
    const [bx, bz, bh] = this._findGround(-1022, 222, 0.5, 6, 40);
    this._scaleProp(bx, bz, bh, 0x3a6ab0);
    this.clueSpot('st2', V(bx, bh + 1, bz), 'A blue scale, still crackling');
    const [gx, gz, gh] = this._findGround(-300, 110, 0.6, 4);
    this._scaleProp(gx, gz, gh, 0x6ab04a);
    this.clueSpot('dev2', V(gx, gh + 1, gz), 'A green scale as big as a door');
    this.wreckAt(-275, 158, 0.6, 6, true, 'dev1');
  }

  _black() {
    // the Tidesinger - Captain Mare's wreck
    this.wreckAt(-560, 742, 1.4, 26, false, 'lk1', 'Tidesinger');
    // the shed skin round the spire
    const [sx, sz, sh] = this._findGround(-470, 712, 0.5, 10, 40);
    this._props(b => {
      b.color(0x3a3440);
      for (let i = 0; i < 9; i++) { b.push(0, i * 0.9, 0, 0.12 * (i % 2 ? 1 : -1), i * 0.7, 0); b.cyl(2.4, 2.4, 0, 0.35, 10, false); b.pop(); }
    }, -480, 700, 0, heightAt(-480, 700) - 1);
    this.clueSpot('he2', V(sx, sh + 1, sz), 'A shed skin wound nine times round the spire');
    // the Drowned Gate
    const gx = -680, gz = 820;
    const gate = BA.buildGate(13);
    const gy = heightAt(gx, gz) - 0.4;
    const gm = new THREE.Mesh(gate.geo, MAT.solid);
    gm.position.set(gx, gy, gz); gm.castShadow = true; gm.receiveShadow = true;
    this.group.add(gm);
    const rm = new THREE.Mesh(gate.glow, MAT.glow);
    rm.position.copy(gm.position);
    this.group.add(rm);
    this.glowMeshes.push(rm);
    this.anchors.gate = V(gx, gy, gz);
    this.C.box(gx - 4, gz, 0.95, 0.95, 0, gy - 2, gy + 12); this.C.box(gx + 4, gz, 0.95, 0.95, 0, gy - 2, gy + 12);
    this.lights.push({ pos: V(gx, gy + 6, gz + 2), color: 0x6af0ff, intensity: 2.5, dist: 40, night: false });
    this.interact.push({ id: 'gate', kind: 'gate', pos: V(gx, gy + 1.5, gz), r: 6, label: 'Touch the Drowned Gate' });
  }

  /* The progression, written on the sea: a ring of coloured buoys at every
     zone boundary. Past the yellow ring the fish get bigger; past the red
     one you need a real boat and a real rod. */
  _zoneBuoys() {
    const b = new MeshBuilder(rng(77));
    const g = new MeshBuilder(rng(78));
    for (const Z of ZONES) {
      if (!Z.r) continue;
      const n = Math.round(Z.r * Math.PI * 2 / 55);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU;
        const x = HOME_CENTRE.x + Math.cos(a) * Z.r, z = HOME_CENTRE.z + Math.sin(a) * Z.r;
        if (heightAt(x, z) > -3) continue;
        b.push(x, 0, z);
        b.color(Z.color).cyl(0.55, 0.4, -0.3, 1.0, 7, true);
        b.color(0xf4f0e8).cyl(0.57, 0.57, 0.45, 0.65, 7, false);
        b.color(0x2a2a2e).cyl(0.06, 0.06, 1.0, 2.6, 4, true);
        b.color(Z.color).card([0, 2.55, 0], [0, 2.05, 0], [0.8, 2.3, 0]);
        b.pop();
        g.push(x, 0, z); g.color(Z.color).blob(0.14, 0.14, 0.14, 0, 2.75, 0, 5, 3); g.pop();
      }
    }
    const m = new THREE.Mesh(b.build(), MAT.solid);
    m.name = 'zoneBuoys'; m.castShadow = true;
    this.group.add(m);
    const gm = new THREE.Mesh(g.build(), MAT.glow);
    this.group.add(gm);
    // and a sign on the pier that says so
    const A = this.anchors.pierEnd;
    const sg = BA.signBoard('BEYOND THE BUOYS: BIGGER FISH', 3.4, 0.5);
    sg.position.set(A.x - 1.45, 2.6, A.z - 2); sg.rotation.y = Math.PI / 2;
    this.group.add(sg);
    this._props(bb => bb.color(0x4a3526).box(0.14, 2.4, 0.14, 0, 1.2, 0), A.x - 1.5, A.z - 2, 0, 1.25);
  }

  wreckAt(x, z, depthOffset, len, bitten, clueId = null, name = null) {
    const geo = BA.buildWreck(len * 7 + (bitten ? 1 : 0), len, bitten);
    const h = heightAt(x, z);
    const y = Math.max(h, -3.2) - depthOffset * 0.3;
    const m = new THREE.Mesh(geo, MAT.solid);
    m.position.set(x, y, z); m.rotation.y = (x * 0.13) % TAU;
    m.castShadow = true; m.receiveShadow = true;
    this.group.add(m);
    this.C.box(x, z, 2.6, len / 2, m.rotation.y, y - 3, y + 3.5, 'wreck');
    if (clueId) this.clueSpot(clueId, V(x, Math.max(y + 2, 1.2), z), name ? 'The wreck of the ' + name : 'A bitten wreck', 12);
    return m;
  }

  _scaleProp(x, z, h, col) {
    const geo = BA.buildScale(col);
    const m = new THREE.Mesh(geo, MAT.solidDS);
    m.position.set(x, h - 0.2, z); m.rotation.set(-0.3, x % TAU, 0.2); m.scale.setScalar(1.6);
    m.castShadow = true;
    this.group.add(m);
    this.blockers.push({ x, z, r: 2 });
  }

  clueSpot(id, pos, label, r = 4) {
    this.clues[id] = { id, pos, label, r };
  }

  _clues() {
    // clue spots for sound/sonar types come straight from the data
    for (const L of LEVIATHANS) for (const c of L.clues) {
      if ((c.type === 'sound' || c.type === 'sonar') && c.at && !this.clues[c.id]) this.clues[c.id] = { id: c.id, pos: V(c.at[0], 0, c.at[1]), label: c.text, r: c.r || 80, zone: true };
    }
    // glinting markers so physical clues can be found
    const b = new MeshBuilder(rng(3));
    for (const k in this.clues) {
      const c = this.clues[k];
      if (c.zone) continue;
      b.push(c.pos.x, c.pos.y + 0.8, c.pos.z);
      b.color(0xfff0a0).lump(0.08, 0, 0, 0, 0.1);
      b.pop();
    }
    this.clueMarkers = new THREE.Mesh(b.build(), MAT.glow);
    this.group.add(this.clueMarkers);
  }
}
