/* LeviathanData.js - the twelve legendary creatures and the story they tell.

   You do not simply meet a leviathan. You find its clues first:
     mark    something it did - a bite out of a wreck, gouges in a pier
     scale   something it left - a scale taller than you, a tooth
     sound   something you hear - only at night (or in a storm) near a place
     sonar   something the sonar sees - needs a sonar, near a place
     catch   something it scared into your line - catch a given species
   When every clue is found, the guild map marks its LURE POINT. Go there
   (at the right time), put a line in, and the game changes for a few
   minutes.

   Each one swallowed a shard of the Heart of the Tide. That is why they are
   so big, and that is the mystery the guild has been chasing for a hundred
   years. */

export const LEVIATHANS = [
  { id: 'gloop', name: 'Grandmother Gloop', title: 'The Thing in Mirror Lake', region: 'home', kind: 'catfish', size: 16,
    colors: { back: 0x4a4a3e, belly: 0xc8c0a8, fin: 0x3a3a30, glow: 0xa8f0a0 },
    lure: { x: -75, z: -45, r: 30, time: 'night', water: 'lake' }, rod: 2, hp: 50, stamina: 110, power: 3, reward: 4000,
    clues: [
      { id: 'gloop1', type: 'mark', text: 'Bite marks on the lake pier. Each tooth mark is the size of your fist.', at: [-40, -20], obj: 'pierbite' },
      { id: 'gloop2', type: 'catch', text: 'You caught a catfish in Mirror Lake. It was shaking, and not from the cold.', species: 'catfish', region: 'home', water: 'lake' },
      { id: 'gloop3', type: 'sound', text: 'A deep, wet croak rolled across Mirror Lake in the dark. The reeds went flat.', at: [-75, -45], r: 60, time: 'night' },
    ],
    story: 'Gloop was the first. Old Gus swears she was the size of a trout when he was a boy. Inside her, wrapped in a hundred years of lake weed, was a shard of green-blue stone that hummed like a struck bell.' },

  { id: 'devourer', name: 'The Driftwood Devourer', title: 'Terror of the Bay', region: 'home', kind: 'pike', size: 24,
    colors: { back: 0x3a5a2e, belly: 0xd8d8b0, fin: 0x2a4a22, glow: 0xd8ff70 },
    lure: { x: -210, z: 250, r: 40, time: 'any', water: 'sea' }, rod: 3, hp: 70, stamina: 150, power: 4, reward: 6500,
    clues: [
      { id: 'dev1', type: 'mark', text: 'A bite taken clean out of a moored rowboat. Clean. Out.', at: [-275, 158], obj: 'wreck' },
      { id: 'dev2', type: 'scale', text: 'A green scale as big as a door, washed up on Gull Rock.', at: [-300, 110], obj: 'scale', col: 0x6ab04a },
      { id: 'dev3', type: 'sonar', text: 'Sonar: something forty metres long is circling the mouth of the bay.', at: [-210, 250], r: 90 },
    ],
    story: 'The Devourer had eaten three rowboats, one lighthouse keeper\'s lunch and a shard of the Heart. The guild archive has a drawing of it from 1911. It was smaller then.' },

  { id: 'frostmaw', name: 'The Frostmaw', title: 'Under the Ice', region: 'frost', kind: 'serpent', size: 30,
    colors: { back: 0xc8e0ee, belly: 0xf8fcff, fin: 0x8ab8d8, glow: 0x9af0ff },
    lure: { x: 0, z: -700, r: 70, time: 'any', water: 'ice' }, rod: 3, hp: 80, stamina: 160, power: 4.5, reward: 8000,
    clues: [
      { id: 'maw1', type: 'mark', text: 'Claw gouges down the side of Ingrid\'s ice hut. From below.', at: [70, -612], obj: 'claw' },
      { id: 'maw2', type: 'catch', text: 'The Frost Pike you pulled up had frost burns in the shape of a mouth.', species: 'frostpike', region: 'frost' },
      { id: 'maw3', type: 'sound', text: 'At night the ice on Frostbite Lake sings. Something is swimming right under your feet.', at: [0, -700], r: 90, time: 'night' },
    ],
    story: 'The Frostmaw was coiled around its shard like a dragon on gold. The lake has not frozen solid since the shard went in - it keeps the water beneath just warm enough for something to live there.' },

  { id: 'aurora', name: 'The Aurora Whale', title: 'The Singer in the North', region: 'frost', kind: 'whale', size: 36,
    colors: { back: 0x2e3a5a, belly: 0xd8e4f0, fin: 0x2a3450, glow: 0x7af0c0 },
    lure: { x: -40, z: -1150, r: 70, time: 'night', water: 'sea' }, rod: 3, hp: 90, stamina: 180, power: 4, reward: 9000,
    clues: [
      { id: 'aur1', type: 'sound', text: 'Whale song under the northern cliffs. It is singing the same four notes as the humming stone.', at: [-40, -1120], r: 140, time: 'night' },
      { id: 'aur2', type: 'scale', text: 'A barnacle the size of a bathtub on the north shore. Something scraped it off.', at: [80, -1085], obj: 'barnacle' },
      { id: 'aur3', type: 'sonar', text: 'Sonar: one enormous, slow heartbeat. Getting louder.', at: [-40, -1150], r: 120 },
    ],
    story: 'The whale never meant anyone harm. It swallowed the shard by accident and has been singing ever since, because the shard sings and the whale is lonely.' },

  { id: 'wreckjaw', name: 'Wreckjaw', title: 'Shark of the Sunken Coast', region: 'tropic', kind: 'shark', size: 22,
    colors: { back: 0x5a6a7a, belly: 0xf0f2f4, fin: 0x4a5a6a, glow: 0xff9a5a },
    lure: { x: 800, z: 95, r: 50, time: 'any', water: 'sea' }, rod: 3, hp: 90, stamina: 150, power: 5, reward: 9500,
    clues: [
      { id: 'wj1', type: 'mark', text: 'A shipwreck with a shark-shaped hole bitten through three layers of oak.', at: [742, 132], obj: 'wreck' },
      { id: 'wj2', type: 'scale', text: 'A tooth on the beach. It is taller than your leg.', at: [860, 215], obj: 'tooth' },
      { id: 'wj3', type: 'sonar', text: 'Sonar: something big is patrolling the wrecks. It turned when you pinged it.', at: [800, 95], r: 110 },
    ],
    story: 'Wreckjaw had sunk more ships than any storm. The shard was lodged in its jaw like a gold tooth, and it had been grinding on everything it met.' },

  { id: 'shellback', name: 'Old Shellback', title: 'The Island That Swims', region: 'tropic', kind: 'turtle', size: 28,
    colors: { back: 0x6a7a3a, belly: 0xd8c890, fin: 0x5a6a3a, glow: 0xf0e070 },
    lure: { x: 955, z: 265, r: 60, time: 'day', water: 'sea' }, rod: 3, hp: 120, stamina: 170, power: 3.5, reward: 10000,
    clues: [
      { id: 'sb1', type: 'scale', text: 'A piece of shell on Palm Cay, green with coral. It is warm.', at: [770, 300], obj: 'shell' },
      { id: 'sb2', type: 'catch', text: 'The Mahi-Mahi had a sliver of old turtle shell in its gill.', species: 'mahi', region: 'tropic' },
      { id: 'sb3', type: 'sound', text: 'A slow groan under Mount Smoulder at night, like an island rolling over in its sleep.', at: [1000, -60], r: 150, time: 'night' },
    ],
    story: 'Old Shellback was mistaken for an island by the first sailors to reach the coast. They built a hut on him. He did not notice for eleven years.' },

  { id: 'tentacula', name: 'Queen Tentacula', title: 'The Kraken', region: 'open', kind: 'kraken', size: 30,
    colors: { back: 0x8a2a3a, belly: 0xf0b0b0, fin: 0x6a1a2a, glow: 0xff6a8a },
    lure: { x: -980, z: -260, r: 60, time: 'any', water: 'sea' }, rod: 4, hp: 130, stamina: 200, power: 5.5, reward: 14000,
    clues: [
      { id: 'kr1', type: 'mark', text: 'Sucker marks all the way up the lighthouse. The top one is forty feet high.', at: [-812, -52], obj: 'suckers' },
      { id: 'kr2', type: 'sonar', text: 'Sonar: eight things moving together. No - one thing, with eight arms.', at: [-980, -260], r: 140 },
      { id: 'kr3', type: 'catch', text: 'The tuna you caught had a ring of sucker scars around its middle.', species: 'tuna', region: 'open' },
    ],
    story: 'The Queen wrapped her shard in her arms and dragged it to the bottom of the open sea. The lighthouse keeper watched her do it, and never went down the stairs again.' },

  { id: 'stormcaller', name: 'The Stormcaller', title: 'Serpent of the Squall', region: 'open', kind: 'serpent', size: 38,
    colors: { back: 0x1a2a4a, belly: 0x8ab0d8, fin: 0x2a4a7a, glow: 0x8af0ff },
    lure: { x: -1080, z: 140, r: 70, time: 'storm', water: 'sea' }, rod: 4, hp: 140, stamina: 210, power: 6, reward: 15000,
    clues: [
      { id: 'st1', type: 'sound', text: 'In the storm, between two thunderclaps, a roar that was not thunder.', at: [-1000, 150], r: 220, time: 'storm' },
      { id: 'st2', type: 'scale', text: 'A blue scale on the sea stack, still crackling with static.', at: [-1022, 222], obj: 'scale', col: 0x3a6ab0 },
      { id: 'st3', type: 'sonar', text: 'Sonar: it only comes up when the weather is at its worst.', at: [-1080, 140], r: 160 },
    ],
    story: 'The Stormcaller does not cause the storms. The shard in its belly does - it pulls on the weather the way the moon pulls on the tide.' },

  { id: 'ironmarlin', name: 'The Iron Marlin', title: 'The Needle', region: 'open', kind: 'marlin', size: 20,
    colors: { back: 0x6a7a8a, belly: 0xd8e0e8, fin: 0x4a5a6a, glow: 0xffd070 },
    lure: { x: -860, z: 460, r: 60, time: 'day', water: 'sea' }, rod: 4, hp: 110, stamina: 230, power: 6.5, reward: 15000,
    clues: [
      { id: 'im1', type: 'catch', text: 'The Blue Marlin fought like it was running from something. It was.', species: 'marlin', region: 'open' },
      { id: 'im2', type: 'mark', text: 'A hull on the sea stack, punched straight through by something narrow and fast.', at: [-712, 360], obj: 'wreck' },
      { id: 'im3', type: 'sonar', text: 'Sonar: a contact moving at sixty knots. That is not possible.', at: [-860, 460], r: 150 },
    ],
    story: 'The Iron Marlin\'s scales had turned to metal around the shard. Fishermen called it the Needle. It was the fastest thing in the sea and it had never once been caught.' },

  { id: 'lanternking', name: 'The Lantern King', title: 'Light of the Blackwater', region: 'black', kind: 'angler', size: 26,
    colors: { back: 0x2a2630, belly: 0x3a343e, fin: 0x221e28, glow: 0x9affd8 },
    lure: { x: -780, z: 700, r: 60, time: 'any', water: 'sea', lights: 1 }, rod: 4, hp: 150, stamina: 230, power: 6, reward: 18000,
    clues: [
      { id: 'lk1', type: 'mark', text: 'Captain Mare\'s wreck, the Tidesinger. Something has been nesting in the hold.', at: [-560, 742], obj: 'founderwreck' },
      { id: 'lk2', type: 'sound', text: 'In the Blackwater at night: a clicking, like a lantern being lit and lit and lit.', at: [-720, 720], r: 150, time: 'night' },
      { id: 'lk3', type: 'sonar', text: 'Sonar: a single light, far below, pretending to be a star.', at: [-780, 700], r: 150 },
    ],
    story: 'The Lantern King swallowed the brightest shard and has used it as a lure ever since. Every light you have seen in the Blackwater was his.' },

  { id: 'hollow', name: 'The Hollow Eel', title: 'The Mouth Below', region: 'black', kind: 'eel', size: 42,
    colors: { back: 0x1e1a24, belly: 0x2e2a34, fin: 0x16121c, glow: 0xff5a8a },
    lure: { x: -540, z: 930, r: 60, time: 'night', water: 'sea', lights: 1 }, rod: 4, hp: 150, stamina: 250, power: 7, reward: 20000,
    clues: [
      { id: 'he1', type: 'catch', text: 'The Gulper Eel you landed was full of rocks. It had been eating stones to be heavier. To hide.', species: 'gulper', region: 'black' },
      { id: 'he2', type: 'scale', text: 'A shed skin wrapped round the black spire. It goes round nine times.', at: [-470, 712], obj: 'skin' },
      { id: 'he3', type: 'sonar', text: 'Sonar: the trench floor is moving.', at: [-540, 930], r: 150 },
    ],
    story: 'The Hollow Eel is mostly mouth, and the mouth was mostly shard. It was the last of the eleven, and the closest to the Gate.' },

  { id: 'tidemother', name: 'The Tidemother', title: 'Guardian of the Heart', region: 'black', kind: 'mother', size: 60, final: true,
    colors: { back: 0x1a2a3a, belly: 0x4a6a8a, fin: 0x1a3a5a, glow: 0x6af0ff },
    lure: { x: -680, z: 845, r: 60, time: 'night', water: 'sea', lights: 1 }, rod: 4, hp: 260, stamina: 360, power: 8, reward: 60000,
    clues: [],
    story: 'She was never a monster. She was the keeper of the Heart, and when the Heart broke she fell asleep beneath the Gate to wait for someone to bring it home.' },
];
export const LEV_BY_ID = Object.fromEntries(LEVIATHANS.map(l => [l.id, l]));

/* Messages in bottles - Captain Aldous Mare's log, found in order. */
export const BOTTLES = [
  'Log of the Tidesinger, day one. The guild is founded. Six boats, eleven men, one very bad cook. The sea around Driftwood is flat as a millpond. It always has been.',
  'Day forty. Found a stone arch rising out of the water far to the south-west. Runes on it that glow at night. The men call it the Drowned Gate. I call it a fortune.',
  'Day forty-one. Beneath the arch: a great stone heart, humming. The water around it is perfectly calm even in a gale. Whoever built this could command the sea.',
  'Day forty-four. We lowered chains. The Heart would not come up. I ordered more chains.',
  'Day forty-five. It broke. God forgive me, it broke into eleven pieces and they scattered like frightened fish. The sea has not been calm since.',
  'Day sixty. Something ate the Merriweather\'s rowboat off Gull Rock. The men say it was a pike. Pike do not grow that big. Not normally.',
  'Day ninety. Storms every week now. A whale singing in the north. A shark in the south with a glowing tooth. I know what they have swallowed.',
  'Day two hundred. I have founded the guild map. Every creature that swallowed a shard is marked on it. When they are caught, the shards come home.',
  'Day three hundred. Something enormous sleeps beneath the Gate. It opened one eye when we passed. It was waiting for the shards, not for us.',
  'Last entry. I am too old to finish this. Whoever reads this: catch them all. Bring the Heart home. The Tidemother will rise, and she will not be happy, and you must be braver than I was.',
];

export const STORY = {
  intro: 'You are the newest member of the Driftwood Fishing Guild. You have a rowboat, a rod and a cabin with nothing in it. Old Gus says the waters around the bay are not normal. Old Gus is right.',
  midpoint: 'The shards are humming together on the guild table. Odessa says they are trying to find each other.',
  ending: 'The Heart of the Tide sits whole again beneath the Drowned Gate. The Tidemother sinks back into the dark, humming. By morning the sea around Driftwood Bay is calm for the first time in a hundred years - calm, but still full of very strange fish.',
};
