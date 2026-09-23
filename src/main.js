/* main.js - boots Tidal Trouble.

   Loading screen -> the world is generated -> the title screen (the camera
   drifts round Driftwood Bay at golden hour) -> solo, host, or join.

   Debug query parameters (used by the test harness, harmless otherwise):
     ?auto=new|continue   skip the title
     ?tod=0.75            time of day
     ?at=x,z[,yaw]        start somewhere
     ?fresh               ignore the save
     ?stage=NAME          set up a scene for a screenshot (see stage()) */

import * as THREE from '../lib/three.module.js?v=1790183165';
import { Input } from './core/Input.js?v=1790183165';
import { Audio } from './core/Audio.js?v=1790183165';
import { World } from './world/World.js?v=1790183165';
import { Game } from './game/Game.js?v=1790183165';
import { UI } from './ui/UI.js?v=1790183165';
import { State } from './game/State.js?v=1790183165';
import { Net } from './net/Net.js?v=1790183165';
import { Remote } from './game/Remote.js?v=1790183165';
import { heightAt } from './world/Terrain.js?v=1790183165';
import { U } from './art/Materials.js?v=1790183165';

const Q = new URLSearchParams(location.search);
if (Q.has('debug')) {
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:6px;top:6px;z-index:99;color:#fff;background:rgba(0,0,0,0.82);padding:4px;font:13px monospace;white-space:pre-wrap;max-width:90vw;pointer-events:none';
  document.body.appendChild(box);
  const log = t => { box.textContent += t + '\n'; };
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
  const setBar = (f, t) => { document.querySelector('#loading .load-bar i').style.width = Math.round(f * 100) + '%'; document.querySelector('#loading .load-step').textContent = t; };
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
  document.getElementById('loading').classList.add('gone');
  window.TT = { game, world, state, net, THREE, renderer, scene, camera, heightAt };
  if (Q.has('netjoin')) { const code = Q.get('netjoin'); ui.open('lobby', { mode: 'join' }); joinRoom(code); netProbe('client'); }
  else if (Q.has('auto')) startGame(Q.get('auto') === 'continue' && State.hasSave() ? 'continue' : 'new');
  else showTitle();
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
    case 'host': startGame(State.hasSave() ? 'continue' : 'new'); hostRoom(); return true;
    case 'hostNow': hostRoom(); return true;
    case 'join': ui.open('lobby', { mode: 'join' }); return true;
    case 'joinGo': joinRoom(document.getElementById('joincode')?.value || ''); return true;
    case 'leaveRoom': net.leave(); ui.close(); if (state.remote) location.reload(); return true;
  }
  return undefined;
}

function startGame(mode) {
  if (game.running) return;
  ui.hideTitle();
  ui.close();
  game.start(mode);
  game.applySettings();
  if (Q.has('tod')) game.tod = +Q.get('tod');
  if (Q.has('at')) {
    const [x, z, yaw] = Q.get('at').split(',').map(Number);
    game.player.place(new THREE.Vector3(x, Math.max(heightAt(x, z), 0) + 0.2, z), yaw || 0);
    world.prebuild(x, z);
  }
  if (Q.has('stage')) stage(Q.get('stage'));
  input.lock();
  if (Q.has('nethost')) { hostRoom().then(() => { try { parent.postMessage({ room: net.room }, '*'); } catch (e) { /* */ } }); netProbe('host'); }
  if (Q.has('script')) setTimeout(() => import('./debug/Scripts.js?v=1790183165').then(m => m.runScripts(Q.get('script').split(','), game)), 500);
}

async function hostRoom() {
  ui.open('lobby', { mode: 'host' });
  try {
    await net.host({ name: state.settings.name || 'Captain', look: state.settings.look });
    game.player.id = net.selfId;
    for (const it of game.loot.items.values()) if (it.held === 'local') it.held = net.selfId;
    for (const b of game.boats) if (b.driver === 'local') b.driver = net.selfId;
  } catch (e) { net._status(e.message); }
  if (ui.screen === 'lobby') ui.render();
}

async function joinRoom(code) {
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
    if (!game.running) { game.start('join'); game.applySettings(); }
    game._boatChanged();
    ui.open('lobby', {});
    game._needsPlace = true;
  };
  net.on.join = (id, p) => {
    if (!game.remotes.has(id)) game.remotes.set(id, new Remote(game, id, p, idx++));
    ui.toast((p?.name || 'Someone') + ' joined the crew!', 'good');
    if (ui.screen === 'lobby') ui.render();
  };
  net.on.leave = (id, p) => {
    const r = game.remotes.get(id);
    if (r) { r.dispose(); game.remotes.delete(id); }
    for (const b of game.boats) if (b.driver === id) b.driver = null;
    for (const it of game.loot.items.values()) if (it.held === id) it.held = null;
    ui.toast((p?.name || 'Someone') + ' left.', 'warn');
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
    if (role === 'host' && n === 10) { game.events.start('storm', game.player.pos); }
    if (role === 'client' && n === 12) log('client sees storm=' + game.world.storm.toFixed(2) + ' events=' + game.events.list.map(e => e.k).join(','));
    if (n > 13) clearInterval(iv);
  }, 1500);
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
  if (name === 'giant') { P.attach(b, new THREE.Vector3(0, b.deck, 0)); G.creatures.spawnGiant(b.pos); }
}

/* ---------------- loop ---------------- */
let last = performance.now();
let titleT = 0;
function loop(now) {
  if (!Q.has('loop')) requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  U.uTime.value += dt;
  if (game && game.running) {
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
input.onLockChange = locked => { if (locked) input.requireLock = true; if (!locked && game && game.running && !ui.isOpen && !ui.talkEl && !input.blocked) ui.open('pause'); };

boot().catch(e => {
  console.error(e);
  const s = document.querySelector('#loading .load-step');
  if (s) s.textContent = 'Something went wrong: ' + e.message;
});
