/* BoatArt.js - the four hulls and everything bolted onto them.

   The hull is a LOFT: cross-sections from the transom to the bow, each a
   keel point, a chine, the waterline and the gunwale. The outside is
   painted, the inside is bare wood, a trim cap runs along the top, and the
   deck is laid in planks at the height BoatData says you stand at. The
   inside skin is a real surface facing inward, so from the deck the hull
   has walls and from the water it has a painted side.

   Frame: +Z bow, y = 0 waterline, deck at hull.deck. */

import * as THREE from '../../lib/three.module.js?v=1790358905';
import { MeshBuilder, shadeHex, mixHex } from './Geo.js?v=1790358905';
import { MAT } from './Materials.js?v=1790358905';
import { rng, TAU } from '../core/Util.js?v=1790358905';
import { HULL_BY_ID, PAINT_BY_ID, boatStats } from '../data/BoatData.js?v=1790358905';

const RAIL = { dinghy: 0.42, motor: 0.55, trawler: 0.85, expedition: 0.95, wayfarer: 1.0 };
const BOW = { dinghy: 0.25, motor: 0.55, trawler: 0.9, expedition: 1.2, wayfarer: 1.6 };

function sections(H) {
  const n = 12, out = [];
  const rail = RAIL[H.id];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const z = -H.hl + t * H.hl * 2;
    let w;
    if (t < 0.55) w = H.hw * (0.84 + 0.16 * Math.sin(t / 0.55 * Math.PI / 2));
    else w = H.hw * Math.pow(Math.cos((t - 0.55) / 0.45 * Math.PI / 2), 0.75);
    if (i === n) w = 0.0;
    const keel = -H.draft * (t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25 * 0.8);
    const g = H.deck + rail + BOW[H.id] * Math.pow(Math.max(0, (t - 0.55) / 0.45), 2);
    out.push({ z, w, keel, g, t });
  }
  return out;
}

export function buildBoat(cfg) {
  const H = HULL_BY_ID[cfg.hull] || HULL_BY_ID.dinghy;
  const paint = PAINT_BY_ID[cfg.paint] || PAINT_BY_ID.natural;
  const st = boatStats(cfg);
  const r = rng(H.id.length * 13 + 7);
  const b = new MeshBuilder(r);
  const group = new THREE.Group();
  group.name = 'boat';
  const S = sections(H);
  const rail = RAIL[H.id];
  const hullCol = paint.hull, trim = paint.trim;
  const wood = 0x8a6848, woodIn = 0x9a7a56;

  const outer = s => [[0, s.keel], [s.w * 0.72, s.keel * 0.42], [s.w, H.deck * 0.3], [s.w, s.g]];
  const inner = s => [[s.w * 0.9, H.deck], [s.w * 0.9, s.g]];

  // --- outer skin ---
  for (let i = 0; i < S.length - 1; i++) {
    const A = outer(S[i]), B = outer(S[i + 1]);
    for (let k = 0; k < 3; k++) {
      for (const side of [-1, 1]) {
        const band = k === 2 ? (H.id === 'dinghy' ? shadeHex(hullCol, 1.05) : hullCol) : k === 0 ? shadeHex(hullCol, 0.7) : shadeHex(hullCol, 0.85);
        b.color(shadeHex(band, 0.95 + r() * 0.08));
        const p = [side * A[k][0], A[k][1], S[i].z], q = [side * A[k + 1][0], A[k + 1][1], S[i].z];
        const p2 = [side * B[k][0], B[k][1], S[i + 1].z], q2 = [side * B[k + 1][0], B[k + 1][1], S[i + 1].z];
        b.quad(p, q, q2, p2, [side, k === 0 ? -1 : 0.2, 0]);
      }
    }
    // a painted stripe just under the gunwale
    for (const side of [-1, 1]) {
      const y0a = S[i].g - 0.12, y1a = S[i].g - 0.04, y0b = S[i + 1].g - 0.12, y1b = S[i + 1].g - 0.04;
      b.color(trim);
      b.quad([side * (S[i].w + 0.004), y0a, S[i].z], [side * (S[i].w + 0.004), y1a, S[i].z], [side * (S[i + 1].w + 0.004), y1b, S[i + 1].z], [side * (S[i + 1].w + 0.004), y0b, S[i + 1].z], [side, 0, 0]);
    }
  }
  // transom
  const T = outer(S[0]);
  b.color(shadeHex(hullCol, 0.9));
  for (let k = 0; k < 3; k++) {
    b.quad([-T[k][0], T[k][1], S[0].z], [T[k][0], T[k][1], S[0].z], [T[k + 1][0], T[k + 1][1], S[0].z], [-T[k + 1][0], T[k + 1][1], S[0].z], [0, 0, -1]);
  }
  // --- inner skin and gunwale cap ---
  for (let i = 0; i < S.length - 1; i++) {
    const A = inner(S[i]), B = inner(S[i + 1]);
    for (const side of [-1, 1]) {
      b.color(shadeHex(woodIn, 0.9 + r() * 0.15));
      b.quad([side * A[0][0], A[0][1], S[i].z], [side * A[1][0], A[1][1], S[i].z], [side * B[1][0], B[1][1], S[i + 1].z], [side * B[0][0], B[0][1], S[i + 1].z], [-side, 0, 0]);
      b.color(trim === 0xe8e0cc ? 0x6a4a30 : shadeHex(trim, 0.92));
      b.quad([side * S[i].w, S[i].g, S[i].z], [side * A[1][0], A[1][1], S[i].z], [side * B[1][0], B[1][1], S[i + 1].z], [side * S[i + 1].w, S[i + 1].g, S[i + 1].z], [0, 1, 0]);
    }
  }
  // inner transom
  b.color(woodIn);
  b.quad([-S[0].w * 0.9, H.deck, S[0].z + 0.02], [S[0].w * 0.9, H.deck, S[0].z + 0.02], [S[0].w * 0.9, S[0].g, S[0].z + 0.02], [-S[0].w * 0.9, S[0].g, S[0].z + 0.02], [0, 0, 1]);
  b.color(0x6a4a30).box(S[0].w * 2, 0.06, 0.1, 0, S[0].g + 0.03, S[0].z);
  // --- deck planks ---
  const pw = 0.22;
  for (let i = 0; i < S.length - 1; i++) {
    const w0 = S[i].w * 0.9, w1 = S[i + 1].w * 0.9;
    const n = Math.max(1, Math.ceil(w0 * 2 / pw));
    for (let k = 0; k < n; k++) {
      const a0 = -w0 + k * w0 * 2 / n, a1 = a0 + w0 * 2 / n * 0.94;
      const c0 = -w1 + k * w1 * 2 / n, c1 = c0 + w1 * 2 / n * 0.94;
      b.color(shadeHex(wood, 0.85 + ((k * 7 + i * 3) % 5) * 0.05));
      b.quad([a0, H.deck, S[i].z], [a1, H.deck, S[i].z], [c1, H.deck, S[i + 1].z], [c0, H.deck, S[i + 1].z], [0, 1, 0]);
    }
  }
  // keel strip
  b.color(0x3a2a20);
  for (let i = 0; i < S.length - 1; i++) b.beam([0, S[i].keel - 0.03, S[i].z], [0, S[i + 1].keel - 0.03, S[i + 1].z], 0.08, 0.08);

  const parts = { lights: [], rodHolders: [], cooler: null, fuel: null };
  const D = H.deck;

  /* ---------------- per-hull furniture ---------------- */
  if (H.id === 'dinghy') {
    // thwarts
    b.color(0x7a5838);
    for (const z of [-1.2, 0.4]) {
      const s = S[Math.round((z + H.hl) / (H.hl * 2) * 12)];
      b.box(s.w * 1.8, 0.06, 0.32, 0, D + 0.3, z);
    }
    // oarlocks and oars stowed along the side
    b.color(0x3a3a3a);
    for (const sx of [-1, 1]) b.box(0.05, 0.1, 0.05, sx * (S[5].w - 0.02), S[5].g + 0.05, -0.4);
    b.color(0xb08a58);
    b.beam([-0.55, D + 0.1, -1.5], [-0.62, D + 0.12, 1.3], 0.05, 0.05);
    b.color(0xb08a58).box(0.14, 0.02, 0.5, -0.62, D + 0.12, 1.4);
  } else {
    // bow rail posts
    b.color(0xc8ccd0);
    for (let i = 7; i < 12; i++) for (const side of [-1, 1]) {
      const s = S[i];
      b.cyl(0.02, 0.02, s.g, s.g + 0.45, 4, true, side * (s.w - 0.05), s.z);
    }
    for (const side of [-1, 1]) for (let i = 7; i < 11; i++) b.beam([side * (S[i].w - 0.05), S[i].g + 0.45, S[i].z], [side * (S[i + 1].w - 0.05), S[i + 1].g + 0.45, S[i + 1].z], 0.03, 0.03);
    // tyre fenders
    b.color(0x1e1e22);
    for (const side of [-1, 1]) for (const zz of [-0.5, 0.5]) {
      const s = S[Math.round(6 + zz * 4)];
      b.push(side * (s.w + 0.08), s.g - 0.45, s.z, 0, 0, Math.PI / 2);
      b.cyl(0.2, 0.2, -0.06, 0.06, 7, true);
      b.pop();
    }
    // life ring
    b.color(0xe8502a);
    b.push(0.0, S[0].g - 0.15, S[0].z - 0.05, Math.PI / 2, 0, 0);
    for (let k = 0; k < 8; k++) { const a0 = k / 8 * TAU, a1 = (k + 1) / 8 * TAU; b.color(k % 2 ? 0xf2f2f2 : 0xe8502a).beam([Math.cos(a0) * 0.25, 0, Math.sin(a0) * 0.25], [Math.cos(a1) * 0.25, 0, Math.sin(a1) * 0.25], 0.08, 0.08); }
    b.pop();
  }
  // cooler
  {
    const [cx, , cz] = H.cooler;
    const s = H.id === 'dinghy' ? 0.5 : 0.7;
    b.color(0xf2f2ee).box(s * 1.3, s * 0.75, s, cx, D + s * 0.375, cz);
    b.color(0x2e7ab0).box(s * 1.32, s * 0.12, s * 1.02, cx, D + s * 0.78, cz);
    b.color(0xd8d8d8).box(s * 0.5, 0.04, 0.05, cx, D + s * 0.86, cz);
    parts.cooler = [cx, D + s * 0.8, cz];
  }
  // fuel tank
  if (H.fuel) {
    const [fx, , fz] = H.fuel;
    b.color(0xc8302a).box(0.5, 0.42, 0.34, fx, D + 0.21, fz);
    b.color(0x2a2a2a).cyl(0.05, 0.05, D + 0.42, D + 0.5, 6, true, fx + 0.12, fz);
    b.color(0xf2d24a).box(0.3, 0.08, 0.01, fx, D + 0.25, fz + 0.175);
    parts.fuel = [fx, D + 0.25, fz];
  }
  // rod holders (only as many as installed)
  for (let i = 0; i < st.holders; i++) {
    const [hx, hy, hz] = H.rodHolders[i];
    b.color(0xb8bcc0).tube([hx, D + hy - 0.2, hz], [hx * 1.02, D + hy + 0.15, hz - 0.12], 0.035, 0.035, 5);
    parts.rodHolders.push([hx, D + hy + 0.15, hz - 0.12]);
  }
  // engine
  const engine = new THREE.Group();
  if (H.engine === 'outboard') {
    const big = H.id !== 'dinghy';
    const eb = new MeshBuilder(r);
    const ec = big ? 0x2a2a30 : 0x5a6a5a;
    eb.color(ec).box(big ? 0.5 : 0.34, big ? 0.62 : 0.42, big ? 0.55 : 0.38, 0, 0.25, 0);
    eb.color(shadeHex(ec, 1.3)).box(big ? 0.52 : 0.36, 0.08, big ? 0.57 : 0.4, 0, big ? 0.6 : 0.47, 0);
    eb.color(0x3a3a3a).box(0.12, big ? 1.0 : 0.75, 0.16, 0, -0.35, -0.05);
    eb.color(0x2a2a2a).box(0.2, 0.12, 0.3, 0, -0.85, -0.05);
    if (!big) { eb.color(0x2a2a2a).beam([0, 0.3, 0.15], [0, 0.35, 0.95], 0.04, 0.04); eb.color(0xc83a2a).cyl(0.04, 0.04, 0.3, 0.42, 5, true, 0, 0.95); }
    else eb.color(0xe8e8e8).box(0.01, 0.1, 0.3, big ? 0.26 : 0.18, 0.4, 0);
    const em = new THREE.Mesh(eb.build(), MAT.solid);
    em.castShadow = true;
    engine.add(em);
    const prop = new THREE.Group();
    const pb = new MeshBuilder(r);
    pb.color(0xb8a060);
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; pb.push(0, 0, 0, 0, 0, a); pb.box(0.05, 0.16, 0.02, 0, 0.09, 0); pb.pop(); }
    prop.add(new THREE.Mesh(pb.build(), MAT.solid));
    prop.position.set(0, -0.85, -0.25);
    engine.add(prop);
    parts.prop = prop;
    engine.position.set(0, S[0].g - 0.25, S[0].z - (big ? 0.3 : 0.2));
  } else if (H.engine === 'sail') {
    // two masts, square sails, rigging down to the rails, a crow's nest
    parts.sails = [];
    for (const [mx, mz] of H.masts) {
      const tall = mz > 0 ? 11 : 9;
      b.color(0x6a4a2e).cyl(0.2, 0.14, D, D + tall, 8, true, mx, mz);
      for (const [y, w] of [[D + tall * 0.42, 3.4], [D + tall * 0.78, 2.6]]) b.color(0x5a3e28).box(w * 2, 0.16, 0.16, mx, y, mz);
      if (mz > 0) { b.color(0x5a3e28).cyl(0.7, 0.6, D + tall - 1.3, D + tall - 0.9, 8, true, mx, mz); b.color(0x6a4a2e); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.box(0.06, 0.5, 0.06, mx + Math.cos(a) * 0.65, D + tall - 0.65, mz + Math.sin(a) * 0.65); } }
      b.color(0xc8b48a);
      for (const sx of [-1, 1]) for (const zz of [-1.2, 1.2]) b.beam([mx, D + tall * 0.95, mz], [sx * (S[Math.round((mz + zz + H.hl) / (H.hl * 2) * 12)].w - 0.05), S[6].g + 0.05, mz + zz], 0.025, 0.025);
      const sg = new MeshBuilder(r);
      for (const [y0, y1, w] of [[tall * 0.44, tall * 0.76, 3.2], [tall * 0.8, tall * 0.98, 2.4]]) {
        for (let k = 0; k < 6; k++) {
          const xa = -w + k * w / 3, xb = xa + w / 3, bulge = 0.5;
          sg.color(k % 2 ? 0xf2ead4 : 0xe6dcc0).card([xa, y1, 0], [xb, y1, 0], [xb, y0, bulge * (1 - Math.abs(k - 2.5) / 3)], [xa, y0, bulge * (1 - Math.abs(k - 2.5) / 3)]);
        }
      }
      if (mz > 0) sg.color(0xa83a2a).card([-0.8, tall * 0.62, 0.3], [0.8, tall * 0.62, 0.3], [0, tall * 0.54, 0.34]);
      const sail = new THREE.Mesh(sg.build(), MAT.solidDS);
      sail.position.set(mx, D, mz + 0.2); sail.castShadow = true;
      group.add(sail); parts.sails.push(sail);
    }
    // a raised quarterdeck rail and the stern wheel on its pedestal
    b.color(0x5a3e28).box(0.2, 1.1, 0.2, 0, D + 0.55, H.helm[2] - 0.1);
    // the hatch down to the hold: a dark opening with a raised coaming
    const Hd = H.hold, [hx, hz] = Hd.hatch;
    b.color(0x100c08).box(Hd.hatchHW * 2, 0.02, Hd.hatchHD * 2, hx, D + 0.012, hz);
    b.color(0x4a3222);
    for (const sx of [-1, 1]) b.box(0.12, 0.18, Hd.hatchHD * 2 + 0.24, hx + sx * (Hd.hatchHW + 0.06), D + 0.09, hz);
    for (const sz of [-1, 1]) b.box(Hd.hatchHW * 2 + 0.24, 0.18, 0.12, hx, D + 0.09, hz + sz * (Hd.hatchHD + 0.06));
    // bowsprit
    b.color(0x6a4a2e).tube([0, S[12].g - 0.2, S[12].z - 0.4], [0, S[12].g + 0.9, S[12].z + 3.2], 0.16, 0.08, 6);
    const prop = new THREE.Group(); engine.add(prop); parts.prop = prop;
  } else {
    const pb = new MeshBuilder(r);
    pb.color(0xb8a060);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; pb.push(0, 0, 0, 0, 0, a); pb.box(0.08, 0.3, 0.03, 0, 0.16, 0); pb.pop(); }
    const prop = new THREE.Group();
    prop.add(new THREE.Mesh(pb.build(), MAT.solid));
    prop.position.set(0, -H.draft + 0.25, -H.hl + 0.3);
    engine.add(prop);
    if (H.engine === 'twin') { const p2 = prop.clone(); p2.position.x = 0.9; prop.position.x = -0.9; engine.add(p2); parts.prop2 = p2; }
    parts.prop = prop;
    // exhaust stack(s)
    b.color(0x2a2a2e);
    b.cyl(0.14, 0.12, D, D + 3.4, 6, true, H.id === 'expedition' ? -1.2 : 0.9, H.cabin.z - H.cabin.hl + 0.1);
    if (H.id === 'expedition') b.cyl(0.14, 0.12, D, D + 3.4, 6, true, 1.2, H.cabin.z - H.cabin.hl + 0.1);
  }
  group.add(engine);
  parts.engine = engine;

  // helm / wheel / console / wheelhouse
  const wheel = new THREE.Group();
  if (H.cabin) {
    const C = H.cabin;
    if (C.open) {
      // console with a windscreen
      b.color(shadeHex(hullCol, 1.05)).box(C.hw * 1.1, 1.0, C.hl * 1.2, 0, D + 0.5, C.z);
      b.color(0x2a2a2a).box(C.hw * 0.9, 0.05, 0.4, 0, D + 1.02, C.z + 0.1);
      b.color(0xc8ccd0);
      b.beam([-C.hw * 0.55, D + 1.0, C.z + 0.3], [-C.hw * 0.5, D + 1.45, C.z + 0.15], 0.03, 0.03);
      b.beam([C.hw * 0.55, D + 1.0, C.z + 0.3], [C.hw * 0.5, D + 1.45, C.z + 0.15], 0.03, 0.03);
      wheel.position.set(0, D + 1.05, C.z - C.hl * 0.6);
    } else {
      // wheelhouse: a walk-in cabin - low walls, big windows, a door in the back
      const wh = C.hw, wl = C.hl, hh = C.h, wt = 0.1, low = 0.95;
      const zF = C.z + wl, zB = C.z - wl, door = 0.6;
      const wall = shadeHex(trim, 0.95), post = shadeHex(trim, 0.85);
      b.color(wall);
      b.box(wh * 2, low, wt, 0, D + low / 2, zF - wt / 2);                                   // front, below the windscreen
      for (const sx of [-1, 1]) b.box(wt, low, wl * 2, sx * (wh - wt / 2), D + low / 2, C.z);   // sides
      for (const sx of [-1, 1]) b.box(wh - door, hh, wt, sx * (door + (wh - door) / 2), D + hh / 2, zB + wt / 2);  // back, either side of the door
      b.box(door * 2, hh - 2.0, wt, 0, D + 2.0 + (hh - 2.0) / 2, zB + wt / 2);                // lintel
      b.color(post);
      for (const sx of [-1, 1]) for (const z of [zF - wt / 2, zB + wt / 2]) b.box(0.12, hh, 0.12, sx * (wh - 0.06), D + hh / 2, z);
      b.color(0x9ec0d2);
      b.box(wh * 2 - 0.2, hh - low - 0.1, 0.04, 0, D + low + (hh - low) / 2, zF - 0.05);
      for (const sx of [-1, 1]) b.box(0.04, hh - low - 0.1, wl * 2 - 0.2, sx * (wh - 0.05), D + low + (hh - low) / 2, C.z);
      b.color(0x3a3a40).box(wh * 2 + 0.3, 0.14, wl * 2 + 0.3, 0, D + hh + 0.07, C.z);
      // console under the windscreen
      b.color(shadeHex(hullCol, 1.0)).box(wh * 1.2, 1.0, 0.5, 0, D + 0.5, zF - 0.35);
      b.color(0x2a2a2a).box(wh * 1.0, 0.04, 0.35, 0, D + 1.02, zF - 0.35);
      b.color(0x6af0a0).box(0.18, 0.1, 0.02, -0.3, D + 1.05, zF - 0.5);
      b.color(0xf2c14a).box(0.1, 0.1, 0.02, 0.3, D + 1.05, zF - 0.5);      // mast
      b.color(0xd8d8d8).cyl(0.07, 0.05, D + hh, D + hh + 2.6, 6, true, 0, C.z - wl * 0.3);
      b.color(0xd8d8d8).box(1.6, 0.06, 0.06, 0, D + hh + 2.0, C.z - wl * 0.3);
      if (H.id === 'expedition') {
        b.color(0xf2f2f2).blob(0.5, 0.35, 0.5, 0, D + hh + 0.5, C.z + wl * 0.3, 8, 3);
        b.color(0x3a3a40).box(wh * 1.4, 1.1, wl * 1.2, 0, D + hh + 0.65, C.z - wl * 0.35);
        b.color(0x9ec0d2).box(wh * 1.3, 0.5, 0.04, 0, D + hh + 0.75, C.z - wl * 0.35 + wl * 0.6 + 0.01);
      }
      wheel.position.set(0, D + 1.15, C.z + wl - 0.75);
    }
  } else {
    wheel.position.set(0, D + 0.7, H.helm[2]);
  }
  if (H.id !== 'dinghy') {
    const wb = new MeshBuilder(r);
    wb.color(0x6a4a30);
    for (let k = 0; k < 8; k++) { const a0 = k / 8 * TAU, a1 = (k + 1) / 8 * TAU; wb.beam([Math.cos(a0) * 0.22, Math.sin(a0) * 0.22, 0], [Math.cos(a1) * 0.22, Math.sin(a1) * 0.22, 0], 0.035, 0.035); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; wb.beam([0, 0, 0], [Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0], 0.025, 0.025); }
    wb.color(0xd8b048).cyl(0.04, 0.04, -0.04, 0.04, 6, true);
    const wm = new THREE.Mesh(wb.build(), MAT.solid);
    wm.rotation.x = 0;
    wheel.add(wm);
    wheel.rotation.x = -0.5;
  }
  group.add(wheel);
  parts.wheel = wheel;

  // crane
  if (H.crane) {
    const [kx, , kz] = H.crane;
    b.color(0xe0a830).cyl(0.14, 0.12, D, D + 2.2, 6, true, kx, kz);
    b.color(0xe0a830).beam([kx, D + 2.1, kz], [kx + 1.4, D + 3.4, kz - 1.4], 0.14, 0.14);
    b.color(0x2a2a2a).beam([kx + 1.4, D + 3.4, kz - 1.4], [kx + 1.4, D + 2.2, kz - 1.4], 0.02, 0.02);
    b.color(0x5a5a5a).box(0.2, 0.2, 0.08, kx + 1.4, D + 2.15, kz - 1.4);
  }
  const glowLamps = [];
  // lamp posts for installed lights
  for (let i = 0; i < Math.min(H.lights.length, 1 + st.lights * 2); i++) {
    const [lx, ly, lz] = H.lights[i];
    b.color(0x3a2c20).cyl(0.02, 0.02, D, D + ly - 0.08, 4, true, lx, lz);
    b.color(0x2a2a2a).cyl(0.07, 0.06, D + ly - 0.08, D + ly - 0.04, 6, true, lx, lz);
    b.color(0x2a2a2a).cone(0.08, D + ly + 0.08, D + ly + 0.16, 6, lx, lz);
    glowLamps.push([lx, D + ly + 0.02, lz]);
    parts.lights.push([lx, D + ly, lz]);
  }

  // decorations
  const decor = new Set(cfg.decor || []);
  if (decor.has('flag')) {
    const fz = S[0].z + 0.15;
    b.color(0x5a4230).cyl(0.025, 0.02, S[0].g, S[0].g + 1.6, 5, true, S[0].w * 0.7, fz);
    b.color(0x2e7ab0).card([S[0].w * 0.7, S[0].g + 1.55, fz], [S[0].w * 0.7, S[0].g + 1.25, fz], [S[0].w * 0.7 + 0.01, S[0].g + 1.4, fz - 0.6]);
  }
  if (decor.has('gnome')) {
    const gx = -S[3].w * 0.6, gz = S[3].z;
    b.color(0x3a6aa0).cyl(0.1, 0.07, D, D + 0.2, 6, true, gx, gz);
    b.color(0xf1c9a5).blob(0.07, 0.07, 0.07, gx, D + 0.25, gz, 6, 3);
    b.color(0xf2f2f2).cone(0.07, D + 0.16, D + 0.26, 6, gx, gz + 0.05);
    b.color(0xc83a2a).cone(0.08, D + 0.29, D + 0.5, 6, gx, gz);
  }
  if (decor.has('flamingo')) {
    const fx = S[8].w * 0.5, fz = S[8].z;
    b.color(0x2a2a2a).beam([fx, D, fz], [fx, D + 0.5, fz], 0.015, 0.015);
    b.color(0xf08ab8).blob(0.16, 0.1, 0.08, fx, D + 0.6, fz, 6, 3);
    b.color(0xf08ab8).tube([fx + 0.1, D + 0.62, fz], [fx + 0.14, D + 0.95, fz], 0.025, 0.025, 4);
    b.color(0xf08ab8).blob(0.05, 0.04, 0.04, fx + 0.16, D + 0.97, fz, 5, 3);
    b.color(0x2a2a2a).box(0.06, 0.02, 0.02, fx + 0.22, D + 0.95, fz);
  }
  if (decor.has('figurehead')) {
    const s = S[12];
    b.color(0xd8a848).push(0, s.g - 0.2, s.z + 0.1, -0.3, 0, 0);
    b.blob(0.14, 0.18, 0.5, 0, 0, 0.35, 6, 4);
    b.color(0xb08838).card([0, 0, -0.1], [0, 0.3, -0.25], [0, -0.3, -0.25]);
    b.pop();
  }
  const glow = new MeshBuilder(r);
  for (const [gx, gy, gz] of glowLamps) glow.color(0xffe0a0).cyl(0.06, 0.06, gy - 0.05, gy + 0.06, 6, true, gx, gz);
  if (decor.has('lanterns')) {
    const cols = [0xffd27a, 0xff9a6a, 0xa8f0ff, 0xf0a8ff];
    for (let i = 1; i < S.length - 1; i++) for (const side of [-1, 1]) {
      glow.color(cols[(i + (side > 0 ? 1 : 0)) % 4]).blob(0.05, 0.06, 0.05, side * S[i].w, S[i].g + 0.1, S[i].z, 5, 3);
    }
  }
  if (decor.has('disco')) {
    const y = H.cabin && !H.cabin.open ? D + H.cabin.h + 1.2 : D + 2;
    b.color(0x5a5a5a).cyl(0.02, 0.02, D, y, 4, true, -S[4].w * 0.6, S[4].z);
    for (let k = 0; k < 16; k++) { glow.color(k % 2 ? 0xe8f0ff : 0xa8b8d8); }
    glow.color(0xd8e8ff).blob(0.22, 0.22, 0.22, -S[4].w * 0.6, y + 0.1, S[4].z, 8, 5, 0.08);
  }
  const hullMesh = new THREE.Mesh(b.build(), MAT.solid);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  group.add(hullMesh);
  if (glow.tris) group.add(new THREE.Mesh(glow.build(), MAT.glow));

  // harpoon mount
  if (st.mount > 0 && H.mount) {
    const mount = new THREE.Group();
    const mb = new MeshBuilder(r);
    mb.color(0x3a3a40).cyl(0.2, 0.25, 0, 0.6, 6, true);
    mount.add(new THREE.Mesh(mb.build(), MAT.solid));
    const yaw = new THREE.Group(); yaw.position.y = 0.7;
    const pitch = new THREE.Group(); yaw.add(pitch);
    const gb = new MeshBuilder(r);
    gb.color(0x4a4a52).box(0.3, 0.3, 0.5, 0, 0, 0);
    gb.color(0x2a2a30).cyl(0.07, 0.07, 0, st.mount > 1 ? 1.6 : 1.1, 6, true);
    gb.color(0xd8d8d8).cone(0.09, st.mount > 1 ? 1.6 : 1.1, (st.mount > 1 ? 1.6 : 1.1) + 0.25, 4);
    gb.color(0x6a4a30).box(0.08, 0.08, 0.6, 0, -0.15, -0.5);
    const gm = new THREE.Mesh(gb.build(), MAT.solid);
    gm.rotation.x = Math.PI / 2;
    pitch.add(gm);
    mount.add(yaw);
    mount.position.set(H.mount[0], D, H.mount[2]);
    group.add(mount);
    parts.mount = { group: mount, yaw, pitch };
  }

  // the hold: a room under the deck, built facing inward so it has walls
  // from inside - floor, plank walls, beams, shelves, a ladder, lanterns
  if (H.hold) {
    const Hd = H.hold, hb = new MeshBuilder(r), hg = new MeshBuilder(r);
    const y0 = Hd.floor, y1 = D - 0.06, w = Hd.hw, z0 = Hd.z0, z1 = Hd.z1;
    for (let k = 0; k < Math.round(w * 2 / 0.3); k++) hb.color(shadeHex(0x6a4a30, 0.85 + (k % 4) * 0.06)).box(0.3, 0.06, z1 - z0, -w + 0.15 + k * 0.3, y0 - 0.03, (z0 + z1) / 2);
    hb.color(0x1e160e).quad([-w - 0.2, y0 - 0.07, z0], [w + 0.2, y0 - 0.07, z0], [w + 0.2, y0 - 0.07, z1], [-w - 0.2, y0 - 0.07, z1], [0, 1, 0]);
    const plank = (a, c, n, out) => { for (let k = 0; k < n; k++) { const f0 = k / n, f1 = (k + 1) / n; hb.color(shadeHex(0x7a5838, 0.8 + (k % 3) * 0.08)); hb.quad(a(f0, 0), a(f1, 0), a(f1, 1), a(f0, 1), out); } void c; };
    for (const s of [-1, 1]) plank((f, v) => [s * w, y0 + (y1 - y0) * v, z0 + (z1 - z0) * f], null, 24, [-s, 0, 0]);
    plank((f, v) => [-w + 2 * w * f, y0 + (y1 - y0) * v, z0], null, 12, [0, 0, 1]);
    plank((f, v) => [-w + 2 * w * f, y0 + (y1 - y0) * v, z1], null, 12, [0, 0, -1]);
    // the ceiling (the underside of the deck) with a hole for the hatch
    const [hx, hz] = Hd.hatch, hw2 = Hd.hatchHW, hd2 = Hd.hatchHD;
    const ceil = (xa, xb, za, zb) => hb.color(0x8a6a48).quad([xa, y1, za], [xb, y1, za], [xb, y1, zb], [xa, y1, zb], [0, -1, 0]);
    ceil(-w, w, z0, hz - hd2); ceil(-w, w, hz + hd2, z1); ceil(-w, hx - hw2, hz - hd2, hz + hd2); ceil(hx + hw2, w, hz - hd2, hz + hd2);
    // and a dark underlay facing up, so you never see into the hold between the deck planks
    const under = (xa, xb, za, zb) => hb.color(0x1e160e).quad([xa, y1 + 0.02, za], [xb, y1 + 0.02, za], [xb, y1 + 0.02, zb], [xa, y1 + 0.02, zb], [0, 1, 0]);
    under(-w, w, z0, hz - hd2); under(-w, w, hz + hd2, z1); under(-w, hx - hw2, hz - hd2, hz + hd2); under(hx + hw2, w, hz - hd2, hz + hd2);
    for (let z = z0 + 1; z < z1; z += 1.5) hb.color(0x3a2818).box(w * 2, 0.18, 0.2, 0, y1 - 0.09, z);
    for (const z of [z0 + 2.2, z0 + 5.4]) hb.color(0x4a3222).cyl(0.14, 0.14, y0, y1, 6, true, 0, z);
    // the ladder up through the hatch
    hb.color(0x6a4a30); for (const sx of [-1, 1]) hb.box(0.07, y1 - y0 + 0.3, 0.07, hx + sx * 0.3, (y0 + y1) / 2 + 0.15, hz + hd2 - 0.1);
    for (let k = 0; k < 6; k++) hb.box(0.6, 0.05, 0.05, hx, y0 + 0.3 + k * 0.3, hz + hd2 - 0.1);
    // shelves of stores along the port wall, a workbench, barrels, nets, spare planks
    for (const [sy, sz] of [[0.6, -4], [1.2, -4], [0.6, -1.4], [1.2, -1.4]]) {
      hb.color(0x5a3e28).box(0.5, 0.05, 2.2, -w + 0.3, y0 + sy, sz);
      for (let k = 0; k < 5; k++) hb.color([0x7a5236, 0x8a6a44, 0x5a6a7a, 0xa87a4a][k % 4]).box(0.34, 0.28, 0.34, -w + 0.3, y0 + sy + 0.17, sz - 0.9 + k * 0.45);
    }
    hb.color(0x6a4a30).box(0.9, 0.08, 1.8, w - 0.5, y0 + 0.85, -3.8);
    for (const zz of [-4.5, -3.1]) for (const xx of [w - 0.85, w - 0.15]) hb.box(0.08, 0.85, 0.08, xx, y0 + 0.42, zz);
    hb.color(0x9aa0a8).box(0.3, 0.05, 0.08, w - 0.5, y0 + 0.92, -4.2); hb.color(0x6a4a30).box(0.12, 0.04, 0.3, w - 0.6, y0 + 0.92, -3.4);
    for (let k = 0; k < 4; k++) hb.color(shadeHex(0x7a5838, 0.8 + k * 0.05)).box(2, 0.08, 0.26, w - 1.1, y0 + 0.05 + k * 0.08, z1 - 0.5 - (k % 2) * 0.1);
    hb.color(0xc4b48a).blob(0.6, 0.25, 0.5, -w + 0.7, y0 + 0.2, z1 - 0.8, 7, 3, 0.3);
    hb.color(0x7a5232).cyl(0.35, 0.35, y0, y0 + 0.9, 8, true, w - 0.5, z0 + 0.6); hb.color(0x7a5232).cyl(0.35, 0.35, y0, y0 + 0.9, 8, true, w - 1.3, z0 + 0.6);
    // lanterns on hooks along the walls, above head height
    for (const [lx, lz] of [[w - 0.2, z0 + 1.6], [-w + 0.2, 0.6], [w - 0.2, z1 - 2.4]]) { hb.color(0x2a2a2a).box(0.02, 0.14, 0.02, lx, y1 - 0.1, lz); hb.box(0.2, 0.03, 0.2, lx, y1 - 0.2, lz); hg.color(0xffd890).box(0.13, 0.18, 0.13, lx, y1 - 0.32, lz); }
    const hm = new THREE.Mesh(hb.build(), MAT.solid); hm.receiveShadow = true;
    group.add(hm); group.add(new THREE.Mesh(hg.build(), MAT.glow));
    // the water that rises in the hold when you are holed
    const hf = new MeshBuilder(); hf.color(0x2e6a78).quad([-w, 0, z0], [w, 0, z0], [w, 0, z1], [-w, 0, z1], [0, 1, 0]);
    const holdFlood = new THREE.Mesh(hf.build(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false }));
    holdFlood.visible = false; holdFlood.renderOrder = 3; group.add(holdFlood); parts.holdFlood = holdFlood;
  }

  // flooding: a sheet of water inside the hull that rises with the leak level
  const fb = new MeshBuilder();
  fb.color(0x2e6a78);
  for (let i = 0; i < S.length - 1; i++) {
    const w0 = S[i].w * 0.88, w1 = S[i + 1].w * 0.88;
    fb.quad([-w0, 0, S[i].z], [w0, 0, S[i].z], [w1, 0, S[i + 1].z], [-w1, 0, S[i + 1].z], [0, 1, 0]);
  }
  const flood = new THREE.Mesh(fb.build(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }));
  flood.position.y = D;
  flood.visible = false;
  flood.renderOrder = 3;
  group.add(flood);
  parts.flood = flood;

  return { group, parts, hull: H, stats: st, sections: S, rail };
}
