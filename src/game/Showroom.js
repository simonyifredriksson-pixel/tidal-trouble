/* Showroom.js - shops you walk around in.

   Rods stand in racks, bait sits on tables and shelves, boat plans lie on
   drafting tables with a model of the boat on top. Look straight at one
   from close by and it gets a soft outline and a small card near the middle
   of the screen: its name, its price, HOLD E TO PURCHASE. Hold E and a ring
   fills; let go, look away or step back and it empties again. When it is
   full the thing is yours - into the inventory, onto the hotbar if it goes
   there - and nothing else on the screen has moved.

   One system for anything with a price on it: an item is {kind, ref, name,
   price, obj}. Rods, bait, tools and boat plans use it now; anything else
   (weapons, equipment, a pirate's odd stock) only needs a mesh and a buy. */

import * as THREE from '../../lib/three.module.js';
import { RODS, ROD_BY_ID, BAITS, BAIT_BY_ID, TOOLS, TOOL_BY_ID, SHOPS, shopOf, WEAPONS } from '../data/GearData.js';
import { HULLS, HULL_BY_ID } from '../data/BoatData.js';
import { NPCS } from '../data/NPCData.js';
import { planPrice } from '../data/BuildData.js';
import { buildRod } from '../art/RodArt.js';
import { baitDisplay, planDisplay, tackleStall, planPavilion, addOutline } from '../art/ShopArt.js';
import { toolMesh } from './ViewModel.js';
import { signBoard, buildLureBoard, buildCrate, buildBarrel } from '../art/BuildingArt.js';
import { MeshBuilder, shadeHex } from '../art/Geo.js';
import { MAT } from '../art/Materials.js';
import { heightAt } from '../world/Terrain.js';
import { insideCollider } from '../world/Colliders.js';
import { rng, clamp, fmtInt } from '../core/Util.js';

const HOLD = 0.6;           // seconds of E to buy
const REACH = 4.2;          // how far away you can be looking at something
const _ray = new THREE.Ray(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _hit = new THREE.Vector3(), _inv = new THREE.Matrix4();

/* which shops put bait out: every tackle counter, and the hermit on the Lost Shores */
const BAIT_SHOPS = new Set(['home', 'tropic', 'frost', 'lost', ...NPCS.filter(n => n.role === 'outfitter').map(n => n.shop)]);
const ACCENT = { home: 0x3a7a3e, tropic: 0xd8703a, frost: 0x5a8ab8, open: 0x7a3a2e, reach: 0x4a4a5a, whisper: 0x4a6a3a, sunscar: 0xb8402a, skywatch: 0x5a8ac8,
  crystal: 0x3aa8b8, frostfall: 0x8ab8d8, dread: 0x4a5a3a, ironwreck: 0x6a5a4a, lost: 0x8a8a8a, thunder: 0x4a4a8a, tide: 0x2a7a9a, crown: 0xc8a030, abyssal: 0x2a2a6a };

export class Showroom {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.group = new THREE.Group();
    this.group.name = 'showroom';
    game.scene.add(this.group);
    this.target = null;
    this.hold = 0;
    this.lock = false;       // bought: wait for E to come up before another
    this.msg = null;         // {text, kind, t}
    this._build();
  }

  /* ---------------- where the shops are ---------------- */
  _anchor(def) {
    const a = this.game.world.settlement.anchors[def.at];
    if (!a) return null;
    return { pos: (a.pos || a).clone(), face: a.face || 0 };
  }
  _build() {
    const S = this.game.world.settlement;
    // tackle: the home shop is Melvin's own floor; every other shop gets a stall by its keeper
    const tag = (id, n0) => { for (const it of this.items.slice(n0)) it.shop = id; };
    for (const id of Object.keys(SHOPS)) {
      const stock = this._tackleStock(id);
      if (!stock.rods.length && !stock.baits.length && !stock.tools.length) continue;
      const n0 = this.items.length;
      if (id === 'home' && S.anchors.tackleShop) this._melvins(S.anchors.tackleShop, stock);
      else {
        const keeper = NPCS.find(n => n.role === 'outfitter' && n.shop === id) || NPCS.find(n => n.role === 'seller' && n.shop === id);
        const A = keeper && this._anchor(keeper);
        if (A) this._stall(id, A, stock);
      }
      tag(id, n0);
      if (stock.pm) for (const it of this.items.slice(n0)) if (it.kind === 'tool') it.pm = stock.pm;
    }
    // boat plans: Marge's shed at home, a drafting pavilion by every other shipwright
    const yards = new Set(HULLS.map(H => H.yard));
    for (const y of yards) {
      const hulls = HULLS.filter(H => H.yard === y);
      const n0 = this.items.length;
      if (y === 'home' && S.anchors.yardShop) this._marges(S.anchors.yardShop, hulls);
      else {
        const wright = NPCS.find(n => n.role === 'boatyard' && (n.yard || 'home') === y);
        const A = wright && this._anchor(wright);
        if (A) this._pavilion(y, A, hulls);
      }
      tag('yard:' + y, n0);
    }
  }
  /** Everything on display at one shop ('home', 'tropic', ... or 'yard:<id>'). */
  at(shop) { return this.items.filter(it => it.shop === shop); }
  _tackleStock(id) {
    // the Fence sells every weapon in the sea (at a Fence's price) and the bait that goes bang
    if (id === 'blackflag') return { rods: [], baits: BAITS.filter(B => B.id === 'explosive' || B.id === 'mystery'), tools: WEAPONS, pm: 1.3 };
    return {
      rods: RODS.filter(R => R.shop === id && R.price > 0),
      baits: BAITS.filter(B => B.shop ? B.shop === id : BAIT_SHOPS.has(id)),
      tools: TOOLS.filter(T => T.price > 0 && shopOf(T) === id && !T.hidden),
    };
  }

  /** Somewhere flat and dry, clear of buildings, near a shopkeeper; facing them. */
  _spot(A, w, d) {
    const C = this.game.world.colliders, S = this.game.world.settlement;
    const R = Math.hypot(w, d) / 2;
    for (let r = 3.5 + R * 0.6; r < 18; r += 0.8) {
      for (let k = 0; k < 20; k++) {
        const a = A.face + Math.PI / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.33;
        const x = A.pos.x + Math.sin(a) * r, z = A.pos.z + Math.cos(a) * r;
        const rot = Math.atan2(A.pos.x - x, A.pos.z - z);
        const c = Math.cos(rot), s = Math.sin(rot);
        let lo = Infinity, hi = -Infinity, ok = true;
        for (const [lx, lz] of [[0, 0], [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2], [0, d / 2], [-w / 2, 0], [w / 2, 0]]) {
          const px = x + lx * c + lz * s, pz = z - lx * s + lz * c, h = heightAt(px, pz);
          if (h < 0.5) { ok = false; break; }
          lo = Math.min(lo, h); hi = Math.max(hi, h);
        }
        if (!ok || hi - lo > 0.45) continue;
        for (const col of C.near(x, z, R + 1)) {
          if (col.y1 < lo - 0.2 || col.y0 > hi + 3) continue;
          if (insideCollider(col, x, z, R * 0.9)) { ok = false; break; }
        }
        if (!ok) continue;
        if (S.blockers.some(B => Math.hypot(B.x - x, B.z - z) < B.r + R * 0.7)) continue;
        if (Math.hypot(A.pos.x - x, A.pos.z - z) < R + 1.2) continue;
        return { x, z, y: hi - 0.04, rot };
      }
    }
    return null;
  }
  /** Put a structure (geo + local colliders) in the world. */
  _place(res, x, z, y, rot) {
    const m = new THREE.Mesh(res.geo, MAT.solid);
    m.position.set(x, y, z); m.rotation.y = rot;
    m.castShadow = true; m.receiveShadow = true;
    m.matrixAutoUpdate = false; m.updateMatrix();
    this.group.add(m);
    const C = this.game.world.colliders, c = Math.cos(rot), s = Math.sin(rot);
    for (const k of res.cols || []) {
      const col = C.box(x + k.x * c + k.z * s, z - k.x * s + k.z * c, k.hw, k.hd, rot, y + k.y0, y + k.y1, k.floor ? 'floor' : 'shop');
      col.floor = !!k.floor;
    }
    return m;
  }
  _frame(x, z, y, rot) {
    const F = new THREE.Group();
    F.position.set(x, y, z); F.rotation.y = rot;
    this.group.add(F);
    F.updateMatrixWorld(true);
    return F;
  }
  _light(F, lx, ly, lz, col = 0xffc890) {
    const w = F.localToWorld(new THREE.Vector3(lx, ly, lz));
    this.game.world.settlement.lights.push({ pos: w, color: col, intensity: 1.4, dist: 9, night: true });
    const b = new MeshBuilder(rng(3));
    b.color(0x2a2a2a).box(0.02, 0.3, 0.02, 0, 0.15, 0);
    const g = new MeshBuilder(rng(4)); g.color(0xffd890).blob(0.07, 0.09, 0.07, 0, -0.02, 0, 6, 3);
    const L = new THREE.Group(); L.add(new THREE.Mesh(b.build(), MAT.solid)); L.add(new THREE.Mesh(g.build(), MAT.glow));
    L.position.set(lx, ly, lz); F.add(L);
  }

  /* ---------------- products ---------------- */
  _item(F, kind, ref, obj, lx, ly, lz, ry = 0, extra = {}) {
    obj.position.set(lx, ly, lz);
    obj.rotation.y = ry;
    F.add(obj);
    F.updateMatrixWorld(true);
    const box = new THREE.Box3();
    // the box in the object's own frame, a touch bigger so a thin rod is easy to look at
    obj.traverse(o => {
      if (!o.isMesh || o.userData.shell) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone();
      const m = new THREE.Matrix4().copy(obj.matrixWorld).invert().multiply(o.matrixWorld);
      box.union(bb.applyMatrix4(m));
    });
    const pad = kind === 'rod' ? 0.06 : 0.03;
    box.expandByVector(new THREE.Vector3(pad, pad * 0.5, pad));
    const mat = addOutline(obj);
    const it = { kind, ref, obj, box, mat, op: 0, center: box.getCenter(new THREE.Vector3()).applyMatrix4(obj.matrixWorld), ...extra };
    this.items.push(it);
    return it;
  }
  _rod(F, R, lx, ly, lz, ry = 0) {
    const r = buildRod(R);
    const s = Math.min(1, 2.05 / r.length);
    r.group.scale.setScalar(s);
    const holder = new THREE.Group();
    holder.add(r.group);
    r.group.rotation.z = 0.05;
    return this._item(F, 'rod', R.id, holder, lx, ly, lz, ry);
  }
  _bait(F, B, lx, ly, lz, ry = 0) { const g = baitDisplay(B); g.scale.setScalar(1.45); const w = new THREE.Group(); w.add(g); return this._item(F, 'bait', B.id, w, lx, ly, lz, ry); }
  _tool(F, T, lx, ly, lz, ry = 0, rz = 0) {
    const g = new THREE.Group(), m = toolMesh(T.id);
    m.rotation.z = rz;
    g.add(m);
    return this._item(F, 'tool', T.id, g, lx, ly, lz, ry);
  }
  _plan(F, H, lx, ly, lz, ry = 0, tilt = 0) {
    const g = planDisplay(H.id);
    g.rotation.x = tilt;
    const w = new THREE.Group(); w.add(g);
    return this._item(F, 'plan', H.id, w, lx, ly, lz, ry);
  }

  /* ---------------- the shops ---------------- */
  /** An island tackle stall by its keeper: rods on the back wall, bait on the table, tools hung at the ends. */
  _stall(id, A, stock) {
    const res = tackleStall(4.6, 2.8, ACCENT[id] || 0x3a7a3e);
    const sp = this._spot(A, res.w, res.d);
    if (!sp) return;
    this._place(res, sp.x, sp.z, sp.y, sp.rot);
    const F = this._frame(sp.x, sp.z, sp.y, sp.rot);
    // the sign
    const name = SHOPS[id]?.outfit || SHOPS[id]?.place || 'Tackle';
    const sg = signBoard(name.toUpperCase(), Math.min(4.2, 0.2 + name.length * 0.13), 0.42);
    sg.position.set(0, res.F + 2.55, res.d / 2 + 0.3); F.add(sg);
    // rods along the back wall
    const nR = stock.rods.length, nT = stock.tools.length;
    stock.rods.forEach((R, i) => this._rod(F, R, -((nR - 1) * 0.62) / 2 + i * 0.62 - (nT ? 0.5 : 0), res.F + 0.3, res.backZ + 0.07));
    stock.tools.forEach((T, i) => this._tool(F, T, res.w / 2 - 0.55 - i * 0.45, res.F + 1.2, res.backZ + 0.1, 0, 0));
    // bait along the table
    const nB = stock.baits.length, span = Math.min(res.tableW, nB * 0.42);
    stock.baits.forEach((B, i) => this._bait(F, B, nB > 1 ? -span / 2 + i * span / (nB - 1) : 0, res.tableY, res.tableZ + (i % 2 ? -0.1 : 0.08), (i % 3 - 1) * 0.2));
    this._light(F, -res.w / 2 + 0.25, res.F + 2.4, res.d / 2 - 0.25);
  }
  /** A shipwright's pavilion: one drafting table per boat she draws. */
  _pavilion(y, A, hulls) {
    const res = planPavilion(hulls.length, 0x24587e);
    const sp = this._spot(A, res.w, res.d);
    if (!sp) return;
    this._place(res, sp.x, sp.z, sp.y, sp.rot);
    const F = this._frame(sp.x, sp.z, sp.y, sp.rot);
    hulls.forEach((H, i) => { const t = res.tables[i]; this._plan(F, H, t.x, t.y, t.z, 0, t.tilt); });
    const sg = signBoard('BOAT PLANS', 2.2, 0.42); sg.position.set(0, res.F + 2.9, res.d / 2 + 0.35); F.add(sg);
    this._light(F, res.w / 2 - 0.3, res.F + 2.7, res.d / 2 - 0.3);
  }
  /** Melvin's shop floor: rods and tools on the walls, bait on shelves, a counter. House frame, door on +Z. */
  _melvins(H, stock) {
    const F = this._frame(H.x, H.z, H.y, H.rot);
    const b = new MeshBuilder(rng(77));
    // back wall rod rack
    b.color(0x5a3e28); b.box(3.4, 0.07, 0.08, -0.6, 0.4, -2.12); b.box(3.4, 0.07, 0.08, -0.6, 2.05, -2.12);
    for (let i = 0; i < 6; i++) b.color(0x4a3322).box(0.05, 0.12, 0.1, -2.1 + i * 0.6, 2.0, -2.08);
    // bait shelves on the left wall (two tiers)
    b.color(0x6a4a30);
    for (const y of [0.55, 1.2]) b.box(0.55, 0.05, 3.2, -2.45, y, -0.2);
    for (const z of [-1.75, 1.35]) b.box(0.5, 1.25, 0.05, -2.45, 0.625, z);
    // tool wall on the right: a pegboard
    b.color(0xb89a70).box(0.05, 1.6, 2.6, 2.7, 1.3, -0.6);
    b.color(0x3a2a1c); for (let i = 0; i < 40; i++) b.box(0.052, 0.025, 0.025, 2.7, 0.6 + (i % 5) * 0.34, -1.8 + Math.floor(i / 5) * 0.34);
    // counter by the door with a cash tin and a coil of line
    b.color(0x6a4630).box(1.3, 0.95, 0.55, 1.9, 0.475, 1.25);
    b.color(0x4a3022).box(1.4, 0.05, 0.62, 1.9, 0.97, 1.25);
    b.color(0x4a6a7a).box(0.26, 0.1, 0.18, 2.2, 1.04, 1.2);
    b.color(0xd8c89a).cyl(0.1, 0.1, 0.99, 1.07, 10, true, 1.6, 1.3);
    // a crate of odds and ends
    buildCrate(b, -1.6, 0, 1.6, 0.6, 0x9a7446, 0.3);
    const m = new THREE.Mesh(b.build(), MAT.solid); m.castShadow = true; m.receiveShadow = true; F.add(m);
    const C = this.game.world.colliders, c = Math.cos(H.rot), s = Math.sin(H.rot);
    const col = (lx, lz, hw, hd, y1) => C.box(H.x + lx * c + lz * s, H.z - lx * s + lz * c, hw, hd, H.rot, H.y - 0.2, H.y + y1, 'shop');
    col(-2.45, -0.2, 0.3, 1.6, 1.3); col(1.9, 1.25, 0.65, 0.3, 1.0); col(-1.6, 1.6, 0.32, 0.32, 0.65);
    // the stock
    stock.rods.forEach((R, i) => this._rod(F, R, -2.0 + i * 0.6, 0.12, -2.06));
    stock.baits.forEach((B, i) => this._bait(F, B, -2.4, i < Math.ceil(stock.baits.length / 2) ? 0.58 : 1.23, -1.4 + (i % Math.ceil(stock.baits.length / 2)) * 0.62, Math.PI / 2));
    stock.tools.forEach((T, i) => {
      const long = T.id === 'harpoon' || T.id === 'net';
      this._tool(F, T, 2.6, long ? 0.35 : 1.35, -1.6 + i * 0.52, -Math.PI / 2, long ? 0 : 0);
    });
    this._light(F, 0, 2.55, 0);
    const L = this.game.world.settlement.lights;
    L.push({ pos: F.localToWorld(new THREE.Vector3(0, 2.3, -0.5)), color: 0xffd0a0, intensity: 1.8, dist: 8, night: false, interior: true });
  }
  /** Marge's shed: the plans on drafting tables along the left wall, clear of the boat on the trestles. */
  _marges(H, hulls) {
    const F = this._frame(H.x, H.z, H.y, H.rot);
    const b = new MeshBuilder(rng(78));
    const C = this.game.world.colliders, c = Math.cos(H.rot), s = Math.sin(H.rot);
    hulls.forEach((Hh, i) => {
      const z = -0.9 + i * 1.45, x = -3.25;
      b.color(0x7a5a3a); b.push(x, 0.9, z, 0, 0, 0.12); b.box(0.8, 0.06, 1.25, 0, 0, 0); b.pop();
      b.color(0x4a3322); for (const lx of [-0.32, 0.32]) for (const lz of [-0.55, 0.55]) b.box(0.07, 0.88, 0.07, x + lx, 0.44, z + lz);
      C.box(H.x + x * c + z * s, H.z - x * s + z * c, 0.42, 0.66, H.rot, H.y - 0.2, H.y + 0.95, 'shop');
      this._plan(F, Hh, x + 0.02, 0.95, z, Math.PI / 2, -0.12);
    });
    // a pinned plan on the back wall
    b.color(0x2a5a8a).box(1.8, 1.0, 0.02, -1.2, 1.9, -2.85);
    b.color(0xe8f0f8); for (let k = 0; k <= 8; k++) { const t = k / 8; b.box(0.2, 0.012, 0.005, -2.0 + t * 1.6, 1.9 + 0.3 * Math.sin(Math.PI * t) ** 0.5, -2.835); b.box(0.2, 0.012, 0.005, -2.0 + t * 1.6, 1.9 - 0.3 * Math.sin(Math.PI * t) ** 0.5, -2.835); }
    const m = new THREE.Mesh(b.build(), MAT.solid); m.castShadow = true; m.receiveShadow = true; F.add(m);
    const L = this.game.world.settlement.lights;
    L.push({ pos: F.localToWorld(new THREE.Vector3(-2.2, 2.8, 0.5)), color: 0xffd0a0, intensity: 1.6, dist: 9, night: false, interior: true });
  }

  /* ---------------- what you can buy ---------------- */
  info(it) {
    const s = this.game.state.s;
    if (it.kind === 'rod') { const R = ROD_BY_ID[it.ref]; return { name: R.name, price: R.price, owned: s.rods.includes(R.id), sub: 'Tier ' + R.tier + ' rod' }; }
    if (it.kind === 'bait') { const B = BAIT_BY_ID[it.ref]; return { name: B.name + '  x' + B.pack, price: B.price * B.pack, owned: false, sub: (s.baits[B.id] || 0) ? 'You have ' + s.baits[B.id] : 'Bait' }; }
    if (it.kind === 'tool') { const T = TOOL_BY_ID[it.ref]; return { name: T.name, price: Math.round(T.price * (it.pm || 1)), owned: !!s.tools[T.id], sub: T.kind === 'weapon' ? (it.pm ? 'Weapon - no questions asked' : 'Weapon') : 'Tool' }; }
    if (it.kind === 'plan') { const H = HULL_BY_ID[it.ref]; return { name: H.name + ' - boat plans', price: planPrice(H), owned: (s.boatPlans || []).includes(H.id), sub: 'Build her yourself at the water' }; }
    return { name: it.name || '?', price: it.price || 0, owned: false };
  }
  _buy(it) {
    const G = this.game, I = this.info(it);
    if (I.owned) return;
    if (G.state.s.money < I.price) {
      this.msg = { text: 'NOT ENOUGH MONEY', kind: 'bad', t: 1.6 };
      G.audio.deny();
      return;
    }
    const k = { rod: 'rod', bait: 'bait', tool: 'tool', plan: 'hull' }[it.kind];
    G.act({ t: 'buy', k, id: it.ref, quiet: true, pm: it.pm || 1 });
    if (!G.isHost) G.state.s.money -= I.price;           // the host's save follows in a moment
    this.msg = { text: it.kind === 'bait' ? 'ADDED TO YOUR BAIT' : it.kind === 'plan' ? 'IN YOUR BLUEPRINT BOOK' : 'IN YOUR INVENTORY', kind: 'good', t: 1.6 };
    this.pop = { it, t: 0 };
    G.audio.buy();
    G.fx.sparks(it.center.x, it.center.y + 0.1, it.center.z, 14, 0xffe08a);
  }

  /* ---------------- every frame ---------------- */
  /** Returns true when something is being looked at (the E key belongs to the shop then). */
  update(dt, input, blocked) {
    const G = this.game, P = G.player;
    let tgt = null;
    if (!blocked && P.mode === 'walk' && !P.boat) {
      const cam = G.camera;
      cam.getWorldPosition(_o); cam.getWorldDirection(_d);
      let best = REACH;
      for (const it of this.items) {
        if (it.center.distanceToSquared(P.pos) > 64) continue;
        _inv.copy(it.obj.matrixWorld).invert();
        _ray.origin.copy(_o).applyMatrix4(_inv);
        _ray.direction.copy(_d).transformDirection(_inv);
        // transformDirection normalises: rescale the hit distance back to world units
        if (!_ray.intersectBox(it.box, _hit)) continue;
        const t = _hit.applyMatrix4(it.obj.matrixWorld).distanceTo(_o);
        const bias = it === this.target ? 0.25 : 0;          // a little stickiness, so it does not flicker between neighbours
        if (t - bias < best) { best = t - bias; tgt = it; }
      }
    }
    if (tgt !== this.target) { this.target = tgt; this.hold = 0; if (tgt) G.audio.hover?.(); }
    // the outline: fades in on what you look at, out on everything else
    for (const it of this.items) {
      const want = it === tgt ? 1 : 0;
      it.op += (want - it.op) * Math.min(1, dt * 12);
      if (it.op < 0.01 && want === 0) { if (it.shown) { for (const sh of it.obj.userData.shells) sh.visible = false; it.shown = false; } continue; }
      if (!it.shown) { for (const sh of it.obj.userData.shells) sh.visible = true; it.shown = true; }
      it.mat.uniforms.uOp.value = it.op * 0.9;
    }
    // holding E
    const E = input.held('KeyE');
    if (!E) this.lock = false;
    if (tgt && E && !this.lock) {
      const I = this.info(tgt);
      if (!I.owned) {
        const was = this.hold;
        this.hold = Math.min(1, this.hold + dt / HOLD);
        if (Math.floor(was * 6) !== Math.floor(this.hold * 6)) G.audio.tone(520 + this.hold * 380, 0.05, 'sine', 0.025);
        if (this.hold >= 1) { this._buy(tgt); this.hold = 0; this.lock = true; }
      }
    } else this.hold = Math.max(0, this.hold - dt * 6);
    // a little hop when something is bought
    if (this.pop) {
      const p = this.pop; p.t += dt;
      const k = Math.min(1, p.t / 0.35);
      p.it.obj.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.12);
      if (k >= 1) { p.it.obj.scale.setScalar(1); this.pop = null; }
    }
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    G.ui.buyPrompt(tgt ? { ...this.info(tgt), hold: this.hold, msg: this.msg } : null);
    return !!tgt;
  }
}
