/* Ships.js - other people's boats.

   Fishing boats, traders, salvagers, surveyors, cargo ships, a rich man's
   yacht, a Guild escort, a drifting wreck, and pirates. They are real boats
   (Boat.js, the same physics as yours) with real crews walking their decks,
   and they sail about the sea doing their own business: steaming to the next
   ground, stopping to fish, drifting.

   Pull alongside and the crew notices you. Some wave and talk, some warn you
   off, a rich man's yacht runs. Jump across and you can walk their deck,
   break open their crates and pick up their catch - if nobody is looking.
   If somebody is, the whole crew comes for you: fists, belaying pins,
   cutlasses, pistols. Knock them down, tie them up, throw them over the side;
   they get up again, untie each other, bail and patch their hull, and call for
   the Guild escort if it goes on too long.

   Pirates come looking. Black sails, a skull you can read a mile off, six
   guns. They chase, they fire, and when they are close enough a spiked bridge
   comes down on your rail and they walk across it for your catch and for you.
   Kick the bridge off, knock them into the sea, or run. If they take everyone
   down, you wake up somewhere else (Game._captured -> Pirate Island).

   The host runs all of it; the crew list and every boat go to the guests in
   the world snapshot, and shots, cannon and shouts go as events. */

import * as THREE from '../../lib/three.module.js';
import { Boat } from './Boat.js';
import { Character } from '../art/Character.js';
import { buildRod } from '../art/RodArt.js';
import { ROD_BY_ID, TOOL_BY_ID } from '../data/GearData.js';
import { SHIP_KINDS, CREW_LOOKS, CREW_WEAPONS } from '../data/ShipData.js';
import { HULL_BY_ID } from '../data/BoatData.js';
import { FISH, FISH_BY_ID } from '../data/FishData.js';
import { galleyDress, waveFlag, cargoMesh, boardingBridge, cannonballMesh } from '../art/ShipArt.js';
import { toolMesh } from './ViewModel.js';
import { heightAt } from '../world/Terrain.js';
import { zoneAt, HOME_CENTRE, WORLD, fogAt } from '../world/MapData.js';
import { clamp, damp, wrapAngle, uid, rng } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const V3 = () => new THREE.Vector3();
const _v = V3(), _w = V3(), _a = V3(), _b = V3();
const pick = a => a[Math.floor(Math.random() * a.length)];
const MAX_SHIPS = 4;
const HP = 100;

/* ---------------- speech bubbles ---------------- */
function bubble(text, col = '#fff') {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d');
  if (c) {
    c.font = '700 34px Nunito, "Segoe UI", sans-serif';
    let t = text; while (c.measureText(t).width > 470 && t.length > 4) t = t.slice(0, -2);
    const w = Math.min(500, c.measureText(t).width + 40);
    c.fillStyle = 'rgba(12,18,22,0.82)';
    c.beginPath(); c.moveTo(256 - w / 2, 12); c.lineTo(256 + w / 2, 12); c.lineTo(256 + w / 2, 84); c.lineTo(270, 84); c.lineTo(256, 104); c.lineTo(242, 84); c.lineTo(256 - w / 2, 84); c.closePath(); c.fill();
    c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, 256, 49);
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
  sp.scale.set(2.2, 0.55, 1); sp.renderOrder = 20;
  return sp;
}

export class Ships {
  constructor(game) {
    this.game = game;
    this.list = new Map();          // id -> ship
    this.boatList = [];             // their Boats (for Game.allBoats)
    this.balls = [];                // cannonballs in the air (everyone simulates; the host decides hits)
    this.bridges = [];              // boarding-bridge meshes
    this.spawnT = 25;
    this.t = 0;
    this.group = new THREE.Group(); this.group.name = 'ships';
    game.scene.add(this.group);
    this.noticed = {};              // pid -> time a pirate last spotted them (for the warning)
    this.bound = {};                // pid -> until when a pirate has them tied up (host)
    this.nextId = 1;
    this.timers = [];               // game-clock timers (host): a swing lands, a gun fires, help arrives
  }
  /** Run fn after `sec` seconds of game time. */
  after(sec, fn) { this.timers.push({ t: sec, fn }); }

  /* ================= spawning (host) ================= */
  _pickKind(zone, near) {
    const K = Object.entries(SHIP_KINDS).filter(([id, K]) => zone >= K.zones[0] && zone <= K.zones[1]);
    if (!K.length) return null;
    const tot = K.reduce((a, [, k]) => a + k.weight * (k.pirate ? (near ? 0.6 : 1) : 1), 0);
    let r = Math.random() * tot;
    for (const [id, k] of K) { r -= k.weight * (k.pirate ? (near ? 0.6 : 1) : 1); if (r <= 0) return id; }
    return K[0][0];
  }
  /** Somewhere open and deep, `d` metres from (x,z). */
  _openWater(x, z, d0, d1) {
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, d = d0 + Math.random() * (d1 - d0);
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (Math.hypot(px - HOME_CENTRE.x, pz - HOME_CENTRE.z) > WORLD.edge - 200) continue;
      let ok = true;
      for (let j = 0; j < 8 && ok; j++) { const b = j / 8 * Math.PI * 2; if (heightAt(px + Math.cos(b) * 40, pz + Math.sin(b) * 40) > -4) ok = false; }
      if (ok && heightAt(px, pz) < -6) return { x: px, z: pz };
    }
    return null;
  }
  spawn(kind, x, z, heading = Math.random() * Math.PI * 2, o = {}) {
    const G = this.game, K = SHIP_KINDS[kind];
    if (!K) return null;
    const id = o.id || 'ship' + (this.nextId++) + '_' + Math.floor(Math.random() * 1e4).toString(36);
    const boat = new Boat(G, { hull: K.hull, parts: { engine: 1, hull: K.pirate ? 3 : 1, lights: 1 }, paint: K.paint, decor: [] }, id);
    boat.npc = true; boat.docked = false; boat.mooring = null;
    boat.pos.set(x, 0, z); boat.heading = heading; boat._updateMatrix();
    const S = { id, kind, K, boat, crew: [], cargo: [], hostile: new Set(), alarm: 0, st: K.derelict ? 'drift' : 'roam', wp: null, t: 0, fishT: 20 + Math.random() * 40,
      gunT: 3, bridge: null, calledHelp: false, taunt: 4, fled: 0, sayT: 0, age: 0, far: 0 };
    if (K.derelict) { boat.hp = boat.stats.hp * 0.35; boat.addHole(0.5); boat.water = 0.25; boat.breakSomething('rail'); boat.breakSomething('engine'); }
    if (kind === 'pirate') this._dressGalley(S);
    this.list.set(id, S);
    this._refreshList();
    if (!o.bare) {
      this._makeCrew(S);
      this._makeCargo(S);
    }
    return S;
  }
  _refreshList() { this.boatList = [...this.list.values()].map(S => S.boat); }
  _dressGalley(S) {
    const b = S.boat, H = b.hull;
    const d = galleyDress(H, H.deck);
    b.group.add(d);
    S.dress = d;
    // the stern castle is solid, and so are the guns
    const c = d.userData.castle;
    b.obstacles.push({ x: 0, z: c.z, hw: c.hw, hd: c.hd });
    for (const g of d.userData.guns) b.obstacles.push({ x: g.x - g.side * 0.75, z: g.z, hw: 0.35, hd: 0.3 });
  }
  /** Walkable deck points of a boat (local), clear of obstacles. */
  _deckPoint(b, r = Math.random) {
    const H = b.hull;
    for (let k = 0; k < 30; k++) {
      const z = (r() * 2 - 1) * (H.hl - 1.0), x = (r() * 2 - 1) * (b.halfWidth(z) - 0.5);
      if (!b.over(x, z, 0.4)) continue;
      if (b.obstacles.some(o => Math.abs(x - o.x) < o.hw + 0.4 && Math.abs(z - o.z) < o.hd + 0.4)) continue;
      return new THREE.Vector3(x, b.deck, z);
    }
    return new THREE.Vector3(0, b.deck, 0);
  }
  _makeCrew(S) {
    const b = S.boat;
    S.K.crew.forEach(([role, weapon], i) => {
      const looks = CREW_LOOKS[S.kind === 'pirate' && role === 'captain' ? 'pirateCaptain' : role] || CREW_LOOKS.deckhand;
      const look = { ...pick(looks), skin: pick([0xf1c9a5, 0xe0ac86, 0xc68a62, 0x9a6444, 0x70462e]) };
      const C = { id: S.id + 'c' + i, ship: S, role, weapon, W: CREW_WEAPONS[weapon] || CREW_WEAPONS.fists, look, hp: HP, st: 'idle', t: Math.random() * 4,
        on: b, local: this._deckPoint(b), pos: V3(), yaw: Math.random() * 6.28, dest: null, target: null, cd: 1 + Math.random(), aim: 0, swing: 0, downT: 0, bound: false,
        carry: null, bubble: null, bubbleT: 0, speed: 0, act: 0 };
      if (i === 0 && S.boat.hull.helm) C.local.set(S.boat.hull.helm[0], b.deck, S.boat.hull.helm[2] - 0.6), C.helm = true;
      this._crewBody(C);
      S.crew.push(C);
    });
  }
  _crewBody(C) {
    const c = new Character(C.look, C.id.length * 31 + C.id.charCodeAt(C.id.length - 1));
    C.c = c;
    this.game.scene.add(c.root);
    // what they hold: a rod for the fishers when they fish, their weapon otherwise
    C.weaponMesh = null;
    if (C.weapon !== 'fists' && TOOL_BY_ID[C.weapon]) { C.weaponMesh = toolMesh(C.weapon); C.weaponMesh.scale.setScalar(0.9); C.weaponMesh.rotation.x = Math.PI / 2; }
    if (C.ship.K.fishes && C.role !== 'bodyguard') { const r = buildRod(ROD_BY_ID[pick(['basic', 'reinforced', 'reef'])]); r.group.scale.setScalar(0.8); r.group.rotation.x = Math.PI / 2 - 0.4; C.rodMesh = r.group; }
    this._hold(C, C.weaponMesh);
  }
  _hold(C, m) { if (C.held === m) return; C.held = m; C.c.hold(m || null); }
  _makeCargo(S) {
    const b = S.boat, n = S.K.crates || 0;
    for (let i = 0; i < n; i++) {
      const p = this._deckPoint(b);
      const kind = S.K.loot.some(l => l[0] === 'chest') && i === 0 ? 'chest' : i % 3 === 1 ? 'barrel' : 'crate';
      const cg = { i, kind, x: p.x, z: p.z, open: false, m: null };
      cg.m = cargoMesh(kind, i + S.id.length);
      cg.m.position.set(p.x, b.deck, p.z); cg.m.rotation.y = Math.random() * 6.28;
      b.group.add(cg.m);
      b.obstacles.push({ x: p.x, z: p.z, hw: 0.36, hd: 0.36, cargo: true });
      S.cargo.push(cg);
    }
    // their catch, lying by the cooler: yours for the taking, if nobody sees
    if (S.K.catch) {
      const [lo, hi] = S.K.catch, n2 = lo + Math.floor(Math.random() * (hi - lo + 1));
      for (let k = 0; k < n2; k++) this._spawnLoot(S, 'fish', this._deckPoint(b), false);
    }
  }

  /* ---------------- what comes out of a crate ---------------- */
  _lootSpec(S, what) {
    const zone = zoneAt(S.boat.pos.x, S.boat.pos.z);
    if (what === 'fish') {
      const pool = FISH.filter(f => !f.junk && !f.beast && f.rarity !== 'giant' && f.rarity !== 'legendary' && (f.where === 'all' || Array.isArray(f.where)) && f.kg[1] < 60 && (S.K.rare ? ['rare', 'epic', 'uncommon'].includes(f.rarity) : ['common', 'uncommon', 'rare'].includes(f.rarity)));
      const f = pick(pool.length ? pool : FISH.filter(x => !x.junk).slice(0, 20));
      const kg = f.kg[0] + Math.random() * (f.kg[1] - f.kg[0]) * 0.7;
      return { sp: f.id, kg: +kg.toFixed(2), cm: Math.round(f.cm[0] + (f.cm[1] - f.cm[0]) * 0.5), zone, alive: false };
    }
    const table = { bait: 'baitsack', coins: 'coinpouch', mats: 'timberbundle', goods: pick(['spicejar', 'silkbolt', 'rumcask', 'teachest']), junk: pick(['boot', 'can', 'oldkey']), strongbox: 'strongbox', chest: 'chest', chart: 'shipchart', weapon: pick(['cutlassitem', 'pistolitem', 'pinitem']), odd: pick(['bottle', 'mimic', 'eel']) };
    const sp = table[what] || 'boot';
    const F = FISH_BY_ID[sp] || FISH_BY_ID.boot;
    return { sp: F.id, kg: F.kg[0], cm: F.cm[0], zone, alive: false };
  }
  _spawnLoot(S, what, local, pop = true) {
    const G = this.game, spec = this._lootSpec(S, what), b = S.boat;
    const w = b.toWorld(_v.copy(local).setY(b.deck + 0.4));
    const it = G.loot.spawn({ ...spec, pos: w, vel: pop ? new THREE.Vector3((Math.random() - 0.5) * 3, 3.5, (Math.random() - 0.5) * 3) : new THREE.Vector3(), flop: 0, boat: b });
    if (it) it.shipOf = S.id;
    return it;
  }

  /* ================= every frame ================= */
  update(dt, host) {
    const G = this.game;
    this.t += dt;
    if (host) this._hostSpawn(dt);
    if (host) for (let i = this.timers.length - 1; i >= 0; i--) { const T = this.timers[i]; T.t -= dt; if (T.t <= 0) { this.timers.splice(i, 1); T.fn(); } }
    for (const S of [...this.list.values()]) {
      const b = S.boat;
      if (host) { this._shipAI(S, dt); b.simulate(dt, G.world); this._crewHost(S, dt); }
      b.visuals(dt, G.fx, G.world, G._night?.() || 0);
      if (S.dress) waveFlag(S.dress.userData.flag, this.t + S.id.length, 1 + G.world.storm);
      this._crewPose(S, dt);
      if (host && (S.gone || (b.sinking > 0 && b.sinking > 14))) this._remove(S);
    }
    this._balls(dt, host);
    this._bridgesDraw();
    if (host) this._collideBoats(dt);
  }
  _hostSpawn(dt) {
    const G = this.game;
    this.spawnT -= dt;
    for (const S of this.list.values()) {
      const d = Math.min(...G.allPlayers().map(P => P.pos.distanceTo(S.boat.pos)));
      S.far = d > 1400 ? S.far + dt : 0;
      if (S.far > 20 && !S.engaged) S.gone = true;
    }
    if (this.spawnT > 0) return;
    this.spawnT = 45 + Math.random() * 60;
    const P = G.focusPlayer?.() || G.player;
    if (!P || G.intro?.active) return;
    // only on the water, well away from home, and not in the middle of the edge business
    if (Math.hypot(P.pos.x - HOME_CENTRE.x, P.pos.z - HOME_CENTRE.z) < 650 || G.edge?.E) return;
    const near = [...this.list.values()].filter(S => S.boat.pos.distanceTo(P.pos) < 1200).length;
    if (near >= 2 || this.list.size >= MAX_SHIPS) return;
    const zone = zoneAt(P.pos.x, P.pos.z);
    const kind = this._pickKind(zone, false);
    if (!kind) return;
    // a pirate is sometimes seen coming from a long way off, and sometimes is simply there
    const sudden = kind === 'pirate' && Math.random() < 0.35;
    const spot = this._openWater(P.pos.x, P.pos.z, sudden ? 240 : 450, sudden ? 340 : 900);
    if (!spot) return;
    const S = this.spawn(kind, spot.x, spot.z, Math.atan2(P.pos.x - spot.x, P.pos.z - spot.z) + (Math.random() - 0.5) * 1.5);
    if (S && kind === 'pirate') S.sudden = sudden;
  }
  _remove(S) {
    const G = this.game;
    for (const C of S.crew) { G.scene.remove(C.c.root); if (C.bubble) C.bubble.parent?.remove(C.bubble); }
    for (const P of G.allPlayers()) if (P.boat === S.boat) P.detach?.();
    G.scene.remove(S.boat.group);
    if (S.bridgeMesh) { this.group.remove(S.bridgeMesh); S.bridgeMesh = null; }
    // what was lying on its deck goes into the sea with it
    for (const it of [...G.loot.items.values()]) if (it.boat === S.boat) G.loot._detach(it);
    this.list.delete(S.id);
    this._refreshList();
  }
  /** Remove every ship (admin / tests). */
  clear() { for (const S of [...this.list.values()]) this._remove(S); }

  /* ================= how a ship sails (host) ================= */
  _steerTo(S, x, z, throttle) {
    const b = S.boat;
    const want = Math.atan2(x - b.pos.x, z - b.pos.z);
    let err = wrapAngle(want - b.heading);
    // shallow water ahead: turn away from it
    const f = b.forward(), look = 26 + b.hull.hl;
    const ahead = heightAt(b.pos.x + f.x * look, b.pos.z + f.z * look);
    if (ahead > -2.5) {
      const l = heightAt(b.pos.x + Math.sin(b.heading + 0.7) * look, b.pos.z + Math.cos(b.heading + 0.7) * look);
      const r = heightAt(b.pos.x + Math.sin(b.heading - 0.7) * look, b.pos.z + Math.cos(b.heading - 0.7) * look);
      err = l < r ? 1.2 : -1.2;
      throttle *= 0.5;
    }
    b.autopilot = b.autopilot || { x, z };
    b.autopilot.x = x; b.autopilot.z = z;
    b.steer = clamp(err * 2, -1, 1);
    b.throttle = throttle * clamp(1.2 - Math.abs(err) * 0.4, 0.35, 1);
  }
  _stop(S) { const b = S.boat; b.autopilot = b.autopilot || { x: b.pos.x, z: b.pos.z }; b.throttle = 0; b.steer = 0; }
  _nearestPlayerBoat(S, range) {
    const G = this.game;
    let best = null, bd = range;
    for (const P of G.allPlayers()) {
      const pb = P.boat;
      const pos = pb ? pb.pos : P.pos;
      const d = Math.hypot(pos.x - S.boat.pos.x, pos.z - S.boat.pos.z);
      if (d < bd && P.mode !== 'down') { bd = d; best = { P, boat: pb, pos, d }; }
    }
    return best;
  }
  _shipAI(S, dt) {
    const G = this.game, b = S.boat, K = S.K;
    S.t += dt; S.age += dt;
    if (b.sinking > 0) { this._stop(S); return; }
    // somebody aboard at the wheel who is not crew: it is theirs now
    if (b.driver && !S.crew.some(C => C.helm && C.st !== 'down' && !C.bound && C.on === b)) { b.autopilot = null; return; }
    if (b.driver) b.driver = null;
    const helmsman = S.crew.find(C => C.helm && C.on === b && C.st !== 'down' && !C.bound && C.st !== 'swim');
    if (!helmsman || K.derelict) { this._stop(S); return; }
    const alive = S.crew.filter(C => C.on === b && C.st !== 'down' && !C.bound && C.st !== 'swim').length;
    const beaten = alive <= Math.ceil(S.crew.length * 0.34);
    const threat = this._nearestPlayerBoat(S, K.pirate ? (fogAt(b.pos.x, b.pos.z) > 0.4 || G.isNight() ? 380 : 720) : 90);
    // pirates
    if (K.pirate) return this._pirateAI(S, dt, threat, beaten);
    // everybody else: flee a fight they are losing, a stranger if they are shy, or anyone hostile
    const aboard = G.allPlayers().some(Q => Q.boat === b && S.hostile.has(Q.id));
    const hostileNear = threat && S.hostile.has(threat.P.id) && !aboard;
    if ((K.mood === 'shy' && threat && threat.d < 70) || (hostileNear && (beaten || K.mood !== 'wary')) || S.st === 'flee') {
      if (S.st !== 'flee') { S.st = 'flee'; S.fled = 0; this._say(helmsman, pick(K.say.flee || ['Go!'])); }
      S.fled += dt;
      const away = threat ? threat.pos : G.player.pos;
      const dx = b.pos.x - away.x, dz = b.pos.z - away.z, l = Math.hypot(dx, dz) || 1;
      this._steerTo(S, b.pos.x + dx / l * 200, b.pos.z + dz / l * 200, 1);
      if (S.fled > 40 && (!threat || threat.d > 250)) { S.st = 'roam'; S.hostile.clear(); S.alarm = 0; }
      return;
    }
    // somebody tied up alongside: stop and deal with it
    if (threat && threat.d < 25 && (S.alarm > 0 || K.mood === 'friendly')) { this._stop(S); return; }
    // fishing boats stop to fish
    if (K.fishes) {
      S.fishT -= dt;
      if (S.st === 'fish') { this._stop(S); if (S.fishT <= 0) { S.st = 'roam'; S.fishT = 30 + Math.random() * 50; } return; }
      if (S.fishT <= 0) { S.st = 'fish'; S.fishT = 25 + Math.random() * 35; return; }
    }
    if (!S.wp || Math.hypot(S.wp.x - b.pos.x, S.wp.z - b.pos.z) < 40) S.wp = this._openWater(b.pos.x, b.pos.z, 250, 600) || { x: b.pos.x + 300, z: b.pos.z };
    this._steerTo(S, S.wp.x, S.wp.z, K.speed * 0.7);
  }
  _pirateAI(S, dt, threat, beaten) {
    const G = this.game, b = S.boat, K = S.K;
    const hurt = b.hp < b.stats.hp * 0.3 || b.water > 0.55;
    if ((beaten || hurt) && S.st !== 'retreat') {
      S.st = 'retreat'; S.engaged = false;
      if (S.bridge) this.dropBridge(S, 'retreat');
      const cap = S.crew.find(C => C.on === b && C.st !== 'down' && !C.bound) || S.crew[0];
      this._say(cap, pick(K.say.flee));
      G._everyone({ t: 'ship', k: 'retreat', id: S.id });
    }
    if (S.st === 'retreat') {
      const away = threat ? threat.pos : G.player.pos;
      const dx = b.pos.x - away.x, dz = b.pos.z - away.z, l = Math.hypot(dx, dz) || 1;
      this._steerTo(S, b.pos.x + dx / l * 300, b.pos.z + dz / l * 300, 1);
      if (!threat || threat.d > 700) S.gone = true;
      return;
    }
    if (!threat) {
      S.engaged = false; S.st = 'patrol';
      if (!S.wp || Math.hypot(S.wp.x - b.pos.x, S.wp.z - b.pos.z) < 60) S.wp = this._openWater(b.pos.x, b.pos.z, 300, 800) || { x: b.pos.x - 300, z: b.pos.z };
      this._steerTo(S, S.wp.x, S.wp.z, 0.55);
      return;
    }
    // spotted: the chase
    if (!S.engaged) {
      S.engaged = true; S.st = 'chase';
      if (!this.noticed[threat.P.id] || this.t - this.noticed[threat.P.id] > 60) {
        this.noticed[threat.P.id] = this.t;
        G._everyone({ t: 'ship', k: 'pirates', id: S.id, d: Math.round(threat.d), sudden: !!S.sudden });
      }
    }
    for (const P of G.allPlayers()) if (P.pos.distanceTo(b.pos) < 900) S.hostile.add(P.id);
    const tb = threat.boat, tp = threat.pos;
    if (S.bridge) {
      // bridged: stay alongside whatever they do
      const T = G.boatById(S.bridge.to);
      if (!T || T.sinking) { this.dropBridge(S, 'gone'); return; }
      this._alongside(S, T, dt, true);
      return;
    }
    if (tb) {
      const d = threat.d;
      // the guns: when they are abeam and in range
      S.gunT -= dt;
      const bearing = wrapAngle(Math.atan2(tp.x - b.pos.x, tp.z - b.pos.z) - b.heading);
      const abeam = Math.abs(Math.abs(bearing) - Math.PI / 2) < 0.55;
      if (d < 130 && d > 14 && abeam && S.gunT <= 0) { S.gunT = 6 + Math.random() * 3; this._broadside(S, tb, bearing > 0 ? 1 : -1); }
      // close in on the side; when alongside and slow enough, the bridge comes down
      if (d < 40) {
        this._alongside(S, tb, dt, false);
        const rel = Math.hypot(tb.vel.x - b.vel.x, tb.vel.y - b.vel.y);
        const gap = d - tb.hull.hw - b.hull.hw;
        if (gap < 4.2 && rel < 4.5 && S.t > 3) this.lowerBridge(S, tb);
      } else {
        // run a line to pass them broadside in gun range, then cut in
        const side = bearing > 0 ? 1 : -1;
        const f = tb.forward();
        const ox = tp.x + f.z * side * 28 + tb.vel.x * 3, oz = tp.z - f.x * side * 28 + tb.vel.y * 3;
        this._steerTo(S, d > 120 ? tp.x + tb.vel.x * 4 : ox, d > 120 ? tp.z + tb.vel.y * 4 : oz, 1);
      }
      S.taunt -= dt;
      if (S.taunt <= 0 && d < 90) { S.taunt = 9 + Math.random() * 8; const C = S.crew.find(x => x.on === b && x.st !== 'down' && !x.bound); if (C) this._say(C, pick(K.say.taunt)); }
    } else {
      // on foot or swimming: come and have a look, no boarding
      this._steerTo(S, tp.x, tp.z, 0.6);
    }
  }
  /** Hold station beside boat T (matching its heading and speed); `lock` keeps them tight together. */
  _alongside(S, T, dt, lock) {
    const b = S.boat;
    const f = T.forward(), side = Math.sign((b.pos.x - T.pos.x) * f.z - (b.pos.z - T.pos.z) * f.x) || 1;
    const gap = T.hull.hw + b.hull.hw + (lock ? 3.4 : 3.0);
    const tx = T.pos.x + f.z * side * gap, tz = T.pos.z - f.x * side * gap;
    const dx = tx - b.pos.x, dz = tz - b.pos.z;
    if (lock) {
      // the bridge holds them together: pull both boats toward the right spacing
      b.tow.x += dx * 2.4 - (b.vel.x - T.vel.x) * 1.6; b.tow.y += dz * 2.4 - (b.vel.y - T.vel.y) * 1.6;
      T.tow.x -= dx * 0.9; T.tow.y -= dz * 0.9;
      b.heading += wrapAngle(T.heading - b.heading) * Math.min(1, dt * 1.5);
      this._stop(S);
      return;
    }
    const ahead = Math.hypot(T.vel.x, T.vel.y);
    this._steerTo(S, tx + f.x * (4 + ahead * 1.5), tz + f.z * (4 + ahead * 1.5), clamp(0.4 + Math.hypot(dx, dz) * 0.05 + ahead / Math.max(4, b.stats.speed), 0.3, 1));
  }
  /** Ships do not pass through each other (yours included): a push apart and a bump. */
  _collideBoats(dt) {
    const G = this.game, all = G.allBoats();
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const A = all[i], B = all[j];
      if (A.absent || B.absent || A.sinking > 1 || B.sinking > 1) continue;
      const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, d = Math.hypot(dx, dz);
      // two ellipses, approximated by the circle each side of its long axis
      const ra = A.hull.hw + 0.4, rb = B.hull.hw + 0.4;
      if (d > A.hull.hl + B.hull.hl + 2) continue;
      let hit = null;
      for (const ta of [-0.6, 0, 0.6]) for (const tb of [-0.6, 0, 0.6]) {
        const ax = A.pos.x + Math.sin(A.heading) * A.hull.hl * ta, az = A.pos.z + Math.cos(A.heading) * A.hull.hl * ta;
        const bx = B.pos.x + Math.sin(B.heading) * B.hull.hl * tb, bz = B.pos.z + Math.cos(B.heading) * B.hull.hl * tb;
        const ex = bx - ax, ez = bz - az, e = Math.hypot(ex, ez);
        if (e < ra + rb && (!hit || e < hit.e)) hit = { e, nx: ex / (e || 1), nz: ez / (e || 1) };
      }
      if (!hit) continue;
      const pen = (ra + rb - hit.e) * 0.5;
      const ma = A.hull.mass, mb = B.hull.mass, wa = mb / (ma + mb), wb = ma / (ma + mb);
      A.pos.x -= hit.nx * pen * wa * 2; A.pos.z -= hit.nz * pen * wa * 2;
      B.pos.x += hit.nx * pen * wb * 2; B.pos.z += hit.nz * pen * wb * 2;
      const rv = (B.vel.x - A.vel.x) * hit.nx + (B.vel.y - A.vel.y) * hit.nz;
      if (rv < 0) {
        A.vel.x += hit.nx * rv * wa * 1.2; A.vel.y += hit.nz * rv * wa * 1.2;
        B.vel.x -= hit.nx * rv * wb * 1.2; B.vel.y -= hit.nz * rv * wb * 1.2;
        if (-rv > 3.5) { A.damage((-rv - 3) * 5 * wa, 'ram'); B.damage((-rv - 3) * 5 * wb, 'ram'); G._everyone({ t: 'ship', k: 'thud', p: [A.pos.x + hit.nx * ra, 1, A.pos.z + hit.nz * ra], f: -rv }); }
      }
    }
  }

  /* ================= guns ================= */
  _broadside(S, T, side) {
    const G = this.game, b = S.boat, guns = S.dress.userData.guns.filter(g => g.side === side);
    guns.forEach((g, k) => this.after(k * 0.38, () => {
      if (!this.list.has(S.id) || b.sinking) return;
      const o = b.toWorld(_v.set(g.x, g.y, g.z)).clone();
      // aim where they will be, with an honest gunner's error
      const d = o.distanceTo(T.pos), tf = d / 42;
      const tx = T.pos.x + T.vel.x * tf + (Math.random() - 0.5) * d * 0.16, tz = T.pos.z + T.vel.y * tf + (Math.random() - 0.5) * d * 0.16;
      const flat = Math.hypot(tx - o.x, tz - o.z), vh = flat / tf;
      const vy = (T.deck + 0.8 - o.y + 0.5 * 9.8 * tf * tf) / tf;
      const v = [(tx - o.x) / flat * vh, vy, (tz - o.z) / flat * vh];
      G._everyone({ t: 'ship', k: 'cannon', o: o.toArray().map(n => +n.toFixed(2)), v: v.map(n => +n.toFixed(2)), s: S.id });
    }));
  }
  onCannon(e) {
    const G = this.game;
    const m = cannonballMesh();
    m.position.fromArray(e.o);
    this.group.add(m);
    this.balls.push({ m, p: m.position, v: new THREE.Vector3().fromArray(e.v), t: 0, s: e.s });
    G.fx.explosion?.(e.o[0], e.o[1], e.o[2], 0.35);
    G.fx.smoke(e.o[0], e.o[1], e.o[2], 0x9a9488);
    G.audio.explosion?.(0.6, new THREE.Vector3().fromArray(e.o));
    G.addShake?.(Math.max(0, 0.35 - G.player.pos.distanceTo(m.position) / 400));
  }
  _balls(dt, host) {
    const G = this.game;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const B = this.balls[i];
      B.t += dt;
      B.v.y -= 9.8 * dt;
      B.p.addScaledVector(B.v, dt);
      let done = false;
      if (host) {
        for (const bt of G.allBoats()) {
          if (bt.id === B.s || bt.absent || bt.sinking) continue;
          const L = bt.toLocal(B.p, _w);
          if (bt.over(L.x, L.z, -0.4) && L.y > bt.deck - 1.4 && L.y < bt.deck + 2.6) { this._ballHit(B, bt); done = true; break; }
        }
      }
      const sea = G.world.sea(B.p.x, B.p.z);
      if (!done && B.p.y < sea) { if (host) G._everyone({ t: 'ship', k: 'splash', p: B.p.toArray() }); done = true; }
      if (B.t > 8) done = true;
      if (done) { this.group.remove(B.m); this.balls.splice(i, 1); }
    }
  }
  _ballHit(B, bt) {
    const G = this.game;
    bt.damage(38, 'cannon');
    if (Math.random() < 0.6) bt.addHole(0.6 + Math.random() * 0.6);
    if (Math.random() < 0.35) bt.breakSomething();
    // a loose crate or a fish goes flying
    for (const it of G.loot.items.values()) if (it.boat === bt && it.pos.distanceTo(B.p) < 4) { it.vel.y += 4; it.vel.x += (Math.random() - 0.5) * 5; it.vel.z += (Math.random() - 0.5) * 5; }
    for (const P of G.allPlayers()) {
      const d = P.pos.distanceTo(B.p);
      if (d < 3.5) { G.hurtPlayer(P, 22 * (1 - d / 4), 'cannon'); G.knockPlayer(P, P.pos.clone().sub(B.p).setY(0).normalize(), 6 * (1 - d / 4), 'cannon'); }
    }
    for (const S of this.list.values()) for (const C of S.crew) if (C.on === bt && this.crewPos(C).distanceTo(B.p) < 3) this._crewHurt(C, 40, B.p, 5, null);
    G._everyone({ t: 'ship', k: 'hit', p: B.p.toArray(), b: bt.id });
  }

  /* ================= the boarding bridge ================= */
  lowerBridge(S, T) {
    if (S.bridge) return;
    S.bridge = { to: T.id, hp: 70, t: 0 };
    S.st = 'board';
    const cap = S.crew.find(C => C.on === S.boat && C.st !== 'down' && !C.bound);
    if (cap) this._say(cap, pick(S.K.say.angry));
    this.game._everyone({ t: 'ship', k: 'bridge', id: S.id, to: T.id });
  }
  dropBridge(S, why = '') {
    if (!S.bridge) return;
    const G = this.game, T = G.boatById(S.bridge.to);
    // anyone on it goes in the water
    for (const C of S.crew) if (C.st === 'cross') { C.st = 'swim'; C.on = null; C.pos.copy(C.crossTo || C.pos); }
    S.bridge = null;
    if (S.st === 'board') S.st = 'chase';
    S.t = -4;          // a few seconds before it can try again
    G._everyone({ t: 'ship', k: 'unbridge', id: S.id, why, to: T?.id });
  }
  /** The two ends of a ship's bridge in world space (on its rail, and on the other boat's rail). */
  bridgeEnds(S) {
    const G = this.game, T = S.bridge && G.boatById(S.bridge.to);
    if (!T) return null;
    const b = S.boat;
    const Lt = b.toLocal(_a.copy(T.pos), V3()), sideA = Math.sign(Lt.x) || 1;
    const za = clamp(Lt.z, -b.hull.hl * 0.4, b.hull.hl * 0.4);
    const A = b.toWorld(V3().set(sideA * (b.halfWidth(za) - 0.2), b.railY(za) + 0.05, za));
    const Lb = T.toLocal(_b.copy(A), V3()), sideB = Math.sign(Lb.x) || 1;
    const zb = clamp(Lb.z, -T.hull.hl * 0.6, T.hull.hl * 0.6);
    const Bp = T.toWorld(V3().set(sideB * (T.halfWidth(zb) - 0.15), T.railY(zb) + 0.05, zb));
    return { A, B: Bp, T, zb, sideB, za, sideA };
  }
  _bridgesDraw() {
    for (const S of this.list.values()) {
      if (!S.bridge) { if (S.bridgeMesh) { S.bridgeMesh.visible = false; } continue; }
      const E = this.bridgeEnds(S);
      if (!E) continue;
      const len = E.A.distanceTo(E.B);
      if (!S.bridgeMesh || Math.abs(S.bridgeMesh.userData.len - len) > 0.6) {
        if (S.bridgeMesh) this.group.remove(S.bridgeMesh);
        S.bridgeMesh = boardingBridge(Math.max(2, len)); S.bridgeMesh.userData.len = len; this.group.add(S.bridgeMesh);
      }
      const m = S.bridgeMesh; m.visible = true;
      m.position.copy(E.A);
      m.lookAt(E.B);
      m.scale.set(1, 1, len / m.userData.len);
    }
  }
  /** Is point p (world) on a bridge, and which ship's? (players can walk across) */
  bridgeAt(p, r = 0.75) {
    for (const S of this.list.values()) {
      if (!S.bridge) continue;
      const E = this.bridgeEnds(S);
      if (!E) continue;
      const ab = _a.copy(E.B).sub(E.A), l = ab.length();
      const t = clamp(_b.copy(p).sub(E.A).dot(ab) / (l * l), 0, 1);
      const q = E.A.clone().addScaledVector(ab, t);
      if (Math.hypot(q.x - p.x, q.z - p.z) < r && Math.abs(q.y - p.y) < 1.2) return { S, E, t, y: q.y };
    }
    return null;
  }
  /** A player hits the bridge (axe, weapon, a kick). */
  hitBridge(S, dmg, from) {
    if (!S.bridge) return;
    S.bridge.hp -= dmg;
    this.game._everyone({ t: 'ship', k: 'bridgeHit', id: S.id, hp: S.bridge.hp });
    if (S.bridge.hp <= 0) this.dropBridge(S, 'kicked');
  }

  /* ================= crews (host) ================= */
  crewPos(C, out = V3()) {
    if (C.st === 'swim' || !C.on) return out.copy(C.pos);
    if (C.st === 'cross') return out.copy(C.pos);
    return C.on.toWorld(out.copy(C.local));
  }
  _crewHost(S, dt) {
    const G = this.game;
    for (const C of S.crew) {
      C.t += dt; C.cd -= dt; C.bubbleT -= dt; C.act = Math.max(0, C.act - dt);
      if (C.st === 'down') { C.downT -= dt; if (C.downT <= 0 && !C.bound) { C.st = 'fight'; C.hp = 45; } continue; }
      if (C.bound) { C.st = 'bound'; continue; }
      if (C.st === 'swim') { this._crewSwim(C, dt); continue; }
      if (C.st === 'cross') { this._crewCross(C, dt); continue; }
      const b = C.on;
      if (!b) { C.st = 'swim'; continue; }
      if (b.sinking > 3) { C.pos.copy(this.crewPos(C)); C.on = null; C.st = 'swim'; continue; }
      // who is the enemy?
      const foe = this._foe(S, C);
      if (foe) { this._crewFight(S, C, foe, dt); continue; }
      if (S.K.pirate && C.on !== S.boat && S.bridge) { this._steal(S, C, dt); continue; }
      if (S.K.pirate && C.on !== S.boat && !S.bridge) { C.dest = null; C.pose = 'idle'; continue; }
      // mates to untie, holes to patch
      const mate = S.crew.find(M => M.bound && M.on === b && !M.untier);
      if (mate && C.role !== 'captain') { mate.untier = C; C.job = { k: 'untie', m: mate }; }
      if (C.job?.k === 'untie') { if (this._crewUntie(C, dt)) continue; }
      if (!C.helm && b.leaks.length && C.role !== 'owner') { this._crewRepair(C, b, dt); continue; }
      // the helmsman stays at the wheel
      if (C.helm && S.boat === b) { C.dest = new THREE.Vector3(b.hull.helm[0], b.deck, b.hull.helm[2] - 0.6); this._crewWalk(C, dt, 1.6); C.pose = 'drive'; continue; }
      // otherwise: fish, chat, stand about, or deal with a stranger aboard
      const stranger = G.allPlayers().find(P => P.boat === b && P.pos.distanceTo(this.crewPos(C)) < 12);
      if (stranger) {
        this._face(C, stranger.pos);
        C.pose = S.K.mood === 'friendly' ? 'talk' : 'idle';
        if (C.bubbleT < -6 && Math.random() < dt * 0.4) this._say(C, pick(S.K.mood === 'friendly' ? (S.K.say.hello || ['Hello.']) : (S.K.say.warn || S.K.say.hello || ['...'])));
        continue;
      }
      if (S.st === 'fish' && S.K.fishes && C.rodMesh) {
        if (!C.fishSpot) { const side = C.id.charCodeAt(C.id.length - 1) % 2 ? 1 : -1; const z = (Math.random() - 0.5) * b.hull.hl; C.fishSpot = new THREE.Vector3(side * (b.halfWidth(z) - 0.45), b.deck, z); }
        C.dest = C.fishSpot; if (this._crewWalk(C, dt, 1.4)) { C.pose = 'fish'; C.yaw = Math.sign(C.fishSpot.x) > 0 ? Math.PI / 2 : -Math.PI / 2; }
        continue;
      }
      C.fishSpot = null;
      if (!C.dest || C.t > 7) { C.t = Math.random() * 3; C.dest = this._deckPoint(b); }
      this._crewWalk(C, dt, 1.3);
    }
  }
  /** The player a crewman is fighting, if any. */
  _foe(S, C) {
    const G = this.game;
    if (!S.hostile.size) return null;
    const here = this.crewPos(C);
    let best = null, bd = C.W.ranged ? C.W.reach + 6 : 40;
    for (const P of G.allPlayers()) {
      if (!S.hostile.has(P.id) || (this.bound[P.id] || 0) > this.t) continue;
      const d = P.pos.distanceTo(here);
      if (d < bd) { bd = d; best = P; }
    }
    return best;
  }
  _crewFight(S, C, P, dt) {
    const G = this.game, W = C.W, here = this.crewPos(C);
    const d = P.pos.distanceTo(here);
    this._face(C, P.pos);
    this._hold(C, C.weaponMesh);
    C.pose = 'fight';
    if (C.bubbleT < -4 && Math.random() < dt * 0.3) this._say(C, pick(S.K.say.angry || ['Hey!']));
    if (W.ranged) {
      // keep a little distance and shoot
      if (d < 4 && C.on && P.boat === C.on) { const L = C.on.toLocal(P.pos, V3()); const aw = C.local.clone().sub(L).setY(0); if (aw.lengthSq() > 0.01) { C.dest = C.local.clone().addScaledVector(aw.normalize(), 1.5); this._crewWalk(C, dt, 2.4); } }
      C.aim = Math.min(1, C.aim + dt / (W.aim || 0.8));
      if (C.cd <= 0 && C.aim >= 1 && d < W.reach) { C.cd = W.cd * (0.8 + Math.random() * 0.5); C.aim = 0; this._crewShoot(C, P, d); }
      return;
    }
    // melee: go to them if they are on the same deck (or cross the bridge to get to them)
    if (C.on && P.boat === C.on) {
      const L = C.on.toLocal(P.pos, V3());
      if (d > W.reach * 0.85) { C.dest = L; this._crewWalk(C, dt, 3.1); }
      else if (S.K.pirate && P.mode === 'down' && !((this.bound[P.id] || 0) > this.t)) { this._bindPlayer(S, C, P); }
      else if (C.cd <= 0) { C.cd = W.cd * (0.8 + Math.random() * 0.4); C.swing = 0.45; C.act = 0.45; this.after(0.26, () => this._crewMelee(C, P)); }
      return;
    }
    // they are on another boat: pirates cross over the bridge; everyone else waits at the rail
    const S2 = C.ship;
    if (S2.bridge && C.on === S2.boat && P.boat && P.boat.id === S2.bridge.to && C.role !== 'captain') { this._startCross(C, true); return; }
    if (S2.bridge && C.on && C.on.id === S2.bridge.to && P.boat === S2.boat) { this._startCross(C, false); return; }
    // otherwise shuffle to the rail nearest them and shout
    if (C.on) { const L = C.on.toLocal(P.pos, V3()); const z = clamp(L.z, -C.on.hull.hl + 1, C.on.hull.hl - 1.2); C.dest = new THREE.Vector3(Math.sign(L.x) * (C.on.halfWidth(z) - 0.5), C.on.deck, z); this._crewWalk(C, dt, 2.2); }
    // a pirate on your deck with nobody to fight steals instead
  }
  /** A pirate ties a player up. If everyone near the galley is tied up at once, that is the end of it. */
  _bindPlayer(S, C, P) {
    const G = this.game;
    this.bound[P.id] = this.t + 9;
    this._say(C, pick(['Got one!', 'Truss them up!', 'Stay down, fisher.']));
    G._everyone({ t: 'bind', to: P.id, dur: 9 });
    const near = G.allPlayers().filter(Q => Q.pos.distanceTo(S.boat.pos) < 70);
    if (near.length && near.every(Q => (this.bound[Q.id] || 0) > this.t)) this.captureAll(S, near);
  }
  captureAll(S, players) {
    const G = this.game;
    for (const Q of players) { G._everyone({ t: 'captured', to: Q.id, why: 'bound' }); delete this.bound[Q.id]; }
    if (S.bridge) this.dropBridge(S, 'done');
    S.st = 'retreat'; S.engaged = false; S.hostile.clear();
    this.after(4, () => { if (this.list.has(S.id)) S.gone = true; });
  }
  onFreed(pid) { delete this.bound[pid]; }
  _crewMelee(C, P) {
    const G = this.game;
    if (!C.c || C.st === 'down' || C.bound) return;
    const here = this.crewPos(C);
    const d = P.pos.distanceTo(here);
    if (d > C.W.reach + 0.4) return;
    const dir = P.pos.clone().sub(here).setY(0).normalize();
    G.hurtPlayer(P, C.W.dmg, C.ship.kind === 'pirate' ? 'pirate' : 'crew');
    G.knockPlayer(P, dir, C.W.knock, 'crew');
    G._everyone({ t: 'ship', k: 'melee', p: here.toArray(), w: C.weapon });
  }
  _crewShoot(C, P, d) {
    const G = this.game;
    const o = this.crewPos(C).add(_v.set(0, 1.35, 0));
    // the further, the worse: a pistol is a pistol
    const acc = clamp(0.85 - d / 45, 0.2, 0.85) * (P.mode === 'swim' ? 0.5 : 1) * (C.W.spread ? 1.2 : 1);
    const hit = Math.random() < acc;
    const to = P.pos.clone().add(_w.set((Math.random() - 0.5) * (hit ? 0.2 : 2.5), 1.1 + (Math.random() - 0.5) * (hit ? 0.2 : 1.4), (Math.random() - 0.5) * (hit ? 0.2 : 2.5)));
    if (hit) { G.hurtPlayer(P, C.W.dmg * (C.W.spread ? clamp(1.4 - d / 10, 0.4, 1.2) : 1), 'shot'); if (C.W.spread && d < 6) G.knockPlayer(P, to.clone().sub(o).setY(0).normalize(), C.W.knock, 'shot'); }
    G._everyone({ t: 'ship', k: 'shot', o: o.toArray().map(n => +n.toFixed(2)), to: to.toArray().map(n => +n.toFixed(2)), w: C.weapon, hit });
  }
  _crewWalk(C, dt, speed) {
    const b = C.on;
    if (!b || !C.dest) return true;
    const dx = C.dest.x - C.local.x, dz = C.dest.z - C.local.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { C.speed = 0; C.pose = C.pose === 'fight' ? 'fight' : 'idle'; return true; }
    const s = Math.min(d, speed * dt);
    let nx = C.local.x + dx / d * s, nz = C.local.z + dz / d * s;
    const hw = b.halfWidth(nz) - 0.35;
    nx = clamp(nx, -hw, hw); nz = clamp(nz, -b.hull.hl + 0.6, b.hull.hl - 0.8);
    for (const o of b.obstacles) {
      const ox = nx - o.x, oz = nz - o.z;
      if (Math.abs(ox) < o.hw + 0.3 && Math.abs(oz) < o.hd + 0.3) {
        const px = o.hw + 0.3 - Math.abs(ox), pz = o.hd + 0.3 - Math.abs(oz);
        if (px < pz) nx = o.x + Math.sign(ox || 1) * (o.hw + 0.3); else nz = o.z + Math.sign(oz || 1) * (o.hd + 0.3);
      }
    }
    C.local.set(nx, b.deck, nz);
    C.yaw = Math.atan2(dx, dz);
    C.speed = speed;
    if (C.pose !== 'fight') C.pose = speed > 2 ? 'run' : 'walk';
    return false;
  }
  _face(C, p) {
    const here = this.crewPos(C);
    const yw = Math.atan2(p.x - here.x, p.z - here.z) - (C.on && C.st !== 'swim' ? C.on.heading : 0);
    C.yaw += wrapAngle(yw - C.yaw) * 0.25;
  }
  _crewRepair(C, b, dt) {
    const L = b.leaks[0];
    const side = Math.sign(L.x) || 1;
    C.dest = new THREE.Vector3(side * (b.halfWidth(L.z) - 0.55), b.deck, L.z);
    if (this._crewWalk(C, dt, 2)) {
      C.pose = 'reel';
      L.fix = (L.fix || 0) + dt / 9;
      if (C.bubbleT < -8) this._say(C, pick(['Patch it! Patch it!', 'Bail, you dogs!', 'Plug that hole!']));
      if (L.fix >= 1) b.patchHole(0);
      b.water = Math.max(0, b.water - dt * 0.004);
    }
  }
  _crewUntie(C, dt) {
    const M = C.job.m;
    if (!M.bound || M.on !== C.on) { C.job = null; if (M.untier === C) M.untier = null; return false; }
    C.dest = M.local.clone().add(_v.set(0.5, 0, 0.3));
    if (this._crewWalk(C, dt, 2.6)) {
      C.pose = 'reel';
      C.job.t = (C.job.t || 0) + dt;
      if (C.job.t > 3.2) { M.bound = false; M.st = 'fight'; M.hp = 40; M.untier = null; C.job = null; this._say(M, 'Right. Where were we?'); }
    }
    return true;
  }
  _startCross(C, toTarget) {
    const S = C.ship, E = this.bridgeEnds(S);
    if (!E) return;
    C.st = 'cross'; C.crossT = 0; C.crossDir = toTarget;
    C.crossFrom = (toTarget ? E.A : E.B).clone(); C.crossTo = (toTarget ? E.B : E.A).clone();
    C.pos.copy(C.crossFrom);
    this.game._everyone({ t: 'ship', k: 'cross', c: C.id });
  }
  _crewCross(C, dt) {
    const S = C.ship, E = this.bridgeEnds(S);
    if (!E) { C.st = 'swim'; C.on = null; return; }
    C.crossT += dt / 1.4;
    const from = C.crossDir ? E.A : E.B, to = C.crossDir ? E.B : E.A;
    C.pos.lerpVectors(from, to, Math.min(1, C.crossT));
    C.pos.y += Math.sin(Math.min(1, C.crossT) * Math.PI) * 0.15;
    C.yaw = Math.atan2(to.x - from.x, to.z - from.z);
    C.pose = 'run';
    if (C.crossT >= 1) {
      const nb = C.crossDir ? E.T : S.boat;
      C.on = nb; C.st = 'fight';
      C.local.copy(nb.toLocal(to, V3())).setY(nb.deck);
      const hw = nb.halfWidth(C.local.z) - 0.6; C.local.x = clamp(C.local.x, -hw, hw);
      C.yaw -= nb.heading;
      if (C.carry) this._dropCarry(C);
    }
  }
  _crewSwim(C, dt) {
    const G = this.game;
    // swim back to the ship and climb aboard; if it has gone, swim away and be gone
    const b = C.ship.boat;
    const d = Math.hypot(b.pos.x - C.pos.x, b.pos.z - C.pos.z);
    C.pos.y = G.world.sea(C.pos.x, C.pos.z) - 1.2;
    C.pose = 'swim';
    if (!this.list.has(C.ship.id) || b.sinking > 0 || d > 90) { C.pos.x += Math.sin(C.yaw) * dt; C.pos.z += Math.cos(C.yaw) * dt; C.t += dt; return; }
    const ax = b.pos.x - C.pos.x, az = b.pos.z - C.pos.z;
    C.yaw = Math.atan2(ax, az);
    const s = Math.min(1.6 * dt, Math.max(0, d - b.hull.hw));
    C.pos.x += ax / d * s; C.pos.z += az / d * s;
    C.swimT = (C.swimT || 0) + dt;
    if (d < b.hull.hw + 2.2 && C.swimT > 6) {
      C.on = b; C.st = 'fight'; C.swimT = 0; C.hp = Math.max(C.hp, 30);
      C.local.copy(b.toLocal(C.pos, V3())).setY(b.deck);
      const hw = b.halfWidth(C.local.z) - 0.6; C.local.x = clamp(C.local.x, -hw, hw); C.local.z = clamp(C.local.z, -b.hull.hl + 1, b.hull.hl - 1);
      G._everyone({ t: 'ship', k: 'climb', p: C.pos.toArray() });
    }
  }
  _dropCarry(C) {
    const G = this.game, it = G.loot.get(C.carry);
    C.carry = null;
    if (!it) return;
    it.crewCarry = null;
    G.loot.drop(it, this.crewPos(C).add(_v.set(0, 1.0, 0)), new THREE.Vector3(0, 1, 0));
    if (it.boat && this.list.has(C.ship.id) && it.boat === C.ship.boat) it.shipOf = C.ship.id;
  }

  /* ---------------- being hurt ---------------- */
  _crewHurt(C, dmg, from, knock, pid) {
    const G = this.game, S = C.ship;
    if (C.st === 'down' && !C.bound && dmg < 30) return;
    C.hp -= dmg;
    if (pid) { S.hostile.add(pid); S.alarm = Math.max(S.alarm, 1); this._callHelp(S); }
    const here = this.crewPos(C);
    G._everyone({ t: 'ship', k: 'hurt', c: C.id, p: here.toArray().map(n => +n.toFixed(2)) });
    // knocked back: near the rail, over it
    if (knock > 0 && C.on && C.st !== 'swim') {
      const L = C.local, dir = C.on.toLocal(here.clone().add(here.clone().sub(from).setY(0).normalize()), V3()).sub(L);
      const nx = L.x + dir.x * knock * 0.35, nz = L.z + dir.z * knock * 0.35;
      if (Math.abs(nx) > C.on.halfWidth(nz) - 0.2 && knock > 3.2) {
        C.pos.copy(C.on.toWorld(_v.set(Math.sign(nx) * (C.on.halfWidth(nz) + 1.2), C.on.deck, nz)));
        C.on = null; C.st = 'swim'; C.swimT = 0;
        if (C.carry) this._dropCarry(C);
        G._everyone({ t: 'ship', k: 'overboard', c: C.id, p: C.pos.toArray() });
        return;
      }
      const hw = C.on.halfWidth(nz) - 0.35;
      L.x = clamp(nx, -hw, hw); L.z = clamp(nz, -C.on.hull.hl + 0.6, C.on.hull.hl - 0.8);
    }
    if (C.hp <= 0 && C.st !== 'down') {
      C.st = 'down'; C.downT = 22; C.hp = 0;
      if (C.carry) this._dropCarry(C);
      this._say(C, pick(S.K.say.down || ['Ugh.']));
      // an armed man drops what he was holding
      if (C.W.drop && Math.random() < 0.7 && C.on) {
        const it = G.loot.spawn({ sp: C.W.drop + 'item', kg: 1, cm: 60, pos: here.clone().add(_v.set(0, 0.6, 0)), vel: new THREE.Vector3((Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2), flop: 0 });
        if (it) { it.shipOf = S.id; C.weapon = 'fists'; C.W = CREW_WEAPONS.fists; C.weaponMesh = null; this._hold(C, null); }
      }
    }
  }
  /** Shouting for help: the Guild escort comes if it goes on long enough, and nearby ships hear it. */
  _callHelp(S) {
    const G = this.game;
    if (S.K.pirate || S.calledHelp) return;
    S.calledHelp = true;
    for (const O of this.list.values()) if (O !== S && !O.K.pirate && O.boat.pos.distanceTo(S.boat.pos) < 250) { O.alarm = 1; for (const pid of S.hostile) O.hostile.add(pid); }
    // reinforcements, in a while
    this.after(42, () => {
      if (!this.list.has(S.id) || !S.hostile.size || S.K.escort) return;
      const spot = this._openWater(S.boat.pos.x, S.boat.pos.z, 260, 360);
      if (!spot) return;
      const E = this.spawn('guarded', spot.x, spot.z, Math.atan2(S.boat.pos.x - spot.x, S.boat.pos.z - spot.z));
      if (E) { for (const pid of S.hostile) E.hostile.add(pid); E.alarm = 1; E.st = 'respond'; E.wp = { x: S.boat.pos.x, z: S.boat.pos.z }; }
      G._everyone({ t: 'ship', k: 'escort', id: E?.id });
    });
  }

  /* ================= what players do to them (host) ================= */
  crewById(id) { for (const S of this.list.values()) for (const C of S.crew) if (C.id === id) return C; return null; }
  /** A hit from a player's weapon: on a crewman, on a hull, or on a bridge. */
  hostStrike(c, from) {
    const G = this.game, P = G.playerById(from) || G.player;
    const T = TOOL_BY_ID[c.w];
    const dmg = (T?.dmg || 10) * (c.mult || 1);
    const at = c.at ? new THREE.Vector3().fromArray(c.at) : P.pos;
    if (c.crew) { const C = this.crewById(c.crew); if (C) this._crewHurt(C, dmg, P.pos, T?.knock ?? 3, from); }
    if (c.ship) {
      const S = this.list.get(c.ship);
      if (S) { S.boat.damage(dmg * (T?.hull || 0.5), 'shot'); S.hostile.add(from); S.alarm = 1; this._callHelp(S); if (c.w === 'blunder' && Math.random() < 0.25) S.boat.addHole(0.5); if (S.dress && Math.random() < 0.3) S.sailRip = Math.min(1, (S.sailRip || 0) + 0.15); }
      // a crate hit hard enough breaks open
      if (S) for (const cg of S.cargo) if (!cg.open && S.boat.toWorld(_v.set(cg.x, S.boat.deck + 0.4, cg.z)).distanceTo(at) < 0.9 && (c.w === 'blunder' || dmg > 20)) this.openCargo(S, cg, from, true);
    }
    if (c.bridge) { const S = this.list.get(c.bridge); if (S) this.hitBridge(S, dmg * 0.8, from); }
    // no matter what was hit: a shot at them is a shot at them
    if ((c.crew || c.ship) && !c.ship) { const C = this.crewById(c.crew); if (C) C.ship.hostile.add(from); }
  }
  /** Break open a crate / barrel / chest on their deck. */
  openCargo(S, cg, from, violent = false) {
    const G = this.game;
    if (!cg || cg.open) return;
    cg.open = true;
    const n = cg.kind === 'chest' ? 3 : 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) {
      const w = S.K.loot, tot = w.reduce((a, x) => a + x[1], 0);
      let r = Math.random() * tot, what = w[0][0];
      for (const [id, wt] of w) { r -= wt; if (r <= 0) { what = id; break; } }
      if (cg.kind === 'chest' && k === 0) what = S.K.loot.some(x => x[0] === 'chest') ? 'coins' : what;
      this._spawnLoot(S, what, new THREE.Vector3(cg.x, S.boat.deck, cg.z), true);
    }
    const o = S.boat.obstacles.findIndex(o => o.cargo && o.x === cg.x && o.z === cg.z);
    if (o >= 0) S.boat.obstacles.splice(o, 1);
    G._everyone({ t: 'ship', k: 'open', id: S.id, i: cg.i });
    this.noticeTheft(S, from, S.boat.toWorld(_v.set(cg.x, S.boat.deck, cg.z)).clone(), violent);
  }
  /** Somebody took something of theirs. Did anyone see? */
  noticeTheft(S, pid, at, loud = false) {
    const G = this.game;
    if (S.K.derelict || S.hostile.has(pid)) return;
    const seer = S.crew.find(C => C.st !== 'down' && !C.bound && C.st !== 'swim' && this.crewPos(C).distanceTo(at) < (loud ? 30 : 16));
    if (!seer) return;
    S.hostile.add(pid); S.alarm = 1;
    this._say(seer, pick(S.K.say.angry || ['Thief!']));
    this._callHelp(S);
  }
  /** A player picked up something that was theirs. */
  onPickup(it, P) {
    const S = it.shipOf && this.list.get(it.shipOf);
    if (S) this.noticeTheft(S, P.id, it.pos.clone());
  }
  /** E on a crewman who is down: tie them up; on one tied up: over the side. */
  hostTie(c, from) {
    const C = this.crewById(c.id);
    if (!C) return;
    if (c.k === 'tie' && C.st === 'down') { C.bound = true; C.st = 'bound'; C.ship.hostile.add(from); this._say(C, pick(['Untie me!', 'You will hang for this!', 'Mmmf!'])); }
    else if (c.k === 'throw' && (C.bound || C.st === 'down') && C.on) {
      const here = this.crewPos(C), b = C.on, L = C.local;
      const side = Math.sign(L.x) || 1;
      C.pos.copy(b.toWorld(_v.set(side * (b.halfWidth(L.z) + 1.4), b.deck, L.z)));
      C.on = null; C.st = 'swim'; C.bound = false; C.swimT = -8; C.hp = 30;
      this.game._everyone({ t: 'ship', k: 'overboard', c: C.id, p: C.pos.toArray() });
    }
  }
  /** Pirates on your deck with nobody to fight: they take what they can carry back. */
  _steal(S, C, dt) {
    const G = this.game;
    if (C.carry) {
      const E = this.bridgeEnds(S);
      if (!E) { this._dropCarry(C); return; }
      C.dest = C.on.toLocal(E.B, V3()).setY(C.on.deck);
      if (this._crewWalk(C, dt, 2.6)) this._startCross(C, false);
      return;
    }
    const it = [...G.loot.items.values()].filter(x => x.boat === C.on && !x.held && !x.crewCarry && x.state !== 'bag').sort((a, b) => G.loot.value(b) - G.loot.value(a))[0];
    if (!it) return;
    if (it.state === 'cooler') G.loot.fromCooler(it, C.on.toWorld(_v.copy(C.local).setY(C.on.deck + 0.6)));
    C.dest = C.on.toLocal(it.pos, V3()).setY(C.on.deck);
    if (this._crewWalk(C, dt, 2.8)) { it.crewCarry = C.id; C.carry = it.id; this._say(C, pick(['Ooh, that is a nice one.', 'Mine now!', 'Thank you kindly!'])); }
  }

  /* ================= how they look (everyone) ================= */
  _crewPose(S, dt) {
    const G = this.game;
    for (const C of S.crew) {
      const c = C.c;
      if (!c) continue;
      const p = this.crewPos(C);
      c.root.position.copy(p);
      c.root.rotation.y = C.yaw + (C.on && C.st !== 'swim' && C.st !== 'cross' ? C.on.heading : 0);
      let state = 'idle', sp = 0;
      if (C.st === 'down' || C.bound) { c.fallT = 1.0; state = 'idle'; }
      else if (C.st === 'swim') state = 'swim';
      else { state = { walk: 'walk', run: 'run', talk: 'talk', fish: 'fish', drive: 'drive', reel: 'reel', fight: 'idle' }[C.pose] || 'idle'; sp = C.speed; }
      // the rod comes out to fish, the weapon to fight
      if (C.pose === 'fish' && C.rodMesh) this._hold(C, C.rodMesh); else if (C.pose !== 'fish') this._hold(C, C.weaponMesh);
      c.update(dt, state, sp);
      // fighting stances drawn over the top
      const [aL, aR] = c.arms;
      if (C.bound) { aL.rotation.x = 0.5; aR.rotation.x = 0.5; aL.rotation.z = 0.5; aR.rotation.z = -0.5; }
      else if (C.st !== 'down' && C.pose === 'fight') {
        if (C.W.ranged) { aR.rotation.x = -1.45 * Math.max(0.35, C.aim); aR.userData.elbow.rotation.x = -0.1; if (C.weapon === 'blunder') { aL.rotation.x = -1.2; aL.rotation.z = 0.4; } }
        else { const s = C.act > 0 ? Math.sin((1 - C.act / 0.45) * Math.PI) : 0; aR.rotation.x = -1.2 - s * 1.4; aR.rotation.z = 0.2 - s * 0.6; }
      }
      if (C.carry) { aL.rotation.x = -1.2; aR.rotation.x = -1.2; const it = G.loot.get(C.carry); if (it) { it.pos.copy(p).add(_v.set(Math.sin(c.root.rotation.y) * 0.5, 1.1, Math.cos(c.root.rotation.y) * 0.5)); it.mesh.position.copy(it.pos); it.mesh.visible = true; } }
      // speech
      if (C.bubble) {
        C.bubble.position.copy(p).add(_v.set(0, 2.45, 0));
        if (C.bubbleT <= 0) { this.group.remove(C.bubble); C.bubble.material.map.dispose(); C.bubble = null; }
      }
      c.root.visible = p.distanceTo(G.player.pos) < 350;
    }
    // ragged sails on a battered galley
    if (S.dress && S.boat.parts.sails) for (const s of S.boat.parts.sails) s.scale.y = 1 - (S.sailRip || 0) * 0.45;
  }
  _say(C, text, col) {
    if (!C || !text) return;
    C.bubbleT = 3.2;
    C.sayText = text;
    if (this.game.isHost) this.game._everyone({ t: 'ship', k: 'say', c: C.id, text });
  }
  _showSay(C, text) {
    if (C.bubble) { this.group.remove(C.bubble); C.bubble.material.map.dispose(); }
    C.bubble = bubble(text, C.ship.K.pirate ? '#ffcf8a' : '#ffffff');
    C.bubbleT = 3.2;
    this.group.add(C.bubble);
  }

  /* ================= events (everyone) ================= */
  onEvent(e) {
    const G = this.game, A = G.audio;
    const P3 = a => new THREE.Vector3().fromArray(a);
    switch (e.k) {
      case 'say': { const C = this.crewById(e.c); if (C) this._showSay(C, e.text); break; }
      case 'shot': {
        const o = P3(e.o), to = P3(e.to);
        G.fx.sparks(o.x, o.y, o.z, 6, 0xffd070); G.fx.smoke(o.x, o.y, o.z, 0xb8b0a0);
        this._tracer(o, to);
        A.noise?.(0.12, 0.35 * this._vol(o), 'lowpass', 1400, 1, 0.3); A.tone?.(90, 0.12, 'square', 0.08 * this._vol(o), 0.002, 0.5);
        if (!e.hit) G.fx.splash?.(to.x, G.world.sea(to.x, to.z), to.z, 0.2);
        break;
      }
      case 'melee': A.thunk?.(P3(e.p)); break;
      case 'hurt': { const p = P3(e.p); G.fx.sparks(p.x, p.y + 1.3, p.z, 5, 0xfff0c0); A.tone?.(260 + Math.random() * 60, 0.1, 'triangle', 0.08 * this._vol(p)); const C = this.crewById(e.c); if (C && C.c && Math.random() < 0.5) C.c.knock(); break; }
      case 'overboard': { const p = P3(e.p); G.fx.splash(p.x, G.world.sea(p.x, p.z), p.z, 1.3); A.splash(1, p); break; }
      case 'climb': { const p = P3(e.p); G.fx.splash(p.x, p.y, p.z, 0.6); break; }
      case 'cannon': this.onCannon(e); break;
      case 'splash': { const p = P3(e.p); G.fx.splash(p.x, G.world.sea(p.x, p.z), p.z, 2.4); A.splash(1.6, p); break; }
      case 'hit': { const p = P3(e.p); G.fx.explosion?.(p.x, p.y, p.z, 0.8); G.fx.chips?.(p.x, p.y, p.z, 0x8a6a4a, 18, 0, 0); A.crash?.(); if (G.player.boat && G.player.boat.id === e.b) G.addShake?.(0.6); break; }
      case 'thud': { A.crash?.(); break; }
      case 'bridge': {
        A.crash?.(); A.chain?.();
        if (G.player.boat && G.player.boat.id === e.to) G.ui.banner('BOARDERS!', 'A spiked bridge just bit into your rail. Knock them into the sea - or kick the bridge off (E at the bridge).', 'skull', 3.5);
        break;
      }
      case 'unbridge': { A.splash?.(1.4); if (G.player.boat && G.player.boat.id === e.to) G.ui.toast(e.why === 'kicked' ? 'The bridge splinters and drops into the sea!' : 'They cut the bridge loose!', 'good'); break; }
      case 'bridgeHit': A.thunk?.(); break;
      case 'open': { A.crack?.(); break; }
      case 'pirates': {
        const near = e.d < 400;
        G.ui.banner(e.sudden ? 'PIRATES!' : 'BLACK SAILS', e.sudden ? 'A pirate galley came out of nowhere - right on top of you!' : 'A pirate galley on the horizon, and it has seen you. Run, or get ready.', 'skull', 4);
        A.horn?.(); A.eventSting?.();
        G.ui.radio?.(near ? 'Radio: ...MAYDAY, pirates, they are right on - (static)' : 'Radio: All boats, all boats: black sails sighted. Make for harbour.');
        break;
      }
      case 'retreat': G.ui.toast('The pirates are running!', 'good'); break;
      case 'escort': if (e.id) G.ui.toast('A Guild escort is coming to see what the shouting is about.', 'warn'); break;
    }
  }
  _vol(p) { return clamp(1 - this.game.player.pos.distanceTo(p) / 160, 0, 1); }
  _tracer(o, to) {
    const g = new THREE.BufferGeometry().setFromPoints([o, to]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.8 }));
    this.group.add(l);
    let t = 0;
    const fade = () => { t += 0.05; l.material.opacity = 0.8 * (1 - t / 0.2); if (t < 0.2) requestAnimationFrame(fade); else { this.group.remove(l); g.dispose(); } };
    requestAnimationFrame(fade);
  }

  /* ================= queries for the game ================= */
  /** Is any pirate ship in a fight with this player (for the capture). */
  pirateEngaged(P, id = P.id) {
    for (const S of this.list.values()) if (S.K.pirate && S.st !== 'retreat' && S.hostile.has(id) && S.boat.pos.distanceTo(P.pos) < 160) return S;
    return null;
  }
  /** The crewman under a ray from the camera (for players' weapons), within `range`. */
  rayCrew(o, d, range) {
    let best = null, bt = range;
    for (const S of this.list.values()) for (const C of S.crew) {
      const p = this.crewPos(C);
      for (const h of [0.5, 1.1, 1.6]) {
        const c = _a.copy(p).setY(p.y + (C.st === 'down' || C.bound ? 0.3 : h));
        const t = _b.copy(c).sub(o).dot(d);
        if (t < 0 || t > bt) continue;
        const q = o.clone().addScaledVector(d, t);
        if (q.distanceTo(c) < 0.42) { bt = t; best = { C, t }; }
      }
    }
    return best;
  }
  /** A ship's hull under a ray, if nearer than `range`. */
  rayShip(o, d, range) {
    let best = null;
    for (const S of this.list.values()) {
      const b = S.boat;
      for (let t = 0.5; t < range; t += 0.5) {
        const p = _a.copy(o).addScaledVector(d, t);
        const L = b.toLocal(p, _b);
        if (b.over(L.x, L.z, -0.3) && L.y < b.deck + 1.2 && L.y > -1) { if (!best || t < best.t) best = { S, t, p: p.clone() }; break; }
      }
    }
    return best;
  }
  /** Crew near a point (for melee). */
  crewNear(p, r) {
    const out = [];
    for (const S of this.list.values()) for (const C of S.crew) { const q = this.crewPos(C); if (q.distanceTo(p) < r) out.push({ C, d: q.distanceTo(p), q }); }
    return out.sort((a, b) => a.d - b.d);
  }
  /** Cargo on a deck near a player (for the E prompt). */
  cargoNear(P, r = 1.6) {
    if (!P.boat) return null;
    const S = [...this.list.values()].find(x => x.boat === P.boat);
    if (!S) return null;
    let best = null, bd = r;
    for (const cg of S.cargo) { if (cg.open) continue; const d = Math.hypot(P.local.x - cg.x, P.local.z - cg.z); if (d < bd) { bd = d; best = cg; } }
    return best ? { S, cg: best } : null;
  }
  shipOfBoat(b) { for (const S of this.list.values()) if (S.boat === b) return S; return null; }

  /* ================= sync ================= */
  snapshot() {
    const out = [];
    for (const S of this.list.values()) {
      out.push({
        id: S.id, k: S.kind, b: S.boat.snapshot(), br: S.bridge ? [S.bridge.to, Math.round(S.bridge.hp)] : 0, st: S.st, rip: +(S.sailRip || 0).toFixed(2), h: [...S.hostile],
        cg: S.cargo.map(c => c.open ? 1 : 0).join(''),
        c: S.crew.map(C => { const p = this.crewPos(C); return [C.st, C.on ? C.on.id : 0, +C.local.x.toFixed(2), +C.local.z.toFixed(2), +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +C.yaw.toFixed(2), C.pose || '', +C.aim.toFixed(2), +C.act.toFixed(2), C.bound ? 1 : 0, C.weapon, C.carry || 0]; }),
      });
    }
    return out;
  }
  applySnapshot(arr, dt) {
    const G = this.game, seen = new Set();
    for (const o of arr || []) {
      seen.add(o.id);
      let S = this.list.get(o.id);
      if (!S) {
        S = this.spawn(o.k, o.b.x, o.b.z, o.b.h, { id: o.id, bare: true });
        if (!S) continue;
        // the crew, as the host has them
        S.K.crew.forEach(([role, weapon], i) => {
          const looks = CREW_LOOKS[S.kind === 'pirate' && role === 'captain' ? 'pirateCaptain' : role] || CREW_LOOKS.deckhand;
          const C = { id: S.id + 'c' + i, ship: S, role, weapon, W: CREW_WEAPONS[weapon], look: { ...looks[i % looks.length] }, hp: HP, st: 'idle', on: S.boat, local: V3(), pos: V3(), yaw: 0, aim: 0, act: 0, bubbleT: 0 };
          this._crewBody(C); S.crew.push(C);
        });
        // the cargo, where the host says it is: rebuilt from the deck points on the host's next open events
        for (let i = 0; i < (S.K.crates || 0); i++) { const cg = { i, kind: i === 0 && S.K.loot.some(l => l[0] === 'chest') ? 'chest' : i % 3 === 1 ? 'barrel' : 'crate', x: 0, z: 0, open: false }; S.cargo.push(cg); }
      }
      S.boat.applySnapshot(o.b, dt);
      S.st = o.st; S.sailRip = o.rip; S.hostile = new Set(o.h || []);
      S.bridge = o.br ? { to: o.br[0], hp: o.br[1] } : null;
      o.c.forEach((a, i) => {
        const C = S.crew[i]; if (!C) return;
        C.st = a[0]; C.on = a[1] ? G.boatById(a[1]) : null;
        C.local.set(a[2], C.on ? C.on.deck : 0, a[3]);
        C.pos.set(a[4], a[5], a[6]); C.yaw = a[7]; C.pose = a[8]; C.aim = a[9]; C.act = a[10]; C.bound = !!a[11];
        if (C.weapon !== a[12]) { C.weapon = a[12]; C.W = CREW_WEAPONS[a[12]] || CREW_WEAPONS.fists; C.weaponMesh = a[12] !== 'fists' && TOOL_BY_ID[a[12]] ? toolMesh(a[12]) : null; if (C.weaponMesh) C.weaponMesh.rotation.x = Math.PI / 2; }
        C.carry = a[13] || null;
      });
    }
    for (const S of [...this.list.values()]) if (!seen.has(S.id)) this._remove(S);
  }
}
