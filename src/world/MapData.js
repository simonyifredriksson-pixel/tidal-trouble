/* MapData.js - the geography of the whole sea, from Driftwood Bay out to
   the fog at the edge of the world.
   Everything here is DATA: islands, lakes, pads, paths, regions, currents,
   storms and the wave field. Terrain.js turns it into a height function;
   Water.js and the boat read the same wave formula (waveAmp / waveHeight),
   generated into GLSL from the same arrays, so a boat floats on exactly the
   surface that is drawn.

   Layout (metres, +x east, +z south), in rings round Driftwood Bay:
     INNER (0 - 1700)      Driftwood Bay, Frostbite Lake, the Sunken Coast,
                           the Open Sea, the Blackwater, Castaway Key
     MID-OCEAN (1700-3000) Whispering Woods, the Sunscar Archipelago,
                           Skywatch Isle, the Crystal Reef
     OUTER (3000-4500)     Frostfall, Dreadmire, Ironwreck, the Lost Shores
     EXTREME (4500-6500)   Thunderpeak, Tidebreaker, the Sunken Crown,
                           the Abyssal Reach
     THE EDGE (6500+)      Vigil's End, alone at the rim, and then nothing
   The farther out, the bigger the swell, the stronger the current, the
   darker the water and the stranger everything gets. */

import { smoothstep, clamp } from '../core/Util.js';

export const WORLD = {
  half: 7400,          // square bounds of everything (the map, the terrain scan)
  edge: 7300,          // the sea ends at this radius from the bay: past it, only fog and walls of water
  seaFloor: -30,
  seed: 7127,
};
export const HOME_CENTRE = { x: 0, z: 80 };
export const distHome = (x, z) => Math.hypot(x - HOME_CENTRE.x, z - HOME_CENTRE.z);

/* Vigil's End: the last island, right at the rim of the world. */
export const VIGIL = { x: 4950, z: 4950 };

/* Regions. `style` decides how the land is coloured and what grows on it,
   `band` marks the open-water regions that fill the gaps between islands. */
export const REGIONS = {
  home:   { id: 'home',   name: 'Driftwood Bay',  x: 0,    z: 0,    r: 430, color: 0x5d9e4a, style: 'home', blurb: 'Small lakes, dense forest and the only pub for a hundred miles.' },
  frost:  { id: 'frost',  name: 'Frostbite Lake', x: 0,    z: -780, r: 430, color: 0xcfe4ee, style: 'frost', blurb: 'Frozen mountains. Ice fishing. Something moves under the ice.' },
  tropic: { id: 'tropic', name: 'Sunken Coast',   x: 800,  z: 120,  r: 400, color: 0xf0c872, style: 'tropic', blurb: 'Tropical islands, old shipwrecks and very strange fish.' },
  open:   { id: 'open',   name: 'The Open Sea',   x: -850, z: -60,  r: 520, color: 0x3f7fa6, band: true, blurb: 'Huge waves, huge fish and storms. Bring a better boat.' },
  black:  { id: 'black',  name: 'The Blackwater', x: -680, z: 820,  r: 440, color: 0x1e2430, style: 'black', blurb: 'Extremely deep. Almost no light. Something enormous lives down there.' },
  // --- mid-ocean ---
  whisper:  { id: 'whisper',  name: 'Whispering Woods',     x: -2050, z: -1650, r: 560, color: 0x2e6a3a, style: 'woods', blurb: 'A forest so tall the island is dark at noon. Hidden lakes, and something walking between the trees at night.' },
  sunscar:  { id: 'sunscar',  name: 'Sunscar Archipelago',  x: 2450,  z: -700,  r: 560, color: 0xd0582a, style: 'volcanic', blurb: 'Black sand, hot springs and a volcano that has not finished yet. The water is warm and the fish are strange.' },
  skywatch: { id: 'skywatch', name: 'Skywatch Isle',        x: -2750, z: 700,   r: 470, color: 0xb8b8a8, style: 'cliff', blurb: 'A tower of rock ninety metres high. People live on top and fish from the edge of the sky.' },
  crystal:  { id: 'crystal',  name: 'The Crystal Reef',     x: 700,   z: 2650,  r: 540, color: 0x8ae8f0, style: 'crystal', blurb: 'A ring reef round a lagoon full of crystal spires. By night the whole lagoon glows.' },
  // --- outer ---
  frostfall: { id: 'frostfall', name: 'Frostfall',          x: -400,  z: -3900, r: 640, color: 0xe8f4fa, style: 'frost', blurb: 'The far north. A glacier lake, frozen fish, and the only Ice Auger for sale anywhere.' },
  dread:     { id: 'dread',     name: 'Dreadmire',          x: -3000, z: 2700,  r: 640, color: 0x4a5a3a, style: 'swamp', blurb: 'A drowned forest of channels and fog. Take the boat in slowly. Something takes the lanterns.' },
  ironwreck: { id: 'ironwreck', name: 'Ironwreck',          x: 3050,  z: -2600, r: 520, color: 0x8a5a3a, style: 'rust', blurb: 'A graveyard of ships. Salvagers live in the wrecks and sell what the sea gives back.' },
  lost:      { id: 'lost',      name: 'The Lost Shores',    x: -4100, z: -1300, r: 580, color: 0x8a8a7a, style: 'ghost', blurb: 'A village where everyone left in one night. The fog never lifts. Somebody left notes.' },
  // --- extreme ---
  thunder:   { id: 'thunder',   name: 'Thunderpeak',        x: 3500,  z: -4600, r: 700, color: 0x5a5a8a, style: 'storm', blurb: 'A mountain that makes its own weather. It never stops storming, and some fish only bite in lightning.' },
  tide:      { id: 'tide',      name: 'Tidebreaker',        x: 5400,  z: 1100,  r: 660, color: 0x3a8ab0, style: 'tide', blurb: 'The currents here run faster than most boats. The Current Masters teach you to ride them.' },
  crown:     { id: 'crown',     name: 'The Sunken Crown',   x: 1300,  z: 5200,  r: 620, color: 0xd8b048, style: 'ruins', blurb: 'A drowned city. Its towers still stand in the shallows, and fish live in the throne room.' },
  abyssal:   { id: 'abyssal',   name: 'The Abyssal Reach',  x: -4500, z: 4400,  r: 700, color: 0x2a1e3a, style: 'abyss', blurb: 'The deepest water in the world. The biggest fish that are not leviathans live down there.' },
  // --- open water between the islands ---
  mid:     { id: 'mid',     name: 'Mid-Ocean',      x: 0, z: 0, r: 0, color: 0x2e6a96, band: true, blurb: 'Open blue water between the mid-ocean islands. Long swells, fast fish, schools that go on forever.' },
  outer:   { id: 'outer',   name: 'The Outer Ocean', x: 0, z: 0, r: 0, color: 0x1e4a70, band: true, blurb: 'Grey water, heavy swell, currents that do not stop. The fish out here are bigger than your boat.' },
  extreme: { id: 'extreme', name: 'Extreme Waters',  x: 0, z: 0, r: 0, color: 0x14304a, band: true, blurb: 'Hardly anyone sails this far. Storms, black water and things nobody has named.' },
  reach:   { id: 'reach',   name: "Vigil's End",    x: VIGIL.x, z: VIGIL.z, r: 700, color: 0x6a7078, style: 'reach', blurb: 'The last island before the edge of the sea. Fog, rocks and six old fishermen waiting for something.' },
};
export const REGION_LIST = Object.values(REGIONS);
const ISLAND_REGIONS = REGION_LIST.filter(R => !R.band);
/** The open-water band a distance from the bay falls in. */
export const bandAt = d => d < 1500 ? 'open' : d < 3000 ? 'mid' : d < 4500 ? 'outer' : 'extreme';

/** 0..1: how deep into the Vigil's End murk a point is. */
export function mistAt(x, z) { return 1 - smoothstep(240, 720, Math.hypot(x - VIGIL.x, z - VIGIL.z)); }

/* Islands: r = shore radius, h = peak height, rise = fraction of the radius
   it takes to climb, hill/ridge = noise amounts, slope = underwater slope.
   A negative h makes a drowned bank: shallow water, no land. */
const V = VIGIL;
export const ISLANDS = [
  // --- Driftwood Bay ---
  { id: 'driftwood', x: 0, z: 0, r: 215, h: 18, rise: 0.55, shape: 1.3, hill: 9, ridge: 0, warp: 0.16, wf: 0.006, slope: 0.1, region: 'home' },
  { id: 'gullrock', x: -275, z: 120, r: 42, h: 9, rise: 0.6, shape: 1, hill: 4, ridge: 0, warp: 0.2, wf: 0.02, slope: 0.14, region: 'home' },
  { id: 'pinekey', x: 245, z: -70, r: 38, h: 8, rise: 0.6, shape: 1, hill: 3, ridge: 0, warp: 0.2, wf: 0.02, slope: 0.14, region: 'home' },
  { id: 'hermit', x: 190, z: 340, r: 30, h: 6, rise: 0.6, shape: 1, hill: 3, ridge: 0, warp: 0.22, wf: 0.025, slope: 0.14, region: 'home' },
  { id: 'twinsA', x: -160, z: 320, r: 24, h: 5, rise: 0.6, shape: 1, hill: 2, ridge: 0, warp: 0.25, wf: 0.03, slope: 0.15, region: 'home' },
  { id: 'twinsB', x: -110, z: 355, r: 18, h: 4, rise: 0.6, shape: 1, hill: 2, ridge: 0, warp: 0.25, wf: 0.03, slope: 0.15, region: 'home' },
  // --- Frostbite ---
  { id: 'frostbite', x: 0, z: -800, r: 290, h: 78, rise: 0.75, shape: 1.6, hill: 10, ridge: 55, warp: 0.14, wf: 0.004, slope: 0.09, region: 'frost' },
  { id: 'floe1', x: 250, z: -560, r: 30, h: 7, rise: 0.5, shape: 1, hill: 2, ridge: 0, warp: 0.25, wf: 0.03, slope: 0.2, region: 'frost' },
  { id: 'floe2', x: -270, z: -590, r: 26, h: 6, rise: 0.5, shape: 1, hill: 2, ridge: 0, warp: 0.25, wf: 0.03, slope: 0.2, region: 'frost' },
  // --- Sunken Coast ---
  { id: 'coco', x: 700, z: 40, r: 72, h: 9, rise: 0.5, shape: 1.2, hill: 3, ridge: 0, warp: 0.22, wf: 0.015, slope: 0.07, region: 'tropic' },
  { id: 'palmA', x: 835, z: 185, r: 55, h: 8, rise: 0.5, shape: 1.2, hill: 3, ridge: 0, warp: 0.25, wf: 0.018, slope: 0.07, region: 'tropic' },
  { id: 'palmB', x: 905, z: 20, r: 40, h: 6, rise: 0.5, shape: 1, hill: 2, ridge: 0, warp: 0.25, wf: 0.02, slope: 0.08, region: 'tropic' },
  { id: 'palmC', x: 760, z: 270, r: 34, h: 6, rise: 0.5, shape: 1, hill: 2, ridge: 0, warp: 0.25, wf: 0.02, slope: 0.08, region: 'tropic' },
  { id: 'palmD', x: 985, z: 165, r: 30, h: 5, rise: 0.5, shape: 1, hill: 2, ridge: 0, warp: 0.25, wf: 0.02, slope: 0.08, region: 'tropic' },
  { id: 'palmE', x: 630, z: 205, r: 24, h: 4, rise: 0.5, shape: 1, hill: 1, ridge: 0, warp: 0.3, wf: 0.03, slope: 0.08, region: 'tropic' },
  { id: 'volcanet', x: 1000, z: -120, r: 46, h: 34, rise: 0.9, shape: 1.8, hill: 3, ridge: 8, warp: 0.18, wf: 0.02, slope: 0.12, region: 'tropic' },
  // --- Open Sea ---
  { id: 'lighthouse', x: -820, z: -60, r: 26, h: 12, rise: 0.4, shape: 0.8, hill: 2, ridge: 0, warp: 0.2, wf: 0.03, slope: 0.35, region: 'open' },
  { id: 'stackA', x: -1010, z: 210, r: 12, h: 18, rise: 0.2, shape: 0.6, hill: 1, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.6, region: 'open' },
  { id: 'stackB', x: -700, z: 350, r: 10, h: 14, rise: 0.2, shape: 0.6, hill: 1, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.6, region: 'open' },
  { id: 'stackC', x: -620, z: -330, r: 14, h: 16, rise: 0.25, shape: 0.6, hill: 1, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.6, region: 'open' },
  // --- Blackwater (a ring of black spires around the trench) ---
  { id: 'gate', x: -680, z: 820, r: 30, h: 10, rise: 0.4, shape: 1, hill: 2, ridge: 0, warp: 0.2, wf: 0.03, slope: 0.4, region: 'black' },
  { id: 'spire1', x: -480, z: 700, r: 16, h: 32, rise: 0.25, shape: 0.5, hill: 2, ridge: 0, warp: 0.35, wf: 0.05, slope: 0.7, region: 'black' },
  { id: 'spire2', x: -540, z: 1010, r: 18, h: 28, rise: 0.25, shape: 0.5, hill: 2, ridge: 0, warp: 0.35, wf: 0.05, slope: 0.7, region: 'black' },
  { id: 'spire3', x: -860, z: 990, r: 15, h: 36, rise: 0.25, shape: 0.5, hill: 2, ridge: 0, warp: 0.35, wf: 0.05, slope: 0.7, region: 'black' },
  { id: 'spire4', x: -900, z: 690, r: 17, h: 30, rise: 0.25, shape: 0.5, hill: 2, ridge: 0, warp: 0.35, wf: 0.05, slope: 0.7, region: 'black' },
  { id: 'spire5', x: -640, z: 580, r: 14, h: 26, rise: 0.25, shape: 0.5, hill: 2, ridge: 0, warp: 0.35, wf: 0.05, slope: 0.7, region: 'black' },
  { id: 'wreckisle', x: -560, z: 740, r: 20, h: 5, rise: 0.4, shape: 1, hill: 1, ridge: 0, warp: 0.25, wf: 0.04, slope: 0.3, region: 'black' },
  // --- Castaway Key: on no chart, alone in the deep south-east of the bay ---
  { id: 'castaway', x: 430, z: 650, r: 21, h: 4, rise: 0.55, shape: 1, hill: 1.2, ridge: 0, warp: 0.2, wf: 0.03, slope: 0.18, region: 'tropic' },

  /* ===== MID-OCEAN ===== */
  // Whispering Woods: a high forested dome with three hidden lakes in its folds
  { id: 'whisper', x: -2050, z: -1650, r: 275, h: 36, rise: 0.62, shape: 1.2, hill: 12, ridge: 9, warp: 0.18, wf: 0.005, slope: 0.1, region: 'whisper' },
  { id: 'whisperB', x: -1800, z: -1420, r: 42, h: 10, rise: 0.6, shape: 1, hill: 3, ridge: 0, warp: 0.2, wf: 0.02, slope: 0.14, region: 'whisper' },
  // Sunscar: a volcano and four ash cays
  { id: 'sunscar', x: 2450, z: -700, r: 175, h: 78, rise: 0.86, shape: 1.8, hill: 4, ridge: 12, warp: 0.16, wf: 0.008, slope: 0.12, region: 'sunscar' },
  { id: 'cinderA', x: 2690, z: -545, r: 62, h: 8, rise: 0.5, shape: 1.1, hill: 3, ridge: 0, warp: 0.22, wf: 0.02, slope: 0.08, region: 'sunscar' },
  { id: 'cinderB', x: 2290, z: -460, r: 44, h: 7, rise: 0.5, shape: 1, hill: 2, ridge: 0, warp: 0.25, wf: 0.02, slope: 0.09, region: 'sunscar' },
  { id: 'cinderC', x: 2640, z: -930, r: 50, h: 14, rise: 0.7, shape: 1.3, hill: 3, ridge: 3, warp: 0.22, wf: 0.02, slope: 0.1, region: 'sunscar' },
  { id: 'cinderD', x: 2220, z: -840, r: 34, h: 6, rise: 0.5, shape: 1, hill: 2, ridge: 0, warp: 0.25, wf: 0.03, slope: 0.1, region: 'sunscar' },
  // Skywatch: a flat-topped tower of rock with a shelf at its foot for the dock
  { id: 'skywatch', x: -2750, z: 700, r: 128, h: 94, rise: 0.1, shape: 0.5, hill: 4, ridge: 3, warp: 0.12, wf: 0.012, slope: 0.9, region: 'skywatch' },
  { id: 'skyneedle', x: -2560, z: 560, r: 13, h: 48, rise: 0.25, shape: 0.5, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.8, region: 'skywatch' },
  { id: 'skyneedle2', x: -2930, z: 860, r: 11, h: 36, rise: 0.25, shape: 0.5, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.8, region: 'skywatch' },
  // the Crystal Reef: a low ring round a lagoon (the lagoon is a LAKE that is really the sea)
  { id: 'crystal', x: 700, z: 2650, r: 205, h: 4, rise: 0.25, shape: 1, hill: 1.5, ridge: 0, warp: 0.12, wf: 0.01, slope: 0.06, region: 'crystal' },

  /* ===== OUTER ===== */
  { id: 'frostfall', x: -400, z: -3900, r: 320, h: 96, rise: 0.75, shape: 1.6, hill: 10, ridge: 60, warp: 0.14, wf: 0.004, slope: 0.09, region: 'frostfall' },
  { id: 'frostfallB', x: -40, z: -3650, r: 36, h: 8, rise: 0.5, shape: 1, hill: 2, ridge: 0, warp: 0.25, wf: 0.03, slope: 0.2, region: 'frostfall' },
  // Dreadmire: a huge, nearly flat swamp (channels are carved through it below)
  { id: 'dread', x: -3000, z: 2700, r: 330, h: 4.2, rise: 0.9, shape: 1, hill: 1.6, ridge: 0, warp: 0.22, wf: 0.006, slope: 0.05, region: 'dread' },
  { id: 'ironwreck', x: 3050, z: -2600, r: 112, h: 9, rise: 0.5, shape: 1.1, hill: 3, ridge: 0, warp: 0.25, wf: 0.015, slope: 0.08, region: 'ironwreck' },
  { id: 'ironbank', x: 3150, z: -2480, r: 230, h: -3.5, rise: 0.8, shape: 1, hill: 1, ridge: 0, warp: 0.2, wf: 0.01, slope: 0.05, region: 'ironwreck' },
  { id: 'lost', x: -4100, z: -1300, r: 240, h: 15, rise: 0.5, shape: 1.1, hill: 6, ridge: 2, warp: 0.2, wf: 0.006, slope: 0.1, region: 'lost' },

  /* ===== EXTREME ===== */
  { id: 'thunder', x: 3500, z: -4600, r: 220, h: 132, rise: 0.82, shape: 2.2, hill: 5, ridge: 30, warp: 0.16, wf: 0.008, slope: 0.12, region: 'thunder' },
  { id: 'tide', x: 5400, z: 1100, r: 112, h: 16, rise: 0.4, shape: 0.9, hill: 3, ridge: 2, warp: 0.2, wf: 0.015, slope: 0.15, region: 'tide' },
  ...Array.from({ length: 8 }, (_, i) => ({ id: 'tstack' + i, x: 5400 + Math.cos(i / 8 * Math.PI * 2 + 0.3) * 320, z: 1100 + Math.sin(i / 8 * Math.PI * 2 + 0.3) * 320, r: 13 + (i % 3) * 3, h: 22 + (i % 4) * 5, rise: 0.2, shape: 0.6, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.8, region: 'tide' })),
  { id: 'crown', x: 1300, z: 5200, r: 88, h: 10, rise: 0.5, shape: 1, hill: 2, ridge: 0, warp: 0.2, wf: 0.02, slope: 0.12, region: 'crown' },
  { id: 'crownbank', x: 1300, z: 5060, r: 330, h: -3.2, rise: 0.85, shape: 1, hill: 0.6, ridge: 0, warp: 0.15, wf: 0.008, slope: 0.05, region: 'crown' },
  { id: 'abyssal', x: -4500, z: 4400, r: 60, h: 24, rise: 0.2, shape: 0.7, hill: 3, ridge: 2, warp: 0.2, wf: 0.03, slope: 0.9, region: 'abyssal' },

  /* ===== THE EDGE: Vigil's End, a cliff-walled island with a notch cut for the landing ===== */
  { id: 'vigil', x: V.x, z: V.z, r: 82, h: 17, rise: 0.2, shape: 0.7, hill: 3, ridge: 5, warp: 0.2, wf: 0.011, slope: 0.55, region: 'reach' },
  { id: 'vstackA', x: V.x + 90, z: V.z - 80, r: 11, h: 22, rise: 0.18, shape: 0.6, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.9, region: 'reach' },
  { id: 'vstackB', x: V.x - 85, z: V.z + 80, r: 9, h: 18, rise: 0.18, shape: 0.6, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.9, region: 'reach' },
  { id: 'vstackC', x: V.x + 95, z: V.z + 95, r: 13, h: 26, rise: 0.18, shape: 0.6, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.9, region: 'reach' },
  { id: 'vstackD', x: V.x + 45, z: V.z + 145, r: 8, h: 15, rise: 0.2, shape: 0.6, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.9, region: 'reach' },
];

/* The open sea is never empty: small islets, sea stacks and sandbars are
   scattered through every ring, deterministically, well clear of the big
   islands. Some have a wreck or a cache on them (see Settlement). */
function makeIslets() {
  let s = 90210;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out = [];
  const clear = (x, z, rad) => ISLANDS.every(I => Math.hypot(x - I.x, z - I.z) > I.r + rad + (I.r > 60 ? 380 : 120)) && out.every(I => Math.hypot(x - I.x, z - I.z) > 260);
  for (let tries = 0; tries < 5000 && out.length < 110; tries++) {
    const d = 1500 + r() * 5000, a = r() * Math.PI * 2;
    const x = HOME_CENTRE.x + Math.cos(a) * d, z = HOME_CENTRE.z + Math.sin(a) * d;
    if (Math.hypot(x - V.x, z - V.z) < 900) continue;
    const kind = r();
    const I = kind < 0.45
      ? { r: 10 + r() * 22, h: 3 + r() * 9, rise: 0.55, shape: 1, hill: 2, ridge: 0, slope: 0.14, kind: 'islet' }
      : kind < 0.8
        ? { r: 6 + r() * 9, h: 12 + r() * 26, rise: 0.22, shape: 0.6, hill: 1.5, ridge: 0, slope: 0.7, kind: 'stack' }
        : { r: 30 + r() * 40, h: -1.5 - r() * 2, rise: 0.8, shape: 1, hill: 0.6, ridge: 0, slope: 0.06, kind: 'bar' };
    if (!clear(x, z, I.r)) continue;
    out.push({ id: 'islet' + out.length, x: Math.round(x), z: Math.round(z), warp: 0.25, wf: 0.03, region: null, ...I });
  }
  return out;
}
export const ISLETS = makeIslets();
ISLANDS.push(...ISLETS);

/* Lakes are carved out of land down to `depth` below sea level. They share
   the sea's water plane (y = 0) because they sit inside rims above it.
   `sea: true` is a lagoon open to the sea: salt water, normal zones.
   `zone` is the depth zone a far-off lake counts as. */
export const LAKES = [
  { id: 'mirror', name: 'Mirror Lake', x: -75, z: -45, r: 48, depth: 7, region: 'home' },
  { id: 'reed', name: 'Reed Pond', x: 88, z: -92, r: 30, depth: 4, region: 'home' },
  { id: 'frozen', name: 'Frostbite Lake', x: 0, z: -700, r: 95, depth: 14, region: 'frost', ice: true },
  // Whispering Woods: three lakes hidden in the forest
  { id: 'hollow', name: 'Hollow Mere', x: -2120, z: -1720, r: 40, depth: 9, region: 'whisper', zone: 5 },
  { id: 'moonpool', name: 'The Moonpool', x: -1975, z: -1600, r: 30, depth: 12, region: 'whisper', zone: 5 },
  { id: 'deeproot', name: 'Deeproot Tarn', x: -2170, z: -1560, r: 26, depth: 6, region: 'whisper', zone: 5 },
  // the Crystal Reef lagoon, open to the sea through a cut in the ring
  { id: 'lagoon', name: 'The Crystal Lagoon', x: 700, z: 2650, r: 150, depth: 7, region: 'crystal', sea: true },
  // Frostfall's glacier lake
  { id: 'glacier', name: 'Glacier Lake', x: -400, z: -3800, r: 105, depth: 18, region: 'frostfall', ice: true, zone: 6 },
  // Dreadmire's black pool at the heart of the channels
  { id: 'mirepool', name: 'The Mirepool', x: -2950, z: 2650, r: 70, depth: 7, region: 'dread', sea: true },
];

/* Flat pads, blended into the land (settlements, outposts). */
export const PADS = [
  { id: 'village', x: 25, z: 150, r: 62, y: 1.5 },
  { id: 'guildyard', x: -40, z: 128, r: 30, y: 2.2 },
  { id: 'frostcamp', x: 44, z: -520, r: 22, y: 1.4 },
  { id: 'lakecamp', x: 55, z: -612, r: 14, y: 1.0 },
  { id: 'tiki', x: 690, z: 90, r: 22, y: 1.2 },
  { id: 'lightyard', x: -820, z: -60, r: 9, y: 11 },
  // your home on the south-east waterfront: the hut, Pim's stall and the dock
  { id: 'homecove', x: 128, z: 156, r: 26, y: 1.45 },
  // Vigil's End: the landing, a terrace half way up, the hut on the cliff top
  { id: 'vlanding', x: V.x - 60, z: V.z - 55, r: 26, y: 1.3 },
  { id: 'vterrace', x: V.x - 40, z: V.z - 37, r: 17, y: 7.5 },
  { id: 'vhut', x: V.x - 19, z: V.z - 20, r: 16, y: 14.5 },
  // the new islands' settlements
  { id: 'whisperCamp', x: -2010, z: -1400, r: 24, y: 1.6 },
  { id: 'sunscarTown', x: 2700, z: -535, r: 24, y: 1.5 },
  { id: 'skydock', x: -2750, z: 842, r: 16, y: 1.3 },
  { id: 'skytop', x: -2750, z: 700, r: 70, y: 93 },
  { id: 'crystalCamp', x: 877, z: 2650, r: 18, y: 1.4 },
  { id: 'frostfallCamp', x: -370, z: -3610, r: 24, y: 1.5 },
  { id: 'dreadStilts', x: -2862, z: 2640, r: 12, y: 1.2 },
  { id: 'ironDock', x: 3010, z: -2510, r: 26, y: 1.5 },
  { id: 'lostVillage', x: -3960, z: -1225, r: 38, y: 2.0 },
  { id: 'thunderCamp', x: 3345, z: -4430, r: 20, y: 1.6 },
  { id: 'tideDock', x: 5320, z: 1180, r: 24, y: 1.5 },
  { id: 'crownDock', x: 1300, z: 5120, r: 20, y: 1.4 },
  { id: 'abyssLight', x: -4500, z: 4400, r: 16, y: 20 },
];

/* Channels: carved strips of water (x0,z0 -> x1,z1, width, bed depth). */
export const CHANNELS = [
  // the frozen lake drains south through a narrow inlet to the landing beach
  { a: [0, -608], b: [8, -520], w: 18, depth: -3, ice: true },
  // Mirror Lake drains west to the sea as a little river
  { a: [-118, -40], b: [-215, -8], w: 11, depth: -2.5 },
  // the cut through the Crystal Reef into the lagoon
  { a: [700, 2780], b: [705, 2890], w: 20, depth: -4.5 },
  // Dreadmire: channels you can take a boat through, all meeting at the Mirepool
  { a: [-3370, 2720], b: [-3150, 2735], w: 16, depth: -3.2 },
  { a: [-3150, 2735], b: [-2990, 2660], w: 15, depth: -3.2 },
  { a: [-2910, 2640], b: [-2800, 2760], w: 14, depth: -3 },
  { a: [-2800, 2760], b: [-2640, 2700], w: 14, depth: -3 },
  { a: [-2960, 2600], b: [-3010, 2470], w: 13, depth: -3 },
  { a: [-3010, 2470], b: [-2990, 2350], w: 13, depth: -3 },
  { a: [-2930, 2700], b: [-2950, 2880], w: 12, depth: -2.8 },
  { a: [-2950, 2880], b: [-3060, 3040], w: 12, depth: -2.8 },
];

/* Dirt paths (painted, and cleared of trees). */
export const PATHS = [
  { w: 3.4, pts: [[25, 150], [-10, 120], [-40, 60], [-60, 0], [-70, -10]] },   // village -> Mirror Lake
  { w: 3.0, pts: [[25, 150], [60, 100], [85, 40], [88, -60]] },                 // village -> Reed Pond
  { w: 3.2, pts: [[25, 150], [-40, 128]] },                                    // to the guild hall
  { w: 3.2, pts: [[25, 150], [70, 150], [104, 156], [124, 158]] },           // down to your hut on the cove
  { w: 2.6, pts: [[124, 158], [130, 172]] },                                   // hut -> your dock
  { w: 2.2, pts: [[V.x - 60, V.z - 55], [V.x - 40, V.z - 37], [V.x - 19, V.z - 20], [V.x - 3, V.z - 1]] },   // Vigil's End: landing -> cliff top
  { w: 3.0, pts: [[44, -520], [52, -565], [55, -612]] },                         // frost beach -> lake camp
  { w: 2.6, pts: [[690, 90], [700, 40], [690, 0]] },
  // Whispering Woods: from the camp up into the forest, past all three lakes
  { w: 2.6, pts: [[-2010, -1400], [-2000, -1480], [-1985, -1560], [-2040, -1640], [-2080, -1690]] },
  { w: 2.2, pts: [[-2040, -1640], [-2130, -1590], [-2160, -1570]] },
  { w: 3.0, pts: [[-370, -3610], [-385, -3680], [-395, -3710]] },               // Frostfall camp -> glacier lake
  { w: 3.0, pts: [[-3960, -1225], [-4010, -1260], [-4060, -1300], [-4120, -1330]] },   // Lost Shores village street
  { w: 2.6, pts: [[3010, -2510], [3040, -2560], [3060, -2600]] },
  { w: 2.4, pts: [[5320, 1180], [5370, 1130], [5400, 1100]] },
];

/* Named spots inside a region where particular fish live: the ruins of the
   Sunken Crown, the lightning water under Thunderpeak, the vents off
   Sunscar... A fish with `spot` only bites inside that circle. */
export const FISH_SPOTS = [
  { id: 'throne', name: 'the throne room of the Sunken Crown', x: 1300, z: 5000, r: 90, region: 'crown' },
  { id: 'ruins', name: 'the drowned streets of the Sunken Crown', x: 1300, z: 5040, r: 300, region: 'crown' },
  { id: 'vents', name: 'the hot vents off Sunscar', x: 2450, z: -700, r: 330, region: 'sunscar' },
  { id: 'wrecks', name: 'the wreck field of Ironwreck', x: 3150, z: -2480, r: 330, region: 'ironwreck' },
  { id: 'cliffs', name: 'the foot of the Skywatch cliffs', x: -2750, z: 700, r: 260, region: 'skywatch' },
  { id: 'lagoon', name: 'the Crystal Lagoon', x: 700, z: 2650, r: 150, region: 'crystal' },
  { id: 'rip', name: 'the rip between the Tidebreaker stacks', x: 5400, z: 1100, r: 420, region: 'tide' },
  { id: 'trench', name: 'the Abyssal Trench', x: -4680, z: 4580, r: 520, region: 'abyssal' },
  { id: 'mire', name: 'the Dreadmire channels', x: -2980, z: 2680, r: 380, region: 'dread' },
  { id: 'lostbay', name: 'the bay of the Lost Shores', x: -3900, z: -1150, r: 260, region: 'lost' },
];
export function spotAt(x, z) {
  let best = null;
  for (const S of FISH_SPOTS) if (Math.hypot(x - S.x, z - S.z) < S.r && (!best || S.r < best.r)) best = S;
  return best;
}
/** Is a point inside a named spot (a small spot sits inside a big one: both count)? */
export function inSpot(id, x, z) { const S = FISH_SPOTS.find(q => q.id === id); return !!S && Math.hypot(x - S.x, z - S.z) < S.r; }

/* ---------------- regions ---------------- */

/** Region weights at a point, each 0..1 (not normalised). */
export function regionWeights(x, z) {
  const w = {};
  let others = 0;
  for (const R of ISLAND_REGIONS) {
    const d = Math.hypot(x - R.x, z - R.z);
    const v = d > R.r ? 0 : 1 - smoothstep(R.r * 0.55, R.r, d);
    w[R.id] = v;
    if (v > others) others = v;
  }
  const rest = clamp(1 - others, 0, 1);
  const band = bandAt(distHome(x, z));
  w.open = 0; w.mid = 0; w.outer = 0; w.extreme = 0;
  if (band === 'open') w.open = rest * (0.6 + 0.4 * smoothstep(-300, -700, x));
  else w[band] = rest;
  return w;
}

export function regionAt(x, z) {
  const w = regionWeights(x, z);
  let best = bandAt(distHome(x, z)), bv = -1;
  for (const k in w) if (w[k] > bv) { bv = w[k]; best = k; }
  return best;
}
/** The terrain style at a point: the style of the strongest island region, if any. */
export function styleWeights(x, z) {
  const w = regionWeights(x, z), s = {};
  for (const k in w) { const st = REGIONS[k].style; if (st && w[k] > (s[st] || 0)) s[st] = w[k]; }
  return s;
}

/* ---------------- weather that belongs to a place ----------------
   Some places are always rough: Thunderpeak storms all day, the approach to
   Vigil's End is grey and wild, and the rim of the world is the worst of
   all. These are 0..1 fields; the game mixes them with the passing storms. */
export const STORM_SPOTS = [
  { x: 3500, z: -4600, r0: 450, r1: 1150, s: 1.0 },          // Thunderpeak
  { x: V.x, z: V.z, r0: 500, r1: 1400, s: 0.75 },              // Vigil's End
  { x: 5400, z: 1100, r0: 300, r1: 900, s: 0.35 },             // Tidebreaker's spray
];
export function stormAt(x, z) {
  let s = 0.35 * smoothstep(WORLD.edge - 900, WORLD.edge, distHome(x, z)) + 0.12 * smoothstep(4500, 6500, distHome(x, z));
  for (const S of STORM_SPOTS) s = Math.max(s, S.s * (1 - smoothstep(S.r0, S.r1, Math.hypot(x - S.x, z - S.z))));
  return clamp(s, 0, 1);
}
/* Fog that belongs to a place (0..1). */
export const FOG_SPOTS = [
  { x: -4100, z: -1300, r0: 300, r1: 800, s: 0.85 },           // the Lost Shores never clear
  { x: -3000, z: 2700, r0: 250, r1: 750, s: 0.75 },            // Dreadmire
  { x: -2050, z: -1650, r0: 120, r1: 420, s: 0.35 },           // the woods at dusk
];
export function fogAt(x, z) {
  let f = Math.max(mistAt(x, z), 0.5 * smoothstep(WORLD.edge - 700, WORLD.edge, distHome(x, z)));
  for (const S of FOG_SPOTS) f = Math.max(f, S.s * (1 - smoothstep(S.r0, S.r1, Math.hypot(x - S.x, z - S.z))));
  return clamp(f, 0, 1);
}
/* How dark the water and the sky are here (0..1), before any storm. */
export function gloomAt(x, z) {
  const d = distHome(x, z);
  let g = 0.18 * smoothstep(3000, 6500, d);
  g = Math.max(g, 0.7 * (1 - smoothstep(350, 900, Math.hypot(x + 4600, z - 4500))));   // the Abyssal Reach
  return g;
}

/* ---------------- waves (generated into Water.js GLSL - keep the formula in one place) ----------------
   WAVE_SPOTS add swell round a point: a * (1 - smoothstep(r0, r1, distance)). */
export const WAVE_SPOTS = [
  { x: -680, z: 820, r0: 250, r1: 440, a: 0.45 },       // the Blackwater
  { x: 800, z: 120, r0: 200, r1: 420, a: 0.12 },        // the Sunken Coast chop
  { x: V.x, z: V.z, r0: 170, r1: 900, a: 1.7 },         // Vigil's End: the biggest swell there is
  { x: 3500, z: -4600, r0: 300, r1: 950, a: 1.35 },     // Thunderpeak
  { x: 5400, z: 1100, r0: 250, r1: 700, a: 0.9 },       // Tidebreaker
  { x: -4600, z: 4500, r0: 300, r1: 900, a: 0.8 },      // the Abyssal Reach
  { x: -2750, z: 700, r0: 150, r1: 520, a: 0.45 },      // round Skywatch
];

/* The lee of every far island: waves die down within r0 of its middle and
   are back to full strength by r1. (Mirrored in the water shader.) */
export const SHELTERS = ISLANDS.filter(I => I.region && I.r >= 60 && I.h > 0 && Math.hypot(I.x, I.z) > 1500)
  .map(I => ({ x: I.x, z: I.z, r0: I.r + 20, r1: I.r + 170 }));

/** Base swell amplitude at a point before storms. */
export function waveAmp(x, z) {
  const dHome = Math.hypot(x, z - 60);
  let a = 0.16 + 0.22 * smoothstep(230, 700, dHome);
  // the Open Sea: the big western swell, calmer round the Blackwater
  a += 1.15 * smoothstep(-380, -820, x) * (1 - smoothstep(560, 760, Math.hypot(x + 680, z - 820)) * 0.4) * (1 - smoothstep(1600, 2600, dHome));
  // and it only gets bigger the farther out you sail
  a += 0.55 * smoothstep(1500, 3000, dHome) + 0.5 * smoothstep(3000, 4600, dHome) + 0.55 * smoothstep(4600, 6500, dHome);
  for (const S of WAVE_SPOTS) a += S.a * (1 - smoothstep(S.r0, S.r1, Math.hypot(x - S.x, z - S.z)));
  // the rim of the world: a wall of water
  a += 2.4 * smoothstep(WORLD.edge - 500, WORLD.edge, dHome);
  // close in under a big island the sea is sheltered, so the docks are usable
  for (const S of SHELTERS) a *= 0.32 + 0.68 * smoothstep(S.r0, S.r1, Math.hypot(x - S.x, z - S.z));
  // lakes are nearly still, the frozen ones entirely; a lagoon is calmer
  for (const L of LAKES) {
    const d = Math.hypot(x - L.x, z - L.z);
    const lo = L.ice ? 0 : L.sea ? 0.55 : 0.3;
    a *= lo + (1 - lo) * smoothstep(L.r * 0.8, L.r * 1.5, d);
  }
  return a;
}

/**
 * Sea surface height. `storm` multiplies amplitude (1 calm, ~2.6 in a storm),
 * `wp` is an optional whirlpool {x,z,r,s}.
 */
export function waveHeight(x, z, t, storm = 1, wp = null) {
  const a = waveAmp(x, z) * storm;
  let h = a * (
    0.55 * Math.sin(0.071 * x + 0.052 * z + 1.10 * t) +
    0.30 * Math.sin(-0.043 * x + 0.110 * z + 1.63 * t + 1.7) +
    0.15 * Math.sin(0.190 * x - 0.130 * z + 2.40 * t + 0.5)
  );
  h += 0.035 * Math.sin(0.61 * x + 0.43 * z + 3.1 * t) * Math.min(1, a * 3);
  h += 0.06 * Math.sin(0.33 * x - 0.27 * z + 2.7 * t) * Math.min(1, a * 4);
  if (wp && wp.s > 0) {
    const d = Math.hypot(x - wp.x, z - wp.z);
    if (d < wp.r) {
      const f = 1 - d / wp.r;
      h -= wp.s * f * f * 6.0;
    }
  }
  return h;
}

/* ---------------- currents (the water itself moves) ----------------
   A slow clockwise gyre round the bay that meanders as it goes, gets
   stronger the farther out you are, and races through a few named places.
   Shallow water, lakes and the harbour are calm. A boat nobody is driving
   drifts with it - backwards, forwards, sideways, wherever the sea is going -
   and only the anchor holds it. Speeds are metres per second. */
export const CURRENT_SPOTS = [
  // the trench pulls the water round in a slow spiral
  { x: -680, z: 820, r: 330, s: 0.7, swirl: 1 },
  // Tidebreaker: the fastest water in the world, round and round the stacks, and a rip through the middle
  { x: 5400, z: 1100, r: 700, s: 4.2, swirl: 1 },
  { x: 5400, z: 1100, r: 380, s: 3.2, dir: [0.8, -0.6] },
  // Vigil's End and the rim: the sea pulls away from the edge of the world
  { x: V.x, z: V.z, r: 900, s: 2.2, swirl: -1 },
  // the Abyssal Reach: water drawn round the trench
  { x: -4680, z: 4580, r: 800, s: 1.8, swirl: 1 },
  // Sunscar's warm outflow and Ironwreck's wreck-rips
  { x: 2450, z: -700, r: 500, s: 0.9, dir: [0.7, 0.7] },
  { x: 3150, z: -2480, r: 420, s: 1.1, swirl: -1 },
  // Dreadmire barely moves
];
const _cur = { x: 0, z: 0, s: 0 };
/** Current at a point. `depth` is metres of water below the surface (0 or less = none). */
export function currentAt(x, z, t = 0, depth = 30, out = _cur) {
  out.x = 0; out.z = 0; out.s = 0;
  if (depth <= 0.3) return out;
  for (const L of LAKES) if (!L.sea && Math.hypot(x - L.x, z - L.z) < L.r * 1.6) return out;
  const dx = x - HOME_CENTRE.x, dz = z - HOME_CENTRE.z;
  const d = Math.hypot(dx, dz) || 1;
  // clockwise round the bay, bent by two slow meanders and a wandering tide
  let a = Math.atan2(dz, dx) + Math.PI / 2;
  a += 1.15 * Math.sin(x * 0.0017 + z * 0.0011 + 0.7) + 0.75 * Math.sin(-x * 0.0008 + z * 0.0023 + 2.1) + 0.5 * Math.sin(t * 0.006 + d * 0.0009);
  let s = 0.24 + 0.6 * smoothstep(240, 1100, d) + 0.8 * smoothstep(1500, 3200, d) + 0.9 * smoothstep(3600, 6200, d);
  s *= 0.8 + 0.2 * Math.sin(t * 0.021 + x * 0.0013);
  let vx = Math.cos(a) * s, vz = Math.sin(a) * s;
  for (const C of CURRENT_SPOTS) {
    const cx = x - C.x, cz = z - C.z, cd = Math.hypot(cx, cz);
    if (cd > C.r) continue;
    const f = 1 - smoothstep(C.r * 0.35, C.r, cd);
    if (C.swirl) { const l = cd || 1; vx += -cz / l * C.s * f * C.swirl; vz += cx / l * C.s * f * C.swirl; }
    if (C.dir) { vx += C.dir[0] * C.s * f; vz += C.dir[1] * C.s * f; }
  }
  // Dreadmire's channels are still water
  const mire = 1 - 0.85 * (1 - smoothstep(250, 450, Math.hypot(x + 3000, z - 2700)));
  // the harbour and the shallows are calm
  const k = smoothstep(0.5, 9, depth) * smoothstep(80, 220, Math.hypot(x - 60, z - 160)) * mire;
  out.x = vx * k; out.z = vz * k; out.s = Math.hypot(out.x, out.z);
  return out;
}

/** The whole-map list of named places for the map screen. `island` links a
    place to the island whose discovery reveals it. */
export const PLACES = [
  { name: 'Driftwood Bay', x: 20, z: 160, kind: 'town' },
  { name: 'Mirror Lake', x: -75, z: -45, kind: 'lake' },
  { name: 'Reed Pond', x: 88, z: -92, kind: 'lake' },
  { name: 'Gull Rock', x: -275, z: 120, kind: 'isle' },
  { name: 'Pine Key', x: 245, z: -70, kind: 'isle' },
  { name: 'Frostbite Lake', x: 0, z: -700, kind: 'lake' },
  { name: 'Ingrid\'s Landing', x: 44, z: -520, kind: 'town' },
  { name: 'Sunken Coast', x: 800, z: 120, kind: 'region' },
  { name: 'Coco\'s Hut', x: 690, z: 90, kind: 'town' },
  { name: 'Mount Smoulder', x: 1000, z: -120, kind: 'isle' },
  { name: 'Old Lighthouse', x: -820, z: -60, kind: 'isle' },
  { name: 'The Drowned Gate', x: -680, z: 820, kind: 'mystery' },
  { name: 'Your Hut', x: 128, z: 150, kind: 'town' },
  { name: 'Whispering Woods', x: -2050, z: -1650, kind: 'region' },
  { name: 'Woodsmoke Camp', x: -2010, z: -1400, kind: 'town' },
  { name: 'Hollow Mere', x: -2120, z: -1720, kind: 'lake' },
  { name: 'The Moonpool', x: -1975, z: -1600, kind: 'lake' },
  { name: 'Deeproot Tarn', x: -2170, z: -1560, kind: 'lake' },
  { name: 'Sunscar Archipelago', x: 2450, z: -700, kind: 'region' },
  { name: 'Emberhaven', x: 2700, z: -535, kind: 'town' },
  { name: 'Skywatch Isle', x: -2750, z: 700, kind: 'region' },
  { name: 'The Eyrie', x: -2750, z: 690, kind: 'town' },
  { name: 'The Crystal Reef', x: 700, z: 2650, kind: 'region' },
  { name: 'Glasswater Camp', x: 877, z: 2650, kind: 'town' },
  { name: 'Frostfall', x: -400, z: -3900, kind: 'region' },
  { name: 'Glacier Lake', x: -400, z: -3800, kind: 'lake' },
  { name: 'Rime Camp', x: -370, z: -3610, kind: 'town' },
  { name: 'Dreadmire', x: -3000, z: 2700, kind: 'region' },
  { name: 'The Mirepool', x: -2950, z: 2650, kind: 'lake' },
  { name: 'Ironwreck', x: 3050, z: -2600, kind: 'region' },
  { name: 'Salvage Town', x: 3010, z: -2510, kind: 'town' },
  { name: 'The Lost Shores', x: -4100, z: -1300, kind: 'mystery' },
  { name: 'Thunderpeak', x: 3500, z: -4600, kind: 'region' },
  { name: 'Stormwatch Station', x: 3345, z: -4430, kind: 'town' },
  { name: 'Tidebreaker', x: 5400, z: 1100, kind: 'region' },
  { name: 'The Current Masters', x: 5320, z: 1180, kind: 'town' },
  { name: 'The Sunken Crown', x: 1300, z: 5200, kind: 'mystery' },
  { name: 'The Abyssal Reach', x: -4500, z: 4400, kind: 'mystery' },
  { name: "Vigil's End", x: V.x, z: V.z, kind: 'mystery' },
];

/* ---------------- depth zones: the farther out, the crazier it gets ----------------
   Distance from Driftwood Bay decides the zone, and very deep water adds
   one more near home. The zone scales what bites, how big it grows, what
   it is worth and how often something strange turns up - and the world
   shows it: ring buoys mark each boundary, the sea darkens and the swell
   grows. */
export const ZONES = [
  { id: 0, name: 'Driftwood Shallows', short: 'Shallows', r: 0, color: 0x6ac86a, css: '#7fd07a', value: 1.0, size: 0.0, variant: 0.03, blurb: 'Easy fish, easy water. A good place to learn.' },
  { id: 1, name: 'Coastal Waters', short: 'Coastal', r: 270, color: 0xf2d24a, css: '#f2d24a', value: 1.4, size: 0.12, variant: 0.06, blurb: 'Bigger fish and the first strange ones. A reinforced rod helps.' },
  { id: 2, name: 'Offshore', short: 'Offshore', r: 540, color: 0xf08a2a, css: '#f08a2a', value: 1.9, size: 0.25, variant: 0.10, blurb: 'Rare fish, rough swell, things that fight back. Bring a boat.' },
  { id: 3, name: 'Deep Water', short: 'Deep', r: 820, color: 0xe0402a, css: '#ff6a4a', value: 2.7, size: 0.42, variant: 0.16, blurb: 'Massive fish and giant predators. Heavy rods and strong hulls only.' },
  { id: 4, name: 'The Abyss', short: 'Abyss', r: 1080, color: 0x9a4ae0, css: '#c07af0', value: 4.0, size: 0.65, variant: 0.24, blurb: 'Nothing down here is normal. Leviathan country.' },
  { id: 5, name: 'Mid-Ocean', short: 'Mid-Ocean', r: 1700, color: 0x3ab0e0, css: '#5ac8f0', value: 5.0, size: 0.8, variant: 0.27, blurb: 'Blue water to every horizon. Long swells, big schools and the first of the far islands.' },
  { id: 6, name: 'Outer Ocean', short: 'Outer', r: 3000, color: 0x3a6ae0, css: '#6a8af8', value: 6.5, size: 0.95, variant: 0.31, blurb: 'Heavy swell, strong currents, darker water. Anchor well and bring a real boat.' },
  { id: 7, name: 'Extreme Waters', short: 'Extreme', r: 4500, color: 0xe03a8a, css: '#f06ab0', value: 8.5, size: 1.1, variant: 0.35, blurb: 'Storms that do not end and fish nobody has named. Only the best boats come back.' },
  { id: 8, name: "The World's Edge", short: 'Edge', r: 6500, color: 0xf0f0f0, css: '#ffffff', value: 11, size: 1.3, variant: 0.4, blurb: 'The last water there is. Past this, the sea stands up into a wall of fog.' },
];
export const MAX_ZONE = ZONES.length - 1;

/** Zone index at a point. Lakes near home are always the shallows. */
export function zoneAt(x, z, depth = 0) {
  for (const L of LAKES) if (!L.ice && !L.sea && Math.hypot(x - L.x, z - L.z) < L.r * 1.2) return L.zone || 0;
  const d = Math.hypot(x - HOME_CENTRE.x, z - HOME_CENTRE.z);
  let zi = 0;
  for (const Z of ZONES) if (d >= Z.r) zi = Z.id;
  if (depth > 70 && zi < 4) zi++;
  // the Blackwater is always the abyss
  if (Math.hypot(x + 680, z - 820) < 300) zi = 4;
  // and the Abyssal Trench is as deep as the world goes
  if (Math.hypot(x + 4680, z - 4580) < 520) zi = Math.max(zi, 8);
  return zi;
}
