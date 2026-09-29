/* Deep.js - what is underneath you.

   Out past the coast the sea is not empty. Now and then - rarely, and never
   twice in a row without a long quiet in between - something large makes
   itself known, and it is not always friendly:

     pass     a shape much bigger than the boat drifts under it. Nothing else.
     bump     a big fish hits the hull by accident: a lurch, a knock, maybe a crack
     ram      a predator comes at the boat on purpose, from a way off: a hole, a
              break, people thrown about
     breach   something comes up right beside you and falls back in: the sea
              comes over the rail and into the bilge
     drag     something takes hold of the keel and pulls the boat off course
     coil     a long body circles underneath and the boat spins with it
     glimpse  at night or in a storm, lightning shows a shape standing out of
              the sea far off, and then it is gone
     lunge    you are swimming in deep water: something comes up at you
     behind   you are standing at the rail: it waits until you look away

   The deeper and further out, the more often, and the worse. In the home
   waters: never. The host decides what happens (and does the damage); every
   screen draws the shapes from the event, so the whole crew sees the same
   thing. */

import * as THREE from '../../lib/three.module.js';
import { fishMesh } from '../art/FishArt.js';
import { FISH_BY_ID } from '../data/FishData.js';
import { zoneAt } from '../world/MapData.js';
import { clamp, lerp, smoothstep } from '../core/Util.js';
import { WAVE_GLSL } from '../world/Water.js';

/* A shape seen through the water: a dark print laid on the sea, riding the same waves the sea does. */
function shadeMat(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uStorm: U.uStorm, uWp: U.uWp, uOp: { value: 0.5 } },
    transparent: true, depthWrite: false,
    vertexShader: WAVE_GLSL + `\nvoid main() { vec4 wp = modelMatrix * vec4(position, 1.0); wp.y = waveH(wp.xz, uTime) + 0.06; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: 'uniform float uOp; void main() { gl_FragColor = vec4(0.01, 0.05, 0.08, uOp); }',
  });
}

const SHAPES = ['marlin', 'tuna', 'catfish', 'eel', 'pike'];
const DARK = new THREE.MeshBasicMaterial({ color: 0x02080c, transparent: true, opacity: 0.55, depthWrite: false });
const DUR = { pass: 9, bump: 3, ram: 6, breach: 4, drag: 7, coil: 9, glimpse: 3.2, lunge: 3, behind: 3.4 };

export class Deep {
  constructor(game) {
    this.game = game;
    this.quiet = 90;           // host: seconds until the sea may stir again
    this.acts = [];            // everyone: shapes being drawn {k, t, dur, x, z, a, len, id, m}
    this.lookT = 0;
    this.timers = [];
  }

  /* ---------------- the host: when, and what ---------------- */
  _host(dt) {
    const G = this.game, P = G.player;
    this.quiet -= dt;
    if (this.quiet > 0 || this.acts.length) return;
    // who is out there: boats with someone aboard, and swimmers in deep water
    for (const Q of G.allPlayers()) {
      if (!Q.pos) continue;
      const depth = -G.world.height(Q.pos.x, Q.pos.z);
      const z = zoneAt(Q.pos.x, Q.pos.z, depth);
      if (z < 2 || depth < 14) continue;
      const b = Q.boat;
      // roughly: once in a few minutes out in the deep, more often the further you go
      const rate = (0.004 + z * 0.0022) * (G.isNight() ? 1.4 : 1) * (G.world.storm > 0.3 ? 1.5 : 1);
      if (Math.random() > rate * 0.5 * 60 * dt) continue;
      let k;
      if (!b && Q.mode === 'swim') k = Math.random() < 0.55 ? 'pass' : 'lunge';
      else if (b) {
        const r = Math.random(), atRail = Q === P && this._atRail(Q);
        k = atRail && r < 0.18 ? 'behind'
          : (G.isNight() || G.world.storm > 0.4) && r < 0.3 ? 'glimpse'
          : r < 0.5 ? 'pass' : r < 0.64 ? 'bump' : r < 0.74 ? 'breach' : r < 0.82 ? 'coil' : r < 0.9 ? 'drag' : z >= 3 ? 'ram' : 'bump';
      } else continue;
      this._start(k, Q, z);
      return;
    }
  }
  _atRail(Q) { const b = Q.boat; return b && !Q.inHold && Math.abs(Q.local.x) > b.halfWidth(Q.local.z) - 0.8; }

  _start(k, Q, z) {
    const G = this.game, b = Q.boat;
    const at = b ? b.pos : Q.pos, h = b ? b.heading : Q.yaw;
    const len = clamp(8 + z * 3 + Math.random() * 10, 8, 38) * (k === 'lunge' ? 0.5 : 1);
    const a = Math.random() * Math.PI * 2;
    const e = { t: 'deep', k, x: +at.x.toFixed(1), z: +at.z.toFixed(1), a: +a.toFixed(2), h: +h.toFixed(2), len: +len.toFixed(1), sh: SHAPES[Math.floor(Math.random() * SHAPES.length)], boat: b ? b.id : 0, pid: b ? null : Q.id, side: Math.random() < 0.5 ? -1 : 1 };
    G._everyone(e);
    // after something happens, the sea stays calm a good while: the quiet is what makes it work
    this.quiet = 150 + Math.random() * 170;
    this._hits(e, b, Q);
  }

  /** The host's physics: what each one does to the boat and the people on it. */
  _hits(e, b, Q) {
    const G = this.game;
    const crew = b ? G.allPlayers().filter(p => p.boat === b) : [Q];
    const side = new THREE.Vector3(Math.cos(e.h) * e.side, 0, -Math.sin(e.h) * e.side);
    // on the game's clock, not the wall's, so a hit lands when the shape arrives
    const at = (s, fn) => this.timers.push({ t: s, fn: () => { if (G.running && (!b || !b.sinking)) fn(); } });
    const knockAll = f => { for (const p of crew) G.knockPlayer(p, side.clone().multiplyScalar(-1), f, 'deep'); };
    if (e.k === 'pass' && b) at(4.5, () => b.impulse(0, 0, 0.15 * e.side, 0.6));
    if (e.k === 'bump' && b) at(1.2, () => { b.impulse(-side.x * 2.5, -side.z * 2.5, 0.5 * e.side, 0.8); b.damage(10 + Math.random() * 10, 'fish'); knockAll(3); });
    if (e.k === 'ram' && b) at(4.2, () => { b.impulse(-side.x * 6, -side.z * 6, 1.2 * e.side, 1.5); b.damage(28 + Math.random() * 16, 'ram'); b.addHole(0.8 + Math.random() * 0.4); if (Math.random() < 0.6) b.breakSomething('rail'); knockAll(6); });
    if (e.k === 'breach' && b) at(1.6, () => { b.impulse(-side.x * 3, -side.z * 3, 0.9 * e.side, 2); b.water = Math.min(0.9, b.water + 0.18); knockAll(4.5); });
    if (e.k === 'drag' && b) for (let i = 0; i < 12; i++) at(1 + i * 0.4, () => { b.vel.x += -side.x * 0.9; b.vel.y += -side.z * 0.9; b.yawRate += 0.03 * e.side; });
    if (e.k === 'coil' && b) for (let i = 0; i < 16; i++) at(1 + i * 0.45, () => { b.yawRate += 0.12 * e.side; b.vr += 0.02 * e.side; b.vel.multiplyScalar(0.9); });
    if (e.k === 'lunge' && !b) at(1.6, () => { G.hurtPlayer(Q, 18, 'deep'); G.knockPlayer(Q, new THREE.Vector3(Math.random() - 0.5, 0.2, Math.random() - 0.5).normalize(), 5, 'deep'); });
  }

  /* ---------------- everyone: drawing it ---------------- */
  onEvent(e) {
    const G = this.game;
    const m = fishMesh(FISH_BY_ID[e.sh] || FISH_BY_ID.tuna, e.len);
    const shade = shadeMat(G.world.water.uniforms);
    m.traverse(o => { if (o.isMesh) { o.material = DARK; o.castShadow = false; o.renderOrder = 3; } });
    m.userData.shade = shade;
    G.scene.add(m);
    this.acts.push({ ...e, t: 0, dur: DUR[e.k] || 5, m });
    const P = G.player, near = Math.hypot(P.pos.x - e.x, P.pos.z - e.z) < 80;
    if (!near) return;
    // the sounds come before the sight
    if (e.k === 'glimpse') setTimeout(() => { G.world.sky.strikeAt(e.x + Math.sin(e.a) * 380, e.z + Math.cos(e.a) * 380, 1); }, 300);
    else if (e.k === 'ram') { G.audio.groan(0.9); setTimeout(() => { G.audio.crash(); G.audio.crack(); G.addShake(1.4); G.ui.toast('Something rammed the boat!', 'bad'); }, 4200); }
    else if (e.k === 'bump') setTimeout(() => { G.audio.thunk(); G.audio.crash(); G.addShake(0.8); G.ui.toast('Something big just hit the hull.', 'warn'); }, 1200);
    else if (e.k === 'breach') setTimeout(() => { G.audio.splash(3); G.audio.roar(0.5); G.addShake(1); }, 1500);
    else if (e.k === 'drag') { G.audio.groan(0.6); setTimeout(() => G.ui.toast('Something has hold of the boat.', 'warn'), 1500); }
    else if (e.k === 'coil') G.audio.groan(0.7);
    else if (e.k === 'lunge') setTimeout(() => { G.audio.roar(0.6); G.addShake(0.9); }, 1500);
    else if (e.k === 'behind') setTimeout(() => G.audio.splash(1.4), 1700);
    else if (e.k === 'pass' && Math.random() < 0.4) setTimeout(() => G.audio.groan(0.35), 2500);
  }

  update(dt, host) {
    const G = this.game, P = G.player;
    if (host) this._host(dt);
    for (let i = this.timers.length - 1; i >= 0; i--) { const T = this.timers[i]; T.t -= dt; if (T.t <= 0) { this.timers.splice(i, 1); T.fn(); } }
    for (let i = this.acts.length - 1; i >= 0; i--) {
      const A = this.acts[i];
      A.t += dt;
      const u = A.t / A.dur;
      if (u >= 1) { G.scene.remove(A.m); this.acts.splice(i, 1); continue; }
      this._pose(A, u, dt);
    }
    // swimming in the deep: the light goes, and you never quite know what is below
    const depth = -G.world.height(P.pos.x, P.pos.z);
    const swim = P.mode === 'swim' && depth > 20 && zoneAt(P.pos.x, P.pos.z, depth) >= 2;
    this.dread = lerp(this.dread || 0, swim ? clamp((depth - 20) / 60, 0.25, 0.6) * (P.underwater ? 1.4 : 1) : 0, Math.min(1, dt * 0.8));
    if (swim && Math.random() < dt * 0.05) G.audio.groan(0.2 + Math.random() * 0.2);
  }

  _pose(A, u, dt) {
    const G = this.game, m = A.m;
    const cx = A.x, cz = A.z, dir = new THREE.Vector3(Math.sin(A.a), 0, Math.cos(A.a));
    const perp = new THREE.Vector3(Math.cos(A.h) * A.side, 0, -Math.sin(A.h) * A.side);
    const sea = G.world.sea(cx, cz);
    let x = cx, z = cz, y = sea - 6, yaw = A.a, vis = 1;
    if (A.k === 'pass' || A.k === 'lunge') { const s = lerp(-60, 60, u); x = cx + dir.x * s; z = cz + dir.z * s; y = sea - (A.k === 'lunge' && u > 0.45 && u < 0.6 ? 1.5 : 7 + A.len * 0.15); vis = Math.sin(u * Math.PI); }
    else if (A.k === 'bump') { const s = lerp(40, 0, smoothstep(0, 0.4, u)); x = cx + perp.x * s; z = cz + perp.z * s; y = sea - 3; yaw = Math.atan2(-perp.x, -perp.z); vis = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4; }
    else if (A.k === 'ram') { const s = lerp(120, 0, smoothstep(0, 0.7, u)); x = cx + perp.x * s; z = cz + perp.z * s; y = sea - 2 + (u < 0.7 ? 0 : -(u - 0.7) * 20); yaw = Math.atan2(-perp.x, -perp.z); if (u < 0.7 && Math.random() < 0.6) G.fx.foam(x, sea + 0.1, z, -perp.x * 8, -perp.z * 8); }
    else if (A.k === 'breach') { x = cx + perp.x * (6 + A.len * 0.3); z = cz + perp.z * (6 + A.len * 0.3); y = sea + Math.sin(clamp(u / 0.6, 0, 1) * Math.PI) * A.len * 0.5 - 4; yaw = A.h; m.rotation.z = lerp(0.9, -0.9, clamp(u / 0.6, 0, 1)); if (Math.abs(u - 0.38) < 0.02) G.fx.eruption(x, sea, z, A.len * 0.6); }
    else if (A.k === 'drag') { x = cx + perp.x * 5; z = cz + perp.z * 5; y = sea - 5; yaw = Math.atan2(perp.x, perp.z); vis = Math.sin(u * Math.PI) * 0.8; }
    else if (A.k === 'coil') { const a = u * Math.PI * 3; x = cx + Math.cos(a) * 18; z = cz + Math.sin(a) * 18; y = sea - 5; yaw = -a; vis = Math.sin(u * Math.PI); }
    else if (A.k === 'glimpse') { const far = 380; x = cx + dir.x * far; z = cz + dir.z * far; y = sea + A.len * 0.2 - smoothstep(0.3, 1, u) * A.len * 0.9; yaw = A.a + Math.PI / 2; m.rotation.z = 1.2; vis = u < 0.12 ? u / 0.12 : 1; }
    else if (A.k === 'behind') {
      // on the side you are not looking at: it only surfaces once you have turned away
      const P = G.player, look = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
      if (!A.dirB) A.dirB = look.clone().multiplyScalar(-1);
      x = cx + A.dirB.x * 9; z = cz + A.dirB.z * 9; y = sea + Math.sin(clamp((u - 0.4) / 0.4, 0, 1) * Math.PI) * 2.5 - 2.2; yaw = Math.atan2(A.dirB.z, -A.dirB.x);
      if (Math.abs(u - 0.5) < 0.02) G.fx.splash(x, sea, z, 2.5);
    }
    // under the water you see it as a dark shape through the surface, not the thing itself
    const under = ['pass', 'drag', 'coil', 'lunge', 'bump', 'ram'].includes(A.k) && y < sea - 0.5;
    const mat = under ? m.userData.shade : DARK;
    if (under) m.userData.shade.uniforms.uOp.value = clamp(0.78 - (sea - y) * 0.02, 0.35, 0.78) * vis;
    m.traverse(o => { if (o.isMesh && o.material !== mat) o.material = mat; });
    m.position.set(x, y, z);
    if (A.k !== 'breach' && A.k !== 'glimpse') m.rotation.set(0, yaw, 0); else m.rotation.y = yaw;
    m.visible = vis > 0.05;
  }
}
