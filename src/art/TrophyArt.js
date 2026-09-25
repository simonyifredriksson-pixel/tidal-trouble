/* TrophyArt.js - the objects on your bookcase.

   Every trophy is its own little model on a stand, and the stand tells you
   how hard it was to get:
     tier 0  a plain wooden block           tier 1  dark wood and a brass plate
     tier 2  marble with a silver band      tier 3  gold, with glowing gems
     tier 4  black stone with glowing runes - the relics of real monsters
   buildTrophy() returns a Group already scaled to sit in a cubby of the
   given width and height, feet on y = 0, facing +Z (out of the shelf). */

import * as THREE from '../../lib/three.module.js?v=1790356418';
import { MeshBuilder, shadeHex } from './Geo.js?v=1790356418';
import { MAT } from './Materials.js?v=1790356418';
import { fishMesh } from './FishArt.js?v=1790356418';
import { buildLeviathan } from './CreatureArt.js?v=1790356418';
import { buildGreat, buildKrakenStatue } from './GreatArt.js?v=1790356418';
import { FISH_BY_ID } from '../data/FishData.js?v=1790356418';
import { LEV_BY_ID } from '../data/LeviathanData.js?v=1790356418';
import { GREAT_BY_ID } from '../data/GreatData.js?v=1790356418';
import { BEAST_BY_ID } from '../data/BeastData.js?v=1790356418';
import { buildBeast } from './BeastArt.js?v=1790356418';
import { rng, TAU } from '../core/Util.js?v=1790356418';

const PLINTH = [
  { top: 0x8a6a44, side: 0x6a4a30, trim: 0x5a3e28 },
  { top: 0x4a2e1e, side: 0x3a2418, trim: 0xd8b048 },
  { top: 0xe8e4dc, side: 0xc8c2b8, trim: 0xb8c0c8 },
  { top: 0xe8c050, side: 0xc8962a, trim: 0xfff0a0 },
  { top: 0x2a2a30, side: 0x1e1e24, trim: 0x6af0ff },
];

function plinth(b, g, tier, w = 1, d = 0.7) {
  const P = PLINTH[tier];
  b.color(P.side).box(w, 0.16, d, 0, 0.08, 0);
  b.color(P.top).box(w * 0.9, 0.08, d * 0.9, 0, 0.2, 0);
  b.color(P.trim).box(w * 1.02, 0.03, d * 1.02, 0, 0.165, 0);
  if (tier >= 1) b.color(P.trim).box(w * 0.4, 0.07, 0.01, 0, 0.08, d / 2 + 0.005);
  if (tier === 3) for (const x of [-0.35, 0.35]) g.color(0xff5a8a).lump(0.04, x * w, 0.12, d / 2 + 0.01, 0.2);
  if (tier === 4) { g.color(P.trim); for (const x of [-0.3, 0, 0.3]) g.box(0.08 * w, 0.02, 0.01, x * w, 0.09, d / 2 + 0.006); }
  return 0.24;       // height of the top face
}

function grp(b, g, extra = []) {
  const G = new THREE.Group();
  if (b.tris) { const m = new THREE.Mesh(b.build(), MAT.solid); m.castShadow = true; G.add(m); }
  if (g && g.tris) G.add(new THREE.Mesh(g.build(), MAT.glow));
  for (const e of extra) G.add(e);
  return G;
}

/** Scale and seat a group so it fits a w x h cubby, feet at 0, centred. */
function fitInto(obj, w, h, d = 0.36) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const s = box.getSize(new THREE.Vector3());
  const k = Math.min(w * 0.9 / Math.max(s.x, 1e-3), h * 0.92 / Math.max(s.y, 1e-3), d / Math.max(s.z, 1e-3));
  const out = new THREE.Group();
  obj.scale.multiplyScalar(k);
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  out.add(obj);
  return out;
}

const MODELS = {
  carving(b, g, T) {
    const y = plinth(b, g, T.tier, 0.9, 0.5);
    b.color(0x6a4a30).box(0.04, 0.35, 0.04, 0, y + 0.17, 0);
    b.color(0xb88a58); b.push(0, y + 0.52, 0, 0, 0, 0.15); b.blob(0.36, 0.14, 0.07, 0, 0, 0, 7, 3); b.color(0x9a7040).cone(0.12, -0.46, -0.28, 4); b.pop();
    b.color(0x2a1a10).box(0.03, 0.03, 0.02, 0.24, y + 0.57, 0.07);
  },
  hook(b, g, T) {
    const y = plinth(b, g, T.tier, 0.8, 0.6);
    b.color(0xb8804a);
    b.cyl(0.035, 0.035, y, y + 0.8, 6, true);
    for (let i = 0; i < 7; i++) { const a0 = Math.PI + i / 7 * Math.PI * 1.15, a1 = Math.PI + (i + 1) / 7 * Math.PI * 1.15; b.beam([0.18 + Math.cos(a0) * 0.18, y + 0.2 + Math.sin(a0) * 0.18, 0], [0.18 + Math.cos(a1) * 0.18, y + 0.2 + Math.sin(a1) * 0.18, 0], 0.06, 0.06); }
    b.cone(0.05, y + 0.24, y + 0.38, 4, 0.36, 0);
    b.color(0xd8a060).box(0.14, 0.08, 0.08, 0, y + 0.84, 0);
  },
  reel(b, g, T) {
    const y = plinth(b, g, T.tier, 0.9, 0.6);
    b.color(0x9aa0a8).box(0.06, 0.25, 0.06, 0, y + 0.12, 0);
    b.push(0, y + 0.5, 0, 0, 0, Math.PI / 2);
    b.color(0xd8dde2).cyl(0.26, 0.26, -0.12, -0.09, 12, true); b.cyl(0.26, 0.26, 0.09, 0.12, 12, true);
    b.color(0xe8e0c8).cyl(0.18, 0.18, -0.09, 0.09, 12, false);
    b.color(0x8a9098); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; b.box(0.02, 0.2, 0.02, Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22); }
    b.pop();
    b.color(0x3a3a3a).box(0.04, 0.04, 0.28, 0.14, y + 0.5, 0.1); b.color(0xc8a050).cyl(0.03, 0.03, y + 0.5, y + 0.6, 5, true, 0.14, 0.24);
  },
  cushion(b, g, T) {
    const y = plinth(b, g, T.tier, 1, 0.7);
    b.color(0xa8202a).blob(0.42, 0.1, 0.3, 0, y + 0.08, 0, 8, 3);
    for (const [x, z] of [[-0.4, -0.28], [0.4, -0.28], [-0.4, 0.28], [0.4, 0.28]]) b.color(0xe8c050).blob(0.04, 0.05, 0.04, x, y + 0.06, z, 5, 3);
    b.color(0xf2c850); b.push(0, y + 0.22, 0, 0, 0.3, 0); b.blob(0.32, 0.1, 0.06, 0, 0, 0, 8, 3); b.color(0xd8a830).cone(0.11, -0.42, -0.26, 4); b.pop();
    g.color(0xfff4b0).lump(0.03, 0.18, y + 0.3, 0.05, 0.2);
  },
  orb(b, g, T, extra) {
    const y = plinth(b, g, T.tier, 0.9, 0.7);
    b.color(0x3a2e40).cyl(0.2, 0.26, y, y + 0.12, 8, true);
    g.color(0xc07af0); g.push(0, y + 0.42, 0, 0, 0.6, 0); g.blob(0.13, 0.05, 0.035, 0, 0, 0, 6, 2); g.cone(0.05, -0.17, -0.1, 3); g.pop();
    const glass = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshLambertMaterial({ color: 0x2a1e40, transparent: true, opacity: 0.45, emissive: 0x2a1040, flatShading: true }));
    glass.position.y = y + 0.42;
    extra.push(glass);
  },
  tooth(b, g, T) {
    const y = plinth(b, g, T.tier, 0.8, 0.6);
    b.color(0x5a4a3a).box(0.3, 0.08, 0.3, 0, y + 0.04, 0);
    b.color(0xf4f0e0); b.push(0, y + 0.08, 0, 0, 0, 0.12); b.cyl(0.13, 0.02, 0, 0.8, 6, true); b.pop();
    b.color(0xd8d0bc).cyl(0.14, 0.13, y + 0.08, y + 0.2, 6, false);
  },
  coins(b, g, T) {
    const y = plinth(b, g, T.tier, 1, 0.7);
    b.color(0xe0a93a);
    for (let i = 0; i < 9; i++) b.color(i % 2 ? 0xf2c14a : 0xd8a030).cyl(0.14, 0.14, y + i * 0.05, y + i * 0.05 + 0.045, 9, true, -0.12, 0);
    for (let i = 0; i < 5; i++) b.color(i % 2 ? 0xf2c14a : 0xd8a030).cyl(0.14, 0.14, y + i * 0.05, y + i * 0.05 + 0.045, 9, true, 0.22, 0.08);
    b.color(0xf2c14a); b.push(0.3, y + 0.05, -0.18, 0.4, 0, 0.9); b.cyl(0.14, 0.14, 0, 0.045, 9, true); b.pop();
  },
  lantern(b, g, T) {
    const y = plinth(b, g, T.tier, 0.8, 0.6);
    b.color(0x2e2e30).box(0.36, 0.05, 0.36, 0, y + 0.03, 0);
    for (const [x, z] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) b.box(0.03, 0.5, 0.03, x, y + 0.3, z);
    b.box(0.36, 0.05, 0.36, 0, y + 0.56, 0);
    b.cone(0.26, y + 0.58, y + 0.78, 4, 0, 0, Math.PI / 4);
    for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU; b.beam([Math.cos(a0) * 0.08, y + 0.9 + Math.sin(a0) * 0.08, 0], [Math.cos(a1) * 0.08, y + 0.9 + Math.sin(a1) * 0.08, 0], 0.02, 0.02); }
    g.color(0xffd890).box(0.26, 0.4, 0.26, 0, y + 0.3, 0);
  },
  logbook(b, g, T) {
    const y = plinth(b, g, T.tier, 1, 0.7);
    b.color(0x6a3a22).box(0.8, 0.05, 0.56, 0, y + 0.03, 0);
    for (const s of [-1, 1]) { b.color(0xf0e6c8); b.push(s * 0.19, y + 0.08, 0, 0, 0, s * 0.1); b.box(0.36, 0.04, 0.5, 0, 0, 0); b.pop(); }
    b.color(0x8a7a5a); for (let i = 0; i < 5; i++) for (const s of [-1, 1]) b.box(0.26, 0.005, 0.02, s * 0.2, y + 0.106 + s * 0.005, -0.16 + i * 0.08);
    b.color(0xf4f4f0); b.push(0.22, y + 0.2, 0.05, 0, 0.4, -0.9); b.box(0.03, 0.46, 0.08, 0, 0, 0); b.pop();
    b.color(0x2a2a2a).cyl(0.06, 0.07, y + 0.05, y + 0.14, 7, true, -0.34, 0.2);
  },
  jar(b, g, T, extra) {
    const y = plinth(b, g, T.tier, 0.8, 0.6);
    b.color(0x6a1e2e);
    let px = 0, py = y + 0.08, pz = 0;
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7, r = 0.13 - i * 0.012;
      const nx = Math.cos(a) * 0.1, nz = Math.sin(a) * 0.08, ny = y + 0.1 + i * 0.07;
      b.color(i % 2 ? 0x8a2e3a : 0x6a1e2e).tube([px, py, pz], [nx, ny, nz], Math.max(0.02, r), Math.max(0.015, r - 0.012), 6);
      b.color(0xf4d8cc).blob(0.02, 0.02, 0.012, nx * 1.2, ny, nz * 1.2 + 0.05, 4, 2);
      px = nx; py = ny; pz = nz;
    }
    b.color(0x9a7a4a).cyl(0.23, 0.23, y + 0.78, y + 0.86, 9, true);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.72, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xc8e0d0, transparent: true, opacity: 0.3, side: THREE.DoubleSide, emissive: 0x1a2a22 }));
    glass.position.y = y + 0.42;
    extra.push(glass);
  },
  hoard(b, g, T) {
    const y = plinth(b, g, T.tier, 1.6, 1.0);
    b.color(0x6a4428).box(1.0, 0.5, 0.62, 0, y + 0.25, 0);
    b.color(0x3a3a3a); for (const x of [-0.38, 0.38]) b.box(0.06, 0.52, 0.64, x, y + 0.26, 0);
    b.color(0x7a5230); b.push(0, y + 0.5, -0.3, -1.1, 0, 0); b.box(1.0, 0.1, 0.62, 0, 0, 0.31); b.pop();
    for (let i = 0; i < 26; i++) { const x = (Math.random() - 0.5) * 0.9, z = (Math.random() - 0.5) * 0.5; b.color(i % 3 ? 0xf2c14a : 0xd8a030).cyl(0.07, 0.07, y + 0.5 + Math.random() * 0.12, y + 0.53 + Math.random() * 0.12, 7, true, x, z); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; b.color(0xf2c14a).cyl(0.07, 0.07, y, y + 0.03, 7, true, Math.cos(a) * 0.72, 0.38 + Math.sin(a) * 0.06); }
    b.color(0xe8c050).cyl(0.14, 0.16, y + 0.62, y + 0.74, 8, false, 0.1, 0);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; b.cone(0.03, y + 0.74, y + 0.84, 4, 0.1 + Math.cos(a) * 0.14, Math.sin(a) * 0.14); }
    g.color(0x5af0a0).lump(0.04, 0.24, y + 0.68, 0, 0.2); g.color(0xff5a6a).lump(0.035, -0.2, y + 0.64, 0.1, 0.2);
  },
  fish(b, g, T, extra) {
    const sp = FISH_BY_ID[T.sp];
    const y = plinth(b, g, T.tier, 1.2, 0.6);
    b.color(PLINTH[T.tier].trim).cyl(0.025, 0.025, y, y + 0.28, 5, true);
    if (sp) {
      const len = 1.0;
      const m = fishMesh(sp, len);
      m.position.set(0, y + 0.28 + 0.12, 0);
      m.rotation.set(0, 0, 0.18);
      extra.push(m);
    }
    if (T.tier >= 3) { g.color(0xfff4b0); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.box(0.03, 0.03, 0.03, Math.cos(a) * 0.62, y + 0.4 + Math.sin(a) * 0.3, 0); } }
  },
  skull(b, g, T, extra) {
    const L = LEV_BY_ID[T.lev];
    const y = plinth(b, g, T.tier, 1.3, 1.1);
    extra.push(skullMini(L, y));
  },
  levstatue(b, g, T, extra) {
    const L = LEV_BY_ID[T.lev];
    const y = plinth(b, g, T.tier, 2.4, 0.9);
    b.color(0x3a3e44); for (let i = 0; i < 5; i++) b.lump(0.2 + (i % 2) * 0.1, -0.9 + i * 0.45, y + 0.1, 0, 0.3, 0.6);
    const bl = buildLeviathan(L);
    if (bl.mats) for (const m of bl.mats) if (m.userData.u) m.userData.u.uAmp.value = 0;
    bl.group.scale.setScalar(2.0 / L.size);
    bl.group.position.set(0, y + 0.35, 0);
    bl.group.rotation.set(0, 0, 0.08);
    extra.push(bl.group);
  },
  kraken(b, g, T, extra) {
    const y = plinth(b, g, T.tier, 2.2, 1.0);
    b.color(0x3a3e44); for (let i = 0; i < 4; i++) b.lump(0.28, -0.6 + i * 0.4, y + 0.12, (i % 2) * 0.1, 0.35, 0.6);
    const k = buildKrakenStatue();
    k.position.set(0, y + 0.15, 0);
    extra.push(k);
  },
  strongbox(b, g, T, extra) {
    const y = plinth(b, g, T.tier, 1, 0.7);
    const m = fishMesh(FISH_BY_ID.strongbox, 1); m.scale.setScalar(0.6); m.position.y = y + 0.2; extra.push(m);
    b.color(0xd8c8a0).box(0.5, 0.01, 0.35, 0.2, y + 0.005, 0.1);
  },
  beast(b, g, T, extra) {
    const D = BEAST_BY_ID[T.beast];
    const y = plinth(b, g, T.tier, 2.4, 1.0);
    b.color(0x2a3a44); for (let i = 0; i < 6; i++) b.lump(0.2, -1 + i * 0.4, y + 0.06, (i % 2) * 0.1 - 0.05, 0.3, 0.5);
    const m = buildBeast(D, true); m.animate(1.3, { spread: 1, reach: 1, vis: 1 });
    m.group.scale.setScalar(2); m.group.position.set(0, y + 0.2, 0);
    extra.push(m.group);
  },
  great(b, g, T, extra) {
    const D = GREAT_BY_ID[T.great];
    const y = plinth(b, g, T.tier, 2.4, 0.9);
    // a wave of dark stone for it to breach out of
    b.color(0x2a3a44); for (let i = 0; i < 7; i++) b.lump(0.18 + (i % 3) * 0.06, -1.0 + i * 0.33, y + 0.06, (i % 2) * 0.12 - 0.06, 0.3, 0.5);
    b.color(0xe8f0f4); for (let i = 0; i < 5; i++) b.lump(0.06, -0.8 + i * 0.4, y + 0.2, 0.12, 0.4, 0.6);
    const m = buildGreat(D, true);
    m.group.scale.setScalar(D.id === 'hushwing' ? 1.9 : 2.1);
    m.group.position.set(0, y + 0.3, 0);
    m.group.rotation.set(0, 0, D.id === 'hushwing' ? 0.15 : 0.12);
    if (m.pose) m.pose(0.4);
    extra.push(m.group);
  },
};

function skullMini(L, y) {
  const b = new MeshBuilder(rng(L.id.length * 5));
  const bone = 0xe8dcc0;
  const long = ['serpent', 'eel', 'pike', 'marlin', 'mother'].includes(L.kind);
  b.color(bone).blob(0.5, 0.4, long ? 0.8 : 0.55, 0, 0.45, 0, 7, 4, 0.12);
  b.color(shadeHex(bone, 0.9)).blob(0.4, 0.16, long ? 0.7 : 0.45, 0, 0.12, long ? 0.2 : 0.12, 6, 3, 0.1);
  b.color(0x2a2218); for (const s of [-1, 1]) b.blob(0.13, 0.12, 0.1, s * 0.28, 0.55, long ? 0.4 : 0.3, 5, 3);
  b.color(0xf4f0e0);
  for (let i = 0; i < (long ? 9 : 6); i++) for (const s of [-1, 1]) { b.push(s * (0.25 - i * 0.01), 0.22, (long ? 0.75 : 0.5) - i * 0.1, Math.PI, 0, 0); b.cone(0.035, 0, 0.14, 3); b.pop(); }
  if (L.kind === 'marlin') b.color(bone).tube([0, 0.45, 0.7], [0, 0.5, 1.9], 0.07, 0.01, 5);
  if (L.kind === 'kraken') { b.color(bone); for (let i = 0; i < 4; i++) b.tube([0, 0.2, 0], [Math.cos(i * 1.6) * 0.9, 0.05, Math.sin(i * 1.6) * 0.9], 0.08, 0.03, 5); }
  if (L.kind === 'turtle') b.color(0x6a7a3a).blob(0.9, 0.35, 0.9, 0, 0.35, -0.5, 8, 3, 0.1);
  const G = new THREE.Group();
  const m = new THREE.Mesh(b.build(), MAT.solid); m.castShadow = true; G.add(m);
  const gb = new MeshBuilder(rng(2));
  gb.color(L.colors.glow).lump(0.1, 0, 0.75, long ? 0.45 : 0.32, 0.3, 1.4);
  G.add(new THREE.Mesh(gb.build(), MAT.glow));
  G.position.y = y;
  return G;
}

export function buildTrophy(T, w, h) {
  const b = new MeshBuilder(rng(T.id.length * 13 + 7));
  const g = new MeshBuilder(rng(3));
  const extra = [];
  (MODELS[T.model] || MODELS.carving)(b, g, T, extra);
  return fitInto(grp(b, g, extra), w, h, T.size === 'L' ? 0.4 : 0.36);
}
