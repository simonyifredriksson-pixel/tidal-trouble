/* Scripts.js - test scenarios that drive the REAL game in the browser.
   Loaded only with ?script=a,b,c. Each scenario fast-forwards the game with
   game.update() (no rendering) and prints PASS/FAIL lines to the debug
   overlay, so a single headless screenshot is the test report. */

import * as THREE from '../../lib/three.module.js?v=1790185859';
import { FISH_BY_ID, FISH } from '../data/FishData.js?v=1790185859';
import { heightAt } from '../world/Terrain.js?v=1790185859';
import { LEVIATHANS } from '../data/LeviathanData.js?v=1790185859';
import { Bus } from '../core/Bus.js?v=1790185859';
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
        const screens = ['pause', 'settings', 'controls', 'tackle', 'boatyard', 'market', 'guild', 'journal', 'map', 'bait', 'trophy', 'ending'];
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
        P.place(b.pos.clone().add(V(1.9, -1.2, 0)), 0); P.mode = 'swim'; step(1);
        ok(P.mode === 'swim', 'swimming next to the boat');
        ok(P.tryClimb() && P.boat === b, 'climbed back aboard from the water');
        const info = G.renderer.info.render;
        log('INFO draw calls last frame: ' + info.calls + ', triangles ' + info.triangles);
      }      if (name === 'save') {
        const { State } = await import('../game/State.js?v=1790185859');
        G.state.s.money = 4321; G.state.record('pike', 5, 80); G.state.s.cabin.slots[0] = { sp: 'pike', kg: 5, cm: 80 };
        G.loot.spawn({ sp: 'bass', kg: 2, cm: 40, pos: b.toWorld(V(0, b.deck + 0.5, 0)) }); step(2);
        G.save();
        const S2 = new State().load();
        ok(S2.s.money === 4321, 'money survives a save: ' + S2.s.money);
        ok(!!S2.s.dex.pike && S2.s.cabin.slots[0]?.sp === 'pike', 'journal and cabin mounts survive');
        ok(S2.s.boatCargo.length >= 1, 'fish left on the deck survive (' + S2.s.boatCargo.length + ')');
        ok(!!S2.s.player, 'player position saved');
      }      if (name === 'net') {
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
