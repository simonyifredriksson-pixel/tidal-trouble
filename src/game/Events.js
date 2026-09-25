/* Events.js - the random things that happen while you are fishing.
   Host-run; peers see them through the world snapshot.

     storm      the sky goes grey, the swell doubles, lightning. Get home.
     migration  thousands of fish at once. Bites come four times as fast.
     giant      something huge surfaces near you. Run - or try to catch it.
     thief      Slippery Pete takes your unattended boat for a joyride.
     whirlpool  the sea starts spinning. Rare fish at the edge, doom inside.
     meteor     something falls from the sky; where it lands, the water
                glows and legendary fish gather for a few minutes.

   Chaos without complication: one director, one list, and each event is a
   start, an update and an end. */

import * as THREE from '../../lib/three.module.js?v=1790358905';
import { Character } from '../art/Character.js?v=1790358905';
import { THIEF, RADIO } from '../data/NPCData.js?v=1790358905';
import { MeshBuilder } from '../art/Geo.js?v=1790358905';
import { MAT } from '../art/Materials.js?v=1790358905';
import { clamp, damp, smoothstep, uid, wrapAngle } from '../core/Util.js?v=1790358905';
import { Bus } from '../core/Bus.js?v=1790358905';

const _v = new THREE.Vector3();

export class Events {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.timer = 200;
    this.storm = 0;
    this.pete = null;
    this.meteorMesh = null;
    this.jumpers = [];
  }

  near(kind, pos, r) {
    for (const e of this.list) if (e.k === kind && Math.hypot(e.x - pos.x, e.z - pos.z) < (e.r || 0) + r) return e;
    return null;
  }
  active(kind) { return this.list.find(e => e.k === kind) || null; }

  radio(kind) {
    const lines = RADIO[kind];
    if (lines) this.game.ui.radio(lines[Math.floor(Math.random() * lines.length)]);
  }

  /* ---------------- host ---------------- */
  update(dt, host) {
    const G = this.game;
    if (host) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = (140 + Math.random() * 160) / (1 + (G.zone || 0) * 0.25);
        if (G.state.s.tut >= 4 && !G.creatures.lev) this.startRandom();
      }
      for (let i = this.list.length - 1; i >= 0; i--) {
        const e = this.list[i];
        e.t += dt;
        this._step(e, dt);
        if (e.t >= e.dur) { this._end(e); this.list.splice(i, 1); }
      }
      const st = this.active('storm');
      const target = Math.max(st ? smoothstep(0, 20, st.t) * (1 - smoothstep(st.dur - 25, st.dur, st.t)) : 0, G.beasts?.stormForce || 0);
      this.storm = damp(this.storm, target, 1.5, dt);
      // a storm has a wind, and the wind pushes boats - off course, sometimes somewhere new
      if (this.storm > 0.2) {
        this.windA = (this.windA ?? Math.random() * 6.28) + dt * 0.01;
        for (const b of G.boats) if (!b.docked) { b.tow.x += Math.cos(this.windA) * this.storm * 0.9; b.tow.y += Math.sin(this.windA) * this.storm * 0.9; }
      } else this.windA = undefined;
    }
    G.world.storm = this.storm;
    const wp = this.active('whirlpool');
    G.world.whirl = wp ? { x: wp.x, z: wp.z, r: wp.r, s: wp.s || 0 } : null;
    const me = this.active('meteor');
    G.world.glow = me && me.t > me.fall ? { x: me.x, z: me.z, r: me.r, s: clamp(1 - (me.t - me.dur + 20) / 20, 0, 1) } : null;
    this._visuals(dt);
  }

  startRandom(kind = null) {
    const G = this.game;
    const focus = G.focusPlayer();
    if (!focus) return;
    const p = focus.pos;
    const reg = G.world.region(p.x, p.z);
    const wet = G.world.waterAt(p.x, p.z) > -Infinity || !!focus.boat;
    const boat = G.boats[0];
    const w = [
      { k: 'storm', w: this.active('storm') ? 0 : reg === 'open' ? 2 : 1 },
      { k: 'migration', w: wet ? 1.3 : 0.4 },
      { k: 'giant', w: wet && G.creatures.giants.size === 0 ? 1 + (G.zone || 0) * 1.1 : 0.1 },
      { k: 'thief', w: boat && !boat.stolen && !G.allPlayers().some(pl => pl.boat === boat) && boat.pos.distanceTo(p) > 35 && boat.pos.distanceTo(p) < 250 ? 1.6 : 0 },
      { k: 'whirlpool', w: wet && reg !== 'home' ? 0.8 : wet ? 0.3 : 0 },
      { k: 'meteor', w: G.isNight() ? 1.2 : 0.5 },
    ];
    let pick = kind;
    if (!pick) {
      const tot = w.reduce((a, b) => a + b.w, 0);
      let x = Math.random() * tot;
      for (const o of w) { x -= o.w; if (x <= 0) { pick = o.k; break; } }
    }
    if (pick) this.start(pick, p);
  }

  start(k, p) {
    const G = this.game;
    const e = { id: uid('e'), k, t: 0, x: p.x, z: p.z, r: 0 };
    if (k === 'storm') { e.dur = 150 + Math.random() * 90; }
    else if (k === 'migration') {
      const q = this._waterNear(p, 10, 45); if (!q) return null;
      e.x = q.x; e.z = q.z; e.r = 55; e.dur = 90;
    } else if (k === 'giant') {
      const g = G.creatures.spawnGiant(p); if (!g) return null;
      e.dur = 150; e.gid = g.id;
    } else if (k === 'thief') {
      const b = G.boats[0]; if (!b) return null;
      const q = this._waterNear(b.pos, 90, 150, 8); if (!q) return null;
      e.boat = b.id; e.tx = q.x; e.tz = q.z; e.dur = 240;
      b.stolen = true; b.docked = false; b.autopilot = { x: q.x, z: q.z };
      this._spawnPete(b);
    } else if (k === 'whirlpool') {
      const q = this._waterNear(p, 55, 120, 10) || this._waterNear(p, 100, 260, 10); if (!q) return null;
      e.x = q.x; e.z = q.z; e.r = 42; e.dur = 110; e.s = 0;
    } else if (k === 'meteor') {
      const q = this._waterNear(p, 90, 230, 4); if (!q) return null;
      e.x = q.x; e.z = q.z; e.r = 26; e.dur = 190; e.fall = 3.2;
    }
    this.list.push(e);
    this.radio(k);
    G.ui.eventBanner(k);
    G.audio.eventSting(k);
    Bus.emit('event:start', { e });
    return e;
  }

  _waterNear(p, dmin, dmax, depth = 3) {
    const G = this.game;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, d = dmin + Math.random() * (dmax - dmin);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (G.world.height(x, z) < -depth && !G.world.onIce(x, z) && !G.isLake(x, z)) return { x, z };
    }
    return null;
  }

  _step(e, dt) {
    const G = this.game;
    if (e.k === 'whirlpool') {
      e.s = smoothstep(0, 15, e.t) * (1 - smoothstep(e.dur - 15, e.dur, e.t));
      for (const b of G.boats) {
        const dx = e.x - b.pos.x, dz = e.z - b.pos.z, d = Math.hypot(dx, dz);
        if (d > e.r * 1.6) continue;
        const f = e.s * (1 - d / (e.r * 1.6));
        // pull in and swing round
        b.tow.x += (dx / d * 3.2 + dz / d * 5.2) * f;
        b.tow.y += (dz / d * 3.2 - dx / d * 5.2) * f;
        if (d < 9) { b.damage(4 * dt * e.s, 'whirlpool'); b.water += dt * 0.02 * e.s; }
      }
    }
    if (e.k === 'storm') {
      // rogue waves in heavy seas
      e.waveT = (e.waveT || 8) - dt;
      if (e.waveT <= 0 && this.storm > 0.6) {
        e.waveT = 9 + Math.random() * 10;
        for (const b of G.boats) {
          const amp = G.world.sea(b.pos.x, b.pos.z);
          if (b.stats.waves < 1.5 + this.storm) {
            b.impulse((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.8, 2);
            b.water = Math.min(1, b.water + 0.05);
            G.fx.splash(b.pos.x, amp + 0.5, b.pos.z, 3);
            for (const p of G.allPlayers()) if (p.boat === b && Math.random() < 0.35) G.knockPlayer(p, new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), 4, 'wave');
            Bus.emit('storm:wave', {});
          }
        }
      }
    }
    if (e.k === 'meteor' && e.t >= e.fall && !e.hit) {
      e.hit = true;
      G.fx.eruption(e.x, 0, e.z, 8);
      G.fx.explosion(new THREE.Vector3(e.x, 1, e.z).x, 1, e.z, 2);
      G.audio.explosion(1.5);
      G.shakeAll(0.5);
    }
    if (e.k === 'thief') this._thief(e, dt);
  }

  _end(e) {
    const G = this.game;
    if (e.k === 'thief') {
      const b = G.boatById(e.boat);
      if (b && b.stolen) { b.respawn(false); G.ui.radio('Radio: Pete left your boat back at the harbour. Cheeky.'); }
      this._removePete();
    }
    if (e.k === 'storm') G.ui.radio('Radio: The storm is passing. Everybody still afloat?');
    Bus.emit('event:end', { e });
  }

  /* ---------------- the boat thief ---------------- */
  _spawnPete(boat) {
    const G = this.game;
    this._removePete();
    const c = new Character(THIEF.look, 99);
    c.setName(THIEF.name, '#ffb0a0');
    G.scene.add(c.root);
    this.pete = { c, boat: boat.id, swim: 0, pos: new THREE.Vector3() };
  }
  _removePete() { if (this.pete) { this.game.scene.remove(this.pete.c.root); this.pete = null; } }

  _thief(e, dt) {
    const G = this.game;
    const b = G.boatById(e.boat);
    if (!b) { e.t = e.dur; return; }
    const pete = this.pete;
    const reclaimed = G.allPlayers().some(p => p.boat === b);
    if (!b.stolen) { e.t = e.dur; return; }
    if (reclaimed || (pete && pete.swim > 0)) {
      // got it back
      b.stolen = false; b.autopilot = null; b.throttle = 0; b.steer = 0;
      if (pete && !pete.swim) { pete.swim = 0.01; G.fx.splash(b.pos.x, 0, b.pos.z, 1.5); G.ui.radio('Radio: Ha! Pete is swimming for it!'); Bus.emit('thief:caught', {}); }
      e.t = Math.max(e.t, e.dur - 6);
      return;
    }
    // drive to the hideout, then putter in circles
    const A = b.autopilot;
    const dx = A.x - b.pos.x, dz = A.z - b.pos.z, d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const err = wrapAngle(want - b.heading);
    const circling = d < 14;
    b.steer = circling ? 0.6 : clamp(err * 2, -1, 1);
    b.throttle = circling ? 0.25 + Math.sin(e.t * 0.7) * 0.15 : 0.7;
    if (Math.random() < dt * 0.4) G.fx.smoke(b.pos.x, b.pos.y + 1, b.pos.z, 0x3a3a3a);
  }

  spearHitThief(pos) {
    const pete = this.pete;
    if (!pete || pete.swim) return false;
    if (pete.pos.distanceTo(pos) < 1.4) {
      pete.swim = 0.01;
      this.game.ui.radio('Radio: You harpooned Pete! (He is fine. He is used to it.)');
      return true;
    }
    return false;
  }

  /* ---------------- visuals on every peer ---------------- */
  _visuals(dt) {
    const G = this.game;
    // Pete sits at the wheel of your boat, then swims off
    const pete = this.pete;
    if (pete) {
      const b = G.boatById(pete.boat);
      if (b && !pete.swim) {
        const helm = b.hull.helm;
        b.toWorld(_v.set(helm[0], b.deck, helm[2]), pete.pos);
        pete.c.root.position.copy(pete.pos);
        pete.c.root.rotation.y = b.heading;
        pete.c.update(dt, 'drive', 0);
      } else if (pete.swim) {
        pete.swim += dt;
        pete.pos.x += dt * 2; pete.pos.z += dt * 1.2;
        pete.pos.y = G.world.sea(pete.pos.x, pete.pos.z) - 1.1;
        pete.c.root.position.copy(pete.pos);
        pete.c.update(dt, 'swim', 1);
        if (pete.swim > 8) this._removePete();
      }
    }
    // meteor fireball
    const me = this.active('meteor');
    if (me && me.t < me.fall) {
      if (!this.meteorMesh) {
        const b = new MeshBuilder();
        b.color(0xffd27a).lump(2.2, 0, 0, 0, 0.3);
        this.meteorMesh = new THREE.Mesh(b.build(), MAT.glow);
        G.scene.add(this.meteorMesh);
      }
      const f = me.t / me.fall;
      const p = new THREE.Vector3(me.x - 200 * (1 - f), 400 * (1 - f), me.z - 120 * (1 - f));
      this.meteorMesh.position.copy(p);
      this.meteorMesh.visible = true;
      G.fx.fire(p.x, p.y, p.z, 1.5); G.fx.fire(p.x, p.y, p.z, 1.5);
      G.fx.smoke(p.x, p.y, p.z, 0x5a5a5a);
    } else if (this.meteorMesh) this.meteorMesh.visible = false;
    if (me && me.t > me.fall && Math.random() < dt * 4) G.fx.glint(me.x + (Math.random() - 0.5) * me.r, 0.3, me.z + (Math.random() - 0.5) * me.r, 0x9ab8ff);
    // migrations: fish leaping out of the water everywhere
    const mi = this.active('migration');
    if (mi && Math.random() < dt * 6) {
      const a = Math.random() * 6.28, d = Math.random() * mi.r;
      const x = mi.x + Math.cos(a) * d, z = mi.z + Math.sin(a) * d;
      if (G.world.waterAt(x, z) > -Infinity) this._jumper(x, z);
    }
    for (let i = this.jumpers.length - 1; i >= 0; i--) {
      const J = this.jumpers[i];
      J.t += dt;
      const f = J.t / 0.8;
      if (f >= 1) { G.fx.splash(J.x, J.y0, J.z, 0.4); G.scene.remove(J.m); this.jumpers.splice(i, 1); continue; }
      J.m.position.set(J.x + J.dx * f, J.y0 + Math.sin(f * Math.PI) * 1.1, J.z + J.dz * f);
      J.m.rotation.set(0, J.h, Math.cos(f * Math.PI) * 0.8);
    }
  }
  _jumper(x, z) {
    const G = this.game;
    if (this.jumpers.length > 14) return;
    const sp = G.fishMeshCache('mackerel');
    const m = sp.clone();
    m.scale.setScalar(0.35);
    G.scene.add(m);
    const h = Math.random() * 6.28;
    const y0 = G.world.sea(x, z);
    G.fx.splash(x, y0, z, 0.3);
    this.jumpers.push({ m, t: 0, x, z, y0, h, dx: Math.cos(h) * 1.2, dz: -Math.sin(h) * 1.2 });
  }

  /* ---------------- sync ---------------- */
  snapshot() {
    return { s: +this.storm.toFixed(3), e: this.list.map(e => ({ id: e.id, k: e.k, x: +e.x.toFixed(1), z: +e.z.toFixed(1), r: e.r, t: +e.t.toFixed(1), dur: e.dur, s: e.s ? +e.s.toFixed(2) : 0, fall: e.fall || 0, boat: e.boat || 0 })), pete: this.pete ? { swim: this.pete.swim, boat: this.pete.boat } : null };
  }
  applySnapshot(s) {
    const had = new Set(this.list.map(e => e.id));
    this.storm = s.s;
    for (const e of s.e) if (!had.has(e.id)) { this.radio(e.k); this.game.ui.eventBanner(e.k); this.game.audio.eventSting(e.k); }
    this.list = s.e;
    if (s.pete && !this.pete) { const b = this.game.boatById(s.pete.boat); if (b) this._spawnPete(b); }
    if (this.pete && s.pete) this.pete.swim = s.pete.swim;
    if (!s.pete && this.pete) this._removePete();
  }
}
