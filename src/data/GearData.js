/* GearData.js - rods, bait and equipment. Every stat here changes how
   fishing FEELS, not just a number in a tooltip.

   The fight is the Fish N Sticks bar: a catch zone you lift by holding
   the button and that sinks when you let go, chasing a fish that darts up
   and down the bar. The rod decides how that zone handles:

   rating   the heaviest FIGHT the rod can hold. A fish above it bleeds the
            catch meter even while you track it perfectly, so a starter rod
            can hook a monster and will never land one. That is the upgrade
            loop stated as a rule rather than a locked door.
   band     how much of the bar the catch zone covers
   lift     how hard the zone rises while held      fall  how fast it sinks
   control  damping - higher is steadier and easier to place
   line     metres of line (what the HUD shows while the fish runs)
   reel     how fast the line comes in (the crank you see turning)
   cast     launch speed of the bobber
   window   seconds you have to strike after a bite
   tier     what giants and leviathans require
   shop     which island's fish seller stocks it (see SHOPS) - rods are not
            all sold in one place; the farther you travel, the better they get */

export const RODS = [
  { id: 'basic', name: 'Basic Rod', tier: 1, price: 0, rating: 1.3, band: 0.20, lift: 4.2, fall: 2.3, control: 1.0,
    maxKg: 25, line: 40, reel: 3.2, cast: 15, tolerance: 1.0, window: 0.9, look: 'basic', shop: 'home',
    blank: 0x8a6a44, grip: 0x3a2a20, reelCol: 0x6a6a6a, accent: 0xb08a50,
    blurb: 'Your grandad\'s old rod. Good for the lakes and the harbour. Mostly held together by optimism.' },
  { id: 'reinforced', name: 'Reinforced Rod', tier: 2, price: 450, rating: 1.65, band: 0.21, lift: 4.7, fall: 2.3, control: 1.25,
    maxKg: 90, line: 70, reel: 4.4, cast: 20, tolerance: 1.25, window: 1.05, look: 'reinforced', shop: 'home',
    blank: 0x3a6aa8, grip: 0x1a1a22, reelCol: 0x2a3a5a, accent: 0x6ab0f0,
    blurb: 'Fibreglass, steel guides, a reel that clicks properly. For coastal water: pike, salmon, the odd tuna.' },
  { id: 'reef', name: 'Coral Whip', tier: 2, price: 1400, rating: 1.85, band: 0.24, lift: 5.0, fall: 2.35, control: 1.5,
    maxKg: 150, line: 90, reel: 5.0, cast: 24, tolerance: 1.3, window: 1.15, look: 'reef', shop: 'tropic',
    blank: 0xc8b070, grip: 0x3aa0a0, reelCol: 0xf0e4d0, accent: 0xf07a6a,
    blurb: 'Split cane from the Sunken Coast with coral grown right onto the grip. Whippy, quick and very forgiving.' },
  { id: 'deepwater', name: 'Deepwater Rod', tier: 3, price: 2600, rating: 2.05, band: 0.22, lift: 5.2, fall: 2.25, control: 1.55,
    maxKg: 300, line: 130, reel: 5.6, cast: 25, tolerance: 1.5, window: 1.2, look: 'deepwater', shop: 'tropic',
    blank: 0x2a3a2e, grip: 0x5a3a24, reelCol: 0xb08a3a, accent: 0xe8c060,
    blurb: 'Heavy blank, brass reel, 130 metres of braid. Built for offshore water and the big ones that live there.' },
  { id: 'icebreaker', name: 'Icebreaker', tier: 3, price: 4200, rating: 2.3, band: 0.22, lift: 5.5, fall: 2.25, control: 1.7,
    maxKg: 500, line: 150, reel: 5.8, cast: 22, tolerance: 1.6, window: 1.25, look: 'ice', shop: 'frost',
    blank: 0x9ac8e0, grip: 0x3a3a44, reelCol: 0xd8e8f0, accent: 0x5ab0e0,
    blurb: 'Short, stubby and absurdly strong. Ingrid builds them for ice holes and deep cold water. Wear mittens.' },
  { id: 'heavy', name: 'Heavy Rod', tier: 4, price: 7500, rating: 2.55, band: 0.23, lift: 5.7, fall: 2.2, control: 1.8,
    maxKg: 900, line: 190, reel: 6.4, cast: 27, tolerance: 1.7, window: 1.3, look: 'heavy', shop: 'open',
    blank: 0x2a2a30, grip: 0x3a3a3a, reelCol: 0x8a8a90, accent: 0xe8502a,
    blurb: 'Steel-cored, double grip, a winch for a reel. For deep water, giants and things with far too many teeth.' },
  { id: 'storm', name: 'Stormglass Rod', tier: 4, price: 12500, rating: 2.85, band: 0.24, lift: 6.0, fall: 2.2, control: 1.95,
    maxKg: 2000, line: 220, reel: 6.8, cast: 29, tolerance: 1.8, window: 1.35, look: 'storm', shop: 'open',
    blank: 0x4a6a8a, grip: 0x2a2a30, reelCol: 0xb87a3a, accent: 0x9af0ff,
    blurb: 'A glass blank wound with copper coil, capped with a lightning rod. The Keeper says it caught a storm once.' },
  { id: 'titan', name: 'Legendary Rod', tier: 5, price: 22000, rating: 3.3, band: 0.25, lift: 6.3, fall: 2.2, control: 2.1,
    maxKg: 99999, line: 260, reel: 7.2, cast: 30, tolerance: 1.9, window: 1.4, look: 'legendary', shop: 'reach',
    blank: 0x1a1a24, grip: 0x5a1a2a, reelCol: 0xd8b048, accent: 0x6af0ff,
    blurb: 'Forged from the lighthouse railing and wound with gold. It hums near leviathans. Strong enough to hold one - for a while.' },
  { id: 'oath', name: "Vigil's Oath", tier: 5, price: 48000, rating: 3.75, band: 0.26, lift: 6.6, fall: 2.2, control: 2.3,
    maxKg: 99999, line: 320, reel: 7.8, cast: 31, tolerance: 2.0, window: 1.5, look: 'oath', shop: 'reach',
    blank: 0xe8dcc0, grip: 0x3a2e28, reelCol: 0x9a7a4a, accent: 0xd8f0ff,
    blurb: 'Carved from a leviathan\'s rib by the first fishermen of Vigil\'s End. Six of them waited their whole lives to use it.' },
];
export const ROD_BY_ID = Object.fromEntries(RODS.map(r => [r.id, r]));

/* Where rods are sold: one fish seller per island, and each island stocks
   the rods for the water around it. */
export const SHOPS = {
  home:   { id: 'home',   npc: 'pim',    place: 'Driftwood Bay',   seller: 'Pim, next to your hut' },
  tropic: { id: 'tropic', npc: 'coco',   place: 'the Sunken Coast', seller: "Coco's tiki bar on the Sunken Coast" },
  frost:  { id: 'frost',  npc: 'ingrid', place: 'Frostbite Lake',  seller: 'Ingrid at Frostbite Lake' },
  open:   { id: 'open',   npc: 'keeper', place: 'the Old Lighthouse', seller: 'the Keeper at the Old Lighthouse' },
  reach:  { id: 'reach',  npc: 'maud',   place: "Vigil's End",     seller: "Maud at Vigil's End, at the edge of the sea" },
};

export const BAITS = [
  { id: 'worm', name: 'Worms', price: 2, pack: 10, bite: 1.0, col: 0xc87a6a,
    blurb: 'Classic. Everything in a lake will eat a worm.' },
  { id: 'pieces', name: 'Fish Pieces', price: 5, pack: 10, bite: 1.1, col: 0xd86a5a,
    blurb: 'Smelly chunks of fish. Predators and big fish love them.' },
  { id: 'glow', name: 'Glow Bait', price: 12, pack: 8, bite: 1.15, col: 0x7af0e0,
    blurb: 'Shines in the dark. Night fish, deep fish and ghosts cannot resist it.' },
  { id: 'explosive', name: 'Explosive Bait', price: 20, pack: 5, bite: 1.0, col: 0xe0402a,
    blurb: 'Goes off a few seconds after landing and stuns everything nearby. Also attracts Bombfish. Obviously.' },
  { id: 'magnetic', name: 'Magnetic Bait', price: 15, pack: 6, bite: 0.9, col: 0x9aa4b0,
    blurb: 'Fish do not like it. Treasure, junk, eels and Mimicfish love it.' },
  { id: 'mystery', name: 'Mystery Bait', price: 25, pack: 5, bite: 1.05, col: 0xb07af0,
    blurb: 'Nobody knows what is in it. Anything might bite. Anything.' },
];
export const BAIT_BY_ID = Object.fromEntries(BAITS.map(b => [b.id, b]));

/* Tools go on the hotbar. `slot` is their fixed hotbar position. */
export const TOOLS = [
  { id: 'rod', name: 'Fishing Rod', slot: 1, price: 0, owned: true, blurb: 'Hold left mouse to cast. Click when it bites. Hold to reel.' },
  { id: 'harpoon', name: 'Harpoon', slot: 2, price: 600, blurb: 'Throw with left mouse. Hits anything near the surface and reels back on its rope. Essential against giants.' },
  { id: 'net', name: 'Landing Net', slot: 3, price: 250, blurb: 'Scoop fish off the surface: stunned fish, migrations, a thief that got too close.' },
  { id: 'trap', name: 'Fishing Trap', slot: 4, price: 400, blurb: 'Drop it in the water from the boat or a pier. Come back later to see what walked in.' },
  { id: 'hammer', name: 'Repair Hammer', slot: 5, price: 0, owned: true, blurb: 'Hold left mouse on a leak or a cracked plank to fix it.' },
  { id: 'bucket', name: 'Bucket', slot: 6, price: 0, owned: true, blurb: 'Throws water: puts out fires and bails out a flooding boat.' },
  { id: 'camera', name: 'Camera', slot: 7, price: 150, blurb: 'Take a photo. The good ones go on the wall of your cabin.' },
  { id: 'grapple', name: 'Grappling Hook', slot: 8, price: 1800, blurb: 'Fire at rock, wood or a boat to pull yourself across. Also yanks loose things toward you.' },
  { id: 'auger', name: 'Ice Auger', slot: 9, price: 300, blurb: 'Drill a fishing hole through the ice at Frostbite Lake.' },
  { id: 'axe', name: 'Hand Axe', slot: 0, price: 0, owned: true, blurb: 'Splits firewood. Also, it turns out, the only thing a kraken respects. Press E next to a tentacle to chop it.' },
];
export const TOOL_BY_ID = Object.fromEntries(TOOLS.map(t => [t.id, t]));

/* Passive gear. */
export const GEAR = [
  { id: 'diving', name: 'Diving Gear', price: 1500, blurb: 'Mask and air tank: 90 seconds underwater instead of 20, and you swim faster.' },
  { id: 'sonar', name: 'Handheld Sonar', price: 900, blurb: 'Pings the water around you. Shows fish schools, giants and anything very large and very quiet.' },
  { id: 'lucky', name: 'Lucky Hat', price: 2400, blurb: 'Bigger fish. Rarer fish. Nobody knows why. Do not wash it.' },
  { id: 'gloves', name: 'Rubber Gloves', price: 350, blurb: 'Grab an Electric Eel without being electrocuted. Mostly.' },
];
export const GEAR_BY_ID = Object.fromEntries(GEAR.map(g => [g.id, g]));
