/* PirateIsle.js - what goes on on Blackflag Isle.

   CAPTURED. When the pirates take you (tied up, or beaten down while they are
   aboard) the screen goes black, you hear the voyage, and you wake up in a
   wooden cage on the beach below their camp. Your gear is gone - your hotbar
   is empty - and your boat is tied up at their dock.

   To get out: force the bars of the cage (hold E) when the guard on the beach
   is not looking; get up to the camp's storehouse without being seen and take
   your things back out of the stash chest; get down to the dock and sail away.
   Get caught by a guard and you are back in the cage.

   Visiting on purpose is a different thing. Rattigan the Fence down by the dock
   does business with anybody. The camp is theirs: walk into it and the guards
   come for you. So is the vault behind the lake, and the hoard in it - which you
   can have, once, if you can get to it.

   The guards are host-run; their positions go to the guests in the snapshot. */

import * as THREE from '../../lib/three.module.js';
import { Character } from '../art/Character.js';
import { CREW_LOOKS } from '../data/ShipData.js';
import { toolMesh } from './ViewModel.js';
import { PIRATE_ISLE } from '../world/MapData.js';
import { clamp, wrapAngle } from '../core/Util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const pick = a => a[Math.floor(Math.random() * a.length)];

export class PirateIsle {
  constructor(game) {
    this.game = game;
    const P = game.world.settlement.isle.pirate;
    this.P = P;
    this.guards = [];
    this.sitters = [];
    this.captives = {};          // host: pid -> true while they are an escaping prisoner
    this.cell = -1;              // this player's cage, while in one
    this.doorOpen = [false, false, false];
    if (!P) return;
    // the guards: one on the beach by the cages, one round the camp, one on the vault path
    P.beats.forEach((beat, i) => {
      const look = { ...CREW_LOOKS.pirate[i % CREW_LOOKS.pirate.length], skin: [0xe0ac86, 0x9a6444, 0xc68a62][i] };
      const c = new Character(look, 700 + i);
      c.setName('Guard', '#ffb08a');
      const w = toolMesh(i === 0 ? 'pistol' : 'cutlass'); w.rotation.x = Math.PI / 2; c.hold(w);
      game.scene.add(c.root);
      this.guards.push({ c, beat, k: 0, pos: beat[0].clone(), yaw: 0, st: 'patrol', target: null, t: 0, cd: 0, alert: 0 });
    });
    for (const s of P.sitters) {
      const c = new Character({ ...pick(CREW_LOOKS.pirate), skin: pick([0xe0ac86, 0xc68a62, 0x70462e]) }, Math.round(s.pos.x * 7));
      c.root.position.copy(s.pos); c.root.rotation.y = s.face;
      game.scene.add(c.root);
      this.sitters.push({ c, ...s });
    }
    this.bellT = 20;
  }
  get ok() { return !!this.P; }
  /** Is a point on the island (roughly)? */
  on(p) { return Math.hypot(p.x - PIRATE_ISLE.x, p.z - PIRATE_ISLE.z) < 260; }
  /** Is a point somewhere the guards will not have you: the camp, the vault. */
  forbidden(p) {
    const P = this.P;
    return p.distanceTo(P.camp) < P.campR || p.distanceTo(P.hoard) < 22;
  }

  /* ---------------- the cage (local) ---------------- */
  /** Put the local player in a cage and shut the door. */
  imprison(P) {
    const G = this.game, I = this.P;
    const i = Math.max(0, G.allPlayers().indexOf(P)) % I.cages.length;
    this.cell = i;
    this._door(i, false);
    P.detach?.(); P.mode = 'walk';
    P.place(I.cages[i].inside.clone(), I.cages[i].rot);
    P.vel?.set?.(0, 0, 0);
  }
  _door(i, open) {
    const G = this.game, C = this.P.cages[i];
    if (this.doorOpen[i] === open) return;
    this.doorOpen[i] = open;
    C.door.rotation.y = C.rot + (open ? -1.6 : 0);
    const cols = G.world.colliders;
    if (open) { cols.remove(C.dcol); }
    else { const d = C.doorBox; C.dcol = cols.box(d.x, d.z, 1.25, 0.12, d.rot, d.y - 0.5, d.y + 2.4, 'cage'); }
  }
  /** Which cage (if any) the player is standing in. */
  cageAt(p) { const I = this.P; if (!I) return -1; return I.cages.findIndex(C => Math.hypot(p.x - C.x, p.z - C.z) < 1.25 && Math.abs(p.y - C.y) < 1.5); }
  /** Is any guard looking at point p from close enough to see? */
  watched(p, r = 10) {
    for (const g of this.guards) {
      const d = g.pos.distanceTo(p);
      if (d > r) continue;
      const f = V(Math.sin(g.yaw), 0, Math.cos(g.yaw)), to = p.clone().sub(g.pos).setY(0).normalize();
      if (d < 3 || f.dot(to) > 0.35) return g;
    }
    return null;
  }

  /* ---------------- every frame ---------------- */
  update(dt, host) {
    if (!this.P) return;
    const G = this.game;
    const near = G.allPlayers().some(p => this.on(p.pos)) || G.player.pos.distanceTo(this.P.camp) < 500;
    for (const g of this.guards) g.c.root.visible = near;
    for (const s of this.sitters) { s.c.root.visible = near; if (near) s.c.update(dt, 'sit', 0); }
    if (!near) return;
    if (host) for (const g of this.guards) this._guard(g, dt);
    for (const g of this.guards) {
      g.c.root.position.copy(g.pos); g.c.root.rotation.y = g.yaw;
      g.c.update(dt, g.st === 'chase' ? 'run' : g.st === 'patrol' ? 'walk' : 'idle', g.st === 'chase' ? 3.8 : 1.3);
      if (g.st === 'chase') { g.c.arms[1].rotation.x = -1.3; }
    }
    // the skull's eyes burn at night; the bell rings in a storm
    if (this.P.skullEyes) this.P.skullEyes.visible = G._night() > 0.3;
    this.bellT -= dt;
    if (this.bellT <= 0) { this.bellT = 8 + Math.random() * 14; if ((G.world.storm > 0.3 || Math.random() < 0.15) && G.player.pos.distanceTo(this.P.bell) < 220) G.audio.bell?.(this.P.bell); }
    // the flag on the camp pole
    if (this.P.campFlag) this.P.campFlag.rotation.y = Math.sin(G.world.time * 1.3) * 0.25;
  }
  _guard(g, dt) {
    const G = this.game;
    g.t += dt; g.cd -= dt;
    // who is he after? an escaping prisoner anywhere, anyone in the camp or the vault
    let tgt = null, bd = 16;
    for (const Q of G.allPlayers()) {
      if (Q.mode === 'swim' || Q.boat) continue;
      const bad = this.captives[Q.id] || this.forbidden(Q.pos);
      if (!bad) continue;
      if (this.cageAt(Q.pos) >= 0 && !this.doorOpen[this.cageAt(Q.pos)]) continue;     // still locked up
      const d = Q.pos.distanceTo(g.pos);
      if (d > bd) continue;
      const f = V(Math.sin(g.yaw), 0, Math.cos(g.yaw)), to = Q.pos.clone().sub(g.pos).setY(0).normalize();
      if (g.st === 'chase' && g.target === Q.id || d < 4 || f.dot(to) > 0.3) { bd = d; tgt = Q; }
    }
    if (tgt) {
      if (g.st !== 'chase') { g.st = 'chase'; G.tell(tgt.id, pick(['"OI! Back in your box!"', '"Intruder in the camp!"', '"Get them!"']), 'bad'); G.audio.horn?.(); }
      g.target = tgt.id;
      const to = tgt.pos.clone().sub(g.pos); to.y = 0;
      const d = to.length();
      g.yaw = Math.atan2(to.x, to.z);
      if (d > 1.1) { g.pos.addScaledVector(to.normalize(), Math.min(d, 3.9 * dt)); g.pos.y = G.world.ground(g.pos.x, g.pos.z); }
      if (d < 1.4 && g.cd <= 0) {
        g.cd = 2;
        // caught: a prisoner goes back in the cage; anyone else gets knocked down and thrown in with them
        G.knockPlayer(tgt, to.lengthSq() ? to.clone().normalize() : V(0, 0, 1), 3, 'guard');
        G.hurtPlayer(tgt, 8, 'guard');
        setTimeout(() => G._everyone({ t: 'captured', to: tgt.id, why: 'guards' }), 900);
        g.st = 'patrol'; g.target = null;
      }
      return;
    }
    if (g.st === 'chase') { g.st = 'patrol'; g.target = null; }
    // the beat
    const wp = g.beat[g.k];
    const to = wp.clone().sub(g.pos); to.y = 0;
    const d = to.length();
    if (d < 0.6) { g.k = (g.k + 1) % g.beat.length; g.st = 'look'; g.lookT = 2 + Math.random() * 3; }
    if (g.st === 'look') { g.lookT -= dt; g.yaw += Math.sin(g.t * 0.8) * dt * 0.8; if (g.lookT <= 0) g.st = 'patrol'; return; }
    g.st = 'patrol';
    g.yaw += wrapAngle(Math.atan2(to.x, to.z) - g.yaw) * Math.min(1, dt * 4);
    g.pos.addScaledVector(to.normalize(), Math.min(d, 1.3 * dt));
    g.pos.y = G.world.ground(g.pos.x, g.pos.z);
  }

  /* ---------------- sync ---------------- */
  snapshot() { return this.guards.map(g => [+g.pos.x.toFixed(2), +g.pos.y.toFixed(2), +g.pos.z.toFixed(2), +g.yaw.toFixed(2), g.st === 'chase' ? 1 : 0]); }
  applySnapshot(a) {
    if (!a) return;
    a.forEach((s, i) => { const g = this.guards[i]; if (!g) return; g.pos.lerp(V(s[0], s[1], s[2]), 0.5); g.yaw = s[3]; g.st = s[4] ? 'chase' : 'patrol'; });
  }
}
