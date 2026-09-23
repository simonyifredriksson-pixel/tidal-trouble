/* Effects.js - pooled particles: splashes, spray, fire, smoke, sparks,
   explosions, confetti, electric shocks, coins, and water ripples.

   Two InstancedMeshes: one lit (droplets, smoke, debris) and one unlit
   (fire, sparks, glints). A particle is a row in a typed array; nothing is
   allocated per frame. Anything that emits calls a named effect, never the
   pool directly, so the look of an explosion lives in one place. */

import * as THREE from '../../lib/three.module.js?v=1790183165';
import { MeshBuilder } from '../art/Geo.js?v=1790183165';

const MAX = 1800;

class Pool {
  constructor(scene, lit) {
    const b = new MeshBuilder();
    b.color(0xffffff).lump(0.5, 0, 0, 0, 0.15, 1, 0);
    const mat = lit
      ? new THREE.MeshLambertMaterial({ vertexColors: false })
      : new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.InstancedMesh(b.build(), mat, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.n = 0;
    this.p = new Float32Array(MAX * 3); this.v = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX); this.max = new Float32Array(MAX);
    this.size = new Float32Array(MAX); this.grow = new Float32Array(MAX);
    this.grav = new Float32Array(MAX); this.drag = new Float32Array(MAX);
    this.col = new Float32Array(MAX * 3); this.floor = new Float32Array(MAX);
    this.spin = new Float32Array(MAX);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(); this._v = new THREE.Vector3(); this._c = new THREE.Color();
  }
  add(x, y, z, vx, vy, vz, life, size, col, grav = -9.8, drag = 0.5, grow = 0, floor = -1e9) {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grow[i] = grow;
    this.grav[i] = grav; this.drag[i] = drag; this.floor[i] = floor; this.spin[i] = Math.random() * 6;
    this._c.setHex(col);
    this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
  }
  update(dt) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      if (w !== i) {
        for (let k = 0; k < 3; k++) { this.p[w * 3 + k] = this.p[i * 3 + k]; this.v[w * 3 + k] = this.v[i * 3 + k]; this.col[w * 3 + k] = this.col[i * 3 + k]; }
        this.life[w] = this.life[i]; this.max[w] = this.max[i]; this.size[w] = this.size[i]; this.grow[w] = this.grow[i];
        this.grav[w] = this.grav[i]; this.drag[w] = this.drag[i]; this.floor[w] = this.floor[i]; this.spin[w] = this.spin[i];
      }
      const d = Math.exp(-this.drag[w] * dt);
      this.v[w * 3] *= d; this.v[w * 3 + 1] = this.v[w * 3 + 1] * d + this.grav[w] * dt; this.v[w * 3 + 2] *= d;
      this.p[w * 3] += this.v[w * 3] * dt; this.p[w * 3 + 1] += this.v[w * 3 + 1] * dt; this.p[w * 3 + 2] += this.v[w * 3 + 2] * dt;
      if (this.p[w * 3 + 1] < this.floor[w]) { this.p[w * 3 + 1] = this.floor[w]; this.v[w * 3 + 1] *= -0.3; this.v[w * 3] *= 0.6; this.v[w * 3 + 2] *= 0.6; }
      this.size[w] += this.grow[w] * dt;
      w++;
    }
    this.n = w;
    const m = this.mesh;
    for (let i = 0; i < this.n; i++) {
      const t = this.life[i] / this.max[i];
      const s = Math.max(0.001, this.size[i] * (t < 0.2 ? t / 0.2 : 1));
      this.spin[i] += dt * 3;
      this._e.set(this.spin[i], this.spin[i] * 0.7, 0);
      this._q.setFromEuler(this._e);
      this._m.compose(this._v.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]), this._q, this._s.set(s, s, s));
      m.setMatrixAt(i, this._m);
      const f = t < 0.3 ? t / 0.3 : 1;
      this._c.setRGB(this.col[i * 3] * f, this.col[i * 3 + 1] * f, this.col[i * 3 + 2] * f);
      m.setColorAt(i, this._c);
    }
    m.count = this.n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.lit = new Pool(scene, true);
    this.glow = new Pool(scene, false);
    // ripples
    const rb = new MeshBuilder();
    rb.color(0xffffff);
    const seg = 14;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const p = (a, r) => [Math.cos(a) * r, 0, Math.sin(a) * r];
      rb.quad(p(a0, 0.85), p(a0, 1), p(a1, 1), p(a1, 0.85), [0, 1, 0]);
    }
    this.ringGeo = rb.build();
    this.rings = [];
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; m.renderOrder = 4;
      scene.add(m);
      this.rings.push({ m, t: 0, life: 1, r0: 0.2, r1: 2 });
    }
    this.world = null;
  }

  ripple(x, y, z, r1 = 2, life = 1.2) {
    const R = this.rings.find(r => !r.m.visible) || this.rings[0];
    R.m.visible = true; R.t = 0; R.life = life; R.r1 = r1; R.r0 = 0.2;
    R.m.position.set(x, y + 0.03, z);
  }

  splash(x, y, z, power = 1) {
    const n = Math.round(10 + power * 18);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.8 + Math.random() * 2.2) * power;
      this.lit.add(x, y, z, Math.cos(a) * s * 0.6, (2 + Math.random() * 3) * Math.sqrt(power), Math.sin(a) * s * 0.6, 0.6 + Math.random() * 0.6, 0.07 + Math.random() * 0.1 * power, Math.random() < 0.5 ? 0xe8f4f8 : 0xa8d8e8, -9.8, 0.3);
    }
    this.ripple(x, y, z, 1.5 + power * 1.5, 1 + power * 0.4);
    if (power > 1.5) this.ripple(x, y, z, 3 + power * 2, 1.8);
  }

  /** The water erupting when something huge surfaces. */
  eruption(x, y, z, size = 6) {
    for (let i = 0; i < 220; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * size * 0.6;
      this.lit.add(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr, Math.cos(a) * (2 + Math.random() * 4), 6 + Math.random() * 12, Math.sin(a) * (2 + Math.random() * 4), 1.4 + Math.random() * 1.2, 0.18 + Math.random() * 0.35, Math.random() < 0.6 ? 0xf0f8fa : 0x9ad0e0, -9.8, 0.2);
    }
    for (let k = 0; k < 4; k++) this.ripple(x, y, z, size * (1.2 + k * 0.8), 2 + k * 0.5);
  }

  wake(x, y, z, vx, vz, strength) {
    if (Math.random() > strength) return;
    this.lit.add(x + (Math.random() - 0.5) * 0.6, y + 0.05, z + (Math.random() - 0.5) * 0.6, -vz * 0.15 + (Math.random() - 0.5), 0.8 + Math.random(), vx * 0.15 + (Math.random() - 0.5), 0.5 + Math.random() * 0.4, 0.06 + Math.random() * 0.08, 0xf0f8fa, -6, 0.8);
  }

  explosion(x, y, z, power = 1) {
    for (let i = 0; i < 70 * power; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.4 - 0.2, s = (4 + Math.random() * 8) * power;
      this.glow.add(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s, 0.3 + Math.random() * 0.5, 0.25 + Math.random() * 0.35, [0xffd24a, 0xff8a2a, 0xff5a2a, 0xfff0a0][i % 4], -3, 2.5);
    }
    for (let i = 0; i < 30 * power; i++) {
      const a = Math.random() * Math.PI * 2;
      this.lit.add(x, y + 0.3, z, Math.cos(a) * 2, 1.5 + Math.random() * 2.5, Math.sin(a) * 2, 1.6 + Math.random() * 1.4, 0.5 + Math.random() * 0.4, 0x5a5a5a, 1.2, 1.2, 0.9);
    }
    for (let i = 0; i < 20 * power; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7;
      this.lit.add(x, y, z, Math.cos(a) * s, 4 + Math.random() * 6, Math.sin(a) * s, 1.5 + Math.random(), 0.08 + Math.random() * 0.1, 0x5a3a24, -9.8, 0.3);
    }
  }

  fire(x, y, z, intensity = 1) {
    const n = Math.random() < intensity ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.glow.add(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4, 1.4 + Math.random() * 1.6, (Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.4, (0.18 + Math.random() * 0.2) * (0.7 + intensity * 0.5), Math.random() < 0.5 ? 0xff8a2a : 0xffc24a, 2, 1.5, -0.25);
    }
    if (Math.random() < 0.25 * intensity) this.lit.add(x, y + 0.6, z, (Math.random() - 0.5) * 0.3, 1.2 + Math.random(), (Math.random() - 0.5) * 0.3, 2 + Math.random(), 0.3, 0x3a3a3a, 0.6, 0.8, 0.5);
  }

  smoke(x, y, z, col = 0x6a6a6a) {
    this.lit.add(x, y, z, (Math.random() - 0.5) * 0.4, 1 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4, 2 + Math.random() * 1.5, 0.25, col, 0.3, 0.6, 0.45);
  }

  sparks(x, y, z, n = 20, col = 0xffe070) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.5, s = 2 + Math.random() * 5;
      this.glow.add(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, Math.sin(a) * Math.cos(e) * s, 0.25 + Math.random() * 0.35, 0.05 + Math.random() * 0.05, col, -9.8, 1);
    }
  }

  shock(x, y, z, r = 1.5) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * r;
      this.glow.add(x + Math.cos(a) * rr, y + Math.random() * 1.8, z + Math.sin(a) * rr, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 0.12 + Math.random() * 0.25, 0.06 + Math.random() * 0.07, Math.random() < 0.5 ? 0x9af0ff : 0xffffff, 0, 3);
    }
  }

  confetti(x, y, z, n = 60) {
    const cols = [0xf2c14a, 0xe86a3a, 0x5ab4f0, 0x7fd07a, 0xc07af0, 0xffffff];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      this.lit.add(x, y, z, Math.cos(a) * s, 3 + Math.random() * 4, Math.sin(a) * s, 1.5 + Math.random() * 1.5, 0.05 + Math.random() * 0.05, cols[i % cols.length], -4, 1.5);
    }
  }

  coins(x, y, z, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2;
      this.glow.add(x, y, z, Math.cos(a) * s, 3 + Math.random() * 3, Math.sin(a) * s, 0.8 + Math.random() * 0.5, 0.07, 0xf2c14a, -9.8, 0.5);
    }
  }

  bubbles(x, y, z, n = 6) {
    for (let i = 0; i < n; i++) this.lit.add(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, 0, 1 + Math.random(), 0, 0.8 + Math.random(), 0.04 + Math.random() * 0.05, 0xd8f0f8, 2, 1);
  }

  glint(x, y, z, col = 0xfff0a0) {
    this.glow.add(x, y, z, 0, 0.4, 0, 0.5, 0.09, col, 0, 1);
  }

  water(x, y, z, dx, dy, dz) {
    for (let i = 0; i < 26; i++) {
      this.lit.add(x, y, z, dx * (5 + Math.random() * 3) + (Math.random() - 0.5) * 1.5, dy * 5 + 1.5 + Math.random() * 1.5, dz * (5 + Math.random() * 3) + (Math.random() - 0.5) * 1.5, 0.7 + Math.random() * 0.4, 0.06 + Math.random() * 0.06, 0xa8d8e8, -9.8, 0.3);
    }
  }

  update(dt) {
    this.lit.update(dt);
    this.glow.update(dt);
    for (const R of this.rings) {
      if (!R.m.visible) continue;
      R.t += dt;
      const f = R.t / R.life;
      if (f >= 1) { R.m.visible = false; continue; }
      const r = R.r0 + (R.r1 - R.r0) * Math.sqrt(f);
      R.m.scale.set(r, 1, r);
      R.m.material.opacity = (1 - f) * 0.6;
    }
  }
}
