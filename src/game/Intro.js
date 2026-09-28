/* Intro.js - the first night. You do not start on the island; you start
   on a fishing boat, far out, in the worst storm you have ever seen.

   A scripted sequence, played by every client for itself (a guest who
   joins while the host is still in it is synced to the same moment):

     0     black, then the storm: rain, wind, thunder, a boat thrown about
     10    the sea goes wrong. The Thing Below rises off the starboard bow,
           only its head and arms out of the water, and looks at you
     19    it goes down again, and its wake nearly rolls the boat
     23.5  you: "What the hell was that?"
     28.5  it comes back - close, and high, higher than a lighthouse
     32.5  the arms come up round the boat; the boat comes apart
     35    black. Three seconds of nothing.
     38    you wake on the beach at Driftwood Bay, blurred and swimming,
           and Old Gus is standing over you

   You can look around the whole time (the mouse is yours) but you cannot
   move, fish or open anything. There is no skipping it. */

import * as THREE from '../../lib/three.module.js';
import { buildBoat } from '../art/BoatArt.js';
import { buildThingBelow, curlArm } from '../art/AbyssArt.js';
import { MeshBuilder } from '../art/Geo.js';
import { MAT } from '../art/Materials.js';
import { heightAt } from '../world/Terrain.js';
import { clamp, dampAngle, lerp, smoothstep, rng } from '../core/Util.js';

export const INTRO_SEA = { x: 1900, z: 1200 };
const T = { rise1: 10, look: 16, sink1: 19, say: 23.5, rise2: 28.5, arms: 32.5, smash: 33.6, black: 35.2, wake: 38.2, up: 43.5, done: 46.5 };
export const INTRO_T = T;

function debrisGeo(seed) {
  const r = rng(seed);
  const b = new MeshBuilder(r);
  const w = 0.6 + r() * 1.6, cols = [0x8a2e22, 0xe8e2d4, 0x6a4a30, 0x3a3a40];
  b.color(cols[seed % 4], 0.1).box(w, 0.08, 0.22 + r() * 0.3, 0, 0, 0);
  if (r() < 0.5) b.color(0x6a4a30).box(0.08, 0.08, 0.6, w * 0.3, 0.08, 0);
  return b.build();
}

export class Intro {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.t = 0;
  }

  /** Start from the beginning (or from `at` seconds in, to match the host). */
  start(at = 0) {
    const G = this.game;
    this.active = true;
    this.t = at;
    this.said = false;
    this.yaw = -Math.PI / 2 + 0.25; this.pitch = 0.02;
    this.stage = '';
    G.ui.showHUD(false);
    G.ui.closeTalk(); G.ui.close();
    G.fishing?.cancel(true);
    this.todWas = G.tod;
    G.tod = 0.77;           // the last of the light, going fast
    // the boat you came in on - it will not survive the night
    const at0 = INTRO_SEA;
    this.boat = buildBoat({ hull: 'seafarer', parts: { lights: 1 }, paint: 'harbour', decor: [] });
    this.boat.group.position.set(at0.x, 0, at0.z);
    G.scene.add(this.boat.group);
    this.deck = 0.7;
    this.heading = 0.4;
    // standing at the stern, looking out over the starboard side (where it will come up)
    this.yaw = Math.atan2(-Math.cos(this.heading), Math.sin(this.heading)) + 0.2;
    this.kick = { p: 0, r: 0, vp: 0, vr: 0 };
    // the Thing Below, waiting under the boat
    this.thing = buildThingBelow();
    this.thing.group.visible = false;
    G.scene.add(this.thing.group);
    this.pieces = [];
    this.lightning = 2;
    this._overlay();
    this.ov.classList.add('on');
    this.black = 1;
    G.world.prebuild(at0.x, at0.z);
    if (at > T.black) this._toBeach();
  }

  /** A guest's intro jumps to the host's moment. */
  sync(at) { if (this.active && Math.abs(at - this.t) > 1.5 && this.t < T.black) this.t = at; }

  _overlay() {
    if (this.ov) return;
    const d = document.createElement('div');
    d.id = 'cine';
    d.innerHTML = '<div class="bars top"></div><div class="bars bot"></div><div class="blk"></div><div class="say"><b></b><span></span></div>';
    document.body.appendChild(d);
    this.ov = d;
  }

  /* ---------------- every frame ---------------- */
  update(dt, input) {
    if (!this.active) return;
    const G = this.game;
    this.t = this.hold !== undefined ? this.hold : this.t + dt;
    const t = this.t;
    // look around
    const look = input.look();
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch - look.y, -1.2, 1.2);
    if (t < T.black) this._sea(dt, t);
    else if (t < T.wake) { this.black = 1; if (!this.onBeach) this._toBeach(); }
    else this._wake(dt, t);
    this.ov.querySelector('.blk').style.opacity = this.black;
    // friends are somewhere else entirely until everyone is on the beach
    for (const r of G.remotes.values()) if (r.c) r.c.root.visible = t > T.done;
    if (t > T.done) this._finish();
  }

  /** The storm, the creature and the end of the boat. */
  _sea(dt, t) {
    const G = this.game, W = G.world, A = INTRO_SEA;
    // the sky is the storm, and it is dusk - for a guest too, whatever the host's clock says
    W.storm = 1;
    G.tod = 0.77;
    this.black = t < 2.5 ? 1 - t / 2.5 : 0;
    if (t > T.smash + 1.1) this.black = clamp((t - T.smash - 1.1) / 0.5, 0, 1);
    // lightning every few seconds, closer and brighter as it goes on
    this.lightning -= dt;
    if (this.lightning <= 0) {
      this.lightning = t > T.rise2 ? 1 + Math.random() * 1.5 : 2.5 + Math.random() * 3.5;
      const a = Math.random() * 6.28, d = t > T.rise2 ? 60 + Math.random() * 90 : 140 + Math.random() * 300;
      W.sky.strikeAt(A.x + Math.cos(a) * d, A.z + Math.sin(a) * d, 1);
    }
    // the boat rides the swell: heave from the sea height, pitch and roll from its slope
    const B = this.boat.group, h = this.heading;
    const fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
    const L = 4, Wd = 1.5;
    const bow = W.sea(A.x + fx * L, A.z + fz * L), stern = W.sea(A.x - fx * L, A.z - fz * L);
    const port = W.sea(A.x - rx * Wd, A.z - rz * Wd), star = W.sea(A.x + rx * Wd, A.z + rz * Wd);
    const K = this.kick;
    K.vp += (-K.p * 7 - K.vp * 1.6) * dt; K.vr += (-K.r * 6 - K.vr * 1.3) * dt;
    K.p += K.vp * dt; K.r += K.vr * dt;
    const pitch = Math.atan2(bow - stern, 2 * L) + K.p, roll = Math.atan2(star - port, 2 * Wd) * 0.8 + K.r;
    const y = (bow + stern + port + star) / 4 - 0.35;
    const broken = t > T.smash;
    B.visible = !broken;
    B.position.set(A.x, y, A.z);
    B.rotation.set(0, h, 0, 'YXZ');
    B.rotateX(-pitch); B.rotateZ(roll);
    // the Thing Below
    const TH = this.thing, g = TH.group;
    const side = new THREE.Vector3(rx, 0, rz);
    if (t > T.rise1 - 2 && t < T.sink1 + 5) {
      // first time: off the starboard bow, a hundred metres out, head and shoulders only
      g.visible = true;
      const k = smoothstep(T.rise1, T.rise1 + 6, t) * (1 - smoothstep(T.sink1, T.sink1 + 4.5, t));
      const p = new THREE.Vector3(A.x, 0, A.z).addScaledVector(side, 88).addScaledVector(new THREE.Vector3(fx, 0, fz), 8);
      g.position.set(p.x, lerp(-46, -4, k) + Math.sin(t * 0.7) * 0.6, p.z);
      // it turns to look at the boat, holds, and looks away as it goes
      const want = Math.atan2(A.x - p.x, A.z - p.z);
      g.rotation.y = want + (1 - smoothstep(T.look - 3, T.look, t)) * 0.7 + smoothstep(T.sink1, T.sink1 + 3, t) * 0.5;
      TH.head.rotation.x = -0.15 + Math.sin(t * 0.5) * 0.04;
      this._arms(t, 0.8, 0.35);
      if (t > T.rise1 && !this._roared1) { this._roared1 = true; G.audio.groan(0.8); }
      if (t > T.rise1 + 3 && !this._roar1b) { this._roar1b = true; G.audio.roar(0.7); }
      this._pour(g, k, t);
      if (t > T.sink1 + 0.5 && !this._wave1) {
        // it goes down and the sea it moved comes at the boat
        this._wave1 = true;
        G.fx.eruption(p.x, 0, p.z, 26);
        setTimeout(() => { if (!this.active) return; this.kick.vr += 1.3; this.kick.vp -= 0.5; G.addShake(1); G.audio.crash(); G.audio.splash(3); for (let k = 0; k < 20; k++) G.fx.water(A.x + (Math.random() - 0.5) * 6, 1.5, A.z + (Math.random() - 0.5) * 8, -rx * 2, 2, -rz * 2); }, 2600);
      }
    } else if (t >= T.rise2 - 1 && t < T.black) {
      // second time: close, and it keeps coming up
      g.visible = true;
      const k = smoothstep(T.rise2, T.rise2 + 4, t);
      const p = new THREE.Vector3(A.x, 0, A.z).addScaledVector(side, 34).addScaledVector(new THREE.Vector3(fx, 0, fz), -2);
      g.position.set(p.x, lerp(-70, 20, k) + Math.sin(t) * 0.5, p.z);
      g.rotation.y = Math.atan2(A.x - p.x, A.z - p.z);
      TH.head.rotation.x = lerp(-0.1, 0.5, smoothstep(T.arms, T.smash, t));
      this._arms(t, lerp(0.8, 2.6, smoothstep(T.arms - 1, T.smash, t)), 0.3, true);
      this._pour(g, 1, t);
      if (!this._roar2 && t > T.rise2 + 0.5) { this._roar2 = true; G.audio.roar(1.4); G.audio.groan(1.2); G.addShake(0.8); G.fx.eruption(p.x, 0, p.z, 30); }
      if (!this._roar3 && t > T.arms) { this._roar3 = true; G.audio.roar(1.6); G.addShake(1.2); W.sky.strikeAt(A.x + 20, A.z - 15, 1); }
      if (t > T.rise2 + 1) { this.kick.vr += Math.sin(t * 3) * dt * 1.2; }
      if (broken && !this._smashed) this._smash();
    } else g.visible = false;
    // the pieces fly and fall
    for (const P of this.pieces) {
      P.v.y -= 9.8 * dt;
      P.m.position.addScaledVector(P.v, dt);
      P.m.rotation.x += P.w.x * dt; P.m.rotation.y += P.w.y * dt; P.m.rotation.z += P.w.z * dt;
      const sea = W.sea(P.m.position.x, P.m.position.z);
      if (P.m.position.y < sea) { P.m.position.y = sea; P.v.multiplyScalar(0.3); P.v.y = 0; P.w.multiplyScalar(0.9); }
    }
    // where you are: on the deck, then thrown
    if (!this._smashed) {
      const local = new THREE.Vector3(-0.5, this.deck + 1.62, -2.6);
      this.eye = B.localToWorld(local.clone());
      this.camRoll = roll * 0.8;
      this.camPitch = pitch * 0.6;
    } else {
      const F = this.fly;
      F.v.y -= 9.8 * dt;
      F.p.addScaledVector(F.v, dt);
      const sea = W.sea(F.p.x, F.p.z);
      if (F.p.y < sea + 0.2) { if (!F.wet) { F.wet = true; G.fx.splash(F.p.x, sea, F.p.z, 3); G.audio.splash(3); } F.p.y = sea - 0.6; F.v.set(0, 0, 0); }
      this.eye = F.p;
      this.camRoll += F.spin * dt;
      this.camPitch += F.spin * 0.4 * dt;
      this.yaw += F.spin * 0.3 * dt;
    }
    if (t > T.say && !this.said) {
      this.said = true;
      this._say('You', 'What the hell was that?', 3.6);
    }
  }

  _arms(t, curl, wave, reach = false) {
    const TH = this.thing;
    TH.arms.forEach((A, i) => {
      curlArm(A, t, curl * (0.8 + (i % 3) * 0.15), wave, i * 1.3, (i % 2 ? 1 : -1) * 0.3);
      A.group.rotation.z = reach ? -0.25 : 0;
    });
    TH.feelers.forEach((F, i) => curlArm(F, t * 1.6, 0.6, 0.4, i));
  }

  /** Water pouring off it as it comes up. */
  _pour(g, k, t) {
    const G = this.game;
    if (k < 0.2 || k > 0.99 && t % 1 > 0.3) return;
    if (Math.random() < 0.6) {
      const a = Math.random() * 6.28, r = 8 + Math.random() * 6;
      const x = g.position.x + Math.cos(a) * r, z = g.position.z + Math.sin(a) * r;
      G.fx.water(x, g.position.y + 12 + Math.random() * 8, z, Math.cos(a) * 0.3, -1, Math.sin(a) * 0.3);
    }
  }

  /** The end of the boat. */
  _smash() {
    this._smashed = true;
    const G = this.game, A = INTRO_SEA, B = this.boat.group;
    G.audio.crash(); G.audio.crack(); G.audio.explosion(1.2); G.audio.roar(1.8);
    G.addShake(2);
    G.fx.eruption(A.x, 0, A.z, 34);
    G.world.sky.strikeAt(A.x - 10, A.z + 10, 1);
    for (let k = 0; k < 22; k++) {
      const m = new THREE.Mesh(debrisGeo(k + 3), MAT.solid);
      m.position.set(A.x + (Math.random() - 0.5) * 4, B.position.y + 1 + Math.random() * 2, A.z + (Math.random() - 0.5) * 10);
      G.scene.add(m);
      this.pieces.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 18, 6 + Math.random() * 14, (Math.random() - 0.5) * 18), w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8) });
    }
    // the three big pieces of the hull
    for (let k = 0; k < 3; k++) {
      const b = new MeshBuilder(rng(k));
      b.color(0x8a2e22).box(3.2, 1.3, 3.4, 0, 0, 0); b.color(0xe8e2d4).box(3.3, 0.3, 3.5, 0, 0.7, 0);
      const m = new THREE.Mesh(b.build(), MAT.solid);
      m.position.set(A.x, B.position.y, A.z + (k - 1) * 3.5);
      G.scene.add(m);
      this.pieces.push({ m, v: new THREE.Vector3((k - 1) * 3, 4 + k * 2, (k - 1) * 5), w: new THREE.Vector3((k - 1) * 1.5, 0.5, 1.2) });
    }
    // and you, off the deck and into the sea
    const away = new THREE.Vector3(-Math.cos(this.heading), 0, Math.sin(this.heading));
    this.fly = { p: (this.eye || new THREE.Vector3(A.x, 2.3, A.z)).clone(), v: away.multiplyScalar(9).add(new THREE.Vector3(0, 7, 0)), spin: 2.6, wet: false };
  }

  /** Behind the black: clear the sea, wash up on the beach. */
  _toBeach() {
    if (this.onBeach) return;
    this.onBeach = true;
    const G = this.game;
    this.black = 1;
    for (const P of this.pieces) G.scene.remove(P.m);
    this.pieces = [];
    G.scene.remove(this.boat.group);
    G.scene.remove(this.thing.group);
    this.thing.group.visible = false;
    G.world.storm = 0;
    G.tod = 0.29;           // the next morning
    G.state.s.tod = G.tod;
    this._say('', '', 0);
    const spot = this.wakeSpot();
    this.spot = spot;
    G.player.place(spot.pos.clone(), spot.yaw);
    G.player.pitch = 0;
    G._needsPlace = false;
    G.world.prebuild(spot.pos.x, spot.pos.z);
    // Old Gus has come down to the water to see what the sea brought in
    const gus = G.npcs.byId('gus');
    if (gus) G.npcs.visit(gus, spot.gus, Math.atan2(spot.pos.x - spot.gus.x, spot.pos.z - spot.gus.z));
  }

  /** A strip of sand near the village, just above the water line, with Gus standing up the beach from you. */
  wakeSpot() {
    const G = this.game, A = G.world.settlement.anchors;
    const c = (A.gusChair?.pos || A.spawn).clone();
    let best = null, bd = Infinity;
    for (let r = 6; r < 240; r += 3) for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h < 0.3 || h > 1.2) continue;
      // the sea within a few metres
      let sea = null;
      for (let j = 0; j < 16 && sea === null; j++) { const b = j / 16 * Math.PI * 2; if (heightAt(x + Math.cos(b) * 5, z + Math.sin(b) * 5) < -0.3) sea = b; }
      if (sea === null) continue;
      // open beach: nothing built on the spot, as little as possible close by
      if (G.world.settlement.blockers.some(b => Math.hypot(b.x - x, b.z - z) < b.r + 2)) continue;
      const near = [...G.world.colliders.near(x, z, 5)].filter(k => Math.hypot(k.x - x, k.z - z) < 5);
      if (near.some(k => Math.hypot(k.x - x, k.z - z) < 1.6)) continue;
      const clutter = near.length + G.world.settlement.blockers.filter(b => Math.hypot(b.x - x, b.z - z) < b.r + 8).length * 2;
      const score = r * 0.15 + clutter * 6;
      if (score < bd) { bd = score; best = { x, z, sea }; }
    }
    if (!best) best = { x: A.spawn.x, z: A.spawn.z, sea: 0 };
    const pos = new THREE.Vector3(best.x, heightAt(best.x, best.z), best.z);
    // Gus stands inland of you, between you and the village
    const inland = best.sea + Math.PI;
    const gus = new THREE.Vector3(best.x + Math.cos(inland) * 1.9, 0, best.z + Math.sin(inland) * 1.9);
    gus.y = G.world.ground(gus.x, gus.z);
    const yaw = Math.atan2(-(gus.x - pos.x), -(gus.z - pos.z));
    return { pos, gus, yaw };
  }

  /** Waking up: blurred, dark, swimming, then clear. */
  _wake(dt, t) {
    const G = this.game, k = clamp((t - T.wake) / 7.5, 0, 1);
    this.black = clamp(1 - (t - T.wake) / 3.2, 0, 1) * 0.9;
    const cv = G.renderer.domElement;
    const blur = (1 - smoothstep(0, 1, k)) * 14, bright = 0.35 + k * 0.65;
    const wob = (1 - k) * 0.012;
    cv.style.filter = k < 1 ? `blur(${blur.toFixed(1)}px) brightness(${bright.toFixed(2)}) saturate(${(0.4 + k * 0.6).toFixed(2)})` : '';
    cv.style.transform = k < 1 ? `scale(${(1 + wob * 3).toFixed(4)}) skewX(${(Math.sin(t * 1.3) * wob * 40).toFixed(2)}deg)` : '';
    // on your back looking at the sky, then up on one elbow, then on your feet
    const S = this.spot, P = G.player;
    const up = smoothstep(T.up - 2.5, T.up + 1.5, t);
    const y0 = S.pos.y + 0.3, y1 = S.pos.y + 1.62;
    const sit = smoothstep(T.wake + 3.5, T.up - 1, t);
    this.eye = new THREE.Vector3(S.pos.x, lerp(y0, lerp(y0 + 0.55, y1, up), sit), S.pos.z);
    this.camPitch = lerp(1.25, 0, smoothstep(T.wake + 2, T.up, t));
    this.camRoll = lerp(0.35, 0, sit);
    this.yaw = dampAngle(this.yaw, S.yaw, 3 * sit, dt);
    if (t > T.wake + 2.5 && !this._groaned) { this._groaned = true; G.audio.ouch(); }
    if (t > T.wake + 4 && !this._gusSpoke) { this._gusSpoke = true; this._say('Old Gus', 'Easy. Easy now - do not try to get up yet.', 3.4); }
    P.yaw = this.yaw;
  }

  applyCamera(cam) {
    if (!this.active || !this.eye) return;
    cam.position.copy(this.eye);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(clamp(this.pitch + (this.camPitch || 0), -1.5, 1.5), this.yaw, this.camRoll || 0);
  }

  _say(who, text, sec) {
    const s = this.ov.querySelector('.say');
    clearTimeout(this._sayT);
    if (!text) { s.classList.remove('on'); return; }
    s.querySelector('b').textContent = who;
    s.querySelector('span').textContent = text;
    s.classList.add('on');
    this._sayT = setTimeout(() => s.classList.remove('on'), sec * 1000);
  }

  _finish() {
    const G = this.game;
    this.active = false;
    const cv = G.renderer.domElement;
    cv.style.filter = ''; cv.style.transform = '';
    this.ov.classList.remove('on');
    this._say('', '', 0);
    G.ui.showHUD(true);
    G.ui.hotbar();
    const P = G.player;
    P.place(new THREE.Vector3(this.spot.pos.x, this.spot.pos.y + 0.1, this.spot.pos.z), this.yaw);
    P.pitch = 0;
    if (!G.state.remote) { G.state.s.flags.intro = G.state.s.day; G._saveDirty = true; }
    G.vm.visible = true;
    // and Gus has something to say
    const gus = G.npcs.byId('gus');
    if (gus) G.gusIntro(gus);
  }
}
