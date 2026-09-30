/* PirateIsland.js - Blackflag Isle, where the pirates live.

   No chart shows it and a fog bank sits on it. Come in from the north and
   the first thing you see is a skull thirty metres high carved out of the
   rock at the harbour mouth, its eyes lit red at night.

   The harbour: a dock with the pirates' own galley tied up, and a berth where
   they leave the boats they take. The beach: three wooden cages - one of them
   yours, if they caught you. Up the slope: the camp - tents, a fire that never
   goes out, rum, a storehouse where they keep what they take off prisoners
   (the stash), and Rattigan the Fence, who will sell anyone anything. Two
   watchtowers. Two ships' corpses on the beaches. And in the middle of the
   island a lake they will not swim in, with the mast of a sunken ship
   sticking out of it and a bell on the mast.

   South of the lake, behind a gap in the rocks that a trail of little skull
   cairns leads to, a cave: the pirates' vault, and their hoard.

   Everything that moves (guards, cages, the stash, the hoard) is run by
   game/PirateIsle.js from the anchors made here (S.isle.pirate). */

import * as THREE from '../../lib/three.module.js';
import { MeshBuilder, shadeHex } from '../art/Geo.js';
import { MAT } from '../art/Materials.js';
import * as BA from '../art/BuildingArt.js';
import { buildBoat } from '../art/BoatArt.js';
import { HULL_BY_ID } from '../data/BoatData.js';
import { galleyDress, skullShape } from '../art/ShipArt.js';
import { heightAt } from './Terrain.js';
import { PIRATE_ISLE, LAKES } from './MapData.js';
import { dock, stand, sign, light } from './Islands.js';
import { rng, TAU } from '../core/Util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const I = PIRATE_ISLE;

/* ---------------- pieces ---------------- */
/** A wooden cage, 2.4 m square: plank floor, bars, a roof. Front (+Z) is the door. */
function cageGeo(r) {
  const b = new MeshBuilder(r), d = new MeshBuilder(r);
  const s = 1.2, H = 2.3;
  for (let i = 0; i < 6; i++) b.color(shadeHex(0x5a3e28, 0.85 + r() * 0.2)).box(2.4 / 6 * 0.95, 0.1, 2.4, -s + (i + 0.5) * 0.4, 0.05, 0);
  b.color(0x3a2a1c);
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) b.box(0.14, H, 0.14, x, H / 2, z);
  for (const y of [0.15, H - 0.1]) { b.box(2.5, 0.1, 0.1, 0, y, -s); b.box(0.1, 0.1, 2.5, -s, y, 0); b.box(0.1, 0.1, 2.5, s, y, 0); }
  b.color(0x4a3222);
  for (let k = 1; k < 8; k++) { const t = -s + k * 0.3; b.box(0.05, H - 0.2, 0.05, t, H / 2, -s); b.box(0.05, H - 0.2, 0.05, -s, H / 2, t); b.box(0.05, H - 0.2, 0.05, s, H / 2, t); }
  for (let i = 0; i < 6; i++) b.color(shadeHex(0x4a3a2a, 0.85 + r() * 0.2)).box(2.6 / 6 * 0.95, 0.07, 2.7, -1.3 + (i + 0.5) * 2.6 / 6, H + 0.05, 0);
  // the door: bars on a frame, a lock
  d.color(0x3a2a1c); d.box(2.3, 0.1, 0.1, 0, 0.15, 0); d.box(2.3, 0.1, 0.1, 0, H - 0.1, 0);
  d.color(0x4a3222); for (let k = 1; k < 8; k++) d.box(0.05, H - 0.2, 0.05, -s + k * 0.3, H / 2, 0);
  d.color(0x2a2a2e).box(0.16, 0.2, 0.08, 0.9, 1.1, 0.04); d.color(0x8a8a90).box(0.04, 0.08, 0.1, 0.9, 1.0, 0.06);
  return { geo: b.build(), door: d.build() };
}
/** A giant skull carved in rock, facing +Z, `s` metres tall. */
function giantSkull(s, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const k = s / 30;
  b.color(0x8a847a).blob(14 * k, 12 * k, 12 * k, 0, 18 * k, 0, 12, 7, 0.06);
  b.color(0x7a746a).blob(10 * k, 6 * k, 9 * k, 0, 8 * k, 3 * k, 10, 5, 0.08);           // cheekbones and upper jaw
  b.color(0x6a645a).blob(8 * k, 4 * k, 7 * k, 0, 2.5 * k, 3.5 * k, 9, 4, 0.1);           // the jaw
  // the eyes and the nose: black hollows, with a red fire far back in them
  for (const sx of [-1, 1]) { b.color(0x141210).blob(3.4 * k, 3.8 * k, 2 * k, sx * 5 * k, 14 * k, 10.2 * k, 8, 4); g.color(0xff3a1a).blob(1.3 * k, 1.5 * k, 0.4 * k, sx * 5 * k, 14 * k, 12.3 * k, 6, 3); }
  b.color(0x141210); b.tri([0, 11 * k, 11.6 * k], [-1.6 * k, 8.4 * k, 11 * k], [1.6 * k, 8.4 * k, 11 * k]);
  // teeth
  b.color(0xb8b2a4); for (let t = -3; t <= 3; t++) { b.box(1.3 * k, 2.2 * k, 1 * k, t * 1.45 * k, 5.6 * k, 9.4 * k - Math.abs(t) * 0.5 * k); b.box(1.2 * k, 1.8 * k, 0.9 * k, t * 1.45 * k, 3.3 * k, 9 * k - Math.abs(t) * 0.5 * k); }
  // cracks and moss
  b.color(0x4a5a3a); for (let i = 0; i < 12; i++) { const a = r() * TAU; b.lump(1.2 * k, Math.cos(a) * 12 * k, 20 * k + r() * 8 * k, Math.sin(a) * 11 * k, 0.4, 0.4); }
  return { geo: b.build(), glow: g.build() };
}

/* ---------------- the island ---------------- */
export function buildPirateIsland(S) {
  const r = rng(1717);
  const out = S.isle.pirate = { cages: [], guards: [], fires: [], lanterns: [], cx: I.x, cz: I.z };
  const Cc = S.C;
  // --- the harbour: a dock north off the beach ---
  const D = dock(S, 'blackflag', I.x + 25, I.z + 160, 0, 1, 26, 1717);
  out.berth = S.moorings[S.moorings.length - 1];             // where they tie up the boats they take
  out.berth.pirate = true;
  // their galley alongside the other side of the pier: scenery, gently riding the swell
  const gh = HULL_BY_ID.galley;
  const gal = buildBoat({ hull: 'galley', parts: {}, paint: 'pirate', decor: [] });
  gal.group.add(galleyDress(gh, gh.deck));
  const [gx, gz] = S._w(-gh.hw - 2.2, 26 - 10, D.ox, D.oz, D.rot);
  gal.group.position.set(gx, -gh.draft * 0.35, gz); gal.group.rotation.y = D.rot + Math.PI;
  S.group.add(gal.group);
  out.galley = gal.group;
  Cc.circle(gx, gz, gh.hw + 0.4, -3, 3);
  sign(S, 'NO QUARTER', I.x + 22, I.z + 184, Math.PI, null, { w: 2.4 });

  // --- the beach: three cages on the sand below the camp, and the guard's post ---
  const by = heightAt(I.x + 25, I.z + 175);
  for (let i = 0; i < 3; i++) {
    const x = I.x + 6 + i * 4.2, z = I.z + 170, y = heightAt(x, z) - 0.02, rot = Math.PI;     // doors face the camp (south)
    const cg = cageGeo(r);
    const m = new THREE.Mesh(cg.geo, MAT.solid); m.position.set(x, y, z); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true; S.group.add(m);
    const door = new THREE.Mesh(cg.door, MAT.solid); door.castShadow = true;
    const dp = new THREE.Group(); dp.position.set(x - Math.sin(rot) * 1.2 + Math.cos(rot) * -1.15, y, z - Math.cos(rot) * 1.2 - Math.sin(rot) * -1.15); dp.rotation.y = rot;
    door.position.set(1.15, 0, 0); dp.add(door); S.group.add(dp);
    // walls (the door is its own collider, so it can open)
    const c = Math.cos(rot), s = Math.sin(rot), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    for (const [lx, lz, hw, hd] of [[0, -1.2, 1.25, 0.1], [-1.2, 0, 0.1, 1.25], [1.2, 0, 0.1, 1.25]]) { const [wx, wz] = W(lx, lz); Cc.box(wx, wz, hw, hd, rot, y - 0.5, y + 2.4, 'cage'); }
    const fl = Cc.box(x, z, 1.2, 1.2, rot, y - 2, y + 0.1, 'floor'); fl.floor = true;
    const [dx2, dz2] = W(0, 1.2);
    const dcol = Cc.box(dx2, dz2, 1.25, 0.12, rot, y - 0.5, y + 2.4, 'cage');
    const [fx0, fz0] = W(0, 2.4);
    out.cages.push({ i, x, z, y, rot, door: dp, dcol, doorBox: { x: dx2, z: dz2, rot, y }, inside: V(x, y + 0.12, z), front: V(fx0, y, fz0) });
    S.blockers.push({ x, z, r: 2.5 });
  }
  S._props(b => { BA.buildCampfire(b, 0, 0, 0); BA.buildBench(b, 1.4, 0, 0.6, 0.4); BA.buildBarrel(b, -1.4, 0, -0.8, 0x6a4a2a); }, I.x + 11, I.z + 164.5, 0);
  light(S, I.x + 11, by + 1.2, I.z + 164.5, 0xff9a40, 2, 12, false, true);
  out.fires.push(V(I.x + 11, by + 0.3, I.z + 164.5));

  // --- the camp up the slope ---
  const cx = I.x + 20, cz = I.z + 110, cy = heightAt(cx, cz);
  S._props(b => {
    BA.buildCampfire(b, 0, 0, 0);
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; BA.buildBench(b, Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6, -a + Math.PI / 2); }
    // rum, crates, a pile of shot, a flag on a pole
    for (let k = 0; k < 6; k++) BA.buildBarrel(b, -7 + k * 0.7, 0, 5.5 + (k % 2) * 0.6, k % 2 ? 0x6a4a2a : 0x5a3a22);
    BA.buildCrate(b, 6, 0, 5, 0.8, 0x8a6a44, 0.3); BA.buildCrate(b, 6.8, 0, 5.6, 0.6, 0x7a5a3a, 1.1); BA.buildCrate(b, 6.3, 0.8, 5.2, 0.55, 0x9a7446, 0.6);
    b.color(0x1a1a1c); for (let k = 0; k < 10; k++) b.blob(0.14, 0.14, 0.14, -4 + (k % 4) * 0.3, 0.14 + Math.floor(k / 4) * 0.22, -6, 5, 3);
    b.color(0x3a2a1c).box(0.14, 8, 0.14, 0, 4, -9);
  }, cx, cz, 0);
  const pole = new THREE.Group(); pole.position.set(cx + 0.1, cy + 7.2, cz - 9);
  const fl2 = new MeshBuilder(rng(5)); fl2.color(0x141212).card([0, -0.8, 0], [2.4, -0.8, 0], [2.4, 0.8, 0], [0, 0.8, 0]); skullShape(fl2, 1.15, 0.02, 0, 1.0);
  const flm = new THREE.Mesh(fl2.build(), MAT.solidDS); pole.add(flm); S.group.add(pole); out.campFlag = pole;
  light(S, cx, cy + 1.3, cz, 0xff9a40, 2.6, 16, false, true);
  out.fires.push(V(cx, cy + 0.3, cz));
  out.camp = V(cx, cy, cz);
  // tents round the fire
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU + 0.4, tx = cx + Math.cos(a) * 11, tz = cz + Math.sin(a) * 11, ty = heightAt(tx, tz);
    S._props(b => {
      const col = [0x8a3a2a, 0xc8b890, 0x3a3a3a, 0x7a6a4a][k % 4];
      b.color(col); b.tri([-1.4, 0, -1.6], [0, 1.9, -1.6], [1.4, 0, -1.6]); b.tri([-1.4, 0, 1.6], [0, 1.9, 1.6], [1.4, 0, 1.6]);
      b.color(shadeHex(col, 0.85)); b.quad([-1.4, 0, -1.6], [0, 1.9, -1.6], [0, 1.9, 1.6], [-1.4, 0, 1.6]); b.quad([1.4, 0, -1.6], [0, 1.9, -1.6], [0, 1.9, 1.6], [1.4, 0, 1.6]);
      b.color(0x3a2a1c).box(0.08, 2.1, 0.08, 0, 1.05, 1.62); b.box(0.08, 2.1, 0.08, 0, 1.05, -1.62);
    }, tx, tz, -a + Math.PI / 2, ty);
    Cc.box(tx, tz, 1.4, 1.6, -a + Math.PI / 2, ty - 1, ty + 1.9, 'tent');
  }
  // the storehouse: where they keep what they take off prisoners
  const sh = S._house({ w: 5, d: 4, h: 2.6, rise: 1.4, seed: 1730, wall: 0x4a3a2a, roof: 0x2a2a2a, doorX: 0, doorW: 1.4, doorOpen: true, windows: [], floorH: 0.35 }, cx - 16, cz + 2, Math.PI / 2, 'pirateStore');
  out.stash = V(cx - 16 + 0.2, sh.y + 0.35, cz + 2);
  S._props(b => { b.color(0x6a3e22).box(1.1, 0.55, 0.6, 0, 0.27, 0); b.color(0x7a4a2a).box(1.12, 0.3, 0.62, 0, 0.62, 0); b.color(0xd8b048); for (const x of [-0.4, 0.4]) b.box(0.06, 0.82, 0.64, x, 0.4, 0); b.color(0x2a2a2e).box(0.14, 0.16, 0.05, 0, 0.5, 0.32); }, cx - 16.6, cz + 2, Math.PI / 2, sh.y + 0.35);
  S.interact.push({ id: 'pirateStash', kind: 'pirateStash', pos: out.stash.clone().add(V(0.4, 0.5, 0)), r: 1.8, label: 'The pirates\' stash chest' });
  // Rattigan the Fence, and his stall (the Showroom puts his stock out)
  // down by the harbour, out of the camp: the guards leave his customers alone
  const fx = I.x + 42, fz = I.z + 172, frot = Math.atan2(I.x + 25 - fx, I.z + 180 - fz);
  stand(S, 'pirateFence', fx, fz, frot);
  out.fence = { pos: V(fx, heightAt(fx, fz), fz), face: frot };
  // watchtowers, each with a torch and a guard's platform
  out.towers = [];
  for (const [ox, oz] of [[-26, 34], [48, 8]]) {
    const tx = cx + ox, tz = cz + oz, ty = heightAt(tx, tz);
    S._props(b => {
      b.color(0x3a2a1c);
      for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) b.box(0.2, 7.2, 0.2, x, 3.6, z);
      for (const y of [2.4, 4.8]) { b.box(2.8, 0.1, 0.1, 0, y, -1.3); b.box(2.8, 0.1, 0.1, 0, y, 1.3); b.box(0.1, 0.1, 2.8, -1.3, y, 0); b.box(0.1, 0.1, 2.8, 1.3, y, 0); }
      for (let i = 0; i < 7; i++) b.color(shadeHex(0x5a3e28, 0.85 + (i % 3) * 0.1)).box(0.42, 0.1, 3, -1.3 + i * 0.43, 7.2, 0);
      b.color(0x3a2a1c); for (const z of [-1.45, 1.45]) b.box(3, 0.9, 0.08, 0, 7.7, z); for (const x of [-1.45, 1.45]) b.box(0.08, 0.9, 3, x, 7.7, 0);
      b.color(0x2a2a2a).box(0.06, 1.2, 0.06, 1.3, 8.6, 1.3);
    }, tx, tz, 0, ty);
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) Cc.circle(tx + x, tz + z, 0.2, ty - 1, ty + 7.2);
    light(S, tx + 1.3, ty + 9.3, tz + 1.3, 0xff8a3a, 2, 18, true, true);
    out.towers.push(V(tx, ty, tz));
  }
  // --- two ships' corpses on the beaches ---
  S.place(BA.buildWreck(1731, 20, false), I.x - 150, I.z + 95, 0.9, heightAt(I.x - 150, I.z + 95) - 1.4);
  S.place(BA.buildWreck(1732, 14, true), I.x + 160, I.z + 60, -1.3, heightAt(I.x + 160, I.z + 60) - 1.0);
  // --- the skull on its rock, looking out to sea (north) ---
  const sk = giantSkull(40, rng(1740));
  const sr = { x: I.x + 150, z: I.z + 250 }, sy = heightAt(sr.x, sr.z);
  // it looks straight down the way in to the harbour, at whoever is coming
  const skRot = Math.atan2(I.x + 10 - sr.x, I.z + 420 - sr.z);
  const skm = new THREE.Mesh(sk.geo, MAT.solid); skm.position.set(sr.x, sy - 9, sr.z); skm.rotation.y = skRot; skm.castShadow = true; S.group.add(skm);
  const skg = new THREE.Mesh(sk.glow, MAT.glow); skg.position.copy(skm.position); skg.rotation.y = skRot; S.group.add(skg);
  out.skullEyes = skg;
  Cc.circle(sr.x, sr.z, 13, sy - 10, sy + 30);
  // --- the lake: a pier, lanterns in a ring, and the sunken ship's mast with its bell ---
  const L = LAKES.find(l => l.id === 'drownedbell');
  const [px, pz] = S._shore(L.x, L.z + L.r * 0.6, 0, 1, 80);
  S.place(BA.buildPier(10, 2.2, 0.9, 1741), px, pz + 3, Math.PI, 0);
  out.lakePier = V(px, 0.9, pz - 5);
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * TAU, lx = L.x + Math.cos(a) * (L.r + 6), lz = L.z + Math.sin(a) * (L.r + 6), ly = heightAt(lx, lz);
    S._props(b => { b.color(0x2a2220).box(0.1, 2.2, 0.1, 0, 1.1, 0); b.color(0x2a2a2e).box(0.24, 0.3, 0.24, 0, 2.3, 0); }, lx, lz, 0, ly);
    light(S, lx, ly + 2.3, lz, 0x7aff9a, 1.2, 9, true, true);
    out.lanterns.push(V(lx, ly + 2.3, lz));
  }
  S._props(b => {
    b.color(0x3a2e24).cyl(0.28, 0.22, -6, 9, 7, true);
    b.color(0x2e2620).box(5, 0.22, 0.22, 0, 6, 0); b.box(3.4, 0.2, 0.2, 0, 8.3, 0);
    b.color(0x6a8a5a).lathe([[0.05, 5.8], [0.5, 5.5], [0.65, 5.0], [0.75, 4.7]], 9, 1.9, 0);
    b.color(0x4a5a3a); for (let i = 0; i < 7; i++) b.lump(0.3, (r() - 0.5) * 0.6, -1 + r() * 4, (r() - 0.5) * 0.6, 0.5, 0.8);
  }, L.x + 8, L.z - 6, 0.4, 0);
  out.bell = V(L.x + 8 + 1.9, 4.9, L.z - 6);
  // --- the vault: a cave behind a gap in the rocks south of the lake, found by following the skull cairns ---
  const vx = I.x - 30, vz = I.z - 125, vy = heightAt(vx, vz);
  const vb = new MeshBuilder(rng(1750)), vg = new MeshBuilder(rng(1751));
  const R = 9, n = 18;
  for (let i = 0; i < n; i++) for (let j = 0; j < 5; j++) {
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, e0 = j / 5 * Math.PI / 2, e1 = (j + 1) / 5 * Math.PI / 2;
    if (i < 2 && j < 2) continue;               // the way in, facing the lake
    const p = (a, e, rr) => [Math.sin(a) * Math.cos(e) * rr, Math.sin(e) * rr * 0.62, Math.cos(a) * Math.cos(e) * rr];
    vb.color(shadeHex(0x6a645a, 0.8 + ((i + j) % 3) * 0.1));
    vb.quad(p(a0, e0, R + 1.6), p(a1, e0, R + 1.6), p(a1, e1, R + 1.6), p(a0, e1, R + 1.6));
    vb.color(0x3a3630); vb.quad(p(a0, e1, R), p(a1, e1, R), p(a1, e0, R), p(a0, e0, R));
  }
  // the hoard: heaps of coin, chests, a throne of a sort
  vg.color(0xf2c848); for (let k = 0; k < 16; k++) { const a = r() * TAU, rr = 2 + r() * 5; vg.blob(0.6 + r() * 0.9, 0.3 + r() * 0.5, 0.6 + r() * 0.9, Math.sin(a) * rr, 0.1, Math.cos(a) * rr - 1.5, 6, 3, 0.2); }
  vb.color(0x6a3e22); for (let k = 0; k < 4; k++) vb.box(1.1, 0.6, 0.7, -3 + k * 2, 0.3, -6.2);
  vb.color(0xd8b048); for (let k = 0; k < 4; k++) vb.box(0.07, 0.62, 0.72, -3 + k * 2 - 0.4, 0.31, -6.2);
  vb.color(0x3a2a1c).box(1.4, 2.2, 0.3, 0, 1.1, -7.4); vb.color(0x7a1e1a).box(1.2, 0.2, 1, 0, 0.6, -6.9);
  const vm = new THREE.Mesh(vb.build(), MAT.solidDS); vm.position.set(vx, vy - 0.2, vz); vm.castShadow = true; vm.receiveShadow = true; S.group.add(vm);
  const vgm = new THREE.Mesh(vg.build(), MAT.glow); vgm.position.set(vx, vy - 0.2, vz); S.group.add(vgm);
  for (let i = 2; i < n; i++) { const a = (i + 0.5) / n * TAU; Cc.circle(vx + Math.sin(a) * (R + 0.6), vz + Math.cos(a) * (R + 0.6), 1.3, vy - 2, vy + 6); }
  light(S, vx, vy + 3.5, vz - 2, 0xffc860, 2.6, 14, false, false);
  out.hoard = V(vx, vy + 0.5, vz - 5.4);
  S.interact.push({ id: 'pirateHoard', kind: 'pirateHoard', pos: out.hoard.clone(), r: 2.6, label: 'The pirates\' hoard' });
  // the trail of skull cairns from the camp round the lake to the gap
  const trail = [[cx - 30, cz - 20], [I.x - 70, I.z + 40], [I.x - 85, I.z - 20], [I.x - 70, I.z - 80], [vx - 6, vz + 14]];
  for (const [tx, tz] of trail) {
    const ty = heightAt(tx, tz);
    S._props(b => { b.color(0x7a746a).lump(0.35, 0, 0.3, 0, 0.3, 0.6); b.lump(0.25, 0.05, 0.7, 0, 0.3, 0.6); skullShape(b, 0, 1.15, 0.05, 0.45, 0xe8e0cc, 0x141210, true); }, tx, tz, r() * TAU, ty);
  }
  // the gap: two walls of rock either side of the way in
  for (const s of [-1, 1]) S._props(b => { b.color(0x6a645a); for (let k = 0; k < 6; k++) b.lump(2.4, s * 3.6, 1 + k * 1.3, -k * 1.6, 0.35, 1.4); }, vx, vz + 15, 0, vy);
  // pirates in the camp who are not going anywhere
  out.sitters = [[cx + 2.4, cz + 0.8, -2.0], [cx - 1.8, cz + 2, 2.6], [cx + 0.5, cz - 2.6, 0.2]].map(([x, z, f]) => ({ pos: V(x, heightAt(x, z), z), face: f }));
  // the guards' beats: the beach and cages, the camp, the vault path
  out.beats = [
    [V(I.x + 2, 0, I.z + 164), V(I.x + 24, 0, I.z + 164), V(I.x + 30, 0, I.z + 178)],
    [V(cx - 10, 0, cz - 8), V(cx + 10, 0, cz - 12), V(cx + 14, 0, cz + 8), V(cx - 12, 0, cz + 10)],
    [V(cx - 30, 0, cz - 20), V(I.x - 70, 0, I.z + 40), V(I.x - 85, 0, I.z - 20)],
  ].map(b => b.map(p => p.setY(heightAt(p.x, p.z))));
  out.campR = 42;
}
