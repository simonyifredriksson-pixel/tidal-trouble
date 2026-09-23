/* Colliders.js - static collision for everything that is not terrain:
   tree trunks, rocks, walls, dock posts, furniture.

   Two shapes: circles and oriented boxes, both with a vertical extent
   (y0..y1) so you can walk UNDER a roof, step onto a porch, or swim past a
   rock that stops above the water line. Stored in a 16 m spatial hash.

   RESOLUTION SUMS THE PUSHES AND CANCELS VELOCITY ONCE against the net
   normal. Cancelling against each blocker in turn removes nearly all of the
   velocity along a row of overlapping circles, and a pure push-out without
   touching velocity makes the next frame walk straight back in. Both were
   how a player got wedged against a shop in an earlier game. */

const CELL = 16;

export class Colliders {
  constructor() {
    this.map = new Map();
    this.all = [];
  }
  _cells(x0, z0, x1, z1, fn) {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
      for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) fn(i + ',' + j);
  }
  _add(c, reach) {
    this.all.push(c);
    this._cells(c.x - reach, c.z - reach, c.x + reach, c.z + reach, k => {
      if (!this.map.has(k)) this.map.set(k, []);
      this.map.get(k).push(c);
    });
    return c;
  }
  circle(x, z, r, y0 = -50, y1 = 50, tag = null) {
    return this._add({ t: 'c', x, z, r, y0, y1, tag }, r);
  }
  /** Oriented box: centre, half-width (local x), half-depth (local z), rotation about Y. */
  box(x, z, hw, hd, rot = 0, y0 = -50, y1 = 50, tag = null) {
    return this._add({ t: 'b', x, z, hw, hd, rot, c: Math.cos(rot), s: Math.sin(rot), y0, y1, tag }, Math.hypot(hw, hd));
  }
  near(x, z, r = 2) {
    const out = new Set();
    this._cells(x - r, z - r, x + r, z + r, k => { const l = this.map.get(k); if (l) for (const c of l) out.add(c); });
    return out;
  }

  /** Highest collider top under (x,z) within [yFeet-step, yFeet+step] - for standing on porches, docks, crates. */
  floorAt(x, z, yFeet, step = 0.55) {
    let best = -Infinity;
    for (const c of this.near(x, z, 1)) {
      if (!c.floor) continue;
      if (c.y1 > yFeet + step || c.y1 < yFeet - 1.2) continue;
      if (inside(c, x, z, 0)) best = Math.max(best, c.y1);
    }
    return best;
  }

  /**
   * Push a circle (x,z,r) at height range [y, y+h] out of every blocker.
   * Returns {x, z, nx, nz, hit} - the corrected position and the net normal.
   */
  resolve(x, z, r, y, h, vel = null) {
    let px = 0, pz = 0, hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let sx = 0, sz = 0, any = false;
      for (const c of this.near(x, z, r + 1)) {
        if (c.floor && y >= c.y1 - 0.56) continue;           // standing on it
        if (y + h < c.y0 || y > c.y1) continue;
        const p = push(c, x, z, r);
        if (p) { sx += p[0]; sz += p[1]; any = true; }
      }
      if (!any) break;
      hit = true;
      x += sx; z += sz; px += sx; pz += sz;
    }
    let nx = 0, nz = 0;
    const l = Math.hypot(px, pz);
    if (l > 1e-6) {
      nx = px / l; nz = pz / l;
      if (vel) {
        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) {
          vel.x -= vn * nx; vel.z -= vn * nz;
          // dead-centre: no tangent to slide along - pick a side
          const sp = Math.hypot(vel.x, vel.z);
          if (sp < 0.05 && Math.abs(vn) > 0.5) { vel.x += -nz * 0.6; vel.z += nx * 0.6; }
        }
      }
    }
    return { x, z, nx, nz, hit };
  }

  remove(c) {
    const i = this.all.indexOf(c);
    if (i >= 0) this.all.splice(i, 1);
    for (const l of this.map.values()) { const k = l.indexOf(c); if (k >= 0) l.splice(k, 1); }
  }
}

function inside(c, x, z, r) {
  if (c.t === 'c') return Math.hypot(x - c.x, z - c.z) < c.r + r;
  const dx = x - c.x, dz = z - c.z;
  const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
  return Math.abs(lx) < c.hw + r && Math.abs(lz) < c.hd + r;
}

function push(c, x, z, r) {
  if (c.t === 'c') {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
    if (d >= m) return null;
    if (d < 1e-5) return [m, 0];
    return [dx / d * (m - d), dz / d * (m - d)];
  }
  const dx = x - c.x, dz = z - c.z;
  const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
  const qx = Math.max(-c.hw, Math.min(c.hw, lx)), qz = Math.max(-c.hd, Math.min(c.hd, lz));
  let ex = lx - qx, ez = lz - qz;
  const d = Math.hypot(ex, ez);
  let ox, oz;
  if (d > 1e-6) {
    if (d >= r) return null;
    ox = ex / d * (r - d); oz = ez / d * (r - d);
  } else {
    // centre inside the box: leave by the nearest face
    const fx = c.hw - Math.abs(lx), fz = c.hd - Math.abs(lz);
    if (fx < fz) { ox = Math.sign(lx || 1) * (fx + r); oz = 0; }
    else { ox = 0; oz = Math.sign(lz || 1) * (fz + r); }
  }
  // back to world
  return [ox * c.c + oz * c.s, -ox * c.s + oz * c.c];
}

export { inside as insideCollider };
