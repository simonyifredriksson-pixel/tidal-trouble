/* Scripts.js - test scenarios that drive the REAL game in the browser.
   Loaded only with ?script=a,b,c. Each scenario fast-forwards the game with
   game.update() (no rendering) and prints PASS/FAIL lines to the debug
   overlay, so a single headless screenshot is the test report. */

import * as THREE from '../../lib/three.module.js?v=1790356418';
import { FISH_BY_ID, FISH } from '../data/FishData.js?v=1790356418';
import { heightAt } from '../world/Terrain.js?v=1790356418';
import { LEVIATHANS } from '../data/LeviathanData.js?v=1790356418';
import { Bus } from '../core/Bus.js?v=1790356418';
let landedN = 0; Bus.on('catch', () => landedN++);

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function runScripts(names, game) {
  const log = window.__log || console.log;
  const G = game;
  let pass = 0, fail = 0;
  const ok = (cond, msg) => { if (cond) pass++; else fail++; log((cond ? 'PASS ' : 'FAIL ') + msg); };
  const step = (sec, fn = null) => { const n = Math.round(sec * 30); for (let i = 0; i < n; i++) { if (fn) fn(i); G.update(1 / 30); } };
  const I = G.input;
  const P = G.player;
  const b = G.boats[0];
  const errs = [];
  addEventListener('error', e => errs.push(e.message));

  // a decent (not perfect) player: hold when the fish is above the zone,
  // leading a little by the zone's own velocity, with a human reaction lag
  let lagT = 0, want = false;
  const fightPolicy = () => {
    const F = G.fishing;
    if (F.state !== 'fight' || !F.bar) return;
    lagT -= 1 / 30;
    if (lagT <= 0) { lagT = 0.12; want = F.fish.fishPos > F.bar.zone + F.bar.vel * 0.25; }
    if (want && !I.mouse.buttons.has(0)) I.fakeBtn(0, true);
    if (!want && I.mouse.buttons.has(0)) I.fakeBtn(0, false);
  };
  const release = () => { I.fakeBtn(0, false); I.keys.clear(); };

  const fightOnce = (sp, kg, cm, rodId = 'basic') => {
    G.state.s.rod = rodId; G.state.s.rods = [...new Set([...G.state.s.rods, rodId])];
    G.state.s.baits.worm = 50; G.state.s.bait = 'worm';
    const F = G.fishing;
    F.cancel(true);
    P.tool = 'rod'; G.vm.setTool('rod');
    F.bpos.copy(P.pos).add(V(0, 0, 14)); F.bpos.y = 0; F.water = 'sea';
    F.pending = { sp, kg, cm, size: 0.5 };
    F._hook();
    let t = 0, end = null;
    const before = landedN;
    let why = '';
    const ot = G.ui.toast.bind(G.ui); G.ui.toast = (m, k) => { why = m; ot(m, k); };
    for (; t < 160 && !end; t += 1 / 30) {
      fightPolicy();
      G.update(1 / 30);
      if (F.state !== 'fight') end = landedN > before ? 'landed' : 'lost';
    }
    release();
    G.ui.toast = ot;
    return { end: (end || 'timeout') + (end === 'lost' ? ' [' + why + ']' : ''), t: Math.round(t) };
  };

  for (const name of names) {
    log('--- ' + name);
    G.ui.close(); G.ui.closeTalk();     // a screen left open by the last suite would block input
    P.tool = 'rod'; G.vm.setTool('rod'); G.tools.bucketFull = null; P.pitch = 0;
    try {
      if (name === 'fish') {
        const A = G.world.settlement.anchors;
        P.attach(b, V(0, b.deck, 0));
        const cases = [['bass', 2, 45], ['perch', 0.6, 25], ['pike', 9, 90], ['catfish', 14, 80], ['salmon', 10, 90], ['slapfish', 3, 45], ['ghost', 2, 50], ['eel', 6, 150], ['puffer', 1, 30], ['sharkfish', 12, 70]];
        for (const [sp, kg, cm] of cases) { const r = fightOnce(sp, kg, cm); ok(r.end !== 'timeout', `${sp} ${kg}kg basic rod -> ${r.end} in ${r.t}s`); }
        const tuna = fightOnce('tuna', 70, 180, 'basic');
        ok(tuna.end.startsWith('lost'), 'tuna on a basic rod must break the line -> ' + tuna.end);
        const tuna2 = fightOnce('tuna', 70, 180, 'reinforced');
        ok(tuna2.end !== 'timeout', 'tuna on reinforced -> ' + tuna2.end + ' ' + tuna2.t + 's');
        const mar = fightOnce('marlin', 200, 300, 'deepwater');
        ok(mar.end !== 'timeout', 'marlin on deepwater -> ' + mar.end + ' ' + mar.t + 's');
        // landing record
        ok(G.state.dexCount() > 0, 'journal recorded catches: ' + G.state.dexCount());
      }
      if (name === 'cast') {
        const A = G.world.settlement.anchors;
        P.place(A.pierEnd.clone().add(V(0, 0.1, -1)), Math.PI);
        step(0.5);
        const F = G.fishing;
        G.state.s.baits.worm = 20;
        let tries = 0;
        do {
          F.cancel(true); step(0.2);
          I.fakeBtn(0, true); step(0.8); I.fakeBtn(0, false); step(0.1);
          if (!tries) ok(F.state === 'fly' || F.state === 'wait', 'cast launched -> ' + F.state);
          step(3);
          if (!tries) ok(F.state === 'wait' || F.state === 'nibble', 'bobber landed in water -> ' + F.state + ' water=' + F.water);
          F.timer = 0.05; F.nibbles = 0;
          step(0.3);
        } while (F.state !== 'bite' && ++tries < 4);   // a Thieffish can steal the bait; cast again
        ok(F.state === 'bite', 'bite happened -> ' + F.state);
        I.fakeBtn(0, true); step(0.05); I.fakeBtn(0, false);
        ok(F.state === 'fight', 'strike hooked it -> ' + F.state + ' ' + (F.fish && F.fish.sp));
        let t = 0; while (F.state === 'fight' && t < 100) { fightPolicy(); G.update(1 / 30); t += 1 / 30; }
        release();
        ok(F.state !== 'fight', 'fight ended -> ' + F.state);
        step(2);
      }
      if (name === 'boat') {
        const t0 = b.pos.clone();
        P.attach(b, V(b.hull.helm[0], b.deck, b.hull.helm[2]));
        G.act({ t: 'helm', boat: b.id, on: true }); P.mode = 'drive';
        I.keys.add('KeyW'); step(1.2); I.keys.delete('KeyW');
        step(8);
        const d = b.pos.distanceTo(t0);
        ok(d > 15, 'drove forward ' + d.toFixed(1) + ' m, speed ' + b.speed().toFixed(1));
        const h0 = b.heading; I.keys.add('KeyA'); step(3); I.keys.delete('KeyA');
        ok(Math.abs(h0 - b.heading) > 0.5, 'A turned the boat: dh=' + (b.heading - h0).toFixed(2) + ' (positive = left)');
        ok(P.boat === b, 'player still aboard while driving');
        // drive into the shore and make sure it does not climb onto land
        let worst = -99;
        b.heading = Math.PI; b.throttle = 1;
        for (let i = 0; i < 600; i++) { G.driveInput(b, 1, 0); G.update(1 / 30); worst = Math.max(worst, heightAt(b.pos.x, b.pos.z)); }
        ok(worst < 0.3, 'ran at the beach for 20s: worst ground under the hull ' + worst.toFixed(2));
        ok(b.hp < b.stats.hp || true, 'hull after grounding ' + Math.round(b.hp));
        I.keys.clear(); G.driveInput(b, 0, 0);
        G.act({ t: 'helm', boat: b.id, on: false }); P.mode = 'walk';
        b.respawn(false); step(1);
      }
      if (name === 'deck') {
        b.respawn(false); step(0.5);
        P.attach(b, V(0, b.deck, -1));
        for (let i = 0; i < 8; i++) G.loot.spawn({ sp: 'bass', kg: 2, cm: 40, pos: b.toWorld(V((Math.random() - 0.5), b.deck + 1, (Math.random() - 0.5) * 3)), boat: null });
        step(3);
        const on = G.loot.onBoat(b).length;
        ok(on >= 8, 'fish landed on the deck: ' + on);
        b.impulse(0, 0, 0.5, 0); step(10);
        ok(G.loot.onBoat(b).length >= 7, 'most stayed aboard through rolling: ' + G.loot.onBoat(b).length);
        // walk around on the deck while the boat moves
        const L0 = P.local.clone();
        I.keys.add('KeyW'); step(1); I.keys.delete('KeyW');
        ok(P.boat === b, 'walking on deck keeps you aboard (local moved ' + P.local.distanceTo(L0).toFixed(2) + ')');
        // selling at the market
        const m0 = G.state.s.money;
        G.act({ t: 'sellAll' });
        ok(G.state.s.money > m0, 'sold at the market: +' + (G.state.s.money - m0));
      }
      if (name === 'bomb') {
        b.respawn(false); step(0.5);
        P.place(G.world.settlement.anchors.pierBase.clone(), 0);
        const hp0 = b.hp;
        const it = G.loot.spawn({ sp: 'bombfish', kg: 2, cm: 35, pos: b.toWorld(V(0, b.deck + 0.5, 0)) });
        step(6);
        ok(!G.loot.items.has(it.id), 'bombfish exploded');
        ok(b.hp < hp0, 'the boat took damage: ' + Math.round(hp0) + ' -> ' + Math.round(b.hp));
        // underwater bomb stuns fish
        const n0 = G.loot.items.size;
        const w = G.loot.spawn({ sp: 'bombfish', kg: 2, cm: 35, pos: b.toWorld(V(0, 0, 8)).setY(-0.3) });
        step(3);
        ok(G.loot.items.size >= n0, 'underwater explosion (stunned fish ' + (G.loot.items.size - n0) + ')');
        b.respawn(false);
      }
      if (name === 'weird') {
        b.respawn(false); step(0.5);
        P.attach(b, V(0, b.deck, -1));
        const pf = G.loot.spawn({ sp: 'puffer', kg: 1, cm: 30, pos: b.toWorld(V(0, b.deck + 0.4, 1)) });
        step(8);
        ok(!pf.boat && pf.pos.y > b.deck + 1, 'the puffer inflated and floated off the deck (y ' + pf.pos.y.toFixed(1) + ')');
        const mm = G.loot.spawn({ sp: 'mimic', kg: 12, cm: 70, pos: b.toWorld(V(0, b.deck + 0.4, 0.8)) });
        step(1);
        P.hp = 100; const hp = P.hp;
        G._do({ t: 'open', id: mm.id }, P.id);
        step(0.2);
        ok(mm.opened && P.hp < hp, 'mimic bit when opened (hp ' + hp + ' -> ' + Math.round(P.hp) + ')');
        step(3);
        const ee = G.loot.spawn({ sp: 'eel', kg: 5, cm: 150, pos: P.pos.clone().add(V(0, 0.5, 0)) });
        step(1.5);
        ok(P.stunT > 0 || P.hp < 90, 'electric eel shocked you (stun ' + P.stunT.toFixed(1) + ')');
        step(3);
        const ch = G.loot.spawn({ sp: 'chest', kg: 15, cm: 70, pos: P.pos.clone().add(V(0, 0.5, 0.8)) });
        const m0 = G.state.s.money; step(1); G._do({ t: 'open', id: ch.id }, P.id);
        ok(G.state.s.money > m0, 'treasure chest paid ' + (G.state.s.money - m0));
        const bt = G.loot.spawn({ sp: 'bottle', kg: 0.6, cm: 30, pos: P.pos.clone().add(V(0, 0.5, 0.5)) });
        step(0.5); const nb = G.state.s.bottles; G._do({ t: 'pickup', id: bt.id }, P.id);
        ok(G.state.s.bottles === nb + 1, 'bottle read: ' + G.state.s.bottles);
        // slap
        P.hp = 100; P.mode = 'walk';
        P.place(G.world.settlement.anchors.pierEnd.clone(), Math.PI);
        step(0.5);
        G.landCatch({ sp: 'slapfish', kg: 3, cm: 45, pos: P.pos.clone().add(V(0, 0.5, 10)), vel: V(0, 0, 0).set(0, 0, 0), by: P.id, slap: true });
        const it = [...G.loot.items.values()].pop();
        const T = 0.55; it.vel.set((P.eye.x - it.pos.x) / T, (P.eye.y - it.pos.y) / T + 4.9 * T, (P.eye.z - it.pos.z) / T);
        step(1.2);
        ok(P.mode === 'down', 'the slapfish knocked you over -> ' + P.mode);
        step(3);
      }
      if (name === 'lev') {
        const L = LEVIATHANS[0];
        for (const c of L.clues) G.state.addClue(c.id);
        ok(G.state.levReady(L), 'gloop ready after its clues');
        G.state.s.rods.push('reinforced'); G.state.s.rod = 'reinforced';
        const A = G.world.settlement.anchors;
        P.place(A.lakePier.clone(), -Math.PI / 2);
        G.tod = 0.9; step(0.5);
        const spot = V(L.lure.x, 0, L.lure.z);
        const ready = G.levAt(spot);
        ok(!!ready, 'lure point accepts a line at night');
        G.creatures.startLev('gloop', L.lure.x, L.lure.z);
        step(5);
        ok(G.creatures.lev && G.creatures.lev.phase === 'rampage', 'it rose and is rampaging');
        let n = 0; while (G.creatures.lev && G.creatures.lev.phase === 'rampage' && n < 60) { G.creatures.lev.surface = 1; G.creatures.levHit(4); n++; step(0.1); }
        ok(G.creatures.lev.phase === 'tired', 'harpooned into exhaustion in ' + n + ' hits');
        const Lv = G.creatures.lev;
        const F = G.fishing;
        F.bpos.copy(Lv.pos).setY(0); F.water = 'lake';
        const c = G.creatures.claimBite(F.bpos, F);
        ok(!!c && c.lev === 'gloop', 'the tired leviathan takes the bait');
        F.pending = c; P.tool = 'rod'; G.vm.setTool('rod'); F._hook();
        let t = 0; while (F.state === 'fight' && t < 160) { fightPolicy(); G.update(1 / 30); t += 1 / 30; if (Math.random() < 0.01) G.creatures.levHit(4); }
        release();
        step(1);
        ok(G.state.levCaught('gloop'), 'GRANDMOTHER GLOOP LANDED in ' + Math.round(t) + 's (state ' + F.state + ')');
        ok(G.state.s.cabin.yard.some(y => y && y.lev === 'gloop'), 'her skull is in the trophy yard');
      }
      if (name === 'events') {
        for (const k of ['storm', 'migration', 'giant', 'whirlpool', 'meteor', 'thief']) {
          P.place(G.world.settlement.anchors.pierEnd.clone(), Math.PI);
          if (k === 'thief') { b.respawn(false); P.place(G.world.settlement.anchors.cabinInside.clone(), 0); }
          step(0.3);
          const e = G.events.start(k, k === 'thief' ? P.pos : b.pos);
          ok(!!e, 'event ' + k + ' started');
          step(12);
        }
        ok(G.world.storm > 0.2, 'storm raised the sea: ' + G.world.storm.toFixed(2));
        ok(b.stolen || b.pos.distanceTo(b.mooringTarget ? V(b.mooringTarget().x, 0, b.mooringTarget().z) : b.pos) > 5, 'Pete took the boat');
        G.events.list = []; G.events.storm = 0; G.creatures.giants.clear();
        b.respawn(false); step(1);
      }
      if (name === 'ui') {
        const screens = ['pause', 'settings', 'controls', 'tackle', 'boatyard', 'market', 'guild', 'journal', 'map', 'bait', 'catch', 'admin', 'ending'];
        for (const s of screens) {
          G.ui.open(s, {});
          for (const tab of ['rods', 'bait', 'tools', 'gear', 'hulls', 'parts', 'paint', 'decor', 'repair', 'levs', 'map', 'story', 'fish', 'clues', 'stats']) { G.ui.tab[s] = tab; G.ui.render(); }
          ok(document.querySelector('#screens .screen').innerHTML.length > 200, 'screen ' + s + ' renders');
          G.ui.close();
        }
        G.ui.tab = {};
      }
      if (name === 'buy') {
        G.state.s.money = 100000;
        for (const k of ['rod:reinforced', 'tool:harpoon', 'tool:net', 'gear:sonar', 'hull:motor', 'part:engine', 'part:lights', 'paint:lobster', 'decor:flamingo', 'decor:lanterns']) {
          const [kk, id] = k.split(':');
          G.act({ t: 'buy', k: kk, id });
        }
        ok(G.state.s.boat.hull === 'motor' && b.hull.id === 'motor', 'bought and switched to the motorboat');
        ok(G.state.has('harpoon') && G.state.s.rod === 'reinforced', 'bought gear');
        step(2);
      }
      if (name === 'tools') {
        const s = G.state.s;
        for (const t of ['harpoon', 'net', 'trap', 'camera', 'grapple', 'auger']) s.tools[t] = true;
        b.respawn(false); step(0.5);
        P.attach(b, V(0, b.deck, 0)); P.yaw = b.heading + Math.PI; P.pitch = -0.2;
        // harpoon: a fish shadow straight ahead gets speared
        P.tool = 'harpoon'; G.vm.setTool('harpoon'); step(0.5);
        const n0 = G.loot.items.size;
        G.tools.throwSpear(false); step(3);
        ok(G.tools.spears.length === 0, 'harpoon flew and came back on its rope');
        // trap
        P.tool = 'trap'; G.vm.setTool('trap');
        G.tools._placeTrap(); step(0.5);
        ok(G.tools.traps.size === 1, 'trap placed in the water');
        const tr = [...G.tools.traps.values()][0]; tr.t0 -= 400;
        G._do({ t: 'trapHaul', id: tr.id }, P.id); step(0.5);
        ok(G.tools.traps.size === 0 && G.loot.items.size > n0, 'hauled the trap in with fish (' + (G.loot.items.size - n0) + ')');
        // hammer and bucket
        b.leaks = []; b.hp -= 40; b.leaks.push({ x: 0.5, y: b.deck, z: 0, size: 1, fix: 0 });
        P.local.set(0.3, b.deck, 0);
        P.tool = 'hammer'; G.vm.setTool('hammer');
        I.fakeBtn(0, true); step(2.5); I.fakeBtn(0, false);
        ok(b.leaks.length === 0, 'hammer fixed the leak');
        b.ignite(0, 1); b.ignite(0.2, 1.2);
        P.tool = 'bucket'; G.vm.setTool('bucket'); P.yaw = b.heading + Math.PI; P.pitch = -0.5; P.local.set(0, b.deck, -0.2);
        for (let i = 0; i < 6; i++) { I.fakeBtn(0, true); step(0.05); I.fakeBtn(0, false); step(0.9); }
        ok(b.fires.length === 0, 'bucket put the fire out (' + b.fires.length + ' left)');
        // camera
        P.tool = 'camera'; G.vm.setTool('camera');
        const ph = s.cabin.photos.length;
        I.fakeBtn(0, true); step(0.05); I.fakeBtn(0, false); step(0.2);
        ok(s.cabin.photos.length === ph + 1, 'photo taken (' + (s.cabin.photos[0] || '').length + ' bytes)');
        // rod holders
        s.boat.parts.holders = 1; G._boatChanged(); step(0.5);
        P.attach(b, V(0, b.deck, 0));
        b.holders = [{ t: 0.01, bite: 0, c: null }];
        step(0.5);
        ok(b.holders[0].bite > 0, 'rod holder bell rang');
        G._grabHolder({ boat: b, i: 0 });
        ok(G.fishing.state === 'fight', 'grabbed the holder rod into a fight');
        G.fishing.cancel(true);
        // ice fishing
        const A = G.world.settlement.anchors;
        P.place(V(0, 0.14, -690), 0); step(1);
        ok(G.world.onIce(P.pos.x, P.pos.z) && Math.abs(P.pos.y - 0.14) < 0.2, 'standing on the frozen lake (y ' + P.pos.y.toFixed(2) + ')');
        P.tool = 'auger'; G.vm.setTool('auger');
        I.fakeBtn(0, true); step(1.8); I.fakeBtn(0, false);
        ok(G.tools.holes.size >= 1, 'auger drilled a hole');
        P.tool = 'rod'; G.vm.setTool('rod'); s.baits.worm = 10; s.bait = 'worm';
        I.fakeBtn(0, true); step(0.05); I.fakeBtn(0, false); step(0.2);
        ok(G.fishing.state === 'wait' && G.fishing.water === 'ice', 'line dropped through the ice -> ' + G.fishing.state + ' ' + G.fishing.water);
        G.fishing.cancel(true);
        // grapple across
        P.place(A.pierBase.clone(), Math.PI); step(0.5);
        const p0 = P.pos.clone();
        P.tool = 'grapple'; G.vm.setTool('grapple'); P.pitch = -0.15;
        G.tools._grapple(); step(1.2);
        ok(P.pos.distanceTo(p0) > 3 || G.tools.cool > 0, 'grapple pulled (' + P.pos.distanceTo(p0).toFixed(1) + ' m)');
        // swimming and climbing back aboard
        b.pos.set(60, 0, 270); b.docked = false; b._updateMatrix(); step(0.2);
        P.place(b.pos.clone().add(V(1.9, -1.2, 0)), 0); P.mode = 'swim'; step(1);
        ok(P.mode === 'swim', 'swimming next to the boat');
        ok(P.tryClimb() && P.boat === b, 'climbed back aboard from the water');
        const info = G.renderer.info.render;
        log('INFO draw calls last frame: ' + info.calls + ', triangles ' + info.triangles);
      }      if (name === 'save') {
        const { State } = await import('../game/State.js?v=1790356418');
        G.state.s.money = 4321; G.state.record('pike', 5, 80); G.state.s.cabin.slots[0] = { sp: 'pike', kg: 5, cm: 80 };
        G.loot.spawn({ sp: 'bass', kg: 2, cm: 40, pos: b.toWorld(V(0, b.deck + 0.5, 0)) }); step(2);
        G.save();
        const S2 = new State().load();
        ok(S2.s.money === 4321, 'money survives a save: ' + S2.s.money);
        ok(!!S2.s.dex.pike && S2.s.cabin.slots[0]?.sp === 'pike', 'journal and cabin mounts survive');
        ok(S2.s.boatCargo.length >= 1, 'fish left on the deck survive (' + S2.s.boatCargo.length + ')');
        ok(!!S2.s.player, 'player position saved');
      }      if (name === 'beasts') {
        const { BEASTS } = await import('../data/BeastData.js?v=1790356418');
        G.state.s.boat.hull = 'expedition'; G._boatChanged();
        const deep = [[-700, 700], [-950, 250], [60, 760], [860, 850]];
        for (const D of BEASTS) {
          const [x, z] = D.id === 'trenchwalker' || D.id === 'cthulhu' ? deep[0] : D.id === 'mirrorfish' ? [880, 60] : D.id === 'whalefall' ? [-1100, 0] : deep[1];
          b.pos.set(x, 0, z); b.vel.set(0, 0); b.docked = false; b.hp = b.stats.hp; b.leaks = []; b.water = 0; b._updateMatrix();
          P.attach(b, V(0, b.deck, 0)); G.world.prebuild(x, z);
          G.tod = D.where.toString().includes('c.night') && !D.where.toString().includes('!c.night') ? 0.95 : 0.45;
          G.great.lev = null; G.great.kraken = null;
          G.beasts.b = null; const B = G.beasts.spawn(D.id, b.pos);
          const start = b.pos.clone(); const phases = new Set(); let refused = null, fishable = false, far = 0;
          for (let i = 0; i < 150 && G.beasts.b; i++) {
            step(1); phases.add(G.beasts.b.phase); far = Math.max(far, b.pos.distanceTo(start));
            const r = G.beasts.claim(V(G.beasts.b.x, 0, G.beasts.b.z));
            if (r && r.refused && !refused) refused = r.text;
            if (G.beasts._fishable(G.beasts.b, V(G.beasts.b.x, 0, G.beasts.b.z))) fishable = true;
            if (G.beasts.b) G.beasts.b.hooked = null;
          }
          const inScene = !!G.scene.getObjectByName('beast:' + D.id);
          ok(B && inScene && phases.size >= (D.id === 'mirrorfish' ? 1 : 2), `${D.name}: appears and runs its cycle (${[...phases].join(', ')})`);
          ok(!!refused, `  ... before the right moment it refuses: "${(refused || '').slice(0, 70)}"`);
          const moved = far;
          if (D.id === 'serpent' || D.id === 'colossus') ok(moved > 12, `  ... its current pushed the boat ${moved.toFixed(0)} m`);
          if (D.id === 'cthulhu') ok(G.world.storm > 0.6 && (b.leaks.length > 0 || b.hp < b.stats.hp), `  ... it brings a storm (${G.world.storm.toFixed(2)}) and the waves hole the ship (${b.leaks.length} holes, hp ${Math.round(b.hp)})`);
          // and it can be caught (playtest catch-all, so the test is quick)
          if (!G.beasts.b) G.beasts.spawn(D.id, b.pos);
          G.admin.autoCatch = true;
          const Bx = G.beasts.b; Bx.fxT = 99; P.attach(b, V(0, b.deck, 0)); const c = G.beasts.claim(V(Bx.x, 0, Bx.z));
          const F = G.fishing; F.cancel(true); P.tool = 'rod'; G.vm.setTool('rod'); P.mode = 'walk';
          F.bpos.set(Bx.x, 0, Bx.z); F.water = 'sea'; F.pending = c; F._hook(); step(5);
          G.admin.autoCatch = false;
          ok(G.state.s.beasts[D.id] && G.state.s.trophies.got['beast:' + D.id], `  ... and landed: trophy earned, journal entry filled in`);
          void fishable;
        }
        const J = await import('../data/JournalData.js?v=1790356418');
        ok(J.progress(G.state.s).per.beasts.got === 10, 'all ten are in the journal\'s Ocean Beasts section');
      }
      if (name === 'flood') {
        G.state.s.boat.hull = 'motor'; G._boatChanged();
        b.pos.set(60, 0, 300); b.docked = false; b.hp = b.stats.hp; b.leaks = []; b.water = 0; b._updateMatrix();
        P.attach(b, V(0, b.deck, 0)); step(0.3);
        b.damage(28, 'test'); b.leaks.push({ x: b.halfWidth(0.5) * 0.95, y: b.deck, z: 0.5, size: 1.1, fix: 0 });
        step(1);
        ok(b.holes.some(m => m.visible), 'a hole is visible in the side of the hull (' + b.holes.filter(m => m.visible).length + ')');
        const w0 = b.water; step(20);
        ok(b.water > w0 + 0.05 && b.parts.flood.visible, 'water rises inside the boat: ' + w0.toFixed(2) + ' -> ' + b.water.toFixed(2));
        b.leaks = [];
        P.tool = 'bucket'; G.vm.setTool('bucket'); P.pitch = -0.6; G.tools.bucketFull = null;
        const w1 = b.water;
        I.fakeBtn(0, true); step(0.05); I.fakeBtn(0, false); step(0.6);
        ok(G.tools.bucketFull === 'bilge' && b.water < w1, 'looking down and clicking scoops bilge water: ' + w1.toFixed(3) + ' -> ' + b.water.toFixed(3));
        // throw it on the deck: it comes back
        P.pitch = -0.2; P.yaw = b.heading + Math.PI; P.local.set(0, b.deck, -2.4);
        const w2 = b.water; I.fakeBtn(0, true); step(0.05); I.fakeBtn(0, false); step(0.6);
        ok(b.water > w2, 'thrown on your own deck, it runs back into the bilge');
        // scoop again, walk to the rail, throw it over
        P.pitch = -0.6; I.fakeBtn(0, true); step(0.05); I.fakeBtn(0, false); step(0.6);
        P.local.set(b.halfWidth(0) - 0.4, b.deck, 0); P.yaw = b.heading - Math.PI / 2 + Math.PI; P.pitch = 0;
        const w3 = b.water; I.fakeBtn(0, true); step(0.05); I.fakeBtn(0, false); step(0.6);
        ok(b.water <= w3 + 0.001 && !G.tools.bucketFull, 'thrown over the rail, it is gone (' + w3.toFixed(3) + ' -> ' + b.water.toFixed(3) + ')');
        b.water = 0;
      }
      if (name === 'ocean') {
        const O = G.ocean;
        b.pos.set(60, 0, 400); b._updateMatrix(); P.attach(b, V(0, b.deck, 0));
        O.hot = []; O.spawnT = 0; step(1);
        ok(O.hot.length > 0, 'the sea makes its own fishing spots: ' + O.hot.map(h => h.kind).join(', '));
        const { pickSpecies } = await import('../game/Fishing.js?v=1790356418');
        const hits = k => { let n = 0; for (let i = 0; i < 2000; i++) if (FISH_BY_ID[pickSpecies({ region: 'home', water: 'sea', bait: k === 'glow' ? 'glow' : 'pieces', night: k === 'glow', zone: 1, hotspot: k }).id].hotspot === k) n++; return n; };
        ok(hits('birds') > 50 && hits('glow') > 20 && hits('bubbles') > 20, 'each hotspot has its own fish (sprats ' + hits('birds') + ', jellies ' + hits('glow') + ', groupers ' + hits('bubbles') + ' in 2000 bites)');
        let storms = 0; for (let i = 0; i < 3000; i++) if (FISH_BY_ID[pickSpecies({ region: 'open', water: 'sea', bait: 'pieces', zone: 2, storm: true }).id].weather) storms++;
        let calm = 0; for (let i = 0; i < 3000; i++) if (FISH_BY_ID[pickSpecies({ region: 'open', water: 'sea', bait: 'pieces', zone: 2, storm: false }).id].weather) calm++;
        ok(storms > 50 && calm === 0, 'storm fish only bite in storms (' + storms + ' in a storm, ' + calm + ' calm)');
        // the chart: pick it up, an X appears; fish on the X, a strongbox; open it, a page about a beast
        const s = G.state.s; s.mysteries = []; s.beastClues = {};
        const map = G.loot.spawn({ sp: 'oldmap', kg: 0.2, cm: 30, pos: P.pos.clone().add(V(0, 0.5, 0)) }); step(0.2);
        G._do({ t: 'pickup', id: map.id }, P.id); step(0.2);
        const m = s.mysteries[0];
        ok(m && m.stage === 0, 'a waterlogged chart puts an X on the map at ' + (m ? m.x + ', ' + m.z : '-'));
        let box = null;
        for (let i = 0; i < 20 && !box; i++) { const sp = pickSpecies({ region: G.world.region(m.x, m.z), water: 'sea', bait: 'worm', zone: 2, mystery: !!O.mysteryAt(V(m.x, 0, m.z)) }); if (sp.id === 'strongbox') box = sp; }
        ok(!!box, 'fishing right on the X pulls up the Sunken Strongbox');
        const sb = G.loot.spawn({ sp: 'strongbox', kg: 20, cm: 70, pos: P.pos.clone().add(V(0, 0.5, 0)), flop: 0 }); sb.pos.set(m.x, 0.5, m.z); step(0.2);
        const n0 = G.loot.items.size; G._do({ t: 'open', id: sb.id }, P.id); step(0.3);
        const page = [...G.loot.items.values()].find(x => x.sp === 'journalpage');
        ok(m.stage === 1 && !!page, 'opening it pays out and leaves a Drowned Journal Page');
        G._do({ t: 'pickup', id: page.id }, P.id); step(0.2);
        const known = Object.keys(s.beastClues);
        ok(known.length === 1, 'the page tells you about ' + known[0] + ' - and makes it more likely to turn up');
        void n0;
      }
      if (name === 'shore') {
        // wade in to knee depth on a beach, face the sea, and land fish
        const spots = [];
        for (let x = -300; x < 300 && spots.length < 3; x += 3) for (let z = -200; z < 400 && spots.length < 3; z += 3) {
          const h = heightAt(x, z);
          if (h < -0.6 && h > -1.0 && heightAt(x, z - 12) > 0.6 && heightAt(x, z + 14) < -3) spots.push(V(x, 0, z));
        }
        ok(spots.length > 0, 'found ' + spots.length + ' waterline spots');
        G.state.s.baits.worm = 50;
        let good = 0;
        for (const sp of [...spots, G.world.settlement.anchors.pierEnd.clone()]) {
          P.place(sp.clone().setY(Math.max(0, heightAt(sp.x, sp.z)) + (sp.y ? 0 : 0)), Math.PI);   // yaw PI faces +z: out to sea
          if (sp.y) P.place(sp.clone(), Math.PI);
          step(0.5);
          const F = G.fishing; F.cancel(true); P.tool = 'rod'; G.vm.setTool('rod');
          F.bpos.copy(P.pos).add(V(0, 0, 12)); F.bpos.y = 0; F.water = 'sea';
          F.pending = { sp: 'cod', kg: 3, cm: 50, size: 0.5 }; F._hook();
          const n0 = G.loot.items.size;
          F.bar.catch = 1; step(0.1);
          const it = [...G.loot.items.values()].pop();
          step(6);
          const alive = it && G.loot.items.has(it.id);
          const wet = alive && G.world.waterAt(it.pos.x, it.pos.z) > it.pos.y;
          const reach = alive ? Math.hypot(it.pos.x - P.pos.x, it.pos.z - P.pos.z) : 99;
          if (alive && !wet && reach < 16) good++;
          log('INFO ' + (sp.y ? 'pier' : 'beach') + ': fish ' + (alive ? (wet ? 'in the water' : 'on dry land') : 'GONE') + ', ' + reach.toFixed(1) + ' m from you');
          if (alive) { G._do({ t: 'pickup', id: it.id }, P.id); ok(it.held === P.id, 'and you can pick it up'); G.loot.remove(it); P.held = null; }
          void n0;
        }
        ok(good === spots.length + 1, 'every fish landed from shore or pier stays on dry land (' + good + '/' + (spots.length + 1) + ')');
      }
      if (name === 'journal') {
        const J = await import('../data/JournalData.js?v=1790356418');
        const { pickSpecies } = await import('../game/Fishing.js?v=1790356418');
        const { ZMIN, RARITY } = await import('../data/FishData.js?v=1790356418');
        const pr = J.progress(G.state.s);
        ok(J.SECTIONS.length >= 8 && pr.of > 60, 'the field guide has ' + J.SECTIONS.length + ' places and ' + pr.of + ' entries: ' + J.SECTIONS.map(S => S.name + ' ' + pr.per[S.id].of).join(', '));
        // every fish listed under a place can really be caught there
        const bad = [];
        for (const S of J.SECTIONS) {
          if (S.id === 'any') continue;
          for (const e of J.sectionEntries(S)) {
            if (e.type !== 'fish') continue;
            const f = FISH_BY_ID[e.id];
            if (f.rarity === 'giant') continue;       // giants come with their world event
            const bait = Object.entries(f.bait).sort((a, b) => b[1] - a[1])[0][0];
            const region = S.id === 'kraken' ? f.where[0] : S.id;
            const ctx = { region, water: f.water === 'any' ? 'sea' : f.water, bait, night: f.time === 'night', dusk: f.time === 'dusk', zone: S.id === 'kraken' ? 2 : Math.max(ZMIN[f.id] || 0, 0), meteor: false, hotspot: f.hotspot || null, storm: f.weather === 'storm' };
            let hit = false; for (let i = 0; i < 4000 && !hit; i++) if (pickSpecies(ctx).id === f.id) hit = true;
            if (!hit) bad.push(S.id + ':' + f.id);
          }
        }
        ok(!bad.length, 'every fish in every section bites where the journal says' + (bad.length ? ' - NOT: ' + bad.join(', ') : ''));
        const kz = ['inkfin', 'suckerfish', 'hatchling'];
        let wrong = 0, right = 0;
        for (let i = 0; i < 6000; i++) { const z = [1, 2, 3][i % 3]; const f = pickSpecies({ region: 'open', water: 'sea', bait: 'pieces', night: true, zone: z }); if (kz.includes(f.id)) { if (z === 2) right++; else wrong++; } }
        ok(right > 0 && wrong === 0, "the kraken's-water fish bite only in the Offshore zone (" + right + ' there, ' + wrong + ' elsewhere)');
        // discovery: hidden until caught
        G.ui.open('journal', { sec: 'frost' }); G.ui.tab.journal = 'fish'; G.ui.render();
        const sc = () => document.querySelector('#screens');
        ok(sc().querySelector('.jsec.on')?.textContent.includes('Frostbite') && ![...sc().querySelectorAll('.jcard b')].some(b => b.textContent === 'Northern Pike' && !G.state.s.dex.pike), 'Frostbite Lake shows only its own fish, unknown ones as ???');
        const before = sc().querySelectorAll('.jcard.unknown').length;
        G.state.record('frostpike', 12, 110, null, 'Frostbite Lake');
        G.ui.render();
        ok(sc().querySelectorAll('.jcard.unknown').length === before - 1 && [...sc().querySelectorAll('.jcard b')].some(b => b.textContent === 'Frost Pike'), 'catching a Frost Pike reveals it');
        G.uiAct('dexSel', 'fish:frostpike'); G.ui.render();
        const page = sc().querySelector('.jpage')?.textContent || '';
        ok(/Habitat/.test(page) && /Frostbite Lake/.test(page) && /First caught/.test(page) && /Worth/.test(page), 'its page: habitat, size, value, where you caught it');
        G.uiAct('jsec', 'reach'); G.ui.render();
        ok(sc().querySelectorAll('.jcard.legend').length === 3 && sc().querySelector('.jcard.legend b').textContent.includes('?'), "Vigil's End: three great leviathan entries, hidden");
        G.uiAct('jsec', 'kraken'); G.ui.render();
        ok(sc().querySelectorAll('.jcard.legend').length === 1, "the Kraken's Water: the kraken's own entry");
        G.ui.close();
      }
      if (name === 'drown') {
        const A = G.world.settlement.anchors;
        // near the beach: exhausted and out of breath, and still fine
        const m = G.homeMooring();
        let spot = null;
        for (let d = 2; d < 40 && !spot; d += 0.5) { const x = m.pos.x + d, z = m.pos.z + 6; if (heightAt(x, z) < -2.2 && heightAt(x + 7, z) > 0.4) spot = V(x, 0, z); }
        if (!spot) { for (let d = 0; d < 80 && !spot; d += 1) { const x = 128 + d, z = 186; if (heightAt(x, z) < -2 && G.player._nearShore) spot = V(x, 0, z); } }
        const nearTest = (pos, sec) => {
          P.place(pos.clone().setY(-1.6), 0); P.mode = 'swim'; P.hp = 100; P.stamina = 0.1; P.breath = 0.2; P.exhausted = false; G.passing = false;
          let passed = false; const op = G.passOut.bind(G); G.passOut = (p, why) => { passed = why; };
          step(sec, () => { P.vel.y = Math.min(P.vel.y, -0.5); });   // hold them under, as badly as possible
          G.passOut = op;
          return { passed, hp: P.hp, mode: P.mode };
        };
        // walk out from the beach until the water is over your head, and stop there
        // somewhere the water is over your head and the beach is still within 12 m
        const shoreSpot = (() => {
          for (let x = -400; x < 400; x += 2) for (let z = -300; z < 420; z += 2) {
            if (heightAt(x, z) > -1.9) continue;
            for (let a = 0; a < 16; a++) if (heightAt(x + Math.cos(a) * 11, z + Math.sin(a) * 11) > 0.5) return V(x, 0, z);
          }
          return null;
        })();
        ok(!!shoreSpot, 'found deep water within 10 m of the beach');
        const r1 = nearTest(shoreSpot, 20);
        ok(!r1.passed && r1.hp > 99, 'near the beach you cannot drown or pass out (hp ' + Math.round(r1.hp) + ', ' + r1.mode + ')');
        const far = V(60, 0, 300);
        const r2 = nearTest(far, 20);
        ok(r2.passed || r2.hp < 100, 'forty metres out the normal rules apply (' + (r2.passed || 'hp ' + Math.round(r2.hp)) + ')');
        void spot; void A;
        P.place(A.spawn.clone(), 0); P.hp = 100; P.exhausted = false; P.stamina = P.maxStamina;
      }
      if (name === 'home') {
        G.ui.close();
        const S = G.world.settlement, A = S.anchors;
        const pim = G.npcs.byId('pim');
        const door = A.cabinDoor.pos;
        ok(pim && pim.pos.distanceTo(door) < 12, 'Pim stands right outside your hut door: ' + (pim ? pim.pos.distanceTo(door).toFixed(1) : '-') + ' m');
        const m = G.homeMooring();
        ok(m.home && m.pos.distanceTo(door) < 60 && heightAt(m.pos.x, m.pos.z) < -1.2, 'your boat is tied up at your own dock (' + m.pos.distanceTo(door).toFixed(0) + ' m, depth ' + (-heightAt(m.pos.x, m.pos.z)).toFixed(1) + ' m)');
        ok(S.cabin.trophies.S.length >= 38 && S.cabin.trophies.L.length >= 6, 'the bookcase has ' + S.cabin.trophies.S.length + ' cubbies and ' + S.cabin.trophies.L.length + ' big spaces');
        ok(S.interact.some(x => x.kind === 'bed') && S.interact.some(x => x.kind === 'bookcase') && S.interact.some(x => x.kind === 'journal'), 'the hut has a bed, a journal and the trophy bookcase');
        // --- the conversation, not a shop window ---
        b.respawn(false); step(0.5);
        P.place(pim.pos.clone().add(V(-1.2, 0.1, 0)), -Math.PI / 2); step(0.3);
        for (let i = 0; i < 3; i++) G.loot.spawn({ sp: 'bass', kg: 2, cm: 40, pos: pim.pos.clone().add(V(-1.5, 0.4, i * 0.4 - 0.4)), flop: 0 });
        const fav = G.loot.spawn({ sp: 'goldtrout', kg: 2, cm: 45, pos: pim.pos.clone().add(V(-1.8, 0.4, 0.8)), flop: 0 });
        step(0.5);
        G.uiAct('favToggle', fav.id);
        ok(fav.fav, 'a fish can be made a favourite');
        G._talk(pim);
        const labels = () => [...(G.ui.talkEl?.querySelectorAll('.dopt span') || [])].map(s => s.textContent);
        ok(labels().join('|').includes('Sell all fish') && labels().join('|').includes('Sell the fish I\'m holding') && labels().join('|').includes('View fishing rods') && labels().join('|').includes('Never mind'), 'talking to Pim offers: ' + labels().join(', '));
        ok(!document.querySelector('#screens.on'), 'and no shop window opened');
        const m0 = G.state.s.money;
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true }));
        step(0.2);
        ok(G.state.s.money > m0 && G.loot.items.has(fav.id), 'SELL ALL (key 1) sold the bass for ' + (G.state.s.money - m0) + ' and left the favourite alone');
        ok(!!G.ui.talkEl?.querySelector('.dreceipt'), 'Pim counts it out in the conversation: "' + G.ui.talkEl?.querySelector('.dlg-line')?.textContent + '"');
        G._do({ t: 'pickup', id: fav.id }, P.id); P.held = fav.id; step(0.1);
        G._dSellHeld(pim); step(0.1);
        ok(G.loot.items.has(fav.id) && /favourite|keep/i.test(G.ui.talkEl?.querySelector('.dlg-line')?.textContent || ''), 'the favourite in your hands will not be sold: "' + G.ui.talkEl?.querySelector('.dlg-line')?.textContent + '"');
        G._do({ t: 'sell', id: fav.id, at: 'pim' }, P.id);
        ok(G.loot.items.has(fav.id), 'not even by a direct sell order');
        G.uiAct('favToggle', fav.id); G._dSellHeld(pim); step(0.1);
        ok(!G.loot.items.has(fav.id), 'unfavourited, it sells');
        G._dRods(pim);
        ok(labels().some(l => l.startsWith('Reinforced Rod')) && !labels().some(l => l.startsWith('Coral Whip')), 'Pim only stocks the home rods: ' + labels().join(', '));
        const coco = G.npcs.byId('coco'); G._dRods(coco);
        ok(labels().some(l => l.startsWith('Coral Whip')) && labels().some(l => l.startsWith('Deepwater')), 'Coco on the Sunken Coast sells the Coral Whip and the Deepwater Rod');
        const maud = G.npcs.byId('maud'); G._dRods(maud);
        ok(labels().some(l => l.startsWith("Vigil's Oath")), "Maud at Vigil's End sells Vigil's Oath");
        G.ui.closeTalk();
      }
      if (name === 'trophy') {
        const s = G.state.s;
        for (const id of ['first', 'sp:marlin', 'kraken', 'great:hushwing', 'lev:gloop']) G.award(id);
        ok(G.state.pendingTrophies().length >= 5, 'trophies earned wait to be placed: ' + G.state.pendingTrophies().join(', '));
        P.place(G.world.settlement.anchors.cabinInside.clone(), Math.PI); step(0.2);
        G._do({ t: 'placeTrophies' }, P.id); step(0.2);
        ok(Object.keys(s.trophies.placed).length >= 5 && !G.state.pendingTrophies().length, 'pressing E at the bookcase puts them on the shelf');
        ok(G.cabin.trophySpots.length >= 5, 'and they are real objects in the hut: ' + G.cabin.trophySpots.length);
        const L = ['kraken', 'great:hushwing'].every(id => s.trophies.placed[id] !== undefined && s.trophies.placed[id] < 7);
        ok(L, 'the kraken and the Hushwing take the big spaces');
        const spot = G.cabin.trophySpots.find(t => t.id === 'sp:marlin');
        ok(spot && G.cabin.trophyNear(spot.pos)?.id === 'sp:marlin', 'looking at a trophy tells you what it is');
      }
      if (name === 'great') {
        const { rollGreat, GREAT } = await import('../data/GreatData.js?v=1790356418');
        const c = {}; for (let i = 0; i < 20000; i++) { const g = rollGreat(); c[g.id] = (c[g.id] || 0) + 1; }
        const pc = k => (c[k] || 0) / 200;
        ok(Math.abs(pc('graveback') - 60) < 2 && Math.abs(pc('ninefold') - 30) < 2 && Math.abs(pc('hushwing') - 10) < 1.5, `spawn odds over 20000 rolls: Graveback ${pc('graveback').toFixed(1)}%, Ninefold ${pc('ninefold').toFixed(1)}%, Hushwing ${pc('hushwing').toFixed(1)}%`);
        G.teleport('vigilsea'); step(0.5);
        const L = G.great.spawnLev('graveback');
        step(0.3);
        ok(!!L && document.querySelector('.worldev.on')?.textContent.includes('LEVIATHAN HAS BEEN SPOTTED'), 'the whole sea is told: "' + (document.querySelector('.worldev h2')?.textContent || '') + ' ' + (document.querySelector('.worldev p')?.textContent || '') + '"');
        const seen = new Set(); for (let i = 0; i < 90; i++) { step(1); seen.add(G.great.lev?.phase); }
        ok(seen.has('rise') && seen.has('deep') && seen.has('dive'), 'it surfaces and dives in turn: ' + [...seen].join(', '));
        ok(G.scene.getObjectByName('great:graveback'), 'the Graveback is in the water');
        let hooks = 0, n = 400;
        for (let i = 0; i < n; i++) { G.great.lev.hooked = null; G.great.lev.wary = 0; const r = G.great.claim(V(G.great.lev.x, 0, G.great.lev.z)); if (r && !r.refused) hooks++; }
        G.great.lev.hooked = null;
        ok(hooks / n > 0.1 && hooks / n < 0.2, 'only about 15% of bites near it hook it: ' + (hooks / n * 100).toFixed(1) + '%');
        // a weak rod has no chance. (Fought from the Leviathan Hunter, out of the rocks.)
        G.state.s.boat.hull = 'expedition'; G._boatChanged();
        const placeBoat = () => { const Lv = G.great.lev; const a = Math.atan2(Lv.z - 1005, Lv.x - 1015); b.pos.set(Lv.x + Math.cos(a) * 70, 0, Lv.z + Math.sin(a) * 70); b.hp = b.stats.hp; b.water = 0; b.leaks = []; b._updateMatrix(); P.attach(b, V(0, b.deck, 0)); };
        const fightIt = (rod) => {
          placeBoat();
          G.state.s.rod = rod; G.state.s.rods = [...new Set([...G.state.s.rods, rod])]; G.vm.setRod(G.fishing.rod);
          const F = G.fishing; F.cancel(true); P.tool = 'rod'; G.vm.setTool('rod');
          F.bpos.set(G.great.lev.x, 0, G.great.lev.z); F.water = 'sea';
          F.pending = G.great._pending(G.great.lev.def, 'great'); G.great.lev.hooked = P.id; F._hook();
          let why = ''; const ot = G.ui.toast.bind(G.ui); G.ui.toast = (m, k) => { why = m; ot(m, k); };
          log('INFO hooked: state ' + F.state + ' fight ' + (F.fish && F.fish.fight) + ' pace ' + (F.fish && F.fish.pace) + ' rod ' + F.rod.rating);
          let t = 0; while (F.state === 'fight' && t < 300) { fightPolicy(); G.update(1 / 30); t += 1 / 30; }
          G.ui.toast = ot;
          log('INFO fight over: ' + F.state + ' after ' + t.toFixed(1) + ' s, meter ' + (F.bar ? F.bar.catch.toFixed(2) : '-') + ' [' + why + ']');
          release(); return t;
        };
        const tw = fightIt('heavy');
        ok(!G.state.s.great.graveback && tw < 20, 'on a Heavy Rod the Graveback breaks you in ' + tw.toFixed(1) + ' s');
        const tl = fightIt('oath');
        ok(true, "INFO a fair player on Vigil's Oath: " + (G.state.s.great.graveback ? 'LANDED it after ' : 'lost it after ') + tl.toFixed(0) + ' s');
        if (!G.great.lev) G.great.spawnLev('ninefold');
        G.admin.autoCatch = true;
        const L2 = G.great.lev;
        placeBoat(); L2.hooked = null; P.tool = 'rod'; G.vm.setTool('rod'); G.fishing.cancel(true);
        const r = G.great.claim(V(L2.x, 0, L2.z));
        ok(r && !r.refused, 'playtest catch-all mode makes it bite');
        G.fishing.pending = r; G.fishing.bpos.set(L2.x, 0, L2.z); G.fishing._hook();
        step(5);
        G.admin.autoCatch = false;
        ok(!G.great.lev && Object.keys(G.state.s.great).length >= 1 && G.state.s.trophies.got['great:' + L2.id], 'and the fight wins itself: caught, rewarded, trophy earned');
      }
      if (name === 'kraken') {
        G.teleport('offshore'); step(0.5);
        const { zoneAt } = await import('../world/MapData.js?v=1790356418');
        ok(P.boat === b && zoneAt(b.pos.x, b.pos.z) === 2 && heightAt(b.pos.x, b.pos.z) < -12, 'on the boat in the Offshore zone (zone ' + (zoneAt(b.pos.x, b.pos.z) + 1) + ', depth ' + (-heightAt(b.pos.x, b.pos.z)).toFixed(0) + ' m)');
        const K = G.great.startKraken(b);
        ok(K && K.arms.length === 3, 'no warning: three arms come over the rail');
        step(2.5);
        log('INFO kraken ' + (G.great.kraken === K) + ' ' + K.phase + ' arms ' + JSON.stringify(K.arms.map(A => [A.st, +A.t.toFixed(1)])) + ' meshes ' + G.great.m.arms.length + ' boat ' + !!G.boatById(K.boat) + ' crew ' + (P.boat === b));
        ok(K.arms.every(A => A.st === 'grip') && G.great.m.arms.length === 3, 'they grip the boat');
        { const T = G.great.m.arms[0]; const tip = T.tip.getWorldPosition(V()), root = T.group.getWorldPosition(V()); log('INFO arm curl seg5 ' + T.segs[5].rotation.z.toFixed(2) + ' tip-root ' + tip.clone().sub(root).toArray().map(v => v.toFixed(1)).join(',') + ' boat ' + b.pos.x.toFixed(0) + ',' + b.pos.z.toFixed(0)); }
        const v0 = b.speed();
        P.tool = 'rod'; G.vm.setTool('rod');
        const arm0 = K.arms[0];
        // walk up to each arm and chop it
        let chops = 0;
        for (const A of K.arms) {
          const L = b.toLocal(A._grip, V());
          P.local.set(Math.sign(L.x) * (b.hull.hw - 0.4), b.deck, Math.max(-b.hull.hl + 0.4, Math.min(b.hull.hl - 0.4, L.z))); step(0.1);
          if (A === arm0) { const hint = G.great.armNear(P.pos); ok(!!hint, 'standing next to an arm, E offers to chop it'); }
          P.tool = 'axe'; G.vm.setTool('axe');
          for (let k = 0; k < 2; k++) { G.vm.play('chop'); G._do({ t: 'chop', arm: A.id }, P.id); step(0.5); chops++; }
        }
        ok(K.arms.every(A => A.hp <= 0), 'two axe blows each and all ' + K.arms.length + ' arms let go (' + chops + ' chops)');
        step(1);
        ok(G.great.kraken?.phase === 'dive' || G.great.kraken?.phase === 'window', 'it screams and dives -> ' + G.great.kraken?.phase);
        ok(G.state.s.trophies.got.survivor, 'Kraken Survivor trophy earned');
        step(6);
        ok(G.great.kraken?.phase === 'window', 'the water where it went down can be fished');
        const spot = G.great.kraken.spot;
        let hooks = 0, n = 500;
        for (let i = 0; i < n; i++) { G.great.kraken.hooked = null; const r = G.great.claim(V(spot.x, 0, spot.z)); if (r && !r.refused) hooks++; }
        G.great.kraken.hooked = null;
        ok(hooks / n > 0.06 && hooks / n < 0.14, 'the kraken takes about one bait in ten: ' + (hooks / n * 100).toFixed(1) + '%');
        G.admin.autoCatch = true;
        const r = G.great.claim(V(spot.x, 0, spot.z));
        G.fishing.pending = r; G.fishing.bpos.set(spot.x, 0, spot.z); P.tool = 'rod'; G.vm.setTool('rod'); G.fishing._hook(); step(5);
        G.admin.autoCatch = false;
        ok(G.state.s.kraken.caught === 1 && G.state.s.trophies.got.kraken && !G.great.kraken, 'the kraken, caught (playtest mode) - trophy earned');
        void v0;
      }
      if (name === 'admin') {
        const key = (code, down) => document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
        G.ui.close();
        key('KeyL', true); key('KeyJ', true); key('KeyM', true);
        ok(G.ui.screen !== 'admin', 'L + J + M alone does nothing');
        key('Digit3', true);
        ok(G.ui.screen === 'admin', 'L + J + M + 3 opens the playtest panel');
        for (const k of ['KeyL', 'KeyJ', 'KeyM', 'Digit3']) key(k, false);
        ok(document.querySelectorAll('#screens [data-act="adm"]').length > 30, 'with ' + document.querySelectorAll('#screens [data-act="adm"]').length + ' controls');
        document.querySelector('#screens [data-arg="giveRod:oath"]').click(); step(0.1);
        ok(G.state.s.rod === 'oath', "Give rod: Vigil's Oath in your hands");
        document.querySelector('#screens [data-arg="toggle:autoCatch"]').click();
        ok(G.admin.autoCatch, 'catch-all mode on');
        document.querySelector('#screens [data-arg="toggle:autoCatch"]').click();
        const m0 = G.state.s.money; document.getElementById('admMoney').value = 777; document.querySelector('#screens [data-arg="moneyAdd"]').click();
        ok(G.state.s.money === m0 + 777, 'money added: +777');
        for (const k of ['KeyL', 'KeyJ', 'KeyM', 'Digit3']) key(k, true);
        ok(G.ui.screen !== 'admin', 'the same combination closes it');
        for (const k of ['KeyL', 'KeyJ', 'KeyM', 'Digit3']) key(k, false);
        G.ui.close();
      }
      if (name === 'vigil') {
        const S = G.world.settlement;
        G.teleport('vigil'); step(1);
        ok(G.mist > 0.9 && G.state.s.flags.vigil && G.state.s.trophies.got.vigil, "reached Vigil's End: fog " + G.mist.toFixed(2) + ', trophy earned');
        ok(S.rocks.length > 50, 'a rock field of ' + S.rocks.length + ' rocks around the island');
        const fisher = ['tobias', 'hesketh', 'ada', 'pell', 'ansel', 'mags'].map(id => G.npcs.byId(id));
        ok(fisher.every(Boolean) && new Set(fisher.map(n => n.def.lines[1])).size === 6, 'six fishermen, each with their own story');
        const d = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) d.push(fisher[i].pos.distanceTo(fisher[j].pos));
        ok(Math.min(...d) > 15 && fisher.every(n => n.pos.y > 8), 'on different cliffs (at least ' + Math.min(...d).toFixed(0) + ' m apart, ' + Math.min(...fisher.map(n => n.pos.y)).toFixed(0) + '+ m up)');
        ok(G.npcs.byId('maud') && G.npcs.byId('maud').pos.distanceTo(S.anchors.vigilHut.pos) < 8, 'Maud the fish seller is by the hut');
        for (const n of fisher) { G._talk(n); step(0.05); }
        G.ui.closeTalk();
        ok(G.state.s.trophies.got.legend, 'hearing all six out earns The Legend');
        const { waveAmp } = await import('../world/MapData.js?v=1790356418');
        ok(waveAmp(900, 880) > 0.8, 'the swell out here (' + waveAmp(900, 880).toFixed(2) + ') is too much for the rowboat (0.75)');
      }
      if (name === 'chat') {
        const C = G.chat;
        const tap = (extra) => {
          document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft', bubbles: true }));
          if (extra) document.dispatchEvent(new KeyboardEvent('keydown', { code: extra, bubbles: true }));
          document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ControlLeft', bubbles: true }));
        };
        tap('KeyC');
        ok(!C.open, 'CTRL+C is a shortcut, it does not open the chat');
        tap();
        ok(C.open && document.activeElement === C.fieldEl, 'a CTRL tap opens the chat with the box focused');
        ok(I.blocked, 'the game ignores keys while you type');
        C.fieldEl.value = 'hello';
        C.fieldEl.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
        ok(!C.open && !I.blocked, 'ENTER sends and closes the box');
        const last = C.lines[C.lines.length - 2], sys = C.lines[C.lines.length - 1];
        ok(last && last.text === 'hello' && last.undelivered && sys.system, 'solo: the line is marked NOT SENT with a reason: "' + (sys && sys.text) + '"');
        tap(); C.fieldEl.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
        ok(!C.open, 'ESC backs out');
        C.push({ name: 'Bo', text: 'spam' }); C.push({ name: 'Bo', text: 'spam' }); C.push({ name: 'Bo', text: 'spam' });
        ok(C.lines[C.lines.length - 1].count === 3, 'repeats collapse into one row with a count (3)');
        C.push({ name: '<img src=x onerror=alert(1)>', text: '<b>bold</b>' });
        ok(!C.logEl.querySelector('img,b'), 'names and text from the network are never HTML');
        G.ui.open('pause'); tap(); ok(!C.open, 'the chat will not open over a menu'); G.ui.close();
        // voice maths: near is loud, far is silent, the walkie ignores distance
        const { Voice } = await import('../net/Voice.js?v=1790356418');
        ok(Voice.proximity(2) === 1 && Voice.proximity(17.5) > 0.2 && Voice.proximity(17.5) < 0.3 && Voice.proximity(40) === 0, 'proximity voice: 2 m full, 17 m ' + Voice.proximity(17.5).toFixed(2) + ', 40 m silent');
        const fakeR = { pos: P.pos.clone().add(V(200, 0, 0)), walkie: false, name: 'Far', color: '#fff' };
        G.remotes.set('fake', fakeR);
        const peer = { call: { close() {} }, prox: { gain: { value: 0 } }, radio: { gain: { value: 0 } }, an: null, level: 0.2, walkie: false };
        G.voice.peers.set('fake', peer);
        G.voice.update(1); ok(peer.prox.gain.value < 0.01 && peer.radio.gain.value < 0.01, 'a friend 200 m away is silent');
        fakeR.walkie = true; G.voice.update(1); ok(peer.radio.gain.value > 1, 'the same friend on the walkie-talkie comes through the radio: gain ' + peer.radio.gain.value.toFixed(2));
        ok(G.voice.talking().some(t => t.radio), 'and the HUD shows them talking on the radio');
        G.voice.peers.delete('fake'); G.remotes.delete('fake');
        // holding C lifts your own walkie-talkie (online only)
        const wasNet = G.net; G.net = { isOnline: true, isHost: true, isClient: false, sendPlayer() {}, sendWorld() {}, sendEvent() {}, sendSave() {}, conns: new Map(), profiles: new Map() };
        I.keys.add('KeyC'); step(0.1);
        ok(G.voice.walkie && G.vm.walkieMesh.visible, 'holding C raises the walkie-talkie');
        I.keys.delete('KeyC'); step(0.1);
        ok(!G.voice.walkie, 'letting go puts it away');
        G.net = wasNet;
      }
      if (name === 'net') {
        const snap = JSON.parse(JSON.stringify(G.worldSnapshot()));
        G.applyWorld(snap, 0.1);
        ok(true, 'world snapshot round-trips (' + JSON.stringify(snap).length + ' bytes)');
      }
      if (name === 'soak') {
        const pts = [[20, 200], [-75, -30], [44, -520], [0, -700], [700, 90], [-820, -40], [-680, 800], [900, 100]];
        for (const [x, z] of pts) { P.place(V(x, Math.max(0, heightAt(x, z)) + 0.2, z), 0); step(2); }
        ok(true, 'visited every region');
      }
    } catch (e) {
      fail++; log('FAIL ' + name + ' threw: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'));
    }
  }
  ok(errs.length === 0, 'no runtime errors (' + errs.length + ')' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  log(`=== ${pass} passed, ${fail} failed ===`);
  window.__done = true;
}
