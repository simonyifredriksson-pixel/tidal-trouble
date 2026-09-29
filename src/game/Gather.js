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
import { MeshBuilder, shadeHex, mixHex } from '../art/Geo.js';
import { MAT } from '../art/Materials.js';

const BLOCK = 200;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3();
const CHIP = { axe: 0xc8985a, pick: 0x9a9a92 };
/* How thick each trunk is where you chop it (x the tree's scale), how high that is, and how many sides it has to be cut from. */
const TRUNK = { pine: 0.4, snowpine: 0.4, broad: 0.33, birch: 0.33, palm: 0.26, dead: 0.21, deaddark: 0.21, ash: 0.21, giant: 1.55, mangrove: 0.29 };
const CHOPY = { giant: 1.4, mangrove: 1.9 };
const sidesOf = key => key === 'giant' ? 10 : 6;
const WOODFACE = 0xe8c890, WOODRIM = 0xb88a58, BARKC = 0x4a3526;
/* A tree's own material, with V-shaped wedges taken out of its trunk.
   uCuts[i] = (angle in the tree's frame, depth, half-height at the bark). */
const MAXCUTS = 10;
function carveMaterial() {
  const u = { uCuts: { value: Array.from({ length: MAXCUTS }, () => new THREE.Vector4()) }, uN: { value: 0 }, uAxis: { value: new THREE.Vector3() }, uR: { value: 0.4 } };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.userData.u = u;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLp;
uniform vec4 uCuts[${MAXCUTS}];
uniform float uN;
uniform vec3 uAxis;
uniform float uR;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
for (int i = 0; i < ${MAXCUTS}; i++) {
  if (float(i) >= uN) break;
  vec4 c = uCuts[i];
  vec2 dir = vec2(sin(c.x), cos(c.x));
  float u = dot(vLp.xz - uAxis.xz, dir), inner = uR - c.y;
  if (u > inner && abs(vLp.y - uAxis.y) < c.z * (u - inner) / c.y) discard;
}`)
      // looking through a cut you see the inside of the trunk, not the back of the bark
      .replace('#include <color_fragment>', `#include <color_fragment>
if (!gl_FrontFacing && abs(vLp.y - uAxis.y) < 0.8) diffuseColor.rgb = vec3(0.62, 0.42, 0.24);`);
  };
  mat.customProgramCacheKey = () => 'carved';
  return mat;
}
/* The two faces of one wedge: fresh wood, sapwood at the bark and darker heartwood towards the middle. */
const SAP = 0xecd09a, HEART = 0xb8844a, RING = 0x9a6a3a;
function cutFaces(b, w, R, ly) {
  const dx = Math.sin(w.a), dz = Math.cos(w.a), px = Math.cos(w.a), pz = -Math.sin(w.a);
  const inner = R / 0.9 - w.d, outer = R;
  const S = 3;
  for (const side of [1, -1]) {
    const col = t => mixHex(HEART, SAP, t);
    for (let i = 0; i < S; i++) {
      const u0 = inner + (outer - inner) * i / S, u1 = inner + (outer - inner) * (i + 1) / S;
      const y0 = ly + side * w.hh * (u0 - inner) / w.d, y1 = ly + side * w.hh * (u1 - inner) / w.d;
      const s0 = Math.sqrt(Math.max(0, R * R - u0 * u0)), s1 = Math.sqrt(Math.max(0, R * R - u1 * u1));
      const P = (u, s, y) => [dx * u + px * s, y, dz * u + pz * s];
      // a growth ring every other strip, the lower face a shade darker
      // heartwood in the middle, one growth ring, pale sapwood under the bark
      const c = i === 0 ? HEART : i === 1 ? mixHex(HEART, SAP, 0.55) : SAP;
      b.color(side > 0 ? c : shadeHex(c, 0.82));
      b.quad(P(u0, -s0, y0), P(u0, s0, y0), P(u1, s1, y1), P(u1, -s1, y1), [0, side, 0]);
    }
    // the torn bark lip along the opening
    const sE = Math.sqrt(Math.max(0, R * R - outer * outer * 0.96)) + 0.02;
    b.color(0x3a2a1e).beam([dx * outer + px * -sE, ly + side * w.hh, dz * outer + pz * -sE], [dx * outer + px * sE, ly + side * w.hh, dz * outer + pz * sE], 0.03, 0.03);
  }
}/* A chunk of bark and wood, or a lump of rock, knocked off by a swing. */
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
    this.carved = new Map();       // everyone: tree id -> {mesh, mat, faces} (a tree with cuts in it)
    this.debris = [];              // chunks flying off
    this.logs = new Map();         // host: felled trees still lying whole (id -> {dir})
    this.fallen = new Map();       // everyone: the fallen trunk meshes (id -> {m, n, dx, dz})
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
    const C = this.carved.get(n.id);
    if (C && !this.gone.has(n.id)) { C.mesh.matrix.copy(M); return; }
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
      const lg = tool === 'axe' && this.fallenNear(P);
      if (lg) { G.act({ t: 'split', id: lg.id }); return; }
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

  /* A tree comes down after enough chopping - from any side. Each swing
     cuts into the side facing you; a fresh side bites deepest, so walking
     round the trunk is quicker than hacking at one notch, not required. */
  _hostCut(c, n, dir, from) {
    const G = this.game, s = G.state.s;
    const N = sidesOf(n.key);
    const cut = this.cuts.get(c.id) || new Array(N).fill(0);
    this.cuts.set(c.id, cut);
    // which side of the trunk you are standing on
    const px = c.at ? c.at[0] : n.it[0] - dir[0], pz = c.at ? c.at[1] : n.it[2] - dir[1];
    const a = Math.atan2(px - n.it[0], pz - n.it[2]);
    const k = ((Math.round(a / (Math.PI * 2 / N)) % N) + N) % N;
    const iron = s.upg?.axe ? 2 : 1;
    cut[k] += (cut[k] ? 0.6 : 1) * iron;
    const total = cut.reduce((x, y) => x + y, 0), need = n.def.hp;
    // it falls away from the last cut
    if (total >= need - 1e-6) { this.cuts.delete(c.id); this._give(c, n, [-Math.sin(a), -Math.cos(a)], from, cut); return; }
    G._everyone({ t: 'gather', k: 'cut', id: c.id, cut: cut.map(v => +v.toFixed(2)).join(','), side: k, of: N, dir, left: +(need - total).toFixed(2), need });
  }

  _give(c, n, dir, from, cut = null) {
    const G = this.game, s = G.state.s;
    const at = new THREE.Vector3(n.it[0], n.it[1] + Math.min(1.2, 0.5 * n.it[3] + 0.4), n.it[2]);
    // it gives
    this.hp.delete(c.id);
    (s.felled = s.felled || {})[c.id] = s.day;
    G._saveDirty = true;
    s.stats.gathered = (s.stats.gathered || 0) + 1;
    G._everyone({ t: 'gather', k: n.def.fall ? 'fell' : 'break', id: c.id, dir, cut: cut ? cut.map(v => +v.toFixed(2)).join(',') : undefined });
    const drop = (delay, pts) => setTimeout(() => {
      for (const [m, q] of n.def.give) for (let k = 0; k < q; k++) {
        const p = pts(k, q);
        this.spawn(m, p, new THREE.Vector3((Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2));
      }
    }, delay);
    if (n.def.fall) this.logs.set(c.id, { dir, t: G.world.time });
    else drop(60, () => at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.2, (Math.random() - 0.5) * 0.8)));
    if (Object.keys(s.felled).length >= 25) G.award('woodsman', from);
  }

  /** Host: one blow on a fallen tree and it comes apart into logs. */
  hostSplit(c, from) {
    const G = this.game, L = this.logs.get(c.id), n = this.node(c.id);
    if (!L || !n) return;
    this.logs.delete(c.id);
    const dir = L.dir, len = 6 * n.it[3];
    G._everyone({ t: 'gather', k: 'split', id: c.id, dir });
    setTimeout(() => {
      for (const [m, q] of n.def.give) for (let k = 0; k < q; k++) {
        const f = 0.15 + 0.75 * k / Math.max(1, q - 1);
        const p = new THREE.Vector3(n.it[0] + dir[0] * len * f, n.it[1] + 0.7, n.it[2] + dir[1] * len * f);
        this.spawn(m, p, new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2.5, (Math.random() - 0.5) * 3));
      }
    }, 120);
  }
  /** The fallen tree in front of you, if any: the trunk lies from its stump along where it fell. */
  fallenNear(P) {
    let best = null, bd = 2.2;
    for (const [id, Fl] of this.fallen) {
      const n = Fl.n, bx = n.it[0], bz = n.it[2], L = 7 * n.it[3];
      const ex = P.pos.x - bx, ez = P.pos.z - bz;
      const u = clamp(ex * Fl.dx + ez * Fl.dz, 0.4, L);
      const d = Math.hypot(ex - Fl.dx * u, ez - Fl.dz * u);
      if (d < bd && Math.abs(P.pos.y - n.it[1]) < 3) { bd = d; best = { id, Fl, u }; }
    }
    return best;
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
      this._carve(n, e.cut);
      (this.lastCut = this.lastCut || new Map()).set(n.id, { left: e.left, need: e.need });
      this.wobbles.push({ n, t: 0, dx, dz, a: 0.04 });
      return;
    }    if (e.k === 'hit') {
      if (!wood) {
        // a lump breaks off the side you hit
        this._chunk(new THREE.Vector3(at.x - dx * 0.5 * n.it[3], at.y, at.z - dz * 0.5 * n.it[3]), Math.atan2(-dx, -dz), n.key === 'crystal' ? 'crystal' : n.key === 'lavarock' || n.key === 'spire' ? 'dark' : 'stone');
        // a rock loses a piece every time: it gets smaller
        const k = 0.55 + 0.45 * e.hp / e.max;
        n.shrink = k;
        this._setInst(n, this._matrix(n.it, 0, 0, 0, k));
      } else this.wobbles.push({ n, t: 0, dx, dz, a: tree ? 0.06 : 0.12 });
    }
    if (e.k === 'split') {
      const Fl = this.fallen.get(e.id);
      const len = 6 * n.it[3];
      const mid = new THREE.Vector3(n.it[0] + dx * len * 0.45, n.it[1] + 0.5, n.it[2] + dz * len * 0.45);
      G.audio.chopWood(mid); G.audio.crack(); G.audio.timber(mid);
      G.fx.chips(mid.x, mid.y + 0.3, mid.z, CHIP.axe, 34, 0, 0);
      G.fx.dust(mid.x, n.it[1], mid.z, 26, 1.8);
      if (LEAF[n.key]) G.fx.leaves(mid.x, mid.y + 1, mid.z, 18, LEAF[n.key]);
      for (let k = 0; k < 7; k++) { const f = k / 6; this._chunk(new THREE.Vector3(n.it[0] + dx * len * f, n.it[1] + 0.6, n.it[2] + dz * len * f), Math.random() * 6.28, 'wood'); }
      if (G.player.pos.distanceTo(mid) < 20) G.addShake(0.45);
      if (Fl) {
        // it jumps apart as it goes
        this.splitting = this.splitting || [];
        this.splitting.push({ m: Fl.m, t: 0, base: Fl.m.matrix.clone(), carved: Fl.carved });
        this.fallen.delete(e.id);
      }
      return;
    }
    if (e.k === 'fell') { if (e.cut) this._carve(n, e.cut); this._gone(e.id, { dx, dz }); }
    if (e.k === 'break') { this._gone(e.id, null); G.fx.dust(n.it[0], n.it[1], n.it[2], 12, Math.min(2, n.it[3])); if (!wood) G.audio.crack(); }
  }

  /** The point on the trunk's surface at chopping height on the side at angle a (0 = +z). */
  _trunkPoint(n, a, inset = 0) {
    const r = (TRUNK[n.key] || 0.3) * n.it[3] - inset;
    return new THREE.Vector3(n.it[0] + Math.sin(a) * r, n.it[1] + (CHOPY[n.key] || 0.95) * Math.min(1.2, n.it[3]), n.it[2] + Math.cos(a) * r);
  }
  /* The carved tree: once it has been cut, the tree is drawn on its own
     with a shader that takes V-shaped wedges out of the trunk (in the
     tree's own frame, so the notches go with it when it falls). Through
     the cut you see the inside of the trunk, and the two faces of every
     wedge are closed with fresh wood - pale sapwood at the bark, darker
     heartwood towards the middle. */
  _carve(n, cut) {
    const G = this.game;
    const old = this.carved.get(n.id);
    if (!cut) {
      if (old) { G.scene.remove(old.mesh); old.mat.dispose(); for (const g of old.geos) g.dispose(); this.carved.delete(n.id); }
      return;
    }
    const cs = String(cut).split(',').map(Number), N = cs.length;
    const R = TRUNK[n.key] || 0.3, ly = this._chopLocalY(n);
    const wedges = [];
    for (let k = 0; k < N; k++) {
      if (!cs[k]) continue;
      const d = R * Math.min(0.85, 0.34 + 0.18 * cs[k]), hh = d * 1.05;
      wedges.push({ a: k / N * Math.PI * 2 - n.it[4], d, hh });
    }
    let C = old;
    if (!C) {
      const V = this.flora.V[n.key];
      const mat = carveMaterial(V.mat === MAT.solid);
      const mesh = new THREE.Mesh(V.geos[n.blk.vi], mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(this._matrix(n.it));
      G.scene.add(mesh);
      C = { mesh, mat, geos: [], faces: null };
      this.carved.set(n.id, C);
      // the instance in the forest goes; this one stands in for it
      if (n.mesh) { _m.makeScale(0, 0, 0); n.mesh.setMatrixAt(n.i, _m); n.mesh.instanceMatrix.needsUpdate = true; }
    }
    const u = C.mat.userData.u;
    u.uAxis.value.set(0, ly, 0); u.uR.value = R; u.uN.value = wedges.length;
    wedges.forEach((w, i) => u.uCuts.value[i].set(w.a, w.d, w.hh, 0));
    // the cut faces
    if (C.faces) { C.mesh.remove(C.faces); C.faces.geometry.dispose(); }
    const b = new MeshBuilder(rng(3));
    for (const w of wedges) cutFaces(b, w, R * 0.9, ly);
    C.faces = new THREE.Mesh(b.build(), MAT.solidDS);
    C.faces.castShadow = true;
    C.mesh.add(C.faces);
  }
  _chopLocalY(n) { return ((CHOPY[n.key] || 0.95) * Math.min(1.2, n.it[3]) + 0.2) / n.it[3]; }
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
    const carved = fall ? this.carved.get(id) : null;
    if (carved) this.carved.delete(id); else this._carve(n, null);
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
      let m = carved && carved.mesh;
      if (!m) { m = new THREE.Mesh(V.geos[n.blk.vi], V.mat); m.castShadow = true; m.matrixAutoUpdate = false; G.scene.add(m); }
      this._matrix(n.it);
      m.matrix.copy(_m);
      this.falling.push({ m, n, t: 0, dx: fall.dx, dz: fall.dz, landed: false, carved });
      G.audio.crack(); G.audio.treeFall(new THREE.Vector3(n.it[0], n.it[1], n.it[2]));
    }
  }
  _restore(id) {
    const G = this.game, n = this.node(id);
    this.gone.delete(id);
    this.cuts.delete(id);
    this.logs.delete(id);
    const fl = this.fallen.get(id); if (fl) { G.scene.remove(fl.m); this.fallen.delete(id); }
    if (!n) return;
    this._carve(n, null);
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
      if (t > 1.9) { this.falling.splice(i, 1); this.fallen.set(F.n.id, { m: F.m, n: F.n, dx: F.dx, dz: F.dz, carved: F.carved, t: G.world.time }); }
    }
    for (let i = (this.splitting || []).length - 1; i >= 0; i--) {
      const S2 = this.splitting[i];
      S2.t += dt;
      const k = S2.t / 0.35, s = Math.max(0.001, 1 - k);
      S2.m.matrix.copy(S2.base);
      S2.m.matrix.elements[13] += Math.sin(Math.min(1, k) * Math.PI) * 0.35;
      const sc = new THREE.Matrix4().makeScale(1, s, 1); S2.m.matrix.multiply(sc);
      if (k >= 1) { G.scene.remove(S2.m); if (S2.carved) { S2.carved.mat.dispose(); if (S2.carved.faces) S2.carved.faces.geometry.dispose(); } this.splitting.splice(i, 1); }
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
    if (tool === 'axe' && this.fallenNear(P)) return { T: null, text: 'Split the fallen tree - one good blow' };
    const T = this.target(P, tool);
    if (!T) return null;
    if (T.def.fall) {
      const L = this.lastCut?.get(T.id);
      const pct = L ? Math.round(100 * (1 - L.left / L.need)) : 0;
      return { T, text: pct ? `Chop the tree (${pct}%) - a fresh side cuts deeper` : 'Chop the tree' };
    }
    const hp = this.hp.get(T.id) ?? T.def.hp;
    return { T, text: (tool === 'axe' ? (T.def.fall ? 'Chop the tree' : 'Cut it') : 'Break the rock') + (T.def.hp > 1 ? ` (${clamp(hp, 0, T.def.hp)} more)` : '') };
  }
}
