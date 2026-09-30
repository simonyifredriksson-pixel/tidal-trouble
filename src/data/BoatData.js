/* BoatData.js - the four hulls and every part you can bolt onto them.

   Boat frame: +Z is the bow, the deck is at y = deck above the waterline,
   the deck is a rectangle of half-width hw and half-length hl. Everything a
   player can stand on, bump into or use is described here so the physics,
   the art and the co-op sync all read the same numbers.

   waves   the swell amplitude the hull shrugs off. Above it the boat ships
           water and takes damage - which is what gates the Open Sea. */

/* Every hull also has:
     yard       where it is sold (a shipwright on that island)
     stability  0..1  how little it rolls and how hard it is to knock you over
     deep       0..1  deep-water performance: holds course in the far currents,
                      a little faster out there, and past 0.9 the things that
                      bump hulls in the dark leave it alone
     repair     cost and time of repairs (1 normal, higher is harder)
     cap        equipment capacity: the highest upgrade level it can take
   THE LEVIATHAN HUNTER IS THE BEST BOAT IN THE SEA: no other hull beats it
   on any of these, and the test suite checks that it stays that way. */
export const HULLS = [
  { id: 'dinghy', name: 'The Soggy Biscuit', tier: 1, price: 0, yard: 'home', stability: 0.3, deep: 0, repair: 0.6, cap: 2,
    hw: 0.85, hl: 2.3, deck: 0.35, draft: 0.35, mass: 250, hp: 100, cargoKg: 180, waves: 0.75,
    speed: 7.5, accel: 2.6, turn: 1.25, engine: 'outboard',
    helm: [0, 0, -1.9], seats: [[0, 0, -1.2], [0, 0, 0.4]], cooler: [0, 0, 1.2], fuel: null,
    rodHolders: [[0.7, 0.3, -1.5]], mount: null, lights: [[0, 0.9, 2.1]], cabin: null,
    blurb: 'A wooden rowboat with an outboard motor older than you. It floats. Usually.' },
  { id: 'motor', name: 'Motorboat', tier: 2, price: 2600, yard: 'home', stability: 0.45, deep: 0.1, repair: 0.8, cap: 3,
    hw: 1.25, hl: 3.4, deck: 0.55, draft: 0.5, mass: 900, hp: 240, cargoKg: 600, waves: 1.6,
    speed: 14, accel: 4.2, turn: 1.0, engine: 'outboard',
    helm: [0, 0, -0.9], seats: [[-0.7, 0, -2.4], [0.7, 0, -2.4]], cooler: [-0.6, 0, 1.4], fuel: [0.8, 0, -2.6],
    rodHolders: [[1.1, 0.4, -2.6], [-1.1, 0.4, -2.6]], mount: [0, 0, 2.7], lights: [[0, 1.6, -0.6], [0, 0.9, 3.2]], cabin: { z: -0.4, hw: 0.9, hl: 0.5, h: 1.3, open: true },
    blurb: 'A proper motorboat with a windscreen, a fuel tank you should not hit, and room for two friends.' },
  { id: 'seafarer', name: 'The Seafarer', tier: 2, price: 7500, yard: 'home', stability: 0.6, deep: 0.3, repair: 0.9, cap: 3,
    hw: 1.6, hl: 4.2, deck: 0.7, draft: 0.65, mass: 1800, hp: 420, cargoKg: 1200, waves: 2.2,
    speed: 13.5, accel: 3.8, turn: 0.9, engine: 'inboard',
    helm: [0, 0, 1.2], seats: [[-0.9, 0, -3.2], [0.9, 0, -3.2]], cooler: [-1.0, 0, -2.4], fuel: [1.1, 0, -2.9],
    rodHolders: [[1.4, 0.4, -3.6], [-1.4, 0.4, -3.6], [1.4, 0.4, -2.0]], mount: [0, 0, 3.5], lights: [[0, 2.6, 0.8], [0, 1.0, 3.9], [-1.3, 1.6, -1], [1.3, 1.6, -1]],
    cabin: { z: 0.8, hw: 1.2, hl: 1.1, h: 2.1, open: false }, anchor: [0.6, 2.9], flybridge: true, platform: true,
    blurb: 'A sturdy cabin cruiser with a wheelhouse, a flybridge and room to fish off the back. The first boat that can cross open water.' },
  { id: 'swiftfin', name: 'The Swiftfin', tier: 3, price: 22000, yard: 'sunscar', stability: 0.35, deep: 0.3, repair: 1.4, cap: 3,
    hw: 1.2, hl: 3.8, deck: 0.55, draft: 0.4, mass: 700, hp: 320, cargoKg: 700, waves: 2.0,
    speed: 21, accel: 7, turn: 1.3, engine: 'outboard',
    helm: [0, 0, -0.6], seats: [[-0.6, 0, -2.6], [0.6, 0, -2.6]], cooler: [-0.5, 0, 1.5], fuel: [0.6, 0, -2.9],
    rodHolders: [[1.0, 0.4, -3.0], [-1.0, 0.4, -3.0]], mount: null, lights: [[0, 1.4, -0.2], [0, 0.8, 3.6]],
    cabin: { z: -0.2, hw: 0.8, hl: 0.45, h: 1.2, open: true }, anchor: [0.4, 2.5], foils: true,
    blurb: 'A hydrofoil racer from Sunscar. Fastest thing on the water but one. Hates storms, hates cargo, loves going very fast.' },
  { id: 'trawler', name: 'The Trawler', tier: 3, price: 16000, yard: 'whisper', stability: 0.75, deep: 0.45, repair: 1.0, cap: 3,
    hw: 2.1, hl: 5.6, deck: 0.9, draft: 0.9, mass: 4200, hp: 700, cargoKg: 3200, waves: 3.0, outriggers: true,
    speed: 12.5, accel: 3.2, turn: 0.7, engine: 'inboard',
    helm: [0, 0, 1.4], seats: [[-1.4, 0, -4.4], [1.4, 0, -4.4]], cooler: [-1.2, 0, -2.6], fuel: [1.4, 0, -1.2],
    rodHolders: [[1.9, 0.5, -4.8], [-1.9, 0.5, -4.8], [1.9, 0.5, -3.2], [-1.9, 0.5, -3.2]], mount: [0, 0, 4.9], lights: [[0, 3.2, 1.4], [0, 1.2, 5.2], [-1.8, 2.2, -1], [1.8, 2.2, -1]],
    cabin: { z: 1.6, hw: 1.5, hl: 1.3, h: 2.2, open: false }, crane: [1.5, 0, -1.8],
    blurb: 'Oak ribs, steel plate, outriggers and a net drum. Tamsin builds them in Whispering Woods: the best working boat of the mid-ocean, with a deck big enough to land a small whale.' },
  { id: 'salvager', name: 'The Salvager', tier: 3, price: 38000, yard: 'ironwreck', stability: 0.8, deep: 0.5, repair: 0.7, cap: 4,
    hw: 2.4, hl: 6.2, deck: 1.0, draft: 1.0, mass: 9000, hp: 1300, cargoKg: 9000, waves: 3.6,
    speed: 11.5, accel: 3, turn: 0.65, engine: 'inboard',
    helm: [0, 0, 3.0], seats: [[-1.7, 0, -5.2], [1.7, 0, -5.2]], cooler: [-1.6, 0, -2], fuel: [1.6, 0, 0.6],
    rodHolders: [[2.2, 0.5, -5.4], [-2.2, 0.5, -5.4], [2.2, 0.5, -3.6]], mount: [0, 0, 5.6], lights: [[0, 3.4, 3.2], [0, 1.4, 5.9], [-2.1, 2.4, -2], [2.1, 2.4, -2]],
    cabin: { z: 3.2, hw: 1.5, hl: 1.2, h: 2.3, open: false }, crane: [1.6, 0, -1.2], anchor: [1.0, 5.0], aframe: true,
    blurb: 'A workboat with an A-frame on the stern, a crane and a huge open deck. Carries more than anything but the ships, and it is the easiest boat in the sea to fix.' },
  { id: 'ironclad', name: 'The Ironclad', tier: 4, price: 55000, yard: 'ironwreck', stability: 0.88, deep: 0.6, repair: 1.8, cap: 4,
    hw: 2.5, hl: 6.8, deck: 1.1, draft: 1.2, mass: 16000, hp: 2400, cargoKg: 5000, waves: 4.6,
    speed: 13, accel: 2.8, turn: 0.55, engine: 'inboard',
    helm: [0, 0, 1.8], seats: [[-1.8, 0, -5.6], [1.8, 0, -5.6]], cooler: [-1.6, 0, -3.6], fuel: [1.7, 0, -1.4],
    rodHolders: [[2.3, 0.5, -6.0], [-2.3, 0.5, -6.0], [2.3, 0.5, -4.4], [-2.3, 0.5, -4.4]], mount: [0, 0, 6.1], lights: [[0, 3.6, 2], [0, 1.4, 6.5], [-2.2, 2.4, -1.2], [2.2, 2.4, -1.2]],
    cabin: { z: 2.0, hw: 1.7, hl: 1.5, h: 2.4, open: false }, anchor: [1.1, 4.6], plates: true, ram: true,
    blurb: 'Riveted steel plate from keel to rail and a ram on the bow. It takes a beating like nothing else - and costs a fortune to fix when you finally break it.' },
  { id: 'deeprunner', name: 'The Deep Runner', tier: 4, price: 70000, yard: 'tide', stability: 0.85, deep: 0.9, repair: 1.2, cap: 4,
    hw: 2.1, hl: 7.6, deck: 1.0, draft: 1.8, mass: 11000, hp: 1600, cargoKg: 6000, waves: 4.8,
    speed: 20, accel: 4.5, turn: 0.7, engine: 'twin',
    helm: [0, 0, -2.0], seats: [[-1.5, 0, -6.4], [1.5, 0, -6.4]], cooler: [-1.4, 0, 2.4], fuel: [1.4, 0, -4.4],
    rodHolders: [[1.9, 0.5, -6.6], [-1.9, 0.5, -6.6], [1.9, 0.5, 1.4], [-1.9, 0.5, 1.4]], mount: [0, 0, 6.9], lights: [[0, 3.4, -2.2], [0, 1.4, 7.2], [-1.8, 2.2, 2], [1.8, 2.2, 2]],
    cabin: { z: -2.2, hw: 1.5, hl: 1.6, h: 2.3, open: false }, anchor: [0.9, 5.6], keel: true, sonarDome: true,
    blurb: 'Long, narrow, a keel like a knife. The Current Masters design her to run straight through water that spins other boats round.' },
  { id: 'stormbreaker', name: 'The Stormbreaker', tier: 4, price: 85000, yard: 'thunder', stability: 0.92, deep: 0.75, repair: 1.3, cap: 4,
    hw: 2.6, hl: 7.2, deck: 1.3, draft: 1.4, mass: 14000, hp: 2100, cargoKg: 5500, waves: 5.8,
    speed: 17.5, accel: 4, turn: 0.75, engine: 'inboard',
    helm: [0, 0, 1.6], seats: [[-1.9, 0, -5.8], [1.9, 0, -5.8]], cooler: [-1.7, 0, -4], fuel: [1.8, 0, -1.6],
    rodHolders: [[2.4, 0.5, -6.2], [-2.4, 0.5, -6.2], [2.4, 0.5, -4.6], [-2.4, 0.5, -4.6]], mount: [0, 0, 6.5], lights: [[0, 3.8, 1.8], [0, 1.6, 6.9], [-2.3, 2.6, -1.4], [2.3, 2.6, -1.4]],
    cabin: { z: 1.8, hw: 1.8, hl: 1.7, h: 2.5, open: false }, anchor: [1.2, 5.0], lightningRod: true, highBow: true,
    blurb: 'A storm cutter from Thunderpeak: a towering bow, a sealed wheelhouse and a lightning rod on the mast. Built to sail into the worst weather there is and come out the other side.' },
  { id: 'abyss', name: 'The Abyss', tier: 5, price: 110000, yard: 'abyssal', stability: 0.9, deep: 1.0, repair: 1.5, cap: 4,
    hw: 2.7, hl: 7.8, deck: 1.2, draft: 1.6, mass: 15000, hp: 2300, cargoKg: 9000, waves: 5.4,
    speed: 18.5, accel: 4.2, turn: 0.7, engine: 'twin',
    helm: [0, 0, 1.0], seats: [[-2.0, 0, -6.4], [2.0, 0, -6.4]], cooler: [-2, 0, -4.4], fuel: [2, 0, -1.8],
    rodHolders: [[2.5, 0.5, -6.8], [-2.5, 0.5, -6.8], [2.5, 0.5, -5.2], [-2.5, 0.5, -5.2], [2.5, 0.5, -3.6]], mount: [0, 0, 7.1], lights: [[0, 4.2, 1.2], [0, 1.5, 7.5], [-2.5, 2.8, -1.4], [2.5, 2.8, -1.4], [-2.5, 2.8, -5.4], [2.5, 2.8, -5.4]],
    cabin: { z: 1.2, hw: 1.6, hl: 1.8, h: 2.6, open: false }, anchor: [1.2, 5.6], sonarDome: true, glowStrips: true,
    blurb: 'Black hull, blue lights and deep sonar, built at the Abyssal Reach for the darkest water in the world. The second best boat in the sea.' },
  { id: 'expedition', name: 'The Leviathan Hunter', tier: 5, price: 180000, yard: 'reach', stability: 0.97, deep: 1.0, repair: 0.6, cap: 4,
    hw: 2.9, hl: 8.2, deck: 1.3, draft: 1.3, mass: 12000, hp: 3200, cargoKg: 16000, waves: 6.5,
    speed: 22, accel: 7.2, turn: 1.3, engine: 'twin',
    helm: [0, 0, 2.6], seats: [[-2.2, 0, -6.8], [2.2, 0, -6.8]], cooler: [-2, 0, -4.2], fuel: [2.2, 0, -1.6],
    rodHolders: [[2.7, 0.5, -7.4], [-2.7, 0.5, -7.4], [2.7, 0.5, -5.4], [-2.7, 0.5, -5.4], [2.7, 0.5, -3.4], [-2.7, 0.5, -3.4]],
    mount: [0, 0, 7.4], lights: [[0, 4.6, 2.6], [0, 1.6, 7.9], [-2.6, 3, -1], [2.6, 3, -1], [-2.6, 3, -6], [2.6, 3, -6]],
    cabin: { z: 2.8, hw: 2.0, hl: 1.9, h: 2.6, open: false }, crane: [2.1, 0, -2.2],
    blurb: 'The best boat in the sea, and there will never be a better one. Twin engines, floodlights, a harpoon cannon, a hull built for the edge of the world - and a trophy shelf in the galley.' },
  { id: 'wayfarer', name: 'The Wanderer', tier: 4, price: 45000, yard: 'crystal', stability: 0.8, deep: 0.6, repair: 1.1, cap: 4,
    hw: 3.3, hl: 9.5, deck: 2.2, draft: 1.5, mass: 20000, hp: 1500, cargoKg: 12000, waves: 4.4,
    speed: 17, accel: 2.6, turn: 0.5, engine: 'sail',
    helm: [0, 0, -7.6], seats: [[-2.4, 0, -8.2], [2.4, 0, -8.2]], cooler: [-2.2, 0, 5.4], fuel: null,
    rodHolders: [[3.0, 0.5, -8.4], [-3.0, 0.5, -8.4], [3.0, 0.5, -6.2], [-3.0, 0.5, -6.2], [3.0, 0.5, 6], [-3.0, 0.5, 6]],
    mount: [0, 0, 8.4], lights: [[0, 5.2, 3.6], [0, 1.4, 8.8], [-2.9, 2.4, -1], [2.9, 2.4, -1], [-2.9, 2.4, -6], [2.9, 2.4, -6]],
    cabin: null, masts: [[0, 3.8], [0, -2.6]], crane: [2.4, 0, -4.6],
    // the hold: a real room under the deck, down a hatch and a ladder
    hold: { z0: -5.6, z1: 3.4, hw: 2.3, floor: 0.35, hatch: [1.5, 2.5], hatchHW: 0.55, hatchHD: 0.6 },
    blurb: 'A proper ship from Captain Odile at the Crystal Reef. Two masts, a stern wheel, and a hold below deck with shelves, a workbench and room for a whole expedition\'s catch.' },
];
/* Where the anchor windlass sits on the foredeck (local x, z). The rope runs
   from it over a roller on the stem. `windage`: how hard the wind shoves it. */
const ANCHOR_AT = { dinghy: [0, 1.72], motor: [0.5, 2.2], trawler: [0.95, 4.0], expedition: [1.25, 6.0], wayfarer: [1.4, 6.6] };
/* The Leviathan Hunter was laid out at 2.9 x 8.2; it is built bigger than
   any ship in the sea, so everything on it is stretched to the new hull. */
function stretch(H, W, L) {
  const sx = W / H.hw, sz = L / H.hl;
  const p = a => a && (a.length === 3 ? [a[0] * sx, a[1], a[2] * sz] : [a[0] * sx, a[1] * sz]);
  H.hw = W; H.hl = L;
  for (const k of ['helm', 'cooler', 'fuel', 'mount', 'crane']) if (H[k]) H[k] = p(H[k]);
  for (const k of ['seats', 'rodHolders', 'lights']) if (H[k]) H[k] = H[k].map(p);
  if (H.cabin) H.cabin = { ...H.cabin, z: H.cabin.z * sz, hl: H.cabin.hl * Math.min(sz, 1.15), hw: H.cabin.hw * sx };
  if (ANCHOR_AT[H.id]) ANCHOR_AT[H.id] = p(ANCHOR_AT[H.id]);
}
stretch(HULLS.find(h => h.id === 'expedition'), 3.4, 9.8);
for (const H of HULLS) { H.anchor = H.anchor || ANCHOR_AT[H.id] || [0, H.hl * 0.7]; H.windage = H.windage ?? (H.engine === 'sail' ? 1.6 : 1); }
export const HULL_BY_ID = Object.fromEntries(HULLS.map(h => [h.id, h]));
/* The pirates' own ship: the Wanderer's frame, faster, meaner, a raised stern and gun ports.
   Never for sale, never in a yard, never in HULLS - only ever under a black flag. */
HULL_BY_ID.galley = { ...HULL_BY_ID.wayfarer, id: 'galley', name: 'Pirate Galley', tier: 9, price: 0, yard: null, npc: true,
  speed: 16, accel: 3.2, turn: 0.6, hp: 1900, mass: 17000, hold: null, windage: 1.2,
  blurb: 'Black sails, a skull the size of a door, and six guns.' };

/* Parts: a level per boat, carried over when you buy a new hull (capped). */
export const PARTS = [
  { id: 'engine', name: 'Engine', max: 4, prices: [0, 500, 1800, 5200, 12000],
    names: ['Stock', 'Tuned', 'Big Block', 'Racing', 'Jet'], fx: lv => ({ speed: 1 + lv * 0.14, accel: 1 + lv * 0.18 }),
    blurb: 'Top speed and acceleration. The Jet makes a noise like an angry kettle.' },
  { id: 'hull', name: 'Hull Plating', max: 4, prices: [0, 400, 1400, 4000, 9000],
    names: ['Planks', 'Tarred', 'Copper', 'Steel', 'Leviathan-bone'], fx: lv => ({ hp: 1 + lv * 0.35, waves: 1 + lv * 0.12 }),
    blurb: 'More hull points and better in heavy seas.' },
  { id: 'storage', name: 'Storage', max: 3, prices: [0, 350, 1200, 3600],
    names: ['Cooler', 'Ice Box', 'Fish Hold', 'Walk-in Freezer'], fx: lv => ({ cargo: 1 + lv * 0.6 }),
    blurb: 'How much fish you can carry before the boat starts to wallow.' },
  { id: 'lights', name: 'Lights', max: 3, prices: [0, 300, 1100, 3000],
    names: ['Lantern', 'Deck Lamps', 'Floodlights', 'Searchlight Array'], fx: lv => ({ lights: lv }),
    blurb: 'Needed in the Blackwater. Also makes night fishing much less terrifying.' },
  { id: 'mount', name: 'Harpoon Mount', max: 2, prices: [0, 1600, 5500],
    names: ['None', 'Harpoon Gun', 'Harpoon Cannon'], fx: lv => ({ mount: lv }),
    blurb: 'A mounted harpoon on the bow. Hurts giants a lot more than a thrown one.' },
  { id: 'sonar', name: 'Radar & Sonar', max: 2, prices: [0, 1200, 4200],
    names: ['None', 'Fish Finder', 'Deep Sonar'], fx: lv => ({ sonar: lv }),
    blurb: 'Shows fish, giants and hidden things on your HUD while you are aboard.' },
  { id: 'anchor', name: 'Anchor', max: 4, prices: [0, 450, 1600, 4800, 14000], yardLv: { 3: 'tide', 4: 'tide' },
    names: ['Stone & Rope', 'Iron Fluke', 'Danforth & Chain', 'Grapnel Claw', 'Leviathan Hook'], fx: lv => ({ anchor: lv }),
    blurb: 'Throw it over and the boat stops drifting. A heavier anchor holds in stronger currents, a longer rope reaches deeper water, and a better winch hauls it up faster. The two heaviest are only made at Tidebreaker.' },
  { id: 'keel', name: 'Current Keel', max: 3, prices: [0, 3500, 9000, 20000], yard: 'tide',
    names: ['None', 'Keel Fins', 'Deep Keel', 'Master\'s Keel'], fx: lv => ({ keel: lv }),
    blurb: 'Fins under the hull that bite into the water: the current carries you off course far less. Only the Current Masters on Tidebreaker fit them.' },
  { id: 'rod', name: 'Lightning Rod', max: 1, prices: [0, 7500], yard: 'thunder',
    names: ['None', 'Copper Lightning Rod'], fx: lv => ({ rod: lv }),
    blurb: 'A grounded copper rod on the mast. Lightning never strikes your boat. Sparks McGee fits them at Thunderpeak.' },
  { id: 'holders', name: 'Rod Holders', max: 3, prices: [0, 200, 700, 2000],
    names: ['None', 'One', 'Several', 'A Forest'], fx: lv => ({ holders: lv }),
    blurb: 'Leave extra lines in the water. A bell rings when one of them bites.' },
];
export const PART_BY_ID = Object.fromEntries(PARTS.map(p => [p.id, p]));

/* The anchor, level by level.
     hold   the push (current + wind + engine, scaled by the boat's weight) it
            holds against before it starts to drag along the bottom
     rope   metres of rope or chain: deeper water than this and it just hangs
     reel   metres a second you haul it back up
     sink   metres a second it drops through the water */
export const ANCHORS = [
  { name: 'Stone & Rope', hold: 1.0, rope: 32, reel: 1.7, sink: 2.4, throwV: 6.5, rope2: 0xc8a870, chain: false, winch: 'hand' },
  { name: 'Iron Fluke', hold: 2.0, rope: 60, reel: 2.5, sink: 3.2, throwV: 7, rope2: 0xb89868, chain: false, winch: 'crank' },
  { name: 'Danforth & Chain', hold: 3.2, rope: 110, reel: 3.5, sink: 4.2, throwV: 7.5, rope2: 0x8a8e94, chain: true, winch: 'crank' },
  { name: 'Grapnel Claw', hold: 4.8, rope: 180, reel: 5, sink: 5.2, throwV: 8, rope2: 0x6a6e74, chain: true, winch: 'winch' },
  { name: 'Leviathan Hook', hold: 7.5, rope: 320, reel: 7.5, sink: 6.5, throwV: 8.5, rope2: 0x3a3e46, chain: true, winch: 'winch' },
];
/** How much a boat of this mass leans on its anchor (a motorboat is 1). */
export const anchorLoad = mass => Math.pow(mass / 900, 0.35);

export const PAINTS = [
  { id: 'natural', name: 'Natural Wood', price: 0, hull: 0x8a6444, trim: 0xe8e0cc },
  { id: 'harbour', name: 'Harbour Blue', price: 150, hull: 0x2e5a86, trim: 0xf2eee2 },
  { id: 'lobster', name: 'Lobster Red', price: 150, hull: 0xb03a2e, trim: 0xf2eee2 },
  { id: 'moss', name: 'Moss Green', price: 150, hull: 0x3e6a3a, trim: 0xe8d8a8 },
  { id: 'sunset', name: 'Sunset Orange', price: 250, hull: 0xe07a2a, trim: 0x3a2a24 },
  { id: 'midnight', name: 'Midnight', price: 400, hull: 0x1e2230, trim: 0xd8b048 },
  { id: 'banana', name: 'Banana', price: 400, hull: 0xf0d040, trim: 0x3a3a3a },
  { id: 'bubblegum', name: 'Bubblegum', price: 600, hull: 0xf08ab8, trim: 0xffffff },
];
export const PAINT_BY_ID = Object.fromEntries(PAINTS.map(p => [p.id, p]));
// colours only other people's boats wear
Object.assign(PAINT_BY_ID, {
  rust: { id: 'rust', name: 'Rust', price: 0, hull: 0x7a4a2e, trim: 0xb8a890, npc: true },
  royal: { id: 'royal', name: 'Royal', price: 0, hull: 0xf2eee2, trim: 0xc8a040, npc: true },
  navy: { id: 'navy', name: 'Navy', price: 0, hull: 0x22305a, trim: 0xd8d0b8, npc: true },
  weathered: { id: 'weathered', name: 'Weathered', price: 0, hull: 0x6a6a64, trim: 0x8a8478, npc: true },
  slate: { id: 'slate', name: 'Slate', price: 0, hull: 0x3e4650, trim: 0xc8b048, npc: true },
  pirate: { id: 'pirate', name: 'Black Gull', price: 0, hull: 0x1a1614, trim: 0x7a1e1a, npc: true },
});

export const DECOR = [
  { id: 'flag', name: 'Guild Pennant', price: 100, blurb: 'A little flag on a pole. Very official.' },
  { id: 'gnome', name: 'Garden Gnome', price: 180, blurb: 'He watches the horizon. He has seen things.' },
  { id: 'flamingo', name: 'Plastic Flamingo', price: 220, blurb: 'Pink. Proud. Structurally unnecessary.' },
  { id: 'lanterns', name: 'String Lights', price: 350, blurb: 'Warm little lights along the rails. Perfect for sunset.' },
  { id: 'figurehead', name: 'Fish Figurehead', price: 900, blurb: 'A carved wooden fish on the bow, glaring at the sea.' },
  { id: 'disco', name: 'Disco Ball', price: 1500, blurb: 'Nobody asked for this.' },
];
export const DECOR_BY_ID = Object.fromEntries(DECOR.map(d => [d.id, d]));

/** Effective stats of a boat config {hull, parts:{}, paint, decor:[]}. */
/** The highest level of a part a hull can carry (its equipment capacity). */
export const partCap = (P, H) => Math.min(P.max, P.max >= 4 ? H.cap ?? 4 : Math.max(1, (H.cap ?? 4) - (4 - P.max)));
/** Where a level of a part can be bought: a particular island's yard, or any yard. */
export const partYard = (P, lv) => P.yardLv?.[lv] || P.yard || null;

export function boatStats(cfg) {
  const H = HULL_BY_ID[cfg.hull] || HULLS[0];
  const lv = id => Math.min(cfg.parts?.[id] || 0, partCap(PART_BY_ID[id], H));
  const e = PART_BY_ID.engine.fx(lv('engine')), h = PART_BY_ID.hull.fx(lv('hull')), s = PART_BY_ID.storage.fx(lv('storage'));
  return {
    hull: H,
    speed: H.speed * e.speed, accel: H.accel * e.accel, turn: H.turn,
    hp: Math.round(H.hp * h.hp), waves: H.waves * h.waves, cargoKg: Math.round(H.cargoKg * s.cargo),
    lights: Math.max(lv('lights'), H.glowStrips ? 2 : 0), mount: H.mount ? lv('mount') : 0, anchor: lv('anchor'), sonar: Math.max(lv('sonar'), H.sonarDome ? 1 : 0), holders: Math.min([0, 1, 3, 6][lv('holders')], H.rodHolders.length),
    keel: lv('keel'), rod: H.lightningRod ? 1 : lv('rod'),
    stability: H.stability ?? 0.5, deep: H.deep ?? 0, repair: H.repair ?? 1, cap: H.cap ?? 4,
    space: Math.round(H.hw * H.hl * 4 * 0.8), slots: H.rodHolders.length,
  };
}
