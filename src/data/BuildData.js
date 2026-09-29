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
  { id: 'glass', name: 'Glass', col: 0xcfefff, icon: 'glass', from: 'Melt 3 stone and 1 fibre into 2 panes at a campfire or a workbench.' },
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

function wormfarm() {
  // a plank box of wet earth under a fibre cover
  const P = [{ m: 'stone', k: 'stone', t: 0, x: -0.5, y: 0.06, z: -0.3, w: 0.16 }, { m: 'stone', k: 'stone', t: 0, x: 0.5, y: 0.06, z: 0.3, w: 0.16 }];
  P.push({ m: 'wood', k: 'plank', t: 1, x: 0, y: 0.14, z: 0, w: 1.3, h: 0.08, d: 0.8, solid: true });
  for (const [x, z, w, d] of [[0, -0.38, 1.3, 0.05], [0, 0.38, 1.3, 0.05], [-0.63, 0, 0.05, 0.72], [0.63, 0, 0.05, 0.72]]) P.push({ m: 'wood', k: 'plank', t: 2, x, y: 0.36, z, w, h: 0.38, d });
  P.push({ m: 'wood', k: 'plank', t: 3, x: 0, y: 0.5, z: 0, w: 1.22, h: 0.04, d: 0.7, soil: true });
  for (let i = 0; i < 4; i++) P.push({ m: 'fibre', k: 'thatch', t: 4, x: -0.45 + i * 0.3, y: 0.68, z: -0.3, w: 0.3, h: 0.3, d: 0.04 });
  return P;
}
function workbench() {
  const P = [];
  for (const [x, z] of [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]]) P.push({ m: 'wood', k: 'post', t: 0, x, y: 0, z, w: 0.08, h: 0.88, solid: true });
  for (let i = 0; i < 3; i++) P.push({ m: 'wood', k: 'plank', t: 1, x: 0, y: 0.92, z: -0.32 + i * 0.32, w: 2.0, h: 0.08, d: 0.3, solid: true });
  P.push({ m: 'stone', k: 'stone', t: 2, x: 0.7, y: 1.02, z: 0.1, w: 0.14 });
  P.push({ m: 'stone', k: 'stone', t: 2, x: 0.45, y: 1.0, z: -0.2, w: 0.1 });
  P.push({ m: 'iron', k: 'plank', t: 3, x: -0.55, y: 1.03, z: 0, w: 0.44, h: 0.14, d: 0.2 });
  P.push({ m: 'iron', k: 'plank', t: 3, x: -0.55, y: 1.16, z: 0, w: 0.26, h: 0.1, d: 0.14 });
  P.push({ m: 'wood', k: 'plank', t: 4, x: 0, y: 1.5, z: -0.42, w: 2.0, h: 0.9, d: 0.05 });
  return P;
}

/* ---------------- aquariums ----------------
   `tank` is the water inside: w x h x d (or r for a round one), its floor
   at y0, the longest catch it takes (cm) and how many (n). The parts are the
   frame, the glass and the lamps; the water and the sand fill in when the
   last piece goes on. */
const G = (x, y, z, w, h, d, t, r = 0) => ({ m: 'glass', k: 'glass', t, x, y, z, w, h, d, r });
function boxTank(W, H, D, y0, t, glassPer = 1) {
  // four walls of panes (glassPer across each long side) - a pane is one piece of glass
  const P = [], pw = W / glassPer;
  for (let i = 0; i < glassPer; i++) for (const s of [-1, 1]) P.push(G(-W / 2 + pw * (i + 0.5), y0 + H / 2, s * D / 2, pw * 0.98, H, 0.04, t));
  for (const s of [-1, 1]) P.push(G(s * W / 2, y0 + H / 2, 0, 0.04, H, D, t));
  return P;
}
function aq1() {
  const P = [];
  for (const [x, z] of [[-0.48, -0.22], [0.48, -0.22], [-0.48, 0.22], [0.48, 0.22]]) P.push({ m: 'wood', k: 'post', t: 0, x, y: 0, z, w: 0.05, h: 0.8, solid: true });
  P.push({ m: 'wood', k: 'plank', t: 1, x: 0, y: 0.82, z: 0, w: 1.2, h: 0.06, d: 0.62, solid: true });
  P.push(...boxTank(1.1, 0.6, 0.55, 0.85, 2));
  P.push({ m: 'wood', k: 'plank', t: 3, x: 0, y: 1.47, z: -0.25, w: 1.16, h: 0.04, d: 0.1 });
  return P;
}
function aq2() {
  const P = [];
  for (const [x, z] of [[-0.75, -0.3], [0.75, -0.3], [-0.75, 0.3], [0.75, 0.3]]) P.push({ m: 'stone', k: 'stone', t: 0, x, y: 0.2, z, w: 0.26 });
  P.push({ m: 'stone', k: 'plank', t: 1, x: 0, y: 0.5, z: 0, w: 2.0, h: 0.16, d: 0.95, solid: true, sand: 1 });
  P.push(...boxTank(1.8, 0.9, 0.8, 0.6, 2));
  for (const s of [-1, 1]) P.push({ m: 'wood', k: 'plank', t: 3, x: 0, y: 1.53, z: s * 0.4, w: 1.9, h: 0.06, d: 0.07 });
  for (const s of [-1, 1]) P.push({ m: 'wood', k: 'plank', t: 3, x: s * 0.9, y: 1.53, z: 0, w: 0.07, h: 0.06, d: 0.86 });
  return P;
}
function aq3() {
  const P = [];
  for (let i = 0; i < 8; i++) { const x = -1.35 + (i % 4) * 0.9, z = i < 4 ? -0.6 : 0.6; P.push({ m: 'stone', k: 'stone', t: 0, x, y: 0.22, z, w: 0.3 }); }
  P.push({ m: 'stone', k: 'plank', t: 1, x: 0, y: 0.5, z: 0, w: 3.2, h: 0.2, d: 1.5, solid: true, sand: 1 });
  for (const [x, z] of [[-1.5, -0.65], [1.5, -0.65], [-1.5, 0.65], [1.5, 0.65]]) P.push({ m: 'iron', k: 'post', t: 2, x, y: 0.6, z, w: 0.05, h: 1.35 });
  P.push(...boxTank(3.0, 1.3, 1.3, 0.6, 3, 2));
  for (const s of [-1, 1]) P.push({ m: 'wood', k: 'plank', t: 4, x: 0, y: 1.95, z: s * 0.65, w: 3.1, h: 0.08, d: 0.08 });
  P.push({ m: 'crystal', k: 'crystal', t: 5, x: 0, y: 2.3, z: 0, w: 0.14, h: 0.26 });
  return P;
}
function aq4() {
  const P = [];
  // a stepped plinth
  for (let i = 0; i < 12; i++) { const a = i / 12, x = -2.1 + (i % 6) * 0.84, z = i < 6 ? -1.05 : 1.05; P.push({ m: 'stone', k: 'stone', t: 0, x, y: 0.25, z, w: 0.36 }); void a; }
  P.push({ m: 'stone', k: 'plank', t: 1, x: 0, y: 0.3, z: 0, w: 5.0, h: 0.3, d: 2.6, solid: true, floor: true });
  P.push({ m: 'stone', k: 'plank', t: 1, x: 0, y: 0.6, z: 0, w: 4.7, h: 0.2, d: 2.2, solid: true, sand: 1 });
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) P.push({ m: 'iron', k: 'post', t: 2, x: -2.25 + i * 2.25, y: 0.7, z: s * 1.02, w: 0.06, h: 2.1 });
  P.push(...boxTank(4.5, 2.0, 2.0, 0.7, 3, 3));
  // arched beams over the top, and two lamps
  for (let i = 0; i < 4; i++) P.push({ m: 'wood', k: 'log', t: 4, x: -1.7 + i * 1.13, y: 3.0, z: 0, w: 2.3, h: 0.07, r: Math.PI / 2 });
  for (const x of [-1.5, 1.5]) P.push({ m: 'crystal', k: 'crystal', t: 5, x, y: 3.2, z: 0, w: 0.16, h: 0.3 });
  return P;
}
function aq5() {
  const P = [];
  for (let i = 0; i < 16; i++) { const x = -3.3 + (i % 8) * 0.94, z = i < 8 ? -1.85 : 1.85; P.push({ m: 'stone', k: 'stone', t: 0, x, y: 0.28, z, w: 0.42 }); }
  P.push({ m: 'stone', k: 'plank', t: 1, x: 0, y: 0.5, z: 0, w: 7.6, h: 0.36, d: 4.0, solid: true, sand: 1 });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) P.push({ m: 'iron', k: 'post', t: 2, x: -3.5 + i * 2.333, y: 0.68, z: s * 1.78, w: 0.08, h: 3.3 });
  P.push(...boxTank(7.0, 3.2, 3.5, 0.68, 3, 4));
  for (let i = 0; i < 6; i++) P.push({ m: 'iron', k: 'plank', t: 4, x: -3.0 + i * 1.2, y: 3.95, z: 0, w: 0.1, h: 0.1, d: 3.6 });
  for (const x of [-2.4, 0, 2.4]) P.push({ m: 'crystal', k: 'crystal', t: 5, x, y: 4.25, z: 0, w: 0.2, h: 0.36 });
  return P;
}
function aq6() {
  // the Oceanarium: a round glass tower fifteen metres across
  const P = [], R = 7.5, N = 12;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; P.push({ m: 'stone', k: 'stone', t: 0, x: Math.cos(a) * (R + 0.3), y: 0.3, z: Math.sin(a) * (R + 0.3), w: 0.5 }); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.push({ m: 'stone', k: 'plank', t: 1, x: Math.cos(a) * R * 0.5, y: 0.45, z: Math.sin(a) * R * 0.5, w: R * 1.05, h: 0.3, d: R * 0.42, r: -a, solid: true, sand: 1 }); }
  for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * Math.PI * 2; P.push({ m: 'iron', k: 'post', t: 2, x: Math.cos(a) * R, y: 0.6, z: Math.sin(a) * R, w: 0.12, h: 5.2 }); }
  const chord = 2 * R * Math.sin(Math.PI / N);
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; P.push(G(Math.cos(a) * R * Math.cos(Math.PI / N), 0.6 + 2.5, Math.sin(a) * R * Math.cos(Math.PI / N), 0.05, 5.0, chord * 1.01, 3, -a)); }
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; P.push({ m: 'iron', k: 'plank', t: 4, x: Math.cos(a) * R * Math.cos(Math.PI / N), y: 5.9, z: Math.sin(a) * R * Math.cos(Math.PI / N), w: 0.14, h: 0.16, d: chord * 1.02, r: -a }); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.push({ m: 'crystal', k: 'crystal', t: 5, x: Math.cos(a) * R * 0.95, y: 6.35, z: Math.sin(a) * R * 0.95, w: 0.24, h: 0.44 }); }
  return P;
}
export const AQUARIUMS = [
  { id: 'aq1', name: 'Small Aquarium', icon: 'fish', foot: 1.0, parts: aq1(), tank: { w: 1.1, h: 0.6, d: 0.55, y0: 0.85, cm: 45, n: 4 },
    blurb: 'A glass box on a wooden stand. Big enough for a few little fish, and the first thing in your hut that is alive.', use: 'Holds up to 4 living fish, each up to 45 cm.' },
  { id: 'aq2', name: 'Medium Aquarium', icon: 'fish', foot: 1.3, parts: aq2(), tank: { w: 1.8, h: 0.9, d: 0.8, y0: 0.6, cm: 90, n: 6 },
    blurb: 'A proper tank on a stone plinth, rimmed in wood.', use: 'Holds up to 6 living fish, each up to 90 cm.' },
  { id: 'aq3', name: 'Large Aquarium', icon: 'fish', foot: 1.9, parts: aq3(), tank: { w: 3.0, h: 1.3, d: 1.3, y0: 0.6, cm: 160, n: 8 },
    blurb: 'Iron corner posts, big panes and a crystal lamp over the water. Room for real fish.', use: 'Holds up to 8 living fish, each up to 1.6 m.' },
  { id: 'aq4', name: 'Grand Aquarium', icon: 'fish', foot: 2.8, parts: aq4(), tank: { w: 4.5, h: 2.0, d: 2.0, y0: 0.7, cm: 260, n: 10 },
    blurb: 'A stepped stone plinth, arched beams and two lamps. People will come to look at this.', use: 'Holds up to 10 living fish, each up to 2.6 m.' },
  { id: 'aq5', name: 'Massive Aquarium', icon: 'fish', foot: 4.2, parts: aq5(), tank: { w: 7.0, h: 3.2, d: 3.5, y0: 0.68, cm: 620, n: 12 },
    blurb: 'An iron-ribbed tank as long as a boat. The smaller sea beasts will fit - just.', use: 'Holds up to 12 catches up to 6.2 m - the Kraken and the Mirrorfish included.' },
  { id: 'aq6', name: 'The Oceanarium', icon: 'fish', foot: 8.2, parts: aq6(), tank: { r: 7.2, h: 5.0, y0: 0.6, cm: 1500, n: 16, round: true },
    blurb: 'A round glass tower fifteen metres across, ringed in iron and lit with reef crystal. The sea, brought home.', use: 'Holds up to 16 catches of any size - even the greatest sea beasts.' },
];

/* ---------------- boats ----------------
   A boat is built on its blueprint at the water's edge, keel first: the
   keel and stem, then the ribs, then the planks of the hull, the deck, the
   rail, and last whatever makes it that boat (a mast, a wheelhouse, an
   engine). Laid out along local +Z (the bow), like the boat it becomes.
   The better the boat, the more it takes - and the rarer the stuff. */
export function boatParts(H) {
  const hl = H.hl, hw = H.hw, tier = H.tier || 1, P = [];
  const ribs = Math.max(3, Math.round(hl * 1.1)), rows = tier >= 3 ? 3 : 2;
  const hwAt = z => hw * Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.max(0, z / hl), 2.4) * 0.9)) * (z < -hl * 0.8 ? 0.85 : 1);
  // cradle stones and the keel
  for (const z of [-hl * 0.6, 0, hl * 0.6]) P.push({ m: 'stone', k: 'stone', t: 0, x: 0, y: -0.15, z, w: 0.28 });
  P.push({ m: tier >= 4 ? 'iron' : 'wood', k: 'log', t: 1, x: 0, y: 0.05, z: 0, w: hl * 1.9, h: 0.1, r: Math.PI / 2 });
  // ribs
  for (let i = 0; i < ribs; i++) {
    const z = -hl * 0.85 + (hl * 1.7) * i / (ribs - 1), w = hwAt(z);
    for (const s of [-1, 1]) P.push({ m: 'wood', k: 'post', t: 2, x: s * w * 0.92, y: 0.05, z, w: 0.05, h: H.deck * 0.9 + 0.25 });
  }
  // hull planks, both sides, in strakes
  const segs = Math.max(2, Math.round(hl / 1.3));
  for (let r = 0; r < rows; r++) for (let i = 0; i < segs; i++) {
    const z0 = -hl * 0.9 + (hl * 1.8) * i / segs, z1 = -hl * 0.9 + (hl * 1.8) * (i + 1) / segs, zc = (z0 + z1) / 2, w = hwAt(zc);
    for (const s of [-1, 1]) P.push({ m: tier >= 5 && r === 0 ? 'iron' : 'wood', k: 'plank', t: 3, x: s * w * (0.85 + r * 0.05), y: 0.2 + r * (H.deck / rows), z: zc, w: 0.05, h: H.deck / rows * 0.95, d: (z1 - z0) * 1.02, r: s * (w - hwAt(z1)) / (z1 - z0) * -0.9 });
  }
  // the deck
  const dk = Math.max(2, Math.round(hl * 0.9));
  for (let i = 0; i < dk; i++) { const z = -hl * 0.8 + hl * 1.6 * (i + 0.5) / dk; P.push({ m: 'wood', k: 'plank', t: 4, x: 0, y: H.deck, z, w: hwAt(z) * 1.7, h: 0.05, d: hl * 1.6 / dk * 0.96 }); }
  // the rail
  for (const s of [-1, 1]) P.push({ m: 'wood', k: 'log', t: 5, x: s * hw * 0.9, y: H.deck + 0.45, z: -hl * 0.1, w: hl * 1.5, h: 0.04, r: Math.PI / 2 });
  // what makes it this boat
  if (tier >= 2) P.push({ m: 'iron', k: 'plank', t: 5, x: 0, y: H.deck + 0.3, z: -hl * 0.75, w: 0.5, h: 0.45, d: 0.45 });                       // an engine
  if (H.engine === 'sail' || tier >= 3) P.push({ m: 'wood', k: 'post', t: 6, x: 0, y: H.deck, z: hl * 0.15, w: 0.1, h: 3 + tier });            // a mast
  if (H.cabin) P.push({ m: 'wood', k: 'plank', t: 6, x: 0, y: H.deck + H.cabin.h / 2, z: H.cabin.z, w: H.cabin.hw * 2, h: H.cabin.h, d: H.cabin.hl * 2 });
  if (tier >= 4) P.push({ m: 'glass', k: 'glass', t: 6, x: 0, y: H.deck + 1.5, z: (H.cabin?.z || 0) + (H.cabin?.hl || 1), w: hw * 1.2, h: 0.6, d: 0.04 });
  for (let i = 0; i < Math.max(0, tier - 2) * 3; i++) { const z = -hl * 0.7 + hl * 1.4 * i / Math.max(1, (tier - 2) * 3 - 1), s = i % 2 ? 1 : -1; P.push({ m: 'iron', k: 'plank', t: 5, x: s * hwAt(z) * 0.9, y: H.deck + 0.15, z, w: 0.1, h: 0.08, d: 0.22 }); }
  if (tier >= 5) for (let i = 0; i < 2; i++) P.push({ m: 'crystal', k: 'crystal', t: 6, x: (i ? 1 : -1) * hw * 0.8, y: H.deck + 1.2, z: hl * 0.5, w: 0.14, h: 0.26 });
  return P;
}
export const boatBlueprint = H => ({ id: 'boat:' + H.id, name: H.name, icon: 'boat', foot: H.hw + 0.8, boat: H.id, water: true, parts: boatParts(H),
  blurb: H.blurb, use: 'When the last piece goes on, she floats - and she is yours.' });

/* What the workbench makes. `give` is a bait (bait:id, n), or an upgrade (up:key). */
export const RECIPES = [
  { id: 'glass', name: 'Glass Panes (x2)', icon: 'glass', cost: { stone: 3, fibre: 1 }, mat: 'glass', n: 2, blurb: 'Crushed stone and a little fibre ash, melted down and poured flat. Every aquarium needs it. (A campfire can do it too.)' },
  { id: 'ironaxe', name: 'Iron Axe', icon: 'axe', cost: { iron: 6, wood: 4 }, up: 'axe', blurb: 'An iron head on an ash haft. Every swing does twice the work.' },
  { id: 'ironpick', name: 'Iron Pickaxe', icon: 'pick', cost: { iron: 6, wood: 4 }, up: 'pick', blurb: 'Tempered iron. Rock comes apart in half the blows.' },
  { id: 'crystallure', name: 'Crystal Lures (x3)', icon: 'glow', cost: { crystal: 2, fibre: 2 }, bait: 'glow', n: 3, blurb: 'A chip of reef crystal tied into a fibre fly. It glows like Glow Bait - because it is.' },
  { id: 'fibrefly', name: 'Fibre Flies (x6)', icon: 'worm', cost: { fibre: 3 }, bait: 'worm', n: 6, blurb: 'Twisted fibre and a hook. The fish do not know they are not worms.' },
];
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));
/** Worms a full worm farm holds, and the game seconds each one takes. */
export const WORMS = { max: 20, every: 45 };

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
  { id: 'wormfarm', name: 'Worm Farm', icon: 'worm', foot: 1.0, parts: wormfarm(),
    blurb: 'A plank box of wet earth and scraps under a fibre cover. Worms breed in it whether you watch or not.', use: 'Breeds a worm every so often, up to twenty. Press E to empty it into your bait tin.' },
  { id: 'workbench', name: 'Workbench', icon: 'hammer', foot: 1.3, parts: workbench(),
    blurb: 'A heavy plank bench with an iron anvil block and a tool board. Where the islands\' raw stuff becomes something better.', use: 'Craft iron tools that chop and break twice as fast, and lures from crystal and fibre (E).' },
  { id: 'palisade', name: 'Palisade Wall', icon: 'shield', foot: 1.9, parts: palisade(),
    blurb: 'Eight sharpened stakes between two footing stones. Keeps the wind off a camp - and anything else.', use: 'A solid wall. Build several round a camp.' },
  { id: 'jetty', name: 'Fishing Jetty', icon: 'dock', foot: 1.3, shore: true, parts: jetty(),
    blurb: 'Posts driven into the sea bed and a plank deck out over the water. Build it at the edge of the shore, facing the sea.', use: 'Walk out and fish from deeper water without a boat.' },
  { id: 'shelter', name: 'Wooden Shelter', icon: 'hut', foot: 2.2, parts: shelter(),
    blurb: 'A lean-to cabin: a stone footing, log walls and a plank roof. Somewhere of your own out here.', use: 'Sleep in it at night (E). If you black out, you wake up at your newest shelter instead of back home.' },
  { id: 'watchtower', name: 'Watchtower', icon: 'eye', foot: 1.9, parts: watchtower(),
    blurb: 'Four tall legs, a platform six metres up and a ladder. You can see a long way from up there.', use: 'Climb the ladder (E) and look out from the top (E) to chart the sea for a kilometre around.' },
];
BLUEPRINTS.push(...AQUARIUMS);
export const BP_BY_ID = Object.fromEntries(BLUEPRINTS.map(b => [b.id, b]));
// every boat has its plan (in BP_BY_ID so a laid-out one can be found, but only in your book once you own it)
import { HULLS } from './BoatData.js';
for (const H of HULLS) BP_BY_ID['boat:' + H.id] = boatBlueprint(H);
/** What a boat's blueprint costs at the yard: a third of the old price of the boat. */
export const planPrice = H => Math.round(H.price * 0.35 / 50) * 50;

/** The materials a blueprint needs in all. */
export function bpCost(bp) {
  const c = {};
  for (const p of bp.parts) c[p.m] = (c[p.m] || 0) + 1;
  return c;
}
