/* MapData.js - the geography of Driftwood Bay and the waters around it.
   Everything here is DATA: islands, lakes, pads, paths and the five regions.
   Terrain.js turns it into a height function; Water.js and the boat read the
   same wave formula (waveAmp / waveHeight), mirrored in GLSL, so a boat
   floats on exactly the surface that is drawn.

   Layout (metres, +x east, +z south):
     Driftwood Bay   home island at the centre, settlement on its south shore
     Frostbite Lake  mountain island far north, frozen lake inside
     Sunken Coast    tropical archipelago to the east, wrecks in the shallows
     The Open Sea    everything west - big swell, few rocks, a lighthouse
     The Blackwater  deep trench to the south-west ringed by black spires */

import { smoothstep, clamp } from '../core/Util.js?v=1790192871';

export const WORLD = {
  half: 1300,          // playable half-extent
  seaFloor: -30,
  seed: 7127,
};

export const REGIONS = {
  home:   { id: 'home',   name: 'Driftwood Bay',  x: 0,    z: 0,    r: 430, color: 0x5d9e4a, blurb: 'Small lakes, dense forest and the only pub for a hundred miles.' },
  frost:  { id: 'frost',  name: 'Frostbite Lake', x: 0,    z: -780, r: 430, color: 0xcfe4ee, blurb: 'Frozen mountains. Ice fishing. Something moves under the ice.' },
  tropic: { id: 'tropic', name: 'Sunken Coast',   x: 800,  z: 120,  r: 400, color: 0xf0c872, blurb: 'Tropical islands, old shipwrecks and very strange fish.' },
  open:   { id: 'open',   name: 'The Open Sea',   x: -850, z: -60,  r: 520, color: 0x3f7fa6, blurb: 'Huge waves, huge fish and storms. Bring a better boat.' },
  black:  { id: 'black',  name: 'The Blackwater', x: -680, z: 820,  r: 440, color: 0x1e2430, blurb: 'Extremely deep. Almost no light. Something enormous lives down there.' },
  reach:  { id: 'reach',  name: "Vigil's End",    x: 1015, z: 1005, r: 420, color: 0x6a7078, blurb: 'The last island before the edge of the sea. Fog, rocks and six old fishermen waiting for something.' },
};
/* Vigil's End: the farthest island in the playable sea. Everything about the
   approach - the fog, the colour draining out of the sky, the rock field, the
   heavier swell - is keyed off the distance to this point. */
export const VIGIL = { x: 1015, z: 1005 };
/** 0..1: how deep into the Vigil's End murk a point is. */
export function mistAt(x, z) { return 1 - smoothstep(240, 720, Math.hypot(x - VIGIL.x, z - VIGIL.z)); }
export const REGION_LIST = Object.values(REGIONS);

/* Islands: r = shore radius, h = peak height, rise = fraction of the radius
   it takes to climb, hill/ridge = noise amounts, slope = underwater slope. */
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
  // --- Vigil's End: a cliff-walled island with a notch cut for the landing ---
  { id: 'vigil', x: 1015, z: 1005, r: 82, h: 17, rise: 0.2, shape: 0.7, hill: 3, ridge: 5, warp: 0.2, wf: 0.011, slope: 0.55, region: 'reach' },
  { id: 'vstackA', x: 1105, z: 925, r: 11, h: 22, rise: 0.18, shape: 0.6, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.9, region: 'reach' },
  { id: 'vstackB', x: 930, z: 1085, r: 9, h: 18, rise: 0.18, shape: 0.6, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.9, region: 'reach' },
  { id: 'vstackC', x: 1110, z: 1100, r: 13, h: 26, rise: 0.18, shape: 0.6, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.9, region: 'reach' },
  { id: 'vstackD', x: 1060, z: 1150, r: 8, h: 15, rise: 0.2, shape: 0.6, hill: 2, ridge: 0, warp: 0.3, wf: 0.05, slope: 0.9, region: 'reach' },
];

/* Lakes are carved out of land down to `depth` below sea level. They share
   the sea's water plane (y = 0) because they sit inside rims above it. */
export const LAKES = [
  { id: 'mirror', name: 'Mirror Lake', x: -75, z: -45, r: 48, depth: 7, region: 'home' },
  { id: 'reed', name: 'Reed Pond', x: 88, z: -92, r: 30, depth: 4, region: 'home' },
  { id: 'frozen', name: 'Frostbite Lake', x: 0, z: -700, r: 95, depth: 14, region: 'frost', ice: true },
];

/* Flat pads, blended into the land (settlement, outposts). */
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
  { id: 'vlanding', x: 955, z: 950, r: 26, y: 1.3 },
  { id: 'vterrace', x: 975, z: 968, r: 17, y: 7.5 },
  { id: 'vhut', x: 996, z: 985, r: 16, y: 14.5 },
];

/* Channels: carved strips of water (x0,z0 -> x1,z1, width, bed depth). */
export const CHANNELS = [
  // the frozen lake drains south through a narrow inlet to the landing beach
  { a: [0, -608], b: [8, -520], w: 18, depth: -3, ice: true },
  // Mirror Lake drains west to the sea as a little river
  { a: [-118, -40], b: [-215, -8], w: 11, depth: -2.5 },
];

/* Dirt paths (painted, and cleared of trees). */
export const PATHS = [
  { w: 3.4, pts: [[25, 150], [-10, 120], [-40, 60], [-60, 0], [-70, -10]] },   // village -> Mirror Lake
  { w: 3.0, pts: [[25, 150], [60, 100], [85, 40], [88, -60]] },                 // village -> Reed Pond
  { w: 3.2, pts: [[25, 150], [-40, 128]] },                                    // to the guild hall
  { w: 3.2, pts: [[25, 150], [70, 150], [104, 156], [124, 158]] },           // down to your hut on the cove
  { w: 2.6, pts: [[124, 158], [130, 172]] },                                   // hut -> your dock
  { w: 2.2, pts: [[955, 950], [975, 968], [996, 985], [1012, 1004]] },         // Vigil's End: landing -> cliff top
  { w: 3.0, pts: [[44, -520], [52, -565], [55, -612]] },                         // frost beach -> lake camp
  { w: 2.6, pts: [[690, 90], [700, 40], [690, 0]] },
];

/* ---------------- regions ---------------- */

/** Region weights at a point, each 0..1 (not normalised). */
export function regionWeights(x, z) {
  const w = {};
  for (const R of REGION_LIST) {
    if (R.id === 'open') continue;
    const d = Math.hypot(x - R.x, z - R.z);
    w[R.id] = 1 - smoothstep(R.r * 0.55, R.r, d);
  }
  const others = Math.max(w.home, w.frost, w.tropic, w.black, w.reach);
  w.open = clamp(1 - others, 0, 1) * (0.6 + 0.4 * smoothstep(-300, -700, x));
  return w;
}

export function regionAt(x, z) {
  const w = regionWeights(x, z);
  let best = 'open', bv = -1;
  for (const k in w) if (w[k] > bv) { bv = w[k]; best = k; }
  if (Math.abs(x) > WORLD.half - 60 || Math.abs(z) > WORLD.half - 60) return 'open';
  return best;
}

/* ---------------- waves (mirrored in Water.js GLSL - keep in sync) ---------------- */

/** Base swell amplitude at a point before storms. */
export function waveAmp(x, z) {
  const dHome = Math.hypot(x, z - 60);
  let a = 0.16 + 0.22 * smoothstep(230, 700, dHome);
  a += 1.15 * smoothstep(-380, -820, x) * (1 - smoothstep(560, 760, Math.hypot(x + 680, z - 820)) * 0.4);
  a += 0.45 * (1 - smoothstep(250, 440, Math.hypot(x + 680, z - 820)));
  a += 0.12 * (1 - smoothstep(200, 420, Math.hypot(x - 800, z - 120)));
  // the swell gets heavy around Vigil's End: a rowboat will not make it
  a += 0.5 * (1 - smoothstep(170, 540, Math.hypot(x - 1015, z - 1005)));
  const edge = Math.max(Math.abs(x), Math.abs(z));
  a += 1.4 * smoothstep(WORLD.half - 250, WORLD.half, edge);
  // lakes are nearly still, the frozen lake entirely
  for (const L of LAKES) {
    const d = Math.hypot(x - L.x, z - L.z);
    const lo = L.ice ? 0 : 0.3;
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

/** The whole-map list of named places for the map screen. */
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
  { name: "Vigil's End", x: 1015, z: 1005, kind: 'mystery' },
];

/* ---------------- depth zones: the farther out, the crazier it gets ----------------
   Distance from Driftwood Bay decides the zone, and very deep water adds
   one more. The zone scales what bites, how big it grows, what it is
   worth and how often something strange turns up - and the world shows it:
   ring buoys mark each boundary, the sea darkens and the swell grows. */
export const ZONES = [
  { id: 0, name: 'Driftwood Shallows', short: 'Shallows', r: 0, color: 0x6ac86a, css: '#7fd07a', value: 1.0, size: 0.0, variant: 0.03, blurb: 'Easy fish, easy water. A good place to learn.' },
  { id: 1, name: 'Coastal Waters', short: 'Coastal', r: 270, color: 0xf2d24a, css: '#f2d24a', value: 1.4, size: 0.12, variant: 0.06, blurb: 'Bigger fish and the first strange ones. A reinforced rod helps.' },
  { id: 2, name: 'Offshore', short: 'Offshore', r: 540, color: 0xf08a2a, css: '#f08a2a', value: 1.9, size: 0.25, variant: 0.10, blurb: 'Rare fish, rough swell, things that fight back. Bring a boat.' },
  { id: 3, name: 'Deep Water', short: 'Deep', r: 820, color: 0xe0402a, css: '#ff6a4a', value: 2.7, size: 0.42, variant: 0.16, blurb: 'Massive fish and giant predators. Heavy rods and strong hulls only.' },
  { id: 4, name: 'The Abyss', short: 'Abyss', r: 1080, color: 0x9a4ae0, css: '#c07af0', value: 4.0, size: 0.65, variant: 0.24, blurb: 'Nothing down here is normal. Leviathan country.' },
];
export const HOME_CENTRE = { x: 0, z: 80 };

/** Zone index 0..4 at a point. Lakes are always the shallows. */
export function zoneAt(x, z, depth = 0) {
  for (const L of LAKES) if (!L.ice && Math.hypot(x - L.x, z - L.z) < L.r * 1.2) return 0;
  const d = Math.hypot(x - HOME_CENTRE.x, z - HOME_CENTRE.z);
  let zi = 0;
  for (const Z of ZONES) if (d >= Z.r) zi = Z.id;
  if (depth > 70 && zi < 4) zi++;
  // the Blackwater is always the abyss
  if (Math.hypot(x + 680, z - 820) < 300) zi = 4;
  return zi;
}