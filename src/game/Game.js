/* Game.js - wires every system together and owns the rules.

   ONE PATH FOR EVERY CHANGE TO THE WORLD. Anything that changes shared
   state - picking up a fish, selling, buying, fixing a leak, hooking a
   giant - goes through act(cmd). Solo and host run it immediately
   (_do); a client sends it to the host, who runs it and lets the result
   arrive in the next snapshot. So solo play and co-op are the same code,
   and there is no way for two clients to both sell the same Bombfish. */

import * as THREE from '../../lib/three.module.js?v=1790192871';
import { Player } from './Player.js?v=1790192871';
import { Boat } from './Boat.js?v=1790192871';
import { Loot } from './Loot.js?v=1790192871';
import { Fishing, pickSpecies, rollCatch } from './Fishing.js?v=1790192871';
import { Tools } from './Tools.js?v=1790192871';
import { ViewModel } from './ViewModel.js?v=1790192871';
import { Effects } from './Effects.js?v=1790192871';
import { Creatures } from './Creatures.js?v=1790192871';
import { Events } from './Events.js?v=1790192871';
import { NPCs } from './NPCs.js?v=1790192871';
import { Cabin } from './Cabin.js?v=1790192871';
import { Remote } from './Remote.js?v=1790192871';
import { State } from './State.js?v=1790192871';
import { PLAYER_LOOKS } from '../art/Character.js?v=1790192871';
import { fishMesh } from '../art/FishArt.js?v=1790192871';
import { FISH, FISH_BY_ID, RARITY, fishValue, GIANTS, valueBreakdown, catchName, VARIANT_BY_ID } from '../data/FishData.js?v=1790192871';
import { RODS, ROD_BY_ID, BAITS, BAIT_BY_ID, TOOLS, TOOL_BY_ID, GEAR_BY_ID } from '../data/GearData.js?v=1790192871';
import { HULL_BY_ID, PART_BY_ID, PAINT_BY_ID, DECOR_BY_ID, boatStats } from '../data/BoatData.js?v=1790192871';
import { LEVIATHANS, LEV_BY_ID, STORY } from '../data/LeviathanData.js?v=1790192871';
import { LAKES, REGIONS, waveAmp, zoneAt, ZONES } from '../world/MapData.js?v=1790192871';
import { nearLake } from '../world/Terrain.js?v=1790192871';
import { clamp, damp, uid, fmtInt, fmtKg, rng } from '../core/Util.js?v=1790192871';
import { Bus } from '../core/Bus.js?v=1790192871';
import { ic } from '../ui/Icons.js?v=1790192871';

import { Chat } from '../ui/Chat.js?v=1790192871';
import { Voice } from '../net/Voice.js?v=1790192871';
import { Great } from './Great.js?v=1790192871';
import { GREAT, GREAT_BY_ID, KRAKEN } from '../data/GreatData.js?v=1790192871';
import { TROPHY_BY_ID, speciesTrophy } from '../data/TrophyData.js?v=1790192871';
import { VIGIL_FISHERMEN, NPC_BY_ID } from '../data/NPCData.js?v=1790192871';
import { SHOPS } from '../data/GearData.js?v=1790192871';
import { mistAt, VIGIL } from '../world/MapData.js?v=1790192871';

const pick = a => a[Math.floor(Math.random() * a.length)];
const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] !== undefined ? o[k] : m));

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);           // scene, camera, renderer, input, audio, world, ui, net, state
    this.running = false;
    Game._inst = this;
    this.fx = new Effects(this.scene);
    this.loot = new Loot(this);
    this.boats = [];
    this.remotes = new Map();
    this.player = new Player(this, 'local');
    this.shake = 0;
    this.saveT = 20;
    // tap CTRL to talk; hold C for the walkie-talkie
    this.chat = new Chat({
      input: this.input,
      canOpen: () => this.running && !this.ui?.isOpen && !this.ui?.talkEl,
      selfName: () => this.state.settings.name || 'Fisher',
      selfColor: () => '#ffd27a',
      onClose: () => { this.input.blocked = !!(this.ui?.isOpen || this.ui?.talkEl); },
      onSend: text => {
        if (!this.net?.isOnline) return 'Nobody can hear you - you are fishing solo. Host or join a crew to chat.';
        if (this.net.isClient && !this.net.hostConn?.open) return 'The connection to the host dropped.';
        this.net.sendEvent({ t: 'chat', name: this.state.settings.name || 'Fisher', text });
        return null;
      },
    });
    this.voice = new Voice(this);
    this.clueT = 0;
    this.slaps = [];
    this.tod = 0.3;
    this._bus();
  }

  get isHost() { return !this.net || !this.net.isOnline || this.net.isHost; }

  /* ================= setup ================= */
  start(mode) {
    const S = this.state;
    const look = PLAYER_LOOKS[S.settings.look % 4];
    this.vm = new ViewModel(look);
    this.fishing = new Fishing(this, this.player);
    this.tools = new Tools(this);
    this.creatures = new Creatures(this);
    this.events = new Events(this);
    this.npcs = new NPCs(this);
    this.cabin = new Cabin(this);
    this.great = new Great(this);
    this.admin = this.admin || { autoCatch: false, autoCast: false };
    this.vm.setRod(ROD_BY_ID[S.s.rod]);
    this.vm.setTool(this.player.tool);
    this._spawnBoat();
    const s = S.s;
    this.tod = s.tod;
    const A = this.world.settlement.anchors;
    if (s.player && mode === 'continue') {
      this.player.place(new THREE.Vector3(s.player.x, s.player.y, s.player.z), s.player.yaw);
      if (s.player.onBoat) {
        const b = this.boats[0];
        this.player.attach(b, new THREE.Vector3(0, b.deck, 0));
      }
    } else {
      this.player.place(A.spawn.clone(), Math.PI);
    }
    for (const t of s.traps || []) this.tools.addTrap(t);
    for (const h of s.holes || []) this.tools.addHole(h);
    this.world.prebuild(this.player.pos.x, this.player.pos.z);
    if (!this.state.remote) this._backfillTrophies();
    this.cabin.update();
    this.running = true;
    this.ui.showHUD(true);
    this.ui.hotbar();
    if (mode !== 'continue' && !this.state.remote) {
      this.ui.subtitle(STORY.intro, 9);
      setTimeout(() => this.ui.radio('Radio: Morning, Driftwood Bay. Fish are biting and Old Gus is on his porch.'), 3000);
    }
  }

  _spawnBoat() {
    const s = this.state.s;
    for (const b of this.boats) { this.scene.remove(b.group); }
    this.boats = [];
    const b = new Boat(this, s.boat, 'boat');
    b.mooring = this.homeMooring();
    if (s.boatPos && !this.state.remote) {
      b.pos.set(s.boatPos.x, 0, s.boatPos.z); b.heading = s.boatPos.h; b.docked = !!s.boatPos.docked;
      b.hp = Math.min(b.stats.hp, s.boatPos.hp ?? b.stats.hp);
      if (s.boatPos.docked) b.respawn(false);
      b._updateMatrix();
    } else b.respawn(false);
    this.boats.push(b);
    if (!this.state.remote) this.loot.loadOnBoat(b, s.boatCargo);
  }

  homeMooring() { return this.world.settlement.moorings[0]; }
  boatById(id) { return this.boats.find(b => b.id === id) || null; }
  boatAt(pos, margin = 0) {
    for (const b of this.boats) {
      if (b.sinking) continue;
      const L = b.toLocal(pos, _w);
      if (b.over(L.x, L.z, -margin) && L.y > b.deck - 0.8 && L.y < b.deck + 3) return b;
    }
    return null;
  }
  playerById(id) { if (id === this.player.id || id === this.net?.selfId) return this.player; return this.remotes.get(id) || null; }
  allPlayers() { return [this.player, ...this.remotes.values()]; }
  focusPlayer() { const all = this.allPlayers(); return all[Math.floor(Math.random() * all.length)]; }
  isNight() { return this.tod < 0.22 || this.tod > 0.8; }
  isLake(x, z) {
    const L = nearLake(x, z);
    return !!L && !L.ice && Math.hypot(x - L.x, z - L.z) < L.r * 1.2;
  }
  fishMeshCache(id) {
    this._fmc = this._fmc || {};
    if (!this._fmc[id]) this._fmc[id] = fishMesh(FISH_BY_ID[id], 1);
    return this._fmc[id];
  }

  /* ================= actions ================= */
  act(cmd) {
    if (this.isHost) return this._do(cmd, this.player.id);
    this.net.sendAction(cmd);
    // a little local prediction for things that feel laggy otherwise
    if (cmd.t === 'pickup') this.player.held = cmd.id;
    if (cmd.t === 'drop' || cmd.t === 'throw') this.player.held = null;
    return null;
  }
  /** The host performs an action for player `from`. */
  _do(c, from) {
    const S = this.state, s = S.s, P = this.playerById(from) || this.player;
    const me = P === this.player;
    const it = c.id ? this.loot.get(c.id) : null;
    const boat = c.boat ? this.boatById(c.boat) : P.boat;
    switch (c.t) {
      case 'pickup':
        if (it && !it.held && this.loot.pickUp(it, from)) { P.held = it.id; this._onPickup(it, P); }
        break;
      case 'drop': case 'throw':
        if (it && it.held === from) { this.loot.drop(it, new THREE.Vector3(...c.pos), new THREE.Vector3(...c.vel)); if (me) P.held = null; else P.held = null; }
        break;
      case 'cooler':
        if (it && boat && this.loot.toCooler(it, boat)) { P.held = null; this.tell(from, 'Stored in the cooler.', 'good'); }
        else this.tell(from, it && it.kg > 60 ? 'Far too big for the cooler.' : 'The cooler is full. The rest goes on the deck.', 'warn');
        break;
      case 'mount': {
        if (!it || c.slot == null) break;
        s.cabin.slots[c.slot] = { sp: it.sp, kg: +it.kg.toFixed(2), cm: Math.round(it.cm) };
        this.loot.remove(it); P.held = null;
        this.tell(from, 'Mounted on the wall. Beautiful.', 'good');
        this.fx.confetti(P.pos.x, P.pos.y + 1.5, P.pos.z, 30);
        this._changed();
        break;
      }
      case 'yardPut': {
        if (!it) break;
        const i = s.cabin.yard.findIndex(x => !x);
        if (i < 0) { this.tell(from, 'The trophy yard is full.', 'warn'); break; }
        s.cabin.yard[i] = { sp: it.sp, kg: +it.kg.toFixed(1), cm: Math.round(it.cm) };
        this.loot.remove(it); P.held = null;
        this.tell(from, 'Hauled to your trophy yard.', 'good');
        this._changed();
        break;
      }
      case 'netLoot':
        if (it && !it.held) { it.boat = null; it.pos.copy(P.pos).add(new THREE.Vector3(0, 1.2, 0)); it.vel.set(0, 2, 0); it.stunned = false; it.flop = 12; }
        break;
      case 'netFish': {
        const sp = FISH_BY_ID[c.c.sp];
        const pos = P.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
        this.landCatch({ sp: sp.id, kg: c.c.kg, cm: c.c.cm, pos, vel: new THREE.Vector3(0, 2, 0), by: from, size: c.c.size, v: c.c.v, zone: c.c.zone, mult: c.c.mult });
        if (c.thief) { const n = 4 + Math.floor(Math.random() * 5); S.addBait(c.thief, n); S.addBait(BAITS[Math.floor(Math.random() * BAITS.length)].id, 3); this.tell(from, `The thief's hoard: ${n} ${BAIT_BY_ID[c.thief].name} and more!`, 'good'); }
        break;
      }
      case 'yank':
        if (it && !it.held) { const to = new THREE.Vector3(...c.to); const d = to.sub(it.pos); it.boat = null; it.vel.copy(d.multiplyScalar(1.6)).add(new THREE.Vector3(0, 3, 0)); }
        break;
      case 'trapPlace': {
        const t = { id: uid('t'), x: c.x, z: c.z, t0: this.world.time, owner: from };
        this.tools.addTrap(t);
        s.traps = [...this.tools.traps.values()].map(({ mesh, ...o }) => o);
        break;
      }
      case 'trapHaul': {
        const t = this.tools.traps.get(c.id);
        if (!t) break;
        const ready = this.tools.trapReady(t);
        this.tools.removeTrap(c.id);
        s.traps = [...this.tools.traps.values()].map(({ mesh, ...o }) => o);
        if (!ready) { this.tell(from, 'Empty. Leave traps longer.', 'warn'); break; }
        const n = 1 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const sp = pickSpecies({ region: this.world.region(t.x, t.z), water: this.isLake(t.x, t.z) ? 'lake' : 'sea', bait: 'pieces', night: this.isNight() });
          const cc = rollCatch(sp, Math.random, 0, zoneAt(t.x, t.z));
          this.landCatch({ sp: sp.id, kg: cc.kg, cm: cc.cm, pos: P.pos.clone().add(new THREE.Vector3((Math.random() - 0.5), 1.5, (Math.random() - 0.5))), vel: new THREE.Vector3(0, 2, 0), by: from, size: cc.size, quiet: i > 0, v: cc.v, zone: cc.zone, mult: cc.mult });
        }
        this.tell(from, `The trap had ${n} catch${n > 1 ? 'es' : ''} in it!`, 'good');
        break;
      }
      case 'hole': {
        const h = { id: uid('h'), x: c.x, z: c.z };
        this.tools.addHole(h);
        s.holes = [...this.tools.holes.values()].map(({ mesh, ...o }) => o).slice(-20);
        break;
      }
      case 'fix': {
        if (!boat) break;
        const L = boat.leaks[c.leak];
        if (!L) break;
        L.fix += c.dt / 1.6;
        if (L.fix >= 1) { boat.leaks.splice(c.leak, 1); this.tell(from, 'Leak fixed.', 'good'); }
        break;
      }
      case 'patch': if (boat) boat.hp = Math.min(boat.stats.hp, boat.hp + c.dt * 5); break;
      case 'bucket': {
        if (!boat) break;
        let doused = false;
        for (let i = boat.fires.length - 1; i >= 0; i--) {
          const F = boat.fires[i];
          const w = boat.toWorld(_v.set(F.x, boat.deck, F.z));
          if (Math.hypot(w.x - c.x, w.z - c.z) < 3.4) { F.i -= 0.9; doused = true; if (F.i <= 0) boat.fires.splice(i, 1); }
        }
        if (!doused && boat.water > 0) { boat.water = Math.max(0, boat.water - 0.08); this.tell(from, 'Bailing out!', 'info'); }
        if (doused) this.tell(from, boat.fires.length ? 'Keep going!' : 'Fire is out!', boat.fires.length ? 'warn' : 'good');
        break;
      }
      case 'photo': S.addPhoto(c.data); this._changed(); break;
      case 'helm':
        if (boat && (c.on ? !boat.driver || boat.driver === from : boat.driver === from)) { boat.driver = c.on ? from : null; if (c.on) { boat.docked = false; if (s.tut === 3) this._tut(4); } }
        break;
      case 'drive':
        if (boat && boat.driver === from) boat.control(c.th, c.st);
        break;
      case 'harpoon':
        if (c.id === 'lev') this.creatures.levHit(c.dmg);
        else {
          const g = this.creatures.giants.get(c.id);
          if (g) {
            g.stun = 3;
            this.fx.splash(g.pos.x, 0, g.pos.z, 2);
            if (g.hooked) this._staminaHit(g.hooked, c.dmg * 0.9);
            else g.state = 'charge';
          }
        }
        break;
      case 'giantHook': { const g = this.creatures.giants.get(c.id); if (g) g.hooked = c.by; break; }
      case 'levHook': { const L = this.creatures.lev; if (L && L.phase === 'tired') { L.phase = 'hooked'; L.hooked = c.by; } break; }
      case 'levRise': if (!this.creatures.lev) this.creatures.startLev(c.id, c.x, c.z); break;
      case 'creatureLost': {
        if (c.id === 'great' || c.id === 'kraken') { this.great.released(c.id); break; }
        if (c.id === 'lev') { const L = this.creatures.lev; if (L) { L.phase = 'rampage'; L.armor = L.armorMax * 0.4; L.hooked = null; } }
        else { const g = this.creatures.giants.get(c.id); if (g) { g.hooked = null; g.life = Math.min(g.life, 30); } }
        break;
      }
      case 'creatureLanded': this._creatureLanded(c, from); break;
      case 'staminaHit': this._staminaHit(c.by, c.n); break;
      case 'catch': this.landCatch({ ...c, pos: new THREE.Vector3(...c.pos), vel: new THREE.Vector3(...c.vel), by: from }); break;
      case 'open': this._openChest(it, P, from); break;
      case 'clue': this.foundClue(c.id, from); break;
      case 'sleep': this._sleep(); break;
      case 'sell': {
        const x = this.loot.get(c.id), at = this._sellerPos(c.at);
        if (x && x.fav) { this.tell(from, 'That one is a favourite. Right-click it to unfavourite it first.', 'warn'); break; }
        if (x && this._canSell(x, at)) this._sell([x], from, c.at);
        break;
      }
      case 'sellAll': this._sell(this.sellable(this._sellerPos(c.at)), from, c.at); break;
      case 'fav': { const x = this.loot.get(c.id); if (x) x.fav = !!c.on; this._saveDirty = true; break; }
      case 'placeTrophies': {
        const n = this.cabin.placeAll();
        if (n) { this.fx.confetti(P.pos.x, P.pos.y + 1.6, P.pos.z, 20 + n * 10); this.audio.fanfare(2); this._changed(); }
        this.tell(from, n ? `You set ${n} trophy${n > 1 ? ' pieces' : ''} on the bookcase.` : 'Nothing new to put on the shelf.', n ? 'good' : 'info');
        break;
      }
      case 'rack': if (s.rods.includes(c.id)) { s.rod = c.id; this._rodChanged(); this.tell(from, 'You take the ' + ROD_BY_ID[c.id].name + ' off the rack.', 'good'); } break;
      case 'chop': this.great.chop(c.arm, from); break;
      case 'greatHook': if (this.great.lev) this.great.lev.hooked = c.by; break;
      case 'krakenHook': if (this.great.kraken) this.great.kraken.hooked = c.by; break;
      case 'heard': s.heard[c.id] = true; if (VIGIL_FISHERMEN.every(k => s.heard[k])) this.award('legend', from); break;
      case 'admin': this._adminDo(c.cmd, c, P); break;
      case 'yard': { const x = this.loot.get(c.id); if (x) this._do({ t: 'yardPut', id: x.id }, from); break; }
      case 'trophyPick': {
        if (c.sp) { const d = s.dex[c.sp]; if (d) s.cabin.slots[c.slot] = { sp: c.sp, kg: d.bestKg, cm: d.bestCm }; }
        else s.cabin.slots[c.slot] = null;
        this._changed();
        break;
      }
      case 'buy': this._buy(c, from); break;
      case 'heldGiant': break;
      case 'tankHit': if (boat && boat.hull.fuel) { boat.ignite(boat.hull.fuel[0], boat.hull.fuel[2]); this.state.s.stats.fires++; this._everyone({ t: 'banner', title: 'THE FUEL TANK!', sub: 'Your rod hit the fuel tank. The boat is on fire!', icon: 'fire' }); } break;
    }
    return true;
  }

  tell(pid, text, kind = 'info') {
    if (pid === this.player.id || !this.net?.isOnline || pid === this.net.selfId) this.ui.toast(text, kind);
    else this.net.sendEvent({ t: 'toast', to: pid, text, kind });
  }

  _staminaHit(pid, n) {
    if (pid === this.player.id || pid === this.net?.selfId) this.fishing.assist(n);
    else this.net.sendEvent({ t: 'stamina', to: pid, n });
  }

  _changed() { this.cabin.update(); this._saveDirty = true; }

  /* ================= trophies ================= */
  /** Host: earn a trophy (once). Everyone hears about it. */
  award(id, pid = null) {
    if (!this.isHost || !TROPHY_BY_ID[id]) return false;
    if (!this.state.award(id)) return false;
    this._everyone({ t: 'trophy', id });
    this._saveDirty = true;
    return true;
  }
  /** An older save: hand out what it has already earned. */
  _backfillTrophies() {
    const s = this.state.s, A = id => this.state.award(id);
    if (s.stats.caught >= 1) A('first');
    if (s.stats.caught >= 50) A('fifty');
    if (s.stats.caught >= 250) A('seasoned');
    if (s.stats.earned >= 10000) A('coins');
    if (s.stats.earned >= 100000) A('hoard');
    for (const sp in s.dex) { const T = speciesTrophy(sp); if (T) A(T.id); if (s.dex[sp].vars?.includes('golden')) A('golden'); if (s.dex[sp].vars?.includes('abyssal')) A('abyssal'); if (FISH_BY_ID[sp]?.rarity === 'giant') A('giant'); }
    for (const id in s.levs) A('lev:' + id);
    for (const id in s.great) A('great:' + id);
    if (s.kraken.caught) A('kraken');
    if (s.flags.vigil) A('vigil');
  }
  _catchTrophies(sp, o) {
    const s = this.state.s;
    if (sp.rarity === 'junk') return;
    this.award('first', o.by);
    if (s.stats.caught >= 50) this.award('fifty', o.by);
    if (s.stats.caught >= 250) this.award('seasoned', o.by);
    const T = speciesTrophy(sp.id); if (T) this.award(T.id, o.by);
    if (o.v === 'golden') this.award('golden', o.by);
    if (o.v === 'abyssal') this.award('abyssal', o.by);
    if (sp.rarity === 'giant') this.award('giant', o.by);
  }

  /* ================= catching ================= */
  landCatch(o) {
    if (!this.isHost) { this.net.sendAction({ t: 'catch', sp: o.sp, kg: o.kg, cm: o.cm, pos: o.pos.toArray(), vel: o.vel.toArray(), slap: o.slap, size: o.size }); return; }
    const sp = FISH_BY_ID[o.sp];
    const it = this.loot.spawn({ sp: o.sp, kg: o.kg, cm: o.cm, pos: o.pos, vel: o.vel, by: o.by, v: o.v || null, zone: o.zone || 0, mult: o.mult || 1 });
    if (!it) return;
    // record first, announce second
    const junk = sp.rarity === 'junk' || sp.beh === 'mimic';
    const rec = junk && sp.beh !== 'chest' ? { isNew: false, record: false } : this.state.record(sp.id, o.kg, o.cm, o.v);
    if (sp.beh === 'bottle') { /* read on pickup */ }
    const value = fishValue(sp, o.kg, o.mult || 1);
    const card = { sp: sp.beh === 'mimic' ? 'chest' : sp.id, kg: o.kg, cm: o.cm, value: sp.beh === 'mimic' ? 0 : value, isNew: rec.isNew, record: rec.record, v: sp.beh === 'mimic' ? null : o.v || null, zone: o.zone || 0 };
    if (!o.quiet) this._cardTo(o.by, card);
    if (o.slap) this.slaps.push({ id: it.id, pid: o.by, t: 0 });
    // tutorial and clues
    if (this.state.s.tut === 1 && sp.rarity !== 'junk') this._tut(2);
    for (const L of LEVIATHANS) for (const cl of L.clues) {
      if (cl.type !== 'catch' || cl.species !== sp.id) continue;
      const P = this.playerById(o.by) || this.player;
      if (this.world.region(P.pos.x, P.pos.z) !== cl.region && this.world.region(o.pos.x, o.pos.z) !== cl.region) continue;
      if (cl.water === 'lake' && !this.isLake(o.pos.x, o.pos.z)) continue;
      this.foundClue(cl.id, o.by);
    }
    const tier = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 3, giant: 3, junk: 0 }[sp.rarity];
    if (tier >= 2) this.fx.confetti(o.pos.x, o.pos.y + 1, o.pos.z, 40 + tier * 20);
    if (!junk) this._catchTrophies(sp, o);
    Bus.emit('catch', { sp, it, by: o.by });
    this._saveDirty = true;
    return it;
  }
  _cardTo(pid, card) {
    if (pid === this.player.id || pid === this.net?.selfId || !this.net?.isOnline) this._showCard(card);
    else this.net.sendEvent({ t: 'card', to: pid, card });
  }
  _showCard(card) {
    const sp = FISH_BY_ID[card.sp];
    this.ui.catchCard(card);
    const tier = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 3, giant: 3, junk: 0 }[sp.rarity];
    this.audio.fanfare(tier);
    if (tier >= 1) this.player.cheerT = 2.2;
    if (tier >= 2) this.ui.banner(sp.rarity === 'legendary' ? 'LEGENDARY!' : sp.rarity === 'giant' ? 'A GIANT!' : sp.rarity === 'epic' ? 'EPIC CATCH!' : 'RARE CATCH!', sp.name, 'star', 2.5);
  }

  _creatureLanded(c, from) {
    if (c.id === 'great' || c.id === 'kraken') { this.great.landed(c.id, from); return; }
    if (c.id === 'lev') {
      const L = this.creatures.lev;
      if (!L) return;
      const def = L.def;
      this.creatures.lev = null;
      const first = this.state.catchLev(def.id);
      this.award('lev:' + def.id, from);
      if (first) {
        this.state.earn(def.reward, 'leviathan');
        const i = this.state.s.cabin.yard.findIndex(x => !x);
        if (i >= 0) this.state.s.cabin.yard[i] = { lev: def.id };
      } else this.state.earn(Math.round(def.reward * 0.2), 'leviathan');
      this.fx.eruption(L.pos.x, 0, L.pos.z, def.size * 0.4);
      for (let k = 0; k < 4; k++) this.fx.confetti(this.player.pos.x + (Math.random() - 0.5) * 6, this.player.pos.y + 2, this.player.pos.z + (Math.random() - 0.5) * 6, 80);
      this._everyone({ t: 'levCaught', id: def.id, first });
      this._changed();
      if (def.final && first) setTimeout(() => this._everyone({ t: 'ending' }), 6000);
      return;
    }
    const g = this.creatures.giants.get(c.id);
    this.creatures.giants.delete(c.id);
    const P = this.playerById(from) || this.player;
    const pos = (g ? g.pos.clone() : P.pos.clone()).setY(1);
    const target = P.pos.clone();
    const vel = new THREE.Vector3((target.x - pos.x) / 1.2, 7, (target.z - pos.z) / 1.2);
    this.landCatch({ sp: c.sp, kg: c.kg, cm: c.cm, pos, vel, by: from, size: 1 });
    this.fx.eruption(pos.x, 0, pos.z, 5);
  }

  /** Run something on every peer (and here). */
  _everyone(e) { this._event(this.player.id, e); this.net?.sendEvent(e); }

  _onPickup(it, P) {
    const sp = FISH_BY_ID[it.sp];
    if (sp.beh === 'bottle') {
      const text = this.state.nextBottle();
      this.loot.remove(it); P.held = null;
      this.state.addShelf('bottle');
      this._everyone({ t: 'bottle', text: text || 'The bottle is empty. Just a very old smell.' });
      this._changed();
    }
    if (sp.junk === 'duck') this.state.addShelf('duck');
    if (sp.junk === 'boot') this.state.addShelf('boot');
    if (sp.beh === 'eel' && !this.state.has('gloves')) { this.shock(P, it); }
  }

  _openChest(it, P, from) {
    if (!it) return;
    const sp = FISH_BY_ID[it.sp];
    if (sp.beh === 'mimic' && !it.opened) {
      it.opened = true; this.loot._mesh(it); it.flop = 15;
      it.vel.set(0, 4, 0);
      this.state.record('mimic', it.kg, it.cm);
      this.fx.splash(it.pos.x, it.pos.y, it.pos.z, 1);
      this.knockPlayer(P, P.pos.clone().sub(it.pos).setY(0).normalize(), 4, 'mimic');
      this.hurtPlayer(P, 15, 'mimic');
      this._everyone({ t: 'banner', title: 'IT BIT YOU!', sub: 'That was not a treasure chest. That was a Mimicfish.', icon: 'chest' });
      this._cardTo(from, { sp: 'mimic', kg: it.kg, cm: it.cm, value: fishValue(sp, it.kg), isNew: !this.state.s.dex.mimic || this.state.s.dex.mimic.n === 1 });
    } else if (sp.beh === 'chest') {
      const coins = 60 + Math.floor(Math.random() * 340);
      this.state.earn(coins, 'chest');
      const b = BAITS[1 + Math.floor(Math.random() * (BAITS.length - 1))];
      this.state.addBait(b.id, 3 + Math.floor(Math.random() * 4));
      this.fx.coins(it.pos.x, it.pos.y + 0.5, it.pos.z, 30);
      this.fx.confetti(it.pos.x, it.pos.y + 0.5, it.pos.z, 40);
      this.loot.remove(it);
      this.tell(from, `Treasure! ${coins} coins and some ${b.name}.`, 'good');
      if (Math.random() < 0.3) this.state.addShelf('gold');
      this._changed();
    }
  }

  /* ================= chaos ================= */
  explode(pos, kind = 'air', item = null, src = '') {
    if (!this.isHost) return;
    this._everyone({ t: 'boom', p: pos.toArray().map(v => +v.toFixed(2)), k: kind });
    this.state.s.stats.explosions++;
    for (const P of this.allPlayers()) {
      const d = P.pos.distanceTo(pos);
      if (d > 6) continue;
      const dir = P.pos.clone().sub(pos).setY(0);
      if (dir.lengthSq() < 0.01) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      dir.normalize();
      this.knockPlayer(P, dir, 7 * (1 - d / 7), 'explosion');
      this.hurtPlayer(P, 22 * (1 - d / 6), 'explosion');
    }
    for (const b of this.boats) {
      const d = Math.hypot(b.pos.x - pos.x, b.pos.z - pos.z);
      if (d > b.hull.hl + 5) continue;
      b.damage(26 * (1 - d / (b.hull.hl + 6)), 'explosion');
      b.impulse((b.pos.x - pos.x) / (d + 1) * 3, (b.pos.z - pos.z) / (d + 1) * 3, 0.8, 1.5);
      if (kind === 'air' && b.hull.fuel) {
        const f = b.toWorld(_v.set(b.hull.fuel[0], b.deck, b.hull.fuel[2]));
        if (f.distanceTo(pos) < 3.5) { b.ignite(b.hull.fuel[0], b.hull.fuel[2]); this.state.s.stats.fires++; this._everyone({ t: 'banner', title: 'THE FUEL TANK!', sub: 'The boat is on fire. Grab the bucket!', icon: 'fire' }); }
      }
      if (kind === 'air' && Math.random() < 0.35) b.ignite((Math.random() - 0.5) * b.hull.hw, (Math.random() - 0.5) * b.hull.hl);
    }
    for (const it of this.loot.items.values()) {
      if (it.held || it.state === 'cooler') continue;
      const d = it.pos.distanceTo(pos);
      if (d > 6 || it === item) continue;
      const push = it.pos.clone().sub(pos).normalize().multiplyScalar(9 * (1 - d / 6) / Math.sqrt(1 + it.kg / 10));
      if (it.boat) { const inv = new THREE.Matrix3().setFromMatrix4(it.boat.inv); push.applyMatrix3(inv); }
      it.vel.add(push); it.vel.y += 5 * (1 - d / 6);
      it.flop = Math.max(it.flop, 4);
    }
    // under the water: stunned fish float up
    if (kind === 'water') {
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const x = pos.x + (Math.random() - 0.5) * 8, z = pos.z + (Math.random() - 0.5) * 8;
        if (this.world.waterAt(x, z) === -Infinity) continue;
        const sp = pickSpecies({ region: this.world.region(x, z), water: this.isLake(x, z) ? 'lake' : 'sea', bait: 'worm', night: this.isNight() });
        if (sp.rarity === 'junk' || sp.beh) continue;
        const cc = rollCatch(sp);
        this.loot.spawn({ sp: sp.id, kg: cc.kg, cm: cc.cm, pos: new THREE.Vector3(x, this.world.sea(x, z) - 1, z), vel: new THREE.Vector3(0, 3, 0), stunned: true, flop: 0 });
      }
      this.ui.toast('Stunned fish are floating up - grab them with the net!', 'good');
    }
  }

  knockPlayer(P, dir, force, why) {
    if (P === this.player) { this.player.knock(dir, force, why); this.addShake(0.4 + force * 0.05); if (why === 'slap') this.state.s.stats.slapped++; this._tankCheck(); }
    else this.net?.sendEvent({ t: 'knock', to: P.id, d: dir.toArray(), f: force, why });
  }
  /** Falling over next to the fuel tank: your rod hits it. The boat catches fire. */
  _tankCheck() {
    const P = this.player, b = P.boat;
    if (!b || !b.hull.fuel || P.tool !== 'rod') return;
    const f = b.hull.fuel;
    if (Math.hypot(P.local.x - f[0], P.local.z - f[2]) > 1.8 || Math.random() > 0.55) return;
    if (this.isHost) this._do({ t: 'tankHit' }, P.id); else this.net.sendAction({ t: 'tankHit' });
  }
  hurtPlayer(P, n, why) {
    if (P === this.player) { this.player.hurt(n, why); this.ui.hurt(); this.audio.ouch(); }
    else this.net?.sendEvent({ t: 'hurt', to: P.id, n, why });
  }
  throwPlayer(P, from, force) {
    const dir = P.pos.clone().sub(from).setY(0).normalize();
    this.knockPlayer(P, dir, force + 4, 'thrown');
  }
  shock(P, it) {
    const pos = it ? it.pos : P.pos;
    this._everyone({ t: 'zap', p: pos.toArray() });
    if (P === this.player) {
      if (this.state.has('gloves') && Math.random() < 0.8) { this.ui.toast('Your gloves took the shock.', 'good'); return; }
      this.player.stunT = 1.3;
      this.dropHeld(this.player, true);
      this.hurtPlayer(this.player, 8, 'shock');
      this.ui.banner('ZAP!', 'Electric Eel. Maybe use gloves. Or a net. Or stop touching it.', 'alert', 2);
    } else this.net?.sendEvent({ t: 'shock', to: P.id });
  }
  shakeAll(a) { this.addShake(a); this.net?.sendEvent({ t: 'shake', a }); }
  addShake(a) { if (this.state.settings.shake) this.shake = Math.min(1.2, this.shake + a); }

  dropHeld(P, knocked = false) {
    if (!P.held) return;
    const it = this.loot.get(P.held);
    const pos = P === this.player ? (it ? it.pos.clone() : P.pos.clone().setY(P.pos.y + 1)) : P.pos.clone().setY(P.pos.y + 1);
    const vel = knocked ? new THREE.Vector3((Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3) : new THREE.Vector3();
    this.act({ t: 'drop', id: P.held, pos: pos.toArray(), vel: vel.toArray() });
    P.held = null;
  }
  dropAtFeet(it) {
    const P = this.player;
    this.act({ t: 'yank', id: it.id, to: P.pos.toArray() });
  }

  passOut(P, why) {
    if (P !== this.player || this.passing) return;
    this.passing = true;
    this.fishing.cancel(true);
    this.dropHeld(P, true);
    this.ui.fade(true, why === 'drown' ? 'You blacked out under the water...' : why === 'exhausted' ? 'Too tired to swim... someone fishes you out.' : 'Everything goes dark...');
    setTimeout(() => {
      const A = this.world.settlement.anchors;
      P.place(A.spawn.clone(), Math.PI);
      P.hp = 100; P.breath = P.maxBreath;
      const fee = Math.min(300, Math.round(this.state.s.money * 0.1));
      if (this.isHost && fee > 0) this.state.spend(fee);
      this.ui.fade(false);
      this.ui.toast(fee > 0 ? `You wake up at home. The doctor charged ${fee} coins.` : 'You wake up at home, soaked.', 'warn');
      this.passing = false;
    }, 2600);
  }

  /* ================= clues and leviathans ================= */
  foundClue(id, from) {
    if (!this.isHost) { this.net.sendAction({ t: 'clue', id }); return; }
    if (!this.state.addClue(id)) return;
    let L = null, clue = null;
    for (const l of LEVIATHANS) for (const c of l.clues) if (c.id === id) { L = l; clue = c; }
    if (!clue) return;
    if (clue.type === 'scale' || clue.type === 'mark') this.state.addShelf('clue:' + id);
    const ready = this.state.levReady(L);
    this._everyone({ t: 'clue', id, ready });
    if (this.state.s.tut === 5) this._tut(6);
    this._changed();
  }
  levAt(pos) {
    const s = this.state.s;
    for (const L of LEVIATHANS) {
      if (s.levs[L.id] || !this.state.levReady(L)) continue;
      const lu = L.lure;
      if (Math.hypot(pos.x - lu.x, pos.z - lu.z) > lu.r) continue;
      if (lu.time === 'night' && !this.isNight()) { this.ui.toast(L.name + ' only rises at night.', 'info'); continue; }
      if (lu.time === 'day' && this.isNight()) { this.ui.toast('Come back in daylight.', 'info'); continue; }
      if (lu.time === 'storm' && this.events.storm < 0.5) { this.ui.toast('The water here is waiting for a storm.', 'info'); continue; }
      const b = this.boats[0];
      if (lu.lights && (!b || b.stats.lights < lu.lights)) { this.ui.toast('It is too dark down there. You need lights on your boat.', 'warn'); continue; }
      if (ROD_BY_ID[s.rod].tier < L.rod) { this.ui.toast('Something huge sniffs at your line... your rod is not strong enough.', 'warn'); continue; }
      return L;
    }
    return null;
  }

  _checkZoneClues() {
    const P = this.player, s = this.state.s;
    const sonar = (P.boat && P.boat.stats.sonar > 0) || this.state.has('sonar');
    for (const L of LEVIATHANS) for (const c of L.clues) {
      if (s.clues[c.id]) continue;
      if (c.type !== 'sound' && c.type !== 'sonar') continue;
      if (Math.hypot(P.pos.x - c.at[0], P.pos.z - c.at[1]) > (c.r || 80)) continue;
      if (c.type === 'sound') {
        if (c.time === 'night' && !this.isNight()) continue;
        if (c.time === 'storm' && this.events.storm < 0.5) continue;
        this.audio.roar(0.35);
      } else if (!sonar) continue;
      this.foundClue(c.id, P.id);
    }
  }

  /* ================= economy ================= */
  /* Every island's fish seller buys: what you hold, what is lying at their
     feet, and the whole catch on your boat if it is tied up nearby.
     FAVOURITES ARE NEVER SOLD - not by "sell all", not one at a time. */
  _sellerPos(npcId) {
    const n = npcId && this.npcs.byId(npcId);
    return n ? n.pos : this.world.settlement.anchors.market.pos;
  }
  boatAtMarket(at = null) {
    const m = at || this.world.settlement.anchors.market.pos;
    const b = this.boats[0];
    return b && m && Math.hypot(b.pos.x - m.x, b.pos.z - m.z) < 55;
  }
  _canSell(it, at = null) {
    const m = at || this.world.settlement.anchors.market.pos;
    if (it.held) return true;
    if (it.boat && this.boatAtMarket(m)) return true;
    return m && it.pos.distanceTo(m) < 9;
  }
  sellable(at = null, withFavs = false) {
    const out = [];
    for (const it of this.loot.items.values()) {
      const sp = FISH_BY_ID[it.sp];
      if (!sp || sp.beh === 'chest' || (sp.beh === 'mimic' && !it.opened)) continue;
      if (it.fav && !withFavs) continue;
      if (this._canSell(it, at)) out.push(it);
    }
    return out.sort((a, b) => this.loot.value(b) - this.loot.value(a));
  }
  _sell(list, from, npc = null) {
    let total = 0, n = 0;
    const rows = [];
    for (const it of list) {
      if (!this.loot.items.has(it.id) || it.fav) continue;
      const v = this.loot.value(it);
      const sp = FISH_BY_ID[it.sp];
      const bd = valueBreakdown(sp, it.kg, it.zone || 0, it.v);
      rows.push({ sp: it.sp, v: it.v || null, kg: +it.kg.toFixed(2), zone: it.zone || 0, value: v, base: bd.base, size: +bd.size.toFixed(2), zm: bd.zone, vm: bd.variant });
      total += v; n++;
      if (it.held) { const P = this.playerById(it.held); if (P) P.held = null; }
      this.loot.remove(it);
    }
    if (!n) { if (npc) { const e = { t: 'receipt', to: from, npc, rows: [], more: 0, total: 0, purse: this.state.s.money }; if (from === this.player.id || !this.net?.isOnline) this._event(this.player.id, e); else this.net.sendEvent(e); } return; }
    this.state.earn(total, 'sell');
    this.audio.coin();
    const m = this._sellerPos(npc);
    this.fx.coins(m.x, m.y + 1.5, m.z, Math.min(40, 6 + n * 2));
    if (!npc) this.tell(from, `Sold ${n} for ${fmtInt(total)} coins.`, 'good');
    rows.sort((a, b) => b.value - a.value);
    const receipt = { t: 'receipt', to: from, npc, rows: rows.slice(0, 40), more: Math.max(0, rows.length - 40), total, purse: this.state.s.money };
    if (from === this.player.id || !this.net?.isOnline) this._event(this.player.id, receipt); else this.net.sendEvent(receipt);
    if (this.state.s.tut === 2) this._tut(3);
    this._saveDirty = true;
  }

  _buy(c, from) {
    const S = this.state, s = S.s;
    const ok = (price) => { if (!S.spend(price)) { this.tell(from, 'Not enough coins.', 'bad'); return false; } this.audio.buy(); return true; };
    const k = c.k, id = c.id;
    if (k === 'rod') { const R = ROD_BY_ID[id]; if (R && !s.rods.includes(id) && ok(R.price)) { s.rods.push(id); s.rod = id; this._rodChanged(); } }
    else if (k === 'equipRod') { if (s.rods.includes(id)) { s.rod = id; this._rodChanged(); } }
    else if (k === 'bait') { const B = BAIT_BY_ID[id]; if (B && ok(B.price * B.pack)) S.addBait(id, B.pack); }
    else if (k === 'setBait') { if ((s.baits[id] || 0) > 0) s.bait = id; }
    else if (k === 'tool') { const T = TOOL_BY_ID[id]; if (T && !s.tools[id] && ok(T.price)) { s.tools[id] = true; this.tell(from, T.name + ' - hotbar slot ' + T.slot, 'good'); } }
    else if (k === 'gear') { const Gd = GEAR_BY_ID[id]; if (Gd && !s.gear[id] && ok(Gd.price)) s.gear[id] = true; }
    else if (k === 'hull') { const H = HULL_BY_ID[id]; if (H && !s.hulls.includes(id) && ok(H.price)) { s.hulls.push(id); s.boat.hull = id; this._boatChanged(); } }
    else if (k === 'useHull') { if (s.hulls.includes(id)) { s.boat.hull = id; this._boatChanged(); } }
    else if (k === 'part') { const P = PART_BY_ID[id]; const lv = s.boat.parts[id] || 0; if (P && lv < P.max && ok(P.prices[lv + 1])) { s.boat.parts[id] = lv + 1; this._boatChanged(); } }
    else if (k === 'paint') { const P = PAINT_BY_ID[id]; if (P && !s.paints.includes(id) && ok(P.price)) { s.paints.push(id); s.boat.paint = id; this._boatChanged(); } }
    else if (k === 'applyPaint') { if (s.paints.includes(id)) { s.boat.paint = id; this._boatChanged(); } }
    else if (k === 'decor') { const D = DECOR_BY_ID[id]; if (D && !s.decorOwned.includes(id) && ok(D.price)) { s.decorOwned.push(id); s.boat.decor.push(id); this._boatChanged(); } }
    else if (k === 'toggleDecor') { if (s.decorOwned.includes(id)) { const i = s.boat.decor.indexOf(id); if (i >= 0) s.boat.decor.splice(i, 1); else s.boat.decor.push(id); this._boatChanged(); } }
    else if (k === 'repair') {
      const b = this.boats[0];
      const cost = Math.ceil((b.stats.hp - b.hp) * 0.6) + b.leaks.length * 15;
      if (cost > 0 && ok(cost)) { b.hp = b.stats.hp; b.leaks = []; b.water = 0; b.fires = []; this.tell(from, 'Good as new. Mostly.', 'good'); }
    }
    this._saveDirty = true;
  }
  _rodChanged() { this.vm.setRod(ROD_BY_ID[this.state.s.rod]); this.cabin.update(); }
  _boatChanged() {
    const b = this.boats[0];
    b.setConfig(this.state.s.boat);
    b.mooring = this.homeMooring();
    if (b.docked) b.respawn(false);
    for (const P of this.allPlayers()) if (P.boat === b) { P.local.y = b.deck; }
  }

  /* ================= time ================= */
  _sleep() {
    const s = this.state.s;
    this._everyone({ t: 'fade', on: true, text: 'Day ' + (s.day + 1) });
    setTimeout(() => {
      s.day++; this.tod = 0.27; s.tod = 0.27;
      this.player.hp = 100;
      this._everyone({ t: 'fade', on: false });
      this.state.save();
    }, 1800);
  }

  /* ================= tutorial / objectives ================= */
  _tut(n) {
    const s = this.state.s;
    if (s.tut >= n) return;
    s.tut = n;
    const o = this.objective();
    if (o) this.ui.banner(n >= 6 ? 'NEW GOAL' : 'NEXT', o.text, o.icon, 3.2);
    this._saveDirty = true;
  }
  objective() {
    const s = this.state.s;
    switch (s.tut) {
      case 0: return { icon: 'people', title: 'WELCOME TO DRIFTWOOD BAY', text: 'Talk to Old Gus. He is in the rocking chair on the porch of the tackle shop.' };
      case 1: return { icon: 'rod', title: 'YOUR FIRST FISH', text: 'Walk down to your dock, right outside your hut. Hold left mouse to cast, click when the bobber goes under, then hold to reel.' };
      case 2: return { icon: 'sell', title: 'SELL IT', text: 'Pim\'s fish stall is right next to your hut. Carry your fish over (F), talk to Pim (E) and sell it.' };
      case 3: return { icon: 'boat', title: 'TAKE THE BOAT OUT', text: 'Your rowboat is tied up at your dock. Step aboard and press E at the tiller.' };
      case 4: return { icon: 'crown', title: 'THE GUILD', text: 'Visit the Guild Hall up the hill and study the great map with Guildmaster Odessa.' };
      case 5: return { icon: 'eye', title: 'THE FIRST CLUE', text: 'Something has been chewing the little pier on Mirror Lake. Go and have a look (E).' };
    }
    const ready = LEVIATHANS.find(L => !s.levs[L.id] && this.state.levReady(L));
    if (ready) return { icon: 'target', title: ready.name.toUpperCase(), text: 'Its lure point is on the map. Cast a line there' + (ready.lure.time !== 'any' ? ' (' + ready.lure.time + ')' : '') + ' and be ready.' };
    const next = LEVIATHANS.find(L => !s.levs[L.id] && !L.final);
    if (!next) return s.levs.tidemother ? null : { icon: 'shard', title: 'THE DROWNED GATE', text: 'All eleven shards are home. Go to the Drowned Gate in the Blackwater, at night.' };
    const found = next.clues.filter(c => s.clues[c.id]).length;
    return { icon: 'crown', title: 'THE HUNT', text: `Clues for the creature in ${REGIONS[next.region].name}: ${found} of ${next.clues.length}. Check the guild map (J for your journal).` };
  }

  /* ================= photo ================= */
  takePhoto() {
    try {
      this.vm.visible = false;
      this.renderer.render(this.scene, this.camera);
      const src = this.renderer.domElement;
      const cv = document.createElement('canvas');
      cv.width = 320; cv.height = 180;
      const cx = cv.getContext('2d');
      const ar = src.width / src.height, w = src.height * 16 / 9;
      cx.drawImage(src, (src.width - Math.min(src.width, w)) / 2, 0, Math.min(src.width, w), src.height, 0, 0, 320, 180);
      this.vm.visible = true;
      this.ui.photoFlash();
      void ar;
      return cv.toDataURL('image/jpeg', 0.72);
    } catch (e) { this.vm.visible = true; return null; }
  }

  /* ================= the frame ================= */
  update(dt) {
    if (!this.running) return;
    const I = this.input, P = this.player, UI = this.ui;
    const blocked = I.blocked || UI.isOpen;
    this.tod = (this.tod + dt / 1080) % 1;
    if (this.tod < dt / 1080) this.state.s.day++;
    this.state.s.tod = this.tod;

    this._keys(blocked);
    P.update(dt, I, blocked);
    // hands
    const fishingActive = P.tool === 'rod' && !P.held && P.mode !== 'drive' && P.mode !== 'mount' && P.mode !== 'down' && P.mode !== 'swim';
    if (!fishingActive && this.fishing.active && this.fishing.state !== 'fight') this.fishing.cancel(true);
    if (P.mode === 'swim' && this.fishing.state === 'fight') this.fishing.cancel();
    this.fishing.update(dt, I, blocked || P.stunT > 0, fishingActive && P.stunT <= 0);
    this.tools.update(dt, I, blocked || P.stunT > 0);
    this._heldControls(blocked);
    this._interact(blocked);

    // host simulation
    const host = this.isHost;
    if (host) {
      for (const b of this.boats) b.simulate(dt, this.world);
      this.tools.hostHolders(dt);
      this._slaps(dt);
    }
    for (const b of this.boats) b.visuals(dt, this.fx, this.world, this._night());
    this.loot.update(dt, host);
    this.creatures.update(dt, host);
    this.great.update(dt, host);
    this.events.update(dt, host);
    this.npcs.update(dt);
    for (const r of this.remotes.values()) r.update(dt);
    this.cabin.update();
    this.fx.update(dt);

    // how far out are we? The world says so.
    this.zoneT = (this.zoneT || 0) - dt;
    if (this.zoneT <= 0) {
      this.zoneT = 0.5;
      const z = zoneAt(P.pos.x, P.pos.z, -this.world.height(P.pos.x, P.pos.z));
      if (z !== this.zone) {
        const was = this.zone ?? 0;
        this.zone = z;
        this._seenZone = this._seenZone || {};
        if (z > was && !this._seenZone[z] && z > 0) {
          this._seenZone[z] = true;
          const Z = ZONES[z];
          this.ui.banner(Z.name.toUpperCase(), Z.blurb + '  Fish here are worth x' + Z.value.toFixed(1) + '.', 'wave', 3.6);
          this.audio.eventSting('zone');
          const rod = ROD_BY_ID[this.state.s.rod];
          if (rod.tier < z) setTimeout(() => this.ui.toast('Your ' + rod.name + ' will struggle out here. Melvin sells stronger ones.', 'warn'), 3800);
        }
      }
      // the abyss in the dark with no lights: something keeps bumping the hull
      if (this.isHost && P.boat && this.zone >= 4 && P.boat.stats.lights < 1 && Math.random() < 0.06) {
        P.boat.impulse((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 0.6, 1);
        P.boat.damage(6, 'abyss');
        this.ui.toast('Something big just bumped the hull. You need lights out here.', 'bad');
        this.audio.crash();
      }
    }
    // clues nearby
    this.clueT -= dt;
    if (this.clueT <= 0) { this.clueT = 1; this._checkZoneClues(); }

    // camera
    P.applyCamera(this.camera);
    if (this.shake > 0) {
      const s = this.shake * 0.05;
      this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.rotation.z += (Math.random() - 0.5) * s * 0.5;
      this.shake = Math.max(0, this.shake - dt * 2);
    }
    const fov = this.state.settings.fov + (P.sprint && P.speed > 5 ? 4 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.1) { this.camera.fov = damp(this.camera.fov, fov, 6, dt); this.camera.updateProjectionMatrix(); }

    // world, sky, lights
    const reg = this.world.weights(P.pos.x, P.pos.z);
    const lights = (P.boat ? P.boat.stats.lights : 0) / 3;
    const edge = clamp((Math.max(Math.abs(P.pos.x), Math.abs(P.pos.z)) - 1150) / 150, 0, 1);
    const mist = mistAt(P.pos.x, P.pos.z);
    this.mist = mist;
    const env = { tod: this.tod, storm: this.world.storm, dark: reg.black * 0.95, frost: reg.frost, underwater: P.underwater, lights, edge, mist };
    // the first time anyone reaches Vigil's End
    if (mist > 0.93 && !this.state.s.flags.vigil && this.isHost) {
      this.state.s.flags.vigil = this.state.s.day;
      this.award('vigil');
      this._everyone({ t: 'banner', title: "VIGIL'S END", sub: 'The last island before the edge of the sea. Six old fishermen, waiting for something.', icon: 'light' });
    }
    this.world.extraLights = this.boats.filter(b => b.lampOn).map(b => b.lampSrc);
    const night = this._night();
    this.world.update(dt, this.camera.position, P.pos, env, night);
    this.world.darkAt = (x, z) => this.world.weights(x, z).black;
    const L = this.world.sky;
    this.vm.syncLights(L.sun.color, L.sun.intensity, L.hemi.color, L.hemi.groundColor, L.hemi.intensity);
    const vmState = { moving: P.speed > 0.5 && P.mode === 'walk', sprint: P.sprint, look: I.blocked ? { x: 0, y: 0 } : { x: I.mouse.dx * 0.0022, y: I.mouse.dy * 0.0022 }, fishing: this.fishing.hud(), busy: this.tools.busy, holding: !!P.held && P.mode !== 'swim', aim: false,
      swim: P.mode === 'swim' ? { moving: P.speed > 0.4, exhausted: P.exhausted } : null, walkie: this.voice.walkie };
    if (!this.vm.onStroke) this.vm.onStroke = () => this.audio.stroke();
    // a big fish on the line tugs the whole view, not just the rod
    if (this.fishing.state === 'fight') {
      const pull = this.fishing.pull || 0, k = Math.max(0, pull - 0.8) * 0.004 + Math.max(0, this.fishing.tension - 0.9) * 0.006;
      this._tug = (this._tug || 0) + dt * 17;
      this.camera.rotation.x += Math.sin(this._tug) * k; this.camera.rotation.z += Math.cos(this._tug * 0.8) * k;
    }
    this.vm.visible = P.mode !== 'drive' || true;
    this.vm.update(dt, vmState, this.camera);

    // audio
    this.audio.listener = this.camera.position;
    const b = P.boat;
    this.audio.update(dt, {
      nearWater: this.world.height(P.pos.x, P.pos.z) < 3 || !!b, storm: this.world.storm, frost: reg.frost > 0.5, height: P.pos.y,
      engine: !!(b && (b.driver || b.autopilot)), throttle: b ? b.throttle : 0, speed: b ? b.speed() : 0,
      night: this.isNight(), nearLand: this.world.height(P.pos.x, P.pos.z) > -5, underwater: P.underwater,
      fire: b && b.fires.length > 0, tense: !!this.creatures.lev || this.creatures.giants.size > 0 || (this.fishing.fish && this.fishing.fish.giant) || this.great.kraken?.phase === 'attack' || (!!this.great.lev && this.mist > 0.3),
      mist: this.mist,
    });

    // networking
    if (this.net?.isOnline) {
      const snap = P.snapshot();
      snap.f = this.fishing.state !== 'idle' ? { s: this.fishing.state, b: this.fishing.bpos.toArray().map(v => +v.toFixed(2)), t: +this.fishing.tension.toFixed(2) } : null;
      snap.name = this.state.settings.name;
      snap.wk = this.voice.walkie ? 1 : 0;
      snap.r = this.state.s.rod;
      this.net.sendPlayer(snap, dt);
      if (this.net.isHost) {
        this.net.sendWorld(() => this.worldSnapshot(), dt);
        this._saveSync = (this._saveSync || 0) - dt;
        if (this._saveSync <= 0) { this._saveSync = 2; const k = JSON.stringify(this.state.s); if (k !== this._lastSaveSent) { this._lastSaveSent = k; this.net.sendSave(this.state.s); } }
      }
      // what the host says we are holding
      if (!this.isHost) { let h = null; for (const it of this.loot.items.values()) if (it.held === this.net.selfId) h = it.id; if (!this._predictT || this._predictT < 0) P.held = h; this._predictT = (this._predictT || 0) - dt; }
    }
    // voice: distance gains, and the walkie-talkie while C is held
    const walkie = !!this.net?.isOnline && !this.chat.open && !UI.isOpen && !UI.talkEl && I.keys.has('KeyC');
    if (walkie !== this.voice.walkie) { this.voice.walkie = walkie; this.audio.radio(); }
    if (this.net?.isOnline && I.pressedRaw('KeyV') && !this.chat.open && !UI.isOpen) {
      this.voice.setMuted(!this.voice.muted);
      UI.toast(this.voice.muted ? 'Microphone muted (V)' : 'Microphone on', 'info');
    }
    this.voice.update(dt);
    UI.update(dt);
    // autosave
    this.saveT -= dt;
    if ((this.saveT <= 0 || this._saveDirty) && host && !this.state.remote) {
      if (this.saveT <= 0 || this._dirtyT === undefined || this._dirtyT <= 0) { this.save(); this.saveT = 30; this._saveDirty = false; this._dirtyT = 3; }
    }
    if (this._dirtyT > 0) this._dirtyT -= dt;
    I.endFrame();
  }

  _night() { const t = this.tod; return t < 0.2 || t > 0.84 ? 1 : t < 0.26 ? 1 - (t - 0.2) / 0.06 : t > 0.76 ? (t - 0.76) / 0.08 : 0; }

  save() {
    if (this.state.remote) return;
    const s = this.state.s, P = this.player, b = this.boats[0];
    s.player = { x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +P.yaw.toFixed(2), onBoat: !!P.boat };
    if (b) {
      s.boatPos = { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), h: +b.heading.toFixed(3), docked: b.docked && !b.stolen, hp: Math.round(b.hp) };
      s.boatCargo = this.loot.saveOnBoat(b).slice(0, 60);
    }
    this.state.save();
  }

  /* ================= input ================= */
  _keys(blocked) {
    const I = this.input, P = this.player, s = this.state.s;
    if (I.pressedRaw('Escape')) {
      if (this.ui.talkEl) this.ui.closeTalk();
      else if (this.ui.isOpen) { if (this.ui.screen === 'settings' || this.ui.screen === 'controls') this.ui.open('pause'); else this.ui.close(); }
      else this.ui.open('pause');
    }
    const combo = I.keys.has('KeyL');       // L is the first key of the admin combination: J, M and 3 wait
    if (I.pressedRaw('KeyJ') && !I.blocked && !combo) this.ui.isOpen && this.ui.screen === 'journal' ? this.ui.close() : this.ui.open('journal');
    if (I.pressedRaw('KeyM') && !I.blocked && !combo) this.ui.isOpen && this.ui.screen === 'map' ? this.ui.close() : this.ui.open('map');
    if ((I.pressedRaw('KeyI') || I.pressedRaw('Tab')) && !I.blocked) this.ui.isOpen && this.ui.screen === 'catch' ? this.ui.close() : this.ui.open('catch');
    if (blocked) return;
    if (I.pressed('KeyB')) this.ui.open('bait');
    // right-click a fish in your hands to make it a favourite (favourites are never sold)
    if (I.click(2) && P.held) {
      const it = this.loot.get(P.held);
      if (it) { this.act({ t: 'fav', id: it.id, on: !it.fav }); it.fav = !it.fav; this.ui.toast(it.fav ? catchName(FISH_BY_ID[it.sp], it.v) + ' is a favourite. It will never be sold.' : 'No longer a favourite.', it.fav ? 'good' : 'info'); this.audio.tone(it.fav ? 1320 : 660, 0.12, 'triangle', 0.08); }
    }
    // hotbar
    const pick = id => { if (!s.tools[id]) { this.ui.toast((TOOL_BY_ID[id]?.name || 'That') + ' - buy it at Melvin\'s.', 'warn'); return; } if (this.fishing.state === 'fight') return; P.tool = id; this.vm.setTool(id); this.audio.click(); };
    if (!combo) for (const T of TOOLS) if (I.pressed('Digit' + T.slot)) pick(T.id);
    if (I.mouse.wheel && this.fishing.state !== 'fight' && P.mode !== 'drive') {
      const owned = TOOLS.filter(T => s.tools[T.id]);
      const i = owned.findIndex(T => T.id === P.tool);
      const n = owned[(i + (I.mouse.wheel > 0 ? 1 : -1) + owned.length) % owned.length];
      if (n) { P.tool = n.id; this.vm.setTool(n.id); }
    }
  }

  _heldControls(blocked) {
    const I = this.input, P = this.player;
    if (blocked) return;
    if (I.pressed('KeyF')) {
      if (P.held) { const it = this.loot.get(P.held); this.act({ t: 'drop', id: P.held, pos: (it ? it.pos : P.pos).toArray(), vel: [0, 0, 0] }); P.held = null; this._predictT = 0.4; }
      else {
        const f = P.forward(_v).clone();
        const at = P.eye.clone().addScaledVector(f, 1.3);
        const it = this.loot.nearest(at, 1.8) || this.loot.nearest(P.pos, 1.6);
        if (it) {
          if (it.kg > 450) this.ui.toast('Way too heavy to move. Sell it where it lies.', 'warn');
          else { this.act({ t: 'pickup', id: it.id }); this._predictT = 0.4; }
        }
      }
    }
    if (!P.held && P.tool === 'axe' && I.click(0)) {
      const a = this.great.armNear(P.pos);
      if (a) this._chop(a); else { this.vm.play('chop'); this.audio.swoosh(); }
    }
    if (P.held && I.click(0)) {
      const it = this.loot.get(P.held);
      if (it) {
        const f = P.forward(_v).clone();
        const k = clamp(12 / Math.sqrt(1 + it.kg / 3), 2, 11);
        const vel = f.multiplyScalar(k).add(new THREE.Vector3(0, 2.5, 0));
        if (P.boat) { vel.x += P.boat.vel.x; vel.z += P.boat.vel.y; }
        this.act({ t: 'throw', id: it.id, pos: it.pos.toArray(), vel: vel.toArray() });
        this.audio.throw();
        P.held = null; this._predictT = 0.4;
      }
    }
  }

  /** Finds what E would do right now, shows the prompt, and does it on press. */
  _interact(blocked) {
    const I = this.input, P = this.player, UI = this.ui, s = this.state.s;
    if (blocked) { UI.prompt(null); return; }
    const E = I.pressed('KeyE');
    const key = `<span class="key">E</span>`;
    const opt = [];
    const f = P.forward(_v).clone();
    const look = P.eye.clone().addScaledVector(f, 1.5);
    const b = P.boat;
    if (P.mode === 'drive') opt.push({ label: 'Leave the helm', run: () => { this.act({ t: 'helm', boat: b.id, on: false }); P.mode = 'walk'; } });
    else if (P.mode === 'mount') opt.push({ label: 'Leave the harpoon gun', run: () => { P.mode = 'walk'; } });
    else if (P.mode === 'swim') opt.push({ label: 'Climb out', run: () => { if (!P.tryClimb()) UI.toast('Nothing to climb onto here.', 'info'); } });
    else {
      // a kraken arm over the rail comes before everything else
      const arm = this.great.armNear(P.pos);
      if (arm) {
        if (P.tool === 'axe') opt.push({ label: 'CHOP THE TENTACLE!', icon: 'axe', run: () => this._chop(arm) });
        else opt.push({ label: 'Get your axe out (0) and chop it!', icon: 'axe', run: () => { if (this.fishing.state === 'fight') this.fishing.cancel(); P.tool = 'axe'; this.vm.setTool('axe'); } });
      }
      const it = P.held ? this.loot.get(P.held) : null;
      if (it) {
        if (b && Math.hypot(P.local.x - b.hull.cooler[0], P.local.z - b.hull.cooler[2]) < 1.7) opt.push({ label: 'Put it in the cooler', run: () => this.act({ t: 'cooler', id: it.id }) });
        const slot = this.cabin.nearestSlot(look, 1.6);
        if (slot !== null && P.pos.distanceTo(this.world.settlement.anchors.cabinInside) < 5) opt.push({ label: 'Mount it on the wall', run: () => this.act({ t: 'mount', id: it.id, slot }) });
        const yard = this.world.settlement.cabin.yard.find(y => y.pos.distanceTo(P.pos) < 3);
        if (yard && it.kg > 20) opt.push({ label: 'Put it on display in the trophy yard', run: () => this.act({ t: 'yardPut', id: it.id }) });
      }
      // loot to open
      const lo = this.loot.nearest(look, 1.6, x => FISH_BY_ID[x.sp].beh === 'chest' || (FISH_BY_ID[x.sp].beh === 'mimic' && !x.opened));
      if (lo) opt.push({ label: 'Open the chest', run: () => this.act({ t: 'open', id: lo.id }) });
      // rod holders
      const H = this.tools.nearestHolder(P.eye);
      if (H && H.boat.holders?.[H.i]?.bite > 0 && !this.fishing.fish) opt.push({ label: 'Grab the bent rod!', run: () => this._grabHolder(H) });
      // traps
      const tr = this.tools.nearestTrap(P.pos, 3.6);
      if (tr) opt.push({ label: this.tools.trapReady(tr) ? 'Haul in the trap' : 'Haul in the trap (still empty)', run: () => this.act({ t: 'trapHaul', id: tr.id }) });
      // boat stations
      if (b) {
        const L = P.local;
        if (Math.hypot(L.x - b.hull.helm[0], L.z - b.hull.helm[2]) < 1.5) opt.push({ label: b.driver && b.driver !== P.id ? 'Someone else is steering' : 'Take the helm', run: () => { if (!b.driver || b.driver === P.id) { this.act({ t: 'helm', boat: b.id, on: true }); P.mode = 'drive'; this.fishing.cancel(true); } } });
        if (b.parts.mount && Math.hypot(L.x - b.hull.mount[0], L.z - b.hull.mount[2]) < 1.6) opt.push({ label: 'Man the harpoon gun', run: () => { P.mode = 'mount'; this.fishing.cancel(true); } });
      }
      // npcs
      const n = this.npcs.nearest(P.pos, 3.2);
      if (n) opt.push({ label: 'Talk to ' + n.def.full, icon: 'people', run: () => this._talk(n) });
      // inside the hut: the trophy you are looking at, the rods on the rack
      if (P.pos.distanceTo(this.world.settlement.anchors.cabinInside) < 6) {
        const near = P.eye.clone().addScaledVector(f, 1.2);
        const rk = this.cabin.rackNear(near, 0.9);
        if (rk) opt.push({ label: 'Take the ' + ROD_BY_ID[rk.id].name + ' off the rack', icon: 'rod', run: () => this.act({ t: 'rack', id: rk.id }) });
        const tr = this.state.pendingTrophies().length ? null : this.cabin.trophyNear(near, 0.45);
        if (tr) opt.push({ label: TROPHY_BY_ID[tr.id].name, icon: 'trophy', run: () => this.ui.subtitle(TROPHY_BY_ID[tr.id].name + ' - ' + TROPHY_BY_ID[tr.id].text, 6) });
      }
      // world interactables
      for (const X of this.world.settlement.interact) {
        if (!(X.pos.distanceTo(P.pos) < X.r || X.pos.distanceTo(look) < X.r * 0.8)) continue;
        let label = X.label, icon = null;
        if (X.kind === 'bookcase') { const k = this.state.pendingTrophies().length; label = k ? `Put ${k} new troph${k > 1 ? 'ies' : 'y'} on the bookcase` : 'Your trophy bookcase (' + Object.keys(s.trophies.placed).length + ')'; icon = 'trophy'; }
        opt.push({ label, icon, run: () => this._useX(X) });
      }
      // physical clues
      for (const k in this.world.settlement.clues) {
        const C = this.world.settlement.clues[k];
        if (C.zone || s.clues[k]) continue;
        if (C.pos.distanceTo(P.pos) < C.r + 1.5) opt.push({ label: 'Inspect: ' + C.label, icon: 'eye', run: () => this.foundClue(k, P.id) });
      }
    }
    const o = opt[0];
    UI.prompt(o ? `${key}${ic(o.icon || 'hands')} ${o.label}` : null);
    if (E && o) o.run();
  }

  _grabHolder(H) {
    const R = H.boat.holders[H.i];
    if (!R || !R.c) return;
    const c = R.c;
    R.bite = 0; R.c = null; R.t = 30 + Math.random() * 30;
    const P = this.player;
    P.tool = 'rod'; this.vm.setTool('rod');
    const F = this.fishing;
    F.bpos.copy(H.boat.toWorld(new THREE.Vector3(0, 0, -H.boat.hull.hl - 8)));
    F.bpos.y = this.world.sea(F.bpos.x, F.bpos.z);
    F.water = this.isLake(F.bpos.x, F.bpos.z) ? 'lake' : 'sea';
    F.pending = c;
    F._hook();
  }

  _useX(X) {
    const s = this.state.s;
    if (X.kind === 'guildmap') { this.ui.open('guild'); if (s.tut === 4) this._tut(5); }
    else if (X.kind === 'bed') { if (this.tod > 0.72 || this.tod < 0.2) this.act({ t: 'sleep' }); else this.ui.toast('It is too early to sleep. Go fishing.', 'info'); }
    else if (X.kind === 'journal') this.ui.open('journal');
    else if (X.kind === 'trophyboard') this.ui.open('trophy', {});
    else if (X.kind === 'bookcase') {
      if (this.state.pendingTrophies().length) { this.act({ t: 'placeTrophies' }); this.vm.play('throw'); }
      else this.ui.toast(Object.keys(s.trophies.placed).length ? 'Look at a trophy to read about it. Earn more and they will join it here.' : 'Empty, for now. Catch rare fish, reach far islands and survive monsters - every trophy you earn goes here.', 'info');
    }
    else if (X.kind === 'map') this.ui.open('map');
    else if (X.kind === 'bell') { this.audio.bell(); this.audio.tone(392, 3, 'sine', 0.12, 0.01, 1, 0.2); this.ui.subtitle('The bell rings out over the fog. Somewhere far off, something answers - or it is only the echo off the rocks.', 5); }
    else if (X.kind === 'cairns') this.ui.subtitle('Eli Wren. The Kettle brothers. Sarah Moore and the Bright Promise. Every stone is a boat that went looking for the great ones and did not come home.', 8);
    else if (X.kind === 'gate') {
      if (s.levs.tidemother) this.ui.toast('The Heart hums quietly beneath the water.', 'info');
      else if (s.shards >= 11) this.ui.toast('The runes blaze. Cast your line into the water beneath the Gate - at night.', 'good');
      else this.ui.toast(`The runes flicker. ${s.shards} of 11 shards have come home.`, 'info');
    }
  }

  _chop(arm) {
    this.vm.play('chop'); this.audio.swoosh();
    const now = this.world.time;
    if (now - (this._chopT || -9) < 0.45) return;
    this._chopT = now;
    setTimeout(() => this.act({ t: 'chop', arm: arm.id }), 170);
  }

  /* ================= conversations =================
     Talking is a conversation, not a shop window: the person says
     something, you pick what to say back (click it, or press its number),
     and they answer in their own voice. Fish sellers on every island buy
     your catch and sell the rods for their stretch of water. */
  _talk(n) {
    const d = n.def, role = d.role;
    this.audio.tone(220 + Math.random() * 80, 0.12, 'triangle', 0.06);
    if (this.state.s.tut === 0 && d.id === 'gus') this._tut(1);
    n.talking = 5;
    if (role === 'seller') return this._sellerMenu(n, pick(d.say.hello));
    if (role === 'vigil') return this._vigilTalk(n);
    const line = this.npcs.talk(n);
    const opts = [];
    if (role === 'tackle') opts.push({ label: 'Show me the bait and gear', icon: 'rod', cb: () => this.ui.open('tackle') });
    if (role === 'boatyard') opts.push({ label: 'Let me see the boats', icon: 'boat', cb: () => this.ui.open('boatyard') });
    if (role === 'guild') opts.push({ label: 'The Guild Map, please', icon: 'crown', cb: () => { this.ui.open('guild'); if (this.state.s.tut === 4) this._tut(5); } });
    opts.push({ label: 'Tell me more', icon: 'ear', cb: () => this._talk(n) });
    opts.push({ label: 'Never mind', bye: true });
    this.ui.dialogue(n, line, opts);
  }

  _sellerMenu(n, line) {
    const d = n.def, say = d.say;
    const opts = [
      { label: 'Sell all fish', icon: 'sell', cb: () => this._dSellAll(n) },
      { label: 'Sell the fish I\'m holding', icon: 'fish', cb: () => this._dSellHeld(n) },
      { label: 'View fishing rods', icon: 'rod', cb: () => this._dRods(n) },
    ];
    if (d.extra) opts.push({ label: d.extra.label, icon: d.extra.icon, cb: () => this.ui.open(d.extra.arg) });
    if (d.lore) opts.push({ label: 'Tell me more', icon: 'ear', cb: () => this._sellerMenu(n, this.npcs.talk(n)) });
    opts.push({ label: 'Never mind', bye: true, line: pick(say.bye) });
    this.ui.dialogue(n, line, opts);
  }
  _dSellAll(n) {
    const say = n.def.say, at = n.pos;
    const list = this.sellable(at), favs = this.sellable(at, true).length - list.length;
    if (!list.length) return this._sellerMenu(n, favs ? pick(say.fav) : pick(say.nothing));
    this._pendingSale = { npc: n.def.id, favs };
    this.act({ t: 'sellAll', at: n.def.id });
  }
  _dSellHeld(n) {
    const say = n.def.say, P = this.player;
    const it = P.held ? this.loot.get(P.held) : null;
    if (!it) return this._sellerMenu(n, pick(say.empty));
    if (it.fav) return this._sellerMenu(n, pick(say.fav));
    this._pendingSale = { npc: n.def.id, one: catchName(FISH_BY_ID[it.sp], it.v), favs: 0 };
    this.act({ t: 'sell', id: it.id, at: n.def.id });
  }
  /** The seller's answer, once the host has counted the money. */
  _saleDone(e) {
    const n = this.npcs.byId(e.npc);
    if (!n || !this.ui.talkEl || this.ui.talkNpc !== n) { this.ui.open('receipt', { rows: e.rows, more: e.more, total: e.total, purse: e.purse }); return; }
    const say = n.def.say, ps = this._pendingSale || {};
    const count = e.rows.length + (e.more || 0);
    let line = !count ? pick(say.nothing) : ps.one ? fill(pick(say.soldOne), { fish: ps.one, total: fmtInt(e.total) }) : fill(pick(say.sold), { n: count, total: fmtInt(e.total) });
    if (count && ps.favs) line += ' ' + pick(say.favSome);
    this._pendingSale = null;
    this._sellerMenu(n, line);
    if (count) this.ui.dialogueReceipt(e);
  }
  _dRods(n, line = null) {
    const d = n.def, say = d.say, s = this.state.s;
    const here = RODS.filter(R => R.shop === d.shop);
    const opts = here.map(R => {
      const own = s.rods.includes(R.id);
      return { label: R.name + (own ? (s.rod === R.id ? '  -  in your hands' : '  -  owned') : '  -  ' + fmtInt(R.price) + ' coins'), icon: 'rod', rod: R.id, dim: own,
        cb: () => {
          if (own) { this.act({ t: 'buy', k: 'equipRod', id: R.id }); return this._dRods(n, 'Take it. It is yours already.'); }
          if (s.money < R.price) return this._dRods(n, fill(pick(say.broke), { price: fmtInt(R.price) }));
          this.act({ t: 'buy', k: 'rod', id: R.id });
          setTimeout(() => this._dRods(n, fill(pick(say.bought), { rod: R.name })), 120);
        } };
    });
    // where the next rods are sold, so you know where to go
    const best = here.reduce((a, R) => Math.max(a, R.tier), 0);
    const next = RODS.find(R => R.tier > best && R.shop !== d.shop);
    opts.push({ label: 'Back', icon: 'arrow', cb: () => this._sellerMenu(n, pick(say.hello)) });
    const tail = next ? '  Stronger rods than these? ' + SHOPS[next.shop].seller + '.' : '';
    this.ui.dialogue(n, (line || pick(say.rods)) + tail, opts);
  }
  _vigilTalk(n) {
    const line = this.npcs.talk(n);
    if (!this.state.s.heard[n.def.id]) this.act({ t: 'heard', id: n.def.id });
    const more = n.line % n.def.lines.length !== 0;
    this.ui.dialogue(n, line, [
      { label: more ? 'Go on...' : 'Tell me again, from the start', icon: 'ear', cb: () => this._vigilTalk(n) },
      { label: 'Have you seen it?', icon: 'leviathan', cb: () => this.ui.dialogue(n, this.great.lev ? 'It is up. Right now. Can you not feel it? Go - before it goes down again.' : pick(['Not in years. Not in years.', 'No. But the water remembers it.', 'Seen it? I have seen the fog go still. That is close enough for me.']), [{ label: 'Go on...', icon: 'ear', cb: () => this._vigilTalk(n) }, { label: 'Never mind', bye: true }]) },
      { label: 'Never mind', bye: true },
    ]);
  }

  /* ================= the admin / playtest panel (host side) ================= */
  static get TELEPORTS() {
    return [
      { id: 'home', name: 'Your hut', at: () => this._inst.world.settlement.anchors.spawn },
      { id: 'harbour', name: 'Driftwood harbour', at: () => this._inst.world.settlement.anchors.pierEnd },
      { id: 'mirror', name: 'Mirror Lake pier', at: () => this._inst.world.settlement.anchors.lakePier },
      { id: 'frost', name: 'Frostbite Lake', at: () => this._inst.world.settlement.anchors.frostLanding },
      { id: 'tropic', name: 'Sunken Coast (Coco)', at: () => this._inst.world.settlement.anchors.tikiFront },
      { id: 'light', name: 'Old Lighthouse', at: () => this._inst.world.settlement.anchors.lighthouse.pos },
      { id: 'offshore', name: 'Offshore - the kraken zone', water: [60, 740] },
      { id: 'black', name: 'The Blackwater', water: [-600, 760] },
      { id: 'vigil', name: "Vigil's End", at: () => this._inst.world.settlement.anchors.vigilLanding },
      { id: 'vigilsea', name: "Vigil's End - the rock field (boat)", water: [860, 850] },
    ];
  }
  /** Put yourself somewhere; water spots bring your boat along. */
  teleport(id) {
    const T = Game.TELEPORTS.find(t => t.id === id);
    if (!T) return;
    const P = this.player, b = this.boats[0];
    this.fishing.cancel(true);
    if (T.water) {
      const [x, z] = T.water;
      if (this.isHost && b) { b.pos.set(x, 0, z); b.vel.set(0, 0); b.docked = false; b.stolen = false; b.autopilot = null; b._updateMatrix(); P.attach(b, new THREE.Vector3(0, b.deck, 0)); }
      else P.place(new THREE.Vector3(x, 0, z), P.yaw);
    } else { const p = T.at(); if (p) P.place(p.clone().add(new THREE.Vector3(0, 0.1, 0)), P.yaw); }
    this.world.prebuild(P.pos.x, P.pos.z);
    this.ui.toast('Teleported: ' + T.name, 'info');
  }
  _adminDo(cmd, c, P) {
    const s = this.state.s, b = this.boats[0];
    switch (cmd) {
      case 'spawnGreat': if (this.great.lev) this.great.lev = null; this.great.spawnLev(c.id); s.flags.vigil = s.flags.vigil || s.day; break;
      case 'spawnKraken': {
        if (this.great.kraken) this.great.kraken = null;
        if (b && P.boat !== b) { b.pos.set(P.pos.x + 4, 0, P.pos.z); if (this.world.height(b.pos.x, b.pos.z) > -1) b.pos.set(60, 0, 740); b.docked = false; b._updateMatrix(); if (P === this.player) P.attach(b, new THREE.Vector3(0, b.deck, 0)); }
        this.great.krakenCool = 0; this.great.startKraken(b);
        break;
      }
      case 'giveRod': if (ROD_BY_ID[c.id] && !s.rods.includes(c.id)) s.rods.push(c.id); s.rod = c.id; this._rodChanged(); break;
      case 'allRods': for (const R of RODS) if (!s.rods.includes(R.id)) s.rods.push(R.id); this._rodChanged(); break;
      case 'giveFish': {
        const sp = FISH_BY_ID[c.sp]; if (!sp) break;
        const cc = rollCatch(sp, Math.random, 0.5, c.zone || 0);
        const pos = (P.boat ? P.boat.toWorld(new THREE.Vector3(0, P.boat.deck + 1, 0)) : P.pos.clone().addScaledVector(P.flatForward(new THREE.Vector3()), 1.4).add(new THREE.Vector3(0, 1, 0)));
        this.landCatch({ sp: sp.id, kg: cc.kg, cm: cc.cm, pos, vel: new THREE.Vector3(0, 1.5, 0), by: P.id, size: cc.size, v: c.v || cc.v, zone: cc.zone, mult: cc.mult * (c.v && VARIANT_BY_ID[c.v] ? VARIANT_BY_ID[c.v].mult / (cc.v ? VARIANT_BY_ID[cc.v].mult : 1) : 1) });
        break;
      }
      case 'money': if (c.set) { s.money = Math.max(0, Math.round(c.n)); } else this.state.earn(Math.max(0, Math.round(c.n)), 'admin'); break;
      case 'resetBoat': if (b) { const on = P.boat === b; b.respawn(false); b.hp = b.stats.hp; if (on) P.attach(b, new THREE.Vector3(0, b.deck, 0)); } break;
      case 'resetChar': P.hp = 100; P.stamina = P.maxStamina; P.exhausted = false; P.breath = P.maxBreath; if (P === this.player) { P.place(this.world.settlement.anchors.spawn.clone(), Math.PI); this.fishing.cancel(true); } break;
      case 'clearInv': for (const it of [...this.loot.items.values()]) this.loot.remove(it); P.held = null; break;
      case 'allTrophies': for (const id in TROPHY_BY_ID) this.state.award(id); this.cabin.placeAll(); this._changed(); break;
      case 'clearTrophies': s.trophies = { got: {}, placed: {} }; this._changed(); break;
      case 'tools': for (const T of TOOLS) s.tools[T.id] = true; for (const g in GEAR_BY_ID) s.gear[g] = true; break;
      case 'tod': this.tod = c.v; break;
      case 'event': this.events.start(c.id, P.pos); break;
    }
    this._saveDirty = true;
  }

  driveInput(b, th, st) {
    if (this.isHost) b.control(th, st);
    else { b.throttle = th; b.steer = st; this._driveT = (this._driveT || 0) - 1 / 60; if (this._driveT <= 0) { this._driveT = 0.05; this.net.sendAction({ t: 'drive', boat: b.id, th, st }); } }
  }

  _slaps(dt) {
    for (let i = this.slaps.length - 1; i >= 0; i--) {
      const S = this.slaps[i];
      S.t += dt;
      const it = this.loot.get(S.id), P = this.playerById(S.pid);
      if (!it || !P || S.t > 1.5) { this.slaps.splice(i, 1); continue; }
      if (it.pos.distanceTo(P.eye) < 1.0) {
        const dir = new THREE.Vector3(it.vel.x, 0, it.vel.z).normalize();
        this.knockPlayer(P, dir, 4.5, 'slap');
        this._everyone({ t: 'banner', title: 'SLAP!', sub: 'The fish launched itself into ' + (P === this.player ? 'your' : (P.name || 'their')) + ' face.', icon: 'hands' });
        it.vel.multiplyScalar(-0.3);
        this.slaps.splice(i, 1);
      }
    }
  }

  /* ================= bus: reactions ================= */
  _bus() {
    Bus.on('boat:sink', ({ boat }) => {
      if (!this.isHost) return;
      this.state.s.stats.sunk++;
      for (const P of this.allPlayers()) if (P.boat === boat) {
        if (P === this.player) { P.detach(); P.mode = 'swim'; P.vel.set((Math.random() - 0.5) * 3, 2, (Math.random() - 0.5) * 3); }
        else this.net?.sendEvent({ t: 'overboard', to: P.id });
      }
      this._everyone({ t: 'banner', title: 'SHE IS GOING DOWN!', sub: 'Abandon ship! Marge will tow what is left back to the harbour.', icon: 'leak' });
    });
    Bus.on('boat:towed', () => {
      if (!this.isHost) return;
      const fee = Math.min(500, Math.max(20, Math.round(this.state.s.money * 0.1)));
      this.state.spend(Math.min(fee, this.state.s.money));
      this._everyone({ t: 'radio', text: `Radio: Marge here. Towed your boat home. That will be ${fee} coins, thank you very much.` });
    });
    Bus.on('boat:fire', () => { if (this.isHost) this.state.s.stats.fires++; });
    Bus.on('boat:leak', ({ boat }) => { if (this.player.boat === boat) this.ui.toast('The hull cracked - a leak! Use the hammer on it.', 'bad'); });
    Bus.on('boat:crash', ({ boat, force }) => {
      this.audio.crash();
      if (this.player.boat === boat) { this.addShake(0.3 + force * 0.05); if (force > 6) this.knockPlayer(this.player, this.player.flatForward(new THREE.Vector3()).clone(), force * 0.6, 'crash'); }
    });
    Bus.on('boat:wave', ({ boat }) => { if (this.player.boat === boat) this.ui.toast('These waves are too big for this boat!', 'bad'); });
    Bus.on('player:overboard', () => { this.state.s.stats.overboard++; this.ui.banner('OVERBOARD!', 'Swim back and press E at the hull to climb aboard.', 'wave', 2.5); this.audio.splash(1.5); });
    Bus.on('player:knocked', () => this.audio.ouch());
    Bus.on('player:swim', ({ p }) => {
      if (p !== this.player || this._swimTold) return;
      this._swimTold = true;
      this.ui.toast('Deep water. You can only swim for about ten seconds - boats go farther.', 'warn');
    });
    Bus.on('player:exhausted', ({ p }) => { if (p === this.player) { this.ui.banner('EXHAUSTED', 'Your arms are done. Get to a boat or the shore.', 'wave', 2.6); this.audio.ouch(); } });
    Bus.on('bomb:lit', ({ it }) => { if (this.isHost) this._everyone({ t: 'toast', text: 'The Bombfish fuse is lit! THROW IT!', kind: 'bad' }); });
    Bus.on('loot:escaped', ({ it }) => { if (this.isHost && it.held == null) this._everyone({ t: 'toast', text: (FISH_BY_ID[it.sp]?.name || 'A fish') + ' flopped back into the water and swam off.', kind: 'warn' }); });
    Bus.on('loot:floataway', ({ it }) => { if (this.isHost) this._everyone({ t: 'toast', text: 'The puffer floated off into the sky. Bye!', kind: 'warn' }); });
    Bus.on('lev:rise', ({ lev }) => this._everyone({ t: 'levRise', id: lev.id }));
    Bus.on('lev:tired', ({ lev }) => this._everyone({ t: 'banner', title: 'IT IS EXHAUSTED!', sub: 'Cast your line near it NOW!', icon: 'hook' }));
    Bus.on('money', ({ delta }) => {
      if (delta > 0) this.audio.coin();
      if (delta > 0 && this.running) { if (this.state.s.stats.earned >= 10000) this.award('coins'); if (this.state.s.stats.earned >= 100000) this.award('hoard'); }
    });
  }

  /* ================= network glue ================= */
  worldSnapshot() {
    return {
      tod: +this.tod.toFixed(4), day: this.state.s.day, wt: +this.world.time.toFixed(2),
      boats: this.boats.map(b => b.snapshot()), loot: this.loot.snapshot(), cr: this.creatures.snapshot(), ev: this.events.snapshot(), gr: this.great.snapshot(),
      traps: [...this.tools.traps.values()].map(({ mesh, ...o }) => o), holes: [...this.tools.holes.values()].map(({ mesh, ...o }) => o),
      holders: this.boats.map(b => (b.holders || []).map(h => +(h.bite > 0))),
    };
  }
  applyWorld(w, dt = 0.1) {
    if (!this.running || !this.creatures) return;
    this.tod = w.tod;
    this.world.time += (w.wt - this.world.time) * 0.2;
    for (const s of w.boats) { const b = this.boatById(s.id); if (b) b.applySnapshot(s, dt); }
    this.loot.applySnapshot(w.loot);
    this.creatures.applySnapshot(w.cr, dt);
    this.events.applySnapshot(w.ev);
    this.great.applySnapshot(w.gr);
    const tIds = new Set(w.traps.map(t => t.id));
    for (const t of w.traps) this.tools.addTrap(t);
    for (const id of [...this.tools.traps.keys()]) if (!tIds.has(id)) this.tools.removeTrap(id);
    for (const h of w.holes) this.tools.addHole(h);
    this.boats.forEach((b, i) => { b.holders = (w.holders[i] || []).map(x => ({ bite: x ? 1 : 0, c: null })); });
  }

  /** Handle a network event from `from`, or a local _everyone call. */
  _event(from, e) {
    if (!this.running) return;
    const me = this.player.id === from;
    const forMe = !e.to || e.to === this.net?.selfId || e.to === this.player.id;
    if (!forMe) return;
    switch (e.t) {
      case 'toast': this.ui.toast(e.text, e.kind); break;
      case 'radio': this.ui.radio(e.text); break;
      case 'banner': this.ui.banner(e.title, e.sub, e.icon); break;
      case 'card': this._showCard(e.card); break;
      case 'knock': this.player.knock(new THREE.Vector3(...e.d), e.f, e.why); this.addShake(0.4); break;
      case 'hurt': this.player.hurt(e.n, e.why); this.ui.hurt(); break;
      case 'shock': this.player.stunT = 1.3; this.dropHeld(this.player, true); this.player.hurt(8, 'shock'); this.ui.banner('ZAP!', 'Electric Eel!', 'alert', 2); break;
      case 'stamina': this.fishing.assist(e.n); break;
      case 'overboard': this.player.detach(); this.player.mode = 'swim'; break;
      case 'shake': this.addShake(e.a); break;
      case 'boom': { const p = new THREE.Vector3(...e.p); if (e.k === 'water') this.fx.eruption(p.x, this.world.sea(p.x, p.z), p.z, 3); this.fx.explosion(p.x, p.y + (e.k === 'water' ? 0.3 : 0), p.z, 1); this.audio.explosion(1, p); this.addShake(Math.max(0, 0.9 - this.player.pos.distanceTo(p) / 20)); break; }
      case 'zap': { const p = new THREE.Vector3(...e.p); this.fx.shock(p.x, p.y, p.z); this.audio.zap(); break; }
      case 'fx': if (e.k === 'erupt') this.fx.eruption(e.p[0], 0, e.p[2], e.s); break;
      case 'spear': if (!me) this.tools.ghostSpear(e.o, e.d, !!e.m); break;
      case 'chat': if (!me) { this.chat.push({ name: String(e.name || this.remotes.get(from)?.name || 'Fisher'), text: String(e.text || ''), color: this.remotes.get(from)?.color || '#e8e0c8' }); this.audio.tone(760, 0.06, 'triangle', 0.05); } break;
      case 'bottle': this.ui.banner('A MESSAGE IN A BOTTLE', '', 'bottle', 2); this.ui.subtitle(e.text, 10); break;
      case 'clue': {
        let L = null, c = null;
        for (const l of LEVIATHANS) for (const x of l.clues) if (x.id === e.id) { L = l; c = x; }
        if (!c) break;
        this.ui.banner('CLUE FOUND', c.text, { mark: 'eye', scale: 'scale', sound: 'ear', sonar: 'ping', catch: 'hook' }[c.type], 4.5);
        this.audio.eventSting('clue');
        if (e.ready) setTimeout(() => this.ui.banner(L.name.toUpperCase(), 'Every clue found. Its lure point is now marked on the guild map.', 'target', 5), 4800);
        break;
      }
      case 'levRise': { const L = LEV_BY_ID[e.id]; this.ui.banner(L.name.toUpperCase(), L.title, 'crown', 4); this.audio.eventSting('lev'); this.addShake(1); this.ui.radio('Radio: WHAT IS THAT?! Everybody hold on to something!'); break; }
      case 'levCaught': {
        const L = LEV_BY_ID[e.id];
        this.ui.banner('LEVIATHAN CAUGHT!', L.name + (e.first ? ' - a shard of the Heart comes home.' : ''), 'crown', 6);
        this.audio.fanfare(3);
        if (e.first) setTimeout(() => this.ui.subtitle(L.story, 12), 3000);
        break;
      }
      case 'ending': this.ui.open('ending'); break;
      case 'receipt': if (e.npc) this._saleDone(e); else this.ui.open('receipt', { rows: e.rows, more: e.more, total: e.total, purse: e.purse }); break;
      case 'trophy': { const T = TROPHY_BY_ID[e.id]; if (T) { this.ui.trophyToast(T); this.audio.fanfare(T.size === 'L' ? 3 : 1); } break; }
      case 'greatSpawn': {
        const D = GREAT_BY_ID[e.id];
        this.ui.worldEvent('A LEVIATHAN HAS BEEN SPOTTED', "near Vigil's End", D ? D.name : '');
        this.audio.horn();
        this.chat.system('A leviathan has been spotted near Vigil\'s End.');
        break;
      }
      case 'greatLeave': { const D = GREAT_BY_ID[e.id]; this.ui.banner(D ? D.name.toUpperCase() : 'THE LEVIATHAN', 'It sinks back into the deep. Nobody knows when it will come up again.', 'leviathan', 5); break; }
      case 'greatFx': {
        const d = Math.hypot(this.player.pos.x - e.x, this.player.pos.z - e.z);
        if (e.k === 'breach') { this.fx.eruption(e.x, this.world.sea(e.x, e.z), e.z, 18); setTimeout(() => this.fx.eruption(e.x, this.world.sea(e.x, e.z), e.z, 22), 4200); this.audio.roar(Math.max(0.2, 1 - d / 900)); if (d < 500) this.addShake(Math.max(0, 0.8 - d / 600)); }
        if (e.k === 'rise') { this.fx.eruption(e.x, this.world.sea(e.x, e.z), e.z, 10); if (d < 700) this.audio.roar(Math.max(0.15, 0.7 - d / 1000)); }
        if (e.k === 'dive') this.fx.eruption(e.x, this.world.sea(e.x, e.z), e.z, 12);
        break;
      }
      case 'greatCaught': {
        this.ui.worldEvent(e.id === 'kraken' ? 'THE KRAKEN HAS BEEN CAUGHT' : 'A LEVIATHAN HAS BEEN CAUGHT', e.by + (e.first ? ' did the impossible' : ' did it again') + '  -  ' + fmtInt(e.reward) + ' coins', (GREAT_BY_ID[e.id] || KRAKEN).name, true);
        this.audio.fanfare(3);
        for (let k = 0; k < 5; k++) this.fx.confetti(this.player.pos.x + (Math.random() - 0.5) * 6, this.player.pos.y + 2, this.player.pos.z + (Math.random() - 0.5) * 6, 80);
        break;
      }
      case 'krakenAttack': {
        this.ui.banner('THE BOAT IS BEING ATTACKED', e.first ? 'Something has grabbed the boat. Get your axe out (0) and chop the arms - walk up and press E!' : 'IT IS BACK. Axe out - chop the arms!', 'tentacle', 5);
        this.audio.shriek(0.8); this.addShake(1); this.audio.crash();
        this.chat.system('Something has grabbed the boat!');
        break;
      }
      case 'krakenSlam': { const p = new THREE.Vector3(...e.p); this.fx.splash(p.x, p.y, p.z, 2.5); this.fx.smoke(p.x, p.y, p.z, 0x8a6a4a); this.audio.crash(); this.addShake(0.6); break; }
      case 'krakenChop': {
        const p = new THREE.Vector3(...e.p);
        this.fx.sparks(p.x, p.y, p.z, 26, 0x2a1030); this.fx.splash(p.x, p.y, p.z, 1.4); this.fx.smoke(p.x, p.y, p.z, 0x1a1020);
        this.audio.thunk(); this.audio.shriek(e.left > 0 ? 0.45 : 0.85); this.addShake(0.35);
        if (e.left <= 0) this.ui.toast('The arm lets go and slides back into the sea!', 'good');
        break;
      }
      case 'krakenDive': {
        this.audio.shriek(1.3); this.addShake(1.2);
        this.fx.eruption(e.x, this.world.sea(e.x, e.z), e.z, 16);
        this.ui.banner('IT DOVE!', 'The kraken let go. Cast your line into the ink where it went down - if you dare.', 'tentacle', 6);
        break;
      }
      case 'fade': this.ui.fade(e.on, e.text || ''); break;
    }
  }

  /* ================= UI glue ================= */
  onScreen(open, was) {
    this.input.blocked = open;
    if (open) this.input.unlock();
    if (!open && was === 'lobby' && !this.running) { /* title flow handles it */ }
  }
  uiSetting(k, v) {
    const S = this.state.settings;
    S[k] = v;
    this.state.saveSettings();
    this.applySettings();
  }
  applySettings() {
    const S = this.state.settings;
    this.input.sensitivity = S.sens; this.input.invertY = S.invert;
    this.audio.setVolume(S.volume, S.music);
    this.renderer.shadowMap.enabled = S.shadows;
    if (this.world.sky) this.world.sky.sun.castShadow = S.shadows;
    if (this.world.grass) { this.world.grass.density = Math.max(0.05, S.grass); this.world.grass.R = S.grass < 0.1 ? 0 : 70; this.world.grass.update(this.player.pos, true); }
  }
  uiAct(act, arg) {
    const hook = this.onUiAct && this.onUiAct(act, arg);
    if (hook !== undefined) return hook;
    const buy = (k, id) => this.act({ t: 'buy', k, id });
    switch (act) {
      case 'open': this.ui.open(arg, {}); if (arg === 'guild' && this.state.s.tut === 4) this._tut(5); break;
      case 'buyRod': buy('rod', arg); break;
      case 'equipRod': buy('equipRod', arg); break;
      case 'buyBait': buy('bait', arg); break;
      case 'setBait': buy('setBait', arg); if (this.ui.screen === 'bait') this.ui.close(); break;
      case 'buyTool': buy('tool', arg); break;
      case 'buyGear': buy('gear', arg); break;
      case 'buyHull': buy('hull', arg); break;
      case 'useHull': buy('useHull', arg); break;
      case 'buyPart': buy('part', arg); break;
      case 'buyPaint': buy('paint', arg); break;
      case 'paint': buy('applyPaint', arg); break;
      case 'buyDecor': buy('decor', arg); break;
      case 'toggleDecor': buy('toggleDecor', arg); break;
      case 'repair': buy('repair', arg); break;
      case 'sell': this.act({ t: 'sell', id: arg }); break;
      case 'sellAll': this.act({ t: 'sellAll' }); break;
      case 'yard': this.act({ t: 'yard', id: arg }); break;
      case 'dexSel': this.ui.data.sel = arg; break;
      case 'dexBack': this.ui.data.sel = null; break;
      case 'trophySlot': this.ui.data.slot = +arg; break;
      case 'trophyPick': if (this.ui.data.slot != null) this.act({ t: 'trophyPick', slot: this.ui.data.slot, sp: arg }); break;
      case 'talkMore': { const n = this.npcs.byId(arg); if (n) this._talk(n); break; }
      case 'favToggle': { const it = this.loot.get(arg); if (it) { it.fav = !it.fav; this.act({ t: 'fav', id: it.id, on: it.fav }); this.audio.tone(it.fav ? 1320 : 660, 0.12, 'triangle', 0.08); } break; }
      case 'adm': {
        const [cmd, a] = String(arg).split(':');
        const send = o => this.act({ t: 'admin', cmd, ...o });
        if (cmd === 'toggle') { this.admin[a] = !this.admin[a]; this.ui.toast(a + ': ' + (this.admin[a] ? 'ON' : 'off'), 'info'); }
        else if (cmd === 'tp') this.teleport(a);
        else if (cmd === 'spawnGreat') send({ id: a || null });
        else if (cmd === 'giveRod') send({ id: a });
        else if (cmd === 'giveFish') send({ sp: document.getElementById('admFish')?.value, v: document.getElementById('admVar')?.value || null, zone: this.zone || 0 });
        else if (cmd === 'testFish') { const pool = [...FISH].filter(f => !f.junk && ['rare', 'epic', 'legendary'].includes(f.rarity)); this.act({ t: 'admin', cmd: 'giveFish', sp: pool[Math.floor(Math.random() * pool.length)].id, zone: this.zone || 0 }); }
        else if (cmd === 'moneyAdd' || cmd === 'moneySet') this.act({ t: 'admin', cmd: 'money', set: cmd === 'moneySet', n: +(document.getElementById('admMoney')?.value || 0) });
        else if (cmd === 'tod') send({ v: +a });
        else if (cmd === 'event') send({ id: a });
        else send({});
        break;
      }
      case 'look': this.uiSetting('look', +arg); break;
      case 'quit': this.save(); location.reload(); break;
    }
    // shop screens re-render with the new state on the next frame for clients
    if (!this.isHost) setTimeout(() => this.ui.isOpen && this.ui.render(), 350);
  }
}
