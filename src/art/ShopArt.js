/* ShopArt.js - the things a shop puts out for you to look at.

   Every bait has its own container - a crate of soil and worms, a glowing
   jar, a sweating ice brick, a fizzing canister - so you can tell them apart
   across the room without reading a label. Boat plans are a sheet on a
   drafting table with the boat drawn on it and a little model of her on top.
   The stalls and pavilions are plain island carpentry: a plank deck, four
   posts, a back wall to hang rods on, a table, a canvas roof. */

import * as THREE from '../../lib/three.module.js';
import { MeshBuilder, shadeHex } from './Geo.js';
import { MAT } from './Materials.js';
import { rng, TAU } from '../core/Util.js';
import { buildBoat } from './BoatArt.js';
import { HULL_BY_ID } from '../data/BoatData.js';

const meshOf = (b, mat = MAT.solid) => { const m = new THREE.Mesh(b.build(), mat); m.castShadow = true; m.receiveShadow = true; return m; };
function group(b, g = null, gl = null) {
  const G = new THREE.Group();
  if (b.tris) G.add(meshOf(b));
  if (g && g.tris) { const m = meshOf(g, MAT.glow); m.castShadow = false; G.add(m); }
  if (gl && gl.tris) { const m = meshOf(gl, MAT.glass); m.castShadow = false; m.renderOrder = 2; G.add(m); }
  return G;
}
let _gl = null;     // the glass of whatever jar is being made

/* ---------------- bait ---------------- */
function crate(b, w, h, d, col) {
  b.color(col);
  b.box(w, 0.02, d, 0, 0.01, 0);
  for (const s of [-1, 1]) { b.box(0.02, h, d, s * (w / 2 - 0.01), h / 2, 0); b.box(w, h, 0.02, 0, h / 2, s * (d / 2 - 0.01)); }
  b.color(shadeHex(col, 0.75)); b.box(w + 0.01, 0.025, 0.03, 0, h * 0.55, d / 2);
}
function jar(b, g, r, h, glass, fill, fillH, glow = false) {
  (glow ? g : b).color(fill).cyl(r * 0.92, r * 0.92, 0.01, h * fillH, 8, true);
  (_gl || b).color(glass).lathe([[r * 0.95, 0], [r, 0.02], [r, h * 0.92], [r * 0.7, h], [r * 0.7, h * 1.06]], 8, 0, 0);
}
/** One bait, as a thing on a shelf. About 30 cm across. */
export function baitDisplay(B) {
  const r = rng(B.id.length * 7 + 3);
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  _gl = new MeshBuilder(r);
  const col = B.col || 0xc8a070;
  switch (B.id) {
    case 'worm': case 'grub': {
      crate(b, 0.3, 0.12, 0.22, B.id === 'grub' ? 0xd8cbb0 : 0x8a6440);
      b.color(0x3a2a1c).box(0.27, 0.02, 0.19, 0, 0.1, 0);
      b.color(col);
      for (let k = 0; k < 7; k++) { const x = -0.1 + r() * 0.2, z = -0.07 + r() * 0.14; b.tube([x, 0.11, z], [x + (r() - 0.5) * 0.06, 0.13, z + 0.04], B.id === 'grub' ? 0.018 : 0.008, 0.007, 5); }
      break;
    }
    case 'pieces': case 'krill': {
      if (B.id === 'krill') { b.color(0xcfe8f4).box(0.26, 0.12, 0.18, 0, 0.06, 0); b.color(0xe8f6fc).box(0.27, 0.02, 0.19, 0, 0.12, 0); b.color(col); for (let k = 0; k < 12; k++) b.box(0.02, 0.012, 0.012, -0.11 + r() * 0.22, 0.03 + r() * 0.09, 0.091); }
      else { b.color(0x9aa0a8).lathe([[0.1, 0], [0.105, 0.01], [0.105, 0.11], [0.1, 0.115]], 10, 0, 0); b.color(col); for (let k = 0; k < 6; k++) b.lump(0.03, -0.05 + r() * 0.1, 0.12, -0.05 + r() * 0.1, 0.3, 0.8); b.color(0xe8e0d0).box(0.21, 0.05, 0.005, 0, 0.06, 0.104); }
      break;
    }
    case 'glow': case 'dust': case 'deep': case 'ghost': {
      const h = B.id === 'dust' ? 0.14 : 0.2, rr = B.id === 'dust' ? 0.045 : 0.075;
      jar(b, g, rr, h, 0xb8d8d8, col, B.id === 'ghost' ? 0.4 : 0.7, true);
      b.color(0x8a6440).cyl(rr * 0.72, rr * 0.72, h * 1.03, h * 1.12, 8, true);
      if (B.id === 'deep') { b.color(0x3a3a44); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; b.beam([Math.cos(a) * rr * 1.05, 0.01, Math.sin(a) * rr * 1.05], [Math.cos(a) * rr * 1.05, h, Math.sin(a) * rr * 1.05], 0.008, 0.008); } g.color(0x9ab0ff).blob(0.03, 0.03, 0.03, 0, h * 0.5, 0, 6, 3); }
      if (B.id === 'ghost') { g.color(0xf0f8ff); for (let k = 0; k < 3; k++) g.blob(0.018, 0.03, 0.018, (r() - 0.5) * 0.06, h * (0.45 + k * 0.12), (r() - 0.5) * 0.06, 5, 3); }
      if (B.id === 'dust') { g.color(0xe8ffff); for (let k = 0; k < 8; k++) g.box(0.008, 0.008, 0.008, (r() - 0.5) * 0.06, 0.02 + r() * 0.08, (r() - 0.5) * 0.06); }
      break;
    }
    case 'explosive': {
      crate(b, 0.3, 0.14, 0.2, 0x7a5a3a);
      b.color(0xd84a2a); for (let k = 0; k < 5; k++) b.cyl(0.022, 0.022, 0.02, 0.2, 7, true, -0.1 + k * 0.05, 0);
      b.color(0x2a2a2a); for (let k = 0; k < 5; k++) b.beam([-0.1 + k * 0.05, 0.2, 0], [-0.1 + k * 0.05 + 0.02, 0.25, 0.01], 0.004, 0.004);
      b.color(0xf2c14a).box(0.12, 0.04, 0.005, 0, 0.08, 0.101);
      break;
    }
    case 'magnetic': {
      b.color(0x6a7078).lathe([[0.09, 0], [0.095, 0.01], [0.095, 0.09], [0.09, 0.095]], 10, 0, 0);
      b.color(0xc83a2a); b.box(0.03, 0.09, 0.03, -0.04, 0.14, 0); b.box(0.03, 0.09, 0.03, 0.04, 0.14, 0); b.box(0.11, 0.03, 0.03, 0, 0.2, 0);
      b.color(0xd8d8d8); b.box(0.03, 0.02, 0.031, -0.04, 0.1, 0); b.box(0.03, 0.02, 0.031, 0.04, 0.1, 0);
      break;
    }
    case 'mystery': {
      b.color(0x6a3a9a).box(0.2, 0.16, 0.2, 0, 0.08, 0);
      b.color(0xf2c14a); b.box(0.21, 0.165, 0.03, 0, 0.08, 0); b.box(0.03, 0.165, 0.21, 0, 0.08, 0);
      b.blob(0.035, 0.025, 0.02, -0.03, 0.18, 0, 5, 3); b.blob(0.035, 0.025, 0.02, 0.03, 0.18, 0, 5, 3);
      break;
    }
    case 'lava': {
      b.color(0x3a3230).lathe([[0.07, 0], [0.11, 0.05], [0.1, 0.12], [0.08, 0.13]], 9, 0, 0);
      g.color(col).cyl(0.085, 0.085, 0.11, 0.125, 9, true);
      g.color(0xffd24a).blob(0.02, 0.01, 0.02, 0.02, 0.127, -0.01, 5, 2);
      break;
    }
    case 'feather': {
      b.color(0x6a4a30).cyl(0.012, 0.012, 0, 0.3, 5, true); b.box(0.12, 0.02, 0.12, 0, 0.01, 0);
      b.color(0x9aa0a8).beam([0, 0.3, 0], [0.06, 0.28, 0], 0.005, 0.005);
      for (let k = 0; k < 3; k++) { const y = 0.26 - k * 0.07; b.color(k % 2 ? col : 0xe0503a).card([0.06, y, 0], [0.09, y - 0.1, 0.02], [0.03, y - 0.1, -0.01]); b.color(0x9aa0a8).beam([0.06, y + 0.02, 0], [0.06, y - 0.02, 0], 0.004, 0.004); }
      break;
    }
    case 'leech': {
      jar(b, g, 0.075, 0.2, 0x98b0a0, 0x4a4a2a, 0.75, false);
      b.color(0x1a1a12); for (let k = 0; k < 4; k++) b.tube([(r() - 0.5) * 0.08, 0.04 + k * 0.03, 0.05], [(r() - 0.5) * 0.08, 0.06 + k * 0.03, 0.05], 0.01, 0.006, 4);
      b.color(0x5a4a30).cyl(0.056, 0.056, 0.205, 0.225, 8, true);
      break;
    }
    case 'charged': {
      b.color(0x3a3e46).cyl(0.06, 0.06, 0, 0.2, 8, true);
      b.color(0xc8c8c8).cyl(0.03, 0.03, 0.2, 0.23, 6, true);
      g.color(col); g.cyl(0.062, 0.062, 0.06, 0.075, 8, false); g.cyl(0.062, 0.062, 0.13, 0.145, 8, false);
      break;
    }
    case 'current': {
      b.color(0x7a8a94).lathe([[0.09, 0], [0.12, 0.16], [0.125, 0.17]], 10, 0, 0);
      b.color(0x4a90b0).cyl(0.11, 0.11, 0.13, 0.14, 10, true);
      b.color(col); for (let k = 0; k < 5; k++) { const a = r() * TAU, rr = 0.05 * r(); b.blob(0.025, 0.008, 0.008, Math.cos(a) * rr, 0.145, Math.sin(a) * rr, 5, 2); }
      break;
    }
    case 'royal': {
      b.color(0xd8b048).lathe([[0.06, 0], [0.08, 0.04], [0.075, 0.14], [0.05, 0.15]], 9, 0, 0);
      b.color(0xf2d070).cyl(0.055, 0.055, 0.15, 0.17, 8, true);
      b.color(0xf2c14a); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; b.cone(0.012, 0.17, 0.21, 4, Math.cos(a) * 0.045, Math.sin(a) * 0.045); }
      g.color(0xff5a5a).blob(0.01, 0.01, 0.01, 0, 0.2, 0.05, 4, 2);
      break;
    }
    default: {
      jar(b, g, 0.07, 0.18, 0xb8c8c8, col, 0.6, false);
      b.color(0x8a6440).cyl(0.05, 0.05, 0.18, 0.2, 8, true);
    }
  }
  const out = group(b, g, _gl);
  _gl = null;
  return out;
}

/* ---------------- boat plans ---------------- */
/** A drafting table's worth of boat: the plan drawn on a blue sheet, and a little model of her on a cradle. */
export function planDisplay(hullId) {
  const H = HULL_BY_ID[hullId];
  const G = new THREE.Group();
  const b = new MeshBuilder(rng(hullId.length));
  // the sheet, with the boat drawn from above
  b.color(0x2a5a8a).box(1.0, 0.006, 0.66, 0, 0.003, 0);
  b.color(0xe8f0f8);
  const L = 0.8, W = Math.min(0.42, L * H.hw / H.hl * 1.25);
  const w = t => W / 2 * Math.pow(Math.max(0, Math.sin(Math.PI * (t * 0.92 + 0.04))), 0.55) * (t < 0.5 ? 1 : 1 - (t - 0.5) * 0.35);
  let prev = null;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, x = -L / 2 + t * L;
    const p = [x, w(t)];
    if (prev) for (const s of [-1, 1]) b.beam([prev[0], 0.008, prev[1] * s], [p[0], 0.008, p[1] * s], 0.006, 0.002);
    prev = p;
  }
  b.beam([-L / 2, 0.008, 0], [L / 2, 0.008, 0], 0.003, 0.002);
  for (let k = 1; k < 5; k++) { const x = -L / 2 + k / 5 * L, ww = w(k / 5); b.beam([x, 0.008, -ww], [x, 0.008, ww], 0.003, 0.002); }
  // a title block in the corner, and two rolled plans beside the sheet
  b.box(0.2, 0.002, 0.08, 0.36, 0.008, 0.25);
  b.color(0x7a9ab8); b.push(-0.56, 0.035, 0.18, 0, 0, Math.PI / 2); b.cyl(0.03, 0.03, -0.2, 0.2, 7, true); b.pop();
  b.color(0xe8e0c8); b.push(-0.56, 0.035, 0.06, 0, 0.2, Math.PI / 2); b.cyl(0.028, 0.028, -0.18, 0.18, 7, true); b.pop();
  // the cradle
  b.color(0x6a4a30);
  for (const x of [-0.18, 0.18]) { b.box(0.04, 0.1, 0.22, x, 0.05, 0); }
  G.add(meshOf(b));
  // the model: the real boat, small
  const boat = buildBoat({ hull: hullId, parts: {}, paint: 'natural', decor: [] });
  const s = 0.72 / (H.hl * 2);
  boat.group.scale.setScalar(s);
  boat.group.rotation.y = Math.PI / 2;
  boat.group.position.set(0, 0.1 + H.draft * s * 0.4, 0);
  boat.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } if (o.isLight) o.visible = false; });
  G.add(boat.group);
  return G;
}

/* ---------------- stalls ---------------- */
/** A tackle stall, front +Z: plank deck, posts, a back wall to hang rods on, a bait table, a canvas roof.
    Returns {geo, cols, rodSlots: [[x,y,z]], baitSlots: [[x,y,z]], toolSlots}. */
export function tackleStall(w = 4.6, d = 2.8, accent = 0x3a7a3e) {
  const r = rng(11);
  const b = new MeshBuilder(r);
  const hw = w / 2, hd = d / 2, F = 0.16;
  // deck
  for (let i = 0; i < 12; i++) b.color(shadeHex(0x7a5638, 0.85 + r() * 0.25)).box(w / 12 * 0.95, F, d, -hw + (i + 0.5) * w / 12, F / 2, 0);
  // posts
  b.color(0x4a3322);
  for (const [x, z] of [[-hw + 0.1, -hd + 0.1], [hw - 0.1, -hd + 0.1], [-hw + 0.1, hd - 0.1], [hw - 0.1, hd - 0.1]]) b.box(0.14, z < 0 ? 2.9 : 2.5, 0.14, x, F + (z < 0 ? 1.45 : 1.25), z);
  // back wall: pale boards and two rails with pegs
  const bz = -hd + 0.18;
  for (let i = 0; i < 9; i++) b.color(shadeHex(0xb89a70, 0.88 + r() * 0.2)).box((w - 0.3) / 9 * 0.97, 2.5, 0.06, -hw + 0.15 + (i + 0.5) * (w - 0.3) / 9, F + 1.25, bz);
  b.color(0x5a3e28); b.box(w - 0.3, 0.07, 0.07, 0, F + 0.45, bz + 0.06); b.box(w - 0.3, 0.07, 0.07, 0, F + 2.2, bz + 0.06);
  // the bait table
  const tz = 0.35, th = 0.92;
  b.color(0x6a4a30).box(w * 0.72, 0.06, 0.62, 0, F + th, tz);
  b.color(0x5a3e28).box(w * 0.72, 0.04, 0.5, 0, F + 0.35, tz);
  for (const x of [-w * 0.34, w * 0.34]) for (const z of [tz - 0.26, tz + 0.26]) b.box(0.07, th, 0.07, x, F + th / 2, z);
  // canvas roof in the shop's colour, striped
  for (let i = 0; i < 8; i++) {
    b.color(i % 2 ? 0xf0e6d0 : accent);
    b.push(-hw - 0.15 + (i + 0.5) * (w + 0.3) / 8, F + 2.72, 0, -0.14, 0, 0);
    b.box((w + 0.3) / 8, 0.05, d + 0.5, 0, 0, 0);
    b.pop();
  }
  b.color(shadeHex(accent, 0.8)); for (let i = 0; i < 10; i++) b.card([-hw - 0.15 + i * (w + 0.3) / 10, F + 2.47, hd + 0.25], [-hw - 0.15 + (i + 0.5) * (w + 0.3) / 10, F + 2.3, hd + 0.27], [-hw - 0.15 + (i + 1) * (w + 0.3) / 10, F + 2.47, hd + 0.25]);
  const cols = [
    { x: 0, z: 0, hw, hd, y0: -2, y1: F, floor: true },
    { x: 0, z: bz, hw: hw - 0.15, hd: 0.08, y0: F - 0.2, y1: F + 2.6 },
    { x: 0, z: tz, hw: w * 0.36, hd: 0.32, y0: F - 0.2, y1: F + th + 0.05 },
  ];
  for (const [x, z] of [[-hw + 0.1, hd - 0.1], [hw - 0.1, hd - 0.1]]) cols.push({ x, z, hw: 0.1, hd: 0.1, y0: F - 0.2, y1: F + 2.5 });
  return { geo: b.build(), cols, F, backZ: bz + 0.1, tableY: F + th + 0.03, tableZ: tz, tableW: w * 0.68, w, d };
}

/** A shipwright's drafting pavilion: deck, posts, roof, a big plan pinned on the back wall, and one table per boat. */
export function planPavilion(n = 1, accent = 0x24587e) {
  const r = rng(23);
  const b = new MeshBuilder(r);
  const w = Math.max(4.2, 1.7 * n + 1.4), d = 3.4, hw = w / 2, hd = d / 2, F = 0.16;
  for (let i = 0; i < 14; i++) b.color(shadeHex(0x6a5038, 0.85 + r() * 0.25)).box(w / 14 * 0.95, F, d, -hw + (i + 0.5) * w / 14, F / 2, 0);
  b.color(0x3a2a1c);
  for (const [x, z] of [[-hw + 0.1, -hd + 0.1], [hw - 0.1, -hd + 0.1], [-hw + 0.1, hd - 0.1], [hw - 0.1, hd - 0.1]]) b.box(0.16, 3, 0.16, x, F + 1.5, z);
  // back wall with a pinned plan and a rack of tools
  const bz = -hd + 0.2;
  for (let i = 0; i < 10; i++) b.color(shadeHex(0x8a6a4a, 0.88 + r() * 0.2)).box((w - 0.3) / 10 * 0.97, 2.6, 0.06, -hw + 0.15 + (i + 0.5) * (w - 0.3) / 10, F + 1.3, bz);
  b.color(0x2a5a8a).box(2.0, 1.1, 0.02, 0, F + 1.8, bz + 0.05);
  b.color(0xe8f0f8);
  for (let k = 0; k <= 10; k++) { const t = k / 10, x = -0.8 + t * 1.6, y = 0.32 * Math.sin(Math.PI * t) ** 0.5; b.box(0.16, 0.012, 0.005, x, F + 1.8 + y, bz + 0.065); b.box(0.16, 0.012, 0.005, x, F + 1.8 - y, bz + 0.065); }
  b.box(1.7, 0.01, 0.005, 0, F + 1.8, bz + 0.065);
  b.color(0x9aa0a8); for (let k = 0; k < 4; k++) b.box(0.03, 0.4, 0.02, hw - 0.6 - k * 0.18, F + 1.5, bz + 0.05);
  b.color(0x5a3e28); b.box(0.9, 0.05, 0.1, hw - 0.85, F + 1.72, bz + 0.07);
  // tables
  const tables = [];
  for (let i = 0; i < n; i++) {
    const x = -((n - 1) * 1.7) / 2 + i * 1.7, z = 0.25, th = 0.9;
    b.color(0x7a5a3a).push(x, F + th, z, -0.12, 0, 0); b.box(1.25, 0.06, 0.8, 0, 0, 0); b.pop();
    b.color(0x4a3322); for (const lx of [-0.55, 0.55]) for (const lz of [-0.32, 0.32]) b.box(0.07, th - 0.02, 0.07, x + lx, F + (th - 0.02) / 2, z + lz);
    tables.push({ x, z, y: F + th + 0.04, tilt: -0.12 });
  }
  // canvas roof
  for (let i = 0; i < 9; i++) { b.color(i % 2 ? 0xe8e0cc : accent); b.push(-hw - 0.2 + (i + 0.5) * (w + 0.4) / 9, F + 3.05, 0, -0.1, 0, 0); b.box((w + 0.4) / 9, 0.05, d + 0.6, 0, 0, 0); b.pop(); }
  const cols = [{ x: 0, z: 0, hw, hd, y0: -2, y1: F, floor: true }, { x: 0, z: bz, hw: hw - 0.15, hd: 0.08, y0: F - 0.2, y1: F + 2.7 }];
  for (const t of tables) cols.push({ x: t.x, z: t.z, hw: 0.66, hd: 0.42, y0: F - 0.2, y1: t.y + 0.05 });
  for (const [x, z] of [[-hw + 0.1, hd - 0.1], [hw - 0.1, hd - 0.1]]) cols.push({ x, z, hw: 0.1, hd: 0.1, y0: F - 0.2, y1: F + 3 });
  return { geo: b.build(), cols, tables, F, w, d };
}

/* ---------------- the outline ---------------- */
/* A thin shell around the thing you are looking at: the geometry pushed out
   along smoothed normals by a fixed number of pixels, drawn back faces only,
   behind the object. It follows the object because it is a child of it. */
const _shellCache = new WeakMap();
function shellGeo(geo) {
  let s = _shellCache.get(geo);
  if (s) return s;
  const pos = geo.attributes.position, n = pos.count;
  const acc = new Map(), key = i => Math.round(pos.getX(i) * 1e3) + ',' + Math.round(pos.getY(i) * 1e3) + ',' + Math.round(pos.getZ(i) * 1e3);
  const nor = geo.attributes.normal;
  for (let i = 0; i < n; i++) { const k = key(i); const a = acc.get(k) || [0, 0, 0]; a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i); acc.set(k, a); }
  const sn = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = acc.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1; sn[i * 3] = a[0] / l; sn[i * 3 + 1] = a[1] / l; sn[i * 3 + 2] = a[2] / l; }
  s = new THREE.BufferGeometry();
  s.setAttribute('position', pos);
  s.setAttribute('snormal', new THREE.BufferAttribute(sn, 3));
  _shellCache.set(geo, s);
  return s;
}
export function outlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOp: { value: 0 }, uW: { value: 0.0032 }, uCol: { value: new THREE.Color(0xfff2d0) } },
    vertexShader: `attribute vec3 snormal; uniform float uW;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * snormal);
        vec2 off = (projectionMatrix * vec4(n, 0.0)).xy;
        float l = length(off); if (l > 1e-5) off /= l;
        clip.xy += off * uW * clip.w * vec2(1.0, 1.6);
        gl_Position = clip;
      }`,
    fragmentShader: 'uniform float uOp; uniform vec3 uCol; void main() { gl_FragColor = vec4(uCol, uOp); }',
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
}
/** Give every mesh in `obj` an outline shell sharing one material. Returns the material (fade it with uOp). */
export function addOutline(obj) {
  const mat = outlineMaterial();
  const meshes = [];
  obj.traverse(o => { if (o.isMesh && !o.userData.shell) meshes.push(o); });
  for (const m of meshes) {
    const sh = new THREE.Mesh(shellGeo(m.geometry), mat);
    sh.userData.shell = true; sh.renderOrder = -1; sh.visible = false; sh.raycast = () => {};
    m.add(sh);
    (obj.userData.shells = obj.userData.shells || []).push(sh);
  }
  return mat;
}
