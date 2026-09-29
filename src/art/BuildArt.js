/* BuildArt.js - the pieces of a blueprint, the materials you carry, and
   the pickaxe and blueprint book in your hands.

   Every part of a blueprint is one physical piece - a stone, a log, a
   plank - so a half-built shelter looks half built: real stones where
   you have laid them and a pale blue ghost where the rest will go. */

import * as THREE from '../../lib/three.module.js';
import { MeshBuilder, shadeHex } from './Geo.js';
import { MAT } from './Materials.js';
import { rng, TAU } from '../core/Util.js';

const WOOD = 0x8a5a36, WOOD2 = 0x6e4428, BARK = 0x4e3624, PLANK = 0xb08458, STONE = 0x8e8e88, FIBRE = 0x9ab04a;

/** One part as geometry, in its own frame (origin at its base or centre, as `k` says). */
function partBuilder(p, seed = 1) {
  const b = new MeshBuilder(rng(seed));
  const w = p.w || 0.3, h = p.h || 0.1, d = p.d || w;
  switch (p.k) {
    case 'stone':
      b.color(STONE, 0.12).lump(w, 0, 0, 0, 0.3, 0.7);
      b.color(shadeHex(STONE, 0.8)).lump(w * 0.45, w * 0.3, w * 0.2, -w * 0.2, 0.3, 0.6);
      break;
    case 'log': {
      // along local X, centred
      b.push(0, 0, 0, 0, 0, Math.PI / 2);
      b.color(BARK, 0.1).cyl(h, h * 0.94, -w / 2, w / 2, 7, false);
      b.color(0xd0a870).cyl(h * 0.9, h * 0.9, w / 2, w / 2 + 0.005, 7, true);
      b.color(0xd0a870).cyl(h * 0.9, h * 0.9, -w / 2 - 0.005, -w / 2, 7, true);
      b.pop();
      break;
    }
    case 'plank': {
      const c = p.soil ? 0x3a2a1c : p.sand ? 0xd8c890 : p.m === 'iron' ? 0x4a4644 : p.m === 'stone' ? 0x8e8e88 : PLANK;
      b.color(c, 0.08).box(w, h, d, 0, 0, 0);
      b.color(shadeHex(c, p.m === 'iron' ? 1.4 : 0.8)).box(w * 1.001, h * 0.2, d * 0.04, 0, h * 0.5, 0);
      break;
    }
    case 'glass':
      // a pane: thin, with a faint edge so you can see where it is
      b.color(0xdff4ff).box(w, h, d, 0, 0, 0);
      break;
    case 'post': {
      if (p.m === 'iron') { b.color(0x3e4246, 0.05).box(w * 2, h, w * 2, 0, h / 2, 0); b.color(0x5a5e64).box(w * 2.4, 0.06, w * 2.4, 0, h - 0.03, 0).box(w * 2.4, 0.06, w * 2.4, 0, 0.03, 0); break; }
      b.color(WOOD, 0.08).cyl(w, w * 0.9, 0, h, 6, true);
      b.color(BARK).cyl(w * 1.04, w * 1.04, h * 0.1, h * 0.2, 6, false);
      break;
    }
    case 'stake':
      b.color(WOOD2, 0.08).cyl(w, w * 0.95, 0, h, 6, false);
      b.color(0xd0a870).cone(w, h, h + w * 2.4, 6);
      break;
    case 'crystal':
      b.color(0x9ae8f0).cyl(w * 0.5, w, -h * 0.5, 0, 5, true);
      b.color(0xc8f8ff).cone(w, 0, h * 0.5, 5);
      b.color(0x3a3a40).cyl(0.012, 0.012, 0, 0.32, 4, false);
      break;
    case 'thatch':
      b.color(FIBRE, 0.15);
      for (let i = 0; i < 5; i++) { const x = (i / 4 - 0.5) * w; b.card([x, h / 2, 0], [x - 0.05, -h / 2, 0.02], [x + 0.06, -h / 2, -0.02]); }
      b.color(0x6a7a3a).box(w, 0.04, 0.04, 0, h / 2, 0);
      break;
    default:
      b.color(WOOD).box(w, h, d, 0, 0, 0);
  }
  return b;
}

const geoCache = new Map();
export function partGeo(p) {
  const key = [p.k, p.w, p.h, p.d, p.m, p.soil ? 's' : '', p.sand ? 'd' : ''].join(':');
  if (!geoCache.has(key)) geoCache.set(key, partBuilder(p, key.length).build());
  return geoCache.get(key);
}

/** The ghost: pale blue where it is waiting for you, gold where you are about to put the next piece. */
/** Aquarium glass: clear, faintly blue, with a hard highlight. */
export const GLASS = new THREE.MeshPhongMaterial({ color: 0xcfefff, transparent: true, opacity: 0.16, shininess: 120, specular: 0xffffff, depthWrite: false, side: THREE.DoubleSide });
export const GHOST = {
  wait: new THREE.MeshBasicMaterial({ color: 0x8ad8ff, transparent: true, opacity: 0.42, depthWrite: false }),
  locked: new THREE.MeshBasicMaterial({ color: 0x8ad8ff, transparent: true, opacity: 0.16, depthWrite: false }),
  next: new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.6, depthWrite: false }),
  bad: new THREE.MeshBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.35, depthWrite: false }),
  good: new THREE.MeshBasicMaterial({ color: 0x8aff9a, transparent: true, opacity: 0.35, depthWrite: false }),
};

/** A loose piece of material lying in the world (or in your hands). */
const pieceCache = {};
export function pieceGeo(k) {
  if (pieceCache[k]) return pieceCache[k];
  const b = new MeshBuilder(rng(k.length + 5));
  if (k === 'wood') {
    b.push(0, 0, 0, 0, 0, Math.PI / 2);
    b.color(BARK, 0.1).cyl(0.11, 0.1, -0.45, 0.45, 7, false);
    b.color(0xd8b078).cyl(0.1, 0.1, 0.45, 0.455, 7, true); b.color(0xd8b078).cyl(0.1, 0.1, -0.455, -0.45, 7, true);
    b.color(shadeHex(0xd8b078, 0.7)).cyl(0.04, 0.04, 0.455, 0.46, 5, true);
    b.pop();
  } else if (k === 'stone') {
    b.color(STONE, 0.12).lump(0.16, 0, 0, 0, 0.35, 0.75);
  } else if (k === 'fibre') {
    b.color(FIBRE, 0.2);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; b.card([Math.cos(a) * 0.03, -0.18, Math.sin(a) * 0.03], [Math.cos(a) * 0.1, 0.2, Math.sin(a) * 0.1], [Math.cos(a + 0.4) * 0.07, 0.2, Math.sin(a + 0.4) * 0.07]); }
    b.color(0x8a6a3a).cyl(0.045, 0.045, -0.03, 0.03, 6, true);
  } else if (k === 'crystal') {
    b.color(0x9ae8f0).cyl(0.05, 0.08, -0.1, 0.05, 5, true); b.color(0xd8fcff).cone(0.08, 0.05, 0.2, 5);
  } else if (k === 'iron') {
    b.color(0x4a4442, 0.1).lump(0.14, 0, 0, 0, 0.35, 0.8);
    b.color(0xb07050); for (let i = 0; i < 4; i++) b.lump(0.035, (i - 1.5) * 0.06, 0.08, (i % 2 - 0.5) * 0.1, 0.3);
  }
  return (pieceCache[k] = b.build());
}
export function pieceMesh(k) {
  const m = new THREE.Mesh(pieceGeo(k), k === 'crystal' ? MAT.glow : MAT.solid);
  m.castShadow = true;
  return m;
}

/** The pickaxe, for the first-person hands. */
export function pickMeshBuilder(b, iron = false) {
  b.color(iron ? 0x4a3222 : 0x7a5836).cyl(0.021, 0.025, -0.22, 0.58, 6, true);
  b.color(0x4a3222).cyl(0.03, 0.03, -0.22, -0.1, 6, true);
  b.color(0x6a6e74).box(0.05, 0.07, 0.07, 0, 0.54, 0);
  // the head: a pick one way, a flat chisel the other
  b.color(iron ? 0x3e4246 : 0x8a9098).beam([0, 0.54, 0.02], [0, 0.48, 0.3], iron ? 0.042 : 0.035, iron ? 0.042 : 0.035);
  b.push(0, 0.47, 0.31, 1.9, 0, 0); b.color(0xc8ccd0).cone(0.026, 0, 0.09, 4); b.pop();
  b.color(iron ? 0x3e4246 : 0x8a9098).beam([0, 0.54, -0.02], [0, 0.5, -0.24], 0.045, 0.03);
  b.color(0xc8ccd0).box(0.06, 0.02, 0.04, 0, 0.5, -0.25);
}
/** The blueprint book: a fat, dog-eared ledger of plans, open in your hand. */
export function plansMeshBuilder(b) {
  b.color(0x3a4a6a).box(0.22, 0.03, 0.3, 0, 0, 0);
  b.color(0xe8e0c8).box(0.2, 0.026, 0.28, 0.005, 0.022, 0);
  b.color(0x3a6aa0);
  for (let i = 0; i < 5; i++) b.box(0.14 - i * 0.012, 0.002, 0.006, 0.01, 0.036, -0.1 + i * 0.05);
  b.box(0.006, 0.002, 0.2, -0.06, 0.036, 0);
  b.box(0.006, 0.002, 0.14, 0.06, 0.036, 0.02);
  b.color(0xd04a3a).box(0.02, 0.004, 0.1, 0.09, 0.034, 0.12);
}
