/* BuildingArt.js - cabins, the guild hall, shops, docks and every prop in
   the settlement.

   A building is built in its own frame: centred on the origin, floor at
   y = 0, front (the door side) facing +Z. Walls are VERTICAL PLANKS, one box
   per plank with a little colour and depth jitter, which is exactly what
   makes the reference cabin read as wood without a texture. Openings are
   left as real holes, so a door is a door you can walk through.

   Every builder returns { geo, cols, anchors }:
     geo      BufferGeometry (or a Group for signs with text)
     cols     colliders in LOCAL space: boxes {x,z,hw,hd,y0,y1,floor?}
     anchors  named local points (door, counter, stool, mount slots...) */

import * as THREE from '../../lib/three.module.js?v=1790354328';
import { MeshBuilder, mixHex, shadeHex } from './Geo.js?v=1790354328';
import { rng, TAU } from '../core/Util.js?v=1790354328';

const WALL_T = 0.14;

/* ------------------------------------------------------------------ */
/* planks                                                              */
/* ------------------------------------------------------------------ */

/** A plank wall along local X from x0 to x1 at z, height 0..h (or a gable top fn). Openings: [{x0,x1,y0,y1}] */
function plankWall(b, r, x0, x1, z, h, col, openings = [], topFn = null, outward = 1) {
  const pw = 0.26;
  const n = Math.max(1, Math.round((x1 - x0) / pw));
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * w;
    const top = topFn ? topFn(cx) : h;
    // gather vertical spans not cut by openings
    let spans = [[0, top]];
    for (const o of openings) {
      if (cx < o.x0 || cx > o.x1) continue;
      const next = [];
      for (const [a, c] of spans) {
        if (o.y1 <= a || o.y0 >= c) { next.push([a, c]); continue; }
        if (o.y0 > a) next.push([a, o.y0]);
        if (o.y1 < c) next.push([o.y1, c]);
      }
      spans = next;
    }
    const tone = shadeHex(col, 0.86 + r() * 0.26);
    const dz = (r() - 0.5) * 0.03 * outward;
    for (const [a, c] of spans) {
      if (c - a < 0.02) continue;
      b.color(tone).box(w * 0.94, c - a, WALL_T, cx, (a + c) / 2, z + dz);
    }
  }
}

/** Frame around an opening on a wall at z. */
function frame(b, x0, x1, y0, y1, z, col, sill = true) {
  const t = 0.1, d = WALL_T + 0.08;
  b.color(col);
  b.box(t, y1 - y0 + t * 2, d, x0 - t / 2, (y0 + y1) / 2, z);
  b.box(t, y1 - y0 + t * 2, d, x1 + t / 2, (y0 + y1) / 2, z);
  b.box(x1 - x0 + t * 2, t, d, (x0 + x1) / 2, y1 + t / 2, z);
  if (sill) b.box(x1 - x0 + t * 3, t, d + 0.08, (x0 + x1) / 2, y0 - t / 2, z);
}

function windowPane(b, x0, x1, y0, y1, z) {
  // glass: pale blue facets, muntins in a cross like the reference
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rows = 3, cols = 3;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const ax = x0 + (x1 - x0) * i / cols, bx = x0 + (x1 - x0) * (i + 1) / cols;
    const ay = y0 + (y1 - y0) * j / rows, by = y0 + (y1 - y0) * (j + 1) / rows;
    b.color((i + j) % 2 ? 0xb9ccd8 : 0x9eb6c6);
    b.box(bx - ax, by - ay, 0.02, (ax + bx) / 2, (ay + by) / 2, z);
    // a diagonal glint on some panes
    if ((i * 3 + j) % 4 === 0) { b.color(0xe6f0f5); b.box((bx - ax) * 0.25, (by - ay) * 0.7, 0.025, (ax + bx) / 2 - (bx - ax) * 0.15, (ay + by) / 2, z + 0.004); }
  }
  b.color(0x4a3524);
  for (let i = 1; i < cols; i++) b.box(0.05, y1 - y0, 0.05, x0 + (x1 - x0) * i / cols, cy, z + 0.02);
  for (let j = 1; j < rows; j++) b.box(x1 - x0, 0.05, 0.05, cx, y0 + (y1 - y0) * j / rows, z + 0.02);
}

function door(b, x0, x1, y1, z, col, open = false) {
  const w = x1 - x0;
  if (open) return;
  const n = 4;
  for (let i = 0; i < n; i++) {
    b.color(shadeHex(col, 0.9 + (i % 2) * 0.12));
    b.box(w / n * 0.95, y1, 0.07, x0 + (i + 0.5) * w / n, y1 / 2, z);
  }
  b.color(shadeHex(col, 0.7));
  b.box(w * 0.95, 0.12, 0.1, (x0 + x1) / 2, y1 * 0.25, z + 0.03);
  b.box(w * 0.95, 0.12, 0.1, (x0 + x1) / 2, y1 * 0.75, z + 0.03);
  b.color(0x2a2a2a).box(0.06, 0.06, 0.12, x1 - 0.18, y1 * 0.5, z + 0.07);
}

/** Gable roof with shingle rows. Ridge along X. */
function gableRoof(b, r, w, d, wallH, rise, over, col) {
  const hx = w / 2 + over, hz = d / 2 + over;
  const ridgeY = wallH + rise;
  const rows = Math.max(4, Math.round(Math.hypot(hz, rise) / 0.42));
  for (const side of [-1, 1]) {
    for (let k = 0; k < rows; k++) {
      const t0 = k / rows, t1 = (k + 1.25) / rows;
      const z0 = side * hz * (1 - t0), z1 = side * hz * Math.max(0, 1 - t1);
      const y0 = wallH - over * rise / (d / 2) + (ridgeY - (wallH - over * rise / (d / 2))) * t0;
      const y1 = wallH - over * rise / (d / 2) + (ridgeY - (wallH - over * rise / (d / 2))) * Math.min(1, t1);
      const segs = Math.max(3, Math.round(hx * 2 / 0.9));
      for (let s = 0; s < segs; s++) {
        const xa = -hx + (s / segs) * hx * 2, xb = -hx + ((s + 1) / segs) * hx * 2;
        const jit = (r() - 0.5) * 0.04;
        b.color(shadeHex(col, 0.82 + r() * 0.3));
        const th = 0.07;
        // top surface
        b.quad([xa, y0 + jit + th, z0], [xb, y0 + jit + th, z0], [xb, y1 + th, z1], [xa, y1 + th, z1], [0, 1, side * 0.6]);
        // underside
        b.color(shadeHex(col, 0.5));
        b.quad([xa, y0 + jit, z0], [xb, y0 + jit, z0], [xb, y1, z1], [xa, y1, z1], [0, -1, -side * 0.3]);
        // butt edge
        b.color(shadeHex(col, 0.65));
        b.quad([xa, y0 + jit, z0], [xb, y0 + jit, z0], [xb, y0 + jit + th, z0], [xa, y0 + jit + th, z0], [0, 0, side]);
      }
    }
  }
  // ridge cap
  b.color(shadeHex(col, 0.7)).box(hx * 2 + 0.1, 0.16, 0.3, 0, ridgeY + 0.1, 0);
  // barge boards
  b.color(0x3d2a1c);
  for (const sx of [-1, 1]) {
    b.beam([sx * hx, wallH - over * rise / (d / 2), -hz], [sx * hx, ridgeY + 0.05, 0], 0.12, 0.2);
    b.beam([sx * hx, wallH - over * rise / (d / 2), hz], [sx * hx, ridgeY + 0.05, 0], 0.12, 0.2);
  }
}

/* ------------------------------------------------------------------ */
/* house                                                               */
/* ------------------------------------------------------------------ */

export function buildHouse(spec) {
  const s = Object.assign({
    w: 6, d: 5, h: 2.8, rise: 1.9, over: 0.45, seed: 1,
    wall: 0x7a5236, roof: 0x5a3a2e, trim: 0x4a3322, doorCol: 0x6a4630,
    doorX: 0.6, doorW: 1.1, doorH: 2.1, doorOpen: true,
    windows: [{ side: 'front', x: -1.5 }], porch: false, floorH: 0.35, chimney: false, interior: false,
    stilts: 0,
  }, spec);
  const r = rng(s.seed);
  const b = new MeshBuilder(r);
  const hw = s.w / 2, hd = s.d / 2, F = s.floorH;
  const cols = [];
  const anchors = {};

  b.push(0, F + s.stilts, 0);
  // floor
  b.color(0x6b4a30);
  const fp = 0.3, fn = Math.round(s.w / fp);
  for (let i = 0; i < fn; i++) b.color(shadeHex(0x7a5638, 0.85 + r() * 0.25)).box(s.w / fn * 0.96, 0.1, s.d - 0.1, -hw + (i + 0.5) * s.w / fn, -0.05, 0);
  // front wall with door and windows
  const openF = [{ x0: s.doorX - s.doorW / 2, x1: s.doorX + s.doorW / 2, y0: -1, y1: s.doorH }];
  const winH = [0.95, 1.95];
  const wins = s.windows.map(wd => ({ ...wd, x0: wd.x - 0.55, x1: wd.x + 0.55, y0: winH[0], y1: winH[1] }));
  for (const wd of wins) if (wd.side === 'front') openF.push(wd);
  plankWall(b, r, -hw, hw, hd, s.h, s.wall, openF, null, 1);
  // back
  const openB = wins.filter(w => w.side === 'back');
  plankWall(b, r, -hw, hw, -hd, s.h, s.wall, openB, null, -1);
  // sides as walls along X rotated
  for (const side of [-1, 1]) {
    b.push(side * hw, 0, 0, 0, side * Math.PI / 2, 0);
    const openS = wins.filter(w => w.side === (side < 0 ? 'left' : 'right')).map(w => ({ ...w }));
    // gable: height rises to the ridge at the centre
    plankWall(b, r, -hd, hd, 0, s.h, s.wall, openS, x => s.h + s.rise * (1 - Math.abs(x) / hd) - 0.05, 1);
    for (const w of openS) { frame(b, w.x0, w.x1, w.y0, w.y1, 0.02, s.trim); windowPane(b, w.x0, w.x1, w.y0, w.y1, 0); }
    b.pop();
  }
  // corner posts
  b.color(s.trim);
  for (const [px, pz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) b.box(0.2, s.h, 0.2, px, s.h / 2, pz);
  // frames and panes on front/back
  frame(b, s.doorX - s.doorW / 2, s.doorX + s.doorW / 2, 0, s.doorH, hd + 0.02, s.trim, false);
  if (!s.doorOpen) door(b, s.doorX - s.doorW / 2, s.doorX + s.doorW / 2, s.doorH, hd, s.doorCol);
  for (const w of wins) {
    if (w.side === 'front') { frame(b, w.x0, w.x1, w.y0, w.y1, hd + 0.02, s.trim); windowPane(b, w.x0, w.x1, w.y0, w.y1, hd); }
    if (w.side === 'back') { frame(b, w.x0, w.x1, w.y0, w.y1, -hd - 0.02, s.trim); windowPane(b, w.x0, w.x1, w.y0, w.y1, -hd); }
  }
  // ceiling boards (so the inside is not open to the roof void)
  if (s.interior) {
    b.color(0x5e412c);
    b.box(s.w - 0.2, 0.06, s.d - 0.2, 0, s.h - 0.03, 0);
  }
  gableRoof(b, r, s.w, s.d, s.h, s.rise, s.over, s.roof);
  if (s.chimney) {
    b.color(0x6f6a64).box(0.7, s.rise + 1.6, 0.7, -hw + 0.9, s.h + s.rise * 0.55 + 0.4, -hd * 0.3);
    b.color(0x4a4642).box(0.85, 0.2, 0.85, -hw + 0.9, s.h + s.rise * 1.1 + 0.9, -hd * 0.3);
  }
  // porch
  if (s.porch) {
    const pd = 1.8;
    for (let i = 0; i < fn; i++) b.color(shadeHex(0x8a6444, 0.85 + r() * 0.25)).box(s.w / fn * 0.96, 0.1, pd, -hw + (i + 0.5) * s.w / fn, -0.05, hd + pd / 2);
    b.color(s.trim);
    for (const px of [-hw + 0.1, hw - 0.1]) b.box(0.16, s.h, 0.16, px, s.h / 2, hd + pd - 0.1);
    // porch roof
    b.color(shadeHex(s.roof, 0.95));
    b.push(0, s.h - 0.05, hd + pd / 2, -0.18, 0, 0);
    b.box(s.w + 0.4, 0.08, pd + 0.5, 0, 0, 0);
    b.pop();
    cols.push({ x: 0, z: hd + pd / 2, hw: hw, hd: pd / 2, y0: -2, y1: F + s.stilts, floor: true });
    anchors.porch = [s.w * 0.25, F + s.stilts, hd + 0.9];
  }
  // stilts / foundation
  b.pop();
  b.color(0x4a3a2c);
  const legs = s.stilts > 0 ? s.stilts + F : F;
  for (const [px, pz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, -hd], [0, hd]]) b.box(0.26, legs + 1.5, 0.26, px, legs / 2 - 0.75, pz);
  if (s.stilts === 0) { b.color(0x6a655c); b.box(s.w + 0.1, F + 0.6, s.d + 0.1, 0, F / 2 - 0.3, 0); }

  // colliders: four walls with the door gap, floor
  const Y = F + s.stilts;
  const d0 = s.doorX - s.doorW / 2, d1 = s.doorX + s.doorW / 2;
  cols.push({ x: (-hw + d0) / 2, z: hd, hw: (d0 + hw) / 2, hd: 0.12, y0: Y - 0.3, y1: Y + s.h });
  cols.push({ x: (d1 + hw) / 2, z: hd, hw: (hw - d1) / 2, hd: 0.12, y0: Y - 0.3, y1: Y + s.h });
  cols.push({ x: 0, z: -hd, hw: hw, hd: 0.12, y0: Y - 0.3, y1: Y + s.h });
  cols.push({ x: -hw, z: 0, hw: 0.12, hd: hd, y0: Y - 0.3, y1: Y + s.h });
  cols.push({ x: hw, z: 0, hw: 0.12, hd: hd, y0: Y - 0.3, y1: Y + s.h });
  cols.push({ x: 0, z: 0, hw: hw, hd: hd, y0: -3, y1: Y, floor: true });
  anchors.door = [s.doorX, Y, hd + 0.6];
  anchors.inside = [0, Y, 0];
  anchors.floorY = Y;
  return { geo: b.build(), cols, anchors, spec: s };
}

/* ------------------------------------------------------------------ */
/* dock                                                                */
/* ------------------------------------------------------------------ */

/** A pier from (0,0,0) along +Z for `len` metres, deck at y = deckY. */
export function buildPier(len, width = 3, deckY = 1.2, seed = 3, floorBase = -6) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const cols = [];
  const pw = 0.34;
  const n = Math.round(len / pw);
  for (let i = 0; i < n; i++) {
    const z = (i + 0.5) * len / n;
    if (r() < 0.03) continue;   // a missing board or two
    b.color(shadeHex(0x8a6a48, 0.8 + r() * 0.3)).box(width + (r() - 0.5) * 0.15, 0.1, len / n * 0.9, (r() - 0.5) * 0.06, deckY - 0.05, z);
  }
  b.color(0x5a4230);
  b.box(0.18, 0.22, len, -width / 2 + 0.2, deckY - 0.2, len / 2);
  b.box(0.18, 0.22, len, width / 2 - 0.2, deckY - 0.2, len / 2);
  for (let z = 0; z <= len + 0.01; z += 3) {
    for (const sx of [-1, 1]) {
      b.color(0x4d3a2a).cyl(0.16, 0.14, floorBase, deckY + (z % 6 === 0 ? 0.7 : 0.1), 6, true, sx * (width / 2 - 0.05), z);
      if (z % 6 === 0) cols.push({ x: sx * (width / 2 - 0.05), z, hw: 0.18, hd: 0.18, y0: -10, y1: deckY + 0.7 });
    }
  }
  // end rope coils
  b.color(0xc9b27a);
  b.cyl(0.3, 0.3, deckY, deckY + 0.14, 8, true, width / 2 - 0.5, len - 0.6);
  cols.push({ x: 0, z: len / 2, hw: width / 2, hd: len / 2, y0: -8, y1: deckY, floor: true });
  return { geo: b.build(), cols, anchors: { end: [0, deckY, len], deckY } };
}

/* ------------------------------------------------------------------ */
/* props                                                               */
/* ------------------------------------------------------------------ */

export function buildBarrel(b, x = 0, y = 0, z = 0, col = 0x7a5232) {
  b.color(col).lathe([[0.3, 0], [0.36, 0.25], [0.38, 0.45], [0.36, 0.65], [0.3, 0.9]], 8, x, z, 0, t => shadeHex(col, 0.9 + (t * 5 % 1) * 0.2));
  b.color(0x3a3a3a).cyl(0.37, 0.37, y + 0.2, y + 0.26, 8, false, x, z);
  b.color(0x3a3a3a).cyl(0.37, 0.37, y + 0.66, y + 0.72, 8, false, x, z);
  b.color(shadeHex(col, 0.8)).cyl(0.3, 0.3, y + 0.88, y + 0.9, 8, true, x, z);
}

export function buildCrate(b, x = 0, y = 0, z = 0, s = 0.8, col = 0x9a7446, rot = 0) {
  b.push(x, y, z, 0, rot, 0);
  b.color(col).box(s, s, s, 0, s / 2, 0);
  b.color(shadeHex(col, 0.7));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.08, s + 0.02, 0.08, sx * s / 2, s / 2, sz * s / 2);
  b.box(s + 0.02, 0.08, 0.08, 0, s * 0.5, s / 2);
  b.box(0.08, 0.08, s + 0.02, s / 2, s * 0.5, 0);
  b.pop();
}

export function buildLamp(b, x = 0, y = 0, z = 0, glow = true) {
  b.color(0x3a2c20).cyl(0.09, 0.08, y, y + 2.6, 5, true, x, z);
  b.color(0x3a2c20).box(0.7, 0.07, 0.07, x + 0.3, y + 2.55, z);
  b.color(0x2a2a2a).box(0.28, 0.08, 0.28, x + 0.6, y + 2.42, z);
  b.color(glow ? 0xffd27a : 0x8a7a50).box(0.22, 0.3, 0.22, x + 0.6, y + 2.24, z);
  b.color(0x2a2a2a).cone(0.22, y + 2.46, y + 2.62, 4, x + 0.6, z, Math.PI / 4);
}

export function buildRockingChair(b, x = 0, y = 0, z = 0, rot = 0) {
  b.push(x, y, z, 0, rot, 0);
  const c = 0x6a4a32;
  b.color(c);
  // rockers
  for (const sx of [-0.25, 0.25]) {
    for (let i = 0; i < 5; i++) {
      const a0 = -0.6 + i * 0.24, a1 = a0 + 0.24;
      b.beam([sx, 0.6 - Math.cos(a0) * 0.55, Math.sin(a0) * 0.7], [sx, 0.6 - Math.cos(a1) * 0.55, Math.sin(a1) * 0.7], 0.06, 0.06);
    }
  }
  b.box(0.6, 0.06, 0.55, 0, 0.45, 0);
  for (const sx of [-0.25, 0.25]) for (const sz of [-0.22, 0.22]) b.box(0.05, 0.4, 0.05, sx, 0.25, sz);
  // back slats
  b.color(shadeHex(c, 1.1));
  for (let i = 0; i < 5; i++) b.box(0.08, 0.75, 0.04, -0.22 + i * 0.11, 0.85, -0.28);
  b.box(0.62, 0.08, 0.06, 0, 1.24, -0.28);
  // arm rests
  for (const sx of [-0.3, 0.3]) b.box(0.06, 0.05, 0.55, sx, 0.72, 0);
  b.pop();
}

/** The lure board from the reference: a board on a post with hanging tackle. */
export function buildLureBoard(b, x = 0, y = 0, z = 0, rot = 0) {
  b.push(x, y, z, 0, rot, 0);
  b.color(0x4a3526).box(0.22, 3.2, 0.22, 0, 1.6, 0);
  for (let i = 0; i < 6; i++) b.color(shadeHex(0x6b4a32, 0.85 + (i % 3) * 0.1)).box(2.2, 0.26, 0.07, 0, 1.4 + i * 0.28, 0.14);
  // lures
  const hang = (px, py, col, len = 0.3) => {
    b.color(0x333333).box(0.015, 0.12, 0.015, px, py - 0.06, 0.22);
    b.color(col).blob(0.06, len / 2, 0.04, px, py - 0.12 - len / 2, 0.23, 5, 3);
  };
  hang(-0.7, 2.9, 0x8ed84a, 0.36); hang(0.2, 2.95, 0xe8c040, 0.3); hang(0.7, 2.8, 0xe86a3a, 0.26);
  // knife
  b.color(0x3a2a20).box(0.07, 0.3, 0.04, 0.1, 2.0, 0.22);
  b.color(0xc0c4c8).box(0.08, 0.42, 0.02, 0.1, 1.64, 0.22);
  // dynamite bundle
  b.color(0xc02a22);
  for (let i = 0; i < 3; i++) b.cyl(0.05, 0.05, 1.35, 1.8, 6, true, 0.55 + i * 0.1, 0.24);
  b.color(0x222222).box(0.34, 0.05, 0.12, 0.65, 1.6, 0.24);
  // brass knuckle-shaped hook ring and a spare reel
  b.color(0xc8a038).cyl(0.12, 0.12, 1.5, 1.54, 6, true, -0.35, 0.22);
  b.color(0x2a3a5a).cyl(0.12, 0.12, 1.82, 1.92, 8, true, -0.75, 0.22);
  b.pop();
}

export function buildFence(b, x0, z0, x1, z1, y0 = 0) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    b.color(0x5a4230).box(0.12, 1.1, 0.12, x0 + (x1 - x0) * t, y0 + 0.55, z0 + (z1 - z0) * t);
  }
  b.color(0x7a5a3a);
  b.beam([x0, y0 + 0.85, z0], [x1, y0 + 0.85, z1], 0.08, 0.05);
  b.beam([x0, y0 + 0.45, z0], [x1, y0 + 0.45, z1], 0.08, 0.05);
}

export function buildBench(b, x, y, z, rot = 0) {
  b.push(x, y, z, 0, rot, 0);
  b.color(0x7a5836).box(1.6, 0.08, 0.4, 0, 0.45, 0);
  b.color(0x5a4028);
  for (const sx of [-0.65, 0.65]) b.box(0.08, 0.45, 0.36, sx, 0.22, 0);
  b.pop();
}

export function buildCampfire(b, x, y, z) {
  b.color(0x6a6660);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; b.lump(0.18, x + Math.cos(a) * 0.55, y + 0.08, z + Math.sin(a) * 0.55, 0.3, 0.7); }
  b.color(0x4a3222);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.3; b.tube([x + Math.cos(a) * 0.4, y + 0.05, z + Math.sin(a) * 0.4], [x, y + 0.5, z], 0.06, 0.05, 4); }
}

export function buildNetRack(b, x, y, z, rot = 0) {
  b.push(x, y, z, 0, rot, 0);
  b.color(0x5a4230);
  b.box(0.12, 2, 0.12, -1.2, 1, 0); b.box(0.12, 2, 0.12, 1.2, 1, 0); b.box(2.5, 0.1, 0.1, 0, 2, 0);
  b.color(0xc4b48a);
  for (let i = 0; i < 9; i++) b.box(0.02, 1.7, 0.02, -1.1 + i * 0.275, 1.15, 0.02);
  for (let j = 0; j < 7; j++) b.box(2.3, 0.02, 0.02, 0, 0.4 + j * 0.24, 0.02);
  b.pop();
}

/* ------------------------------------------------------------------ */
/* landmarks                                                           */
/* ------------------------------------------------------------------ */

export function buildLighthouse(seed = 9) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const H = 16;
  for (let i = 0; i < 8; i++) {
    const y0 = i * H / 8, y1 = (i + 1) * H / 8;
    b.color(i % 2 ? 0xc8412e : 0xf2ede2).cyl(2.4 - i * 0.12, 2.4 - (i + 1) * 0.12, y0, y1, 10, false);
  }
  b.color(0x2e2e30).cyl(1.8, 1.8, H, H + 0.3, 10, true);
  b.color(0xfff0b0).cyl(1.1, 1.1, H + 0.3, H + 2, 8, false);
  b.color(0x2e2e30).cone(1.5, H + 2, H + 3.3, 8);
  b.color(0x3a3a3c);
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; b.box(0.06, 0.9, 0.06, Math.cos(a) * 1.75, H + 0.75, Math.sin(a) * 1.75); }
  // door
  b.color(0x3a2a20).box(0.9, 1.8, 0.2, 0, 0.9, 2.35);
  return { geo: b.build(), cols: [{ x: 0, z: 0, hw: 2.2, hd: 2.2, y0: -5, y1: H }], lampY: H + 1.2 };
}

export function buildTikiHut(seed = 5) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const W = 4.5;
  b.color(0x8a6a44);
  for (const [px, pz] of [[-W / 2, -W / 2], [W / 2, -W / 2], [-W / 2, W / 2], [W / 2, W / 2]]) b.cyl(0.14, 0.12, 0, 2.6, 6, true, px, pz);
  // counter
  b.color(0x9a7a4e).box(W, 1.05, 0.5, 0, 0.52, W / 2 - 0.2);
  b.color(0xb08a58).box(W + 0.2, 0.08, 0.7, 0, 1.08, W / 2 - 0.2);
  // thatch: layered cones
  for (let i = 0; i < 4; i++) {
    b.color(mixHex(0xc9a860, 0xa8864a, i / 3)).cyl(W * 0.95 - i * 0.7, 0.2, 2.5 + i * 0.5, 4.2 + i * 0.35, 8, true, 0, 0, i * 0.2);
  }
  // hanging bananas and a shell sign
  b.color(0xf2d24a); for (let i = 0; i < 4; i++) b.blob(0.06, 0.18, 0.06, -1.2 + i * 0.1, 2.1, W / 2 + 0.1, 4, 3);
  return { geo: b.build(), cols: [{ x: 0, z: W / 2 - 0.2, hw: W / 2, hd: 0.3, y0: -2, y1: 1.1 }], counter: [0, 0, W / 2 + 0.8] };
}

export function buildIceHut(seed = 6) {
  const h = buildHouse({ w: 4, d: 3.4, h: 2.4, rise: 1.2, seed, wall: 0xa8452e, roof: 0x3a3a40, trim: 0x2e2a28, windows: [{ side: 'left', x: 0 }], doorX: 0, doorW: 1.0, doorOpen: true, floorH: 0.2, chimney: true });
  return h;
}

/** A broken old ship lying on its side: hull ribs and planks. */
export function buildWreck(seed = 1, len = 18, bitten = false) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const ribs = Math.round(len / 1.2);
  b.push(0, 0, 0, 0, 0, 0.5);
  for (let i = 0; i < ribs; i++) {
    const z = -len / 2 + i * len / ribs;
    const w = 3.2 * Math.sin((i + 0.5) / ribs * Math.PI) + 0.6;
    if (r() < 0.2) continue;
    b.color(0x3e3226);
    for (let k = 0; k < 6; k++) {
      const a0 = Math.PI + k / 6 * Math.PI, a1 = Math.PI + (k + 1) / 6 * Math.PI;
      b.beam([Math.cos(a0) * w, Math.sin(a0) * 2.4 + 2.4, z], [Math.cos(a1) * w, Math.sin(a1) * 2.4 + 2.4, z], 0.22, 0.26);
    }
  }
  // remaining hull planks
  for (let k = 0; k < 6; k++) {
    for (let i = 0; i < ribs - 1; i++) {
      if (r() < 0.45) continue;
      if (bitten && i > ribs * 0.35 && i < ribs * 0.6 && k > 1) continue; // the bite
      const z0 = -len / 2 + i * len / ribs, z1 = z0 + len / ribs;
      const w0 = 3.2 * Math.sin((i + 0.5) / ribs * Math.PI) + 0.6, w1 = 3.2 * Math.sin((i + 1.5) / ribs * Math.PI) + 0.6;
      const a = Math.PI + (k + 0.5) / 6 * Math.PI;
      b.color(shadeHex(0x5a4632, 0.8 + r() * 0.3));
      const p0 = [Math.cos(a) * w0, Math.sin(a) * 2.4 + 2.4, z0], p1 = [Math.cos(a) * w1, Math.sin(a) * 2.4 + 2.4, z1];
      b.beam(p0, p1, 0.95, 0.1);
    }
  }
  // mast stub
  b.color(0x4a3a2a).tube([0, 0.4, len * 0.1], [0.3, 6, len * 0.1 + 1], 0.25, 0.18, 6);
  b.pop();
  if (bitten) {
    // giant tooth marks gouged along the gap
    b.color(0xd8d0c0);
    for (let i = 0; i < 7; i++) {
      const z = -len * 0.15 + i * len * 0.035;
      b.push(-2.6, 1.8 + Math.sin(i) * 0.3, z, 0, 0, 0.3);
      b.cone(0.18, 0, 0.9, 4);
      b.pop();
    }
  }
  return b.build();
}

/** The Drowned Gate: an ancient stone arch with glowing runes. */
export function buildGate(seed = 13) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const stone = 0x4a5058;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      b.color(shadeHex(stone, 0.85 + r() * 0.3)).box(1.8 + r() * 0.2, 1.6, 1.8 + r() * 0.2, sx * 4, 0.8 + i * 1.6, 0);
    }
  }
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (i / 6);
    b.color(shadeHex(stone, 0.85 + r() * 0.3));
    b.push(Math.cos(a) * 4, 9.6 + Math.sin(a) * 2.6, 0, 0, 0, a - Math.PI / 2);
    b.box(1.9, 1.7, 1.9);
    b.pop();
  }
  const runes = new MeshBuilder(r);
  runes.color(0x6af0ff);
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) runes.box(0.5, 0.18, 0.05, sx * 4, 1.4 + i * 1.6, 0.93);
  runes.box(1.2, 0.3, 0.05, 0, 12.2, 0.95);
  return { geo: b.build(), glow: runes.build() };
}

/** An enormous scale, taller than a person, half buried in sand. */
export function buildScale(col = 0x6ad0c0) {
  const b = new MeshBuilder(rng(4));
  b.color(col);
  const pts = [];
  for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; pts.push([Math.cos(a) * 0.9, Math.sin(a) * 1.4]); }
  for (let i = 0; i < 8; i++) {
    b.color(shadeHex(col, 0.85 + (i % 2) * 0.2));
    b.card([0, 0, 0], [pts[i][0], pts[i][1], 0.05 * i % 0.1], [pts[i + 1][0], pts[i + 1][1], 0.05]);
  }
  return b.build();
}

/* ------------------------------------------------------------------ */
/* the home cove: Pim's stall, little boats, pots and baskets           */
/* ------------------------------------------------------------------ */

/** Pim's fish stall. Counter along X, customers stand at +Z, the seller at -Z. */
export function buildFishStall(b, r) {
  // counter: planked front, thick top, ice trays full of fish
  for (let i = 0; i < 8; i++) b.color(shadeHex(0x7a5836, 0.85 + r() * 0.25)).box(0.38, 1.0, 0.08, -1.33 + i * 0.38, 0.5, 0.52);
  b.color(0x5a4028).box(3.1, 1.0, 0.9, 0, 0.5, 0.05);
  b.color(0x9a7446).box(3.3, 0.09, 1.2, 0, 1.04, 0.05);
  for (let i = 0; i < 3; i++) {
    b.color(0xd8e8f0).box(0.86, 0.1, 0.72, -1.02 + i * 1.02, 1.13, 0.1);
    b.color(0xf0f8fc); for (let k = 0; k < 6; k++) b.lump(0.05, -1.3 + i * 1.02 + r() * 0.6, 1.2, -0.15 + r() * 0.5, 0.4, 0.6);
    const col = [0x8a9aa8, 0xc88a5a, 0x5a7a4a][i];
    for (let k = 0; k < 3; k++) { b.color(shadeHex(col, 0.9 + r() * 0.2)); b.push(-1.02 + i * 1.02 + (k - 1) * 0.08, 1.23 + k * 0.03, (k - 1) * 0.2, 0, (r() - 0.5) * 0.6, 0); b.blob(0.24, 0.055, 0.075, 0, 0, 0, 6, 2); b.color(shadeHex(col, 0.7)).cone(0.06, -0.3, -0.2, 3); b.pop(); }
  }
  // awning on four posts, red and white canvas
  b.color(0x5a4230);
  for (const px of [-1.55, 1.55]) for (const pz of [-0.55, 0.65]) b.box(0.1, 2.7, 0.1, px, 1.35, pz);
  for (let i = 0; i < 8; i++) {
    b.color(i % 2 ? 0xf2eee2 : 0xc8412e);
    b.push(-1.52 + i * 0.435, 2.62, 0.05, 0.16, 0, 0); b.box(0.44, 0.05, 1.7, 0, 0, 0); b.pop();
    b.push(-1.52 + i * 0.435, 2.36, 0.94, 0, 0, 0); b.box(0.44, 0.34, 0.03, 0, 0, 0); b.pop();
  }
  // a hanging weighing scale with a fish on it
  b.color(0x3a3a3a).box(0.02, 0.3, 0.02, 1.1, 2.35, 0.55);
  b.color(0xb8a060).cyl(0.12, 0.12, 2.12, 2.2, 8, true, 1.1, 0.55);
  b.color(0xe8e0c8).cyl(0.1, 0.1, 2.14, 2.2, 8, false, 1.1, 0.62);
  b.color(0x9a9aa0).cyl(0.2, 0.14, 1.76, 1.8, 8, true, 1.1, 0.55);
  b.color(0x7a8a9a); b.push(1.1, 1.84, 0.55); b.blob(0.2, 0.05, 0.06, 0, 0, 0, 6, 2); b.pop();
  // the back table: a cutting board, a knife, a bucket of scraps
  b.color(0x6a4a30).box(2.4, 0.08, 0.6, 0, 0.88, -0.95);
  for (const px of [-1.1, 1.1]) b.box(0.08, 0.88, 0.5, px, 0.44, -0.95);
  b.color(0xc8a878).box(0.7, 0.05, 0.4, -0.5, 0.95, -0.95);
  b.color(0xc0c4c8).box(0.26, 0.012, 0.05, -0.45, 0.98, -0.9); b.color(0x3a2a20).box(0.12, 0.02, 0.05, -0.68, 0.98, -0.9);
  b.color(0x8a8a90).lathe([[0.16, 0], [0.19, 0.3], [0.2, 0.32]], 8, 0.7, -0.95); b.push(0, 0.93, 0); b.pop();
}

/** A little clinker rowboat (a prop, not a vehicle). Bow along +Z. */
export function buildRowboat(b, r, col = 0x3a6a8a, flip = false) {
  b.push(0, flip ? 0.5 : 0, 0, 0, 0, flip ? Math.PI : 0);
  const L = 3.4, W = 0.75;
  for (let k = 0; k < 4; k++) {
    const y = 0.08 + k * 0.1, w = W * (0.55 + k * 0.15);
    b.color(shadeHex(k === 3 ? 0xe8e0cc : col, 0.9 + r() * 0.15));
    for (const s of [-1, 1]) {
      b.beam([s * w * 0.35, y, -L / 2 + 0.2], [s * w, y, -L * 0.15], 0.05, 0.1);
      b.beam([s * w, y, -L * 0.15], [s * w, y, L * 0.2], 0.05, 0.1);
      b.beam([s * w, y, L * 0.2], [0, y + 0.05, L / 2], 0.05, 0.1);
    }
  }
  b.color(shadeHex(col, 0.7)).box(W * 0.9, 0.05, L * 0.62, 0, 0.06, -0.05);
  b.color(0x7a5836); for (const z of [-0.8, 0.4]) b.box(W * 1.7, 0.05, 0.26, 0, 0.36, z);
  b.color(0x9a7446); b.beam([0.4, 0.4, 0.4], [1.0, 0.25, -1.4], 0.05, 0.05); b.box(0.12, 0.02, 0.5, 1.05, 0.25, -1.6);
  b.pop();
}

/** A stack of crab pots: wooden frames wrapped in net. */
export function buildCrabPots(b, r, n = 3) {
  for (let i = 0; i < n; i++) {
    const y = i < 2 ? 0 : 0.5, x = i < 2 ? i * 0.7 - 0.35 : 0;
    b.push(x, y, 0, 0, (r() - 0.5) * 0.3, 0);
    b.color(0x6a4a30);
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.25, 0.25]) b.box(0.04, 0.48, 0.04, sx, 0.24, sz);
    b.box(0.64, 0.04, 0.54, 0, 0.48, 0); b.box(0.64, 0.04, 0.54, 0, 0.02, 0);
    b.color(0xc4b48a);
    for (let k = 0; k < 6; k++) b.box(0.006, 0.44, 0.52, -0.25 + k * 0.1, 0.25, 0);
    for (let k = 0; k < 4; k++) b.box(0.62, 0.006, 0.52, 0, 0.1 + k * 0.1, 0);
    b.color(0xe0402a).blob(0.07, 0.07, 0.07, 0.3, 0.52, 0.25, 5, 3);
    b.pop();
  }
}

/** A woven fish basket, with the day's catch sticking out. */
export function buildFishBasket(b, r, x = 0, z = 0) {
  b.color(0xb08a50).lathe([[0.2, 0], [0.26, 0.12], [0.3, 0.32], [0.32, 0.36]], 9, x, z, 0, t => shadeHex(0xb08a50, 0.8 + ((t * 7) % 1) * 0.35));
  const cols = [0x8a9aa8, 0x6a8a5a, 0xc88a5a];
  for (let k = 0; k < 4; k++) { b.color(cols[k % 3]); b.push(x + (r() - 0.5) * 0.25, 0.36, z + (r() - 0.5) * 0.25, 0, r() * 6, 1.1 + r() * 0.3); b.blob(0.18, 0.04, 0.055, 0, 0, 0, 5, 2); b.pop(); }
}

/** A firewood pile and a chopping block with the hand axe buried in it. */
export function buildWoodpile(b, r) {
  b.color(0x6a4a30);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) {
    b.color(shadeHex(0x7a5838, 0.8 + r() * 0.3));
    b.push(-0.9 + i * 0.3 + row * 0.15, 0.13 + row * 0.24, 0, Math.PI / 2, 0, 0); b.cyl(0.13, 0.13, -0.6, 0.6, 6, true); b.pop();
    b.color(0xd8b888).cyl(0.1, 0.1, 0.6, 0.61, 6, false, -0.9 + i * 0.3 + row * 0.15, 0.13 + row * 0.24);
  }
  // the block and the axe
  b.color(0x6a4a30).cyl(0.34, 0.36, 0, 0.55, 8, true, 1.4, 0.2);
  b.color(0xc8a070).cyl(0.3, 0.3, 0.55, 0.56, 8, false, 1.4, 0.2);
  b.push(1.4, 0.56, 0.2, 0, 0.5, -0.5);
  b.color(0x7a5836).cyl(0.03, 0.035, 0, 0.75, 6, true);
  b.color(0x8a9098).box(0.04, 0.16, 0.22, 0, 0.02, 0.06);
  b.pop();
}

/**
 * The trophy bookcase. Built at the origin, back against -Z, front at +Z.
 * Returns the cubbies in local space: { S: [...], L: [...] } with the floor
 * point of each cubby, its width and its height.
 */
export function buildBookcase(b, r, W = 4.0, H = 2.62, D = 0.46) {
  const wood = 0x5a3a24, edge = 0x6e4a2e;
  const S = [], L = [];
  // carcass
  b.color(wood).box(W, H, 0.05, 0, H / 2, -D / 2 + 0.025);
  for (const sx of [-1, 1]) b.color(edge).box(0.08, H, D, sx * (W / 2 - 0.04), H / 2, 0);
  b.color(edge).box(W, 0.1, D, 0, 0.05, 0);
  b.color(edge).box(W + 0.12, 0.1, D + 0.08, 0, H - 0.05, 0.02);
  // crown moulding and a carved board
  b.color(0x4a2e1c).box(W + 0.2, 0.06, D + 0.12, 0, H + 0.02, 0.03);
  // the big bottom shelf (four large spaces) and four rows of ten cubbies
  const rows = [0.1, 0.86, 1.3, 1.74, 2.18];
  b.color(edge);
  for (let i = 1; i < rows.length; i++) b.box(W - 0.1, 0.05, D - 0.02, 0, rows[i] - 0.025, 0.01);
  // large bay dividers
  for (let k = 1; k < 4; k++) b.box(0.05, rows[1] - 0.1, D - 0.04, -W / 2 + k * W / 4, (rows[1] + 0.1) / 2, 0);
  for (let k = 0; k < 4; k++) L.push({ x: -W / 2 + (k + 0.5) * W / 4, y: 0.1, z: 0.02, w: W / 4 - 0.1, h: rows[1] - 0.14 });
  // small cubby dividers
  const cw = (W - 0.1) / 10;
  for (let row = 1; row < rows.length; row++) {
    const y0 = rows[row], y1 = row + 1 < rows.length ? rows[row + 1] - 0.05 : H - 0.1;
    for (let k = 1; k < 10; k++) b.color(shadeHex(edge, 0.9)).box(0.03, y1 - y0, D - 0.06, -W / 2 + 0.05 + k * cw, (y0 + y1) / 2, 0);
    for (let k = 0; k < 10; k++) S.push({ x: -W / 2 + 0.05 + (k + 0.5) * cw, y: y0, z: 0.02, w: cw - 0.05, h: y1 - y0 - 0.02 });
  }
  // top of the case: three big display spots
  for (let k = 0; k < 3; k++) L.push({ x: -W / 2 + (k + 0.5) * W / 3, y: H + 0.05, z: 0.02, w: W / 3 - 0.2, h: 0.55, top: true });
  // a row of real books in the top corner cubby so it reads as a bookcase
  S.pop();
  for (let k = 0; k < 7; k++) {
    b.color([0x7a2a22, 0x2a4a6a, 0x3a5a2a, 0x8a6a2a, 0x5a2a4a][k % 5]);
    b.box(0.045, 0.24 + r() * 0.08, 0.26, W / 2 - 0.12 - k * 0.05, rows[4] + 0.14, -0.04);
  }
  return { S, L, W, H, D };
}

/* ------------------------------------------------------------------ */
/* painted signs (text is a canvas texture on a wooden board)           */
/* ------------------------------------------------------------------ */

export function signBoard(text, w = 2.4, h = 0.6, opts = {}) {
  const g = new THREE.Group();
  const b = new MeshBuilder(rng(text.length));
  b.color(opts.board || 0x5a3e28).box(w + 0.16, h + 0.16, 0.08, 0, 0, -0.02);
  const frameMesh = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  frameMesh.castShadow = true;
  g.add(frameMesh);
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * h / w);
  const cx = cv.getContext('2d');
  if (cx) {
    cx.fillStyle = opts.bg || '#8a6444';
    cx.fillRect(0, 0, cv.width, cv.height);
    // plank lines
    cx.strokeStyle = 'rgba(40,24,12,0.35)'; cx.lineWidth = 3;
    for (let y = cv.height / 3; y < cv.height; y += cv.height / 3) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(cv.width, y); cx.stroke(); }
    cx.fillStyle = opts.ink || '#f3e6c4';
    cx.font = `700 ${Math.round(cv.height * 0.56)}px "Bree Serif", Georgia, serif`;
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = 'rgba(0,0,0,0.35)'; cx.shadowOffsetY = 3;
    cx.fillText(text, cv.width / 2, cv.height / 2 + 2, cv.width * 0.92);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
  face.position.z = 0.025;
  g.add(face);
  return g;
}
