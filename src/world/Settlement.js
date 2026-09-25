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

import * as THREE from '../../lib/three.module.js?v=1790358905';
import { MeshBuilder, shadeHex } from '../art/Geo.js?v=1790358905';
import { MAT } from '../art/Materials.js?v=1790358905';
import * as BA from '../art/BuildingArt.js?v=1790358905';
import { heightAt, groundAt, ICE_Y } from './Terrain.js?v=1790358905';
import { LEVIATHANS } from '../data/LeviathanData.js?v=1790358905';
import { ZONES, HOME_CENTRE } from './MapData.js?v=1790358905';
import { rng, TAU } from '../core/Util.js?v=1790358905';

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
    this.wrecks = [];
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
    this._vigil();
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
    // the harbour pier: the fish market moved to the cove by your hut
    const hs = BA.signBoard('DRIFTWOOD HARBOUR', 2.6, 0.5);
    hs.position.set(sx - 1.45, 1.25 + 2.2, sz + 3); hs.rotation.y = Math.PI / 2;
    this.group.add(hs);
    this._props(b => b.color(0x4a3526).box(0.14, 2.4, 0.14, 0, 1.2, 0), sx - 1.5, sz + 3, 0, 1.25);
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

    // --- your hut on the cove, Pim's stall and your dock ---
    this._home();

    // --- villager cottages ---
    const homes = [[-8, 132, 0.1], [22, 118, -0.15], [52, 124, 0.05], [-22, 188, 0.4], [-60, 170, 0.6], [66, 168, -0.3]];
    homes.forEach(([x, z, rot], i) => {
      const walls = [0x7a5236, 0x6a4a34, 0x8a6a4a, 0x5a6a7a, 0x7a3a2e, 0x6a7a5a][i];
      this._house({ w: 4.6 + (i % 2), d: 4.0, h: 2.6, rise: 1.6, seed: 30 + i, wall: walls, roof: [0x5a3a2e, 0x3e4a52, 0x6a3a2e][i % 3], doorX: 0.5, doorOpen: false, windows: [{ side: 'front', x: -1.2 }], porch: i % 2 === 0, floorH: 0.35, chimney: i % 3 === 0 }, x, z, rot);
    });
    // lamps along the paths and the waterfront
    for (const [x, z] of [[12, 150], [-12, 140], [40, 145], [70, 140], [-30, 150], [30, 180], [-24, 110], [60, 105], [84, 150], [104, 154]]) this._lamp(x, z);
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
    this.anchors.villageCentre = V(25, heightAt(25, 150), 150);
    this.anchors.wander = [[25, 150], [0, 140], [40, 130], [-20, 160], [60, 150], [10, 180], [-40, 140], [80, 150]].map(([x, z]) => V(x, heightAt(x, z), z));
  }

  /* ---------------- home: your hut, Pim's stall and your dock ----------------
     Step out of the door and Pim is right there behind the counter; ten steps
     on and you are on your own little dock with the boat tied up. The hut is
     small but lived in: bed, stove, table, a chart desk, a rod rack, and the
     trophy bookcase along the back wall that fills up as you play. */
  _home() {
    const cx = 124, cz = 150;
    const spec = { w: 7.6, d: 6.2, h: 3.2, rise: 2.1, seed: 21, wall: 0x84583a, roof: 0x5a3a2e, trim: 0x4a3322, doorX: 2.1, doorW: 1.15, doorH: 2.2, doorOpen: true,
      windows: [{ side: 'front', x: -1.6 }, { side: 'left', x: -0.2 }, { side: 'back', x: 2.35 }], porch: true, floorH: 0.4, chimney: true, interior: true };
    const cab = this._house(spec, cx, cz, 0, 'cabin');
    const fy = cab.y + 0.4;
    const hw = spec.w / 2 - 0.08, hd = spec.d / 2 - 0.08;
    this.anchors.cabinInside = V(cx, fy, cz);
    this.anchors.cabinDoor = { pos: V(cx + 2.1, fy, cz + 3.8), face: 0 };
    this.anchors.spawn = V(cx + 2.1, fy, cz + 4.3);
    const cs = BA.signBoard('HOME', 1.2, 0.36, { bg: '#6a4a30' });
    cs.position.set(cx + 2.1, fy + 2.5, cz + 3.13); this.group.add(cs);
    this.lights.push({ pos: V(cx - 0.2, fy + 2.3, cz + 0.2), color: 0xffc890, intensity: 1.7, dist: 10, night: false, interior: true });
    this.lights.push({ pos: V(cx - 3.0, fy + 0.6, cz - 1.9), color: 0xff8a3a, intensity: 0.8, dist: 5, night: false, interior: true, flicker: true });
    const g = new MeshBuilder(rng(5));     // glowing bits: lantern glass, stove fire
    this._props(b => {
      const r = rng(88);
      // ceiling beams and a rug
      b.color(0x4a3222); for (const z of [-1.9, 0, 1.9]) b.box(spec.w - 0.2, 0.16, 0.18, 0, spec.h - 0.14, z);
      b.color(0x7a2e26).box(2.6, 0.02, 1.8, 0.4, 0.01, 0.3);
      b.color(0xd8b060).box(2.2, 0.025, 1.4, 0.4, 0.012, 0.3);
      b.color(0x3a5a6a).box(1.4, 0.03, 0.6, 0.4, 0.014, 0.3);
      // --- the bed, front-left, with a patchwork quilt ---
      b.color(0x5a3e28).box(1.15, 0.4, 2.1, -3.1, 0.2, 1.85);
      b.color(0x4a3220).box(1.2, 1.0, 0.1, -3.1, 0.5, hd - 0.05);
      b.color(0x4a3220).box(1.2, 0.62, 0.1, -3.1, 0.31, 0.78);
      b.color(0xe8dcc0).box(1.05, 0.14, 1.95, -3.1, 0.47, 1.85);
      const quilt = [0xc84a3a, 0x3a6a8a, 0xe8c040, 0x6a8a4a, 0xa85a8a, 0xe88a3a];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) b.color(quilt[(i * 2 + j + 1) % quilt.length]).box(0.5, 0.06, 0.4, -3.35 + j * 0.51, 0.57, 0.98 + i * 0.41);
      b.color(0xf4f0e6).blob(0.4, 0.09, 0.2, -3.1, 0.62, 2.68, 7, 3);
      // bedside table and a lantern
      b.color(0x6a4a30).box(0.46, 0.56, 0.42, -2.25, 0.28, 2.72);
      b.color(0x3a3a3a).box(0.16, 0.04, 0.16, -2.25, 0.58, 2.72); b.color(0x3a3a3a).box(0.02, 0.22, 0.02, -2.18, 0.7, 2.66);
      g.color(0xffd27a).box(0.12, 0.18, 0.12, -2.25 + cx, 0.69 + fy, 2.72 + cz);
      b.color(0x3a3a3a).cone(0.1, 0.8, 0.9, 4, -2.25, 2.72, Math.PI / 4);
      // the sea chest at the foot of the bed
      b.color(0x5a3a24).box(0.92, 0.44, 0.5, -3.1, 0.22, 0.44);
      b.color(0x6a4a2e).box(0.94, 0.12, 0.52, -3.1, 0.5, 0.44);
      b.color(0x2e2e30); for (const x of [-3.45, -2.75]) b.box(0.05, 0.58, 0.54, x, 0.29, 0.44);
      b.color(0xd8b048).box(0.1, 0.1, 0.04, -3.1, 0.42, 0.7);
      // --- the stove against the left wall, with a kettle and a woodpile ---
      b.color(0x2a2a2e).box(0.72, 0.84, 0.66, -3.35, 0.42, -1.9);
      b.color(0x3a3a40).box(0.8, 0.06, 0.72, -3.35, 0.87, -1.9);
      b.color(0x3a3a40).cyl(0.09, 0.09, 0.9, spec.h, 6, true, -3.5, -1.9);
      g.color(0xff8a3a).box(0.02, 0.18, 0.3, -2.98 + cx, 0.36 + fy, -1.9 + cz);
      b.color(0x5a6a7a).lathe([[0.11, 0.9], [0.13, 0.98], [0.12, 1.08], [0.05, 1.12]], 7, -3.3, -1.8); b.color(0x3a3a3a).beam([-3.18, 1.02, -1.8], [-3.08, 1.1, -1.8], 0.02, 0.02);
      for (let i = 0; i < 5; i++) { b.color(shadeHex(0x7a5838, 0.8 + r() * 0.3)); b.push(-3.45 + (i % 2) * 0.16, 0.08 + Math.floor(i / 2) * 0.15, -1.1, Math.PI / 2, 0, 0); b.cyl(0.07, 0.07, -0.3, 0.3, 6, true); b.pop(); }
      // --- the table, two chairs, dinner ---
      b.color(0x7a5836).box(1.4, 0.08, 0.9, 1.1, 0.78, 0.5);
      b.color(0x5a4028); for (const px of [0.5, 1.7]) for (const pz of [0.15, 0.85]) b.box(0.07, 0.78, 0.07, px, 0.39, pz);
      for (const [pz, s] of [[-0.25, 1], [1.25, -1]]) {
        b.color(0x6a4a30).box(0.46, 0.05, 0.46, 1.1, 0.46, pz);
        for (const px of [0.9, 1.3]) for (const dz of [-0.18, 0.18]) b.box(0.05, 0.46, 0.05, px, 0.23, pz + dz);
        b.box(0.46, 0.55, 0.05, 1.1, 0.74, pz - s * 0.2);
      }
      b.color(0xe8e0d0).cyl(0.14, 0.16, 0.82, 0.84, 8, true, 0.9, 0.55);
      b.color(0xd8d0c0); b.push(0.9, 0.86, 0.55, 0, 0.3, 0); b.box(0.22, 0.01, 0.04, 0, 0, 0); for (let k = 0; k < 4; k++) b.box(0.01, 0.01, 0.1, -0.08 + k * 0.05, 0, 0); b.pop();
      b.color(0x9a5a3a).cyl(0.045, 0.04, 0.82, 0.94, 7, true, 1.4, 0.3); b.color(0x9a5a3a).cyl(0.045, 0.04, 0.82, 0.94, 7, true, 1.55, 0.72);
      b.color(0x6a3a22).box(0.3, 0.06, 0.22, 1.5, 0.85, 0.55); b.color(0xf0e6c8).box(0.28, 0.02, 0.2, 1.5, 0.89, 0.55);
      // --- the chart desk (back right) under the window ---
      b.color(0x6a4a30).box(1.5, 0.08, 0.66, 2.8, 0.82, -hd + 0.36);
      for (const px of [2.1, 3.5]) b.box(0.07, 0.82, 0.6, px, 0.41, -hd + 0.36);
      b.color(0x3a6a3a).box(0.46, 0.2, 0.28, 3.25, 0.96, -hd + 0.4);
      b.color(0x2a4a2a).box(0.48, 0.04, 0.3, 3.25, 1.07, -hd + 0.4);
      b.color(0xe8dcb8).box(0.5, 0.01, 0.36, 2.55, 0.865, -hd + 0.34); b.color(0xd8c8a0).box(0.34, 0.01, 0.3, 2.42, 0.872, -hd + 0.4);
      b.color(0x3a3a3a).cyl(0.012, 0.012, 0.86, 1.1, 4, true, 2.2, -hd + 0.25);
      b.color(0xb8a060).lathe([[0.03, 0.86], [0.07, 0.88], [0.04, 0.92]], 6, 2.9, -hd + 0.48);
      // --- by the door: coat hooks, a yellow oilskin, boots ---
      b.color(0x4a3222).box(0.6, 0.08, 0.06, 3.2, 1.75, hd - 0.02);
      b.color(0xe8c040).box(0.42, 0.85, 0.12, 3.05, 1.3, hd - 0.1); b.color(0xd8b030).box(0.14, 0.7, 0.13, 2.8, 1.35, hd - 0.1);
      b.color(0xe8c040).cyl(0.14, 0.2, 1.72, 1.88, 7, true, 3.4, hd - 0.14);
      b.color(0x2e3a2e); for (const px of [2.95, 3.2]) { b.box(0.13, 0.36, 0.14, px, 0.18, 2.55); b.box(0.13, 0.08, 0.26, px, 0.04, 2.49); }
      // --- the rod rack on the right wall ---
      b.color(0x4a3222); for (const y of [0.45, 1.95]) b.box(0.1, 0.1, 3.2, hw - 0.05, y, -0.95);
      for (let i = 0; i < 9; i++) b.color(0x3a2a1a).box(0.14, 0.05, 0.05, hw - 0.1, 1.95, -2.45 + i * 0.37);
      // a wall shelf for the strange things you find, above the rack
      b.color(0x5a3e28).box(0.3, 0.05, 3.1, hw - 0.14, 2.45, -0.95);
      // the hanging lantern and its chain
      b.color(0x3a3a3a).box(0.02, 0.5, 0.02, -0.2, spec.h - 0.45, 0.2);
      b.color(0x2e2e30).box(0.26, 0.05, 0.26, -0.2, spec.h - 0.72, 0.2); b.color(0x2e2e30).box(0.26, 0.05, 0.26, -0.2, spec.h - 1.05, 0.2);
      g.color(0xffe0a0).box(0.2, 0.28, 0.2, -0.2 + cx, spec.h - 0.88 + fy, 0.2 + cz);
      // a pot plant on the window sill, a net over the bed corner
      b.color(0xa85a3a).cyl(0.1, 0.08, 0.9, 1.08, 7, true, -1.6, hd - 0.12);
      b.color(0x5a9a3a); for (let k = 0; k < 5; k++) b.card([-1.6, 1.08, hd - 0.12], [-1.6 + Math.cos(k) * 0.18, 1.3, hd - 0.12 + Math.sin(k) * 0.12], [-1.6 + Math.cos(k + 0.4) * 0.12, 1.34, hd - 0.12 + Math.sin(k + 0.4) * 0.1]);
      b.color(0xc4b48a); for (let k = 0; k < 8; k++) b.card([-hw + 0.05, spec.h - 0.2, 1.2 + k * 0.2], [-hw + 0.05, spec.h - 0.7 - (k % 3) * 0.15, 1.3 + k * 0.2], [-hw + 0.6, spec.h - 0.25, 1.25 + k * 0.2]);
      // a barrel of old nets in the back-left corner
      BA.buildBarrel(b, -3.35, 0, -2.72);
      b.color(0xc4b48a).blob(0.3, 0.12, 0.3, -3.35, 0.95, -2.72, 6, 2, 0.3);
    }, cx, cz, 0, fy, 88);
    const gm = new THREE.Mesh(g.build(), MAT.glow); this.group.add(gm);
    // furniture colliders
    const box = (x, z, w, d, h) => this.C.box(cx + x, cz + z, w / 2, d / 2, 0, fy - 1, fy + h);
    box(-3.1, 1.85, 1.2, 2.15, 0.62); box(-2.25, 2.72, 0.46, 0.42, 0.6); box(-3.1, 0.44, 0.95, 0.52, 0.56);
    box(-3.35, -1.9, 0.8, 0.72, 1.0); box(1.1, 0.5, 1.45, 0.95, 0.85); box(2.8, -hd + 0.36, 1.5, 0.66, 0.9);
    box(-3.35, -2.72, 0.75, 0.75, 1.0);
    // --- the trophy bookcase on the back wall ---
    const bc = new MeshBuilder(rng(61));
    const shelf = BA.buildBookcase(bc, rng(62));
    const bx = -0.9, bz = -hd + shelf.D / 2 + 0.02;
    this.place({ geo: bc.build() }, cx + bx, cz + bz, 0, fy);
    this.C.box(cx + bx, cz + bz, shelf.W / 2, shelf.D / 2, 0, fy - 1, fy + shelf.H);
    const toW = s => ({ ...s, pos: V(cx + bx + s.x, fy + s.y, cz + bz + s.z), face: 0 });
    this.cabin.trophies = { S: shelf.S.map(toW), L: shelf.L.map(toW) };
    this.interact.push({ id: 'bookcase', kind: 'bookcase', pos: V(cx + bx, fy + 1.3, cz + bz + 0.4), r: 2.2, label: 'Look at your trophies' });
    // the map pinned over the chart desk (drawn by Cabin, which knows the save)
    this.anchors.cabinMap = { pos: V(cx + 2.8, fy + 1.95, cz - hd + 0.04), face: 0 };
    this.interact.push({ id: 'cabinmap', kind: 'map', pos: V(cx + 2.8, fy + 1.5, cz - hd + 0.6), r: 1.2, label: 'Study the chart' });
    this.interact.push({ id: 'bed', kind: 'bed', pos: V(cx - 3.1, fy + 0.5, cz + 1.85), r: 1.8, label: 'Sleep until morning' });
    this.interact.push({ id: 'journal', kind: 'journal', pos: V(cx + 1.5, fy + 0.85, cz + 0.55), r: 1.4, label: 'Read your fishing journal' });
    // fish plaques: the left wall by the stove and the front wall around the window
    const slots = [];
    for (const z of [-2.6, -1.25]) slots.push({ p: [-hw + 0.02, 1.95, z], face: Math.PI / 2 });
    for (const x of [-3.0, -0.3]) slots.push({ p: [x, 2.35, hd - 0.02], face: Math.PI });
    for (const x of [0.7, 1.35]) slots.push({ p: [x, 1.55, hd - 0.02], face: Math.PI });
    this.cabin.slots = slots.map((s, i) => ({ i, pos: V(cx + s.p[0], fy + s.p[1], cz + s.p[2]), face: s.face }));
    // photos on the right wall, by the door
    const photos = [];
    for (const z of [1.0, 1.75]) for (const y of [1.25, 1.85]) photos.push({ p: [hw - 0.02, y, z], face: -Math.PI / 2 });
    for (const x of [-2.35, -1.6, -0.85, 0.35]) photos.push({ p: [x, 1.2 + (x > 0 ? 0 : 0.95), hd - 0.02], face: Math.PI });
    this.cabin.photos = photos.map((s, i) => ({ i, pos: V(cx + s.p[0], fy + s.p[1], cz + s.p[2]), face: s.face }));
    for (let i = 0; i < 8; i++) this.cabin.shelf.push({ i, pos: V(cx + hw - 0.14, fy + 2.48, cz - 2.35 + i * 0.4) });
    // the rod rack: each rod you own stands in its own peg
    this.cabin.rack = { pos: V(cx + hw - 0.12, fy, cz - 2.45), step: 0.37, face: -Math.PI / 2 };

    // --- outside: porch bench, woodpile, pots, a boat upside down on the grass ---
    const oy = heightAt(cx, cz + 5);
    this._props(b => {
      const r = rng(71);
      BA.buildBench(b, -1.8, 0, 0, 0);
      b.color(0x6a4a2e).box(0.5, 0.4, 0.4, -3.2, 0.2, -0.1); b.color(0x9aa0a8).lathe([[0.12, 0.4], [0.15, 0.62], [0.16, 0.64]], 8, -3.2, -0.1);
      void r;
    }, cx, cz + 4.2, 0, fy - 0.02);
    this._props(b => BA.buildWoodpile(b, rng(3)), cx - 5.6, cz + 1.5, Math.PI / 2);
    this.C.box(cx - 5.6, cz + 1.2, 0.5, 1.2, Math.PI / 2, oy - 1, oy + 1);
    this._props(b => { b.push(0, 0.05, 0, 0, 0, 0.12); BA.buildRowboat(b, rng(4), 0x2e5a86, false); b.pop(); b.color(0x6a4a30); for (const z of [-1, 1]) b.box(0.3, 0.14, 0.4, 0.5, 0.07, z); }, cx - 7.5, cz + 8.5, 0.8);
    this.C.box(cx - 7.5, cz + 8.5, 0.8, 1.7, 0.8, oy - 1, oy + 0.8);
    this._props(b => BA.buildCrabPots(b, rng(5), 3), cx + 5.8, cz + 2.2, -0.3);
    this.C.box(cx + 5.8, cz + 2.2, 0.8, 0.4, -0.3, oy - 1, oy + 1);
    this._props(b => BA.buildNetRack(b, 0, 0, 0, 0), cx - 4.5, cz + 11.5, 0.2);
    this.C.box(cx - 4.5, cz + 11.5, 1.3, 0.2, 0.2, oy - 1, oy + 2);
    for (const [x, z] of [[cx - 1.5, cz + 7.5], [cx + 4.5, cz + 13]]) this._lamp(x, z);
    // a signpost where the village path meets your gate
    this._props(b => {
      b.color(0x4a3526).box(0.14, 2.3, 0.14, 0, 1.15, 0);
    }, cx - 11, cz + 8.5, 0);
    const sp1 = BA.signBoard('VILLAGE', 1.1, 0.3, { bg: '#7a5a3a' }); sp1.position.set(cx - 11.6, heightAt(cx - 11, cz + 8.5) + 2.0, cz + 8.5); sp1.rotation.y = Math.PI / 2; this.group.add(sp1);
    const sp2 = BA.signBoard('HOME  &  DOCK', 1.4, 0.3, { bg: '#7a5a3a' }); sp2.position.set(cx - 10.3, heightAt(cx - 11, cz + 8.5) + 1.6, cz + 8.5); sp2.rotation.y = -Math.PI / 2 + 0.3; this.group.add(sp2);

    // --- Pim's stall, right outside your door ---
    const px = cx + 7.4, pz = cz + 7.0, prot = -Math.PI / 2;
    const py = heightAt(px, pz);
    this._props(b => {
      const r = rng(81);
      BA.buildFishStall(b, r);
      BA.buildBarrel(b, 1.95, 0, -0.9);
      BA.buildCrate(b, -2.1, 0, -0.6, 0.6, 0x9a7446, 0.4);
      BA.buildFishBasket(b, r, -2.05, 0.75);
      BA.buildFishBasket(b, r, 2.1, 0.8);
    }, px, pz, prot, py);
    this.C.box(px, pz, 1.6, 0.6, prot, py - 1, py + 1.1);
    this.C.box(...this._w(0, -0.95, px, pz, prot), 1.2, 0.3, prot, py - 1, py + 0.95);
    const pa = this._w(0, -1.5, px, pz, prot);
    this._npcAnchor('market', V(pa[0], py, pa[1]), prot);
    const ms = BA.signBoard("PIM'S FRESH FISH", 2.4, 0.5);
    const msp = this._w(0, 0.98, px, pz, prot);
    ms.position.set(msp[0], py + 2.12, msp[1]); ms.rotation.y = prot; this.group.add(ms);
    const cb = BA.signBoard('FISH BOUGHT HERE', 1.2, 0.5, { bg: '#2a2e2a', ink: '#f2eee2' });
    const cbp = this._w(-2.2, 1.3, px, pz, prot);
    cb.position.set(cbp[0], py + 0.55, cbp[1]); cb.rotation.set(-0.15, prot, 0); this.group.add(cb);
    this._props(b => { b.color(0x4a3526).beam([0, 0, -0.1], [0, 1.0, 0.05], 0.05, 0.05); }, cbp[0], cbp[1], prot, py);
    this.blockers.push({ x: px, z: pz, r: 3.5 });
    this.lights.push({ pos: V(px, py + 2.3, pz), color: 0xffc070, intensity: 1.2, dist: 9, night: true });

    // --- your dock ---
    const [dx, dz] = this._shore(cx + 6, cz + 12, 0, 1, 80);
    const dLen = 34;
    this.place(BA.buildPier(dLen, 2.8, 1.25, 51), dx, dz - 5, 0, 0);
    this.blockers.push({ x: dx, z: dz, r: 4 });
    this.anchors.homeDock = V(dx, 1.25, dz - 5 + dLen - 1.5);
    // the home mooring: where your boat waits, and where it is towed back to
    this.moorings.unshift({ pos: V(dx + 3.9, 0, dz + dLen - 13), heading: 0, board: V(dx + 1.3, 1.25, dz + dLen - 13), home: true });
    this.anchors.mooring = this.moorings[0];
    this._props(b => {
      const r = rng(91);
      BA.buildCrate(b, -0.9, 1.25, 3.5, 0.7, 0x9a7446, 0.2);
      BA.buildCrate(b, -0.9, 1.95, 3.55, 0.5, 0xa88456, 0.8);
      BA.buildBarrel(b, 0.95, 1.25, 7.5);
      BA.buildFishBasket(b, r, -0.85, 9.2); b.push(0, 1.25, 0); b.pop();
      b.color(0xc4b48a).cyl(0.34, 0.34, 1.25, 1.42, 8, true, 0.9, 14.5); b.color(0xa8985a).cyl(0.2, 0.2, 1.42, 1.44, 8, true, 0.9, 14.5);
      for (const z of [6, 12, 18]) for (const s of [-1, 1]) { b.color(0x3a3a3a).cyl(0.12, 0.14, 1.25, 1.62, 6, true, s * 1.25, z); b.color(0x5a5a5a).cyl(0.16, 0.16, 1.6, 1.66, 6, true, s * 1.25, z); }
    }, dx, dz - 5, 0, 0);
    this.C.box(dx - 0.9, dz - 1.5, 0.4, 0.4, 0, 0, 2.6); this.C.circle(dx + 0.95, dz + 2.5, 0.42, 0, 2.3);
    for (const z of [3, 15]) this._lampOn(dx - 1.3, dz - 5 + z, 1.25);
    // a little rowboat tied up on the far side of the dock
    const rbx = dx - 3.2, rbz = dz + 9;
    this._props(b => BA.buildRowboat(b, rng(6), 0x8a3a2e), rbx, rbz, 0.05, -0.15);
    this.C.box(rbx, rbz, 0.9, 1.8, 0.05, -2, 0.7);
    // the trophy yard for giants and skulls: two rows on the lawn west of the hut
    this.cabin.yard = [];
    for (let i = 0; i < 12; i++) {
      const X = cx - 25 + (i % 6) * 3.4, Z = cz - 6 + Math.floor(i / 6) * 5;
      const Y = heightAt(X, Z);
      this.cabin.yard.push({ i, pos: V(X, Y + 0.6, Z), ground: Y, face: 0 });
    }
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

  /* ---------------- Vigil's End ----------------
     The last island. A notch in the cliffs with a bone arch and a dock, a
     path climbing past a terrace to Maud's little hut on the top, and six
     old fishermen spaced round the cliff edge, lines hanging a hundred feet
     down into the fog. The water around it is full of rocks. */
  _vigil() {
    const VX = 1015, VZ = 1005;
    const r = rng(555);
    // --- the landing: bone arch, dock, mooring ---
    const dirx = -0.72, dirz = -0.69, rot = Math.atan2(dirx, dirz);
    const [shx, shz] = this._shore(955, 950, dirx, dirz, 80);
    const ox = shx - dirx * 5, oz = shz - dirz * 5;
    const dLen = 22;
    this.place(BA.buildPier(dLen, 2.8, 1.3, 71), ox, oz, rot, 0);
    this.blockers.push({ x: shx, z: shz, r: 5 });
    const [mx, mz] = this._w(3.9, dLen - 9, ox, oz, rot), [bx, bz] = this._w(1.3, dLen - 9, ox, oz, rot);
    this.moorings.push({ pos: V(mx, 0, mz), heading: rot, board: V(bx, 1.3, bz), vigil: true });
    const [ex, ez] = this._w(0, dLen - 1.5, ox, oz, rot);
    this.anchors.vigilLanding = V(ex, 1.3, ez);
    for (const z of [4, 16]) { const [lx, lz] = this._w(-1.3, z, ox, oz, rot); this._lampOn(lx, lz, 1.3); }
    // the whalebone arch over the top of the dock
    const [ax, az] = this._w(0, 1, ox, oz, rot);
    const ay = heightAt(ax, az);
    this._props(b => {
      b.color(0xe8dcc0);
      for (const s of [-1, 1]) {
        let px = s * 2.2, py = -0.5, pz = 0;
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 0.55; const nx = s * (2.2 - Math.sin(a) * 2.0), ny = -0.5 + Math.sin(a + 0.3) * 6.2 + k * 0.1; b.color(k % 2 ? 0xe8dcc0 : 0xd8ccb0).tube([px, py, pz], [nx, ny, 0], 0.32 - k * 0.02, 0.3 - k * 0.02, 6); px = nx; py = ny; }
      }
      b.color(0x5a4a3a).box(3.2, 0.5, 0.12, 0, 4.6, 0.25);
    }, ax, az, rot, ay);
    const vs = BA.signBoard("VIGIL'S END", 3.0, 0.46, { bg: '#5a5048', ink: '#e8e4d8' });
    const [vsx, vsz] = this._w(0, 1.3, ax, az, rot); vs.position.set(vsx, ay + 4.6, vsz); vs.rotation.y = rot; this.group.add(vs);
    for (const s of [-1, 1]) { const [cx2, cz2] = this._w(s * 2.2, 0, ax, az, rot); this.C.circle(cx2, cz2, 0.4, ay - 2, ay + 5); }
    // --- the path up: terrace, cairns for the lost, the hut on top ---
    const [tx, tz] = [975, 968];
    this._props(b => {
      // memorial cairns: a stone for every boat that did not come back
      for (let k = 0; k < 4; k++) {
        const px = -4 + k * 2.6 + (r() - 0.5), pz = -3 + (r() - 0.5) * 2;
        b.color(0x6a6e72); for (let j = 0; j < 4; j++) b.lump(0.45 - j * 0.08, px, 0.2 + j * 0.42, pz, 0.35, 0.7);
        b.color(0x8a8e92).box(0.1, 0.9, 0.1, px + 0.5, 0.45, pz); b.color(0x5a4a3a).box(0.5, 0.08, 0.06, px + 0.5, 0.8, pz);
      }
      BA.buildBench(b, 3, 0, 1, rot);
    }, tx, tz, 0);
    this.interact.push({ id: 'cairns', kind: 'cairns', pos: V(tx - 1, heightAt(tx, tz) + 1, tz - 3), r: 3.5, label: 'Read the names on the cairns' });
    this._lamp(965, 958); this._lamp(986, 976); this._lamp(1003, 993);
    // Maud's hut: small, weathered, alone on the cliff top, door facing the landing
    const hx = 996, hz = 985;
    const hut = this._house({ w: 4.4, d: 3.8, h: 2.5, rise: 1.5, seed: 77, wall: 0x5a5048, roof: 0x3a3e42, trim: 0x2e2a28, doorX: -0.8, doorW: 1.0, doorOpen: false,
      windows: [{ side: 'front', x: 1.0 }, { side: 'left', x: 0 }], porch: true, floorH: 0.3, chimney: true }, hx, hz, rot, 'vigilHut');
    this.lights.push({ pos: V(hx, hut.y + 2, hz), color: 0xffb070, intensity: 1.4, dist: 10, night: true });
    // her table of fish and a lantern, by the porch
    const [stx, stz] = this._w(1.2, 4.2, hx, hz, rot);
    const sty = heightAt(stx, stz);
    this._props(b => {
      b.color(0x5a4a3a).box(2.2, 0.08, 0.8, 0, 0.92, 0);
      for (const px of [-1, 1]) for (const pz of [-0.32, 0.32]) b.box(0.08, 0.92, 0.08, px, 0.46, pz);
      b.color(0xd8e8f0).box(0.8, 0.1, 0.6, -0.5, 1.0, 0); b.color(0x6a7478); for (let k = 0; k < 3; k++) b.blob(0.26, 0.05, 0.07, -0.5 + (k - 1) * 0.05, 1.08 + k * 0.03, (k - 1) * 0.18, 5, 2);
      BA.buildFishBasket(b, r, 0.6, 0); b.push(0, 0.96, 0); b.pop();
      BA.buildBarrel(b, 1.5, 0, -0.6); BA.buildCrate(b, -1.6, 0, -0.5, 0.6, 0x7a6a56, 0.3);
      b.color(0x2e2e30).box(0.2, 0.3, 0.2, 0.2, 1.1, 0.2);
    }, stx, stz, rot, sty);
    this.C.box(stx, stz, 1.15, 0.45, rot, sty - 1, sty + 1);
    const [smx, smz] = this._w(1.2, 3.2, hx, hz, rot);
    this._npcAnchor('vigilSeller', V(smx, heightAt(smx, smz), smz), rot);
    const ms = BA.signBoard('FISH BOUGHT  -  RODS', 2.0, 0.36, { bg: '#4a4440', ink: '#e8e4d8' });
    const [msx, msz] = this._w(1.2, 4.62, hx, hz, rot); ms.position.set(msx, sty + 1.6, msz); ms.rotation.y = rot; this.group.add(ms);
    // the vigil bell on its post
    const [blx, blz] = this._w(-3.6, 3.2, hx, hz, rot);
    const bly = heightAt(blx, blz);
    this._props(b => {
      b.color(0x3a3228).box(0.2, 3.2, 0.2, -0.8, 1.6, 0); b.box(0.2, 3.2, 0.2, 0.8, 1.6, 0); b.box(2.0, 0.2, 0.24, 0, 3.2, 0);
      b.color(0x8a7a4a).lathe([[0.02, 3.1], [0.2, 3.0], [0.3, 2.6], [0.42, 2.25], [0.44, 2.2]], 9, 0, 0);
      b.color(0x5a4a2a).cyl(0.06, 0.06, 2.2, 2.35, 6, true);
    }, blx, blz, rot, bly);
    this.C.circle(blx, blz, 1.0, bly - 1, bly + 3.4);
    this.interact.push({ id: 'vbell', kind: 'bell', pos: V(blx, bly + 2.4, blz), r: 2.6, label: 'Ring the vigil bell' });
    // --- the six fishermen, each on their own stretch of cliff ---
    const angles = [-1.75, -0.95, -0.1, 0.75, 1.55, 2.35];
    angles.forEach((a, i) => {
      const e = this._cliffEdge(VX, VZ, a);
      const fx = e.x - Math.cos(a) * 1.1, fz = e.z - Math.sin(a) * 1.1;
      const fy = heightAt(fx, fz);
      const face = Math.atan2(Math.cos(a), Math.sin(a));
      const sit = [0, 2, 4].includes(i);
      this._props(b => {
        if (sit) { b.color(0x6a6e72).lump(0.42, 0, 0.1, -0.1, 0.25, 0.55); b.color(0x7a7e82).box(0.7, 0.08, 0.5, 0, 0.42, -0.05); }
        b.color(0x6a4a30).box(0.5, 0.35, 0.4, 0.9, 0.17, -0.5);
        b.color(0x8a8a90).lathe([[0.14, 0], [0.17, 0.26], [0.18, 0.28]], 8, -0.8, -0.4);
        b.color(0x2e2e30).box(0.18, 0.26, 0.18, -0.9, 0.13, 0.3);
      }, fx, fz, face, fy);
      const [lx, lz] = this._w(-0.9, 0.3, fx, fz, face);
      this.lights.push({ pos: V(lx, fy + 0.4, lz), color: 0xffc070, intensity: 0.9, dist: 6, night: true });
      this.anchors['vigil' + (i + 1)] = { pos: V(fx, fy + (sit ? 0.42 : 0), fz), face, line: V(e.x + Math.cos(a) * 26, 0, e.z + Math.sin(a) * 26) };
      this.C.circle(fx, fz, 0.5, fy - 1, fy + 1.5);
    });
    this.anchors.vigilHut = { pos: V(hx, hut.y, hz), face: rot };
    // --- the rocks: a field of stone round the island, clear to see, hard to thread ---
    this.rocks = [];
    const rb = new MeshBuilder(rng(556)), foam = new MeshBuilder(rng(557));
    for (let tries = 0; tries < 2400 && this.rocks.length < 90; tries++) {
      const ang = r() * TAU, d = 105 + Math.pow(r(), 0.8) * 270;
      const x = VX + Math.cos(ang) * d, z = VZ + Math.sin(ang) * d;
      if (heightAt(x, z) > -5) continue;
      const rad = 1.6 + r() * r() * 5.5;
      if (this.rocks.some(q => Math.hypot(q.x - x, q.z - z) < q.r + rad + 11)) continue;
      const tall = r() < 0.2 ? 0.5 + r() * 0.8 : 2 + r() * rad * 1.6;
      this.rocks.push({ x, z, r: rad, h: tall });
      rb.push(x, 0, z, 0, r() * TAU, 0);
      rb.color(0x2e3236).lump(rad, 0, -1.5, 0, 0.3, 1.1);
      const n = 2 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const kr = rad * (0.45 + r() * 0.4), kx = (r() - 0.5) * rad * 0.8, kz = (r() - 0.5) * rad * 0.8;
        rb.color(k === 0 ? 0x4a4e54 : 0x3c4046).lump(kr, kx, tall * (0.35 + r() * 0.5), kz, 0.35, (tall / kr) * 0.55 + 0.4);
      }
      rb.color(0x6a6e72).lump(rad * 0.35, 0, tall * 0.85, 0, 0.3, 0.5);     // pale, bird-stained tops
      rb.color(0xd8dcd8).lump(rad * 0.12, rad * 0.1, tall * 0.98, 0, 0.3, 0.4);
      rb.pop();
      foam.push(x, 0.06, z);
      foam.color(0xe8f0f0);
      for (let k = 0; k < 10; k++) { const a0 = k / 10 * TAU, a1 = (k + 1) / 10 * TAU, R0 = rad * 1.05, R1 = rad * 1.35; foam.quad([Math.cos(a0) * R0, 0, Math.sin(a0) * R0], [Math.cos(a1) * R0, 0, Math.sin(a1) * R0], [Math.cos(a1) * R1, 0, Math.sin(a1) * R1], [Math.cos(a0) * R1, 0, Math.sin(a0) * R1], [0, 1, 0]); }
      foam.pop();
      this.C.circle(x, z, rad * 0.95, -30, tall + 1, 'rock');
    }
    const rm = new THREE.Mesh(rb.build(), MAT.solid); rm.castShadow = true; rm.receiveShadow = true; rm.name = 'vigilRocks';
    this.group.add(rm);
    const fm = new THREE.Mesh(foam.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }));
    fm.renderOrder = 3; fm.name = 'vigilFoam';
    this.group.add(fm);
    this.vigilFoam = fm;
  }

  /** Walk out from an island centre along an angle to the lip of the cliff. */
  _cliffEdge(cx, cz, a) {
    let last = { x: cx, z: cz };
    for (let d = 10; d < 140; d += 1) {
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (heightAt(x, z) < 9) return last;
      last = { x, z };
    }
    return last;
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
    this.wrecks.push({ x, z });
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
