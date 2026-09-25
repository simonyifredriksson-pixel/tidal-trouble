/* Cabin.js - your fisherman's museum, drawn from the save.

   Wall plaques hold mounted fish, the yard holds giants and leviathan
   skulls, the shelf holds strange things you found, the walls hold your
   photographs, the rack holds every rod you own - and the guild hall's
   pedestals and the shard table fill up as the leviathans are caught.
   Everything is rebuilt from State whenever it changes, so co-op peers
   see the same museum. */

import * as THREE from '../../lib/three.module.js?v=1790354328';
import { MeshBuilder, shadeHex } from '../art/Geo.js?v=1790354328';
import { MAT } from '../art/Materials.js?v=1790354328';
import { fishMesh } from '../art/FishArt.js?v=1790354328';
import { buildRod } from '../art/RodArt.js?v=1790354328';
import { buildLeviathan } from '../art/CreatureArt.js?v=1790354328';
import { FISH_BY_ID } from '../data/FishData.js?v=1790354328';
import { RODS } from '../data/GearData.js?v=1790354328';
import { LEVIATHANS, LEV_BY_ID } from '../data/LeviathanData.js?v=1790354328';
import { rng } from '../core/Util.js?v=1790354328';
import { worldMapCanvas, toMap } from '../ui/MapArt.js?v=1790354328';
import { TROPHY_BY_ID } from '../data/TrophyData.js?v=1790354328';
import { buildTrophy } from '../art/TrophyArt.js?v=1790354328';

function plaque() {
  const b = new MeshBuilder(rng(9));
  b.color(0x4a3222).box(1.3, 0.62, 0.06, 0, 0, 0);
  b.color(0x6a4a30).box(1.18, 0.5, 0.07, 0, 0, 0.01);
  b.color(0xd8b048).box(0.34, 0.07, 0.02, 0, -0.24, 0.05);
  return new THREE.Mesh(b.build(), MAT.solid);
}

export function buildSkull(L, scale = 1) {
  const r = rng(L.id.length * 5);
  const b = new MeshBuilder(r);
  const bone = 0xe8dcc0;
  const long = L.kind === 'serpent' || L.kind === 'eel' || L.kind === 'pike' || L.kind === 'marlin' || L.kind === 'mother';
  b.color(bone).blob(0.5, 0.4, long ? 0.8 : 0.55, 0, 0.45, 0, 7, 4, 0.12);
  b.color(shadeHex(bone, 0.9)).blob(0.4, 0.16, long ? 0.7 : 0.45, 0, 0.12, long ? 0.2 : 0.12, 6, 3, 0.1);
  b.color(0x2a2218);
  for (const s of [-1, 1]) b.blob(0.13, 0.12, 0.1, s * 0.28, 0.55, long ? 0.4 : 0.3, 5, 3);
  b.color(0xf4f0e0);
  const n = long ? 9 : 6;
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
    const z = (long ? 0.75 : 0.5) - i * 0.1;
    b.push(s * (0.25 - i * 0.01), 0.22, z, Math.PI, 0, 0); b.cone(0.035, 0, 0.14, 3); b.pop();
  }
  if (L.kind === 'marlin') b.color(bone).tube([0, 0.45, 0.7], [0, 0.5, 1.9], 0.07, 0.01, 5);
  if (L.kind === 'kraken') { b.color(bone); for (let i = 0; i < 4; i++) b.tube([0, 0.2, 0], [Math.cos(i * 1.6) * 0.9, 0.05, Math.sin(i * 1.6) * 0.9], 0.08, 0.03, 5); }
  if (L.kind === 'turtle') b.color(0x6a7a3a).blob(0.9, 0.35, 0.9, 0, 0.35, -0.5, 8, 3, 0.1);
  b.color(0x5a4a3a).box(1.4, 0.1, 1.4, 0, 0, 0);
  const m = new THREE.Mesh(b.build(), MAT.solid);
  m.castShadow = true;
  m.scale.setScalar(scale);
  // the shard, glowing between the eyes
  const g = new MeshBuilder(rng(2));
  g.color(L.colors.glow).lump(0.09, 0, 0.75, long ? 0.45 : 0.32, 0.3, 1.4);
  const gm = new THREE.Mesh(g.build(), MAT.glow);
  gm.scale.setScalar(scale);
  const grp = new THREE.Group(); grp.add(m, gm);
  return grp;
}

function shelfItem(id) {
  const b = new MeshBuilder(rng(id.length));
  const g = new MeshBuilder(rng(3));
  if (id.startsWith('clue:')) {
    const c = id.slice(5);
    const tone = { dev2: 0x6ab04a, st2: 0x3a6ab0, wj2: 0xf4f0e0, sb1: 0x6a7a3a, aur2: 0xb8b0a0, he2: 0x3a3440 }[c] || 0xc8c0a8;
    b.color(tone).lump(0.1, 0, 0.1, 0, 0.3, 1.3);
  } else if (id === 'meteorite') { b.color(0x3a3a44).lump(0.1, 0, 0.1, 0, 0.35); g.color(0x9ab8ff).lump(0.03, 0.04, 0.16, 0.02, 0.2); }
  else if (id === 'bottle') { b.color(0x6aa87a).cyl(0.04, 0.03, 0, 0.2, 6, true); b.color(0xf0e6c8).box(0.02, 0.12, 0.02, 0, 0.08, 0); }
  else if (id === 'duck') { b.color(0xf2d02a).blob(0.07, 0.05, 0.06, 0, 0.05, 0, 6, 3); b.color(0xf2d02a).blob(0.04, 0.04, 0.04, 0.04, 0.11, 0, 5, 3); }
  else if (id === 'boot') { b.color(0x4a3222).box(0.08, 0.16, 0.08, -0.03, 0.08, 0); b.color(0x4a3222).box(0.15, 0.06, 0.08, 0.02, 0.03, 0); }
  else b.color(0xd8b048).lump(0.07, 0, 0.07, 0, 0.3);
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(b.build(), MAT.solid));
  if (g.tris) grp.add(new THREE.Mesh(g.build(), MAT.glow));
  return grp;
}

export class Cabin {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'museum';
    game.scene.add(this.group);
    this.key = '';
    this.photoTex = new Map();
  }

  update() {
    const s = this.game.state.s;
    const key = JSON.stringify([s.cabin, s.rods, s.rod, s.levs, s.shards, Object.keys(s.clues).length, s.trophies?.placed]);
    if (key === this.key) return;
    this.key = key;
    this.rebuild();
  }

  rebuild() {
    const G = this.game, S = G.world.settlement, s = G.state.s;
    for (const c of [...this.group.children]) { this.group.remove(c); }
    // fish mounts
    S.cabin.slots.forEach((slot, i) => {
      const it = s.cabin.slots[i];
      const pl = plaque();
      pl.position.copy(slot.pos); pl.rotation.y = slot.face;
      this.group.add(pl);
      if (!it) return;
      const sp = FISH_BY_ID[it.sp];
      if (!sp) return;
      const len = it.cm / 100;
      const fit = Math.min(1.1 / Math.max(len, 0.05), 1);
      const m = fishMesh(sp, len * fit);
      m.position.copy(slot.pos);
      const off = new THREE.Vector3(0, 0.02, 0.12).applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.face);
      m.position.add(off);
      m.rotation.set(0, slot.face, 0.12);
      this.group.add(m);
    });
    // yard: giants and skulls
    S.cabin.yard.forEach((spot, i) => {
      const it = s.cabin.yard[i];
      if (!it) return;
      const pb = new MeshBuilder(rng(i + 40));
      pb.color(0x8a8478).box(1.5, 0.55, 1.5, 0, 0.27, 0); pb.color(0x9a7a56).box(1.6, 0.08, 1.6, 0, 0.58, 0);
      const plinth = new THREE.Mesh(pb.build(), MAT.solid); plinth.position.set(spot.pos.x, spot.ground, spot.pos.z); plinth.castShadow = true; plinth.receiveShadow = true;
      this.group.add(plinth);
      if (it.lev) {
        const L = LEV_BY_ID[it.lev];
        if (!L) return;
        const sk = buildSkull(L, 1.2 + Math.min(1.4, L.size / 30));
        sk.position.copy(spot.pos); sk.rotation.y = Math.PI + (i - 6) * 0.1;
        this.group.add(sk);
      } else {
        const sp = FISH_BY_ID[it.sp];
        if (!sp) return;
        const m = fishMesh(sp, Math.min(it.cm / 100, 4.5));
        m.position.copy(spot.pos).add(new THREE.Vector3(0, 0.5 + Math.min(it.cm / 100, 4.5) * 0.1, 0));
        m.rotation.set(0, 0.3 + i * 0.4, Math.PI / 2 * 0.2);
        this.group.add(m);
      }
    });
    // shelf
    s.cabin.shelf.forEach((id, i) => {
      const spot = S.cabin.shelf[i];
      if (!spot) return;
      const m = shelfItem(id);
      m.position.copy(spot.pos);
      this.group.add(m);
    });
    // photos
    s.cabin.photos.slice(0, S.cabin.photos.length).forEach((data, i) => {
      const spot = S.cabin.photos[i];
      const frame = new MeshBuilder(rng(i));
      frame.color(0x3a2a1c).box(0.62, 0.4, 0.04, 0, 0, 0);
      const fm = new THREE.Mesh(frame.build(), MAT.solid);
      fm.position.copy(spot.pos); fm.rotation.y = spot.face;
      this.group.add(fm);
      let tex = this.photoTex.get(data);
      if (!tex) {
        const img = new Image();
        tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        img.onload = () => { tex.needsUpdate = true; };
        img.src = data;
        this.photoTex.set(data, tex);
      }
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.32), new THREE.MeshBasicMaterial({ map: tex }));
      pic.position.copy(spot.pos).add(new THREE.Vector3(0, 0, 0.025).applyAxisAngle(new THREE.Vector3(0, 1, 0), spot.face));
      pic.rotation.y = spot.face;
      this.group.add(pic);
    });
    // rod rack: every rod you own stands in its peg on the wall; the one in
    // your hands leaves an empty peg
    const rack = S.cabin.rack;
    this.rackSpots = [];
    RODS.forEach((R, i) => {
      const pos = new THREE.Vector3(rack.pos.x - 0.06, rack.pos.y + 0.25, rack.pos.z + i * rack.step);
      this.rackSpots.push({ id: R.id, pos: pos.clone().add(new THREE.Vector3(0, 1.2, 0)), own: s.rods.includes(R.id), held: R.id === s.rod });
      if (!s.rods.includes(R.id) || R.id === s.rod) return;
      const rod = buildRod(R);
      rod.group.scale.setScalar(0.95);
      rod.group.position.copy(pos);
      rod.group.rotation.set(0, rack.face, -0.04);
      this.group.add(rod.group);
    });
    // the bookcase: every trophy you have placed, in its own cubby
    const TS = S.cabin.trophies;
    this.trophySpots = [];
    if (TS) for (const id in s.trophies.placed) {
      const T = TROPHY_BY_ID[id];
      const slot = (T && (T.size === 'L' ? TS.L : TS.S)[s.trophies.placed[id]]);
      if (!slot) continue;
      const m = buildTrophy(T, slot.w, slot.h);
      m.position.copy(slot.pos);
      this.group.add(m);
      this.trophySpots.push({ id, pos: slot.pos.clone().add(new THREE.Vector3(0, slot.h * 0.4, 0)) });
    }
    // the chart pinned over the desk
    if (S.anchors.cabinMap) {
      if (!this._chartTex) {
        const cv = worldMapCanvas(256, true);
        this._chartTex = new THREE.CanvasTexture(cv); this._chartTex.colorSpace = THREE.SRGBColorSpace;
      }
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshLambertMaterial({ map: this._chartTex }));
      pl.position.copy(S.anchors.cabinMap.pos); pl.rotation.y = S.anchors.cabinMap.face;
      this.group.add(pl);
      const fb = new MeshBuilder(rng(4));
      fb.color(0xc83a2a); for (const [x, y] of [[-0.55, 0.4], [0.55, 0.4], [-0.55, -0.4], [0.55, -0.4]]) fb.box(0.04, 0.04, 0.03, x, y, 0.01);
      const pins = new THREE.Mesh(fb.build(), MAT.solid); pins.position.copy(pl.position); this.group.add(pins);
    }
    // guild hall: a statue per leviathan caught, shards on the table
    LEVIATHANS.forEach((L, i) => {
      if (!s.levs[L.id]) return;
      const spot = S.anchors.guildPedestals[i];
      if (!spot) return;
      const b = buildLeviathan(L);
      b.group.scale.setScalar(0.9 / L.size * (L.kind === 'kraken' || L.kind === 'turtle' ? 0.8 : 1.4));
      b.group.position.copy(spot).add(new THREE.Vector3(0, 0.35, 0));
      b.group.rotation.y = spot.x < S.anchors.shardTable.x ? 0 : Math.PI;
      if (b.mats) for (const m of b.mats) if (m.userData.u) m.userData.u.uAmp.value = 0;
      this.group.add(b.group);
    });
    // the great map on the guild wall, with every lure point the guild knows
    {
      const base = worldMapCanvas(512, true);
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
      const c = cv.getContext('2d');
      if (c) {
        c.fillStyle = '#d8c8a0'; c.fillRect(0, 0, 1024, 512);
        c.drawImage(base, 256, 0, 512, 512);
        c.font = '700 26px Georgia, serif'; c.fillStyle = '#3a2410'; c.textAlign = 'center';
        c.fillText('THE LEVIATHANS', 128, 44); c.fillText('OF THE WATERS', 896, 44);
        LEVIATHANS.forEach((L, i) => {
          const caught = s.levs[L.id], ready = G.state.levReady(L);
          const [mx, my] = toMap(L.lure.x, L.lure.z, 512);
          if (ready || caught) {
            c.strokeStyle = caught ? '#2a5a2a' : '#8a1a0a'; c.lineWidth = 4;
            c.beginPath(); c.arc(256 + mx, my, 12, 0, 6.28); c.stroke();
            if (caught) { c.beginPath(); c.moveTo(256 + mx - 8, my - 8); c.lineTo(256 + mx + 8, my + 8); c.moveTo(256 + mx + 8, my - 8); c.lineTo(256 + mx - 8, my + 8); c.stroke(); }
          }
          const col = i < 6 ? 128 : 896, row = 90 + (i % 6) * 68;
          c.font = '700 19px Georgia, serif';
          c.fillStyle = caught ? '#2a5a2a' : '#3a2410';
          const known = caught || L.clues.some(k => s.clues[k.id]);
          c.fillText((known ? L.name : '? ? ?') + (caught ? '  (caught)' : ''), col, row);
          c.font = 'italic 15px Georgia, serif'; c.fillStyle = '#6a4a2a';
          c.fillText(L.final ? 'Beneath the Drowned Gate' : L.clues.filter(k => s.clues[k.id]).length + ' of ' + L.clues.length + ' clues', col, row + 22);
        });
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 2.6), new THREE.MeshLambertMaterial({ map: tex, emissive: 0x2a2014 }));
      plane.position.copy(S.anchors.guildMap);
      this.group.add(plane);
    }
    const shards = Object.keys(s.levs).filter(k => !LEV_BY_ID[k]?.final).length;
    for (let i = 0; i < shards; i++) {
      const L = LEVIATHANS[i];
      const g = new MeshBuilder(rng(i));
      g.color(L.colors.glow).lump(0.09, 0, 0.1, 0, 0.3, 1.5);
      const m = new THREE.Mesh(g.build(), MAT.glow);
      const a = i / 11 * Math.PI * 2;
      m.position.copy(S.anchors.shardTable).add(new THREE.Vector3(Math.cos(a) * 0.9, 0.05, Math.sin(a) * 0.35));
      this.group.add(m);
    }
  }

  /** Put every trophy you have earned but not placed onto the bookcase. Returns how many. */
  placeAll() {
    const G = this.game, s = G.state.s, TS = G.world.settlement.cabin.trophies;
    const used = { S: new Set(), L: new Set() };
    for (const id in s.trophies.placed) { const T = TROPHY_BY_ID[id]; if (T) used[T.size].add(s.trophies.placed[id]); }
    let n = 0;
    for (const id of G.state.pendingTrophies()) {
      const T = TROPHY_BY_ID[id];
      const list = T.size === 'L' ? TS.L : TS.S;
      let k = 0; while (k < list.length && used[T.size].has(k)) k++;
      if (k >= list.length) continue;
      used[T.size].add(k); s.trophies.placed[id] = k; n++;
    }
    return n;
  }
  /** The trophy you are looking at on the shelf, if any. */
  trophyNear(pos, r = 0.35) {
    let best = null, bd = r;
    for (const t of this.trophySpots || []) { const d = t.pos.distanceTo(pos); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  rackNear(pos, r = 0.45) {
    let best = null, bd = r;
    for (const t of this.rackSpots || []) { if (!t.own || t.held) continue; const d = Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z) + Math.abs(t.pos.y - pos.y) * 0.3; if (d < bd) { bd = d; best = t; } }
    return best;
  }

  /** The nearest empty/filled plaque to a point (for mounting). */
  nearestSlot(pos, r = 2.2) {
    let best = null, bd = r;
    this.game.world.settlement.cabin.slots.forEach((s, i) => { const d = s.pos.distanceTo(pos); if (d < bd) { bd = d; best = i; } });
    return best;
  }
}
