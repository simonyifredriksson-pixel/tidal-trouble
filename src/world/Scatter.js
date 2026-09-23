/* Scatter.js - plants every tree, bush, rock and log in the world.

   Instanced by (variant, 200 m block): one InstancedMesh per variant per
   block means frustum culling and the distance cut-off work per block
   instead of drawing every pine on the map for every shadow pass.

   Rules are per region and read the same fields the terrain colours with,
   so the dark forest floor is under the dense forest and the paths are
   genuinely clear. Blockers (building footprints) are passed in from the
   settlement so nothing grows through a cabin. */

import * as THREE from '../../lib/three.module.js?v=1790193571';
import { heightAt, forestAt, pathAt, padAt, nearLake, iceAt } from './Terrain.js?v=1790193571';
import { regionWeights, WORLD } from './MapData.js?v=1790193571';
import { hash3, smoothstep, rng } from '../core/Util.js?v=1790193571';
import { MAT } from '../art/Materials.js?v=1790193571';
import * as F from '../art/FloraArt.js?v=1790193571';

const BLOCK = 200;

function makeVariants() {
  const V = {};
  const add = (key, geos, mat, shadow = true) => { V[key] = { geos, mat, shadow }; };
  add('pine', [1, 2, 3, 4].map(s => F.buildPine(100 + s)), MAT.foliage);
  add('snowpine', [1, 2, 3].map(s => F.buildPine(200 + s, true)), MAT.foliage);
  add('broad', [1, 2, 3].map(s => F.buildBroadleaf(300 + s)), MAT.foliage);
  add('birch', [1, 2].map(s => F.buildBroadleaf(400 + s, true)), MAT.foliage);
  add('palm', [1, 2, 3].map(s => F.buildPalm(500 + s)), MAT.foliage);
  add('dead', [1, 2].map(s => F.buildDead(600 + s)), MAT.foliage);
  add('deaddark', [1, 2].map(s => F.buildDead(650 + s, true)), MAT.foliage);
  add('bush', [1, 2, 3].map(s => F.buildBush(700 + s)), MAT.foliage);
  add('tbush', [1, 2].map(s => F.buildBush(750 + s, 0x3f9a3a)), MAT.foliage);
  add('fern', [1, 2].map(s => F.buildFern(800 + s)), MAT.foliage, false);
  add('rock', [1, 2, 3, 4].map(s => F.buildRock(900 + s)), MAT.solid);
  add('snowrock', [1, 2].map(s => F.buildRock(950 + s, 0x8a939a, false)), MAT.solid);
  add('sandrock', [1, 2].map(s => F.buildRock(970 + s, 0x9a8a70, false)), MAT.solid);
  add('spire', [1, 2, 3].map(s => F.buildSpire(1000 + s)), MAT.solid);
  add('log', [1, 2].map(s => F.buildLog(1100 + s)), MAT.solid);
  add('mosslog', [1].map(s => F.buildLog(1150 + s, false)), MAT.solid);
  add('stump', [1].map(s => F.buildStump(1200 + s)), MAT.solid);
  add('reeds', [1, 2].map(s => F.buildReeds(1300 + s)), MAT.foliage, false);
  add('flowers', [1, 2, 3].map(s => F.buildFlowers(1400 + s)), MAT.foliage, false);
  add('coral', [1, 2, 3].map(s => F.buildCoral(1500 + s)), MAT.solid, false);
  add('ice', [1, 2].map(s => F.buildIceChunk(1600 + s)), MAT.solid);
  return V;
}

export class Scatter {
  constructor(scene, colliders, blockers, terrain) {
    this.terrain = terrain;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'flora';
    scene.add(this.group);
    this.V = makeVariants();
    this.blocks = new Map();
    this.colliders = colliders;
    this.blockers = blockers;       // [{x,z,r}]
    this.count = 0;
    this._plant();
  }

  _land(x, z, min) {
    const ch = this.terrain.chunks.get(Math.floor(x / 80) + ',' + Math.floor(z / 80));
    return !!ch && ch.max > min;
  }

  _blocked(x, z, pad) {
    for (const b of this.blockers) {
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < b.r + pad) return true;
    }
    return false;
  }

  _put(key, x, y, z, s, rotY, tilt = 0, colJit = 0.08, seed = 0) {
    const bk = Math.floor(x / BLOCK) + ',' + Math.floor(z / BLOCK);
    const V = this.V[key];
    const vi = Math.floor(hash3(x * 7 | 0, z * 7 | 0, seed + 3) * V.geos.length) % V.geos.length;
    const k = key + ':' + vi + '@' + bk;
    if (!this.blocks.has(k)) this.blocks.set(k, { key, vi, list: [], cx: (Math.floor(x / BLOCK) + 0.5) * BLOCK, cz: (Math.floor(z / BLOCK) + 0.5) * BLOCK });
    const j = 1 + (hash3(x | 0, z | 0, 91) - 0.5) * colJit * 2;
    this.blocks.get(k).list.push([x, y, z, s, rotY, tilt, j]);
    this.count++;
  }

  _plant() {
    const H = WORLD.half;
    const C = this.colliders;
    // --- trees: 4.5 m jittered grid ---
    const S = 4.5;
    for (let gx = -H; gx < H; gx += S) for (let gz = -H; gz < H; gz += S) {
      if (!this._land(gx, gz, 0.5)) continue;
      const r1 = hash3(gx * 10 | 0, gz * 10 | 0, 1);
      const x = gx + hash3(gx | 0, gz | 0, 2) * S, z = gz + hash3(gx | 0, gz | 0, 3) * S;
      const h = heightAt(x, z);
      if (h < 0.7) continue;
      const slope = Math.abs(heightAt(x + 1.5, z) - h) + Math.abs(heightAt(x, z + 1.5) - h);
      if (slope > 1.6) continue;
      if (pathAt(x, z) > 0.05 || padAt(x, z) > 0.05) continue;
      if (iceAt(x, z)) continue;
      if (this._blocked(x, z, 2.5)) continue;
      const w = regionWeights(x, z);
      const f = forestAt(x, z);
      const rot = hash3(x | 0, z | 0, 4) * 6.283;
      const sc = 0.75 + hash3(x | 0, z | 0, 5) * 0.55;
      let key = null, p = 0;
      if (w.frost > 0.5) {
        if (h < 48) { p = Math.pow(f, 1.2) * 0.62 * (1 - smoothstep(30, 48, h)); key = 'snowpine'; }
      } else if (w.black > 0.5) {
        p = 0.1; key = hash3(x | 0, z | 0, 6) < 0.6 ? 'deaddark' : 'spire';
      } else if (w.reach > 0.5) {
        p = 0.06; key = 'dead';
      } else if (w.tropic > 0.5) {
        if (h < 5) { p = 0.16; key = 'palm'; }
        else { p = 0.2; key = hash3(x | 0, z | 0, 6) < 0.5 ? 'palm' : 'broad'; }
      } else if (w.home > 0.4) {
        p = Math.pow(f, 1.5) * 0.95;
        if (h < 1.6) p *= 0.25;
        const q = hash3(x | 0, z | 0, 6);
        key = q < 0.66 ? 'pine' : q < 0.86 ? 'broad' : q < 0.95 ? 'birch' : 'dead';
      } else {
        p = 0.05; key = 'pine';
      }
      if (!key || r1 > p) continue;
      this._put(key, x, h - 0.2, z, sc, rot, 0, 0.1);
      if (key !== 'spire') C.circle(x, z, 0.45 * sc, h - 1, h + 12, 'tree');
      else C.circle(x, z, 1.6 * sc, h - 2, h + 10, 'rock');
    }
    // --- undergrowth, rocks, logs: 3 m grid ---
    const U = 3;
    for (let gx = -H; gx < H; gx += U) for (let gz = -H; gz < H; gz += U) {
      const x = gx + hash3(gx | 0, gz | 0, 12) * U, z = gz + hash3(gx | 0, gz | 0, 13) * U;
      const r1 = hash3(gx * 3 | 0, gz * 3 | 0, 14);
      if (r1 > 0.34) continue;       // cheap early out: most cells are empty
      if (!this._land(gx, gz, -8)) continue;
      const h = heightAt(x, z);
      if (h < -8 || h > 70) continue;
      const w = regionWeights(x, z);
      const rot = hash3(x | 0, z | 0, 15) * 6.283;
      const q = hash3(x * 5 | 0, z * 5 | 0, 16);
      const lake = nearLake(x, z);
      const onPath = pathAt(x, z) > 0.1;
      const pad = padAt(x, z) > 0.2;
      // reeds at lake margins
      if (lake && !lake.ice && h > -0.7 && h < 0.9) {
        if (q < 0.5) this._put('reeds', x, h, z, 0.9 + q, rot);
        continue;
      }
      // coral under tropical water
      if (h < -0.8) {
        if (w.tropic > 0.5 && h > -8 && h < -3 && q < 0.25) this._put('coral', x, h, z, 0.5 + q * 1.2, rot);
        continue;
      }
      if (h < 0.6 || onPath || iceAt(x, z)) continue;
      if (this._blocked(x, z, 1.2)) continue;
      const f = forestAt(x, z);
      const slope = Math.abs(heightAt(x + 1.5, z) - h) + Math.abs(heightAt(x, z + 1.5) - h);
      if (q < 0.05 && !pad) {
        // rocks
        const key = w.frost > 0.5 ? 'snowrock' : w.black > 0.5 ? 'spire' : w.tropic > 0.5 ? 'sandrock' : 'rock';
        const s = 0.6 + hash3(x | 0, z | 0, 17) * 1.6 + (slope > 1 ? 0.8 : 0);
        this._put(key, x, h - 0.3, z, s, rot);
        if (s > 0.9) C.circle(x, z, 1.0 * s, h - 3, h + 1.2 * s, 'rock');
        continue;
      }
      if (h < 1.6 && q < 0.08 && w.home + w.tropic > 0.5) { this._put('log', x, h - 0.05, z, 1, rot); continue; }
      if (w.frost > 0.5) { if (h < 1.5 && q < 0.09) this._put('ice', x, h - 0.2, z, 0.8 + q * 4, rot); continue; }
      if (w.black > 0.5) continue;
      if (w.reach > 0.5) { if (q < 0.1 && !pad) this._put('bush', x, h - 0.15, z, 0.5 + q * 3, rot, 0, 0.3); continue; }
      if (pad && q > 0.12) continue;
      if (w.tropic > 0.5) { if (q < 0.18) this._put('tbush', x, h - 0.1, z, 0.9 + q * 2, rot); continue; }
      if (w.home < 0.4) continue;
      if (f > 0.55) {
        if (q < 0.17) this._put('fern', x, h, z, 0.9 + q * 2, rot);
        else if (q < 0.27) this._put('bush', x, h - 0.1, z, 0.8 + q, rot);
        else if (q < 0.29) this._put('stump', x, h - 0.05, z, 1, rot);
        else if (q < 0.31) this._put('mosslog', x, h - 0.05, z, 1, rot);
      } else {
        if (q < 0.12) this._put('flowers', x, h, z, 1, rot);
        else if (q < 0.2) this._put('bush', x, h - 0.1, z, 0.7 + q, rot);
      }
    }
    this._buildMeshes();
  }

  _buildMeshes() {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const col = new THREE.Color();
    this.meshes = [];
    for (const blk of this.blocks.values()) {
      const V = this.V[blk.key];
      const geo = V.geos[blk.vi];
      const im = new THREE.InstancedMesh(geo, V.mat, blk.list.length);
      blk.list.forEach((it, i) => {
        e.set(it[5], it[4], 0);
        q.setFromEuler(e);
        m4.compose(v.set(it[0], it[1], it[2]), q, s.set(it[3], it[3], it[3]));
        im.setMatrixAt(i, m4);
        col.setRGB(it[6], it[6], it[6]);
        im.setColorAt(i, col);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = V.shadow;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      im.userData.blk = blk;
      im.userData.far = V.shadow ? 900 : 260;
      this.group.add(im);
      this.meshes.push(im);
    }
  }

  update(cam) {
    for (const m of this.meshes) {
      const b = m.userData.blk;
      const d = Math.hypot(b.cx - cam.x, b.cz - cam.z) - BLOCK * 0.7;
      m.visible = d < m.userData.far;
    }
  }
}

/* ---------------- dynamic grass near the camera ---------------- */
export class Grass {
  constructor(scene, blockers = []) {
    this.blockers = blockers;
    this.geos = [0, 1, 2, 3].map(p => [F.buildGrassTuft(2000 + p * 3, p), F.buildGrassTuft(2001 + p * 3, p)]);
    this.meshes = [];
    this.MAX = 5200;
    for (let p = 0; p < 4; p++) for (let v = 0; v < 2; v++) {
      const im = new THREE.InstancedMesh(this.geos[p][v], MAT.grass, this.MAX);
      im.count = 0;
      im.castShadow = false;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.name = 'grass';
      scene.add(im);
      this.meshes.push(im);
    }
    this.cx = 1e9; this.cz = 1e9;
    this.R = 70;
    this.density = 1;
  }

  update(cam, force = false) {
    if (!force && Math.hypot(cam.x - this.cx, cam.z - this.cz) < 14) return;
    this.cx = cam.x; this.cz = cam.z;
    const S = 1.9 / Math.sqrt(this.density), R = this.R;
    const counts = new Array(this.meshes.length).fill(0);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const x0 = Math.floor((cam.x - R) / S) * S, z0 = Math.floor((cam.z - R) / S) * S;
    for (let gx = x0; gx < cam.x + R; gx += S) for (let gz = z0; gz < cam.z + R; gz += S) {
      const ix = Math.round(gx / S), iz = Math.round(gz / S);
      const x = gx + hash3(ix, iz, 21) * S, z = gz + hash3(ix, iz, 22) * S;
      if (Math.hypot(x - cam.x, z - cam.z) > R) continue;
      const h = heightAt(x, z);
      if (h < 1.1 || h > 40) continue;
      const w = regionWeights(x, z);
      if (w.frost > 0.5 || w.black > 0.5 || w.reach > 0.5) continue;
      const pa = pathAt(x, z);
      if (pa > 0.25) continue;
      const pd = padAt(x, z);
      const f = forestAt(x, z);
      let p = w.tropic > 0.5 ? 0.35 : 0.75 - f * 0.25;
      if (pd > 0.2) p *= 0.3;
      if (hash3(ix, iz, 23) > p) continue;
      const slope = Math.abs(heightAt(x + 1, z) - h);
      if (slope > 0.8) continue;
      let inside = false;
      for (const bl of this.blockers) if (Math.abs(x - bl.x) < bl.r && Math.abs(z - bl.z) < bl.r && Math.hypot(x - bl.x, z - bl.z) < bl.r * 0.75) { inside = true; break; }
      if (inside) continue;
      let pal = w.tropic > 0.5 ? 2 : f > 0.6 ? 1 : hash3(ix, iz, 24) < 0.5 ? 0 : 3;
      const vi = hash3(ix, iz, 25) < 0.5 ? 0 : 1;
      const mi = pal * 2 + vi;
      if (counts[mi] >= this.MAX) continue;
      const sc = 0.8 + hash3(ix, iz, 26) * 0.9;
      e.set(0, hash3(ix, iz, 27) * 6.28, 0); q.setFromEuler(e);
      m4.compose(v.set(x, h - 0.05, z), q, s.set(sc, sc * (0.8 + hash3(ix, iz, 28) * 0.6), sc));
      this.meshes[mi].setMatrixAt(counts[mi]++, m4);
    }
    this.meshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
  }
}
