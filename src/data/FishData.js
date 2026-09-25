/* FishData.js - every living (and unliving) thing on the end of a line.

   A species is one entry. Nothing else in the game knows it exists: the
   bite roll, the fight, the art, the journal and the market all read it
   from here.

   where    region ids it lives in (home frost tropic open black), or 'all'
   water    'lake' (inside a lake), 'sea', 'ice' (through an ice hole), 'any'
   time     'any' | 'day' | 'night' | 'dusk'
   bait     affinity per bait id; missing = 0.35. 0 means it never bites that.
   kg, cm   size range; a catch rolls a size and both scale together
   value    coins at the MIDDLE of the size range
   fight    power (pull), stamina, erratic (direction changes), jump
   beh      special behaviour, see Fishing.js / Loot.js
   art      body genome for FishArt.js */

export const RARITY = {
  common:    { id: 'common',    name: 'Common',    css: '#c9c2a8', w: 60 },
  uncommon:  { id: 'uncommon',  name: 'Uncommon',  css: '#7fd07a', w: 26 },
  rare:      { id: 'rare',      name: 'Rare',      css: '#5ab4f0', w: 10 },
  epic:      { id: 'epic',      name: 'Epic',      css: '#c07af0', w: 3.2 },
  legendary: { id: 'legendary', name: 'Legendary', css: '#f2b33a', w: 0.8 },
  giant:     { id: 'giant',     name: 'Giant',     css: '#ff7a4a', w: 0 },
  junk:      { id: 'junk',      name: 'Junk',      css: '#a09a8a', w: 0 },
};

const A = (o) => Object.assign({ h: 0.26, w: 0.12, back: 0x5a7a4a, belly: 0xd8d0a8, fin: 0x4a6a3a, pat: 'none', patCol: 0x2a3a2a, tail: 'fork', extras: [] }, o);

export const FISH = [
  /* ---------------- Driftwood lakes ---------------- */
  { id: 'bass', name: 'Largemouth Bass', rarity: 'common', where: ['home'], water: 'lake', time: 'any', bait: { worm: 1, pieces: 0.6 }, kg: [0.4, 4.5], cm: [25, 60], value: 22,
    fight: { power: 1.0, stamina: 1.0, erratic: 0.5, jump: 0.3 }, art: A({ h: 0.32, w: 0.15, back: 0x4f6e32, belly: 0xe0dcae, pat: 'bars', patCol: 0x2f4a22, mouth: 1.4 }),
    blurb: 'The bread and butter of Driftwood Bay. Bites anything, complains about everything.' },
  { id: 'perch', name: 'Yellow Perch', rarity: 'common', where: ['home', 'frost'], water: 'lake', time: 'day', bait: { worm: 1.2 }, kg: [0.1, 1.2], cm: [15, 35], value: 15,
    fight: { power: 0.6, stamina: 0.6, erratic: 0.7, jump: 0.1 }, art: A({ h: 0.3, back: 0x9a9a3a, belly: 0xf2e6a0, pat: 'bars', patCol: 0x4a4a1a, fin: 0xe08a3a }),
    blurb: 'Small, stripy and certain it is much bigger than it is.' },
  { id: 'trout', name: 'Rainbow Trout', rarity: 'common', where: ['home', 'frost'], water: 'lake', time: 'any', bait: { worm: 1, glow: 0.6 }, kg: [0.3, 3.5], cm: [25, 65], value: 24,
    fight: { power: 0.9, stamina: 1.1, erratic: 0.6, jump: 0.6 }, art: A({ h: 0.24, back: 0x6a8a6a, belly: 0xf0e0d0, pat: 'spots', patCol: 0x2a2a2a, stripe: 0xe07a8a }),
    blurb: 'Wears a rainbow stripe. Jumps a lot to show it off.' },
  { id: 'carp', name: 'Mirror Carp', rarity: 'common', where: ['home'], water: 'lake', time: 'any', bait: { worm: 0.8, mystery: 0.8 }, kg: [1, 12], cm: [35, 85], value: 26,
    fight: { power: 1.3, stamina: 1.4, erratic: 0.2, jump: 0 }, art: A({ h: 0.34, w: 0.17, back: 0x8a7440, belly: 0xe8d090, pat: 'scales', patCol: 0xc8a860, mouth: 0.8, extras: ['whiskers'] }),
    blurb: 'A heavy, patient fish with a face like a disappointed uncle.' },
  { id: 'pike', name: 'Northern Pike', rarity: 'uncommon', where: ['home', 'frost'], water: 'lake', time: 'any', bait: { pieces: 1.4, worm: 0.4 }, kg: [2, 16], cm: [50, 120], value: 58,
    fight: { power: 1.6, stamina: 1.3, erratic: 0.7, jump: 0.3 }, art: A({ h: 0.17, w: 0.1, back: 0x4a6a3a, belly: 0xe0e0c0, pat: 'spots', patCol: 0xc8d890, mouth: 1.6, snout: 1.6, extras: ['teeth'] }),
    blurb: 'All teeth and bad decisions. Loves fish pieces.' },
  { id: 'catfish', name: 'Channel Catfish', rarity: 'uncommon', where: ['home'], water: 'lake', time: 'night', bait: { pieces: 1.3, worm: 0.7, mystery: 0.9 }, kg: [2, 30], cm: [45, 120], value: 62,
    fight: { power: 1.7, stamina: 1.7, erratic: 0.3, jump: 0 }, art: A({ h: 0.2, w: 0.18, back: 0x5a5a52, belly: 0xd8d4c4, fin: 0x4a4a44, mouth: 1.5, head: 1.3, extras: ['whiskers'], tail: 'round' }),
    blurb: 'Comes out at night. Has whiskers. Knows things.' },
  { id: 'goldtrout', name: 'Golden Trout', rarity: 'rare', where: ['home', 'frost'], water: 'lake', time: 'dusk', bait: { glow: 1.4, worm: 0.5 }, kg: [0.5, 3], cm: [25, 55], value: 190,
    fight: { power: 1.1, stamina: 1.2, erratic: 0.9, jump: 0.8 }, art: A({ h: 0.24, back: 0xe8a830, belly: 0xf8e080, pat: 'spots', patCol: 0xa05a1a, fin: 0xf07a3a, stripe: 0xe0503a }),
    blurb: 'Only bites around sunset. Glows like it knows it is worth a lot.' },

  /* ---------------- Driftwood sea ---------------- */
  { id: 'cod', name: 'Atlantic Cod', rarity: 'common', where: ['home', 'frost', 'open'], water: 'sea', time: 'any', bait: { worm: 0.8, pieces: 1 }, kg: [1, 12], cm: [40, 100], value: 24,
    fight: { power: 1.1, stamina: 1.1, erratic: 0.3, jump: 0 }, art: A({ h: 0.24, w: 0.14, back: 0x8a8a5a, belly: 0xe8e4d0, pat: 'spots', patCol: 0x5a5a3a, extras: ['barbel'], tail: 'round' }),
    blurb: 'Tastes great fried. Knows it. Does not care.' },
  { id: 'flounder', name: 'Flounder', rarity: 'common', where: ['home', 'tropic'], water: 'sea', time: 'any', bait: { worm: 1.1 }, kg: [0.3, 3], cm: [20, 50], value: 18,
    fight: { power: 0.7, stamina: 0.8, erratic: 0.4, jump: 0 }, art: A({ h: 0.5, w: 0.05, back: 0x8a7a5a, belly: 0xf0ece0, pat: 'spots', patCol: 0x5a4a32, flat: true, tail: 'round' }),
    blurb: 'Both eyes on one side. Deeply unbothered.' },
  { id: 'seabass', name: 'Sea Bass', rarity: 'uncommon', where: ['home', 'tropic'], water: 'sea', time: 'any', bait: { pieces: 1.2, worm: 0.7 }, kg: [1, 9], cm: [35, 80], value: 55,
    fight: { power: 1.3, stamina: 1.2, erratic: 0.5, jump: 0.2 }, art: A({ h: 0.28, w: 0.14, back: 0x5a6a7a, belly: 0xe8eef0, fin: 0x4a5a6a }),
    blurb: 'Silver, fast and a little bit smug.' },
  { id: 'salmon', name: 'Chinook Salmon', rarity: 'uncommon', where: ['home', 'frost', 'open'], water: 'sea', time: 'any', bait: { pieces: 1, glow: 0.8, worm: 0.5 }, kg: [3, 22], cm: [60, 120], value: 70,
    fight: { power: 1.5, stamina: 1.5, erratic: 0.5, jump: 0.7 }, art: A({ h: 0.24, w: 0.13, back: 0x4a6a7a, belly: 0xf0dcd0, pat: 'spots', patCol: 0x2a3a4a, fin: 0x5a6a6a, stripe: 0xe08a7a }),
    blurb: 'Swims upstream on principle. Fights on principle too.' },

  /* ---------------- Frostbite ---------------- */
  { id: 'char', name: 'Arctic Char', rarity: 'common', where: ['frost'], water: 'any', time: 'any', bait: { worm: 1, glow: 0.8 }, kg: [0.5, 6], cm: [30, 75], value: 30,
    fight: { power: 1.0, stamina: 1.1, erratic: 0.5, jump: 0.4 }, art: A({ h: 0.24, back: 0x4a5a6a, belly: 0xf07a4a, pat: 'spots', patCol: 0xf0d0d0, fin: 0xe06a3a }),
    blurb: 'Lives in water so cold it should not be able to.' },
  { id: 'icecod', name: 'Ice Cod', rarity: 'common', where: ['frost'], water: 'any', time: 'any', bait: { pieces: 1, worm: 0.7 }, kg: [0.5, 5], cm: [30, 60], value: 28,
    fight: { power: 0.9, stamina: 1.0, erratic: 0.4, jump: 0 }, art: A({ h: 0.24, back: 0xa8c0d0, belly: 0xf4f8fa, pat: 'spots', patCol: 0x6a8aa0, tail: 'round', extras: ['barbel'] }),
    blurb: 'Has antifreeze in its blood and nothing in its head.' },
  { id: 'burbot', name: 'Burbot', rarity: 'uncommon', where: ['frost'], water: 'ice', time: 'night', bait: { pieces: 1.4, glow: 1 }, kg: [1, 10], cm: [40, 100], value: 75,
    fight: { power: 1.3, stamina: 1.4, erratic: 0.4, jump: 0 }, art: A({ h: 0.14, w: 0.12, back: 0x6a6a4a, belly: 0xd8d0b0, pat: 'spots', patCol: 0x3a3a2a, tail: 'eel', extras: ['barbel'] }),
    blurb: 'A freshwater cod that looks like an eel that looks like a mistake.' },
  { id: 'frostpike', name: 'Frost Pike', rarity: 'rare', where: ['frost'], water: 'ice', time: 'any', bait: { pieces: 1.3, glow: 0.9 }, kg: [4, 24], cm: [70, 140], value: 240,
    fight: { power: 2.0, stamina: 1.6, erratic: 0.8, jump: 0.2 }, art: A({ h: 0.17, w: 0.1, back: 0x8ab0c8, belly: 0xf4faff, pat: 'spots', patCol: 0xffffff, mouth: 1.6, snout: 1.6, extras: ['teeth', 'frost'] }),
    blurb: 'Pike that went into the ice and came out colder and angrier.' },
  { id: 'glaciersalmon', name: 'Glacier Salmon', rarity: 'epic', where: ['frost'], water: 'sea', time: 'dusk', bait: { glow: 1.5 }, kg: [8, 30], cm: [90, 140], value: 820,
    fight: { power: 2.1, stamina: 2.0, erratic: 0.6, jump: 0.8 }, art: A({ h: 0.24, w: 0.13, back: 0x9ad0e8, belly: 0xf8fcff, pat: 'spots', patCol: 0xffffff, fin: 0x6ab0d8, stripe: 0x6ad8f8, extras: ['frost'] }),
    blurb: 'Swims under the aurora. Its scales look like broken ice.' },

  /* ---------------- Sunken Coast ---------------- */
  { id: 'parrot', name: 'Parrotfish', rarity: 'common', where: ['tropic'], water: 'sea', time: 'day', bait: { worm: 0.8, mystery: 1 }, kg: [0.5, 6], cm: [25, 70], value: 32,
    fight: { power: 1.0, stamina: 1.0, erratic: 0.6, jump: 0.1 }, art: A({ h: 0.34, w: 0.14, back: 0x3ab0a0, belly: 0x9ae0d0, fin: 0xf07ab0, pat: 'scales', patCol: 0x2a8a8a, beak: true }),
    blurb: 'Eats coral and poops sand. Half of every beach here is its fault.' },
  { id: 'reefdancer', name: 'Reef Dancer', rarity: 'common', where: ['tropic'], water: 'sea', time: 'any', bait: { worm: 1, glow: 0.7 }, kg: [0.1, 0.8], cm: [8, 20], value: 26,
    fight: { power: 0.5, stamina: 0.6, erratic: 1.2, jump: 0.2 }, art: A({ h: 0.4, w: 0.12, back: 0xf07a2a, belly: 0xf8a04a, fin: 0xf8f8f8, pat: 'bars', patCol: 0xffffff, tail: 'round' }),
    blurb: 'Tiny, orange, striped and completely unable to sit still.' },
  { id: 'barracuda', name: 'Barracuda', rarity: 'uncommon', where: ['tropic', 'open'], water: 'sea', time: 'any', bait: { pieces: 1.4 }, kg: [3, 20], cm: [60, 150], value: 80,
    fight: { power: 1.8, stamina: 1.2, erratic: 0.9, jump: 0.5 }, art: A({ h: 0.14, w: 0.09, back: 0x5a6a7a, belly: 0xe8eef2, pat: 'bars', patCol: 0x3a4a5a, mouth: 1.5, snout: 1.4, extras: ['teeth'] }),
    blurb: 'A torpedo with an underbite.' },
  { id: 'puffer', name: 'Balloon Puffer', rarity: 'uncommon', where: ['tropic', 'home'], water: 'sea', time: 'any', bait: { mystery: 1.2, worm: 0.6 }, kg: [0.3, 3], cm: [15, 45], value: 65, beh: 'puffer',
    fight: { power: 0.7, stamina: 0.8, erratic: 0.4, jump: 0 }, art: A({ h: 0.45, w: 0.4, back: 0xc8b060, belly: 0xf0ecd0, pat: 'spots', patCol: 0x5a4a2a, tail: 'round', extras: ['spikes'] }),
    blurb: 'Inflates when landed and tries to float away. Grab it quickly.' },
  { id: 'mahi', name: 'Mahi-Mahi', rarity: 'rare', where: ['tropic', 'open'], water: 'sea', time: 'day', bait: { pieces: 1.2, glow: 0.8 }, kg: [5, 25], cm: [80, 150], value: 260,
    fight: { power: 1.9, stamina: 1.6, erratic: 0.9, jump: 1.0 }, art: A({ h: 0.3, w: 0.11, back: 0x3ab04a, belly: 0xf0d840, fin: 0x3a8ae0, pat: 'spots', patCol: 0x2a6ae0, head: 1.3, tail: 'lunate' }),
    blurb: 'Green, gold and blue, with a forehead like a brick.' },
  { id: 'swordfish', name: 'Swordfish', rarity: 'rare', where: ['tropic', 'open'], water: 'sea', time: 'any', bait: { pieces: 1.3 }, kg: [30, 180], cm: [150, 300], value: 420,
    fight: { power: 2.6, stamina: 2.2, erratic: 0.7, jump: 0.8 }, art: A({ h: 0.2, w: 0.12, back: 0x3a4a6a, belly: 0xd8dce4, fin: 0x2a3a5a, tail: 'lunate', extras: ['sword'] }),
    blurb: 'Brings its own weapon. Mind the pointy end.' },
  { id: 'sunfish', name: 'Ocean Sunfish', rarity: 'epic', where: ['tropic', 'open'], water: 'sea', time: 'day', bait: { mystery: 1.2, glow: 0.8 }, kg: [100, 900], cm: [150, 300], value: 1100,
    fight: { power: 2.4, stamina: 3.0, erratic: 0.1, jump: 0 }, art: A({ h: 0.9, w: 0.14, back: 0x9aa8b0, belly: 0xe8ecef, fin: 0x8a98a0, tail: 'none', extras: ['sunfin'] }),
    blurb: 'A fish that forgot to grow a back half. Enormous. Friendly. Heavy.' },

  /* ---------------- Open Sea ---------------- */
  { id: 'mackerel', name: 'Mackerel', rarity: 'common', where: ['open', 'home'], water: 'sea', time: 'any', bait: { worm: 0.9, pieces: 1, glow: 0.8 }, kg: [0.2, 2], cm: [20, 45], value: 20,
    fight: { power: 0.8, stamina: 0.9, erratic: 0.8, jump: 0.2 }, art: A({ h: 0.2, w: 0.1, back: 0x3a6a8a, belly: 0xf0f4f8, pat: 'waves', patCol: 0x1a3a4a, tail: 'fork' }),
    blurb: 'Comes in schools. Leaves in your cooler.' },
  { id: 'tuna', name: 'Bluefin Tuna', rarity: 'common', where: ['open'], water: 'sea', time: 'any', bait: { pieces: 1.3 }, kg: [15, 120], cm: [100, 220], value: 90,
    fight: { power: 2.2, stamina: 2.0, erratic: 0.4, jump: 0.2 }, art: A({ h: 0.28, w: 0.2, back: 0x1a2a4a, belly: 0xd8dce8, fin: 0xe8d040, tail: 'lunate', extras: ['finlets'] }),
    blurb: 'A muscle shaped like a fish. The open sea is full of them.' },
  { id: 'halibut', name: 'Pacific Halibut', rarity: 'uncommon', where: ['open', 'frost'], water: 'sea', time: 'any', bait: { pieces: 1.3 }, kg: [5, 90], cm: [60, 200], value: 110,
    fight: { power: 2.0, stamina: 2.2, erratic: 0.2, jump: 0 }, art: A({ h: 0.52, w: 0.06, back: 0x6a5a44, belly: 0xf4f0e8, pat: 'spots', patCol: 0x4a3a2a, flat: true, tail: 'round' }),
    blurb: 'A flounder that kept going. Some are the size of a door.' },
  { id: 'marlin', name: 'Blue Marlin', rarity: 'rare', where: ['open'], water: 'sea', time: 'day', bait: { pieces: 1.4, glow: 0.8 }, kg: [60, 400], cm: [200, 400], value: 560,
    fight: { power: 2.8, stamina: 2.6, erratic: 0.8, jump: 1.0 }, art: A({ h: 0.22, w: 0.11, back: 0x1a3a7a, belly: 0xe0e8f0, fin: 0x2a5ab0, pat: 'bars', patCol: 0x5ab0f0, tail: 'lunate', extras: ['sword', 'sail'] }),
    blurb: 'The old man and the sea, and the other old man, and his boat.' },
  { id: 'oarfish', name: 'Giant Oarfish', rarity: 'epic', where: ['open', 'black'], water: 'sea', time: 'night', bait: { glow: 1.5, mystery: 0.8 }, kg: [40, 250], cm: [300, 800], value: 1300,
    fight: { power: 1.8, stamina: 2.8, erratic: 0.5, jump: 0 }, art: A({ h: 0.07, w: 0.03, back: 0xd0d8e0, belly: 0xf0f4f8, fin: 0xe03a3a, pat: 'spots', patCol: 0x3a4a5a, tail: 'eel', extras: ['crest'] }),
    blurb: 'Sailors called it a sea serpent. It is a very long, very silver fish.' },

  /* ---------------- Blackwater ---------------- */
  { id: 'lantern', name: 'Lanternfish', rarity: 'common', where: ['black'], water: 'sea', time: 'any', bait: { glow: 1.4, worm: 0.4 }, kg: [0.05, 0.4], cm: [6, 15], value: 45,
    fight: { power: 0.5, stamina: 0.6, erratic: 1.0, jump: 0 }, art: A({ h: 0.22, back: 0x2a2e3a, belly: 0x4a4e5a, pat: 'lights', patCol: 0x6af0ff, extras: ['glow'] }),
    blurb: 'Tiny lights in the dark. There are more of them than anything else alive.' },
  { id: 'angler', name: 'Anglerfish', rarity: 'uncommon', where: ['black'], water: 'sea', time: 'any', bait: { glow: 1.3, pieces: 0.8 }, kg: [1, 20], cm: [20, 90], value: 160,
    fight: { power: 1.5, stamina: 1.4, erratic: 0.3, jump: 0 }, art: A({ h: 0.5, w: 0.4, back: 0x2e2a2e, belly: 0x3a343a, fin: 0x2a2428, head: 1.6, mouth: 2.2, tail: 'round', extras: ['lure', 'teeth'] }),
    blurb: 'Fishes for fish. You are fishing for a fisherman.' },
  { id: 'viper', name: 'Viperfish', rarity: 'uncommon', where: ['black'], water: 'sea', time: 'any', bait: { glow: 1.3, pieces: 1 }, kg: [0.1, 1.5], cm: [20, 60], value: 150,
    fight: { power: 1.2, stamina: 0.9, erratic: 1.1, jump: 0 }, art: A({ h: 0.14, w: 0.07, back: 0x1a2a3a, belly: 0x3a5a6a, pat: 'lights', patCol: 0x6af0ff, mouth: 1.8, extras: ['teeth', 'glow'] }),
    blurb: 'Its teeth do not fit inside its mouth. Nobody has told it.' },
  { id: 'gulper', name: 'Gulper Eel', rarity: 'rare', where: ['black'], water: 'sea', time: 'any', bait: { glow: 1.2, mystery: 1 }, kg: [1, 8], cm: [60, 180], value: 380,
    fight: { power: 1.6, stamina: 1.6, erratic: 0.8, jump: 0 }, art: A({ h: 0.1, w: 0.08, back: 0x1e1a24, belly: 0x2e2a34, head: 2.2, mouth: 2.6, tail: 'eel', extras: ['glowtail'] }),
    blurb: 'A mouth with an eel attached.' },
  { id: 'coelacanth', name: 'Coelacanth', rarity: 'epic', where: ['black'], water: 'sea', time: 'night', bait: { glow: 1.2, mystery: 1.2 }, kg: [30, 90], cm: [120, 200], value: 1600,
    fight: { power: 2.2, stamina: 2.4, erratic: 0.3, jump: 0 }, art: A({ h: 0.26, w: 0.15, back: 0x2a3a5a, belly: 0x4a5a7a, pat: 'spots', patCol: 0xe0e8f0, fin: 0x2a3a5a, tail: 'round', extras: ['lobefins'] }),
    blurb: 'Supposed to have died out with the dinosaurs. Did not get the memo.' },

  /* ---------------- the kraken's water: Offshore only (zone 2), any sea ---------------- */
  { id: 'inkfin', name: 'Inkfin', rarity: 'uncommon', where: ['home', 'frost', 'tropic', 'open', 'black'], zoneOnly: 2, water: 'sea', time: 'any', bait: { pieces: 1.2, worm: 0.6, glow: 0.8 }, kg: [1, 7], cm: [35, 75], value: 140,
    fight: { power: 1.5, stamina: 1.4, erratic: 0.9, jump: 0.2 }, art: A({ h: 0.22, w: 0.1, back: 0x3a1a2a, belly: 0xb88a9a, fin: 0x1a0a14, pat: 'spots', patCol: 0x14080e, tail: 'fork' }),
    blurb: 'Squirts a cloud of black ink when it is hooked. It only lives where the kraken hunts, and eats what the kraken leaves.' },
  { id: 'suckerfish', name: 'Sucker Remora', rarity: 'rare', where: ['home', 'frost', 'tropic', 'open', 'black'], zoneOnly: 2, water: 'sea', time: 'any', bait: { pieces: 1.4, mystery: 1 }, kg: [3, 18], cm: [60, 130], value: 620,
    fight: { power: 2.0, stamina: 1.8, erratic: 0.6, jump: 0 }, art: A({ h: 0.14, w: 0.1, back: 0x5a3a44, belly: 0xe8c8c0, fin: 0x4a2a34, pat: 'bars', patCol: 0xf4d8cc, head: 1.3, tail: 'round' }),
    blurb: 'Clamps onto something enormous and rides it for years. The round scars on its sides are exactly the size of a kraken sucker.' },
  { id: 'hatchling', name: 'Kraken Hatchling', rarity: 'epic', where: ['home', 'frost', 'tropic', 'open', 'black'], zoneOnly: 2, water: 'sea', time: 'night', bait: { glow: 1.5, mystery: 1.2 }, kg: [4, 22], cm: [50, 120], value: 2100,
    fight: { power: 2.5, stamina: 2.4, erratic: 1.2, jump: 0 }, art: A({ h: 0.34, w: 0.26, back: 0x8a2e3a, belly: 0xf0b8b0, fin: 0x6a1e2e, pat: 'spots', patCol: 0xf4d8cc, head: 1.5, tail: 'none', extras: ['whiskers', 'glow'] }),
    blurb: 'A baby. Somewhere below it, its mother is listening. Only comes up at night, only in the offshore water.' },

  /* ---------------- Vigil's End ---------------- */
  { id: 'fogfin', name: 'Fogfin', rarity: 'uncommon', where: ['reach'], water: 'sea', time: 'any', bait: { worm: 0.8, pieces: 1, glow: 1.2 }, kg: [0.6, 6], cm: [30, 70], value: 180,
    fight: { power: 1.3, stamina: 1.3, erratic: 0.9, jump: 0.4 }, art: A({ h: 0.24, w: 0.1, back: 0xa8b0b4, belly: 0xe8ecee, fin: 0xc8d0d4, pat: 'waves', patCol: 0x8a9296, tail: 'veil', extras: ['sail'] }),
    blurb: 'Grey as the fog it swims under, with fins like torn sails. The old men of the Vigil call them little ghosts.' },
  { id: 'hushray', name: 'Hush Ray', rarity: 'rare', where: ['reach'], water: 'sea', time: 'any', bait: { pieces: 1.2, glow: 1.3, mystery: 1 }, kg: [8, 60], cm: [80, 220], value: 900,
    fight: { power: 2.2, stamina: 2.2, erratic: 0.5, jump: 0.3 }, art: A({ h: 0.6, w: 0.04, back: 0x4a5058, belly: 0xe8e8ea, fin: 0x3a4048, pat: 'spots', patCol: 0xc8d0d8, flat: true, tail: 'eel' }),
    blurb: 'A grey ray that glides without a sound. They gather wherever something much larger has just passed.' },
  { id: 'watcher', name: 'Watcher Grouper', rarity: 'epic', where: ['reach'], water: 'sea', time: 'any', bait: { pieces: 1.4, mystery: 1.2 }, kg: [60, 320], cm: [150, 280], value: 2400,
    fight: { power: 2.9, stamina: 3.0, erratic: 0.35, jump: 0 }, art: A({ h: 0.36, w: 0.2, back: 0x3a4046, belly: 0x9aa0a4, fin: 0x2a3036, pat: 'spots', patCol: 0x6af0ff, mouth: 1.8, head: 1.4, tail: 'round', extras: ['glow'] }),
    blurb: 'An enormous old grouper with lamps for eyes. It watches the deep water beyond the rocks, day and night.' },
  { id: 'vigillight', name: 'Vigil Lantern', rarity: 'legendary', where: ['reach'], water: 'sea', time: 'night', bait: { glow: 1.6, mystery: 1.2 }, kg: [2, 9], cm: [40, 80], value: 5200,
    fight: { power: 1.8, stamina: 2.0, erratic: 1.3, jump: 0.8 }, art: A({ h: 0.3, w: 0.13, back: 0x2a3a4a, belly: 0xd8f0ff, fin: 0x9af0ff, pat: 'lights', patCol: 0xd8fcff, tail: 'veil', extras: ['glow', 'lure'] }),
    blurb: 'The fishermen light a lantern every night so that this fish has something to swim towards. Almost nobody has caught one.' },

  /* ---------------- the weird ones ---------------- */
  { id: 'bombfish', name: 'Bombfish', rarity: 'uncommon', where: 'all', water: 'any', time: 'any', bait: { explosive: 3, mystery: 1, worm: 0.2 }, kg: [1, 4], cm: [25, 45], value: 140, beh: 'bomb',
    fight: { power: 1.0, stamina: 0.8, erratic: 0.6, jump: 0.4 }, art: A({ h: 0.5, w: 0.45, back: 0x2a2a2e, belly: 0x4a4a50, fin: 0xc03a2a, pat: 'none', tail: 'round', extras: ['fuse'] }),
    blurb: 'It explodes when you pull it out of the water. Throw it. Throw it now.' },
  { id: 'thief', name: 'Thieffish', rarity: 'common', where: 'all', water: 'any', time: 'any', bait: { worm: 0.9, pieces: 0.9, glow: 0.9, mystery: 0.9, magnetic: 0.6 }, kg: [0.3, 2], cm: [20, 40], value: 90, beh: 'thief',
    fight: { power: 0.8, stamina: 0.7, erratic: 1.3, jump: 0.2 }, art: A({ h: 0.26, back: 0x3a3a3a, belly: 0xa8a8a8, pat: 'mask', patCol: 0x111111, fin: 0x2a2a2a }),
    blurb: 'Steals your bait and swims away. It has been doing it for years. Its hoard must be enormous.' },
  { id: 'mimic', name: 'Mimicfish', rarity: 'rare', where: ['tropic', 'open', 'black', 'home'], water: 'sea', time: 'any', bait: { magnetic: 2, mystery: 1.2, worm: 0.1 }, kg: [8, 25], cm: [60, 90], value: 480, beh: 'mimic',
    fight: { power: 1.4, stamina: 1.4, erratic: 0.2, jump: 0 }, art: A({ h: 0.5, w: 0.4, back: 0x7a4a2a, belly: 0xd8b060, fin: 0x5a3a20, tail: 'round', mouth: 2, extras: ['teeth', 'chest'] }),
    blurb: 'Looks exactly like a treasure chest until you open it.' },
  { id: 'eel', name: 'Electric Eel', rarity: 'uncommon', where: ['home', 'tropic', 'black'], water: 'any', time: 'any', bait: { magnetic: 1.4, pieces: 0.9, worm: 0.5 }, kg: [2, 15], cm: [80, 220], value: 150, beh: 'eel',
    fight: { power: 1.4, stamina: 1.2, erratic: 0.9, jump: 0 }, art: A({ h: 0.08, w: 0.07, back: 0x3a4a3a, belly: 0xe8b040, fin: 0x2a3a2a, tail: 'eel', pat: 'lights', patCol: 0xf0f070 }),
    blurb: 'Electrocutes whoever touches it. Including you. Especially you.' },
  { id: 'sharkfish', name: 'Sharkfish', rarity: 'rare', where: ['home', 'tropic', 'open', 'black'], water: 'sea', time: 'any', bait: { pieces: 1.5, mystery: 1 }, kg: [60, 260], cm: [180, 400], value: 620, beh: 'shark',
    fight: { power: 2.6, stamina: 2.2, erratic: 0.5, jump: 0.3 }, art: A({ h: 0.22, w: 0.16, back: 0x6a7a8a, belly: 0xf0f2f4, fin: 0x5a6a7a, tail: 'shark', mouth: 1.2, extras: ['dorsal', 'teeth'] }),
    blurb: 'Looks like a tiny fish. Until it is hooked. Then it is ten times bigger.' },
  { id: 'ghost', name: 'Ghostfish', rarity: 'rare', where: ['frost', 'black', 'home'], water: 'any', time: 'night', bait: { glow: 2, mystery: 1 }, kg: [0.5, 5], cm: [30, 70], value: 520, beh: 'ghost',
    fight: { power: 1.2, stamina: 1.3, erratic: 1.0, jump: 0 }, art: A({ h: 0.3, w: 0.12, back: 0xc8e8f8, belly: 0xf4fcff, fin: 0xa8d8f0, tail: 'round', extras: ['ghost'] }),
    blurb: 'Disappears when you get close. You can see the moon through it.' },
  { id: 'slapfish', name: 'Slapfish', rarity: 'uncommon', where: 'all', water: 'any', time: 'any', bait: { worm: 0.8, pieces: 0.8, mystery: 1.2 }, kg: [1, 6], cm: [30, 60], value: 95, beh: 'slap',
    fight: { power: 1.2, stamina: 0.9, erratic: 1.0, jump: 1.2 }, art: A({ h: 0.26, w: 0.12, back: 0xd05a3a, belly: 0xf8d0a0, fin: 0xa03a2a, pat: 'bars', patCol: 0x8a2a1a, mouth: 1.3 }),
    blurb: 'Launches itself into your face the moment it leaves the water. Every time.' },
  { id: 'magnetfish', name: 'Magnet Minnow', rarity: 'uncommon', where: 'all', water: 'sea', time: 'any', bait: { magnetic: 2.2 }, kg: [0.2, 1], cm: [10, 25], value: 110,
    fight: { power: 0.7, stamina: 0.7, erratic: 0.8, jump: 0 }, art: A({ h: 0.24, back: 0xa8b0b8, belly: 0xd8dde2, fin: 0xc84040, pat: 'bars', patCol: 0x3a4a5a, extras: ['metal'] }),
    blurb: 'Covered in paperclips, keys and one very old coin.' },
  { id: 'starfish', name: 'Falling Starfish', rarity: 'legendary', where: 'meteor', water: 'sea', time: 'any', bait: { glow: 1.5, mystery: 1.5, worm: 0.5, pieces: 0.5, explosive: 0.5, magnetic: 0.5 }, kg: [1, 6], cm: [30, 60], value: 2600,
    fight: { power: 1.6, stamina: 1.6, erratic: 1.4, jump: 1.0 }, art: A({ h: 0.3, w: 0.12, back: 0x5a6af0, belly: 0xf0e0ff, fin: 0xa0f0ff, pat: 'lights', patCol: 0xffffff, extras: ['glow', 'star'] }),
    blurb: 'Only found where a meteor has fallen. It is warm to the touch.' },
  { id: 'rainbowkoi', name: 'Aurora Koi', rarity: 'legendary', where: ['home', 'frost'], water: 'lake', time: 'dusk', bait: { glow: 1.2, mystery: 1.4 }, kg: [2, 9], cm: [40, 80], value: 3200,
    fight: { power: 1.6, stamina: 1.8, erratic: 1.2, jump: 0.6 }, art: A({ h: 0.3, w: 0.15, back: 0xf05a8a, belly: 0xf8f0ff, fin: 0x8af0f0, pat: 'patches', patCol: 0x5ae0a0, tail: 'veil', extras: ['whiskers', 'glow'] }),
    blurb: 'Driftwood legend says one lives in Mirror Lake. Driftwood legend is right.' },

  /* ---------------- junk and treasure ---------------- */
  { id: 'boot', name: 'Old Boot', rarity: 'junk', where: 'all', water: 'any', time: 'any', bait: { magnetic: 1, worm: 0.15, pieces: 0.15, mystery: 0.6 }, kg: [0.8, 1.4], cm: [28, 32], value: 3, beh: 'junk', junk: 'boot',
    fight: { power: 0.3, stamina: 0.2, erratic: 0, jump: 0 }, art: A({}), blurb: 'Left foot. Somebody out there has the right one.' },
  { id: 'can', name: 'Rusty Can', rarity: 'junk', where: 'all', water: 'any', time: 'any', bait: { magnetic: 1.4, worm: 0.1, mystery: 0.5 }, kg: [0.2, 0.4], cm: [12, 14], value: 2, beh: 'junk', junk: 'can',
    fight: { power: 0.2, stamina: 0.1, erratic: 0, jump: 0 }, art: A({}), blurb: 'Beans, once. A long time ago.' },
  { id: 'duck', name: 'Rubber Duck', rarity: 'junk', where: 'all', water: 'any', time: 'any', bait: { mystery: 0.8, worm: 0.05 }, kg: [0.1, 0.1], cm: [10, 10], value: 30, beh: 'junk', junk: 'duck',
    fight: { power: 0.2, stamina: 0.1, erratic: 0.3, jump: 0 }, art: A({}), blurb: 'Squeaks. Has seen things.' },
  { id: 'bottle', name: 'Message in a Bottle', rarity: 'junk', where: 'all', water: 'sea', time: 'any', bait: { magnetic: 0.6, mystery: 0.9, worm: 0.06 }, kg: [0.6, 0.6], cm: [30, 30], value: 5, beh: 'bottle', junk: 'bottle',
    fight: { power: 0.2, stamina: 0.1, erratic: 0, jump: 0 }, art: A({}), blurb: 'There is a note inside. Somebody wanted it found.' },
  /* ---------------- things from the bottom: some useless, some the start of something ---------------- */
  { id: 'oldmap', name: 'Waterlogged Chart', rarity: 'junk', where: 'all', water: 'sea', time: 'any', bait: { magnetic: 0.5, mystery: 0.6, worm: 0.03, pieces: 0.03 }, kg: [0.2, 0.2], cm: [30, 30], value: 10, beh: 'map', junk: 'map',
    fight: { power: 0.2, stamina: 0.1, erratic: 0, jump: 0 }, art: A({}), blurb: 'An old sea chart rolled in oilcloth. Someone drew an X on it, far out on the open water.' },
  { id: 'oldkey', name: 'Barnacled Key', rarity: 'junk', where: 'all', water: 'sea', time: 'any', bait: { magnetic: 1.2, mystery: 0.4, worm: 0.02 }, kg: [0.1, 0.1], cm: [12, 12], value: 40, beh: 'curio', junk: 'key',
    fight: { power: 0.2, stamina: 0.1, erratic: 0, jump: 0 }, art: A({}), blurb: 'A heavy brass key. The lock it opened is probably at the bottom of the sea.' },
  { id: 'coinpouch', name: 'Rotten Coin Purse', rarity: 'junk', where: 'all', water: 'sea', time: 'any', bait: { magnetic: 1, mystery: 0.5, worm: 0.04, pieces: 0.03 }, kg: [0.4, 0.8], cm: [15, 15], value: 5, beh: 'coins', junk: 'pouch',
    fight: { power: 0.2, stamina: 0.1, erratic: 0, jump: 0 }, art: A({}), blurb: 'It splits open when you pick it up. Old coins, still good.' },
  { id: 'artifact', name: 'Strange Idol', rarity: 'rare', where: 'all', water: 'sea', time: 'any', bait: { magnetic: 0.6, mystery: 0.8, worm: 0.01 }, kg: [2, 3], cm: [25, 25], value: 900, beh: 'curio', junk: 'idol',
    fight: { power: 0.6, stamina: 0.4, erratic: 0, jump: 0 }, art: A({}), blurb: 'A green stone figure with too many eyes. It is warm. Collectors pay well for these.' },
  { id: 'shippart', name: 'Salvaged Planks', rarity: 'junk', where: 'all', water: 'sea', time: 'any', bait: { magnetic: 0.7, worm: 0.04, pieces: 0.04 }, kg: [4, 8], cm: [120, 120], value: 8, beh: 'salvage', junk: 'planks',
    fight: { power: 0.4, stamina: 0.2, erratic: 0, jump: 0 }, art: A({}), blurb: 'Good oak from some wreck. Carry it onto your boat and it patches the hull.' },
  { id: 'journalpage', name: 'Drowned Journal Page', rarity: 'junk', where: 'all', water: 'sea', time: 'any', bait: { mystery: 0.5, magnetic: 0.3, worm: 0.01 }, kg: [0.05, 0.05], cm: [20, 20], value: 1, beh: 'page', junk: 'page',
    fight: { power: 0.1, stamina: 0.1, erratic: 0, jump: 0 }, art: A({}), blurb: 'A page from someone\'s journal, somehow still legible. It describes something enormous.' },
  { id: 'strongbox', name: 'Sunken Strongbox', rarity: 'rare', where: 'mystery', water: 'sea', time: 'any', bait: { magnetic: 2, worm: 1, pieces: 1, glow: 1, mystery: 1, explosive: 1 }, kg: [18, 26], cm: [70, 70], value: 0, beh: 'strongbox', junk: 'strongbox',
    fight: { power: 1.4, stamina: 1.2, erratic: 0.1, jump: 0 }, art: A({}), blurb: 'Iron-banded and chained shut, right where the chart said. Whatever is in it, someone wanted it kept.' },

  /* ---------------- weather and hotspot fish ---------------- */
  { id: 'thundertuna', name: 'Thunderhead Tuna', rarity: 'epic', where: ['open', 'tropic', 'black'], water: 'sea', time: 'any', weather: 'storm', bait: { pieces: 1.4, glow: 1 }, kg: [40, 200], cm: [150, 280], value: 1500,
    fight: { power: 2.6, stamina: 2.4, erratic: 0.7, jump: 0.6 }, art: A({ h: 0.28, w: 0.2, back: 0x2a3a6a, belly: 0xd8e4f0, fin: 0x9af0ff, pat: 'lights', patCol: 0xd8fcff, tail: 'lunate', extras: ['finlets', 'glow'] }),
    blurb: 'Only rises when lightning hits the sea. Its fins crackle.' },
  { id: 'squallray', name: 'Squall Ray', rarity: 'rare', where: ['home', 'tropic', 'frost', 'open'], water: 'sea', time: 'any', weather: 'storm', bait: { pieces: 1.2, worm: 0.8 }, kg: [5, 40], cm: [80, 180], value: 520,
    fight: { power: 1.9, stamina: 1.8, erratic: 0.8, jump: 0.3 }, art: A({ h: 0.6, w: 0.04, back: 0x4a5a6a, belly: 0xe8ecf0, fin: 0x3a4a5a, pat: 'waves', patCol: 0x8aa0b8, flat: true, tail: 'eel' }),
    blurb: 'Rides the storm swell just under the surface. You will not see one on a calm day.' },
  { id: 'birdbait', name: 'Silver Sprat', rarity: 'common', where: 'all', hotspot: 'birds', water: 'sea', time: 'any', bait: { worm: 1, pieces: 1, glow: 1 }, kg: [0.1, 0.4], cm: [10, 18], value: 35,
    fight: { power: 0.5, stamina: 0.5, erratic: 1.2, jump: 0.4 }, art: A({ h: 0.2, w: 0.08, back: 0x8aa8c0, belly: 0xf4f8fa, pat: 'none', tail: 'fork' }),
    blurb: 'The little fish the birds are diving for. Where there are sprats, there is something bigger hunting them.' },
  { id: 'glowjelly', name: 'Lantern Jelly', rarity: 'epic', where: 'all', hotspot: 'glow', water: 'sea', time: 'night', bait: { glow: 1.6, mystery: 1 }, kg: [1, 6], cm: [30, 70], value: 1800,
    fight: { power: 1.2, stamina: 1.4, erratic: 1.1, jump: 0 }, art: A({ h: 0.5, w: 0.45, back: 0x7af0e0, belly: 0xd8fff8, fin: 0x9affd8, pat: 'lights', patCol: 0xffffff, tail: 'none', extras: ['glow', 'ghost'] }),
    blurb: 'It makes the water glow. Only found in the glowing patches that drift across the sea at night.' },
  { id: 'deepbubbler', name: 'Bubble-eye Grouper', rarity: 'rare', where: 'all', hotspot: 'bubbles', water: 'sea', time: 'any', bait: { pieces: 1.3, mystery: 1 }, kg: [8, 50], cm: [60, 140], value: 640,
    fight: { power: 2.0, stamina: 2.0, erratic: 0.4, jump: 0 }, art: A({ h: 0.34, w: 0.2, back: 0x6a5a4a, belly: 0xd8c8b0, fin: 0x5a4a3a, pat: 'spots', patCol: 0x3a2a1a, mouth: 1.8, head: 1.4, tail: 'round' }),
    blurb: 'Lives far below and breathes out the bubbles you see rising. Fish right where they break.' },
  { id: 'chest', name: 'Treasure Chest', rarity: 'rare', where: ['tropic', 'open', 'black', 'home'], water: 'sea', time: 'any', bait: { magnetic: 1.6, mystery: 0.7 }, kg: [10, 25], cm: [60, 90], value: 0, beh: 'chest', junk: 'chest',
    fight: { power: 1.3, stamina: 1.2, erratic: 0.1, jump: 0 }, art: A({}), blurb: 'Heavy, locked and dripping. Probably a real one. Probably.' },
];

/* Giants: world-event fish, only hookable while the event is running. */
export const GIANTS = [
  { id: 'bertha', name: 'Big Bertha', rarity: 'giant', where: ['home'], kg: [180, 260], cm: [300, 380], value: 2600, rod: 2,
    fight: { power: 3.4, stamina: 4.5, erratic: 0.5, jump: 0.4 }, art: A({ h: 0.32, w: 0.15, back: 0x3f5e28, belly: 0xe0dcae, pat: 'bars', patCol: 0x2a3e1a, mouth: 1.6, extras: ['scar'] }),
    blurb: 'Mother of every bass in the bay. Has swallowed three outboard motors.' },
  { id: 'whiskers', name: 'Old Whiskers', rarity: 'giant', where: ['home'], kg: [220, 320], cm: [320, 420], value: 3000, rod: 2,
    fight: { power: 3.6, stamina: 5, erratic: 0.3, jump: 0 }, art: A({ h: 0.2, w: 0.18, back: 0x4a4a42, belly: 0xd8d4c4, mouth: 1.6, head: 1.3, extras: ['whiskers', 'scar'], tail: 'round' }),
    blurb: 'A catfish the size of a canoe. The whiskers alone are two metres long.' },
  { id: 'grouper', name: 'Glacier Grouper', rarity: 'giant', where: ['frost'], kg: [260, 400], cm: [260, 340], value: 3400, rod: 3,
    fight: { power: 3.8, stamina: 5.5, erratic: 0.3, jump: 0 }, art: A({ h: 0.34, w: 0.2, back: 0x8ab0c8, belly: 0xf4faff, pat: 'spots', patCol: 0xffffff, mouth: 1.8, head: 1.3, tail: 'round', extras: ['frost'] }),
    blurb: 'Lives under the ice shelf and eats seals. Allegedly.' },
  { id: 'reefking', name: 'Reef King', rarity: 'giant', where: ['tropic'], kg: [300, 480], cm: [280, 360], value: 3800, rod: 3,
    fight: { power: 4.0, stamina: 5.5, erratic: 0.6, jump: 0.2 }, art: A({ h: 0.36, w: 0.16, back: 0x3ab0a0, belly: 0x9ae0d0, fin: 0xf07ab0, pat: 'scales', patCol: 0x2a8a8a, beak: true, extras: ['crest'] }),
    blurb: 'A parrotfish that ate an entire reef and wants another.' },
  { id: 'tunatank', name: 'The Tuna Tank', rarity: 'giant', where: ['open'], kg: [500, 800], cm: [350, 450], value: 4600, rod: 3,
    fight: { power: 4.6, stamina: 6, erratic: 0.4, jump: 0.3 }, art: A({ h: 0.3, w: 0.22, back: 0x1a2a4a, belly: 0xd8dce8, fin: 0xe8d040, tail: 'lunate', extras: ['finlets', 'scar'] }),
    blurb: 'Tows fishing boats for fun. Has done it to every captain in the guild.' },
  { id: 'abyssangler', name: 'Abyssal Angler', rarity: 'giant', where: ['black'], kg: [400, 700], cm: [300, 400], value: 5200, rod: 3,
    fight: { power: 4.4, stamina: 6, erratic: 0.4, jump: 0 }, art: A({ h: 0.5, w: 0.42, back: 0x2e2a2e, belly: 0x3a343a, head: 1.6, mouth: 2.2, tail: 'round', extras: ['lure', 'teeth'] }),
    blurb: 'Its lure is the size of a lantern. So is each tooth.' },
];

// the deep-water regulars follow you all the way out to Vigil's End
for (const f of FISH) if (['cod', 'mackerel', 'tuna', 'halibut', 'marlin', 'swordfish', 'oarfish', 'angler', 'viper', 'gulper', 'coelacanth', 'sharkfish', 'mimic', 'chest'].includes(f.id) && Array.isArray(f.where)) f.where.push('reach');
GIANTS.find(g => g.id === 'abyssangler').where.push('reach');

export const FISH_BY_ID = Object.fromEntries([...FISH, ...GIANTS].map(f => [f.id, f]));

/** Median weight of a species. */
export const midKg = f => (f.kg[0] + f.kg[1]) / 2;

/* ---------------- depth progression ----------------
   ZMIN is the zone a species belongs to. Outside it (shallower) it is a
   rare stray; at or past it the rarer it is the more the deep favours it. */
export const ZMIN = {
  bass: 0, perch: 0, trout: 0, carp: 0, pike: 0, catfish: 0, goldtrout: 0, cod: 0, flounder: 0, mackerel: 0, rainbowkoi: 0, thief: 0, slapfish: 0,
  seabass: 1, salmon: 1, char: 1, icecod: 1, burbot: 1, parrot: 1, reefdancer: 1, puffer: 1, bombfish: 1, eel: 1, magnetfish: 1,
  frostpike: 2, barracuda: 2, mahi: 2, tuna: 2, halibut: 2, mimic: 2, sharkfish: 2, ghost: 2,
  glaciersalmon: 3, swordfish: 3, sunfish: 3, marlin: 3, oarfish: 3, lantern: 3,
  angler: 4, viper: 4, gulper: 4, coelacanth: 4,
  fogfin: 4, hushray: 4, watcher: 4, vigillight: 4,
  inkfin: 2, suckerfish: 2, hatchling: 2,
  thundertuna: 2, squallray: 1, deepbubbler: 1, glowjelly: 1, artifact: 1, oldmap: 1,
};
export const zoneOfSpecies = f => ZMIN[f.id] ?? 0;

/* Variants: something is not quite right with this one. Chance and pool
   grow with the zone, so the strangest catches live the farthest out. */
export const VARIANTS = [
  { id: 'giant', name: 'Giant', mult: 2.2, size: 1.75, w: 1.0, zone: 0, fight: 0.25, css: '#ffb070' },
  { id: 'golden', name: 'Golden', mult: 6, size: 1, w: 0.3, zone: 0, fight: 0.1, css: '#f2c14a' },
  { id: 'albino', name: 'Albino', mult: 3, size: 1, w: 0.6, zone: 1, fight: 0, css: '#f4f0e8' },
  { id: 'armored', name: 'Armoured', mult: 2.6, size: 1.15, w: 0.6, zone: 2, fight: 0.3, css: '#a8b8c8' },
  { id: 'glowing', name: 'Glowing', mult: 4, size: 1, w: 0.55, zone: 3, fight: 0.15, css: '#8af0ff' },
  { id: 'abyssal', name: 'Abyssal', mult: 7.5, size: 1.45, w: 0.45, zone: 4, fight: 0.45, css: '#c07af0' },
];
export const VARIANT_BY_ID = Object.fromEntries(VARIANTS.map(v => [v.id, v]));
const ZONE_VALUE = [1.0, 1.4, 1.9, 2.7, 4.0];
const ZONE_SIZE = [0, 0.12, 0.25, 0.42, 0.65];
const ZONE_VARIANT = [0.03, 0.06, 0.10, 0.16, 0.24];
export const zoneValue = z => ZONE_VALUE[Math.max(0, Math.min(4, z | 0))];

export function rollVariant(zone, r = Math.random) {
  if (r() > ZONE_VARIANT[Math.max(0, Math.min(4, zone | 0))]) return null;
  const pool = VARIANTS.filter(v => v.zone <= zone);
  let t = pool.reduce((a, v) => a + v.w, 0), x = r() * t;
  for (const v of pool) { x -= v.w; if (x <= 0) return v.id; }
  return pool[0].id;
}
export const zoneSizeBoost = z => ZONE_SIZE[Math.max(0, Math.min(4, z | 0))];

/** How hard a fish fights on the bar (compared against a rod's rating).
    One rule everywhere: bigger, rarer, pricier and stranger fish fight harder. */
const RARITY_FIGHT = { common: 0, uncommon: 0.05, rare: 0.12, epic: 0.22, legendary: 0.34, giant: 0.25, junk: 0 };
export function fightOf(f, kg, variant = null) {
  const F = f.fight;
  let v = 0.45 + F.power * 0.33 + Math.log10(Math.max(0.05, kg) + 1) * 0.32;
  v += RARITY_FIGHT[f.rarity] || 0;
  v += Math.max(0, Math.log10(Math.max(1, f.value) / 100)) * 0.05;
  if (variant && VARIANT_BY_ID[variant]) v += VARIANT_BY_ID[variant].fight;
  return v;
}

/** Display name of a catch, variant first. */
export function catchName(sp, variant) {
  const f = typeof sp === 'string' ? FISH_BY_ID[sp] : sp;
  const v = variant && VARIANT_BY_ID[variant];
  return (v ? v.name + ' ' : '') + (f ? f.name : '?');
}

/** Coin value of one catch. `mult` carries depth zone and variant. */
export function fishValue(f, kg, mult = 1) {
  if (f.beh === 'chest') return 0;
  const m = midKg(f);
  return Math.max(1, Math.round(f.value * Math.pow(Math.max(0.05, kg) / m, 0.7) * mult));
}

/** The pieces of a price, for the market receipt. */
export function valueBreakdown(f, kg, zone = 0, variant = null) {
  const m = midKg(f);
  const size = Math.pow(Math.max(0.05, kg) / m, 0.7);
  const zm = zoneValue(zone), vm = variant && VARIANT_BY_ID[variant] ? VARIANT_BY_ID[variant].mult : 1;
  return { base: f.value, size, zone: zm, variant: vm, total: fishValue(f, kg, zm * vm) };
}

/** Roll a size in 0..1 skewed toward small; big ones are rare. */
export function rollSize(r, luck = 0) {
  const a = r(), b = r();
  return Math.min(1, Math.pow(Math.min(a, b) * 0.6 + a * 0.4, 1.35 - luck * 0.3));
}

export const JOURNAL_ORDER = FISH.filter(f => f.rarity !== 'junk' || f.id === 'chest').concat(GIANTS);
