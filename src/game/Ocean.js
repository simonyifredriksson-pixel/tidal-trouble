/* Ocean.js - the sea between the places, so it is never an empty road.

   HOTSPOTS (host, synced): signs on the water that something is feeding.
   Nothing marks them on a map - you have to notice them.
     birds    gulls wheeling and diving     sprats, and the fish hunting them
     boil     the surface boiling with fish  fast bites, rare fish
     bubbles  bubbles rising from far below  deep fish - the Bubble-eye
     glow     a patch of glowing water       (night) the Lantern Jelly
     debris   floating wreckage              junk, charts, keys, strongboxes...
   Fishing inside one bites twice as fast and leans rare.

   AMBIENCE (every peer, cosmetic): gulls near the coasts, fish jumping,
   whales blowing far off, other fishing boats on the horizon, lightning in
   the distance when you are far out.

   MYSTERIES (host, saved): a Waterlogged Chart marks an X somewhere at sea.
   Fish right on it and a Sunken Strongbox comes up; inside is coin and a
   Drowned Journal Page, and every page is about one of the ocean beasts. */

import * as THREE from '../../lib/three.module.js?v=1790356418';
import { MeshBuilder } from '../art/Geo.js?v=1790356418';
import { MAT } from '../art/Materials.js?v=1790356418';
import { buildBoat } from '../art/BoatArt.js?v=1790356418';
import { buildBarrel, buildCrate } from '../art/BuildingArt.js?v=1790356418';
import { BEASTS } from '../data/BeastData.js?v=1790356418';
import { clamp, uid, rng } from '../core/Util.js?v=1790356418';

const _v = new THREE.Vector3();
const HOT_R = { birds: 26, boil: 22, bubbles: 16, glow: 28, debris: 20 };

function birdGeo() {
  const b = new MeshBuilder();
  b.color(0xf4f4f0).blob(0.08, 0.06, 0.2, 0, 0, 0, 6, 3);
  b.color(0xf08a2a).cone(0.02, 0, 0.06, 3, 0, 0.2);
  return b.build();
}
function wingGeo() { const b = new MeshBuilder(); b.color(0xe8e8e4).card([0, 0, 0.06], [0.45, 0.04, -0.02], [0, 0, -0.08]); b.color(0x3a3a3a).card([0.38, 0.04, 0.0], [0.45, 0.04, -0.02], [0.34, 0.03, -0.05]); return b.build(); }

export class Ocean {
  constructor(game) {
    this.game = game;
    this.hot = [];
    this.spawnT = 4;
    this.birds = [];
    this.debris = new Map();
    this.jumpers = [];
    this.far = [];
    this.spoutT = 20; this.boltT = 25;
    const bg = birdGeo(), wg = wingGeo();
    for (let i = 0; i < 28; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(bg, MAT.solid));
      const L = new THREE.Mesh(wg, MAT.solidDS), R = new THREE.Mesh(wg, MAT.solidDS); R.scale.x = -1;
      g.add(L, R); g.visible = false; g.scale.setScalar(1.4);
      game.scene.add(g);
      this.birds.push({ g, L, R, a: Math.random() * 6.28, r: 10 + Math.random() * 20, h: 8 + Math.random() * 10, sp: 0.4 + Math.random() * 0.4, dive: 0, host: null, cx: 0, cz: 0 });
    }
    // other boats out on the water, sailing their own long loops
    const hulls = ['motor', 'trawler', 'dinghy'];
    const routes = [[[200, 420], [620, 360], [760, -120], [250, -300]], [[-520, 120], [-900, 300], [-980, -300], [-560, -380]], [[300, -900], [-300, -1000], [-500, -600], [220, -560]]];
    routes.forEach((R, i) => {
      const art = buildBoat({ hull: hulls[i], parts: { lights: 1 }, paint: ['harbour', 'moss', 'lobster'][i], decor: ['flag'] });
      game.scene.add(art.group);
      this.far.push({ g: art.group, R, len: R.reduce((a, p, k) => a + Math.hypot(p[0] - R[(k + 1) % R.length][0], p[1] - R[(k + 1) % R.length][1]), 0), off: i * 400, speed: 5 + i });
    });
  }

  /* ================= hotspots ================= */
  hotspotAt(p) {
    let best = null;
    for (const h of this.hot) if (Math.hypot(p.x - h.x, p.z - h.z) < h.r) best = h;
    // the Glassback lights the water around it at night
    const B = this.game.beasts?.b;
    if (!best && B && B.id === 'glassback' && this.game.isNight() && Math.hypot(p.x - B.x, p.z - B.z) < 45) return { kind: 'glow', x: B.x, z: B.z, r: 45 };
    return best;
  }
  addHotspot(kind, x, z, life = 180) {
    const h = { id: uid('h'), kind, x, z, r: HOT_R[kind], life, t: 0 };
    this.hot.push(h);
    return h;
  }
  _host(dt) {
    const G = this.game;
    for (let i = this.hot.length - 1; i >= 0; i--) { const h = this.hot[i]; h.t += dt; if (h.t > h.life) this.hot.splice(i, 1); }
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 12;
    for (const P of G.allPlayers()) {
      const near = this.hot.filter(h => Math.hypot(h.x - P.pos.x, h.z - P.pos.z) < 420).length;
      if (near >= 4) continue;
      for (let k = 0; k < 20; k++) {
        const a = Math.random() * 6.28, d = 70 + Math.random() * 300;
        const x = P.pos.x + Math.cos(a) * d, z = P.pos.z + Math.sin(a) * d;
        const depth = -G.world.height(x, z);
        if (depth < 4 || G.isLake(x, z) || G.world.onIce(x, z) || Math.abs(x) > 1250 || Math.abs(z) > 1250) continue;
        const night = G.isNight();
        const pool = [['boil', 3], ['debris', 1.4], ['bubbles', depth > 18 ? 2 : 0], ['birds', night ? 0 : 3], ['glow', night ? 2.2 : 0]];
        let tot = pool.reduce((s, q) => s + q[1], 0), r = Math.random() * tot, kind = 'boil';
        for (const [k2, w] of pool) { r -= w; if (r <= 0) { kind = k2; break; } }
        this.addHotspot(kind, x, z, 140 + Math.random() * 140);
        break;
      }
    }
  }

  /* ================= mysteries ================= */
  mysteryAt(p) { return (this.game.state.s.mysteries || []).find(m => m.stage === 0 && Math.hypot(p.x - m.x, p.z - m.z) < 30) || null; }
  /** Host: a chart was found. Mark an X somewhere far out. */
  newMystery() {
    const G = this.game, s = G.state.s;
    s.mysteries = s.mysteries || [];
    for (let k = 0; k < 80; k++) {
      const a = Math.random() * 6.28, d = 320 + Math.random() * 700;
      const x = Math.cos(a) * d, z = 80 + Math.sin(a) * d;
      if (G.world.height(x, z) > -8 || Math.abs(x) > 1200 || Math.abs(z) > 1200) continue;
      const m = { id: uid('m'), x: Math.round(x), z: Math.round(z), stage: 0, day: s.day };
      s.mysteries.push(m);
      return m;
    }
    return null;
  }
  /** Host: a journal page. It tells you about a beast you do not know yet. */
  readPage() {
    const s = this.game.state.s;
    s.beastClues = s.beastClues || {};
    const unknown = BEASTS.filter(b => !s.beastClues[b.id]);
    const D = (unknown.length ? unknown : BEASTS)[Math.floor(Math.random() * (unknown.length || BEASTS.length))];
    s.beastClues[D.id] = s.day;
    return D;
  }

  /* ================= every peer ================= */
  update(dt, host) {
    if (host) this._host(dt);
    const G = this.game, P = G.player, t = G.world.time;
    // birds: over a hotspot they wheel and dive; near the coast they just loaf about
    const birdHot = this.hot.filter(h => h.kind === 'birds' && Math.hypot(h.x - P.pos.x, h.z - P.pos.z) < 500);
    this.birds.forEach((B, i) => {
      const hot = birdHot[i % Math.max(1, birdHot.length)];
      if (hot) { B.cx = hot.x; B.cz = hot.z; B.on = true; }
      else {
        const coast = G.world.height(P.pos.x, P.pos.z) > -30 && !G.isNight() && i < 8 && (G.mist || 0) < 0.4;
        if (coast && !B.on) { B.cx = P.pos.x + Math.cos(i) * 60; B.cz = P.pos.z + Math.sin(i * 1.7) * 60; }
        B.on = coast;
      }
      B.g.visible = B.on;
      if (!B.on) return;
      B.a += dt * B.sp;
      B.dive = Math.max(0, B.dive - dt);
      if (hot && B.dive <= 0 && Math.random() < dt * 0.25) B.dive = 1.6;
      const dv = B.dive > 0 ? Math.sin((1.6 - B.dive) / 1.6 * Math.PI) : 0;
      const x = B.cx + Math.cos(B.a) * B.r, z = B.cz + Math.sin(B.a) * B.r;
      const y = G.world.sea(x, z) + B.h * (1 - dv * 0.95);
      if (dv > 0.9 && Math.random() < dt * 8) G.fx.splash(x, G.world.sea(x, z), z, 0.3);
      B.g.position.set(x, y, z);
      B.g.rotation.set(dv * 0.9, B.a + Math.PI, Math.sin(B.a * 2) * 0.2);
      const flap = Math.sin(t * 9 + i) * (dv > 0 ? 0.1 : 0.6);
      B.L.rotation.z = flap; B.R.rotation.z = -flap;
    });
    // each hotspot's tell
    for (const h of this.hot) {
      const d = Math.hypot(h.x - P.pos.x, h.z - P.pos.z);
      if (d > 600) continue;
      const rx = () => h.x + (Math.random() - 0.5) * h.r * 1.4, rz = () => h.z + (Math.random() - 0.5) * h.r * 1.4;
      if (h.kind === 'boil' && Math.random() < dt * 5) { const x = rx(), z = rz(); G.fx.splash(x, G.world.sea(x, z), z, 0.35); if (Math.random() < 0.35) this._jump(x, z); }
      if (h.kind === 'bubbles' && Math.random() < dt * 9) { const x = h.x + (Math.random() - 0.5) * 8, z = h.z + (Math.random() - 0.5) * 8; G.fx.bubbles(x, G.world.sea(x, z) - 0.2, z, 3); if (Math.random() < 0.2) G.fx.ripple(x, G.world.sea(x, z), z, 2.5, 1.5); }
      if (h.kind === 'glow' && Math.random() < dt * 14) { const x = rx(), z = rz(); G.fx.glint(x, G.world.sea(x, z) + 0.05, z, 0x7af0e0); }
      if (h.kind === 'debris') this._debris(h, dt);
    }
    for (const [id, D] of this.debris) if (!this.hot.some(h => h.id === id)) { G.scene.remove(D.g); this.debris.delete(id); }
    // jumping fish, anywhere with water
    if (Math.random() < dt * 0.5) { const a = Math.random() * 6.28, d = 25 + Math.random() * 70, x = P.pos.x + Math.cos(a) * d, z = P.pos.z + Math.sin(a) * d; if (G.world.height(x, z) < -2) this._jump(x, z); }
    for (let i = this.jumpers.length - 1; i >= 0; i--) {
      const J = this.jumpers[i]; J.t += dt;
      const f = J.t / 0.8;
      if (f >= 1) { G.fx.splash(J.x + J.dx, J.y0, J.z + J.dz, 0.35); G.scene.remove(J.m); this.jumpers.splice(i, 1); continue; }
      J.m.position.set(J.x + J.dx * f, J.y0 + Math.sin(f * Math.PI) * 1.2, J.z + J.dz * f);
      J.m.rotation.set(0, J.h, Math.cos(f * Math.PI) * 0.8);
    }
    // far out: whales blowing on the horizon and lightning over the edge of the world
    const far = G.world.height(P.pos.x, P.pos.z) < -25;
    this.spoutT -= dt;
    if (far && this.spoutT <= 0) {
      this.spoutT = 30 + Math.random() * 50;
      const a = Math.random() * 6.28, d = 180 + Math.random() * 200, x = P.pos.x + Math.cos(a) * d, z = P.pos.z + Math.sin(a) * d;
      if (G.world.height(x, z) < -15) { for (let k = 0; k < 3; k++) setTimeout(() => G.fx.water(x, G.world.sea(x, z) + 1, z, 0, 1.6, 0), k * 120); G.fx.eruption(x, G.world.sea(x, z), z, 3); G.audio.blow(d); }
    }
    this.boltT -= dt;
    if (far && this.boltT <= 0 && G.world.storm < 0.3) {
      this.boltT = 40 + Math.random() * 70;
      const sky = G.world.sky, a = Math.random() * 6.28;
      if (sky.strikeAt) sky.strikeAt(P.pos.x + Math.cos(a) * 900, P.pos.z + Math.sin(a) * 900, 0.35);
    }
    // the other boats
    for (const B of this.far) {
      const s = ((t * B.speed + B.off) % B.len + B.len) % B.len;
      let acc = 0;
      for (let k = 0; k < B.R.length; k++) {
        const a = B.R[k], b = B.R[(k + 1) % B.R.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (acc + L >= s) { const f = (s - acc) / L, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; B.g.position.set(x, G.world.sea(x, z) - 0.1, z); B.g.rotation.set(0, Math.atan2(b[0] - a[0], b[1] - a[1]), Math.sin(t * 0.8 + B.off) * 0.04); break; }
        acc += L;
      }
      B.g.visible = B.g.position.distanceTo(P.pos) < 1400;
    }
  }

  _jump(x, z) {
    const G = this.game;
    if (this.jumpers.length > 12) return;
    const m = G.fishMeshCache(['mackerel', 'cod', 'seabass', 'barracuda'][Math.floor(Math.random() * 4)]).clone();
    m.scale.setScalar(0.4 + Math.random() * 0.3);
    G.scene.add(m);
    const h = Math.random() * 6.28, y0 = G.world.sea(x, z);
    G.fx.splash(x, y0, z, 0.3);
    this.jumpers.push({ m, t: 0, x, z, y0, h, dx: Math.cos(h) * 1.4, dz: -Math.sin(h) * 1.4 });
  }

  _debris(h, dt) {
    const G = this.game;
    let D = this.debris.get(h.id);
    if (!D) {
      const r = rng(h.x | 0), b = new MeshBuilder(r);
      const items = [];
      for (let k = 0; k < 9; k++) {
        const x = (r() - 0.5) * h.r * 1.4, z = (r() - 0.5) * h.r * 1.4;
        items.push([x, z, r() * 6.28]);
        const q = r();
        b.push(x, 0, z, 0, r() * 6.28, 0);
        if (q < 0.3) buildBarrel(b, 0, -0.45, 0, 0x6a4a2e);
        else if (q < 0.55) buildCrate(b, 0, -0.35, 0, 0.7, 0x7a5a3a, r());
        else for (let j = 0; j < 3; j++) b.color(0x6a4a30).box(1.8 + r(), 0.1, 0.22, 0, 0, j * 0.26 - 0.26);
        b.pop();
      }
      const g = new THREE.Mesh(b.build(), MAT.solid);
      g.castShadow = true;
      G.scene.add(g);
      D = { g, items };
      this.debris.set(h.id, D);
    }
    D.g.position.set(h.x, G.world.sea(h.x, h.z) - 0.05, h.z);
    D.g.rotation.y += dt * 0.02;
  }

  snapshot() { return this.hot.map(h => [h.id, h.kind, Math.round(h.x), Math.round(h.z), h.r, Math.round(h.life - h.t)]); }
  applySnapshot(a) {
    if (!a) return;
    this.hot = a.map(([id, kind, x, z, r, left]) => ({ id, kind, x, z, r, life: left, t: 0 }));
  }
}
