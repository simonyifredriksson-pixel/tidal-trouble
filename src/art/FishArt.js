/* FishArt.js - every fish is built from its body genome in FishData.

   Frame: length 1 along X, nose at +0.5, tail at -0.5, +Y up. Scale the mesh
   by the catch's real length. The body is a loft of 8-sided rings; each
   face takes back or belly colour by its height, then the pattern is laid
   on top as face colours (bars, spots, stripes, scales, lights). Fins are
   double-faced cards so they read from both sides.

   Returns { solid, glow } geometries - `glow` is drawn unlit (lights,
   lures, fuses) and may be null.

   The genome, beyond colours:
     shape   spindle (default) torpedo arrow tadpole disc box hump
     tail    fork lunate shark round veil eel flukes none lyre split fan
             whip pointed
     pat     bars spots scales waves mask patches lights rings stripes dots
             checker saddle head fade tiger speckle
     extras  see the long list at the bottom of buildFish
     kind    not a fish at all: squid cuttle octopus crab lobster shrimp
             jelly seahorse ray urchin nautilus turtle star - each has its
             own builder, in the same frame (length 1 along X, head at +X) */

import * as THREE from '../../lib/three.module.js';
import { MeshBuilder, mixHex, shadeHex, hexToLinear } from './Geo.js';
import { rng, TAU, clamp } from '../core/Util.js';
import { MAT } from './Materials.js';

const ST = [0, 0.07, 0.18, 0.32, 0.47, 0.62, 0.76, 0.88, 0.96, 1];
const PR = [0.2, 0.3, 0.55, 0.82, 0.98, 1.0, 0.9, 0.7, 0.42, 0.12];
const SHAPES = {
  torpedo: [0.25, 0.45, 0.72, 0.9, 1, 1, 0.95, 0.82, 0.55, 0.18],
  arrow:   [0.2, 0.35, 0.6, 0.85, 1, 0.95, 0.8, 0.55, 0.3, 0.08],
  tadpole: [0.12, 0.18, 0.3, 0.45, 0.62, 0.8, 0.95, 1, 0.9, 0.45],
  disc:    [0.25, 0.45, 0.75, 0.95, 1, 1, 0.95, 0.8, 0.55, 0.2],
  box:     [0.35, 0.6, 0.9, 1, 1, 1, 1, 0.95, 0.75, 0.35],
};

/** Creatures that sit the right way up when landed instead of flopping onto their side. */
const UPRIGHT = new Set(['crab', 'lobster', 'jelly', 'seahorse', 'ray', 'urchin', 'nautilus', 'turtle', 'star', 'octopus']);
export const isUpright = sp => !!(sp && sp.art && UPRIGHT.has(sp.art.kind));

export function buildFish(art, seed = 1) {
  const r = rng(seed);
  if (art.kind && KINDS[art.kind]) return KINDS[art.kind](art, r);
  const b = new MeshBuilder(r);
  const g = new MeshBuilder(r);
  const ex = new Set(art.extras || []);
  const H = art.h, W = art.w;
  const shape = art.shape || 'spindle';
  const head = art.head || 1, snout = art.snout || (shape === 'arrow' ? 1.8 : 1);
  const eel = art.tail === 'eel';
  const sides = art.sides || (shape === 'box' ? 4 : 8);
  const len = 1;
  const xs = ST.map((u, i) => {
    let x = -0.5 + u * len;
    if (i >= 7) x += (snout - 1) * 0.08 * (i - 6);
    return x;
  });
  const base = SHAPES[shape] || PR;
  const prof = base.map((p, i) => {
    let v = p;
    if (eel) v = i === 0 ? 0.35 : i === 9 ? 0.25 : 0.75 + 0.25 * Math.sin(i / 9 * Math.PI);
    if (i >= 6) v *= 1 + (head - 1) * (i - 5) / 4;
    return v;
  });
  if (art.tail === 'none') { prof[0] = 0.75; prof[1] = 0.85; }
  const hump = shape === 'hump' ? (art.hump || 0.45) : 0;
  const bumpAt = i => (i === 7 ? 1 : i === 6 || i === 8 ? 0.6 : i === 5 ? 0.25 : 0);
  // rings
  const rings = xs.map((x, i) => {
    const out = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * TAU + Math.PI / sides;
      const cy = Math.sin(a), cz = Math.cos(a);
      // slightly flatter belly, a bit of hump on the back
      let yy = cy > 0 ? cy * 1.05 : cy * 0.9;
      if (yy > 0 && hump) yy *= 1 + hump * bumpAt(i);
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
      if (pat === 'rings' && Math.floor(u * 10) % 2 === 1 && u > 0.1 && u < 0.86) col = mixHex(col, patCol, 0.85);
      if (pat === 'stripes' && k % 2 === 0 && Math.abs(ny) < 0.95 && u > 0.08) col = mixHex(col, patCol, 0.75);
      if (pat === 'dots' && (i + k) % 3 === 0 && ny > -0.35) col = mixHex(col, patCol, 0.85);
      if (pat === 'checker' && (i + k) % 2 === 0) col = mixHex(col, patCol, 0.7);
      if (pat === 'saddle' && ny > 0.25 && Math.floor(u * 6) % 2 === 0 && u > 0.1) col = mixHex(col, patCol, 0.85);
      if (pat === 'head' && u > 0.72) col = mixHex(col, patCol, 0.9);
      if (pat === 'fade' && u < 0.4) col = mixHex(col, patCol, (0.4 - u) / 0.4);
      if (pat === 'tiger' && ny > -0.15 && Math.sin(u * 23 + k * 0.9) > 0.35 && u > 0.08) col = mixHex(col, patCol, 0.75);
      if (pat === 'speckle' && r() < 0.5) col = mixHex(col, patCol, 0.3 + r() * 0.3);
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
  const eyeK = ex.has('bigeye') ? 2.1 : 1;
  for (const sz of [-1, 1]) {
    if (ex.has('hammer')) break;             // a hammerhead's eyes are out on the ends of the hammer
    const ey = hH * 0.28, ez = sz * hW * 0.92;
    b.color(art.eyeCol || 0xf8f8f0).blob(0.022 * head * eyeK, 0.024 * head * eyeK, 0.012 * eyeK, ex0, ey, ez, 6, 3);
    b.color(0x111111).blob(0.012 * head * eyeK, 0.013 * head * eyeK, 0.008 * eyeK, ex0 + 0.003, ey, ez + sz * 0.008 * eyeK, 5, 3);
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
  } else if (art.tail === 'lyre') {
    // a fork whose tips run out into long streamers
    b.card([tx + 0.02, th * 0.4, 0], [tx - 0.14, H * 0.4, 0], [tx - 0.08, 0, 0]);
    b.card([tx + 0.02, -th * 0.4, 0], [tx - 0.08, 0, 0], [tx - 0.14, -H * 0.4, 0]);
    b.card([tx - 0.12, H * 0.36, 0], [tx - 0.42, H * 0.62, 0], [tx - 0.13, H * 0.32, 0]);
    b.card([tx - 0.12, -H * 0.36, 0], [tx - 0.13, -H * 0.32, 0], [tx - 0.42, -H * 0.62, 0]);
  } else if (art.tail === 'split') {
    b.card([tx + 0.02, th * 0.3, 0], [tx - 0.3, H * 0.75, 0], [tx - 0.04, 0, 0]);
    b.card([tx + 0.02, -th * 0.3, 0], [tx - 0.04, 0, 0], [tx - 0.3, -H * 0.72, 0]);
  } else if (art.tail === 'fan') {
    for (let k = 0; k < 9; k++) {
      const a0 = -1.25 + k * 0.28, a1 = a0 + 0.28;
      b.color(k % 2 ? fin : shadeHex(fin, 0.8)).card([tx + 0.01, 0, 0], [tx - Math.cos(a0) * 0.22, Math.sin(a0) * H * 1.3, 0], [tx - Math.cos(a1) * 0.22, Math.sin(a1) * H * 1.3, 0]);
    }
    b.color(fin);
  } else if (art.tail === 'whip') {
    b.tube([tx + 0.02, 0, 0], [tx - 0.55, H * 0.05, 0], th * 0.9 + 0.004, 0.002, 5);
  } else if (art.tail === 'pointed') {
    b.push(tx + 0.01, 0, 0, 0, 0, Math.PI / 2); b.cone(th * 1.1 + 0.005, 0, 0.16, 5); b.pop();
    b.card([tx, th, 0], [tx - 0.1, 0, 0], [tx, -th, 0]);
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

  /* ---------------- heads ---------------- */
  const dark = shadeHex(back, 0.7), fcol = art.fin;
  if (ex.has('horn')) b.color(art.hornCol || shadeHex(back, 0.8)).tube([xs[8], hH * 0.75, 0], [noseX + 0.16, hH * 1.9, 0], 0.022, 0.003, 5);
  if (ex.has('hammer')) {
    const span = W * 1.7 + 0.08;
    b.color(back).box(0.07, hH * 0.55, span * 2, noseX - 0.04, hH * 0.15, 0);
    b.color(shadeHex(back, 1.1)).box(0.04, hH * 0.3, span * 2 + 0.01, noseX - 0.01, hH * 0.35, 0);
    for (const sz of [-1, 1]) { b.color(0xf0f0e0).blob(0.02, 0.02, 0.014, noseX - 0.04, hH * 0.2, sz * span, 5, 3); b.color(0x111111).blob(0.011, 0.012, 0.01, noseX - 0.035, hH * 0.2, sz * (span + 0.008), 4, 2); }
  }
  if (ex.has('saw')) {
    b.color(shadeHex(back, 0.9)).box(0.42, 0.014, 0.05, noseX + 0.2, 0, 0);
    b.color(0xf0ece0);
    for (let k = 0; k < 9; k++) for (const sz of [-1, 1]) { b.push(noseX + 0.03 + k * 0.042, 0, sz * 0.025, 0, 0, sz * -Math.PI / 2); b.push(0, 0, 0, Math.PI / 2 * sz, 0, 0); b.cone(0.006, 0, 0.03, 3); b.pop(); b.pop(); }
  }
  if (ex.has('tube')) { b.color(shadeHex(back, 0.95)).tube([noseX - 0.02, -hH * 0.05, 0], [noseX + 0.26, -hH * 0.02, 0], hH * 0.28 + 0.006, hH * 0.18 + 0.004, 6); b.color(0x2a1a1a).blob(0.012, 0.012, 0.012, noseX + 0.26, -hH * 0.02, 0, 5, 3); }
  if (ex.has('lips')) b.color(art.lipCol || 0xd87a6a).blob(0.035 * mouth, 0.03 * mouth, W * 0.35 * prof[8] + 0.012, noseX + 0.005, -hH * 0.22, 0, 6, 3);
  if (ex.has('fangs')) { b.color(0xf8f4e8); for (const sz of [-1, 1]) { b.push(noseX - 0.02, -hH * 0.1, sz * hW * 0.35, Math.PI, 0, 0); b.cone(0.012 * mouth, 0, 0.09 * mouth, 4); b.pop(); } }
  if (ex.has('jaw')) {
    b.color(shadeHex(belly, 0.85)).box(0.12 * mouth, hH * 0.35, W * 0.55 * prof[8] + 0.01, noseX + 0.03, -hH * 0.45, 0);
    b.color(0xf4f0e0); for (let t = 0; t < 4; t++) for (const sz of [-1, 1]) b.cone(0.006, -hH * 0.28, -hH * 0.28 + 0.03, 3, noseX + 0.07 - t * 0.025, sz * W * 0.2 * prof[8]);
  }
  if (ex.has('tusks')) { b.color(0xf0e8d0); for (const sz of [-1, 1]) b.tube([noseX - 0.03, -hH * 0.25, sz * hW * 0.5], [noseX + 0.1, -hH * 0.05, sz * hW * 0.7], 0.012, 0.002, 4); }
  if (ex.has('bulb')) b.color(art.bulbCol || shadeHex(back, 1.1)).blob(0.07 * head, hH * 0.55 + 0.01, hW * 0.9, xs[8] - 0.01, hH * 0.95, 0, 7, 4);
  if (ex.has('antennae')) { b.color(dark); for (const sz of [-1, 1]) { b.beam([xs[8], hH * 0.8, sz * hW * 0.4], [xs[8] + 0.12, hH * 3.2, sz * (hW + 0.1)], 0.005, 0.005); b.beam([xs[8] + 0.12, hH * 3.2, sz * (hW + 0.1)], [xs[6], hH * 4.2, sz * (hW + 0.22)], 0.004, 0.004); } }
  if (ex.has('beard')) { b.color(art.beardCol || shadeHex(belly, 0.8)); for (let k = 0; k < 7; k++) { const z = (k / 6 - 0.5) * hW * 1.4; b.beam([noseX - 0.04, -hH * 0.7, z], [noseX - 0.06 - (k % 3) * 0.02, -hH * 1.5 - (k % 2) * hH * 0.4, z * 1.2], 0.005, 0.005); } }
  if (ex.has('eyestalks')) { for (const sz of [-1, 1]) { b.color(dark).tube([xs[8], hH * 0.6, sz * hW * 0.4], [xs[8] + 0.02, hH * 1.8, sz * hW * 0.7], 0.008, 0.006, 4); b.color(0x111111).blob(0.018, 0.018, 0.018, xs[8] + 0.02, hH * 1.85, sz * hW * 0.7, 5, 3); } }
  if (ex.has('crown')) { b.color(art.crownCol || 0xe0a040); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; b.push(xs[8] - 0.02 + Math.cos(a) * 0.03, hH * 0.9, Math.sin(a) * hW * 0.6, 0, 0, Math.cos(a) * -0.4); b.cone(0.012, 0, 0.08 + (k % 2) * 0.04, 4); b.pop(); } }

  /* ---------------- fins ---------------- */
  if (ex.has('wings')) {
    for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) {
      const x0 = xs[6], z0 = sz * W / 2 * prof[6];
      const a0 = 0.15 + k * 0.28, a1 = a0 + 0.28;
      b.color(k % 2 ? fcol : shadeHex(fcol, 1.15)).card([x0, 0, z0], [x0 - Math.cos(a0) * 0.5, 0.02, z0 + sz * Math.sin(a0) * 0.5], [x0 - Math.cos(a1) * 0.5, 0.02, z0 + sz * Math.sin(a1) * 0.5]);
    }
  }
  if (ex.has('longfins')) {
    b.color(shadeHex(fcol, 1.1));
    for (const sz of [-1, 1]) {
      b.card([xs[6], -H * 0.1, sz * W / 2 * prof[6]], [xs[1] - 0.05, -H * 0.4, sz * (W * 0.6 + 0.08)], [xs[5], -H * 0.05, sz * W / 2 * prof[5]]);
      b.beam([xs[5], -topAt(5) * 0.9, sz * W * 0.2], [xs[0] - 0.1, -H * 1.0, sz * W * 0.4], 0.004, 0.004);
    }
  }
  if (ex.has('spinefins')) {
    for (let k = 0; k < 9; k++) {
      const x = xs[2] + k * 0.07, y = topAt(Math.min(9, 2 + Math.round(k * 0.8)));
      b.color(k % 2 ? fcol : 0xf4ece0).beam([x, y * 0.9, 0], [x - 0.04, y + H * 0.9, 0], 0.006, 0.003);
    }
    for (const sz of [-1, 1]) for (let k = 0; k < 6; k++) {
      const a0 = -0.9 + k * 0.32, a1 = a0 + 0.32, x0 = xs[6], z0 = sz * W / 2 * prof[6];
      b.color(k % 2 ? fcol : 0xf4ece0).card([x0, 0, z0], [x0 - Math.cos(a0) * 0.3, Math.sin(a0) * 0.3, z0 + sz * 0.12], [x0 - Math.cos(a1) * 0.3, Math.sin(a1) * 0.3, z0 + sz * 0.12]);
    }
  }
  if (ex.has('streamer')) b.color(fcol).beam([xs[6], topAt(6) * 1.2, 0], [xs[0] - 0.15, topAt(0) + H * 1.2, 0], 0.005, 0.003);
  if (ex.has('spikeback')) { b.color(art.spikeCol || dark); for (let i = 2; i < 9; i++) b.cone(0.012 + H * 0.05, topAt(i) * 0.9, topAt(i) + H * 0.55, 4, xs[i], 0); }
  if (ex.has('plates')) {
    b.color(art.plateCol || shadeHex(back, 1.25));
    for (let i = 1; i < 9; i++) {
      b.push(xs[i], topAt(i) * 0.95, 0, 0, 0.785, 0); b.box(0.035, 0.03, 0.035, 0, 0, 0); b.pop();
      for (const sz of [-1, 1]) { b.push(xs[i], 0, sz * W / 2 * prof[i] * 0.98, 0, 0.785, 0); b.box(0.03, 0.025, 0.03, 0, 0, 0); b.pop(); }
    }
  }
  if (ex.has('leaf')) {
    for (let k = 0; k < 8; k++) {
      const i = 1 + k, x = xs[Math.min(9, i)], s = k % 2 ? 1 : -1, y = topAt(Math.min(9, i));
      b.color(k % 3 ? fcol : shadeHex(fcol, 1.2)).card([x, y * 0.6, 0], [x - 0.05, y + H * 0.7, s * W * 0.6], [x + 0.04, y + H * 0.5, s * W * 0.3]);
      b.card([x, -y * 0.6, 0], [x - 0.04, -y - H * 0.6, -s * W * 0.5], [x + 0.03, -y - H * 0.4, -s * W * 0.2]);
    }
  }
  if (ex.has('warts')) { b.color(art.wartCol || shadeHex(back, 0.8)); for (let n = 0; n < 16; n++) { const i = 2 + Math.floor(r() * 6), k = Math.floor(r() * sides); const p = rings[i][k]; if (p[1] > -H * 0.1) b.lump(0.012 + r() * 0.01, p[0], p[1], p[2], 0.4, 0.8); } }
  if (ex.has('eyespot')) for (const sz of [-1, 1]) { const z = sz * W / 2 * prof[2] * 1.02; b.color(0xf8f0d0).blob(0.04, H * 0.2, 0.006, xs[2], 0, z, 7, 2); b.color(0x14100c).blob(0.026, H * 0.13, 0.008, xs[2], 0, z * 1.01, 6, 2); }
  if (ex.has('glowline')) { g.color(art.patCol || 0x9af0ff); for (let i = 1; i < 9; i++) for (const sz of [-1, 1]) g.box(0.04, 0.008, 0.004, (xs[i] + xs[i + 1]) / 2, 0, sz * W / 2 * prof[i] * 1.01); }
  return { solid: b.build(), glow: g.tris ? g.build() : null };
}

/* ======================================================================
   NOT FISH: everything else that ends up on the end of a line.
   Same frame - length 1 along X, the head (or the front) at +X, belly -Y.
   ====================================================================== */
const out = (b, g) => ({ solid: b.build(), glow: g.tris ? g.build() : null });

function glowSpots(g, art, pts) {
  if (art.pat !== 'lights') return;
  g.color(art.patCol || 0x9af0ff);
  for (const [x, y, z] of pts) g.box(0.016, 0.016, 0.016, x, y, z);
}

/** Squid (and the cuttlefish, which is a squid that sat on something). Mantle first. */
function buildSquid(art, r, cuttle = false) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const back = art.back, belly = art.belly, fin = art.fin, W = art.w || 0.12;
  const s = W / 0.12;
  if (!cuttle) {
    b.push(0, 0, 0, 0, 0, -Math.PI / 2);
    b.lathe([[0.075 * s, -0.12], [0.1 * s, 0.02], [0.11 * s, 0.18], [0.09 * s, 0.32], [0.05 * s, 0.44], [0.004, 0.5]], 8, 0, 0, 0, t => mixHex(belly, back, 0.4 + t * 0.6));
    b.pop();
    b.color(fin);
    for (const sz of [-1, 1]) b.card([0.28, 0, sz * 0.05 * s], [0.48, 0.01, sz * 0.02], [0.3, 0.01, sz * 0.2 * s]);
  } else {
    b.blob(0.3, 0.07 * s, 0.13 * s, 0.1, 0, 0, 9, 4, 0.04, back, belly);
    b.color(fin);
    for (let k = 0; k < 10; k++) for (const sz of [-1, 1]) { const x0 = 0.37 - k * 0.055, x1 = x0 - 0.055; b.card([x0, -0.01, sz * 0.12 * s * Math.sin((k + 0.5) / 10 * Math.PI)], [x1, -0.01, sz * 0.12 * s * Math.sin((k + 1.5) / 10 * Math.PI)], [(x0 + x1) / 2, -0.02, sz * (0.17 * s * Math.sin((k + 1) / 10 * Math.PI) + 0.01)]); }
  }
  if (art.pat === 'bars' || art.pat === 'tiger') { b.color(art.patCol); for (let k = 0; k < 5; k++) b.box(0.03, 0.01, 0.1 * s, 0.35 - k * 0.07, cuttle ? 0.06 * s : 0.1 * s, 0); }
  // head, eyes
  b.color(mixHex(back, belly, 0.4)).blob(0.07, 0.06 * s, 0.065 * s, -0.16, 0, 0, 7, 3);
  for (const sz of [-1, 1]) { b.color(art.eyeCol || 0xf0e8b0).blob(0.028, 0.03, 0.02, -0.15, 0.02, sz * 0.06 * s, 6, 3); b.color(0x111111).box(cuttle ? 0.03 : 0.012, 0.018, 0.01, -0.145, 0.02, sz * 0.078 * s); }
  // arms
  const n = art.arms || 8;
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, rr = 0.04 * s;
    const y0 = Math.sin(a) * rr, z0 = Math.cos(a) * rr;
    b.color(k % 2 ? back : mixHex(back, belly, 0.5)).tube([-0.2, y0, z0], [-0.4 - r() * 0.05, y0 * 2.2, z0 * 2.2], 0.016 * s, 0.003, 5);
  }
  for (const sz of [-1, 1]) {
    b.color(back).tube([-0.2, 0, sz * 0.02], [-0.6, -0.02, sz * 0.05], 0.008 * s, 0.006 * s, 4);
    b.color(mixHex(back, belly, 0.3)).blob(0.035, 0.012 * s, 0.02 * s, -0.62, -0.02, sz * 0.05, 5, 2);
  }
  glowSpots(g, art, Array.from({ length: 14 }, () => [0.4 - r() * 0.55, (r() - 0.3) * 0.12 * s, (r() - 0.5) * 0.2 * s]));
  if ((art.extras || []).includes('glow')) g.color(art.patCol || 0x9af0ff).blob(0.03, 0.03, 0.03, 0.47, 0, 0, 5, 3);
  return out(b, g);
}

function buildOctopus(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const back = art.back, belly = art.belly;
  // the head sits up and forward, arms trail back and out across the ground
  b.blob(0.2, 0.2, 0.18, 0.22, 0.12, 0, 8, 5, 0.08, back, belly);
  if (art.pat === 'rings' || art.pat === 'spots') { b.color(art.patCol); for (let k = 0; k < 10; k++) { const a = r() * TAU, y = r() * 0.3; b.blob(0.03, 0.03, 0.015, 0.22 + Math.cos(a) * 0.2, 0.05 + y, Math.sin(a) * 0.17, 5, 2); } }
  for (const sz of [-1, 1]) { b.color(0xf4e8a0).blob(0.035, 0.03, 0.02, 0.1, 0.1, sz * 0.13, 6, 3); b.color(0x111111).box(0.03, 0.012, 0.01, 0.1, 0.1, sz * 0.15); }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    let px = 0.12, py = 0, pz = 0;
    let dx = Math.cos(a), dz = Math.sin(a), rad = 0.045;
    for (let seg = 0; seg < 5; seg++) {
      const L = 0.1 - seg * 0.008, turn = (k % 2 ? 1 : -1) * 0.35 * seg;
      const c = Math.cos(turn), s = Math.sin(turn), ndx = dx * c - dz * s, ndz = dx * s + dz * c;
      const nx = px + ndx * L - 0.05, nz = pz + ndz * L, ny = py - 0.01 + (seg === 4 ? 0.04 : 0);
      b.color(seg % 2 ? back : mixHex(back, belly, 0.4)).tube([px, py, pz], [nx, ny, nz], rad, rad * 0.75, 5);
      b.color(art.suckerCol || 0xf0d8c8).blob(rad * 0.4, rad * 0.25, rad * 0.4, (px + nx) / 2, py - rad * 0.8, (pz + nz) / 2, 4, 2);
      px = nx; py = ny; pz = nz; rad *= 0.75;
    }
  }
  glowSpots(g, art, Array.from({ length: 12 }, () => [0.22 + (r() - 0.5) * 0.3, 0.1 + r() * 0.2, (r() - 0.5) * 0.3]));
  return out(b, g);
}

function buildCrab(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const back = art.back, belly = art.belly, fin = art.fin || shadeHex(back, 0.8);
  const Wd = (art.w || 0.5) * 1.0;
  b.blob(0.3, 0.1, Wd * 0.5, 0, 0.12, 0, 9, 4, 0.06, back, belly);
  if (art.pat === 'spots' || art.pat === 'speckle') { b.color(art.patCol); for (let k = 0; k < 12; k++) b.blob(0.02, 0.012, 0.02, (r() - 0.5) * 0.4, 0.2, (r() - 0.5) * Wd * 0.7, 4, 2); }
  if ((art.extras || []).includes('spikeback')) { b.color(shadeHex(back, 0.8)); for (let k = 0; k < 8; k++) b.cone(0.02, 0.18, 0.28, 4, (r() - 0.5) * 0.35, (r() - 0.5) * Wd * 0.6); }
  // eyes on stalks
  for (const sz of [-1, 1]) { b.color(fin).tube([0.22, 0.16, sz * 0.05], [0.26, 0.27, sz * 0.07], 0.01, 0.008, 4); b.color(0x111111).blob(0.016, 0.016, 0.016, 0.26, 0.28, sz * 0.07, 5, 3); }
  // claws
  const big = art.claw || 1;
  for (const sz of [-1, 1]) {
    const k = sz > 0 ? big : big * (art.oneClaw ? 0.45 : 1);
    b.color(fin).tube([0.18, 0.08, sz * Wd * 0.35], [0.32, 0.1, sz * Wd * 0.55], 0.03 * k, 0.03 * k, 5);
    b.color(back).blob(0.1 * k, 0.05 * k, 0.05 * k, 0.4, 0.1, sz * Wd * 0.58, 6, 3);
    b.push(0.48, 0.1, sz * Wd * 0.58, 0, 0, -Math.PI / 2); b.color(art.clawTip || 0x2a1a14).cone(0.025 * k, 0, 0.08 * k, 4, 0, 0.02); b.cone(0.02 * k, 0, 0.07 * k, 4, 0, -0.02); b.pop();
  }
  // legs
  for (const sz of [-1, 1]) for (let k = 0; k < 4; k++) {
    const x = 0.1 - k * 0.1, z0 = sz * Wd * 0.4, z1 = sz * (Wd * 0.4 + 0.18);
    b.color(k % 2 ? fin : back).tube([x, 0.1, z0], [x - 0.03, 0.14, z1], 0.018, 0.015, 4);
    b.tube([x - 0.03, 0.14, z1], [x - 0.08, -0.02, z1 + sz * 0.1], 0.015, 0.006, 4);
  }
  glowSpots(g, art, Array.from({ length: 10 }, () => [(r() - 0.5) * 0.4, 0.21, (r() - 0.5) * Wd * 0.6]));
  return out(b, g);
}

function buildLobster(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const back = art.back, belly = art.belly, fin = art.fin || shadeHex(back, 0.8);
  // head and thorax
  b.push(0.12, 0.06, 0, 0, 0, -Math.PI / 2);
  b.lathe([[0.02, -0.18], [0.07, -0.12], [0.08, 0.02], [0.06, 0.14], [0.02, 0.2]], 8, 0, 0, 0, t => mixHex(belly, back, 0.5 + t * 0.5));
  b.pop();
  if ((art.extras || []).includes('spikeback')) { b.color(shadeHex(back, 0.7)); for (let k = 0; k < 6; k++) b.cone(0.012, 0.1, 0.16, 4, 0.02 + k * 0.05, 0); }
  // the tail: shrinking plates, then a fan
  for (let k = 0; k < 6; k++) {
    const x = -0.1 - k * 0.06, w = 0.07 - k * 0.006;
    b.color(k % 2 ? back : shadeHex(back, 1.12)).box(0.065, w * 0.9, w * 2, x, 0.05 - k * 0.006, 0);
    if (art.pat === 'bars' || art.pat === 'rings') b.color(art.patCol).box(0.012, w * 0.92, w * 2.02, x - 0.025, 0.05 - k * 0.006, 0);
  }
  b.color(fin);
  for (let k = 0; k < 5; k++) { const a = -0.8 + k * 0.4; b.card([-0.46, 0.02, 0], [-0.46 - Math.cos(a) * 0.12, 0.02, Math.sin(a) * 0.1], [-0.46 - Math.cos(a + 0.4) * 0.12, 0.02, Math.sin(a + 0.4) * 0.1]); }
  // claws
  const big = art.claw || 1;
  for (const sz of [-1, 1]) {
    b.color(fin).tube([0.2, 0.04, sz * 0.05], [0.32, 0.05, sz * 0.14], 0.02, 0.02, 5);
    b.color(back).blob(0.11 * big, 0.035 * big, 0.045 * big, 0.44, 0.05, sz * 0.16, 6, 3);
    b.color(shadeHex(back, 0.7)).tube([0.52, 0.05, sz * 0.14], [0.6, 0.05, sz * 0.12], 0.018 * big, 0.004, 4);
  }
  // antennae
  b.color(art.antCol || shadeHex(back, 0.8));
  for (const sz of [-1, 1]) { b.beam([0.3, 0.08, sz * 0.02], [0.6, 0.18, sz * 0.12], 0.006, 0.006); b.beam([0.6, 0.18, sz * 0.12], [0.85, 0.1, sz * 0.3], 0.004, 0.004); }
  for (const sz of [-1, 1]) b.color(0x111111).blob(0.014, 0.014, 0.014, 0.29, 0.1, sz * 0.03, 5, 3);
  // legs
  for (const sz of [-1, 1]) for (let k = 0; k < 4; k++) b.color(fin).tube([0.15 - k * 0.05, 0.02, sz * 0.05], [0.13 - k * 0.05, -0.06, sz * 0.14], 0.008, 0.005, 4);
  glowSpots(g, art, Array.from({ length: 10 }, () => [0.2 - r() * 0.6, 0.09, (r() - 0.5) * 0.08]));
  return out(b, g);
}

function buildShrimp(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const back = art.back, belly = art.belly, fin = art.fin || back;
  // a curled body: segments along an arc, head at +X, tail curling down and under
  const N = 8, pts = [];
  for (let k = 0; k <= N; k++) { const t = k / N, a = t * 2.4; pts.push([0.36 - Math.sin(a) * 0.36, (1 - Math.cos(a)) * -0.13 + 0.05, 0]); }
  for (let k = 0; k < N; k++) {
    const rr = 0.085 * (1 - k / N * 0.7);
    b.color(k % 2 ? back : mixHex(back, belly, 0.35)).tube(pts[k], pts[k + 1], rr, rr * 0.88, 7);
    if (art.pat === 'bars' || art.pat === 'rings') b.color(art.patCol).tube(pts[k], [(pts[k][0] * 3 + pts[k + 1][0]) / 4, (pts[k][1] * 3 + pts[k + 1][1]) / 4, 0], rr * 1.02, rr * 1.0, 7);
  }
  const tl = pts[N];
  b.color(fin);
  for (let k = 0; k < 5; k++) { const a = -0.7 + k * 0.35; b.card(tl, [tl[0] + 0.1 + Math.sin(a) * 0.02, tl[1] + 0.05, Math.sin(a) * 0.1], [tl[0] + 0.1 + Math.sin(a + 0.35) * 0.02, tl[1] + 0.05, Math.sin(a + 0.35) * 0.1]); }
  // rostrum, eyes, feelers
  b.color(shadeHex(back, 0.8)).tube([0.4, 0.07, 0], [0.56, 0.1, 0], 0.012, 0.002, 4);
  for (const sz of [-1, 1]) { b.color(0x111111).blob(0.018, 0.018, 0.018, 0.38, 0.1, sz * 0.05, 5, 3); b.color(art.antCol || fin).beam([0.4, 0.05, sz * 0.03], [0.75, 0.12, sz * 0.2], 0.004, 0.004); b.beam([0.75, 0.12, sz * 0.2], [0.95, 0.02, sz * 0.35], 0.003, 0.003); }
  for (let k = 0; k < 6; k++) for (const sz of [-1, 1]) b.color(fin).beam([0.3 - k * 0.05, -0.02, sz * 0.03], [0.28 - k * 0.05, -0.1, sz * 0.06], 0.006, 0.006);
  glowSpots(g, art, pts.map(p => [p[0], p[1] + 0.06, 0]));
  if ((art.extras || []).includes('glow')) { g.color(art.patCol || 0x9af0ff); for (const p of pts) g.box(0.02, 0.02, 0.02, p[0], p[1] - 0.07, 0); }
  return out(b, g);
}

function buildJelly(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const back = art.back, belly = art.belly;
  // the bell: a dome, with a scalloped rim
  b.lathe([[0.36, 0], [0.34, 0.08], [0.28, 0.17], [0.18, 0.24], [0.06, 0.28], [0.001, 0.29]], 12, 0, 0, 0, t => mixHex(belly, back, t));
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; b.color(back).blob(0.05, 0.03, 0.05, Math.cos(a) * 0.35, -0.01, Math.sin(a) * 0.35, 5, 2); }
  // frilly oral arms and long trailing tentacles
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; b.color(art.fin || belly); for (let j = 0; j < 5; j++) b.card([Math.cos(a) * 0.05, -j * 0.08, Math.sin(a) * 0.05], [Math.cos(a) * 0.14, -j * 0.08 - 0.05, Math.sin(a) * 0.14], [Math.cos(a) * 0.04, -j * 0.08 - 0.1, Math.sin(a) * 0.04]); }
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, R = 0.32; b.color(k % 2 ? back : belly).beam([Math.cos(a) * R, -0.01, Math.sin(a) * R], [Math.cos(a) * (R - 0.04), -0.55 - r() * 0.3, Math.sin(a) * (R - 0.04)], 0.006, 0.003); }
  g.color(art.patCol || 0xb8fff0);
  if (art.pat === 'lights' || (art.extras || []).includes('glow')) { for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; g.blob(0.05, 0.03, 0.05, Math.cos(a) * 0.1, 0.12, Math.sin(a) * 0.1, 5, 2); } for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.box(0.02, 0.02, 0.02, Math.cos(a) * 0.35, 0.02, Math.sin(a) * 0.35); } }
  return out(b, g);
}

function buildSeahorse(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const back = art.back, belly = art.belly, fin = art.fin || back;
  // stands up: the head at the top, the tail curled under. Height ~1.
  const spine = [];
  for (let k = 0; k <= 12; k++) { const t = k / 12; const y = 0.42 - t * 0.9; const x = Math.sin(t * Math.PI * 1.1) * 0.12 - (t > 0.75 ? (t - 0.75) * 0.8 : 0); spine.push([x, y, 0]); }
  for (let k = 0; k < 12; k++) { const rr = 0.09 * Math.sin(Math.min(1, (k + 1) / 5) * Math.PI / 2) * (1 - k / 14) + 0.01; b.color(k % 2 ? back : mixHex(back, belly, 0.4)).tube(spine[k], spine[k + 1], rr, rr * 0.9, 6); }
  // the curl
  let p = spine[12];
  for (let k = 0; k < 6; k++) { const a = k * 0.9; const n = [p[0] + Math.cos(a) * 0.035, p[1] - Math.sin(a) * 0.035, 0]; b.color(back).tube(p, n, 0.012, 0.009, 5); p = n; }
  // head and snout
  b.color(back).blob(0.07, 0.06, 0.05, 0.03, 0.46, 0, 6, 3);
  b.color(shadeHex(back, 0.9)).tube([0.07, 0.46, 0], [0.24, 0.42, 0], 0.025, 0.018, 5);
  for (const sz of [-1, 1]) { b.color(0xf0e8c0).blob(0.018, 0.018, 0.012, 0.05, 0.48, sz * 0.045, 5, 3); b.color(0x111111).blob(0.009, 0.009, 0.008, 0.055, 0.48, sz * 0.052, 4, 2); }
  b.color(art.patCol || shadeHex(back, 0.8)); for (let k = 0; k < 4; k++) b.cone(0.01, 0.5, 0.56 + k * 0.01, 4, k * 0.02 - 0.03, 0);
  b.color(fin).card([-0.08, 0.1, 0], [-0.2, 0.18, 0], [-0.16, 0.0, 0]);
  if ((art.extras || []).includes('leaf')) { b.color(fin); for (let k = 1; k < 11; k += 2) b.card(spine[k], [spine[k][0] - 0.12, spine[k][1] + 0.05, (k % 4 - 1) * 0.08], [spine[k][0] - 0.06, spine[k][1] - 0.05, 0]); }
  glowSpots(g, art, spine.map(q => [q[0] - 0.06, q[1], 0]));
  return out(b, g);
}

function buildRay(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const back = art.back, belly = art.belly;
  const span = art.span || 0.55;
  // flat body with raised middle, wings as fans of facets, a long tail
  b.blob(0.3, 0.05, 0.14, 0.05, 0, 0, 8, 3, 0.03, back, belly);
  // each wing is one kite: from beside the head, out to a swept-back tip, and in again by the tail
  const xAt = t => 0.3 - 0.52 * t;
  const I = (t, y, sz) => [xAt(t), y, sz * 0.07];
  const O = (t, y, sz) => { const s = Math.sin(t * Math.PI); return [xAt(t) - 0.1 * s, y - s * 0.02, sz * (0.07 + span * Math.pow(s, 0.8))]; };
  for (const sz of [-1, 1]) for (let k = 0; k < 8; k++) {
    const t0 = k / 8, t1 = (k + 1) / 8;
    b.color(k % 2 ? back : shadeHex(back, 1.08)).quad(I(t0, 0.03, sz), I(t1, 0.03, sz), O(t1, 0.02, sz), O(t0, 0.02, sz), [0, 1, 0]);
    b.color(belly).quad(I(t0, -0.015, sz), I(t1, -0.015, sz), O(t1, -0.005, sz), O(t0, -0.005, sz), [0, -1, 0]);
    b.color(shadeHex(back, 0.8)).quad(O(t0, 0.02, sz), O(t1, 0.02, sz), O(t1, -0.005, sz), O(t0, -0.005, sz), [0, 0, sz]);
  }
  if (art.pat === 'spots' || art.pat === 'dots' || art.pat === 'speckle') { b.color(art.patCol); for (let k = 0; k < 14; k++) { const z = (r() - 0.5) * span * 1.4, x = 0.1 + (r() - 0.5) * 0.4 * (1 - Math.abs(z) / span); b.box(0.025, 0.004, 0.025, x, 0.05 - Math.abs(z) * 0.05, z); } }
  b.color(shadeHex(back, 0.85)).tube([-0.2, 0, 0], [-0.75, 0.01, 0], 0.02, 0.003, 5);
  if ((art.extras || []).includes('spikeback')) b.color(0xe8e0c8).cone(0.012, 0, 0.08, 3, -0.3, 0);
  if ((art.extras || []).includes('horn')) for (const sz of [-1, 1]) b.color(back).card([0.3, 0.02, sz * 0.06], [0.42, 0.03, sz * 0.12], [0.34, 0.02, sz * 0.14]);
  for (const sz of [-1, 1]) { b.color(0x111111).blob(0.016, 0.016, 0.016, 0.22, 0.05, sz * 0.05, 5, 3); }
  glowSpots(g, art, Array.from({ length: 12 }, () => { const z = (r() - 0.5) * span; return [0.1 + (r() - 0.5) * 0.3, 0.04, z]; }));
  return out(b, g);
}

function buildUrchin(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  b.color(art.back).blob(0.26, 0.2, 0.26, 0, 0.18, 0, 9, 5, 0.06);
  const n = art.spines || 60;
  for (let k = 0; k < n; k++) {
    const u = r() * 0.95, a = r() * TAU, phi = Math.acos(1 - u * 1.4);
    const d = [Math.sin(phi) * Math.cos(a), Math.cos(phi), Math.sin(phi) * Math.sin(a)];
    const p0 = [d[0] * 0.24, 0.18 + d[1] * 0.18, d[2] * 0.24];
    const L = (art.spineLen || 0.35) * (0.6 + r() * 0.5);
    b.color(k % 3 ? (art.fin || shadeHex(art.back, 0.8)) : art.belly).tube(p0, [p0[0] + d[0] * L, p0[1] + d[1] * L, p0[2] + d[2] * L], 0.012, 0.001, 3);
  }
  if (art.pat === 'lights' || (art.extras || []).includes('glow')) { g.color(art.patCol || 0x9af0ff); for (let k = 0; k < 14; k++) { const a = r() * TAU, y = r() * 0.3; g.box(0.02, 0.02, 0.02, Math.cos(a) * 0.25, 0.08 + y, Math.sin(a) * 0.25); } }
  return out(b, g);
}

function buildNautilus(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  // a logarithmic spiral in the XY plane: the whorl grows by the same ratio
  // every turn and ends at the bottom, its opening facing +X
  const cx = -0.12, cy = 0.3, Rmax = 0.3, turnK = Math.log(1 / 0.45) / TAU;
  const t1 = Math.PI * 3.5, t0 = t1 - Math.PI * 3.2, N = 40;
  let prev = null;
  for (let k = 0; k <= N; k++) {
    const th = t0 + (t1 - t0) * k / N;
    const R = Rmax * Math.exp(turnK * (th - t1));
    const p = [cx + R * Math.cos(th), cy + R * Math.sin(th), 0], rr = R * 0.46 + 0.004;
    const stripe = (art.pat === 'tiger' || art.pat === 'bars') && Math.sin(k * 1.3) > 0.2 && k < N - 4;
    if (prev) b.color(stripe ? art.patCol : k % 2 ? art.back : art.belly).tube(prev.p, p, prev.rr, rr, 9, k === N);
    prev = { p, rr };
  }
  const mouth = [prev.p[0] + 0.02, prev.p[1] + 0.05, 0];
  b.color(shadeHex(art.belly, 0.6)).blob(0.02, prev.rr * 0.8, prev.rr * 0.8, prev.p[0] + 0.005, prev.p[1], 0, 7, 3);
  b.color(art.fin || 0x9a6a5a);
  for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; b.tube([mouth[0] + 0.03, mouth[1] - 0.04, 0], [mouth[0] + 0.24 + r() * 0.08, mouth[1] - 0.1 + Math.sin(a) * 0.08, Math.cos(a) * 0.1], 0.008, 0.002, 3); }
  for (const sz of [-1, 1]) b.color(0x111111).blob(0.02, 0.02, 0.015, mouth[0] + 0.04, mouth[1] + 0.03, sz * 0.09, 5, 3);
  if ((art.extras || []).includes('glow')) g.color(art.patCol || 0xffd890).blob(0.03, 0.03, 0.03, mouth[0], mouth[1], 0, 5, 3);
  return out(b, g);
}

function buildTurtle(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const back = art.back, belly = art.belly, fin = art.fin || shadeHex(back, 0.9);
  b.push(0, 0.02, 0, 0, 0, 0, 1, 1, 0.78);
  b.lathe([[0.34, 0], [0.33, 0.05], [0.27, 0.12], [0.16, 0.17], [0.001, 0.19]], 9, 0, 0, 0, t => mixHex(back, shadeHex(back, 1.25), t));
  b.pop();
  b.color(belly).cyl(0.3, 0.33, -0.04, 0.01, 9, true, 0, 0);
  // scutes
  b.color(art.patCol || shadeHex(back, 0.75));
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; b.box(0.05, 0.01, 0.05, Math.cos(a) * 0.16, 0.16, Math.sin(a) * 0.12); }
  b.box(0.06, 0.012, 0.06, 0, 0.19, 0);
  b.color(fin).blob(0.08, 0.06, 0.06, 0.38, 0.03, 0, 6, 3);
  for (const sz of [-1, 1]) b.color(0x111111).blob(0.012, 0.012, 0.01, 0.43, 0.05, sz * 0.04, 4, 2);
  for (const [x, z, L] of [[0.16, 0.22, 0.28], [-0.2, 0.2, 0.14]]) for (const sz of [-1, 1]) b.color(fin).blob(L * 0.6, 0.02, 0.05, x + (x > 0 ? 0.08 : -0.04), 0, sz * (z + L * 0.35), 6, 2);
  b.color(fin).tube([-0.3, 0.01, 0], [-0.42, 0, 0], 0.03, 0.004, 4);
  if ((art.extras || []).includes('glow')) { g.color(art.patCol || 0x9af0ff); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.box(0.02, 0.012, 0.02, Math.cos(a) * 0.16, 0.172, Math.sin(a) * 0.12); } }
  return out(b, g);
}

function buildStar(art, r) {
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const n = art.arms || 5;
  b.color(art.back).blob(0.12, 0.05, 0.12, 0, 0.04, 0, 7, 3);
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU;
    b.color(k % 2 ? art.back : shadeHex(art.back, 1.08)).tube([0, 0.04, 0], [Math.cos(a) * 0.45, 0.02, Math.sin(a) * 0.45], 0.075, 0.015, 5);
    b.color(art.patCol || art.belly); for (let j = 1; j < 5; j++) b.blob(0.012, 0.012, 0.012, Math.cos(a) * j * 0.09, 0.08 - j * 0.012, Math.sin(a) * j * 0.09, 4, 2);
  }
  if (art.pat === 'lights' || (art.extras || []).includes('glow')) { g.color(art.patCol || 0xfff0a0); for (let k = 0; k < n; k++) { const a = k / n * TAU; g.box(0.03, 0.03, 0.03, Math.cos(a) * 0.4, 0.04, Math.sin(a) * 0.4); } }
  return out(b, g);
}

const KINDS = {
  squid: (a, r) => buildSquid(a, r, false), cuttle: (a, r) => buildSquid(a, r, true), octopus: buildOctopus, crab: buildCrab, lobster: buildLobster,
  shrimp: buildShrimp, jelly: buildJelly, seahorse: buildSeahorse, ray: buildRay, urchin: buildUrchin, nautilus: buildNautilus, turtle: buildTurtle, star: buildStar,
};

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
  } else if (kind === 'map') {
    b.color(0xd8c8a0).cyl(0.16, 0.16, -0.5, 0.5, 8, true); b.color(0x8a6a44); for (const y of [-0.3, 0.3]) b.cyl(0.17, 0.17, y - 0.03, y + 0.03, 8, false);
    b.color(0xa8302a).box(0.02, 0.2, 0.34, 0, 0.35, 0);
    rotateBuilderZ(b, -Math.PI / 2);
  } else if (kind === 'key') {
    b.color(0xb08a3a).cyl(0.06, 0.06, -0.5, 0.25, 6, true); for (let i = 0; i < 8; i++) { const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2; b.beam([0, 0.45 + Math.cos(a0) * 0.2, Math.sin(a0) * 0.2], [0, 0.45 + Math.cos(a1) * 0.2, Math.sin(a1) * 0.2], 0.07, 0.07); }
    b.box(0.08, 0.14, 0.2, 0, -0.42, 0.12); b.color(0xe8e4d8); for (let k = 0; k < 5; k++) b.lump(0.04, 0, -0.2 + k * 0.1, 0.06, 0.4);
    rotateBuilderZ(b, -Math.PI / 2);
  } else if (kind === 'pouch') {
    b.color(0x6a4a2a).blob(0.45, 0.35, 0.4, 0, -0.1, 0, 7, 4, 0.15); b.color(0x4a3220).cyl(0.14, 0.2, 0.2, 0.42, 6, true); b.color(0xe8c050); for (let k = 0; k < 4; k++) b.cyl(0.12, 0.12, -0.45 + k * 0.03, -0.43 + k * 0.03, 7, true, 0.3 + k * 0.05, 0.2);
  } else if (kind === 'idol') {
    b.color(0x3a6a4a).box(0.5, 0.9, 0.4, 0, 0, 0); b.color(0x2a5a3a).blob(0.35, 0.3, 0.3, 0, 0.55, 0, 7, 4);
    g.color(0x9affb0); for (let k = 0; k < 5; k++) g.box(0.07, 0.07, 0.02, -0.2 + k * 0.1, 0.6 + (k % 2) * 0.08, 0.3);
    rotateBuilderZ(b, -Math.PI / 2); rotateBuilderZ(g, -Math.PI / 2);
  } else if (kind === 'planks') {
    for (let k = 0; k < 4; k++) b.color(k % 2 ? 0x7a5836 : 0x6a4a2e).box(1, 0.08, 0.22, (k % 2) * 0.1 - 0.05, k * 0.09 - 0.14, (k - 1.5) * 0.24);
    b.color(0x5a5a5a); for (let k = 0; k < 6; k++) b.box(0.02, 0.12, 0.02, -0.4 + k * 0.16, 0.2, (k % 3 - 1) * 0.2);
  } else if (kind === 'page') {
    b.color(0xe8dcb8).box(0.9, 0.02, 0.65, 0, 0, 0); b.color(0x6a5a44); for (let k = 0; k < 6; k++) b.box(0.6, 0.025, 0.02, -0.05, 0, -0.22 + k * 0.08);
    b.color(0x3a2a1a).box(0.2, 0.026, 0.16, 0.25, 0, 0.2);
  } else if (kind === 'strongbox') {
    b.color(0x3a3a3e).box(1, 0.6, 0.66, 0, 0, 0); b.color(0x5a5a60).box(1.02, 0.1, 0.68, 0, 0.3, 0);
    b.color(0x8a6a3a); for (const x of [-0.35, 0, 0.35]) b.box(0.07, 0.62, 0.7, x, 0, 0);
    b.color(0x6a6a6a); for (let k = 0; k < 7; k++) b.beam([-0.5 + k * 0.16, 0.34, 0.35], [-0.42 + k * 0.16, 0.34, -0.35], 0.04, 0.04);
    b.color(0xb08a3a).box(0.16, 0.18, 0.05, 0, 0.05, 0.36);
    b.color(0x6a8a5a); for (let k = 0; k < 8; k++) b.lump(0.06, (Math.random() - 0.5) * 0.9, -0.25 + Math.random() * 0.5, 0.34, 0.4, 0.4);
  } else if (kind === 'bell') {
    // a ship's bell, green with age, with its clapper and a hanging ring
    b.color(0x6a8a5a).lathe([[0.02, 0.5], [0.22, 0.42], [0.3, 0.1], [0.42, -0.3], [0.46, -0.42]], 10);
    b.color(0x8aa870).cyl(0.47, 0.47, -0.46, -0.4, 10, false);
    b.color(0x5a7a4a).cyl(0.08, 0.08, 0.5, 0.62, 6, true); b.color(0x3a3a3a).blob(0.08, 0.1, 0.08, 0, -0.38, 0, 6, 3);
    rotateBuilderZ(b, -Math.PI / 2);
  } else if (kind === 'wheel') {
    // a ship's wheel: rim, hub, eight spoked handles
    b.color(0x6a4a2a);
    for (let k = 0; k < 12; k++) { const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2; b.beam([Math.cos(a0) * 0.36, Math.sin(a0) * 0.36, 0], [Math.cos(a1) * 0.36, Math.sin(a1) * 0.36, 0], 0.06, 0.06); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.color(0x7a5a38).beam([0, 0, 0], [Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0], 0.035, 0.035); }
    b.color(0xb08a3a).cyl(0.09, 0.09, -0.05, 0.05, 8, true);
    rotateBuilderZ(b, Math.PI / 2);
  } else if (kind === 'porthole') {
    b.color(0xb08a3a); for (let k = 0; k < 12; k++) { const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2; b.beam([0, Math.cos(a0) * 0.4, Math.sin(a0) * 0.4], [0, Math.cos(a1) * 0.4, Math.sin(a1) * 0.4], 0.12, 0.1); }
    b.color(0x9ec0d2).cyl(0.34, 0.34, -0.02, 0.02, 12, true); b.color(0x8a6a2a); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; b.box(0.1, 0.08, 0.08, 0.04, Math.cos(a) * 0.46, Math.sin(a) * 0.46); }
  } else if (kind === 'compass') {
    b.color(0x5a3a22).box(0.8, 0.3, 0.8, 0, -0.1, 0); b.color(0xb08a3a).cyl(0.34, 0.34, 0.05, 0.12, 12, true);
    b.color(0xf0e8d0).cyl(0.3, 0.3, 0.12, 0.13, 12, true); b.color(0xc83a2a).box(0.04, 0.02, 0.5, 0, 0.14, 0);
  } else if (kind === 'crown') {
    b.color(0xd8b048).cyl(0.4, 0.42, -0.2, 0.1, 12, false);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.push(Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.4).cone(0.09, 0, 0.35, 4).pop(); }
    g.color(0xe03a4a); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; g.blob(0.06, 0.06, 0.04, Math.cos(a) * 0.42, -0.05, Math.sin(a) * 0.42, 6, 3); }
    g.color(0x4ae0a0); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 1.2; g.blob(0.05, 0.05, 0.04, Math.cos(a) * 0.42, -0.05, Math.sin(a) * 0.42, 6, 3); }
  } else if (kind === 'sceptre') {
    b.color(0xd8b048).cyl(0.05, 0.05, -0.5, 0.35, 7, true); for (const y of [-0.3, 0, 0.3]) b.cyl(0.08, 0.08, y - 0.03, y + 0.03, 7, true);
    b.color(0xc89830).cyl(0.1, 0.06, 0.35, 0.42, 7, true);
    g.color(0x9af0f0).blob(0.14, 0.14, 0.14, 0, 0.56, 0, 8, 4);
    rotateBuilderZ(b, -Math.PI / 2); rotateBuilderZ(g, -Math.PI / 2);
  } else if (kind === 'chalice') {
    b.color(0xd8b048).lathe([[0.3, -0.5], [0.3, -0.44], [0.06, -0.36], [0.05, -0.05], [0.1, 0], [0.3, 0.2], [0.36, 0.5]], 10);
    g.color(0xe03a4a); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; g.blob(0.04, 0.04, 0.03, Math.cos(a) * 0.3, 0.25, Math.sin(a) * 0.3, 5, 3); }
    b.color(0x6a8a5a); for (let k = 0; k < 3; k++) b.lump(0.05, (k - 1) * 0.12, 0.35, 0.2, 0.4);
  } else if (kind === 'seal') {
    b.color(0xd8b048).cyl(0.45, 0.45, -0.1, 0.1, 14, true);
    b.color(0xb08a2a); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.box(0.3, 0.04, 0.04, Math.cos(a) * 0.2, 0.11, Math.sin(a) * 0.2); }
    b.color(0xe8c860).cyl(0.12, 0.12, 0.1, 0.13, 8, true);
    b.color(0x3a6aa0); for (let k = 0; k < 3; k++) b.box(0.5 - k * 0.1, 0.03, 0.05, 0, 0.11, -0.25 + k * 0.06);
  } else if (kind === 'mask') {
    b.color(0xd8b048).blob(0.4, 0.5, 0.18, 0, 0, 0, 10, 5);
    b.color(0x2a2a2a).box(0.18, 0.03, 0.05, -0.15, 0.1, 0.16); b.box(0.18, 0.03, 0.05, 0.15, 0.1, 0.16);
    b.color(0xc89830).blob(0.06, 0.12, 0.06, 0, -0.02, 0.2, 5, 3); b.color(0xa87820).box(0.16, 0.03, 0.04, 0, -0.22, 0.17);
    rotateBuilderZ(b, -Math.PI / 2);
  } else if (kind === 'coinjar') {
    b.color(0x9a6a44).lathe([[0.2, -0.5], [0.4, -0.3], [0.42, 0.1], [0.24, 0.35], [0.18, 0.5]], 9);
    b.color(0x6a8a5a); for (let k = 0; k < 6; k++) b.lump(0.06, (Math.cos(k) * 0.4), -0.2 + k * 0.08, Math.sin(k) * 0.4, 0.4);
    g.color(0xf0c848); for (let k = 0; k < 6; k++) g.cyl(0.07, 0.07, 0.5 + k * 0.02, 0.51 + k * 0.02, 7, true, (k % 3 - 1) * 0.06, (k % 2) * 0.05);
    rotateBuilderZ(b, -Math.PI / 2); rotateBuilderZ(g, -Math.PI / 2);
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
const VMAT = {};
function variantMat(v) {
  if (VMAT[v]) return VMAT[v];
  const o = { vertexColors: true };
  if (v === 'golden') Object.assign(o, { color: 0xffd060, emissive: 0x4a3200 });
  else if (v === 'albino') Object.assign(o, { color: 0xffffff, emissive: 0x9a9088 });
  else if (v === 'armored') Object.assign(o, { color: 0xb0bcc8, emissive: 0x1a2026 });
  else if (v === 'glowing') Object.assign(o, { color: 0xc8fff4, emissive: 0x1a7a70 });
  else if (v === 'abyssal') Object.assign(o, { color: 0x6a4a9a, emissive: 0x1a0a30 });
  return (VMAT[v] = new THREE.MeshLambertMaterial(o));
}

export function fishMesh(species, lengthM, opts = {}) {
  const geos = fishGeos(species);
  const grp = new THREE.Group();
  const ghost = (species.art?.extras || []).includes('ghost');
  const vm = opts.variant && opts.variant !== 'giant' ? variantMat(opts.variant) : null;
  const m = new THREE.Mesh(geos.solid, ghost ? MAT.ghost : vm || MAT.solid);
  m.castShadow = !ghost; m.receiveShadow = true;
  grp.add(m);
  if (geos.glow) { const gm = new THREE.Mesh(geos.glow, MAT.glow); grp.add(gm); }
  const junkScale = species.junk ? ({ chest: 0.75, strongbox: 0.7, duck: 0.12, planks: 1.2, page: 0.35, key: 0.22, idol: 0.35, bell: 0.45, wheel: 0.9, porthole: 0.45, compass: 0.25, crown: 0.3, sceptre: 0.7, chalice: 0.25, seal: 0.15, mask: 0.3, coinjar: 0.35 }[species.junk] ?? 0.3) : 1;
  const s = species.junk ? junkScale / 1 : lengthM;
  grp.scale.setScalar(opts.forceScale || s);
  grp.userData.species = species.id;
  return grp;
}
