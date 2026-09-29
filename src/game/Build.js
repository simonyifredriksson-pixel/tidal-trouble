/* Build.js - blueprints, and putting them up with your own hands.

   With the BLUEPRINT BOOK (=) out, left mouse opens the book. Pick a plan
   and its ghost follows your eyes across the ground - green where it can
   go, red where it cannot. R turns it, left mouse lays it out, right mouse
   puts it away.

   A laid-out blueprint is a pale blue ghost of every piece. You build it
   by carrying the right material to the right piece: press G to take a
   material out of your pack (G again for the next one), walk up to a
   ghost piece that needs it - the one you are about to fill glows gold -
   and press E. The piece flies out of your hands and lands where it
   belongs. Foundations first; the walls open when the footing is done,
   the roof when the walls are.

   Everything lives in the save (s.builds) so the whole crew sees and
   fills the same blueprint: one of you chops, one breaks rock, one builds.
   Host-authoritative: 'bnew', 'bput', 'bdel' go through act().

   A finished building does something - see BLUEPRINTS in BuildData.js. */

import * as THREE from '../../lib/three.module.js';
import { BLUEPRINTS, BP_BY_ID, MATS, MAT_BY_ID, bpCost, WORMS } from '../data/BuildData.js';
import { FISH_BY_ID } from '../data/FishData.js';
import { HULL_BY_ID } from '../data/BoatData.js';
import { partGeo, GHOST, GLASS, pieceMesh } from '../art/BuildArt.js';
import { MAT } from '../art/Materials.js';
import { MeshBuilder } from '../art/Geo.js';
import { rng } from '../core/Util.js';
import { Aquariums } from './Aquarium.js';
import { uid as uid2 } from '../core/Util.js';
import { heightAt } from '../world/Terrain.js';
import { uid, clamp } from '../core/Util.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Euler();
const MAX_SITES = 60;
const DRY_SECONDS = 180;      // three minutes of game time on the rack
// a beacon's fire is not hidden by the fog: that is the whole point of it
const FLAME = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

/** Which tier a site is working on (the lowest with anything left). */
export function openTier(bp, placed) {
  let t = Infinity;
  bp.parts.forEach((p, i) => { if (placed[i] !== '1') t = Math.min(t, p.t); });
  return t;
}

export class Build {
  constructor(game) {
    this.game = game;
    this.sites = new Map();       // id -> {S (save entry), bp, group, parts: [{p, mesh, done, cols}]}
    this.plan = null;             // the blueprint you are laying out {bp, rot, group, ok}
    this.held = null;             // the material in your hands (a mat id)
    this.flyers = [];
    this.syncT = 0;
    this.lampT = 0;
    this.aq = new Aquariums(game);
  }

  /* ---------------- the save <-> the world ---------------- */
  _sync() {
    const G = this.game, list = G.state.s.builds || [];
    const ids = new Set();
    for (const S of list) {
      ids.add(S.id);
      // a blueprint that gained a piece since this was built: a finished one gets it for free
      const bpN = BP_BY_ID[S.bp]?.parts.length || 0;
      if (S.p.length < bpN) S.p = S.p.padEnd(bpN, S.p.includes('0') ? '0' : '1');
      let site = this.sites.get(S.id);
      if (!site) site = this._make(S);
      site.S = S;
      site.parts.forEach((P, i) => { const d = S.p[i] === '1'; if (d !== P.done) this._setPart(site, i, d, false); });
      site.complete = !S.p.includes('0');
    }
    for (const [id, site] of this.sites) if (!ids.has(id)) this._unmake(site);
  }
  _make(S) {
    const G = this.game, bp = BP_BY_ID[S.bp];
    const group = new THREE.Group();
    group.position.set(S.x, S.y, S.z);
    group.rotation.y = S.r;
    G.scene.add(group);
    const site = { S, bp, group, parts: [], complete: false };
    bp.parts.forEach((p, i) => {
      const m = new THREE.Mesh(partGeo(p), GHOST.wait);
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(p.rx || 0, p.r || 0, p.rz || 0, 'YXZ');
      group.add(m);
      site.parts.push({ p, mesh: m, done: false, cols: [] });
    });
    group.updateMatrixWorld(true);
    this.sites.set(S.id, site);
    bp.parts.forEach((p, i) => { if (S.p[i] === '1') this._setPart(site, i, true, false); });
    this._paint(site);
    return site;
  }
  _unmake(site) {
    const G = this.game;
    for (const P of site.parts) for (const c of P.cols) G.world.colliders.remove(c);
    G.scene.remove(site.group);
    this.sites.delete(site.S.id);
  }
  /** Make a piece real (or a ghost again). */
  _setPart(site, i, done, fly) {
    const G = this.game, P = site.parts[i], p = P.p;
    P.done = done;
    P.mesh.material = done ? (p.k === 'glass' ? GLASS : p.m === 'crystal' ? MAT.glow : MAT.solid) : GHOST.wait;
    P.mesh.castShadow = done && p.k !== 'glass'; P.mesh.receiveShadow = done && p.k !== 'glass';
    P.mesh.renderOrder = done && p.k === 'glass' ? 3 : 0;
    for (const c of P.cols) G.world.colliders.remove(c);
    P.cols = [];
    if (done && (p.solid || p.floor || p.k === 'glass')) {
      const S = site.S, ca = Math.cos(S.r), sa = Math.sin(S.r);
      const wx = S.x + p.x * ca + p.z * sa, wz = S.z - p.x * sa + p.z * ca;
      const y0 = S.y + p.y;
      let c;
      if (p.k === 'post' || p.k === 'stake') c = G.world.colliders.circle(wx, wz, (p.w || 0.1) + 0.08, y0 - 0.2, y0 + (p.h || 1), 'build');
      else if (p.k === 'log') c = G.world.colliders.box(wx, wz, (p.w || 1) / 2, (p.h || 0.1) + 0.05, S.r + (p.r || 0), y0 - (p.h || 0.1), y0 + (p.h || 0.1), 'build');
      else {
        // floor planks overlap a little, so you can't drop through the crack between two of them
        const h = (p.h || 0.1) / 2, pad = p.floor ? 0.05 : 0;
        c = G.world.colliders.box(wx, wz, (p.w || 1) / 2 + pad, (p.d || p.w || 1) / 2 + pad, S.r + (p.r || 0), p.floor ? y0 - 0.4 : y0 - h, y0 + h, 'build');
      }
      if (p.floor) c.floor = true;
      P.cols.push(c);
    }
    if (fly) this._fly(site, i);
    this._paint(site);
  }
  /** Colour the ghosts: the tier you can work on now is brighter than the ones after it. */
  _paint(site) {
    const placed = site.parts.map(P => P.done ? '1' : '0');
    const tier = openTier(site.bp, placed);
    for (const P of site.parts) if (!P.done) P.mesh.material = P.p.t === tier ? GHOST.wait : GHOST.locked;
    site.tier = tier;
  }
  /** The piece flies from your hands to its place and lands with a thump. */
  _fly(site, i) {
    const G = this.game, P = site.parts[i];
    const to = P.mesh.getWorldPosition(new THREE.Vector3());
    const from = G.player.pos.distanceTo(to) < 8 ? G.vm.handWorld(G.camera, new THREE.Vector3()) : to.clone().add(new THREE.Vector3(0, 2, 0));
    P.mesh.visible = false;
    const m = pieceMesh(P.p.m);
    m.position.copy(from);
    G.scene.add(m);
    this.flyers.push({ m, from, to, t: 0, P });
  }

  /* ---------------- laying out a blueprint (local) ---------------- */
  choose(id) {
    const bp = BP_BY_ID[id];
    if (!bp) return;
    this.cancelPlan();
    const G = this.game;
    const group = new THREE.Group();
    for (const p of bp.parts) {
      const m = new THREE.Mesh(partGeo(p), GHOST.good);
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(p.rx || 0, p.r || 0, p.rz || 0, 'YXZ');
      group.add(m);
    }
    G.scene.add(group);
    this.plan = { bp, rot: 0, group, ok: false };
    const P = G.player;
    P.tool = 'plans'; G.vm.setTool('plans');
    G.ui.toast(`${bp.name}: left mouse to lay it out, R to turn it, right mouse to put it away.`, 'info');
  }
  cancelPlan() {
    if (!this.plan) return;
    this.game.scene.remove(this.plan.group);
    this.plan = null;
  }
  /** Where the plan would go, and whether it can. */
  _planSpot() {
    const G = this.game, P = G.player, bp = this.plan.bp;
    const f = P.forward(_v).clone();
    const o = P.eye.clone();
    let hit = null;
    for (let s = 1.5; s < (bp.water ? 30 : 11); s += 0.25) {
      const p = o.clone().addScaledVector(f, s);
      if (p.y <= Math.max(G.world.ground(p.x, p.z), 0)) { hit = p; break; }
    }
    if (!hit) { const ff = P.flatForward(_w); hit = P.pos.clone().addScaledVector(ff, Math.max(3, bp.foot * 2.2)); }
    const d = Math.hypot(hit.x - P.pos.x, hit.z - P.pos.z), min = bp.foot + 1.2 + (bp.boat ? (HULL_BY_ID[bp.boat]?.hl || 0) : 0);
    if (d < min) { const ff = P.flatForward(_w); hit.x = P.pos.x + ff.x * min; hit.z = P.pos.z + ff.z * min; }
    const r = P.yaw + this.plan.rot;
    if (bp.water) { const yw = 0; return { x: hit.x, z: hit.z, y: yw, r, why: this._why(bp, hit.x, hit.z, yw, r) }; }
    const y = G.world.ground(hit.x, hit.z);
    return { x: hit.x, z: hit.z, y, r, why: this._why(bp, hit.x, hit.z, y, r) };
  }
  /** Why a blueprint cannot go here (null if it can). */
  _why(bp, x, z, y, r) {
    const G = this.game, s = G.state.s;
    if (G.player.boat) return 'You cannot build on a boat.';
    if ((s.builds || []).length >= MAX_SITES) return 'You have laid out as many blueprints as the islands will stand. Finish or take down some first.';
    const h = heightAt(x, z);
    if (bp.water) {
      const d = -heightAt(x, z);
      if (d < 0.6) return 'A boat is built in the water - lay it out just off the beach, where it is at least knee deep.';
      if (d > 9) return 'Too deep to build here. Come in closer to the shore.';
      let near = false; for (let i = 0; i < 16 && !near; i++) { const a = i / 16 * Math.PI * 2; for (const r of [8, 16, 26]) if (heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r) > 0.3) near = true; }
      if (!near) return 'Too far from land - build her close to the shore.';
      for (const b2 of G.boats) if (!b2.absent && Math.hypot(b2.pos.x - x, b2.pos.z - z) < b2.hull.hl + bp.foot + 1) return 'Your boat is in the way.';
    } else if (bp.shore) {
      if (h < -0.4 || h > 1.6) return 'A jetty starts at the water\'s edge: stand on the beach and face the sea.';
      const fx = -Math.sin(r), fz = -Math.cos(r);
      if (heightAt(x + fx * 6, z + fz * 6) > -0.8) return 'Face deeper water - the far end of the jetty needs the sea under it.';
    } else {
      if (h < 0.25 || G.world.waterAt(x, z) > y + 0.05) return 'Not in the water.';
      if (G.world.onIce(x, z)) return 'Not on the ice.';
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, hh = heightAt(x + Math.cos(a) * bp.foot, z + Math.sin(a) * bp.foot);
        if (Math.abs(hh - h) > 0.9) return 'The ground is too steep here.';
        if (hh < 0.1) return 'Too close to the water.';
      }
    }
    for (const b of G.world.settlement.blockers) if (Math.hypot(x - b.x, z - b.z) < b.r + bp.foot) return 'There is already something built here.';
    // trees, rocks, walls: clear the ground first (a tree you have felled is gone from here too)
    for (const c of G.world.colliders.near(x, z, bp.foot + 1)) {
      if (c.tag === 'build') continue;
      const d = c.t === 'c' ? Math.hypot(c.x - x, c.z - z) - c.r : Math.hypot(c.x - x, c.z - z) - Math.min(c.hw, c.hd);
      if (d < bp.foot * 0.85) return c.tag === 'tree' ? 'A tree is in the way. Chop it down first (0).' : c.tag === 'rock' ? 'A rock is in the way. Break it up first (-).' : 'Something is in the way.';
    }
    for (const S of s.builds || []) { const o = BP_BY_ID[S.bp]; if (o && Math.hypot(x - S.x, z - S.z) < bp.foot + o.foot + 0.3) return 'Too close to another blueprint.'; }
    return null;
  }

  /* ---------------- building (local) ---------------- */
  /** The ghost piece nearest your eyes that you could fill now. */
  targetPart(P) {
    let best = null, bd = Infinity;
    const f = P.forward(_v).clone();
    for (const site of this.sites.values()) {
      if (site.complete) continue;
      if (Math.hypot(site.S.x - P.pos.x, site.S.z - P.pos.z) > site.bp.foot + 8) continue;
      site.parts.forEach((Pt, i) => {
        if (Pt.done || Pt.p.t !== site.tier) return;
        const w = Pt.mesh.getWorldPosition(_w);
        const d = w.distanceTo(P.eye);
        if (d > 3.6) return;
        const dir = w.clone().sub(P.eye).normalize();
        const facing = dir.dot(f);
        if (facing < 0.3 && d > 1.2) return;
        const score = d * (1.6 - facing) - (this.held === Pt.p.m ? 0.8 : 0);
        if (score < bd) { bd = score; best = { site, i, P: Pt }; }
      });
    }
    return best;
  }
  /** G: take the next material out of the pack (or put it away). */
  cycleHeld(prefer = null) {
    const G = this.game, m = G.state.s.mats || {};
    const have = MATS.filter(M => (m[M.id] || 0) > 0).map(M => M.id);
    if (prefer && have.includes(prefer)) this.held = prefer;
    else if (!have.length) { this.held = null; G.ui.toast('Your pack is empty. Chop trees (0) and break rocks (-).', 'info'); }
    else { const i = have.indexOf(this.held); this.held = i < 0 ? have[0] : have[i + 1] || null; }
    G.vm.heldMat = this.held;
    G.audio.click();
    if (this.held) G.ui.toast(`In your hands: ${MAT_BY_ID[this.held].name} (${m[this.held]})`, 'info');
    return this.held;
  }
  put(T) {
    const G = this.game;
    G.act({ t: 'bput', id: T.site.S.id, i: T.i });
    G.vm.play('throw');
  }

  /* ---------------- the host ---------------- */
  hostNew(c, from) {
    const G = this.game, s = G.state.s, bp = BP_BY_ID[c.bp];
    if (!bp) return;
    s.builds = s.builds || [];
    const why = this._why(bp, c.x, c.z, c.y, c.r);
    if (why) { G.tell(from, why, 'warn'); return; }
    const S = { id: uid('b'), bp: bp.id, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2), r: +c.r.toFixed(3), p: '0'.repeat(bp.parts.length), day: s.day, by: from, store: [] };
    s.builds.push(S);
    G._saveDirty = true;
    G._everyone({ t: 'build', k: 'new', id: S.id, bp: bp.id });
    this._sync();
  }
  hostPut(c, from) {
    const G = this.game, s = G.state.s;
    const S = (s.builds || []).find(b => b.id === c.id);
    if (!S) return;
    const bp = BP_BY_ID[S.bp], p = bp.parts[c.i];
    if (!p || S.p[c.i] === '1') return;
    if (p.t !== openTier(bp, S.p)) { G.tell(from, 'Finish the pieces underneath first.', 'warn'); return; }
    s.mats = s.mats || {};
    if (!(s.mats[p.m] > 0)) { G.tell(from, `You are out of ${MAT_BY_ID[p.m].name.toLowerCase()}.`, 'warn'); return; }
    s.mats[p.m]--;
    S.p = S.p.slice(0, c.i) + '1' + S.p.slice(c.i + 1);
    G._saveDirty = true;
    const done = !S.p.includes('0');
    G._everyone({ t: 'build', k: 'put', id: S.id, i: c.i, by: from, done });
    if (done && bp.boat) { this._launch(S, bp, from); return; }
    if (done) {
      S.t0 = Math.round(this.clock());
      s.stats.built = (s.stats.built || 0) + 1;
      G.award('builder', from);
      if (s.stats.built >= 6) G.award('settler', from);
      G._everyone({ t: 'build', k: 'done', id: S.id });
    }
  }
  /** The last piece of a boat: she slides into the water and she is yours. */
  _launch(S, bp, from) {
    const G = this.game, s = G.state.s, H = HULL_BY_ID[bp.boat];
    s.hulls = s.hulls || [];
    if (!s.hulls.includes(H.id)) s.hulls.push(H.id);
    s.boat.hull = H.id; s.boat.built = true;
    s.builds.splice(s.builds.indexOf(S), 1);
    G._boatChanged();
    const b = G.boats[0];
    b.pos.set(S.x, 0, S.z); b.heading = S.r; b.vel.set(0, 0); b.yawRate = 0;
    b.hp = b.stats.hp; b.leaks = []; b.patches = []; b.breaks = []; b.water = 0; b.fires = []; b.sinking = 0;
    b.docked = false; b._updateMatrix();
    s.stats.built = (s.stats.built || 0) + 1;
    s.stats.boats = (s.stats.boats || 0) + 1;
    G.award('builder', from);
    G._saveDirty = true;
    G._everyone({ t: 'build', k: 'launch', id: S.id, hull: H.id, x: S.x, z: S.z });
    this._sync();
  }
  hostDel(c, from) {
    const G = this.game, s = G.state.s;
    const i = (s.builds || []).findIndex(b => b.id === c.id);
    if (i < 0) return;
    const S = s.builds[i], bp = BP_BY_ID[S.bp];
    // you get back what you put in
    s.mats = s.mats || {};
    bp.parts.forEach((p, k) => { if (S.p[k] === '1') s.mats[p.m] = (s.mats[p.m] || 0) + 1; });
    for (const it of S.store || []) this._dropCatch(S, it);
    s.builds.splice(i, 1);
    G._saveDirty = true;
    G._everyone({ t: 'build', k: 'del', id: S.id });
    this._sync();
  }
  _dropCatch(S, it) {
    const G = this.game;
    G.loot.spawn({ ...it, pos: new THREE.Vector3(S.x, S.y + 1, S.z), vel: new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), flop: 0 });
  }

  onEvent(e) {
    const G = this.game;
    this._sync();
    const site = this.sites.get(e.id);
    if (e.k === 'put' && site) {
      const P = site.parts[e.i];
      if (P) { this._setPart(site, e.i, true, true); }
      if (e.by === G.player.id && this.held && !((G.state.s.mats || {})[this.held] > (G.isHost ? 0 : 1))) { this.held = null; G.vm.heldMat = null; }
    }
    if (e.k === 'launch') {
      G.fx.splash(e.x, 0, e.z, 3); G.audio.splash(2); G.audio.fanfare(3);
      if (G.player.pos.distanceTo(new THREE.Vector3(e.x, 0, e.z)) < 80) G.ui.banner('SHE FLOATS', 'The ' + HULL_BY_ID[e.hull].name + ' is in the water. You built her. Step aboard and take the helm (E).', 'boat', 6);
    }
    if (e.k === 'tank' && site) {
      const c = site.group.position, T = site.bp.tank;
      G.fx.splash(c.x, c.y + T.y0 + T.h, c.z, 0.8); G.audio.splash(0.8, c);
      if (e.by === G.player.id || e.by === G.net?.selfId) G.ui.toast((FISH_BY_ID[e.sp]?.name || 'It') + ' is in the ' + site.bp.name + '. It will live there as long as you like.', 'good');
    }
    if (e.k === 'done' && site) {
      const c = site.group.position;
      G.fx.confetti(c.x, c.y + 2, c.z, 60);
      G.audio.fanfare(2);
      if (G.player.pos.distanceTo(c) < 60) G.ui.banner(site.bp.name.toUpperCase() + ' BUILT', site.bp.use, site.bp.icon, 4.5);
    }
  }

  /* ---------------- every frame ---------------- */
  update(dt, input, blocked) {
    const G = this.game, P = G.player;
    this.syncT -= dt;
    if (this.syncT <= 0) { this.syncT = 0.5; this._sync(); this._racks(); }
    this.aq.update(dt, this.sites);
    // pieces in the air
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const F = this.flyers[i];
      F.t += dt / 0.38;
      const k = Math.min(1, F.t);
      F.m.position.lerpVectors(F.from, F.to, k);
      F.m.position.y += Math.sin(k * Math.PI) * 1.2;
      F.m.rotation.set(k * 6, k * 3, 0);
      if (F.t >= 1) {
        G.scene.remove(F.m);
        F.P.mesh.visible = true;
        F.P.mesh.scale.setScalar(1.25);
        F.pop = 0.2;
        G.audio.place(F.P.p.m !== 'stone');
        G.fx.dust(F.to.x, F.to.y - 0.1, F.to.z, 8, 0.6);
        this.flyers.splice(i, 1);
        this._pops = this._pops || [];
        this._pops.push({ mesh: F.P.mesh, t: 0 });
      }
    }
    for (let i = (this._pops || []).length - 1; i >= 0; i--) { const Q = this._pops[i]; Q.t += dt; Q.mesh.scale.setScalar(1 + 0.25 * Math.max(0, 1 - Q.t / 0.2)); if (Q.t > 0.2) this._pops.splice(i, 1); }
    // highlight the piece you would fill
    if (this._lit) { const s = this.sites.get(this._lit.id); const Pt = s?.parts[this._lit.i]; if (Pt && !Pt.done) Pt.mesh.material = GHOST.wait; this._lit = null; }
    this.aim = !blocked && !P.boat ? this.targetPart(P) : null;
    if (this.aim) { this.aim.P.mesh.material = GHOST.next; this._lit = { id: this.aim.site.S.id, i: this.aim.i }; }
    // the held material follows what you have
    const m = G.state.s.mats || {};
    if (this.held && !(m[this.held] > 0)) { this.held = null; }
    G.vm.heldMat = P.held || P.tool === 'rod' && G.fishing.active ? null : this.held;
    if (!blocked && input.pressed('KeyG') && !P.boat) this.cycleHeld();
    // laying out a plan
    if (this.plan) {
      if (P.tool !== 'plans' || blocked && G.ui.screen !== 'plans') { if (P.tool !== 'plans') this.cancelPlan(); }
      if (this.plan) {
        const spot = this._planSpot();
        this.plan.spot = spot;
        const g = this.plan.group;
        g.position.set(spot.x, spot.y, spot.z);
        g.rotation.y = spot.r;
        const mat = spot.why ? GHOST.bad : GHOST.good;
        for (const c of g.children) c.material = mat;
        if (!blocked) {
          if (input.pressed('KeyR')) this.plan.rot += Math.PI / 4;
          if (input.click(2)) { this.cancelPlan(); G.ui.toast('Blueprint put away.', 'info'); }
          else if (input.click(0)) {
            if (spot.why) { G.ui.toast(spot.why, 'warn'); G.audio.deny(); }
            else { G.act({ t: 'bnew', bp: this.plan.bp.id, x: spot.x, y: spot.y, z: spot.z, r: spot.r }); G.audio.place(true); G.fx.dust(spot.x, spot.y, spot.z, 16, this.plan.bp.foot); const bp = this.plan.bp; this.cancelPlan(); this._firstTip(bp); }
          }
        }
      }
    } else if (!blocked && P.tool === 'plans' && input.click(0) && !P.held) G.ui.open('plans', {});
    // taking down a blueprint you no longer want (with the book out): X
    if (!blocked && P.tool === 'plans' && !this.plan && input.pressed('KeyX')) {
      const site = this.siteNear(P.pos, 3);
      if (site) G.act({ t: 'bdel', id: site.S.id });
    }
  }
  _firstTip(bp) {
    const G = this.game, c = bpCost(bp);
    G.ui.toast(`Laid out. It needs ${Object.entries(c).map(([k, n]) => n + ' ' + MAT_BY_ID[k].name.toLowerCase()).join(', ')}. Hold a material (G) and press E at a blue piece.`, 'good');
  }
  _lamps(dt) {
    const G = this.game, night = G._night();
    const out = [];
    for (const site of this.sites.values()) {
      if (!site.complete) continue;
      const id = site.bp.id;
      if (id !== 'campfire' && id !== 'lantern' && id !== 'beacon') continue;
      const c = site.group.position;
      if (id === 'beacon') {
        // a real fire basket at night, and a glow you can see from far out at sea
        const lit = night > 0.15;
        if (!site.flame) {
          const fb = new MeshBuilder(rng(5));
          fb.color(0xffb03a).blob(0.42, 0.7, 0.42, 0, 0.6, 0, 7, 4); fb.color(0xfff0a0).blob(0.22, 0.45, 0.22, 0, 0.45, 0, 6, 3);
          site.flame = new THREE.Mesh(fb.build(), FLAME);
          site.flame.position.set(0, 3.1, 0);
          site.group.add(site.flame);
        }
        site.flame.visible = lit;
        const d = Math.hypot(c.x - G.player.pos.x, c.z - G.player.pos.z);
        site.flame.scale.setScalar(1 + Math.min(4, d / 250) + Math.sin(G.world.time * 9 + c.x) * 0.08);
        if (lit && d < 160 && Math.random() < 0.9) G.fx.fire(c.x, c.y + 3.35, c.z, 1.1);
        if (lit) { site.light = site.light || { pos: new THREE.Vector3(c.x, c.y + 3.6, c.z), color: 0xffa04a, intensity: 2.4, dist: 26, flicker: true, beacon: true }; out.push(site.light); }
        continue;
      }
      if (Math.hypot(c.x - G.player.pos.x, c.z - G.player.pos.z) > 160) continue;
      if (id === 'campfire') {
        if (Math.random() < 0.9) G.fx.fire(c.x, c.y + 0.25, c.z, 0.8);
        site.light = site.light || { pos: new THREE.Vector3(c.x, c.y + 1, c.z), color: 0xff9a4a, intensity: 1.6, dist: 12, flicker: true };
        out.push(site.light);
      } else if (night > 0.2) {
        const p = site.parts[3].mesh.getWorldPosition(new THREE.Vector3());
        site.light = site.light || { pos: p, color: 0x9ae8ff, intensity: 1.1, dist: 10 };
        out.push(site.light);
      }
    }
    G.world.extraLights.push(...out);
  }

  /** Worms waiting in a worm farm right now. */
  worms(S) {
    if (!S || S.p.includes('0')) return 0;
    if (S.t0 === undefined) S.t0 = Math.round(this.clock());
    return Math.max(0, Math.min(WORMS.max, Math.floor((this.clock() - S.t0) / WORMS.every)));
  }
  /** The game clock in seconds (days and time of day, so it survives saving). */
  clock() { const s = this.game.state.s; return (s.day + this.game.tod) * 1080; }
  /** Dried yet? */
  dried(it) { return !!it.dry || this.clock() - (it.t0 || 0) >= DRY_SECONDS; }

  /** Fish hanging on the drying racks, drawn where they hang. */
  _racks() {
    const G = this.game;
    for (const site of this.sites.values()) {
      if (site.bp.id !== 'dryrack' || !site.complete) { if (site.hung) { for (const m of site.hung) site.group.remove(m); site.hung = null; } continue; }
      const store = site.S.store || [];
      const key = store.map(x => x.sp + (this.dried(x) ? 'd' : '')).join(',');
      if (key === site.hungKey) continue;
      site.hungKey = key;
      if (site.hung) for (const m of site.hung) site.group.remove(m);
      site.hung = store.map((x, i) => {
        const m = G.fishMeshCache(x.sp).clone();
        const s = Math.min(0.9, 0.25 + Math.cbrt(x.kg) * 0.18);
        m.scale.setScalar(s);
        m.position.set(-0.75 + i * 0.5, 1.38 - s * 0.45, 0);
        m.rotation.set(0, 0, Math.PI / 2);
        // a dried fish goes dark and shrivelled
        if (this.dried(x)) m.traverse(o => { if (o.material) { o.material = o.material.clone(); if (o.material.color) o.material.color.setRGB(0.55, 0.42, 0.3); } });
        site.group.add(m);
        return m;
      });
    }
  }

  /** The finished aquarium you are standing at (for E), measured from its glass, not its middle. */
  tankNear(pos, r = 2.2) {
    let best = null, bd = r;
    for (const site of this.sites.values()) {
      const T = site.bp.tank;
      if (!T || !site.complete) continue;
      const S = site.S, dx = pos.x - S.x, dz = pos.z - S.z, ca = Math.cos(S.r), sa = Math.sin(S.r);
      const lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
      const d = T.round ? Math.abs(Math.hypot(lx, lz) - T.r) : Math.hypot(Math.max(0, Math.abs(lx) - T.w / 2), Math.max(0, Math.abs(lz) - T.d / 2));
      if (d < bd) { bd = d; best = site; }
    }
    return best;
  }
  /** Can this catch go in this aquarium? null if it can, otherwise why not. */
  tankRefuses(site, it) {
    const T = site.bp.tank, sp = FISH_BY_ID[it.sp];
    if (!T) return 'That is not an aquarium.';
    if (!sp || it.alive === false) return 'It is dead. Only living fish go in an aquarium.';
    if ((site.S.store || []).length >= T.n) return 'This aquarium is full (' + T.n + ').';
    if (it.cm > T.cm) return `Too big for the ${site.bp.name} - it takes catches up to ${T.cm >= 100 ? (T.cm / 100).toFixed(1) + ' m' : T.cm + ' cm'}.`;
    return null;
  }
  hostTankPut(c, from) {
    const G = this.game, s = G.state.s, P = G.playerById(from) || G.player;
    const S = (s.builds || []).find(b => b.id === c.site), site = S && this.sites.get(S.id);
    const it = G.loot.get(c.id);
    if (!site || !it) return;
    const why = this.tankRefuses(site, it);
    if (why) { G.tell(from, why, 'warn'); return; }
    if (it.held && it.held !== from) { G.tell(from, 'Someone else has that one.', 'warn'); return; }
    if (it.pos.distanceTo(new THREE.Vector3(S.x, S.y, S.z)) > 60 && it.held !== from) { G.tell(from, 'Bring it closer first.', 'warn'); return; }
    S.store = S.store || [];
    S.store.push({ id: uid2('q'), sp: it.sp, kg: +it.kg.toFixed(2), cm: Math.round(it.cm), v: it.v || null, zone: it.zone || 0, mult: it.mult || 1, fav: !!it.fav });
    if (P.held === it.id) P.held = null;
    G.loot.remove(it, 'splash');
    G._saveDirty = true;
    G._everyone({ t: 'build', k: 'tank', id: S.id, sp: it.sp, by: from });
    s.stats.tanked = (s.stats.tanked || 0) + 1;
  }
  hostTankTake(c, from) {
    const G = this.game, s = G.state.s, P = G.playerById(from) || G.player;
    const S = (s.builds || []).find(b => b.id === c.site);
    const i = S?.store?.findIndex(x => x.id === c.fid);
    if (!S || i < 0) return;
    const x = S.store.splice(i, 1)[0];
    const it = G.loot.spawn({ ...x, id: undefined, alive: true, pos: P.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), vel: new THREE.Vector3(0, 1, 0), flop: 6 });
    if (it && !P.held && G.loot.pickUp(it, from)) P.held = it.id;
    G._saveDirty = true;
    G._everyone({ t: 'build', k: 'tankOut', id: S.id });
  }

  /** Is there a lit campfire within r of a point? (warmth at Frostfall) */
  warmAt(pos, r = 7) {
    for (const site of this.sites.values()) if (site.complete && site.bp.id === 'campfire' && site.group.position.distanceTo(pos) < r) return true;
    return false;
  }
  /** Finished buildings near you, for E. */
  near(pos, r = 3) {
    let best = null, bd = r;
    for (const site of this.sites.values()) {
      if (!site.complete) continue;
      const d = Math.hypot(site.S.x - pos.x, site.S.z - pos.z) - site.bp.foot * 0.5;
      if (d < bd) { bd = d; best = site; }
    }
    return best;
  }
  /** Any site near you (for taking a blueprint down). */
  siteNear(pos, r = 4) {
    let best = null, bd = r;
    for (const site of this.sites.values()) { const d = Math.hypot(site.S.x - pos.x, site.S.z - pos.z); if (d < bd + site.bp.foot) { bd = d; best = site; } }
    return best;
  }
  /** The newest finished shelter: where you wake up if you black out. */
  shelter() {
    let best = null;
    for (const site of this.sites.values()) if (site.complete && site.bp.id === 'shelter' && (!best || site.S.day >= best.S.day)) best = site;
    return best;
  }
  worldPoint(site, lx, ly, lz) {
    const S = site.S, ca = Math.cos(S.r), sa = Math.sin(S.r);
    return new THREE.Vector3(S.x + lx * ca + lz * sa, S.y + ly, S.z - lx * sa + lz * ca);
  }
}

export { BLUEPRINTS, bpCost };
