/* Player.js - the local first-person controller.

   Camera conventions (pinned): rotation order YXZ, yaw = rotation.y,
   forward = (-sin yaw, 0, -cos yaw), right = (cos yaw, 0, -sin yaw), mouse
   right DECREASES yaw, pitch positive = looking UP, clamped to +-1.45.

   Modes
     walk    on land, a pier, or a boat deck (boat != null)
     swim    in the water; E near a hull or pier climbs out
     drive   at the helm: W/S throttle, A/D steer, look around freely
     mount   on the bow harpoon gun
     down    knocked over - flat on your back for two seconds

   ON A BOAT the position lives in the boat's local frame, and the boat's
   turning is added to your yaw, so standing on a turning boat turns you
   with it instead of making the world spin round you. */

import * as THREE from '../../lib/three.module.js?v=1790193571';
import { clamp, damp, lerp, wrapAngle } from '../core/Util.js?v=1790193571';
import { Bus } from '../core/Bus.js?v=1790193571';

const EYE = 1.62, RADIUS = 0.3, HEIGHT = 1.75;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class Player {
  constructor(game, id = 'local') {
    this.game = game;
    this.id = id;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.local = new THREE.Vector3();
    this.boat = null;
    this.yaw = 0; this.pitch = 0;
    this.mode = 'walk';
    this.onGround = true;
    this.hp = 100;
    this.breath = 20;
    this.held = null;
    this.tool = 'rod';
    this.downT = 0; this.stunT = 0;
    this.bob = 0; this.bobAmt = 0; this.roll = 0;
    this.eye = new THREE.Vector3();
    this.lastBoatHeading = 0;
    this.speed = 0;
    this.anim = 'idle';
    this.coyote = 0;
    this.sprint = false;
    this.name = 'You';
    this.stamina = 10;          // seconds of swimming before you are spent
    this.exhausted = false; this.exhaustT = 0;
    this.wade = 0;
  }

  get maxStamina() { return this.game.state.has('diving') ? 16 : 10; }

  get maxBreath() { return this.game.state.has('diving') ? 90 : 20; }

  forward(out = _v) { return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
  flatForward(out = _v) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  place(p, yaw = this.yaw) {
    this.detach();
    this.pos.copy(p); this.vel.set(0, 0, 0); this.yaw = yaw; this.mode = 'walk';
  }

  attach(boat, local) {
    this.boat = boat;
    this.local.copy(local);
    this.lastBoatHeading = boat.heading;
    this.mode = this.mode === 'swim' ? 'walk' : this.mode;
  }
  detach() {
    if (!this.boat) return;
    const b = this.boat;
    b.toWorld(this.local, this.pos);
    this.vel.x += b.vel.x; this.vel.z += b.vel.y;
    if (b.driver === this.id) b.driver = null;
    this.boat = null;
    if (this.mode === 'drive' || this.mode === 'mount') this.mode = 'walk';
  }

  /** Knocked over. `dir` is a world push; strong pushes near the rail go overboard. */
  knock(dir, force = 4, why = '') {
    if (this.mode === 'down' && this.downT < 1.2) return;
    if (this.mode === 'drive' || this.mode === 'mount') { if (this.boat) this.boat.driver = null; this.mode = 'walk'; }
    this.game.dropHeld(this, true);
    this.mode = 'down';
    this.downT = 0;
    this.downDir = this.yaw;
    if (this.boat) {
      const b = this.boat;
      const L = this.local;
      const inv = new THREE.Matrix3().setFromMatrix4(b.inv);
      const ld = _w.copy(dir).applyMatrix3(inv);
      const hw = b.halfWidth(L.z);
      const nearRail = Math.abs(L.x) > hw - 0.9 && Math.sign(ld.x) === Math.sign(L.x);
      if (nearRail && force > 3.5 && Math.abs(ld.x) > 0.3) {
        // over the side you go
        this.detach();
        this.vel.copy(dir).multiplyScalar(force * 0.8); this.vel.y = 3.5;
        this.pos.y += 0.5;
        Bus.emit('player:overboard', { p: this, why });
        return;
      }
      this.bump = ld.multiplyScalar(force * 0.35);
    } else {
      this.vel.addScaledVector(dir, force * 0.6); this.vel.y = Math.max(this.vel.y, 2.5);
    }
    Bus.emit('player:knocked', { p: this, why });
  }

  hurt(n, why = '') {
    if (!(n > 0)) return;
    this.hp = Math.max(0, this.hp - n);
    Bus.emit('player:hurt', { p: this, n, why });
    if (this.hp <= 0) this.game.passOut(this, why);
  }

  update(dt, input, blocked) {
    const G = this.game, world = G.world;
    const look = blocked ? { x: 0, y: 0 } : input.look();
    // boat turning carries your view with it
    if (this.boat) {
      const dh = wrapAngle(this.boat.heading - this.lastBoatHeading);
      this.yaw += dh;
      this.lastBoatHeading = this.boat.heading;
    }
    if (this.mode !== 'down') {
      this.yaw -= look.x;
      this.pitch = clamp(this.pitch - look.y, -1.45, 1.45);
    }
    this.stunT = Math.max(0, this.stunT - dt);

    let mx = 0, mz = 0, jump = false, sprint = false, dive = false;
    if (!blocked && this.mode !== 'down' && this.stunT <= 0 && this.mode !== 'drive' && this.mode !== 'mount') {
      mx = input.axis('KeyA', 'KeyD');
      mz = input.axis('KeyS', 'KeyW');
      jump = input.pressed('Space');
      sprint = input.held('ShiftLeft') || input.held('ShiftRight');
      dive = input.held('KeyQ');
    }
    this.sprint = sprint;
    const heavy = this.held && G.loot.get(this.held)?.kg > 40;
    let spd = this.mode === 'swim' ? (G.state.has('diving') ? 3.1 : 2.1) * (this.exhausted ? 0.22 : 1) : (sprint ? 6.2 : 3.7) * (1 - this.wade * 0.45);
    if (heavy) spd = Math.min(spd, 1.8);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }

    if (this.mode === 'down') {
      this.downT += dt;
      if (this.downT > 2.2) { this.mode = this.inWaterNow() ? 'swim' : 'walk'; }
      wx = 0; wz = 0;
    }

    if (this.mode === 'drive' && this.boat) {
      const b = this.boat;
      let th = b.throttle;
      if (!blocked) {
        const a = input.axis('KeyS', 'KeyW');
        th = a !== 0 ? clamp(th + a * dt * 0.9, -0.5, 1) : th;
        if (input.held('KeyX')) th = damp(th, 0, 6, dt);
        const st = input.axis('KeyD', 'KeyA');
        G.driveInput(b, th, st);
      }
      this.local.set(b.hull.helm[0], b.deck, b.hull.helm[2]);
      this.speed = 0;
    } else if (this.mode === 'mount' && this.boat) {
      const b = this.boat;
      const m = b.hull.mount;
      this.local.set(m[0], b.deck, m[2] - 0.9);
    } else if (this.boat) {
      this.wade = 0;
      this._walkBoat(dt, wx * spd, wz * spd, jump);
    } else if (this.mode === 'swim') {
      this._swim(dt, wx * spd, wz * spd, jump || (input.held('Space') && !blocked), dive);
    } else {
      this._walkWorld(dt, wx * spd, wz * spd, jump);
    }
    if (this.boat) this.boat.toWorld(this.local, this.pos);

    // swimming stamina: roughly ten seconds, then you are spent. Within about
    // fifteen metres of the beach you are safe: an exhausted swimmer there is
    // carried in by the surf and never passes out or drowns.
    const safe = this.mode === 'swim' && this._nearShore(dt);
    if (this.mode === 'swim') {
      this.stamina = Math.max(0, this.stamina - dt * (sprint ? 1.5 : 1) * (this.exhausted ? 0 : 1));
      if (this.stamina <= 0 && !this.exhausted) { this.exhausted = true; this.exhaustT = 0; Bus.emit('player:exhausted', { p: this, safe }); }
      if (this.exhausted) {
        if (safe) {
          // the surf takes you in, gently
          this.exhaustT = Math.max(0, this.exhaustT - dt);
          const s = this._shore;
          const dx = s.x - this.pos.x, dz = s.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
          this.vel.x += dx / d * 1.1 * dt; this.vel.z += dz / d * 1.1 * dt;
        } else this.exhaustT += dt;
        if (this.exhaustT > 12) { this.exhausted = false; this.stamina = this.maxStamina; G.passOut(this, 'exhausted'); }
      }
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * (this.boat ? 4 : 3));
      if (this.exhausted && this.stamina > 3) this.exhausted = false;
      this.exhaustT = 0;
    }
    // breath
    const head = this.pos.y + EYE - 0.05;
    const sea = world.waterAt(this.pos.x, this.pos.z);
    this.underwater = head < sea - 0.05;
    if (this.underwater) {
      this.breath -= dt;
      if (this.breath <= 0) {
        this.breath = 0;
        // near the beach your body just bobs back up for air
        if (safe || (this.mode === 'swim' && this._shoreNear)) this.vel.y = Math.max(this.vel.y, 3);
        else this.hurt(dt * 20, 'drown');
      }
    } else this.breath = Math.min(this.maxBreath, this.breath + dt * 8);

    // animation state for the avatar other people see
    this.cheerT = Math.max(0, (this.cheerT || 0) - dt);
    this.anim = this.cheerT > 0 && this.mode === 'walk' ? 'cheer' : this.mode === 'down' ? 'fall' : this.mode === 'swim' ? 'swim' : this.mode === 'drive' ? 'drive' : this.speed > 4.5 ? 'run' : this.speed > 0.4 ? 'walk' : 'idle';
    this._camera(dt);
  }

  /** Is there beach within ~15 m? Sampled a few times a second; remembers the nearest land. */
  _nearShore(dt) {
    this._shoreT = (this._shoreT || 0) - dt;
    if (this._shoreT > 0) return this._shoreNear;
    this._shoreT = 0.3;
    const G = this.game.world;
    let best = null;
    for (const r of [3, 6, 9, 12, 15]) {
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        const x = this.pos.x + Math.cos(a) * r, z = this.pos.z + Math.sin(a) * r;
        if (G.height(x, z) > 0.35) { best = { x, z }; break; }
      }
      if (best) break;
    }
    this._shoreNear = !!best;
    if (best) this._shore = best;
    return this._shoreNear;
  }
  get safeSwim() { return this.mode === 'swim' && !!this._shoreNear; }

  inWaterNow() {
    const s = this.game.world.waterAt(this.pos.x, this.pos.z);
    return !this.boat && this.pos.y < s - 1.0;
  }

  _walkBoat(dt, wx, wz, jump) {
    const b = this.boat, L = this.local;
    // world wish -> boat local (rotation only)
    const c = Math.cos(b.heading), s = Math.sin(b.heading);
    const lx = wx * c - wz * s, lz = wx * s + wz * c;
    this.vel.x = damp(this.vel.x, lx, 12, dt);
    this.vel.z = damp(this.vel.z, lz, 12, dt);
    if (this.bump) { this.vel.x += this.bump.x; this.vel.z += this.bump.z; this.bump = null; }
    this.vel.y -= 16 * dt;
    if (jump && this.onGround) { this.vel.y = 5.2; this.onGround = false; }
    const nx = L.x + this.vel.x * dt, nz = L.z + this.vel.z * dt;
    let ny = L.y + this.vel.y * dt;
    const deck = b.deck;
    if (ny <= deck) { ny = deck; this.vel.y = 0; this.onGround = true; }
    // rails keep you in unless you are high enough to go over
    const hw = b.halfWidth(nz) - RADIUS;
    const rail = b.railY(nz);
    let ox = nx, oz = nz;
    const overRail = ny > rail - 0.15;
    if (Math.abs(ox) > hw && !overRail) ox = Math.sign(ox) * hw;
    const hl = b.hull.hl - 0.35;
    if (oz < -hl && !overRail) oz = -hl;
    if (oz > hl - 0.3 && !overRail) oz = hl - 0.3;
    for (const o of b.obstacles) {
      const dx = ox - o.x, dz = oz - o.z;
      if (Math.abs(dx) < o.hw + RADIUS && Math.abs(dz) < o.hd + RADIUS) {
        const px = o.hw + RADIUS - Math.abs(dx), pz = o.hd + RADIUS - Math.abs(dz);
        if (px < pz) ox = o.x + Math.sign(dx || 1) * (o.hw + RADIUS); else oz = o.z + Math.sign(dz || 1) * (o.hd + RADIUS);
      }
    }
    // stepping off onto a pier or the shore at the same height
    if (!b.over(ox, oz, 0.1)) {
      const w = b.toWorld(_w.set(ox, ny, oz));
      const G = this.game.world;
      let g = G.ground(w.x, w.z);
      const fl = G.colliders.floorAt(w.x, w.z, w.y, 0.9);
      if (fl > g) g = fl;
      if (g > w.y - 0.9 || overRail || !b.over(ox, oz, -1.2)) {
        L.set(ox, ny, oz);
        this.detach();
        this.pos.copy(w);
        this.mode = this.inWaterNow() ? 'swim' : 'walk';
        return;
      }
      ox = clamp(ox, -hw, hw);
    }
    L.set(ox, ny, oz);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
  }

  _walkWorld(dt, wx, wz, jump) {
    const G = this.game.world, P = this.pos, V = this.vel;
    const acc = this.onGround ? 12 : 2.5;
    V.x = damp(V.x, wx, acc, dt);
    V.z = damp(V.z, wz, acc, dt);
    V.y -= 16 * dt;
    if (jump && (this.onGround || this.coyote > 0)) { V.y = 5.4; this.onGround = false; this.coyote = 0; this.game.audio?.jump(); }
    P.x += V.x * dt; P.z += V.z * dt;
    const r = G.colliders.resolve(P.x, P.z, RADIUS, P.y + 0.3, HEIGHT - 0.3, V);
    P.x = r.x; P.z = r.z;
    // edge of the world
    const E = 1285;
    P.x = clamp(P.x, -E, E); P.z = clamp(P.z, -E, E);
    P.y += V.y * dt;
    let g = G.ground(P.x, P.z);
    const fl = G.colliders.floorAt(P.x, P.z, P.y, 0.6);
    if (fl > g) g = fl;
    if (P.y <= g + 0.001) {
      // steep ground slows you
      if (this.onGround === false && V.y < -12) this.hurt((-V.y - 12) * 4, 'fall');
      P.y = g; V.y = Math.max(0, V.y); this.onGround = true; this.coyote = 0.12;
    } else if (P.y - g < 0.35 && V.y <= 0 && this.onGround) {
      P.y = g;            // stick to the ground walking downhill
    } else {
      this.onGround = false; this.coyote -= dt;
    }
    this.speed = Math.hypot(V.x, V.z);
    // boarding: walk onto a deck
    for (const b of this.game.boats) {
      if (b.sinking) continue;
      const L = b.toLocal(P, _w);
      if (b.over(L.x, L.z, 0.2) && L.y > b.deck - 0.9 && L.y < b.deck + 1.2) {
        L.y = Math.max(L.y, b.deck);
        this.attach(b, L);
        this.vel.set(0, 0, 0);
        Bus.emit('player:boarded', { p: this, boat: b });
        return;
      }
    }
    // wading, then swimming once the water reaches about your head
    const sea = G.waterAt(P.x, P.z);
    const depth = sea > -Infinity ? sea - P.y : 0;
    this.wade = Math.max(0, Math.min(1, depth / 1.4));
    if (depth > 0.2 && this.speed > 1 && Math.random() < 0.15) this.game.fx.ripple(P.x, sea, P.z, 0.9, 0.8);
    if (depth > 1.45 && this.onGround) {
      this.mode = 'swim'; this.vel.y = 0;
      this.game.audio?.splash(0.5);
      Bus.emit('player:swim', { p: this });
    } else if (depth > 1.45 && V.y < -3) {
      this.mode = 'swim'; this.game.fx.splash(P.x, sea, P.z, 1.2); this.game.audio?.splash(1);
      Bus.emit('player:swim', { p: this });
    }
  }

  _swim(dt, wx, wz, up, down) {
    const G = this.game.world, P = this.pos, V = this.vel;
    const sea = G.waterAt(P.x, P.z);
    V.x = damp(V.x, wx, 3, dt); V.z = damp(V.z, wz, 3, dt);
    const tired = this.exhausted;
    const surf = sea - 1.35 - (tired ? 0.22 + Math.sin(this.game.world.time * 2.2) * 0.1 : 0);
    if (down && !tired) V.y = damp(V.y, -2.2, 3, dt);
    else if (up && !tired) V.y = damp(V.y, 2.4, 3, dt);
    else V.y = damp(V.y, (surf - P.y) * 3, 4, dt);
    // if you are under the surface and not diving you float up
    P.x += V.x * dt; P.y += V.y * dt; P.z += V.z * dt;
    if (P.y > surf + 0.1 && !up) P.y = damp(P.y, surf, 5, dt);
    if (P.y > surf + 0.6) P.y = surf + 0.6;
    const r = G.colliders.resolve(P.x, P.z, RADIUS, P.y, HEIGHT, V);
    P.x = r.x; P.z = r.z;
    const g = G.ground(P.x, P.z);
    if (P.y < g) P.y = g;
    // shallow enough to stand: you find your feet and walk out
    if (g > sea - 1.35 || sea === -Infinity) { this.mode = 'walk'; this.onGround = false; V.y = 0; P.y = Math.max(P.y, g); }
    this.speed = Math.hypot(V.x, V.z);
    if (Math.random() < dt * 3 && this.speed > 0.5) this.game.fx.ripple(P.x, sea, P.z, 1.2, 1);
  }

  /** Climb out of the water onto a boat or pier (E). Returns true if it worked. */
  tryClimb() {
    if (this.mode !== 'swim') return false;
    const G = this.game;
    for (const b of G.boats) {
      if (b.sinking) continue;
      const L = b.toLocal(this.pos, _w);
      const hw = b.halfWidth(clamp(L.z, -b.hull.hl, b.hull.hl));
      if (Math.abs(L.z) < b.hull.hl + 0.8 && Math.abs(L.x) < hw + 1.6) {
        L.x = clamp(L.x, -hw + 0.5, hw - 0.5); L.z = clamp(L.z, -b.hull.hl + 0.6, b.hull.hl - 0.9); L.y = b.deck;
        this.mode = 'walk';
        this.attach(b, L);
        this.vel.set(0, 0, 0);
        G.fx.splash(this.pos.x, this.pos.y + 1.2, this.pos.z, 0.6);
        Bus.emit('player:boarded', { p: this, boat: b, climb: true });
        return true;
      }
    }
    // piers and shore within reach
    for (let a = 0; a < 16; a++) {
      const ang = a / 16 * Math.PI * 2;
      const x = this.pos.x + Math.cos(ang) * 1.6, z = this.pos.z + Math.sin(ang) * 1.6;
      const fl = G.world.colliders.floorAt(x, z, this.pos.y + 1.6, 1.6);
      const g = G.world.ground(x, z);
      const top = Math.max(fl, g);
      if (top > G.world.waterAt(x, z) - 0.2 && top < this.pos.y + 3.2) {
        this.pos.set(x, top, z); this.vel.set(0, 0, 0); this.mode = 'walk';
        return true;
      }
    }
    return false;
  }

  _camera(dt) {
    const moving = this.speed > 0.5 && this.onGround && this.mode === 'walk';
    this.bobAmt = damp(this.bobAmt, moving ? (this.sprint ? 1.5 : 1) : 0, 8, dt);
    this.bob += dt * (this.sprint ? 12 : 8.5) * (moving ? 1 : 0.3);
    let rollT = 0, pitchOff = 0;
    const eyeH = this.mode === 'down' ? lerp(EYE, 0.35, Math.min(1, this.downT / 0.35) * (this.downT > 1.8 ? 1 - (this.downT - 1.8) / 0.4 : 1)) : this.mode === 'swim' ? EYE : EYE;
    if (this.boat) rollT = this.boat.roll * 0.55 * Math.cos(this.yaw - this.boat.heading - Math.PI) + this.boat.pitch * 0.55 * Math.sin(this.yaw - this.boat.heading);
    if (this.mode === 'down') {
      const f = this.downT < 0.35 ? this.downT / 0.35 : this.downT > 1.8 ? Math.max(0, 1 - (this.downT - 1.8) / 0.4) : 1;
      pitchOff = f * 0.9; rollT += f * 0.25;
    }
    this.roll = damp(this.roll, rollT, 6, dt);
    this.pitchOff = pitchOff;
    this.eye.set(this.pos.x, this.pos.y + eyeH + Math.sin(this.bob * 2) * 0.035 * this.bobAmt, this.pos.z);
    if (this.mode === 'swim') this.eye.y += Math.sin(this.game.world.time * 1.7) * 0.05;
  }

  applyCamera(cam) {
    cam.position.copy(this.eye);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(clamp(this.pitch + (this.pitchOff || 0), -1.5, 1.5), this.yaw, this.roll + Math.sin(this.bob) * 0.006 * this.bobAmt);
  }

  /** Where a held item sits (world). */
  holdPoint(it) {
    const f = this.flatForward(new THREE.Vector3());
    const heavy = it.kg > 40;
    const p = heavy
      ? this.pos.clone().addScaledVector(f, 1.1 + it.r * 0.4).setY(this.pos.y + 0.2)
      : this.eye.clone().addScaledVector(this.forward(new THREE.Vector3()), 0.75).add(new THREE.Vector3(0, -0.35, 0)).addScaledVector(new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), 0.12);
    return { pos: p, yaw: this.yaw + Math.PI / 2, roll: heavy ? Math.PI / 2 : 0.3 };
  }

  snapshot() {
    return {
      x: +this.pos.x.toFixed(2), y: +this.pos.y.toFixed(2), z: +this.pos.z.toFixed(2), yaw: +this.yaw.toFixed(3), pitch: +this.pitch.toFixed(3),
      b: this.boat ? this.boat.id : 0, lx: +this.local.x.toFixed(2), ly: +this.local.y.toFixed(2), lz: +this.local.z.toFixed(2),
      m: this.mode, a: this.anim, t: this.tool, hp: Math.round(this.hp),
    };
  }
}
