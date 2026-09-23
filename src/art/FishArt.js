/* FishArt.js - every fish is built from its body genome in FishData.

   Frame: length 1 along X, nose at +0.5, tail at -0.5, +Y up. Scale the mesh
   by the catch's real length. The body is a loft of 8-sided rings; each
   face takes back or belly colour by its height, then the pattern is laid
   on top as face colours (bars, spots, stripes, scales, lights). Fins are
   double-faced cards so they read from both sides.

   Returns { solid, glow } geometries - `glow` is drawn unlit (lights,
   lures, fuses) and may be null. */

import * as THREE from '../../lib/three.module.js?v=1790183165';
import { MeshBuilder, mixHex, shadeHex, hexToLinear } from './Geo.js?v=1790183165';
import { rng, TAU, clamp } from '../core/Util.js?v=1790183165';
import { MAT } from './Materials.js?v=1790183165';

const ST = [0, 0.07, 0.18, 0.32, 0.47, 0.62, 0.76, 0.88, 0.96, 1];
const PR = [0.2, 0.3, 0.55, 0.82, 0.98, 1.0, 0.9, 0.7, 0.42, 0.12];

export function buildFish(art, seed = 1) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const g = new MeshBuilder(r);
  const ex = new Set(art.extras || []);
  const H = art.h, W = art.w;
  const head = art.head || 1, snout = art.snout || 1;
  const eel = art.tail === 'eel';
  const sides = 8;
  const len = 1;
  const xs = ST.map((u, i) => {
    let x = -0.5 + u * len;
    if (i >= 7) x += (snout - 1) * 0.08 * (i - 6);
    return x;
  });
  const prof = PR.map((p, i) => {
    let v = p;
    if (eel) v = i === 0 ? 0.35 : i === 9 ? 0.25 : 0.75 + 0.25 * Math.sin(i / 9 * Math.PI);
    if (i >= 6) v *= 1 + (head - 1) * (i - 5) / 4;
    return v;
  });
  if (art.tail === 'none') { prof[0] = 0.75; prof[1] = 0.85; }
  // rings
  const rings = xs.map((x, i) => {
    const out = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * TAU + Math.PI / sides;
      const cy = Math.sin(a), cz = Math.cos(a);
      // slightly flatter belly, a bit of hump on the back
      const yy = cy > 0 ? cy * 1.05 : cy * 0.9;
      out.push([x, yy * H / 2 * prof[i], cz * W / 2 * prof[i]]);
    }
    return out;
  });
  const back = art.back, belly = art.belly;
  const patCol = art.patCol;
  for (let i = 0; i < rings.length - 1; i++) {
    const u = (ST[i] + ST[i + 1]) / 2;
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      const a = rings[i][k], bb = rings[i][k1], c = rings[i + 1][k1], d = rings[i + 1][k];
      const my = (a[1] + bb[1] + c[1] + d[1]) / 4;
      const ny = my / (H / 2 * Math.max(0.1, prof[i]));
      let col = mixHex(belly, back, clamp(ny * 0.8 + 0.5, 0, 1));
      // patterns
      const pat = art.pat;
      if (pat === 'bars' && ny > -0.2 && Math.floor(u * 9) % 2 === 1 && u > 0.12 && u < 0.85) col = mixHex(col, patCol, 0.75);
      if (pat === 'spots' && ny > -0.4 && r() < 0.28) col = mixHex(col, patCol, 0.7);
      if (pat === 'scales') col = shadeHex(col, (i + k) % 2 ? 1.1 : 0.9);
      if (pat === 'waves' && ny > 0.1 && (Math.floor(u * 14 + k) % 3 === 0)) col = mixHex(col, patCol, 0.8);
      if (pat === 'mask' && u > 0.72 && u < 0.9 && ny > -0.3) col = patCol;
      if (pat === 'patches' && r() < 0.4) col = mixHex(col, patCol, 0.9);
      if (art.stripe && Math.abs(ny) < 0.3 && u > 0.1 && u < 0.9) col = mixHex(col, art.stripe, 0.7);
      if (art.beak && u > 0.88) col = mixHex(0xf0f0e0, col, 0.3);
      if (ex.has('scar') && i === 4 && k === 1) col = 0xe8d8c8;
      if (ex.has('frost') && ny > 0.6) col = mixHex(col, 0xffffff, 0.5);
      b.color(shadeHex(col, 0.95 + r() * 0.1));
      b.quad(a, bb, c, d, null, [(a[0] + c[0]) / 2, 0, 0]);
      if (pat === 'lights' && r() < 0.18 && ny < 0.4) {
        g.color(patCol).box(0.012, 0.012, 0.004, (a[0] + c[0]) / 2, my * 0.98, (a[2] + c[2]) / 2 * 1.02);
      }
    }
  }
  // close the nose and the tail end
  const nose = [xs[9] + 0.02, 0, 0];
  const tailEnd = [xs[0] - 0.01, 0, 0];
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    b.color(mixHex(belly, back, rings[9][k][1] > 0 ? 0.85 : 0.2));
    if (art.beak) b.color(0xf0eee0);
    b.triO(rings[9][k], rings[9][k1], nose, [1, 0, 0]);
    b.color(back);
    b.triO(rings[0][k], rings[0][k1], tailEnd, [-1, 0, 0]);
  }
  const noseX = xs[9];
  const hH = H / 2 * prof[7], hW = W / 2 * prof[7];
  // mouth
  const mouth = art.mouth || 1;
  b.color(0x3a1a1a);
  b.push(noseX - 0.02 * mouth, -hH * 0.25, 0);
  b.box(0.05 * mouth, 0.012 * mouth + 0.01, W * 0.5 * prof[8] + 0.01, 0, 0, 0);
  b.pop();
  if (ex.has('teeth')) {
    b.color(0xf4f0e0);
    for (let t = 0; t < 5; t++) for (const sz of [-1, 1]) {
      const x = noseX - 0.01 - t * 0.022 * mouth, z = sz * (W * 0.22 * prof[8] + t * 0.004);
      b.push(x, -hH * 0.2, z, Math.PI, 0, 0); b.cone(0.006 * mouth, 0, 0.025 * mouth, 3); b.pop();
    }
  }
  // eyes
  const ex0 = xs[7] + (xs[8] - xs[7]) * 0.3;
  for (const sz of [-1, 1]) {
    const ey = hH * 0.28, ez = sz * hW * 0.92;
    b.color(0xf8f8f0).blob(0.022 * head, 0.024 * head, 0.012, ex0, ey, ez, 6, 3);
    b.color(0x111111).blob(0.012 * head, 0.013 * head, 0.008, ex0 + 0.003, ey, ez + sz * 0.008, 5, 3);
    if (ex.has('ghost')) g.color(0xbff0ff).blob(0.01, 0.01, 0.006, ex0 + 0.004, ey, ez + sz * 0.012, 4, 2);
  }
  // tail fin
  const fin = art.fin;
  const tx = xs[0], th = H / 2 * prof[0];
  b.color(fin);
  if (art.tail === 'fork') {
    b.card([tx + 0.02, th * 0.4, 0], [tx - 0.17, H * 0.42, 0], [tx - 0.1, 0, 0]);
    b.card([tx + 0.02, -th * 0.4, 0], [tx - 0.1, 0, 0], [tx - 0.17, -H * 0.38, 0]);
  } else if (art.tail === 'lunate') {
    b.card([tx + 0.02, th * 0.3, 0], [tx - 0.14, H * 0.55, 0], [tx - 0.07, 0, 0]);
    b.card([tx + 0.02, -th * 0.3, 0], [tx - 0.07, 0, 0], [tx - 0.14, -H * 0.5, 0]);
  } else if (art.tail === 'shark') {
    b.card([tx + 0.03, th * 0.5, 0], [tx - 0.2, H * 0.62, 0], [tx - 0.05, 0, 0]);
    b.card([tx + 0.03, -th * 0.4, 0], [tx - 0.05, 0, 0], [tx - 0.1, -H * 0.3, 0]);
  } else if (art.tail === 'round' || art.tail === 'veil') {
    const L = art.tail === 'veil' ? 0.3 : 0.14, S = art.tail === 'veil' ? 0.5 : 0.36;
    for (let k = 0; k < 5; k++) {
      const a0 = -0.9 + k * 0.36, a1 = a0 + 0.36;
      b.card([tx + 0.01, 0, 0], [tx - Math.cos(a0) * L, Math.sin(a0) * H * S * 2, 0], [tx - Math.cos(a1) * L, Math.sin(a1) * H * S * 2, 0]);
    }
  } else if (art.tail === 'eel') {
    b.card([tx + 0.25, H * 0.2, 0], [tx - 0.04, 0, 0], [tx + 0.25, -H * 0.18, 0]);
  } else if (art.tail === 'flukes') {
    // whale: horizontal flukes
    b.card([tx + 0.03, 0, 0], [tx - 0.12, 0.02, W * 1.6], [tx - 0.04, 0, 0]);
    b.card([tx + 0.03, 0, 0], [tx - 0.04, 0, 0], [tx - 0.12, 0.02, -W * 1.6]);
    b.card([tx - 0.04, 0, 0], [tx - 0.12, 0.02, W * 1.6], [tx - 0.15, 0.01, W * 0.3]);
    b.card([tx - 0.04, 0, 0], [tx - 0.15, 0.01, -W * 0.3], [tx - 0.12, 0.02, -W * 1.6]);
  } else if (art.tail === 'none') {
    b.card([tx + 0.02, H * 0.38, 0], [tx - 0.04, 0, 0], [tx + 0.02, -H * 0.38, 0]);
  }
  // dorsal + anal + pectoral
  const topAt = i => H / 2 * prof[i];
  if (!eel) {
    const dH = ex.has('sail') ? H * 0.9 : ex.has('dorsal') ? H * 0.55 : ex.has('sunfin') ? H * 0.7 : H * 0.28;
    const d0 = ex.has('sail') ? 2 : ex.has('dorsal') ? 4 : ex.has('sunfin') ? 1 : 3;
    const d1 = ex.has('sail') ? 7 : ex.has('dorsal') ? 5 : ex.has('sunfin') ? 2 : 6;
    b.color(fin);
    b.card([xs[d0], topAt(d0) * 0.95, 0], [xs[d1], topAt(d1) * 0.95, 0], [(xs[d0] + xs[d1]) / 2 - (ex.has('dorsal') ? 0.05 : 0), topAt(Math.round((d0 + d1) / 2)) + dH, 0]);
    // anal
    const aH = ex.has('sunfin') ? H * 0.7 : H * 0.14;
    b.card([xs[ex.has('sunfin') ? 1 : 2], -topAt(2) * 0.85, 0], [xs[ex.has('sunfin') ? 2 : 3], -topAt(3) * 0.85, 0], [xs[2] - 0.02, -topAt(2) - aH, 0]);
  } else {
    // eel: a long low ridge
    b.color(fin);
    for (let i = 1; i < 8; i++) b.card([xs[i], topAt(i) * 0.95, 0], [xs[i + 1], topAt(i + 1) * 0.95, 0], [xs[i] + 0.02, topAt(i) + H * 0.25, 0]);
  }
  if (ex.has('crest')) {
    g.color(0xe03a3a);
    for (let i = 3; i < 9; i++) g.card([xs[i], topAt(i), 0], [xs[i] + 0.04, topAt(i), 0], [xs[i] + 0.02, topAt(i) + H * 1.4, 0]);
  }
  b.color(shadeHex(fin, 1.1));
  for (const sz of [-1, 1]) {
    const px = xs[6], py = -H * 0.1, pz = sz * W / 2 * prof[6] * 0.9;
    const lobe = ex.has('lobefins') ? 1.8 : 1;
    b.card([px, py, pz], [px - 0.1 * lobe, py - H * 0.2 * lobe, pz + sz * W * 0.4], [px - 0.02, py + H * 0.05, pz]);
  }
  if (ex.has('finlets')) {
    b.color(0xe8d040);
    for (let i = 0; i < 4; i++) { const x = xs[1] + i * 0.035; b.card([x, topAt(1) * 1.4, 0], [x + 0.02, topAt(1) * 1.4, 0], [x, topAt(1) * 1.4 + 0.03, 0]); }
  }
  // whiskers and barbel
  if (ex.has('whiskers')) {
    b.color(shadeHex(back, 0.7));
    for (const sz of [-1, 1]) {
      b.beam([noseX - 0.02, -hH * 0.1, sz * hW * 0.6], [noseX - 0.08, -hH * 0.6, sz * (hW + 0.18)], 0.006, 0.006);
      b.beam([noseX - 0.03, -hH * 0.3, sz * hW * 0.5], [noseX - 0.12, -hH * 1.4, sz * (hW + 0.06)], 0.005, 0.005);
    }
  }
  if (ex.has('barbel')) b.color(shadeHex(back, 0.8)).beam([noseX - 0.05, -hH * 0.7, 0], [noseX - 0.06, -hH * 1.3, 0], 0.006, 0.006);
  if (ex.has('sword')) b.color(shadeHex(back, 0.85)).tube([noseX, hH * 0.05, 0], [noseX + 0.42, hH * 0.1, 0], 0.012, 0.002, 5);
  if (ex.has('lure')) {
    b.color(shadeHex(back, 0.8));
    b.beam([xs[8], hH * 0.9, 0], [xs[8] + 0.07, hH * 1.9, 0], 0.008, 0.008);
    b.beam([xs[8] + 0.07, hH * 1.9, 0], [noseX + 0.08, hH * 1.7, 0], 0.008, 0.008);
    g.color(0xb8ffe0).blob(0.028, 0.028, 0.028, noseX + 0.08, hH * 1.55, 0, 6, 3);
  }
  if (ex.has('fuse')) {
    b.color(0x1a1a1a).tube([xs[5], topAt(5) * 0.95, 0], [xs[5] - 0.02, topAt(5) + 0.12, 0.02], 0.012, 0.01, 5);
    g.color(0xffd24a).blob(0.022, 0.022, 0.022, xs[5] - 0.02, topAt(5) + 0.14, 0.02, 5, 3);
    b.color(0xd8d8d8).box(0.08, 0.02, W * 0.02 + 0.004, xs[4], topAt(4) * 0.55, W / 2 * prof[4] * 0.98);
  }
  if (ex.has('spikes')) {
    b.color(shadeHex(back, 0.8));
    for (let i = 2; i < 8; i++) for (let k = 0; k < sides; k += 2) {
      const p = rings[i][k];
      const n = [0, p[1], p[2]]; const l = Math.hypot(n[1], n[2]) || 1;
      b.tube(p, [p[0], p[1] + n[1] / l * 0.05, p[2] + n[2] / l * 0.05], 0.008, 0.001, 3);
    }
  }
  if (ex.has('chest')) {
    // a wooden lid of a back, with iron bands: the mimic's disguise shows through
    b.color(0x6a4226).box(0.62, H * 0.12, W * 0.9, 0, topAt(5) * 0.95, 0);
    b.color(0x3a3a3a);
    for (const x of [-0.18, 0.18]) b.box(0.03, H * 0.13, W * 0.92, x, topAt(5) * 0.96, 0);
    b.color(0xd8b048).box(0.05, 0.05, 0.02, 0.22, topAt(5) * 0.6, W / 2 * 0.95);
  }
  if (ex.has('metal')) {
    b.color(0x9aa4ac);
    for (let i = 0; i < 8; i++) { const p = rings[2 + (i % 6)][(i * 3) % sides]; b.box(0.03, 0.006, 0.012, p[0], p[1], p[2]); }
  }
  if (ex.has('star')) {
    g.color(0xfff0a0);
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.card([xs[5], topAt(5) + 0.02, 0], [xs[5] + Math.cos(a) * 0.05, topAt(5) + 0.02 + Math.sin(a) * 0.05 + 0.05, 0.01], [xs[5] + Math.cos(a + 0.4) * 0.02, topAt(5) + 0.02 + Math.sin(a + 0.4) * 0.02 + 0.05, 0]); }
  }
  if (ex.has('glowtail')) g.color(0xff5a8a).blob(0.03, 0.03, 0.03, xs[0] - 0.02, 0, 0, 5, 3);
  if (ex.has('glow')) g.color(art.patCol || 0xa0f0ff).box(0.02, 0.02, W * 0.95, xs[6], hH * 0.1, 0);
  return { solid: b.build(), glow: g.tris ? g.build() : null };
}

/* ---------------- junk (also length 1 along X) ---------------- */
export function buildJunk(kind) {
  const b = new MeshBuilder(rng(kind.length));
  const g = new MeshBuilder();
  if (kind === 'boot') {
    b.color(0x4a3222).box(0.35, 0.8, 0.32, -0.25, 0.2, 0);
    b.color(0x4a3222).box(0.8, 0.3, 0.34, 0.05, -0.2, 0);
    b.color(0x2a1a12).box(0.85, 0.08, 0.36, 0.05, -0.37, 0);
    b.color(0x6a8a3a).box(0.2, 0.05, 0.2, -0.3, 0.62, 0.1);
  } else if (kind === 'can') {
    b.color(0x8a6a4a).cyl(0.35, 0.35, -0.5, 0.5, 8, true);
    b.color(0xa83a2a).cyl(0.36, 0.36, -0.2, 0.25, 8, false);
    b.color(0x6a4a3a).cyl(0.37, 0.37, 0.45, 0.5, 8, false);
  } else if (kind === 'duck') {
    b.color(0xf2d02a).blob(0.45, 0.32, 0.35, -0.05, -0.1, 0, 8, 4);
    b.color(0xf2d02a).blob(0.26, 0.26, 0.24, 0.25, 0.32, 0, 8, 4);
    b.color(0xf08a2a).blob(0.14, 0.05, 0.12, 0.52, 0.28, 0, 6, 3);
    b.color(0x111111); for (const s of [-1, 1]) b.blob(0.04, 0.04, 0.02, 0.4, 0.4, s * 0.17, 5, 3);
  } else if (kind === 'bottle') {
    b.color(0x6aa87a).lathe([[0.18, -0.5], [0.2, -0.3], [0.2, 0.15], [0.08, 0.3], [0.07, 0.48]], 7);
    b.color(0x8a6a44).cyl(0.07, 0.07, 0.46, 0.55, 6, true);
    b.color(0xf0e6c8).box(0.08, 0.5, 0.08, 0, -0.1, 0);
    // turn to lie along X
    rotateBuilderZ(b, -Math.PI / 2);
  } else if (kind === 'chest') {
    b.color(0x7a4a2a).box(1, 0.5, 0.62, 0, -0.1, 0);
    b.color(0x8a5a32).box(1.02, 0.28, 0.64, 0, 0.3, 0);
    b.color(0x3a3a3a);
    for (const x of [-0.3, 0.3]) { b.box(0.06, 0.52, 0.66, x, -0.1, 0); b.box(0.06, 0.3, 0.68, x, 0.3, 0); }
    b.color(0xd8b048).box(0.12, 0.14, 0.04, 0, 0.12, 0.34);
  }
  return { solid: b.build(), glow: g.tris ? g.build() : null };
}

function rotateBuilderZ(b, a) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < b.P.length; i += 3) {
    const x = b.P[i], y = b.P[i + 1];
    b.P[i] = x * c - y * s; b.P[i + 1] = x * s + y * c;
  }
}

/* ---------------- a ready-to-add mesh for a species ---------------- */
const cache = new Map();
export function fishGeos(species) {
  if (cache.has(species.id)) return cache.get(species.id);
  const out = species.junk ? buildJunk(species.junk) : buildFish(species.art, species.id.length * 31 + species.id.charCodeAt(0));
  cache.set(species.id, out);
  return out;
}

/** A Group holding a species model, scaled to `lengthM` metres. */
export function fishMesh(species, lengthM, opts = {}) {
  const geos = fishGeos(species);
  const grp = new THREE.Group();
  const ghost = (species.art?.extras || []).includes('ghost');
  const m = new THREE.Mesh(geos.solid, ghost ? MAT.ghost : MAT.solid);
  m.castShadow = !ghost; m.receiveShadow = true;
  grp.add(m);
  if (geos.glow) { const gm = new THREE.Mesh(geos.glow, MAT.glow); grp.add(gm); }
  const junkScale = species.junk ? (species.junk === 'chest' ? 0.75 : species.junk === 'duck' ? 0.12 : 0.3) : 1;
  const s = species.junk ? junkScale / 1 : lengthM;
  grp.scale.setScalar(opts.forceScale || s);
  grp.userData.species = species.id;
  return grp;
}
