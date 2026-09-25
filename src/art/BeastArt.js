/* BeastArt.js - the ten ocean beasts, each built from scratch.

   Convention (same as GreatArt): forward +Z, up +Y, built about one unit
   across and scaled by the beast's size in metres. Every builder returns
   { group, animate(t, a), ...named parts } so Beasts.js can move limbs,
   raise heads and show only the pieces that break the surface. */

import * as THREE from '../../lib/three.module.js?v=1790356418';
import { MeshBuilder, shadeHex, mixHex } from './Geo.js?v=1790356418';
import { MAT } from './Materials.js?v=1790356418';
import { rng, TAU } from '../core/Util.js?v=1790356418';

const mesh = (b, mat = MAT.solid) => { const m = new THREE.Mesh(b.build(), mat); m.castShadow = true; m.frustumCulled = false; return m; };
const hold = (b, g = null, mat = MAT.solid) => { const G = new THREE.Group(); if (b.tris) G.add(mesh(b, mat)); if (g && g.tris) { const m = new THREE.Mesh(g.build(), MAT.glow); m.frustumCulled = false; G.add(m); } return G; };

/** A chain of tapering tube segments along +Y (tentacles, legs, necks). */
function chain(parent, r, n, len, r0, r1, col, col2, extra = null) {
  const segs = [];
  let p = parent;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const b = new MeshBuilder(r);
    b.color(i % 2 ? col : col2).cyl(r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, 0, len / n * 1.06, 7, false);
    if (extra) extra(b, i, t0, r0 + (r1 - r0) * t0, len / n);
    const S = new THREE.Group(); S.position.y = i ? len / n : 0;
    S.add(mesh(b)); p.add(S); segs.push(S); p = S;
  }
  return segs;
}

/* ---------------- 1. CTHULHU: a head with a beard of arms, wings, and hands ---------------- */
function cthulhu() {
  const r = rng(1001), G = new THREE.Group();
  const skin = 0x3a4a3a, skin2 = 0x2a3a2e, belly = 0x5a6a4a;
  const head = new THREE.Group(); head.position.y = 0.55; G.add(head);
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  // the great domed skull, swept back, lumpy, with ridged brow
  b.lathe([[0.02, -0.08], [0.16, -0.05], [0.2, 0.05], [0.21, 0.15], [0.19, 0.24], [0.14, 0.32], [0.06, 0.37], [0.01, 0.38]], 12, 0, -0.03, 0, t => mixHex(skin, skin2, t));
  b.color(shadeHex(skin, 0.8)); for (let k = 0; k < 40; k++) { const a = r() * TAU, y = r() * 0.3; const rr = 0.2 * Math.sin((y + 0.08) / 0.46 * Math.PI) + 0.01; b.lump(0.012 + r() * 0.018, Math.cos(a) * rr, y, Math.sin(a) * rr - 0.03, 0.4, 0.6); }
  b.color(skin2).box(0.3, 0.04, 0.06, 0, 0.1, 0.17);
  for (const s of [-1, 1]) { b.color(0x1a2218).blob(0.05, 0.035, 0.03, s * 0.08, 0.06, 0.17, 6, 3); g.color(0xf0e040).blob(0.035, 0.012, 0.012, s * 0.08, 0.06, 0.195, 6, 3); }
  // crest of fins down the back of the skull
  for (let k = 0; k < 6; k++) b.color(shadeHex(skin2, 0.9)).card([0, 0.36 - k * 0.05, -0.05 - k * 0.03], [0, 0.44 - k * 0.05, -0.12 - k * 0.04], [0, 0.34 - k * 0.05, -0.1 - k * 0.03]);
  head.add(hold(b, g));
  // the beard of arms
  const beard = [];
  for (let i = 0; i < 12; i++) {
    const a = -1.1 + i / 11 * 2.2, root = new THREE.Group();
    root.position.set(Math.sin(a) * 0.14, -0.04, Math.cos(a) * 0.13 + 0.03);
    root.rotation.x = Math.PI - 0.25; root.rotation.z = Math.sin(a) * 0.2;
    head.add(root);
    beard.push(chain(root, r, 9, 0.5 + (1 - Math.abs(a) / 1.1) * 0.25, 0.028, 0.004, 0x4a5a44, skin, (bb, k, t, rr, sl) => { if (k % 2) bb.color(0xa8b890).blob(rr * 0.4, sl * 0.12, rr * 0.3, 0, sl * 0.5, rr * 0.85, 4, 2); }));
  }
  // shoulders and the wings, folded like a church roof
  const back = new MeshBuilder(r);
  back.color(skin).blob(0.36, 0.2, 0.24, 0, 0.32, -0.06, 10, 5, 0.08, skin, skin2);
  G.add(hold(back));
  const wings = [];
  for (const s of [-1, 1]) {
    const W = new THREE.Group(); W.position.set(s * 0.2, 0.46, -0.16); G.add(W);
    const wb = new MeshBuilder(r);
    const tips = [[0.4, 0.55, -0.1], [0.62, 0.3, -0.18], [0.66, 0.02, -0.2], [0.5, -0.18, -0.16]];
    wb.color(0x2a2a24);
    for (const tp of tips) wb.tube([0, 0, 0], [s * tp[0], tp[1], tp[2]], 0.02, 0.006, 5);
    for (let k = 0; k < tips.length - 1; k++) {
      const A = tips[k], B = tips[k + 1];
      wb.color(k % 2 ? 0x3a3a2e : 0x2e2e26).card([0, 0, 0], [s * A[0], A[1], A[2]], [s * (A[0] + B[0]) * 0.45, (A[1] + B[1]) * 0.45 - 0.05, (A[2] + B[2]) * 0.5], [s * B[0], B[1], B[2]]);
    }
    W.add(hold(wb)); wings.push({ g: W, s });
  }
  // two hands that grip the sea
  const hands = [];
  for (const s of [-1, 1]) {
    const H = new THREE.Group(); H.position.set(s * 0.55, 0.02, 0.35); G.add(H);
    const hb = new MeshBuilder(r);
    hb.color(skin).blob(0.08, 0.04, 0.09, 0, 0, 0, 7, 3, 0.1);
    for (let k = 0; k < 4; k++) { const a = -0.6 + k * 0.4; hb.color(skin2).tube([Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06], [Math.sin(a) * 0.2, 0.06, Math.cos(a) * 0.2], 0.018, 0.01, 5); hb.color(0xd8d0b8).cone(0.01, 0, 0.05, 4, Math.sin(a) * 0.2, Math.cos(a) * 0.2); }
    H.add(hold(hb)); hands.push({ g: H, s });
  }
  const animate = (t, a = {}) => {
    beard.forEach((segs, i) => segs.forEach((S, k) => { S.rotation.x = Math.sin(t * 0.9 + i * 0.7 + k * 0.5) * 0.12 - 0.03 * k; S.rotation.z = Math.cos(t * 0.7 + i + k * 0.4) * 0.1; }));
    for (const W of wings) { W.g.rotation.z = W.s * (-0.3 + (a.spread || 0) * 0.9 + Math.sin(t * 0.5) * 0.05); W.g.rotation.y = W.s * (0.4 - (a.spread || 0) * 0.3); }
    for (const H of hands) { H.g.position.y = 0.02 + Math.sin(t * 0.6 + H.s) * 0.02; H.g.rotation.y = Math.sin(t * 0.4) * 0.2 * H.s; }
    head.rotation.y = Math.sin(t * 0.21) * 0.3 + (a.look || 0);
  };
  animate(0);
  return { group: G, head, hands, wings, animate };
}

/* ---------------- 2. THE SKYMAW: a winged ring of teeth ---------------- */
function skymaw() {
  const r = rng(1002), G = new THREE.Group();
  const col = 0x8a8278, col2 = 0x6a6258, pale = 0xd8d0c4;
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  // the body: a long tapering tube, mouth-first
  b.push(0, 0, 0, Math.PI / 2, 0, 0);
  b.lathe([[0.1, -0.45], [0.13, -0.3], [0.15, -0.1], [0.16, 0.1], [0.19, 0.3], [0.22, 0.42], [0.2, 0.46]], 12, 0, 0, 0, t => mixHex(col2, col, t));
  b.pop();
  // the mouth: a ring of teeth facing forward, three rings deep
  for (let ring = 0; ring < 3; ring++) for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU, rr = 0.19 - ring * 0.04, z = 0.45 - ring * 0.05;
    b.color(pale); b.push(Math.cos(a) * rr, Math.sin(a) * rr, z, 0, 0, 0); b.push(0, 0, 0, Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2, 0, 0); b.cone(0.012, 0, 0.06, 3); b.pop(); b.pop();
  }
  g.color(0xff6a3a).cyl(0.06, 0.06, 0.3, 0.32, 8, true, 0, 0); // a glow deep in the throat
  // pale belly plates
  b.color(pale); for (let k = 0; k < 9; k++) b.box(0.16, 0.01, 0.06, 0, -0.14 + k * 0.004, -0.35 + k * 0.08);
  // long whip tail
  b.color(col2); b.tube([0, 0, -0.45], [0, 0.02, -0.95], 0.08, 0.005, 6);
  b.color(col).card([0, 0.02, -0.9], [0.1, 0.02, -1.0], [-0.1, 0.02, -1.0]);
  G.add(hold(b, g));
  // four wings, two big, two small, feathered at the edges
  const wings = [];
  for (const [z, span, s] of [[0.15, 0.9, 1], [0.15, 0.9, -1], [-0.2, 0.5, 1], [-0.2, 0.5, -1]]) {
    const W = new THREE.Group(); W.position.set(s * 0.13, 0.03, z); G.add(W);
    const wb = new MeshBuilder(r);
    const pts = [[0, 0.08], [span * 0.4, 0.12], [span * 0.8, 0.05], [span, -0.06], [span * 0.7, -0.14], [span * 0.35, -0.14], [0, -0.1]];
    for (let k = 1; k < pts.length - 1; k++) wb.color(k % 2 ? col : 0x9a9288).card([0, 0, 0], [s * pts[k][0], 0, pts[k][1]], [s * pts[k + 1][0], 0, pts[k + 1][1]]);
    for (let k = 0; k < 6; k++) wb.color(pale).card([s * span * (0.4 + k * 0.1), 0, -0.14 + k * 0.012], [s * span * (0.43 + k * 0.1), 0, -0.24], [s * span * (0.46 + k * 0.1), 0, -0.13 + k * 0.012]);
    W.add(hold(wb)); wings.push({ g: W, s, big: span > 0.6 });
  }
  const animate = (t, a = {}) => {
    const flap = a.flap ?? 0.3, sp = a.speed ?? 1.2;
    for (const W of wings) W.g.rotation.z = W.s * Math.sin(t * sp + (W.big ? 0 : 0.8)) * flap * (W.big ? 1 : 1.3);
  };
  animate(0);
  return { group: G, wings, animate };
}

/* ---------------- 3. THE DROWNED KING: a crab-thing wearing ships ---------------- */
function drownedking() {
  const r = rng(1003), G = new THREE.Group();
  const shell = 0x4a4038, shell2 = 0x3a3028, wood = 0x5a4632;
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  // the carapace: a low dome
  b.lathe([[0.45, 0], [0.46, 0.05], [0.4, 0.14], [0.28, 0.22], [0.12, 0.27], [0.01, 0.28]], 12, 0, 0, 0, t => mixHex(shell2, shell, t));
  // ships and wreckage grown into it: hull halves, masts, a figurehead, barrels
  for (let k = 0; k < 5; k++) {
    const a = r() * TAU, d = 0.1 + r() * 0.24, x = Math.cos(a) * d, z = Math.sin(a) * d;
    b.push(x, 0.22 - d * 0.35, z, (r() - 0.5) * 0.8, r() * TAU, (r() - 0.5) * 0.6);
    for (let p = 0; p < 5; p++) b.color(shadeHex(wood, 0.8 + r() * 0.3)).box(0.22, 0.012, 0.03, 0, p * 0.02, p * 0.012 - 0.03);
    b.color(0x3e3226); for (let p = 0; p < 4; p++) b.beam([-0.1 + p * 0.07, 0, 0], [-0.1 + p * 0.07, 0.1, 0.04], 0.012, 0.012);
    b.pop();
  }
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; b.color(0x4a3a2a).tube([Math.cos(a) * 0.12, 0.24, Math.sin(a) * 0.12], [Math.cos(a) * 0.2, 0.55 + k * 0.05, Math.sin(a) * 0.2], 0.012, 0.008, 5); b.color(0xc8bca0).card([Math.cos(a) * 0.19, 0.5, Math.sin(a) * 0.19], [Math.cos(a) * 0.19, 0.36, Math.sin(a) * 0.19], [Math.cos(a) * 0.19 + 0.1, 0.42, Math.sin(a) * 0.19]); }
  b.color(0xc8a060).blob(0.03, 0.05, 0.03, 0, 0.12, 0.44, 5, 3);
  for (let k = 0; k < 6; k++) { const a = r() * TAU; b.color(0x6a4a2e).cyl(0.03, 0.03, 0, 0.05, 7, true, Math.cos(a) * 0.35, Math.sin(a) * 0.35); }
  b.color(0x6a8a5a); for (let k = 0; k < 30; k++) { const a = r() * TAU, d = r() * 0.44; b.lump(0.01 + r() * 0.012, Math.cos(a) * d, 0.27 - d * 0.55, Math.sin(a) * d, 0.4, 0.5); }
  // the face under the brim, lamp eyes on stalks
  b.color(shell2).blob(0.16, 0.06, 0.08, 0, 0.02, 0.42, 7, 3);
  for (const s of [-1, 1]) { b.color(shell).tube([s * 0.06, 0.04, 0.44], [s * 0.1, 0.14, 0.5], 0.012, 0.01, 5); g.color(0xffb040).blob(0.022, 0.022, 0.022, s * 0.1, 0.15, 0.5, 5, 3); }
  G.add(hold(b, g));
  // claws and legs
  const claws = [];
  for (const s of [-1, 1]) {
    const C = new THREE.Group(); C.position.set(s * 0.32, 0.02, 0.32); C.rotation.set(-1.2, s * 0.4, 0); G.add(C);
    const segs = chain(C, r, 2, 0.3, 0.05, 0.035, shell, shell2);
    const cb = new MeshBuilder(r);
    cb.color(shell).blob(0.07, 0.05, 0.12, 0, 0.06, 0, 7, 3); cb.color(0xd8c8a8).cone(0.03, 0.08, 0.22, 4, 0.03, 0); cb.color(0xd8c8a8).cone(0.025, 0.06, 0.18, 4, -0.03, 0);
    const pinch = new THREE.Group(); pinch.position.y = 0.15; pinch.add(hold(cb)); segs[1].add(pinch);
    claws.push({ g: C, s, segs });
  }
  const legs = [];
  for (let k = 0; k < 6; k++) {
    const s = k % 2 ? -1 : 1, z = -0.2 + Math.floor(k / 2) * 0.18;
    const L = new THREE.Group(); L.position.set(s * 0.38, 0.02, z); L.rotation.z = s * -1.9; G.add(L);
    legs.push({ g: L, s, segs: chain(L, r, 3, 0.45, 0.03, 0.012, shell2, shell) });
  }
  // anchors hanging off on chains
  const chains = [];
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * TAU + 0.5, C = new THREE.Group(); C.position.set(Math.cos(a) * 0.4, 0.06, Math.sin(a) * 0.4); C.rotation.x = Math.PI; G.add(C);
    const links = chain(C, r, 6, 0.36, 0.008, 0.008, 0x5a5a5a, 0x4a4a4a);
    const ab = new MeshBuilder(r);
    ab.color(0x4a4a4a).box(0.015, 0.14, 0.015, 0, 0.07, 0); ab.box(0.08, 0.012, 0.012, 0, 0.12, 0);
    for (const s of [-1, 1]) ab.beam([0, 0, 0], [s * 0.06, 0.04, 0], 0.015, 0.015);
    const an = new THREE.Group(); an.position.y = 0.07; an.add(hold(ab)); links[links.length - 1].add(an);
    chains.push(links);
  }
  const animate = (t, a = {}) => {
    for (const C of claws) { C.segs[0].rotation.x = Math.sin(t * 0.8 + C.s) * 0.3; C.segs[1].rotation.x = -0.6 + Math.sin(t * 1.3 + C.s) * 0.4; }
    legs.forEach((L, i) => { L.segs[0].rotation.x = Math.sin(t * 1.4 + i * 1.1) * 0.25; L.segs[1].rotation.z = L.s * (0.6 + Math.sin(t * 1.4 + i) * 0.2); });
    chains.forEach((links, i) => links.forEach((S, k) => { S.rotation.x = Math.sin(t * 1.1 + i * 2 + k * 0.4) * 0.08 * (a.swing ?? 1); }));
  };
  animate(0);
  return { group: G, claws, animate };
}

/* ---------------- 4. THE ABYSSAL SERPENT: coils and a sail fin ---------------- */
function serpent() {
  const r = rng(1004), G = new THREE.Group();
  const N = 34, sp = 1 / N, segs = [];
  for (let i = 0; i < N; i++) {
    const s = i / (N - 1), rad = 0.018 * Math.sin(Math.min(1, (s + 0.05) / 0.25) * Math.PI / 2) * (1 - Math.pow(s, 2) * 0.8) + 0.002;
    const b = new MeshBuilder(r), g = new MeshBuilder(r);
    b.push(0, 0, 0, Math.PI / 2, 0, 0); b.color(i % 2 ? 0x141c24 : 0x1c2630).cyl(rad, rad * 0.97, -sp * 0.6, sp * 0.6, 7, false); b.pop();
    b.color(0x5a6a7a).box(rad * 1.4, rad * 0.2, sp * 0.8, 0, -rad * 0.9, 0);
    // spines down the whole back, and the great sail fin in the middle third
    b.color(0x2a3a4a).cone(rad * 0.25, rad * 0.9, rad * 1.8, 4);
    if (s > 0.3 && s < 0.6) { const h = rad * 7 * Math.sin((s - 0.3) / 0.3 * Math.PI); b.color(i % 2 ? 0x2a3a4e : 0x3a4a60).card([0, rad, -sp * 0.6], [0, rad + h, 0], [0, rad, sp * 0.6]); g.color(0x5ab0e8).box(0.002, h * 0.8, 0.002, 0, rad + h * 0.45, 0); }
    if (i === 0) { b.color(0x1c2630).blob(0.03, 0.022, 0.05, 0, 0, sp * 1.2, 7, 3); for (const sd of [-1, 1]) g.color(0x8af0ff).box(0.008, 0.004, 0.012, sd * 0.02, 0.01, sp * 1.8); b.color(0xe8e4d8); for (let k = 0; k < 6; k++) for (const sd of [-1, 1]) { b.push(sd * 0.015, -0.01, sp * 0.8 + k * 0.008, Math.PI, 0, 0); b.cone(0.003, 0, 0.012, 3); b.pop(); } }
    if (i === N - 1) b.color(0x2a3a4e).card([0, 0, 0], [0, 0.05, -sp * 3], [0, -0.05, -sp * 3]);
    const S = hold(b, g); S.position.z = 0.5 - i * sp; G.add(S); segs.push({ g: S, s });
  }
  const animate = (t, a = {}) => {
    const A = a.wave ?? 0.012, k = TAU * 2.2;
    for (const S of segs) { const ph = S.s * k - t * 1.3; S.g.position.x = Math.sin(ph) * A * 2.2; S.g.rotation.y = Math.atan(Math.cos(ph) * A * 2.2 * k); S.g.position.y = Math.sin(ph * 0.5 + t * 0.3) * A * (a.coil ?? 0.6); }
  };
  animate(0);
  return { group: G, segs, head: segs[0].g, animate };
}

/* ---------------- 5. THE GLASSBACK: a whale you can see through ---------------- */
function glassback() {
  const r = rng(1005), G = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xbfe8f0, transparent: true, opacity: 0.34, emissive: 0x1a4a58, depthWrite: false, side: THREE.DoubleSide });
  const b = new MeshBuilder(r);
  b.color(0xffffff).blob(0.14, 0.12, 0.46, 0, 0, 0, 12, 7);
  b.blob(0.1, 0.08, 0.14, 0, -0.02, 0.4, 10, 5);
  for (const s of [-1, 1]) b.card([s * 0.12, -0.04, 0.12], [s * 0.42, -0.1, -0.02], [s * 0.34, -0.08, -0.14], [s * 0.12, -0.05, -0.04]);
  b.card([0, 0, -0.44], [0.2, 0.02, -0.66], [0, 0.01, -0.58]); b.card([0, 0, -0.44], [-0.2, 0.02, -0.66], [0, 0.01, -0.58]);
  const body = new THREE.Mesh(b.build(), skin); body.frustumCulled = false; body.renderOrder = 5;
  G.add(body);
  // the insides: a glowing heart, a spine of lamps, coils of gut, ribs
  const g = new MeshBuilder(r), o = new MeshBuilder(r);
  g.color(0xff8aa8).lump(0.045, 0, -0.01, 0.12, 0.2);
  for (let k = 0; k < 14; k++) g.color(k % 3 ? 0x8af0ff : 0xd8a0ff).box(0.012, 0.012, 0.012, 0, 0.07, 0.35 - k * 0.055);
  for (let k = 0; k < 8; k++) g.color(0x9affd0).lump(0.02, Math.sin(k) * 0.05, -0.04 + Math.cos(k * 1.7) * 0.03, -0.05 - k * 0.03, 0.3);
  o.color(0xd8f4f8); for (let k = 0; k < 9; k++) { const z = 0.28 - k * 0.07; for (let j = 0; j < 7; j++) { const a0 = Math.PI * 0.1 + j / 7 * Math.PI * 0.8, a1 = Math.PI * 0.1 + (j + 1) / 7 * Math.PI * 0.8; o.beam([Math.cos(a0) * 0.11, Math.sin(a0) * 0.09, z], [Math.cos(a1) * 0.11, Math.sin(a1) * 0.09, z], 0.004, 0.004); } }
  const inner = new THREE.Mesh(g.build(), MAT.glow); inner.frustumCulled = false;
  const bones = new THREE.Mesh(o.build(), MAT.solid); bones.frustumCulled = false;
  G.add(inner, bones);
  const animate = (t, a = {}) => {
    G.children.forEach(c => { if (c !== inner) c.rotation.z = Math.sin(t * 0.4) * 0.03; });
    inner.scale.setScalar(1 + Math.sin(t * 2.2) * 0.04);
    skin.opacity = (a.fade ?? 1) * 0.34;
  };
  return { group: G, skin, animate };
}

/* ---------------- 6. THE STORM EATER: a thundercloud-coloured ray with lightning veins ---------------- */
function stormeater() {
  const r = rng(1006), G = new THREE.Group();
  const col = 0x3a404c, col2 = 0x2a2e38;
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  // a huge lozenge of a body, with cloud-like billows along the edges
  b.blob(0.18, 0.05, 0.3, 0, 0, 0, 12, 5, 0.06, col, col2);
  for (let k = 0; k < 22; k++) { const a = k / 22 * TAU; b.color(k % 2 ? 0x4a5060 : 0x5a606c).lump(0.05 + r() * 0.03, Math.cos(a) * 0.45 * (0.6 + Math.abs(Math.cos(a)) * 0.4), 0.03, Math.sin(a) * 0.28, 0.3, 0.45); }
  // the face: a slot of a mouth, six small cold eyes
  b.color(0x14161c).box(0.16, 0.012, 0.03, 0, -0.02, 0.29);
  for (let k = 0; k < 6; k++) g.color(0xd8f0ff).box(0.012, 0.008, 0.008, -0.08 + (k % 3) * 0.08, 0.035, 0.24 - Math.floor(k / 3) * 0.03);
  // lightning veins branching over the back
  for (let k = 0; k < 7; k++) { let x = 0, z = 0.1; const a = -1.3 + k / 6 * 2.6; for (let j = 0; j < 5; j++) { const nx = x + Math.sin(a) * 0.08 + (r() - 0.5) * 0.03, nz = z - Math.cos(a) * 0.05 + (r() - 0.5) * 0.02; g.color(0xb8e8ff).beam([x, 0.052, z], [nx, 0.052, nz], 0.006, 0.003); x = nx; z = nz; } }
  G.add(hold(b, g));
  const wings = [];
  for (const s of [-1, 1]) {
    const W = new THREE.Group(); W.position.set(s * 0.16, 0, 0); G.add(W);
    const wb = new MeshBuilder(r), wg = new MeshBuilder(r);
    const pts = [[0, 0.24], [0.2, 0.18], [0.42, 0.02], [0.55, -0.12], [0.35, -0.16], [0.12, -0.2], [0, -0.22]];
    for (let k = 1; k < pts.length - 1; k++) wb.color(k % 2 ? col : col2).card([0, 0, 0], [s * pts[k][0], 0.01, pts[k][1]], [s * pts[k + 1][0], 0.01, pts[k + 1][1]]);
    for (let k = 0; k < 4; k++) wg.color(0x9ad8ff).beam([s * 0.05, 0.02, 0.02], [s * (0.2 + k * 0.08), 0.02, 0.1 - k * 0.07], 0.004, 0.002);
    W.add(hold(wb, wg)); wings.push({ g: W, s });
  }
  const tail = new MeshBuilder(r); tail.color(col2).tube([0, 0, -0.3], [0, 0, -0.85], 0.03, 0.003, 5); g.color(0xb8e8ff); const tailG = hold(tail); G.add(tailG);
  const animate = (t, a = {}) => {
    for (const W of wings) W.g.rotation.z = W.s * Math.sin(t * 0.7) * (a.flap ?? 0.18);
    tailG.rotation.y = Math.sin(t * 0.9) * 0.2;
  };
  animate(0);
  return { group: G, animate };
}

/* ---------------- 7. THE WHALEFALL: an ancient whale with a forest on its back ---------------- */
function whalefall() {
  const r = rng(1007), G = new THREE.Group();
  const col = 0x4a5a64, col2 = 0x3a4852, belly = 0xb8c0c4;
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  b.blob(0.13, 0.12, 0.5, 0, 0, 0, 12, 6, 0.04, col, belly);
  b.color(col2).blob(0.12, 0.1, 0.16, 0, 0.01, 0.4, 10, 5, 0.03);
  for (const s of [-1, 1]) { b.color(0x1a2024).blob(0.012, 0.01, 0.01, s * 0.11, 0.0, 0.42, 5, 3); b.color(col2).card([s * 0.12, -0.06, 0.24], [s * 0.4, -0.12, 0.12], [s * 0.36, -0.12, 0.02], [s * 0.12, -0.08, 0.14]); }
  // throat grooves
  b.color(0x9aa4a8); for (let k = 0; k < 7; k++) b.box(0.005, 0.004, 0.22, -0.06 + k * 0.02, -0.115, 0.3);
  // flukes
  for (const s of [-1, 1]) b.color(col2).card([0, 0.01, -0.48], [s * 0.26, 0.02, -0.66], [s * 0.1, 0.01, -0.62]);
  // the forest on its back: kelp, barnacle towers, a crooked little tree, gulls' nests
  for (let k = 0; k < 40; k++) { const z = -0.35 + r() * 0.7, x = (r() - 0.5) * 0.16; const y = Math.sqrt(Math.max(0, 1 - (x / 0.13) ** 2 - (z / 0.5) ** 2)) * 0.12; b.color(r() < 0.5 ? 0xc8c0b0 : 0xa89e8e).cone(0.006 + r() * 0.008, y, y + 0.01 + r() * 0.03, 5, x, z); }
  for (let k = 0; k < 18; k++) { const z = -0.3 + r() * 0.6, x = (r() - 0.5) * 0.12, y = 0.11; b.color(k % 2 ? 0x4a7a3a : 0x5a8a4a).card([x, y, z], [x + (r() - 0.5) * 0.03, y + 0.06 + r() * 0.05, z + (r() - 0.5) * 0.03], [x + 0.01, y, z + 0.01]); }
  b.color(0x5a4a3a).tube([0.02, 0.115, -0.05], [0.03, 0.2, -0.07], 0.004, 0.003, 4); b.color(0x6a8a4a).lump(0.03, 0.03, 0.21, -0.07, 0.3, 0.6);
  g.color(0xfff0c0).box(0.004, 0.004, 0.004, 0.02, 0.13, 0.1);
  G.add(hold(b, g));
  return { group: G, animate: (t) => { G.children[0].rotation.x = Math.sin(t * 0.3) * 0.02; } };
}

/* ---------------- 8. THE MIRRORFISH: a fish that is also a reflection ---------------- */
function mirrorfish() {
  const r = rng(1008), G = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 140, specular: 0xffffff, flatShading: true, transparent: true, opacity: 1, emissive: 0x202830 });
  const b = new MeshBuilder(r);
  // a tall, flat, perfectly faceted body, like a cut mirror
  b.color(0xd8e4ec).blob(0.05, 0.22, 0.46, 0, 0, 0, 12, 6);
  for (let k = 0; k < 20; k++) b.color(k % 2 ? 0xf4f8fa : 0xb8c8d4).box(0.052, 0.04, 0.05, 0, -0.12 + (k % 5) * 0.06, -0.25 + Math.floor(k / 5) * 0.14);
  b.color(0xc8d8e4).card([0, 0.2, 0.1], [0, 0.42, -0.2], [0, 0.18, -0.3]);
  b.color(0xc8d8e4).card([0, -0.2, 0.05], [0, -0.38, -0.18], [0, -0.18, -0.25]);
  b.color(0xe8f0f4).card([0, 0, -0.44], [0, 0.26, -0.7], [0, -0.26, -0.7]);
  b.color(0x1a2a3a).blob(0.052, 0.03, 0.03, 0, 0.06, 0.34, 6, 3);
  const body = new THREE.Mesh(b.build(), mat); body.frustumCulled = false; G.add(body);
  // two false reflections that only show when the real one hides
  const ghosts = [];
  for (const s of [-1, 1]) { const m = new THREE.Mesh(body.geometry, new THREE.MeshBasicMaterial({ color: 0xd8e8f0, transparent: true, opacity: 0, depthWrite: false })); m.position.x = s * 0.9; m.frustumCulled = false; G.add(m); ghosts.push(m); }
  return { group: G, mat, ghosts, animate: (t, a = {}) => { const v = a.vis ?? 1; mat.opacity = 0.08 + v * 0.92; for (const gm of ghosts) gm.material.opacity = (1 - v) * 0.3 * (0.6 + Math.sin(t * 3 + gm.position.x) * 0.4); body.rotation.y = Math.sin(t * 0.8) * 0.05; } };
}

/* ---------------- 9. THE TRENCH WALKER: legs taller than a lighthouse ---------------- */
function trenchwalker() {
  const r = rng(1009), G = new THREE.Group();
  const col = 0x2a2a30, col2 = 0x3a3440, pale = 0xd8d0c8;
  const body = new THREE.Group(); G.add(body);
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  b.blob(0.1, 0.06, 0.14, 0, 0, 0, 10, 5, 0.08, col2, col);
  for (let k = 0; k < 12; k++) g.color(0xff5a4a).box(0.01, 0.01, 0.01, (k % 4 - 1.5) * 0.03, 0.04, 0.12 - Math.floor(k / 4) * 0.02);
  body.add(hold(b, g));
  const legs = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.3;
    const L = new THREE.Group(); L.position.set(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.1); body.add(L);
    const hip = new THREE.Group(); hip.rotation.order = 'YXZ'; hip.rotation.y = -a + Math.PI / 2; L.add(hip);
    const up = chain(hip, r, 1, 0.55, 0.05, 0.036, col, col2, (bb, i, t, rr, sl) => { bb.color(pale); for (let j = 0; j < 4; j++) bb.cone(rr * 0.4, sl * (0.2 + j * 0.2), sl * (0.2 + j * 0.2) + rr, 4, rr, 0); });
    const knee = new THREE.Group(); knee.position.y = 0.55; up[0].add(knee);
    const low = chain(knee, r, 3, 0.8, 0.036, 0.008, col2, col);
    legs.push({ hip, knee, low, a });
  }
  const animate = (t, a = {}) => {
    legs.forEach((L, i) => {
      // walking: legs splay down and out to the trench floor. Reaching: the
      // front leg swings straight up and out of the sea, a tower of joints
      const ph = t * 0.6 + i * Math.PI / 3, rch = i === 0 ? (a.reach || 0) : 0;
      L.hip.rotation.x = (-2.3 + Math.sin(ph) * 0.15) * (1 - rch) + (-0.12 + Math.sin(t * 0.8) * 0.06) * rch;
      L.knee.rotation.x = (1.1 + Math.cos(ph) * 0.2) * (1 - rch) + (0.25 + Math.sin(t * 1.1) * 0.1) * rch;
      L.low.forEach((S, k) => { S.rotation.x = 0.05 * k; });
    });
  };
  animate(0);
  return { group: G, body, legs, animate };
}

/* ---------------- 10. THE COLOSSUS: an island that walks ---------------- */
function colossus() {
  const r = rng(1010), G = new THREE.Group();
  const stone = 0x5a5a52, stone2 = 0x46463e, moss = 0x5a7a4a;
  const torso = new THREE.Group(); G.add(torso);
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  // a ridged, mountainous back: rock layers, moss, trees, a waterfall, old ruins
  b.lathe([[0.32, -0.05], [0.33, 0.05], [0.28, 0.14], [0.2, 0.22], [0.08, 0.27], [0.01, 0.28]], 12, 0, 0, 0, t => mixHex(stone2, stone, t));
  for (let k = 0; k < 16; k++) { const a = r() * TAU, d = r() * 0.26; b.color(k % 3 ? stone : 0x6a6a60).lump(0.04 + r() * 0.05, Math.cos(a) * d, 0.2 - d * 0.5 + r() * 0.04, Math.sin(a) * d, 0.35, 1.2); }
  b.color(moss); for (let k = 0; k < 40; k++) { const a = r() * TAU, d = r() * 0.28; b.lump(0.012 + r() * 0.012, Math.cos(a) * d, 0.26 - d * 0.6, Math.sin(a) * d, 0.4, 0.5); }
  for (let k = 0; k < 10; k++) { const a = r() * TAU, d = 0.06 + r() * 0.2, x = Math.cos(a) * d, z = Math.sin(a) * d, y = 0.27 - d * 0.6; b.color(0x4a3a2a).tube([x, y, z], [x, y + 0.04, z], 0.003, 0.002, 4); b.color(0x3a6a3a).cone(0.014, y + 0.02, y + 0.07, 5, x, z); }
  b.color(0x8a8478); for (let k = 0; k < 4; k++) b.box(0.012, 0.03, 0.012, -0.06 + k * 0.03, 0.29, 0.02);  b.box(0.1, 0.008, 0.015, -0.015, 0.305, 0.02);
  b.color(0xd8f0f8).box(0.01, 0.12, 0.004, 0.18, 0.12, 0.2);
  // the head: a heavy horned brow jutting forward, lantern eyes deep inside
  b.color(stone2).blob(0.12, 0.08, 0.12, 0, 0.02, 0.36, 9, 4, 0.1);
  for (const s of [-1, 1]) { b.color(0x3a3a34).tube([s * 0.08, 0.06, 0.4], [s * 0.2, 0.14, 0.38], 0.03, 0.006, 5); g.color(0x9af0d0).box(0.02, 0.012, 0.01, s * 0.05, 0.03, 0.47); }
  torso.add(hold(b, g));
  // four columnar legs, like old stone pillars
  const legs = [];
  for (const [x, z] of [[0.24, 0.2], [-0.24, 0.2], [0.24, -0.2], [-0.24, -0.2]]) {
    const L = new THREE.Group(); L.position.set(x, -0.02, z); L.rotation.x = Math.PI; torso.add(L);
    legs.push({ g: L, segs: chain(L, r, 2, 0.5, 0.07, 0.06, stone2, stone, (bb, i, t, rr, sl) => { if (i === 1) { bb.color(stone2); for (let j = 0; j < 4; j++) bb.box(rr * 0.6, rr * 0.4, rr * 0.6, Math.cos(j * 1.6) * rr, sl, Math.sin(j * 1.6) * rr); } }) });
  }
  const animate = (t, a = {}) => {
    const w = a.walk ?? 1;
    legs.forEach((L, i) => { const ph = t * 0.35 + (i === 0 || i === 3 ? 0 : Math.PI); L.segs[0].rotation.x = Math.sin(ph) * 0.35 * w; L.segs[1].rotation.x = Math.max(0, -Math.sin(ph)) * 0.5 * w; });
    torso.position.y = Math.abs(Math.sin(t * 0.35)) * 0.012 * w;
    torso.rotation.z = Math.sin(t * 0.35) * 0.02 * w;
  };
  animate(0);
  return { group: G, torso, animate };
}

const BUILD = { cthulhu, skymaw, drownedking, serpent, glassback, stormeater, whalefall, mirrorfish, trenchwalker, colossus };
export function buildBeast(D, mini = false) {
  const m = BUILD[D.id]();
  if (!mini) m.group.scale.setScalar(D.size);
  m.group.name = 'beast:' + D.id;
  return m;
}
