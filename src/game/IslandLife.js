/* IslandLife.js - what makes each far island do its own thing, every frame.

   DISCOVERY    walk (or sail) onto an island and it is found: a banner, a
                lantern trophy, its shops named, and it goes on your map.
   THE CHART    the map starts blank past the waters everybody knows. The
                squares round every player are charted as you go (host),
                saved as a bit field in state.s.chart. Pip's telescope on
                Skywatch charts a huge circle at once.
   And one thing per island: Sunscar's volcano throws burning rock,
   Thunderpeak's storm puts lightning in the water (and in your mast, unless
   you fitted a rod), Frostfall's night cold hurts without a thermal suit,
   Skywatch has its cliff lift, Ironwreck's wrecks can be salvaged, the Lost
   Shores have their notes, the Abyssal Reach has lights and booms and an
   eye, the woods and the swamp have wisps, the reef glows.

   The host decides anything that changes the world; everyone sees the
   effects (they arrive as 'isle' events). */

import * as THREE from '../../lib/three.module.js';
import { MeshBuilder } from '../art/Geo.js';
import { MAT } from '../art/Materials.js';
import { WORLD, REGIONS, HOME_CENTRE, stormAt, distHome, inSpot } from '../world/MapData.js';
import { ISLAND_INFO, LOST_NOTES } from '../data/IslandData.js';
import { FISH } from '../data/FishData.js';
import { clamp, rng } from '../core/Util.js';

export const CHART_CELL = 150;
export const CHART_N = Math.ceil(2 * WORLD.half / CHART_CELL);
/* Everybody already knows the home waters: the inner ring is charted from the start. */
const KNOWN_R = 1500;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encode(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 3) { const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0; s += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)] + B64[((b & 15) << 2) | (c >> 6)] + B64[c & 63]; } return s; }
function decode(str, n) { const out = new Uint8Array(n); let o = 0; for (let i = 0; i + 3 < str.length && o < n; i += 4) { const a = B64.indexOf(str[i]), b = B64.indexOf(str[i + 1]), c = B64.indexOf(str[i + 2]), d = B64.indexOf(str[i + 3]); out[o++] = (a << 2) | (b >> 4); if (o < n) out[o++] = ((b & 15) << 4) | (c >> 2); if (o < n) out[o++] = ((c & 3) << 6) | d; } return out; }

function bombGeo() { const b = new MeshBuilder(rng(3)); b.color(0x3a2a24).lump(0.9, 0, 0, 0, 0.35); return b.build(); }
function glowGeo(col) { const b = new MeshBuilder(rng(4)); b.color(col).lump(0.5, 0, 0, 0, 0.2); return b.build(); }
function eyeGeo() {
  const b = new MeshBuilder(rng(5)), g = new MeshBuilder(rng(6));
  b.color(0x2a2230).blob(9, 1.2, 5, 0, 0, 0, 12, 3);
  g.color(0xe8d890).blob(6.5, 1.3, 3.6, 0, 0.1, 0, 12, 3);
  g.color(0x0a0808).blob(1.2, 1.4, 3.2, 0, 0.2, 0, 8, 3);
  return { solid: b.build(), glow: g.build() };
}

export class IslandLife {
  constructor(game) {
    this.game = game;
    this.S = game.world.settlement;
    this.bits = new Uint8Array(Math.ceil(CHART_N * CHART_N / 8));
    this._loadChart();
    this.t = 0; this.tickT = 0;
    this.bombs = [];
    this.bolts = [];
    this.coldT = 0;
    this.lights = [];
    // meshes for effects
    const scene = game.scene;
    this.bombGeo = bombGeo();
    this.emberMat = MAT.glow;
    this.wispMeshes = (this.S.isle.wisps || []).map(w => { const m = new THREE.Mesh(glowGeo(w.col), MAT.glowAdd); m.scale.setScalar(0.35); m.visible = false; scene.add(m); return m; });
    const E = eyeGeo();
    this.eye = new THREE.Group(); this.eye.add(new THREE.Mesh(E.solid, MAT.solid)); this.eyeIris = new THREE.Mesh(E.glow, MAT.glow); this.eye.add(this.eyeIris); this.eye.visible = false; scene.add(this.eye);
    this.eyeT = 0; this.phenT = 20; this.boomT = 40;
    // bobbing buoys in the Tidebreaker race
    const bb = new MeshBuilder(rng(7)); bb.color(0xe04a2a).cyl(0.5, 0.35, -0.4, 1, 7, true); bb.color(0xf2f2ee).cyl(0.52, 0.52, 0.3, 0.55, 7, false); bb.color(0x2a2a2a).cyl(0.05, 0.05, 1, 2.2, 4, true);
    const bgeo = bb.build();
    this.buoys = (this.S.isle.buoys || []).map(p => { const m = new THREE.Mesh(bgeo, MAT.solid); m.position.set(p.x, 0, p.z); m.castShadow = true; scene.add(m); return { m, x: p.x, z: p.z }; });
  }

  /* ================= the chart ================= */
  _loadChart() {
    const s = this.game.state.s;
    if (s.chart) this.bits = decode(s.chart, this.bits.length);
    this.chartDirty = false;
  }
  _cell(x, z) { return [Math.floor((x + WORLD.half) / CHART_CELL), Math.floor((z + WORLD.half) / CHART_CELL)]; }
  /** Has this point of the sea been charted? (the home waters always are) */
  charted(x, z) {
    if (distHome(x, z) < KNOWN_R) return true;
    const [ix, iz] = this._cell(x, z);
    if (ix < 0 || iz < 0 || ix >= CHART_N || iz >= CHART_N) return false;
    const i = iz * CHART_N + ix;
    return !!(this.bits[i >> 3] & (1 << (i & 7)));
  }
  chartedCell(ix, iz) { const i = iz * CHART_N + ix; return !!(this.bits[i >> 3] & (1 << (i & 7))); }
  /** Chart everything within r of a point. */
  reveal(x, z, r) {
    const [x0, z0] = this._cell(x - r, z - r), [x1, z1] = this._cell(x + r, z + r);
    let n = 0;
    for (let iz = Math.max(0, z0); iz <= Math.min(CHART_N - 1, z1); iz++) for (let ix = Math.max(0, x0); ix <= Math.min(CHART_N - 1, x1); ix++) {
      const cx = -WORLD.half + (ix + 0.5) * CHART_CELL, cz = -WORLD.half + (iz + 0.5) * CHART_CELL;
      if (Math.hypot(cx - x, cz - z) > r + CHART_CELL * 0.5) continue;
      const i = iz * CHART_N + ix;
      if (!(this.bits[i >> 3] & (1 << (i & 7)))) { this.bits[i >> 3] |= 1 << (i & 7); n++; }
    }
    if (n) this.chartDirty = true;
    return n;
  }
  chartAll() { this.bits.fill(255); this.chartDirty = true; }
  chartReset() { this.bits.fill(0); this.game.state.s.chart = ''; this.chartDirty = false; }
  chartedFraction() {
    let n = 0, tot = 0;
    for (let iz = 0; iz < CHART_N; iz++) for (let ix = 0; ix < CHART_N; ix++) {
      const cx = -WORLD.half + (ix + 0.5) * CHART_CELL, cz = -WORLD.half + (iz + 0.5) * CHART_CELL;
      if (distHome(cx, cz) > WORLD.edge) continue;
      tot++; if (this.chartedCell(ix, iz) || distHome(cx, cz) < KNOWN_R) n++;
    }
    return n / tot;
  }

  /* ================= discovery ================= */
  islandAt(x, z) {
    const A = this.S.anchors;
    for (const I of ISLAND_INFO) {
      const R = REGIONS[I.region];
      if (Math.hypot(x - R.x, z - R.z) < R.r * 0.55) return I;
      // the landing can sit out on a far corner of the island
      const L = A[I.id + 'Landing'], p = L && (L.pos || L);
      if (p && Math.hypot(x - p.x, z - p.z) < 160) return I;
    }
    return null;
  }
  _discover(I, P) {
    const G = this.game, s = G.state.s;
    if (s.found[I.id]) return;
    s.found[I.id] = s.day;
    G._saveDirty = true;
    this.reveal(REGIONS[I.region].x, REGIONS[I.region].z, REGIONS[I.region].r);
    G._everyone({ t: 'isle', k: 'found', id: I.id });
    G.award('isle:' + I.id);
    if (ISLAND_INFO.every(q => s.found[q.id])) G.award('wayfinder');
  }

  /* ================= every frame ================= */
  update(dt, host) {
    const G = this.game, P = G.player, w = G.world, night = G.isNight();
    this.t += dt;
    // --- the host keeps the chart and the discoveries ---
    if (host) {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = 1;
        for (const Q of G.allPlayers()) {
          if (!Q.pos) continue;
          const onBoat = !!Q.boat;
          this.reveal(Q.pos.x, Q.pos.z, onBoat ? 520 : 300);
          const I = this.islandAt(Q.pos.x, Q.pos.z);
          if (I) this._discover(I, Q);
          if (distHome(Q.pos.x, Q.pos.z) > WORLD.edge - 120) G.award('rim');
        }
        if (this.chartDirty) { G.state.s.chart = encode(this.bits); this.chartDirty = false; G._saveDirty = true; }
      }
      this._volcano(dt);
      this._lightning(dt);
      this._cold(dt);
      this._abyss(dt);
    } else {
      // a guest charts their own map as they go (the host's save keeps the shared one)
      this.tickT -= dt;
      if (this.tickT <= 0) { this.tickT = 1; this.reveal(P.pos.x, P.pos.z, P.boat ? 520 : 300); }
    }
    // --- what everyone sees ---
    this._bombs(dt);
    for (const sp of this.S.isle.spinners || []) sp.m.rotation[sp.axis] += dt * sp.speed * (sp.axis === 'x' ? 1 + (G.world.current(sp.m.position.x, sp.m.position.z).s || 0) : 1);
    if (this.S.isle.crystalGlow) this.S.isle.crystalGlow.visible = G._night() > 0.25;
    // the wisps: only at night, drifting and bobbing between the trees
    const W = this.S.isle.wisps || [];
    for (let i = 0; i < W.length; i++) {
      const q = W[i], m = this.wispMeshes[i];
      const vis = night && Math.hypot(q.x - P.pos.x, q.z - P.pos.z) < 260;
      m.visible = vis;
      if (!vis) continue;
      const a = this.t * 0.2 + q.ph, x = q.x + Math.cos(a) * 14 + Math.sin(a * 2.3) * 4, z = q.z + Math.sin(a * 0.8) * 14;
      m.position.set(x, G.world.height(x, z) + 2 + Math.sin(this.t * 1.3 + q.ph) * 0.8, z);
      m.scale.setScalar(0.3 + Math.sin(this.t * 3 + q.ph) * 0.08);
    }
    // the Tidebreaker buoys: tugged over and bobbing in the race
    for (const B of this.buoys) {
      if (Math.hypot(B.x - P.pos.x, B.z - P.pos.z) > 900) { B.m.visible = false; continue; }
      B.m.visible = true;
      const c = w.current(B.x, B.z);
      B.m.position.y = w.sea(B.x, B.z) - 0.2;
      B.m.rotation.set(clamp(c.z * 0.12, -0.6, 0.6), 0, clamp(-c.x * 0.12, -0.6, 0.6));
    }
    // the eye, when it is open
    if (this.eye.visible) {
      this.eyeT += dt;
      const open = this.eyeT < 2 ? this.eyeT / 2 : this.eyeT > 12 ? Math.max(0, 1 - (this.eyeT - 12) / 2) : 1;
      this.eyeIris.scale.set(1, 1, Math.max(0.05, open));
      this.eye.position.y = w.sea(this.eye.position.x, this.eye.position.z) + 0.1;
      this.eye.lookAt(P.pos.x, this.eye.position.y, P.pos.z); this.eye.rotateY(Math.PI / 2);
      if (this.eyeT > 14) this.eye.visible = false;
    }
    // near the hot vents the water steams
    if (inSpot('vents', P.pos.x, P.pos.z) && Math.random() < dt * 6) { const a = Math.random() * 6.28, d = 5 + Math.random() * 30, x = P.pos.x + Math.cos(a) * d, z = P.pos.z + Math.sin(a) * d; if (w.height(x, z) < -1) G.fx.smoke(x, w.sea(x, z), z, 0xe8e8e8); }
  }

  /* ================= Sunscar: the volcano ================= */
  _volcano(dt) {
    const V = this.S.isle.volcano, G = this.game;
    if (!V) return;
    const near = G.allPlayers().some(Q => Q.pos && Math.hypot(Q.pos.x - V.x, Q.pos.z - V.z) < 1100);
    if (!near) return;
    V.next -= dt;
    if (V.next > 0) return;
    V.next = 45 + Math.random() * 60;
    // an eruption: a rumble, a column of smoke, and burning rock thrown out round the peak
    const bombs = [];
    for (let k = 0; k < 9; k++) {
      const a = Math.random() * 6.28, d = 60 + Math.random() * 300;
      // some of them come for you
      const target = k < 3 ? G.allPlayers()[k % G.allPlayers().length] : null;
      const tx = target && Math.hypot(target.pos.x - V.x, target.pos.z - V.z) < 420 ? target.pos.x + (Math.random() - 0.5) * 30 : V.x + Math.cos(a) * d;
      const tz = target && Math.hypot(target.pos.x - V.x, target.pos.z - V.z) < 420 ? target.pos.z + (Math.random() - 0.5) * 30 : V.z + Math.sin(a) * d;
      bombs.push([Math.round(tx), Math.round(tz), +(3 + Math.random() * 3).toFixed(1)]);
    }
    G._everyone({ t: 'isle', k: 'erupt', b: bombs });
  }
  _erupt(bombs) {
    const G = this.game, V = this.S.isle.volcano;
    if (!V) return;
    const d = Math.hypot(G.player.pos.x - V.x, G.player.pos.z - V.z);
    G.audio.explosion(1.2, new THREE.Vector3(V.x, V.y, V.z)); G.audio.roar(Math.max(0.2, 1 - d / 1200));
    if (d < 700) G.addShake(Math.max(0.2, 0.8 - d / 900));
    for (let k = 0; k < 40; k++) G.fx.smoke(V.x + (Math.random() - 0.5) * 12, V.y + Math.random() * 10, V.z + (Math.random() - 0.5) * 12, 0x3a3434);
    G.fx.explosion(V.x, V.y + 2, V.z, 1.5);
    if (d < 900) G.ui.toast('The volcano is erupting! Burning rock is coming down - watch the sky!', 'bad');
    for (const [tx, tz, T] of bombs) {
      const m = new THREE.Mesh(this.bombGeo, MAT.solid);
      G.scene.add(m);
      const vx = (tx - V.x) / T, vz = (tz - V.z) / T, vy = (0 - V.y) / T + 9.8 * T / 2;
      this.bombs.push({ m, x: V.x, y: V.y, z: V.z, vx, vy, vz, t: 0, T });
    }
  }
  _bombs(dt) {
    const G = this.game;
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const B = this.bombs[i];
      B.t += dt; B.vy -= 9.8 * dt;
      B.x += B.vx * dt; B.y += B.vy * dt; B.z += B.vz * dt;
      B.m.position.set(B.x, B.y, B.z); B.m.rotation.x += dt * 3;
      if (Math.random() < 0.7) G.fx.fire(B.x, B.y, B.z, 1.2);
      if (Math.random() < 0.3) G.fx.smoke(B.x, B.y, B.z, 0x2a2a2a);
      const ground = G.world.height(B.x, B.z), sea = G.world.sea(B.x, B.z);
      if (B.y <= Math.max(ground, sea) || B.t > B.T + 2) {
        G.scene.remove(B.m); this.bombs.splice(i, 1);
        if (B.y <= sea + 0.5 && ground < sea) { G.fx.eruption(B.x, sea, B.z, 3); G.fx.smoke(B.x, sea + 1, B.z, 0xe8e8e8); }
        else G.fx.explosion(B.x, ground, B.z, 0.7);
        const d = Math.hypot(G.player.pos.x - B.x, G.player.pos.z - B.z);
        G.audio.explosion(0.6, new THREE.Vector3(B.x, B.y, B.z));
        if (d < 40) G.addShake(Math.max(0.2, 0.6 - d / 60));
        if (G.isHost) this._bombHit(B.x, B.z);
      }
    }
  }
  _bombHit(x, z) {
    const G = this.game;
    for (const b of G.boats) {
      const d = Math.hypot(b.pos.x - x, b.pos.z - z);
      if (d > b.hull.hl + 5) continue;
      if (G.state.has('heatsuit') && d > b.hull.hl * 0.5) { G._everyone({ t: 'toast', text: 'A burning rock hissed into the sea right beside the boat - the heat suit kept the embers off.', kind: 'warn' }); continue; }
      b.damage(22 + Math.random() * 18, 'volcano');
      b.ignite((Math.random() - 0.5) * b.hull.hw, (Math.random() - 0.5) * b.hull.hl);
      G._everyone({ t: 'toast', text: 'A lava bomb hit the boat! FIRE!', kind: 'bad' });
      G.award('eruption');
    }
    for (const Q of G.allPlayers()) {
      if (!Q.pos || Math.hypot(Q.pos.x - x, Q.pos.z - z) > 6) continue;
      if (G.state.has('heatsuit')) continue;
      G.hurtPlayer(Q, 35, 'volcano');
    }
  }

  /* ================= Thunderpeak: lightning in the water ================= */
  _lightning(dt) {
    const G = this.game;
    for (const Q of G.allPlayers()) {
      if (!Q.pos) continue;
      const s = stormAt(Q.pos.x, Q.pos.z);
      if (s < 0.7) continue;
      Q._boltT = (Q._boltT ?? 3) - dt;
      if (Q._boltT > 0) continue;
      Q._boltT = 2.5 + Math.random() * 5 * (1.6 - s);
      const b = Q.boat;
      // the highest thing on the water: sometimes that is your mast
      if (b && Math.random() < 0.14) {
        const x = b.pos.x, z = b.pos.z;
        const rod = b.stats.rod > 0;
        G._everyone({ t: 'isle', k: 'bolt', x, z, boat: b.id, rod });
        if (!rod) {
          b.damage(45, 'lightning');
          b.ignite(0, -b.hull.hl * 0.3);
          if (b.parts.engine && Math.random() < 0.5) b.breakSomething('engine');
          for (const R of G.allPlayers()) if (R.boat === b) G.shock(R, null, true);
        }
        continue;
      }
      const a = Math.random() * 6.28, d = 40 + Math.random() * 250;
      G._everyone({ t: 'isle', k: 'bolt', x: Q.pos.x + Math.cos(a) * d, z: Q.pos.z + Math.sin(a) * d });
    }
  }
  _bolt(e) {
    const G = this.game;
    G.world.sky.strikeAt(e.x, e.z, 0.9);
    const sea = G.world.sea(e.x, e.z);
    G.fx.sparks(e.x, sea + 1, e.z, 50, 0xd8f0ff); G.fx.splash(e.x, sea, e.z, 1.2);
    this.bolts.push({ x: e.x, z: e.z, t: G.world.time });
    if (this.bolts.length > 12) this.bolts.shift();
    if (e.boat && G.player.boat?.id === e.boat) {
      if (e.rod) G.ui.toast('Lightning hit the mast - the lightning rod took it straight down into the sea!', 'good');
      else { G.ui.banner('STRUCK BY LIGHTNING!', 'The boat is on fire. Fit a lightning rod at Thunderpeak.', 'storm', 3); G.award('struck'); }
    }
  }
  /** Did lightning hit the water near here in the last few seconds? (storm fish rush to it) */
  recentBolt(p, r = 45, sec = 10) { const t = this.game.world.time; return this.bolts.some(b => t - b.t < sec && Math.hypot(b.x - p.x, b.z - p.z) < r); }

  /* ================= Frostfall: the night cold ================= */
  _cold(dt) {
    const G = this.game;
    if (!G.isNight()) return;
    for (const Q of G.allPlayers()) {
      if (!Q.pos) continue;
      const R = REGIONS.frostfall;
      if (Math.hypot(Q.pos.x - R.x, Q.pos.z - R.z) > R.r * 0.7) continue;
      if (G.state.has('thermal')) continue;
      // a fire, a hut or a wheelhouse keeps you alive
      const warm = this.S.lights.some(L => L.flicker && L.pos.distanceTo(Q.pos) < 7) || (Q.boat && Q.boat.hull.cabin && !Q.boat.hull.cabin.open) || G.build?.warmAt(Q.pos);
      if (warm) continue;
      Q._coldT = (Q._coldT || 0) + dt;
      if (Q._coldT > 1.5) {
        Q._coldT = 0;
        G.hurtPlayer(Q, 3, 'cold');
        if (!Q._coldTold || G.world.time - Q._coldTold > 20) { Q._coldTold = G.world.time; G.tell(Q.id, 'The Frostfall night cold is in your bones. Get to a fire - or buy a thermal suit from Halvard.', 'bad'); }
      }
    }
  }

  /* ================= the Abyssal Reach: lights, booms and the eye ================= */
  _abyss(dt) {
    const G = this.game, R = REGIONS.abyssal;
    const Q = G.allPlayers().find(q => q.pos && Math.hypot(q.pos.x - R.x, q.pos.z - R.z) < 1000);
    if (!Q) return;
    this.phenT -= dt; this.boomT -= dt;
    if (this.phenT <= 0) {
      this.phenT = 20 + Math.random() * 35;
      const a = Math.random() * 6.28, d = 60 + Math.random() * 200;
      G._everyone({ t: 'isle', k: 'column', x: Q.pos.x + Math.cos(a) * d, z: Q.pos.z + Math.sin(a) * d });
    }
    if (this.boomT <= 0) {
      this.boomT = 50 + Math.random() * 70;
      G._everyone({ t: 'isle', k: 'boom' });
      for (const b of G.boats) if (Math.hypot(b.pos.x - R.x, b.pos.z - R.z) < 1000) b.impulse((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.5, 1.5);
    }
    // the eye opens only at night, and not often
    if (G.isNight() && !this.eye.visible && Math.random() < dt / 240) {
      const a = Math.random() * 6.28;
      G._everyone({ t: 'isle', k: 'eye', x: Q.pos.x + Math.cos(a) * 70, z: Q.pos.z + Math.sin(a) * 70 });
      G.award('eye');
    }
  }

  /* ================= network / local events ================= */
  onEvent(e) {
    const G = this.game;
    if (e.k === 'found') {
      const I = ISLAND_INFO.find(q => q.id === e.id);
      if (!I) return;
      G.state.s.found[I.id] = G.state.s.found[I.id] || G.state.s.day;
      G.ui.banner(I.name.toUpperCase(), 'Discovered, out in the ' + I.ring + '. ' + I.feature, 'compass', 6);
      G.audio.eventSting('zone'); G.audio.fanfare(2);
      G.chat?.system?.('Discovered: ' + I.name + ' (' + I.ring + ')');
    }
    if (e.k === 'erupt') this._erupt(e.b);
    if (e.k === 'bolt') this._bolt(e);
    if (e.k === 'boom') { G.addShake(0.5); G.audio.roar(0.6); G.audio.crash(); G.ui.toast('A boom from far below. The whole sea shivers.', 'warn'); }
    if (e.k === 'column') {
      const sea = G.world.sea(e.x, e.z);
      for (let k = 0; k < 60; k++) G.fx.glow.add(e.x + (Math.random() - 0.5) * 4, sea - 2, e.z + (Math.random() - 0.5) * 4, 0, 6 + Math.random() * 10, 0, 2 + Math.random() * 2, 0.3 + Math.random() * 0.3, Math.random() < 0.5 ? 0x6a7af0 : 0x9af0ff, 0, 0.2);
      G.fx.ripple(e.x, sea, e.z, 12, 3);
    }
    if (e.k === 'eye') {
      this.eye.position.set(e.x, G.world.sea(e.x, e.z), e.z); this.eye.visible = true; this.eyeT = 0;
      G.ui.banner('SOMETHING IS LOOKING AT YOU', 'An eye as wide as the lighthouse is tall has opened in the water.', 'eye', 5);
      G.audio.roar(0.4);
    }
    if (e.k === 'salvage') G.ui.toast(e.text, 'good');
  }

  /* ================= things you press E on ================= */
  use(X) {
    const G = this.game, P = G.player, s = G.state.s;
    if (X.kind === 'lift') {
      const L = X.lift ? this.S.isle[X.lift] : this.S.isle.lift;
      if (!L) return;
      const up = X.dir === 'up';
      G.audio.clunk(); G.ui.fade(true, up ? 'Up the cliff...' : 'Down to the dock...');
      setTimeout(() => {
        const to = up ? new THREE.Vector3(L.tx, L.ty + 0.1, L.tz) : new THREE.Vector3(L.bx, L.by + 0.1, L.bz + (X.lift ? 0 : 2));
        P.place(to, P.yaw); G.world.prebuild(to.x, to.z);
        if (L.cage) L.cage.position.set(up ? L.tx : L.bx, (up ? L.ty : L.by) + 0.1, up ? L.tz + 2 : L.bz + 1.5);
        G.ui.fade(false);
      }, 900);
    } else if (X.kind === 'telescope') {
      // from ninety metres up you can see a very long way
      const n = G.isHost ? this.reveal(X.pos.x, X.pos.z, 3800) : 0;
      if (G.isHost && n) { s.chart = encode(this.bits); G._saveDirty = true; }
      const seen = ISLAND_INFO.filter(I => Math.hypot(REGIONS[I.region].x - X.pos.x, REGIONS[I.region].z - X.pos.z) < 3800 && !s.found[I.id]).map(I => I.name);
      G.ui.subtitle('Through the telescope the sea goes on for ever. ' + (seen.length ? 'Out there, small and grey: ' + seen.join(', ') + '. They are on your map now.' : 'Everything you can see from here is already on your map.'), 8);
      s.sighted = s.sighted || {};
      for (const I of ISLAND_INFO) if (Math.hypot(REGIONS[I.region].x - X.pos.x, REGIONS[I.region].z - X.pos.z) < 3800) s.sighted[I.id] = true;
    } else if (X.kind === 'totem') {
      const lines = [
        'You press your ear to the wood. Far, far down, something like a heartbeat. The trees are all listening to the same thing.',
        'A whisper, very clearly: "the Moonpool, at midnight." Then only the wind.',
        'The totem is warm. Somewhere in the forest, something very tall stops walking.',
        'You hear water. Three lakes, talking to each other under the roots.',
      ];
      G.ui.subtitle(lines[(this._totem = ((this._totem ?? -1) + 1) % lines.length)], 7);
      G.audio.tone(180, 2.5, 'sine', 0.08, 0.4, 0.1);
    } else if (X.kind === 'spring') {
      P.hp = 100; P.stamina = P.maxStamina; P._coldT = 0;
      G.ui.toast('You soak in the hot spring. Everything aches less.', 'good');
      G.fx.smoke(X.pos.x, X.pos.y, X.pos.z, 0xf0f0f0);
    } else if (X.kind === 'note') {
      const N = LOST_NOTES[X.note];
      if (!N) return;
      G.ui.subtitle('"' + N.text + '"  -  ' + N.by, 12);
      if (!s.notes[X.note]) {
        s.notes[X.note] = s.day; G._saveDirty = true;
        const n = Object.keys(s.notes).length;
        G.ui.toast(`Note ${n} of ${LOST_NOTES.length} read.`, 'info');
        if (n >= LOST_NOTES.length) { G.award('lostnotes'); setTimeout(() => G.ui.banner('THE ASHCOMBE NOTES', 'Every note read. They followed the bell into the sea. The Lost Pilot swims in the bay at night.', 'ghost', 6), 1500); }
      }
    } else if (X.kind === 'salvage') {
      if (P.mode !== 'swim' || !P.underwater) { G.ui.toast('The salvage is down inside the wreck. Dive to it (Q) and press E there.', 'info'); return; }
      if (!G.state.has('wreckdiver')) { G.ui.toast('You cannot get inside without a Wreck Diving Suit. Vex sells them in Salvage Town.', 'warn'); return; }
      const last = s.salvaged[X.id];
      if (last && s.day - last < 2) { G.ui.toast('Picked clean. The sea will wash more in - come back in a couple of days.', 'info'); return; }
      s.salvaged[X.id] = s.day;
      const coins = 150 + Math.floor(Math.random() * 650);
      G.state.earn(coins, 'salvage');
      const junk = FISH.filter(f => f.junk && f.junk !== 'chest' && f.value > 0);
      const it = junk[Math.floor(Math.random() * junk.length)];
      if (it && G.isHost) G.landCatch({ sp: it.id, kg: it.kg[0], cm: it.cm[0], pos: P.pos.clone().add(new THREE.Vector3(0, 1, 0)), vel: new THREE.Vector3(0, 2, 0), by: P.id, size: 0.5, zone: 6, quiet: true });
      G.ui.toast(`Salvaged: ${coins} coins${it ? ' and ' + it.name : ''} out of the wreck.`, 'good');
      G.audio.coin();
      const nSalv = Object.keys(s.salvaged).length;
      if (nSalv >= 10) G.award('salvage');
    } else if (X.kind === 'cache') {
      if (G.claimed('cairn:' + X.id, P.id)) { G.ui.toast('You have already taken what was left under this cairn.', 'info'); return; }
      G.claim('cairn:' + X.id, P.id);
      s.caches[X.id] = s.day;
      const coins = 100 + Math.floor(Math.random() * 500);
      G.state.earn(coins, 'cache');
      const baits = ['mystery', 'glow', 'magnetic'];
      const bait = baits[Math.floor(Math.random() * baits.length)];
      G.state.addBait(bait, 3);
      G.vm.play('throw'); G.audio.step(false);
      G.ui.toast(`Under the cairn, in an oilcloth: ${coins} coins and some bait. Somebody left this for somebody.`, 'good');
      G._saveDirty = true;
    } else if (X.kind === 'crown') {
      G.ui.subtitle('The crowned head of the last king of Aurel, as tall as a house, looking out over his drowned city. The rubies in the crown still catch the light. Fish swim in and out of his ear.', 8);
    }
  }

  /** The island you have not been to that is nearest (for the Old Compass). */
  nearestUnfound(p) {
    const s = this.game.state.s;
    let best = null, bd = Infinity;
    for (const I of ISLAND_INFO) { if (s.found[I.id]) continue; const R = REGIONS[I.region], d = Math.hypot(R.x - p.x, R.z - p.z); if (d < bd) { bd = d; best = I; } }
    return best ? { I: best, x: REGIONS[best.region].x, z: REGIONS[best.region].z, d: bd } : null;
  }
}
export { HOME_CENTRE };
