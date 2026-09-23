/* Geo.js - the low-poly geometry toolkit. There are no model files in
   Hooked: every cabin, rod, fish, boat and leviathan is written as
   triangles by code into a MeshBuilder.

   THE LOOK is flat-shaded facets with per-vertex colour. The builder writes
   unwelded triangles, so every face gets its own normal and the lighting
   breaks across the surface in hard planes - the faceted, carved look of the
   reference art - without a single texture.

   COLOUR SPACE: three.js treats a `color` attribute as linear. Palette values
   are sRGB hex, so every colour is converted on the way in. Skip it and every
   mid-tone renders three times too bright and the world looks like pastel.

   WINDING: convex primitives (box, cylinder, sphere, lathe) orient every
   triangle away from their own centre, so none of them can come out inside
   out. Hand-built quads take an explicit `out` hint for the same reason. */

import * as THREE from '../../lib/three.module.js?v=1790192871';
import { TAU, clamp } from '../core/Util.js?v=1790192871';

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export const hexToLinear = hex => [LIN[(hex >> 16) & 255], LIN[(hex >> 8) & 255], LIN[hex & 255]];

/** Mix two sRGB hex colours in sRGB (how a painter mixes), return hex. */
export function mixHex(a, b, t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
export function shadeHex(a, f) {
  const r = clamp(Math.round(((a >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((a >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((a & 255) * f), 0, 255);
  return (r << 16) | (g << 8) | b;
}
export const hexCss = h => '#' + (h >>> 0).toString(16).padStart(6, '0');

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();

export class MeshBuilder {
  constructor(seedRnd = null) {
    this.P = [];   // positions, 9 per triangle
    this.C = [];   // colours
    this.S = [];   // sway per vertex
    this.col = [1, 1, 1];
    this.sway = 0;
    this.stack = [new THREE.Matrix4()];
    this.rnd = seedRnd || Math.random;
  }

  get tris() { return this.P.length / 9; }
  get M() { return this.stack[this.stack.length - 1]; }

  /* ---------------- state ---------------- */
  color(hex, jitter = 0) {
    let [r, g, b] = hexToLinear(hex);
    if (jitter > 0) {
      const f = this.rnd;
      const l = 1 + (f() - 0.5) * jitter * 2;
      r = clamp(r * l * (1 + (f() - 0.5) * jitter * 0.6), 0, 1);
      g = clamp(g * l * (1 + (f() - 0.5) * jitter * 0.6), 0, 1);
      b = clamp(b * l * (1 + (f() - 0.5) * jitter * 0.6), 0, 1);
    }
    this.col = [r, g, b];
    return this;
  }
  setSway(s) { this.sway = s; return this; }

  push(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.stack.push(this.M.clone().multiply(_m));
    return this;
  }
  pushMatrix(m) { this.stack.push(this.M.clone().multiply(m)); return this; }
  pop() { if (this.stack.length > 1) this.stack.pop(); return this; }

  /* ---------------- raw triangles ---------------- */
  _xf(p) {
    const e = this.M.elements, x = p[0], y = p[1], z = p[2];
    return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
  }

  /** A triangle in LOCAL coords (transformed by the stack). cols optional per-vertex [r,g,b] linear. */
  tri(a, b, c, cols = null, sw = null) {
    const A = this._xf(a), B = this._xf(b), Cc = this._xf(c);
    this.P.push(A[0], A[1], A[2], B[0], B[1], B[2], Cc[0], Cc[1], Cc[2]);
    const k = this.col;
    if (cols) for (let i = 0; i < 3; i++) this.C.push(cols[i][0], cols[i][1], cols[i][2]);
    else this.C.push(k[0], k[1], k[2], k[0], k[1], k[2], k[0], k[1], k[2]);
    const s = this.sway;
    if (sw) this.S.push(sw[0], sw[1], sw[2]); else this.S.push(s, s, s);
    return this;
  }

  /** Triangle oriented so its front faces `out` (a local direction) or away from point `ctr`. */
  triO(a, b, c, out = null, ctr = null) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    let d;
    if (out) d = nx * out[0] + ny * out[1] + nz * out[2];
    else if (ctr) {
      const mx = (a[0] + b[0] + c[0]) / 3 - ctr[0], my = (a[1] + b[1] + c[1]) / 3 - ctr[1], mz = (a[2] + b[2] + c[2]) / 3 - ctr[2];
      d = nx * mx + ny * my + nz * mz;
    } else d = 1;
    return d >= 0 ? this.tri(a, b, c) : this.tri(a, c, b);
  }

  quad(a, b, c, d, out = null, ctr = null) {
    this.triO(a, b, c, out, ctr);
    this.triO(a, c, d, out, ctr);
    return this;
  }

  /* ---------------- primitives ---------------- */
  /** Axis-aligned box centred at (x,y,z) in local space, size w,h,d. faceCols: {top,bottom,side} hex. */
  box(w, h, d, x = 0, y = 0, z = 0, faceCols = null, jit = 0) {
    const hx = w / 2, hy = h / 2, hz = d / 2;
    const v = [
      [x - hx, y - hy, z - hz], [x + hx, y - hy, z - hz], [x + hx, y + hy, z - hz], [x - hx, y + hy, z - hz],
      [x - hx, y - hy, z + hz], [x + hx, y - hy, z + hz], [x + hx, y + hy, z + hz], [x - hx, y + hy, z + hz],
    ];
    const ctr = [x, y, z];
    const base = this.col;
    const face = (i0, i1, i2, i3, key) => {
      if (faceCols && faceCols[key] !== undefined) this.color(faceCols[key], jit);
      else if (jit) { this.col = base; }
      this.quad(v[i0], v[i1], v[i2], v[i3], null, ctr);
    };
    face(3, 2, 6, 7, 'top');
    face(0, 1, 5, 4, 'bottom');
    face(0, 1, 2, 3, 'side');
    face(4, 5, 6, 7, 'side');
    face(0, 4, 7, 3, 'side');
    face(1, 5, 6, 2, 'side');
    this.col = base;
    return this;
  }

  /** Box between two local points (a beam). width w, depth d. */
  beam(a, b, w, d = w) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return this;
    const dir = new THREE.Vector3(dx / len, dy / len, dz / len);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, 1, 1));
    this.pushMatrix(m); this.box(w, len, d); this.pop();
    return this;
  }

  /** Cylinder / frustum along +Y from y0 to y1. `sides` low for the low-poly look. */
  cyl(rBot, rTop, y0, y1, sides = 6, caps = true, x = 0, z = 0, rot = 0, jitter = 0) {
    const ring = (r, y) => {
      const out = [];
      for (let i = 0; i < sides; i++) {
        const a = rot + (i / sides) * TAU;
        const j = jitter ? 1 + (this.rnd() - 0.5) * jitter : 1;
        out.push([x + Math.cos(a) * r * j, y, z + Math.sin(a) * r * j]);
      }
      return out;
    };
    const A = ring(rBot, y0), B = ring(rTop, y1);
    const cy = (y0 + y1) / 2;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const mid = [x, cy, z];
      // sides orient away from the axis at their own height
      const ctr = [x, (A[i][1] + B[i][1]) / 2, z];
      if (rTop < 1e-5) this.triO(A[i], A[j], B[i], null, ctr);
      else if (rBot < 1e-5) this.triO(A[i], B[j], B[i], null, ctr);
      else this.quad(A[i], A[j], B[j], B[i], null, ctr);
      void mid;
    }
    if (caps) {
      if (rTop > 1e-5) for (let i = 1; i < sides - 1; i++) this.triO(B[0], B[i], B[i + 1], [0, 1, 0]);
      if (rBot > 1e-5) for (let i = 1; i < sides - 1; i++) this.triO(A[0], A[i], A[i + 1], [0, -1, 0]);
    }
    return this;
  }

  cone(r, y0, y1, sides = 6, x = 0, z = 0, rot = 0) { return this.cyl(r, 0, y0, y1, sides, true, x, z, rot); }

  /** Cylinder between two local points. */
  tube(a, b, r0, r1 = r0, sides = 6, caps = true) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(a[0], a[1], a[2]), q, new THREE.Vector3(1, 1, 1));
    this.pushMatrix(m); this.cyl(r0, r1, 0, len, sides, caps); this.pop();
    return this;
  }

  /** Low-poly ellipsoid: lat/long with few segments, optional jitter for a carved look. */
  blob(rx, ry, rz, x = 0, y = 0, z = 0, seg = 6, rings = 4, jitter = 0, topCol = null, botCol = null) {
    const pts = [];
    for (let i = 0; i <= rings; i++) {
      const v = i / rings, phi = v * Math.PI;
      const row = [];
      for (let j = 0; j < seg; j++) {
        const th = (j / seg) * TAU + (i % 2 ? Math.PI / seg : 0);
        const jj = (i === 0 || i === rings || !jitter) ? 1 : 1 + (this.rnd() - 0.5) * jitter;
        row.push([x + Math.sin(phi) * Math.cos(th) * rx * jj, y + Math.cos(phi) * ry * jj, z + Math.sin(phi) * Math.sin(th) * rz * jj]);
      }
      pts.push(row);
    }
    const ctr = [x, y, z];
    const base = this.col;
    for (let i = 0; i < rings; i++) {
      if (topCol !== null && botCol !== null) {
        const t = (i + 0.5) / rings;
        this.color(mixHex(topCol, botCol, t));
      }
      for (let j = 0; j < seg; j++) {
        const j1 = (j + 1) % seg;
        const a = pts[i][j], b = pts[i][j1], c = pts[i + 1][j1], d = pts[i + 1][j];
        if (i === 0) this.triO(a, c, d, null, ctr);
        else if (i === rings - 1) this.triO(a, b, d, null, ctr);
        else this.quad(a, b, c, d, null, ctr);
      }
    }
    if (topCol !== null) this.col = base;
    return this;
  }

  /** Icosahedron-ish rock/foliage lump, subdivided 0 times, jittered. */
  lump(r, x = 0, y = 0, z = 0, jitter = 0.25, sy = 1, detail = 0) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    const p = g.attributes.position;
    const verts = new Map();
    const key = (vx, vy, vz) => `${vx.toFixed(3)},${vy.toFixed(3)},${vz.toFixed(3)}`;
    const get = (i) => {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const k = key(vx, vy, vz);
      if (!verts.has(k)) {
        const j = 1 + (this.rnd() - 0.5) * 2 * jitter;
        verts.set(k, [x + vx * j, y + vy * j * sy, z + vz * j]);
      }
      return verts.get(k);
    };
    const idx = g.index;
    const n = idx ? idx.count : p.count;
    const ctr = [x, y, z];
    for (let i = 0; i < n; i += 3) {
      const a = get(idx ? idx.getX(i) : i), b = get(idx ? idx.getX(i + 1) : i + 1), c = get(idx ? idx.getX(i + 2) : i + 2);
      this.triO(a, b, c, null, ctr);
    }
    g.dispose();
    return this;
  }

  /** Lathe: profile [[r, y], ...] bottom to top, around +Y. */
  lathe(profile, sides = 8, x = 0, z = 0, rot = 0, colFn = null) {
    const rings = profile.map(([r, y]) => {
      const row = [];
      for (let i = 0; i < sides; i++) {
        const a = rot + (i / sides) * TAU;
        row.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
      }
      return row;
    });
    const base = this.col;
    for (let k = 0; k < rings.length - 1; k++) {
      if (colFn) this.color(colFn(k / (rings.length - 2 || 1)));
      const ctr = [x, (profile[k][1] + profile[k + 1][1]) / 2, z];
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        const a = rings[k][i], b = rings[k][j], c = rings[k + 1][j], d = rings[k + 1][i];
        const r0 = profile[k][0], r1 = profile[k + 1][0];
        if (r0 < 1e-5) this.triO(a, c, d, null, ctr);
        else if (r1 < 1e-5) this.triO(a, b, c, null, ctr);
        else this.quad(a, b, c, d, null, ctr);
      }
    }
    if (colFn) this.col = base;
    return this;
  }

  /** Extrude a closed 2D polygon (x,z pairs, local) from y0 to y1. */
  prism(poly, y0, y1, capTop = true, capBot = false) {
    const n = poly.length;
    let cx = 0, cz = 0;
    for (const [px, pz] of poly) { cx += px; cz += pz; }
    cx /= n; cz /= n;
    for (let i = 0; i < n; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % n];
      this.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], null, [cx, (y0 + y1) / 2, cz]);
    }
    if (capTop) for (let i = 0; i < n; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % n];
      this.triO([cx, y1, cz], [ax, y1, az], [bx, y1, bz], [0, 1, 0]);
    }
    if (capBot) for (let i = 0; i < n; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % n];
      this.triO([cx, y0, cz], [ax, y0, az], [bx, y0, bz], [0, -1, 0]);
    }
    return this;
  }

  /** Flat double-faced card (leaf, blade, sail) - written twice so it is visible from both sides with single-sided materials. */
  card(a, b, c, d = null) {
    this.tri(a, b, c); this.tri(a, c, b);
    if (d) { this.tri(a, c, d); this.tri(a, d, c); }
    return this;
  }

  append(other) {
    // other is already in its own local space; transform by our current matrix
    const e = this.M.elements;
    const P = other.P;
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      this.P.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
    }
    for (let i = 0; i < other.C.length; i++) this.C.push(other.C[i]);
    for (let i = 0; i < other.S.length; i++) this.S.push(other.S[i]);
    return this;
  }

  build() {
    const n = this.P.length / 3;
    const P = new Float32Array(this.P), C = new Float32Array(this.C), S = new Float32Array(this.S);
    const N = new Float32Array(n * 3);
    for (let t = 0; t < n; t += 3) {
      const o = t * 3;
      const ux = P[o + 3] - P[o], uy = P[o + 4] - P[o + 1], uz = P[o + 5] - P[o + 2];
      const vx = P[o + 6] - P[o], vy = P[o + 7] - P[o + 1], vz = P[o + 8] - P[o + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 3; k++) { N[o + k * 3] = nx; N[o + k * 3 + 1] = ny; N[o + k * 3 + 2] = nz; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('sway', new THREE.BufferAttribute(S, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
