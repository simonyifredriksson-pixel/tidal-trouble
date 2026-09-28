/* JournalData.js - the Fishing Journal as a field guide, organised by where
   things actually live.

   Nothing here is written by hand per fish: every section is COMPUTED from
   the same data the bite roll reads (FishData `where`, `water`, `zoneOnly`,
   ZMIN), so a fish listed under Frostbite Lake can be caught at Frostbite
   Lake, a fish in the Kraken's Water only bites in the Offshore zone, and a
   new species shows up in the right sections by itself.

   A common fish that lives in several places appears in each of them - the
   journal is a collection map, and each section counts on its own. */

import { FISH, GIANTS, FISH_BY_ID, ZMIN } from './FishData.js';
import { LEVIATHANS } from './LeviathanData.js';
import { GREAT, KRAKEN } from './GreatData.js';
import { BEASTS } from './BeastData.js';
import { REGIONS, ZONES, FISH_SPOTS } from '../world/MapData.js';

const listed = f => f.rarity !== 'junk' || f.id === 'chest' || !!f.relic;
const inRegion = r => f => Array.isArray(f.where) && f.where.includes(r) && f.zoneOnly === undefined && listed(f);

export const SECTIONS = [
  { id: 'home', name: 'Driftwood Bay', icon: 'pine', blurb: 'The lakes, the harbour and the water inside the first buoys. Where every fisher starts.', fish: inRegion('home'), lev: 'home' },
  { id: 'frost', name: 'Frostbite Lake', icon: 'mountain', blurb: 'The frozen north: ice holes on the lake, cold sea round the mountain.', fish: inRegion('frost'), lev: 'frost' },
  { id: 'tropic', name: 'Sunken Coast', icon: 'palm', blurb: 'Warm shallows, coral and shipwrecks, east of the bay.', fish: inRegion('tropic'), lev: 'tropic' },
  { id: 'open', name: 'The Open Sea', icon: 'wave', blurb: 'Big swell far to the west. Big fish that need a real boat.', fish: inRegion('open'), lev: 'open' },
  { id: 'black', name: 'The Blackwater', icon: 'abyss', blurb: 'The deep trench in the south-west. Almost no light. Bring lamps.', fish: inRegion('black'), lev: 'black' },
  { id: 'kraken', name: "The Kraken's Water", icon: 'tentacle', blurb: 'The Offshore zone - the orange buoys and beyond, before the deep. Things live here that live nowhere else.', fish: f => f.zoneOnly === 2 && listed(f), creatures: [{ kind: 'kraken', id: 'kraken' }] },
  { id: 'reach', name: "Vigil's End", icon: 'light', blurb: 'The last island, at the edge of the sea. Fog, rocks, and the great ones.', fish: inRegion('reach'), creatures: GREAT.map(g => ({ kind: 'great', id: g.id })) },
  // --- the far islands, ring by ring ---
  { id: 'whisper', name: 'Whispering Woods', icon: 'pine', ring: 'Mid-Ocean', blurb: 'Three hidden lakes under a forest of giants, and the dark coast round them.', fish: inRegion('whisper') },
  { id: 'sunscar', name: 'Sunscar Archipelago', icon: 'volcano', ring: 'Mid-Ocean', blurb: 'Warm water, black sand and the hot vents under a live volcano.', fish: inRegion('sunscar') },
  { id: 'skywatch', name: 'Skywatch Isle', icon: 'cliff', ring: 'Mid-Ocean', blurb: 'The water at the foot of the great cliff, fished from ninety metres up.', fish: inRegion('skywatch') },
  { id: 'crystal', name: 'The Crystal Reef', icon: 'crystal', ring: 'Mid-Ocean', blurb: 'The ring reef, and the lagoon of crystal spires that glows at night.', fish: inRegion('crystal') },
  { id: 'mid', name: 'Mid-Ocean', icon: 'wave', ring: 'Mid-Ocean', blurb: 'The open blue water between the mid-ocean islands.', fish: inRegion('mid') },
  { id: 'frostfall', name: 'Frostfall', icon: 'mountain', ring: 'Outer Ocean', blurb: 'Under the ice of Glacier Lake, and the frozen coast. You will need an auger.', fish: inRegion('frostfall') },
  { id: 'dread', name: 'Dreadmire', icon: 'swamp', ring: 'Outer Ocean', blurb: 'The fog-bound channels and the Mirepool at their heart.', fish: inRegion('dread') },
  { id: 'ironwreck', name: 'Ironwreck', icon: 'wreck', ring: 'Outer Ocean', blurb: 'The wreck field and everything that lives in it - and what the wrecks give back.', fish: inRegion('ironwreck') },
  { id: 'lost', name: 'The Lost Shores', icon: 'ghost', ring: 'Outer Ocean', blurb: 'The empty village of Ashcombe and its bay, in the fog that never lifts.', fish: inRegion('lost') },
  { id: 'outer', name: 'The Outer Ocean', icon: 'wave', ring: 'Outer Ocean', blurb: 'Grey, heavy water between the outer islands.', fish: inRegion('outer') },
  { id: 'thunder', name: 'Thunderpeak', icon: 'storm', ring: 'Extreme Waters', blurb: 'The storm that never ends. Some of these only bite when lightning hits the water.', fish: inRegion('thunder') },
  { id: 'tide', name: 'Tidebreaker', icon: 'current', ring: 'Extreme Waters', blurb: 'The race round the stacks and the rip through the middle. Anchor well.', fish: inRegion('tide') },
  { id: 'crown', name: 'The Sunken Crown', icon: 'crown', ring: 'Extreme Waters', blurb: 'The drowned city of Aurel: its streets, its throne room, and its treasure.', fish: inRegion('crown') },
  { id: 'abyssal', name: 'The Abyssal Reach', icon: 'abyss', ring: 'Extreme Waters', blurb: 'The needle rock over the deepest trench in the world. The biggest fish that are not leviathans.', fish: inRegion('abyssal') },
  { id: 'extreme', name: 'Extreme Waters', icon: 'storm', ring: 'Extreme Waters', blurb: 'The black water far from everything, out towards the rim of the world.', fish: inRegion('extreme') },
  { id: 'beasts', name: 'Ocean Beasts', icon: 'leviathan', blurb: 'Ten things too big for any other page. Nobody tells you where they are. You find out.', fish: () => false, creatures: BEASTS.map(b => ({ kind: 'beast', id: b.id })) },
  { id: 'hidden', name: 'Hidden Places', icon: 'eye', blurb: 'A cave, a temple under the sea, a lost wreck, an island on no chart. Nobody will tell you where. The fish that live there live nowhere else.', fish: f => f.where === 'site' && listed(f) },
  { id: 'any', name: 'All Waters', icon: 'fish', blurb: 'The strange ones that turn up anywhere - and the one that only falls from the sky.', fish: f => (f.where === 'all' || f.where === 'meteor') && listed(f) },
];

/** Every entry of a section: special creatures first, then fish by rarity. */
const ORDER = { legendary: 0, giant: 1, epic: 2, rare: 3, uncommon: 4, common: 5, junk: 6 };
export function sectionEntries(S) {
  const out = [];
  for (const c of S.creatures || []) out.push({ type: c.kind, id: c.id, key: c.kind + ':' + c.id });
  if (S.lev) for (const L of LEVIATHANS) if (L.region === S.lev) out.push({ type: 'lev', id: L.id, key: 'lev:' + L.id });
  const fish = [...FISH, ...GIANTS].filter(S.fish).sort((a, b) => (ORDER[b.rarity] - ORDER[a.rarity]) || (a.value - b.value));
  for (const f of fish) out.push({ type: 'fish', id: f.id, key: 'fish:' + f.id });
  return out;
}

/** Has the player discovered this entry? */
export function discovered(s, e) {
  if (e.type === 'fish') return !!s.dex[e.id];
  if (e.type === 'lev') return !!s.levs[e.id];
  if (e.type === 'great') return !!(s.great && s.great[e.id]);
  if (e.type === 'kraken') return !!(s.kraken && s.kraken.caught);
  if (e.type === 'beast') return !!(s.beastSeen && s.beastSeen[e.id]) || !!(s.beasts && s.beasts[e.id]);
  return false;
}

/** Collection progress: overall (unique entries) and per section. */
export function progress(s) {
  const seen = new Map();
  const per = {};
  for (const S of SECTIONS) {
    const es = sectionEntries(S);
    let n = 0;
    for (const e of es) { const d = discovered(s, e); if (d) n++; seen.set(e.key, d); }
    per[S.id] = { got: n, of: es.length };
  }
  let got = 0; for (const d of seen.values()) if (d) got++;
  return { got, of: seen.size, per };
}

/* ---------------- the words on a discovered page ---------------- */
const WATER = { lake: 'lakes', sea: 'the sea', ice: 'ice holes', any: 'lakes and sea', fresh: 'lakes and ice holes' };
export function habitat(f) {
  if (f.zoneOnly === 2) return 'Offshore water - the kraken\'s zone, and nowhere else';
  if (f.where === 'meteor') return 'Only where a meteor has fallen into the sea';
  if (f.where === 'site') return { grotto: "Only inside Smuggler's Grotto", temple: 'Only over the Drowned Temple', promise: 'Only over the wreck of the Bright Promise', castaway: 'Only in the water round Castaway Key' }[f.site] || 'Somewhere hidden';
  const HOT = { birds: 'where the birds are diving', boil: 'where the water boils with fish', bubbles: 'where bubbles rise from the deep', glow: 'in the patches of glowing water at night', debris: 'among floating wreckage' };
  if (f.hotspot) return 'Open sea, ' + HOT[f.hotspot];
  if (f.spot) { const S = FISH_SPOTS.find(q => q.id === f.spot); if (S) return 'Only in ' + S.name + (f.weather === 'storm' ? ', in a storm' : ''); }
  if (f.where === 'all') return 'Anywhere with water in it';
  if (f.weather === 'storm') return (f.where || []).map(r => REGIONS[r]?.name).filter(Boolean).join(', ') + ' - only in a storm';
  const regions = (f.where || []).map(r => REGIONS[r]?.name).filter(Boolean);
  const z = ZMIN[f.id] || 0;
  const depth = f.water === 'lake' || f.water === 'ice' || f.water === 'fresh' ? '' : z > 0 ? ' - ' + ZONES[z].name + ' and farther out' : ' - close to shore';
  return regions.join(', ') + '  (' + (WATER[f.water] || 'water') + ')' + depth;
}
export function sizeClass(f) {
  const cm = (f.cm[0] + f.cm[1]) / 2;
  return cm < 30 ? 'Small' : cm < 80 ? 'Medium' : cm < 200 ? 'Large' : cm < 400 ? 'Huge' : 'Enormous';
}
export const BEHAVIOUR = {
  bomb: 'Explodes a few seconds after it is landed. Throw it - into the water, ideally.',
  puffer: 'Inflates on deck and floats away into the sky unless you grab it.',
  mimic: 'Looks exactly like a treasure chest. Opening it is a mistake.',
  chest: 'A real treasure chest: coins and bait inside.',
  eel: 'Electrocutes whoever touches it. Rubber gloves help.',
  sting: 'Venomous spines: it stings whoever grabs it. Rubber gloves help.',
  slap: 'Launches itself straight into your face when it leaves the water.',
  thief: 'Often steals the bait and swims off with it. Net it to find its hoard.',
  shark: 'Tiny when it bites. Ten times bigger once it is hooked.',
  ghost: 'Fades out of sight during the fight - hold on while it is gone.',
  relic: 'Treasure, not a fish. Sell it - for twice as much with a Relic Satchel.',
};
export const TIME = { any: 'Any time', day: 'By day', night: 'At night', dusk: 'Around sunset' };
void FISH_BY_ID; void KRAKEN;
