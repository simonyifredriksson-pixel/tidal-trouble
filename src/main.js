/* main.js - boots Hooked.

   Loading screen -> the world is generated -> the title screen (the camera
   drifts round Driftwood Bay at golden hour) -> solo, host, or join.

   Debug query parameters (used by the test harness, harmless otherwise):
     ?auto=new|continue   skip the title
     ?tod=0.75            time of day
     ?at=x,z[,yaw]        start somewhere
     ?fresh               ignore the save
     ?stage=NAME          set up a scene for a screenshot (see stage()) */

import * as THREE from '../lib/three.module.js';
import { Input } from './core/Input.js';
import { Audio } from './core/Audio.js';
import { World } from './world/World.js';
import { Game } from './game/Game.js';
import { UI } from './ui/UI.js';
import { State } from './game/State.js';
import { Net } from './net/Net.js';
import { Remote } from './game/Remote.js';
import { heightAt } from './world/Terrain.js';
import { VIGIL, REGIONS, HOME_CENTRE } from './world/MapData.js';
import { U } from './art/Materials.js';
import { BP_BY_ID } from './data/BuildData.js';
import { FISH_BY_ID } from './data/FishData.js';
import { HULL_BY_ID } from './data/BoatData.js';

const Q = new URLSearchParams(location.search);
if (Q.has('debug')) {
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:6px;top:6px;z-index:99;color:#fff;background:rgba(0,0,0,0.82);padding:4px;font:13px monospace;white-space:pre-wrap;max-width:90vw;max-height:calc(100vh - 12px);overflow:hidden;pointer-events:none';
  document.body.appendChild(box);
  const log = t => { box.textContent += t + '\n'; box.scrollTop = box.scrollHeight; };
  addEventListener('error', e => log('ERR ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  addEventListener('unhandledrejection', e => log('REJ ' + (e.reason && e.reason.stack || e.reason)));
  window.__log = log;
}
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 3600);
camera.rotation.order = 'YXZ';
scene.add(camera);

const input = new Input(canvas);
const audio = new Audio();
const state = new State();
if (!Q.has('fresh')) state.load();
state.loadSettings();
const net = new Net();
const world = new World(scene);

let game = null, ui = null;
const tick = () => new Promise(r => setTimeout(r, 0));

async function boot() {
  const setBar = (f, t) => { document.querySelector('#intro .load-bar i').style.width = Math.round(f * 100) + '%'; document.querySelector('#intro .load-step').textContent = t; };
  introFx();
  let n = 0;
  const steps = 8;
  const T0 = performance.now(); const lap = l => window.__log && window.__log('load ' + l + ' ' + Math.round(performance.now() - T0) + 'ms');
  await world.build(async label => { lap(label); setBar(n++ / steps, label + '...'); await tick(); });
  lap('world done');
  setBar(0.9, 'Waking up the villagers...'); await tick();
  game = new Game({ scene, camera, renderer, input, audio, world, net, state });
  ui = new UI(game);
  game.ui = ui;
  game.onUiAct = titleActs;
  game.applySettings = game.applySettings.bind(game);
  lap('game built');
  wireNet();
  // warm up the near terrain around the village for the title shot
  world.prebuild(20, 180);
  lap('prebuild done');
  setBar(1, 'Ready.');
  await tick();
  window.TT = { game, world, state, net, THREE, renderer, scene, camera, heightAt };
  const intro = document.getElementById('intro');
  if (Q.has('netjoin')) { intro.classList.add('gone'); const code = Q.get('netjoin'); ui.open('lobby', { mode: 'join' }); joinRoom(code); netProbe('client'); }
  else if (Q.has('uijoin')) { intro.classList.add('gone'); showTitle(); uiJoinProbe(Q.get('uijoin')); }
  else if (Q.has('auto')) { intro.classList.add('gone'); startGame(Q.get('auto') === 'continue' && State.hasSave() ? 'continue' : 'new'); }
  else {
    // PRESS ANYWHERE TO PLAY: the click opens the menu with the cursor free
    intro.classList.add('ready');
    const go = () => {
      intro.removeEventListener('pointerdown', go); removeEventListener('keydown', go);
      audio.unlock();
      input.unlock();
      intro.classList.add('gone');
      showTitle();
    };
    intro.addEventListener('pointerdown', go);
    addEventListener('keydown', go);
  }
  if (Q.has('loop')) setInterval(() => loop(performance.now()), 50); else requestAnimationFrame(loop);
}

function showTitle() {
  ui.title({ hasSave: State.hasSave(), day: state.s.day });
}

/* ---------------- title & lobby actions ---------------- */
function titleActs(act, arg) {
  audio.unlock();
  switch (act) {
    case 'continue': startGame('continue'); return true;
    case 'newgame':
      if (State.hasSave() && !game.running) { ui.open('confirm', { title: 'Start over?', text: 'This replaces your saved game - your fish, your boat, your cabin. There is no undo.', act: 'wipeStart', ok: 'Start fresh' }); return true; }
      startGame('new'); return true;
    case 'wipeStart': ui.close(); state.wipe(); startGame('new'); return true;
    case 'settings': ui.open('settings'); return true;
    case 'controls': ui.open('controls'); return true;
    case 'host': startGame(State.hasSave() ? 'continue' : 'new', false); hostRoom(); return true;
    case 'hostNow': hostRoom(); return true;
    case 'join': ui.open('lobby', { mode: 'join' }); return true;
    case 'joinGo': joinRoom(document.getElementById('joincode')?.value || ui.data?.code || ''); return true;
    case 'leaveRoom': net.leave(); ui.close(); if (state.remote) location.reload(); return true;
  }
  return undefined;
}

function startGame(mode, lock = true) {
  if (game.running) return;
  ui.hideTitle();
  ui.close();
  // tests, staged shots and teleports go straight to the island; ?intro plays it anyway
  game.skipIntro = !Q.has('intro') && (Q.has('script') || Q.has('stage') || Q.has('nointro') || Q.has('at') || Q.has('nethost'));
  game.start(mode);
  game.applySettings();
  if (Q.has('tod')) game.tod = +Q.get('tod');
  if (Q.has('at')) {
    const [x, z, yaw] = Q.get('at').split(',').map(Number);
    game.player.place(new THREE.Vector3(x, Math.max(heightAt(x, z), 0) + 0.2, z), yaw || 0);
    world.prebuild(x, z);
  }
  if (Q.has('stage')) stage(Q.get('stage'));
  if (lock && !ui.isOpen) input.lock();
  if (Q.has('nethost')) { hostRoom().then(() => { try { parent.postMessage({ room: net.room }, '*'); } catch (e) { /* */ } }); netProbe('host'); }
  if (Q.has('script')) setTimeout(() => import('./debug/Scripts.js').then(m => m.runScripts(Q.get('script').split(','), game)), 500);
}

async function hostRoom() {
  ui.open('lobby', { mode: 'host' });
  try {
    await net.host({ name: state.settings.name || 'Captain', look: state.settings.look });
    game.player.id = net.selfId;
    for (const it of game.loot.items.values()) if (it.held === 'local') it.held = net.selfId;
    for (const b of game.boats) if (b.driver === 'local') b.driver = net.selfId;
    game.chat.system('Room ' + net.room + ' is open. Tap CTRL to chat - voice is on nearby, hold C for the walkie-talkie.');
    game.voice.start(net);
  } catch (e) { net._status(e.message); }
  if (ui.screen === 'lobby') ui.render();
}

async function joinRoom(code) {
  if (!code || code.replace(/[^A-Za-z0-9]/g, '').length !== 5) { net._status('Room codes are five letters.'); ui.render(); return; }
  net._status('Connecting...');
  ui.render();
  try {
    await net.join(code, { name: state.settings.name || 'Fisher', look: state.settings.look });
  } catch (e) { net._status(e.message); ui.render(); }
}

function wireNet() {
  let idx = 1;
  net.on.status = () => { if (ui.screen === 'lobby') ui.render(); };
  net.on.getSave = () => state.s;
  net.on.welcome = d => {
    state.remote = true;
    if (d.save) state.s = Object.assign(state.s, d.save);
    for (const [id, p] of net.profiles) game.remotes.set(id, new Remote(game, id, p, idx++));
    game.player.id = net.selfId;
    ui.hideTitle();
    ui.close();
    game.skipIntro = Q.has('netjoin') || Q.has('uijoin') || Q.has('nointro');
    if (!game.running) { game.start('join'); game.applySettings(); }
    game._boatChanged();
    ui.open('lobby', {});
    game._needsPlace = true;
    game.chat.system('Joined room ' + net.room + '. Tap CTRL to chat - voice is on nearby, hold C for the walkie-talkie.');
    game.voice.start(net);
  };
  net.on.join = (id, p) => {
    if (!game.remotes.has(id)) game.remotes.set(id, new Remote(game, id, p, idx++));
    // still out in the storm? then so are they, at the same moment
    if (game.intro?.active) net.sendEvent({ t: 'intro', to: id, at: game.intro.t });
    ui.toast((p?.name || 'Someone') + ' joined the crew!', 'good');
    game.chat.system((p?.name || 'Someone') + ' joined the crew');
    game.voice.connectAll();
    if (ui.screen === 'lobby') ui.render();
  };
  net.on.leave = (id, p) => {
    const r = game.remotes.get(id);
    if (r) { r.dispose(); game.remotes.delete(id); }
    for (const b of game.boats) if (b.driver === id) b.driver = null;
    for (const it of game.loot.items.values()) if (it.held === id) it.held = null;
    ui.toast((p?.name || 'Someone') + ' left.', 'warn');
    game.chat.system((p?.name || 'Someone') + ' left');
    game.voice.drop(id);
    if (ui.screen === 'lobby') ui.render();
  };
  net.on.player = (id, s) => {
    let r = game.remotes.get(id);
    if (!r) { r = new Remote(game, id, net.profiles.get(id) || { name: s.name }, idx++); game.remotes.set(id, r); }
    r.apply(s);
    if (game._needsPlace && net.profiles.get(id)?.host) {
      game._needsPlace = false;
      const p = new THREE.Vector3(s.x + 1.5, s.y, s.z + 1.5);
      if (s.b) { const b = game.boatById(s.b); if (b) { game.player.attach(b, new THREE.Vector3(s.lx + 0.8, s.ly, s.lz)); return; } }
      game.player.place(p, s.yaw);
      world.prebuild(p.x, p.z);
    }
  };
  net.on.action = (id, a) => game._do(a, id);
  net.on.event = (id, e) => game._event(id, e);
  net.on.world = w => game.applyWorld(w);
  net.on.saveIn = s => {
    const rodBefore = state.s.rod, boatBefore = JSON.stringify(state.s.boat);
    state.s = s;
    if (s.rod !== rodBefore) game._rodChanged();
    if (JSON.stringify(s.boat) !== boatBefore) game._boatChanged();
  };
  net.on.lost = () => { ui.banner('CONNECTION LOST', 'The host left or the connection dropped.', 'radio', 5); setTimeout(() => location.reload(), 4000); };
}

/* ---------------- co-op probe for the two-window test ---------------- */
function netProbe(role) {
  const log = window.__log || (() => {});
  let n = 0;
  const iv = setInterval(() => {
    n++;
    if (!game.running) { log(role + ' t' + n + ' ' + net.status); return; }
    const b = game.boats[0];
    log(`${role} t${n} online=${net.isOnline} peers=${game.remotes.size} loot=${game.loot.items.size} boat=${b.pos.x.toFixed(1)},${b.pos.z.toFixed(1)} money=${state.s.money} held=${game.player.held || '-'}`);
    if (n % 4 === 0) log(role + ' net ' + JSON.stringify(net.stats) + ' conns=' + net.conns.size);
    if (role === 'host' && n === 4) { for (let i = 0; i < 3; i++) game.loot.spawn({ sp: 'bass', kg: 2, cm: 40, pos: b.toWorld(new THREE.Vector3(0, b.deck + 1, i - 1)) }); game.state.s.money += 500; }
    if (role === 'client' && n === 7) { const it = [...game.loot.items.values()][0]; if (it) { game.act({ t: 'pickup', id: it.id }); log('client asked to pick up ' + it.id); } }
    if (role === 'client' && n === 9) { game.act({ t: 'buy', k: 'bait', id: 'glow' }); log('client bought glow bait'); }
    if (role === 'client' && n === 8) {
      // the real chat: tap CTRL, type, ENTER
      if (ui.isOpen) ui.close();
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ControlLeft', bubbles: true }));
      log('client chat opened by a CTRL tap: ' + game.chat.open);
      game.chat.fieldEl.value = 'ahoy from the client';
      game.chat.fieldEl.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
      log('client chat sent, box closed: ' + !game.chat.open);
    }
    if (role === 'host' && n === 11) { const l = game.chat.lines.filter(x => !x.system).pop(); log('host chat got: ' + (l ? '<' + l.name + '> ' + l.text : 'nothing')); }
    if (role === 'host' && n === 10) { game.events.start('storm', game.player.pos); }
    if (role === 'client' && n === 12) log('client sees storm=' + game.world.storm.toFixed(2) + ' events=' + game.events.list.map(e => e.k).join(','));
    // building together: the host lays out a campfire, the guest puts pieces into it, both see the same thing
    if (role === 'host' && n === 5) {
      game.state.s.mats = { wood: 10, stone: 10 };
      const B = game.build, A = world.settlement.anchors;
      let done = false;
      for (let r = 10; r < 80 && !done; r += 3) for (let a = 0; a < 6.28 && !done; a += 0.4) { const x = A.spawn.x + Math.cos(a) * r, z = A.spawn.z + Math.sin(a) * r, y = world.ground(x, z); if (!B._why(BP_BY_ID.campfire, x, z, y, 0)) { game.act({ t: 'bnew', bp: 'campfire', x, y, z, r: 0 }); done = true; } }
      log('host laid out a campfire: ' + done);
    }
    if (role === 'client' && n === 10) {
      const site = [...game.build.sites.values()][0];
      log('client sees the blueprint: ' + (site ? site.bp.id + ' ' + site.S.p : 'none') + ', pack wood=' + (state.s.mats?.wood || 0) + ' stone=' + (state.s.mats?.stone || 0));
      if (site) for (let i = 0; i < 3; i++) game.act({ t: 'bput', id: site.S.id, i });
    }
    if (role === 'host' && n === 19) { const S = (game.state.s.builds || [])[0]; log('host blueprint after the guest: ' + (S ? S.p : 'none') + ', stone left ' + game.state.s.mats.stone); }
    if (role === 'client' && n === 13) { const site = [...game.build.sites.values()][0]; log('client sees ' + (site ? site.parts.filter(p => p.done).length : 0) + ' pieces built'); }
    if (n > 19) clearInterval(iv);
  }, 1500);
}

/* ---------------- the real join flow, driven through the DOM (test) ---------------- */
function uiJoinProbe(code) {
  const log = window.__log || (() => {});
  setTimeout(() => {
    const btn = document.querySelector('#title [data-act="join"]');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    setTimeout(() => {
      const inp = document.getElementById('joincode');
      const r = inp.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      log('join box on top of everything: ' + (hit === inp) + ' (hit ' + (hit && (hit.id || hit.className)) + ')');
      inp.focus();
      log('join box focused: ' + (document.activeElement === inp) + ', pointer locked: ' + !!document.pointerLockElement);
      for (const ch of code.toLowerCase()) { inp.value += ch; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      inp.value = inp.value.slice(0, -1); inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.value += code.slice(-1); inp.dispatchEvent(new Event('input', { bubbles: true }));
      log('typed (with a delete) -> "' + inp.value + '", still focused: ' + (document.activeElement === document.getElementById('joincode')));
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      netProbe('client');
    }, 400);
  }, 800);
}

/* ---------------- stages for screenshots ---------------- */
function stage(name) {
  const G = game, P = G.player, A = world.settlement.anchors;
  const b = G.boats[0];
  if (name.startsWith('ui:')) { const [scr, tab] = name.slice(3).split('.'); if (tab) G.ui.tab[scr] = tab; setTimeout(() => G.ui.open(scr, {}), 300); }
  if (name === 'motor' || name === 'trawler') { G.state.s.boat = { hull: name, parts: { lights: 2, mount: 1, holders: 2 }, paint: 'harbour', decor: ['flag', 'lanterns', 'gnome'] }; G._boatChanged(); P.attach(b, new THREE.Vector3(0.8, b.deck, -1.5)); P.yaw = b.heading + Math.PI - 0.5; P.pitch = -0.15; G.tod = 0.7; b.docked = false; b.pos.x += 10; b.pos.z += 15; }
  if (name === 'porch') { P.place(new THREE.Vector3(-3.5, heightAt(-3.5, 183), 183), 0.15); P.pitch = 0.06; G.tod = 0.4; }
  if (name === 'boat') { const m = b.mooringTarget(); P.attach(b, new THREE.Vector3(0.2, b.deck, -0.6)); P.yaw = b.heading + Math.PI; P.pitch = -0.1; }
  if (name === 'fight') { P.attach(b, new THREE.Vector3(0, b.deck, 0)); P.yaw = b.heading + Math.PI; G.fishing.bpos.copy(b.toWorld(new THREE.Vector3(0, 0, 12))); G.fishing.bpos.y = 0; G.fishing.water = 'sea'; G.fishing.pending = { sp: 'pike', kg: 8, cm: 90, size: 0.5 }; G.fishing._hook(); }
  if (name === 'cabin') { P.place(A.cabinInside.clone().add(new THREE.Vector3(1.8, 0, 2)), 0.6); P.pitch = 0.1; G.tod = 0.5; }
  if (name === 'guild') { P.place(A.guildInside.clone(), 0); G.tod = 0.5; }
  if (name === 'sunset') { G.tod = 0.745; P.attach(b, new THREE.Vector3(0, b.deck, 0)); P.yaw = b.heading + Math.PI * 0.7; }
  if (name === 'storm') { G.events.start('storm', P.pos); G.events.storm = 1; }
  if (name === 'lev') { G.state.s.clues = {}; G.creatures.startLev('gloop', -75, -45); P.place(A.lakePier.clone(), -1.57); G.tod = 0.9; }
  // headless shots render only a few frames: fast-forward the simulation instead
  const advance = sec => { const keep = [P.yaw, P.pitch]; for (let i = 0; i < sec * 30; i++) G.update(1 / 30); [P.yaw, P.pitch] = keep; };
  const look = (from, to, pitch = 0) => { P.place(from.clone(), Math.atan2(-(to.x - from.x), -(to.z - from.z))); P.pitch = pitch; };
  const C = A.cabinInside;
  if (name === 'hut' || name === 'hut2' || name === 'hutbare') {
    if (name !== 'hutbare') { for (const id in (window.__TROPHIES || {})) G.state.award(id); import('./data/TrophyData.js').then(m => { for (const T of m.TROPHIES) G.state.award(T.id); G.cabin.placeAll(); G.cabin.update(); }); }
    G.state.s.rods = ['basic', 'reinforced', 'reef', 'deepwater', 'icebreaker', 'heavy', 'storm', 'titan', 'oath']; G.state.s.rod = 'oath'; G._rodChanged();
    G.tod = 0.5;
    if (name === 'hut2') look(C.clone().add(new THREE.Vector3(1.9, 0, -1.2)), C.clone().add(new THREE.Vector3(-3.4, 0.9, 1.6)), -0.12);
    else look(C.clone().add(new THREE.Vector3(2.9, 0, 2.5)), C.clone().add(new THREE.Vector3(-1.2, 1.4, -3.0)), -0.02);
  }
  if (name === 'rack') { G.state.s.rods = ['basic', 'reinforced', 'reef', 'deepwater', 'icebreaker', 'heavy', 'storm', 'titan', 'oath']; G.state.s.rod = 'basic'; G._rodChanged(); G.tod = 0.5; look(C.clone().add(new THREE.Vector3(1.3, 0, -0.9)), C.clone().add(new THREE.Vector3(3.8, 1.3, -0.9)), 0.05); P.tool = 'hammer'; G.vm.setTool('hammer'); }
  if (name === 'cove') { G.tod = 0.4; look(C.clone().add(new THREE.Vector3(-9, 1, 17)), C.clone().add(new THREE.Vector3(4, 1.5, 4)), -0.02); P.tool = 'hammer'; G.vm.setTool('hammer'); }
  if (name === 'dock') { G.tod = 0.72; const d = A.homeDock; look(d.clone().add(new THREE.Vector3(0, 0, 0.5)), C.clone().add(new THREE.Vector3(3, 1, 3)), 0.02); }
  if (name === 'talk') {
    G.tod = 0.45;
    const pim = G.npcs.byId('pim');
    for (let i = 0; i < 4; i++) G.loot.spawn({ sp: ['bass', 'pike', 'goldtrout', 'catfish'][i], kg: 2 + i * 3, cm: 40 + i * 20, pos: pim.pos.clone().add(new THREE.Vector3(-1.6, 0.4, i * 0.4 - 0.6)), flop: 0 });
    look(pim.pos.clone().add(new THREE.Vector3(-3.9, 0, 0.6)), pim.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 0);
    setTimeout(() => { G._talk(pim); if (Q.get('opt') === 'rods') G._dRods(pim); if (Q.get('opt') === 'sell') G._dSellAll(pim); }, 500);
  }
  // the big ship, its hold and its damage; the hidden places
  const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
  if (name === 'wayfarer' || name === 'hold' || name === 'wreckage') {
    G.tod = 0.45; G.state.s.boat.hull = 'wayfarer'; G._boatChanged();
    b.pos.set(60, 0, 420); b.heading = 0.4; b.docked = false; b._updateMatrix(); world.prebuild(b.pos.x, b.pos.z);
    const Hd = b.hull.hold;
    if (name === 'wreckage') { b.addHole(1.1); b.addHole(0.7); b.breakSomething('rail'); b.breakSomething('engine'); b.water = 0.2; }
    advance(1);
    if (name === 'hold') { P.attach(b, new THREE.Vector3(Hd.hatch[0] - 0.5, Hd.floor, Hd.z1 - 0.8)); P.inHold = true; P.yaw = b.heading + Math.PI * 0 + 0.15; P.pitch = -0.12; }
    else if (name === 'wreckage') { const R = b.breaks.find(x => x.kind === 'rail'); P.attach(b, new THREE.Vector3(-Math.sign(R.x) * 1.2, b.deck, R.z - 3.5)); const w = b.toWorld(new THREE.Vector3(R.x, b.deck, R.z)); P.yaw = yawTo(P.pos, w); P.pitch = -0.3; }
    else { P.attach(b, new THREE.Vector3(0.6, b.deck, -8.4)); P.yaw = b.heading + Math.PI + 0.08; P.pitch = 0.18; }
    advance(0.3);
  }
  // the first night, held at one moment: ?stage=intro:SECONDS[:YAW]
  if (name.startsWith('intro:')) {
    const [, sec = '0', yaw] = name.split(':');
    G.intro.start(+sec);
    G.intro.hold = +sec;
    if (yaw !== undefined) G.intro.yaw = +yaw;
  }
  // every blueprint in a row on open ground near the village: ?stage=yard[:FRACTION]  (FRACTION of pieces placed, 1 = all built)
  if (name.startsWith('yard')) {
    const frac = name.includes(':') ? +name.split(':')[1] : -1;
    const B = G.build, s = G.state.s;
    s.mats = { wood: 400, stone: 400, fibre: 60, crystal: 20, iron: 10 };
    const bps = (Q.get('bps') || 'campfire,bench,lantern,chest,baitstation,palisade,shelter,watchtower').split(',');
    // a long flat stretch: walk out from the hut until the ground is kind
    let x0 = null, z0 = null;
    for (let r = 30; r < 500 && x0 === null; r += 6) for (let a = 0; a < 6.28 && x0 === null; a += 0.2) {
      const x = A.spawn.x + Math.cos(a) * r, z = A.spawn.z + Math.sin(a) * r;
      let good = true;
      for (let k = 0; k < bps.length && good; k++) { const bx = x + k * 6.5, y = world.ground(bx, z); if (B._why(BP_BY_ID[bps[k]], bx, z, y, 0)) good = false; }
      if (good) { x0 = x; z0 = z; }
    }
    if (x0 !== null) {
      bps.forEach((id, k) => {
        const bx = x0 + k * 6.5;
        G.act({ t: 'bnew', bp: id, x: bx, y: world.ground(bx, z0), z: z0, r: 0 });
        const S = s.builds[s.builds.length - 1];
        if (!S) return;
        const n = BP_BY_ID[id].parts.length, want = frac < 0 ? [0, 0.3, 0.6, 1, 1, 0.5, 0.45, 1][k] ?? 1 : frac;
        S.p = BP_BY_ID[id].parts.map((p, i) => i < Math.round(n * want) ? '1' : '0').join('');
      });
      B._sync();
      // look at one of them close up (?focus=K) or down the whole row
      const fk = Q.has('focus') ? +Q.get('focus') : -1;
      const mid = fk >= 0 ? x0 + fk * 6.5 : x0 + 3.5 * 6.5, back = fk >= 0 ? 5.5 : 12, side = fk >= 0 ? 2.5 : -6;
      P.place(new THREE.Vector3(mid + side, world.ground(mid + side, z0 + back) + 0.1, z0 + back), 0);
      P.yaw = Math.atan2(-(mid - P.pos.x), -(z0 - P.pos.z)); P.pitch = fk >= 0 ? -0.18 : -0.1;
      G.tod = +(Q.get('tod') || 0.5);
    } else window.__log && window.__log('no room for the yard');
  }
  // a boat going up on its blueprint: ?stage=boatbuild:HULL:FRACTION
  if (name.startsWith('boatbuild')) {
    const [, hull = 'seafarer', fr = '0.55'] = name.split(':');
    const bp = BP_BY_ID['boat:' + hull], B = G.build, s = G.state.s;
    let q = null;
    for (let r = 20; r < 400 && !q; r += 3) for (let a = 0; a < 6.28 && !q; a += 0.15) { const x = 20 + Math.cos(a) * r, z = 160 + Math.sin(a) * r; if (!B._why(bp, x, z, 0, a)) q = { x, z, r: a }; }
    if (q) {
      G.act({ t: 'bnew', bp: bp.id, x: q.x, y: 0, z: q.z, r: q.r });
      const S = s.builds[s.builds.length - 1];
      S.p = bp.parts.map((p, i) => i < Math.round(bp.parts.length * +fr) ? '1' : '0').join('');
      B._sync();
      const side = new THREE.Vector3(Math.cos(q.r), 0, -Math.sin(q.r)), H = HULL_BY_ID[hull];
      const eye = new THREE.Vector3(q.x, 0, q.z).addScaledVector(side, H.hl * 1.6 + 3);
      P.place(new THREE.Vector3(eye.x, Math.max(0, world.ground(eye.x, eye.z)) + 0.1, eye.z), 0);
      P.yaw = Math.atan2(-(q.x - eye.x), -(q.z - eye.z)); P.pitch = -0.2;
      G.tod = 0.45;
    }
  }
  // an aquarium, built and stocked: ?stage=tank:N  (1-6)
  if (name.startsWith('tank:')) {
    const id = 'aq' + name.split(':')[1], bp = BP_BY_ID[id], B = G.build, s = G.state.s;
    let q = null;
    for (let r = 20; r < 600 && !q; r += 5) for (let a = 0; a < 6.28 && !q; a += 0.25) { const x = A.spawn.x + Math.cos(a) * r, z = A.spawn.z + Math.sin(a) * r, y = world.ground(x, z); if (!B._why(bp, x, z, y, 0)) q = { x, y, z }; }
    if (q) {
      G.act({ t: 'bnew', bp: id, x: q.x, y: q.y, z: q.z, r: 0 });
      const S = s.builds[s.builds.length - 1];
      S.p = '1'.repeat(bp.parts.length);
      const T = bp.tank;
      const pool = { aq1: ['bass', 'perch', 'goldtrout', 'sunfish'], aq2: ['bass', 'pike', 'catfish', 'goldtrout', 'perch', 'salmon'], aq3: ['salmon', 'catfish', 'pike', 'tuna', 'bass', 'ghost', 'eel', 'puffer'] }[id];
      const list = pool || Object.values(FISH_BY_ID).filter(f => !f.junk && !f.beast && f.cm && f.cm[1] <= T.cm && f.cm[1] > T.cm * 0.25 && f.art).slice(0, T.n - (id === 'aq5' || id === 'aq6' ? 2 : 0)).map(f => f.id);
      if (id === 'aq5') list.push('great:kraken', 'beast:mirrorfish');
      if (id === 'aq6') list.push('beast:cthulhu', 'great:ninefold');
      S.store = list.filter(sp => FISH_BY_ID[sp]).slice(0, T.n).map((sp, i) => ({ id: 'q' + i, sp, kg: FISH_BY_ID[sp].kg[1], cm: Math.min(T.cm, FISH_BY_ID[sp].cm[1]), zone: 0, mult: 1 }));
      B._sync();
      const back = T.round ? T.r + 6 : T.d / 2 + Math.max(1.8, T.w * 0.55);
      P.place(new THREE.Vector3(q.x + 0.4, world.ground(q.x, q.z + back) + 0.1, q.z + back), 0);
      P.pitch = T.round ? 0.05 : -0.12 - (T.y0 < 0.9 && T.h < 1 ? 0.15 : 0);
      G.tod = +(Q.get('tod') || 0.5);
      for (let i = 0; i < 60; i++) G.update(1 / 30);
    }
  }
  // the four player looks side by side on the beach: ?stage=looks[:zoom]
  if (name.startsWith('looks')) {
    const zoom = name.includes(':');
    import('./art/Character.js').then(({ Character, PLAYER_LOOKS }) => {
      const at = new THREE.Vector3(20, 0, 196); at.y = world.ground(at.x, at.z);
      PLAYER_LOOKS.forEach((L, i) => {
        const c = new Character(L, i * 13 + 5);
        c.root.position.set(at.x + (i - 1.5) * 1.1, world.ground(at.x + (i - 1.5) * 1.1, at.z), at.z);
        c.update(0.5, 'idle', 0);
        scene.add(c.root);
      });
      const d = zoom ? 2.2 : 4.2;
      P.place(new THREE.Vector3(at.x + (zoom ? -1.65 : 0), at.y, at.z + d), 0);
      P.pitch = name.endsWith(':feet') ? -0.62 : zoom ? -0.05 : -0.1;
      G.tod = 0.45;
      game.frozen = false;
      setTimeout(() => { game.frozen = true; }, 400);
    });
  }
  // a pine coming down: ?stage=chop[:SECONDS after the last blow]
  if (name.startsWith('chop')) {
    const sec = name.includes(':') ? +name.split(':')[1] : 0.8;
    let tree = null;
    for (const [k, blk] of world.flora.blocks) { if (blk.key !== 'pine' || tree) continue; for (let i = 0; i < blk.list.length; i++) { const it = blk.list[i]; if (Math.hypot(it[0] - 60, it[2] - 60) < 260 && it[3] > 0.95 && it[1] > 2) { tree = { id: k + '#' + i, it }; break; } } }
    if (tree) {
      const [x, y, z] = tree.it;
      const close = Q.has('cuts');
      P.place(new THREE.Vector3(x - (close ? 2.1 : 6), world.ground(x - (close ? 2.1 : 6), z + (close ? 1 : 4)) + 0.1, z + (close ? 1 : 4)), 0);
      P.yaw = Math.atan2(-(x - P.pos.x), -(z - P.pos.z)); P.pitch = close ? -0.2 : 0.25;
      P.tool = 'axe'; G.vm.setTool('axe'); G.tod = 0.5;
      const f = [(x - P.pos.x), (z - P.pos.z)], l = Math.hypot(...f);
      // ?cuts=N: cut N sides and stop (the notches), otherwise all the way round (it falls)
      const nc = Q.has('cuts') ? +Q.get('cuts') : 6;
      for (let h = 0; h < nc && !G.gather.gone.has(tree.id); h++) { const a = Math.atan2(P.pos.x - x, P.pos.z - z) + (h - (nc - 1) / 2) * 0.9; G._do({ t: 'hit', id: tree.id, tool: 'axe', dir: [-Math.sin(a), -Math.cos(a)], at: [x + Math.sin(a) * 1.5, z + Math.cos(a) * 1.5] }, P.id); }
      advance(sec);
      game.frozen = true;
    }
  }
  // the Warden, at a phase: ?stage=warden:PHASE:SECONDS
  if (name.startsWith('warden:')) {
    const [, ph = 'surround', sec = '3'] = name.split(':');
    G.state.s.boat.hull = 'expedition'; G._boatChanged();
    const bx = 5390, bz = 5390;      // just past the edge, beyond Vigil's End
    b.pos.set(bx, 0, bz); b.heading = Math.PI * 1.25; b.docked = false; b._updateMatrix(); world.prebuild(bx, bz);
    P.attach(b, new THREE.Vector3(0, b.deck, -2)); P.yaw = b.heading + Math.PI + 0.9; P.pitch = 0.25;
    const E = G.edge;
    E._begin({ boat: b.id }, bx, bz);
    E.E.ph = ph; E.E.t = +sec;
    const dx = bx - HOME_CENTRE.x, dz = bz - HOME_CENTRE.z, d = Math.hypot(dx, dz);
    E.E.x = bx + dx / d * (ph === 'hunt' ? 400 : 110); E.E.z = bz + dz / d * (ph === 'hunt' ? 400 : 110); E.E.a = Math.atan2(-dx, -dz);
    E.hold = { ph, t: +sec };
    if (name.endsWith(':face')) { P.yaw = Math.atan2(-dx, -dz); P.pitch = 0.32; }
    G.tod = 0.5;
  }
  // any teleport, at a time of day: ?stage=tp:ID[@TOD[@YAW]]  (ids like isle:whisper keep their colon)
  if (name.startsWith('tp:')) {
    const [id, tod = '0.45', yaw] = name.slice(3).split('@');
    G.teleport(id); G.tod = +tod;
    const R = REGIONS[id.replace('isle:', '')];
    if (yaw !== undefined) P.yaw = +yaw;
    else if (R) P.yaw = Math.atan2(-(R.x - P.pos.x), -(R.z - P.pos.z));
    P.pitch = 0.02;
    advance(0.5);
  }
  // any hull, seen from off the side: ?stage=hull:ID
  if (name.startsWith('hull:')) {
    const id = name.slice(5);
    G.tod = 0.45; G.state.s.boat = { hull: id, parts: { lights: 2, mount: 1, holders: 3, anchor: 2 }, paint: 'harbour', decor: [] }; G._boatChanged();
    b.pos.set(392, 0, 348); b.heading = 0.6; b.docked = false; b._updateMatrix(); world.prebuild(b.pos.x, b.pos.z);
    P.attach(b, new THREE.Vector3(0, b.deck, 0));
    advance(0.5);
    const L = b.hull.hl, side = new THREE.Vector3(Math.cos(b.heading), 0, -Math.sin(b.heading)), fwd = new THREE.Vector3(Math.sin(b.heading), 0, Math.cos(b.heading));
    const eye = b.pos.clone().addScaledVector(side, 11 + L * 1.3).addScaledVector(fwd, L * 0.7); eye.y = 3 + L * 0.45;
    camera.position.copy(eye); camera.lookAt(b.pos.x, 1.5, b.pos.z);
    game.frozen = true;
  }
  // the fog-of-war map: ?stage=map:ZOOM[:charts] - a voyage out to Sunscar and Ironwreck charted
  if (name.startsWith('map:')) {
    const [, zm = '0', extra = ''] = name.split(':');
    const I = G.isles;
    for (let t = 0; t <= 1; t += 0.02) { I.reveal(600 + t * 1850, -200 - t * 500, 520); I.reveal(2450 + t * 600, -700 - t * 1900, 520); }
    I.reveal(-2050, -1650, 560);
    if (extra === 'charts') { G.state.s.gear.charts = 1; G.state.s.gear.compass = 1; }
    P.place(new THREE.Vector3(2600, 0, -1500), 0.8);
    setTimeout(() => { G.ui.mapZoom = +zm; G.ui.open('map', {}); }, 300);
  }
  // the anchor: ?stage=anchor:LEVEL:HULL[:haul|:side|:throw]
  if (name.startsWith('anchor')) {
    const [, lv = '2', hull = 'trawler', mode = ''] = name.split(':');
    G.tod = 0.42; G.state.s.boat.hull = hull; G.state.s.boat.parts.anchor = +lv; G.state.s.boat.parts.lights = 1; G._boatChanged();
    b.pos.set(392, 0, 348); b.heading = 0.6; b.docked = false; b._updateMatrix(); world.prebuild(b.pos.x, b.pos.z);
    const [ax, az] = b.hull.anchor;
    P.attach(b, new THREE.Vector3(ax - 0.1, b.deck, az - 0.75)); P.yaw = b.heading + Math.PI; P.pitch = -0.25;
    if (mode === 'throw') { G._throwAnchor(b); for (let i = 0; i < 8; i++) G.update(1 / 30); }
    else {
      b.throwAnchor(b.rollerWorld().add(new THREE.Vector3(Math.sin(b.heading) * 0.5, 0, Math.cos(b.heading) * 0.5)), new THREE.Vector3(Math.sin(b.heading) * 5, 2, Math.cos(b.heading) * 5));
      advance(14);
      if (mode === 'haul') { G.input.keys.add('KeyE'); advance(1.2); }
      if (mode === 'up') { G.input.keys.add('KeyE'); let t = 0; while (b.anchor.st !== 'hang' && t < 40) { advance(0.5); t += 0.5; } advance(1.6); G.input.keys.delete('KeyE'); }
      if (mode !== 'haul') P.local.set(ax - 0.4, b.deck, az - 2.2);
      if (mode === 'bow') { P.local.set(0.3, b.deck, b.hull.hl * 0.86 - 1.4); P.pitch = -0.9; }
      P.yaw = b.heading + Math.PI + 0.12; P.pitch = mode === 'haul' ? -0.6 : mode === 'bow' ? -0.8 : -0.42;
      if (mode === 'side' || mode === 'up') {
        const R = b.rollerWorld();
        const d = new THREE.Vector3(b.anchor.p.x - R.x, 0, b.anchor.p.z - R.z).normalize();
        const from = R.clone().addScaledVector(new THREE.Vector3(-d.z, 0, d.x), 5.5).addScaledVector(d, 1.5); from.y = 0.4;
        P.detach(); P.place(from, yawTo(from, R)); P.mode = 'swim'; P.pos.y = -1.2; P.pitch = mode === 'up' ? 0.05 : -0.18;
      }
    }
    G.update(1 / 30); G.frozen = true;
    if (window.__log) { const r = b.rope; const f = v => v.toArray().map(x => x.toFixed(1)).join(','); window.__log('rope vis ' + r.mesh.visible + ' w ' + r.w + ' p0 ' + f(r.pts[0]) + ' p1 ' + f(r.pts[1]) + ' pn ' + f(r.pts[r.pts.length - 1]) + ' A ' + b.anchor.st + ' ' + f(b.anchor.p) + ' boat ' + f(b.pos) + ' eye ' + f(P.eye) + ' am ' + b.anchorMesh.visible + ' nan ' + [...r.pos].some(isNaN)); }
  }
  if (name === 'grotto') { G.tod = 0.5; G.teleport('grotto'); advance(0.5); P.local.set(0.5, b.deck, 3); P.yaw = yawTo(P.pos, world.settlement.anchors.grottoLedge); P.pitch = 0.1; advance(0.2); }
  if (name === 'grottoout') { G.tod = 0.45; const S = world.secrets, g = { x: 330, z: 470 }, d = world.settlement.anchors.grottoWater; const dx = d.x - g.x, dz = d.z - g.z, l = Math.hypot(dx, dz); b.pos.set(g.x + dx / l * 55, 0, g.z + dz / l * 55); b.docked = false; b._updateMatrix(); P.attach(b, new THREE.Vector3(0, b.deck, 0)); world.prebuild(b.pos.x, b.pos.z); advance(0.5); P.yaw = yawTo(P.pos, new THREE.Vector3(g.x, 4, g.z)); P.pitch = 0.08; void S; }
  if (name === 'temple' || name === 'wreck') { G.tod = 0.5; G.teleport(name === 'temple' ? 'templeDive' : 'promiseDive'); const S = world.secrets.byId[name === 'temple' ? 'temple' : 'promise']; const c = S.cache; P.place(c.clone().add(new THREE.Vector3(7, 3, 7)), 0); P.mode = 'swim'; P.yaw = yawTo(P.pos, c); P.pitch = -0.25; advance(0.05); P.pos.copy(c.clone().add(new THREE.Vector3(7, 3, 7))); }
  if (name === 'castaway') { G.tod = 0.4; const c = world.secrets.byId.castaway.cache; const from = new THREE.Vector3(430 + 9, 0, 650 + 9); from.y = heightAt(from.x, from.z); P.place(from, yawTo(from, new THREE.Vector3(430, 0, 650))); P.pitch = -0.12; void c; }
  if (name === 'vigil') { G.tod = 0.4; G.teleport('vigil'); look(P.pos.clone(), new THREE.Vector3(VIGIL.x, 14, VIGIL.z), 0.12); }
  if (name === 'vigiltop') { G.tod = 0.42; const m = G.npcs.byId('mags'); look(m.pos.clone().add(new THREE.Vector3(-4, 0, -3)), m.pos.clone().add(new THREE.Vector3(0, 1, 0)), -0.05); }
  if (name === 'vigilsea' || name.startsWith('great:')) {
    G.tod = 0.42;
    G.state.s.boat.hull = 'motor'; G._boatChanged();
    b.pos.set(VIGIL.x - 200, 0, VIGIL.z - 205); b.heading = Math.atan2(200, 205); b.docked = false; b._updateMatrix();
    P.attach(b, new THREE.Vector3(0.3, b.deck, 1.6)); P.yaw = b.heading + Math.PI - 0.1; P.pitch = 0.06;
    world.prebuild(b.pos.x, b.pos.z);
    if (name.startsWith('great:')) {
      const [, id, phase] = name.split(':');
      const L = G.great.spawnLev(id);
      const f = new THREE.Vector3(Math.sin(b.heading), 0, Math.cos(b.heading));
      const dd = +(Q.get('d') || 130);
      L.x = b.pos.x + f.x * dd; L.z = b.pos.z + f.z * dd; L.h = b.heading + (+(Q.get('h') || 1.3)); L.phase = phase || 'rise'; L.pt = +(Q.get('pt') || 6); L.pdur = phase === 'breach' ? 5 : 14; L.life = 999;
      L._y = undefined;
      G.great._hostLev = () => {};      // freeze the phase for the photo
      if (!Q.has('banner')) setTimeout(() => { const w = G.ui.el('.worldev'); if (w) w.classList.remove('on'); G.ui.el('.banner')?.classList.remove('on'); }, 900);
    }
    advance(1.5);
    P.attach(b, new THREE.Vector3(0.3, b.deck, 1.6)); P.yaw = b.heading + Math.PI - 0.1; P.pitch = 0.06;
    if (window.__log && G.great.lev) setTimeout(() => { const m = G.great.m.lev; const bx = new THREE.Box3().setFromObject(m.group); window.__log('lev dist ' + P.pos.distanceTo(m.group.position).toFixed(0) + ' scale ' + m.group.scale.x + ' box ' + bx.getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(0)).join(',') + ' y ' + m.group.position.y.toFixed(1) + ' fov ' + camera.fov); }, 500);
  }
  if (name.startsWith('beast:')) {
    const [, id, ph] = name.split(':');
    G.tod = +(Q.get('tod') || 0.45);
    G.state.s.boat.hull = 'motor'; G._boatChanged();
    const [x, z] = id === 'trenchwalker' || id === 'cthulhu' ? [-700, 700] : [-950, 250];
    b.pos.set(x, 0, z); b.heading = 0; b.docked = false; b._updateMatrix(); world.prebuild(x, z);
    G.beasts.spawn(id, b.pos);
    const B = G.beasts.b, cyc = G.beasts.constructor;
    if (ph) { const C = { cthulhu: 2, skymaw: 0, drownedking: 2, serpent: 1, trenchwalker: 1, colossus: 1, whalefall: 1 }[id] ?? 0; B.ci = C; B.phase = ph; B.pt = 3; }
    const dd = +(Q.get('d') || 150); B.x = x; B.z = z + dd; B.h = +(Q.get('h') || 1.6);
    G.beasts._host = () => {}; G.beasts._director = () => {};
    advance(4);
    P.attach(b, new THREE.Vector3(0.3, b.deck, 1.6)); P.yaw = Math.PI; P.pitch = +(Q.get('p') || 0.12);
    void cyc;
  }
  if (name === 'kraken') {
    G.tod = 0.47;
    G.teleport('offshore');
    G.state.s.tools.axe = true; P.tool = 'axe'; G.vm.setTool('axe');
    G.great.startKraken(b);
    P.local.set(-0.2, b.deck, -b.hull.hl + 0.5); P.yaw = b.heading + Math.PI - 0.25; P.pitch = 0.3;
    advance(+(Q.get('adv') || 3));
    if (window.__log) setInterval(() => { const K = G.great.kraken, T = G.great.m.arms[0]; window.__log('K ' + (K && K.phase) + ' ' + (K ? JSON.stringify(K.arms.map(a => [a.st, +a.t.toFixed(1)])) : '') + ' rz5 ' + (T ? T.segs[5].rotation.z.toFixed(2) : '-') + ' wt ' + world.time.toFixed(1)); }, 2000);
  }
  if (name === 'catch') {
    b.respawn(false);
    for (let i = 0; i < 6; i++) G.loot.spawn({ sp: ['bass', 'marlin', 'goldtrout', 'mahi', 'tuna', 'fogfin'][i], kg: 2 + i * 4, cm: 40 + i * 20, pos: b.toWorld(new THREE.Vector3(0, b.deck + 0.5, i * 0.5 - 1.5)), v: i === 3 ? 'golden' : null, zone: i % 4 });
    P.attach(b, new THREE.Vector3(0, b.deck, -1));
    setTimeout(() => { const items = [...G.loot.items.values()]; items[1].fav = true; items[3].fav = true; G.ui.open('catch'); }, 600);
  }
  if (name === 'admin') setTimeout(() => G.ui.open('admin'), 400);
  if (name === 'zoo') {
    // a row of catches laid out on your dock, for looking at the models in the world
    const ids = (Q.get('ids') || 'browncrab,arcticskate,bayoctopus,tidestar,nautilus,lionfish,hammerhead,boxfish,snowjelly,crayfish').split(',');
    const d = A.homeDock;
    G.tod = 0.45;
    ids.forEach((id, i) => G.loot.spawn({ sp: id, kg: 2, cm: 60, pos: new THREE.Vector3(d.x + (i % 2 ? 0.7 : -0.7), 1.6, d.z - 2 - i * 1.4), flop: 0 }));
    advance(2);
    look(new THREE.Vector3(d.x + 2.2, 1.25, d.z - 1), new THREE.Vector3(d.x, 1.2, d.z - 8), -0.35);
  }
  if (name.startsWith('journal')) {
    for (const [sp, w] of [['bass', 'Mirror Lake'], ['pike', 'Mirror Lake'], ['cod', 'Driftwood Bay - Driftwood Shallows'], ['goldtrout', 'Reed Pond'], ['mackerel', 'Driftwood Bay - Coastal Waters'], ['flounder', 'Driftwood Bay - Driftwood Shallows'], ['catfish', 'Mirror Lake']]) G.state.record(sp, 3, 50, null, w);
    const [, sec, sel] = name.split(':');
    setTimeout(() => G.ui.open('journal', { sec: sec || 'home', sel: sel || null }), 500);
  }
  if (name === 'chat') {
    // a crew mid-conversation, for a screenshot of the chat and voice HUD
    G.net = { isOnline: true, isHost: true, isClient: false, room: 'KRAKN', sendPlayer() {}, sendWorld() {}, sendEvent() {}, sendSave() {}, conns: new Map(), profiles: new Map(), lobbyList: [] };
    G.voice.mic = true; G.voice.status = 'on';
    G.remotes.set('bo', { pos: P.pos.clone(), walkie: true, name: 'Bo', color: '#8af0ff', update() {} });
    G.voice.peers.set('bo', { call: { close() {} }, prox: null, radio: null, an: null, level: 0.2, walkie: true, speaking: true });
    G.voice.update = () => {};
    G.chat.system('Room KRAKN is open. Tap CTRL to chat - voice is on nearby, hold C for the walkie-talkie.');
    G.chat.system('Bo joined the crew');
    G.chat.push({ name: 'Bo', text: 'I am out past the orange buoys, the tuna are huge here', color: '#8af0ff' });
    G.chat.push({ name: 'Fisher', text: 'on my way, save me one', color: '#ffd27a', self: true });
    G.chat.push({ name: 'Bo', text: 'something just bumped the boat', color: '#8af0ff' });
    G.chat.push({ name: 'Bo', text: 'something just bumped the boat', color: '#8af0ff' });
    setTimeout(() => { G.chat.tryOpen(); G.chat.fieldEl.value = 'is it the kraken'; }, 400);
  }
  if (name === 'giant') { P.attach(b, new THREE.Vector3(0, b.deck, 0)); G.creatures.spawnGiant(b.pos); }
}

/* ---------------- the intro's background life ---------------- */
function introFx() {
  const cv = document.getElementById('introfx');
  if (!cv) return;
  const c = cv.getContext('2d');
  const B = [], FSH = [];
  for (let i = 0; i < 46; i++) B.push({ x: Math.random(), y: Math.random(), r: 2 + Math.random() * 7, s: 0.02 + Math.random() * 0.05, w: Math.random() * 6 });
  for (let i = 0; i < 7; i++) FSH.push({ x: Math.random(), y: 0.55 + Math.random() * 0.35, s: (0.012 + Math.random() * 0.02) * (Math.random() < 0.5 ? -1 : 1), k: 18 + Math.random() * 30 });
  let last = performance.now();
  const draw = now => {
    const intro = document.getElementById('intro');
    if (intro.classList.contains('gone')) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const W = cv.width = innerWidth, H = cv.height = innerHeight;
    c.clearRect(0, 0, W, H);
    // fish silhouettes, low-poly, drifting past far below
    c.fillStyle = 'rgba(8,40,90,0.35)';
    for (const f of FSH) {
      f.x += f.s * dt; if (f.x > 1.15) f.x = -0.15; if (f.x < -0.15) f.x = 1.15;
      const x = f.x * W, y = f.y * H + Math.sin(now / 900 + f.k) * 6, k = f.k, d = Math.sign(f.s);
      c.beginPath(); c.moveTo(x + d * k, y); c.lineTo(x + d * k * 0.2, y - k * 0.34); c.lineTo(x - d * k * 0.6, y - k * 0.16); c.lineTo(x - d * k, y - k * 0.38); c.lineTo(x - d * k * 0.86, y);
      c.lineTo(x - d * k, y + k * 0.38); c.lineTo(x - d * k * 0.6, y + k * 0.16); c.lineTo(x + d * k * 0.2, y + k * 0.34); c.closePath(); c.fill();
    }
    // rising bubbles
    for (const b of B) {
      b.y -= b.s * dt; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); }
      const x = b.x * W + Math.sin(now / 700 + b.w) * 8, y = b.y * H;
      c.strokeStyle = 'rgba(230,248,255,0.5)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, y, b.r, 0, 6.283); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.28, 0, 6.283); c.fill();
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

/* ---------------- loop ---------------- */
let last = performance.now();
let titleT = 0;
function loop(now) {
  if (!Q.has('loop')) requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  U.uTime.value += dt;
  if (game && game.frozen) {
    // a staged screenshot: hold the scene exactly as it was set up
  } else if (game && game.running) {
    game.update(dt);
  } else if (game) {
    // the title camera drifts round the bay at golden hour
    titleT += dt;
    const a = titleT * 0.04;
    camera.position.set(40 + Math.cos(a) * 70, 9 + Math.sin(titleT * 0.3) * 1.5, 270 + Math.sin(a) * 30);
    camera.lookAt(10, 3, 170);
    world.update(dt, camera.position, camera.position, { tod: 0.72, storm: 0, dark: 0 }, 0);
    game.fx.update(dt);
    game.npcs && game.npcs.update(dt);
    input.endFrame();
  }
  renderer.autoClear = true;
  renderer.render(scene, camera);
  if (game && game.running && game.vm && game.vm.visible && game.player.mode !== 'drive') {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(game.vm.scene, game.vm.cam);
  }
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
addEventListener('mousedown', () => audio.unlock(), { once: false });
addEventListener('keydown', () => audio.unlock(), { once: true });
addEventListener('beforeunload', () => { if (game && game.running) game.save(); });
input.onLockChange = locked => {
  if (locked) input.requireLock = true;
  // menus always keep the cursor: a lock that lands while one is open is undone
  if (locked && (!game || !game.running || ui.isOpen || ui.talkEl)) { input.unlock(); return; }
  // (ESC out of the chat also drops the pointer - that is not a pause)
  const chatEsc = game && (game.chat.open || performance.now() / 1000 - game.chat.closedAt < 0.5);
  if (!locked && game && game.running && !ui.isOpen && !ui.talkEl && !input.blocked && !chatEsc) ui.open('pause');
};
// the canvas only captures the mouse in play, never in a menu
input.canLock = () => !!(game && game.running && !ui.isOpen && !ui.talkEl && !game.chat.open);

/* The playtest panel: hold L, J, M and 3 together. Only the complete
   combination does anything, and the same combination closes it again. */
{
  const COMBO = ['KeyL', 'KeyJ', 'KeyM', 'Digit3'];
  const down = new Set();
  let fired = false;
  const norm = c => (c === 'Numpad3' ? 'Digit3' : c);
  addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const c = norm(e.code);
    if (COMBO.includes(c)) down.add(c);
    if (!fired && COMBO.every(k => down.has(k)) && game && game.running) {
      fired = true;
      for (const k of COMBO) input.down.delete(k);     // none of the four keys does its normal job this time
      if (ui.screen === 'admin') ui.close(); else ui.open('admin');
    }
  });
  addEventListener('keyup', e => { down.delete(norm(e.code)); if (!COMBO.every(k => down.has(k))) fired = false; });
  addEventListener('blur', () => { down.clear(); fired = false; });
}

boot().catch(e => {
  console.error(e);
  const s = document.querySelector('#intro .load-step');
  if (s) { s.textContent = 'Something went wrong: ' + e.message + ' - try refreshing the page.'; s.style.color = '#ffb08a'; }
});
