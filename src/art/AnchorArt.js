/* AnchorArt.js - the five anchors, the windlass that hauls them and the
   rope (or chain) between the two.

   An anchor hangs from its ring at the origin and points down -Y, so the
   same mesh works stowed on the bow, swinging on the rope, and lying on the
   sea bed. The windlass sits on the foredeck: its `crank` group turns while
   you haul, its `drum` shows the rope wound on. */

import * as THREE from '../../lib/three.module.js';
import { MeshBuilder, shadeHex } from './Geo.js';
import { MAT } from './Materials.js';
import { rng, TAU } from '../core/Util.js';
import { ANCHORS } from '../data/BoatData.js';

const IRON = 0x4a4e54, IRON2 = 0x5e636a, RUST = 0x7a4a30, BRASS = 0xc8a048, BONE = 0xe8dcc0;

/** A ring of beams: the shackle at the top of every anchor. */
function ring(b, r, t, y = 0, axis = 'z') {
  for (let k = 0; k < 10; k++) {
    const a0 = k / 10 * TAU, a1 = (k + 1) / 10 * TAU;
    const p = a => axis === 'z' ? [Math.cos(a) * r, y + Math.sin(a) * r, 0] : [0, y + Math.sin(a) * r, Math.cos(a) * r];
    b.beam(p(a0), p(a1), t, t);
  }
}

/** { solid, glow } geometry of the anchor for a level, about 1 m long at scale 1. */
export function anchorGeo(lv) {
  const b = new MeshBuilder(rng(40 + lv)), g = new MeshBuilder(rng(9));
  if (lv === 0) {
    // a killick: a rough stone lashed into a cradle of two crossed sticks
    b.color(0xc8a870); ring(b, 0.06, 0.025, -0.06);
    b.color(0x7a5a38).beam([0, -0.1, 0], [0, -0.62, 0], 0.05, 0.05);
    b.color(0x8a6a44).beam([-0.24, -0.62, 0], [0.24, -0.62, 0], 0.05, 0.05);
    b.beam([0, -0.62, -0.24], [0, -0.62, 0.24], 0.05, 0.05);
    for (const [x, z] of [[-0.22, 0], [0.22, 0], [0, -0.22], [0, 0.22]]) b.color(0x7a5a38).beam([x, -0.62, z], [x * 0.3, -0.18, z * 0.3], 0.03, 0.03);
    b.color(0x7a7c78).lump(0.2, 0, -0.44, 0, 0.3, 1.1, 1);
    b.color(0xc8a870); for (const y of [-0.34, -0.5]) b.box(0.36, 0.03, 0.03, 0, y, 0.14), b.box(0.03, 0.03, 0.36, 0.14, y, 0);
  } else if (lv === 1) {
    // the classic: ring, a wooden stock across the top, shank, curved arms and spade flukes
    b.color(IRON2); ring(b, 0.09, 0.03, -0.08);
    b.color(0x6a4a2e).box(0.8, 0.07, 0.07, 0, -0.22, 0);
    b.color(0x3a3a3a); for (const x of [-0.36, 0.36]) b.box(0.03, 0.08, 0.08, x, -0.22, 0);
    b.color(IRON).cyl(0.035, 0.045, -1.0, -0.16, 6, true);
    for (const s of [-1, 1]) {
      let px = 0, py = -1.0;
      for (let k = 1; k <= 4; k++) { const a = k / 4 * 1.25, x = s * Math.sin(a) * 0.42, y = -1.0 + (1 - Math.cos(a)) * 0.42; b.color(IRON).beam([0, py, px], [0, y, x], 0.05, 0.05); px = x; py = y; }
      b.color(IRON2).push(0, py - 0.02, px, s * -0.7, 0, 0); b.box(0.2, 0.2, 0.03, 0, 0, 0); b.cone(0.1, 0.1, 0.2, 3); b.pop();
    }
    b.color(IRON).blob(0.06, 0.05, 0.06, 0, -1.0, 0, 6, 3);
  } else if (lv === 2) {
    // a Danforth: a long shank and two flat pivoting flukes that dig in
    b.color(0x9aa0a6); ring(b, 0.08, 0.028, -0.07, 'x');
    b.color(0x8a9096).box(0.06, 0.9, 0.06, 0, -0.55, 0);
    b.color(0x9aa0a6).beam([-0.45, -1.0, 0], [0.45, -1.0, 0], 0.05, 0.05);
    for (const s of [-1, 1]) {
      b.color(0xb0b6bc).push(s * 0.18, -0.78, 0, 0, 0, s * 0.12);
      b.box(0.24, 0.5, 0.02, 0, 0, 0); b.cone(0.12, 0.25, 0.42, 3);
      b.pop();
    }
    b.color(0xe0402a).box(0.1, 0.03, 0.08, 0, -0.14, 0);
  } else if (lv === 3) {
    // a grapnel: five hooked tines round a heavy crown
    b.color(IRON2); ring(b, 0.1, 0.035, -0.08);
    b.color(IRON).cyl(0.05, 0.06, -0.95, -0.16, 7, true);
    b.color(IRON2).blob(0.12, 0.1, 0.12, 0, -0.95, 0, 7, 3);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU, cx = Math.cos(a), cz = Math.sin(a);
      let pr = 0.05, py = -0.95;
      for (let j = 1; j <= 4; j++) { const t = j / 4, r = 0.05 + Math.sin(t * 1.5) * 0.38, y = -0.95 + (1 - Math.cos(t * 1.5)) * 0.3; b.color(j === 4 ? 0xb8bcc2 : IRON).beam([cx * pr, py, cz * pr], [cx * r, y, cz * r], 0.055 - j * 0.008, 0.055 - j * 0.008); pr = r; py = y; }
      b.color(0xd0d4d8).push(cx * pr, py + 0.04, cz * pr); b.cone(0.03, 0, 0.12, 4); b.pop();
    }
    b.color(RUST).box(0.14, 0.05, 0.14, 0, -0.6, 0);
  } else {
    // the Leviathan Hook: a whale-rib hook bound in brass, runes along it that glow
    b.color(BRASS); ring(b, 0.13, 0.045, -0.1);
    b.color(BONE).cyl(0.07, 0.09, -1.1, -0.2, 7, true);
    let px = 0, py = -1.1;
    for (let k = 1; k <= 7; k++) {
      const a = k / 7 * Math.PI * 0.95, x = Math.sin(a) * 0.42, y = -1.1 - Math.sin(a) * 0.16 + (1 - Math.cos(a)) * 0.35;
      b.color(shadeHex(BONE, 1 - k * 0.03)).beam([px, py, 0], [x, y, 0], 0.13 - k * 0.012, 0.11 - k * 0.01);
      px = x; py = y;
    }
    b.color(0xf4ecd8).push(px, py + 0.04, 0, 0, 0, 0.5); b.cone(0.05, 0, 0.24, 4); b.pop();
    b.color(BONE).push(0.26, -1.05, 0, 0, 0, -0.8); b.cone(0.05, 0, 0.22, 4); b.pop();
    // a second, smaller hook on the other side, like a claw
    b.color(shadeHex(BONE, 0.9));
    b.beam([0, -1.1, 0], [-0.26, -0.98, 0], 0.09, 0.08); b.beam([-0.26, -0.98, 0], [-0.34, -0.76, 0], 0.07, 0.06);
    b.push(-0.34, -0.72, 0, 0, 0, 0.3); b.cone(0.04, 0, 0.14, 4); b.pop();
    b.color(BRASS); for (const y of [-0.3, -0.55, -0.85]) b.cyl(0.1, 0.1, y - 0.03, y + 0.03, 7, true);
    g.color(0x6af0e0); for (const y of [-0.42, -0.7]) g.box(0.03, 0.08, 0.2, 0, y, 0), g.box(0.2, 0.08, 0.03, 0, y, 0);
  }
  return { solid: b.build(), glow: g.tris ? g.build() : null };
}

/** An anchor as a group (both materials). */
export function buildAnchor(lv, scale = 1) {
  const { solid, glow } = anchorGeo(lv);
  const grp = new THREE.Group();
  const m = new THREE.Mesh(solid, MAT.solid); m.castShadow = true; grp.add(m);
  if (glow) grp.add(new THREE.Mesh(glow, MAT.glow));
  grp.scale.setScalar(scale);
  return grp;
}

/** The windlass: { group, crank, drum, drumR, top } in the boat's frame, at the origin of the deck spot. */
export function buildWindlass(lv, scale = 1) {
  const A = ANCHORS[lv], b = new MeshBuilder(rng(70 + lv)), cb = new MeshBuilder(rng(71));
  const group = new THREE.Group(), crank = new THREE.Group(), drum = new THREE.Group();
  const col = A.rope2;
  let drumR = 0.12, top = 0.4;
  if (A.winch === 'hand') {
    // a cleat and a coil of rope on the deck: you haul it hand over hand
    b.color(0x6a4a30).box(0.36, 0.06, 0.08, 0, 0.12, 0);
    for (const x of [-0.08, 0.08]) b.box(0.05, 0.12, 0.06, x, 0.06, 0);
    b.color(col);
    for (let k = 0; k < 4; k++) { const r = 0.2 - k * 0.012; for (let i = 0; i < 12; i++) { const a0 = i / 12 * TAU, a1 = (i + 1) / 12 * TAU; b.beam([Math.cos(a0) * r, 0.03 + k * 0.03, -0.34 + Math.sin(a0) * r], [Math.cos(a1) * r, 0.03 + k * 0.03, -0.34 + Math.sin(a1) * r], 0.035, 0.035); } }
    drumR = 0.02; top = 0.16;
  } else {
    const big = A.winch === 'winch';
    const w = big ? 0.5 : 0.36, h = big ? 0.55 : 0.42;
    drumR = big ? 0.16 : 0.11; top = h;
    // two cheeks and a base
    b.color(big ? 0x3a5a7a : 0x6a4a30).box(w + 0.16, 0.06, 0.34, 0, 0.03, 0);
    for (const s of [-1, 1]) { b.color(big ? 0x2e4a66 : 0x5a3e28).box(0.06, h, 0.3, s * w / 2, h / 2, 0); if (big) b.color(0xd8b048).cyl(0.05, 0.05, h - 0.1, h - 0.08, 6, true, s * w / 2, 0); }
    if (big) {
      // a gear wheel on the outside of one cheek
      b.color(0x5a5e64).push(w / 2 + 0.06, h * 0.62, 0, 0, 0, Math.PI / 2); b.cyl(0.2, 0.2, -0.03, 0.03, 12, true);
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; b.box(0.05, 0.08, 0.05, Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22); }
      b.pop();
      b.color(0xe0402a).box(0.1, 0.06, 0.06, 0, h + 0.03, 0.1);
    }
    // the drum, with the rope (or chain) wound on
    const db = new MeshBuilder(rng(72));
    db.color(big ? 0x5a5e64 : 0x7a5a38).push(0, 0, 0, 0, 0, Math.PI / 2); db.cyl(drumR * 1.5, drumR * 1.5, -w / 2 + 0.03, -w / 2 + 0.07, 10, true); db.cyl(drumR * 1.5, drumR * 1.5, w / 2 - 0.07, w / 2 - 0.03, 10, true); db.pop();
    db.color(col); for (let k = 0; k < 7; k++) { const x = -w / 2 + 0.1 + k * (w - 0.2) / 6; db.push(x, 0, 0, 0, 0, Math.PI / 2); db.cyl(drumR, drumR, -0.025, 0.025, 8, true); db.pop(); }
    if (A.chain) { db.color(shadeHex(col, 1.2)); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; db.box(w - 0.2, 0.02, 0.02, 0, Math.cos(a) * drumR * 1.02, Math.sin(a) * drumR * 1.02); } }
    drum.add(new THREE.Mesh(db.build(), MAT.solid));
    drum.position.set(0, h * 0.62, 0);
    group.add(drum);
    // the crank handle, on the starboard cheek
    cb.color(big ? 0x9aa0a8 : 0x3a3a3a).box(0.04, 0.3, 0.04, 0, 0.15, 0);
    cb.color(big ? 0x2a2a2a : 0x6a4a30).cyl(0.03, 0.03, -0.02, 0.16, 6, true, 0, 0);
    cb.push(0, 0.3, 0, 0, 0, Math.PI / 2); cb.color(0x6a4a30).cyl(0.03, 0.03, -0.14, 0.02, 6, true); cb.pop();
    const cm = new THREE.Mesh(cb.build(), MAT.solid);
    crank.add(cm);
    crank.position.set(-(w / 2 + 0.06), h * 0.62, 0);
    group.add(crank);
    if (big) { const c2 = cm.clone(); c2.rotation.x = Math.PI; c2.position.x = w + 0.24; crank.add(c2); }
  }
  group.add(new THREE.Mesh(b.build(), MAT.solid));
  group.scale.setScalar(scale);
  return { group, crank, drum, drumR: drumR * scale, top: top * scale };
}

/** The rope: a strip of crossed ribbons through a list of world points, rebuilt every frame. */
export class Rope {
  constructor(scene, n = 18) {
    this.n = n;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 12 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const idx = [];
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { const o = (i * 2 + k) * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
    g.setIndex(idx);
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 12 * 3).fill(0).map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
    this.mat = new THREE.MeshLambertMaterial({ color: 0xc8a870, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.pts = Array.from({ length: n + 1 }, () => new THREE.Vector3());
  }
  set(color, width) { this.mat.color.setHex(color); this.w = width; }
  /** Lay the rope along `this.pts` (n + 1 points). */
  draw() {
    const P = this.pos, w = (this.w || 0.04) / 2;
    let o = 0;
    for (let i = 0; i < this.n; i++) {
      const a = this.pts[i], c = this.pts[i + 1];
      // two ribbons at right angles, so it reads as a rope from any side
      const dx = c.x - a.x, dy = c.y - a.y, dz = c.z - a.z, l = Math.hypot(dx, dy, dz) || 1;
      let ux = -dz / l, uz = dx / l; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
      const sides = [[ux * w, 0, uz * w], [0, w, 0]];
      for (const [sx, sy, sz] of sides) {
        P[o++] = a.x - sx; P[o++] = a.y - sy; P[o++] = a.z - sz;
        P[o++] = a.x + sx; P[o++] = a.y + sy; P[o++] = a.z + sz;
        P[o++] = c.x + sx; P[o++] = c.y + sy; P[o++] = c.z + sz;
        P[o++] = c.x - sx; P[o++] = c.y - sy; P[o++] = c.z - sz;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.visible = true;
  }
  hide() { this.mesh.visible = false; }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}
