/* Islands.js - builds the twelve far islands into the Settlement: docks,
   houses, shops, the people's stands, lights, signs, and each island's
   one big thing (a cliff lift, a volcano, a drowned city...).

   Every builder works through the Settlement's own helpers (place, _house,
   _props, _shore...) so colliders, blockers and anchors behave exactly like
   the ones in Driftwood Bay. Anchor names an island's people stand at:
     <id>Landing   the end of the dock        <id>Seller   the fish buyer
     <id>Outfit    the exclusive gear shop    <id>Yard     the shipwright
     <id>Lore      the local character
   Moving things that the game animates (the volcano, the lift, the tide
   mill, the wisps...) are listed in S.isle for IslandLife to drive. */

import * as THREE from '../../lib/three.module.js';
import { MeshBuilder, shadeHex, mixHex } from '../art/Geo.js';
import { MAT } from '../art/Materials.js';
import * as BA from '../art/BuildingArt.js';
import { buildCrystal, buildPillar } from '../art/FloraArt.js';
import { heightAt } from './Terrain.js';
import { ISLETS, LAKES } from './MapData.js';
import { rng, TAU } from '../core/Util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------- shared pieces ---------------- */

/** A dock from inland point (x,z) out along (dx,dz): pier, mooring, lamps, landing anchor. */
function dock(S, id, x, z, dx, dz, len = 18, seed = 1) {
  const l = Math.hypot(dx, dz); dx /= l; dz /= l;
  const rot = Math.atan2(dx, dz);
  const [shx, shz] = S._shore(x, z, dx, dz, 220);
  const ox = shx - dx * 4, oz = shz - dz * 4;
  S.place(BA.buildPier(len, 2.8, 1.25, seed), ox, oz, rot, 0);
  S.blockers.push({ x: shx, z: shz, r: 5 });
  const [mx, mz] = S._w(3.9, len - 7, ox, oz, rot), [bx, bz] = S._w(1.3, len - 7, ox, oz, rot);
  S.moorings.push({ pos: V(mx, 0, mz), heading: rot, board: V(bx, 1.25, bz), island: id });
  const [ex, ez] = S._w(0, len - 1.5, ox, oz, rot);
  S.anchors[id + 'Landing'] = V(ex, 1.25, ez);
  const [wx, wz] = S._w(9, len + 10, ox, oz, rot);
  S.anchors[id + 'Water'] = V(wx, 0, wz);
  for (const zz of [3, len - 3]) { const [lx, lz] = S._w(-1.3, zz, ox, oz, rot); S._lampOn(lx, lz, 1.25); }
  return { ox, oz, rot, shx, shz, dx, dz };
}

/** A person's stand: on the ground at (x,z), facing `face`. */
function stand(S, key, x, z, face, y = null) { S._npcAnchor(key, V(x, y ?? heightAt(x, z), z), face); }

function sign(S, text, x, z, rot, y = null, opts = {}) {
  const g = BA.signBoard(text, opts.w || 2.6, opts.h || 0.5, opts);
  const gy = y ?? heightAt(x, z);
  g.position.set(x, gy + (opts.lift ?? 2.0), z); g.rotation.y = rot;
  S.group.add(g);
  S._props(b => b.color(0x4a3526).box(0.14, (opts.lift ?? 2.0) + 0.2, 0.14, 0, ((opts.lift ?? 2.0) + 0.2) / 2, -0.06), x, z, rot, gy);
}

function light(S, x, y, z, color = 0xffb070, intensity = 1.5, dist = 11, night = true, flicker = false) {
  S.lights.push({ pos: V(x, y, z), color, intensity, dist, night, flicker });
}

/** A market stall (counter, awning, fish on ice) - the fish buyer stands behind it. */
function stall(S, x, z, rot, awning = 0xc8452e, seed = 3) {
  const r = rng(seed);
  S._props(b => {
    b.color(0x6a4a30).box(2.4, 0.95, 0.9, 0, 0.47, 0);
    b.color(0xd8e8f0).box(2.2, 0.08, 0.7, 0, 0.98, 0);
    b.color(0x7a8a90); for (let k = 0; k < 4; k++) b.blob(0.22, 0.05, 0.07, -0.7 + k * 0.45, 1.06, (r() - 0.5) * 0.3, 5, 2);
    for (const sx of [-1.1, 1.1]) b.color(0x4a3526).box(0.1, 2.4, 0.1, sx, 1.2, -0.4);
    for (let k = 0; k < 6; k++) b.color(k % 2 ? awning : 0xf2eee2).box(0.42, 0.06, 1.4, -1.05 + k * 0.42, 2.35, 0.1);
    BA.buildBarrel(b, 1.6, 0, 0.3); BA.buildCrate(b, -1.7, 0, 0.2, 0.6, 0x8a6a44, 0.4);
  }, x, z, rot);
  S.C.box(x, z, 1.25, 0.5, rot, heightAt(x, z) - 1, heightAt(x, z) + 1.1);
  S.blockers.push({ x, z, r: 3 });
}

/** A stall with its fish buyer behind the counter, facing the customers (the stall's front is local +Z). */
function sellerStall(S, key, x, z, rot, awning, seed) {
  stall(S, x, z, rot, awning, seed);
  stand(S, key, x - Math.sin(rot) * 0.95, z - Math.cos(rot) * 0.95, rot);
}

/** A cluster of houses round a centre; returns their placements. */
function houses(S, list, cx, cz) {
  return list.map((h, i) => S._house({ w: 4.4, d: 4, h: 2.6, rise: 1.6, seed: 900 + i + Math.round(cx), doorX: 0.5, doorOpen: false, windows: [{ side: 'front', x: -1.2 }], floorH: 0.35, ...h.spec }, cx + h.x, cz + h.z, h.rot || 0, h.key || null));
}

/* ===================================================================== */
/* MID-OCEAN                                                              */
/* ===================================================================== */

/* Whispering Woods: a logging camp at the forest's edge, three hidden lakes up the path. */
function whisper(S) {
  const cx = -2010, cz = -1400;
  dock(S, 'whisper', cx, cz + 6, 0, 1, 20, 101);
  const H = houses(S, [
    { x: -9, z: -4, rot: 0.2, key: 'whisperLodge', spec: { w: 8, d: 5.5, h: 3, rise: 2.2, wall: 0x5a3e28, roof: 0x3a4a2e, porch: true, chimney: true, windows: [{ side: 'front', x: -2.5 }, { side: 'front', x: 2.5 }] } },
    { x: 9, z: -3, rot: -0.3, key: 'whisperShed', spec: { w: 7, d: 6, h: 3.4, rise: 2, wall: 0x6a4a30, roof: 0x4a3a2a, doorX: 0, doorW: 4.4, doorH: 3, doorOpen: true, windows: [] } },
    { x: -2, z: -14, rot: 0.1, spec: { wall: 0x5a4a34, roof: 0x3e4a30, chimney: true } },
    { x: 13, z: -13, rot: -0.5, spec: { wall: 0x4a3a28, roof: 0x3a3a2a } },
  ], cx, cz);
  S._props(b => { BA.buildCampfire(b, 0, 0, 0); BA.buildBench(b, 0, 0, 2, 0); BA.buildBench(b, 2, 0, 0, Math.PI / 2); BA.buildWoodpile(b, rng(3)); }, cx, cz - 3, 0);
  S.C.circle(cx, cz - 3, 0.6, 0, 20);
  light(S, cx, heightAt(cx, cz - 3) + 0.8, cz - 3, 0xff8a3a, 2.2, 11, true, true);
  // stacks of giant logs and a sawhorse
  S._props(b => { for (let k = 0; k < 5; k++) b.color(k % 2 ? 0x6a4a30 : 0x5a3e28).push(0, 0.7 + (k > 2 ? 1.3 : 0), (k % 3) * 1.4 - 1.4, 0, 0, Math.PI / 2).cyl(0.7, 0.7, -4, 4, 8, true).pop(); }, cx + 4, cz + 8, 0.4);
  S.C.box(cx + 4, cz + 8, 4, 2.2, 0.4, heightAt(cx + 4, cz + 8) - 1, heightAt(cx + 4, cz + 8) + 2.6);
  sellerStall(S, 'whisperSeller', cx - 4, cz + 3, 0, 0x3a6a3a, 11);
  stand(S, 'whisperOutfit', H[0].A.door.x, H[0].A.door.z + 0.8, 0.2);
  stand(S, 'whisperYard', cx + 9 + 1.2, cz + 1, -0.3);
  sign(S, 'WOODSMOKE CAMP', cx + 1.5, cz + 5, 0);
  sign(S, "TAMSIN'S BOATS", cx + 12, cz + 1, -0.3, null, { w: 2.2 });
  // the Listener's bench by the Moonpool, and a carved totem that "whispers"
  const L = LAKES.find(q => q.id === 'moonpool');
  const [lx, lz, lh] = S._findGround(L.x + L.r + 4, L.z + 6, 0.7, 12, 30);
  S._props(b => {
    BA.buildBench(b, 0, 0, 0, 0);
    b.color(0x5a3e28).cyl(0.35, 0.3, 0, 3.2, 7, true, 3, 0);
    for (let k = 0; k < 4; k++) { b.color([0x8a3a2a, 0x3a6a8a, 0xd8b048, 0x3a5a2a][k]).box(0.74, 0.1, 0.74, 3, 0.7 + k * 0.7, 0); b.color(0x2a1e14).box(0.2, 0.2, 0.05, 3, 0.95 + k * 0.7, 0.37); }
    b.color(0xe8dcc0).cone(0.2, 3.2, 3.8, 5, 3, 0);
  }, lx, lz, 0.5, lh);
  S.C.circle(lx + 3 * Math.cos(0.5), lz - 3 * Math.sin(0.5), 0.4, lh - 1, lh + 4);
  stand(S, 'whisperLore', lx, lz + 0.6, Math.PI);
  S.interact.push({ id: 'totem', kind: 'totem', pos: V(lx + 2.5, lh + 1.5, lz - 1.5), r: 3, label: 'Put your ear to the carved totem' });
  // little piers on each lake so you can fish them from the bank
  for (const id of ['hollow', 'moonpool', 'deeproot']) {
    const q = LAKES.find(k => k.id === id);
    const a = id === 'hollow' ? 0.5 : id === 'moonpool' ? 2.4 : -1.2;
    const [px, pz] = S._shore(q.x + Math.cos(a) * (q.r + 12), q.z + Math.sin(a) * (q.r + 12), -Math.cos(a), -Math.sin(a), 30);
    S.place(BA.buildPier(7, 2, 0.9, 120 + q.r), px + Math.cos(a) * 2, pz + Math.sin(a) * 2, Math.atan2(-Math.cos(a), -Math.sin(a)), 0);
    S.anchors[id + 'Pier'] = V(px - Math.cos(a) * 4, 0.9, pz - Math.sin(a) * 4);
  }
  // will-o'-the-wisps drift between the trees at night
  S.isle.wisps = S.isle.wisps || [];
  const r = rng(77);
  for (let k = 0; k < 14; k++) { const a = r() * TAU, d = 30 + r() * 180; S.isle.wisps.push({ x: -2050 + Math.cos(a) * d, z: -1650 + Math.sin(a) * d, ph: r() * 6, col: k % 3 ? 0x9af0c8 : 0xd8f0ff }); }
}

/* Sunscar: Emberhaven on the ash cay, black stone and hot springs, the volcano smoking over it. */
function sunscar(S) {
  const cx = 2700, cz = -535;
  dock(S, 'sunscar', cx + 10, cz, 1, 0.15, 18, 102);
  const stone = 0x3a3432, roof = 0x6a2a1e;
  const H = houses(S, [
    { x: -8, z: -8, rot: Math.PI / 2 - 0.2, key: 'sunForge', spec: { w: 7, d: 5.5, h: 3, rise: 1.6, wall: stone, roof, chimney: true, porch: true, windows: [{ side: 'front', x: -2 }] } },
    { x: -9, z: 7, rot: Math.PI / 2 + 0.2, key: 'sunYardHouse', spec: { w: 8, d: 6, h: 3.4, rise: 1.8, wall: 0x4a3a34, roof: 0x3a2a26, doorX: 0, doorW: 4, doorH: 3, doorOpen: true, windows: [] } },
    { x: 2, z: -14, rot: 0.1, spec: { wall: stone, roof } },
    { x: 4, z: 14, rot: Math.PI - 0.2, spec: { wall: 0x4a3e3a, roof } },
  ], cx, cz);
  // the hot spring: a steaming pool ringed with black stones
  const sx = cx - 2, sz = cz + 2;
  S._props(b => {
    b.color(0x5ac8c0).cyl(3.2, 3.2, 0.12, 0.16, 12, true);
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; b.color(k % 2 ? 0x2a2426 : 0x3a3234).lump(0.55, Math.cos(a) * 3.4, 0.2, Math.sin(a) * 3.4, 0.3, 0.6); }
  }, sx, sz, 0);
  S.isle.springs = [{ x: sx, z: sz, y: heightAt(sx, sz) + 0.2, r: 3.2 }];
  S.interact.push({ id: 'spring', kind: 'spring', pos: V(sx, heightAt(sx, sz) + 0.5, sz), r: 3.8, label: 'Soak in the hot spring' });
  sellerStall(S, 'sunscarSeller', cx + 3, cz - 5, Math.PI / 2, 0xe0702a, 12);
  stand(S, 'sunscarOutfit', H[0].A.door.x + 0.8, H[0].A.door.z, Math.PI / 2 - 0.2);
  stand(S, 'sunscarYard', H[1].A.door.x + 0.8, H[1].A.door.z, Math.PI / 2 + 0.2);
  stand(S, 'sunscarLore', cx + 6, cz + 8, 2.2);
  sign(S, 'EMBERHAVEN', cx + 6, cz - 1, Math.PI / 2);
  sign(S, "RICO'S SWIFT HULLS", H[1].A.door.x + 2, H[1].A.door.z + 3.5, Math.PI / 2 + 0.2, null, { w: 2.4 });
  light(S, cx, heightAt(cx, cz) + 3, cz, 0xff7a3a, 2.4, 16);
  // the volcano's crater: IslandLife smokes it and throws rocks out of it
  S.isle.volcano = { x: 2450, z: -700, y: 72, r: 330, next: 30 };
  S._props(b => { b.color(0xff6a2a); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; b.lump(2.2, Math.cos(a) * 7, 0, Math.sin(a) * 7, 0.3, 0.4); } }, 2450, -700, 0, heightAt(2450, -700) - 1.2);
}

/* Skywatch: a dock on a shelf at the foot of the cliff, and a lift to the Eyrie ninety metres up. */
function skywatch(S) {
  const bx = -2750, bz = 842;
  dock(S, 'skywatch', bx, bz, 0, 1, 16, 103);
  // the lift: a timber tower against the cliff, a cage on a cable, a winch house at the top
  const topY = 93, baseY = heightAt(bx, bz - 6);
  let ez = bz - 6; while (heightAt(bx, ez - 1) < topY - 3 && ez > 700) ez -= 1;   // the lip of the cliff
  const lift = { bx, bz: bz - 5, by: baseY, tx: bx, tz: ez - 3, ty: topY };
  S._props(b => {
    const h = topY - baseY + 2;
    for (const sx of [-1.3, 1.3]) for (const sz of [-0.6, 1.4]) b.color(0x5a4230).box(0.3, h, 0.3, sx, h / 2, sz);
    for (let y = 2; y < h; y += 4) { b.color(0x4a3526).box(2.9, 0.2, 0.2, 0, y, -0.6); b.box(2.9, 0.2, 0.2, 0, y, 1.4); b.beam([-1.3, y, -0.6], [1.3, y + 4, -0.6], 0.12, 0.12); }
    b.color(0x3a3a3a).box(0.06, h, 0.06, 0, h / 2, 0.4);
  }, bx, bz - 6.5, 0, baseY);
  S.C.box(bx, bz - 6.5, 1.5, 1.1, 0, baseY - 1, topY + 2);
  const cage = new MeshBuilder(rng(5));
  cage.color(0x6a4a30).box(2, 0.12, 2, 0, 0, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cage.color(0x3a3a3a).box(0.06, 2.2, 0.06, sx * 0.95, 1.1, sz * 0.95);
  cage.color(0x8a6a44).box(2, 0.1, 2, 0, 2.2, 0); cage.color(0xd8b048).box(0.3, 0.3, 0.3, 0, 2.4, 0);
  const cm = new THREE.Mesh(cage.build(), MAT.solid); cm.castShadow = true; cm.position.set(bx, baseY + 0.1, bz - 3.5);
  S.group.add(cm);
  lift.cage = cm;
  S.isle.lift = lift;
  S.anchors.skyBase = V(bx, baseY, bz - 3);
  S.anchors.skyTop = V(bx, topY, ez - 6);
  S.interact.push({ id: 'liftUp', kind: 'lift', dir: 'up', pos: V(bx, baseY + 1, bz - 3.5), r: 2.6, label: 'Ride the cliff lift up to the Eyrie' });
  S.interact.push({ id: 'liftDown', kind: 'lift', dir: 'down', pos: V(bx, topY + 1, ez - 6), r: 2.6, label: 'Ride the lift down to the dock' });
  light(S, bx, baseY + 3, bz - 5, 0xffc070, 1.4, 10);
  sign(S, 'THE EYRIE  -  LIFT UP', bx + 2.4, bz - 3, 0, baseY, { w: 2.8 });
  // the Eyrie: the village on the plateau
  const tx = -2750, tz = 700;
  const H = houses(S, [
    { x: -10, z: 20, rot: Math.PI, key: 'skyHall', spec: { w: 8, d: 6, h: 3.2, rise: 2.2, wall: 0xd8d0b8, roof: 0x3a5a7a, porch: true, chimney: true, windows: [{ side: 'front', x: -2.4 }, { side: 'front', x: 2.4 }], floorH: 0.3 } },
    { x: 12, z: 18, rot: Math.PI + 0.3, spec: { wall: 0xc8c0a8, roof: 0x5a3a2e } },
    { x: -16, z: -6, rot: Math.PI / 2, spec: { wall: 0xd8d0b8, roof: 0x3a5a7a } },
    { x: 18, z: -10, rot: -Math.PI / 2, spec: { wall: 0xb8b098, roof: 0x3a4a5a, chimney: true } },
  ], tx, tz);
  // a windmill and the lookout's telescope on the cliff lip
  S._props(b => {
    b.color(0xd8d0b8).cyl(2.2, 1.4, 0, 9, 8, true);
    b.color(0x5a3a2e).cone(2, 9, 11.5, 8);
  }, tx + 2, tz - 22, 0, topY);
  S.C.circle(tx + 2, tz - 22, 2.2, topY - 1, topY + 11);
  const mill = new MeshBuilder(rng(9));
  for (let k = 0; k < 4; k++) { mill.push(0, 0, 0, 0, 0, k * Math.PI / 2); mill.color(0x6a4a30).box(0.2, 5.2, 0.12, 0, 2.6, 0); mill.color(0xf2ead4).box(1.1, 3.6, 0.04, 0.6, 3.2, 0.05); mill.pop(); }
  const mm = new THREE.Mesh(mill.build(), MAT.solidDS); mm.position.set(tx + 2, topY + 8, tz - 22 + 2.3); S.group.add(mm);
  S.isle.spinners = S.isle.spinners || []; S.isle.spinners.push({ m: mm, axis: 'z', speed: 0.8 });
  const [lx, lz] = [tx + 6, ez - 5];
  S._props(b => { b.color(0x3a3a3a); for (const a of [0, 2.1, 4.2]) b.beam([0, 0, 0], [Math.cos(a) * 0.5, -1.3, Math.sin(a) * 0.5], 0.05, 0.05); b.color(0xb8943a).push(0, 0.1, 0, -0.25, 0, 0).cyl(0.12, 0.09, 0, 1.3, 8, true).pop(); }, lx, lz, Math.PI, topY + 1.3);
  S.interact.push({ id: 'telescope', kind: 'telescope', pos: V(lx, topY + 1.3, lz), r: 2.2, label: 'Look through the telescope' });
  stand(S, 'skywatchLore', lx - 1.5, lz - 1.2, Math.PI, topY);
  // a railing along the lip, with rod holders for fishing off the edge of the sky
  S._props(b => { for (let k = -8; k <= 8; k++) { b.color(0x5a4230).box(0.12, 1.1, 0.12, k * 1.5, 0.55, 0); } b.color(0x6a4a30).box(24.6, 0.1, 0.1, 0, 1.08, 0); for (let k = -3; k <= 3; k += 2) b.color(0x9aa0a8).beam([k * 2, 0.4, 0.1], [k * 2, 1.4, -0.4], 0.05, 0.05); }, tx - 4, ez - 1.5, 0, topY);
  S.C.box(tx - 4, ez - 1.5, 12.3, 0.15, 0, topY - 0.5, topY + 1.1);
  S.anchors.skyEdge = V(tx - 4, topY, ez - 3);
  sellerStall(S, 'skywatchSeller', tx - 2, tz + 8, 0, 0x3a5a7a, 13);
  stand(S, 'skywatchOutfit', H[0].A.door.x, H[0].A.door.z - 0.8, Math.PI);
  sign(S, 'THE EYRIE', tx + 3, tz + 8, Math.PI, topY);
  light(S, tx, topY + 3, tz, 0xffd090, 1.6, 14);
}

/* The Crystal Reef: a research camp on the ring, spires of crystal all through the lagoon. */
function crystal(S) {
  const cx = 877, cz = 2650;
  const L = LAKES.find(q => q.id === 'lagoon');
  dock(S, 'crystal', cx, cz, -1, 0, 14, 104);
  houses(S, [
    { x: 6, z: -8, rot: -Math.PI / 2, key: 'crysLab', spec: { w: 6, d: 4.4, h: 2.8, rise: 1.2, wall: 0xe8ecec, roof: 0x3a8a9a, porch: true, stilts: 0.8, windows: [{ side: 'front', x: -1.5 }, { side: 'front', x: 1.5 }] } },
    { x: 6, z: 9, rot: -Math.PI / 2, key: 'crysYardHouse', spec: { w: 7, d: 5, h: 3.2, rise: 1.4, wall: 0xd8e0e0, roof: 0x6a8a9a, doorX: 0, doorW: 3.6, doorH: 3, doorOpen: true, windows: [] } },
    { x: 14, z: 0, rot: -Math.PI / 2, spec: { w: 3.6, d: 3.4, wall: 0xe8e0d0, roof: 0xd07a5a, stilts: 0.6 } },
  ], cx, cz);
  sellerStall(S, 'crystalSeller', cx - 2, cz - 4, -Math.PI / 2, 0x3a9aa8, 14);
  stand(S, 'crystalOutfit', cx + 4, cz - 8, -Math.PI / 2);
  stand(S, 'crystalYard', cx + 4, cz + 9, -Math.PI / 2);
  stand(S, 'crystalLore', cx - 1, cz + 5, -1.2);
  sign(S, 'GLASSWATER CAMP', cx - 3, cz + 1.5, -Math.PI / 2);
  // the spires: big crystal clusters standing up out of the lagoon, lit from inside at night
  const r = rng(404), solid = new MeshBuilder(r), glow = new MeshBuilder(r);
  S.isle.crystals = [];
  for (let k = 0; k < 26; k++) {
    const a = r() * TAU, d = 20 + r() * (L.r - 35), x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    const h = heightAt(x, z), s = 1.6 + r() * 2.6;
    const tone = [0x9af0f0, 0xc8b0f8, 0xf0b8e0, 0xb8f0c8][k % 4];
    const yaw = r() * TAU;
    solid.push(x, h, z, 0, yaw, 0, s);
    glow.push(x, h, z, 0, yaw, 0, s);
    // the body: a few tall prisms, each with a lit core
    for (let j = 0; j < 4; j++) {
      const ja = r() * TAU, jd = j ? r() * 1.2 : 0, jh = (j ? 2 : 4) + r() * 3, w = (j ? 0.3 : 0.55) + r() * 0.2, tx = (r() - 0.5) * 0.5, tz = (r() - 0.5) * 0.5;
      solid.color(tone).push(Math.cos(ja) * jd, 0, Math.sin(ja) * jd, tx, 0, tz).cyl(w, w * 0.9, -1, jh, 6, false).cone(w * 0.9, jh, jh + w * 2, 6).pop();
      glow.color(shadeHex(tone, 1.1)).push(Math.cos(ja) * jd, 0, Math.sin(ja) * jd, tx, 0, tz).cyl(w * 0.35, w * 0.3, -0.5, jh * 0.9, 5, false).pop();
    }
    solid.pop(); glow.pop();
    S.isle.crystals.push({ x, z, top: h + 6 * s });
    if (h > -6) S.C.circle(x, z, 1.4 * s, h - 2, h + 6 * s, 'rock');
  }
  const sm = new THREE.Mesh(solid.build(), MAT.shiny); sm.castShadow = true; S.group.add(sm);
  const gm = new THREE.Mesh(glow.build(), MAT.glowAdd); S.group.add(gm);
  S.isle.crystalGlow = gm;
  // lights in the lagoon, on at night
  for (let k = 0; k < 6; k++) { const q = S.isle.crystals[k * 4]; light(S, q.x, 2, q.z, 0x6af0f0, 2.4, 30, true); }
  void buildCrystal;
}

/* ===================================================================== */
/* OUTER                                                                  */
/* ===================================================================== */

/* Frostfall: Rime Camp on the south shore, the path up to the glacier lake. */
function frostfall(S) {
  const cx = -370, cz = -3610;
  dock(S, 'frostfall', cx, cz + 6, 0.1, 1, 18, 105);
  const H = houses(S, [
    { x: -9, z: -4, rot: 0.1, key: 'rimeLodge', spec: { w: 8, d: 5.4, h: 3, rise: 2.4, wall: 0x8a3a2a, roof: 0x3a3e46, chimney: true, porch: true, windows: [{ side: 'front', x: -2.4 }, { side: 'front', x: 2.4 }] } },
    { x: 8, z: -5, rot: -0.2, key: 'rimeSmithy', spec: { w: 6, d: 5, h: 2.8, rise: 1.6, wall: 0x5a4a44, roof: 0x3a3e46, chimney: true, porch: true } },
    { x: 1, z: -15, rot: 0, spec: { w: 4, d: 3.6, wall: 0xa8452e, roof: 0x3a3a40, chimney: true } },
  ], cx, cz);
  S._props(b => { BA.buildCampfire(b, 0, 0, 0); BA.buildBench(b, 0, 0, 1.8, 0); b.color(0xe8f0f4); for (let k = 0; k < 5; k++) b.lump(0.8, -4 + k * 2, 0.2, 5, 0.3, 0.5); }, cx, cz, 0);
  S.C.circle(cx, cz, 0.6, 0, 20);
  light(S, cx, heightAt(cx, cz) + 0.8, cz, 0xff8a3a, 2.2, 11, true, true);
  sellerStall(S, 'frostfallSeller', cx - 3, cz + 4, 0, 0x3a6a9a, 15);
  stand(S, 'frostfallOutfit', H[1].A.door.x, H[1].A.door.z + 0.6, -0.2);
  sign(S, 'RIME CAMP', cx + 3, cz + 5, 0);
  sign(S, 'ICE AUGERS  -  THERMALS', H[1].A.door.x + 2.2, H[1].A.door.z + 1.2, -0.2, null, { w: 2.8 });
  // the lake hut up by the glacier, where Old Frost sits and watches the ice
  const G = LAKES.find(q => q.id === 'glacier');
  const [hx, hz] = S._shore(G.x + 10, G.z + G.r + 20, 0, -1, 40);
  const hut = S.place(BA.buildIceHut(44), hx, hz + 4, Math.PI, heightAt(hx, hz + 4) - 0.05);
  S.blockers.push({ x: hx, z: hz + 4, r: 4 });
  stand(S, 'frostfallLore', hut.A.door.x, hut.A.door.z, Math.PI);
  light(S, hx, hut.y + 2, hz + 4, 0xffb070, 1.6, 9);
  S.anchors.glacierShore = V(hx, heightAt(hx, hz), hz - 2);
}

/* Dreadmire: stilt houses round the Mirepool, reached down the channels. */
function dread(S) {
  const P = LAKES.find(q => q.id === 'mirepool');
  const cx = -2870, cz = 2640;
  // a pier from the bank out into the pool (the pool is where you moor)
  const rot = -Math.PI / 2;
  S.place(BA.buildPier(16, 2.6, 1.3, 106), cx - 8, cz, rot, 0);
  const [mx, mz] = S._w(3.8, 11, cx - 8, cz, rot), [bx, bz] = S._w(1.2, 11, cx - 8, cz, rot);
  S.moorings.push({ pos: V(mx, 0, mz), heading: rot, board: V(bx, 1.3, bz), island: 'dread' });
  S.anchors.dreadLanding = V(cx - 22.5, 1.3, cz);
  S.anchors.dreadWater = V(P.x, 0, P.z);
  // the houses stand on stilts in the water round the pool, joined by boardwalks
  const r = rng(606);
  const spots = [[0.2, 'dreadMother'], [0.9, 'dreadSilt'], [-0.6, null], [1.6, null], [-1.3, null], [2.3, null]];
  const placed = [];
  for (const [a, key] of spots) {
    const d = P.r - 6, x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
    const face = Math.atan2(P.x - x, P.z - z);
    const res = BA.buildHouse({ w: 4.2, d: 3.8, h: 2.4, rise: 1.8, seed: 610 + placed.length, wall: mixHex(0x4a4030, 0x5a5038, r()), roof: 0x3a3a26, doorX: 0.4, doorOpen: key === null, windows: [{ side: 'front', x: -1.1 }], floorH: 0.1, stilts: 1.8, porch: true });
    const p = S.place(res, x, z, face, 0);
    S.blockers.push({ x, z, r: 4 });
    placed.push({ x, z, face, p, key });
    light(S, x, 4.2, z, 0xc8e070, 1.3, 9, true, true);
  }
  S.anchors.dreadSeller = { pos: V(placed[0].p.A.porch.x, placed[0].p.A.porch.y, placed[0].p.A.porch.z), face: placed[0].face };
  S.anchors.dreadOutfit = { pos: V(placed[1].p.A.porch.x, placed[1].p.A.porch.y, placed[1].p.A.porch.z), face: placed[1].face };
  // boardwalks between the stilt houses
  S._props(b => {
    for (let k = 0; k < placed.length; k++) {
      const A = placed[k], B = placed[(k + 1) % placed.length];
      const L = Math.hypot(B.x - A.x, B.z - A.z), ang = Math.atan2(B.x - A.x, B.z - A.z);
      b.push((A.x + B.x) / 2 - cx, 1.95, (A.z + B.z) / 2 - cz, 0, ang, 0);
      for (let i = 0; i < L / 0.5; i++) b.color(shadeHex(0x5a4a34, 0.8 + (i % 3) * 0.1)).box(1.4, 0.08, 0.44, 0, 0, -L / 2 + i * 0.5);
      for (let i = 0; i <= L; i += 3) for (const sx of [-0.7, 0.7]) b.color(0x3a3026).box(0.14, 3.6, 0.14, sx, -1.8, -L / 2 + i);
      b.pop();
    }
  }, cx, cz, 0, 0);
  for (let k = 0; k < placed.length; k++) {
    const A = placed[k], B = placed[(k + 1) % placed.length];
    const L = Math.hypot(B.x - A.x, B.z - A.z), ang = Math.atan2(B.x - A.x, B.z - A.z);
    const col = S.C.box((A.x + B.x) / 2, (A.z + B.z) / 2, 0.7, L / 2, ang, -3, 1.95, 'floor'); col.floor = true;
  }
  S.anchors.dreadLore = { pos: V(placed[3].p.A.porch.x, placed[3].p.A.porch.y, placed[3].p.A.porch.z), face: placed[3].face };
  sign(S, 'THE STILT HOUSES', cx - 6, cz + 1.8, rot, 1.3, { w: 2.6, lift: 1.4 });
  // lanterns on poles out in the channels, to follow in the fog
  for (const [x, z] of [[-3300, 2724], [-3200, 2730], [-3080, 2700], [-3000, 2665], [-2850, 2710], [-2720, 2730], [-3000, 2500], [-2995, 2400], [-2945, 2800]]) {
    S._props(b => { b.color(0x3a3026).box(0.16, 4.5, 0.16, 0, 1.2, 0); b.color(0x2a2a2a).box(0.6, 0.08, 0.08, 0.3, 3.4, 0); b.color(0x3a3a2a).box(0.3, 0.4, 0.3, 0.55, 3.1, 0); }, x, z, 0, 0);
    light(S, x + 0.55, 3.1, z, 0xd8f080, 1.8, 14, true, true);
    S.C.circle(x, z, 0.3, -4, 4);
  }
  S.isle.wisps = S.isle.wisps || [];
  for (let k = 0; k < 10; k++) { const a = r() * TAU, d = 60 + r() * 220; S.isle.wisps.push({ x: -3000 + Math.cos(a) * d, z: 2700 + Math.sin(a) * d, ph: r() * 6, col: 0xd8f080 }); }
}

/* Ironwreck: a salvage town made out of ships, a wreck field on the bank to the south-east. */
function ironwreck(S) {
  const cx = 3010, cz = -2510;
  dock(S, 'ironwreck', cx, cz + 6, 0, 1, 22, 107);
  const rust = 0x7a4a32, steel = 0x5a5e64;
  const H = houses(S, [
    { x: -11, z: -6, rot: 0.1, key: 'ironShop', spec: { w: 7, d: 5, h: 3, rise: 0.8, wall: rust, roof: steel, porch: true, windows: [{ side: 'front', x: -2 }] } },
    { x: 11, z: -7, rot: -0.1, key: 'ironYard', spec: { w: 10, d: 7, h: 4.2, rise: 1.4, wall: 0x6a5a4a, roof: 0x4a4e54, doorX: 0, doorW: 6, doorH: 3.8, doorOpen: true, windows: [] } },
    { x: 0, z: -16, rot: 0, spec: { w: 5, d: 4, wall: steel, roof: rust } },
  ], cx, cz);
  // half a ship's hull turned upside down as a roof, cranes, containers
  S._props(b => {
    b.push(0, 0, 0, 0, 0, Math.PI).color(0x3a2e24); for (let k = 0; k < 8; k++) { const a = k / 7 * Math.PI; b.beam([Math.cos(a) * 3, -Math.sin(a) * 2.6 - 3.5, -6], [Math.cos(a) * 3, -Math.sin(a) * 2.6 - 3.5, 6], 0.9, 0.12); } b.pop();
    for (const [x, z, c] of [[8, 4, 0x3a6a8a], [8, 7, 0xb03a2e], [11, 5.5, 0x3a6a3a]]) { b.color(c).box(2.4, 2.4, 5.8, x, 1.2, z); b.color(shadeHex(c, 0.7)); for (let k = 0; k < 8; k++) b.box(2.42, 2.2, 0.08, x, 1.2, z - 2.6 + k * 0.75); }
  }, cx - 3, cz + 3, 0.3);
  S.C.box(cx - 3, cz + 3, 3.2, 6.2, 0.3, heightAt(cx - 3, cz + 3) - 1, heightAt(cx - 3, cz + 3) + 3);
  S._props(b => { b.color(0xe0a830).box(0.6, 12, 0.6, 0, 6, 0); b.beam([0, 12, 0], [9, 13, 0], 0.5, 0.5); b.color(0x2a2a2a).beam([9, 13, 0], [9, 6, 0], 0.05, 0.05); b.color(0x5a5a5a).box(0.8, 0.5, 0.8, 9, 5.8, 0); }, cx + 6, cz + 8, 1.2);
  S.C.circle(cx + 6, cz + 8, 0.5, 0, 14);
  sellerStall(S, 'ironwreckSeller', cx - 4, cz + 4, 0, 0x6a6a6a, 16);
  stand(S, 'ironwreckOutfit', H[0].A.door.x, H[0].A.door.z + 0.7, 0.1);
  stand(S, 'ironwreckYard', H[1].A.door.x + 2, H[1].A.door.z + 0.5, -0.1);
  stand(S, 'ironwreckLore', cx + 3, cz + 10, Math.PI - 0.5);
  sign(S, 'SALVAGE TOWN', cx + 2, cz + 5, 0);
  sign(S, "BIG OLGA'S  -  REPAIRS HALF PRICE", H[1].A.door.x - 3, H[1].A.door.z + 2.5, -0.1, null, { w: 3.4 });
  light(S, cx, heightAt(cx, cz) + 4, cz, 0xfff0d0, 2.2, 18);
  // the wreck field: dozens of ships on the bank, some with salvage in them
  const r = rng(707);
  S.isle.salvage = [];
  for (let k = 0; k < 26; k++) {
    const a = r() * TAU, d = 40 + r() * 240, x = 3150 + Math.cos(a) * d, z = -2480 + Math.sin(a) * d;
    if (heightAt(x, z) > -1.5 || Math.hypot(x - cx, z - cz) < 45) continue;
    S.wreckAt(x, z, 0.6 + r() * 2.5, 14 + r() * 18, r() < 0.2);
    if (k % 3 === 0) { S.isle.salvage.push({ id: 'salv' + k, x, z, y: heightAt(x, z) + 1 }); }
  }
  for (const Sv of S.isle.salvage) S.interact.push({ id: Sv.id, kind: 'salvage', pos: V(Sv.x, Sv.y, Sv.z), r: 5, label: 'Salvage the wreck', swim: true });
}

/* The Lost Shores: an empty fishing village in the fog. Notes in the houses. */
function lost(S) {
  const cx = -3960, cz = -1225;
  dock(S, 'lost', cx + 10, cz, 1, 0.2, 20, 108);
  const r = rng(808);
  const spots = [[-14, -18], [-2, -22], [12, -18], [-20, -2], [18, 2], [-14, 16], [2, 20], [16, 18]];
  const H = spots.map(([x, z], i) => S._house({ w: 4.2 + (i % 2), d: 4, h: 2.5, rise: 1.8, seed: 810 + i, wall: mixHex(0x7a7468, 0x6a645a, r()), roof: mixHex(0x4a4a44, 0x5a4a3a, r()), doorX: 0.4, doorOpen: true, windows: [{ side: 'front', x: -1.2 }], floorH: 0.35, chimney: i % 3 === 0 }, cx + x, cz + z, Math.atan2(-x, -z)));
  // a note in every house, and the chapel bell rope
  H.forEach((h, i) => {
    const p = h.A.inside;
    S.interact.push({ id: 'lostNote' + (i + 1), kind: 'note', note: i, pos: V(p.x, p.y + 0.9, p.z), r: 2.4, label: 'Read the note left on the table' });
    S._props(b => { b.color(0x5a4230).box(1.2, 0.8, 0.7, 0, 0.4, 0); b.color(0xf0e8d0).box(0.3, 0.02, 0.22, 0.1, 0.81, 0); b.color(0x3a3a3a).box(0.12, 0.2, 0.12, -0.3, 0.9, 0.1); }, p.x, p.z, 0, p.y);
  });
  // a well in the square, empty nets on racks
  S._props(b => { b.color(0x6a6a64); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; b.box(0.5, 0.9, 0.35, Math.cos(a) * 1.1, 0.45, Math.sin(a) * 1.1); } b.color(0x4a3a2a).box(0.14, 2.2, 0.14, -1.1, 1.1, 0); b.box(0.14, 2.2, 0.14, 1.1, 1.1, 0); b.box(2.4, 0.14, 0.14, 0, 2.2, 0); BA.buildNetRack(b, 5, 0, 3, 0.4); }, cx, cz, 0);
  S.C.circle(cx, cz, 1.4, 0, 3);
  // the hermit who stayed
  stand(S, 'lostSeller', cx + 5, cz - 4, 1.2);
  stand(S, 'lostLore', cx - 6, cz + 5, -2);
  S._props(b => { BA.buildCampfire(b, 0, 0, 0); BA.buildBench(b, 0, 0, 1.6, 0); }, cx + 7, cz - 2, 0);
  light(S, cx + 7, heightAt(cx + 7, cz - 2) + 0.8, cz - 2, 0xff8a3a, 1.8, 10, true, true);
  sign(S, 'ASHCOMBE  -  POP. 212', cx + 9, cz + 3, Math.PI / 2, null, { w: 2.6, bg: '#6a645a' });
}

/* ===================================================================== */
/* EXTREME                                                                */
/* ===================================================================== */

/* Thunderpeak: Stormwatch Station, bristling with lightning rods. */
function thunder(S) {
  const cx = 3345, cz = -4430;
  dock(S, 'thunder', cx, cz, -0.67, 0.74, 20, 109);
  const H = houses(S, [
    { x: 6, z: -6, rot: -2.4, key: 'stormStation', spec: { w: 8, d: 6, h: 3.2, rise: 0.8, wall: 0x6a6e74, roof: 0x3a3e44, porch: true, chimney: true, windows: [{ side: 'front', x: -2.2 }, { side: 'front', x: 2.2 }] } },
    { x: -8, z: -6, rot: -2.4, key: 'stormYard', spec: { w: 9, d: 6.5, h: 4, rise: 1.2, wall: 0x5a5e64, roof: 0x2e3238, doorX: 0, doorW: 5, doorH: 3.6, doorOpen: true, windows: [] } },
  ], cx, cz);
  // lightning rods, a weather mast with a spinning cup anemometer
  S.isle.rods = [];
  for (const [x, z] of [[cx + 12, cz - 12], [cx - 14, cz - 14], [cx + 2, cz - 20], [cx + 16, cz + 2]]) {
    const y = heightAt(x, z);
    S._props(b => { b.color(0x5a5e64).cyl(0.14, 0.08, 0, 14, 6, true); b.color(0xc87a3a); for (let k = 0; k < 8; k++) b.cyl(0.18, 0.18, 2 + k * 1.4, 2.3 + k * 1.4, 6, false); b.color(0xd8d8d8).cone(0.12, 14, 15.5, 5); }, x, z, 0, y);
    S.C.circle(x, z, 0.3, y - 1, y + 15);
    S.isle.rods.push({ x, y: y + 15.5, z });
  }
  const ay = heightAt(cx, cz - 4);
  S._props(b => { b.color(0x8a8e94).cyl(0.1, 0.08, 0, 7, 6, true); }, cx, cz - 4, 0, ay);
  const an = new MeshBuilder(rng(3));
  for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; an.color(0x9aa0a8).beam([0, 0, 0], [Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7], 0.04, 0.04); an.color(0xe0402a).blob(0.14, 0.12, 0.14, Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7, 6, 3); }
  const am = new THREE.Mesh(an.build(), MAT.solid); am.position.set(cx, ay + 7, cz - 4); S.group.add(am);
  S.isle.spinners = S.isle.spinners || []; S.isle.spinners.push({ m: am, axis: 'y', speed: 6 });
  sellerStall(S, 'thunderSeller', cx - 3, cz + 2, -0.735, 0x5a5ab0, 17);
  stand(S, 'thunderOutfit', H[0].A.door.x, H[0].A.door.z, -2.4 + Math.PI);
  stand(S, 'thunderYard', H[1].A.door.x, H[1].A.door.z, -2.4 + Math.PI);
  stand(S, 'thunderLore', cx + 2, cz + 6, 0.8);
  sign(S, 'STORMWATCH STATION', cx - 1, cz + 5, -2.4 + Math.PI, null, { w: 3 });
  light(S, cx, heightAt(cx, cz) + 3, cz, 0xd8e8ff, 2.2, 16, false);
}

/* Tidebreaker: the Hall of the Current Masters, a tide mill, a ring of stacks and the fastest water there is. */
function tide(S) {
  const cx = 5320, cz = 1180;
  dock(S, 'tide', cx, cz, -0.7, 0.7, 24, 110);
  // the round hall
  const hx = cx + 10, hz = cz - 10, hy = heightAt(hx, hz);
  S._props(b => {
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; if (k === 12) continue; b.color(shadeHex(0xd8d0b8, 0.9 + (k % 2) * 0.1)).push(Math.cos(a) * 6, 0, Math.sin(a) * 6, 0, -a, 0).box(0.4, 4, 2.4, 0, 2, 0).pop(); }
    b.color(0x2a6a9a).cone(7.2, 4, 7.5, 16);
    b.color(0xd8b048).cone(0.6, 7.3, 9, 6);
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; b.color(0xe8e0c8).box(1, 0.2, 1, Math.cos(a) * 5.4, 0.1, Math.sin(a) * 5.4); }
  }, hx, hz, 0, hy);
  for (let k = 0; k < 16; k++) { if (k === 12) continue; const a = k / 16 * TAU; S.C.box(hx + Math.cos(a) * 6, hz + Math.sin(a) * 6, 0.3, 1.2, -a, hy - 1, hy + 4); }
  S.blockers.push({ x: hx, z: hz, r: 8 });
  const door = 12 / 16 * TAU;
  stand(S, 'tideOutfit', hx + Math.cos(door) * 3.5, hz + Math.sin(door) * 3.5, Math.atan2(Math.cos(door), Math.sin(door)));
  light(S, hx, hy + 3, hz, 0xffd090, 2, 12);
  // the tide mill: a paddle wheel turned by the current
  const [mx, mz] = S._shore(cx - 12, cz - 6, -1, 0.3, 60);
  const mw = new MeshBuilder(rng(11));
  for (let k = 0; k < 10; k++) { mw.push(0, 0, 0, 0, 0, k / 10 * TAU); mw.color(0x6a4a30).box(0.2, 3.2, 0.2, 0, 1.6, 0); mw.color(0x7a5a38).box(0.1, 1, 2.2, 0, 3, 0); mw.pop(); }
  const wm = new THREE.Mesh(mw.build(), MAT.solid); wm.position.set(mx, 0.6, mz); wm.rotation.y = Math.atan2(-1, 0.3); S.group.add(wm);
  S.isle.spinners = S.isle.spinners || []; S.isle.spinners.push({ m: wm, axis: 'x', speed: 1.4 });
  S._props(b => { b.color(0x5a4a3a).box(4, 5, 4, 0, 2.5, 0); b.color(0x3a4a5a).cone(3.4, 5, 7, 4); }, mx + 3, mz + 0.5, 0);
  S.C.box(mx + 3, mz + 0.5, 2, 2, 0, -2, 6);
  sellerStall(S, 'tideSeller', cx - 2, cz - 6, -0.785, 0x2a6a9a, 18);
  stand(S, 'tideYard', cx + 4, cz + 4, 2.3);
  stand(S, 'tideLore', cx - 6, cz + 2, 1.8);
  sign(S, 'THE CURRENT MASTERS', cx + 3, cz - 3, -0.8 + Math.PI, null, { w: 3 });
  // buoys marking the rip, bobbing in the race
  S.isle.buoys = [];
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; S.isle.buoys.push({ x: 5400 + Math.cos(a) * 200, z: 1100 + Math.sin(a) * 200 }); }
}

/* The Sunken Crown: a drowned city of towers, arches and a golden crown on the throne. */
function crown(S) {
  const cx = 1300, cz = 5120;
  dock(S, 'crown', cx, cz, 0, -1, 18, 111);
  const H = houses(S, [
    { x: -9, z: 6, rot: Math.PI, key: 'crownHouse', spec: { w: 7, d: 5, h: 3, rise: 1.4, wall: 0xe8d8b0, roof: 0x8a3a2a, porch: true, windows: [{ side: 'front', x: -2 }] } },
    { x: 9, z: 7, rot: Math.PI, spec: { w: 5, d: 4, wall: 0xd8c8a0, roof: 0x3a6a8a } },
  ], cx, cz);
  sellerStall(S, 'crownSeller', cx + 2, cz - 3, Math.PI, 0xd8b048, 19);
  stand(S, 'crownOutfit', H[0].A.door.x, H[0].A.door.z - 0.7, Math.PI);
  stand(S, 'crownLore', cx - 4, cz - 6, -0.6);
  sign(S, 'THE CROWN DOCK', cx - 1, cz - 4, Math.PI);
  // the drowned city
  const r = rng(909), b = new MeshBuilder(r), g = new MeshBuilder(r);
  const stone = [0xd8c8a0, 0xc8b890, 0xb8a888, 0xe0d4b0];
  for (let k = 0; k < 48; k++) {
    const a = r() * TAU, d = 50 + r() * 260, x = 1300 + Math.cos(a) * d, z = 5040 + Math.sin(a) * d * 0.8;
    if (Math.hypot(x - cx, z - cz) < 30 || Math.hypot(x - 1300, z - 5200) < 95) continue;
    const y = heightAt(x, z), col = stone[k % 4], kind = r();
    b.push(x, y, z, 0, r() * TAU, 0);
    if (kind < 0.35) {
      // a tower, broken off at the top
      const th = 5 + r() * 12, w = 2 + r() * 2;
      b.color(col).cyl(w, w * 0.92, 0, th, 8, false);
      b.color(shadeHex(col, 0.8)); for (let j = 0; j < 8; j++) { const q = j / 8 * TAU; b.box(0.9, 0.8 + r() * 1.4, 0.6, Math.cos(q) * w * 0.9, th + 0.4, Math.sin(q) * w * 0.9); }
      b.color(0x2a2a2a); for (let j = 0; j < 3; j++) b.box(0.6, 1.2, 0.1, 0, 3 + j * 3.5, w * 0.93);
      S.C.circle(x, z, w, y - 2, y + th);
    } else if (kind < 0.6) {
      // an arch
      b.color(col).box(1.4, 7, 1.4, -3, 3.5, 0); b.box(1.4, 7, 1.4, 3, 3.5, 0); b.color(shadeHex(col, 1.05)).box(7.6, 1.2, 1.6, 0, 7.4, 0);
      S.C.circle(x - 3 * Math.cos(0), z, 1, y - 2, y + 8);
    } else if (kind < 0.8) {
      // a wall with windows
      b.color(col).box(10, 4 + r() * 3, 1, 0, 2.5, 0); b.color(0x2a2a2a).box(1, 1.4, 1.02, -2.5, 3, 0); b.box(1, 1.4, 1.02, 2.5, 3, 0);
    } else {
      // a dome, cracked open
      b.color(col).cyl(5, 4.8, 0, 3, 10, false); b.color(0x6a8aa8).lathe([[4.8, 3], [4, 5], [2.5, 6.4], [0.1, 7]], 10, 0, 0);
    }
    b.pop();
  }
  // the throne and the crown: a colossal statue's head, crowned in gold, half out of the water
  const tx = 1300, tz = 5000, ty = heightAt(tx, tz);
  b.push(tx, ty, tz);
  b.color(0xc8b890).box(14, 3, 10, 0, 1.5, 0);                     // the dais
  b.color(0xd8c8a0).blob(4.2, 5, 4.2, 0, 6.5, 0, 10, 6);            // the head
  b.color(0x2a2a2a).box(1.2, 0.5, 0.3, -1.4, 7.4, 3.9); b.box(1.2, 0.5, 0.3, 1.4, 7.4, 3.9);
  b.color(0xd8b048); for (let j = 0; j < 8; j++) { const q = j / 8 * TAU; b.push(Math.cos(q) * 3.6, 10.6, Math.sin(q) * 3.6).cone(0.8, 0, 2.6, 4).pop(); }
  b.color(0xc8a038).cyl(3.9, 3.9, 10, 11, 12, false);
  b.pop();
  for (let j = 0; j < 8; j++) { const q = j / 8 * TAU; g.color(j % 2 ? 0xe04a4a : 0x4ae0a0).blob(0.35, 0.35, 0.35, tx + Math.cos(q) * 3.95, ty + 10.5, tz + Math.sin(q) * 3.95, 6, 3); }
  S.C.circle(tx, tz, 7, ty - 2, ty + 12);
  S.isle.crownPos = V(tx, ty + 12, tz);
  const m = new THREE.Mesh(b.build(), MAT.solid); m.castShadow = true; m.receiveShadow = true; m.name = 'drownedCity';
  S.group.add(m);
  S.group.add(new THREE.Mesh(g.build(), MAT.glow));
  light(S, tx, ty + 11, tz, 0xffd070, 2, 30, true);
  S.interact.push({ id: 'crownStatue', kind: 'crown', pos: V(tx, ty + 3, tz + 6), r: 8, label: 'Look up at the Crown', swim: true });
  void buildPillar;
}

/* The Abyssal Reach: a stilt hut at the foot of the needle, the Deep Light on top. */
function abyssal(S) {
  const cx = -4500, cz = 4400;
  const d = dock(S, 'abyssal', cx, cz + 20, 0, 1, 24, 112);
  // a platform on stilts beside the dock, where the Keeper's people live
  const [px, pz] = S._w(-7, 10, d.ox, d.oz, d.rot);
  const res = BA.buildHouse({ w: 6, d: 5, h: 2.8, rise: 1.2, seed: 1201, wall: 0x3a3440, roof: 0x2a2a34, doorX: 0, doorOpen: false, windows: [{ side: 'front', x: -1.8 }, { side: 'front', x: 1.8 }], floorH: 0.1, stilts: 1.6, porch: true });
  const hp = S.place(res, px, pz, d.rot + Math.PI / 2, 0);
  S.blockers.push({ x: px, z: pz, r: 5 });
  const porch = hp.A.porch;
  S.anchors.abyssalSeller = { pos: V(porch.x, porch.y, porch.z), face: d.rot + Math.PI / 2 };
  S.anchors.abyssalOutfit = { pos: V(...S._w(-5, 16, d.ox, d.oz, d.rot).flatMap((v, i) => i ? [1.25, v] : [v])), face: d.rot + Math.PI / 2 };
  S.anchors.abyssalYard = { pos: V(...S._w(1.4, 20, d.ox, d.oz, d.rot).flatMap((v, i) => i ? [1.25, v] : [v])), face: d.rot - Math.PI / 2 };
  light(S, px, 4.5, pz, 0x8a7af0, 1.8, 12);
  // the Deep Light, on the top of the needle
  const ly = heightAt(cx, cz);
  const lh = BA.buildLighthouse(19);
  const lp = S.place(lh, cx, cz, 0, ly - 0.2);
  S.lights.push({ pos: V(cx, lp.y + lh.lampY, cz), color: 0x9a8aff, intensity: 3, dist: 80, night: false, beacon: true });
  // and a lift up to it
  let ez = cz + 10; while (heightAt(cx, ez + 1) > ly - 3 && ez < cz + 80) ez += 1;
  const [bx, bz] = S._w(0, 2, d.ox, d.oz, d.rot);
  S.isle.lift2 = { bx, bz, by: 1.25, tx: cx, tz: ez - 2, ty: ly };
  S.interact.push({ id: 'abyssUp', kind: 'lift', dir: 'up', lift: 'lift2', pos: V(bx, 2, bz), r: 2.4, label: 'Climb the iron ladder to the Deep Light' });
  S.interact.push({ id: 'abyssDown', kind: 'lift', dir: 'down', lift: 'lift2', pos: V(cx, ly + 1, ez - 2), r: 2.6, label: 'Climb back down to the dock' });
  S._props(b => { for (let y = 0; y < ly + 1; y += 0.4) b.color(0x5a5a60).box(0.8, 0.05, 0.05, 0, y, 0); b.box(0.06, ly + 1, 0.06, -0.4, (ly + 1) / 2, 0); b.box(0.06, ly + 1, 0.06, 0.4, (ly + 1) / 2, 0); }, bx, bz - 0.5, d.rot, 0);
  stand(S, 'abyssalLore', cx + 1.5, cz + 3.5, 0.5, ly);
  sign(S, 'THE DEEP LIGHT', px + 2, pz + 3.5, d.rot + Math.PI / 2, 0, { w: 2.4, lift: 3.2 });
}

/* Vigil's End keeps its builder in Settlement; this adds only the shipwright who
   sells the Leviathan Hunter, down by the landing. */
function vigilYard(S) {
  const L = S.anchors.vigilLanding;
  if (!L) return;
  const m = S.moorings.find(q => q.vigil);
  const face = m ? m.heading + Math.PI : 0;
  S._npcAnchor('reachYard', V(L.x - Math.sin(face) * 12 + Math.cos(face) * 2.4, 1.3, L.z - Math.cos(face) * 12 - Math.sin(face) * 2.4), face);
}

/* The islets: a beached wreck, a shack, a cairn with something buried under it. */
function islets(S) {
  const r = rng(1313);
  S.isle.caches = [];
  let n = 0;
  for (const I of ISLETS) {
    // a sandbar: sometimes the columns of something much older stand on it, just under the surface
    if (I.kind === 'bar') { if (r() < 0.35) for (let k = 0; k < 4; k++) { const a = r() * TAU, d = r() * I.r * 0.7, s = 1 + r(), h = 3 + r() * 5; S._props(b => { b.color(0xc8b890).push(0, 0, 0, 0, 0, 0, s); b.box(1.6, 0.5, 1.6, 0, 0.25, 0); b.cyl(0.6, 0.58, 0.5, h, 10, true); b.pop(); }, I.x + Math.cos(a) * d, I.z + Math.sin(a) * d, r() * TAU); } continue; }
    if (I.kind !== 'islet') continue;
    const q = r();
    const [gx, gz, gh] = S._findGround(I.x, I.z, 0.6, 20, I.r);
    if (gh < 0.5) continue;
    if (q < 0.28) S.wreckAt(I.x + I.r * 0.9, I.z, 0.2, 10 + r() * 8, false);
    else if (q < 0.5) {
      S._props(b => { b.color(0x6a5a44).box(3, 2.2, 2.6, 0, 1.1, 0); b.color(0x4a3a2a).push(0, 2.3, 0, 0, 0, 0.12).box(3.6, 0.12, 3.2, 0, 0, 0).pop(); b.color(0x2a2a2a).box(0.8, 1.6, 0.05, 0.6, 0.8, 1.31); BA.buildNetRack(b, -2.6, 0, 0.5, 0.3); }, gx, gz, r() * TAU, gh);
      S.C.box(gx, gz, 1.6, 1.4, 0, gh - 1, gh + 2.4);
    } else if (q < 0.8) {
      // a cairn, and whatever someone buried beneath it
      S._props(b => { b.color(0x7a7a72); for (let j = 0; j < 5; j++) b.lump(0.6 - j * 0.1, 0, 0.25 + j * 0.45, 0, 0.3, 0.7); b.color(0xd8c89a).box(0.06, 0.8, 0.06, 0.7, 0.4, 0); }, gx, gz, 0, gh);
      S.isle.caches.push({ id: 'cache' + n, x: gx, z: gz, y: gh });
      S.interact.push({ id: 'cache' + n, kind: 'cache', pos: V(gx, gh + 0.8, gz), r: 2.6, label: 'Dig under the cairn' });
      n++;
    } else {
      // a beacon someone keeps lit
      S._props(b => { b.color(0x5a4230).box(0.3, 4, 0.3, 0, 2, 0); b.color(0x2a2a2a).box(0.7, 0.7, 0.7, 0, 4.3, 0); }, gx, gz, 0, gh);
      light(S, gx, gh + 4.4, gz, 0xffc070, 2.2, 30, true);
    }
  }
}

export function buildIslands(S) {
  S.isle = S.isle || {};
  for (const f of [whisper, sunscar, skywatch, crystal, frostfall, dread, ironwreck, lost, thunder, tide, crown, abyssal, vigilYard, islets]) f(S);
}
