/* RodArt.js - fishing rods that bend.

   The blank is a chain of nested segment Groups along local +Y from the
   grip. Bending is just rotating every segment a little more than the one
   below it, so a heavy fish curves the tip over in a real arc. The reel
   sits under the grip with a crank that spins while you reel - exactly the
   silhouette in the reference.

   API: { group, tip, bend(amount, side), crank(angle) } */

import * as THREE from '../../lib/three.module.js?v=1790185859';
import { MeshBuilder, shadeHex } from './Geo.js?v=1790185859';
import { MAT } from './Materials.js?v=1790185859';
import { rng } from '../core/Util.js?v=1790185859';

/* Each rod is built to a LOOK, so an upgrade is something you can see:
     basic       thin varnished wood, cork grip, a little tin reel
     reinforced  blue fibreglass, foam grip, a proper spinning reel
     deepwater   thick green blank, wooden grip, a big brass reel
     heavy       a steel-cored broomstick: double grip, fighting butt,
                 a winch drum with a lever and a roller at the tip
     legendary   black blank wound in gold, runes that glow, a gold reel */
const LOOKS = {
  basic:      { L: 2.1, thick: 1.0, reel: 1.0, guides: 4, grip: 'cork', reelKind: 'spin', wraps: 0 },
  reinforced: { L: 2.3, thick: 1.1, reel: 1.12, guides: 6, grip: 'foam', reelKind: 'spin', wraps: 2 },
  deepwater:  { L: 2.5, thick: 1.35, reel: 1.4, guides: 6, grip: 'wood', reelKind: 'drum', wraps: 3 },
  heavy:      { L: 2.45, thick: 1.8, reel: 1.75, guides: 5, grip: 'double', reelKind: 'winch', wraps: 5, butt: true, roller: true },
  legendary:  { L: 2.75, thick: 1.7, reel: 1.6, guides: 7, grip: 'double', reelKind: 'drum', wraps: 9, gold: true, runes: true, butt: true },
};

export function buildRod(def) {
  const r = rng(def.id.length * 7);
  const K = LOOKS[def.look || def.id] || LOOKS.basic;
  const L = K.L, thick = K.thick, rs = K.reel;
  const group = new THREE.Group();
  const glow = new MeshBuilder(r);

  // handle: grip, reel seat, butt
  const hb = new MeshBuilder(r);
  const gripCol = K.grip === 'cork' ? 0xc8a070 : K.grip === 'foam' ? 0x1e1e24 : K.grip === 'wood' ? 0x6a4428 : def.grip;
  hb.color(gripCol).cyl(0.03 * thick, 0.026 * thick, -0.32, 0.12, 7, true);
  if (K.grip === 'cork') for (let i = 0; i < 6; i++) hb.color(0xb08a58).cyl(0.0305, 0.0305, -0.3 + i * 0.07, -0.29 + i * 0.07, 7, false);
  hb.color(shadeHex(gripCol, 0.7)).cyl(0.036 * thick, 0.036 * thick, -0.34, -0.3, 7, true);
  if (K.butt) { hb.color(0x2a2a2a).cyl(0.03 * thick, 0.045 * thick, -0.5, -0.34, 7, true); hb.color(def.accent).cyl(0.046 * thick, 0.046 * thick, -0.52, -0.5, 7, true); }
  hb.color(K.gold ? 0xd8b048 : 0x9aa0a8).cyl(0.024 * thick, 0.024 * thick, 0.12, 0.2, 7, false);
  hb.color(def.accent).cyl(0.022 * thick, 0.022 * thick, 0.2, 0.28, 6, false);
  if (K.grip === 'double') hb.color(gripCol).cyl(0.027 * thick, 0.022 * thick, 0.28, 0.5, 7, false);
  else hb.color(gripCol).cyl(0.026 * thick, 0.02 * thick, 0.28, 0.44, 6, false);
  // reel under the rod
  const reelY = 0.16, reelZ = -0.1 * thick - 0.02 * rs;
  hb.color(def.reelCol).box(0.022 * rs, 0.08, 0.035 * rs, 0, reelY, -0.05 * thick);
  hb.push(0, reelY, reelZ, 0, 0, Math.PI / 2);
  if (K.reelKind === 'spin') {
    hb.color(def.reelCol).cyl(0.05 * rs, 0.05 * rs, -0.035 * rs, 0.035 * rs, 9, true);
    hb.color(shadeHex(def.reelCol, 1.35)).cyl(0.036 * rs, 0.036 * rs, -0.04 * rs, 0.04 * rs, 9, true);
    hb.color(0xd8d0b0).cyl(0.03 * rs, 0.03 * rs, -0.02 * rs, 0.02 * rs, 9, false);
  } else {
    // a drum or a winch: wide spool between two big side plates
    const w = K.reelKind === 'winch' ? 0.07 : 0.05;
    hb.color(def.reelCol).cyl(0.065 * rs, 0.065 * rs, -w * rs, -w * rs + 0.012, 10, true);
    hb.color(def.reelCol).cyl(0.065 * rs, 0.065 * rs, w * rs - 0.012, w * rs, 10, true);
    hb.color(0xe8e0c8).cyl(0.045 * rs, 0.045 * rs, -w * rs, w * rs, 10, false);
    hb.color(shadeHex(def.reelCol, 0.7));
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; hb.box(0.008, w * 2 * rs, 0.008, Math.cos(a) * 0.058 * rs, 0, Math.sin(a) * 0.058 * rs); }
    if (K.reelKind === 'winch') { hb.color(0xe8502a).box(0.012, 0.012, 0.09, 0.07 * rs, 0.03, -0.02); hb.color(0x2a2a2a).cyl(0.014, 0.014, 0.05, 0.08, 6, true, 0.07 * rs, -0.07); }
  }
  hb.pop();
  if (K.gold) { glow.color(0x6af0ff); for (let i = 0; i < 3; i++) glow.box(0.006, 0.02, 0.02, 0.055 * rs, reelY - 0.03 + i * 0.03, reelZ); }
  const handle = new THREE.Mesh(hb.build(), K.gold ? MAT.shiny : MAT.solid);
  handle.castShadow = true;
  group.add(handle);

  // crank
  const crank = new THREE.Group();
  const side = K.reelKind === 'spin' ? 0.05 * rs : (K.reelKind === 'winch' ? 0.075 : 0.055) * rs;
  crank.position.set(side, reelY, reelZ);
  const cb = new MeshBuilder(r);
  const arm = 0.06 + rs * 0.03;
  cb.color(0x2a2a2a).box(0.012, 0.012, arm, 0.01, 0, arm * 0.4);
  cb.color(0x2a2a2a).box(0.012, 0.012, 0.012, 0.01, 0, arm * 0.8);
  cb.color(def.accent).cyl(0.012 * rs, 0.012 * rs, 0.01, 0.05, 5, true, 0, arm * 0.85);
  if (K.reelKind === 'winch') cb.color(def.accent).cyl(0.012 * rs, 0.012 * rs, 0.01, 0.05, 5, true, 0, -arm * 0.1);
  const cm = new THREE.Mesh(cb.build(), MAT.solid);
  cm.rotation.z = -Math.PI / 2;
  crank.add(cm);
  group.add(crank);

  // blank segments
  const segs = 7;
  const base = K.grip === 'double' ? 0.5 : 0.44;
  const segL = (L - base) / segs;
  let parent = group;
  const segments = [];
  const every = Math.max(1, Math.round(segs / K.guides));
  for (let i = 0; i < segs; i++) {
    const sg = new THREE.Group();
    sg.position.y = i === 0 ? base : segL;
    const t0 = i / segs, t1 = (i + 1) / segs;
    const r0 = (0.019 - t0 * 0.013) * thick, r1 = (0.019 - t1 * 0.013) * thick;
    const sb = new MeshBuilder(r);
    sb.color(i % 3 === 2 ? shadeHex(def.blank, 1.15) : def.blank).cyl(r0, r1, 0, segL, K.thick > 1.3 ? 7 : 5, false);
    // thread wraps (gold spirals on the legendary)
    for (let w = 0; w < K.wraps; w++) {
      if ((w + i) % 3) continue;
      const y = segL * (0.2 + (w % 3) * 0.3);
      sb.color(K.gold ? 0xe8c050 : def.accent).cyl(r0 * 1.15, r0 * 1.15, y, y + 0.012, 6, false);
    }
    // line guides, bigger on the heavy rods
    if (i % every === every - 1 || i === segs - 1) {
      const gr = (0.012 - t0 * 0.005) * (0.8 + thick * 0.25);
      sb.color(K.gold ? 0xd8b048 : 0xc8c8c8);
      sb.box(0.006, 0.006, 0.04 - t0 * 0.02, 0, segL * 0.8, -0.02 + t0 * 0.01);
      sb.cyl(gr, gr, segL * 0.8 - 0.004, segL * 0.8 + 0.004, 7, false, 0, -0.04 + t0 * 0.02);
    }
    if (i === segs - 1 && K.roller) sb.color(0x9aa0a8).cyl(0.012 * thick, 0.012 * thick, segL - 0.02, segL + 0.01, 7, true, 0, -0.012);
    if (i === 1) sb.color(def.accent).cyl(r0 * 1.3, r0 * 1.3, 0, 0.03, 5, false);
    const m = new THREE.Mesh(sb.build(), K.gold ? MAT.shiny : MAT.solid);
    m.castShadow = true;
    sg.add(m);
    if (K.runes && i >= 1 && i <= 4) {
      const gb = new MeshBuilder(r);
      gb.color(0x6af0ff).box(0.005, segL * 0.3, 0.005, r0 * 0.95, segL * 0.5, 0);
      gb.color(0x6af0ff).box(0.005, segL * 0.3, 0.005, -r0 * 0.95, segL * 0.3, 0);
      sg.add(new THREE.Mesh(gb.build(), MAT.glow));
    }
    parent.add(sg);
    segments.push(sg);
    parent = sg;
  }
  if (glow.tris) group.add(new THREE.Mesh(glow.build(), MAT.glow));
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
