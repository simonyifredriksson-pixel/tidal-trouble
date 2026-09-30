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
  /* ---- the far islands: each sells the rod for its own water ---- */
  { id: 'willow', name: 'Whisperwillow', tier: 3, price: 5200, rating: 2.2, band: 0.26, lift: 5.0, fall: 2.3, control: 2.0,
    maxKg: 400, line: 140, reel: 5.6, cast: 25, tolerance: 1.5, window: 1.35, look: 'willow', shop: 'whisper',
    blank: 0x8a7a50, grip: 0x6a5a3a, reelCol: 0x5a4a2e, accent: 0x8ac85a,
    blurb: 'A willow wand still putting out leaves. Soft, steady and wonderfully forgiving - made for the hidden lakes of Whispering Woods.' },
  { id: 'magma', name: 'Magma Rod', tier: 3, price: 6800, rating: 2.45, band: 0.23, lift: 5.6, fall: 2.25, control: 1.75,
    maxKg: 650, line: 160, reel: 6.0, cast: 26, tolerance: 1.6, window: 1.25, look: 'magma', shop: 'sunscar',
    blank: 0x2a2626, grip: 0x5a2a1e, reelCol: 0x3a3434, accent: 0xff7a2a,
    blurb: 'Basalt forged in the Sunscar vents. The cracks in it still glow. Heat does not bother it - neither do vent fish.' },
  { id: 'skyline', name: 'Skyline Rod', tier: 3, price: 6200, rating: 2.35, band: 0.23, lift: 5.4, fall: 2.3, control: 1.7,
    maxKg: 550, line: 300, reel: 7.2, cast: 36, tolerance: 1.55, window: 1.3, look: 'skyline', shop: 'skywatch',
    blank: 0xf2f2ee, grip: 0x3a5a7a, reelCol: 0xd8d8d0, accent: 0x5a8ab0,
    blurb: 'Three hundred metres of braid on a reel the size of a plate. The Eyrie fishers cast it off a ninety-metre cliff.' },
  { id: 'prism', name: 'Prism Rod', tier: 4, price: 9800, rating: 2.65, band: 0.27, lift: 5.8, fall: 2.2, control: 2.1,
    maxKg: 900, line: 180, reel: 6.4, cast: 27, tolerance: 1.7, window: 1.4, look: 'prism', shop: 'crystal',
    blank: 0xc8f0f0, grip: 0x3a9aa8, reelCol: 0xb8e0f0, accent: 0x9af0f0,
    blurb: 'A crystal blank grown in the lagoon. A wide, calm catch zone and a glow that brightens when lagoon fish are near.' },
  { id: 'glacier', name: 'Glacier Rod', tier: 4, price: 11000, rating: 2.8, band: 0.23, lift: 5.9, fall: 2.2, control: 1.9,
    maxKg: 1500, line: 200, reel: 6.4, cast: 24, tolerance: 1.75, window: 1.3, look: 'glacier', shop: 'frostfall',
    blank: 0xb8d8ec, grip: 0xe8e0d0, reelCol: 0xd8f0fa, accent: 0x3a6a9a,
    blurb: 'Halvard\'s answer to the Icebreaker: longer, stronger, with a reel sealed in a block of glacier ice. Rated to forty below.' },
  { id: 'bogwood', name: 'Bogwood Rod', tier: 4, price: 10500, rating: 2.75, band: 0.24, lift: 5.8, fall: 2.25, control: 1.85,
    maxKg: 1300, line: 190, reel: 6.2, cast: 25, tolerance: 1.7, window: 1.35, look: 'bogwood', shop: 'dread',
    blank: 0x2e2a22, grip: 0x5a7a3a, reelCol: 0x3a3226, accent: 0xd8f080,
    blurb: 'A twisted root from the heart of Dreadmire, three hundred years in the mud and harder than iron. A little lantern at the tip.' },
  { id: 'riptide', name: 'Riptide Rod', tier: 5, price: 24000, rating: 3.15, band: 0.24, lift: 6.3, fall: 2.2, control: 2.1,
    maxKg: 4000, line: 240, reel: 6.6, cast: 27, tolerance: 1.85, window: 1.4, look: 'riptide', shop: 'tide',
    blank: 0x2a7a7a, grip: 0xd8c89a, reelCol: 0x2a4a5a, accent: 0xd8b048,
    blurb: 'Short, thick and geared low. The Current Masters built it for fish that use the rip against you.' },
  { id: 'bolt', name: 'Thunderstruck', tier: 5, price: 23000, rating: 3.1, band: 0.24, lift: 6.2, fall: 2.2, control: 2.05,
    maxKg: 3500, line: 240, reel: 7.0, cast: 30, tolerance: 1.85, window: 1.45, look: 'bolt', shop: 'thunder',
    blank: 0x22222a, grip: 0x1a1a20, reelCol: 0x2a2a30, accent: 0xb8e8ff,
    blurb: 'Grounded, copper-strapped and rated for a direct strike. Twice. Storm fish can feel it humming.' },
  { id: 'crownrod', name: 'Crown Rod', tier: 5, price: 26000, rating: 3.25, band: 0.25, lift: 6.3, fall: 2.2, control: 2.15,
    maxKg: 5000, line: 250, reel: 7.0, cast: 29, tolerance: 1.9, window: 1.45, look: 'crown', shop: 'crown',
    blank: 0xf0e8d0, grip: 0xd8b048, reelCol: 0xd8b048, accent: 0xe03a4a,
    blurb: 'Ivory and gold from the drowned treasury, a ruby in the butt. Heavy, beautiful, and very strong.' },
  { id: 'abyssalrod', name: 'Abyssal Rod', tier: 5, price: 38000, rating: 3.55, band: 0.25, lift: 6.5, fall: 2.2, control: 2.2,
    maxKg: 99999, line: 300, reel: 7.4, cast: 30, tolerance: 1.95, window: 1.45, look: 'abyssal', shop: 'abyssal',
    blank: 0x1a1a24, grip: 0x14141c, reelCol: 0x2a2a3a, accent: 0x6a7af0,
    blurb: 'Pressure-black, ribbed like deep-sea cable, a blue lantern lure on the tip. Built to hold the biggest fish that are not leviathans.' },
];
export const ROD_BY_ID = Object.fromEntries(RODS.map(r => [r.id, r]));

/* Where things are sold: every island has its own fish seller and its own
   outfitter, and each stocks the rods and gear for the water around it. */
export const SHOPS = {
  home:   { id: 'home',   npc: 'pim',    place: 'Driftwood Bay',   seller: 'Pim, next to your hut', outfit: "Melvin's Bait & Tackle" },
  tropic: { id: 'tropic', npc: 'coco',   place: 'the Sunken Coast', seller: "Coco's tiki bar on the Sunken Coast", outfit: "Coco's Trading Post" },
  frost:  { id: 'frost',  npc: 'ingrid', place: 'Frostbite Lake',  seller: 'Ingrid at Frostbite Lake', outfit: "Ingrid's Ice Gear" },
  open:   { id: 'open',   npc: 'keeper', place: 'the Old Lighthouse', seller: 'the Keeper at the Old Lighthouse' },
  reach:  { id: 'reach',  npc: 'maud',   place: "Vigil's End",     seller: "Maud at Vigil's End, at the edge of the sea" },
  whisper:   { id: 'whisper',   npc: 'hazel',  place: 'Whispering Woods', seller: 'Hazel at Woodsmoke Camp, Whispering Woods', outfit: "Old Bram's Forest Stores" },
  sunscar:   { id: 'sunscar',   npc: 'kaia',   place: 'the Sunscar Archipelago', seller: 'Kaia in Emberhaven, on Sunscar', outfit: "Dunn's Forge" },
  skywatch:  { id: 'skywatch',  npc: 'wren',   place: 'Skywatch Isle', seller: 'Wren up in the Eyrie on Skywatch', outfit: "Captain Aldous's Cliff Supplies" },
  crystal:   { id: 'crystal',   npc: 'marisol', place: 'the Crystal Reef', seller: 'Doctor Vane at Glasswater Camp on the Crystal Reef', outfit: "Lumen's Lagoon Shop" },
  frostfall: { id: 'frostfall', npc: 'sigrun', place: 'Frostfall', seller: 'Sigrun at Rime Camp on Frostfall', outfit: "Halvard's Augers & Thermals" },
  dread:     { id: 'dread',     npc: 'nettle', place: 'Dreadmire', seller: 'Mother Nettle in the Stilt Houses of Dreadmire', outfit: "Silt's Swamp Goods" },
  ironwreck: { id: 'ironwreck', npc: 'rusty',  place: 'Ironwreck', seller: 'Rusty in Salvage Town on Ironwreck', outfit: "Vex's Salvage & Diving" },
  lost:      { id: 'lost',      npc: 'wyn',    place: 'the Lost Shores', seller: 'Wyn the Hermit on the Lost Shores', outfit: "What the Villagers Left" },
  thunder:   { id: 'thunder',   npc: 'juno',   place: 'Thunderpeak', seller: 'Juno at Stormwatch Station on Thunderpeak', outfit: "Sparks's Storm Gear" },
  tide:      { id: 'tide',      npc: 'marin',  place: 'Tidebreaker', seller: 'Marin at the Current Masters\' dock on Tidebreaker', outfit: 'The Current Masters' },
  crown:     { id: 'crown',     npc: 'amara',  place: 'the Sunken Crown', seller: 'Regent Amara at the Crown Dock', outfit: "Goldtooth's Treasure Supplies" },
  abyssal:   { id: 'abyssal',   npc: 'ysolde', place: 'the Abyssal Reach', seller: 'Keeper Ysolde at the Deep Light', outfit: "Doctor Fathom's Deep Kit" },
  blackflag: { id: 'blackflag', npc: 'rattigan', place: 'Blackflag Isle', seller: 'Rattigan the Fence on Blackflag Isle', outfit: "Rattigan's Black Market", hidden: true },
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
  // the far islands' baits: sold only where the fish that love them live
  { id: 'grub', name: 'Woodgrubs', price: 14, pack: 10, bite: 1.1, col: 0xe8d8a8, icon: 'worm', shop: 'whisper',
    blurb: 'Fat white grubs from the rotten logs of Whispering Woods. The lake fish there will not look at anything else.' },
  { id: 'lava', name: 'Volcanic Bait', price: 30, pack: 8, bite: 1.1, col: 0xff6a2a, icon: 'fire', shop: 'sunscar',
    blurb: 'Sulphur paste baked on a vent. Smells like a bad egg on fire. The vent fish love it.' },
  { id: 'feather', name: 'Sky Bait', price: 26, pack: 8, bite: 1.1, col: 0xf2ead4, icon: 'star', shop: 'skywatch',
    blurb: 'A feathered lure that flutters all the way down the cliff. The fish at the foot of Skywatch go straight for it.' },
  { id: 'dust', name: 'Crystal Dust', price: 40, pack: 6, bite: 1.15, col: 0x9af0f0, icon: 'crystal', shop: 'crystal',
    blurb: 'Ground from fallen spires. It sparkles in the water. The glass fish of the lagoon only bite on this.' },
  { id: 'krill', name: 'Frozen Krill', price: 36, pack: 8, bite: 1.1, col: 0xf0a0a0, icon: 'pieces', shop: 'frostfall',
    blurb: 'A brick of frozen krill. The glacier fish have never eaten anything warm and never will.' },
  { id: 'leech', name: 'Mire Leeches', price: 34, pack: 8, bite: 1.15, col: 0x3a3a26, icon: 'worm', shop: 'dread',
    blurb: 'Hold them by the fat end. The things in the Dreadmire channels go mad for them.' },
  { id: 'charged', name: 'Charged Bait', price: 60, pack: 6, bite: 1.15, col: 0xb8e8ff, icon: 'storm', shop: 'thunder',
    blurb: 'It fizzes in your hand. Storm fish can feel it from a mile away - lightning or no lightning.' },
  { id: 'current', name: 'Rip Minnows', price: 55, pack: 8, bite: 1.15, col: 0x6ab0c8, icon: 'fish', shop: 'tide',
    blurb: 'Live minnows raised in the Tidebreaker race. They swim hard against the current and the big fish notice.' },
  { id: 'royal', name: 'Royal Jelly', price: 80, pack: 5, bite: 1.1, col: 0xd8b048, icon: 'crown', shop: 'crown',
    blurb: 'A golden paste the old kings fed their pond fish. The throne room fish still remember the taste.' },
  { id: 'ghost', name: 'Ghost Bait', price: 45, pack: 6, bite: 1.05, col: 0xd8e0e0, icon: 'ghost', shop: 'lost',
    blurb: 'Nobody will say what it is made of. The Lost Shores fish rise to it in the fog.' },
  { id: 'deep', name: 'Deep Lure', price: 120, pack: 5, bite: 1.2, col: 0x6a7af0, icon: 'glow', shop: 'abyssal',
    blurb: 'A lure that glows blue in black water a mile down. The trench giants come up for it.' },
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
  { id: 'auger', name: 'Ice Auger', slot: 9, price: 900, shop: 'frostfall', blurb: 'Drill a fishing hole through any ice. Halvard at Frostfall makes every one in the sea - you will not find one anywhere else.' },
  { id: 'axe', name: 'Hand Axe', slot: 0, price: 0, owned: true, blurb: 'Chops trees for wood and cuts bushes for fibre (left mouse). Also, it turns out, the only thing a kraken respects: press E next to a tentacle to chop it.' },
  { id: 'pick', name: 'Pickaxe', slot: '-', key: 'Minus', price: 0, owned: true, blurb: 'Breaks rock for stone (left mouse). Black rock gives iron ore, reef crystal gives crystal.' },
  { id: 'plans', name: 'Blueprint Book', slot: '=', key: 'Equal', price: 0, owned: true, blurb: 'Every plan the islanders know. Left mouse to open it and lay a blueprint out on the ground; then carry the materials to it (G) and build it piece by piece (E).' },
];
/* Weapons: for trouble at sea - boarders, a crew that did not like you taking their catch.
   dmg per hit (per pellet for the blunderbuss), knock = how hard it shoves, rate = seconds between,
   hull = how much of a hit a ship's hull takes. Fishing is still the point. */
TOOLS.push(
  { id: 'pin', name: 'Belaying Pin', kind: 'weapon', price: 250, shop: 'home', melee: true, dmg: 20, knock: 5.4, reach: 2.2, rate: 0.6, hull: 0.1,
    blurb: 'A hardwood pin off a ship\'s rail. Clubs a sailor off his feet - and, if he is near the rail, over the side.' },
  { id: 'cutlass', name: 'Rusty Cutlass', kind: 'weapon', price: 1800, shop: 'ironwreck', melee: true, dmg: 34, knock: 3.4, reach: 2.4, rate: 0.5, hull: 0.25,
    blurb: 'Notched and rusty and fished out of a wreck. Quick in the hand. Vex swears it was a captain\'s.' },
  { id: 'pistol', name: 'Barnacle Flintlock', kind: 'weapon', price: 3200, shop: 'sunscar', dmg: 42, knock: 1.8, range: 48, rate: 1.5, hull: 0.5,
    blurb: 'One shot, a cloud of smoke and a reload. Dunn forges them in Emberhaven for people who fish the pirate water.' },
  { id: 'blunder', name: 'Brine Blunderbuss', kind: 'weapon', price: 6500, shop: 'thunder', dmg: 13, pellets: 7, knock: 6.5, range: 17, rate: 2.4, hull: 0.9,
    blurb: 'A brass bell of a gun that throws a fistful of shot. Clears a deck. Knocks boarders into the sea. Punches holes in hulls.' },
);
export const TOOL_BY_ID = Object.fromEntries(TOOLS.map(t => [t.id, t]));
export const WEAPONS = TOOLS.filter(t => t.kind === 'weapon');

/* Passive gear. */
export const GEAR = [
  { id: 'diving', name: 'Diving Gear', price: 1500, blurb: 'Mask and air tank: 90 seconds underwater instead of 20, and you swim faster.' },
  { id: 'sonar', name: 'Handheld Sonar', price: 900, blurb: 'Pings the water around you. Shows fish schools, giants and anything very large and very quiet.' },
  { id: 'lucky', name: 'Lucky Hat', price: 2400, blurb: 'Bigger fish. Rarer fish. Nobody knows why. Do not wash it.' },
  { id: 'gloves', name: 'Rubber Gloves', price: 350, blurb: 'Grab an Electric Eel without being electrocuted. Mostly.' },
  // the far islands: gear you can only buy in one place, for that place
  { id: 'moth', name: 'Moth Lantern', price: 2800, shop: 'whisper', icon: 'light', blurb: 'Hang it by the water at night and the lake fish come up to look. Lake and river bites come much faster after dark.' },
  { id: 'heatsuit', name: 'Heat Suit', price: 4800, shop: 'sunscar', icon: 'fire', blurb: 'Asbestos-free, probably. Falling volcanic rock and scalding vent water will not hurt you, and your boat will not catch from the embers.' },
  { id: 'harness', name: 'Cliff Harness', price: 2600, shop: 'skywatch', icon: 'lift', blurb: 'You can fall off anything and walk away. No more fall damage, anywhere.' },
  { id: 'prismlens', name: 'Prism Lens', price: 5500, shop: 'crystal', icon: 'crystal', blurb: 'A crystal eyeglass that sees fish in the dark. At night everything bites faster and rare fish come more often.' },
  { id: 'thermal', name: 'Thermal Suit', price: 5200, shop: 'frostfall', icon: 'mountain', blurb: 'Without one, the night cold on Frostfall will hurt you. With one, you can fish the glacier all night.' },
  { id: 'foglamp', name: 'Fog Lamp', price: 4600, shop: 'dread', icon: 'light', blurb: 'A lamp that burns something green. It pushes fog back - in Dreadmire, the Lost Shores and even at Vigil\'s End.' },
  { id: 'wreckdiver', name: 'Wreck Diving Suit', price: 9000, shop: 'ironwreck', icon: 'diving', blurb: 'A brass helmet and a proper air tank: three minutes underwater, faster swimming, and you can salvage the wrecks.' },
  { id: 'magnet', name: 'Salvage Magnet', price: 6500, shop: 'ironwreck', icon: 'magnetic', blurb: 'A great iron magnet on the line. Treasure, strongboxes and junk come up twice as often.' },
  { id: 'patchkit', name: 'Patch Kit', price: 3200, shop: 'ironwreck', icon: 'hammer', blurb: 'Steel plates, rivets and tar. Your hammer fixes holes and breaks twice as fast.' },
  { id: 'compass', name: 'Old Compass', price: 7000, shop: 'lost', icon: 'compass', blurb: 'Its needle does not point north. It points to the nearest island you have never set foot on.' },
  { id: 'charts', name: 'Current Charts', price: 8500, shop: 'tide', icon: 'current', blurb: 'The Current Masters\' charts: the map shows which way the water runs everywhere you have been.' },
  { id: 'relicbag', name: 'Relic Satchel', price: 12000, shop: 'crown', icon: 'crown', blurb: 'Every relic you bring up out of the drowned city sells for twice as much.' },
  { id: 'pressure', name: 'Pressure Line', price: 16000, shop: 'abyssal', icon: 'abyss', blurb: 'Line that will not part under a mile of water. In deep water your rod holds as if it were a size stronger.' },
];
export const GEAR_BY_ID = Object.fromEntries(GEAR.map(g => [g.id, g]));

/** Where a piece of gear, a tool or a bait is sold ('home' = Melvin's). Common baits are sold everywhere. */
export const shopOf = item => item.shop || 'home';
export const soldAt = (item, shop, kind) => kind === 'bait' && !item.shop ? true : shopOf(item) === (shop || 'home');
