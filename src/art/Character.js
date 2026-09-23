/* Character.js - the people of Driftwood Bay, and every player's body.

   Low-poly, slightly exaggerated: big heads, long noses, oversized hands,
   simple clothes with a strong silhouette. The rig is a tree of Groups
   (hips > torso > head/arms, hips > legs) and all animation is procedural,
   blended by weights so walking into a cheer into a fall never pops.

   States: idle walk run sit fish reel cheer fall swim drive talk carry
   Feet are at y = 0 of the root; +Z is the way the character faces. */

import * as THREE from '../../lib/three.module.js?v=1790183165';
import { MeshBuilder, shadeHex, mixHex } from './Geo.js?v=1790183165';
import { MAT } from './Materials.js?v=1790183165';
import { rng, clamp, lerp, damp } from '../core/Util.js?v=1790183165';

const SKINS = [0xf1c9a5, 0xe0ac86, 0xc68a62, 0x9a6444, 0x70462e, 0xf5d7bd];

export const DEFAULT_LOOK = {
  skin: 0xf1c9a5, shirt: 0x4a6aa0, pants: 0x3a3a48, boots: 0x3a2a20, hat: 'none', hatCol: 0xeeeeee,
  hair: 'short', hairCol: 0x5a3a24, beard: 'none', beardCol: 0xdddddd, glasses: false, overalls: false,
  nose: 1, build: 1, height: 1, belly: 0, vest: 0,
};

function mesh(b, mat = MAT.solid) {
  const m = new THREE.Mesh(b.build(), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class Character {
  constructor(look = {}, seed = 1) {
    this.look = Object.assign({}, DEFAULT_LOOK, look);
    const L = this.look;
    this.r = rng(seed);
    this.root = new THREE.Group();
    this.root.name = 'character';
    this.body = new THREE.Group();          // everything that tilts when falling
    this.root.add(this.body);
    const H = L.height;
    const B = L.build;

    // --- hips ---
    this.hips = new THREE.Group();
    this.hips.position.y = 0.92 * H;
    this.body.add(this.hips);

    // --- legs ---
    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.11 * B, 0, 0);
      const tb = new MeshBuilder(this.r);
      tb.color(L.pants).cyl(0.085 * B, 0.075 * B, -0.45 * H, 0, 6, true);
      leg.add(mesh(tb));
      const knee = new THREE.Group();
      knee.position.y = -0.45 * H;
      const sb = new MeshBuilder(this.r);
      sb.color(L.pants).cyl(0.07 * B, 0.075 * B, -0.4 * H, 0, 6, true);
      sb.color(L.boots).box(0.14 * B, 0.1, 0.26, 0, -0.43 * H, 0.05);
      sb.color(shadeHex(L.boots, 0.8)).box(0.15 * B, 0.03, 0.27, 0, -0.475 * H, 0.05);
      sb.color(L.boots).cyl(0.08 * B, 0.08 * B, -0.43 * H, -0.3 * H, 6, true);
      knee.add(mesh(sb));
      leg.add(knee);
      leg.userData.knee = knee;
      this.hips.add(leg);
      this.legs.push(leg);
    }

    // --- torso ---
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const tb = new MeshBuilder(this.r);
    const shirt = L.shirt, belly = L.belly;
    tb.color(L.overalls ? L.pants : shirt);
    tb.lathe([[0.16 * B, -0.05], [0.19 * B + belly * 0.06, 0.12], [0.2 * B + belly * 0.08, 0.26], [0.2 * B, 0.4], [0.16 * B, 0.52], [0.08, 0.58]], 7);
    if (L.overalls) {
      // shirt shows at the shoulders and arms, the bib covers the front
      tb.color(shirt).lathe([[0.2 * B, 0.36], [0.2 * B, 0.42], [0.16 * B, 0.53], [0.08, 0.585]], 7);
      tb.color(shadeHex(L.pants, 0.85));
      for (const sx of [-0.09, 0.09]) tb.box(0.05, 0.32, 0.03, sx * B, 0.4, 0.19 * B);
      tb.box(0.2 * B, 0.18, 0.03, 0, 0.3, 0.2 * B);
      tb.color(0xd8c070); for (const sx of [-0.09, 0.09]) tb.box(0.04, 0.04, 0.02, sx * B, 0.36, 0.215 * B);
    }
    if (L.vest) {
      tb.color(L.vest);
      tb.lathe([[0.205 * B, 0.1], [0.21 * B + belly * 0.08, 0.26], [0.21 * B, 0.42], [0.17 * B, 0.52]], 7);
    }
    // belt
    tb.color(shadeHex(L.pants, 0.6)).cyl(0.175 * B, 0.18 * B, -0.03, 0.03, 7, false);
    // collar
    tb.color(shadeHex(shirt, 0.8)).cyl(0.1, 0.09, 0.54, 0.6, 6, false);
    this.torso.add(mesh(tb));

    // --- head ---
    this.neck = new THREE.Group();
    this.neck.position.y = 0.6;
    this.torso.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.2;
    this.neck.add(this.head);
    const hb = new MeshBuilder(this.r);
    hb.color(L.skin).cyl(0.06, 0.06, -0.2, -0.08, 6, false);
    hb.color(L.skin).blob(0.2, 0.235, 0.21, 0, 0.03, 0, 8, 5, 0.06);
    // nose - long, like the reference
    const N = L.nose;
    hb.color(shadeHex(L.skin, 0.92));
    hb.push(0, 0.0, 0.19);
    hb.blob(0.045 * N, 0.05 * N, 0.09 * N, 0, -0.01, 0.05 * N, 5, 3);
    hb.pop();
    // ears
    hb.color(shadeHex(L.skin, 0.9));
    for (const sx of [-1, 1]) hb.blob(0.035, 0.06, 0.04, sx * 0.2, 0.02, 0, 5, 3);
    // eyes
    for (const sx of [-1, 1]) {
      hb.color(0xffffff).blob(0.045, 0.05, 0.03, sx * 0.08, 0.07, 0.175, 6, 3);
      hb.color(0x1a1a1a).blob(0.02, 0.024, 0.015, sx * 0.08, 0.07, 0.2, 5, 3);
      hb.color(shadeHex(L.hairCol, 0.9)).box(0.08, 0.018, 0.02, sx * 0.08, 0.135, 0.19);
    }
    // mouth
    hb.color(0x7a3a2e).box(0.08, 0.015, 0.02, 0, -0.1, 0.19);
    // hair
    if (L.hair === 'short') {
      hb.color(L.hairCol).blob(0.205, 0.14, 0.215, 0, 0.12, -0.015, 8, 3, 0.1);
    } else if (L.hair === 'long') {
      hb.color(L.hairCol).blob(0.215, 0.15, 0.22, 0, 0.11, -0.02, 8, 3, 0.1);
      hb.color(L.hairCol).box(0.36, 0.3, 0.12, 0, -0.08, -0.14);
    } else if (L.hair === 'bald') {
      hb.color(L.hairCol);
      for (const sx of [-1, 1]) hb.blob(0.05, 0.07, 0.1, sx * 0.18, 0.02, -0.06, 5, 3);
    } else if (L.hair === 'bun') {
      hb.color(L.hairCol).blob(0.205, 0.14, 0.215, 0, 0.12, -0.015, 8, 3, 0.1);
      hb.color(L.hairCol).blob(0.08, 0.08, 0.08, 0, 0.2, -0.16, 6, 3);
    }
    // beard
    if (L.beard === 'full') {
      hb.color(L.beardCol);
      hb.blob(0.17, 0.14, 0.12, 0, -0.12, 0.1, 7, 4, 0.12);
      hb.blob(0.12, 0.05, 0.06, 0, -0.05, 0.19, 5, 3);
    } else if (L.beard === 'stubble') {
      hb.color(shadeHex(L.skin, 0.8)).blob(0.16, 0.08, 0.1, 0, -0.1, 0.1, 7, 3);
    } else if (L.beard === 'moustache') {
      hb.color(L.beardCol).blob(0.09, 0.03, 0.04, 0, -0.06, 0.205, 6, 3);
    }
    // glasses
    if (L.glasses) {
      hb.color(0x2a2a2a);
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const a0 = i / 6 * Math.PI * 2, a1 = (i + 1) / 6 * Math.PI * 2;
          hb.beam([sx * 0.08 + Math.cos(a0) * 0.06, 0.07 + Math.sin(a0) * 0.06, 0.215], [sx * 0.08 + Math.cos(a1) * 0.06, 0.07 + Math.sin(a1) * 0.06, 0.215], 0.014, 0.014);
        }
        hb.beam([sx * 0.14, 0.08, 0.2], [sx * 0.2, 0.08, 0.02], 0.012, 0.012);
      }
      hb.beam([-0.02, 0.08, 0.215], [0.02, 0.08, 0.215], 0.012, 0.012);
    }
    // hats
    const hc = L.hatCol;
    if (L.hat === 'captain') {
      hb.color(hc).cyl(0.22, 0.24, 0.12, 0.26, 8, true, 0, -0.01);
      hb.color(0x1a1a2a).box(0.26, 0.03, 0.12, 0, 0.13, 0.2);
      hb.color(0x1a1a2a).cyl(0.225, 0.225, 0.12, 0.155, 8, false, 0, -0.01);
      hb.color(0xd8b048).box(0.06, 0.05, 0.02, 0, 0.19, 0.225);
    } else if (L.hat === 'cap') {
      hb.color(hc).blob(0.215, 0.12, 0.22, 0, 0.14, -0.01, 8, 3);
      hb.color(shadeHex(hc, 0.85)).box(0.24, 0.025, 0.16, 0, 0.14, 0.24);
    } else if (L.hat === 'beanie') {
      hb.color(hc).blob(0.215, 0.18, 0.22, 0, 0.12, -0.01, 8, 4);
      hb.color(shadeHex(hc, 0.8)).cyl(0.22, 0.22, 0.04, 0.1, 8, false);
      hb.color(0xf2f2f2).blob(0.05, 0.05, 0.05, 0, 0.31, 0, 5, 3);
    } else if (L.hat === 'bucket') {
      hb.color(hc).cyl(0.2, 0.22, 0.12, 0.28, 8, true);
      hb.color(shadeHex(hc, 0.9)).cyl(0.34, 0.22, 0.1, 0.14, 8, true);
    } else if (L.hat === 'straw') {
      hb.color(0xe0c070).cyl(0.18, 0.21, 0.13, 0.27, 8, true);
      hb.color(0xd8b460).cyl(0.42, 0.4, 0.12, 0.15, 10, true);
      hb.color(0xa8443a).cyl(0.215, 0.215, 0.14, 0.18, 8, false);
    } else if (L.hat === 'fur') {
      hb.color(hc).blob(0.25, 0.2, 0.25, 0, 0.14, 0, 8, 4, 0.12);
    } else if (L.hat === 'hood') {
      hb.color(hc).blob(0.25, 0.27, 0.25, 0, 0.05, -0.03, 8, 4);
    }
    this.headMesh = mesh(hb);
    this.head.add(this.headMesh);

    // --- arms with big hands ---
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.235 * B, 0.5, 0);
      const ab = new MeshBuilder(this.r);
      ab.color(L.shirt).cyl(0.065, 0.06, -0.3, 0.02, 6, true);
      ab.color(L.shirt).blob(0.075, 0.07, 0.075, 0, 0, 0, 6, 3);
      arm.add(mesh(ab));
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      const fb = new MeshBuilder(this.r);
      fb.color(L.shirt).cyl(0.055, 0.055, -0.12, 0, 6, false);
      fb.color(L.skin).cyl(0.045, 0.05, -0.27, -0.1, 6, false);
      // big mitten hand + thumb
      fb.color(L.skin).blob(0.075, 0.09, 0.055, 0, -0.34, 0.01, 6, 3, 0.1);
      fb.color(L.skin).blob(0.03, 0.05, 0.03, side * -0.055, -0.31, 0.05, 5, 3);
      elbow.add(mesh(fb));
      const hand = new THREE.Group();
      hand.position.set(0, -0.35, 0.02);
      elbow.add(hand);
      arm.add(elbow);
      arm.userData.elbow = elbow;
      arm.userData.hand = hand;
      this.torso.add(arm);
      this.arms.push(arm);
    }
    this.handR = this.arms[1].userData.hand;
    this.handL = this.arms[0].userData.hand;

    // animation state
    this.state = 'idle';
    this.w = { idle: 1, walk: 0, run: 0, sit: 0, fish: 0, reel: 0, cheer: 0, fall: 0, swim: 0, drive: 0, talk: 0, carry: 0 };
    this.t = this.r() * 10;
    this.speed = 0;
    this.lookYaw = 0; this.lookPitch = 0;
    this.fallT = 0;
    this.rock = 0;
    this.nameTag = null;
  }

  setName(name, color = '#ffffff') {
    if (this.nameTag) { this.head.remove(this.nameTag); this.nameTag.material.map.dispose(); }
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    if (c) {
      c.font = '600 38px "Alegreya", Georgia, serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillText(name, 129, 35);
      c.fillStyle = color;
      c.fillText(name, 128, 32);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true, fog: false }));
    sp.scale.set(1.2, 0.3, 1);
    sp.position.y = 0.62;
    sp.renderOrder = 5;
    this.nameTag = sp;
    this.head.add(sp);
  }

  /** Attach an object to the right hand. */
  hold(obj) {
    while (this.handR.children.length) this.handR.remove(this.handR.children[0]);
    if (obj) this.handR.add(obj);
  }

  /** Begin a fall (knocked over). */
  knock() { this.fallT = 0.001; }

  update(dt, state = this.state, speed = 0) {
    this.state = state;
    this.t += dt;
    this.speed = damp(this.speed, speed, 8, dt);
    for (const k in this.w) this.w[k] = damp(this.w[k], k === state ? 1 : 0, 9, dt);
    const W = this.w, t = this.t;

    // falling overrides with its own clock
    if (this.fallT > 0) {
      this.fallT += dt;
      if (this.fallT > 2.4) this.fallT = 0;
    }
    const fallA = this.fallT > 0 ? (this.fallT < 0.35 ? this.fallT / 0.35 : this.fallT > 1.8 ? 1 - (this.fallT - 1.8) / 0.6 : 1) : 0;

    const wk = W.walk + W.run * 1.6;
    const cyc = t * (5.5 + W.run * 3.5);
    const swing = Math.sin(cyc) * (0.55 * W.walk + 0.85 * W.run);

    // legs
    const [lL, lR] = this.legs;
    const sit = W.sit + W.drive * 0.2;
    lL.rotation.x = -swing - sit * 1.45 + W.swim * Math.sin(t * 6) * 0.4 - fallA * 1.2;
    lR.rotation.x = swing - sit * 1.45 - W.swim * Math.sin(t * 6) * 0.4 - fallA * 1.0;
    lL.userData.knee.rotation.x = Math.max(0, Math.sin(cyc + 1.2)) * 0.8 * wk + sit * 1.5 + W.swim * 0.3 + fallA * 0.3;
    lR.userData.knee.rotation.x = Math.max(0, Math.sin(cyc + 1.2 + Math.PI)) * 0.8 * wk + sit * 1.5 + W.swim * 0.3 + fallA * 0.2;
    lL.rotation.z = W.cheer * -0.15; lR.rotation.z = W.cheer * 0.15;

    // hips / bob
    const bob = Math.abs(Math.sin(cyc)) * 0.05 * wk;
    const breathe = Math.sin(t * 1.8) * 0.01;
    const jump = W.cheer * Math.max(0, Math.sin(t * 7)) * 0.18;
    this.hips.position.y = 0.92 * this.look.height + bob + jump - sit * 0.42 - W.swim * 0.5;
    this.torso.rotation.x = 0.06 * W.run + breathe + W.fish * 0.08 + W.reel * 0.12 - sit * 0.1 + W.swim * 1.2 + W.carry * -0.05;
    this.torso.rotation.y = Math.sin(cyc) * 0.08 * wk;
    this.torso.rotation.z = W.talk * Math.sin(t * 2) * 0.04;

    // rocking chair
    if (W.sit > 0.5) { this.rock += dt; this.body.rotation.x = Math.sin(this.rock * 1.4) * 0.07 * W.sit; }

    // arms
    const [aL, aR] = this.arms;
    const talkL = W.talk * (Math.sin(t * 3.1) * 0.35 + 0.4), talkR = W.talk * (Math.sin(t * 2.3 + 1) * 0.3 + 0.2);
    aL.rotation.x = swing * 0.9 - W.fish * 1.0 - W.reel * 1.0 - W.cheer * 2.8 - W.drive * 1.1 - talkL - W.carry * 1.2 + W.swim * (Math.sin(t * 3) * 1.6 - 2.2) + fallA * -1.8;
    aR.rotation.x = -swing * 0.9 - W.fish * 1.2 - W.reel * (1.05 + Math.sin(t * 9) * 0.25) - W.cheer * 2.8 - W.drive * 1.1 - talkR - W.carry * 1.2 + W.swim * (Math.sin(t * 3 + Math.PI) * 1.6 - 2.2) + fallA * -1.6;
    aL.rotation.z = -0.08 - W.cheer * 0.35 - W.idle * 0.04 + W.fish * 0.35 + W.reel * 0.3 + W.carry * 0.3;
    aR.rotation.z = 0.08 + W.cheer * 0.35 + W.idle * 0.04 - W.fish * 0.2 - W.reel * 0.1 - W.carry * 0.3;
    aL.userData.elbow.rotation.x = -0.15 - W.fish * 0.5 - W.reel * 0.6 - W.drive * 0.4 - W.talk * 0.6 - W.carry * 0.4 - W.walk * 0.25;
    aR.userData.elbow.rotation.x = -0.15 - W.fish * 0.3 - W.reel * (0.6 + Math.cos(t * 9) * 0.3) - W.drive * 0.4 - W.talk * 0.5 - W.carry * 0.4 - W.walk * 0.25;

    // head looks where it is told, plus a little life
    this.head.rotation.y = damp(this.head.rotation.y, clamp(this.lookYaw, -1.1, 1.1) + W.idle * Math.sin(t * 0.37) * 0.25, 5, dt);
    this.head.rotation.x = damp(this.head.rotation.x, clamp(this.lookPitch, -0.6, 0.6) - W.cheer * 0.4 + W.swim * -0.9, 5, dt);

    // fall: tip the whole body onto its back
    this.body.rotation.x = W.sit > 0.5 ? this.body.rotation.x : -fallA * 1.45;
    this.body.position.y = fallA * 0.25;
    this.body.position.z = -fallA * 0.6;
  }
}

/** Random villager look from a seed. */
export function randomLook(seed) {
  const r = rng(seed);
  return {
    skin: r.pick(SKINS),
    shirt: r.pick([0x4a6aa0, 0x8a3a34, 0x3a7a4a, 0xc8a040, 0x6a4a8a, 0x2e4e5e, 0xa85a2e, 0x5e5e5e]),
    pants: r.pick([0x3a3a48, 0x4a3a2a, 0x2e3e5a, 0x5a5a4a]),
    boots: r.pick([0x3a2a20, 0x2a2a2a, 0x5a3a24]),
    hat: r.pick(['none', 'cap', 'beanie', 'bucket', 'none']),
    hatCol: r.pick([0xc84a3a, 0x3a5a8a, 0xe8c040, 0x4a7a3a, 0x3a3a3a]),
    hair: r.pick(['short', 'short', 'long', 'bald', 'bun']),
    hairCol: r.pick([0x5a3a24, 0x2a1e16, 0xc8a060, 0x8a8a8a, 0xa84a2a]),
    beard: r.pick(['none', 'none', 'stubble', 'full', 'moustache']),
    beardCol: r.pick([0x5a3a24, 0xdddddd, 0x8a6a4a]),
    glasses: r() < 0.3,
    nose: 0.85 + r() * 0.6,
    build: 0.9 + r() * 0.25,
    height: 0.92 + r() * 0.16,
    belly: r() * 0.8,
  };
}

export const PLAYER_LOOKS = [
  { skin: 0xf1c9a5, shirt: 0xd86a3a, pants: 0x3a4a5e, hat: 'beanie', hatCol: 0xc83a32, hair: 'short', hairCol: 0x5a3a24 },
  { skin: 0xc68a62, shirt: 0x3a7ab0, pants: 0x2e2e38, hat: 'cap', hatCol: 0xe8c040, hair: 'short', hairCol: 0x2a1e16, beard: 'stubble' },
  { skin: 0xe0ac86, shirt: 0x5a9a4a, pants: 0x4a3a2a, hat: 'bucket', hatCol: 0x8a9a6a, hair: 'long', hairCol: 0xa84a2a, glasses: true },
  { skin: 0x9a6444, shirt: 0xe8c040, pants: 0x3a3a48, hat: 'none', hair: 'bun', hairCol: 0x1a1410, overalls: false, vest: 0x3a5a7a },
];
