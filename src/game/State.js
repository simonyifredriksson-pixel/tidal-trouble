/* State.js - everything that persists: money, gear, the boat, the journal,
   clues, leviathans, your cabin museum, photos, the tutorial.

   In co-op the HOST's state is the world: money is a shared guild purse,
   the boat is the crew's boat. Clients keep their own save untouched and
   read the host's copy from the network while they are in a room.

   Awarding is done here BEFORE anything is announced, so a listener that
   throws can never make the UI say "caught!" about a fish that was never
   stored. */

import { RODS, ROD_BY_ID, BAITS, TOOLS, TOOL_BY_ID, GEAR_BY_ID } from '../data/GearData.js';
import { FISH_BY_ID } from '../data/FishData.js';
import { LEVIATHANS, LEV_BY_ID, BOTTLES } from '../data/LeviathanData.js';
import { TROPHY_BY_ID } from '../data/TrophyData.js';
import { Bus } from '../core/Bus.js';

export const SAVE_KEY = 'tidaltrouble.save.v1';
export const SETTINGS_KEY = 'tidaltrouble.settings.v1';

export function freshSave() {
  return {
    v: 1, day: 1, tod: 0.3, money: 120,
    rods: ['basic'], rod: 'basic',
    baits: { worm: 25, pieces: 5 }, bait: 'worm',
    tools: { rod: true, hammer: true, bucket: true, axe: true, pick: true, plans: true },
    gear: {},
    boat: { hull: 'dinghy', parts: {}, paint: 'natural', decor: [] },
    hulls: ['dinghy'], paints: ['natural'], decorOwned: [],
    dex: {}, clues: {}, levs: {}, bottles: 0, shards: 0,
    cabin: { slots: new Array(10).fill(null), yard: new Array(12).fill(null), shelf: [], photos: [] },
    stats: { caught: 0, earned: 0, biggest: null, fires: 0, sunk: 0, overboard: 0, explosions: 0, slapped: 0 },
    tut: 0, flags: {},
    trophies: { got: {}, placed: {} },     // earned (id -> day) and on the bookshelf (id -> slot)
    great: {}, kraken: { met: 0, caught: 0 }, heard: {},
    beasts: {}, beastSeen: {}, beastClues: {}, mysteries: [],
    secrets: {}, caches: {},               // hidden places found (id -> day) and caches opened (id -> day)
    player: null, boatPos: null, boatCargo: [], traps: [], holes: [],
    name: 'Fisher',
    // exploring: islands found (id -> day), the charted squares of the map, notes read, how far out you have been
    found: {}, chart: '', notes: {}, farthest: 0, salvaged: {},
    // gathering and building: the crew's pack, what has been cut down (id -> day), and every blueprint laid out
    mats: {}, felled: {}, builds: [],
    boatPlans: ['dinghy'],
    claims: {},                            // secret rewards claimed: reward id -> { player key: day }                 // boat blueprints you own (the rowboat's are Old Gus's gift)
    // the hotbar: ten slots, each empty or holding something you own ('rod:<id>' or a tool id);
    // `seen` is everything that has been offered to it once, so an item you take off stays off
    hotbar: { slots: new Array(HOT_N).fill(null), seen: [] },
    bag: [],                               // the fish in your bag (host player), saved like the boat's cargo
  };
}
export const HOT_N = 10;
/** The order things go onto the hotbar when you get them. */
const HOT_ORDER = ['rod', 'axe', 'pick', 'hammer', 'bucket', 'plans'];
/* The islands everyone already knows about (their shops can be named from the start). */
export const KNOWN_SHOPS = new Set(['home', 'tropic', 'frost', 'open', 'reach']);

export function defaultSettings() {
  return { sens: 1, invert: false, fov: 75, volume: 0.8, music: 0.5, shake: true, shadows: true, grass: 1, name: 'Fisher', look: 0 };
}

export class State {
  constructor() {
    this.s = freshSave();
    this.settings = defaultSettings();
    this.remote = false;         // true while we are a client reading the host's state
  }

  static hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.s = Object.assign(freshSave(), JSON.parse(raw));
      this._migrate();
    } catch (e) { console.warn('save unreadable, starting fresh', e); this.s = freshSave(); }
    return this;
  }
  _migrate() {
    const s = this.s, f = freshSave();
    s.cabin = Object.assign(f.cabin, s.cabin || {});
    while (s.cabin.slots.length < 10) s.cabin.slots.push(null);
    while (s.cabin.yard.length < 12) s.cabin.yard.push(null);
    s.stats = Object.assign(f.stats, s.stats || {});
    if (!ROD_BY_ID[s.rod]) s.rod = 'basic';
    // a castaway who has not yet met Old Gus owns nothing at all (flags.kit === false)
    if (s.flags?.kit !== false) {
      if (!s.rods.includes('basic')) s.rods.unshift('basic');
      s.tools.axe = true; s.tools.pick = true; s.tools.plans = true;
    }
    if (!s.hotbar || !Array.isArray(s.hotbar.slots)) {
      // a save from before the hotbar: the rod in your hands first, then the tools you had
      s.hotbar = { slots: new Array(HOT_N).fill(null), seen: [] };
      this._fillHotbar(s.hotbar, ['rod:' + s.rod]);
      s.hotbar.seen = this.equippables();
    }
    while (s.hotbar.slots.length < HOT_N) s.hotbar.slots.push(null);
    s.bag = s.bag || [];
    // quit the game while a prisoner, and you are still one
    this.captive = s.captive ? { slots: s.captive.slice() } : null;
    s.mats = s.mats || {}; s.felled = s.felled || {}; s.builds = s.builds || [];
    s.boatPlans = s.boatPlans || [...new Set(['dinghy', ...(s.hulls || [])])];
    s.claims = s.claims || {};
    // a save from before the storm on the first night has already been through it
    if (s.flags && s.flags.intro === undefined && (s.stats.caught > 0 || s.tut > 0)) s.flags.intro = 1;
    s.trophies = Object.assign(f.trophies, s.trophies || {});
    s.beasts = s.beasts || {}; s.beastSeen = s.beastSeen || {}; s.beastClues = s.beastClues || {}; s.mysteries = s.mysteries || [];
    s.secrets = s.secrets || {}; s.caches = s.caches || {};
    s.great = s.great || {}; s.kraken = Object.assign(f.kraken, s.kraken || {}); s.heard = s.heard || {};
    s.found = s.found || {}; s.chart = s.chart || ''; s.notes = s.notes || {}; s.farthest = s.farthest || 0; s.salvaged = s.salvaged || {};
  }
  /* ---------------- the hotbar ---------------- */
  /** Everything you own that you can hold in your hands and use. */
  equippables() {
    const s = this.s, out = [];
    for (const R of RODS) if (s.rods.includes(R.id)) out.push('rod:' + R.id);
    const tools = TOOLS.filter(T => T.id !== 'rod' && s.tools[T.id]).map(T => T.id);
    tools.sort((a, b) => (HOT_ORDER.indexOf(a) + 1 || 99) - (HOT_ORDER.indexOf(b) + 1 || 99));
    return out.concat(tools);
  }
  /** Your hotbar. The host's lives in the save; a guest's is their own, for as long as they are in the room. */
  get hot() {
    if (this.remote) return (this._hot = this._hot || { slots: new Array(HOT_N).fill(null), seen: [] });
    return this.s.hotbar;
  }
  _fillHotbar(H, first = []) {
    const own = this.equippables();
    for (const k of [...first, ...own]) if (own.includes(k) && !H.slots.includes(k)) { const i = H.slots.indexOf(null); if (i >= 0) H.slots[i] = k; }
  }
  /** Captured: everything comes off the hotbar into the pirates' stash (it is still yours - you have to go and get it). */
  confiscate() {
    if (this.captive) return;
    const H = this.hot;
    this.captive = { slots: H.slots.slice() };
    H.slots = H.slots.map(() => null);
    if (!this.remote) this.s.captive = this.captive.slots;
  }
  /** Out of the stash chest: the hotbar exactly as it was. */
  release() {
    if (!this.captive) return;
    const H = this.hot;
    H.slots = this.captive.slots.slice();
    this.captive = null;
    if (!this.remote) delete this.s.captive;
  }
  /** Keep the hotbar honest: what you no longer own comes off, what you have just got goes on (once). */
  fixHotbar() {
    if (this.captive) return false;          // in a pirate's cage, with nothing
    const H = this.hot, own = this.equippables(), set = new Set(own);
    let changed = false;
    H.slots = H.slots.map(k => { if (k && !set.has(k)) { changed = true; return null; } return k; });
    H.seen = H.seen.filter(k => set.has(k));
    for (const k of own) {
      if (H.seen.includes(k)) continue;
      H.seen.push(k); changed = true;
      if (!H.slots.includes(k)) { const i = H.slots.indexOf(null); if (i >= 0) H.slots[i] = k; }
    }
    return changed;
  }
  /** The slot something is in (0-9), or -1. */
  hotSlot(key) { return this.hot.slots.indexOf(key); }

  /** Can the game name the place a shop is on? (the far islands only once you have been there) */
  knowsShop(id) { return KNOWN_SHOPS.has(id || 'home') || !!this.s.found[id]; }

  /* ---------------- trophies ---------------- */
  /** Earn a trophy. Returns true the first time. */
  award(id) {
    const T = this.s.trophies;
    if (!TROPHY_BY_ID[id] || T.got[id]) return false;
    T.got[id] = this.s.day;
    return true;
  }
  /** Which earned trophies deserve a place on a shelf with `caps` {S, L} spaces:
      the grandest first, then the ones already up there, then the oldest. */
  shelfPlan(caps = null) {
    const T = this.s.trophies;
    const ids = Object.keys(T.got).filter(id => TROPHY_BY_ID[id]);
    // rank breaks ties inside a tier: the real monsters outrank the ocean beasts for the big spaces
    ids.sort((a, b) => (TROPHY_BY_ID[b].tier - TROPHY_BY_ID[a].tier) || ((TROPHY_BY_ID[b].rank || 0) - (TROPHY_BY_ID[a].rank || 0)) || ((T.placed[a] === undefined) - (T.placed[b] === undefined)) || (T.got[a] - T.got[b]));
    const keep = { S: [], L: [] };
    for (const id of ids) { const z = TROPHY_BY_ID[id].size; if (keep[z].length < (caps ? caps[z] : Infinity)) keep[z].push(id); }
    return keep;
  }
  /** Earned trophies that would go up on the shelf but are not there yet. */
  pendingTrophies(caps = null) { const k = this.shelfPlan(caps), P = this.s.trophies.placed; return [...k.S, ...k.L].filter(id => P[id] === undefined); }
  save() {
    if (this.remote) return false;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); return true; } catch (e) { return false; }
  }
  wipe() { this.s = freshSave(); try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ } }
  loadSettings() {
    try { const r = localStorage.getItem(SETTINGS_KEY); if (r) this.settings = Object.assign(defaultSettings(), JSON.parse(r)); } catch (e) { /* */ }
    return this.settings;
  }
  /** This player's own permanent key: who claimed which secret, across rejoins and reloads. */
  playerKey() {
    if (!this.settings.key) { this.settings.key = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); this.saveSettings(); }
    return this.settings.key;
  }
  saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* */ } }

  /* ---------------- money ---------------- */
  get money() { return this.s.money; }
  earn(n, why = '') {
    if (!(n > 0)) return;
    this.s.money += Math.round(n);
    this.s.stats.earned += Math.round(n);
    Bus.emit('money', { delta: Math.round(n), why });
  }
  spend(n) {
    if (!(n >= 0) || this.s.money < n) return false;
    this.s.money -= Math.round(n);
    Bus.emit('money', { delta: -Math.round(n) });
    return true;
  }

  /* ---------------- gear ---------------- */
  has(id) {
    if (TOOL_BY_ID[id]) return !!this.s.tools[id];
    if (GEAR_BY_ID[id]) return !!this.s.gear[id];
    if (ROD_BY_ID[id]) return this.s.rods.includes(id);
    return false;
  }
  give(id) {
    if (TOOL_BY_ID[id]) this.s.tools[id] = true;
    else if (GEAR_BY_ID[id]) this.s.gear[id] = true;
    else if (ROD_BY_ID[id] && !this.s.rods.includes(id)) this.s.rods.push(id);
  }
  useBait(id) {
    if ((this.s.baits[id] || 0) <= 0) return false;
    this.s.baits[id]--;
    Bus.emit('bait', { id, left: this.s.baits[id] });
    if (this.s.baits[id] <= 0) {
      // fall back to whatever you still have
      const next = BAITS.find(b => (this.s.baits[b.id] || 0) > 0);
      if (next) this.s.bait = next.id;
    }
    return true;
  }
  addBait(id, n) { this.s.baits[id] = (this.s.baits[id] || 0) + n; }
  loseRod(id) {
    if (id === 'basic') return;
    this.s.rods = this.s.rods.filter(r => r !== id);
    const best = RODS.filter(r => this.s.rods.includes(r.id)).pop();
    this.s.rod = best ? best.id : 'basic';
    this.s.flags['lostRod_' + id] = true;
  }

  /* ---------------- the journal ---------------- */
  /** Record a catch. Returns {isNew, record} - call BEFORE announcing. */
  record(sp, kg, cm, variant = null, where = null) {
    const d = this.s.dex[sp] || { n: 0, bestKg: 0, bestCm: 0, first: this.s.day };
    if (where && !d.where) d.where = where;
    if (variant) { d.vars = d.vars || []; if (!d.vars.includes(variant)) d.vars.push(variant); }
    const isNew = d.n === 0;
    d.n++;
    const record = kg > d.bestKg;
    if (record) { d.bestKg = kg; d.bestCm = cm; }
    this.s.dex[sp] = d;
    this.s.stats.caught++;
    const b = this.s.stats.biggest;
    if (!b || kg > b.kg) this.s.stats.biggest = { sp, kg };
    return { isNew, record: record && !isNew };
  }
  dexCount() { return Object.keys(this.s.dex).filter(k => FISH_BY_ID[k] && FISH_BY_ID[k].rarity !== 'junk').length; }

  /* ---------------- clues & leviathans ---------------- */
  hasClue(id) { return !!this.s.clues[id]; }
  addClue(id) {
    if (this.s.clues[id]) return false;
    this.s.clues[id] = this.s.day;
    return true;
  }
  levReady(L) { return L.final ? LEVIATHANS.filter(l => !l.final).every(l => this.s.levs[l.id]) : L.clues.every(c => this.s.clues[c.id]); }
  levCaught(id) { return !!this.s.levs[id]; }
  catchLev(id) {
    if (this.s.levs[id]) return false;
    this.s.levs[id] = { day: this.s.day };
    this.s.shards = Object.keys(this.s.levs).filter(k => !LEV_BY_ID[k]?.final).length;
    return true;
  }
  nextBottle() {
    if (this.s.bottles >= BOTTLES.length) return null;
    return BOTTLES[this.s.bottles++];
  }

  /* ---------------- cabin ---------------- */
  mount(slot, item) { this.s.cabin.slots[slot] = item; }
  yardPlace(i, item) { this.s.cabin.yard[i] = item; }
  addPhoto(data) {
    this.s.cabin.photos.unshift(data);
    if (this.s.cabin.photos.length > 12) this.s.cabin.photos.length = 12;
  }
  addShelf(id) { if (!this.s.cabin.shelf.includes(id) && this.s.cabin.shelf.length < 8) this.s.cabin.shelf.push(id); }
}
