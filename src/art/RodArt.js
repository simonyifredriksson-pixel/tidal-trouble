/* RodArt.js - fishing rods that bend.

   The blank is a chain of nested segment Groups along local +Y from the
   grip. Bending is just rotating every segment a little more than the one
   below it, so a heavy fish curves the tip over in a real arc. The reel
   sits under the grip with a crank that spins while you reel - exactly the
   silhouette in the reference.

   API: { group, tip, bend(amount, side), crank(angle) } */

import * as THREE from '../../lib/three.module.js?v=1790183165';
import { MeshBuilder, shadeHex } from './Geo.js?v=1790183165';
import { MAT } from './Materials.js?v=1790183165';
import { rng } from '../core/Util.js?v=1790183165';

export function buildRod(def) {
  const r = rng(def.id.length * 7);
  const L = { basic: 2.1, reinforced: 2.3, deepwater: 2.5, titan: 2.7 }[def.id] || 2.2;
  const thick = { basic: 1, reinforced: 1.05, deepwater: 1.3, titan: 1.5 }[def.id] || 1;
  const group = new THREE.Group();

  // handle: grip, reel seat, butt
  const hb = new MeshBuilder(r);
  hb.color(def.grip).cyl(0.03 * thick, 0.026 * thick, -0.32, 0.18, 6, true);
  hb.color(shadeHex(def.grip, 0.7)).cyl(0.034 * thick, 0.034 * thick, -0.34, -0.3, 6, true);
  hb.color(def.accent).cyl(0.022 * thick, 0.022 * thick, 0.18, 0.28, 6, false);
  hb.color(def.grip).cyl(0.026 * thick, 0.02 * thick, 0.28, 0.44, 6, false);
  // reel body under the rod
  hb.color(def.reelCol);
  hb.box(0.02, 0.08, 0.03, 0, 0.05, -0.05 * thick);
  hb.push(0, 0.05, -0.12 * thick, 0, 0, Math.PI / 2);
  hb.cyl(0.055 * thick, 0.055 * thick, -0.04, 0.04, 8, true);
  hb.color(shadeHex(def.reelCol, 1.3)).cyl(0.04 * thick, 0.04 * thick, -0.045, 0.045, 8, true);
  hb.pop();
  hb.color(0xd8d0b0).cyl(0.03 * thick, 0.03 * thick, 0.02, 0.08, 8, false, 0, -0.12 * thick);
  const handle = new THREE.Mesh(hb.build(), MAT.solid);
  handle.castShadow = true;
  group.add(handle);

  // crank
  const crank = new THREE.Group();
  crank.position.set(0.05, 0.05, -0.12 * thick);
  const cb = new MeshBuilder(r);
  cb.color(0x2a2a2a).box(0.012, 0.012, 0.09, 0.01, 0, 0.03);
  cb.color(0x2a2a2a).box(0.012, 0.012, 0.012, 0.01, 0, 0.07);
  cb.color(def.accent).cyl(0.012, 0.012, 0.01, 0.05, 5, true, 0, 0.075);
  const cm = new THREE.Mesh(cb.build(), MAT.solid);
  cm.rotation.z = -Math.PI / 2;
  crank.add(cm);
  group.add(crank);

  // blank segments
  const segs = 7;
  const segL = (L - 0.44) / segs;
  let parent = group;
  const segments = [];
  for (let i = 0; i < segs; i++) {
    const s = new THREE.Group();
    s.position.y = i === 0 ? 0.44 : segL;
    const t0 = i / segs, t1 = (i + 1) / segs;
    const r0 = (0.019 - t0 * 0.014) * thick, r1 = (0.019 - t1 * 0.014) * thick;
    const sb = new MeshBuilder(r);
    sb.color(i % 3 === 2 ? shadeHex(def.blank, 1.15) : def.blank).cyl(r0, r1, 0, segL, 5, false);
    // line guide
    if (i % 2 === 1 || i === segs - 1) {
      sb.color(0xc8c8c8);
      sb.box(0.006, 0.006, 0.04 - t0 * 0.02, 0, segL * 0.8, -0.02 + t0 * 0.01);
      sb.cyl(0.012 - t0 * 0.006, 0.012 - t0 * 0.006, segL * 0.8 - 0.004, segL * 0.8 + 0.004, 6, false, 0, -0.04 + t0 * 0.02);
    }
    if (i === 1) sb.color(def.accent).cyl(r0 * 1.3, r0 * 1.3, 0, 0.03, 5, false);
    const m = new THREE.Mesh(sb.build(), MAT.solid);
    m.castShadow = true;
    s.add(m);
    parent.add(s);
    segments.push(s);
    parent = s;
  }
  const tip = new THREE.Object3D();
  tip.position.y = segL;
  parent.add(tip);

  return {
    group, tip, segments, crank, length: L,
    /** amount 0..1 bends the tip toward -Z (the line side) and `side` sideways. */
    bend(amount, side = 0) {
      for (let i = 0; i < segments.length; i++) {
        const k = (i + 1) / segments.length;
        segments[i].rotation.x = -amount * 0.34 * k * k;   // toward -Z: the reel/guide side
        segments[i].rotation.z = side * 0.18 * k * k;
      }
    },
    crank(a) { crank.rotation.x = a; },
  };
}

/** A simple bobber: red top, white bottom, a stick. */
export function buildBobber() {
  const b = new MeshBuilder();
  b.color(0xe03a2a).blob(0.06, 0.05, 0.06, 0, 0.03, 0, 8, 3);
  b.color(0xf4f0e8).blob(0.06, 0.05, 0.06, 0, -0.02, 0, 8, 3);
  b.color(0x2a2a2a).cyl(0.006, 0.006, 0.06, 0.13, 4, true);
  b.color(0xf4f0e8).cyl(0.006, 0.004, -0.12, -0.05, 4, true);
  const m = new THREE.Mesh(b.build(), MAT.solid);
  m.castShadow = true;
  return m;
}
