/* ViewModel.js - your hands and whatever they are holding, first person.

   Drawn in its own scene after the world with the depth buffer cleared, so
   a rod never clips into a wall. The viewmodel camera shares the world
   camera's FOV and orientation exactly, which is what lets the fishing
   line start at the rod tip on screen: the tip is converted from camera
   space into world space and the line is drawn in the world from there.

   Poses are spring-blended targets per tool and action, so a cast is a
   wind-up and a whip, reeling turns the crank, and a hammer swings. */

import * as THREE from '../../lib/three.module.js?v=1790356418';
import { MeshBuilder, shadeHex } from '../art/Geo.js?v=1790356418';
import { MAT } from '../art/Materials.js?v=1790356418';
import { buildRod } from '../art/RodArt.js?v=1790356418';
import { damp, clamp, rng, TAU } from '../core/Util.js?v=1790356418';

function handMesh(skin, sleeve, side) {
  const b = new MeshBuilder(rng(side > 0 ? 3 : 4));
  b.color(sleeve).cyl(0.06, 0.055, -0.5, -0.22, 6, true);
  b.color(shadeHex(sleeve, 0.85)).cyl(0.065, 0.065, -0.24, -0.2, 6, false);
  b.color(skin).cyl(0.047, 0.05, -0.22, -0.02, 6, false);
  // big mitten hand wrapped round a grip at the origin
  b.color(skin).blob(0.07, 0.06, 0.085, 0, 0.03, 0.0, 6, 3, 0.1);
  b.color(shadeHex(skin, 0.94)).blob(0.03, 0.035, 0.05, side * -0.055, 0.05, 0.03, 5, 3);
  b.color(shadeHex(skin, 0.9));
  for (let i = 0; i < 3; i++) b.blob(0.022, 0.02, 0.03, side * (0.02 - i * 0.022), 0.075, 0.04, 4, 2);
  const m = new THREE.Mesh(b.build(), MAT.solid);
  return m;
}

function toolMesh(id) {
  const b = new MeshBuilder(rng(id.length));
  const g = new MeshBuilder(rng(2));
  if (id === 'harpoon') {
    b.color(0x6a4a30).cyl(0.022, 0.022, -0.5, 1.1, 6, true);
    b.color(0x9aa0a8).cone(0.05, 1.1, 1.4, 4);
    b.color(0x9aa0a8).beam([0, 1.18, 0], [0.07, 1.08, 0], 0.012, 0.012);
    b.color(0x9aa0a8).beam([0, 1.18, 0], [-0.07, 1.08, 0], 0.012, 0.012);
    b.color(0xc8b48a).cyl(0.03, 0.03, -0.45, -0.3, 6, true);
  } else if (id === 'net') {
    b.color(0x6a4a30).cyl(0.018, 0.018, -0.4, 1.2, 6, true);
    b.color(0x3a3a3a);
    for (let k = 0; k < 12; k++) { const a0 = k / 12 * TAU, a1 = (k + 1) / 12 * TAU; b.beam([Math.cos(a0) * 0.28, 1.45 + Math.sin(a0) * 0.28, 0], [Math.cos(a1) * 0.28, 1.45 + Math.sin(a1) * 0.28, 0], 0.015, 0.015); }
    b.color(0xd8c89a);
    for (let k = -3; k <= 3; k++) { b.beam([k * 0.08, 1.45 - Math.sqrt(Math.max(0, 0.078 - (k * 0.08) ** 2)), 0], [k * 0.05, 1.3, -0.25], 0.006, 0.006); b.beam([k * 0.08, 1.45 + Math.sqrt(Math.max(0, 0.078 - (k * 0.08) ** 2)), 0], [k * 0.05, 1.3, -0.25], 0.006, 0.006); }
  } else if (id === 'hammer') {
    b.color(0x7a5836).cyl(0.02, 0.022, -0.1, 0.35, 6, true);
    b.color(0x5a5a60).box(0.05, 0.06, 0.18, 0, 0.38, 0);
    b.color(0x5a5a60).beam([0, 0.38, -0.09], [0, 0.34, -0.16], 0.03, 0.03);
  } else if (id === 'bucket') {
    b.color(0x8a8a90).lathe([[0.1, 0], [0.13, 0.22], [0.14, 0.24]], 9, 0, 0);
    b.color(0x5a5a60);
    for (let k = 0; k < 6; k++) { const a0 = k / 6 * Math.PI, a1 = (k + 1) / 6 * Math.PI; b.beam([Math.cos(a0) * 0.14, 0.24 + Math.sin(a0) * 0.14, 0], [Math.cos(a1) * 0.14, 0.24 + Math.sin(a1) * 0.14, 0], 0.008, 0.008); }
    g.color(0x5aa8c8).cyl(0.12, 0.12, 0.17, 0.18, 9, true);
  } else if (id === 'camera') {
    b.color(0x2a2a2e).box(0.2, 0.12, 0.08, 0, 0.06, 0);
    b.color(0x3a3a40).cyl(0.04, 0.045, 0.04, 0.12, 8, true, 0, 0);
    b.color(0xd8d8d8).box(0.05, 0.03, 0.02, 0.06, 0.13, 0);
    g.color(0x8ad0ff).cyl(0.03, 0.03, 0.12, 0.125, 8, true);
  } else if (id === 'grapple') {
    b.color(0x3a3a40).box(0.07, 0.26, 0.09, 0, 0.12, 0.03);
    b.color(0x6a4a30).box(0.05, 0.08, 0.12, 0, 0.0, -0.06);
    b.color(0xc8b48a).cyl(0.035, 0.035, 0.05, 0.12, 6, true, 0, 0.09);
    b.color(0x9aa0a8).cyl(0.018, 0.018, 0.25, 0.42, 6, true);
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; b.color(0x9aa0a8).beam([0, 0.4, 0], [Math.cos(a) * 0.08, 0.36, Math.sin(a) * 0.08], 0.015, 0.015); }
  } else if (id === 'auger') {
    b.color(0x3a6aa0).box(0.4, 0.05, 0.05, 0, 0.5, 0);
    b.color(0x9aa0a8).cyl(0.02, 0.02, -0.4, 0.5, 6, true);
    for (let k = 0; k < 8; k++) b.color(0xb8bec4).beam([Math.cos(k) * 0.05, -0.35 + k * 0.08, Math.sin(k) * 0.05], [Math.cos(k + 1) * 0.05, -0.31 + k * 0.08, Math.sin(k + 1) * 0.05], 0.03, 0.01);
  } else if (id === 'axe') {
    b.color(0x7a5836).cyl(0.022, 0.027, -0.22, 0.56, 6, true);
    b.color(0x5a3e28).cyl(0.03, 0.03, -0.22, -0.12, 6, true);
    b.color(0x8a9098).box(0.03, 0.13, 0.2, 0, 0.5, 0.09);
    b.color(0xd8dce0).box(0.034, 0.17, 0.035, 0, 0.5, 0.2);
    b.color(0x5a5e64).box(0.052, 0.08, 0.08, 0, 0.5, -0.02);
  } else if (id === 'trap') {
    b.color(0x5a4230);
    for (const [x, z] of [[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.12], [0.18, 0.12]]) b.box(0.025, 0.24, 0.025, x, 0.12, z);
    b.box(0.4, 0.025, 0.28, 0, 0.24, 0); b.box(0.4, 0.025, 0.28, 0, 0.0, 0);
    b.color(0xd8c89a);
    for (let i = 0; i < 6; i++) b.box(0.006, 0.24, 0.28, -0.17 + i * 0.07, 0.12, 0);
    b.color(0xe03a2a).blob(0.05, 0.05, 0.05, 0, 0.32, 0, 6, 3);
  }
  const grp = new THREE.Group();
  if (b.tris) grp.add(new THREE.Mesh(b.build(), MAT.solid));
  if (g.tris) grp.add(new THREE.Mesh(g.build(), MAT.glow));
  return grp;
}

export class ViewModel {
  constructor(look) {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(70, 1, 0.01, 20);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.position.set(0.5, 1, 0.3);
    this.scene.add(this.hemi, this.sun, this.cam);
    this.root = new THREE.Group();
    this.cam.add(this.root);
    this.right = new THREE.Group();
    this.left = new THREE.Group();
    this.root.add(this.right, this.left);
    this.rightHand = handMesh(look.skin, look.shirt, 1);
    this.leftHand = handMesh(look.skin, look.shirt, -1);
    this.rightHand.scale.setScalar(0.82); this.leftHand.scale.setScalar(0.82);
    this.right.add(this.rightHand);
    this.left.add(this.leftHand);
    this.toolHolder = new THREE.Group();
    this.right.add(this.toolHolder);
    this.tools = {};
    this.rod = null;
    this.tool = null;
    this.t = 0;
    this.sway = new THREE.Vector2();
    this.action = 'idle';
    this.actT = 0;
    this.pose = { rx: 0, ry: 0, rz: 0, x: 0, y: 0, z: 0 };
    this.visible = true;
    this.holding = false;
  }

  setRod(def) {
    if (this.rod) this.toolHolder.remove(this.rod.group);
    this.rod = buildRod(def);
    this.rod.group.scale.setScalar(0.78);
    this.rodDef = def;
    this.rod.group.visible = false;
    this.toolHolder.add(this.rod.group);
    if (this.tool === 'rod') this.setTool('rod', true);
  }

  setTool(id, force = false) {
    if (this.tool === id && !force) return;
    this.tool = id;
    for (const k in this.tools) this.tools[k].visible = false;
    if (this.rod) this.rod.group.visible = id === 'rod';
    if (id !== 'rod' && id) {
      if (!this.tools[id]) { this.tools[id] = toolMesh(id); this.toolHolder.add(this.tools[id]); }
      this.tools[id].visible = true;
    }
    this.switchT = 0.35;
  }

  play(action) { this.action = action; this.actT = 0; }

  resize(aspect, fov) { this.cam.aspect = aspect; this.cam.fov = fov; this.cam.updateProjectionMatrix(); }

  /** s: { moving, sprint, look:{x,y}, fishing:{state, tension, crank, charge, side}, busy } */
  update(dt, s, worldCam) {
    this.t += dt;
    this.actT += dt;
    this.cam.position.set(0, 0, 0);
    this.cam.quaternion.identity();
    this.switchT = Math.max(0, (this.switchT || 0) - dt);
    // sway lags the mouse
    this.sway.x = damp(this.sway.x, clamp(-s.look.x * 6, -0.08, 0.08), 10, dt);
    this.sway.y = damp(this.sway.y, clamp(s.look.y * 6, -0.08, 0.08), 10, dt);
    const bob = s.moving ? Math.sin(this.t * (s.sprint ? 12 : 8.5)) : 0;
    const bobX = s.moving ? Math.cos(this.t * (s.sprint ? 6 : 4.25)) : 0;
    const breathe = Math.sin(this.t * 1.6) * 0.004;
    const F = s.fishing || {};
    // targets for the right hand (tool hand)
    let R = { x: 0.26, y: -0.3, z: -0.5, rx: -0.2, ry: 0.1, rz: 0 };
    let Lh = { x: -0.26, y: -0.42, z: -0.52, rx: 0.2, ry: 0, rz: 0.2, show: false };
    const tool = this.tool;
    if (tool === 'rod') {
      // rod held forward and up; left hand on the reel crank
      R = { x: 0.2, y: -0.19, z: -0.46, rx: -1.12, ry: 0.18, rz: 0.12 };
      Lh = { x: 0.1, y: -0.3, z: -0.4, rx: -1.0, ry: -0.2, rz: 0.4, show: true };
      if (F.state === 'charge') { const c = F.charge || 0; R.rx = -1.12 + c * 1.2; R.y += c * 0.08; R.z += c * 0.12; }
      if (this.action === 'cast') { const k = this.actT; const w = k < 0.12 ? k / 0.12 : Math.max(0, 1 - (k - 0.12) / 0.3); R.rx = -1.12 - w * 0.45; }
      if (F.state === 'fight') {
        // the fish drags the tip down and toward it; the bigger it is, the more you lean and shake
        const pull = F.pull || 0.5, ten = F.tension || 0;
        const heave = Math.max(0, pull - 0.6);
        R.rx = -1.12 + 0.2 * ten + heave * 0.22;
        R.ry = 0.14 + (F.side || 0) * 0.32;
        R.rz = 0.12 - (F.side || 0) * 0.12;
        R.z = -0.46 - heave * 0.08; R.y = -0.2 - ten * 0.05;
        const sh = Math.min(0.022, heave * 0.012 + Math.max(0, ten - 0.8) * 0.02);
        this.shakeT = (this.shakeT || 0) + dt * 23;
        R.x += Math.sin(this.shakeT * 1.3) * sh; R.y += Math.cos(this.shakeT) * sh; R.rz += Math.sin(this.shakeT * 0.7) * sh * 3;
        // the left hand turns the crank in a circle
        const c = F.crank || 0;
        Lh = { x: 0.1 + Math.sin(c) * 0.025, y: -0.3 + Math.sin(c) * 0.04 - ten * 0.03, z: -0.4 + Math.cos(c) * 0.04, rx: -1.0 + Math.sin(c) * 0.25, ry: -0.2, rz: 0.4, show: true };
      } else if (F.state === 'reelin') {
        const c = F.crank || 0;
        Lh.y += Math.sin(c) * 0.035; Lh.z += Math.cos(c) * 0.035;
      }
      if (F.state === 'bite') { R.rx += Math.sin(this.t * 40) * 0.03; }
    } else if (tool === 'harpoon') {
      R = { x: 0.24, y: -0.3, z: -0.4, rx: -1.35, ry: 0.05, rz: 0 };
      if (this.action === 'throw') { const k = this.actT; const w = k < 0.1 ? -k / 0.1 * 0.4 : k < 0.3 ? 1 : Math.max(0, 1 - (k - 0.3) / 0.3); R.z -= w * 0.35; }
      Lh = { x: 0.1, y: -0.34, z: -0.62, rx: -1.3, ry: 0, rz: 0.2, show: true };
    } else if (tool === 'net') {
      R = { x: 0.28, y: -0.32, z: -0.5, rx: -0.9, ry: 0.2, rz: -0.1 };
      if (this.action === 'swing') { const k = clamp(this.actT / 0.5, 0, 1); R.rx = -0.9 - Math.sin(k * Math.PI) * 0.9; R.ry = 0.2 - Math.sin(k * Math.PI) * 0.7; }
    } else if (tool === 'hammer') {
      R = { x: 0.3, y: -0.3, z: -0.5, rx: -0.4, ry: 0, rz: 0 };
      if (this.action === 'hit' || s.busy) { const k = (this.t * 5) % 1; R.rx = -0.4 - Math.sin(k * Math.PI) * 1.1; }
    } else if (tool === 'bucket') {
      R = { x: 0.22, y: -0.46 - (this.bucketFull ? 0.04 : 0), z: -0.5, rx: 0, ry: 0, rz: Math.sin(this.t * 3) * (this.bucketFull ? 0.04 : 0) };
      if (this.tools.bucket?.children[1]) this.tools.bucket.children[1].visible = !!this.bucketFull;
      if (this.action === 'swing') { const k = clamp(this.actT / 0.45, 0, 1); R.y -= Math.sin(k * Math.PI) * 0.25; R.rx = Math.sin(k * Math.PI) * 0.9; }
      if (this.action === 'throw') { const k = clamp(this.actT / 0.45, 0, 1); R.rx = -Math.sin(k * Math.PI) * 1.6; R.y += Math.sin(k * Math.PI) * 0.25; }
    } else if (tool === 'camera') {
      R = { x: 0.04, y: -0.14, z: -0.34, rx: 0, ry: 0, rz: 0 };
      Lh = { x: -0.12, y: -0.18, z: -0.36, rx: 0, ry: 0, rz: 0.1, show: true };
      if (s.aim) { R.y = -0.26; R.z = -0.3; }
    } else if (tool === 'grapple') {
      R = { x: 0.24, y: -0.26, z: -0.46, rx: -1.45, ry: 0, rz: 0 };
      if (this.action === 'throw') R.z += 0.08 * Math.max(0, 1 - this.actT * 4);
    } else if (tool === 'auger') {
      R = { x: 0.1, y: -0.35, z: -0.62, rx: 0.3, ry: 0, rz: 0 };
      Lh = { x: -0.1, y: -0.35, z: -0.62, rx: 0.3, ry: 0, rz: 0, show: true };
      if (s.busy && this.tools.auger) this.tools.auger.rotation.y += dt * 20;
    } else if (tool === 'axe') {
      R = { x: 0.27, y: -0.3, z: -0.48, rx: -0.55, ry: 0.15, rz: 0.15 };
      if (this.action === 'chop') { const k = clamp(this.actT / 0.42, 0, 1); const up = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65; R.rx = -0.55 - up * 1.2 + (k > 0.35 ? (k - 0.35) * 1.8 : 0); R.y += up * 0.12; R.z -= (k > 0.35 ? (1 - k) * 0.25 : 0); }
    } else if (tool === 'trap') {
      R = { x: 0.14, y: -0.38, z: -0.5, rx: 0, ry: 0.3, rz: 0 };
      Lh = { x: -0.14, y: -0.38, z: -0.5, rx: 0, ry: -0.3, rz: 0, show: true };
    } else {
      R = { x: 0.26, y: -0.46, z: -0.45, rx: -0.3, ry: 0, rz: 0 };
      Lh = { x: -0.26, y: -0.46, z: -0.45, rx: -0.3, ry: 0, rz: 0, show: s.holding };
    }
    if (s.holding) { R = { x: 0.2, y: -0.4, z: -0.5, rx: -0.4, ry: -0.3, rz: 0.4 }; Lh = { x: -0.2, y: -0.4, z: -0.5, rx: -0.4, ry: 0.3, rz: -0.4, show: true }; }
    // swimming: a breaststroke - reach forward, sweep out, pull back, recover
    this.swimW = damp(this.swimW || 0, s.swim ? 1 : 0, 6, dt);
    if (s.swim) {
      const sp = s.swim.exhausted ? 0.9 : s.swim.moving ? 2.1 : 0.9;
      this.strokeT = (this.strokeT || 0) + dt * sp;
      const p = this.strokeT % 1, a = p * Math.PI * 2;
      const reach = s.swim.moving ? 1 : 0.35;
      const out = Math.max(0, Math.sin(a)) * 0.32 * reach, back = Math.max(0, -Math.sin(a)) * reach;
      const low = s.swim.exhausted ? -0.1 : 0;
      R = { x: 0.1 + out, y: -0.28 - back * 0.1 + low, z: -0.52 + back * 0.28 + out * 0.1, rx: -1.3 + back * 0.6, ry: -0.3 - out * 1.1, rz: -0.5, show: true };
      Lh = { x: -0.1 - out, y: -0.28 - back * 0.1 + low, z: -0.52 + back * 0.28 + out * 0.1, rx: -1.3 + back * 0.6, ry: 0.3 + out * 1.1, rz: 0.5, show: true };
      if (s.swim.moving && p < this.lastP) this.onStroke && this.onStroke();
      this.lastP = p;
    }
    this.toolHolder.visible = this.swimW < 0.5;
    // the walkie-talkie: held up to your mouth in the left hand while C is down
    if (!this.walkieMesh) {
      const wb = new MeshBuilder(rng(8));
      wb.color(0x2a2e34).box(0.07, 0.15, 0.04, 0, 0.08, 0.02);
      wb.color(0x3a3e44).box(0.06, 0.05, 0.005, 0, 0.12, 0.042);
      wb.color(0xe8b030).box(0.03, 0.02, 0.01, 0, 0.05, 0.045);
      wb.color(0x1a1a1a).cyl(0.006, 0.005, 0.15, 0.3, 4, true, 0.022, 0.02);
      wb.color(0xe04a2a).box(0.012, 0.012, 0.012, -0.02, 0.165, 0.02);
      this.walkieMesh = new THREE.Mesh(wb.build(), MAT.solid);
      this.left.add(this.walkieMesh);
    }
    this.walkieMesh.visible = !!s.walkie;
    if (s.walkie) Lh = { x: -0.12, y: -0.2, z: -0.34, rx: 0.1, ry: 0.35, rz: 0.1, show: true };
    const sw = this.switchT > 0 ? this.switchT / 0.35 : 0;
    const k = 1 - Math.exp(-14 * dt);
    const apply = (grp, T, bobK) => {
      grp.position.x += (T.x + this.sway.x + bobX * 0.012 * bobK - grp.position.x) * k;
      grp.position.y += (T.y + this.sway.y - sw * 0.3 + Math.abs(bob) * -0.015 * bobK + breathe - grp.position.y) * k;
      grp.position.z += (T.z - grp.position.z) * k;
      grp.rotation.x += (T.rx - grp.rotation.x) * k;
      grp.rotation.y += (T.ry - grp.rotation.y) * k;
      grp.rotation.z += (T.rz - grp.rotation.z) * k;
    };
    apply(this.right, R, 1);
    apply(this.left, Lh, 0.8);
    this.left.visible = !!Lh.show && this.visible;
    this.right.visible = this.visible;
    // rod bend and reel
    if (this.rod && tool === 'rod') {
      const bend = F.state === 'fight' ? 0.3 + (F.tension || 0) * 0.85 * Math.min(1.7, 0.6 + (F.pull || 0.5)) : F.state === 'bite' ? 0.5 + Math.sin(this.t * 30) * 0.2 : F.state === 'nibble' ? 0.18 : F.state === 'wait' ? 0.08 : 0;
      this.rodBend = damp(this.rodBend || 0, bend, 10, dt);
      this.rod.bend(this.rodBend, (F.side || 0) * 0.6);
      this.rod.crank(F.crank || 0);
    }
    this.toolHolder.rotation.set(0, 0, 0);
    // match the world camera
    this.cam.fov = worldCam.fov; this.cam.aspect = worldCam.aspect; this.cam.updateProjectionMatrix();
  }

  /** The rod tip in world space, given the world camera. */
  tipWorld(worldCam, out = new THREE.Vector3()) {
    if (!this.rod) return out.copy(worldCam.position);
    this.root.updateMatrixWorld(true);
    this.rod.tip.getWorldPosition(out);     // in vm camera space (vm cam sits at the origin, unrotated)
    worldCam.updateMatrixWorld();
    return out.applyMatrix4(worldCam.matrixWorld);
  }
  /** Any point at the right hand in world space. */
  handWorld(worldCam, out = new THREE.Vector3()) {
    this.right.getWorldPosition(out);
    return out.applyMatrix4(worldCam.matrixWorld);
  }

  syncLights(sunCol, sunI, hemiCol, hemiGnd, hemiI) {
    this.sun.color.copy(sunCol); this.sun.intensity = Math.max(0.6, sunI * 0.8);
    this.hemi.color.copy(hemiCol); this.hemi.groundColor.copy(hemiGnd); this.hemi.intensity = Math.max(0.8, hemiI);
  }
}
