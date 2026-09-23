/* GreatArt.js - the three Great Leviathans of Vigil's End and the Kraken.

   None of these are a fish genome scaled up. Each has its own skeleton:

     The Graveback  a whale gone to stone: a blunt, bony head with an
                    underbite and tusks, rows of plates along the spine like
                    a churchyard, barnacle crusts, long knobbed flippers and
                    enormous flukes. Six body segments on a slow vertical
                    wave, so the flukes beat and the back rolls.
     The Ninefold   a sea serpent: twenty-eight segments with a sail crest,
                    a frilled head with horns and a lamp-eyed stare. A
                    travelling wave runs down the body at four and a half
                    wavelengths - nine arches break the surface at once.
     The Hushwing   a pale manta: a diamond body, two wide wings built as
                    fans of facets that flap from the shoulder, curled horn
                    lobes, six eyes along the brow, a long whip tail and
                    glowing lines across the back.
     The Kraken     arms (a chain of tapering, suckered segments that curl
                    over your rail), and a head - a mantle and two huge eyes
                    - that you only see once, when it dives.

   Convention: forward is +Z, up is +Y, the root's rotation.y is the heading
   (forward = (sin h, 0, cos h)). The whole creature is built one unit long
   (or wide) and the root is scaled by the creature's size in metres.
   Every builder returns { group, animate(t, a), pose(t) } plus named parts
   the encounter code needs (head, tail, wings, segs...). */

import * as THREE from '../../lib/three.module.js?v=1790192871';
import { MeshBuilder, shadeHex, mixHex } from './Geo.js?v=1790192871';
import { MAT } from './Materials.js?v=1790192871';
import { rng, TAU } from '../core/Util.js?v=1790192871';

const mesh = (b, mat = MAT.solid) => { const m = new THREE.Mesh(b.build(), mat); m.castShadow = true; return m; };
const holder = (b, g) => { const G = new THREE.Group(); if (b.tris) G.add(mesh(b)); if (g && g.tris) G.add(new THREE.Mesh(g.build(), MAT.glow)); return G; };

/* ======================================================================
   THE GRAVEBACK
   ====================================================================== */
function buildGraveback(D) {
  const C = D.colors, r = rng(101);
  const root = new THREE.Group();
  // [zCentre, halfLength, width, height]
  const SEG = [[0.37, 0.13, 0.095, 0.08], [0.18, 0.11, 0.125, 0.105], [-0.02, 0.1, 0.12, 0.1], [-0.19, 0.085, 0.092, 0.078], [-0.32, 0.065, 0.058, 0.05], [-0.42, 0.045, 0.032, 0.03]];
  const segs = [];
  SEG.forEach(([zc, hl, w, h], i) => {
    const b = new MeshBuilder(r), g = new MeshBuilder(r);
    b.blob(w, h, hl * 1.5, 0, 0, 0, 10, 6, 0.06, C.back, C.belly);
    // gravestone plates along the spine
    if (i < 5) for (let k = 0; k < 3; k++) {
      const z = -hl * 0.7 + k * hl * 0.7;
      b.color(shadeHex(C.plate, 0.85 + r() * 0.3));
      b.push((r() - 0.5) * w * 0.3, h * 0.9, z, (r() - 0.5) * 0.3, r() * 0.6, (r() - 0.5) * 0.4);
      b.box(w * 0.35, h * (0.35 + r() * 0.35), w * 0.1, 0, 0, 0);
      b.color(shadeHex(C.plate, 0.7)).box(w * 0.37, h * 0.05, w * 0.12, 0, h * 0.2, 0);
      b.pop();
      // side plates, like shingles
      for (const s of [-1, 1]) { b.color(shadeHex(C.plate, 0.8 + r() * 0.3)); b.push(s * w * 0.75, h * 0.45, z + hl * 0.2, 0, 0, s * 0.9); b.box(w * 0.25, h * 0.08, hl * 0.4, 0, 0, 0); b.pop(); }
    }
    // barnacle crusts
    b.color(C.barnacle);
    for (let k = 0; k < 7; k++) { const a = r() * Math.PI, z = (r() - 0.5) * hl * 1.6; b.lump(w * (0.05 + r() * 0.05), Math.cos(a) * w * 0.95, Math.sin(a) * h * 0.85, z, 0.4, 0.7); }
    if (i === 0) {
      // the head: brow ridge, underbite jaw, tusks, little amber eyes
      b.color(shadeHex(C.back, 1.15)).blob(w * 1.02, h * 0.45, hl * 0.9, 0, h * 0.55, hl * 0.1, 8, 3, 0.1);
      b.color(shadeHex(C.belly, 0.85)).blob(w * 0.95, h * 0.42, hl * 1.1, 0, -h * 0.62, hl * 0.28, 8, 3, 0.06);
      b.color(0xe8e0cc);
      for (const s of [-1, 1]) { b.push(s * w * 0.62, -h * 0.4, hl * 1.1, -0.5, 0, s * -0.15); b.cone(w * 0.12, 0, h * 0.95, 5); b.pop(); }
      for (let k = 0; k < 8; k++) { const x = (k / 7 - 0.5) * w * 1.3; b.push(x, -h * 0.28, hl * 1.22 - Math.abs(x) * 0.6, -0.2, 0, 0); b.cone(w * 0.04, 0, h * 0.22, 3); b.pop(); }
      for (const s of [-1, 1]) {
        b.color(0x2a2620).blob(w * 0.13, h * 0.14, hl * 0.1, s * w * 0.9, h * 0.12, hl * 0.35, 6, 3);
        g.color(C.eye).blob(w * 0.08, h * 0.09, hl * 0.07, s * w * 0.97, h * 0.12, hl * 0.37, 5, 3);
      }
      // the blowholes, and old harpoon scars
      b.color(0x2a2a2a).box(w * 0.2, h * 0.04, hl * 0.1, 0, h * 0.99, -hl * 0.55);
      b.color(0x9a948a); for (let k = 0; k < 3; k++) b.beam([w * 0.4, h * 0.7 - k * h * 0.2, -hl * 0.2], [w * 0.8, h * 0.5 - k * h * 0.2, hl * 0.3], 0.004, 0.004);
    }
    if (i === 5) {
      // the flukes: two broad blades
      b.color(shadeHex(C.back, 0.9));
      for (const s of [-1, 1]) {
        b.quad([0, 0, -hl * 0.3], [s * 0.13, 0.008, -hl * 1.6], [s * 0.2, 0.004, -hl * 3.4], [s * 0.02, 0, -hl * 2.0], [0, 1, 0]);
        b.quad([0, -0.012, -hl * 0.3], [s * 0.13, -0.004, -hl * 1.6], [s * 0.2, -0.008, -hl * 3.4], [s * 0.02, -0.012, -hl * 2.0], [0, -1, 0]);
        b.color(C.barnacle).lump(0.012, s * 0.12, 0.01, -hl * 2.2, 0.4, 0.5);
        b.color(shadeHex(C.back, 0.9));
      }
    }
    const G = holder(b, g);
    G.position.z = zc;
    root.add(G);
    segs.push({ g: G, z: zc });
  });
  // flippers: long and knobbed, from the second segment
  const flippers = [];
  for (const s of [-1, 1]) {
    const b = new MeshBuilder(r);
    b.color(shadeHex(C.back, 0.95)).blob(0.16, 0.012, 0.04, s * 0.16, 0, -0.02, 7, 2, 0.1);
    b.color(C.barnacle); for (let k = 0; k < 5; k++) b.lump(0.009, s * (0.05 + k * 0.05), 0.01, 0.02 - k * 0.012, 0.4, 0.6);
    const f = holder(b);
    f.position.set(s * 0.1, -0.05, 0.2);
    f.rotation.z = s * 0.3; f.rotation.y = s * 0.45;
    root.add(f);
    flippers.push({ g: f, s });
  }
  const animate = (t, amp = 1) => {
    for (let i = 0; i < segs.length; i++) {
      const S = segs[i], k = i / (segs.length - 1);
      const w = Math.sin(t * 0.9 - k * 2.2) * 0.02 * amp * (0.2 + k * k * 1.6);
      S.g.position.y = w;
      S.g.rotation.x = -Math.cos(t * 0.9 - k * 2.2) * 0.12 * amp * k * k;
    }
    for (const F of flippers) F.g.rotation.x = Math.sin(t * 0.7 + F.s) * 0.25 * amp;
  };
  animate(0);
  return { group: root, segs, head: segs[0].g, tail: segs[5].g, animate, pose: t => animate(t, 1.5), length: 1 };
}

/* ======================================================================
   THE NINEFOLD
   ====================================================================== */
function buildNinefold(D) {
  const C = D.colors, r = rng(202);
  const root = new THREE.Group();
  const N = 28, spacing = 1 / N;
  const segs = [];
  for (let i = 0; i < N; i++) {
    const s = i / (N - 1);
    const rad = (s < 0.12 ? 0.014 + s * 0.06 : 0.0212 * (1 - Math.pow((s - 0.12) / 0.88, 1.6)) + 0.0028);
    const b = new MeshBuilder(r), g = new MeshBuilder(r);
    b.push(0, 0, 0, Math.PI / 2, 0, 0);
    b.color(i % 2 ? C.back : shadeHex(C.back, 1.12)).cyl(rad * 1.02, rad, -spacing * 0.62, spacing * 0.62, 7, false);
    b.pop();
    // pale belly scutes
    b.color(C.belly).box(rad * 1.2, rad * 0.25, spacing * 0.9, 0, -rad * 0.86, 0);
    // the sail crest
    if (i > 1 && i < N - 3) {
      const hgt = rad * (1.6 + Math.sin(s * Math.PI) * 1.4);
      b.color(i % 3 ? C.fin : shadeHex(C.fin, 1.2)).card([0, rad * 0.9, -spacing * 0.55], [0, rad * 0.9 + hgt, -spacing * 0.1], [0, rad * 0.9, spacing * 0.55]);
      b.color(shadeHex(C.fin, 0.7)).card([0, rad * 0.9 + hgt, -spacing * 0.1], [0, rad * 0.95 + hgt * 1.1, -spacing * 0.25], [0, rad * 0.9 + hgt * 0.8, -spacing * 0.35]);
      if (i % 4 === 0) g.color(C.glow).box(rad * 0.3, rad * 0.3, rad * 0.3, 0, rad * 0.9 + hgt * 0.5, 0);
    }
    // side fins now and then
    if (i === 3 || i === 10 || i === 18) for (const sd of [-1, 1]) { b.color(C.frill).card([sd * rad, 0, 0], [sd * rad * 3.4, -rad * 0.4, -spacing * 0.8], [sd * rad * 2.2, -rad * 0.2, spacing * 0.5]); }
    if (i === 0) {
      // the head: long skull, frills, horns, lamp eyes, teeth
      const hr = 0.024;
      b.color(C.back).blob(hr * 1.1, hr * 0.85, hr * 2.6, 0, hr * 0.1, spacing * 1.6, 8, 4, 0.06, C.back, C.belly);
      b.color(shadeHex(C.belly, 0.9)).blob(hr * 0.9, hr * 0.45, hr * 2.2, 0, -hr * 0.55, spacing * 1.9, 7, 3);
      b.color(0xf0ece0); for (let k = 0; k < 7; k++) for (const sd of [-1, 1]) { b.push(sd * hr * 0.55, -hr * 0.35, spacing * 1.2 + k * hr * 0.55, Math.PI, 0, 0); b.cone(hr * 0.1, 0, hr * 0.45, 3); b.pop(); }
      for (const sd of [-1, 1]) {
        // the frill: a fan of spines with webbing
        for (let k = 0; k < 5; k++) {
          const a = -0.6 + k * 0.3;
          b.color(k % 2 ? C.frill : shadeHex(C.frill, 0.8)).card([sd * hr * 0.8, hr * 0.3, spacing * 0.8], [sd * (hr * 0.8 + Math.cos(a) * hr * 3.2), hr * 0.3 + Math.sin(a) * hr * 3.2, spacing * 0.3 - k * hr * 0.2], [sd * (hr * 0.8 + Math.cos(a + 0.3) * hr * 3.0), hr * 0.3 + Math.sin(a + 0.3) * hr * 3.0, spacing * 0.2 - k * hr * 0.2]);
        }
        b.color(0x3a3a34); b.push(sd * hr * 0.5, hr * 0.8, spacing * 1.1, -0.9, 0, sd * -0.35); b.cone(hr * 0.22, 0, hr * 2.4, 5); b.pop();
        b.color(0x1a1e1a).blob(hr * 0.3, hr * 0.26, hr * 0.28, sd * hr * 0.92, hr * 0.35, spacing * 2.2, 6, 3);
        g.color(C.eye).blob(hr * 0.2, hr * 0.18, hr * 0.18, sd * hr * 1.05, hr * 0.37, spacing * 2.25, 5, 3);
      }
      // barbels hanging from the chin
      b.color(C.fin); for (const sd of [-1, 1]) b.tube([sd * hr * 0.4, -hr * 0.7, spacing * 2.6], [sd * hr * 1.4, -hr * 2.6, spacing * 2.0], hr * 0.08, hr * 0.02, 4);
    }
    if (i === N - 1) { b.color(C.fin).card([0, 0, 0], [0, rad * 6, -spacing * 2], [0, -rad * 6, -spacing * 2]); }
    const G = holder(b, g);
    G.position.z = 0.5 - i * spacing;
    root.add(G);
    segs.push({ g: G, s, z: 0.5 - i * spacing });
  }
  // a: { wave: amplitude of the arches, rear: 0..1 head lifted, speed }
  const animate = (t, a = {}) => {
    const A = a.wave ?? 0.02, rear = a.rear || 0, sp = a.speed ?? 1.4;
    const k = TAU * 4.5;
    for (let i = 0; i < segs.length; i++) {
      const S = segs[i];
      const ph = S.s * k - t * sp;
      let y = Math.sin(ph) * A, slope = Math.cos(ph) * A * k;
      // rearing: the front third lifts out of the water and looks around
      const front = Math.max(0, 1 - S.s / 0.28);
      if (rear > 0) { y += rear * front * front * 0.16; slope -= rear * front * 0.9; }
      S.g.position.y = y;
      S.g.rotation.x = -Math.atan(slope);
      S.g.rotation.y = Math.sin(t * 0.8 + S.s * 6) * 0.05 * (1 - rear * front);
    }
  };
  animate(0);
  return { group: root, segs, head: segs[0].g, tail: segs[N - 1].g, animate, pose: t => animate(t * 3, { wave: 0.03, rear: 0.6 }), length: 1 };
}

/* ======================================================================
   THE HUSHWING
   ====================================================================== */
function buildHushwing(D) {
  const C = D.colors, r = rng(303);
  const root = new THREE.Group();
  // body: a flattened diamond with a raised back
  const bb = new MeshBuilder(r), bg = new MeshBuilder(r);
  bb.blob(0.12, 0.045, 0.2, 0, 0, 0.02, 10, 5, 0.03, C.back, C.belly);
  bb.color(shadeHex(C.back, 1.05)).blob(0.07, 0.03, 0.14, 0, 0.03, 0.0, 8, 3);
  // the horn lobes, curled forward
  for (const s of [-1, 1]) {
    bb.color(shadeHex(C.back, 0.92));
    let px = s * 0.06, py = 0.0, pz = 0.2;
    for (let k = 0; k < 5; k++) { const nx = px + s * 0.012, ny = py - 0.012 + k * 0.004, nz = pz + 0.028 - k * 0.004; bb.tube([px, py, pz], [nx, ny, nz], 0.018 - k * 0.002, 0.016 - k * 0.002, 5); px = nx; py = ny; pz = nz; }
  }
  // six eyes along the brow, three a side, in dark sockets with a cold rim
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x = s * (0.03 + k * 0.022), z = 0.19 - k * 0.018;
    bb.color(C.eye).blob(0.011, 0.009, 0.009, x, 0.03, z, 5, 3);
    bg.color(C.glow).box(0.004, 0.004, 0.004, x, 0.04, z + 0.008);
  }
  // the gill slits underneath and the mouth
  bb.color(0x6a7078); bb.box(0.1, 0.006, 0.012, 0, -0.04, 0.21);
  for (let k = 0; k < 5; k++) for (const s of [-1, 1]) bb.box(0.004, 0.003, 0.02, s * (0.03 + k * 0.012), -0.045, 0.08);
  root.add(holder(bb, bg));
  // the wings: fans of facets from the shoulder, hinged so they flap
  const wings = [];
  for (const s of [-1, 1]) {
    const b = new MeshBuilder(r), g = new MeshBuilder(r);
    const pts = [[0, 0, 0.12], [0.2, 0.012, 0.08], [0.42, 0.03, -0.02], [0.52, 0.04, -0.1], [0.36, 0.02, -0.12], [0.18, 0.005, -0.14], [0, 0, -0.12]];
    const up = [0, 1, 0];
    for (let k = 1; k < pts.length - 1; k++) {
      const a = pts[0], p = pts[k], q = pts[k + 1];
      const A = [s * a[0], a[1] + 0.006, a[2]], P = [s * p[0], p[1] + 0.006, p[2]], Q = [s * q[0], q[1] + 0.006, q[2]];
      b.color(mixHex(C.back, C.spot, k / pts.length * 0.4)).triO(A, P, Q, up);
      b.color(C.belly).triO([A[0], A[1] - 0.012, A[2]], [P[0], P[1] - 0.012, P[2]], [Q[0], Q[1] - 0.012, Q[2]], [0, -1, 0]);
      // the thin edge
      b.color(shadeHex(C.back, 0.8)).quad(P, Q, [Q[0], Q[1] - 0.012, Q[2]], [P[0], P[1] - 0.012, P[2]], [s * 0.2, 0, -0.1]);
    }
    // grey spots, and glowing lines raying out from the shoulder
    b.color(C.spot); for (let k = 0; k < 9; k++) { const x = 0.08 + r() * 0.3, z = -0.08 + r() * 0.12; b.box(0.02 + r() * 0.02, 0.003, 0.015 + r() * 0.015, s * x, 0.018 + x * 0.04, z); }
    g.color(C.glow); for (let k = 0; k < 4; k++) { const a = -0.3 + k * 0.25; g.beam([s * 0.04, 0.02, 0.02], [s * (0.04 + Math.cos(a) * 0.38), 0.035, 0.02 + Math.sin(a) * 0.14], 0.004, 0.002); }
    const W = holder(b, g);
    W.position.set(s * 0.08, 0.005, 0);
    root.add(W);
    wings.push({ g: W, s });
  }
  // the whip tail
  const tail = [];
  let parent = root;
  for (let k = 0; k < 10; k++) {
    const b = new MeshBuilder(r);
    b.color(k % 2 ? C.back : C.spot);
    b.push(0, 0, 0, -Math.PI / 2, 0, 0); b.cyl(0.008 - k * 0.0006, 0.007 - k * 0.0006, 0, 0.05, 5, false); b.pop();
    if (k === 0) { b.color(C.back); for (const s of [-1, 1]) b.card([0, 0, 0], [s * 0.03, 0.002, -0.05], [0, 0, -0.06]); }
    const T = holder(b);
    T.position.z = k === 0 ? -0.17 : -0.05;
    parent.add(T);
    tail.push(T);
    parent = T;
  }
  const animate = (t, a = {}) => {
    const flap = a.flap ?? 0.35, sp = a.speed ?? 1.2;
    for (const W of wings) {
      W.g.rotation.z = W.s * (Math.sin(t * sp) * flap + (a.glide ? 0.12 : 0));
      W.g.rotation.x = Math.cos(t * sp) * flap * 0.25;
    }
    tail.forEach((T, k) => { T.rotation.y = Math.sin(t * 2 - k * 0.6) * 0.18; T.rotation.x = Math.sin(t * 1.3 - k * 0.5) * 0.06; });
  };
  animate(0);
  return { group: root, wings, tail, head: root, animate, pose: t => animate(t, { flap: 0.5 }), length: 0.5 };
}

export function buildGreat(D, mini = false) {
  const b = D.id === 'graveback' ? buildGraveback(D) : D.id === 'ninefold' ? buildNinefold(D) : buildHushwing(D);
  if (!mini) b.group.scale.setScalar(D.size);
  b.group.name = 'great:' + D.id;
  return b;
}

/* ======================================================================
   THE KRAKEN
   ====================================================================== */
const KC = { skin: 0x6a1e2e, skin2: 0x8a2e3a, belly: 0xe8b8b0, sucker: 0xf4d8cc, eye: 0xf0d040 };

/** One arm: a chain of tapering segments rising along +Y, suckers facing +X
    (the way it curls). `len` in metres. */
export function buildTentacle(len = 10, seed = 1) {
  const r = rng(seed * 17 + 3);
  const N = 14, segL = len / N;
  const root = new THREE.Group();
  const segs = [];
  let parent = root;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const r0 = len * 0.055 * (1 - t0 * 0.85) + 0.02, r1 = len * 0.055 * (1 - t1 * 0.85) + 0.02;
    const b = new MeshBuilder(r);
    b.color(i % 2 ? KC.skin : KC.skin2).cyl(r0, r1, 0, segL * 1.04, 8, false, 0, 0, 0, 0.05);
    // the pale underside and two rows of suckers
    b.color(KC.belly).box(r0 * 0.9, segL * 0.98, r0 * 0.25, r0 * 0.78, segL * 0.5, 0);
    for (let k = 0; k < 2; k++) for (const s of [-1, 1]) {
      const y = segL * (0.25 + k * 0.5);
      b.push(r0 * 0.9, y, s * r0 * 0.35, 0, 0, -Math.PI / 2); b.color(KC.sucker).cyl(r0 * 0.22, r0 * 0.16, 0, r0 * 0.14, 6, true); b.color(0x8a4a4a).cyl(r0 * 0.1, r0 * 0.1, r0 * 0.14, r0 * 0.15, 5, true); b.pop();
    }
    // warty skin on top
    b.color(shadeHex(KC.skin, 0.8)); for (let k = 0; k < 3; k++) b.lump(r0 * 0.14, -r0 * 0.8 + r() * r0 * 0.3, segL * r(), (r() - 0.5) * r0 * 1.2, 0.4, 0.8);
    if (i === N - 1) b.color(KC.skin2).cone(r1, segL, segL * 2.2, 6);
    const S = new THREE.Group();
    S.position.y = i === 0 ? 0 : segL;
    const m = mesh(b); S.add(m);
    parent.add(S);
    segs.push(S);
    parent = S;
  }
  const tip = new THREE.Object3D(); tip.position.y = segL * 1.6; parent.add(tip);
  return { group: root, segs, tip, len };
}

/** The head you see once, as it dives: a mantle and two huge eyes. */
export function buildKrakenHead(size = 14) {
  const r = rng(404);
  const b = new MeshBuilder(r), g = new MeshBuilder(r);
  b.lathe([[0.3, 0], [0.34, 0.12], [0.32, 0.35], [0.26, 0.6], [0.17, 0.82], [0.07, 0.95], [0.01, 1.0]], 12, 0, 0, 0, t => mixHex(KC.skin2, KC.skin, t));
  b.color(shadeHex(KC.skin, 0.75)); for (let k = 0; k < 30; k++) { const a = r() * TAU, y = 0.1 + r() * 0.75; const rr = 0.33 * (1 - y * 0.75); b.lump(0.012 + r() * 0.02, Math.cos(a) * rr, y, Math.sin(a) * rr, 0.4, 0.6); }
  for (const s of [-1, 1]) {
    b.color(0x3a1018).blob(0.1, 0.09, 0.06, s * 0.27, 0.12, 0.13, 8, 4);
    g.color(KC.eye).blob(0.085, 0.075, 0.04, s * 0.3, 0.12, 0.16, 8, 4);
    b.color(0x0a0a0a).box(0.05, 0.1, 0.02, s * 0.31, 0.12, 0.2);
    b.color(0x3a1018).blob(0.11, 0.025, 0.07, s * 0.27, 0.2, 0.12, 6, 2);
  }
  // arm roots into the water
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.color(k % 2 ? KC.skin : KC.skin2).tube([Math.cos(a) * 0.22, 0.02, Math.sin(a) * 0.22], [Math.cos(a) * 0.5, -0.12, Math.sin(a) * 0.5], 0.08, 0.05, 7); }
  const G = holder(b, g);
  G.scale.setScalar(size);
  return G;
}

/** A small statue of the kraken for the bookcase. About a metre tall. */
export function buildKrakenStatue() {
  const G = new THREE.Group();
  const h = buildKrakenHead(0.55);
  h.position.y = 0.05;
  G.add(h);
  for (let k = 0; k < 6; k++) {
    const T = buildTentacle(0.9, k + 2);
    const a = k / 6 * TAU;
    T.group.position.set(Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16);
    T.group.rotation.y = -a;
    T.segs.forEach((s, i) => { s.rotation.z = -0.28 - (i / 14) * 0.2 * (k % 2 ? 1 : -0.5); });
    G.add(T.group);
  }
  return G;
}
