/* Aquarium.js - the water in a finished aquarium, and everything living in it.

   Every finished aquarium gets: tinted water that moves, a sand floor with
   caustic light rippling across it, rocks and weed, a bubbler, a soft blue
   glow, and its fish - real models of the fish you put in, swimming.

   How they swim, by what they are:
     most fish    wander the tank at their own depth, turn, speed up and
                  slow down, and now and then fall in behind another fish
     bottom       crabs, lobsters, starfish, urchins: crawl about the sand
     rays         glide low and flat, banking into their turns
     jellies      drift and pulse, up and down, hardly going anywhere
     eels, serpents and the long ones: slow sinuous patrols
     sea beasts   a slow, heavy circuit of the whole tank

   The fish are in the save (the aquarium's `store`), so the whole crew sees
   the same ones; the swimming is worked out on each screen. */

import * as THREE from '../../lib/three.module.js';
import { catchMesh } from '../art/CatchArt.js';
import { MeshBuilder } from '../art/Geo.js';
import { MAT } from '../art/Materials.js';
import { FISH_BY_ID } from '../data/FishData.js';
import { rng, clamp } from '../core/Util.js';

const _v = new THREE.Vector3();
const U = { uTime: { value: 0 } };
const CAUSTIC = `
float caustic(vec2 p, float t) {
  float c = 0.0;
  c += sin(p.x * 3.1 + t * 1.3 + sin(p.y * 2.3 + t * 0.7) * 1.6);
  c += sin(p.y * 3.7 - t * 1.1 + sin(p.x * 1.9 - t * 0.9) * 1.4);
  c += sin((p.x + p.y) * 2.3 + t * 0.8);
  c = abs(c) / 3.0;
  return pow(1.0 - c, 5.0);
}`;
/** The water: see-through blue that darkens with depth, a moving surface sheen. */
const waterMat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `varying vec3 vW; varying vec3 vN; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uTime; varying vec3 vW; varying vec3 vN; ${CAUSTIC}
    void main() {
      float c = caustic(vW.xz * 1.4 + vW.y * 0.6, uTime);
      vec3 deep = vec3(0.05, 0.28, 0.42), shallow = vec3(0.3, 0.72, 0.82);
      vec3 col = mix(deep, shallow, 0.45 + 0.35 * vN.y) + c * 0.18;
      float a = vN.y > 0.5 ? 0.6 : 0.34;
      gl_FragColor = vec4(col, a);
    }`,
});
/** The sand: warm, with caustics dancing over it. */
const sandMat = new THREE.ShaderMaterial({
  uniforms: U,
  vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uTime; varying vec3 vW; ${CAUSTIC}
    void main() {
      float c = caustic(vW.xz * 1.8, uTime * 1.2);
      float g = fract(sin(dot(floor(vW.xz * 6.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.06;
      vec3 sand = vec3(0.78, 0.7, 0.5) * (0.62 + g) + vec3(0.55, 0.9, 1.0) * c * 0.45;
      gl_FragColor = vec4(sand * vec3(0.8, 0.95, 1.0), 1.0);
    }`,
});
const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.55, depthWrite: false });

/* How a species swims. */
function styleOf(sp) {
  if (sp.beast) return 'beast';
  const k = sp.art?.kind;
  if (['crab', 'lobster', 'star', 'urchin'].includes(k)) return 'bottom';
  if (k === 'ray') return 'ray';
  if (k === 'jelly') return 'jelly';
  if (sp.beh === 'eel' || sp.art?.tail === 'eel' || k === 'eel') return 'eel';
  if (k === 'octopus' || k === 'squid' || k === 'cuttle' || k === 'nautilus') return 'jet';
  return 'fish';
}

export class Aquariums {
  constructor(game) {
    this.game = game;
    this.tanks = new Map();      // site id -> {grp, fish: Map(fid -> F), key}
  }

  /** The inside of a tank in its own frame: a point is in if in(p). */
  static inner(T) {
    const m = 0.08;
    if (T.round) return { round: true, r: T.r - m, y0: T.y0 + m, y1: T.y0 + T.h - m * 2 };
    return { x: T.w / 2 - m, z: T.d / 2 - m, y0: T.y0 + m, y1: T.y0 + T.h - m * 2 };
  }
  /** The longest the model of a catch is drawn in this tank. */
  static displayLen(T, cm) {
    const room = T.round ? T.r * 1.4 : Math.min(T.w * 0.6, Math.max(T.d, T.w * 0.4) * 1.1);
    return Math.min(cm / 100, room, T.h * (T.round ? 2.4 : 1.6));
  }

  update(dt, sites) {
    const G = this.game;
    U.uTime.value += dt;
    const seen = new Set();
    for (const site of sites.values()) {
      const T = site.bp.tank;
      if (!T || !site.complete) continue;
      seen.add(site.S.id);
      let A = this.tanks.get(site.S.id);
      if (!A) A = this._make(site);
      // who is in there (the save says; the crew all see the same)
      const key = (site.S.store || []).map(x => x.id).join(',');
      if (key !== A.key) this._stock(A, site);
      const d = Math.hypot(site.S.x - G.player.pos.x, site.S.z - G.player.pos.z);
      A.grp.visible = d < 220;
      if (!A.grp.visible) continue;
      if (d < 90) this._swim(A, dt);
      this._bubbles(A, dt);
      // a soft blue light off the water at night, and all the time in the big ones
      if (G._night() > 0.2 || T.h > 1.5) G.world.extraLights.push(A.light);
    }
    for (const [id, A] of this.tanks) if (!seen.has(id)) { G.scene.remove(A.grp); this.tanks.delete(id); }
  }

  _make(site) {
    const G = this.game, T = site.bp.tank, S = site.S;
    const grp = new THREE.Group();
    grp.position.set(S.x, S.y, S.z);
    grp.rotation.y = S.r;
    G.scene.add(grp);
    const r = rng(S.id.length * 7 + 3);
    // water and sand
    const inW = T.round ? null : [T.w - 0.06, T.h - 0.1, T.d - 0.06];
    const water = new THREE.Mesh(T.round ? new THREE.CylinderGeometry(T.r - 0.04, T.r - 0.04, T.h - 0.1, 24, 1, false) : new THREE.BoxGeometry(...inW), waterMat);
    water.position.y = T.y0 + (T.h - 0.1) / 2;
    water.renderOrder = 2;
    grp.add(water);
    const sand = new THREE.Mesh(T.round ? new THREE.CircleGeometry(T.r - 0.05, 24) : new THREE.PlaneGeometry(T.w - 0.06, T.d - 0.06, 1, 1), sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = T.y0 + 0.02;
    grp.add(sand);
    // rocks and weed, more of them the bigger it is
    const b = new MeshBuilder(r), wb = new MeshBuilder(r);
    const span = T.round ? T.r : Math.min(T.w, T.d) / 2, n = Math.round(3 + span * 3);
    const rnd = () => { if (T.round) { const a = r() * 6.28, rr = Math.sqrt(r()) * (T.r - 0.3); return [Math.cos(a) * rr, Math.sin(a) * rr]; } return [(r() - 0.5) * (T.w - 0.3), (r() - 0.5) * (T.d - 0.3)]; };
    for (let i = 0; i < n; i++) {
      const [x, z] = rnd(), s = 0.05 + r() * span * 0.12;
      b.color([0x7a7a70, 0x6a6258, 0x8a8478][i % 3], 0.1).lump(s, x, T.y0 + s * 0.4, z, 0.35, 0.6);
    }
    for (let i = 0; i < n * 2; i++) {
      const [x, z] = rnd(), h = 0.1 + r() * Math.min(T.h * 0.6, 0.3 + span * 0.35);
      wb.setSway(1).color(i % 3 ? 0x3a8a4a : 0x7ab04a, 0.15);
      for (let k = 0; k < 3; k++) { const a = r() * 6.28; wb.card([x, T.y0 + 0.02, z], [x + Math.cos(a) * 0.03, T.y0 + 0.02, z + Math.sin(a) * 0.03], [x + Math.cos(a) * 0.05, T.y0 + h, z + Math.sin(a) * 0.05]); }
    }
    if (T.round) {
      // a stone arch in the middle for the big ones to swim through
      for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI, R = T.r * 0.28; b.color(0x7a7268, 0.1).lump(0.45 + T.r * 0.02, Math.cos(a) * R, T.y0 + Math.sin(a) * R * 1.2, 0, 0.3, 0.8); }
    }
    const deco = new THREE.Mesh(b.build(), MAT.solid); deco.receiveShadow = true; grp.add(deco);
    const weed = new THREE.Mesh(wb.build(), MAT.foliage); grp.add(weed);
    // the bubbler
    const [bx, bz] = T.round ? [T.r * 0.55, 0] : [T.w * 0.36, T.d * 0.2];
    const bub = new MeshBuilder(r); bub.color(0x5a5e64).cyl(0.03 + span * 0.01, 0.04 + span * 0.01, T.y0, T.y0 + 0.06, 6, true, bx, bz);
    grp.add(new THREE.Mesh(bub.build(), MAT.solid));
    const bgeo = new THREE.IcosahedronGeometry(0.018 + span * 0.004, 0);
    const bubbles = Array.from({ length: 14 + Math.round(span * 6) }, (_, i) => { const m = new THREE.Mesh(bgeo, bubbleMat); m.renderOrder = 3; grp.add(m); return { m, t: i * 0.37 }; });
    const light = { pos: new THREE.Vector3(S.x, S.y + T.y0 + T.h, S.z), color: 0x7ad8ff, intensity: 0.9 + span * 0.15, dist: 6 + span * 3 };
    const A = { site, T, grp, fish: new Map(), key: null, bubbles, bub: [bx, bz], light, inner: Aquariums.inner(T), r };
    this.tanks.set(S.id, A);
    return A;
  }

  /** Put models in for the fish in the store, take out the ones that have gone. */
  _stock(A, site) {
    const list = site.S.store || [];
    const ids = new Set(list.map(x => x.id));
    for (const [id, F] of A.fish) if (!ids.has(id)) { A.grp.remove(F.m); A.fish.delete(id); }
    for (const x of list) {
      if (A.fish.has(x.id)) continue;
      const sp = FISH_BY_ID[x.sp];
      if (!sp) continue;
      const len = Aquariums.displayLen(A.T, x.cm);
      const m = catchMesh(sp, len, { variant: x.v });
      A.grp.add(m);
      const I = A.inner, st = styleOf(sp);
      const p = new THREE.Vector3();
      this._pick(A, p, st, len);
      const F = { m, sp, st, len, pos: p.clone(), tgt: p.clone(), vel: new THREE.Vector3(), yaw: A.r() * 6.28, t: A.r() * 10, speed: this._speed(st, len), follow: null, wait: 0, bank: 0 };
      m.position.copy(F.pos);
      A.fish.set(x.id, F);
      void I;
    }
    A.key = list.map(x => x.id).join(',');
  }

  _speed(st, len) {
    const base = { fish: 0.35, bottom: 0.06, ray: 0.28, jelly: 0.04, eel: 0.22, jet: 0.3, beast: 0.3 }[st];
    return base * clamp(0.6 + len * 0.6, 0.6, 3.2);
  }
  /** A new place to swim to, at the depth this kind likes. */
  _pick(A, out, st, len) {
    const I = A.inner, r = A.r, h = I.y1 - I.y0;
    const mg = Math.min(len * 0.45, I.round ? I.r * 0.5 : Math.min(I.x, I.z) * 0.9);
    let y;
    if (st === 'bottom') y = I.y0 + 0.03 + len * 0.1;
    else if (st === 'ray') y = I.y0 + len * 0.2 + r() * h * 0.25;
    else if (st === 'jelly') y = I.y0 + h * (0.3 + r() * 0.6);
    else y = I.y0 + clamp(len * 0.3, 0.05, h * 0.45) + r() * Math.max(0.02, h - clamp(len * 0.6, 0.1, h * 0.9));
    y = clamp(y, I.y0 + Math.min(len * 0.15, h * 0.4), I.y1 - Math.min(len * 0.15, h * 0.4));
    if (I.round) { const a = r() * 6.28, rr = Math.sqrt(r()) * Math.max(0.1, I.r - mg); out.set(Math.cos(a) * rr, y, Math.sin(a) * rr); }
    else out.set((r() * 2 - 1) * Math.max(0.02, I.x - mg), y, (r() * 2 - 1) * Math.max(0.02, I.z - mg * 0.5));
    return out;
  }

  _swim(A, dt) {
    const list = [...A.fish.values()];
    for (const F of list) {
      F.t += dt;
      const st = F.st;
      // arrived (or bored): choose somewhere else; sometimes fall in behind another fish for a while
      const to = _v.copy(F.tgt).sub(F.pos);
      const dist = to.length();
      if (F.follow && (F.t > F.followT || !A.fish.has(F.follow.key))) F.follow = null;
      if (F.follow) F.tgt.copy(F.follow.F.pos).addScaledVector(F.follow.F.vel, -1.2);
      else if (dist < Math.max(0.08, F.len * 0.25) || F.t > (F.next || 0)) {
        F.next = F.t + 3 + A.r() * 7;
        if (st !== 'bottom' && st !== 'jelly' && list.length > 1 && A.r() < 0.22) {
          const o = list[Math.floor(A.r() * list.length)];
          if (o !== F && o.st === st) { F.follow = { F: o, key: [...A.fish.entries()].find(e => e[1] === o)[0] }; F.followT = F.t + 4 + A.r() * 5; }
        }
        if (!F.follow) this._pick(A, F.tgt, st, F.len);
      }
      // steer toward it, at this kind's pace; jellies pulse, jets dart
      let sp = F.speed * (0.7 + 0.3 * Math.sin(F.t * 0.9 + F.len));
      if (st === 'jet') sp *= (Math.sin(F.t * 2.2) > 0.7 ? 3.5 : 0.5);
      if (st === 'jelly') { F.vel.y = Math.sin(F.t * 1.6) * 0.05; }
      _v.copy(F.tgt).sub(F.pos);
      if (_v.lengthSq() > 1e-6) _v.normalize().multiplyScalar(sp);
      F.vel.lerp(_v, Math.min(1, dt * (st === 'beast' ? 0.5 : 1.6)));
      // keep a little apart from the others
      for (const o of list) {
        if (o === F) continue;
        const dx = F.pos.x - o.pos.x, dy = F.pos.y - o.pos.y, dz = F.pos.z - o.pos.z, d = Math.hypot(dx, dy, dz), want = (F.len + o.len) * 0.3;
        if (d > 1e-4 && d < want) { const k = (want - d) / want * dt * 1.2; F.vel.x += dx / d * k; F.vel.y += dy / d * k * 0.4; F.vel.z += dz / d * k; }
      }
      F.pos.addScaledVector(F.vel, dt);
      // stay inside the glass
      const I = A.inner, m = Math.min(F.len * 0.35, 0.5);
      F.pos.y = clamp(F.pos.y, I.y0 + Math.min(F.len * 0.12, (I.y1 - I.y0) * 0.45), I.y1 - Math.min(F.len * 0.12, (I.y1 - I.y0) * 0.45));
      if (I.round) { const rr = Math.hypot(F.pos.x, F.pos.z), lim = Math.max(0.1, I.r - m); if (rr > lim) { F.pos.x *= lim / rr; F.pos.z *= lim / rr; } }
      else { F.pos.x = clamp(F.pos.x, -I.x + m, I.x - m); F.pos.z = clamp(F.pos.z, -I.z + Math.min(m, I.z * 0.8), I.z - Math.min(m, I.z * 0.8)); }
      // face where it is going; bank into turns; the tail beats
      const hs = Math.hypot(F.vel.x, F.vel.z);
      if (hs > 0.005 && st !== 'jelly') {
        const want = Math.atan2(-F.vel.z, F.vel.x);
        let dy = want - F.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        F.yaw += dy * Math.min(1, dt * (st === 'beast' ? 0.8 : 3));
        F.bank = F.bank * 0.9 + dy * 0.1;
      }
      const beat = st === 'eel' || st === 'beast' ? 0.12 : st === 'bottom' || st === 'jelly' ? 0 : 0.16;
      F.m.position.copy(F.pos);
      F.m.rotation.set(0, F.yaw + Math.sin(F.t * (4 + F.speed * 6)) * beat * clamp(hs * 4, 0.3, 1), 0);
      if (st === 'ray') F.m.rotateX(F.bank * 2);
      else if (st === 'fish') F.m.rotateX(F.bank * 0.8);
      if (st === 'fish' || st === 'eel') F.m.rotateZ(clamp(F.vel.y / Math.max(0.05, sp), -0.5, 0.5));
      if (F.m.userData.animate) F.m.userData.animate(F.t);
    }
  }

  _bubbles(A, dt) {
    const I = A.inner, [bx, bz] = A.bub, h = I.y1 - I.y0 + 0.1;
    for (const B of A.bubbles) {
      B.t += dt * (0.5 + h * 0.08);
      const k = (B.t % 1);
      B.m.position.set(bx + Math.sin(B.t * 9 + k * 6) * 0.03, I.y0 + k * h, bz + Math.cos(B.t * 7) * 0.03);
      B.m.scale.setScalar(0.6 + k * 0.8);
    }
  }
}
