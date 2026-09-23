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

import * as THREE from '../../lib/three.module.js?v=1790183165';
import { FISH_BY_ID, FISH, rollSize, RARITY } from '../data/FishData.js?v=1790183165';
import { ROD_BY_ID, BAIT_BY_ID } from '../data/GearData.js?v=1790183165';
import { buildBobber } from '../art/RodArt.js?v=1790183165';
import { fishMesh } from '../art/FishArt.js?v=1790183165';
import { clamp, damp, lerp, rng, weighted } from '../core/Util.js?v=1790183165';
import { Bus } from '../core/Bus.js?v=1790183165';

export const FIGHT_MAX = 90;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

/* ---------------- species selection (shared with holders and traps) ---------------- */
export function pickSpecies(ctx, r = Math.random) {
  const list = [];
  for (const f of FISH) {
    if (f.where === 'meteor') { if (!ctx.meteor) continue; }
    else if (f.where !== 'all' && !f.where.includes(ctx.region)) continue;
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
    list.push({ f, w: w * aff * tm });
  }
  const pick = weighted(list, r);
  return pick ? pick.f : FISH_BY_ID.boot;
}

export function rollCatch(sp, r = Math.random, luck = 0) {
  const s = rollSize(r, luck);
  const kg = sp.kg[0] + (sp.kg[1] - sp.kg[0]) * s;
  const cm = sp.cm[0] + (sp.cm[1] - sp.cm[0]) * Math.sqrt(s);
  return { sp: sp.id, kg, cm, size: s };
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
    };
  }

  _biteTime() {
    const G = this.game;
    const bait = BAIT_BY_ID[G.state.s.bait] || BAIT_BY_ID.worm;
    let t = (6 + Math.random() * 10) / bait.bite;
    const ev = G.events;
    if (ev.near('migration', this.bpos, 90)) t /= 4;
    if (ev.near('whirlpool', this.bpos, 80)) t /= 2;
    if (ev.near('meteor', this.bpos, 30)) t /= 2;
    if (G.state.s.bait === 'glow' && (G.tod < 0.22 || G.tod > 0.8)) t /= 1.3;
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
        if (unclick || !lmb) {
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
        if (click) { this._hook(); break; }
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
    const big = G.creatures?.claimBite(this.bpos, this);
    if (big) { this.pending = big; }
    else {
      const sp = pickSpecies(this._ctx());
      const c = rollCatch(sp, Math.random, G.state.has('lucky') ? 1 : 0);
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
    this.fish = {
      sp: c.sp, kg: c.kg, cm: c.cm, size: sizeF, giant: !!c.giant, lev: c.lev || null, creature: c.creature || null,
      power: F.power * (0.75 + sizeF * 0.5), stamina: 0, staminaMax: F.stamina * 8 * (0.7 + sizeF * 0.6), erratic: F.erratic, jump: F.jump,
      dir: 0, run: false, dirT: 0.5, dist: Math.max(4, this.bpos.distanceTo(this.player.pos)),
      bearing: Math.atan2(this.bpos.x - this.player.pos.x, this.bpos.z - this.player.pos.z), jumpT: 2 + Math.random() * 4, phaseT: 3 + Math.random() * 3, phased: false,
      grown: false, reqTier: c.rod || sp.rod || 0,
    };
    if (c.staminaMax) { this.fish.staminaMax = c.staminaMax; this.fish.power = c.power; }
    this.fish.stamina = this.fish.staminaMax;
    this.state = 'fight';
    this.fightT = 0; this.tension = 0.3; this.overT = 0; this.slackT = 0;
    G.state.useBait(G.state.s.bait);
    G.audio.hook();
    Bus.emit('fish:hooked', { fish: this.fish });
    if (this.fish.giant || this.fish.lev) G.ui.banner(this.fish.lev ? 'IT IS HOOKED!' : 'GIANT ON THE LINE!', 'Keep the tension in the zone. Pull against its runs.');
  }

  _fight(dt, input, blocked, reeling) {
    const G = this.game, P = this.player, F = this.fish, rod = this.rod;
    this.fightT += dt;
    // fish AI
    F.dirT -= dt;
    if (F.dirT <= 0) {
      const opts = [-1, -0.6, 0, 0.6, 1];
      F.dir = opts[Math.floor(Math.random() * opts.length)];
      F.run = Math.random() < 0.25 + F.erratic * 0.25;
      F.dirT = (1 + Math.random() * 2.5) / (0.5 + F.erratic);
    }
    const tired = F.stamina <= 0;
    let pull = F.power * (0.35 + 0.65 * clamp(F.stamina / F.staminaMax, 0, 1)) * (F.run ? 1.6 : 1);
    if (tired) pull *= 0.3;
    // player input: pull the rod against the run
    const sideIn = blocked ? 0 : input.axis('KeyA', 'KeyD');
    this.side = damp(this.side, sideIn, 6, dt);
    const counter = clamp(-this.side * F.dir, -1, 1);
    const over = F.lev ? 0 : Math.max(0, F.kg / rod.maxKg - 1);
    const tMul = 1 + over * 1.6;
    let target = (pull * (reeling ? 0.5 : 0.16) * tMul / rod.tolerance) * (1 - 0.4 * Math.max(0, counter)) * (1 + 0.35 * Math.max(0, -counter)) + (reeling ? 0.1 : 0);
    // ghostfish: when it phases out, reeling yanks on nothing and then everything
    if (FISH_BY_ID[F.sp].beh === 'ghost') {
      F.phaseT -= dt;
      if (F.phaseT <= 0) { F.phased = !F.phased; F.phaseT = F.phased ? 1.4 : 3 + Math.random() * 3; if (F.phased) this.msg('It vanished... it is still on the line!', 'info'); }
      if (F.phased && reeling) target += 0.5;
    }
    // sharkfish: small at first
    if (FISH_BY_ID[F.sp].beh === 'shark' && !F.grown && this.fightT > 2.5) {
      F.grown = true;
      F.kg *= 10; F.cm *= 2.15; F.power *= 2.4; F.staminaMax *= 2.2; F.stamina *= 2.2;
      G.fx.eruption(this.bpos.x, G.world.sea(this.bpos.x, this.bpos.z), this.bpos.z, 4);
      G.audio.roar(0.6);
      G.ui.banner('IT IS GROWING?!', 'That was a tiny fish a second ago.');
      Bus.emit('fish:grew', {});
    }
    this.tension = damp(this.tension, target, 5, dt);
    // jumps: a spike if you reel mid-air
    F.jumpT -= dt;
    if (F.jump > 0 && F.jumpT <= 0 && !F.lev) {
      F.jumpT = (4 + Math.random() * 6) / (0.4 + F.jump);
      this._startJump();
    }
    if (this.jump && reeling) this.tension += dt * 1.2;
    // line
    const out = pull * (F.run ? 0.55 : 0.22);
    const inn = reeling ? rod.reel * (1 - 0.5 * clamp(this.tension, 0, 1)) * (tired ? 1.4 : 1) : 0;
    F.dist += (out - inn) * dt;
    F.bearing += F.dir * 0.22 * dt * (F.run ? 1.5 : 1);
    this.crank += reeling ? dt * 16 : 0;
    if (reeling) G.audio.reel(this.tension);
    G.audio.tension(this.tension);
    // the tiring clock runs only in the zone
    if (this.tension > 0.25 && this.tension < 0.95) {
      F.stamina -= dt * (reeling ? 1 : 0.35) * (1 + 0.9 * Math.max(0, counter)) * (0.85 + rod.tier * 0.12);
    }
    // failure conditions
    if (this.tension > 1) this.overT += dt; else this.overT = Math.max(0, this.overT - dt * 0.6);
    if (this.tension < 0.06 && !tired) this.slackT += dt; else this.slackT = 0;
    const rodPull = F.reqTier > rod.tier;
    if (rodPull && this.tension > 1.05 && this.overT > 0.45) return this._yank();
    if (this.overT > 0.75) return this._lose('SNAP! The line broke.');
    if (F.dist > rod.line) return this._lose('It took all your line. SNAP.');
    if (this.slackT > 2.6) return this._lose('Slack line - it spat the hook.');
    if (this.fightT > (F.lev ? FIGHT_MAX * 1.7 : FIGHT_MAX)) return this._lose('After all that, the line finally parts.');
    // position of the fish on the water
    const px = P.pos.x + Math.sin(F.bearing) * F.dist, pz = P.pos.z + Math.cos(F.bearing) * F.dist;
    const s = this.water === 'ice' ? 0.05 : G.world.waterAt(px, pz);
    if (this.water === 'ice') this.bpos.set(this.bpos.x, 0.0, this.bpos.z);
    else if (s === -Infinity) { F.bearing -= F.dir * 0.5 * dt; F.dir = -F.dir; F.dist = Math.max(2, F.dist - 3 * dt); }
    else this.bpos.set(px, s - 0.25, pz);
    if (Math.random() < dt * (3 + pull)) G.fx.splash(this.bpos.x, (s > -Infinity ? s : 0), this.bpos.z, clamp(F.kg / 40, 0.2, 2));
    // big fish tow the boat, or you
    const dx = this.bpos.x - P.pos.x, dz = this.bpos.z - P.pos.z, dl = Math.hypot(dx, dz) || 1;
    if (P.boat && (F.power > 1.6 || F.kg > 60)) {
      const k = F.power * (F.run ? 1.6 : 1) * (tired ? 0.3 : 1) * 1.8 / Math.sqrt(P.boat.hull.mass / 250);
      P.boat.tow.x += dx / dl * k; P.boat.tow.y += dz / dl * k;
    } else if (!P.boat && F.power > 2.6 && this.tension > 0.7 && !tired) {
      P.vel.x += dx / dl * (F.power - 2.4) * 1.3 * dt; P.vel.z += dz / dl * (F.power - 2.4) * 1.3 * dt;
    }
    if (F.dist < 1.8 || (this.water === 'ice' && F.dist < 2.5)) this._land();
  }

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
    } else target = P.pos.clone().addScaledVector(P.flatForward(new THREE.Vector3()), -0.7).add(new THREE.Vector3(0, 0.3, 0));
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
      G.landCatch({ sp: F.sp, kg: F.kg, cm: F.cm, pos: from, vel, by: P.id, slap, size: F.size });
    }
    G.fx.splash(from.x, from.y, from.z, clamp(F.kg / 15, 0.6, 3));
    G.audio.splash(1);
    this.state = 'idle';
    this.fish = null;
    this.bobber.visible = false; this.line.visible = false;
    this.tension = 0;
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
      stamina: F ? clamp(F.stamina / F.staminaMax, 0, 1) : 0, fishDir: F ? F.dir : 0, run: F ? F.run : false,
      rarity: F ? FISH_BY_ID[F.sp].rarity : null, big: F ? (F.giant || !!F.lev) : false, window: this.state === 'bite' ? this.biteT / this.rod.window : 0,
    };
  }
}
