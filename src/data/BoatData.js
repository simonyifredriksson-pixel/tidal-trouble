/* BoatData.js - the four hulls and every part you can bolt onto them.

   Boat frame: +Z is the bow, the deck is at y = deck above the waterline,
   the deck is a rectangle of half-width hw and half-length hl. Everything a
   player can stand on, bump into or use is described here so the physics,
   the art and the co-op sync all read the same numbers.

   waves   the swell amplitude the hull shrugs off. Above it the boat ships
           water and takes damage - which is what gates the Open Sea. */

export const HULLS = [
  { id: 'dinghy', name: 'The Soggy Biscuit', tier: 1, price: 0,
    hw: 0.85, hl: 2.3, deck: 0.35, draft: 0.35, mass: 250, hp: 100, cargoKg: 180, waves: 0.75,
    speed: 7.5, accel: 2.6, turn: 1.25, engine: 'outboard',
    helm: [0, 0, -1.9], seats: [[0, 0, -1.2], [0, 0, 0.4]], cooler: [0, 0, 1.2], fuel: null,
    rodHolders: [[0.7, 0.3, -1.5]], mount: null, lights: [[0, 0.9, 2.1]], cabin: null,
    blurb: 'A wooden rowboat with an outboard motor older than you. It floats. Usually.' },
  { id: 'motor', name: 'Motorboat', tier: 2, price: 2600,
    hw: 1.25, hl: 3.4, deck: 0.55, draft: 0.5, mass: 900, hp: 240, cargoKg: 600, waves: 1.6,
    speed: 14, accel: 4.2, turn: 1.0, engine: 'outboard',
    helm: [0, 0, -0.9], seats: [[-0.7, 0, -2.4], [0.7, 0, -2.4]], cooler: [-0.6, 0, 1.4], fuel: [0.8, 0, -2.6],
    rodHolders: [[1.1, 0.4, -2.6], [-1.1, 0.4, -2.6]], mount: [0, 0, 2.7], lights: [[0, 1.6, -0.6], [0, 0.9, 3.2]], cabin: { z: -0.4, hw: 0.9, hl: 0.5, h: 1.3, open: true },
    blurb: 'A proper motorboat with a windscreen, a fuel tank you should not hit, and room for two friends.' },
  { id: 'trawler', name: 'Heavy Fishing Vessel', tier: 3, price: 9500,
    hw: 2.1, hl: 5.6, deck: 0.9, draft: 0.9, mass: 4200, hp: 560, cargoKg: 2400, waves: 2.8,
    speed: 12.5, accel: 3.2, turn: 0.7, engine: 'inboard',
    helm: [0, 0, 1.4], seats: [[-1.4, 0, -4.4], [1.4, 0, -4.4]], cooler: [-1.2, 0, -2.6], fuel: [1.4, 0, -1.2],
    rodHolders: [[1.9, 0.5, -4.8], [-1.9, 0.5, -4.8], [1.9, 0.5, -3.2], [-1.9, 0.5, -3.2]], mount: [0, 0, 4.9], lights: [[0, 3.2, 1.4], [0, 1.2, 5.2], [-1.8, 2.2, -1], [1.8, 2.2, -1]],
    cabin: { z: 1.6, hw: 1.5, hl: 1.3, h: 2.2, open: false }, crane: [1.5, 0, -1.8],
    blurb: 'A steel trawler with a wheelhouse, a crane and a deck big enough to land a small whale.' },
  { id: 'expedition', name: 'The Leviathan Hunter', tier: 4, price: 32000,
    hw: 2.9, hl: 8.2, deck: 1.3, draft: 1.3, mass: 12000, hp: 1200, cargoKg: 8000, waves: 4.2,
    speed: 19, accel: 4.4, turn: 0.62, engine: 'twin',
    helm: [0, 0, 2.6], seats: [[-2.2, 0, -6.8], [2.2, 0, -6.8]], cooler: [-2, 0, -4.2], fuel: [2.2, 0, -1.6],
    rodHolders: [[2.7, 0.5, -7.4], [-2.7, 0.5, -7.4], [2.7, 0.5, -5.4], [-2.7, 0.5, -5.4], [2.7, 0.5, -3.4], [-2.7, 0.5, -3.4]],
    mount: [0, 0, 7.4], lights: [[0, 4.6, 2.6], [0, 1.6, 7.9], [-2.6, 3, -1], [2.6, 3, -1], [-2.6, 3, -6], [2.6, 3, -6]],
    cabin: { z: 2.8, hw: 2.0, hl: 1.9, h: 2.6, open: false }, crane: [2.1, 0, -2.2],
    blurb: 'Absolutely ridiculous. Twin engines, floodlights, a harpoon cannon and a trophy shelf in the galley.' },
  { id: 'wayfarer', name: 'The Wayfarer', tier: 5, price: 60000,
    hw: 3.3, hl: 9.5, deck: 2.2, draft: 1.5, mass: 20000, hp: 1800, cargoKg: 14000, waves: 5,
    speed: 17, accel: 2.6, turn: 0.5, engine: 'sail',
    helm: [0, 0, -7.6], seats: [[-2.4, 0, -8.2], [2.4, 0, -8.2]], cooler: [-2.2, 0, 5.4], fuel: null,
    rodHolders: [[3.0, 0.5, -8.4], [-3.0, 0.5, -8.4], [3.0, 0.5, -6.2], [-3.0, 0.5, -6.2], [3.0, 0.5, 6], [-3.0, 0.5, 6]],
    mount: [0, 0, 8.4], lights: [[0, 5.2, 3.6], [0, 1.4, 8.8], [-2.9, 2.4, -1], [2.9, 2.4, -1], [-2.9, 2.4, -6], [2.9, 2.4, -6]],
    cabin: null, masts: [[0, 3.8], [0, -2.6]], crane: [2.4, 0, -4.6],
    // the hold: a real room under the deck, down a hatch and a ladder
    hold: { z0: -5.6, z1: 3.4, hw: 2.3, floor: 0.35, hatch: [1.5, 2.5], hatchHW: 0.55, hatchHD: 0.6 },
    blurb: 'A proper ship. Two masts, a stern wheel, and a hold below deck with shelves, a workbench and room for a whole expedition\'s catch.' },
];
export const HULL_BY_ID = Object.fromEntries(HULLS.map(h => [h.id, h]));

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
  { id: 'holders', name: 'Rod Holders', max: 3, prices: [0, 200, 700, 2000],
    names: ['None', 'One', 'Several', 'A Forest'], fx: lv => ({ holders: lv }),
    blurb: 'Leave extra lines in the water. A bell rings when one of them bites.' },
];
export const PART_BY_ID = Object.fromEntries(PARTS.map(p => [p.id, p]));

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
export function boatStats(cfg) {
  const H = HULL_BY_ID[cfg.hull] || HULLS[0];
  const lv = id => Math.min(cfg.parts?.[id] || 0, PART_BY_ID[id].max);
  const e = PART_BY_ID.engine.fx(lv('engine')), h = PART_BY_ID.hull.fx(lv('hull')), s = PART_BY_ID.storage.fx(lv('storage'));
  return {
    hull: H,
    speed: H.speed * e.speed, accel: H.accel * e.accel, turn: H.turn,
    hp: Math.round(H.hp * h.hp), waves: H.waves * h.waves, cargoKg: Math.round(H.cargoKg * s.cargo),
    lights: lv('lights'), mount: H.mount ? lv('mount') : 0, sonar: lv('sonar'), holders: Math.min([0, 1, 3, 6][lv('holders')], H.rodHolders.length),
  };
}
