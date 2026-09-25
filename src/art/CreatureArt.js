/* CreatureArt.js - leviathans, giants and the fish shadows under the water.

   Most leviathans are a FishArt genome at enormous scale with a swimming
   shader: the vertex shader bends the body along its length (local X), so
   a serpent undulates and a whale beats its flukes without any skinning.
   The kraken and the turtle have their own builders because nothing about
   them is fish-shaped. */

import * as THREE from '../../lib/three.module.js?v=1790356418';
import { MeshBuilder, shadeHex, mixHex } from './Geo.js?v=1790356418';
import { buildFish } from './FishArt.js?v=1790356418';
import { rng, TAU } from '../core/Util.js?v=1790356418';
import { U } from './Materials.js?v=1790356418';

/** A Lambert material whose mesh swims: bends in local Z along local X. */
export function swimMaterial(opts = {}) {
  const u = { uAmp: { value: opts.amp ?? 0.06 }, uK: { value: opts.k ?? 7 }, uSpd: { value: opts.speed ?? 5 }, uPh: { value: Math.random() * 10 }, uVert: { value: opts.vertical ? 1 : 0 } };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: !!opts.ghost, opacity: opts.ghost ? 0.45 : 1, depthWrite: !opts.ghost });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u, { uTime: U.uTime });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uAmp; uniform float uK; uniform float uSpd; uniform float uPh; uniform float uVert; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float along = 0.5 - position.x;              // 0 at the nose, 1 at the tail
          float w = sin(position.x * uK - (uTime + uPh) * uSpd) * uAmp * (0.15 + along * along * 1.4);
          if (uVert > 0.5) transformed.y += w; else transformed.z += w;
        }`);
  };
  mat.customProgramCacheKey = () => 'swim';
  mat.userData.u = u;
  return mat;
}

const KIND = {
  catfish: { h: 0.2, w: 0.18, head: 1.4, mouth: 1.8, tail: 'round', pat: 'spots', extras: ['whiskers', 'scar'] },
  pike:    { h: 0.15, w: 0.1, snout: 1.9, mouth: 1.9, tail: 'fork', pat: 'spots', extras: ['teeth', 'scar'] },
  serpent: { h: 0.07, w: 0.055, head: 1.4, mouth: 1.6, tail: 'eel', pat: 'lights', extras: ['crest', 'teeth'] },
  whale:   { h: 0.24, w: 0.21, head: 1.2, mouth: 1.2, tail: 'flukes', pat: 'lights', extras: ['scar'] },
  shark:   { h: 0.22, w: 0.17, mouth: 1.4, tail: 'shark', pat: 'none', extras: ['dorsal', 'teeth', 'scar'] },
  marlin:  { h: 0.2, w: 0.11, tail: 'lunate', pat: 'bars', extras: ['sword', 'sail'] },
  angler:  { h: 0.5, w: 0.42, head: 1.6, mouth: 2.3, tail: 'round', pat: 'lights', extras: ['lure', 'teeth'] },
  eel:     { h: 0.07, w: 0.06, head: 2.2, mouth: 2.6, tail: 'eel', pat: 'lights', extras: ['glowtail', 'teeth'] },
  mother:  { h: 0.09, w: 0.08, head: 1.8, mouth: 1.6, tail: 'eel', pat: 'lights', extras: ['crest', 'glow', 'lure'] },
};

/**
 * Build a leviathan. Returns { group, body (the swimming mesh), mats, size,
 * mouth (Object3D at the head), heart (glow mesh or null) }.
 */
export function buildLeviathan(L) {
  const size = L.size;
  const group = new THREE.Group();
  group.name = 'leviathan:' + L.id;
  if (L.kind === 'kraken') return buildKraken(L, group);
  if (L.kind === 'turtle') return buildTurtle(L, group);
  const K = KIND[L.kind] || KIND.pike;
  const art = Object.assign({ back: L.colors.back, belly: L.colors.belly, fin: L.colors.fin, patCol: L.colors.glow }, K);
  const geos = buildFish(art, L.id.length * 11 + 3);
  const long = L.kind === 'serpent' || L.kind === 'eel' || L.kind === 'mother';
  const mat = swimMaterial({ amp: long ? 0.07 : 0.035, k: long ? 14 : 6, speed: long ? 3 : 2.2, vertical: L.kind === 'whale' });
  const body = new THREE.Mesh(geos.solid, mat);
  body.castShadow = true;
  body.scale.setScalar(size);
  group.add(body);
  const mats = [mat];
  if (geos.glow) {
    const gm = swimMaterial({ amp: mat.userData.u.uAmp.value, k: mat.userData.u.uK.value, speed: mat.userData.u.uSpd.value, vertical: L.kind === 'whale' });
    gm.userData.u.uPh = mat.userData.u.uPh;
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    glowMat.onBeforeCompile = gm.onBeforeCompile;
    glowMat.customProgramCacheKey = () => 'swimglow';
    const g = new THREE.Mesh(geos.glow, glowMat);
    g.scale.setScalar(size);
    group.add(g);
  }
  // a glowing shard inside the chest: the thing that made it grow
  const hb = new MeshBuilder(rng(5));
  hb.color(L.colors.glow).lump(0.5, 0, 0, 0, 0.3, 1.3, 0);
  const heart = new THREE.Mesh(hb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
  heart.position.set(size * 0.08, 0, 0);
  heart.scale.setScalar(size * 0.05);
  group.add(heart);
  const mouth = new THREE.Object3D();
  mouth.position.set(size * 0.5, 0, 0);
  group.add(mouth);
  return { group, body, mats, size, mouth, heart, long };
}

function buildKraken(L, group) {
  const r = rng(77);
  const size = L.size;
  const b = new MeshBuilder(r);
  const C = L.colors;
  // mantle
  b.color(C.back).lathe([[0.05, 1.0], [0.18, 0.9], [0.26, 0.65], [0.28, 0.4], [0.24, 0.18], [0.2, 0.05], [0.22, 0]], 10, 0, 0, 0, t => mixHex(C.back, shadeHex(C.back, 1.3), t));
  // eyes
  for (const s of [-1, 1]) {
    b.color(0xf0e060).blob(0.06, 0.07, 0.04, s * 0.2, 0.12, 0.12, 6, 3);
    b.color(0x111111).box(0.02, 0.07, 0.02, s * 0.2, 0.12, 0.155);
  }
  const body = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  body.scale.setScalar(size);
  body.castShadow = true;
  group.add(body);
  // tentacles: chains of segments, animated in Leviathan.js
  const tentacles = [];
  const tb = new MeshBuilder(r);
  tb.color(C.back).cyl(0.03, 0.022, 0, 0.14, 6, true);
  tb.color(C.belly);
  tb.blob(0.012, 0.012, 0.01, 0, 0.05, 0.026, 4, 2);
  tb.blob(0.012, 0.012, 0.01, 0, 0.1, 0.022, 4, 2);
  const tgeo = tb.build();
  const tmat = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    let parent = new THREE.Group();
    parent.position.set(Math.cos(a) * 0.18 * size, 0.02 * size, Math.sin(a) * 0.18 * size);
    parent.rotation.set(Math.PI - 0.6, 0, 0);
    parent.rotation.order = 'YXZ';
    parent.rotation.y = -a + Math.PI / 2;
    group.add(parent);
    const segs = [];
    for (let k = 0; k < 9; k++) {
      const s = new THREE.Group();
      s.position.y = k === 0 ? 0 : 0.14 * size * (1 - (k - 1) * 0.07);
      const m = new THREE.Mesh(tgeo, tmat);
      const sc = size * (1 - k * 0.085);
      m.scale.set(sc, size * (1 - k * 0.07), sc);
      m.castShadow = true;
      s.add(m);
      parent.add(s);
      segs.push(s);
      parent = s;
    }
    tentacles.push(segs);
  }
  const hb = new MeshBuilder(rng(6));
  hb.color(C.glow).lump(0.5, 0, 0, 0, 0.3, 1.3, 0);
  const heart = new THREE.Mesh(hb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
  heart.position.set(0, size * 0.5, 0);
  heart.scale.setScalar(size * 0.05);
  group.add(heart);
  const mouth = new THREE.Object3D();
  group.add(mouth);
  return { group, body, mats: [], size, mouth, heart, tentacles, kraken: true };
}

function buildTurtle(L, group) {
  const r = rng(88);
  const size = L.size;
  const C = L.colors;
  const b = new MeshBuilder(r);
  // shell: faceted dome with scute colours, coral and a palm tree on top
  for (let i = 0; i < 4; i++) {
    const y0 = i * 0.05, y1 = (i + 1) * 0.05;
    b.color(i % 2 ? C.back : shadeHex(C.back, 0.8)).cyl(0.42 - i * 0.09, 0.42 - (i + 1) * 0.09 + 0.02, y0, y1, 9, i === 3);
  }
  b.color(C.belly).cyl(0.4, 0.43, -0.06, 0.0, 9, true);
  b.color(0x3f8f36);
  for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; b.card([0, 0.26, 0], [Math.cos(a) * 0.08, 0.25, Math.sin(a) * 0.08], [Math.cos(a + 0.3) * 0.05, 0.28, Math.sin(a + 0.3) * 0.05]); }
  b.color(0x7a5c3a).cyl(0.008, 0.006, 0.2, 0.27, 5, false);
  b.color(0xf07a6a).lump(0.03, 0.2, 0.12, 0.1, 0.4);
  b.color(0xf2b84a).lump(0.025, -0.18, 0.1, -0.12, 0.4);
  // head
  b.color(C.fin).blob(0.09, 0.07, 0.12, 0, 0.02, 0.5, 7, 3);
  for (const s of [-1, 1]) b.color(0x111111).blob(0.012, 0.012, 0.01, s * 0.06, 0.05, 0.58, 4, 2);
  const body = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  body.scale.setScalar(size);
  body.castShadow = true;
  group.add(body);
  const flippers = [];
  const fb = new MeshBuilder(r);
  fb.color(C.fin).blob(0.24, 0.025, 0.08, 0.2, 0, 0, 6, 3);
  const fgeo = fb.build();
  for (const [x, z, s] of [[0.32, 0.22, 1], [-0.32, 0.22, -1], [0.3, -0.25, 1], [-0.3, -0.25, -1]]) {
    const p = new THREE.Group();
    p.position.set(x * size, -0.01 * size, z * size);
    const m = new THREE.Mesh(fgeo, body.material);
    m.scale.set(size * s, size, size);
    p.add(m);
    group.add(p);
    flippers.push(p);
  }
  const hb = new MeshBuilder(rng(7));
  hb.color(C.glow).lump(0.5, 0, 0, 0, 0.3, 1.3, 0);
  const heart = new THREE.Mesh(hb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
  heart.position.set(0, size * 0.1, 0);
  heart.scale.setScalar(size * 0.04);
  group.add(heart);
  const mouth = new THREE.Object3D(); mouth.position.set(0, 0, size * 0.55); group.add(mouth);
  // turtle faces +Z; rotate the group's content so the "nose" is +X like the others
  for (const c of group.children) {
    const px = c.position.x, pz = c.position.z;
    c.position.x = pz; c.position.z = -px;
    c.rotation.y += Math.PI / 2;
  }
  return { group, body, mats: [], size, mouth, heart, flippers, turtle: true };
}

/* ---------------- shadows of fish under the surface ---------------- */
let shadowGeo = null;
export function fishShadowGeo() {
  if (shadowGeo) return shadowGeo;
  const b = new MeshBuilder();
  b.color(0x0a1a22);
  const pts = [[0.5, 0], [0.3, 0.12], [0, 0.15], [-0.3, 0.08], [-0.42, 0], [-0.3, -0.08], [0, -0.15], [0.3, -0.12]];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    b.tri([0, 0, 0], [a[0], 0, a[1]], [c[0], 0, c[1]]);
    b.tri([0, 0, 0], [c[0], 0, c[1]], [a[0], 0, a[1]]);
  }
  b.tri([-0.4, 0, 0], [-0.62, 0, 0.16], [-0.62, 0, -0.16]);
  b.tri([-0.4, 0, 0], [-0.62, 0, -0.16], [-0.62, 0, 0.16]);
  shadowGeo = b.build();
  return shadowGeo;
}
export const shadowMat = new THREE.MeshBasicMaterial({ color: 0x06121a, transparent: true, opacity: 0.4, depthWrite: false });
