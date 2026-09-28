/* Gather.js - taking the islands apart, one swing at a time.

   Every tree, rock, bush and log that Scatter planted is a node you can
   work: the AXE (0) for wood and fibre, the PICKAXE (-) for stone, iron
   and crystal. Each blow is a real hit on a real thing - the tree shudders
   and throws chips back at you, the rock loses a chunk and gets smaller -
   and when it gives, a tree actually falls: it tips, speeds up, hits the
   ground with a thump and breaks into logs you can pick up. Everything
   that comes off lands as a physical piece in the world; walk over it (or
   press F) and it goes into the crew's pack.

   Host-authoritative like everything else: a client sends 'hit', the host
   counts the damage and tells everyone what happened. What has been felled
   is saved (s.felled, id -> day) and grows back after a few days.

   A node's id is its instance: `${variant}:${geo}@${block}#${index}`. */

import * as THREE from '../../lib/three.module.js';
import { HARVEST, MAT_BY_ID, REGROW_DAYS } from '../data/BuildData.js';
import { pieceMesh } from '../art/BuildArt.js';
import { uid, clamp, rng } from '../core/Util.js';
import { MeshBuilder, shadeHex } from '../art/Geo.js';
import { MAT } from '../art/Materials.js';

const BLOCK = 200;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3();
const CHIP = { axe: 0xc8985a, pick: 0x9a9a92 };
/* How thick each trunk is where you chop it (x the tree's scale), how high that is, and how many sides it has to be cut from. */
const TRUNK = { pine: 0.4, snowpine: 0.4, broad: 0.33, birch: 0.33, palm: 0.26, dead: 0.21, deaddark: 0.21, ash: 0.21, giant: 1.55, mangrove: 0.29 };
const CHOPY = { giant: 1.4, mangrove: 1.9 };
const sidesOf = key => key === 'giant' ? 10 : 6;
const WOODFACE = 0xe8c890, WOODRIM = 0xb88a58, BARKC = 0x4a3526;
/* A notch: pale fresh wood where the bark was, darker at the rims. depth 1 or 2. */
const notchCache = {};
function notchGeo(depth) {
  if (notchCache[depth]) return notchCache[depth];
  const b = new MeshBuilder(rng(depth + 3));
  const h = 0.22 + depth * 0.08;
  // fresh wood where the bark came off: an upper face lit from above, a lower face in shade, a dark crease where they meet
  b.color(WOODFACE).box(1.0, h * 0.5, 0.03, 0, h * 0.25, 0.012);
  b.color(shadeHex(WOODFACE, 0.8)).box(1.0, h * 0.5, 0.03, 0, -h * 0.25, 0.012);
  b.color(0x7a5230).box(1.01, 0.018 + depth * 0.012, 0.035, 0, 0, 0.015);
  // splinters and the torn bark lip round it
  b.color(WOODRIM).box(1.02, 0.025, 0.045, 0, h / 2, 0.01).box(1.02, 0.025, 0.045, 0, -h / 2, 0.01);
  b.color(0xf4dcae); for (let i = 0; i < 3 + depth; i++) b.box(0.05, 0.014, 0.05, -0.35 + i * 0.25, h * (0.18 + (i % 2) * 0.12), 0.03);
  return (notchCache[depth] = b.build());
}
/* A chunk of bark and wood, or a lump of rock, knocked off by a swing. */
const chunkCache = {};
function chunkGeo(kind) {
  if (chunkCache[kind]) return chunkCache[kind];
  const b = new MeshBuilder(rng(kind.length));
  if (kind === 'wood') { b.color(BARKC).box(0.16, 0.1, 0.05, 0, 0, 0.02); b.color(WOODFACE).box(0.15, 0.09, 0.05, 0, 0, -0.025); }
  else if (kind === 'crystal') { b.color(0x9ae8f0).cyl(0.03, 0.06, -0.05, 0.03, 5, true); b.color(0xd8fcff).cone(0.06, 0.03, 0.12, 5); }
  else { b.color(kind === 'dark' ? 0x3a3434 : 0x8e8e88, 0.15).lump(0.11, 0, 0, 0, 0.35, 0.8); }
  return (chunkCache[kind] = b.build());
}
const LEAF = { pine: 0x2e5a2e, snowpine: 0xe8f0f4, broad: 0x4a8a3a, birch: 0x8ab84a, palm: 0x5a9a3a, giant: 0x2a4a2a, mangrove: 0x3a5a2a };

export class Gather {
  constructor(game) {
    this.game = game;
    this.flora = game.world.flora;
    this.mesh = new Map();         // block key -> InstancedMesh
    for (const [k, blk] of this.flora.blocks) blk.k = k;
    for (const m of this.flora.meshes) this.mesh.set(m.userData.blk.k, m);
    this.hp = new Map();           // host: node id -> hits left
    this.cuts = new Map();         // host: tree id -> depth cut on each side of the trunk
    this.notches = new Map();      // everyone: tree id -> the notch meshes
    this.debris = [];              // chunks flying off
    this.gone = new Set();         // node ids hidden on this screen
    this.cols = new Map();         // node id -> colliders taken away
    this.stumps = new Map();       // node id -> stump mesh
    this.wobbles = [];
    this.falling = [];
    this.pieces = new Map();       // id -> {id, k, pos, vel, mesh, t, rest}
    this.syncT = 0; this.regrowT = 5;
    this.picked = new Map();       // piece id -> time we asked for it
    this.hand = null;              // for tests: the last target found
  }

  /* ---------------- nodes ---------------- */
  node(id) {
    const h = id.lastIndexOf('#');
    const blk = this.flora.blocks.get(id.slice(0, h));
    if (!blk) return null;
    const i = +id.slice(h + 1), it = blk.list[i];
    const def = HARVEST[blk.key];
    if (!it || !def) return null;
    return { id, blk, i, it, def, key: blk.key, mesh: this.mesh.get(blk.k) };
  }
  /** The workable thing in front of you with this tool, if any. `any` ignores the tool (for hints). */
  target(P, tool, any = false) {
    const px = P.pos.x, pz = P.pos.z;
    const f = P.flatForward(_v).clone();
    const bx = Math.floor(px / BLOCK), bz = Math.floor(pz / BLOCK);
    let best = null, bd = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const bk = (bx + dx) + ',' + (bz + dz);
      for (const key in HARVEST) {
        const def = HARVEST[key];
        if (!any && def.tool !== tool) continue;
        const V = this.flora.V[key];
        if (!V) continue;
        for (let vi = 0; vi < V.geos.length; vi++) {
          const k = key + ':' + vi + '@' + bk, blk = this.flora.blocks.get(k);
          if (!blk) continue;
          for (let i = 0; i < blk.list.length; i++) {
            const it = blk.list[i];
            const ox = it[0] - px, oz = it[2] - pz;
            if (Math.abs(ox) > 5 || Math.abs(oz) > 5) continue;
            const d = Math.hypot(ox, oz), reach = def.r * it[3] + 1.4;
            if (d > reach) continue;
            if (Math.abs(it[1] - P.pos.y) > 3.5) continue;
            // in front of you (the thing you are standing inside counts too)
            if (d > 0.6 && (ox * f.x + oz * f.z) / d < 0.45) continue;
            const id = k + '#' + i;
            if (this.gone.has(id)) continue;
            const score = d - reach * 0.3;
            if (score < bd) { bd = score; best = { id, blk, i, it, def, key }; }
          }
        }
      }
    }
    return best;
  }

  /** The instance's own matrix, optionally tilted toward (dx,dz) by `tilt` and scaled by `k`. */
  _matrix(it, tilt = 0, dx = 0, dz = 0, k = 1) {
    _e.set(it[5], it[4], 0);
    _q.setFromEuler(_e);
    if (tilt) { _ax.set(dz, 0, -dx).normalize(); _q2.setFromAxisAngle(_ax, tilt); _q.premultiply(_q2); }
    const s = it[3] * k;
    return _m.compose(_v.set(it[0], it[1], it[2]), _q, _s.set(s, s, s));
  }
  _setInst(n, M) {
    if (!n.mesh) return;
    n.mesh.setMatrixAt(n.i, M);
    n.mesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------------- swinging (local) ---------------- */
  /** Left mouse with the axe or the pickaxe. */
  swing(tool) {
    const G = this.game, P = G.player;
    const now = G.world.time;
    if (now - (this._swingT || -9) < 0.5) return;
    this._swingT = now;
    G.vm.play('chop');
    G.audio.swoosh();
    setTimeout(() => {
      if (!G.running) return;
      const T = this.target(P, tool);
      this.hand = T;
      if (!T) {
        const other = this.target(P, tool === 'axe' ? 'pick' : 'axe');
        if (other && now - (this._hintT || -99) > 4) { this._hintT = now; G.ui.toast(tool === 'axe' ? 'That needs the pickaxe (-).' : 'That needs the axe (0).', 'info'); }
        return;
      }
      const f = P.flatForward(new THREE.Vector3());
      G.act({ t: 'hit', id: T.id, tool, dir: [+f.x.toFixed(2), +f.z.toFixed(2)], at: [+P.pos.x.toFixed(2), +P.pos.z.toFixed(2)] });
    }, 190);
  }

  /* ---------------- the host ---------------- */
  hostHit(c, from) {
    const G = this.game, s = G.state.s;
    const n = this.node(c.id);
    if (!n || this.gone.has(c.id) || n.def.tool !== c.tool) return;
    const dir = c.dir || [0, 1];
    if (n.def.fall) return this._hostCut(c, n, dir, from);
    // an iron tool does twice the work
    const hp = (this.hp.get(c.id) ?? n.def.hp) - (s.upg?.[c.tool] ? 2 : 1);
    this.hp.set(c.id, hp);
    const at = new THREE.Vector3(n.it[0], n.it[1] + Math.min(1.2, 0.5 * n.it[3] + 0.4), n.it[2]);
    if (n.def.chip && hp > 0) this.spawn(n.def.chip[0], at.clone().addScaledVector(new THREE.Vector3(-dir[0], 0, -dir[1]), 0.8), new THREE.Vector3(-dir[0] * 2, 3, -dir[1] * 2));
    if (hp > 0) { G._everyone({ t: 'gather', k: 'hit', id: c.id, hp, max: n.def.hp, dir }); return; }
    this._give(c, n, dir, from);
  }

  /* A tree is cut round its trunk: the swing takes a notch out of the side
     facing you, and it only comes down once the notches go all the way
     round. Hitting the same notch again only deepens it. */
  _hostCut(c, n, dir, from) {
    const G = this.game, s = G.state.s;
    const N = sidesOf(n.key);
    const cut = this.cuts.get(c.id) || new Array(N).fill(0);
    this.cuts.set(c.id, cut);
    // which side of the trunk you are standing on
    const px = c.at ? c.at[0] : n.it[0] - dir[0], pz = c.at ? c.at[1] : n.it[2] - dir[1];
    const a = Math.atan2(px - n.it[0], pz - n.it[2]);
    const k = ((Math.round(a / (Math.PI * 2 / N)) % N) + N) % N;
    const iron = !!s.upg?.axe;
    const before = cut.filter(x => x > 0).length;
    cut[k] = Math.min(2, cut[k] + (iron ? 2 : 1));
    if (iron) { cut[(k + 1) % N] = Math.max(cut[(k + 1) % N], 1); cut[(k + N - 1) % N] = Math.max(cut[(k + N - 1) % N], 1); }
    const done = cut.every(x => x > 0);
    // it falls away from the last cut
    if (done) { this.cuts.delete(c.id); this._give(c, n, [-Math.sin(a), -Math.cos(a)], from, cut); return; }
    const open = cut.filter(x => x > 0).length;
    G._everyone({ t: 'gather', k: 'cut', id: c.id, cut: cut.join(''), side: k, dir, open, of: N, fresh: open > before });
  }

  _give(c, n, dir, from, cut = null) {
    const G = this.game, s = G.state.s;
    const at = new THREE.Vector3(n.it[0], n.it[1] + Math.min(1.2, 0.5 * n.it[3] + 0.4), n.it[2]);
    // it gives
    this.hp.delete(c.id);
    (s.felled = s.felled || {})[c.id] = s.day;
    G._saveDirty = true;
    s.stats.gathered = (s.stats.gathered || 0) + 1;
    G._everyone({ t: 'gather', k: n.def.fall ? 'fell' : 'break', id: c.id, dir, cut: cut ? cut.join('') : undefined });
    const drop = (delay, pts) => setTimeout(() => {
      for (const [m, q] of n.def.give) for (let k = 0; k < q; k++) {
        const p = pts(k, q);
        this.spawn(m, p, new THREE.Vector3((Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2));
      }
    }, delay);
    if (n.def.fall) {
      // the logs lie along where the trunk came down
      const len = 6 * n.it[3];
      drop(1900, (k, q) => new THREE.Vector3(n.it[0] + dir[0] * len * (0.2 + 0.7 * k / Math.max(1, q)), n.it[1] + 0.6, n.it[2] + dir[1] * len * (0.2 + 0.7 * k / Math.max(1, q))));
    } else drop(60, () => at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.2, (Math.random() - 0.5) * 0.8)));
    if (Object.keys(s.felled).length >= 25) G.award('woodsman', from);
  }

  /** A loose piece of material in the world (host). */
  spawn(k, pos, vel = new THREE.Vector3()) {
    const P = { id: uid('m'), k, pos: pos.clone(), vel: vel.clone(), t: 0, rest: false, ry: Math.random() * 6.28 };
    this._addPiece(P);
    return P;
  }
  _addPiece(P) {
    P.mesh = pieceMesh(P.k);
    P.mesh.position.copy(P.pos);
    this.game.scene.add(P.mesh);
    this.pieces.set(P.id, P);
  }
  _removePiece(id) {
    const P = this.pieces.get(id);
    if (!P) return;
    this.game.scene.remove(P.mesh);
    this.pieces.delete(id);
  }
  hostPick(c, from) {
    const G = this.game, s = G.state.s, P = this.pieces.get(c.id);
    if (!P) return;
    this._removePiece(c.id);
    s.mats = s.mats || {};
    s.mats[P.k] = (s.mats[P.k] || 0) + 1;
    G._saveDirty = true;
    G._everyone({ t: 'gather', k: 'got', m: P.k, n: s.mats[P.k], by: from });
  }

  /* ---------------- what everyone sees ---------------- */
  onEvent(e) {
    const G = this.game, n = this.node(e.id || '');
    if (e.k === 'got') {
      if (e.by === G.player.id || e.by === G.net?.selfId || (!G.net?.isOnline)) {
        G.audio.pickup();
        const M = MAT_BY_ID[e.m];
        this._gotN = (this._gotT > G.world.time - 1.2 && this._gotM === e.m ? this._gotN : 0) + 1;
        this._gotM = e.m; this._gotT = G.world.time;
        G.ui.toast(`+${this._gotN} ${M ? M.name : e.m}  (${e.n} in your pack)`, 'good');
      }
      return;
    }
    if (!n) return;
    const [dx, dz] = e.dir || [0, 1];
    const at = new THREE.Vector3(n.it[0], n.it[1] + Math.min(1.3, 0.5 * n.it[3] + 0.5), n.it[2]);
    const wood = n.def.tool === 'axe';
    const tree = !!n.def.fall;
    if (e.k === 'hit' || e.k === 'fell' || e.k === 'break') {
      if (wood) G.audio.chopWood(at); else G.audio.pickStone(at);
      G.fx.chips(at.x - dx * 0.3, at.y, at.z - dz * 0.3, n.key === 'crystal' ? 0x9ae8f0 : n.key === 'lavarock' || n.key === 'spire' ? 0x3a3434 : CHIP[n.def.tool], wood ? 10 : 14, -dx, -dz);
      if (!wood) G.fx.sparks(at.x - dx * 0.3, at.y, at.z - dz * 0.3, 5, 0xffe8a0);
      if (tree && LEAF[n.key] && Math.random() < 0.7) G.fx.leaves(n.it[0], n.it[1] + 5 * n.it[3], n.it[2], 6, LEAF[n.key]);
    }
    if (e.k === 'cut') {
      G.audio.chopWood(at);
      const sideA = e.side / e.of * Math.PI * 2;
      const P0 = this._trunkPoint(n, sideA);
      G.fx.chips(P0.x, P0.y, P0.z, CHIP.axe, 12, Math.sin(sideA) * 0.8, Math.cos(sideA) * 0.8);
      if (LEAF[n.key] && Math.random() < 0.6) G.fx.leaves(n.it[0], n.it[1] + 5 * n.it[3], n.it[2], 5, LEAF[n.key]);
      this._chunk(P0, sideA, 'wood');
      this._notches(n, e.cut);
      (this.lastCut = this.lastCut || new Map()).set(n.id, e.cut);
      this.wobbles.push({ n, t: 0, dx, dz, a: 0.05 });
      // tell the one who swung how far round they are
      if (e.fresh && G.player.pos.distanceTo(P0) < 4) G.ui.toast(e.open < e.of ? `Cut ${e.open} of ${e.of} sides - keep working round the trunk.` : '', 'info');
      else if (!e.fresh && G.player.pos.distanceTo(P0) < 4 && (this._roundT || 0) < G.world.time) { this._roundT = G.world.time + 4; G.ui.toast('That side is cut. Walk round the trunk and cut the next one.', 'info'); }
      return;
    }
    if (e.k === 'hit') {
      if (!wood) {
        // a lump breaks off the side you hit
        this._chunk(new THREE.Vector3(at.x - dx * 0.5 * n.it[3], at.y, at.z - dz * 0.5 * n.it[3]), Math.atan2(-dx, -dz), n.key === 'crystal' ? 'crystal' : n.key === 'lavarock' || n.key === 'spire' ? 'dark' : 'stone');
        // a rock loses a piece every time: it gets smaller
        const k = 0.55 + 0.45 * e.hp / e.max;
        n.shrink = k;
        this._setInst(n, this._matrix(n.it, 0, 0, 0, k));
      } else this.wobbles.push({ n, t: 0, dx, dz, a: tree ? 0.06 : 0.12 });
    }
    if (e.k === 'fell') this._gone(e.id, { dx, dz });
    if (e.k === 'break') { this._gone(e.id, null); G.fx.dust(n.it[0], n.it[1], n.it[2], 12, Math.min(2, n.it[3])); if (!wood) G.audio.crack(); }
  }

  /** The point on the trunk's surface at chopping height on the side at angle a (0 = +z). */
  _trunkPoint(n, a, inset = 0) {
    const r = (TRUNK[n.key] || 0.3) * n.it[3] - inset;
    return new THREE.Vector3(n.it[0] + Math.sin(a) * r, n.it[1] + (CHOPY[n.key] || 0.95) * Math.min(1.2, n.it[3]), n.it[2] + Math.cos(a) * r);
  }
  /** Draw the notches cut so far (cut: a string of depths, one per side). */
  _notches(n, cut) {
    const G = this.game;
    const old = this.notches.get(n.id);
    if (old) G.scene.remove(old);
    if (!cut) { this.notches.delete(n.id); return; }
    const g = new THREE.Group();
    const N = cut.length, r = (TRUNK[n.key] || 0.3) * n.it[3], w = 2 * Math.PI * r / N * 1.04;
    for (let k = 0; k < N; k++) {
      const d = +cut[k];
      if (!d) continue;
      const a = k / N * Math.PI * 2;
      const m = new THREE.Mesh(notchGeo(d), MAT.solid);
      m.position.copy(this._trunkPoint(n, a, (TRUNK[n.key] || 0.3) * n.it[3] * 0.06));
      m.rotation.y = a;
      m.scale.set(w, Math.max(0.7, n.it[3]), Math.max(0.8, n.it[3]));
      m.castShadow = true;
      g.add(m);
    }
    G.scene.add(g);
    this.notches.set(n.id, g);
  }
  /** A chunk knocked off at p, flying out along angle a, then lying on the ground a while. */
  _chunk(p, a, kind) {
    const G = this.game;
    const m = new THREE.Mesh(chunkGeo(kind), kind === 'crystal' ? MAT.glow : MAT.solid);
    m.position.copy(p);
    m.castShadow = true;
    G.scene.add(m);
    const s = 1.8 + Math.random() * 1.6;
    this.debris.push({ m, v: new THREE.Vector3(Math.sin(a) * s + (Math.random() - 0.5), 2 + Math.random() * 2.5, Math.cos(a) * s + (Math.random() - 0.5)), w: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), t: 0 });
    if (this.debris.length > 60) G.scene.remove(this.debris.shift().m);
  }

  /** Hide a node (with a fall if `fall`), leave a stump, take its collider away. */
  _gone(id, fall) {
    const G = this.game;
    if (this.gone.has(id)) return;
    const n = this.node(id);
    if (!n) return;
    this.gone.add(id);
    this._notches(n, null);
    _m.makeScale(0, 0, 0);
    this._setInst(n, _m);
    this.wobbles = this.wobbles.filter(w => w.n.id !== id);
    // colliders at this spot
    const took = [];
    for (const c of G.world.colliders.near(n.it[0], n.it[2], 1)) if (Math.abs(c.x - n.it[0]) < 0.01 && Math.abs(c.z - n.it[2]) < 0.01) took.push(c);
    for (const c of took) G.world.colliders.remove(c);
    this.cols.set(id, took);
    if (n.def.fall) {
      const V = this.flora.V.stump;
      const st = new THREE.Mesh(V.geos[0], V.mat);
      st.position.set(n.it[0], n.it[1] + 0.05, n.it[2]);
      st.rotation.y = n.it[4];
      st.scale.setScalar(Math.min(1.6, n.it[3] * 0.85) * (n.key === 'giant' ? 2.4 : 1));
      st.castShadow = true;
      G.scene.add(st);
      this.stumps.set(id, st);
    }
    if (fall) {
      const V = this.flora.V[n.key];
      const m = new THREE.Mesh(V.geos[n.blk.vi], V.mat);
      m.castShadow = true;
      this._matrix(n.it);
      m.matrixAutoUpdate = false;
      m.matrix.copy(_m);
      G.scene.add(m);
      this.falling.push({ m, n, t: 0, dx: fall.dx, dz: fall.dz, landed: false });
      G.audio.crack(); G.audio.treeFall(new THREE.Vector3(n.it[0], n.it[1], n.it[2]));
    }
  }
  _restore(id) {
    const G = this.game, n = this.node(id);
    this.gone.delete(id);
    this.cuts.delete(id);
    if (!n) return;
    this._notches(n, null);
    this._setInst(n, this._matrix(n.it));
    for (const c of this.cols.get(id) || []) G.world.colliders._add(c, c.t === 'c' ? c.r : Math.hypot(c.hw, c.hd));
    this.cols.delete(id);
    const st = this.stumps.get(id);
    if (st) { G.scene.remove(st); this.stumps.delete(id); }
  }

  /* ---------------- every frame ---------------- */
  update(dt, host) {
    const G = this.game, s = G.state.s;
    // what the save says is gone, on every screen (a guest learns it from the host's save)
    this.syncT -= dt;
    if (this.syncT <= 0) {
      this.syncT = 1;
      const F = s.felled || {};
      for (const id in F) if (!this.gone.has(id)) this._gone(id, null);
      for (const id of [...this.gone]) if (!F[id]) this._restore(id);
    }
    // the island grows back while nobody is looking
    if (host) {
      this.regrowT -= dt;
      if (this.regrowT <= 0) {
        this.regrowT = 10;
        const F = s.felled || {};
        for (const id in F) {
          if (s.day - F[id] < REGROW_DAYS) continue;
          const n = this.node(id);
          if (n && G.allPlayers().some(P => P.pos && Math.hypot(P.pos.x - n.it[0], P.pos.z - n.it[2]) < 60)) continue;
          delete F[id];
          G._saveDirty = true;
        }
      }
    }
    // shudders
    for (let i = this.wobbles.length - 1; i >= 0; i--) {
      const W = this.wobbles[i];
      W.t += dt;
      const k = W.t / 0.45;
      if (k >= 1) { this._setInst(W.n, this._matrix(W.n.it)); this.wobbles.splice(i, 1); continue; }
      this._setInst(W.n, this._matrix(W.n.it, Math.sin(k * 14) * W.a * (1 - k), W.dx, W.dz));
    }
    // falling trees: tip, speed up, hit the ground, bounce once, lie there, go
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const F = this.falling[i], it = F.n.it;
      F.t += dt;
      const t = F.t;
      let a = t < 1.25 ? Math.pow(t / 1.25, 2.2) * 1.48 : 1.48 - Math.sin(Math.min(1, (t - 1.25) / 0.3) * Math.PI) * 0.08;
      if (t >= 1.25 && !F.landed) {
        F.landed = true;
        const p = new THREE.Vector3(it[0] + F.dx * 4 * it[3], it[1], it[2] + F.dz * 4 * it[3]);
        G.audio.timber(p);
        G.fx.dust(p.x, G.world.ground(p.x, p.z), p.z, 30, 2);
        if (LEAF[F.n.key]) G.fx.leaves(p.x, p.y + 1, p.z, 16, LEAF[F.n.key]);
        if (G.player.pos.distanceTo(p) < 25) G.addShake(0.35);
      }
      this._matrix(it, a, F.dx, F.dz);
      F.m.matrix.copy(_m);
      if (t > 2.4) { F.m.position.set(0, -0.5 * (t - 2.4), 0); F.m.matrix.elements[13] -= (t - 2.4) * 1.5; }
      if (t > 3.1) { G.scene.remove(F.m); this.falling.splice(i, 1); }
    }
    // chunks knocked off: fly, bounce, lie there a while, sink into the ground
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const D = this.debris[i];
      D.t += dt;
      const g = G.world.ground(D.m.position.x, D.m.position.z);
      if (!D.rest) {
        D.v.y -= 9.8 * dt;
        D.m.position.addScaledVector(D.v, dt);
        D.m.rotation.x += D.w.x * dt; D.m.rotation.y += D.w.y * dt; D.m.rotation.z += D.w.z * dt;
        if (D.m.position.y < g + 0.03) { D.m.position.y = g + 0.03; if (Math.abs(D.v.y) < 1.2) D.rest = true; else { D.v.y *= -0.3; D.v.x *= 0.5; D.v.z *= 0.5; D.w.multiplyScalar(0.5); } }
      } else if (D.t > 8) D.m.position.y -= dt * 0.05;
      if (D.t > 10) { G.scene.remove(D.m); this.debris.splice(i, 1); }
    }
    // loose pieces
    const P = G.player;
    for (const M of this.pieces.values()) {
      M.t += dt;
      if (host && !M.rest) {
        M.vel.y -= 9.8 * dt;
        M.pos.addScaledVector(M.vel, dt);
        const g = G.world.ground(M.pos.x, M.pos.z), sea = G.world.waterAt(M.pos.x, M.pos.z);
        const floats = M.k === 'wood' || M.k === 'fibre';
        if (floats && sea > -Infinity && M.pos.y < sea) { M.pos.y = sea; M.vel.multiplyScalar(0.8); M.vel.y = 0; }
        else if (M.pos.y < g + 0.1) { M.pos.y = g + 0.1; if (Math.abs(M.vel.y) < 1.5) { M.vel.set(0, 0, 0); M.rest = true; } else { M.vel.y *= -0.3; M.vel.x *= 0.5; M.vel.z *= 0.5; } }
      }
      if (host && M.rest && M.k === 'wood') { const sea = G.world.waterAt(M.pos.x, M.pos.z); if (sea > -Infinity && sea > M.pos.y) M.rest = false; }
      if (host && M.t > 900) { this._removePiece(M.id); continue; }
      M.mesh.position.copy(M.pos);
      M.mesh.rotation.set(M.rest ? 0 : M.t * 3, M.ry, M.k === 'wood' ? 0 : M.t);
      // walk over it and it is yours
      if (M.t > 0.9 && P.pos.distanceTo(M.pos) < 1.7 && (this.picked.get(M.id) || -9) < G.world.time - 1.5) {
        this.picked.set(M.id, G.world.time);
        G.act({ t: 'mpick', id: M.id });
      }
    }
  }

  snapshot() { return [...this.pieces.values()].map(M => [M.id, M.k, +M.pos.x.toFixed(2), +M.pos.y.toFixed(2), +M.pos.z.toFixed(2)]); }
  applySnapshot(list) {
    if (!list) return;
    const seen = new Set();
    for (const [id, k, x, y, z] of list) {
      seen.add(id);
      let M = this.pieces.get(id);
      if (!M) { M = { id, k, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), t: 1, rest: true, ry: Math.random() * 6.28 }; this._addPiece(M); }
      M.pos.lerp(_v.set(x, y, z), 0.5);
    }
    for (const id of [...this.pieces.keys()]) if (!seen.has(id)) this._removePiece(id);
  }

  /** The thing you are about to hit, for the prompt. */
  hint(P) {
    const tool = P.tool;
    if (tool !== 'axe' && tool !== 'pick') return null;
    // looked up a few times a second, not every frame
    const now = this.game.world.time;
    if (this._hintAt && now - this._hintAt.t < 0.2 && this._hintAt.tool === tool) return this._hintAt.h;
    const h = this._hint(P, tool);
    this._hintAt = { t: now, tool, h };
    return h;
  }
  _hint(P, tool) {
    const T = this.target(P, tool);
    if (!T) return null;
    if (T.def.fall) {
      const N = sidesOf(T.key), c = this.lastCut?.get(T.id);
      const open = c ? [...c].filter(x => x !== '0').length : 0;
      return { T, text: open ? `Chop round the trunk (${open} of ${N} sides cut)` : `Chop the tree - cut it all the way round (${N} sides)` };
    }
    const hp = this.hp.get(T.id) ?? T.def.hp;
    return { T, text: (tool === 'axe' ? (T.def.fall ? 'Chop the tree' : 'Cut it') : 'Break the rock') + (T.def.hp > 1 ? ` (${clamp(hp, 0, T.def.hp)} more)` : '') };
  }
}
