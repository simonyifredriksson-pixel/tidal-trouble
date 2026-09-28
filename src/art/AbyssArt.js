/* AbyssArt.js - the two things nobody on the islands will name.

   THE THING BELOW   the creature that wrecks your boat in the storm on the
                     first night. A long ridged skull like a drowned
                     cathedral, three pairs of sick-green eyes down each side
                     of its face, a jaw that opens sideways, and hooked arms.
                     Nothing like the Kraken: no mantle, no suckers, no red.

   THE WARDEN        what lives past the edge of the world. A trunk as wide
                     as a village that goes down further than anyone has
                     seen, crowned with bone petals round a round maw full of
                     rings of teeth, a halo of red eyes, and twelve arms long
                     enough to reach round any ship ever built. Veins of cold
                     blue light run all over it.

   Arms are chains of groups so they can curl: curlArm() bends one. */

import * as THREE from '../../lib/three.module.js';
import { MeshBuilder, shadeHex, mixHex } from './Geo.js';
import { MAT } from './Materials.js';
import { rng, TAU } from '../core/Util.js';

const holder = (b, g) => {
  const G = new THREE.Group();
  const m = new THREE.Mesh(b.build(), MAT.solid); m.castShadow = true; G.add(m);
  if (g && g.tris) G.add(new THREE.Mesh(g.build(), MAT.glow));
  return G;
};

/** One arm rising along +Y: N tapering segments. `hooks` for the Thing Below, `lights` for the Warden. */
export function buildArm(len, o = {}) {
  const r = rng(o.seed || 1);
  const N = o.n || 14, segL = len / N;
  const root = new THREE.Group();
  const segs = [];
  let parent = root;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const r0 = len * (o.thick || 0.05) * (1 - t0 * 0.88) + 0.05, r1 = len * (o.thick || 0.05) * (1 - t1 * 0.88) + 0.05;
    const b = new MeshBuilder(r), g = new MeshBuilder(r);
    b.color(i % 2 ? o.col : o.col2).cyl(r0, r1, 0, segL * 1.05, 8, false, 0, 0, 0, 0.06);
    if (o.hooks) {
      // a row of bone hooks along the inside of the curl, and barnacles on the back
      for (let k = 0; k < 2; k++) {
        const y = segL * (0.3 + k * 0.45);
        b.push(r0 * 0.85, y, 0, 0, 0, -Math.PI / 2 + 0.5); b.color(0xd8d0b8).cone(r0 * 0.22, 0, r0 * 0.7, 4); b.pop();
      }
      b.color(0x6a6a5a); for (let k = 0; k < 3; k++) b.lump(r0 * 0.16, -r0 * 0.85, segL * r(), (r() - 0.5) * r0, 0.5, 0.6);
    }
    if (o.lights) {
      g.color(o.lights);
      for (let k = 0; k < 3; k++) { const a = r() * TAU; g.blob(r0 * 0.12, r0 * 0.12, r0 * 0.12, Math.cos(a) * r0 * 0.98, segL * r(), Math.sin(a) * r0 * 0.98, 4, 2); }
      // a vein of light down the length
      g.box(r0 * 0.08, segL * 1.02, r0 * 0.08, -r0 * 0.96, segL * 0.5, 0);
    }
    if (i === N - 1) { b.color(o.tip || o.col2).cone(r1, segL, segL * 2.4, 6); if (o.hooks) { b.push(0, segL * 2.2, 0, 0, 0, -0.9); b.color(0xd8d0b8).cone(r1 * 0.5, 0, r1 * 2, 4); b.pop(); } }
    const S = new THREE.Group();
    S.position.y = i === 0 ? 0 : segL;
    S.add(holder(b, g));
    parent.add(S);
    segs.push(S);
    parent = S;
  }
  const tip = new THREE.Object3D(); tip.position.y = segL * 2; parent.add(tip);
  return { group: root, segs, tip, len };
}

/** Bend an arm: `curl` total radians along its length, `wave` a travelling ripple, `side` the twist. */
export function curlArm(A, t, curl = 0.9, wave = 0.25, ph = 0, side = 0) {
  const N = A.segs.length;
  for (let i = 0; i < N; i++) {
    const k = i / N;
    A.segs[i].rotation.z = curl / N * (0.4 + k * 1.6) + Math.sin(t * 1.3 - k * 5 + ph) * wave * (0.3 + k);
    A.segs[i].rotation.x = Math.sin(t * 0.9 - k * 4 + ph * 1.7) * wave * 0.5 * k + side / N;
  }
}

/* ---------------- the Thing Below ---------------- */
const TB = { skin: 0x3e5048, skin2: 0x4c5e54, plate: 0x6a7a6c, bone: 0xe0d8c0, eye: 0xd8ff7a, mouth: 0x0e0808 };

export function buildThingBelow() {
  const r = rng(913);
  const group = new THREE.Group();
  // the body going down into the dark: you only ever see the top of it
  const bb = new MeshBuilder(r);
  bb.lathe([[11, -60], [12, -30], [11, -12], [9.5, 0], [8, 6]], 12, 0, 0, 0, t => mixHex(0x10181a, TB.skin, t));
  bb.color(TB.plate); for (let k = 0; k < 40; k++) { const a = r() * TAU, y = -28 + r() * 32; bb.lump(0.8 + r() * 1.4, Math.cos(a) * 10.5, y, Math.sin(a) * 10.5, 0.4, 0.5); }
  const body = holder(bb);
  group.add(body);
  // the head: a long ridged skull tilted forward over the water
  const head = new THREE.Group();
  head.position.set(0, 6, 0);
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  b.color(TB.skin).blob(8.5, 10, 13, 0, 9, 2, 10, 6, 0.08, TB.skin2, TB.skin);
  b.color(TB.skin2).blob(7, 5, 9, 0, 2, 7, 9, 4, 0.1);                              // the heavy lower jaw
  // bone crest along the top and the brow
  for (let k = 0; k < 9; k++) { const z = -9 + k * 2.4, y = 18.2 - Math.abs(z - 2) * 0.28; b.push(0, y, z, -0.35, 0, 0); b.color(TB.bone).cone(1.1 - k * 0.05, 0, 3.4 - Math.abs(k - 4) * 0.3, 4); b.pop(); }
  for (const s of [-1, 1]) {
    b.color(TB.bone).beam([s * 6.8, 14, 9], [s * 3.2, 15.5, 13.5], 1.2, 1.4);
    // armour plates down the cheeks
    b.color(TB.plate); for (let k = 0; k < 7; k++) b.lump(1.6 + r(), s * (7.6 - k * 0.3), 4 + k * 1.6, 3 + k * 1.1, 0.3, 0.45);
    // three eyes down each side, the biggest at the top
    for (let k = 0; k < 3; k++) {
      const ey = 12.5 - k * 3.4, ez = 10 - k * 1.3, ex = s * (6.2 - k * 0.2), er = 1.7 - k * 0.35;
      b.color(0x0a100e).blob(er * 1.25, er * 1.1, er * 0.7, ex, ey, ez, 8, 4);
      g.color(TB.eye).blob(er, er * 0.85, er * 0.55, ex + s * 0.25, ey, ez + 0.3, 8, 4);
      b.color(0x050505).box(0.3, er * 1.5, 0.4, ex + s * 0.5, ey, ez + 0.7);
    }
  }
  // the mouth: a vertical split under the snout, and the feelers hanging from it
  b.color(TB.mouth).box(1.6, 7, 3, 0, 4, 14.3);
  b.color(TB.bone); for (let k = 0; k < 8; k++) { const y = 1.2 + k * 0.85; for (const s of [-1, 1]) { b.push(s * 0.8, y, 14.4, 0, 0, s * 1.4); b.cone(0.28, 0, 1.1, 4); b.pop(); } }
  const headMesh = holder(b, g);
  head.add(headMesh);
  const feelers = [];
  for (let k = 0; k < 6; k++) {
    const F = buildArm(9, { seed: 40 + k, n: 8, thick: 0.05, col: TB.skin2, col2: TB.skin, hooks: true });
    F.group.position.set((k - 2.5) * 0.9, 1.5, 13.4);
    F.group.rotation.x = Math.PI;         // hanging down
    head.add(F.group);
    feelers.push(F);
  }
  group.add(head);
  // the arms: six, each longer than a ship, rising round the body
  const arms = [];
  for (let k = 0; k < 6; k++) {
    const A = buildArm(42 + (k % 3) * 6, { seed: 7 + k, n: 14, thick: 0.052, col: TB.skin, col2: TB.skin2, hooks: true, tip: TB.plate });
    const a = k / 6 * TAU + 0.5;
    A.group.position.set(Math.cos(a) * 12, -2, Math.sin(a) * 12);
    A.group.rotation.y = -a;
    A.a = a;
    group.add(A.group);
    arms.push(A);
  }
  return { group, head, body, arms, feelers };
}

/* ---------------- the Warden ---------------- */
const WD = { skin: 0x1a1426, skin2: 0x2a1e3a, bone: 0xb8a890, maw: 0x080406, eye: 0xff4a2a, vein: 0x5ad8ff };

export function buildWarden() {
  const r = rng(7331);
  const group = new THREE.Group();
  // the trunk: down, and down, and down
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  b.lathe([[40, -220], [36, -120], [31, -40], [27, 10], [25, 32], [30, 40]], 16, 0, 0, 0, t => mixHex(0x08060c, WD.skin, t));
  b.color(WD.skin2); for (let k = 0; k < 70; k++) { const a = r() * TAU, y = -100 + r() * 130; const rr = 27 + (30 - y) * -0.04; b.lump(1.5 + r() * 3.5, Math.cos(a) * rr, y, Math.sin(a) * rr, 0.4, 0.5); }
  g.color(WD.vein);
  for (let k = 0; k < 18; k++) {
    // veins of cold light climbing the trunk
    let a = r() * TAU, y = -90;
    for (let s = 0; s < 9; s++) { const y2 = y + 12, a2 = a + (r() - 0.5) * 0.25, r1 = 28.5 - y * -0.02, r2 = 28.5 - y2 * -0.02; g.beam([Math.cos(a) * r1, y, Math.sin(a) * r1], [Math.cos(a2) * r2, y2, Math.sin(a2) * r2], 0.5, 0.5); a = a2; y = y2; }
  }
  // the crown: nine hooded bone petals leaning out round the maw
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * TAU;
    b.push(Math.cos(a) * 24, 38, Math.sin(a) * 24, 0, -a + Math.PI / 2, 0);
    b.push(0, 0, 0, -0.55, 0, 0);
    b.color(WD.bone).quad([-9, 0, 0], [9, 0, 0], [5, 30, 3], [-5, 30, 3], [0, 0, 1]);
    b.color(shadeHex(WD.bone, 0.7)).quad([-9, 0, -0.1], [9, 0, -0.1], [5, 30, 2.9], [-5, 30, 2.9], [0, 0, -1]);
    b.color(WD.skin2).beam([0, 0, 0.6], [0, 29, 3.4], 2.2, 1.2);
    b.pop(); b.pop();
  }
  // the maw: a black pit ringed with teeth, ring inside ring
  b.color(WD.maw).cyl(21, 8, 40, 26, 16, true);
  for (let ringI = 0; ringI < 3; ringI++) {
    const rr = 20 - ringI * 4.5, y = 39.5 - ringI * 3.5, n = 20 - ringI * 4;
    for (let k = 0; k < n; k++) { const a = k / n * TAU + ringI * 0.2; b.push(Math.cos(a) * rr, y, Math.sin(a) * rr, 0, -a, -Math.PI / 2 - 0.6); b.color(0xe8e0d0).cone(0.9 - ringI * 0.15, 0, 3.4 - ringI * 0.5, 4); b.pop(); }
  }
  // a halo of red eyes all the way round under the petals, and two great ones at the front
  for (let k = 0; k < 26; k++) {
    const a = k / 26 * TAU, y = 30 + (k % 2) * 3;
    b.color(0x0a0406).blob(1.5, 1.2, 1.5, Math.cos(a) * 26.8, y, Math.sin(a) * 26.8, 6, 3);
    g.color(WD.eye).blob(1.1, 0.9, 1.1, Math.cos(a) * 27.4, y, Math.sin(a) * 27.4, 6, 3);
  }
  for (const s of [-1, 1]) {
    const a = Math.PI / 2 + s * 0.28;
    b.color(0x0a0406).blob(5.5, 4, 3, Math.cos(a) * 27, 20, Math.sin(a) * 27, 10, 5);
    g.color(0xffb03a).blob(4.2, 3, 2.2, Math.cos(a) * 28, 20, Math.sin(a) * 28, 10, 5);
    b.color(0x000000).box(0.8, 5.5, 0.8, Math.cos(a) * 30, 20, Math.sin(a) * 30);
  }
  const body = holder(b, g);
  group.add(body);
  // twelve arms
  const arms = [];
  for (let k = 0; k < 12; k++) {
    const A = buildArm(150 + (k % 4) * 18, { seed: 90 + k, n: 16, thick: 0.034, col: WD.skin, col2: WD.skin2, lights: WD.vein, tip: WD.bone });
    const a = k / 12 * TAU;
    A.group.position.set(Math.cos(a) * 30, -10, Math.sin(a) * 30);
    A.group.rotation.y = -a;
    A.a = a;
    group.add(A.group);
    arms.push(A);
  }
  return { group, body, arms };
}
