/* Terrain.js - the land and the sea floor.

   heightAt(x, z) is ANALYTIC: it is the sum of the island, lake, channel and
   pad definitions in MapData, so physics can ask it anywhere at any time
   without a mesh existing there. The meshes are just a drawing of it:

     LOD1   10 m cells, built for every chunk at load (cheap, far view)
     LOD0   2.5 m cells, streamed in around the camera on a time budget

   Every triangle takes ONE colour, sampled at its centroid, so the ground
   breaks into flat carved facets like the rest of the art. Chunks carry a
   3 m skirt on every edge so the seam between a detailed and a coarse
   chunk is a wall of ground, never a crack you can see the sky through. */

import * as THREE from '../../lib/three.module.js?v=1790193571';
import { Noise2D } from '../core/Noise.js?v=1790193571';
import { smoothstep, clamp, lerp, hash3 } from '../core/Util.js?v=1790193571';
import { hexToLinear, mixHex } from '../art/Geo.js?v=1790193571';
import { WORLD, ISLANDS, LAKES, PADS, CHANNELS, PATHS, regionWeights } from './MapData.js?v=1790193571';

const N = new Noise2D(WORLD.seed);
const N2 = new Noise2D(WORLD.seed + 101);
const N3 = new Noise2D(WORLD.seed + 333);

/* ---------------- spatial index of islands ---------------- */
const GRID = 160;
const islandGrid = new Map();
for (const isl of ISLANDS) {
  isl.reach = isl.r * 1.3 + (isl.h + 40) / isl.slope;
  isl.reach = Math.min(isl.reach, isl.r + 420);
  isl.seed = (hash3(isl.x | 0, isl.z | 0, 7) * 1000) | 0;
  const x0 = Math.floor((isl.x - isl.reach) / GRID), x1 = Math.floor((isl.x + isl.reach) / GRID);
  const z0 = Math.floor((isl.z - isl.reach) / GRID), z1 = Math.floor((isl.z + isl.reach) / GRID);
  for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
    const k = gx + ',' + gz;
    if (!islandGrid.has(k)) islandGrid.set(k, []);
    islandGrid.get(k).push(isl);
  }
}

function seabed(x, z) {
  let b = WORLD.seaFloor + 7 * N.fbm(x * 0.004, z * 0.004, 3);
  const db = Math.hypot(x + 680, z - 820);
  b -= 150 * (1 - smoothstep(60, 400, db));
  b -= 28 * smoothstep(-380, -900, x);
  return b;
}

function islandH(isl, x, z) {
  const dx = x - isl.x, dz = z - isl.z;
  const dist = Math.hypot(dx, dz);
  if (dist > isl.reach) return -1e9;
  const w = 1 + isl.warp * N2.fbm(x * isl.wf + isl.seed, z * isl.wf - isl.seed * 0.7, 3) * 1.4;
  const R = isl.r * w;
  if (dist < R) {
    const t = 1 - dist / R;
    const core = Math.pow(smoothstep(0, 1, t / isl.rise), isl.shape);
    let h = 0.9 + (isl.h - 0.9) * core;
    h += isl.hill * smoothstep(0, 0.35, t) * N.fbm(x * 0.013 + isl.seed, z * 0.013, 4);
    if (isl.ridge) h += isl.ridge * smoothstep(0.15, 0.7, t) * (N3.ridged(x * 0.0065, z * 0.0065, 4) - 0.25);
    return h;
  }
  return 0.9 - (dist - R) * isl.slope;
}

function distSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

/** Raw terrain height, ignoring ice. */
export function heightAt(x, z) {
  let h = seabed(x, z);
  const cell = islandGrid.get(Math.floor(x / GRID) + ',' + Math.floor(z / GRID));
  if (cell) for (const isl of cell) { const v = islandH(isl, x, z); if (v > h) h = v; }

  for (const L of LAKES) {
    const dist = Math.hypot(x - L.x, z - L.z);
    if (dist > L.r * 2.4) continue;
    const d = dist / (L.r * (1 + 0.12 * N2.noise(x * 0.03, z * 0.03)));
    // the bank rises gently, so a lake in the mountains sits in a valley, not a pit
    const target = d < 1 ? -L.depth * (1 - d * d) - 0.5 : -0.5 + Math.pow(d - 1, 1.5) * (L.ice ? 34 : 14);
    if (target < h) h = target;
  }
  for (const C of CHANNELS) {
    const d = distSeg(x, z, C.a[0], C.a[1], C.b[0], C.b[1]);
    const hw = C.w / 2;
    if (d > hw + 8) continue;
    const t = d / hw;
    const target = lerp(C.depth, 1.2, smoothstep(0.55, 1.5, t));
    if (target < h) h = target;
  }
  for (const P of PADS) {
    const d = Math.hypot(x - P.x, z - P.z);
    if (d > P.r) continue;
    const f = 1 - smoothstep(P.r * 0.6, P.r, d);
    h = lerp(h, P.y, f);
  }
  return h;
}

/* ---------------- ice ---------------- */
export function iceAt(x, z) {
  for (const L of LAKES) {
    if (!L.ice) continue;
    if (Math.hypot(x - L.x, z - L.z) < L.r * 1.25) return true;
  }
  for (const C of CHANNELS) {
    if (!C.ice) continue;
    if (distSeg(x, z, C.a[0], C.a[1], C.b[0], C.b[1]) < C.w * 0.62) return true;
  }
  return false;
}
export const ICE_Y = 0.14;

/** Walkable ground height: terrain, or the ice sheet if higher. */
export function groundAt(x, z) {
  const h = heightAt(x, z);
  if (h < ICE_Y && iceAt(x, z)) return ICE_Y;
  return h;
}

/** True if a boat can float here (water, not ice, deep enough). */
export function isOpenWater(x, z, draft = 0.4) {
  if (iceAt(x, z) && heightAt(x, z) < ICE_Y) return false;
  return heightAt(x, z) < -draft;
}

/* ---------------- fields shared with the scatter ---------------- */
export function forestAt(x, z) {
  return clamp(N3.fbm(x * 0.006 + 40, z * 0.006 - 30, 3) * 0.9 + 0.55, 0, 1);
}

const pathSegs = [];
for (const p of PATHS) for (let i = 0; i < p.pts.length - 1; i++) pathSegs.push({ a: p.pts[i], b: p.pts[i + 1], w: p.w });
/** 0..1, 1 on a path's centreline. */
export function pathAt(x, z) {
  let best = 0;
  for (const s of pathSegs) {
    const d = distSeg(x, z, s.a[0], s.a[1], s.b[0], s.b[1]);
    const wob = s.w * (1 + 0.25 * N.noise(x * 0.08, z * 0.08));
    if (d < wob) best = Math.max(best, 1 - smoothstep(wob * 0.55, wob, d));
  }
  return best;
}
export function padAt(x, z) {
  let best = 0;
  for (const P of PADS) {
    const d = Math.hypot(x - P.x, z - P.z);
    if (d < P.r) best = Math.max(best, 1 - smoothstep(P.r * 0.55, P.r * 0.95, d));
  }
  return best;
}
export function nearLake(x, z) {
  for (const L of LAKES) if (Math.hypot(x - L.x, z - L.z) < L.r * 1.35) return L;
  return null;
}

/* ---------------- colour ---------------- */
export function colourAt(x, z, h, ny) {
  const rw = regionWeights(x, z);
  const v = N.noise(x * 0.05, z * 0.05) * 0.5 + N2.noise(x * 0.15, z * 0.15) * 0.25;
  const inLake = nearLake(x, z);
  let c;
  if (h < -0.35) {
    // under water
    const deep = smoothstep(-0.3, -14, h);
    const sand = rw.tropic > 0.5 ? 0xe8d49c : rw.black > 0.5 ? 0x2e333a : rw.reach > 0.5 ? 0x4e5256 : rw.frost > 0.5 ? 0x8d9aa0 : (inLake ? 0x7a6d4c : 0xc8b384);
    c = mixHex(sand, rw.black > 0.5 || rw.reach > 0.5 ? 0x14181e : 0x3f5a58, deep * 0.85);
    return c;
  }
  const rock = ny < 0.72;
  if (rw.frost > 0.5) {
    if (rock && !(h > 26 && ny > 0.45)) c = mixHex(0x7c848c, 0x5c6168, 0.5 + v);
    else if (h < 1.3 && !inLake) c = 0xb9bdb6;
    else c = mixHex(0xf1f6f8, 0xdde8ee, 0.5 + v);
  } else if (rw.black > 0.5) {
    c = rock ? mixHex(0x2a2d33, 0x1f2226, 0.5 + v) : mixHex(0x353b3a, 0x2b3530, 0.5 + v);
    if (h < 1.2) c = 0x3a3c40;
  } else if (rw.reach > 0.5) {
    // Vigil's End: wet grey stone, dark shingle, tired grey-green turf
    if (rock) c = mixHex(0x5f646a, 0x464a50, 0.5 + v);
    else if (h < 1.7) c = mixHex(0x545659, 0x67686a, 0.5 + v);
    else c = mixHex(0x707862, 0x5b6352, 0.5 + v);
  } else if (rw.tropic > 0.5) {
    if (rock) c = mixHex(0x8a7b66, 0x6f604e, 0.5 + v);
    else if (h < 1.9) c = mixHex(0xf3e0a8, 0xe7cf8e, 0.5 + v);
    else c = mixHex(0x86b845, 0x6ea33a, 0.5 + v);
  } else {
    if (rock) c = mixHex(0x7a7a72, 0x5f625c, 0.5 + v);
    else if (h < 1.25 && !inLake) c = mixHex(0xdcc893, 0xcdb682, 0.5 + v);
    else if (inLake && h < 0.9) c = 0x6a6040;
    else {
      const f = forestAt(x, z);
      const grass = mixHex(0x78a843, 0x5f9236, 0.5 + v);
      c = mixHex(grass, 0x3f6d2b, smoothstep(0.45, 0.8, f) * 0.75);
    }
  }
  if (!rock && h > 0.6) {
    const pa = pathAt(x, z);
    if (pa > 0) c = mixHex(c, rw.frost > 0.5 ? 0xc6c0b0 : rw.tropic > 0.5 ? 0xd8c08a : rw.reach > 0.5 ? 0x8a8676 : 0xb59566, pa * 0.95);
    const pd = padAt(x, z);
    if (pd > 0 && rw.frost < 0.5) c = mixHex(c, rw.tropic > 0.5 ? 0xe5d19c : 0x9f9a60, pd * 0.35);
  }
  return c;
}

/* ---------------- meshes ---------------- */
export const CHUNK = 80;
const HALF = WORLD.half + 200;

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.chunks = new Map();   // key -> {cx, cz, lod1, lod0, building}
    this.queue = [];
    this._scan();
  }

  _scan() {
    // find chunks that contain any ground shallower than -10 m
    for (let cx = -Math.ceil(HALF / CHUNK); cx < Math.ceil(HALF / CHUNK); cx++) {
      for (let cz = -Math.ceil(HALF / CHUNK); cz < Math.ceil(HALF / CHUNK); cz++) {
        let max = -1e9;
        for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
          const h = heightAt(cx * CHUNK + i * CHUNK / 4, cz * CHUNK + j * CHUNK / 4);
          if (h > max) max = h;
        }
        if (max < -11) continue;
        this.chunks.set(cx + ',' + cz, { cx, cz, lod1: null, lod0: null, max });
      }
    }
  }

  /** Build every coarse chunk now (called under the loading screen). */
  buildCoarse() {
    for (const ch of this.chunks.values()) {
      ch.lod1 = this._mesh(ch.cx, ch.cz, 8, false);
      this.group.add(ch.lod1);
    }
  }

  _mesh(cx, cz, cells, receive) {
    const size = CHUNK / cells;
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const n = cells + 1;
    const H = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = heightAt(x0 + i * size, z0 + j * size);
    const P = [], C = [];
    const put = (ax, ay, az, bx, by, bz, qx, qy, qz, col) => {
      P.push(ax, ay, az, bx, by, bz, qx, qy, qz);
      C.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
    };
    const faceCol = (ax, ay, az, bx, by, bz, qx, qy, qz) => {
      // normal (for slope), then centroid colour
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = qx - ax, vy = qy - ay, vz = qz - az;
      let nx = uy * vz - uz * vy, nyy = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, nyy, nz) || 1;
      nyy = Math.abs(nyy / l);
      const mx = (ax + bx + qx) / 3, mz = (az + bz + qz) / 3, my = (ay + by + qy) / 3;
      const hex = colourAt(mx, mz, my, nyy);
      const lin = hexToLinear(hex);
      // tiny per-face light jitter so flat fields still read as facets
      const j = 1 + (hash3(Math.floor(mx * 3), Math.floor(mz * 3), 11) - 0.5) * 0.06;
      return [lin[0] * j, lin[1] * j, lin[2] * j];
    };
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
      const ax = x0 + i * size, az = z0 + j * size, bx = ax + size, bz = az + size;
      const h00 = H[j * n + i], h10 = H[j * n + i + 1], h01 = H[(j + 1) * n + i], h11 = H[(j + 1) * n + i + 1];
      if (Math.max(h00, h10, h01, h11) < -13 && cells > 10) continue;
      // alternate the diagonal so there is no visible grid grain
      if ((i + j) % 2 === 0) {
        put(ax, h00, az, ax, h01, bz, bx, h11, bz, faceCol(ax, h00, az, ax, h01, bz, bx, h11, bz));
        put(ax, h00, az, bx, h11, bz, bx, h10, az, faceCol(ax, h00, az, bx, h11, bz, bx, h10, az));
      } else {
        put(ax, h00, az, ax, h01, bz, bx, h10, az, faceCol(ax, h00, az, ax, h01, bz, bx, h10, az));
        put(bx, h10, az, ax, h01, bz, bx, h11, bz, faceCol(bx, h10, az, ax, h01, bz, bx, h11, bz));
      }
    }
    // skirts
    const skirt = 3;
    const sk = (ax, ay, az, bx, by, bz) => {
      const col = hexToLinear(ay < -0.3 ? 0x3f5a58 : 0x5a5a4a);
      put(ax, ay, az, bx, by, bz, bx, by - skirt, bz, col);
      put(ax, ay, az, bx, by - skirt, bz, ax, ay - skirt, az, col);
      put(ax, ay, az, bx, by - skirt, bz, bx, by, bz, col);
      put(ax, ay, az, ax, ay - skirt, az, bx, by - skirt, bz, col);
    };
    for (let i = 0; i < cells; i++) {
      sk(x0 + i * size, H[i], z0, x0 + (i + 1) * size, H[i + 1], z0);
      sk(x0 + i * size, H[cells * n + i], z0 + CHUNK, x0 + (i + 1) * size, H[cells * n + i + 1], z0 + CHUNK);
      sk(x0, H[i * n], z0 + i * size, x0, H[(i + 1) * n], z0 + (i + 1) * size);
      sk(x0 + CHUNK, H[i * n + cells], z0 + i * size, x0 + CHUNK, H[(i + 1) * n + cells], z0 + (i + 1) * size);
    }
    const g = new THREE.BufferGeometry();
    const PA = new Float32Array(P);
    g.setAttribute('position', new THREE.BufferAttribute(PA, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.mat);
    m.receiveShadow = receive;
    m.castShadow = false;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    return m;
  }

  /** Stream detailed chunks around (x, z) within a time budget in ms. */
  update(x, z, budgetMs = 6) {
    const NEAR = 250, FAR = 380;
    const t0 = performance.now();
    const want = [];
    for (const ch of this.chunks.values()) {
      const d = Math.hypot(ch.cx * CHUNK + CHUNK / 2 - x, ch.cz * CHUNK + CHUNK / 2 - z);
      ch.dist = d;
      if (d < NEAR && !ch.lod0) want.push(ch);
      if (d > FAR && ch.lod0) {
        this.group.remove(ch.lod0);
        ch.lod0.geometry.dispose();
        ch.lod0 = null;
      }
      if (ch.lod0) { ch.lod0.visible = d < NEAR + 40; if (ch.lod1) ch.lod1.visible = !ch.lod0.visible; }
      else if (ch.lod1) ch.lod1.visible = true;
    }
    want.sort((a, b) => a.dist - b.dist);
    for (const ch of want) {
      if (performance.now() - t0 > budgetMs) break;
      ch.lod0 = this._mesh(ch.cx, ch.cz, 32, true);
      this.group.add(ch.lod0);
      if (ch.lod1) ch.lod1.visible = false;
    }
    return want.length;
  }

  /** Build all near chunks immediately (loading screen). */
  prebuild(x, z) { this.update(x, z, 1e9); }
}

/* ---------------- ice sheet mesh ---------------- */
export function buildIce() {
  const P = [], C = [];
  const col = h => hexToLinear(h);
  const add = (a, b, c, hex) => { P.push(...a, ...b, ...c); const k = col(hex); C.push(...k, ...k, ...k); };
  for (const L of LAKES) {
    if (!L.ice) continue;
    const R = L.r * 1.25, seg = 44, rings = 7;
    const pts = [];
    for (let r = 0; r <= rings; r++) {
      const row = [];
      const rad = (r / rings) * R;
      const cnt = r === 0 ? 1 : seg;
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2 + r * 0.3;
        const jit = r === 0 || r === rings ? 0 : (hash3(r, i, 5) - 0.5) * (R / rings) * 0.7;
        const x = L.x + Math.cos(a) * (rad + jit), z = L.z + Math.sin(a) * (rad + jit);
        row.push([x, ICE_Y + (hash3(r, i, 9) - 0.5) * 0.05, z]);
      }
      pts.push(row);
    }
    for (let r = 0; r < rings; r++) {
      const A = pts[r], B = pts[r + 1];
      for (let i = 0; i < seg; i++) {
        const b0 = B[i], b1 = B[(i + 1) % seg];
        const a0 = A[r === 0 ? 0 : i], a1 = A[r === 0 ? 0 : (i + 1) % seg];
        const tone = () => (hash3(r, i, P.length) < 0.18 ? 0xb7d4e0 : hash3(i, r, 3) < 0.5 ? 0xdcecf3 : 0xcfe4ee);
        add(a0, b1, b0, tone());
        if (r > 0) add(a0, a1, b1, tone());
      }
    }
  }
  for (const Ch of CHANNELS) {
    if (!Ch.ice) continue;
    const [ax, az] = Ch.a, [bx, bz] = Ch.b;
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    const px = -uz * Ch.w * 0.62, pz = ux * Ch.w * 0.62;
    const steps = 10;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const c0x = ax + (bx - ax) * t0, c0z = az + (bz - az) * t0, c1x = ax + (bx - ax) * t1, c1z = az + (bz - az) * t1;
      const p = [[c0x - px, ICE_Y, c0z - pz], [c0x + px, ICE_Y, c0z + pz], [c1x + px, ICE_Y, c1z + pz], [c1x - px, ICE_Y, c1z - pz]];
      add(p[0], p[2], p[1], s % 2 ? 0xd4e7ef : 0xc6dde8);
      add(p[0], p[3], p[2], s % 3 ? 0xdcecf3 : 0xb9d3df);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3));
  g.computeVertexNormals();
  // triangles were emitted with mixed winding; force every normal up
  const nrm = g.attributes.normal;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  m.name = 'ice';
  return m;
}
