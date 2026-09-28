/* BuildData.js - what the islands are made of, and what you can make of them.

   MATS        the materials you carry in your pack (shared by the crew)
   HARVEST     which trees, rocks and plants can be taken apart, with which
               tool, how many hits they take and what falls out
   BLUEPRINTS  everything you can build. A blueprint is a list of PARTS -
               one stone, one log, one plank each - that you place by hand:
               hold the material (G), walk up to the piece and press E.
               Parts come in tiers (foundation, then walls and posts, then
               the roof); a tier opens when the one below it is finished.

   A part: { m: material, k: kind, t: tier, x, y, z (local, metres),
             w, h, d (size), r (rotation about Y), rx, rz, floor, solid }
   kinds: stone, log (along local X), plank (a box), post (upright), stake,
          crystal, thatch. `floor` makes it something you can stand on;
          `solid` gives it a collider. */

export const MATS = [
  { id: 'wood', name: 'Wood', col: 0x8a5a36, icon: 'log', from: 'Chop trees with the axe (0). Fallen logs and stumps give a little too.' },
  { id: 'stone', name: 'Stone', col: 0x8e8e88, icon: 'stone', from: 'Break rocks with the pickaxe (-).' },
  { id: 'fibre', name: 'Fibre', col: 0x9ab04a, icon: 'fibre', from: 'Cut bushes, ferns, reeds and mushrooms with the axe.' },
  { id: 'crystal', name: 'Crystal', col: 0x9ae8f0, icon: 'crystal', from: 'Chip it off the crystal spires of the Crystal Reef with the pickaxe.' },
  { id: 'iron', name: 'Iron Ore', col: 0x6a5a52, icon: 'ore', from: 'Black rock: the spires of the Blackwater and Thunderpeak, and the lava rock of Sunscar. Pickaxe.' },
];
export const MAT_BY_ID = Object.fromEntries(MATS.map(m => [m.id, m]));

/* tool: 'axe' | 'pick'.  hp: hits.  give: [[mat, n], ...] at the end;
   chip: [mat, n] dropped on every hit.  fall: trees topple.  r: how close you need to be (x scale). */
export const HARVEST = {
  pine: { tool: 'axe', hp: 6, give: [['wood', 4]], fall: true, r: 0.5 },
  snowpine: { tool: 'axe', hp: 6, give: [['wood', 4]], fall: true, r: 0.5 },
  broad: { tool: 'axe', hp: 7, give: [['wood', 5]], fall: true, r: 0.55 },
  birch: { tool: 'axe', hp: 5, give: [['wood', 3]], fall: true, r: 0.45 },
  palm: { tool: 'axe', hp: 5, give: [['wood', 3], ['fibre', 2]], fall: true, r: 0.45 },
  dead: { tool: 'axe', hp: 4, give: [['wood', 3]], fall: true, r: 0.45 },
  deaddark: { tool: 'axe', hp: 4, give: [['wood', 3]], fall: true, r: 0.45 },
  ash: { tool: 'axe', hp: 4, give: [['wood', 3]], fall: true, r: 0.45 },
  giant: { tool: 'axe', hp: 16, give: [['wood', 10]], fall: true, r: 1.6 },
  mangrove: { tool: 'axe', hp: 5, give: [['wood', 3], ['fibre', 1]], fall: true, r: 0.45 },
  log: { tool: 'axe', hp: 2, give: [['wood', 2]], r: 1.1 },
  mosslog: { tool: 'axe', hp: 2, give: [['wood', 2], ['fibre', 1]], r: 1.1 },
  stump: { tool: 'axe', hp: 3, give: [['wood', 1]], r: 0.6 },
  bush: { tool: 'axe', hp: 1, give: [['fibre', 2]], r: 0.7 },
  tbush: { tool: 'axe', hp: 1, give: [['fibre', 2]], r: 0.7 },
  fern: { tool: 'axe', hp: 1, give: [['fibre', 1]], r: 0.6 },
  reeds: { tool: 'axe', hp: 1, give: [['fibre', 2]], r: 0.6 },
  mushroom: { tool: 'axe', hp: 2, give: [['fibre', 2]], r: 0.5 },
  rock: { tool: 'pick', hp: 5, chip: ['stone', 1], give: [['stone', 2]], r: 1.0 },
  snowrock: { tool: 'pick', hp: 5, chip: ['stone', 1], give: [['stone', 2]], r: 1.0 },
  sandrock: { tool: 'pick', hp: 4, chip: ['stone', 1], give: [['stone', 2]], r: 1.0 },
  lavarock: { tool: 'pick', hp: 6, chip: ['stone', 1], give: [['iron', 2]], r: 1.1 },
  spire: { tool: 'pick', hp: 8, chip: ['stone', 1], give: [['iron', 2], ['stone', 1]], r: 1.4 },
  crystal: { tool: 'pick', hp: 4, chip: ['crystal', 1], give: [['crystal', 1]], r: 0.7 },
};
/** Days before a felled tree grows back (rocks come back too - the tide turns them up). */
export const REGROW_DAYS = 4;

/* ---------------- blueprints ---------------- */
const ring = (n, r, m, k, t, y = 0, size = 0.32) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return { m, k, t, x: Math.cos(a) * r, y, z: Math.sin(a) * r, w: size, r: -a }; });

function campfire() {
  const P = ring(6, 0.62, 'stone', 'stone', 0, 0.1, 0.26);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; P.push({ m: 'wood', k: 'log', t: 1, x: Math.cos(a) * 0.22, y: 0.42, z: Math.sin(a) * 0.22, w: 0.95, h: 0.08, r: -a, rz: 1.05 }); }
  return P;
}
function bench() {
  return [
    { m: 'wood', k: 'post', t: 0, x: -0.7, y: 0, z: 0, w: 0.1, h: 0.42, solid: true },
    { m: 'wood', k: 'post', t: 0, x: 0.7, y: 0, z: 0, w: 0.1, h: 0.42, solid: true },
    { m: 'wood', k: 'plank', t: 1, x: 0, y: 0.45, z: -0.13, w: 1.8, h: 0.06, d: 0.24, floor: true },
    { m: 'wood', k: 'plank', t: 1, x: 0, y: 0.45, z: 0.13, w: 1.8, h: 0.06, d: 0.24, floor: true },
  ];
}
function lantern() {
  return [
    { m: 'wood', k: 'post', t: 0, x: 0, y: 0, z: 0, w: 0.09, h: 1.3, solid: true },
    { m: 'wood', k: 'post', t: 1, x: 0, y: 1.3, z: 0, w: 0.08, h: 1.1 },
    { m: 'wood', k: 'log', t: 2, x: 0.3, y: 2.3, z: 0, w: 0.7, h: 0.05 },
    { m: 'crystal', k: 'crystal', t: 3, x: 0.58, y: 1.98, z: 0, w: 0.16, h: 0.3 },
  ];
}
function chest() {
  return [
    { m: 'stone', k: 'stone', t: 0, x: -0.45, y: 0.06, z: 0, w: 0.16 },
    { m: 'stone', k: 'stone', t: 0, x: 0.45, y: 0.06, z: 0, w: 0.16 },
    { m: 'wood', k: 'plank', t: 1, x: 0, y: 0.15, z: 0, w: 1.2, h: 0.08, d: 0.7, solid: true },
    { m: 'wood', k: 'plank', t: 2, x: 0, y: 0.42, z: -0.33, w: 1.2, h: 0.5, d: 0.06 },
    { m: 'wood', k: 'plank', t: 2, x: 0, y: 0.42, z: 0.33, w: 1.2, h: 0.5, d: 0.06 },
    { m: 'wood', k: 'plank', t: 2, x: -0.57, y: 0.42, z: 0, w: 0.06, h: 0.5, d: 0.62 },
    { m: 'wood', k: 'plank', t: 2, x: 0.57, y: 0.42, z: 0, w: 0.06, h: 0.5, d: 0.62 },
    { m: 'wood', k: 'plank', t: 3, x: 0, y: 0.72, z: 0, w: 1.26, h: 0.08, d: 0.76, solid: true },
  ];
}
function baitstation() {
  const P = [];
  for (const [x, z] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) P.push({ m: 'wood', k: 'post', t: 0, x, y: 0, z, w: 0.09, h: 0.85, solid: true });
  P.push({ m: 'wood', k: 'plank', t: 1, x: 0, y: 0.9, z: 0, w: 1.8, h: 0.1, d: 0.9, solid: true });
  P.push({ m: 'stone', k: 'stone', t: 2, x: -0.4, y: 1.05, z: 0, w: 0.2 });
  P.push({ m: 'stone', k: 'stone', t: 2, x: 0.45, y: 1.02, z: 0.15, w: 0.14 });
  for (let i = 0; i < 4; i++) P.push({ m: 'fibre', k: 'thatch', t: 3, x: -0.6 + i * 0.4, y: 1.55, z: -0.42, w: 0.4, h: 0.6, d: 0.05 });
  P.push({ m: 'wood', k: 'log', t: 3, x: 0, y: 1.9, z: -0.42, w: 1.9, h: 0.06 });
  return P;
}
function palisade() {
  const P = [{ m: 'stone', k: 'stone', t: 0, x: -1.6, y: 0.1, z: 0, w: 0.3 }, { m: 'stone', k: 'stone', t: 0, x: 1.6, y: 0.1, z: 0, w: 0.3 }];
  for (let i = 0; i < 8; i++) P.push({ m: 'wood', k: 'stake', t: 1, x: -1.4 + i * 0.4, y: 0, z: 0, w: 0.17, h: 1.9 + (i % 3) * 0.2, solid: true });
  return P;
}
function jetty() {
  // runs out along local -Z from the shore (z = 0) over the water
  const P = [];
  for (const x of [-0.8, 0.8]) P.push({ m: 'stone', k: 'stone', t: 0, x, y: 0.1, z: 0.4, w: 0.34 });
  for (const z of [-3, -6]) for (const x of [-0.85, 0.85]) P.push({ m: 'stone', k: 'stone', t: 0, x, y: -0.9, z, w: 0.4 });
  for (const z of [-3, -6]) for (const x of [-0.85, 0.85]) P.push({ m: 'wood', k: 'post', t: 1, x, y: -1.4, z, w: 0.12, h: 2.3, solid: true });
  for (let i = 0; i < 8; i++) P.push({ m: 'wood', k: 'plank', t: 2, x: 0, y: 0.84, z: 0.3 - i * 0.85, w: 2.0, h: 0.08, d: 0.8, floor: true });
  return P;
}
function shelter() {
  // a lean-to cabin, 3 x 2.6 m, open at the front (+Z): 20 wood and 10 stone
  const P = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 10, per = 2 * (3 + 2.6);
    let d = t * per, x, z;
    if (d < 3) { x = -1.5 + d; z = -1.3; } else if ((d -= 3) < 2.6) { x = 1.5; z = -1.3 + d; } else if ((d -= 2.6) < 3) { x = 1.5 - d; z = 1.3; } else { d -= 3; x = -1.5; z = 1.3 - d; }
    P.push({ m: 'stone', k: 'stone', t: 0, x, y: 0.1, z, w: 0.3 });
  }
  for (const [x, z, h] of [[-1.45, -1.25, 1.7], [1.45, -1.25, 1.7], [-1.45, 1.25, 2.4], [1.45, 1.25, 2.4]]) P.push({ m: 'wood', k: 'post', t: 1, x, y: 0, z, w: 0.12, h, solid: true });
  for (let i = 0; i < 4; i++) P.push({ m: 'wood', k: 'log', t: 2, x: 0, y: 0.2 + i * 0.38, z: -1.3, w: 2.95, h: 0.13, solid: true });
  for (const x of [-1.5, 1.5]) for (let i = 0; i < 2; i++) P.push({ m: 'wood', k: 'log', t: 2, x, y: 0.2 + i * 0.38, z: 0, w: 2.5, h: 0.13, r: Math.PI / 2, solid: true });
  P.push({ m: 'wood', k: 'log', t: 3, x: 0, y: 1.72, z: -1.25, w: 3.2, h: 0.12 });
  P.push({ m: 'wood', k: 'log', t: 3, x: 0, y: 2.42, z: 1.25, w: 3.2, h: 0.12 });
  for (let i = 0; i < 6; i++) P.push({ m: 'wood', k: 'plank', t: 4, x: -1.4 + i * 0.56, y: 2.12, z: 0, w: 0.52, h: 0.06, d: 2.95, rx: 0.27 });
  return P;
}
function watchtower() {
  // a platform six metres up with a ladder; 24 wood, 8 stone
  const P = [];
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { P.push({ m: 'stone', k: 'stone', t: 0, x, y: 0.12, z, w: 0.36 }); P.push({ m: 'stone', k: 'stone', t: 0, x: x * 0.7, y: 0.1, z: z * 0.7, w: 0.26 }); }
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { P.push({ m: 'wood', k: 'post', t: 1, x, y: 0.2, z, w: 0.14, h: 3.2, solid: true }); P.push({ m: 'wood', k: 'post', t: 2, x, y: 3.4, z, w: 0.13, h: 3.6, solid: true }); }
  for (let i = 0; i < 4; i++) P.push({ m: 'wood', k: 'log', t: 2, x: 0, y: 1.6, z: i < 2 ? (i ? 1.2 : -1.2) : 0, w: 2.5, h: 0.08, r: i < 2 ? 0 : Math.PI / 2 });
  for (let i = 0; i < 6; i++) P.push({ m: 'wood', k: 'plank', t: 3, x: -1.1 + i * 0.44, y: 5.9, z: 0, w: 0.42, h: 0.1, d: 2.7, floor: true });
  for (let i = 0; i < 2; i++) P.push({ m: 'wood', k: 'log', t: 4, x: 0, y: 6.9, z: i ? 1.25 : -1.25, w: 2.6, h: 0.07 });
  P.push({ m: 'wood', k: 'log', t: 4, x: 1.25, y: 6.9, z: 0, w: 2.6, h: 0.07, r: Math.PI / 2 });
  P.push({ m: 'wood', k: 'plank', t: 4, x: 0, y: 3.3, z: 1.55, w: 0.55, h: 6.1, d: 0.08, ladder: true });
  return P;
}

function dryrack() {
  // two A-frames with a pole between them: fish hang from the pole (the four hooks are the `hang` points)
  const P = [{ m: 'stone', k: 'stone', t: 0, x: -1.1, y: 0.08, z: 0, w: 0.22 }, { m: 'stone', k: 'stone', t: 0, x: 1.1, y: 0.08, z: 0, w: 0.22 }];
  for (const x of [-1.1, 1.1]) for (const s of [-1, 1]) P.push({ m: 'wood', k: 'post', t: 1, x, y: 0, z: s * 0.35, w: 0.06, h: 1.75, rx: -s * 0.19, solid: true });
  P.push({ m: 'wood', k: 'log', t: 2, x: 0, y: 1.68, z: 0, w: 2.5, h: 0.05 });
  for (let i = 0; i < 4; i++) P.push({ m: 'fibre', k: 'thatch', t: 3, x: -0.75 + i * 0.5, y: 1.52, z: 0, w: 0.06, h: 0.3, d: 0.03 });
  return P;
}
function beacon() {
  // a stone tower with an iron fire basket on top; it burns every night and can be seen from far out
  const P = [];
  for (let ring = 0; ring < 3; ring++) {
    const n = 8 - ring * 2, r = 0.95 - ring * 0.22;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + ring * 0.3; P.push({ m: 'stone', k: 'stone', t: ring, x: Math.cos(a) * r, y: 0.15 + ring * 0.75, z: Math.sin(a) * r, w: 0.42 - ring * 0.06 }); }
  }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; P.push({ m: 'wood', k: 'post', t: 3, x: Math.cos(a) * 0.35, y: 1.9, z: Math.sin(a) * 0.35, w: 0.07, h: 1.3 }); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; P.push({ m: 'iron', k: 'plank', t: 4, x: Math.cos(a) * 0.36, y: 3.25, z: Math.sin(a) * 0.36, w: 0.5, h: 0.32, d: 0.05, r: -a + Math.PI / 2 }); }
  for (let i = 0; i < 3; i++) P.push({ m: 'wood', k: 'log', t: 5, x: 0, y: 3.2 + i * 0.1, z: 0, w: 0.55, h: 0.07, r: i * 1.05 });
  return P;
}

export const BLUEPRINTS = [
  { id: 'campfire', name: 'Campfire', icon: 'fire', foot: 1.3, parts: campfire(),
    blurb: 'A ring of stones and a few logs. Warmth on a cold night, light to see by, and a place to rest until morning.', use: 'Rest by it (E) to heal and wait for dawn. Keeps the Frostfall cold off you.' },
  { id: 'bench', name: 'Bench', icon: 'seat', foot: 1.1, parts: bench(),
    blurb: 'Two posts and two planks. Not much, but it is yours.', use: 'Somewhere to sit and watch the water.' },
  { id: 'lantern', name: 'Crystal Lantern', icon: 'light', foot: 0.8, parts: lantern(),
    blurb: 'A wooden post with a chip of reef crystal hung from the arm. It glows all night.', use: 'Lights the way at night - mark a landing, a camp, a path.' },
  { id: 'chest', name: 'Storage Chest', icon: 'chest', foot: 0.9, parts: chest(),
    blurb: 'A plank box on stone feet with a heavy lid. What goes in stays put.', use: 'Stores up to 16 catches. Hold a fish and press E to put it in; E with empty hands to take one out.' },
  { id: 'baitstation', name: 'Bait Station', icon: 'worm', foot: 1.2, parts: baitstation(),
    blurb: 'A cutting table under a fibre screen. Everyone who fishes needs one.', use: 'Hold a fish and press E: it becomes a stack of Fish Pieces bait. Bigger fish, more bait.' },
  { id: 'dryrack', name: 'Fish Drying Rack', icon: 'fish', foot: 1.3, parts: dryrack(), hang: 4,
    blurb: 'A pole between two A-frames, with fibre lines to hang fish from. The wind does the rest.', use: 'Hang up to four fish (hold one, press E). After a few minutes they are dried, and dried fish sells for half as much again.' },
  { id: 'beacon', name: 'Signal Beacon', icon: 'fire', foot: 1.2, parts: beacon(),
    blurb: 'A stone tower with an iron fire basket on top. Every beacon you light is one more thing in the dark that is yours.', use: 'Burns every night, bright enough to see from far out at sea, and marks your map.' },
  { id: 'palisade', name: 'Palisade Wall', icon: 'shield', foot: 1.9, parts: palisade(),
    blurb: 'Eight sharpened stakes between two footing stones. Keeps the wind off a camp - and anything else.', use: 'A solid wall. Build several round a camp.' },
  { id: 'jetty', name: 'Fishing Jetty', icon: 'dock', foot: 1.3, shore: true, parts: jetty(),
    blurb: 'Posts driven into the sea bed and a plank deck out over the water. Build it at the edge of the shore, facing the sea.', use: 'Walk out and fish from deeper water without a boat.' },
  { id: 'shelter', name: 'Wooden Shelter', icon: 'hut', foot: 2.2, parts: shelter(),
    blurb: 'A lean-to cabin: a stone footing, log walls and a plank roof. Somewhere of your own out here.', use: 'Sleep in it at night (E). If you black out, you wake up at your newest shelter instead of back home.' },
  { id: 'watchtower', name: 'Watchtower', icon: 'eye', foot: 1.9, parts: watchtower(),
    blurb: 'Four tall legs, a platform six metres up and a ladder. You can see a long way from up there.', use: 'Climb the ladder (E) and look out from the top (E) to chart the sea for a kilometre around.' },
];
export const BP_BY_ID = Object.fromEntries(BLUEPRINTS.map(b => [b.id, b]));

/** The materials a blueprint needs in all. */
export function bpCost(bp) {
  const c = {};
  for (const p of bp.parts) c[p.m] = (c[p.m] || 0) + 1;
  return c;
}
