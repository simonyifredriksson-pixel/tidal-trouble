/* FloraArt.js - trees, bushes, grass, reeds, rocks and driftwood.
   Each builder returns a BufferGeometry at real-world size with its base at
   the origin. The scatter instances them, so every function here runs a few
   times at load and never again.

   The look follows the reference: tall dark pines built from drooping,
   jagged tiers; exaggerated bright grass blades; big faceted rocks. Colour
   carries a slight top-to-bottom ramp inside every tier so a flat-shaded
   tree still reads as having volume. */

import { MeshBuilder, mixHex, shadeHex } from './Geo.js?v=1790192871';
import { rng, TAU } from '../core/Util.js?v=1790192871';

/* ---------------- pines ---------------- */
export function buildPine(seed, snow = false) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const H = 11 + r() * 6;
  // trunk
  b.color(0x4a3526, 0.1).setSway(0).cyl(0.42, 0.18, 0, H * 0.72, 6, false);
  // tiers from the bottom up, each a jagged skirt of drooping points
  const tiers = 5 + Math.floor(r() * 2);
  const dark = snow ? 0x2c4a36 : 0x24452c, light = snow ? 0x3f6a4b : 0x3a6b3a;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = H * (0.22 + t * 0.62);
    const rad = (1 - t) * 3.4 + 0.8 + r() * 0.4;
    const top = y + 2.6 - t * 0.6;
    const pts = 7 + Math.floor(r() * 3);
    const col = mixHex(dark, light, 0.2 + t * 0.6 + (r() - 0.5) * 0.2);
    for (let k = 0; k < pts; k++) {
      const a0 = (k / pts) * TAU + i * 0.7;
      const a1 = ((k + 1) / pts) * TAU + i * 0.7;
      const am = (a0 + a1) / 2;
      const rr = rad * (0.85 + r() * 0.3);
      const droop = y - 0.9 - r() * 0.6;
      const tip = [Math.cos(am) * rr, droop, Math.sin(am) * rr];
      const e0 = [Math.cos(a0) * rad * 0.55, y, Math.sin(a0) * rad * 0.55];
      const e1 = [Math.cos(a1) * rad * 0.55, y, Math.sin(a1) * rad * 0.55];
      const apex = [0, top, 0];
      b.setSway(0.25 + t * 0.35);
      b.color(shadeHex(col, 0.92 + r() * 0.16));
      b.triO(apex, e0, tip, null, [0, y, 0]);
      b.triO(apex, tip, e1, null, [0, y, 0]);
      // underside, darker
      b.color(shadeHex(col, 0.6));
      b.triO(e0, e1, tip, [0, -1, 0]);
      if (snow && r() < 0.8) {
        b.color(0xf2f7fa);
        const s0 = [e0[0] * 0.9 + tip[0] * 0.1, y + 0.12, e0[2] * 0.9 + tip[2] * 0.1];
        const s1 = [apex[0] * 0.6 + tip[0] * 0.4, top * 0.6 + droop * 0.4 + 0.1, apex[2] * 0.6 + tip[2] * 0.4];
        const s2 = [e1[0] * 0.9 + tip[0] * 0.1, y + 0.12, e1[2] * 0.9 + tip[2] * 0.1];
        b.triO([0, top * 0.9 + y * 0.1 + 0.05, 0], s0, s1, [0, 1, 0]);
        b.triO([0, top * 0.9 + y * 0.1 + 0.05, 0], s1, s2, [0, 1, 0]);
      }
    }
  }
  // crown spike
  b.color(snow ? 0xeef4f7 : light).setSway(0.7).cone(0.7, H * 0.84, H + 1.2, 5);
  return b.build();
}

/* ---------------- broadleaf and birch ---------------- */
export function buildBroadleaf(seed, birch = false) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const H = birch ? 7 + r() * 3 : 6 + r() * 3;
  b.setSway(0).color(birch ? 0xe9e4d6 : 0x5a3f2a, 0.08).cyl(0.34, 0.2, 0, H * 0.75, 6, false);
  if (birch) {
    b.color(0x2e2a26);
    for (let i = 0; i < 6; i++) {
      const y = 0.6 + i * H * 0.1 + r() * 0.3, a = r() * TAU;
      b.box(0.08, 0.06, 0.3, Math.cos(a) * 0.3, y, Math.sin(a) * 0.3);
    }
  }
  // a couple of limbs
  for (let i = 0; i < 3; i++) {
    const a = r() * TAU, y = H * (0.45 + r() * 0.2);
    b.color(birch ? 0xd8d2c2 : 0x4d3624).tube([0, y, 0], [Math.cos(a) * 1.4, y + 1.2, Math.sin(a) * 1.4], 0.12, 0.07, 4);
  }
  const green = birch ? 0x9cbf4a : 0x4f8a34;
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = i === 0 ? 0 : 1 + r() * 1.3;
    const y = H * 0.78 + (i === 0 ? 0.9 : r() * 1.4 - 0.2);
    const rad = (i === 0 ? 2.4 : 1.5 + r() * 0.8) * (birch ? 0.8 : 1);
    b.setSway(0.3).color(mixHex(green, shadeHex(green, 1.25), r()), 0.05);
    b.lump(rad, Math.cos(a) * d, y, Math.sin(a) * d, 0.28, 0.85, 0);
  }
  return b.build();
}

/* ---------------- palm ---------------- */
export function buildPalm(seed) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const H = 7 + r() * 4, lean = 0.25 + r() * 0.7, dir = r() * TAU;
  const segs = 7;
  let prev = [0, 0, 0];
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const p = [Math.cos(dir) * lean * t * t * 2, H * t, Math.sin(dir) * lean * t * t * 2];
    b.setSway(t * 0.3).color(i % 2 ? 0x8a6a45 : 0x7a5c3a).tube(prev, p, 0.3 - t * 0.1, 0.28 - t * 0.1, 6, false);
    prev = p;
  }
  const top = prev;
  b.color(0x5a4028).lump(0.5, top[0], top[1], top[2], 0.1);
  const fronds = 8;
  for (let k = 0; k < fronds; k++) {
    const a = (k / fronds) * TAU + r() * 0.3;
    const L = 3.6 + r() * 1.2;
    const col = mixHex(0x3f8f36, 0x6cb33e, r());
    b.color(col).setSway(0.9);
    const steps = 4;
    let p0 = top;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const p1 = [top[0] + Math.cos(a) * L * t, top[1] + 1.1 * t - 1.7 * t * t, top[2] + Math.sin(a) * L * t];
      const w = (1 - t * 0.7) * 0.7;
      const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      b.card(p0, [p1[0] + px, p1[1] - 0.15, p1[2] + pz], p1);
      b.card(p0, p1, [p1[0] - px, p1[1] - 0.15, p1[2] - pz]);
      p0 = p1;
    }
  }
  // coconuts
  b.color(0x6b4a26).setSway(0.2);
  for (let i = 0; i < 3; i++) b.lump(0.28, top[0] + Math.cos(i * 2.1) * 0.35, top[1] - 0.35, top[2] + Math.sin(i * 2.1) * 0.35, 0.1);
  return b.build();
}

/* ---------------- dead tree / bare sapling ---------------- */
export function buildDead(seed, dark = false) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const H = 4 + r() * 5;
  const col = dark ? 0x23252a : 0x3b2e24;
  b.setSway(0).color(col).cyl(0.22, 0.06, 0, H, 5, false);
  const branch = (p, dir, len, rad, depth) => {
    const q = [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len];
    b.setSway(0.1 * depth).color(col).tube(p, q, rad, rad * 0.5, 4, false);
    if (depth < 3) {
      const n = 2;
      for (let i = 0; i < n; i++) {
        const a = r() * TAU;
        const nd = [dir[0] * 0.6 + Math.cos(a) * 0.6, dir[1] * 0.6 + 0.35, dir[2] * 0.6 + Math.sin(a) * 0.6];
        const l = Math.hypot(...nd);
        branch(q, [nd[0] / l, nd[1] / l, nd[2] / l], len * 0.62, rad * 0.55, depth + 1);
      }
    }
  };
  for (let i = 0; i < 4; i++) {
    const y = H * (0.35 + i * 0.15), a = r() * TAU;
    branch([0, y, 0], [Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8], 1.3 + r(), 0.09, 1);
  }
  return b.build();
}

/* ---------------- bushes, ferns, grass ---------------- */
export function buildBush(seed, tone = 0x3f7a2e) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = r() * 0.8;
    b.setSway(0.2).color(mixHex(tone, shadeHex(tone, 1.3), r()));
    b.lump(0.6 + r() * 0.5, Math.cos(a) * d, 0.5 + r() * 0.3, Math.sin(a) * d, 0.3, 0.8);
  }
  return b.build();
}

export function buildFern(seed) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.4, L = 1 + r() * 0.5;
    const col = mixHex(0x3e7a2c, 0x69a83c, r());
    const tip = [Math.cos(a) * L, 0.55 + r() * 0.2, Math.sin(a) * L];
    const mid = [Math.cos(a) * L * 0.5, 0.75, Math.sin(a) * L * 0.5];
    const px = -Math.sin(a) * 0.22, pz = Math.cos(a) * 0.22;
    b.color(col).setSway(0.6);
    b.card([0, 0, 0], [mid[0] + px, mid[1], mid[2] + pz], tip);
    b.card([0, 0, 0], tip, [mid[0] - px, mid[1], mid[2] - pz]);
  }
  return b.build();
}

/** The big exaggerated grass clumps from the reference - bright, long, wide blades. */
export function buildGrassTuft(seed, palette = 0) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const bases = [[0x5f9a2e, 0x9fd04a], [0x4f8a2a, 0x86c043], [0x8aa84a, 0xc5d86a], [0x6f9e3e, 0xa9cc5e]][palette];
  const n = 7 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = r() * 0.35;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = 0.55 + r() * 0.75;
    const lean = 0.25 + r() * 0.35, la = r() * TAU;
    const w = 0.07 + r() * 0.06;
    const px = -Math.sin(la) * w, pz = Math.cos(la) * w;
    const tip = [x + Math.cos(la) * lean, h, z + Math.sin(la) * lean];
    const lo = mixHex(bases[0], bases[1], 0.1), hi = mixHex(bases[0], bases[1], 0.55 + r() * 0.45);
    const L = b.col;
    b.color(lo); const cLo = b.col; b.color(hi); const cHi = b.col; b.col = L;
    b.tri([x - px, 0, z - pz], [x + px, 0, z + pz], tip, [cLo, cLo, cHi], [0, 0, 1]);
    b.tri([x - px, 0, z - pz], tip, [x + px, 0, z + pz], [cLo, cHi, cLo], [0, 1, 0]);
  }
  return b.build();
}

export function buildReeds(seed) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const n = 8 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = r() * 0.6;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, h = 1.3 + r() * 1.1;
    const lx = (r() - 0.5) * 0.3, lz = (r() - 0.5) * 0.3;
    b.color(mixHex(0x6e8a3a, 0xa8b85a, r())).setSway(0);
    b.card([x - 0.03, 0, z], [x + 0.03, 0, z], [x + lx, h, z + lz]);
    if (r() < 0.45) {
      b.setSway(0.8).color(0x5a3a22).cyl(0.06, 0.06, h - 0.05, h + 0.3, 4, true, x + lx, z + lz);
    }
  }
  return b.build();
}

export function buildFlowers(seed) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const cols = [0xf2d24a, 0xf07a8a, 0xffffff, 0xb08ae0, 0xf29a3a];
  const n = 5 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = r() * 0.6, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.3 + r() * 0.3;
    b.color(0x4f8a2a).setSway(0.3).card([x - 0.02, 0, z], [x + 0.02, 0, z], [x, h, z]);
    b.color(r.pick(cols)).setSway(0.5).lump(0.07, x, h, z, 0.2, 0.6);
  }
  return b.build();
}

/* ---------------- rocks and logs ---------------- */
export function buildRock(seed, tone = 0x7c7d78, moss = true) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const s = i === 0 ? 1 : 0.4 + r() * 0.4;
    b.color(mixHex(tone, shadeHex(tone, 0.8), r()));
    b.lump(1.2 * s, i === 0 ? 0 : (r() - 0.5) * 1.8, 0.35 * s, i === 0 ? 0 : (r() - 0.5) * 1.8, 0.28, 0.7);
  }
  if (moss) {
    // recolour upward-facing faces green
    for (let t = 0; t < b.P.length; t += 9) {
      const ay = b.P[t + 1], by = b.P[t + 4], cy = b.P[t + 7];
      const ux = b.P[t + 3] - b.P[t], uy = by - ay, uz = b.P[t + 5] - b.P[t + 2];
      const vx = b.P[t + 6] - b.P[t], vy = cy - ay, vz = b.P[t + 8] - b.P[t + 2];
      const ny = uz * vx - ux * vz, l = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx) || 1;
      if (ny / l > 0.75 && r() < 0.8) {
        for (let k = 0; k < 3; k++) { b.C[t + k * 3] = 0.12; b.C[t + k * 3 + 1] = 0.25; b.C[t + k * 3 + 2] = 0.06; }
      }
    }
  }
  return b.build();
}

export function buildSpire(seed) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = r() * 1.5, h = 3 + r() * 6;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    b.color(mixHex(0x1c1f25, 0x33373f, r()));
    b.push(x, 0, z, (r() - 0.5) * 0.4, r() * TAU, (r() - 0.5) * 0.4);
    b.cyl(0.6 + r() * 0.5, 0.05, -0.5, h, 5);
    b.pop();
  }
  return b.build();
}

export function buildLog(seed, bleached = true) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const L = 2.5 + r() * 2.5, R = 0.22 + r() * 0.15;
  b.color(bleached ? 0xb8ab94 : 0x5a4230, 0.06);
  b.tube([-L / 2, R, 0], [L / 2, R * 0.9, 0], R, R * 0.8, 6, true);
  b.color(bleached ? 0xa99a82 : 0x4d3828).tube([L * 0.1, R * 1.1, 0], [L * 0.3, R + 0.7, 0.6], R * 0.35, R * 0.15, 4);
  return b.build();
}

export function buildStump(seed) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  b.color(0x5a4230).cyl(0.5, 0.42, 0, 0.6, 7, true);
  b.color(0xc9a878).cyl(0.4, 0.4, 0.6, 0.62, 7, true);
  return b.build();
}

export function buildCoral(seed) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const cols = [0xf07a6a, 0xf2b84a, 0xb07ad0, 0x5ac0c0, 0xf09ab8];
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = r() * 1.4, x = Math.cos(a) * d, z = Math.sin(a) * d;
    b.color(r.pick(cols));
    if (r() < 0.5) b.lump(0.4 + r() * 0.5, x, 0.3, z, 0.35, 0.8);
    else for (let k = 0; k < 4; k++) {
      const aa = r() * TAU;
      b.tube([x, 0, z], [x + Math.cos(aa) * 0.5, 0.8 + r() * 0.8, z + Math.sin(aa) * 0.5], 0.12, 0.06, 4);
    }
  }
  return b.build();
}

export function buildIceChunk(seed) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  b.color(0xdcecf4).lump(1 + r() * 1.2, 0, 0.3, 0, 0.3, 0.55);
  return b.build();
}
