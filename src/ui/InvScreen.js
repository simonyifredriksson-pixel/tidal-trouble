/* InvScreen.js - the inventory (TAB).

   One panel of sea glass sitting right on top of the hotbar, so the two read
   as one thing: what you carry above, what is in your hands' reach below.
   Categories down the left, a grid of what you have in the middle, the one
   thing you picked on the right with the few things you can do with it.
   Drag anything you can hold onto a hotbar slot; drag a slot off the bar to
   take it off. Nothing here is a shop - it is just your stuff. */

import { ic, TOOL_ICON } from './Icons.js';
import { fishThumb, rodThumb } from './Thumbs.js';
import { FISH_BY_ID, RARITY, catchName, VARIANT_BY_ID } from '../data/FishData.js';
import { RODS, ROD_BY_ID, BAITS, BAIT_BY_ID, TOOLS, TOOL_BY_ID, GEAR, GEAR_BY_ID } from '../data/GearData.js';
import { MATS, MAT_BY_ID } from '../data/BuildData.js';
import { HULL_BY_ID } from '../data/BoatData.js';
import { BAG_CAP, bagRefuses, livesSp } from '../game/Loot.js';
import { escapeHTML as esc, fmtInt, fmtKg, fmtCm } from '../core/Util.js';

const CATS = [
  ['all', 'Everything', 'box'], ['fish', 'Fish', 'fish'], ['rods', 'Rods', 'rod'], ['tools', 'Tools', 'hammer'],
  ['weapons', 'Weapons', 'harpoon'], ['bait', 'Bait', 'worm'], ['mats', 'Materials', 'log'], ['gear', 'Equipment', 'diving'], ['special', 'Special', 'shard'],
];
const clock = sec => { sec = Math.max(0, Math.round(sec)); return sec >= 3600 ? Math.floor(sec / 3600) + 'h ' + String(Math.floor(sec % 3600 / 60)).padStart(2, '0') + 'm' : Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };

/** Who "I" am to the host (the id my bag is filed under). */
export function myId(G) { return G.isHost ? G.player.id : (G.net?.selfId || G.player.id); }

/** Everything you have, as tiles: {key, cat, name, img|icon, qty, sub, hot (hotbar key or null), rar}. */
export function invItems(G) {
  const s = G.state.s, out = [];
  // the bag
  for (const it of G.loot.bagOf(myId(G)).sort((a, b) => G.loot.value(b) - G.loot.value(a))) {
    const sp = FISH_BY_ID[it.sp];
    if (!sp) continue;
    out.push({ key: 'fish:' + it.id, cat: 'fish', name: catchName(sp, it.v), img: fishThumb(it.sp), sub: fmtKg(it.kg), rar: sp.rarity, it, fav: it.fav });
  }
  for (const R of RODS) if (s.rods.includes(R.id)) out.push({ key: 'rod:' + R.id, cat: 'rods', name: R.name, img: rodThumb(R.id), sub: 'Tier ' + R.tier, hot: 'rod:' + R.id, R });
  for (const T of TOOLS) {
    if (T.id === 'rod' || !s.tools[T.id]) continue;
    out.push({ key: 'tool:' + T.id, cat: T.kind === 'weapon' ? 'weapons' : 'tools', name: T.name, icon: TOOL_ICON[T.id] || 'hands', hot: T.id, T });
  }
  for (const B of BAITS) if ((s.baits[B.id] || 0) > 0) out.push({ key: 'bait:' + B.id, cat: 'bait', name: B.name, icon: B.icon || B.id, qty: s.baits[B.id], B, on: s.bait === B.id });
  for (const M of MATS) if ((s.mats?.[M.id] || 0) > 0) out.push({ key: 'mat:' + M.id, cat: 'mats', name: M.name, icon: M.icon, qty: s.mats[M.id], M });
  for (const Gd of GEAR) if (s.gear[Gd.id]) out.push({ key: 'gear:' + Gd.id, cat: 'gear', name: Gd.name, icon: Gd.icon || 'diving', Gd });
  // special things: what you have found and what they are for
  if (s.shards > 0) out.push({ key: 'sp:shards', cat: 'special', name: 'Leviathan Shards', icon: 'shard', qty: s.shards, text: 'One from every leviathan you have landed. Something at the edge of the world is waiting for all of them.' });
  if (s.bottles > 0) out.push({ key: 'sp:bottles', cat: 'special', name: 'Messages in Bottles', icon: 'bottle', qty: s.bottles, text: 'Pages of a story that washed up one bottle at a time. Read them again in your journal (J).' });
  for (const [i, m] of (s.mysteries || []).entries()) out.push({ key: 'sp:chart' + i, cat: 'special', name: 'Waterlogged Chart', icon: 'map', text: 'An X marked far out at sea. It is on the chart in your hut.' + (m && m.x != null ? ' Around ' + Math.round(m.x) + ', ' + Math.round(m.z) + '.' : '') });
  for (const id of s.boatPlans || []) { const H = HULL_BY_ID[id]; if (H) out.push({ key: 'sp:plan:' + id, cat: 'special', name: H.name + ' - plans', icon: 'plans', text: 'Boat plans. Open the Blueprint Book, lay them out at the water\'s edge and build her piece by piece.' }); }
  const clues = Object.keys(s.clues || {}).length;
  if (clues) out.push({ key: 'sp:clues', cat: 'special', name: 'Leviathan Clues', icon: 'journal', qty: clues, text: 'Everything you have found out about the great ones. Your journal keeps them.' });
  return out;
}

/** Fish on your boat, in its cooler, or lying near you - not in the bag, but yours to deal with. */
function nearFish(G) {
  const P = G.player, b = G.boats[0], out = [];
  for (const it of G.loot.items.values()) {
    if (it.state === 'bag' || it.fly) continue;
    const sp = FISH_BY_ID[it.sp];
    if (!sp) continue;
    const mine = it.held === myId(G) || it.held === P.id;
    const onBoat = b && it.boat === b;
    const near = !it.boat && it.pos.distanceTo(P.pos) < 12;
    if (!mine && !onBoat && !near) continue;
    out.push({ it, sp, where: mine ? 'in your hands' : it.state === 'cooler' ? 'in the cooler' : onBoat ? 'on the deck' : 'nearby' });
  }
  return out.sort((a, b2) => G.loot.value(b2.it) - G.loot.value(a.it));
}

/* how many stars a thing gets on its card: rarity for a fish, tier for a rod */
const STARS = { junk: 0, common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, giant: 5, mythical: 6 };
const stars = n => n > 0 ? `<span class="stars">${'<i></i>'.repeat(Math.min(6, n))}</span>` : '';

function tile(x, sel, H) {
  const pic = x.img ? `<img src="${x.img}" alt="">` : `<span class="ti">${ic(x.icon)}</span>`;
  const rar = x.rar ? ` r-${x.rar}` : '';
  const bar = x.hot && H.slots.includes(x.hot) ? `<i class="onbar">${(H.slots.indexOf(x.hot) + 1) % 10}</i>` : '';
  return `<button class="itile${rar}${sel ? ' sel' : ''}${x.on ? ' on' : ''}" data-act="invSel" data-arg="${esc(x.key)}"${x.hot ? ` data-drag="${esc(x.hot)}"` : ''} title="${esc(x.name)}">
    ${pic}${x.qty != null ? `<b class="q">${fmtInt(x.qty)}</b>` : x.sub ? `<b class="q s">${esc(x.sub)}</b>` : ''}${x.fav ? `<i class="fv">${ic('star')}</i>` : ''}${bar}</button>`;
}

/* The card on the right, under the big picture: stars, the name, a row of
   stat chips (the last one coloured - what is special about it), the words. */
function card(G, x) {
  if (!x) return { pic: '', card: `<div class="icard empty"><p>Pick something to look at it.</p><p>Drag rods, tools and weapons onto the hotbar to use them with the number keys.</p></div>`, acts: '' };
  const s = G.state.s, H = G.state.hot;
  const onBar = x.hot ? H.slots.indexOf(x.hot) : -1;
  const barBtn = x.hot ? (onBar >= 0
    ? `<button class="ia" data-act="hotOff" data-arg="${esc(x.hot)}"><span class="key">${(onBar + 1) % 10}</span> Off the hotbar</button>`
    : `<button class="ia" data-act="hotOn" data-arg="${esc(x.hot)}">${ic('box')} On the hotbar</button>`) : '';
  const pic = x.img ? `<img src="${x.img}" alt="">` : `<span class="bigic">${ic(x.icon)}</span>`;
  let st = 0, chips = [], fx = null, text = '', acts = '';
  const chip = (icon, v) => `<span class="ch">${icon ? ic(icon) : ''}<b>${esc(String(v))}</b></span>`;
  if (x.cat === 'fish') {
    const it = x.it, sp = FISH_BY_ID[it.sp], R = RARITY[sp.rarity];
    st = STARS[sp.rarity] ?? 1;
    chips = [chip('fish', fmtKg(it.kg)), chip('scale', fmtCm(it.cm)), chip('coin', fmtInt(G.loot.value(it)))];
    fx = livesSp(sp) ? (it.alive ? { t: 'Alive  ' + clock(it.cool), c: 'good' } : { t: 'Dead', c: 'bad' }) : null;
    if (it.v && VARIANT_BY_ID[it.v]) fx = { t: VARIANT_BY_ID[it.v].name + ' x' + VARIANT_BY_ID[it.v].mult, c: 'gold' };
    text = (R ? R.name + '. ' : '') + (sp.blurb || '');
    acts = `<button class="ia main" data-act="bagTake" data-arg="${it.id}" ${G.player.held ? 'disabled' : ''}>${ic('hands')} Take it in your hands</button>
      <button class="ia" data-act="favToggle" data-arg="${it.id}">${ic('star')} ${it.fav ? 'Not a favourite' : 'Favourite'}</button>`;
  } else if (x.cat === 'rods') {
    const R = x.R;
    st = Math.max(1, Math.min(5, Math.round(R.tier / 2)));
    chips = [chip('rod', 'Tier ' + R.tier), chip('fish', 'Up to ' + fmtKg(R.maxKg))];
    if (s.rod === R.id) fx = { t: 'On your line', c: 'gold' };
    text = R.blurb || '';
    acts = `<button class="ia main" data-act="invUse" data-arg="${esc(x.hot)}">${ic('rod')} Take it out</button>${barBtn}`;
  } else if (x.cat === 'tools' || x.cat === 'weapons') {
    text = x.T.blurb || '';
    if (x.T.dmg) chips.push(chip('target', x.T.dmg + ' damage'));
    acts = `<button class="ia main" data-act="invUse" data-arg="${esc(x.hot)}">${ic('hands')} Take it out</button>${barBtn}`;
  } else if (x.cat === 'bait') {
    chips = [chip('worm', fmtInt(x.qty) + ' left')];
    if (x.on) fx = { t: 'On your hook', c: 'gold' };
    text = x.B.blurb || '';
    acts = x.on ? '' : `<button class="ia main" data-act="invBait" data-arg="${x.B.id}">${ic('worm')} Use this bait</button>`;
  } else if (x.cat === 'mats') {
    chips = [chip(x.icon, fmtInt(x.qty) + ' in the pack')];
    text = x.M.from || '';
    acts = `<button class="ia main" data-act="invMat" data-arg="${x.M.id}">${ic('hands')} Hold some <span class="key">G</span></button>`;
  } else if (x.cat === 'gear') {
    fx = { t: 'Always with you', c: 'good' };
    text = x.Gd.blurb || '';
  } else {
    if (x.qty != null) chips = [chip(x.icon, fmtInt(x.qty))];
    text = x.text || '';
  }
  return {
    pic,
    card: `<div class="icard">${stars(st)}<h3>${esc(x.name)}</h3>
      <div class="chips">${chips.join('')}${fx ? `<span class="ch fx ${fx.c}"><b>${esc(fx.t)}</b></span>` : ''}</div>
      <p>${esc(text)}</p></div>`,
    acts,
  };
}

export function invHTML(ui, d) {
  const G = ui.game, s = G.state.s;
  const all = invItems(G);
  const cat = d.cat || 'all';
  const count = c => c === 'all' ? all.length : all.filter(x => x.cat === c).length;
  const cats = CATS.filter(([c]) => c === 'all' || c === cat || count(c) > 0 || c === 'fish');
  const list = cat === 'all' ? all : all.filter(x => x.cat === cat);
  const sel = all.find(x => x.key === d.sel) || list[0] || null;
  const bagN = G.loot.bagOf(myId(G)).length;
  // holding a fish that would fit: offer to bag it
  const held = G.player.held ? G.loot.get(G.player.held) : null;
  const canBag = held && !bagRefuses(held);
  const near = cat === 'fish' ? nearFish(G) : [];
  const H = G.state.hot, cur = G.hotKeyNow();
  const C = card(G, sel);
  const curLabel = (CATS.find(c => c[0] === cat) || CATS[0])[1];
  return `<div class="inv live">
    <div class="itop"><div class="ititle"><h2>Inventory</h2><span>${ic('fish')} Bag ${bagN} / ${BAG_CAP}</span></div>
      <span class="ipurse">${ic('coin')}${fmtInt(s.money)}</span></div>
    <div class="ileft">
      <nav class="icats"><div class="icl">${esc(curLabel)}</div>
        ${cats.map(([c, label, icon]) => `<button class="${c === cat ? 'on' : ''}" data-act="invCat" data-arg="${c}" title="${label}">${ic(icon)}${c === cat ? '<i class="dia"></i>' : ''}</button>`).join('')}</nav>
      <section class="igrid">
        ${canBag ? `<div class="ibanner">${ic('hands')} <span>You are holding a ${esc(FISH_BY_ID[held.sp].name)}.</span> <button class="ia main" data-act="bagPut" data-arg="${held.id}">Put it in the bag</button></div>` : ''}
        ${list.length ? `<div class="tiles">${list.map(x => tile(x, sel && sel.key === x.key, H)).join('')}</div>` : `<div class="inone">${cat === 'fish' ? 'Your bag is empty. Everything you catch goes straight in here.' : 'Nothing here yet.'}</div>`}
        ${near.length ? `<h4>On your boat and nearby</h4><div class="nlist">${near.map(n => `<div class="nrow"><img src="${fishThumb(n.it.sp)}" alt=""><span>${esc(catchName(n.sp, n.it.v))}<small>${fmtKg(n.it.kg)} - ${n.where}</small></span><b>${ic('coin')}${fmtInt(G.loot.value(n.it))}</b></div>`).join('')}</div>` : ''}
      </section>
    </div>
    <div class="iright">
      <div class="ipic${sel && sel.key.startsWith('rod:') ? ' rod' : ''}">${C.pic}</div>
      ${C.card}
      <div class="iacts">${C.acts}</div>
    </div>
    <div class="ihot">${H.slots.map((k, i) => `<div class="slot ${k ? 'full' : 'empty'} ${k && k === cur ? 'on' : ''}" data-hslot="${i}"${k ? ` data-drag="${esc(k)}" data-from="${i}"` : ''}>${k ? `<span class="n">${(i + 1) % 10}</span>${ui.hotIcon(k)}` : ''}</div>`).join('')}</div>
    <div class="ikeys"><span>Drag to the hotbar</span><span>Select <span class="key">LMB</span></span><span>Back <span class="key">TAB</span></span></div>
  </div>`;
}
