/* Secrets.js - the hidden places (SecretData): Smuggler's Grotto, the
   Drowned Temple, the wreck of the Bright Promise and Castaway Key.

   Everything is built here in code like the rest of the world. The grotto is
   a hollow dome of rock standing in deep water with an arch cut in one side,
   so you can drive a boat inside; its wall is a ring of colliders with the
   same gap, so hulls and swimmers are stopped by the rock you can see. The
   temple and the wreck sit on the sea floor and are reached by swimming down.
   Castaway Key is a real terrain island (MapData.ISLANDS) with a camp on it.

   Each place has one CACHE: a point you press E at. `full` meshes (the gold,
   the glowing relic, the X in the sand) show while it has something in it -
   Game.syncSecrets() flips them from the save. */

import * as THREE from '../../lib/three.module.js?v=1790358905';
import { MeshBuilder } from '../art/Geo.js?v=1790358905';
import { MAT } from '../art/Materials.js?v=1790358905';
import * as BA from '../art/BuildingArt.js?v=1790358905';
import { heightAt } from './Terrain.js?v=1790358905';
import { SECRETS, SECRET_BY_ID } from '../data/SecretData.js?v=1790358905';
import { rng, TAU } from '../core/Util.js?v=1790358905';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* the grotto's shape: inner radius, arch direction (towards the bay) and width */
export const GROTTO = { ri: 15.5, ro: 21, h: 12.5, gap: 0.42, archY: 8 };
{ const S = SECRET_BY_ID.grotto; GROTTO.x = S.x; GROTTO.z = S.z; GROTTO.door = Math.atan2(80 - S.z, 0 - S.x); }

const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export class Secrets {
  constructor(scene, colliders, settlement) {
    this.C = colliders;
    this.S = settlement;
    this.group = new THREE.Group();
    this.group.name = 'secrets';
    scene.add(this.group);
    this.sites = SECRETS.map(D => ({ D, id: D.id, cache: null, cacheR: 2.4, underwater: D.kind === 'dive', full: [] }));
    this.byId = Object.fromEntries(this.sites.map(s => [s.id, s]));
    this.t = 0;
    this._grotto();
    this._temple();
    this._promise();
    this._castaway();
  }

  /* ---------------- queries ---------------- */
  /** The hidden place whose own fish bite at this point, or null. */
  siteAt(p) {
    for (const s of this.sites) if (Math.hypot(p.x - s.D.x, p.z - s.D.z) < s.D.fish) return s.D;
    return null;
  }
  /** Is this point inside the grotto dome? */
  inCave(p) { return Math.hypot(p.x - GROTTO.x, p.z - GROTTO.z) < GROTTO.ri - 0.5 && p.y < GROTTO.h - 2; }
  /** A cache within reach of this point, or null. */
  cacheNear(p) {
    for (const s of this.sites) {
      if (!s.cache) continue;
      // on the sea floor you are bobbing about: close above it is close enough
      if (s.underwater) { const dy = p.y - s.cache.y; if (Math.hypot(p.x - s.cache.x, p.z - s.cache.z) < s.cacheR && dy > -2 && dy < 3.5) return s; }
      else if (s.cache.distanceTo(p) < s.cacheR) return s;
    }
    return null;
  }
  /** Show or hide what is left in each cache. */
  sync(avail) { for (const s of this.sites) for (const m of s.full) m.visible = !!avail(s.id); }

  update(dt) {
    this.t += dt;
    const r = this.byId.temple.relic;
    if (r && r.visible) { r.position.y = r.userData.y + Math.sin(this.t * 1.6) * 0.12; r.rotation.y += dt * 0.7; }
  }

  _mesh(geo, mat = MAT.solid, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  /* ---------------- Smuggler's Grotto ----------------
     Two shells of rock (outside and inside) on one grid, joined round the
     arch so the rock has a thickness where you drive through it. */
  _grotto() {
    const G = GROTTO, X = G.x, Z = G.z, r = rng(9101);
    const N = 36;
    // rings bottom to top: a skirt under the water, then the dome
    const rings = [[-15, 1], [-2.5, 1], [0.8, 0.99]];
    for (let k = 1; k <= 7; k++) { const phi = k / 7 * Math.PI / 2; rings.push([0.8 + Math.sin(phi) * (G.h - 0.8), Math.cos(phi) * 0.96 + 0.03]); }
    const K = rings.length;
    const noise = [];
    for (let k = 0; k < K; k++) { noise.push([]); for (let i = 0; i < N; i++) noise[k].push(1 + (r() - 0.5) * 0.16); }
    const pt = (shell, i, k) => {
      const a = (i % N) / N * TAU, [y, f] = rings[k], n = noise[k][i % N];
      const R = (shell ? G.ro : G.ri) * f * n;
      return [Math.cos(a) * R, shell ? y : Math.min(y, G.h - 2.4), Math.sin(a) * R];
    };
    const open = (i, k) => {
      const a = (i + 0.5) / N * TAU;
      return Math.abs(angDiff(a, G.door)) < G.gap && rings[k + 1][0] <= G.archY + 0.5 && k >= 1;
    };
    const b = new MeshBuilder(r);
    b.push(X, 0, Z);
    for (let k = 0; k < K - 1; k++) for (let i = 0; i < N; i++) {
      if (open(i, k)) {
        // the jambs and the lintel of the arch: join the two shells where the hole ends
        const side = (ii, kk, a0, a1) => {
          if (kk < 0 || kk >= K - 1 || open(((ii % N) + N) % N, kk)) return;
          b.color(0x4a463e, 0.1).quad(pt(0, a0[0], a0[1]), pt(1, a0[0], a0[1]), pt(1, a1[0], a1[1]), pt(0, a1[0], a1[1]));
        };
        side(i - 1, k, [i, k], [i, k + 1]);
        side(i + 1, k, [i + 1, k], [i + 1, k + 1]);
        side(i, k + 1, [i, k + 1], [i + 1, k + 1]);
        continue;
      }
      const top = k >= K - 2;
      // outside: weathered stone, dark and wet at the water, birds' white near the top
      const y0 = rings[k][0];
      b.color(y0 < 0 ? 0x3e4240 : top ? 0x9a9a92 : k % 2 ? 0x7a756a : 0x706a5e, 0.12);
      b.quad(pt(1, i, k), pt(1, i + 1, k), pt(1, i + 1, k + 1), pt(1, i, k + 1), null, [0, rings[k][0], 0]);
      // inside: darker, with a green line of weed at the tide mark
      b.color(y0 < 0.5 && y0 > -3 ? 0x2a4034 : 0x34323a, 0.12);
      const a = pt(0, i, k), bb = pt(0, i + 1, k), c = pt(0, i + 1, k + 1), d = pt(0, i, k + 1);
      b.triO(a, bb, c, [-(a[0] + c[0]), 0, -(a[2] + c[2])]); b.triO(a, c, d, [-(a[0] + c[0]), 0, -(a[2] + c[2])]);
    }
    // the cap, inside and out
    for (let i = 0; i < N; i++) {
      b.color(0x8a8a84, 0.1).triO([0, G.h + 0.4, 0], pt(1, i, K - 1), pt(1, i + 1, K - 1), [0, 1, 0]);
      b.color(0x2e2c34, 0.1).triO([0, G.h - 2.2, 0], pt(0, i, K - 1), pt(0, i + 1, K - 1), [0, -1, 0]);
    }
    // stalactites
    b.color(0x3e3c44);
    for (let n = 0; n < 26; n++) {
      const a = r() * TAU, d = 2 + r() * (G.ri - 5), y = G.h - 2.6 - d * d * 0.02;
      b.push(Math.cos(a) * d, y, Math.sin(a) * d, Math.PI); b.cone(0.25 + r() * 0.4, 0, 0.8 + r() * 2.2, 5); b.pop();
    }
    // rocks round the foot outside, so it looks like it grew out of the sea
    for (let n = 0; n < 14; n++) {
      const a = r() * TAU;
      if (Math.abs(angDiff(a, G.door)) < G.gap + 0.25) continue;
      const d = G.ro + 0.5 + r() * 3;
      b.color(0x3a3c3c, 0.1).lump(1.5 + r() * 2.2, Math.cos(a) * d, -0.8, Math.sin(a) * d, 0.3, 0.8);
    }
    b.pop();
    this._mesh(b.build(), MAT.solidDS);
    // the wall: circles round the ring, none across the arch
    for (let a = 0; a < TAU; a += 0.16) {
      if (Math.abs(angDiff(a, G.door)) < G.gap + 0.06) continue;
      const d = (G.ri + G.ro) / 2 + 0.3;
      this.C.circle(X + Math.cos(a) * d, Z + Math.sin(a) * d, 3.4, -16, G.h + 1, 'rock');
    }
    // the ledge at the back, and the smugglers' things on it
    const back = G.door + Math.PI, ld = G.ri - 3.4;
    const lx = X + Math.cos(back) * ld, lz = Z + Math.sin(back) * ld;
    const rot = Math.atan2(Math.cos(back), Math.sin(back));   // local +z points out to the wall
    const LY = 1.3;
    const col = this.C.box(lx, lz, 5.5, 2.4, rot, -16, LY, 'ledge'); col.floor = true;
    const lb = new MeshBuilder(rng(9102));
    lb.push(lx, 0, lz, 0, rot);
    lb.color(0x4a4640, 0.1).box(11, LY + 15, 4.8, 0, (LY - 15) / 2, 0);
    lb.color(0x5a564e, 0.08).box(10.6, 0.14, 4.4, 0, LY, 0);
    // a gangplank of old boards down to the water on the arch side
    lb.color(0x6a5a44).box(1.2, 0.08, 2.4, -3.2, LY - 0.3, -3.1, null, 0.1);
    for (let k = 0; k < 3; k++) BA.buildCrate(lb, -3.8 + k * 1.1, LY, 1.4, 0.8, 0x6a5238, 0.25);
    BA.buildCrate(lb, -3.3, LY + 0.8, 1.4, 0.7, 0x5e4a32, 0.3);
    BA.buildBarrel(lb, 3.6, LY, 1.4); BA.buildBarrel(lb, 4.3, LY, 0.6); BA.buildBarrel(lb, 3.9, LY, -0.3);
    // coiled rope, a lantern, a table with a card game left half played
    lb.color(0x8a7a5a).cyl(0.45, 0.45, LY, LY + 0.22, 8, true, 1.9, 1.5);
    lb.color(0x4a3a2a).box(1.4, 0.07, 0.9, 1.4, LY + 0.8, -0.6);
    for (const px of [-0.6, 0.6]) for (const pz of [-0.35, 0.35]) lb.box(0.07, 0.8, 0.07, 1.4 + px, LY + 0.4, -0.6 + pz);
    lb.color(0xf0ece0); for (let k = 0; k < 5; k++) lb.box(0.1, 0.01, 0.14, 1.1 + k * 0.14, LY + 0.84, -0.6 + (k % 2) * 0.1);
    lb.color(0x2e2e30).box(0.2, 0.3, 0.2, 1.9, LY + 0.99, -0.5);
    // the cache: an iron-bound chest in the middle
    lb.color(0x5a3e22).box(1.3, 0.7, 0.8, 0, LY + 0.35, 0.6); lb.color(0x3a3a3e).box(1.34, 0.08, 0.84, 0, LY + 0.55, 0.6); lb.box(0.1, 0.72, 0.84, -0.5, LY + 0.36, 0.6); lb.box(0.1, 0.72, 0.84, 0.5, LY + 0.36, 0.6);
    lb.pop();
    this._mesh(lb.build());
    const gold = new MeshBuilder(rng(9103));
    gold.push(lx, 0, lz, 0, rot);
    gold.color(0xf0c84a); for (let k = 0; k < 14; k++) gold.cyl(0.07, 0.07, LY + 0.72 + k * 0.012, LY + 0.74 + k * 0.012, 6, true, (k % 5 - 2) * 0.16, 0.5 + (k % 3) * 0.12);
    gold.lump(0.28, 0, LY + 0.78, 0.6, 0.3, 0.5);
    gold.color(0xffe890).lump(0.08, 0.3, LY + 0.95, 0.5);
    gold.pop();
    const gm = this._mesh(gold.build(), MAT.glow, false);
    const s = this.byId.grotto;
    s.full.push(gm);
    const [cx, cz] = [lx + Math.sin(rot) * 0.6, lz + Math.cos(rot) * 0.6];
    s.cache = V(cx, LY + 0.9, cz); s.cacheR = 2.4;
    this.S.lights.push({ pos: V(lx, LY + 1.6, lz), color: 0xffb060, intensity: 1.4, dist: 14, night: false, flicker: true });
    // crystals on the walls: the only light in there
    const cr = new MeshBuilder(rng(9104));
    cr.push(X, 0, Z);
    for (let n = 0; n < 44; n++) {
      const a = r() * TAU;
      if (Math.abs(angDiff(a, G.door)) < G.gap + 0.1) continue;
      // on the inside of the wall: the same profile the shell is built from, less the bumps
      const y = 0.6 + r() * 6.5, f = y < 0.8 ? 0.99 : Math.cos(Math.asin(Math.min(1, (y - 0.8) / (G.h - 0.8)))) * 0.96 + 0.03, d = G.ri * f * 0.9;
      const px = Math.cos(a) * d, pz = Math.sin(a) * d;
      cr.color(n % 3 ? 0x6ae0ff : 0xb08aff);
      for (let k = 0; k < 4; k++) {
        const tilt = (r() - 0.5) * 1.2, len = 0.5 + r() * 1.3;
        cr.push(px, y, pz, tilt, a + Math.PI / 2 + (r() - 0.5), -0.7 - r() * 0.4); cr.cyl(0.12 + r() * 0.1, 0, 0, len, 5); cr.pop();
      }
    }
    cr.pop();
    this._mesh(cr.build(), MAT.glow, false);
    for (let k = 0; k < 3; k++) { const a = back + (k - 1) * 1.6; this.S.lights.push({ pos: V(X + Math.cos(a) * 9, 3.5, Z + Math.sin(a) * 9), color: 0x6ad8ff, intensity: 1.3, dist: 20, night: false }); }
    this.S.anchors.grottoLedge = V(lx, LY + 0.05, lz);
    this.S.anchors.grottoWater = V(X + Math.cos(G.door) * 6, 0, Z + Math.sin(G.door) * 6);
  }

  /* ---------------- the Drowned Temple ----------------
     A stepped platform on the sea floor, a ring of columns (some fallen),
     a fish-headed statue, and an altar with a relic that glows. */
  _temple() {
    const S = SECRET_BY_ID.temple, X = S.x, Z = S.z, r = rng(9201);
    const fy = heightAt(X, Z);
    const b = new MeshBuilder(r);
    b.push(X, fy, Z, 0, 0.35);
    // platform in three steps
    b.color(0x7a8a82, 0.08).box(19, 1.2, 15, 0, -0.2, 0); b.color(0x86968c, 0.08).box(16, 0.6, 12, 0, 0.7, 0); b.color(0x92a298, 0.06).box(13, 0.5, 9.5, 0, 1.25, 0);
    // weed and coral on the steps
    for (let k = 0; k < 30; k++) { b.color(k % 3 ? 0x2e6a4a : 0xd07a6a).cone(0.1 + r() * 0.15, 0.4, 0.9 + r() * 1.2, 4, (r() - 0.5) * 18, (r() - 0.5) * 14); }
    // the columns: fluted, capitals, some snapped with their drums on the floor
    const top = 1.5;
    this.columns = [];
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * TAU, cx = Math.cos(a) * 5.4, cz = Math.sin(a) * 4.0;
      const broken = [2, 5, 8].includes(k), h = broken ? 2 + r() * 1.8 : 6.4;
      b.color(0x9aaaa0, 0.06).cyl(0.62, 0.62, top, top + 0.35, 8, true, cx, cz);
      b.color(0xa8b8ae, 0.06).cyl(0.48, 0.44, top + 0.35, top + h, 8, true, cx, cz);
      if (!broken) b.color(0x9aaaa0, 0.06).box(1.3, 0.4, 1.3, cx, top + h + 0.2, cz);
      else { const fa = a + 1.2; b.color(0xa8b8ae, 0.06).push(cx + Math.cos(fa) * 2.2, 1.9, cz + Math.sin(fa) * 2.2, Math.PI / 2, fa); b.cyl(0.46, 0.46, -1.1, 1.1, 8); b.pop(); }
      this.columns.push([cx, cz]);
    }
    // a lintel still across two of them
    { const [ax, az] = this.columns[0], [bx, bz] = this.columns[1]; b.color(0x9aaaa0, 0.06).beam([ax, top + 6.75, az], [bx, top + 6.75, bz], 0.9, 0.7); }
    // the statue at the back: robed, with a fish's head, eyes lit
    b.push(0, top, -3.2);
    b.color(0x6a7a72, 0.06).box(1.8, 0.8, 1.6, 0, 0.4, 0);
    b.color(0x7a8a82, 0.05).cyl(0.9, 0.55, 0.8, 3.6, 7);
    b.color(0x6e7e76, 0.05).blob(0.62, 0.9, 0.7, 0, 4.3, 0.1, 7, 4);
    b.color(0x5e6e66).cone(0.5, 4.6, 5.6, 5, 0, -0.2);
    for (const s of [-1, 1]) { b.color(0x7a8a82).tube([s * 0.7, 3.3, 0], [s * 1.1, 2.4, 0.6], 0.2, 0.16, 5); b.color(0x6a7a72).box(0.5, 0.2, 0.4, s * 1.1, 2.3, 0.7); }
    b.pop();
    // the altar
    b.color(0x6a7a72, 0.05).box(1.8, 1.0, 1.1, 0, top + 0.5, 0.8); b.color(0x7a8a82).box(2.0, 0.14, 1.3, 0, top + 1.05, 0.8);
    b.pop();
    const m = this._mesh(b.build());
    m.updateMatrixWorld();
    // glowing eyes and runes (always on)
    const g = new MeshBuilder(rng(9202));
    g.push(X, fy, Z, 0, 0.35);
    g.color(0x7affd8); for (const s of [-1, 1]) g.lump(0.1, s * 0.42, top + 4.45, -2.6);
    for (let k = 0; k < 6; k++) g.box(0.12, 0.3, 0.02, -0.75 + k * 0.3, top + 0.55, 1.36);
    g.pop();
    this._mesh(g.build(), MAT.glow, false);
    // the relic: an orb on a little stand, bobbing
    const o = new MeshBuilder(rng(9203));
    o.color(0x9affe8).lump(0.32, 0, 0, 0, 0.1, 1, 1); o.color(0xf0fff8).lump(0.14, 0.12, 0.1, 0.12);
    const relic = this._mesh(o.build(), MAT.glow, false);
    const ca = Math.cos(0.35), sa = Math.sin(0.35);
    const rx = X + 0.8 * sa, rz = Z + 0.8 * ca, ry = fy + top + 1.55;
    relic.position.set(rx, ry, rz); relic.userData.y = ry;
    const s = this.byId.temple;
    s.relic = relic; s.full.push(relic);
    s.cache = V(rx, ry, rz); s.cacheR = 3.2;
    // colliders: the columns and the altar (swimmers bump into them)
    for (const [cx, cz] of this.columns) this.C.circle(X + cx * ca + cz * sa, Z - cx * sa + cz * ca, 0.6, fy - 1, fy + top + 7, 'column');
    this.S.lights.push({ pos: V(rx, ry + 1, rz), color: 0x7af0d0, intensity: 2.0, dist: 18, night: false });
    this.S.anchors.templeWater = V(X + 10, 0, Z + 10);
    this.S.anchors.templeFloor = V(rx + 1.5, ry, rz + 1.5);
  }

  /* ---------------- the wreck of the Bright Promise ---------------- */
  _promise() {
    const S = SECRET_BY_ID.promise, X = S.x, Z = S.z;
    const fy = heightAt(X, Z);
    const rot = 0.6, len = 24;
    const wm = this._mesh(BA.buildWreck(4321, len, false));
    wm.position.set(X, fy + 0.4, Z); wm.rotation.set(0, rot, 0.22);
    this.C.box(X, Z, 2.8, len / 2, rot, fy - 2, fy + 5, 'wreck');
    this.S.wrecks.push({ x: X, z: Z });
    // her name on the bow, still readable
    const sign = BA.signBoard('BRIGHT PROMISE', 2.8, 0.42, { bg: '#3a3028', ink: '#d8c8a0' });
    const bx = X + Math.sin(rot) * (len / 2 - 3), bz = Z + Math.cos(rot) * (len / 2 - 3);
    sign.position.set(bx + Math.cos(rot) * 2.9, fy + 2.4, bz - Math.sin(rot) * 2.9); sign.rotation.y = rot + Math.PI / 2;
    this.group.add(sign);
    // the sea chest, fallen out onto the sand beside the stern, and a spill of cargo
    const cxw = X - Math.sin(rot) * (len / 2 - 4) + Math.cos(rot) * 4.2, czw = Z - Math.cos(rot) * (len / 2 - 4) - Math.sin(rot) * 4.2;
    const cy = heightAt(cxw, czw);
    const b = new MeshBuilder(rng(9301));
    b.push(cxw, cy, czw, 0, rot + 0.4, 0.08);
    b.color(0x4a3420).box(1.2, 0.65, 0.75, 0, 0.32, 0); b.color(0x5a4028).lathe([[0.38, 0.65], [0.36, 0.8], [0.2, 0.88], [0.01, 0.9]], 8, 0, 0);
    b.color(0x6a6a70).box(1.24, 0.08, 0.79, 0, 0.5, 0); b.box(0.12, 0.3, 0.1, 0, 0.45, 0.4);
    b.pop();
    this._mesh(b.build());
    const extra = new MeshBuilder(rng(9302));
    for (let k = 0; k < 5; k++) {
      const a = rot + 0.5 + k * 1.1, d = 3 + k * 1.3, px = cxw + Math.cos(a) * d, pz = czw + Math.sin(a) * d;
      extra.push(px, heightAt(px, pz) - 0.1, pz, 1.3, a, 0.3); BA.buildBarrel(extra, 0, 0, 0); extra.pop();
    }
    this._mesh(extra.build());
    const g = new MeshBuilder(rng(9303));
    g.color(0xf0c84a); for (let k = 0; k < 10; k++) g.cyl(0.07, 0.07, 0, 0.02, 6, true, (k % 4 - 1.5) * 0.25, 0.5 + (k % 3) * 0.2);
    g.color(0xffe890).lump(0.1, 0, 0.9, 0);
    const gm = this._mesh(g.build(), MAT.glow, false);
    gm.position.set(cxw, cy + 0.02, czw); gm.rotation.y = rot;
    const s = this.byId.promise;
    s.full.push(gm);
    s.cache = V(cxw, cy + 0.6, czw); s.cacheR = 3.0;
    this.C.box(cxw, czw, 0.6, 0.4, rot + 0.4, cy - 1, cy + 0.9, 'chest');
    this.S.lights.push({ pos: V(cxw, cy + 1.2, czw), color: 0xffd070, intensity: 0.9, dist: 9, night: false });
    this.S.anchors.promiseWater = V(X + 12, 0, Z - 8);
    this.S.anchors.promiseFloor = V(cxw + 1.5, cy + 1, czw + 1.5);
  }

  /* ---------------- Castaway Key ---------------- */
  _castaway() {
    const S = SECRET_BY_ID.castaway, X = S.x, Z = S.z, r = rng(9401);
    const b = new MeshBuilder(r);
    const at = (x, z, fn, ry = 0) => { b.push(X + x, heightAt(X + x, Z + z), Z + z, 0, ry); fn(); b.pop(); };
    // the shelter: driftwood lean-to thatched with palm fronds
    at(-3, -2, () => {
      b.color(0x8a7a62); for (const s of [-1, 1]) b.tube([s * 1.3, 0, 1.1], [s * 1.2, 1.9, -0.4], 0.08, 0.07, 5);
      b.tube([-1.5, 1.9, -0.4], [1.5, 1.9, -0.4], 0.08, 0.08, 5);
      for (let k = 0; k < 7; k++) { b.color(k % 2 ? 0x6a8a3a : 0x7a9a44).quad([-1.4 + k * 0.42, 1.95, -0.45], [-1.0 + k * 0.42, 1.95, -0.45], [-1.0 + k * 0.42, 0.1, 1.3], [-1.4 + k * 0.42, 0.1, 1.3], [0, 1, 1]); }
      b.color(0x9a8a6a).box(1.8, 0.1, 0.9, 0, 0.05, -0.1);
    }, 0.4);
    // the fire pit: a ring of stones, charcoal, a spit
    at(1.2, 0.8, () => {
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.color(0x6a6a66, 0.1).lump(0.18, Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6, 0.3, 0.7); }
      b.color(0x2a2624).box(0.7, 0.06, 0.7, 0, 0.03, 0);
      b.color(0x5a4a3a); for (const s of [-1, 1]) b.tube([s * 0.8, 0, 0], [s * 0.7, 0.9, 0], 0.04, 0.04, 4); b.tube([-0.8, 0.9, 0], [0.8, 0.9, 0], 0.03, 0.03, 4);
    });
    // SOS in stones, for anyone flying over (nobody ever did)
    at(-1, 5, () => {
      b.color(0xd8d4c8, 0.05);
      const S_ = [[0.4, 0], [0, 0], [-0.1, 0.35], [0.3, 0.55], [0.4, 0.9], [0, 1]], O = [[0, 0], [0.4, 0.1], [0.45, 0.5], [0.4, 0.9], [0, 1], [-0.05, 0.5]];
      const letter = (pts, ox) => { for (const [px, pz] of pts) b.lump(0.14, ox + px * 1.6, 0.05, pz * 1.6, 0.3, 0.6); };
      letter(S_, -2.2); letter(O, -0.4); letter(S_, 1.4);
    }, 0.2);
    // a post with the days scratched into it
    at(2.6, -2.4, () => { b.color(0x7a6a52).box(0.16, 1.4, 0.16, 0, 0.7, 0); b.color(0x3a3228); for (let k = 0; k < 9; k++) b.box(0.02, 0.18, 0.005, -0.06 + (k % 5) * 0.03, 0.6 + Math.floor(k / 5) * 0.3, 0.085); });
    this._mesh(b.build());
    // the X in the sand, where the cache is buried
    const xx = 3.6, xz = 2.6, xy = heightAt(X + xx, Z + xz);
    const x = new MeshBuilder(rng(9402));
    x.push(X + xx, xy + 0.03, Z + xz);
    x.color(0x6a4a2a); x.push(0, 0, 0, 0, 0.785); x.box(1.4, 0.04, 0.22); x.pop(); x.push(0, 0, 0, 0, -0.785); x.box(1.4, 0.04, 0.22); x.pop();
    x.pop();
    const xm = this._mesh(x.build(), MAT.solid, false);
    const s = this.byId.castaway;
    s.full.push(xm);
    s.cache = V(X + xx, xy + 0.6, Z + xz); s.cacheR = 2.4;
    this.S.blockers.push({ x: X, z: Z, r: 9 });
    this.S.lights.push({ pos: V(X + 1.2, heightAt(X + 1.2, Z + 0.8) + 0.6, Z + 0.8), color: 0xffa050, intensity: 0.6, dist: 7, night: true, flicker: true });
    this.S.anchors.castaway = V(X + 1, heightAt(X + 1, Z + 3) + 0.1, Z + 3);
  }
}
