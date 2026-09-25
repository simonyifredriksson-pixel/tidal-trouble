/* Fishing.js - the rod in your hands.

   idle -> charge (hold LMB) -> fly (the bobber is a projectile) -> wait
        -> nibble ... -> bite (strike window) -> fight -> land
   Reeling with nothing on it is `reelin`.

   THE FIGHT, and why it always ends:
     tension  rises with how hard the fish pulls and whether you reel, and
              falls when you pull the rod AGAINST its run (A/D)
     stamina  drains ONLY while tension is in the working zone (0.25-0.95).
              Idling banks nothing; slack lets it spit the hook; too much
              tension for too long snaps the line.
     line     the fish takes line when it runs; run out and it snaps
   and a hard cap: after FIGHT_MAX seconds the line parts regardless. An
   earlier game hung forever on a fish whose drain matched the player's
   fill; the tiring clock only ticking in the zone is the fix.

   Big fish TOW the boat you are standing in, and on the shore they drag
   you toward the water. A giant on a rod too weak for it can pull the rod
   clean out of your hands. */

import * as THREE from '../../lib/three.module.js?v=1790358905';
import { FISH_BY_ID, FISH, rollSize, RARITY, ZMIN, rollVariant, zoneSizeBoost, zoneValue, fightOf, VARIANT_BY_ID } from '../data/FishData.js?v=1790358905';
import { zoneAt } from '../world/MapData.js?v=1790358905';
import { ROD_BY_ID, BAIT_BY_ID, RODS } from '../data/GearData.js?v=1790358905';
import { buildBobber } from '../art/RodArt.js?v=1790358905';
import { fishMesh } from '../art/FishArt.js?v=1790358905';
import { clamp, damp, lerp, rng, weighted } from '../core/Util.js?v=1790358905';
import { Bus } from '../core/Bus.js?v=1790358905';

export const FIGHT_MAX = 90;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

/* ---------------- species selection (shared with holders and traps) ---------------- */
export function pickSpecies(ctx, r = Math.random) {
  const list = [];
  for (const f of FISH) {
    if (f.where === 'meteor') { if (!ctx.meteor) continue; }
    else if (f.where === 'mystery') { if (!ctx.mystery) continue; }
    else if (f.where === 'site') { if (ctx.site !== f.site) continue; }
    else if (f.where !== 'all' && !f.where.includes(ctx.region)) continue;
    if (f.zoneOnly !== undefined && (ctx.zone || 0) !== f.zoneOnly) continue;
    if (f.hotspot && ctx.hotspot !== f.hotspot) continue;
    if (f.weather === 'storm' && !ctx.storm) continue;
    if (f.water === 'lake' && ctx.water !== 'lake') continue;
    if (f.water === 'sea' && ctx.water !== 'sea') continue;
    if (f.water === 'ice' && ctx.water !== 'ice') continue;
    let aff = f.bait[ctx.bait];
    if (aff === undefined) aff = 0.35;
    if (aff <= 0) continue;
    let tm = 1;
    if (f.time === 'night') tm = ctx.night ? 1 : 0;
    else if (f.time === 'day') tm = ctx.night ? 0.1 : 1;
    else if (f.time === 'dusk') tm = ctx.dusk ? 1.4 : 0.05;
    if (tm <= 0) continue;
    let w = f.rarity === 'junk' ? 4 : RARITY[f.rarity].w;
    if (ctx.lucky) { if (f.rarity === 'epic' || f.rarity === 'legendary') w *= 2.2; else if (f.rarity === 'rare') w *= 1.5; }
    if (ctx.deep && (f.rarity === 'rare' || f.rarity === 'epic')) w *= 1.4;
    if (ctx.migration && f.rarity === 'common') w *= 3;
    if (ctx.whirl && f.rarity !== 'common') w *= 1.8;
    if (ctx.meteor && f.id === 'starfish') w *= 30;
    if (f.id === 'bombfish' && ctx.bait === 'explosive') w *= 4;
    // the sea tells you where to fish: hotspots, storms, a marked X
    if (ctx.mystery && f.id === 'strongbox') w *= 400;
    if (f.hotspot && ctx.hotspot === f.hotspot) w *= 30;
    if (ctx.hotspot && !f.hotspot && ['rare', 'epic', 'legendary'].includes(f.rarity)) w *= 2.2;
    if (ctx.hotspot === 'debris' && f.junk && f.junk !== 'chest') w *= 6;
    if (ctx.storm && f.weather === 'storm') w *= 8;
    // a hidden place has its own fish, and the grotto keeps most of the others out
    if (ctx.site && f.site === ctx.site) w *= 12;
    else if (ctx.site === 'grotto' && !f.junk) w *= 0.3;
    if (ctx.storm && !f.weather && (f.rarity === 'rare' || f.rarity === 'epic')) w *= 1.4;
    // the farther out, the crazier it gets
    const z = ctx.zone || 0, zm = ZMIN[f.id] ?? 0;
    if (z < zm) w *= 0.03;
    else w *= 1 + (z - zm) * 0.12;
    const rs = { common: 1 - 0.14 * z, uncommon: 1 + 0.3 * z, rare: 1 + 0.65 * z, epic: 1 + 1.1 * z, legendary: 1 + 1.5 * z, junk: 1 - 0.1 * z }[f.rarity] ?? 1;
    w *= Math.max(0.25, rs);
    list.push({ f, w: w * aff * tm });
  }
  const pick = weighted(list, r);
  return pick ? pick.f : FISH_BY_ID.boot;
}

export function rollCatch(sp, r = Math.random, luck = 0, zone = 0) {
  const s = rollSize(r, luck + zone * 0.3);
  const v = sp.junk || sp.lev ? null : rollVariant(zone, r);
  const V = v ? VARIANT_BY_ID[v] : null;
  // deep water grows them bigger than the book says
  const grow = (1 + zoneSizeBoost(zone) * s) * (V ? V.size : 1);
  const kg = (sp.kg[0] + (sp.kg[1] - sp.kg[0]) * s) * grow;
  const cm = (sp.cm[0] + (sp.cm[1] - sp.cm[0]) * Math.sqrt(s)) * Math.cbrt(grow);
  return { sp: sp.id, kg, cm, size: s, zone, v, mult: zoneValue(zone) * (V ? V.mult : 1) };
}

export class Fishing {
  constructor(game, player) {
    this.game = game;
    this.player = player;
    this.state = 'idle';
    this.charge = 0;
    this.bobber = buildBobber();
    this.bobber.visible = false;
    game.scene.add(this.bobber);
    this.bpos = new THREE.Vector3();
    this.bvel = new THREE.Vector3();
    this.tip = new THREE.Vector3();
    const N = 26;
    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: 0xe8e8e0, transparent: true, opacity: 0.85 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    game.scene.add(this.line);
    this.N = N;
    this.timer = 0; this.nibbles = 0;
    this.fish = null;
    this.tension = 0; this.side = 0; this.crank = 0; this.overT = 0; this.slackT = 0;
    this.fightT = 0;
    this.jumpMesh = null; this.jump = null;
    this.water = 'sea';
    this.msgT = 0;
  }

  get rod() { return ROD_BY_ID[this.game.state.s.rod] || ROD_BY_ID.basic; }
  get active() { return this.state !== 'idle'; }

  cancel(silent = false) {
    if (this.state === 'fight' && !silent) this._lose('You let it go.');
    this.state = 'idle';
    this.bobber.visible = false; this.line.visible = false;
    this.fish = null;
    this._endJump();
  }

  _ctx() {
    const G = this.game;
    const p = this.bpos;
    const region = G.world.region(p.x, p.z);
    const tod = G.tod;
    const ev = G.events;
    return {
      region, water: this.water, bait: G.state.s.bait, night: tod < 0.22 || tod > 0.8, dusk: Math.abs(tod - 0.76) < 0.06 || Math.abs(tod - 0.24) < 0.05,
      lucky: G.state.has('lucky'), deep: G.world.height(p.x, p.z) < -20,
      migration: ev.near('migration', p, 90), whirl: ev.near('whirlpool', p, 80), meteor: ev.near('meteor', p, 30),
      zone: this.zoneHere(),
      storm: ev.storm > 0.45 || (G.beasts?.stormy?.() ?? false),
      hotspot: G.ocean?.hotspotAt(p)?.kind || null,
      mystery: !!G.ocean?.mysteryAt(p),
      site: G.world.secrets?.siteAt(p)?.id || null,
    };
  }

  zoneHere() { const p = this.bpos; return zoneAt(p.x, p.z, -this.game.world.height(p.x, p.z)); }

  _biteTime() {
    const G = this.game;
    const bait = BAIT_BY_ID[G.state.s.bait] || BAIT_BY_ID.worm;
    let t = (6 + Math.random() * 10) / bait.bite;
    const ev = G.events;
    if (ev.near('migration', this.bpos, 90)) t /= 4;
    if (ev.near('whirlpool', this.bpos, 80)) t /= 2;
    if (ev.near('meteor', this.bpos, 30)) t /= 2;
    if (G.state.s.bait === 'glow' && (G.tod < 0.22 || G.tod > 0.8)) t /= 1.3;
    if (G.ocean?.hotspotAt(this.bpos)) t /= 2.2;
    return t;
  }

  msg(s, kind = 'info') { this.game.ui.toast(s, kind); }

  update(dt, input, blocked, useHeld) {
    const G = this.game, P = this.player;
    const rod = this.rod;
    const cam = G.camera;
    G.vm.tipWorld(cam, this.tip);
    const lmb = !blocked && input.btn(0);
    const click = !blocked && input.click(0);
    const unclick = input.unclick(0);
    const hasBait = (G.state.s.baits[G.state.s.bait] || 0) > 0;
    const sea = s => G.world.waterAt(s.x, s.z);

    switch (this.state) {
      case 'idle': {
        // playtest AFK mode: cast by itself every few seconds
        let auto = false;
        if (G.admin?.autoCast && useHeld && hasBait) { this.autoT = (this.autoT || 0) + dt; if (this.autoT > 2.5) { this.autoT = 0; auto = true; } }
        if (auto) { this.charge = 0.8; this.state = 'charge'; this._autoRelease = true; break; }
        if (click && useHeld) {
          if (!hasBait) { this.msg('Out of ' + (BAIT_BY_ID[G.state.s.bait]?.name || 'bait') + '. Press B to pick another.', 'warn'); break; }
          // ice fishing: drop straight into a hole
          if (G.world.onIce(P.pos.x, P.pos.z) && !P.boat) {
            const hole = G.tools.nearestHole(P.pos, 3.5);
            if (!hole) { this.msg('The lake is frozen. Drill a hole with the Ice Auger.', 'warn'); break; }
            this.bpos.set(hole.x, 0.05, hole.z);
            this.water = 'ice';
            this._startWait();
            G.audio.splash(0.3);
            break;
          }
          this.state = 'charge'; this.charge = 0;
        }
        break;
      }
      case 'charge': {
        this.charge = Math.min(1, this.charge + dt / 1.1);
        if (unclick || !lmb || this._autoRelease) {
          this._autoRelease = false;
          const f = P.forward(_v).clone();
          const sp = rod.cast * (0.3 + 0.7 * this.charge);
          this.bpos.copy(this.tip);
          this.bvel.copy(f).multiplyScalar(sp);
          this.bvel.y += 3 + this.charge * 2;
          if (P.boat) { this.bvel.x += P.boat.vel.x; this.bvel.z += P.boat.vel.y; }
          this.state = 'fly';
          G.vm.play('cast');
          G.audio.cast(this.charge);
          this.bobber.visible = true; this.line.visible = true;
        }
        break;
      }
      case 'fly': {
        this.bvel.y -= 9.8 * dt;
        this.bvel.multiplyScalar(Math.exp(-0.15 * dt));
        this.bpos.addScaledVector(this.bvel, dt);
        const d = this.bpos.distanceTo(this.tip);
        if (d > rod.line) { this.bvel.multiplyScalar(0.3); }
        const s = sea(this.bpos);
        const g = G.world.ground(this.bpos.x, this.bpos.z);
        const b = G.boatAt(this.bpos, 0.1);
        if (b) { const L = b.toLocal(this.bpos, _w); if (L.y < b.deck + 0.3) { this.state = 'reelin'; this.msg('You cast into the boat.', 'warn'); break; } }
        if (s > -Infinity && this.bpos.y <= s) {
          this.bpos.y = s;
          this.water = G.world.onIce(this.bpos.x, this.bpos.z) ? 'ice' : G.isLake(this.bpos.x, this.bpos.z) ? 'lake' : 'sea';
          if (this.water === 'ice') { this.state = 'reelin'; break; }
          G.fx.splash(this.bpos.x, s, this.bpos.z, 0.5);
          G.audio.plop(this.bpos);
          this._startWait();
          if (G.state.s.bait === 'explosive') this.boomT = 3;
        } else if (this.bpos.y <= g) {
          this.bpos.y = g;
          this.state = 'reelin';
          this.msg('Snagged on dry land.', 'warn');
        }
        break;
      }
      case 'wait':
      case 'nibble': {
        const s = this.water === 'ice' ? 0.05 : sea(this.bpos);
        this.bpos.y = s + (this.state === 'nibble' ? -0.07 : 0) + Math.sin(G.world.time * 2.3) * 0.015;
        // drift toward you gently, as a real line does
        if (lmb && this.water !== 'ice') {
          // reeling in an empty line (a fish may still take it)
          const to = _w.copy(this.tip).sub(this.bpos); to.y = 0;
          const L = to.length();
          if (L < 2) { this.state = 'reelin'; break; }
          this.bpos.addScaledVector(to.normalize(), rod.reel * 0.8 * dt);
          this.crank += dt * 14;
          G.audio.reel(0.3);
          if (Math.random() < dt * 0.05) this.timer = 0.01;
        }
        if (this.boomT > 0) {
          this.boomT -= dt;
          if (this.boomT <= 0) { G.explode(this.bpos.clone(), 'water', null, 'bait'); G.state.useBait('explosive'); this.state = 'reelin'; break; }
        }
        this.timer -= dt;
        if (this.state === 'nibble') { this.nibT -= dt; if (this.nibT <= 0) this.state = 'wait'; if (click) { this._spook(); break; } }
        else if (this.nibbles > 0 && this.timer < this.nibbles * 1.3) {
          this.nibbles--; this.state = 'nibble'; this.nibT = 0.35;
          G.fx.ripple(this.bpos.x, s, this.bpos.z, 0.8, 0.8); G.audio.nibble(this.bpos);
        }
        if (this.timer <= 0 && this.state === 'wait') this._bite();
        // line too long (you walked away)
        if (this.bpos.distanceTo(this.tip) > rod.line + 2) { this.state = 'reelin'; }
        break;
      }
      case 'bite': {
        this.biteT -= dt;
        const s = this.water === 'ice' ? 0.05 : sea(this.bpos);
        this.bpos.y = s - 0.35;
        if (Math.random() < dt * 20) G.fx.splash(this.bpos.x, s, this.bpos.z, 0.25);
        if (click || G.admin?.autoCatch) { this._hook(); break; }
        if (this.biteT <= 0) {
          if (Math.random() < 0.5) { G.state.useBait(G.state.s.bait); this.msg('Too slow - it took the bait.', 'warn'); }
          else this.msg('Too slow - it got away.', 'warn');
          this._startWait();
        }
        break;
      }
      case 'fight': this._fight(dt, input, blocked, lmb); break;
      case 'reelin': {
        const to = _w.copy(this.tip).sub(this.bpos);
        const L = to.length();
        const s = sea(this.bpos);
        this.bpos.addScaledVector(to.normalize(), Math.min(L, (rod.reel * 2.5 + 4) * dt));
        if (s > -Infinity && this.bpos.y < s) this.bpos.y = s;
        this.crank += dt * 20;
        if (L < 1.2) this.cancel(true);
        break;
      }
    }
    this._draw(dt);
  }

  _startWait() {
    this.state = 'wait';
    this.timer = this._biteTime();
    this.nibbles = Math.floor(Math.random() * 3.2);
    this.bobber.visible = true; this.line.visible = true;
    this.game.creatures?.lureAt(this.bpos, this);
  }

  _spook() {
    this.msg('Too early - you spooked it.', 'warn');
    this.timer = this._biteTime() + 4;
    this.state = 'wait';
  }

  _bite() {
    const G = this.game;
    // giants and leviathans get first refusal of a line near them
    // then the monsters at the top of the food chain, who mostly say no
    const mon = G.great?.claim(this.bpos) || G.beasts?.claim(this.bpos);
    if (mon && mon.refused) {
      G.state.useBait(G.state.s.bait);
      this.msg(mon.text, 'warn');
      if (!mon.quiet) { G.fx.eruption(this.bpos.x, G.world.sea(this.bpos.x, this.bpos.z), this.bpos.z, 3); G.audio.roar(0.4); }
      else G.fx.ripple(this.bpos.x, G.world.sea(this.bpos.x, this.bpos.z), this.bpos.z, 6, 2);
      this._startWait();
      return;
    }
    const big = mon || G.creatures?.claimBite(this.bpos, this);
    if (big) { this.pending = big; }
    else {
      const sp = pickSpecies(this._ctx());
      const c = rollCatch(sp, Math.random, G.state.has('lucky') ? 1 : 0, this.zoneHere());
      this.pending = c;
      if (sp.beh === 'thief' && Math.random() < 0.5) {
        // the thief takes the bait and runs
        G.state.useBait(G.state.s.bait);
        G.creatures?.thiefRun(this.bpos.clone(), G.state.s.bait);
        this.msg('Something stole your bait and swam off with it!', 'bad');
        G.audio.splash(0.4);
        this.state = 'reelin';
        Bus.emit('fish:stolen', {});
        return;
      }
    }
    this.state = 'bite';
    this.biteT = this.rod.window * (this.pending.giant ? 1.5 : 1);
    G.audio.bite(this.bpos);
    G.ui.flashBite();
  }

  _hook() {
    const G = this.game;
    const c = this.pending;
    const sp = FISH_BY_ID[c.sp];
    const sizeF = c.size ?? 0.5;
    const F = sp.fight;
    const rod = this.rod;
    const TIER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, giant: 5, junk: 0 };
    let tier = sp.lev ? 6 : TIER[sp.rarity] ?? 0;
    const zone = c.zone || 0;
    // how hard it fights, against how much the rod can hold
    let fight = fightOf(sp, c.kg, c.v);
    if (sp.lev) fight = (RODS.find(r => r.tier === (c.rod || 3)) || rod).rating - 0.05;
    if (sp.great) { fight = c.fight; tier = 7; }
    if (sp.junk) { fight = 0.5; tier = 0; }
    const er = F.erratic;
    this.fish = {
      sp: c.sp, kg: c.kg, cm: c.cm, size: sizeF, v: c.v || null, zone, giant: !!c.giant, lev: c.lev || null, creature: c.creature || null,
      power: F.power * (0.75 + sizeF * 0.5), jump: F.jump, erratic: er, tier, fight,
      // the bar: how the fish moves on it
      move: {
        speed: clamp(0.24 + er * 0.16 + tier * 0.045 + zone * 0.03 + sizeF * 0.06, 0.18, 0.78),
        restless: 0.5 + er * 0.6 + tier * 0.14 + zone * 0.08,
        dart: clamp(0.16 + er * 0.2 + tier * 0.03, 0, 0.6),
        pause: clamp(0.45 - er * 0.18 - tier * 0.05, 0.06, 0.5),
        drift: 0.08 + er * 0.07,
        drain: clamp(0.5 + F.power * 0.1 + tier * 0.1 + zone * 0.06, 0.45, 1.3),
      },
      fishPos: 0.5, fishTarget: 0.5, nextThink: 0.4, feint: 0, feintTo: 0.5,
      dist: Math.max(4, this.bpos.distanceTo(this.player.pos)), dist0: Math.max(4, this.bpos.distanceTo(this.player.pos)),
      bearing: Math.atan2(this.bpos.x - this.player.pos.x, this.bpos.z - this.player.pos.z), dir: 0,
      jumpT: 2 + Math.random() * 4, phaseT: 3 + Math.random() * 3, phased: false, grown: false,
      reqTier: c.rod || sp.rod || 0, rnd: rng((Math.random() * 1e9) | 0),
      pace: c.pace || 1, cap: c.cap || (sp.lev ? 150 : 75), great: c.great || null,
    };
    if (sp.great) Object.assign(this.fish.move, { speed: 0.82, restless: 3, dart: 0.6, pause: 0.06, drift: 0.2, drain: 1.3 });
    if (c.power) this.fish.power = c.power;
    // you start ON the fish with a little line in hand; the first second is a grace period
    this.bar = { zone: 0.5, vel: 0, catch: 0.35, fought: 0, tired: 0, held: 0, on: 0 };
    this.state = 'fight';
    this.fightT = 0; this.tension = 0.3; this.pull = 0.5;
    G.state.useBait(G.state.s.bait);
    G.audio.hook();
    Bus.emit('fish:hooked', { fish: this.fish });
    const over = this.fish.fight - rod.rating;
    if (this.fish.great) G.ui.banner(sp.name.toUpperCase() + ' IS ON THE LINE', over > 0.3 ? 'Your ' + rod.name + ' cannot hold this for long. Hang on anyway.' : 'This will take minutes, not seconds. Keep the zone on it.', 'leviathan', 4);
    else if (this.fish.giant || this.fish.lev) G.ui.banner(this.fish.lev ? 'IT IS HOOKED!' : 'GIANT ON THE LINE!', 'Hold to lift the catch zone. Keep it on the fish.');
    if (over > 0.25 && !sp.lev && !sp.great) {
      const need = RODS.find(r => r.rating >= this.fish.fight);
      G.ui.toast('This one is too strong for your ' + rod.name + (need ? ' - you need a ' + need.name + '.' : '.'), 'bad');
      Bus.emit('fish:toostrong', { need: need && need.id });
    }
  }

  /* ---------------- the fight: the Fish N Sticks bar ----------------
     The catch zone is a weightless thing in a gravity well: holding the
     button lifts it (and reels - you can see the crank turn), letting go
     drops it. Keep it over the fish as the fish darts about the bar and the
     catch meter fills; slip off and it drains. The fish tires only while
     you are ON it (pressure, not patience), and one heavier than the rod's
     rating bleeds the meter however well you track it - the upgrade loop
     as a rule rather than a locked door. After 75 s the line parts. */
  _fight(dt, input, blocked, holding) {
    const G = this.game, P = this.player, F = this.fish, rod = this.rod, B = this.bar;
    this.fightT += dt;
    const sp = FISH_BY_ID[F.sp];
    // sharkfish: small at first
    if (sp.beh === 'shark' && !F.grown && this.fightT > 2.5) {
      F.grown = true;
      F.kg *= 10; F.cm *= 2.15; F.power *= 2.4; F.fight += 0.9; F.tier = Math.min(6, F.tier + 2);
      F.move.speed = Math.min(0.8, F.move.speed * 1.35); F.move.drain *= 1.3; F.move.restless += 0.5;
      G.fx.eruption(this.bpos.x, G.world.sea(this.bpos.x, this.bpos.z), this.bpos.z, 4);
      G.audio.roar(0.6);
      G.ui.banner('IT IS GROWING?!', 'That was a tiny fish a second ago.');
      Bus.emit('fish:grew', {});
    }
    // ghostfish: it fades out; while it is gone you cannot land progress on it
    if (sp.beh === 'ghost') {
      F.phaseT -= dt;
      if (F.phaseT <= 0) { F.phased = !F.phased; F.phaseT = F.phased ? 1.3 : 3 + Math.random() * 3; if (F.phased) this.msg('It vanished... it is still on the line!', 'info'); }
    }
    // --- the player's zone: lift while held, gravity when not ---
    const drag = 2.2 * rod.control;
    B.vel += ((holding ? rod.lift : 0) - rod.fall) * dt;
    B.vel -= B.vel * Math.min(1, drag * dt);
    B.zone += B.vel * dt;
    if (B.zone < 0) { B.zone = 0; B.vel = Math.max(0, B.vel); }
    if (B.zone > 1) { B.zone = 1; B.vel = Math.min(0, B.vel); }
    // --- the fish ---
    this._moveFish(dt);
    // --- on it? ---
    const half = rod.band * 0.5;
    const on = Math.abs(F.fishPos - B.zone) <= half && !F.phased;
    B.on = on ? Math.min(1, B.on + dt * 6) : Math.max(0, B.on - dt * 6);
    if (on) B.fought += dt;
    B.tired = clamp(B.fought * F.pace / 30, 0, 1);
    B.held += dt;
    if (G.admin?.autoCatch) { B.catch += dt / 3; F.fishPos = B.zone; }     // playtest: every fight wins itself
    // a monster fights on a slower clock: everything moves `pace` as fast
    const pdt = dt * F.pace;
    if (on) B.catch += 0.52 * (1 + B.tired * 1.2) * pdt;
    else B.catch -= 0.30 * F.move.drain * Math.min(1, B.held / 1.5) * pdt;
    const over = F.fight - rod.rating;
    // OVER THE ROD'S RATING the meter bleeds even when you track it perfectly,
    // and it bleeds hard: a little over is a fight, a lot over is impossible.
    if (over > 0 && !G.admin?.autoCatch) B.catch -= (over * 0.55 + over * over * 1.2) * pdt;
    B.catch = clamp(B.catch, 0, 1);
    // --- what the rod, the reel and the line feel ---
    const pull = clamp(F.fight / rod.rating, 0.2, 2);
    const strain = (on ? 0.35 : 0.75) * pull + (holding ? 0.15 : 0) + Math.max(0, over) * 0.6;
    this.tension = damp(this.tension, clamp(strain, 0.1, 1.25), 6, dt);
    this.pull = pull;
    this.side = damp(this.side, clamp((F.fishTarget - F.fishPos) * 4, -1, 1), 4, dt);
    this.crank += holding ? dt * (6 + rod.reel * 3) * (on ? 1 : 0.6) : 0;
    if (holding) G.audio.reel(this.tension);
    G.audio.tension(this.tension);
    // jumps
    F.jumpT -= dt;
    if (F.jump > 0 && F.jumpT <= 0 && !F.lev) { F.jumpT = (4 + Math.random() * 6) / (0.4 + F.jump); this._startJump(); }
    // --- the fish in the world: it comes in as the meter fills ---
    const want = 1.6 + (F.dist0 - 1.6) * (1 - B.catch);
    F.dist = damp(F.dist, want, 1.5, dt);
    F.dir = clamp(F.fishTarget - F.fishPos, -1, 1) * 2;
    F.bearing += F.dir * 0.12 * dt * (on ? 0.5 : 1.2);
    const px = P.pos.x + Math.sin(F.bearing) * F.dist, pz = P.pos.z + Math.cos(F.bearing) * F.dist;
    const s = this.water === 'ice' ? 0.05 : G.world.waterAt(px, pz);
    if (this.water === 'ice') this.bpos.set(this.bpos.x, 0.0, this.bpos.z);
    else if (s === -Infinity) { F.bearing -= F.dir * 0.4 * dt; }
    else this.bpos.set(px, s - 0.25, pz);
    if (Math.random() < dt * (2 + pull * 2)) G.fx.splash(this.bpos.x, (s > -Infinity ? s : 0), this.bpos.z, clamp(F.kg / 40, 0.2, 2));
    // big fish tow the boat, or you
    const dx = this.bpos.x - P.pos.x, dz = this.bpos.z - P.pos.z, dl = Math.hypot(dx, dz) || 1;
    const tugging = (on ? 0.5 : 1.3) * (1 - B.tired * 0.6);
    if (P.boat && (F.power > 1.6 || F.kg > 60)) {
      const k = F.power * tugging * 1.8 / Math.sqrt(P.boat.hull.mass / 250);
      P.boat.tow.x += dx / dl * k; P.boat.tow.y += dz / dl * k;
    } else if (!P.boat && F.power > 2.6 && !on) {
      P.vel.x += dx / dl * (F.power - 2.4) * 1.3 * dt; P.vel.z += dz / dl * (F.power - 2.4) * 1.3 * dt;
    }
    // --- outcomes ---
    if (B.catch >= 1) return this._land();
    if (B.catch <= 0) {
      if (F.reqTier > rod.tier && Math.random() < 0.6) return this._yank();
      return this._lose(over > 0.2 ? 'SNAP! Too strong for this rod.' : 'It shook the hook and got away.');
    }
    if (B.held > F.cap) return this._lose('After all that, the line finally parts.');
  }

  /** The fish on the bar: picks a spot and swims at it, changing its mind
      on its own schedule. Rarer and deeper fish feint, run and break rhythm -
      timing, not raw speed, is what makes them hard. */
  _moveFish(dt) {
    const F = this.fish, M = F.move, B = this.bar, rnd = F.rnd, tier = F.tier;
    F.feint = Math.max(0, F.feint - dt);
    if (F.feint > 0) F.fishTarget = clamp(F.feintTo, 0, 1);
    F.nextThink -= dt;
    if (F.nextThink <= 0) {
      const r = rnd();
      F.nextThink = lerp(0.9, 0.16, clamp(M.restless / 2.6, 0, 1)) * (0.6 + rnd() * 0.9);
      if (tier >= 5 && rnd() < 0.55) {
        const roll = rnd();
        if (roll < 0.34) { F.fishTarget = F.fishPos; F.nextThink = 1.3 + rnd() * 1.1; }
        else if (roll < 0.72) { F.fishTarget = clamp(F.fishPos + (rnd() < 0.5 ? -1 : 1) * (0.34 + rnd() * 0.46), 0, 1); F.nextThink = 0.11 + rnd() * 0.12; }
        else { F.fishTarget = clamp(0.08 + rnd() * 0.84, 0, 1); F.nextThink = 0.45 + rnd() * 0.9; }
      } else if (tier >= 4 && rnd() < 0.22) {
        F.fishTarget = rnd() < 0.5 ? 0.06 : 0.94; F.nextThink = 1.1 + rnd() * 0.7;
      } else if (tier >= 2 && rnd() < (tier >= 4 ? 0.2 : tier >= 3 ? 0.15 : 0.1)) {
        const size = tier >= 4 ? 1 : 0.62, away = rnd() < 0.5 ? -1 : 1;
        F.feintTo = clamp(F.fishPos + away * (0.14 + rnd() * 0.22) * size, 0, 1);
        F.feint = (0.22 + rnd() * 0.14) * size;
        F.fishTarget = clamp(F.fishPos - away * (0.18 + rnd() * 0.26) * size, 0, 1);
        F.nextThink = F.feint + 0.35;
      } else if (r < M.pause) F.fishTarget = F.fishPos;
      else if (r < M.pause + M.dart * 0.5) F.fishTarget = clamp(F.fishPos + (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.5), 0, 1);
      else F.fishTarget = clamp(0.1 + rnd() * 0.8, 0, 1);
    }
    const wobble = Math.sin(this.fightT * 3.1 + F.kg) * M.drift * 0.06;
    const want = clamp(F.fishTarget + wobble, 0, 1);
    const d = want - F.fishPos;
    const step = M.speed * (1 - B.tired * 0.17) * dt * (1 + Math.abs(d) * 1.4);
    F.fishPos = clamp(F.fishPos + clamp(d, -step, step), 0, 1);
  }

  /** Friends with harpoons: every hit on a hooked giant hands you line. */
  assist(n) { if (this.bar && this.state === 'fight') this.bar.catch = clamp(this.bar.catch + n * 0.012, 0, 1); }

  _startJump() {
    const F = this.fish, G = this.game;
    const sp = FISH_BY_ID[F.sp];
    this._endJump();
    const m = fishMesh(sp, F.cm / 100);
    G.scene.add(m);
    const s = G.world.waterAt(this.bpos.x, this.bpos.z);
    this.jump = { m, t: 0, dur: 0.9 + Math.min(1, F.cm / 200) * 0.4, y0: s, x: this.bpos.x, z: this.bpos.z, h: 0.8 + Math.random() * 1.2 + F.cm / 200 };
    G.fx.splash(this.bpos.x, s, this.bpos.z, clamp(F.kg / 10, 0.5, 2.5));
    G.audio.splash(0.6);
    Bus.emit('fish:jump', { fish: F });
  }
  _endJump() { if (this.jump) { this.game.scene.remove(this.jump.m); this.jump = null; } }

  _yank() {
    const G = this.game;
    const lost = G.state.s.rod;
    this.cancel(true);
    G.state.loseRod(lost);
    G.vm.setRod(this.rod);
    G.ui.banner('YOUR ROD!', 'It was pulled clean out of your hands and into the water.');
    G.audio.splash(1.5);
    this.player.knock(new THREE.Vector3(Math.sin(this.player.yaw) * -1, 0, Math.cos(this.player.yaw) * -1), 2.5, 'yank');
    Bus.emit('fish:yank', { rod: lost });
  }

  _lose(text) {
    const G = this.game;
    const F = this.fish;
    if (F?.creature) G.creatures.released(F.creature);
    this.msg(text, 'bad');
    G.audio.snap();
    this._endJump();
    this.state = 'reelin';
    this.fish = null;
    this.tension = 0;
    Bus.emit('fish:lost', {});
  }

  _land() {
    const G = this.game, F = this.fish, P = this.player;
    this._endJump();
    const sp = FISH_BY_ID[F.sp];
    // where it lands: on your deck, or at your feet
    // where it lands: on your deck (pulled in toward the middle), or behind you on the bank
    let target;
    if (P.boat) {
      const B = P.boat, L = P.local.clone();
      L.x *= 0.35; L.z = clamp(L.z * 0.7, -B.hull.hl * 0.6, B.hull.hl * 0.6); L.y = B.deck + 0.35;
      target = B.toWorld(L);
    } else target = this._beachSpot();
    let slap = sp.beh === 'slap';
    if (slap) target.copy(P.eye);
    const from = this.bpos.clone();
    from.y = Math.max(from.y, G.world.sea(from.x, from.z) + 0.2);
    const T = slap ? 0.55 : 0.9;
    const vel = new THREE.Vector3((target.x - from.x) / T, 0, (target.z - from.z) / T);
    vel.y = (target.y - from.y) / T + 0.5 * 9.8 * T;
    if (F.lev || F.creature) {
      G.creatures.landed(F.creature, F);
    } else {
      G.landCatch({ sp: F.sp, kg: F.kg, cm: F.cm, pos: from, vel, by: P.id, slap, size: F.size, v: F.v, zone: F.zone, mult: zoneValue(F.zone) * (F.v ? VARIANT_BY_ID[F.v].mult : 1), ashore: P.boat ? null : target.toArray() });
    }
    G.fx.splash(from.x, from.y, from.z, clamp(F.kg / 15, 0.6, 3));
    G.audio.splash(1);
    this.state = 'idle';
    this.fish = null;
    this.bobber.visible = false; this.line.visible = false;
    this.tension = 0;
  }

  /** Fishing from land: somewhere dry near you to drag the catch onto.
      Prefers the ground (or pier boards) right behind you; if that is water,
      walks away from the line until it finds dry land. */
  _beachSpot() {
    const G = this.game, P = this.player, W = G.world;
    const dry = (x, z, y) => {
      const fl = W.colliders.floorAt(x, z, y, 1.2);
      const g = Math.max(W.ground(x, z), fl);
      return W.waterAt(x, z) === -Infinity || fl > W.waterAt(x, z) + 0.1 ? g : null;
    };
    const back = P.flatForward(new THREE.Vector3()).multiplyScalar(-1);
    // away from the bobber, then sideways, then any direction
    const away = new THREE.Vector3(P.pos.x - this.bpos.x, 0, P.pos.z - this.bpos.z);
    if (away.lengthSq() > 0.01) away.normalize(); else away.copy(back);
    for (const dir of [back, away]) {
      for (let d = 0.8; d <= 14; d += 0.6) {
        const x = P.pos.x + dir.x * d, z = P.pos.z + dir.z * d;
        const g = dry(x, z, P.pos.y);
        if (g !== null) return new THREE.Vector3(x, g + 0.3, z);
      }
    }
    for (let r = 2; r <= 20; r += 2) for (let a = 0; a < 12; a++) {
      const x = P.pos.x + Math.cos(a / 12 * Math.PI * 2) * r, z = P.pos.z + Math.sin(a / 12 * Math.PI * 2) * r;
      const g = dry(x, z, P.pos.y);
      if (g !== null) return new THREE.Vector3(x, g + 0.3, z);
    }
    return P.pos.clone().addScaledVector(back, 0.7).add(new THREE.Vector3(0, 0.3, 0));
  }

  _draw(dt) {
    const on = this.state !== 'idle' && this.state !== 'charge';
    this.bobber.visible = on && this.state !== 'fight';
    this.line.visible = on;
    if (!on) return;
    this.bobber.position.copy(this.bpos);
    const A = this.tip, B = this.bpos;
    const pos = this.lineGeo.attributes.position.array;
    const L = A.distanceTo(B);
    const taut = this.state === 'fight' ? clamp(this.tension, 0, 1) : this.state === 'fly' ? 0.9 : this.state === 'reelin' ? 0.6 : 0.15;
    const sag = L * 0.12 * (1 - taut);
    for (let i = 0; i < this.N; i++) {
      const t = i / (this.N - 1);
      pos[i * 3] = A.x + (B.x - A.x) * t;
      pos[i * 3 + 1] = A.y + (B.y - A.y) * t - Math.sin(t * Math.PI) * sag;
      pos[i * 3 + 2] = A.z + (B.z - A.z) * t;
    }
    this.lineGeo.attributes.position.needsUpdate = true;
    this.line.material.color.setHex(this.tension > 0.95 ? 0xff7a5a : this.tension > 0.8 ? 0xffd27a : 0xe8e8e0);
    if (this.jump) {
      const J = this.jump;
      J.t += dt;
      const f = J.t / J.dur;
      if (f >= 1) { this.game.fx.splash(J.x, J.y0, J.z, 1); this._endJump(); return; }
      J.m.position.set(this.bpos.x, J.y0 + Math.sin(f * Math.PI) * J.h, this.bpos.z);
      J.m.rotation.set(0, this.player.yaw + Math.PI / 2, Math.cos(f * Math.PI) * 0.9);
      J.m.rotateX(Math.sin(f * 12) * 0.3);
    }
  }

  /** Summary for the HUD and the network. */
  hud() {
    const F = this.fish;
    return {
      state: this.state, charge: this.charge, tension: this.tension, side: this.side, crank: this.crank,
      dist: F ? F.dist : this.bpos.distanceTo(this.player.pos), line: this.rod.line,
      stamina: F ? 1 - this.bar.catch : 0, fishDir: F ? F.dir : 0, run: false, pull: F ? this.pull : 0,
      bar: F ? { zone: this.bar.zone, band: this.rod.band, fish: F.fishPos, target: F.fishTarget, catch: this.bar.catch, on: this.bar.on, phased: F.phased, over: F.fight - this.rod.rating, tier: F.tier, v: F.v, tired: this.bar.tired } : null,
      rarity: F ? FISH_BY_ID[F.sp].rarity : null, big: F ? (F.giant || !!F.lev) : false, window: this.state === 'bite' ? this.biteT / this.rod.window : 0,
    };
  }
}
