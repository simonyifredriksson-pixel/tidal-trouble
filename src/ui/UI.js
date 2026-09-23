/* UI.js - the HUD and every screen.

   Screens are rendered as HTML strings into #screens and wired with
   `data-act` attributes; one delegated click handler dispatches them to
   `this.acts`, which call into the Game. After any action the screen
   re-renders from state, so a screen can never show a stale price or a
   fish you just sold.

   While a screen is open `input.blocked` is set and pointer lock is
   released; closing it re-locks on the next click into the world. */

import { ic, TOOL_ICON, EVENT_ICON, REGION_ICON, CLUE_ICON, PART_ICON } from './Icons.js?v=1790183165';
import { fishThumb, rodThumb, boatThumb, levThumb } from './Thumbs.js?v=1790183165';
import { FISH, FISH_BY_ID, RARITY, GIANTS, JOURNAL_ORDER, fishValue } from '../data/FishData.js?v=1790183165';
import { RODS, ROD_BY_ID, BAITS, BAIT_BY_ID, TOOLS, TOOL_BY_ID, GEAR, GEAR_BY_ID } from '../data/GearData.js?v=1790183165';
import { HULLS, HULL_BY_ID, PARTS, PAINTS, DECOR, boatStats } from '../data/BoatData.js?v=1790183165';
import { LEVIATHANS, LEV_BY_ID, BOTTLES, STORY } from '../data/LeviathanData.js?v=1790183165';
import { REGIONS, PLACES, WORLD } from '../world/MapData.js?v=1790183165';
import { heightAt } from '../world/Terrain.js?v=1790183165';
import { worldMapCanvas } from './MapArt.js?v=1790183165';
import { escapeHTML as esc, fmtInt, fmtKg, fmtCm, clamp } from '../core/Util.js?v=1790183165';

const $ = (s, r = document) => r.querySelector(s);
const EVENT_NAME = { storm: 'Storm', migration: 'Fish Migration', giant: 'Giant Creature', thief: 'Boat Thief', whirlpool: 'Whirlpool', meteor: 'Meteor' };
const EVENT_SUB = { storm: 'Waves are building. Get back to shore.', migration: 'Thousands of fish. Everyone fish like crazy.', giant: 'Something massive is nearby. Run - or try to catch it.', thief: 'Someone is taking your boat!', whirlpool: 'The ocean is spinning. We should probably leave.', meteor: 'A new, very rare fishing spot just appeared.' };

export class UI {
  constructor(game) {
    this.game = game;
    this.root = $('#ui');
    this.screen = null;
    this.acts = {};
    this.toastsEl = null;
    this.t = 0;
    this.tab = {};
    this._buildHUD();
    $('#screens').addEventListener('click', e => this._click(e));
    $('#screens').addEventListener('input', e => this._input(e));
    $('#title').addEventListener('click', e => this._click(e));
    this.root.addEventListener('click', e => { if (e.target.closest('.talk')) this._click(e); });
  }

  /* ================= loading & title ================= */
  loading(frac, label) {
    const el = $('#loading');
    el.querySelector('.load-bar i').style.width = Math.round(frac * 100) + '%';
    el.querySelector('.load-step').textContent = label;
  }
  loaded() { $('#loading').classList.add('gone'); }

  title(opts) {
    const el = $('#title');
    el.classList.remove('gone');
    el.innerHTML = `<div class="title-inner live">
      <div class="logo">
        <svg class="fishlogo" viewBox="0 0 120 72">${ic('fish').replace(/<svg[^>]*>|<\/svg>/g, '').replace(/d="/g, 'transform="scale(2.4) translate(0,-6)" d="')}</svg>
        <h1>TIDAL<span>TROUBLE</span></h1>
        <p>Go fishing. Catch weird things. Upgrade your boat. Explore dangerous waters. Try not to get eaten.</p>
      </div>
      <div class="menu">
        ${opts.hasSave ? `<button class="btn gold" data-act="continue">${ic('play')} Continue <small>Day ${opts.day}</small></button>` : ''}
        <button class="btn ${opts.hasSave ? '' : 'gold'}" data-act="newgame">${ic('boat')} ${opts.hasSave ? 'New Game' : 'Start Fishing'}</button>
        <button class="btn" data-act="host">${ic('people')} Host Co-op <small>1-4 players</small></button>
        <button class="btn" data-act="join">${ic('radio')} Join Co-op</button>
        <button class="btn dark" data-act="settings">${ic('gear')} Settings</button>
        <button class="btn dark" data-act="controls">${ic('keyE')} Controls</button>
      </div>
      <div class="title-foot">A chaotic fishing adventure for 1-4 players. Everything you see is generated - no two sunsets alike.</div>
    </div>`;
  }
  hideTitle() { $('#title').classList.add('gone'); }

  /* ================= HUD ================= */
  _buildHUD() {
    const h = document.createElement('div');
    h.id = 'hud';
    h.className = 'hidden';
    h.innerHTML = `
      <div class="vignette"></div><div class="underwater"></div><div class="hurtflash"></div><div class="flash"></div>
      <div class="cross"><i></i><i></i><i></i><i></i></div>
      <div class="prompt hide"><span class="chip"></span></div>
      <div class="clickplay hide"><span class="chip">${ic('mouse')} Click to look around</span></div>
      <div class="topleft">
        <div class="objective hide"><span class="chip"><span class="oi"></span><span><b></b><span class="ot"></span></span></span></div>
      </div>
      <div class="topright">
        <span class="chip money">${ic('coin')}<b>0</b></span>
        <span class="chip clock"><span class="ci"></span><span class="ct"></span></span>
        <span class="chip region-chip"><span class="ri"></span><span class="rt"></span></span>
      </div>
      <div class="radar hide"><canvas width="150" height="150"></canvas></div>
      <div class="eventchips"></div>
      <div class="fishui">
        <div class="bitemark">${ic('hook')}</div>
        <div class="charge hide"><i></i></div>
        <div class="fishdir hide"></div>
        <div class="tension hide"><div class="track"><div class="zone"></div><div class="danger"></div><div class="needle"></div></div>
          <div class="stam"><i></i></div><div class="lbl"><span class="tl">TENSION</span><span class="ll"></span></div></div>
      </div>
      <div class="hint hide"></div>
      <div class="hand-label"></div>
      <div class="baitchip chip"></div>
      <div class="hotbar"></div>
      <div class="boatpanel hide"><div class="chip">
        <div class="row">${ic('boat')}<span class="bname"></span><span style="margin-left:auto" class="bspd"></span></div>
        <div class="row">${ic('shield')}<div class="bar hp"><i></i></div></div>
        <div class="row">${ic('leak')}<div class="bar water"><i></i></div></div>
        <div class="row">${ic('box')}<span class="bcargo"></span></div>
        <div class="bwarn warn"></div>
      </div></div>
      <div class="stats">
        <span class="chip hpchip hide">${ic('heart')}<div class="bar"><i style="background:var(--red)"></i></div></span>
        <span class="chip breath hide">${ic('bubble')}<div class="bar water"><i></i></div></span>
      </div>
      <div class="toasts"></div>
      <div class="radios"></div>
      <div class="banner"><div class="bi"></div><h2></h2><p></p></div>
      <div class="catchcard"><div class="frame"><div class="panel"></div></div></div>
      <div class="chat"></div>
      <div class="sub hide"></div>
      <div class="fade"></div>
      <div class="shouts"></div>`;
    this.root.appendChild(h);
    this.hud = h;
    this.el = sel => h.querySelector(sel);
    this.radarCtx = h.querySelector('.radar canvas').getContext('2d');
  }

  showHUD(on) { this.hud.classList.toggle('hidden', !on); }

  hotbar() {
    const G = this.game, s = G.state.s;
    const hb = this.el('.hotbar');
    hb.innerHTML = TOOLS.map(T => {
      const own = !!s.tools[T.id];
      const on = G.player.tool === T.id;
      return `<div class="slot ${on ? 'on' : ''} ${own ? '' : 'locked'}"><span class="n">${T.slot}</span>${ic(TOOL_ICON[T.id])}</div>`;
    }).join('');
    this._hotKey = s.tools && JSON.stringify([s.tools, G.player.tool]);
  }

  update(dt) {
    const G = this.game, s = G.state.s, P = G.player;
    this.t += dt;
    if (JSON.stringify([s.tools, P.tool]) !== this._hotKey) this.hotbar();
    // fishing widgets every frame
    const F = G.fishing.hud();
    const fu = this.el('.tension');
    const fighting = F.state === 'fight';
    fu.classList.toggle('hide', !fighting);
    this.el('.charge').classList.toggle('hide', F.state !== 'charge');
    this.el('.charge i').style.width = Math.round(F.charge * 100) + '%';
    this.el('.bitemark').classList.toggle('on', F.state === 'bite');
    const fd = this.el('.fishdir');
    fd.classList.toggle('hide', !fighting);
    if (fighting) {
      this.el('.needle').style.left = clamp(F.tension * 100 / 1.05, 0, 100) + '%';
      this.el('.stam i').style.width = Math.round(F.stamina * 100) + '%';
      this.el('.ll').textContent = Math.round(F.dist) + ' / ' + F.line + ' m';
      this.el('.tl').textContent = F.tension > 0.95 ? 'TOO MUCH TENSION' : F.tension < 0.25 ? 'SLACK' : 'TENSION';
      fd.innerHTML = ic('arrow');
      fd.style.transform = `rotate(${F.fishDir < -0.1 ? 180 : 0}deg) scale(${Math.abs(F.fishDir) > 0.1 ? 1 : 0.001})`;
    }
    // hint line
    const hint = this.el('.hint');
    let ht = '';
    if (F.state === 'fight') ht = `Hold <span class="key">LMB</span> to reel  -  pull against the run with <span class="key">A</span><span class="key">D</span>  -  release when the line screams`;
    else if (F.state === 'bite') ht = `<span class="key">CLICK</span> NOW to strike!`;
    else if (F.state === 'wait' || F.state === 'nibble') ht = `Wait for the bobber to go under...  <span class="key">Hold LMB</span> reel in`;
    else if (F.state === 'charge') ht = `Release to cast`;
    else if (P.mode === 'drive') ht = `<span class="key">W</span><span class="key">S</span> throttle  <span class="key">A</span><span class="key">D</span> steer  <span class="key">X</span> stop  <span class="key">E</span> leave the helm`;
    else if (P.mode === 'mount') ht = `<span class="key">LMB</span> fire harpoon  <span class="key">E</span> leave the gun`;
    else if (P.mode === 'swim') ht = `<span class="key">SPACE</span> up  <span class="key">CTRL</span> dive  <span class="key">E</span> climb out`;
    else if (P.held) { const it = G.loot.get(P.held); ht = it ? `<span class="key">LMB</span> throw  <span class="key">F</span> drop  <span class="key">E</span> ${it.kg > 40 ? 'drag it somewhere' : 'store / mount'}` : ''; }
    hint.innerHTML = ht;
    hint.classList.toggle('hide', !ht);
    // throttled text
    if ((this._slow = (this._slow || 0) - dt) > 0) return;
    this._slow = 0.12;
    this.el('.money b').textContent = fmtInt(s.money);
    const tod = G.tod;
    const hh = Math.floor(tod * 24), mm = Math.floor((tod * 24 - hh) * 60);
    this.el('.clock .ci').innerHTML = ic(tod > 0.23 && tod < 0.79 ? 'sun' : 'moon');
    this.el('.clock .ct').textContent = `Day ${s.day}  ${String(hh).padStart(2, '0')}:${String(mm - mm % 10).padStart(2, '0')}`;
    const reg = G.world.region(P.pos.x, P.pos.z);
    this.el('.region-chip .ri').innerHTML = ic(REGION_ICON[reg]);
    this.el('.region-chip .rt').textContent = REGIONS[reg].name;
    const bait = BAIT_BY_ID[s.bait];
    this.el('.baitchip').innerHTML = P.tool === 'rod' ? `${ic(s.bait)} ${bait.name} x${s.baits[s.bait] || 0} <span class="key">B</span>` : '';
    this.el('.baitchip').classList.toggle('hide', P.tool !== 'rod');
    this.el('.hand-label').textContent = P.held ? (FISH_BY_ID[G.loot.get(P.held)?.sp]?.name || '') : TOOL_BY_ID[P.tool]?.name || '';
    // boat
    const b = P.boat;
    const bp = this.el('.boatpanel');
    bp.classList.toggle('hide', !b);
    if (b) {
      this.el('.bname').textContent = b.hull.name;
      this.el('.bspd').textContent = Math.round(b.speed() * 1.94) + ' kn';
      this.el('.bar.hp i').style.width = Math.round(b.hp / b.stats.hp * 100) + '%';
      this.el('.boatpanel .bar.water i').style.width = Math.round(b.water * 100) + '%';
      const kg = b.cargoKg();
      this.el('.bcargo').textContent = `${G.loot.onBoat(b).length} catches  ${fmtKg(kg)} / ${fmtKg(b.stats.cargoKg)}`;
      const w = [];
      if (b.fires.length) w.push('FIRE ON DECK - use the bucket!');
      if (b.leaks.length) w.push(b.leaks.length + ' leak' + (b.leaks.length > 1 ? 's' : '') + ' - use the hammer');
      if (b.water > 0.5) w.push('Taking on water!');
      if (kg > b.stats.cargoKg) w.push('Overloaded');
      this.el('.bwarn').textContent = w.join('  |  ');
    }
    // hp and breath
    this.el('.hpchip').classList.toggle('hide', P.hp > 99);
    this.el('.hpchip .bar i').style.width = P.hp + '%';
    const br = P.breath / P.maxBreath;
    this.el('.breath').classList.toggle('hide', br > 0.99);
    this.el('.breath .bar i').style.width = Math.round(br * 100) + '%';
    this.el('.underwater').classList.toggle('on', !!P.underwater);
    // events
    this.el('.eventchips').innerHTML = G.events.list.map(e => `<span class="chip">${ic(EVENT_ICON[e.k])} ${EVENT_NAME[e.k]}</span>`).join('') + (G.creatures.lev ? `<span class="chip">${ic('crown')} ${esc(G.creatures.lev.def.name)} ${this._levBar()}</span>` : '');
    // objective
    const obj = G.objective();
    const oe = this.el('.objective');
    oe.classList.toggle('hide', !obj);
    if (obj) { oe.querySelector('.oi').innerHTML = ic(obj.icon || 'compass'); oe.querySelector('b').textContent = obj.title; oe.querySelector('.ot').textContent = obj.text; }
    // radar
    const sonar = (b && b.stats.sonar > 0) || G.state.has('sonar');
    this.el('.radar').classList.toggle('hide', !sonar);
    if (sonar) this._radar();
    this.el('.cross').classList.toggle('dot', F.state !== 'idle' || !!P.held);
    this.el('.clickplay').classList.toggle('hide', G.input.locked || this.isOpen || !!this.talkEl || !G.input.requireLock);
  }

  _levBar() {
    const L = this.game.creatures.lev;
    if (!L) return '';
    if (L.phase === 'rampage') return ` - armour ${Math.round(L.armor / L.armorMax * 100)}%`;
    if (L.phase === 'tired') return ' - EXHAUSTED: hook it!';
    if (L.phase === 'hooked') return ' - on the line';
    return '';
  }

  _radar() {
    const G = this.game, c = this.radarCtx, P = G.player;
    const W = 150, R = 70, range = 60;
    c.clearRect(0, 0, W, W);
    c.strokeStyle = 'rgba(140,240,160,0.25)'; c.lineWidth = 1;
    for (const r of [R / 3, R * 2 / 3, R]) { c.beginPath(); c.arc(75, 75, r, 0, 6.28); c.stroke(); }
    const sweep = (this.t * 1.6) % 6.28;
    c.fillStyle = 'rgba(140,240,160,0.12)'; c.beginPath(); c.moveTo(75, 75); c.arc(75, 75, R, sweep - 0.5, sweep); c.fill();
    const yaw = P.yaw;
    const plot = (x, z, col, s = 3) => {
      const dx = x - P.pos.x, dz = z - P.pos.z;
      const rx = dx * Math.cos(yaw) - dz * Math.sin(yaw), rz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      const px = 75 + rx / range * R, py = 75 + rz / range * R;
      if (Math.hypot(px - 75, py - 75) > R) return;
      c.fillStyle = col; c.fillRect(px - s / 2, py - s / 2, s, s);
    };
    for (const S of G.creatures.shadows) if (S.alive) plot(S.pos.x, S.pos.z, 'rgba(160,255,180,0.8)', 2 + S.size * 2);
    for (const g of G.creatures.giants.values()) plot(g.pos.x, g.pos.z, '#ffb070', 8);
    if (G.creatures.lev) plot(G.creatures.lev.pos.x, G.creatures.lev.pos.z, '#ff5a4a', 12);
    for (const t of G.tools.traps.values()) plot(t.x, t.z, '#f2c14a', 4);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(75, 69); c.lineTo(79, 79); c.lineTo(71, 79); c.fill();
  }

  prompt(html) {
    const p = this.el('.prompt');
    if (!html) { p.classList.add('hide'); return; }
    p.classList.remove('hide');
    if (p._h !== html) { p.querySelector('.chip').innerHTML = html; p._h = html; }
  }

  toast(text, kind = 'info') {
    const box = this.el('.toasts');
    if (this._lastToast === text && this.t - this._lastToastT < 1.5) return;
    this._lastToast = text; this._lastToastT = this.t;
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.innerHTML = `<span class="chip">${esc(text)}</span>`;
    box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => d.classList.add('out'), 2800);
    setTimeout(() => d.remove(), 3400);
  }
  radio(text) {
    const box = this.el('.radios');
    const d = document.createElement('div');
    d.className = 'radiomsg';
    d.innerHTML = `<span class="chip">${ic('radio')}<span>${esc(text)}</span></span>`;
    box.appendChild(d);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => d.remove(), 7000);
    this.game.audio.radio();
  }
  banner(title, sub = '', icon = null, time = 3.2) {
    const b = this.el('.banner');
    b.querySelector('h2').textContent = title;
    b.querySelector('p').textContent = sub;
    b.querySelector('.bi').innerHTML = icon ? ic(icon) : '';
    b.classList.add('on');
    clearTimeout(this._banT);
    this._banT = setTimeout(() => b.classList.remove('on'), time * 1000);
  }
  eventBanner(k) { this.banner(EVENT_NAME[k].toUpperCase(), EVENT_SUB[k], EVENT_ICON[k]); }
  flashBite() { const f = this.el('.flash'); f.style.opacity = 0.18; setTimeout(() => f.style.opacity = 0, 80); }
  photoFlash() { const f = this.el('.flash'); f.style.transition = 'none'; f.style.opacity = 0.9; requestAnimationFrame(() => { f.style.transition = 'opacity 0.5s'; f.style.opacity = 0; }); }
  hurt() { const f = this.el('.hurtflash'); f.style.transition = 'none'; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = 'opacity 0.6s'; f.style.opacity = 0; }); }
  fade(on, text = '') { const f = this.el('.fade'); f.classList.toggle('on', on); f.textContent = text; }
  subtitle(text, t = 4) { const s = this.el('.sub'); s.textContent = text; s.classList.remove('hide'); clearTimeout(this._subT); this._subT = setTimeout(() => s.classList.add('hide'), t * 1000); }

  catchCard(c) {
    const sp = FISH_BY_ID[c.sp];
    const R = RARITY[sp.rarity];
    const el = this.el('.catchcard');
    el.querySelector('.panel').innerHTML = `
      <span class="tag" style="background:${R.css}">${R.name}</span>
      <img src="${fishThumb(c.sp)}" alt="">
      <h3>${esc(sp.name)}${c.isNew ? '<span class="new">NEW</span>' : c.record ? '<span class="new" style="background:#3a8a3a">RECORD</span>' : ''}</h3>
      <div class="meta"><span>${ic('fish')} <b>${fmtKg(c.kg)}</b></span><span><b>${fmtCm(c.cm)}</b></span><span>${ic('coin')} <b>${fmtInt(c.value)}</b></span></div>
      <div class="blurb">${esc(sp.blurb || '')}</div>`;
    el.classList.add('on');
    clearTimeout(this._ccT);
    this._ccT = setTimeout(() => el.classList.remove('on'), 5200);
  }

  chat(name, text, color = '#fff') {
    const box = this.el('.chat');
    const d = document.createElement('div');
    d.className = 'm';
    d.innerHTML = `<span style="color:${color}">${esc(name)}:</span> ${esc(text)}`;
    box.appendChild(d);
    while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => d.remove(), 12000);
  }
  chatInput(onSend) {
    const box = this.el('.chat');
    if (box.querySelector('input')) return;
    const inp = document.createElement('input');
    inp.placeholder = 'Say something... (Enter)';
    inp.maxLength = 90;
    box.appendChild(inp);
    inp.focus();
    this.game.input.blocked = true;
    const done = send => { if (send && inp.value.trim()) onSend(inp.value.trim()); inp.remove(); this.game.input.blocked = !!this.screen; };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); e.stopPropagation(); });
    inp.addEventListener('blur', () => done(false));
  }

  /* shouted lines over people's heads */
  shouts(list) {
    const box = this.el('.shouts');
    box.innerHTML = list.map(s => `<div class="shout" style="left:${s.x}px;top:${s.y}px">${esc(s.text)}</div>`).join('');
  }

  /* ================= talk panel ================= */
  talk(npc, line, opts) {
    this.closeTalk();
    const d = document.createElement('div');
    d.className = 'talk live';
    d.innerHTML = `<div class="frame"><div class="panel">
      <h3>${esc(npc.def.full)}<small>(${esc(npc.def.pr === 'they' ? 'they/them' : npc.def.pr === 'she' ? 'she/her' : 'he/him')})</small></h3>
      <div class="line">"${esc(line)}"</div>
      <div class="opts">${opts.map(o => `<button class="btn ${o.cls || ''}" data-act="${o.act}" data-arg="${o.arg || ''}">${o.icon ? ic(o.icon) : ''} ${esc(o.label)}</button>`).join('')}
        <button class="btn ghost" data-act="closeTalk">Bye</button></div>
    </div></div>`;
    this.root.appendChild(d);
    this.talkEl = d;
    this.game.input.blocked = true;
    this.game.input.unlock();
  }
  closeTalk() { if (this.talkEl) { this.talkEl.remove(); this.talkEl = null; this.game.input.blocked = !!this.screen; } }

  /* ================= screens ================= */
  get isOpen() { return !!this.screen; }

  open(name, data = {}) {
    this.closeTalk();
    this.screen = name;
    this.data = data;
    const s = $('#screens');
    s.classList.add('on');
    this.root.classList.add('menu');
    this.render();
    this.game.onScreen(true);
  }
  close() {
    if (!this.screen) return;
    const was = this.screen;
    this.screen = null;
    $('#screens').classList.remove('on');
    $('#screens').innerHTML = '';
    this.game.onScreen(false, was);
  }
  render() {
    const fn = this['_' + this.screen];
    const html = fn ? fn.call(this, this.data) : '';
    const sc = $('#screens');
    const prev = sc.querySelector('.sbody');
    const scroll = prev ? prev.scrollTop : 0;
    sc.innerHTML = `<div class="screen">${html}</div>`;
    const nb = sc.querySelector('.sbody');
    if (nb) nb.scrollTop = scroll;
    if (this.screen === 'map' || this.screen === 'guild') this._drawMap();
  }

  _click(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    this.game.audio.click();
    if (act === 'close') return this.close();
    if (act === 'closeTalk') return this.closeTalk();
    if (act === 'tab') { this.tab[this.screen] = el.dataset.arg; this.data.sel = null; return this.render(); }
    const fn = this.game.uiAct(act, el.dataset.arg, el);
    if (this.screen) this.render();
    return fn;
  }
  _input(e) {
    const el = e.target;
    if (el.dataset.set) this.game.uiSetting(el.dataset.set, el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value);
  }

  _head(icon, title, sub, purse = true) {
    return `<div class="shead">${ic(icon)}<div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
      ${purse ? `<span class="purse">${ic('coin')}${fmtInt(this.game.state.s.money)}</span>` : ''}
      <button class="btn ghost x" data-act="close" style="color:var(--paper1)">${ic('cross')}</button></div>`;
  }
  _tabs(list, def) {
    const cur = this.tab[this.screen] || def;
    return { cur, html: `<div class="tabs">${list.map(([id, label, icon]) => `<button class="tab ${cur === id ? 'on' : ''}" data-act="tab" data-arg="${id}">${icon ? ic(icon) : ''}${esc(label)}</button>`).join('')}</div>` };
  }
  _wrap(inner) { return `<div class="frame"><div class="panel">${inner}</div></div>`; }

  /* ---------- pause ---------- */
  _pause() {
    const G = this.game;
    return this._wrap(`${this._head('anchor', 'Paused', G.net && G.net.isOnline ? (G.net.isHost ? 'Hosting room ' + G.net.room : 'In room ' + G.net.room) : 'Solo', false)}
      <div class="menu" style="max-width:420px">
        <button class="btn gold" data-act="close">${ic('play')} Resume</button>
        <button class="btn" data-act="open" data-arg="journal">${ic('journal')} Journal <small>J</small></button>
        <button class="btn" data-act="open" data-arg="map">${ic('map')} Map <small>M</small></button>
        ${!G.net?.isOnline ? `<button class="btn" data-act="hostNow">${ic('people')} Invite friends (host co-op)</button>` : ''}
        <button class="btn dark" data-act="open" data-arg="settings">${ic('gear')} Settings</button>
        <button class="btn dark" data-act="open" data-arg="controls">${ic('keyE')} Controls</button>
        <button class="btn red" data-act="quit">${ic('door')} Save and quit to title</button>
      </div>`);
  }

  /* ---------- settings ---------- */
  _settings() {
    const S = this.game.state.settings;
    const range = (k, label, min, max, step) => `<label class="setting">${label} <input type="range" min="${min}" max="${max}" step="${step}" value="${S[k]}" data-set="${k}"></label>`;
    const tog = (k, label) => `<label class="setting toggle">${label} <input type="checkbox" ${S[k] ? 'checked' : ''} data-set="${k}"></label>`;
    return this._wrap(`${this._head('gear', 'Settings', 'Saved automatically', false)}
      <div class="sbody"><div class="settings">
        ${range('sens', 'Mouse sensitivity', 0.2, 3, 0.05)}
        ${range('fov', 'Field of view', 60, 100, 1)}
        ${range('volume', 'Master volume', 0, 1, 0.05)}
        ${range('music', 'Music', 0, 1, 0.05)}
        ${range('grass', 'Grass density', 0, 1.5, 0.1)}
        ${tog('invert', 'Invert mouse Y')}
        ${tog('shadows', 'Shadows')}
        ${tog('shake', 'Camera shake')}
        <label class="setting">Your name (shown to friends) <input type="text" maxlength="16" value="${esc(S.name)}" data-set="name"></label>
        <div class="setting">Your fisher
          <div class="looks">${[0, 1, 2, 3].map(i => `<button class="${S.look === i ? 'on' : ''}" data-act="look" data-arg="${i}">${ic(['hands', 'people', 'fish', 'boat'][i])}</button>`).join('')}</div>
        </div>
      </div></div>
      <div class="foot"><button class="btn gold" data-act="${this.game.running ? 'open' : 'close'}" data-arg="pause">Done</button></div>`);
  }

  /* ---------- controls ---------- */
  _controls() {
    const k = s => s.split(' ').map(x => `<span class="key">${x}</span>`).join('');
    const rows = [
      ['Move', k('W A S D')], ['Look', 'Mouse'], ['Jump / swim up', k('SPACE')], ['Sprint', k('SHIFT')], ['Dive', k('CTRL')],
      ['Use tool / cast (hold)', k('LMB')], ['Strike when it bites', k('CLICK')], ['Reel in (hold)', k('LMB')], ['Pull against the fish', k('A D')],
      ['Interact / drive / talk', k('E')], ['Pick up / drop', k('F')], ['Throw what you hold', k('LMB')], ['Tools', k('1 - 9') + ' or wheel'],
      ['Change bait', k('B')], ['Journal', k('J')], ['Map', k('M')], ['Chat (co-op)', k('T')], ['Shout', k('Z X C V')], ['Pause', k('ESC')],
      ['Boat: throttle', k('W S')], ['Boat: steer', k('A D')], ['Boat: full stop', k('X')],
    ];
    return this._wrap(`${this._head('keyE', 'Controls', 'Fishing, boating and general chaos', false)}
      <div class="sbody"><div class="controls">${rows.map(r => `<div><span>${r[0]}</span><span>${r[1]}</span></div>`).join('')}</div>
      <p style="font-weight:700;color:var(--ink2);margin-top:14px">Fighting a fish: keep the tension needle inside the green zone. Reeling raises tension, letting go lowers it. When the fish runs to one side, pull the other way with A or D - it tires much faster. Big fish will tow your boat.</p></div>
      <div class="foot"><button class="btn gold" data-act="${this.game.running ? 'open' : 'close'}" data-arg="pause">Done</button></div>`);
  }

  /* ---------- tackle shop (Melvin) ---------- */
  _tackle() {
    const G = this.game, s = G.state.s;
    const t = this._tabs([['rods', 'Rods', 'rod'], ['bait', 'Bait', 'worm'], ['tools', 'Equipment', 'harpoon'], ['gear', 'Gear', 'diving']], 'rods');
    let body = '';
    if (t.cur === 'rods') {
      const cur = ROD_BY_ID[s.rod];
      body = `<div class="grid">${RODS.map(R => {
        const own = s.rods.includes(R.id), eq = s.rod === R.id;
        const bar = (label, v, max, base) => `<div class="statrow"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, v / max * 100)}%"></i></div><span class="${v > base ? 'up' : v < base ? 'down' : ''}">${v >= 1000 ? 'any' : v}</span></div>`;
        return `<div class="card ${own ? 'owned' : ''} ${eq ? 'equipped' : ''}"><img class="thumb" src="${rodThumb(R.id)}" alt="">
          <h3>${esc(R.name)}</h3><p>${esc(R.blurb)}</p>
          ${bar('Max fish', Math.min(R.maxKg, 1000), 500, Math.min(cur.maxKg, 1000))}${bar('Line (m)', R.line, 260, cur.line)}${bar('Reel', R.reel, 7.2, cur.reel)}${bar('Cast', R.cast, 30, cur.cast)}
          <div class="row">${own ? (eq ? '<span class="price">Equipped</span>' : `<button class="btn" data-act="equipRod" data-arg="${R.id}">Equip</button>`) : `<span class="price">${ic('coin')}${fmtInt(R.price)}</span><button class="btn gold" data-act="buyRod" data-arg="${R.id}" ${s.money < R.price ? 'disabled' : ''}>Buy</button>`}</div></div>`;
      }).join('')}</div>`;
    } else if (t.cur === 'bait') {
      body = `<div class="grid">${BAITS.map(B => `<div class="card ${s.bait === B.id ? 'equipped' : ''}"><h3>${ic(B.id)}${esc(B.name)}</h3><p>${esc(B.blurb)}</p>
        <div class="row"><span>You have <b>${s.baits[B.id] || 0}</b></span><span class="price">${ic('coin')}${B.price * B.pack} / ${B.pack}</span></div>
        <div class="row" style="margin-top:6px"><button class="btn gold" data-act="buyBait" data-arg="${B.id}" ${s.money < B.price * B.pack ? 'disabled' : ''}>Buy ${B.pack}</button>
        <button class="btn" data-act="setBait" data-arg="${B.id}" ${(s.baits[B.id] || 0) > 0 ? '' : 'disabled'}>Use</button></div></div>`).join('')}</div>`;
    } else if (t.cur === 'tools') {
      body = `<div class="grid">${TOOLS.filter(T => T.price > 0).map(T => {
        const own = !!s.tools[T.id];
        return `<div class="card ${own ? 'owned' : ''}"><h3>${ic(TOOL_ICON[T.id])}${esc(T.name)}</h3><p>${esc(T.blurb)}</p>
          <div class="row">${own ? `<span class="price">Owned  -  slot ${T.slot}</span>` : `<span class="price">${ic('coin')}${fmtInt(T.price)}</span><button class="btn gold" data-act="buyTool" data-arg="${T.id}" ${s.money < T.price ? 'disabled' : ''}>Buy</button>`}</div></div>`;
      }).join('')}</div>`;
    } else {
      body = `<div class="grid">${GEAR.map(T => {
        const own = !!s.gear[T.id];
        const icon = { diving: 'diving', sonar: 'sonar', lucky: 'lucky', gloves: 'gloves' }[T.id];
        return `<div class="card ${own ? 'owned' : ''}"><h3>${ic(icon)}${esc(T.name)}</h3><p>${esc(T.blurb)}</p>
          <div class="row">${own ? '<span class="price">Owned</span>' : `<span class="price">${ic('coin')}${fmtInt(T.price)}</span><button class="btn gold" data-act="buyGear" data-arg="${T.id}" ${s.money < T.price ? 'disabled' : ''}>Buy</button>`}</div></div>`;
      }).join('')}</div>`;
    }
    return this._wrap(`${this._head('rod', "Melvin's Bait & Tackle", 'Everything is on sale. Nothing is refundable.')}${t.html}<div class="sbody">${body}</div>`);
  }

  /* ---------- boatyard (Marge) ---------- */
  _boatyard() {
    const G = this.game, s = G.state.s;
    const t = this._tabs([['hulls', 'Boats', 'boat'], ['parts', 'Upgrades', 'wrench'], ['paint', 'Paint', 'paint'], ['decor', 'Decorations', 'flag'], ['repair', 'Repairs', 'hammer']], 'hulls');
    const cur = boatStats(s.boat);
    let body = '';
    if (t.cur === 'hulls') {
      body = `<div class="grid">${HULLS.map(H => {
        const own = s.hulls.includes(H.id), eq = s.boat.hull === H.id;
        const st = boatStats({ ...s.boat, hull: H.id });
        const bar = (label, v, max, base, unit = '') => `<div class="statrow"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, v / max * 100)}%"></i></div><span class="${v > base ? 'up' : v < base ? 'down' : ''}">${Math.round(v)}${unit}</span></div>`;
        return `<div class="card ${own ? 'owned' : ''} ${eq ? 'equipped' : ''}"><img class="thumb" src="${boatThumb({ hull: H.id, parts: s.boat.parts, paint: s.boat.paint, decor: [] })}" alt="">
          <h3>${esc(H.name)}</h3><p>${esc(H.blurb)}</p>
          ${bar('Speed', st.speed * 1.94, 45, cur.speed * 1.94, 'kn')}${bar('Hull', st.hp, 1600, cur.hp)}${bar('Cargo', st.cargoKg, 9000, cur.cargoKg, 'kg')}${bar('Waves', st.waves * 10, 60, cur.waves * 10)}
          <div class="row">${own ? (eq ? '<span class="price">Your boat</span>' : `<button class="btn" data-act="useHull" data-arg="${H.id}">Switch to this</button>`) : `<span class="price">${ic('coin')}${fmtInt(H.price)}</span><button class="btn gold" data-act="buyHull" data-arg="${H.id}" ${s.money < H.price ? 'disabled' : ''}>Buy</button>`}</div></div>`;
      }).join('')}</div>`;
    } else if (t.cur === 'parts') {
      const H = HULL_BY_ID[s.boat.hull];
      body = `<div class="grid">${PARTS.map(P => {
        const lv = s.boat.parts[P.id] || 0;
        const na = (P.id === 'mount' && !H.mount);
        const next = P.prices[lv + 1];
        return `<div class="card"><h3>${ic(PART_ICON[P.id])}${esc(P.name)}</h3><p>${esc(P.blurb)}</p>
          <div class="lv">${P.names.map((_, i) => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</div>
          <p style="margin:0 0 6px"><b>${esc(P.names[lv])}</b>${lv < P.max ? '  ->  ' + esc(P.names[lv + 1]) : ''}</p>
          <div class="row">${na ? '<span class="price">Needs a bigger boat</span>' : lv >= P.max ? '<span class="price">Maxed</span>' : `<span class="price">${ic('coin')}${fmtInt(next)}</span><button class="btn gold" data-act="buyPart" data-arg="${P.id}" ${s.money < next ? 'disabled' : ''}>Upgrade</button>`}</div></div>`;
      }).join('')}</div>`;
    } else if (t.cur === 'paint') {
      body = `<div class="grid">${PAINTS.map(P => {
        const own = s.paints.includes(P.id), eq = s.boat.paint === P.id;
        return `<div class="card ${eq ? 'equipped' : ''}"><div class="swatch" style="background:linear-gradient(135deg,#${P.hull.toString(16).padStart(6, '0')} 0 70%,#${P.trim.toString(16).padStart(6, '0')} 70%)"></div><h3>${esc(P.name)}</h3>
          <div class="row">${own ? (eq ? '<span class="price">Applied</span>' : `<button class="btn" data-act="paint" data-arg="${P.id}">Apply</button>`) : `<span class="price">${ic('coin')}${P.price}</span><button class="btn gold" data-act="buyPaint" data-arg="${P.id}" ${s.money < P.price ? 'disabled' : ''}>Buy</button>`}</div></div>`;
      }).join('')}</div>`;
    } else if (t.cur === 'decor') {
      body = `<div class="grid">${DECOR.map(D => {
        const own = s.decorOwned.includes(D.id), on = s.boat.decor.includes(D.id);
        return `<div class="card ${on ? 'equipped' : ''}"><h3>${ic('star')}${esc(D.name)}</h3><p>${esc(D.blurb)}</p>
          <div class="row">${own ? `<button class="btn ${on ? 'dark' : ''}" data-act="toggleDecor" data-arg="${D.id}">${on ? 'Remove' : 'Put on boat'}</button>` : `<span class="price">${ic('coin')}${D.price}</span><button class="btn gold" data-act="buyDecor" data-arg="${D.id}" ${s.money < D.price ? 'disabled' : ''}>Buy</button>`}</div></div>`;
      }).join('')}</div>`;
    } else {
      const b = G.boats[0];
      const miss = b ? b.stats.hp - b.hp : 0;
      const cost = Math.ceil(miss * 0.6) + (b ? b.leaks.length * 15 : 0);
      body = `<div class="card" style="max-width:520px"><h3>${ic('hammer')}Full repair</h3><p>Marge patches every plank, pumps out the water and puts out anything that is on fire. Hull ${b ? Math.round(b.hp) : 0} / ${b ? b.stats.hp : 0}, ${b ? b.leaks.length : 0} leaks.</p>
        <div class="row"><span class="price">${ic('coin')}${cost}</span><button class="btn gold" data-act="repair" ${cost <= 0 || s.money < cost ? 'disabled' : ''}>Repair</button></div></div>`;
    }
    return this._wrap(`${this._head('boat', "Marge's Boatyard", 'You break it, I fix it. You sink it, I build you a new one.')}${t.html}<div class="sbody">${body}</div>`);
  }

  /* ---------- fish market (Pim) ---------- */
  _market() {
    const G = this.game;
    const items = G.sellable();
    const total = items.reduce((a, it) => a + G.loot.value(it), 0);
    const body = items.length ? `<div class="list">${items.map(it => {
      const sp = FISH_BY_ID[it.sp], R = RARITY[sp.rarity], v = G.loot.value(it);
      const big = it.kg >= 150 || sp.rarity === 'giant';
      return `<div class="li"><img src="${fishThumb(it.sp)}" alt=""><span>${esc(sp.name)} <span class="rar" style="background:${R.css}">${R.name}</span><small>${fmtKg(it.kg)}  ${fmtCm(it.cm)}  ${it.state === 'cooler' ? '- in the cooler' : it.held ? '- in your hands' : ''}</small></span>
        <span class="price">${ic('coin')}${fmtInt(v)}</span>
        <span>${big ? `<button class="btn dark" data-act="yard" data-arg="${it.id}">To trophy yard</button> ` : ''}<button class="btn gold" data-act="sell" data-arg="${it.id}">Sell</button></span></div>`;
    }).join('')}</div>` : `<div class="empty">${G.boatAtMarket() ? 'Nothing to sell. Go catch something weird.' : 'Bring your boat up to the pier (or carry a fish here) and Pim will buy the lot.'}</div>`;
    return this._wrap(`${this._head('sell', "Pim's Fish Market", 'I buy anything with fins. And some things without.')}
      <div class="sbody">${body}</div>
      <div class="foot"><span class="spacer"></span><span class="price" style="font:400 20px var(--display);color:#8a5a10">${ic('coin')} ${fmtInt(total)}</span>
      <button class="btn gold" data-act="sellAll" ${items.length ? '' : 'disabled'}>Sell everything</button></div>`);
  }

  /* ---------- guild (Odessa) ---------- */
  _guild() {
    const G = this.game, s = G.state.s;
    const t = this._tabs([['levs', 'The Leviathans', 'crown'], ['map', 'Guild Map', 'map'], ['story', 'The Mystery', 'shard']], 'levs');
    let body = '';
    if (t.cur === 'levs') {
      body = `<p style="font-weight:700;color:var(--ink2);margin:0 0 12px">Every leviathan swallowed a shard of the Heart of the Tide. Find all of a creature's clues and its lure point appears on the map. Shards recovered: <b>${s.shards} / 11</b></p>
        <div class="levgrid">${LEVIATHANS.map(L => {
          const caught = G.state.levCaught(L.id), ready = G.state.levReady(L);
          const known = caught || L.clues.some(c => s.clues[c.id]);
          return `<div class="lev ${caught ? 'caught' : ''}"><img src="${levThumb(L.id, caught)}" alt="">
            <h3>${known || caught ? esc(L.name) : '? ? ?'}</h3><small>${esc(REGIONS[L.region].name)}${caught ? '  -  CAUGHT' : ''}</small>
            <ul>${L.final ? `<li class="${ready ? '' : 'todo'}">${ic(ready ? 'check' : 'lock')}Recover all eleven shards.</li>` : L.clues.map(c => s.clues[c.id] ? `<li>${ic('check')}${esc(c.text)}</li>` : `<li class="todo">${ic(CLUE_ICON[c.type])}${esc(clueHint(c))}</li>`).join('')}</ul>
            ${!caught && ready ? `<div class="ready">${ic('target')}Lure point marked on the map${L.lure.time !== 'any' ? ' - go at ' + (L.lure.time === 'storm' ? 'the height of a storm' : L.lure.time) : ''}. Needs a ${esc(['', 'Basic', 'Reinforced', 'Deepwater', 'Titan'][L.rod])} Rod or better.</div>` : ''}
          </div>`;
        }).join('')}</div>`;
    } else if (t.cur === 'map') {
      body = this._mapBody(true);
    } else {
      const chapters = LEVIATHANS.filter(L => s.levs[L.id]).map(L => `<p><b>${esc(L.name)}.</b> ${esc(L.story)}</p>`).join('');
      body = `<div class="story"><p>${esc(STORY.intro)}</p>${s.shards >= 6 ? `<p><i>${esc(STORY.midpoint)}</i></p>` : ''}${chapters}${s.levs.tidemother ? `<p><b>${esc(STORY.ending)}</b></p>` : ''}
        <h3 style="margin:16px 0 8px">Captain Mare's log (${s.bottles} / ${BOTTLES.length} bottles found)</h3>
        ${BOTTLES.slice(0, s.bottles).map(b => `<div class="bottle">${esc(b)}</div>`).join('') || '<p>Messages in bottles wash up all over the sea. Magnetic and mystery bait bring them up more often.</p>'}</div>`;
    }
    return this._wrap(`${this._head('crown', 'The Driftwood Fishing Guild', 'Guildmaster Odessa keeps the great map.')}${t.html}<div class="sbody">${body}</div>`);
  }

  /* ---------- journal ---------- */
  _journal(d) {
    const G = this.game, s = G.state.s;
    const t = this._tabs([['fish', 'Fish', 'fish'], ['clues', 'Clues', 'eye'], ['story', 'Story', 'bottle'], ['stats', 'Records', 'trophy']], 'fish');
    let body = '';
    if (t.cur === 'fish') {
      const sel = d.sel && FISH_BY_ID[d.sel];
      if (sel) {
        const rec = s.dex[sel.id];
        const R = RARITY[sel.rarity];
        body = `<div class="dexdetail"><div><img src="${fishThumb(sel.id, !!rec)}" alt=""></div><div>
          <h2 style="font-size:32px">${rec ? esc(sel.name) : '? ? ?'} <span class="rar" style="background:${R.css}">${R.name}</span></h2>
          <p style="font-weight:700;color:var(--ink2);font-size:15px">${rec ? esc(sel.blurb) : 'You have not caught one of these yet.'}</p>
          ${rec ? `<p><b>Caught:</b> ${rec.n}  -  <b>Best:</b> ${fmtKg(rec.bestKg)}, ${fmtCm(rec.bestCm)}  -  <b>Worth about:</b> ${fmtInt(fishValue(sel, rec.bestKg))}</p>` : ''}
          <p><b>Where:</b> ${sel.where === 'all' ? 'Anywhere' : sel.where === 'meteor' ? 'Where a meteor has fallen' : sel.where.map(w => REGIONS[w].name).join(', ')}  -  <b>Water:</b> ${({ lake: 'Lakes', sea: 'The sea', ice: 'Ice holes', any: 'Anywhere' })[sel.water] || 'Event'}  -  <b>When:</b> ${sel.time || 'any'}</p>
          ${sel.bait ? `<p><b>Likes:</b> ${Object.entries(sel.bait).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => BAIT_BY_ID[k]?.name).filter(Boolean).join(', ') || 'anything'}</p>` : ''}
          <button class="btn" data-act="dexBack">Back to the journal</button></div></div>`;
      } else {
        body = `<p style="font-weight:800;color:var(--ink2);margin:0 0 10px">${G.state.dexCount()} of ${JOURNAL_ORDER.filter(f => f.rarity !== 'junk').length} species caught</p>
          <div class="dex">${JOURNAL_ORDER.map(f => {
            const rec = s.dex[f.id]; const R = RARITY[f.rarity];
            return `<div class="dexcell ${rec ? '' : 'unknown'}" data-act="dexSel" data-arg="${f.id}"><span class="stripe" style="background:${R.css}"></span><img src="${fishThumb(f.id, !!rec)}" alt=""><b>${rec ? esc(f.name) : '? ? ?'}</b><small>${rec ? 'x' + rec.n + '  best ' + fmtKg(rec.bestKg) : R.name}</small></div>`;
          }).join('')}</div>`;
      }
    } else if (t.cur === 'clues') {
      body = `<div class="levgrid">${LEVIATHANS.filter(L => !L.final).map(L => {
        const any = L.clues.some(c => s.clues[c.id]);
        return `<div class="lev ${G.state.levCaught(L.id) ? 'caught' : ''}"><h3>${any ? esc(L.name) : 'Something in ' + esc(REGIONS[L.region].name)}</h3>
          <ul>${L.clues.map(c => s.clues[c.id] ? `<li>${ic('check')}${esc(c.text)}</li>` : `<li class="todo">${ic(CLUE_ICON[c.type])}${esc(clueHint(c))}</li>`).join('')}</ul></div>`;
      }).join('')}</div>`;
    } else if (t.cur === 'story') {
      body = `<div class="story"><p>${esc(STORY.intro)}</p>${BOTTLES.slice(0, s.bottles).map(b => `<div class="bottle">${esc(b)}</div>`).join('')}</div>`;
    } else {
      const st = s.stats;
      const big = st.biggest ? FISH_BY_ID[st.biggest.sp] : null;
      body = `<div class="grid">
        ${[['fish', 'Fish caught', fmtInt(st.caught)], ['coin', 'Coins earned', fmtInt(st.earned)], ['trophy', 'Biggest catch', big ? esc(big.name) + ' ' + fmtKg(st.biggest.kg) : '-'], ['crown', 'Leviathans', Object.keys(s.levs).length + ' / 12'],
          ['fire', 'Boat fires', st.fires], ['leak', 'Boats sunk', st.sunk], ['wave', 'Times overboard', st.overboard], ['explosive', 'Explosions', st.explosions], ['hands', 'Slapped by a fish', st.slapped], ['bottle', 'Bottles found', s.bottles]]
          .map(([i, l, v]) => `<div class="card"><h3>${ic(i)}${esc(String(v))}</h3><p>${l}</p></div>`).join('')}</div>`;
    }
    return this._wrap(`${this._head('journal', 'Fishing Journal', 'Everything you have caught, found and survived')}${t.html}<div class="sbody">${body}</div>`);
  }

  /* ---------- world map ---------- */
  _map() { return this._wrap(`${this._head('map', 'Map of the Waters', 'Driftwood Bay and beyond', false)}${this._mapBody(false)}`); }
  _mapBody(guild) {
    return `<div class="mapwrap"><canvas class="worldmap" width="720" height="720" data-guild="${guild ? 1 : 0}"></canvas>
      <div class="legend">
        <div>${ic('arrow')} You</div><div>${ic('boat')} Your boat</div><div>${ic('people')} Friends</div>
        <div>${ic('target')} Leviathan lure point</div><div>${ic('eye')} Clue to inspect</div><div>${ic('trap')} Your traps</div>
        ${Object.values(REGIONS).map(r => `<div>${ic(REGION_ICON[r.id])} ${esc(r.name)}</div>`).join('')}
        <p style="font-size:12px;color:var(--ink2)">${Object.values(REGIONS).map(r => `<b>${esc(r.name)}:</b> ${esc(r.blurb)}`).join('<br>')}</p>
      </div></div>`;
  }
  _drawMap() {
    const cv = document.querySelector('canvas.worldmap');
    if (!cv) return;
    const G = this.game, c = cv.getContext('2d');
    const N = 720, H = WORLD.half;
    c.drawImage(worldMapCanvas(N), 0, 0);
    const toPx = (x, z) => [(x + H) / (2 * H) * N, (z + H) / (2 * H) * N];
    c.font = '700 13px Nunito, sans-serif'; c.textAlign = 'center';
    for (const p of PLACES) { const [px, py] = toPx(p.x, p.z); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillText(p.name, px + 1, py + 1); c.fillStyle = '#fbf4e2'; c.fillText(p.name, px, py); }
    const s = G.state.s;
    const dot = (x, z, col, r = 5) => { const [px, py] = toPx(x, z); c.fillStyle = col; c.beginPath(); c.moveTo(px, py - r); c.lineTo(px + r, py); c.lineTo(px, py + r); c.lineTo(px - r, py); c.fill(); };
    // clues and lure points
    for (const L of LEVIATHANS) {
      if (G.state.levCaught(L.id)) continue;
      if (G.state.levReady(L)) { const [px, py] = toPx(L.lure.x, L.lure.z); c.strokeStyle = '#ff5a4a'; c.lineWidth = 3; c.beginPath(); c.arc(px, py, 12 + Math.sin(this.t * 4) * 2, 0, 6.28); c.stroke(); dot(L.lure.x, L.lure.z, '#ff5a4a', 6); }
    }
    for (const t of G.tools.traps.values()) dot(t.x, t.z, '#f2c14a', 4);
    for (const e of G.events.list) if (e.r) dot(e.x, e.z, '#9ab8ff', 7);
    for (const b of G.boats) dot(b.pos.x, b.pos.z, '#f08a2a', 6);
    for (const p of G.remotes.values()) dot(p.pos.x, p.pos.z, '#8af0ff', 5);
    const P = G.player;
    const [px, py] = toPx(P.pos.x, P.pos.z);
    c.save(); c.translate(px, py); c.rotate(-P.yaw + Math.PI);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.stroke(); c.fill();
    c.restore();
  }

  /* ---------- bait picker ---------- */
  _bait() {
    const s = this.game.state.s;
    return this._wrap(`${this._head('worm', 'Choose Your Bait', 'What happens if I use THIS?', false)}
      <div class="baitwheel">${BAITS.map(B => `<div class="card ${s.bait === B.id ? 'equipped' : ''}" data-act="setBait" data-arg="${B.id}">${ic(B.id)}<h3 style="justify-content:center">${esc(B.name)}</h3><p>x${s.baits[B.id] || 0}</p></div>`).join('')}</div>
      <div class="foot"><button class="btn gold" data-act="close">Done</button></div>`);
  }

  /* ---------- trophy board ---------- */
  _trophy(d) {
    const G = this.game, s = G.state.s;
    const slot = d.slot ?? null;
    const caught = JOURNAL_ORDER.filter(f => s.dex[f.id] && f.rarity !== 'junk');
    const cells = s.cabin.slots.map((it, i) => `<div class="card ${slot === i ? 'equipped' : ''}" data-act="trophySlot" data-arg="${i}" style="cursor:pointer">
      ${it ? `<img class="thumb" src="${fishThumb(it.sp)}" alt=""><h3>${esc(FISH_BY_ID[it.sp]?.name || '')}</h3><p>${fmtKg(it.kg)}</p>` : `<h3>${ic('box')}Empty plaque ${i + 1}</h3><p>Pick a fish below, or carry one in and press E at the wall.</p>`}</div>`).join('');
    const picks = slot === null ? '<p style="font-weight:800;color:var(--ink2)">Select a plaque first.</p>' : `<div class="dex">${caught.map(f => `<div class="dexcell" data-act="trophyPick" data-arg="${f.id}"><img src="${fishThumb(f.id)}" alt=""><b>${esc(f.name)}</b><small>best ${fmtKg(s.dex[f.id].bestKg)}</small></div>`).join('')}
      <div class="dexcell" data-act="trophyPick" data-arg=""><b>Clear this plaque</b></div></div>`;
    return this._wrap(`${this._head('trophy', 'Your Trophy Wall', 'A replica of your best catch of each species. Your cabin becomes a museum.', false)}
      <div class="sbody"><div class="grid">${cells}</div><h3 style="margin:16px 0 8px">Mount a replica</h3>${picks}</div>`);
  }

  /* ---------- lobby ---------- */
  _lobby(d) {
    const G = this.game, N = G.net;
    if (d.mode === 'join' && !N.isOnline) {
      return this._wrap(`${this._head('radio', 'Join a Crew', 'Ask your friend for their room code', false)}
        <div class="lobby"><p style="font-weight:700">Room code</p><input id="joincode" maxlength="5" placeholder="ABCDE" autofocus>
        <div class="foot" style="justify-content:flex-start"><button class="btn gold" data-act="joinGo">${ic('play')} Join</button><span class="spacer"></span><span style="font-weight:800;color:var(--ink2)">${esc(N.status || '')}</span></div></div>`);
    }
    const list = N.lobbyList || [];
    return this._wrap(`${this._head('people', N.isHost ? 'Your Crew' : 'Crew', N.isHost ? 'Share this code with up to three friends' : 'Connected to the host', false)}
      <div class="lobby">${N.isHost ? `<div class="code">${esc(N.room || '.....')}</div>` : ''}
        <div class="plist">${list.map(p => `<div>${ic('hands')} ${esc(p.name)} ${p.you ? '(you)' : ''} ${p.host ? '- captain' : ''}</div>`).join('')}</div>
        <p style="font-weight:700;color:var(--ink2)">${esc(N.status || '')}</p>
        <p style="font-weight:700;color:var(--ink2);font-size:13px">Everyone shares the boat, the guild purse and the cabin. One drives. One fishes. One grabs the harpoon. One does whatever they want.</p></div>
      <div class="foot"><button class="btn dark" data-act="leaveRoom">Leave</button><span class="spacer"></span><button class="btn gold" data-act="close">${ic('play')} Go fishing</button></div>`);
  }

  /* ---------- ending ---------- */
  _ending() {
    return this._wrap(`<div class="ending" style="margin:auto"><div class="bigicon">${ic('shard')}</div><h2>The Heart of the Tide</h2>
      <p>${esc(STORY.ending)}</p><p>Every leviathan caught. Every shard returned. The guild will be telling this story for another hundred years.</p>
      <p style="color:var(--ink2)">The sea is still yours. Keep fishing - there is always something weirder out there.</p>
      <div class="foot" style="justify-content:center"><button class="btn gold" data-act="close">${ic('rod')} Keep fishing</button></div></div>`);
  }

  _confirm(d) {
    return this._wrap(`<h2>${esc(d.title)}</h2><p style="font-weight:700">${esc(d.text)}</p><div class="foot"><button class="btn dark" data-act="close">Cancel</button><button class="btn red" data-act="${d.act}">${esc(d.ok || 'Yes')}</button></div>`);
  }
}

function clueHint(c) {
  if (c.type === 'catch') return 'Catch a ' + (FISH_BY_ID[c.species]?.name || 'certain fish') + ' in ' + REGIONS[c.region].name + '.';
  if (c.type === 'sound') return 'Listen near ' + placeNear(c.at) + (c.time === 'night' ? ' at night.' : c.time === 'storm' ? ' during a storm.' : '.');
  if (c.type === 'sonar') return 'Something only a sonar would see, near ' + placeNear(c.at) + '.';
  if (c.type === 'mark') return 'Something has been damaged near ' + placeNear(c.at) + '.';
  return 'Something was left behind near ' + placeNear(c.at) + '.';
}
function placeNear(at) {
  let best = PLACES[0], bd = 1e9;
  for (const p of PLACES) { const d = Math.hypot(p.x - at[0], p.z - at[1]); if (d < bd) { bd = d; best = p; } }
  return best.name;
}
