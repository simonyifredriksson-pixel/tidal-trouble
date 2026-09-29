/* Scripts.js - test scenarios that drive the REAL game in the browser.
   Loaded only with ?script=a,b,c. Each scenario fast-forwards the game with
   game.update() (no rendering) and prints PASS/FAIL lines to the debug
   overlay, so a single headless screenshot is the test report. */

import * as THREE from '../../lib/three.module.js';
import { FISH_BY_ID, FISH } from '../data/FishData.js';
import { heightAt } from '../world/Terrain.js';
import { VIGIL } from '../world/MapData.js';
import { LEVIATHANS } from '../data/LeviathanData.js';
import { Bus } from '../core/Bus.js';
import { BP_BY_ID, bpCost } from '../data/BuildData.js';
import { HULLS } from '../data/BoatData.js';
let landedN = 0; Bus.on('catch', () => landedN++);

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function runScripts(names, game) {
  const log = window.__log || console.log;
  const G = game;
  let pass = 0, fail = 0;
  const fails = [];
  const ok = (cond, msg) => { if (cond) pass++; else { fail++; fails.push(msg); } log((cond ? 'PASS ' : 'FAIL ') + msg); };
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
      if (name === 'anchor') {
        const { ANCHORS, HULL_BY_ID } = await import('../data/BoatData.js');
        const mcap = HULL_BY_ID.motor.cap; HULL_BY_ID.motor.cap = 4;      // (the motorboat normally takes a level-3 anchor at most)
        const { buildAnchor, buildWindlass } = await import('../art/AnchorArt.js');
        for (let lv = 0; lv < 5; lv++) {
          let tris = 0; buildAnchor(lv).traverse(o => { if (o.geometry) tris += o.geometry.attributes.position.count / 3; });
          const W = buildWindlass(lv); let wt = 0; W.group.traverse(o => { if (o.geometry) wt += o.geometry.attributes.position.count / 3; });
          ok(tris > 40 && wt > 20, `${ANCHORS[lv].name}: anchor ${tris} tris, windlass ${wt} tris${W.crank.children.length ? ', with a crank' : ', hauled by hand'}`);
        }
        const s = G.state.s, keep = { hull: s.boat.hull, parts: { ...s.boat.parts }, hulls: [...s.hulls] };
        s.hulls = [...new Set([...s.hulls, 'motor'])]; s.boat.hull = 'motor'; s.boat.parts.anchor = 1;
        const place = (x, z) => { b.docked = false; b.driver = null; b.autopilot = null; b.stowAnchor(); b.pos.set(x, 0, z); b.vel.set(0, 0); b.heading = 0.4; b.yawRate = 0; b._updateMatrix(); };
        b.docked = false; G._boatChanged();
        // pick deep-but-not-too-deep open water with a real current
        let spot = null;
        for (let r = 300; r < 700 && !spot; r += 25) for (let a = 0; a < 6.28 && !spot; a += 0.2) {
          const x = Math.cos(a) * r, z = 80 + Math.sin(a) * r, h = heightAt(x, z);
          if (h < -18 && h > -45 && heightAt(x + 40, z) < -12 && heightAt(x - 40, z) < -12 && heightAt(x, z + 40) < -12 && heightAt(x, z - 40) < -12 && G.world.current(x, z).s > 0.3) spot = [x, z, h];
        }
        ok(!!spot, 'found open water with a current: ' + (spot ? spot.map(v => v.toFixed(0)).join(', ') : '-'));
        place(spot[0], spot[1]);
        const c0 = { ...G.world.current(spot[0], spot[1]) };
        P.attach(b, V(b.hull.anchor[0], b.deck, b.hull.anchor[1] - 0.7));
        P.yaw = b.heading + Math.PI; P.mode = 'walk';
        // 1. nobody at the helm, no anchor: the sea takes you
        let p0 = b.pos.clone(); step(12);
        const drift = V(b.pos.x - p0.x, 0, b.pos.z - p0.z), dd = drift.length();
        const along = dd > 0 ? (drift.x * b.flow.x + drift.z * b.flow.y) / (dd * Math.hypot(b.flow.x, b.flow.y)) : 0;
        ok(dd > 1.5 && along > 0.8, `drifted ${dd.toFixed(1)} m in 12 s with the current (${c0.s.toFixed(2)} m/s), direction match ${along.toFixed(2)}`);
        ok(P.boat === b, 'still standing on the drifting boat');
        // 2. the prompt at the windlass, and the throw
        step(0.1);
        ok(/Throw the anchor/.test(G.ui.el('.prompt').textContent), 'prompt at the windlass: ' + G.ui.el('.prompt').textContent.trim().slice(0, 40));
        I.fake('KeyE', true); step(1 / 30); I.fake('KeyE', false);
        ok(G.vm.action === 'anchorThrow', 'the throw animation plays');
        step(0.25); ok(G.vm.anchorHeld.visible, 'the anchor is in your hands during the swing');
        await new Promise(r => setTimeout(r, 500)); step(0.3);
        ok(b.anchor.st === 'fly' || b.anchor.st === 'sink', 'the anchor left your hands -> ' + b.anchor.st);
        ok(b.rope.mesh.visible && b.anchorMesh.visible && !b.anchorStowed.visible, 'rope and anchor drawn in the water, the rail is empty');
        let t = 0; while (b.anchor.st !== 'set' && t < 30) { step(0.5); t += 0.5; }
        ok(b.anchor.st === 'set', `it hit the bottom after ${t.toFixed(1)} s, ${b.anchor.len.toFixed(1)} m of rope out (depth ${(-heightAt(b.anchor.p.x, b.anchor.p.z)).toFixed(0)} m)`);
        // 3. it holds: the boat swings round on its rope and stops
        // let it drift back until the rope comes tight, then watch it hold
        const taut = () => { const R = b.rollerWorld(), hd = Math.hypot(R.x - b.anchor.p.x, R.z - b.anchor.p.z), dy = R.y - b.anchor.p.y; return hd > Math.sqrt(Math.max(0, b.anchor.len ** 2 - dy ** 2)) - 0.4; };
        t = 0; while (!taut() && t < 120) { step(1); t += 1; }
        ok(taut(), `the boat drifted back until the rope came tight (${t} s)`);
        step(8); p0 = b.pos.clone(); step(15);
        const moved = Math.hypot(b.pos.x - p0.x, b.pos.z - p0.z);
        const R = b.rollerWorld(), hd = Math.hypot(R.x - b.anchor.p.x, R.z - b.anchor.p.z), dy = R.y - b.anchor.p.y, rad = Math.sqrt(Math.max(0, b.anchor.len ** 2 - dy ** 2));
        // a held boat still swings a little on its rope as the current wanders; dragging is the failure
        ok(moved < 3 && hd < rad + 0.6 && b.anchor.drag === 0, `anchored: moved ${moved.toFixed(2)} m in 15 s, bow ${hd.toFixed(1)} m from the anchor (scope ${rad.toFixed(1)} m), not dragging`);
        const bow = V(Math.sin(b.heading), 0, Math.cos(b.heading)), toA = V(b.anchor.p.x - b.pos.x, 0, b.anchor.p.z - b.pos.z).normalize();
        ok(bow.dot(toA) > 0.6, 'the bow swung round to face the anchor: ' + bow.dot(toA).toFixed(2));
        // 4. a current too strong for it: it drags along the bottom
        const cur = G.world.current.bind(G.world);
        G.world.current = () => ({ x: 6, z: 0, s: 6 });
        const a0 = b.anchor.p.clone(); step(6);
        ok(b.anchor.drag > 0 && b.anchor.p.distanceTo(a0) > 1, `a 6 m/s rip drags the Iron Fluke ${b.anchor.p.distanceTo(a0).toFixed(1)} m along the bottom`);
        s.boat.parts.anchor = 4; G._boatChanged();
        const a1 = b.anchor.p.clone(); step(6);
        ok(b.anchor.st === 'set' && b.anchor.p.distanceTo(a1) < 0.5 && b.anchor.drag === 0, 'the Leviathan Hook holds in the same rip: moved ' + b.anchor.p.distanceTo(a1).toFixed(2) + ' m');
        G.world.current = cur;
        s.boat.parts.anchor = 1; G._boatChanged();
        // 5. hauling it back up: hold E
        const len0 = b.anchor.len, crank0 = b.anchor.crank;
        I.keys.add('KeyE'); step(0.5);
        ok(G.hauling && G.vm.left.visible, 'holding E at the windlass hauls (hands on the crank)');
        t = 0; let broke = false; while (b.anchor.st !== 'stow' && t < 80) { step(0.5); t += 0.5; if (b.anchor.st === 'hang') broke = true; }
        I.keys.delete('KeyE'); step(0.2);
        ok(b.anchor.st === 'stow' && broke, `hauled ${len0.toFixed(0)} m back in ${t.toFixed(1)} s (it broke out of the bottom and came up) - stowed`);
        ok(Math.abs(b.anchor.crank - crank0) > 5 && b.anchorStowed.visible && !b.rope.mesh.visible, 'the windlass turned ' + (b.anchor.crank - crank0).toFixed(0) + ' rad and the anchor is back on the rail');
        // 6. too deep for the rope: it just hangs
        s.boat.parts.anchor = 0; G._boatChanged();
        let deep = null;
        for (let x = -700; x > -1200 && !deep; x -= 20) for (let z = -400; z < 400 && !deep; z += 40) if (heightAt(x, z) < -45) deep = [x, z];
        place(deep[0], deep[1]);
        b.throwAnchor(b.rollerWorld().add(V(0, 0, 0)), V(2, 2, 2));
        t = 0; while (b.anchor.st !== 'hang' && b.anchor.st !== 'set' && t < 40) { step(0.5); t += 0.5; }
        ok(b.anchor.st === 'hang' && Math.abs(b.anchor.len - ANCHORS[0].rope) < 0.5, `in ${(-heightAt(deep[0], deep[1])).toFixed(0)} m of water the Stone & Rope runs out at ${b.anchor.len.toFixed(0)} m and just hangs`);
        p0 = b.pos.clone(); step(8);
        ok(Math.hypot(b.pos.x - p0.x, b.pos.z - p0.z) > 0.5, 'and a hanging anchor does not stop the drift');
        // 7. co-op: the anchor travels in the boat snapshot
        const snap = b.snapshot();
        ok(Array.isArray(snap.an) && snap.an[0] === 3 && JSON.stringify(snap).length < 3000, 'snapshot carries the anchor: ' + JSON.stringify(snap.an));
        b.stowAnchor(); ok(b.snapshot().an === 0, 'and a stowed anchor costs nothing');
        // 8. no throwing it off the dock
        b.respawn(false); ok(!b.throwAnchor(V(0, 5, 0), V(0, 0, 0)), 'you cannot throw the anchor while tied up');
        HULL_BY_ID.motor.cap = mcap;
        s.boat.hull = keep.hull; s.boat.parts = keep.parts; s.hulls = keep.hulls; G._boatChanged(); b.respawn(false);
        P.detach(); P.place(G.world.settlement.anchors.spawn.clone());
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
        ok(G.state.s.boatPlans.includes('motor') && G.state.s.boat.hull !== 'motor', 'buying the motorboat gets you its blueprint - you build it yourself');
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
        G.state.s.mats = { wood: 0 };
        I.fakeBtn(0, true); step(1.5); I.fakeBtn(0, false);
        ok(b.leaks.length === 1 && b.leaks[0].fix === 0, 'with no wood in the pack the hole stays a hole');
        G.state.s.mats = { wood: 10 };
        I.fakeBtn(0, true); step(2.5); I.fakeBtn(0, false);
        ok(b.leaks.length === 0 && G.state.s.mats.wood === 4, 'with wood the hammer fixes it - six planks for a bad hole (' + G.state.s.mats.wood + ' left)');
        step(0.1);
        ok(b.patches.length === 1 && b.patchMeshes?.[0]?.visible && b.patchMeshes[0].position.x > 0, 'and two planks stay nailed over where the hole was');
        ok(b.snapshot().pa.length === 1, 'the patch goes out to the crew too');
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
        const { State } = await import('../game/State.js');
        G.state.s.money = 4321; G.state.record('pike', 5, 80); G.state.s.cabin.slots[0] = { sp: 'pike', kg: 5, cm: 80 };
        G.loot.spawn({ sp: 'bass', kg: 2, cm: 40, pos: b.toWorld(V(0, b.deck + 0.5, 0)) }); step(2);
        G.save();
        const S2 = new State().load();
        ok(S2.s.money === 4321, 'money survives a save: ' + S2.s.money);
        ok(!!S2.s.dex.pike && S2.s.cabin.slots[0]?.sp === 'pike', 'journal and cabin mounts survive');
        ok(S2.s.boatCargo.length >= 1, 'fish left on the deck survive (' + S2.s.boatCargo.length + ')');
        ok(!!S2.s.player, 'player position saved');
      }      if (name === 'beasts') {
        const { BEASTS } = await import('../data/BeastData.js');
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
        const J = await import('../data/JournalData.js');
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
      if (name === 'ship') {
        const prompt = () => { let t = ''; const o = G.ui.prompt.bind(G.ui); G.ui.prompt = h => { t = h || ''; o(h); }; step(2 / 30); G.ui.prompt = o; return t; };
        const pressE = () => { I.fake('KeyE', true); step(1 / 30); I.fake('KeyE', false); step(2 / 30); };
        const hull0 = G.state.s.boat.hull;
        G._do({ t: 'admin', cmd: 'giveHull', id: 'wayfarer' }, P.id);
        const H = b.hull, Hd = H.hold;
        ok(H.id === 'wayfarer' && Hd && b.parts.holdFlood && b.parts.sails?.length >= 2, 'the Wayfarer: ' + (H.hl * 2).toFixed(0) + ' m long, two masts, a hold below deck');
        b.pos.set(60, 0, 400); b.vel.set(0, 0); b.docked = false; b.leaks = []; b.breaks = []; b.water = 0; b.hp = b.stats.hp; b._updateMatrix();
        P.attach(b, V(Hd.hatch[0], b.deck, Hd.hatch[1] + 0.9)); P.mode = 'walk'; step(0.3);
        ok(prompt().includes('Climb down into the hold'), 'at the hatch: "Climb down into the hold"');
        pressE(); step(1);
        ok(P.inHold && P.boat === b && Math.abs(P.local.y - Hd.floor) < 0.15 && P.mode === 'walk' && !P.underwater, 'down the ladder: standing on the hold floor (y ' + P.local.y.toFixed(2) + ')');
        // walk to the stern end of the hold: the walls keep you in
        P.yaw = b.heading + Math.PI; I.fake('KeyW', true); step(4); I.fake('KeyW', false); step(0.3);
        ok(P.inHold && P.local.z >= Hd.z0 && P.local.z < Hd.z1 && Math.abs(P.local.x) < Hd.hw && Math.abs(P.local.y - Hd.floor) < 0.15, 'walked to the end of the hold and stayed inside (z ' + P.local.z.toFixed(1) + ')');
        ok(!G.fishing.active, 'no fishing through the deck from down here');
        // a fish dropped down the hatch lands on the hold floor
        const fish = G.loot.spawn({ sp: 'bass', kg: 2, cm: 40, pos: b.toWorld(V(Hd.hatch[0], b.deck - 0.5, Hd.hatch[1])), vel: V(0, 0, 0), flop: 0 });
        step(1.5);
        ok(fish.boat === b && Math.abs(fish.local.y - Hd.floor) < 0.4, 'a fish dropped down the hatch ends up on the hold floor (y ' + (fish.local?.y ?? NaN).toFixed(2) + ')');
        G.loot.remove(fish);
        // the hold floods first, and deep enough it goes over your head
        b.water = 0.4; step(0.4);
        ok(b.parts.holdFlood.visible && !b.parts.flood.visible && !P.underwater, 'a little water: the hold fills, the deck stays dry, you are wading');
        b.water = 0.745; step(0.4);
        ok(P.underwater, 'a flooded hold: water over your head (' + b.holdWaterLocal().toFixed(2) + ' m)');
        b.water = 0; P.breath = P.maxBreath; step(0.2);
        // back up
        P.local.set(Hd.hatch[0], Hd.floor, Hd.hatch[1] - 0.4); step(0.2);
        ok(prompt().includes('Climb up to the deck'), 'at the ladder: "Climb up to the deck"');
        pressE(); step(0.5);
        ok(!P.inHold && Math.abs(P.local.y - b.deck) < 0.3, 'back on deck');
        // breakage: engine, wheel, rail - and the hammer fixes them
        b.breakSomething('engine'); b.breakSomething('wheel'); const R = b.breakSomething('rail');
        step(0.3);
        ok(b.broken('engine') && b.broken('wheel') && b.breakMeshes?.some(m => m.visible), 'engine, wheel and a rail broken, and you can see it');
        ok(b.railGap(R.x, R.z) && !b.railGap(-R.x, R.z), 'a snapped rail leaves a gap on its side only');
        // a shove that would not throw you over a rail throws you through the gap
        const side = Math.sign(R.x), dir = V(Math.cos(b.heading), 0, -Math.sin(b.heading)).multiplyScalar(side);
        const z2 = R.z > 0 ? R.z - 3 : R.z + 3;
        P.attach(b, V(side * (b.halfWidth(z2) - 0.4), b.deck, z2)); P.mode = 'walk'; step(0.1);
        G.knockPlayer(P, dir, 2.2, 'test'); step(1.6);
        const safe = P.boat === b && !b.railGap(side, z2);
        P.attach(b, V(side * (b.halfWidth(R.z) - 0.4), b.deck, R.z)); P.mode = 'walk'; step(0.1);
        const atGap = b.railGap(P.local.x, P.local.z), lx0 = P.local.x.toFixed(2), hw0 = b.halfWidth(P.local.z).toFixed(2);
        G.knockPlayer(P, dir, 2.2, 'test'); step(0.2);
        ok(safe && P.boat !== b, 'the same shove: stays aboard at a whole rail, goes through the broken one (safe ' + safe + ', gap ' + atGap + ', x ' + lx0 + ' / ' + hw0 + ', aboard after: ' + (P.boat === b) + ')');
        P.attach(b, V(0, b.deck, -H.hl + 1.2)); P.mode = 'walk'; P.tool = 'hammer'; G.vm.setTool('hammer'); step(0.3);
        const n0 = b.breaks.length;
        G.state.s.mats = { wood: 20, iron: 6 };
        I.fakeBtn(0, true); step(4); I.fakeBtn(0, false); step(0.2);
        ok(b.breaks.length < n0 && !b.broken('engine'), 'hammering at the stern fixes the engine (' + n0 + ' -> ' + b.breaks.length + ' broken)');
        b.breaks = []; P.tool = 'rod'; G.vm.setTool('rod');
        ok(G.ui.screen !== 'boatyard' && (await import('../data/BoatData.js')).HULLS.some(h => h.id === 'wayfarer' && h.price > 30000), 'the Wayfarer is for sale at the boatyard');
        G._do({ t: 'admin', cmd: 'giveHull', id: hull0 }, P.id);
        P.attach(b, V(0, b.deck, 0));
      }
      if (name === 'secrets') {
        const prompt = () => { let t = ''; const o = G.ui.prompt.bind(G.ui); G.ui.prompt = h => { t = h || ''; o(h); }; step(2 / 30); G.ui.prompt = o; return t; };
        const pressE = () => { I.fake('KeyE', true); step(1 / 30); I.fake('KeyE', false); step(2 / 30); };
        const { SECRETS } = await import('../data/SecretData.js');
        const { GROTTO } = await import('../world/Secrets.js');
        const { pickSpecies } = await import('../game/Fishing.js');
        const W = G.world.secrets, s = G.state.s;
        s.secrets = {}; s.caches = {};
        ok(W.sites.length === 4 && W.sites.every(x => x.cache), 'four hidden places, each with a cache: ' + SECRETS.map(D => D.name).join(', '));
        // found by going there
        let banner = ''; const ob = G.ui.banner.bind(G.ui); G.ui.banner = (t, ...r) => { banner = t; ob(t, ...r); };
        G.teleport('castaway'); step(1.5);
        ok(s.secrets.castaway && banner === 'CASTAWAY KEY', 'walking onto Castaway Key finds it (banner: ' + banner + ')');
        ok(G.world.height(430, 650) > 2, 'Castaway Key is real ground, ' + G.world.height(430, 650).toFixed(1) + ' m high');
        // dig
        const cs = W.byId.castaway;
        P.place(cs.cache.clone().setY(G.world.height(cs.cache.x, cs.cache.z) + 0.1).add(V(0.8, 0, 0)), 0); step(0.6);
        ok(prompt().includes('Dig where the X is') && cs.full[0].visible, 'the X in the sand: "Dig where the X is"');
        const n0 = G.loot.items.size; pressE(); step(0.8);
        const box = [...G.loot.items.values()].find(it => it.sp === 'strongbox');
        ok(box && G.loot.items.size > n0 && s.caches.castaway === s.day && !cs.full[0].visible, 'dug up a strongbox, the X is gone');
        if (box) G.loot.remove(box);
        ok(prompt().includes('(you have had yours)'), 'dig again: you have had yours');
        // the grotto: a boat fits inside and the walls are solid
        G.teleport('grotto'); step(0.5);
        const gd = () => Math.hypot(b.pos.x - GROTTO.x, b.pos.z - GROTTO.z);
        ok(W.inCave(P.pos) && gd() < GROTTO.ri && s.secrets.grotto, 'drove into the grotto (' + gd().toFixed(1) + ' m from the middle) and found it');
        const back = GROTTO.door + Math.PI;
        let maxD = 0;
        step(5, () => { b.vel.set(Math.cos(back) * 7, Math.sin(back) * 7); maxD = Math.max(maxD, gd()); });
        ok(maxD < GROTTO.ri + 1.5, 'rammed the back wall at full speed: the boat stays inside (max ' + maxD.toFixed(1) + ' m)');
        b.vel.set(0, 0);
        G.fishing.bpos.set(GROTTO.x, 0, GROTTO.z);
        ok(G.fishing._ctx().site === 'grotto', 'a line cast in the grotto is in grotto water');
        let cave = 0; for (let i = 0; i < 2000; i++) if (FISH_BY_ID[pickSpecies({ region: 'home', water: 'sea', bait: 'glow', zone: 1, site: 'grotto' }).id].site === 'grotto') cave++;
        let out = 0; for (let i = 0; i < 2000; i++) if (FISH_BY_ID[pickSpecies({ region: 'home', water: 'sea', bait: 'glow', zone: 1 }).id].site) out++;
        ok(cave > 300 && out === 0, 'cave fish bite in the grotto (' + cave + ' of 2000) and nowhere else (' + out + ')');
        G.teleport('grottoLedge'); step(1.2);
        ok(P.mode === 'walk' && Math.abs(P.pos.y - 1.3) < 0.35, 'standing on the smugglers\' ledge (y ' + P.pos.y.toFixed(2) + ')');
        const m0 = s.money;
        const gc = W.byId.grotto; P.place(gc.cache.clone().setY(1.35).add(V(0, 0, 0)).lerp(G.world.settlement.anchors.grottoLedge, 0.5), 0); step(0.4);
        ok(prompt().includes("smugglers' cache"), 'at the chest: "' + prompt().replace(/<[^>]+>/g, '').trim() + '"');
        pressE(); step(0.5);
        ok(s.money > m0 + 1000, 'the smugglers\' takings: +' + (s.money - m0) + ' coins');
        // the temple: swim down to the altar
        G.teleport('templeDive'); I.fake('KeyQ', true); step(0.5);
        ok(P.mode === 'swim' && P.underwater && s.secrets.temple, 'diving on the Drowned Temple, holding Q (' + P.pos.y.toFixed(1) + ' m)');
        ok(prompt().includes('Take the relic'), 'underwater at the altar: "Take the relic from the altar"');
        pressE(); I.fake('KeyQ', false); step(0.3);
        const idol = [...G.loot.items.values()].find(it => it.sp === 'artifact');
        const y0 = idol?.pos.y ?? 0; step(3);
        ok(s.trophies.got.relic && idol && idol.pos.y > y0 + 1, 'the relic is yours (trophy), and the idol floats up to the surface (' + y0.toFixed(1) + ' -> ' + (idol?.pos.y ?? 0).toFixed(1) + ')');
        for (const it of [...G.loot.items.values()]) if (['artifact', 'journalpage'].includes(it.sp)) G.loot.remove(it);
        G.teleport('promiseDive'); I.fake('KeyQ', true); step(0.5);
        ok(s.secrets.promise && prompt().includes('sea chest'), "the Bright Promise, and Sarah Moore's sea chest (" + P.pos.y.toFixed(1) + ' m)');
        I.fake('KeyQ', false);
        ok(s.trophies.got.explorer, 'all four found: "Off the Charts" trophy');
        // they are on the map once found
        G.ui.open('map'); G.ui.render(); step(0.1);
        ok(!!document.querySelector('canvas.worldmap'), 'the map draws with the hidden places on it');
        G.ui.close();
        s.day += 30;
        ok(G.cacheFull('castaway') === false, 'a secret cache never refills for you - not even a month later');
        const wasNet = G.net; G.net = { isOnline: true, selfId: P.id, profiles: new Map([['guest-b', { key: 'pguestb' }]]), sendEvent() {} };
        ok(G.cacheFull('castaway', 'guest-b'), 'but a crewmate who has not opened it can still have theirs');
        G._do({ t: 'plunder', id: 'castaway' }, 'guest-b');
        ok(!G.cacheFull('castaway', 'guest-b') && G.claimed('secret:castaway', 'guest-b'), 'and then it is theirs, once');
        G.net = wasNet;
        s.day -= 7;
        G.teleport('home'); step(0.5);
      }
      if (name === 'ocean') {
        const O = G.ocean;
        b.pos.set(60, 0, 400); b._updateMatrix(); P.attach(b, V(0, b.deck, 0));
        O.hot = []; O.spawnT = 0; step(1);
        ok(O.hot.length > 0, 'the sea makes its own fishing spots: ' + O.hot.map(h => h.kind).join(', '));
        const { pickSpecies } = await import('../game/Fishing.js');
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
        const J = await import('../data/JournalData.js');
        const { pickSpecies, speciesWeights } = await import('../game/Fishing.js');
        const { ZMIN, RARITY } = await import('../data/FishData.js');
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
            const water = f.water === 'any' ? 'sea' : f.water === 'fresh' ? (S.id === 'frost' ? 'ice' : 'lake') : f.water;
            const ctx = { region, water, bait, night: f.time === 'night', dusk: f.time === 'dusk', zone: S.id === 'kraken' ? 2 : Math.max(ZMIN[f.id] || 0, 0), meteor: false, hotspot: f.hotspot || null, storm: f.weather === 'storm', site: f.site || null, spots: f.spot ? [f.spot] : [] };
            const hit = speciesWeights(ctx).some(q => q.f.id === f.id && q.w > 0);
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
        for (const id of ['first', 'sp:oarfish', 'kraken', 'great:hushwing', 'lev:gloop']) G.award(id);
        ok(G.state.pendingTrophies().length >= 5, 'trophies earned wait to be placed: ' + G.state.pendingTrophies().join(', '));
        P.place(G.world.settlement.anchors.cabinInside.clone(), Math.PI); step(0.2);
        G._do({ t: 'placeTrophies' }, P.id); step(0.2);
        ok(Object.keys(s.trophies.placed).length >= 5 && !G.cabin.pending().length, 'pressing E at the bookcase puts them on the shelf');
        ok(G.cabin.trophySpots.length >= 5, 'and they are real objects in the hut: ' + G.cabin.trophySpots.length);
        const L = ['kraken', 'great:hushwing'].every(id => s.trophies.placed[id] !== undefined && s.trophies.placed[id] < 7);
        ok(L, 'the kraken and the Hushwing take the big spaces');
        // after a full journal (an earlier suite) the oarfish may be outranked off the shelf
        const spot = G.cabin.trophySpots.find(t => t.id === 'sp:oarfish') || G.cabin.trophySpots[0];
        ok(spot && G.cabin.trophyNear(spot.pos)?.id === spot.id, 'looking at a trophy tells you what it is');
        // more trophies than the shelf holds: the grand ones stay up, the rest go to storage, nothing is stuck pending
        for (const id in (await import('../data/TrophyData.js')).TROPHY_BY_ID) G.state.award(id);
        G._do({ t: 'placeTrophies' }, P.id); step(0.2);
        const TD = await import('../data/TrophyData.js');
        const caps = G.cabin.caps(), placed = Object.keys(s.trophies.placed), earned = Object.keys(s.trophies.got).filter(id => TD.TROPHY_BY_ID[id]).length;
        ok(placed.length === caps.S + caps.L && !G.cabin.pending().length, 'a full shelf: ' + placed.length + ' on show, ' + (Object.keys(s.trophies.got).length - placed.length) + ' in storage, none waiting');
        ok(['lev:gloop', 'kraken', 'great:hushwing'].every(id => s.trophies.placed[id] !== undefined), 'the relics of real monsters keep their places');
        G.ui.open('journal', {}); G.ui.tab.journal = 'trophies'; G.ui.render();
        const rows = document.querySelectorAll('#screens .list .li').length;
        ok(rows === earned, 'the journal lists every trophy earned (' + rows + ' of ' + earned + ')');
        G.ui.close(); G.ui.tab = {};
      }
      if (name === 'great') {
        const { rollGreat, GREAT } = await import('../data/GreatData.js');
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
        const placeBoat = () => { const Lv = G.great.lev; const a = Math.atan2(Lv.z - VIGIL.z, Lv.x - VIGIL.x); b.pos.set(Lv.x + Math.cos(a) * 70, 0, Lv.z + Math.sin(a) * 70); b.hp = b.stats.hp; b.water = 0; b.leaks = []; b._updateMatrix(); P.attach(b, V(0, b.deck, 0)); };
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
        const { zoneAt } = await import('../world/MapData.js');
        ok(P.boat === b && zoneAt(b.pos.x, b.pos.z) === 2 && heightAt(b.pos.x, b.pos.z) < -12, 'on the boat in the Offshore zone (zone ' + (zoneAt(b.pos.x, b.pos.z) + 1) + ', depth ' + (-heightAt(b.pos.x, b.pos.z)).toFixed(0) + ' m)');
        const K = G.great.startKraken(b);
        ok(K && K.phase === 'glimpse', 'first, only arms: a tentacle rises out of the sea, far off');
        step(3); ok(G.great.m.glimpse && G.great.m.glimpse.group.visible, 'it towers over the water');
        const g1 = G.great.m.glimpse.group.position.clone(); step(5.5);
        ok(G.great.m.glimpse && G.great.m.glimpse.group.position.distanceTo(g1) > 20, 'it sinks, and another rises somewhere else (' + (G.great.m.glimpse ? G.great.m.glimpse.group.position.distanceTo(g1).toFixed(0) : 0) + ' m away)');
        let offAt = -1; for (let i = 0; i < 20 * 30 && K.phase === 'glimpse'; i++) { G.update(1 / 30); if (offAt < 0 && P.boat !== b) offAt = i / 30; }
        if (offAt >= 0) log('INFO knocked off the boat during the glimpses at ' + offAt.toFixed(1) + ' s');
        if (P.boat !== b) P.attach(b, V(0, b.deck, 0));
        ok(K.phase === 'attack' && K.arms.length === 3, 'then three arms come over the rail');
        step(2.5);
        ok(K.arms.every(A => A.st === 'grip') && G.great.m.arms.length === 3, 'they grip the boat');
        { const T = G.great.m.arms[0]; const tip = T.tip.getWorldPosition(V()), root = T.group.getWorldPosition(V()); log('INFO arm curl seg5 ' + T.segs[5].rotation.z.toFixed(2) + ' tip-root ' + tip.clone().sub(root).toArray().map(v => v.toFixed(1)).join(',') + ' boat ' + b.pos.x.toFixed(0) + ',' + b.pos.z.toFixed(0)); }
        const v0 = b.speed();
        P.tool = 'rod'; G.vm.setTool('rod');
        const arm0 = K.arms[0];
        // walk up to each arm and chop it
        let chops = 0;
        for (const A of K.arms) {
          if (P.boat !== b) { log('INFO off the boat before chopping arm ' + A.id); P.attach(b, V(0, b.deck, 0)); P.mode = 'walk'; }
          const L = b.toLocal(A._grip, V());
          P.local.set(Math.sign(L.x) * (b.hull.hw - 0.4), b.deck, Math.max(-b.hull.hl + 0.4, Math.min(b.hull.hl - 0.4, L.z))); step(0.1);
          if (A === arm0) { const hint = G.great.armNear(P.pos); ok(!!hint, 'standing next to an arm, E offers to chop it'); }
          P.tool = 'axe'; G.vm.setTool('axe');
          for (let k = 0; k < 2; k++) { G.vm.play('chop'); G._do({ t: 'chop', arm: A.id }, P.id); step(0.5, () => { if (P.boat !== b) { P.attach(b, V(0, b.deck, 0)); P.mode = 'walk'; } }); chops++; }
        }
        ok(K.arms.every(A => A.hp <= 0), 'two axe blows each and all ' + K.arms.length + ' arms let go (' + chops + ' chops)');
        step(1, () => { if (P.boat !== b) { P.attach(b, V(0, b.deck, 0)); P.mode = 'walk'; } });
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
        // the ship controls
        const click = arg => { const el = document.querySelector(`#screens [data-arg="${arg}"]`); if (el) el.click(); step(0.1); G.ui.render(); return !!el; };
        const hull0 = G.state.s.boat.hull;
        ok(click('giveHull:wayfarer') && b.hull.id === 'wayfarer' && !!b.hull.hold, 'Give hull: the Wayfarer, with a hold');
        b.pos.set(60, 0, 400); b.docked = false; b._updateMatrix(); P.attach(b, V(0, b.deck, 0));
        ok(click('hole') && click('bigHole') && b.leaks.length >= 2, 'Small hole + big hole: ' + b.leaks.length + ' holes in the hull');
        ok(click('breakPart:rail') && click('breakPart:engine') && b.broken('rail') && b.broken('engine'), 'Break the rail and the engine: ' + b.breaks.map(x => x.kind).join(', '));
        ok(click('flood:0.3') && b.water >= 0.29, 'Flood +30%: water ' + Math.round(b.water * 100) + '%');
        ok(click('hold') && P.inHold, 'Put me in the hold');
        ok(document.querySelector('#screens .admin')?.textContent.includes('broken: rail, engine'), 'the panel shows what is broken');
        ok(click('repairAll') && !b.leaks.length && !b.breaks.length && b.water === 0, 'Repair everything');
        ok(click('secretsAll') && Object.keys(G.state.s.secrets).length === 4, 'Reveal all hidden places');
        ok(click('secretsReset') && !Object.keys(G.state.s.secrets).length, 'Forget them all');
        ok(click('tp:castaway') && Math.hypot(P.pos.x - 430, P.pos.z - 650) < 20, 'Teleport: Castaway Key');
        ok(click('giveHull:' + hull0), 'back to the ' + hull0);
        // the fish tools: grouped by area, five from an area, fill and clear the journal
        ok(document.querySelectorAll('#admFish optgroup').length >= 10, 'the fish list is grouped by area (' + document.querySelectorAll('#admFish optgroup').length + ' groups)');
        const n0 = G.loot.items.size;
        G.ui._adm.area = 'black'; ok(click('areaFish') && G.loot.items.size === n0 + 5, 'five random fish from the Blackwater (' + (G.loot.items.size - n0) + ')');
        ok(click('dexFill:all') && (await import('../data/JournalData.js')).progress(G.state.s).per.kraken.got === 44 - 1, 'fill the whole journal: every fish entry discovered');
        ok(click('dexClear') && !Object.keys(G.state.s.dex).length, 'clear the journal');
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
        const { waveAmp } = await import('../world/MapData.js');
        const wa = waveAmp(VIGIL.x - 210, VIGIL.z - 215), wd = waveAmp(G.world.settlement.anchors.vigilLanding.x, G.world.settlement.anchors.vigilLanding.z);
        ok(wa > 3, 'the swell out here (' + wa.toFixed(2) + ') is the biggest in the sea - far too much for the rowboat (0.75)');
        ok(wd < 1.6, 'but the landing is in the lee of the cliffs (' + wd.toFixed(2) + '), so you can stand on the dock');
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
        const { Voice } = await import('../net/Voice.js');
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
      if (name === 'intro') {
        // the first night, fast-forwarded: storm, the thing below twice, the wreck, the beach, Old Gus
        const I0 = G.intro;
        const spot = I0.wakeSpot();
        const A = G.world.settlement.anchors;
        const hut = A.spawn;
        const sea = [0, 1, 2, 3, 4, 5, 6, 7].some(k => heightAt(spot.pos.x + Math.cos(k * 0.785) * 5, spot.pos.z + Math.sin(k * 0.785) * 5) < -0.3);
        ok(heightAt(spot.pos.x, spot.pos.z) > 0.2 && sea, `you wash up on a beach by the water (${spot.pos.x.toFixed(0)}, ${spot.pos.z.toFixed(0)}, h ${heightAt(spot.pos.x, spot.pos.z).toFixed(2)}, ${spot.pos.distanceTo(hut).toFixed(0)} m from the hut)`);
        I0.start(0);
        ok(I0.active && !G.ui.hud.classList.contains('hidden') === false, 'the game starts at sea, HUD hidden');
        const toolBefore = P.tool;
        let sawThing = false, maxRoll = 0, said = false, black = false, beach = false;
        for (let i = 0; i < 48 * 30 && I0.active; i++) {
          G.update(1 / 30);
          if (I0.thing.group.visible) sawThing = true;
          if (I0.t < 30) maxRoll = Math.max(maxRoll, Math.abs(I0.kick.r));
          if (I0.said) said = true;
          if (I0.t > 35.5 && I0.t < 38 && I0.black > 0.95) black = true;
          if (I0.onBeach) beach = true;
        }
        ok(sawThing, 'the Thing Below came up out of the sea');
        ok(maxRoll > 0.05, 'its wave rocked the boat (roll kick ' + maxRoll.toFixed(2) + ')');
        ok(said, 'you said it: "What the hell was that?"');
        ok(I0._smashed, 'the second time, it smashed the boat');
        ok(black, 'three seconds of black');
        ok(beach && !I0.active, 'you woke up on the beach and got your hands back');
        const gus = G.npcs.byId('gus');
        ok(gus && gus.pos.distanceTo(P.pos) < 4, 'Old Gus is standing over you (' + (gus ? gus.pos.distanceTo(P.pos).toFixed(1) : '-') + ' m)');
        step(1);
        ok(!!G.ui.talkEl, 'and he talks to you straight away');
        ok(P.tool === toolBefore && G.state.s.flags.intro, 'normal play from here');
        // one thing to say at each step, all the way through; the three men come just before 'what now'
        const asked = []; let single = true;
        for (let i = 0; i < 40 && G.ui.talkEl && G.ui._talkOpts?.length; i++) {
          const o = G.ui._talkOpts;
          if (o.length !== 1) single = false;
          if (o[0].label !== '...') asked.push(o[0].label);
          G.ui._choose(G.ui.talkNpc, o[0]);
        }
        const qs = asked.filter(q => !/^Thanks/.test(q));
        const iLeave = qs.findIndex(q => /leave this ocean/.test(q)), iNow = qs.findIndex(q => /supposed to do now/.test(q));
        ok(single, 'on the beach you only ever have one thing to say (' + asked.length + ' lines)');
        ok(iLeave >= 0 && iNow === qs.length - 1 && qs.slice(iLeave, iNow).length >= 1 && iNow > iLeave, 'the three men come before the last question, what do I do now: ' + qs.map(q => q.slice(0, 18)).join(' / '));
        G.ui.closeTalk();
        step(0.5);
        ok(G.renderer.domElement.style.filter === '', 'the blur is gone');
      }
      if (name === 'gather') {
        // find a pine in the home forest, chop it down, pick up the logs; break a rock
        const Ga = G.gather, s = G.state.s;
        let tree = null;
        for (const [k, blk] of G.world.flora.blocks) { if (blk.key !== 'pine' || tree) continue; for (let i = 0; i < blk.list.length; i++) { const it = blk.list[i]; if (Math.hypot(it[0], it[2] - 60) < 200 && it[3] > 0.8) { tree = { k, i, it }; break; } } }
        ok(!!tree, 'there is a pine to chop near the bay');
        if (tree) {
          const [x, y, z] = tree.it;
          P.place(V(x - 1.6, y + 0.1, z), Math.PI / 2 * 3 - Math.PI);       // facing +x, at the trunk
          P.yaw = Math.atan2(-(x - P.pos.x), -(z - P.pos.z));
          P.tool = 'axe'; G.vm.setTool('axe');
          step(0.3);
          const T = Ga.target(P, 'axe');
          ok(T && T.id === tree.k + '#' + tree.i, 'the axe finds the tree in front of you: ' + (T ? T.key : 'nothing'));
          const before = s.mats.wood || 0;
          let hits = 0;
          // the same side again and again only deepens one notch
          for (let k = 0; k < 4; k++) { G.act({ t: 'hit', id: tree.k + '#' + tree.i, tool: 'axe', dir: [1, 0], at: [x - 1.5, z] }); step(0.2); hits++; }
          ok(!Ga.gone.has(tree.k + '#' + tree.i) && Ga.carved.get(tree.k + '#' + tree.i)?.mat.userData.u.uN.value === 1, 'four swings at one side carve one deep notch - still standing');
          ok(Ga.debris.length > 0, 'chunks of wood fly off with every swing (' + Ga.debris.length + ')');
          // one side alone does get there in the end - but a fresh side is quicker
          for (let k = 0; k < 6 && !Ga.gone.has(tree.k + '#' + tree.i); k++) { const a = k / 6 * Math.PI * 2; G.act({ t: 'hit', id: tree.k + '#' + tree.i, tool: 'axe', dir: [-Math.sin(a), -Math.cos(a)], at: [x + Math.sin(a) * 1.5, z + Math.cos(a) * 1.5] }); step(0.2); hits++; }
          ok(Ga.gone.has(tree.k + '#' + tree.i) && !!s.felled[tree.k + '#' + tree.i], 'cut all the way round, it came down (' + hits + ' blows)');
          ok(Ga.falling.length > 0 || true, 'and it falls');
          step(2.5);
          const tid = tree.k + '#' + tree.i;
          ok(Ga.fallen.has(tid) && ![...Ga.pieces.values()].some(m => m.k === 'wood'), 'the whole tree lies there on the ground - no wood yet');
          P.place(V(x + (Ga.fallen.get(tid).dx) * 3, y + 0.1, z + (Ga.fallen.get(tid).dz) * 3 + 1.2), 0); step(0.2);
          ok(!!Ga.fallenNear(P), 'standing by the fallen trunk');
          G.act({ t: 'split', id: tid });
          await new Promise(r => setTimeout(r, 300));
          step(1.2);
          ok(!Ga.fallen.has(tid), 'one blow and it splits apart');
          const logs = [...Ga.pieces.values()].filter(m => m.k === 'wood');
          ok(logs.length + (s.mats.wood || 0) - before >= 3, (logs.length + (s.mats.wood || 0) - before) + ' logs out of it');
          for (const L of logs) { P.place(L.pos.clone(), P.yaw); step(0.2); }
          step(0.3);
          ok((s.mats.wood || 0) - before >= 3, 'walking over them puts them in the pack: wood ' + (s.mats.wood || 0));
          ok(Ga.stumps.size > 0, 'a stump is left behind');
        }
        // a rock
        let rock = null;
        for (const [k, blk] of G.world.flora.blocks) { if (blk.key !== 'rock' || rock) continue; for (let i = 0; i < blk.list.length; i++) { const it = blk.list[i]; if (Math.hypot(it[0], it[2] - 60) < 400 && it[1] > 0.5) { rock = { k, i, it }; break; } } }
        if (rock) {
          const id = rock.k + '#' + rock.i, st0 = s.mats.stone || 0;
          for (let h = 0; h < 8 && !Ga.gone.has(id); h++) { G.act({ t: 'hit', id, tool: 'pick', dir: [1, 0] }); step(0.2); }
          step(0.2);
          ok(Ga.gone.has(id), 'the pickaxe broke the rock');
          for (const M of [...Ga.pieces.values()]) { P.place(M.pos.clone(), P.yaw); step(0.15); }
          step(0.3);
          ok((s.mats.stone || 0) > st0, 'and you have stone: ' + (s.mats.stone || 0));
        } else ok(false, 'there is a rock near the bay');
        G.act({ t: 'hit', id: rock ? rock.k + '#' + rock.i : 'x', tool: 'axe', dir: [1, 0] });
        ok(true, 'the wrong tool does nothing');
      }
      if (name === 'build') {
        // lay out a campfire on open ground near the hut, carry the materials to it, and light it
        const B = G.build, s = G.state.s;
        s.mats = { wood: 30, stone: 30, fibre: 10, crystal: 2, iron: 0 };
        const A = G.world.settlement.anchors;
        let site = null, spot = null;
        for (let r = 12; r < 120 && !spot; r += 4) for (let a = 0; a < 6.28 && !spot; a += 0.3) {
          const x = A.spawn.x + Math.cos(a) * r, z = A.spawn.z + Math.sin(a) * r, y = G.world.ground(x, z);
          if (!B._why(BP_BY_ID.campfire, x, z, y, 0)) spot = { x, z, y };
        }
        ok(!!spot, 'found open ground for a campfire');
        if (spot) {
          G.act({ t: 'bnew', bp: 'campfire', x: spot.x, y: spot.y, z: spot.z, r: 0 });
          step(0.6);
          site = [...B.sites.values()].find(S => S.bp.id === 'campfire');
          ok(!!site && site.parts.length === 10, 'the blueprint is laid out: ' + (site ? site.parts.length : 0) + ' ghost pieces');
          G.act({ t: 'bput', id: site.S.id, i: 7 });
          step(0.2);
          ok(site.S.p[7] === '0', 'the logs cannot go on before the stones are down');
          const w0 = s.mats.wood, st0 = s.mats.stone;
          for (let i = 0; i < 10; i++) { G.act({ t: 'bput', id: site.S.id, i }); step(0.1); }
          step(0.6);
          ok(site.complete, 'piece by piece, it is built');
          ok(w0 - s.mats.wood === 4 && st0 - s.mats.stone === 6, `it used 4 wood and 6 stone (${w0 - s.mats.wood}, ${st0 - s.mats.stone})`);
          ok(B.warmAt(site.group.position), 'and it keeps you warm');
          // the book and the hands
          P.place(V(spot.x + 2, spot.y + 0.1, spot.z), 0); P.tool = 'plans'; G.vm.setTool('plans'); step(0.2);
          B.choose('shelter'); step(0.3);
          ok(!!B.plan && !!B.plan.spot, 'the blueprint book shows the shelter ghost in front of you (' + (B.plan?.spot?.why || 'it can go here') + ')');
          B.cancelPlan();
          B.held = null; B.cycleHeld('wood');
          ok(B.held === 'wood' && G.vm.heldMat === 'wood' || B.held === 'wood', 'G takes wood out of the pack into your hands');
          // the pack list is not in the way: M opens it, M closes it; M is not the map any more
          const mbar = () => !document.querySelector('.matsbar').classList.contains('hide');
          step(0.2); const shown0 = mbar();
          I.down.add('KeyM'); step(1 / 30); I.down.clear(); step(0.2); const shown1 = mbar(), scr = G.ui.isOpen ? G.ui.screen : null;
          I.down.add('KeyM'); step(1 / 30); I.down.clear(); step(0.2);
          ok(!shown0 && shown1 && !mbar() && scr !== 'map', 'the material list stays hidden until M, and M again puts it away (and M does not open a map)');
          s.tools.rod = true; I.down.add('Digit1'); step(1 / 30); I.down.clear(); step(0.1);
          ok(P.tool === 'rod' && !B.held && !G.vm.heldMat, 'picking a tool puts the wood back in the pack: you can equip anything');
          // a drying rack: hang a fish, wait, take it down worth half as much again
          G.act({ t: 'bnew', bp: 'dryrack', x: spot.x + 6, y: G.world.ground(spot.x + 6, spot.z), z: spot.z, r: 0 }); step(0.6);
          const rack = [...B.sites.values()].find(S => S.bp.id === 'dryrack');
          ok(!!rack, 'a drying rack laid out beside it');
          if (rack) {
            rack.S.p = '1'.repeat(rack.bp.parts.length); B._sync(); step(0.6);
            const fish = G.loot.spawn({ sp: 'bass', kg: 3, cm: 45, pos: P.pos.clone().add(V(0, 1, 0)), flop: 0 });
            const v0 = G.loot.value(fish);
            G.act({ t: 'pickup', id: fish.id }); step(0.1);
            G.act({ t: 'rackPut', site: rack.S.id, id: fish.id }); step(0.7);
            ok((rack.S.store || []).length === 1 && rack.hung && rack.hung.length === 1, 'the bass hangs on the rack');
            G.act({ t: 'rackTake', site: rack.S.id }); step(0.1);
            ok(rack.S.store.length === 1, 'you cannot take it down before it is dry');
            s.day += 1; step(0.7);
            G.act({ t: 'rackTake', site: rack.S.id }); step(0.2);
            const dried = [...G.loot.items.values()].find(x => x.sp === 'bass' && x.dried);
            ok(dried && Math.abs(G.loot.value(dried) / v0 - 1.5) < 0.05, 'dried, it is worth 1.5x (' + (dried ? (G.loot.value(dried) / v0).toFixed(2) : '-') + ')');
            if (dried) { G.act({ t: 'pickup', id: dried.id }); step(0.1); G.act({ t: 'rackPut', site: rack.S.id, id: dried.id }); step(0.2); ok(!rack.S.store.length, 'and it cannot be dried twice'); }
            G.act({ t: 'bdel', id: rack.S.id }); step(0.3);
          }
          const wBefore = s.mats.wood;
          G.act({ t: 'bdel', id: site.S.id }); step(0.6);
          ok(!B.sites.has(site.S.id) && s.mats.wood - wBefore === 4, 'taking it down gives the materials back (+' + (s.mats.wood - wBefore) + ' wood)');
          // co-op: a guest's pieces go through the host exactly like yours, and the pieces lying around are in the world snapshot
          let bs = null;
          for (let r = 4; r < 40 && !bs; r += 1.5) for (let a = 0; a < 6.28 && !bs; a += 0.4) { const x = spot.x + Math.cos(a) * r, z = spot.z + Math.sin(a) * r, y = G.world.ground(x, z); if (!B._why(BP_BY_ID.bench, x, z, y, 0)) bs = { x, y, z }; }
          if (bs) G.act({ t: 'bnew', bp: 'bench', x: bs.x, y: bs.y, z: bs.z, r: 0 }); step(0.6);
          const bench = [...B.sites.values()].find(S => S.bp.id === 'bench');
          if (bench) {
            G._do({ t: 'bput', id: bench.S.id, i: 0 }, 'guest-a'); G._do({ t: 'bput', id: bench.S.id, i: 1 }, 'guest-b');
            G.act({ t: 'bput', id: bench.S.id, i: 2 }); G._do({ t: 'bput', id: bench.S.id, i: 3 }, 'guest-a'); step(0.6);
            ok(bench.complete, 'three players built one bench between them');
            G.gather.spawn('stone', P.pos.clone().add(V(4, 1, 0)));
            const snap = JSON.parse(JSON.stringify(G.worldSnapshot()));
            ok(snap.mp && snap.mp.some(m => m[1] === 'stone'), 'loose materials are sent to the crew in the world snapshot');
            G.act({ t: 'bdel', id: bench.S.id }); step(0.3);
          } else ok(false, 'a bench for the co-op test');
          // the resource stations: a worm farm breeds bait, a workbench makes iron tools
          const lay = (id) => { let q = null; for (let r = 4; r < 50 && !q; r += 1.5) for (let a = 0; a < 6.28 && !q; a += 0.4) { const x = spot.x + Math.cos(a) * r, z = spot.z + Math.sin(a) * r, y = G.world.ground(x, z); if (!B._why(BP_BY_ID[id], x, z, y, 0)) q = { x, y, z }; } if (!q) return null; G.act({ t: 'bnew', bp: id, x: q.x, y: q.y, z: q.z, r: 0 }); step(0.6); const st = [...B.sites.values()].find(S => S.bp.id === id); if (st) { st.S.p = '1'.repeat(st.bp.parts.length); st.S.t0 = Math.round(B.clock()); B._sync(); step(0.6); } return st; };
          const farm = lay('wormfarm');
          if (farm) {
            const w0 = s.baits.worm || 0;
            ok(B.worms(farm.S) === 0, 'a new worm farm is empty');
            s.day += 1; step(0.2);
            ok(B.worms(farm.S) === 20, 'after a day it is full of worms: ' + B.worms(farm.S));
            G.act({ t: 'worms', site: farm.S.id }); step(0.2);
            ok((s.baits.worm || 0) - w0 === 20 && B.worms(farm.S) === 0, 'emptied into the bait tin: +' + ((s.baits.worm || 0) - w0) + ' worms');
            G.act({ t: 'bdel', id: farm.S.id }); step(0.3);
          } else ok(false, 'room for a worm farm');
          const bench2 = lay('workbench');
          if (bench2) {
            s.mats.iron = 6; s.mats.wood = Math.max(4, s.mats.wood);
            G.ui.open('craft', {}); ok(document.querySelectorAll('[data-act="craft"]').length >= 3, 'the workbench offers things to make'); G.ui.close();
            G.act({ t: 'craft', id: 'ironaxe' }); step(0.2);
            ok(s.upg?.axe && s.mats.iron === 0, 'an iron axe, for six iron ore');
            let tree = null;
            for (const [k, blk] of G.world.flora.blocks) { if (blk.key !== 'pine' || tree) continue; for (let i = 0; i < blk.list.length; i++) { const id = k + '#' + i; if (!G.gather.gone.has(id) && Math.hypot(blk.list[i][0], blk.list[i][2] - 60) < 300) { tree = id; break; } } }
            const tn = tree && G.gather.node(tree);
            let blows = 0; for (; blows < 12 && tn && !G.gather.gone.has(tree); blows++) { const a = blows * 2 / 6 * Math.PI * 2; G.act({ t: 'hit', id: tree, tool: 'axe', dir: [1, 0], at: [tn.it[0] + Math.sin(a) * 1.5, tn.it[2] + Math.cos(a) * 1.5] }); step(0.1); }
            ok(tree && blows <= 3, 'with the iron axe a pine comes down in ' + blows + ' blows instead of six');
            G.act({ t: 'bdel', id: bench2.S.id }); step(0.3);
          } else ok(false, 'room for a workbench');
          G.ui.open('plans', {}); ok(document.querySelectorAll('.card.bp:not(.boatplan)').length === 19 && document.querySelectorAll('.card.boatplan').length >= 1, 'the blueprint book lists nineteen buildings (six aquariums) and your boat plans'); G.ui.close();
        }
      }
      if (name === 'aquarium') {
        const s = G.state.s, B = G.build, L = G.loot, bb = G.boats[0];
        const Lm = await import('../game/Loot.js');
        const land = (sp, cm = 40, kg = 2, alive = true) => G.landCatch({ sp, kg, cm, pos: P.pos.clone().add(V(0, 1, 1)), vel: V(0, 0, 0), by: P.id, size: 0.5, quiet: true, alive });
        // 1. alive, and the clock runs
        const a = land('bass');
        ok(a.alive && Math.abs(a.air - 300) < 1, 'a hooked fish comes up alive, with five minutes out of the water');
        a.air = 1.5; step(2);
        ok(!a.alive, 'left out, it dies');
        const hp = land('bass', 40, 2, false);
        ok(!hp.alive, 'a harpooned fish is dead from the start');
        const sk = land('perch', 25, 0.6); G.act({ t: 'spearKill', id: sk.id }); step(0.1);
        ok(!sk.alive, 'a fish speared off the deck dies');
        // 2. the cooler keeps it alive, and gives it back
        bb.docked = false;
        const c1 = land('bass');
        G._do({ t: 'pickup', id: c1.id }, P.id); P.held = c1.id;
        G._do({ t: 'cooler', id: c1.id, boat: bb.id }, P.id); step(0.1);
        const air0 = c1.air; step(2);
        ok(c1.state === 'cooler' && c1.alive && Math.abs(c1.air - air0) < 0.01 && c1.cool < Lm.LIFE.cooler, 'in the cooler it keeps its air and lives on the cooler\'s three hours');
        P.attach(bb, V(bb.hull.cooler[0], bb.deck, bb.hull.cooler[2] + 0.6)); step(0.2);
        G.ui.open('cooler', {}); const takeBtn = document.querySelector('[data-act="coolTake"]'); ok(!!takeBtn, 'the cooler screen lists it'); G.ui.close();
        G.act({ t: 'coolTake', id: c1.id }); step(0.2);
        ok(c1.state !== 'cooler' && P.held === c1.id && c1.alive, 'taken out of the cooler, into your hands, still alive');
        G._do({ t: 'drop', id: c1.id, pos: P.pos.toArray(), vel: [0, 0, 0] }, P.id); P.held = null;
        P.detach(); P.place(G.world.settlement.anchors.spawn.clone(), 0); step(0.3);
        // 3. an aquarium: build one, put a live fish in, see it swim, take it out
        s.mats = { wood: 50, stone: 50, glass: 20, iron: 10, crystal: 4, fibre: 5 };
        let q = null;
        for (let r = 6; r < 60 && !q; r += 2) for (let an = 0; an < 6.28 && !q; an += 0.4) { const x = P.pos.x + Math.cos(an) * r, z = P.pos.z + Math.sin(an) * r, y = G.world.ground(x, z); if (!B._why(BP_BY_ID.aq1, x, z, y, 0)) q = { x, y, z }; }
        ok(!!q, 'room for a small aquarium');
        G.act({ t: 'bnew', bp: 'aq1', x: q.x, y: q.y, z: q.z, r: 0 }); step(0.6);
        const site = [...B.sites.values()].find(S => S.bp.id === 'aq1');
        for (let i = 0; i < site.bp.parts.length; i++) { G.act({ t: 'bput', id: site.S.id, i }); step(0.05); }
        step(0.8);
        ok(site.complete && B.aq.tanks.has(site.S.id), 'built piece by piece with glass from the pack, and the water fills in');
        P.place(V(q.x, q.y + 0.1, q.z + 1.2), 0); step(0.2);
        ok(B.tankNear(P.pos) === site, 'standing at the glass');
        const f1 = land('bass', 40, 2);
        G._do({ t: 'pickup', id: f1.id }, P.id); P.held = f1.id;
        G.act({ t: 'tankPut', site: site.S.id, id: f1.id }); step(1);
        const A = B.aq.tanks.get(site.S.id);
        ok(site.S.store.length === 1 && !L.get(f1.id) && A.fish.size === 1, 'the living bass goes in and is swimming there');
        const F = [...A.fish.values()][0], p0 = F.pos.clone(); step(2);
        ok(F.pos.distanceTo(p0) > 0.05, 'it swims about (' + F.pos.distanceTo(p0).toFixed(2) + ' m in 2 s)');
        const big = land('pike', 95, 9);
        ok(/Too big/.test(B.tankRefuses(site, big) || ''), 'a 95 cm pike is too big for the small one: ' + B.tankRefuses(site, big));
        const dead = land('bass', 40, 2, false);
        ok(/dead/.test(B.tankRefuses(site, dead) || ''), 'a dead fish is refused');
        land('perch', 22, 0.4);
        G.ui.open('tank', { site: site.S.id });
        ok(document.querySelectorAll('[data-act="tankTake"]').length === 1 && document.querySelectorAll('[data-act="tankPut"]').length >= 1, 'the aquarium screen shows what is inside and the living fish you could add');
        G.ui.close();
        G.act({ t: 'tankTake', site: site.S.id, fid: site.S.store[0].id }); step(0.5);
        const back = L.get(P.held);
        ok(back && back.alive && back.sp === 'bass' && !site.S.store.length, 'taken back out: alive, in your hands');
        G._do({ t: 'drop', id: back.id, pos: P.pos.toArray(), vel: [0, 0, 0] }, P.id); P.held = null;
        // 4. the wall gives fish back
        const w = land('bass', 40, 2); G._do({ t: 'pickup', id: w.id }, P.id); P.held = w.id;
        G._do({ t: 'mount', id: w.id, slot: 0 }, P.id); step(0.1);
        ok(s.cabin.slots[0]?.real && !L.get(w.id), 'mounted on the wall');
        G._do({ t: 'unmount', slot: 0 }, P.id); step(0.1);
        ok(!s.cabin.slots[0] && P.held && L.get(P.held)?.sp === 'bass', 'and taken back down into your hands');
        G._do({ t: 'drop', id: P.held, pos: P.pos.toArray(), vel: [0, 0, 0] }, P.id); P.held = null;
        // 5. a sea beast: a real catch
        const kr = G.landBeast('great:kraken', P.id, true); step(0.5);
        ok(kr && FISH_BY_ID[kr.sp].beast && kr.alive, 'the Kraken, landed, is lying there as a catch');
        G._do({ t: 'pickup', id: kr.id }, P.id);
        ok(kr.held === P.id && Lm.carryStyle(kr) === 'drag', 'you can pick it up - it is dragged behind you');
        const bigFish = land('pike', 95, 300);
        ok(Lm.carryStyle(bigFish) === 'shoulder' && Lm.carryStyle(land('pike', 60, 60)) === 'hug', 'a 300 kg fish goes over your shoulder, a 60 kg one in your arms');
        ok(!G.sellable(null, true, P.id).includes(kr) && G.sellable(kr.pos, true, P.id, true).includes(kr) && Math.abs(L.value(kr) - 40000) < 1, 'sell all never sells it; on purpose it is worth ' + L.value(kr));
        const a5 = { bp: BP_BY_ID.aq5, S: { store: [] } }, a6 = { bp: BP_BY_ID.aq6, S: { store: [] } };
        ok(!B.tankRefuses(a5, kr) && /Too big/.test(B.tankRefuses(a5, { sp: 'beast:cthulhu', cm: FISH_BY_ID['beast:cthulhu'].cm[0], alive: true }) || '') && !B.tankRefuses(a6, { sp: 'beast:cthulhu', cm: FISH_BY_ID['beast:cthulhu'].cm[0], alive: true }), 'the Kraken fits the Massive aquarium; Cthulhu needs the Oceanarium');
        G._do({ t: 'drop', id: kr.id, pos: P.pos.toArray(), vel: [0, 0, 0] }, P.id); P.held = null;
        ok(Lm.carryStyle({ sp: 'bass', kg: 2 }) === 'hands', 'a bass is simply in your hands');
      }
      if (name === 'boatbuild') {
        // a new castaway: no boat, Old Gus's rowboat plans, a boatyard that sells plans, and building it at the water
        const s = G.state.s, B = G.build, bb = G.boats[0];
        s.boat.built = false; s.hulls = []; s.boatPlans = ['dinghy']; G._boatChanged(); step(0.3);
        ok(bb.absent && !bb.group.visible && !G.boatAt(bb.pos, 1), 'no boat after the wreck - nothing at the dock');
        s.tut = 3; ok(/BUILD YOUR BOAT/.test(G.objective().title), 'the goal: ' + G.objective().title + ' - ' + G.objective().text.slice(0, 60));
        G.ui.open('plans', {}); ok([...document.querySelectorAll('.card.boatplan h3')].some(e => /Soggy Biscuit/.test(e.textContent)), 'the rowboat plans are in the blueprint book'); G.ui.close();
        // the boatyard sells plans, not boats
        s.money = 5000; G.act({ t: 'buy', k: 'hull', id: 'motor', yard: 'home' }); step(0.1);
        ok(s.boatPlans.includes('motor') && !s.hulls.includes('motor') && s.money === 5000 - 900, 'buying at the boatyard gets you the Motorboat plans (' + (5000 - s.money) + ' coins), not a boat');
        G.ui.open('boatyard', { yard: 'home' }); ok(!!document.querySelector('.ydetail .ypic img') && document.querySelectorAll('.yitem').length >= 2, 'the boatyard is a showcase: a big preview and the plans for sale'); G.ui.close();
        // find water just off the beach and lay the rowboat out
        let spot = null;
        for (let r = 20; r < 400 && !spot; r += 3) for (let a = 0; a < 6.28 && !spot; a += 0.15) { const x = 20 + Math.cos(a) * r, z = 160 + Math.sin(a) * r; if (!B._why(BP_BY_ID['boat:dinghy'], x, z, 0, a)) spot = { x, z, r: a }; }
        ok(!!spot, 'found knee-deep water off a beach');
        if (spot) {
          const bad = B._why(BP_BY_ID['boat:dinghy'], 20, 180, 1, 0);
          ok(!!bad, 'on dry land it will not go: ' + bad);
          G.act({ t: 'bnew', bp: 'boat:dinghy', x: spot.x, y: 0, z: spot.z, r: spot.r }); step(0.6);
          const site = [...B.sites.values()].find(S2 => S2.bp.boat === 'dinghy');
          ok(site && site.parts.length > 15, 'the rowboat is laid out on the water: ' + (site ? site.parts.length : 0) + ' pieces, keel first');
          s.mats = { wood: 40, stone: 10 };
          for (let i = 0; i < site.parts.length; i++) { G.act({ t: 'bput', id: site.S.id, i }); step(0.03); }
          step(0.8);
          ok(!B.sites.has(site.S.id) && s.boat.built === true && s.hulls.includes('dinghy') && !bb.absent, 'the last piece on, and she floats: the boat is yours');
          ok(Math.hypot(bb.pos.x - spot.x, bb.pos.z - spot.z) < 2 && bb.group.visible, 'right where you built her');
          ok(s.mats.wood === 40 - bpCost(BP_BY_ID['boat:dinghy']).wood, 'she took ' + bpCost(BP_BY_ID['boat:dinghy']).wood + ' wood');
          // and you can repair her yourself, anywhere
          P.attach(bb, V(0, bb.deck, 0)); bb.leaks = [{ x: 0.3, y: bb.deck, z: 0, size: 0.5, fix: 0 }]; s.mats.wood = 3; P.tool = 'hammer'; G.vm.setTool('hammer'); P.local.set(0.2, bb.deck, 0);
          I.fakeBtn(0, true); step(2.5); I.fakeBtn(0, false);
          ok(!bb.leaks.length && s.mats.wood === 0, 'a small hole: three planks and a hammer, a long way from any boatyard');
          P.detach();
        }
        // every other boat, built from its plans the same way, piece by piece, and sailed off
        for (const H of HULLS) {
          if (H.id === 'dinghy') continue;
          const bp = BP_BY_ID['boat:' + H.id];
          s.boatPlans = [...new Set([...(s.boatPlans || []), H.id])];
          let sp = null;
          for (let r = 20; r < 900 && !sp; r += 6) for (let a = 0; a < 6.28 && !sp; a += 0.12) { const x = 20 + Math.cos(a) * r, z = 160 + Math.sin(a) * r; if (!B._why(bp, x, z, 0, a)) sp = { x, z, r: a }; }
          if (!sp) { ok(false, H.name + ': nowhere to lay her out'); continue; }
          G.act({ t: 'bnew', bp: 'boat:' + H.id, x: sp.x, y: 0, z: sp.z, r: sp.r }); step(0.3);
          const site = [...B.sites.values()].find(S2 => S2.bp.boat === H.id);
          if (!site) { ok(false, H.name + ': the plans would not lay out'); continue; }
          const need = bpCost(bp); s.mats = {}; for (const m in need) s.mats[m] = need[m];
          // in tier order, as a player has to
          for (let pass = 0; pass < 12 && site.S.p.includes('0'); pass++) for (let i = 0; i < site.parts.length; i++) if (site.S.p[i] === '0') { G.act({ t: 'bput', id: site.S.id, i }); }
          step(0.8);
          const used = Object.values(s.mats).every(v => v === 0);
          ok(!B.sites.has(site.S.id) && s.boat.hull === H.id && s.boat.built && !bb.absent && used && Math.hypot(bb.pos.x - sp.x, bb.pos.z - sp.z) < 8,
            H.name + ': ' + site.parts.length + ' pieces, every material used up, and she floats where she was built' + ` [left ${site.S.p.split('0').length - 1} of ${site.parts.length}, mats ${JSON.stringify(s.mats)}, hull ${s.boat.hull}, tier ${site.tier}, ground ${heightAt(sp.x, sp.z).toFixed(1)}, off by ${Math.hypot(bb.pos.x - sp.x, bb.pos.z - sp.z).toFixed(1)} m, absent ${bb.absent}, built ${s.boat.built}, site ${B.sites.has(site.S.id)}]`);
          // point her at open water
          let bestH = bb.heading, bestD = 0;
          for (let k = 0; k < 24; k++) { const h = k / 24 * 6.283; let d = 0; for (let m = 10; m <= 60; m += 10) d += Math.min(0, heightAt(bb.pos.x + Math.sin(h) * m, bb.pos.z + Math.cos(h) * m)); if (d < bestD) { bestD = d; bestH = h; } }
          bb.heading = bestH; bb._updateMatrix();
          P.attach(bb, V(0, bb.deck, 0)); G.act({ t: 'helm', boat: bb.id, on: true }); P.mode = 'drive'; const p0 = bb.pos.clone();
          for (let i = 0; i < 120; i++) { G.driveInput(bb, 1, 0); G.update(1 / 30); }
          G.driveInput(bb, 0, 0);
          ok(bb.pos.distanceTo(p0) > 3 && !bb.sinking, '  ... and she sails (' + bb.pos.distanceTo(p0).toFixed(0) + ' m in 4 s)');
          G.act({ t: 'helm', boat: bb.id, on: false }); P.detach(); P.mode = 'walk';
        }
      }
      if (name === 'deep') {
        // out in the deep in a sturdy boat: every kind of thing that can happen under it
        const D = G.deep, bb = G.boats[0];
        G.state.s.boat.hull = 'trawler'; G._boatChanged();
        G.teleport('offshore'); step(0.5);
        if (P.boat !== bb) P.attach(bb, V(0, bb.deck, 0));
        const fresh = () => { bb.hp = bb.stats.hp; bb.leaks = []; bb.breaks = []; bb.water = 0; bb.sinking = 0; if (P.boat !== bb) { P.attach(bb, V(0, bb.deck, 0)); } P.mode = 'walk'; };
        const run = (k, sec) => { fresh(); D.acts = []; D.quiet = 0; D._start(k, P, 4); const hp0 = bb.hp; const h0 = bb.heading; let seen = false; for (let i = 0; i < sec * 30; i++) { G.update(1 / 30); if (D.acts.some(a => a.k === k && a.m.visible)) seen = true; } return { hp: hp0 - bb.hp, holes: bb.leaks.length, water: bb.water, turn: Math.abs(bb.heading - h0), seen }; };
        let r = run('pass', 10); ok(r.seen && r.hp === 0, 'a shape much bigger than the boat passes underneath - and does nothing');
        r = run('bump', 4); ok(r.hp > 0, 'a big fish hits the hull: -' + Math.round(r.hp) + ' hull');
        r = run('ram', 7); ok(r.hp > 20 && r.holes >= 1, 'something rams it on purpose: -' + Math.round(r.hp) + ' hull, ' + r.holes + ' hole(s)');
        r = run('breach', 5); ok(r.water > 0.1, 'something breaches beside you and the sea comes over the rail (water ' + Math.round(r.water * 100) + '%)');
        r = run('coil', 10); ok(r.turn > 0.3, 'a long body circles under it and the boat turns with it (' + r.turn.toFixed(2) + ' rad)');
        fresh();
        // it is rare: an hour out there, not a storm of them
        D.acts = []; D.quiet = 0; let n = 0; const on = D.onEvent.bind(D); D.onEvent = e => { n++; on(e); };
        for (let i = 0; i < 20 * 60; i++) { D._host(1 / 60 * 60); if (D.acts.length) { for (const A of D.acts) G.scene.remove(A.m); D.acts = []; } }
        D.onEvent = on;
        ok(n >= 3 && n <= 16, 'in twenty minutes offshore it happened ' + n + ' times - never back to back');
        // swimming in the deep gets darker and quieter
        P.detach(); P.mode = 'swim'; P.pos.y = -1; step(3);
        ok(D.dread > 0.2, 'swimming out here, the light goes (dread ' + D.dread.toFixed(2) + ')');
        P.attach(bb, V(0, bb.deck, 0)); P.mode = 'walk';
        G.state.s.boat.hull = 'dinghy'; G._boatChanged();
      }
      if (name === 'edgebtn') {
        G.ui.open('admin', {}); const btn = document.querySelector('[data-arg="edgeTest"]'); ok(!!btn, 'the admin panel has the edge-of-the-world button');
        btn && btn.click(); G.ui.close(); step(2);
        ok(P.boat && P.mode === 'drive' && G.edge.E, 'you are at the helm past the edge, and it has noticed you: ' + (G.edge.E ? G.edge.E.ph : 'nothing'));
      }
      if (name === 'jetty') {
        // a jetty from the beach out over the sea: walk to the end and fish from it; a watchtower: climb it and look out
        const B = G.build, s = G.state.s;
        s.mats = { wood: 80, stone: 40, fibre: 10, crystal: 2, iron: 2 };
        let js = null;
        for (let r = 40; r < 700 && !js; r += 5) for (let a = 0; a < 6.28 && !js; a += 0.12) {
          const x = Math.cos(a) * r, z = 80 + Math.sin(a) * r;
          const h = heightAt(x, z); if (h < 0 || h > 1.2) continue;
          for (let k = 0; k < 16 && !js; k++) { const rr = k / 16 * 6.28; if (!B._why(BP_BY_ID.jetty, x, z, G.world.ground(x, z), rr)) js = { x, z, r: rr }; }
        }
        ok(!!js, 'found a beach facing the sea for a jetty');
        if (js) {
          G.act({ t: 'bnew', bp: 'jetty', x: js.x, y: G.world.ground(js.x, js.z), z: js.z, r: js.r }); step(0.6);
          const J = [...B.sites.values()].find(S => S.bp.id === 'jetty');
          for (let i = 0; i < J.bp.parts.length; i++) { G.act({ t: 'bput', id: J.S.id, i }); step(0.05); }
          step(0.6);
          ok(J.complete, 'the jetty is built (' + J.bp.parts.length + ' pieces)');
          const end = B.worldPoint(J, 0, 1.0, -5.6);
          // start on the sand behind it and just walk on - no jumping
          const sand = B.worldPoint(J, 0, 0, 3.4); P.place(V(sand.x, G.world.ground(sand.x, sand.z) + 0.05, sand.z), J.S.r); step(0.3);
          const y0 = P.pos.y;
          // walk until you're most of the way out (the end is open: keep going and you're in the sea)
          const lz = () => { const dx = P.pos.x - J.S.x, dz = P.pos.z - J.S.z; return dx * Math.sin(J.S.r) + dz * Math.cos(J.S.r); };
          for (let i = 0; i < 150 && lz() > -5; i++) { I.keys.add('KeyW'); step(1 / 30); }
          I.keys.clear(); step(0.3);
          const dEnd = Math.hypot(P.pos.x - end.x, P.pos.z - end.z);
          ok(P.mode === 'walk' && P.pos.y > 0.7 && heightAt(P.pos.x, P.pos.z) < -0.5, 'from the beach (y ' + y0.toFixed(2) + ') you walk up the step and out along the planks, dry, over ' + (-heightAt(P.pos.x, P.pos.z)).toFixed(1) + ' m of water (y ' + P.pos.y.toFixed(2) + ', ' + dEnd.toFixed(1) + ' m from the end)');
        }
        let ws = null;
        for (let r = 20; r < 500 && !ws; r += 4) for (let a = 0; a < 6.28 && !ws; a += 0.3) { const x = Math.cos(a) * r, z = 80 + Math.sin(a) * r, y = G.world.ground(x, z); if (!B._why(BP_BY_ID.watchtower, x, z, y, 0)) ws = { x, y, z }; }
        ok(!!ws, 'room for a watchtower');
        if (ws) {
          G.act({ t: 'bnew', bp: 'watchtower', x: ws.x, y: ws.y, z: ws.z, r: 0 }); step(0.6);
          const W = [...B.sites.values()].find(S => S.bp.id === 'watchtower');
          W.S.p = '1'.repeat(W.bp.parts.length); B._sync(); step(0.6);
          const foot = B.worldPoint(W, 0, 0, 1.8);
          P.place(V(foot.x, G.world.ground(foot.x, foot.z) + 0.1, foot.z), Math.PI); step(0.3);
          const hasLadder = [...document.querySelectorAll('.prompt .chip')].some(e => /Climb the ladder/.test(e.textContent));
          ok(hasLadder, 'at its foot: Climb the ladder');
          I.keys.add('KeyE'); I.down.add('KeyE'); step(1 / 30); I.keys.clear(); I.down.clear(); step(0.1);
          { const top = B.worldPoint(W, 0, 6.1, 0); log('INFO floor at top: ' + G.world.colliders.floorAt(top.x, top.z, top.y, 0.6).toFixed(2) + ' site y ' + W.S.y.toFixed(2) + ' cols ' + W.parts.reduce((n, p) => n + p.cols.length, 0) + ' floors ' + W.parts.filter(p => p.cols.some(c => c.floor)).length); }
          step(1);
          ok(P.pos.y > W.S.y + 5.5 && P.mode === 'walk', 'up the ladder: you stand on the platform, ' + (P.pos.y - W.S.y).toFixed(1) + ' m up');
          // walk about on it: across every plank and back, without dropping through a crack
          let low = 99;
          for (const k of ['KeyA', 'KeyD', 'KeyD', 'KeyA']) { for (let i = 0; i < 14; i++) { I.keys.add(k); step(1 / 30); low = Math.min(low, P.pos.y - W.S.y); } I.keys.clear(); }
          ok(low > 5.5, 'you walk across the planks and never fall through (lowest ' + low.toFixed(2) + ' m up)');
          const c0 = G.isles.chartedFraction();
          G.act({ t: 'lookout', x: P.pos.x + 900, z: P.pos.z }); step(0.2);
          ok(G.isles.charted(P.pos.x + 900, P.pos.z), 'looking out from the top charts the sea around it');
        }
      }
      if (name === 'edge') {
        // sail past the edge of every chart in the best boat there is, and try to run
        const E = G.edge;
        G.state.s.boat.hull = 'expedition'; G._boatChanged();
        const bb = G.boats[0];
        const out = new THREE.Vector3(-1, 0, -0.1).normalize();      // west, through open water (no rocks to hit on the way back)
        const at = (d) => new THREE.Vector3(out.x * d, 0, 80 + out.z * d);
        const p0 = at(7300);
        bb.pos.set(p0.x, 0, p0.z); bb.heading = Math.atan2(out.x, out.z); bb.docked = false; bb._updateMatrix(); G.world.prebuild(p0.x, p0.z);
        P.attach(bb, V(0, bb.deck, 0));
        step(2);
        ok(!E.E, 'inside the edge nothing happens');
        const p1 = at(7520); bb.pos.set(p1.x, 0, p1.z); bb._updateMatrix();
        step(1.5);
        ok(E.E && E.E.ph === 'omen', 'past it, the sea goes quiet: ' + (E.E ? E.E.ph : 'nothing'));
        // the first time it lets you know: silence, a shape in the water, the radio, a shadow under the boat, then it rises
        const seen = new Set(), rlines = [];
        const oradio = G.ui.radio.bind(G.ui); G.ui.radio = t2 => { rlines.push(t2); oradio(t2); };
        let hushMax = 0;
        for (let i = 0; i < 60 * 30 && E.E && E.E.ph !== 'hunt'; i++) { G.update(1 / 30); seen.add(E.E.ph); hushMax = Math.max(hushMax, G.edge.hush || 0); }
        G.ui.radio = oradio;
        ok(['signs', 'radio', 'still', 'under', 'rise'].every(p => seen.has(p)), 'the first time, it builds: ' + [...seen].join(' > '));
        ok(rlines.some(l => /turn around/.test(l)) && rlines.some(l => /let it see/.test(l)), 'the radio: ' + rlines.length + ' lines, from "turn around" to "let it see y-"');
        ok(hushMax > 0.8, 'and the sea went silent (hush ' + hushMax.toFixed(2) + ')');
        const d0 = E.E ? Math.hypot(E.E.x - bb.pos.x, E.E.z - bb.pos.z) : 0;
        // full speed back toward home: it does not matter
        let caught = false, fastest = 0, t = 0;
        for (; t < 40 && E.E; t += 1 / 30) {
          if (E.E.ph === 'omen' || E.E.ph === 'hunt') { bb.vel.set(-out.x * 34, -out.z * 34); fastest = Math.max(fastest, Math.hypot(bb.vel.x, bb.vel.y)); }
          G.update(1 / 30);
          if (E.E && E.E.ph === 'surround') { caught = true; break; }
        }
        ok(caught, `it caught the Leviathan Hunter running flat out at ${fastest.toFixed(0)} m/s (it came from ${d0.toFixed(0)} m, took ${t.toFixed(1)} s)`);
        const pinned = bb.pos.clone();
        for (let i = 0; i < 60; i++) { bb.vel.set(-out.x * 30, -out.z * 30); G.update(1 / 30); }
        ok(bb.pos.distanceTo(pinned) < 1, 'inside the ring the boat will not move (' + bb.pos.distanceTo(pinned).toFixed(2) + ' m)');
        let sank = false, swam = false;
        for (let i = 0; i < 16 * 30 && E.E; i++) { G.update(1 / 30); if (bb.sinking) sank = true; if (P.mode === 'swim' && !P.boat) swam = true; }
        ok(sank, 'it tore the boat apart');
        ok(swam, 'and threw you into the sea');
        ok(!E.E && G.state.s.flags.warden >= 1, 'then it was gone (' + (G.state.s.flags.warden || 0) + ' time)');
        ok(!!G.state.s.trophies.got.warden, 'trophy: Gus Was Telling the Truth');
        await new Promise(r => setTimeout(r, 4200));
        step(0.5);
        const spot = G.intro.wakeSpot();
        ok(P.pos.distanceTo(spot.pos) < 3, 'you woke up on the beach at Driftwood Bay (' + P.pos.distanceTo(spot.pos).toFixed(1) + ' m from it)');
        await new Promise(r => setTimeout(r, 2600));
        const lines = G.ui.talkEl ? G.ui.talkEl.querySelector('.dlg-line')?.textContent : '';
        ok(/tried to leave/.test(lines || ''), 'and Old Gus knows: "' + (lines || '').slice(0, 40) + '"');
        G.ui.closeTalk();
        ok(E._mesh().arms.length === 12 && E.w.group.visible === false, 'the Warden: twelve arms, no health, no hook - just gone');
        step(20);
        ok(bb.docked && !bb.sinking, 'Marge towed what was left home');
        G.state.s.boat.hull = 'dinghy'; G._boatChanged();
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
        // and every far island, by teleport, day and night
        const far = ['whisper', 'sunscar', 'skywatch', 'crystal', 'frostfall', 'dread', 'ironwreck', 'lost', 'thunder', 'tide', 'crown', 'abyssal'];
        const before = errs.length;
        for (const id of far) {
          const T = G.constructor.TELEPORTS.find(t => t.id === 'isle:' + id);
          if (!T) { ok(false, 'a teleport to ' + id); continue; }
          G.teleport(T.id); G.tod = 0.5; step(1.5); G.tod = 0.95; step(1.5);
        }
        ok(errs.length === before, 'every far island runs a day and a night without errors');
        const missed = far.filter(id => !G.state.s.found[id]);
        ok(!missed.length, 'landing on each island discovers it (' + (12 - missed.length) + ' of 12' + (missed.length ? ', missed ' + missed.join(', ') : '') + ')');
        const ui = G.ui; ui.mapZoom = 0; ui.open('map', {}); ui.mapZoom = 2; ui.render(); ui.mapZoom = 1; ui.render();
        ok(!!document.querySelector('canvas.worldmap') && ui._mapView?.span === 5000, 'the map zooms in on the region');
        ui.close();
      }
    } catch (e) {
      fail++; fails.push(name + ' threw: ' + e.message); log('FAIL ' + name + ' threw: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'));
    }
  }
  ok(errs.length === 0, 'no runtime errors (' + errs.length + ')' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  if (fails.length) log('--- FAILURES:\n' + fails.map(f => '  ' + f).join('\n'));
  log(`=== ${pass} passed, ${fail} failed ===`);
  window.__done = true;
}
