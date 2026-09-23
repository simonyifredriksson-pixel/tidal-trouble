/* State.js - everything that persists: money, gear, the boat, the journal,
   clues, leviathans, your cabin museum, photos, the tutorial.

   In co-op the HOST's state is the world: money is a shared guild purse,
   the boat is the crew's boat. Clients keep their own save untouched and
   read the host's copy from the network while they are in a room.

   Awarding is done here BEFORE anything is announced, so a listener that
   throws can never make the UI say "caught!" about a fish that was never
   stored. */

import { RODS, ROD_BY_ID, BAITS, TOOLS, TOOL_BY_ID, GEAR_BY_ID } from '../data/GearData.js?v=1790192871';
import { FISH_BY_ID } from '../data/FishData.js?v=1790192871';
import { LEVIATHANS, LEV_BY_ID, BOTTLES } from '../data/LeviathanData.js?v=1790192871';
import { TROPHY_BY_ID } from '../data/TrophyData.js?v=1790192871';
import { Bus } from '../core/Bus.js?v=1790192871';

export const SAVE_KEY = 'tidaltrouble.save.v1';
export const SETTINGS_KEY = 'tidaltrouble.settings.v1';

export function freshSave() {
  return {
    v: 1, day: 1, tod: 0.3, money: 120,
    rods: ['basic'], rod: 'basic',
    baits: { worm: 25, pieces: 5 }, bait: 'worm',
    tools: { rod: true, hammer: true, bucket: true, axe: true },
    gear: {},
    boat: { hull: 'dinghy', parts: {}, paint: 'natural', decor: [] },
    hulls: ['dinghy'], paints: ['natural'], decorOwned: [],
    dex: {}, clues: {}, levs: {}, bottles: 0, shards: 0,
    cabin: { slots: new Array(10).fill(null), yard: new Array(12).fill(null), shelf: [], photos: [] },
    stats: { caught: 0, earned: 0, biggest: null, fires: 0, sunk: 0, overboard: 0, explosions: 0, slapped: 0 },
    tut: 0, flags: {},
    trophies: { got: {}, placed: {} },     // earned (id -> day) and on the bookshelf (id -> slot)
    great: {}, kraken: { met: 0, caught: 0 }, heard: {},
    player: null, boatPos: null, boatCargo: [], traps: [], holes: [],
    name: 'Fisher',
  };
}

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
    if (!s.rods.includes('basic')) s.rods.unshift('basic');
    s.tools.axe = true;
    s.trophies = Object.assign(f.trophies, s.trophies || {});
    s.great = s.great || {}; s.kraken = Object.assign(f.kraken, s.kraken || {}); s.heard = s.heard || {};
  }

  /* ---------------- trophies ---------------- */
  /** Earn a trophy. Returns true the first time. */
  award(id) {
    const T = this.s.trophies;
    if (!TROPHY_BY_ID[id] || T.got[id]) return false;
    T.got[id] = this.s.day;
    return true;
  }
  pendingTrophies() { const T = this.s.trophies; return Object.keys(T.got).filter(id => T.placed[id] === undefined && TROPHY_BY_ID[id]); }
  save() {
    if (this.remote) return false;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); return true; } catch (e) { return false; }
  }
  wipe() { this.s = freshSave(); try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ } }
  loadSettings() {
    try { const r = localStorage.getItem(SETTINGS_KEY); if (r) this.settings = Object.assign(defaultSettings(), JSON.parse(r)); } catch (e) { /* */ }
    return this.settings;
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
  record(sp, kg, cm, variant = null) {
    const d = this.s.dex[sp] || { n: 0, bestKg: 0, bestCm: 0, first: this.s.day };
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
