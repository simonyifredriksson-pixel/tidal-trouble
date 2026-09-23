/* GearData.js - rods, bait and equipment. Every stat here changes how
   fishing FEELS, not just a number in a tooltip:

   maxKg      heaviest fish the line survives without snapping at full tension
   line       metres of line: a fish that runs further than this breaks it
   reel       metres per second reeled at full crank
   cast       launch speed of the bobber (casting distance)
   tolerance  how much tension headroom before the line starts to fray
   window     seconds you have to strike after a bite
   tier       what giants/leviathans require */

export const RODS = [
  { id: 'basic', name: 'Basic Rod', tier: 1, price: 0, maxKg: 22, line: 40, reel: 3.2, cast: 15, tolerance: 1.0, window: 0.9,
    blank: 0x8a6a44, grip: 0x3a2a20, reelCol: 0x6a6a6a, accent: 0xb08a50,
    blurb: 'Your grandad\'s old rod. Mostly held together by optimism.' },
  { id: 'reinforced', name: 'Reinforced Rod', tier: 2, price: 450, maxKg: 90, line: 70, reel: 4.4, cast: 20, tolerance: 1.25, window: 1.05,
    blank: 0x3a6aa8, grip: 0x1a1a22, reelCol: 0x2a3a5a, accent: 0x6ab0f0,
    blurb: 'Fibreglass, steel guides, a reel that clicks properly. Handles pike and tuna.' },
  { id: 'deepwater', name: 'Deepwater Rod', tier: 3, price: 2800, maxKg: 420, line: 130, reel: 5.6, cast: 25, tolerance: 1.5, window: 1.2,
    blank: 0x2a3a2e, grip: 0x5a3a24, reelCol: 0xb08a3a, accent: 0xe8c060,
    blurb: 'Heavy blank, brass reel, 130 metres of braid. For the open sea and for giants.' },
  { id: 'titan', name: 'Titan Rod', tier: 4, price: 14000, maxKg: 99999, line: 260, reel: 7.2, cast: 30, tolerance: 1.9, window: 1.4,
    blank: 0x1a1a24, grip: 0x8a2a2a, reelCol: 0xd8d8e0, accent: 0xff7a3a,
    blurb: 'Forged from a lighthouse railing. The only rod in the bay that has landed a leviathan.' },
];
export const ROD_BY_ID = Object.fromEntries(RODS.map(r => [r.id, r]));

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
