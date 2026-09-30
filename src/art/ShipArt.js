/* ShipArt.js - what makes a pirate galley a pirate galley, and the cargo on
   everyone's deck.

   The galley is the Wanderer's frame dressed for the job: a raised stern
   castle with lit windows, gun ports and six black cannons, a skull on the
   bow, and on the main mast a flag big enough to read a mile off - a white
   skull and crossed bones on black. The boarding bridge is a plank walk on
   a hinge with iron spikes under the far end that bite into your rail. */

import * as THREE from '../../lib/three.module.js';
import { MeshBuilder, shadeHex } from './Geo.js';
import { MAT } from './Materials.js';
import { rng, TAU } from '../core/Util.js';

const mesh = (b, mat = MAT.solid, shadow = true) => { const m = new THREE.Mesh(b.build(), mat); m.castShadow = shadow; m.receiveShadow = shadow; return m; };

/** A skull and crossed bones, facing +Z, about 1 unit tall. `col` the bone, `hole` the eyes. */
export function skullShape(b, x, y, z, s = 1, col = 0xf0ece0, hole = 0x141210, both = true) {
  const faces = both ? [1, -1] : [1];
  for (const f of faces) {
    const zz = z + f * 0.012 * s;
    b.color(col);
    // cranium: a rounded polygon
    const n = 12, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push([x + Math.cos(a) * 0.36 * s, y + 0.08 * s + Math.sin(a) * 0.34 * s]); }
    for (let i = 0; i < n; i++) b.card([x, y + 0.08 * s, zz], [pts[i][0], pts[i][1], zz], [pts[(i + 1) % n][0], pts[(i + 1) % n][1], zz]);
    // jaw
    b.card([x - 0.2 * s, y - 0.18 * s, zz], [x + 0.2 * s, y - 0.18 * s, zz], [x + 0.17 * s, y - 0.38 * s, zz], [x - 0.17 * s, y - 0.38 * s, zz]);
    // crossed bones behind it
    for (const d of [-1, 1]) {
      const a0 = [x - 0.62 * s * d, y - 0.58 * s], a1 = [x + 0.62 * s * d, y + 0.46 * s];
      const zb = zz - f * 0.004 * s;
      const w = 0.07 * s, dx = a1[0] - a0[0], dy = a1[1] - a0[1], l = Math.hypot(dx, dy), nx = -dy / l * w, ny = dx / l * w;
      b.card([a0[0] + nx, a0[1] + ny, zb], [a1[0] + nx, a1[1] + ny, zb], [a1[0] - nx, a1[1] - ny, zb], [a0[0] - nx, a0[1] - ny, zb]);
      for (const e of [a0, a1]) for (const k of [-1, 1]) {
        const cx = e[0] + nx * k * 1.2, cy = e[1] + ny * k * 1.2;
        for (let i = 0; i < 6; i++) { const u = i / 6 * TAU, v = (i + 1) / 6 * TAU; b.card([cx, cy, zb], [cx + Math.cos(u) * 0.075 * s, cy + Math.sin(u) * 0.075 * s, zb], [cx + Math.cos(v) * 0.075 * s, cy + Math.sin(v) * 0.075 * s, zb]); }
      }
    }
    // eyes and nose, just in front
    const ze = zz + f * 0.006 * s;
    b.color(hole);
    for (const ex of [-0.14, 0.14]) {
      for (let i = 0; i < 7; i++) { const u = i / 7 * TAU, v = (i + 1) / 7 * TAU; b.card([x + ex * s, y + 0.06 * s, ze], [x + ex * s + Math.cos(u) * 0.09 * s, y + 0.06 * s + Math.sin(u) * 0.1 * s, ze], [x + ex * s + Math.cos(v) * 0.09 * s, y + 0.06 * s + Math.sin(v) * 0.1 * s, ze]); }
    }
    b.card([x, y - 0.04 * s, ze], [x - 0.05 * s, y - 0.14 * s, ze], [x + 0.05 * s, y - 0.14 * s, ze]);
    for (let k = -2; k <= 2; k++) b.card([x + k * 0.065 * s - 0.012 * s, y - 0.2 * s, ze], [x + k * 0.065 * s + 0.012 * s, y - 0.2 * s, ze], [x + k * 0.065 * s + 0.012 * s, y - 0.33 * s, ze], [x + k * 0.065 * s - 0.012 * s, y - 0.33 * s, ze]);
  }
}

/** The flag: a black field with a skull on both faces. Hung from its left edge at the origin, flying along +X. */
export function skullFlag(w = 3.4, h = 2.2) {
  const G = new THREE.Group();
  const strips = 5;
  for (let i = 0; i < strips; i++) {
    const b = new MeshBuilder(rng(i + 5));
    const x0 = i * w / strips, x1 = (i + 1) * w / strips;
    b.color(0x141212).card([0, -h / 2, 0], [x1 - x0, -h / 2, 0], [x1 - x0, h / 2, 0], [0, h / 2, 0]);
    // the torn fly end
    if (i === strips - 1) { b.color(0x141212); for (let k = 0; k < 4; k++) b.card([x1 - x0, -h / 2 + k * h / 4, 0], [x1 - x0 + 0.25, -h / 2 + (k + 0.4) * h / 4, 0], [x1 - x0, -h / 2 + (k + 1) * h / 4, 0]); }
    // this strip's slice of the skull
    const sb = new MeshBuilder(rng(9));
    skullShape(sb, w * 0.48 - x0, 0.05, 0, h * 0.62);
    const strip = new THREE.Group();
    strip.add(mesh(b, MAT.solidDS));
    // clip the skull to the strip: only the strip that holds the middle carries it (the flag is short enough)
    if (i === 2 || i === 1 || i === 3) {
      const sk = mesh(sb, MAT.solidDS, false);
      sk.visible = i === 2;
      strip.add(sk);
    }
    strip.position.x = x0;
    G.add(strip);
    G.userData.strips = G.userData.strips || [];
    G.userData.strips.push(strip);
  }
  // the skull drawn whole on its own layer, so the strips can wave without cutting it
  const whole = new MeshBuilder(rng(9));
  skullShape(whole, w * 0.48, 0.05, 0, h * 0.62);
  const wk = mesh(whole, MAT.solidDS, false); wk.name = 'skull';
  G.add(wk);
  for (const s of G.userData.strips) s.children.slice(1).forEach(c => c.visible = false);
  return G;
}
/** Flutter the flag in the wind (call each frame). */
export function waveFlag(flag, t, wind = 1) {
  const S = flag.userData.strips;
  if (!S) return;
  let a = 0;
  S.forEach((s, i) => { const r = Math.sin(t * 3.2 - i * 0.9) * 0.16 * wind * (i / S.length + 0.3); s.rotation.y = r; a += r; });
  const sk = flag.getObjectByName('skull'); if (sk) sk.rotation.y = a / S.length * 0.6;
}

/** Everything the galley carries on top of the Wanderer's frame. Local boat frame: bow +Z, port +X, deck at D. */
export function galleyDress(H, D) {
  const G = new THREE.Group();
  const r = rng(66);
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  const hl = H.hl, hw = H.hw;
  // the stern castle: a raised deck with a carved rail and a row of lit windows
  const zc = -hl + 2.0;
  b.color(0x2a1e18).box(hw * 1.7, 1.5, 3.4, 0, D + 0.75, zc);
  b.color(0x1a1412).box(hw * 1.8, 0.14, 3.6, 0, D + 1.52, zc);
  b.color(0x6a1a18); for (let i = 0; i < 9; i++) b.box(0.08, 0.6, 0.08, -hw * 0.85 + i * hw * 0.21, D + 1.85, zc + 1.7);
  b.box(hw * 1.8, 0.08, 0.1, 0, D + 2.15, zc + 1.7);
  for (let i = 0; i < 4; i++) g.color(0xffb050).box(0.42, 0.34, 0.03, -hw * 0.6 + i * hw * 0.4, D + 0.85, zc - 1.72);
  // gun ports and cannons, three a side
  G.userData.guns = [];
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = -1.5 + k * 3.2, x = side * (hw * 0.88);
    b.color(0x0e0a08).box(0.05, 0.42, 0.55, x + side * 0.1, D + 0.5, z);
    b.color(0x3a2a1c).box(0.6, 0.22, 0.5, x - side * 0.2, D + 0.13, z);
    b.color(0x1a1a1c).push(x - side * 0.1, D + 0.42, z, 0, 0, side * Math.PI / 2); b.cyl(0.16, 0.12, -0.5, 0.55, 8, true); b.pop();
    b.color(0x2a2a2e).blob(0.16, 0.16, 0.16, x - side * 0.6, D + 0.42, z, 6, 3);
    for (const zz of [-0.2, 0.2]) b.color(0x4a3222).cyl(0.13, 0.13, -0.05, 0.05, 7, true, x - side * 0.2, z + zz);
    G.userData.guns.push({ side, x: x + side * 0.55, y: D + 0.42, z });
  }
  // a skull on the bow, and lanterns
  const fb = new MeshBuilder(rng(7));
  skullShape(fb, 0, 0, 0, 0.9, 0xe8e0cc, 0x1a1210, false);
  const fig = mesh(fb, MAT.solidDS); fig.position.set(0, D + 0.3, hl + 0.3); fig.rotation.x = -0.25; G.add(fig);
  for (const [x, z] of [[hw * 0.8, zc + 1.7], [-hw * 0.8, zc + 1.7], [0, hl - 0.8]]) {
    b.color(0x1a1a1a).box(0.06, 0.5, 0.06, x, D + (z > 0 ? 1.0 : 2.4), z);
    g.color(0xffc060).blob(0.1, 0.13, 0.1, x, D + (z > 0 ? 1.3 : 2.7), z, 6, 3);
  }
  // barrels of powder and a pile of shot by the main mast
  for (let i = 0; i < 3; i++) { b.color(0x4a3220).cyl(0.26, 0.3, D, D + 0.7, 8, true, 1.2 + i * 0.55, 1.2); b.color(0x2a2a2a).cyl(0.31, 0.31, D + 0.2, D + 0.26, 8, false, 1.2 + i * 0.55, 1.2); }
  b.color(0x1a1a1c); for (let i = 0; i < 6; i++) b.blob(0.13, 0.13, 0.13, -1.3 + (i % 3) * 0.27, D + 0.13 + Math.floor(i / 3) * 0.2, 1.4, 5, 3);
  G.add(mesh(b));
  const gm = mesh(g, MAT.glow, false); G.add(gm);
  // the flag, at the top of the main mast
  const mast = H.masts.find(m => m[1] > 0) || H.masts[0];
  const flag = skullFlag(3.6, 2.3);
  flag.position.set(mast[0] + 0.2, D + 11 + 1.3, mast[1]);
  flag.rotation.y = Math.PI / 2;
  G.add(flag);
  b.color(0x3a2a1c);
  G.userData.flag = flag;
  G.userData.castle = { z: zc, y: D + 1.52, hw: hw * 0.85, hd: 1.7 };
  // the corvus pole, forward: a tall post with a pulley at the top, and the hinge block at its foot
  const zp = hl - 2.6, pb = new MeshBuilder(rng(12));
  pb.color(0x4a3222).cyl(0.16, 0.13, D, D + 7.6, 8, true, 0, zp);
  pb.color(0x2a2a2e); for (const y of [D + 1.6, D + 4.2, D + 6.8]) pb.cyl(0.18, 0.18, y, y + 0.1, 8, false, 0, zp);
  pb.color(0x3a2a1c).box(0.34, 0.2, 0.5, 0, D + 7.55, zp + 0.1);
  pb.color(0x6a6a70).push(0, D + 7.5, zp + 0.3, 0, 0, Math.PI / 2); pb.cyl(0.13, 0.13, -0.06, 0.06, 8, true); pb.pop();
  pb.color(0x3a2a1c).box(1.5, 0.5, 0.7, 0, D + 0.85, zp + 0.55);
  pb.color(0x2a2a2e).push(0, D + 1.1, zp + 0.55, 0, 0, Math.PI / 2); pb.cyl(0.09, 0.09, -0.78, 0.78, 7, true); pb.pop();
  // a winch for the rope
  pb.color(0x5a3a22).box(0.7, 0.4, 0.4, 0, D + 0.3, zp - 0.9);
  pb.color(0x7a5a3a).push(0, D + 0.5, zp - 0.9, 0, 0, Math.PI / 2); pb.cyl(0.14, 0.14, -0.3, 0.3, 8, true); pb.pop();
  G.add(mesh(pb));
  G.userData.corvus = { z: zp + 0.55, y: D + 1.1, top: D + 7.5, pz: zp + 0.3 };
  return G;
}

/* ---------------- cargo ---------------- */
/** A crate, a barrel or a chest on somebody's deck. Origin on the deck. */
export function cargoMesh(kind, seed = 1) {
  const r = rng(seed * 13 + 1);
  const b = new MeshBuilder(r);
  if (kind === 'barrel') {
    b.color(shadeHex(0x7a5232, 0.85 + r() * 0.3)).lathe([[0.26, 0], [0.31, 0.25], [0.31, 0.5], [0.26, 0.76]], 9, 0, 0);
    b.color(0x3a3a3a); for (const y of [0.1, 0.4, 0.66]) b.cyl(0.3, 0.3, y, y + 0.05, 9, false);
    b.color(0x5a3a24).cyl(0.25, 0.25, 0.74, 0.77, 9, true);
  } else if (kind === 'chest') {
    b.color(0x6a3e22).box(0.78, 0.36, 0.48, 0, 0.18, 0);
    b.color(0x7a4a2a).push(0, 0.36, 0, 0, 0, 0); b.cyl(0.24, 0.24, -0.39, 0.39, 8, true); b.pop();
    b.color(0xd8b048); for (const x of [-0.3, 0.3]) b.box(0.05, 0.62, 0.5, x, 0.3, 0);
    b.color(0xd8b048).box(0.1, 0.12, 0.05, 0, 0.32, 0.25);
  } else {
    const s = 0.55 + r() * 0.2;
    b.color(shadeHex(0x9a7446, 0.85 + r() * 0.3)).box(s, s * 0.85, s, 0, s * 0.425, 0);
    b.color(0x5a4028); for (const y of [0.06, s * 0.78]) b.box(s + 0.02, 0.05, s + 0.02, 0, y, 0);
    for (const x of [-1, 1]) b.box(0.05, s * 0.85, s + 0.02, x * s * 0.35, s * 0.425, 0);
  }
  const m = mesh(b);
  return m;
}

/** The corvus: a boarding bridge `len` long along +Z from its hinge, with side rails, iron bands and a
    great hooked spike under the far end that bites into your deck. */
export function boardingBridge(len = 9) {
  const b = new MeshBuilder(rng(31));
  const n = Math.max(6, Math.round(len / 0.38));
  for (let i = 0; i < n; i++) b.color(shadeHex(0x6a4a2e, 0.82 + (i % 3) * 0.09)).box(1.24, 0.09, len / n * 0.9, 0, 0, (i + 0.5) * len / n);
  b.color(0x3a2a1c); for (const x of [-0.64, 0.64]) b.box(0.12, 0.18, len, x, 0.02, len / 2);
  // side walls of boards, like a trough, with a top rail
  for (const x of [-0.66, 0.66]) {
    for (let k = 0; k <= 6; k++) b.color(0x3a2a1c).box(0.07, 0.95, 0.07, x, 0.5, k * len / 6);
    b.color(0x4a3424).box(0.05, 0.42, len, x, 0.36, len / 2);
    b.color(0x2e2016).box(0.07, 0.07, len, x, 0.96, len / 2);
  }
  // iron bands
  b.color(0x2a2a2e); for (let k = 1; k < 5; k++) b.box(1.4, 0.05, 0.08, 0, 0.07, k * len / 5);
  b.color(0x2a2a2e).push(0, 0, 0.05, 0, 0, Math.PI / 2); b.cyl(0.08, 0.08, -0.7, 0.7, 7, true); b.pop();
  // the beak: a heavy iron spike, curved, and a row of teeth either side of it
  b.color(0x3a3a40).box(1.3, 0.14, 0.3, 0, -0.04, len - 0.2);
  b.color(0x2a2a2e);
  b.push(0, -0.1, len - 0.2, Math.PI + 0.25, 0, 0); b.cone(0.13, 0, 1.0, 6); b.pop();
  for (const x of [-0.45, -0.22, 0.22, 0.45]) { b.push(x, -0.08, len - 0.22, Math.PI + 0.15, 0, 0); b.cone(0.05, 0, 0.42, 4); b.pop(); }
  b.color(0x8a8a90); b.blob(0.09, 0.09, 0.09, 0, 1.0, len - 0.25, 5, 3);
  const m = mesh(b); m.castShadow = true; return m;
}

/** A cannonball. */
export function cannonballMesh() {
  const b = new MeshBuilder(rng(2));
  b.color(0x1a1a1c).blob(0.17, 0.17, 0.17, 0, 0, 0, 7, 4);
  const m = mesh(b); m.castShadow = true; return m;
}
