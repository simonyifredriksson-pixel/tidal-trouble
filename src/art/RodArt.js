/* RodArt.js - fishing rods that bend, and each one its own object.

   The blank is a chain of nested segment Groups along local +Y from the
   grip. Bending is just rotating every segment a little more than the one
   below it, so a heavy fish curves the tip over in a real arc. The reel
   sits under the grip with a crank that spins while you reel.

   Every rod is built by its OWN builder - not a recolour of a shared one:
     basic       thin varnished wood, cork rings, a little tin spinning reel
     reinforced  blue fibreglass, split black foam grips, a bail-arm reel
     reef        (Coral Whip) knotted cane, rope grip overgrown with coral,
                 a scallop-shell reel, a long whippy tip
     deepwater   thick green blank, turned wood grip, a brass star-drag drum
     ice         (Icebreaker) short and fat, frosted, a padded mitten grip,
                 a boxy reel with a T-bar crank, an auger spiral up the blank
     heavy       a steel broomstick: double grip, gimbal butt, winch, roller
     storm       (Stormglass) glass blank wound in copper coil, a lantern-cage
                 reel with a blue spark in it, a lightning-rod tip
     legendary   black blank spiralled in gold, runes that glow, gold reel
     oath        (Vigil's Oath) carved leviathan bone like a spine, a
                 driftwood handle bound in grey cloth, an antique brass
                 multiplier, a harpoon-barb butt and a watching eye charm

   API: { group, tip, segments, crank, length, bend(amount, side), crank(angle) } */

import * as THREE from '../../lib/three.module.js?v=1790358905';
import { MeshBuilder, shadeHex } from './Geo.js?v=1790358905';
import { MAT } from './Materials.js?v=1790358905';
import { rng, TAU } from '../core/Util.js?v=1790358905';

/* ---------------- shared bits ---------------- */
function guide(sb, y, t, size = 1, col = 0xc8c8c8) {
  const gr = (0.012 - t * 0.005) * size;
  sb.color(col);
  sb.box(0.006, 0.006, 0.04 - t * 0.02, 0, y, -0.02 + t * 0.01);
  sb.cyl(gr, gr, y - 0.004, y + 0.004, 7, false, 0, -0.04 + t * 0.02);
}
function spinReel(hb, rs, body, spool, y, z) {
  hb.color(body).box(0.022 * rs, 0.08, 0.035 * rs, 0, y, z + 0.05);
  hb.push(0, y, z, 0, 0, Math.PI / 2);
  hb.color(body).cyl(0.05 * rs, 0.05 * rs, -0.035 * rs, 0.035 * rs, 9, true);
  hb.color(shadeHex(body, 1.35)).cyl(0.036 * rs, 0.036 * rs, -0.04 * rs, 0.04 * rs, 9, true);
  hb.color(spool).cyl(0.03 * rs, 0.03 * rs, -0.02 * rs, 0.02 * rs, 9, false);
  hb.pop();
}
function drumReel(hb, rs, plate, line, y, z, w = 0.05, spokes = 4) {
  hb.color(plate).box(0.022 * rs, 0.08, 0.035 * rs, 0, y, z + 0.06);
  hb.push(0, y, z, 0, 0, Math.PI / 2);
  hb.color(plate).cyl(0.065 * rs, 0.065 * rs, -w * rs, -w * rs + 0.012, 10, true);
  hb.color(plate).cyl(0.065 * rs, 0.065 * rs, w * rs - 0.012, w * rs, 10, true);
  hb.color(line).cyl(0.045 * rs, 0.045 * rs, -w * rs, w * rs, 10, false);
  hb.color(shadeHex(plate, 0.7));
  for (let i = 0; i < spokes; i++) { const a = i / spokes * TAU; hb.box(0.008, w * 2 * rs, 0.008, Math.cos(a) * 0.058 * rs, 0, Math.sin(a) * 0.058 * rs); }
  hb.pop();
}
function crankArm(r, len, knob, arm = 0x2a2a2a, double = false, tbar = false) {
  const cb = new MeshBuilder(r);
  cb.color(arm).box(0.012, 0.012, len, 0.01, 0, len * 0.4);
  cb.color(knob).cyl(0.012, 0.012, 0.01, 0.05, 5, true, 0, len * 0.85);
  if (double) cb.color(knob).cyl(0.012, 0.012, 0.01, 0.05, 5, true, 0, -len * 0.1);
  if (tbar) cb.color(knob).box(0.03, 0.022, 0.08, 0.04, 0, len * 0.85);
  const m = new THREE.Mesh(cb.build(), MAT.solid);
  m.rotation.z = -Math.PI / 2;
  return m;
}

/* ---------------- the looks ----------------
   Each returns { L, segs, base, radius(t), seg(sb, i, t, r0, r1, segL, glow), handle(hb, glow), reel:{y,z,side,arm,knob,double,tbar}, mat } */
const LOOKS = {
  basic: (r, d) => ({
    L: 2.1, segs: 7, base: 0.44, radius: t => 0.019 - t * 0.013, sides: 5,
    handle(hb) {
      hb.color(0xc8a070).cyl(0.03, 0.026, -0.32, 0.12, 7, true);
      for (let i = 0; i < 6; i++) hb.color(0xb08a58).cyl(0.0305, 0.0305, -0.3 + i * 0.07, -0.29 + i * 0.07, 7, false);
      hb.color(0x8a6a44).cyl(0.034, 0.034, -0.34, -0.3, 7, true);
      hb.color(0x9aa0a8).cyl(0.024, 0.024, 0.12, 0.2, 7, false);
      hb.color(0xc8a070).cyl(0.026, 0.02, 0.28, 0.44, 6, false);
      spinReel(hb, 1, 0x7a7a7a, 0xd8d0b0, 0.16, -0.12);
    },
    reel: { y: 0.16, z: -0.12, side: 0.05, arm: 0.09, knob: 0xb08a50 },
    seg(sb, i, t, r0, r1, segL) {
      sb.color(i % 3 === 2 ? 0x9a7a52 : 0x8a6a44).cyl(r0, r1, 0, segL, 5, false);
      if (i === 1) sb.color(0x3a2a20).cyl(r0 * 1.25, r0 * 1.25, 0.02, 0.04, 5, false);
      if (i % 2 === 1 || i === 6) guide(sb, segL * 0.8, t);
    },
  }),
  reinforced: (r, d) => ({
    L: 2.3, segs: 7, base: 0.46, radius: t => (0.019 - t * 0.013) * 1.1, sides: 6,
    handle(hb) {
      hb.color(0x1e1e24).cyl(0.034, 0.03, -0.34, -0.12, 7, true);
      hb.color(0x1e1e24).cyl(0.03, 0.028, -0.02, 0.12, 7, true);
      hb.color(0x3a6aa8).cyl(0.022, 0.022, -0.12, -0.02, 7, false);
      hb.color(0xa8b0b8).cyl(0.026, 0.026, 0.12, 0.2, 7, false);
      hb.color(0x6ab0f0).cyl(0.024, 0.024, 0.2, 0.24, 7, false);
      hb.color(0x1e1e24).cyl(0.028, 0.022, 0.26, 0.46, 7, false);
      spinReel(hb, 1.12, 0x2a3a5a, 0xe8e0d0, 0.16, -0.13);
      // the bail arm, a wire hoop round the spool
      hb.color(0xd8dde2);
      for (let k = 0; k < 7; k++) { const a0 = k / 7 * Math.PI, a1 = (k + 1) / 7 * Math.PI; hb.beam([0.04, 0.16 + Math.cos(a0) * 0.05, -0.13 + Math.sin(a0) * 0.05], [0.04, 0.16 + Math.cos(a1) * 0.05, -0.13 + Math.sin(a1) * 0.05], 0.005, 0.005); }
    },
    reel: { y: 0.16, z: -0.13, side: 0.056, arm: 0.1, knob: 0x6ab0f0 },
    seg(sb, i, t, r0, r1, segL) {
      sb.color(i % 3 === 2 ? 0x4a7ab8 : 0x3a6aa8).cyl(r0, r1, 0, segL, 6, false);
      if (i % 3 === 0) sb.color(0x6ab0f0).cyl(r0 * 1.12, r0 * 1.12, segL * 0.5, segL * 0.5 + 0.014, 6, false);
      guide(sb, segL * 0.8, t, 1.05, 0xd8dde2);
    },
  }),
  reef: (r, d) => ({
    L: 2.55, segs: 8, base: 0.42, radius: t => 0.018 - t * 0.0145, sides: 6,
    handle(hb, g) {
      // rope-bound grip
      hb.color(0x3aa0a0).cyl(0.03, 0.028, -0.32, 0.1, 7, true);
      for (let i = 0; i < 12; i++) hb.color(i % 2 ? 0x2a8a8a : 0x5ac0b8).cyl(0.032, 0.032, -0.31 + i * 0.035, -0.295 + i * 0.035, 7, false);
      hb.color(0xc8b070).cyl(0.02, 0.018, 0.1, 0.42, 6, false);
      // coral growing up the handle
      const cor = [0xf07a6a, 0xf0a04a, 0xe86ab0];
      for (let k = 0; k < 6; k++) {
        const y = -0.2 + k * 0.08, a = k * 2.1;
        hb.color(cor[k % 3]); hb.push(Math.cos(a) * 0.03, y, Math.sin(a) * 0.03, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
        hb.cyl(0.008, 0.004, 0, 0.05, 4, true); hb.cyl(0.005, 0.002, 0.03, 0.06, 4, true, 0.012, 0); hb.lump(0.01, 0, 0.055, 0, 0.3);
        hb.pop();
      }
      // a scallop-shell reel: a fan of ribbed plates
      hb.color(0xf0e4d0).box(0.02, 0.07, 0.03, 0, 0.15, -0.07);
      hb.push(0, 0.15, -0.12, 0, 0, Math.PI / 2);
      for (let k = 0; k < 7; k++) { const a = -1.2 + k * 0.4; hb.color(k % 2 ? 0xf0e4d0 : 0xe8c8b0); hb.card([0.04, 0, 0], [0.04, Math.cos(a) * 0.06, Math.sin(a) * 0.06], [0.04, Math.cos(a + 0.4) * 0.06, Math.sin(a + 0.4) * 0.06]); hb.card([-0.04, 0, 0], [-0.04, Math.cos(a) * 0.06, Math.sin(a) * 0.06], [-0.04, Math.cos(a + 0.4) * 0.06, Math.sin(a + 0.4) * 0.06]); }
      hb.color(0xe8d8c0).cyl(0.04, 0.04, -0.035, 0.035, 9, false);
      hb.pop();
      g.color(0x9af0e0).lump(0.008, 0.045, 0.15, -0.12, 0.2);
    },
    reel: { y: 0.15, z: -0.12, side: 0.045, arm: 0.08, knob: 0xf07a6a },
    seg(sb, i, t, r0, r1, segL) {
      sb.color(i % 2 ? 0xc8b070 : 0xd8c080).cyl(r0, r1, 0, segL, 6, false);
      // the knotted nodes of the cane
      sb.color(0x9a7a3a).cyl(r0 * 1.3, r0 * 1.3, segL * 0.02, segL * 0.08, 6, false);
      sb.color(0xa8884a).cyl(r0 * 1.15, r0 * 1.15, segL * 0.55, segL * 0.6, 6, false);
      if (i % 2 === 1 || i === 7) guide(sb, segL * 0.8, t, 0.9, 0xf0e4d0);
    },
  }),
  deepwater: (r, d) => ({
    L: 2.5, segs: 7, base: 0.44, radius: t => (0.019 - t * 0.013) * 1.35, sides: 7,
    handle(hb) {
      hb.color(0x6a4428).lathe([[0.034, -0.34], [0.04, -0.26], [0.034, -0.12], [0.038, 0.0], [0.031, 0.12]], 8);
      hb.color(0xb08a3a).cyl(0.042, 0.042, -0.36, -0.33, 8, true); hb.color(0xb08a3a).cyl(0.036, 0.036, 0.1, 0.13, 8, false);
      hb.color(0xb08a3a).cyl(0.03, 0.03, 0.13, 0.22, 8, false);
      hb.color(0x6a4428).cyl(0.03, 0.024, 0.24, 0.44, 7, false);
      drumReel(hb, 1.4, 0xb08a3a, 0xe8e0c8, 0.16, -0.16);
      // the star drag
      hb.color(0xd8b048); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; hb.box(0.01, 0.012, 0.03, 0.08, 0.16 + Math.cos(a) * 0.02, -0.16 + Math.sin(a) * 0.02); }
    },
    reel: { y: 0.16, z: -0.16, side: 0.075, arm: 0.12, knob: 0xe8c060 },
    seg(sb, i, t, r0, r1, segL) {
      sb.color(i % 3 === 2 ? 0x3a4a3e : 0x2a3a2e).cyl(r0, r1, 0, segL, 7, false);
      if ((i + 1) % 3 === 0) { sb.color(0xe8c060).cyl(r0 * 1.15, r0 * 1.15, segL * 0.3, segL * 0.3 + 0.012, 7, false); sb.color(0xe8c060).cyl(r0 * 1.15, r0 * 1.15, segL * 0.34, segL * 0.34 + 0.006, 7, false); }
      guide(sb, segL * 0.8, t, 1.2);
    },
  }),
  ice: (r, d) => ({
    L: 1.55, segs: 6, base: 0.5, radius: t => 0.03 - t * 0.018, sides: 7,
    handle(hb, g) {
      // a fat padded mitten grip
      hb.color(0x3a3a44).lathe([[0.03, -0.36], [0.05, -0.32], [0.052, -0.18], [0.046, -0.06], [0.05, 0.05], [0.036, 0.12]], 8);
      for (let i = 0; i < 4; i++) hb.color(0x5ab0e0).cyl(0.053, 0.053, -0.3 + i * 0.1, -0.29 + i * 0.1, 8, false);
      hb.color(0xd8e8f0).cyl(0.04, 0.04, 0.12, 0.24, 8, true);
      hb.color(0x3a3a44).cyl(0.036, 0.03, 0.24, 0.5, 8, false);
      // a boxy reel, like a little ice-auger gearbox
      hb.color(0xd8e8f0).box(0.12, 0.12, 0.09, 0, 0.18, -0.14);
      hb.color(0x5ab0e0).box(0.125, 0.03, 0.095, 0, 0.18, -0.14);
      hb.color(0x9ab8c8).box(0.02, 0.08, 0.04, 0, 0.18, -0.08);
      g.color(0xd8f8ff); for (let k = 0; k < 4; k++) g.lump(0.008, (k - 1.5) * 0.02, 0.24, -0.1, 0.3);
    },
    reel: { y: 0.18, z: -0.14, side: 0.065, arm: 0.1, knob: 0x5ab0e0, tbar: true },
    seg(sb, i, t, r0, r1, segL, g) {
      sb.color(i % 2 ? 0x9ac8e0 : 0xaad4e8).cyl(r0, r1, 0, segL, 7, false);
      // the auger spiral wound up the lower blank
      if (i < 3) { sb.color(0x5ab0e0); for (let k = 0; k < 6; k++) { const a0 = k * 1.1 + i * 3, a1 = a0 + 1.1; sb.beam([Math.cos(a0) * r0 * 1.05, segL * k / 6, Math.sin(a0) * r0 * 1.05], [Math.cos(a1) * r0 * 1.05, segL * (k + 1) / 6, Math.sin(a1) * r0 * 1.05], 0.007, 0.007); } }
      // frost crystals
      sb.color(0xf4fcff); for (let k = 0; k < 2; k++) { const a = k * 3 + i; sb.push(Math.cos(a) * r0, segL * (0.3 + k * 0.4), Math.sin(a) * r0, 0, a, 0.8); sb.cone(r0 * 0.35, 0, r0 * 1.4, 4); sb.pop(); }
      guide(sb, segL * 0.8, t, 1.5, 0xd8e8f0);
    },
  }),
  heavy: (r, d) => ({
    L: 2.45, segs: 7, base: 0.5, radius: t => (0.019 - t * 0.013) * 1.8, sides: 7,
    handle(hb) {
      hb.color(0x3a3a3a).cyl(0.054, 0.047, -0.32, 0.12, 7, true);
      hb.color(0x2a2a2a).cyl(0.065, 0.065, -0.34, -0.3, 7, true);
      hb.color(0x2a2a2a).cyl(0.054, 0.081, -0.5, -0.34, 7, true);
      hb.color(0xe8502a).cyl(0.083, 0.083, -0.52, -0.5, 7, true);
      hb.color(0x9aa0a8).box(0.12, 0.02, 0.02, 0, -0.5, 0);
      hb.color(0x9aa0a8).cyl(0.043, 0.043, 0.12, 0.2, 7, false);
      hb.color(0xe8502a).cyl(0.04, 0.04, 0.2, 0.28, 6, false);
      hb.color(0x3a3a3a).cyl(0.049, 0.04, 0.28, 0.5, 7, false);
      drumReel(hb, 1.75, 0x8a8a90, 0xe8e0c8, 0.16, -0.21, 0.07, 6);
      hb.color(0xe8502a).box(0.012, 0.012, 0.09, 0.12, 0.19, -0.23);
    },
    reel: { y: 0.16, z: -0.21, side: 0.13, arm: 0.12, knob: 0xe8502a, double: true },
    seg(sb, i, t, r0, r1, segL) {
      sb.color(i % 3 === 2 ? 0x3a3a42 : 0x2a2a30).cyl(r0, r1, 0, segL, 7, false);
      if (i % 2 === 0) sb.color(0xe8502a).cyl(r0 * 1.15, r0 * 1.15, segL * 0.2, segL * 0.2 + 0.012, 7, false);
      guide(sb, segL * 0.8, t, 1.35);
      if (i === 6) sb.color(0x9aa0a8).cyl(0.02, 0.02, segL - 0.02, segL + 0.01, 7, true, 0, -0.012);
    },
  }),
  storm: (r, d) => ({
    L: 2.6, segs: 7, base: 0.46, radius: t => (0.019 - t * 0.012) * 1.4, sides: 8, mat: MAT.shiny,
    handle(hb, g) {
      hb.color(0x2a2a30).cyl(0.036, 0.032, -0.36, 0.12, 8, true);
      for (let i = 0; i < 5; i++) hb.color(0xb87a3a).cyl(0.038, 0.038, -0.34 + i * 0.1, -0.325 + i * 0.1, 8, false);
      hb.color(0xb87a3a).cyl(0.03, 0.03, 0.12, 0.22, 8, false);
      hb.color(0x2a2a30).cyl(0.03, 0.026, 0.24, 0.46, 8, false);
      // a lantern-cage reel with a spark caught in it
      hb.color(0x3a3a40).cyl(0.055, 0.055, 0.1, 0.11, 8, true, 0, -0.16); hb.color(0x3a3a40).cyl(0.055, 0.055, 0.21, 0.22, 8, true, 0, -0.16);
      hb.color(0xb87a3a); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; hb.box(0.006, 0.11, 0.006, Math.cos(a) * 0.052, 0.16, -0.16 + Math.sin(a) * 0.052); }
      hb.color(0x3a3a40).box(0.02, 0.06, 0.05, 0, 0.16, -0.09);
      g.color(0x9af0ff).lump(0.03, 0, 0.16, -0.16, 0.3); g.color(0xd8fcff).lump(0.012, 0, 0.16, -0.16, 0.2);
    },
    reel: { y: 0.16, z: -0.16, side: 0.06, arm: 0.1, knob: 0xb87a3a },
    seg(sb, i, t, r0, r1, segL, g) {
      sb.color(i % 2 ? 0x5a7a9a : 0x4a6a8a).cyl(r0, r1, 0, segL, 8, false);
      // copper coil wound tight up the blank
      sb.color(0xb87a3a);
      const turns = i < 4 ? 10 : 5;
      for (let k = 0; k < turns; k++) { const a0 = k * 1.4, a1 = a0 + 1.4; const rr = (r0 + (r1 - r0) * k / turns) * 1.08; sb.beam([Math.cos(a0) * rr, segL * k / turns, Math.sin(a0) * rr], [Math.cos(a1) * rr, segL * (k + 1) / turns, Math.sin(a1) * rr], 0.004, 0.004); }
      guide(sb, segL * 0.8, t, 1.1, 0xb87a3a);
      if (i === 6) { sb.color(0xd8b048).cone(r1 * 1.1, segL, segL + 0.14, 5); g.color(0x9af0ff).lump(0.014, 0, segL + 0.15, 0, 0.2); }
      if (i === 2 || i === 4) g.color(0x9af0ff).box(0.003, segL * 0.5, 0.003, r0 * 1.1, segL * 0.5, 0);
    },
  }),
  legendary: (r, d) => ({
    L: 2.75, segs: 7, base: 0.5, radius: t => (0.019 - t * 0.013) * 1.7, sides: 7, mat: MAT.shiny,
    handle(hb, g) {
      hb.color(0x5a1a2a).cyl(0.051, 0.044, -0.32, 0.12, 7, true);
      hb.color(0x3a1018).cyl(0.061, 0.061, -0.34, -0.3, 7, true);
      hb.color(0x2a2a2a).cyl(0.051, 0.077, -0.5, -0.34, 7, true); hb.color(0x6af0ff).cyl(0.078, 0.078, -0.52, -0.5, 7, true);
      hb.color(0xd8b048).cyl(0.041, 0.041, 0.12, 0.2, 7, false);
      hb.color(0x6af0ff).cyl(0.037, 0.037, 0.2, 0.28, 6, false);
      hb.color(0x5a1a2a).cyl(0.046, 0.037, 0.28, 0.5, 7, false);
      drumReel(hb, 1.6, 0xd8b048, 0xe8e0c8, 0.16, -0.19);
      g.color(0x6af0ff); for (let i = 0; i < 3; i++) g.box(0.006, 0.02, 0.02, 0.088, 0.13 + i * 0.03, -0.19);
    },
    reel: { y: 0.16, z: -0.19, side: 0.088, arm: 0.11, knob: 0x6af0ff },
    seg(sb, i, t, r0, r1, segL, g) {
      sb.color(i % 3 === 2 ? 0x2a2a34 : 0x1a1a24).cyl(r0, r1, 0, segL, 7, false);
      sb.color(0xe8c050); for (let k = 0; k < 6; k++) { const a0 = k * 1.05 + i, a1 = a0 + 1.05; sb.beam([Math.cos(a0) * r0 * 1.08, segL * k / 6, Math.sin(a0) * r0 * 1.08], [Math.cos(a1) * r0 * 1.08, segL * (k + 1) / 6, Math.sin(a1) * r0 * 1.08], 0.004, 0.004); }
      guide(sb, segL * 0.8, t, 1.3, 0xd8b048);
      if (i >= 1 && i <= 4) { g.color(0x6af0ff).box(0.005, segL * 0.3, 0.005, r0 * 0.95, segL * 0.5, 0); g.color(0x6af0ff).box(0.005, segL * 0.3, 0.005, -r0 * 0.95, segL * 0.3, 0); }
    },
  }),
  oath: (r, d) => ({
    L: 2.85, segs: 8, base: 0.5, radius: t => (0.019 - t * 0.012) * 1.75, sides: 7,
    handle(hb, g) {
      // driftwood grip bound in grey cloth and leather
      hb.color(0x6a5a4a).lathe([[0.042, -0.36], [0.05, -0.28], [0.046, -0.12], [0.05, 0.0], [0.04, 0.12]], 7);
      for (let i = 0; i < 9; i++) hb.color(i % 2 ? 0x8a8a84 : 0x6a6a64).cyl(0.052, 0.052, -0.3 + i * 0.03, -0.285 + i * 0.03, 7, false);
      hb.color(0x3a2e28).cyl(0.048, 0.048, -0.02, 0.1, 7, false);
      // the harpoon-barb butt
      hb.color(0x9a8a70); hb.cyl(0.035, 0.012, -0.5, -0.36, 6, true);
      for (const s of [-1, 1]) hb.beam([0, -0.44, 0], [s * 0.05, -0.38, 0], 0.012, 0.012);
      hb.color(0xe8dcc0).cyl(0.036, 0.036, 0.12, 0.22, 7, false);
      hb.color(0x3a2e28).cyl(0.04, 0.032, 0.24, 0.5, 7, false);
      // an antique brass multiplier with fretted side plates
      drumReel(hb, 1.55, 0x9a7a4a, 0xd8d0b8, 0.16, -0.19, 0.055, 8);
      hb.color(0xc8a060); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; hb.lump(0.008, 0.088, 0.16 + Math.cos(a) * 0.08, -0.19 + Math.sin(a) * 0.08, 0.2); }
      // the eye charm on a cord: it watches the water
      hb.color(0x3a2e28).beam([0, 0.3, -0.03], [0.03, 0.2, -0.07], 0.004, 0.004);
      hb.color(0xe8e4dc).blob(0.02, 0.02, 0.014, 0.03, 0.19, -0.075, 6, 3);
      g.color(0xd8f0ff).blob(0.01, 0.01, 0.006, 0.03, 0.19, -0.088, 5, 3);
    },
    reel: { y: 0.16, z: -0.19, side: 0.09, arm: 0.12, knob: 0xe8dcc0 },
    seg(sb, i, t, r0, r1, segL, g) {
      // carved bone like a spine: vertebra knuckles all the way up
      sb.color(i % 2 ? 0xe8dcc0 : 0xd8ccb0).cyl(r0 * 0.9, r1 * 0.9, 0, segL, 7, false);
      for (let k = 0; k < 3; k++) {
        const y = segL * (0.15 + k * 0.33), rr = (r0 + (r1 - r0) * (k / 3)) * 1.28;
        sb.color(0xf0e8d4).cyl(rr, rr * 0.92, y, y + segL * 0.08, 7, false);
        sb.color(0xc8bc9c).box(rr * 0.35, segL * 0.06, rr * 1.7, 0, y + segL * 0.04, 0);
      }
      guide(sb, segL * 0.8, t, 1.3, 0x9a7a4a);
      if (i === 7) { sb.color(0xf4f0e0); sb.push(0, segL, 0, 0, 0, 0.3); sb.cone(r1 * 1.4, 0, 0.1, 5); sb.pop(); }
      if (i === 3) g.color(0xd8f0ff).box(0.004, segL * 0.4, 0.004, 0, segL * 0.5, r0 * 1.1);
    },
  }),
};

export function buildRod(def) {
  const r = rng(def.id.length * 7 + 3);
  const K = (LOOKS[def.look] || LOOKS[def.id] || LOOKS.basic)(r, def);
  const group = new THREE.Group();
  const glow = new MeshBuilder(r);
  const mat = K.mat || MAT.solid;
  // handle and reel
  const hb = new MeshBuilder(r);
  K.handle(hb, glow);
  const handle = new THREE.Mesh(hb.build(), mat);
  handle.castShadow = true;
  group.add(handle);
  // crank
  const R = K.reel;
  const crank = new THREE.Group();
  crank.position.set(R.side, R.y, R.z);
  crank.add(crankArm(r, R.arm, R.knob, 0x2a2a2a, R.double, R.tbar));
  group.add(crank);
  // blank segments
  const segs = K.segs, L = K.L, base = K.base;
  const segL = (L - base) / segs;
  let parent = group;
  const segments = [];
  for (let i = 0; i < segs; i++) {
    const sg = new THREE.Group();
    sg.position.y = i === 0 ? base : segL;
    const t0 = i / segs, t1 = (i + 1) / segs;
    const sb = new MeshBuilder(r), sgGlow = new MeshBuilder(r);
    K.seg(sb, i, t0, K.radius(t0), K.radius(t1), segL, sgGlow);
    const m = new THREE.Mesh(sb.build(), mat);
    m.castShadow = true;
    sg.add(m);
    if (sgGlow.tris) sg.add(new THREE.Mesh(sgGlow.build(), MAT.glow));
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
      const n = segments.length;
      for (let i = 0; i < n; i++) {
        const k = (i + 1) / n;
        segments[i].rotation.x = -amount * 0.34 * k * k * (7 / n);
        segments[i].rotation.z = side * 0.18 * k * k * (7 / n);
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
