/* NPCData.js - the people of Driftwood Bay and the outposts.

   `at` names a settlement anchor (resolved in Settlement.js) so moving a
   building moves its keeper. `role` decides what talking to them opens.
   Pronouns are in `pr` and are used wherever the game refers to them. */

export const NPCS = [
  { id: 'gus', name: 'old gus', full: 'Old Gus', pr: 'he', role: 'lore', at: 'gusChair', pose: 'sit',
    look: { skin: 0xf1c9a5, shirt: 0x5a6a7a, pants: 0x6a2e2a, boots: 0x2a2a2a, hat: 'captain', hatCol: 0xf2f2ee, hair: 'short', hairCol: 0xdddddd, beard: 'full', beardCol: 0xeeeeee, nose: 1.3, belly: 0.4, vest: 0x5a3a2a },
    lines: [
      'The waters round here are not normal, kid. Never have been. Not since the guild was young.',
      'Sit a while. Fish bite better when you stop wanting them to.',
      'I saw Grandmother Gloop once. Mirror Lake, full moon. She looked at me. I looked at her. I went home.',
      'Big fish pull the boat. Bigger fish pull the fisherman. The biggest ones pull the whole village into a story.',
      'You want advice? Never reel when the line is screaming. Let it run. Then take it back.',
      'If you hear the ice sing up at Frostbite, walk. Do not run. Walk.',
    ] },
  { id: 'melvin', name: 'melvin', full: 'Melvin', pr: 'he', role: 'tackle', at: 'tackleDoor', pose: 'stand',
    look: { skin: 0xf0c8a0, shirt: 0x4a5a8a, pants: 0xe8862a, boots: 0x2a2a2a, hat: 'none', hair: 'bald', hairCol: 0x8a6a4a, glasses: true, overalls: true, nose: 1.5, height: 1.02 },
    lines: [
      'Welcome to Melvin\'s Bait and Tackle. Everything is on sale. Nothing is refundable.',
      'Explosive bait? Legally I have to tell you it is a bad idea. Personally I love it.',
      'That rod of yours has seen better decades.',
      'Mystery bait is called mystery bait because I also do not know what is in it.',
    ] },
  { id: 'marge', name: 'marge', full: 'Marge the Shipwright', pr: 'she', role: 'boatyard', at: 'yardDoor', pose: 'stand',
    look: { skin: 0xc68a62, shirt: 0x7a3a2a, pants: 0x3a3a48, boots: 0x3a2a20, hat: 'beanie', hatCol: 0x3a6a8a, hair: 'long', hairCol: 0x2a1e16, nose: 1.1, build: 1.1 },
    lines: [
      'You break it, I fix it. You sink it, I build you a new one. Either way you pay me.',
      'That rowboat has more patches than planks. I respect it.',
      'The open sea eats little boats. Get a hull that can take a wave.',
      'You want floodlights for the Blackwater. Trust me. You want floodlights.',
    ] },
  { id: 'odessa', name: 'odessa', full: 'Guildmaster Odessa', pr: 'she', role: 'guild', at: 'guildDoor', pose: 'stand',
    look: { skin: 0x70462e, shirt: 0x2e4e5e, pants: 0x2a2a30, boots: 0x1a1a1a, hat: 'captain', hatCol: 0x1e2a3a, hair: 'bun', hairCol: 0x1a1410, glasses: true, nose: 1.0, vest: 0x8a6a3a },
    lines: [
      'The guild map shows every leviathan we know of. Find the clues and the map will show you where they wait.',
      'Captain Mare founded this guild a hundred years ago. He left a mess. We are still cleaning it up.',
      'Every leviathan carries a shard. Bring them home and the table starts to hum.',
    ] },
  { id: 'pim', name: 'pim', full: 'Pim the Fishmonger', pr: 'they', role: 'market', at: 'market', pose: 'stand',
    look: { skin: 0xe0ac86, shirt: 0xf2f2ee, pants: 0x3a4a5e, boots: 0x2e5a3a, hat: 'cap', hatCol: 0x2e7ab0, hair: 'short', hairCol: 0xa84a2a, beard: 'moustache', beardCol: 0xa84a2a, nose: 1.2, belly: 0.6 },
    lines: [
      'Fresh fish! I buy anything with fins. And some things without.',
      'Bring your boat up to the dock and I will take the whole catch off your hands.',
      'A Bombfish? No. No no no. Throw it back. Throw it far.',
    ] },
  { id: 'ingrid', name: 'ingrid', full: 'Ingrid of the Ice', pr: 'she', role: 'ice', at: 'iceHut', pose: 'stand',
    look: { skin: 0xf5d7bd, shirt: 0xc8452e, pants: 0x3a3a48, boots: 0x3a2a20, hat: 'fur', hatCol: 0xe8e0d0, hair: 'long', hairCol: 0xe8d8a0, nose: 1.0 },
    lines: [
      'You want to fish the lake? Drill a hole. Drop a line. Do not stand on the singing ice.',
      'I sell augers, warm bait and advice. The advice is free: go home before dark.',
    ] },
  { id: 'coco', name: 'coco', full: 'Coco', pr: 'he', role: 'trader', at: 'tiki', pose: 'stand',
    look: { skin: 0x9a6444, shirt: 0xf07a8a, pants: 0xe8e0c8, boots: 0x8a6a44, hat: 'straw', hair: 'short', hairCol: 0x1a1410, beard: 'stubble', nose: 1.1 },
    lines: [
      'Welcome to the Sunken Coast, friend. Mind the wrecks. Mind the sharks. Mind the sharks in the wrecks.',
      'Magnetic bait brings up treasure. And chests. And chests that are not chests.',
    ] },
  { id: 'keeper', name: 'the keeper', full: 'The Lighthouse Keeper', pr: 'he', role: 'lore', at: 'lighthouse', pose: 'stand',
    look: { skin: 0xe0ac86, shirt: 0x2e3e5a, pants: 0x2a2a30, hat: 'hood', hatCol: 0x3a4a3a, beard: 'full', beardCol: 0x8a8a8a, nose: 1.4 },
    lines: [
      'I have not been down those stairs in thirty years. Not since the arms came up the wall.',
      'On storm nights something big swims out past the stacks. It likes the lightning.',
      'The sea out here does not forgive small boats.',
    ] },
];

export const THIEF = { id: 'pete', name: 'slippery pete', full: 'Slippery Pete', pr: 'he',
  look: { skin: 0xe0ac86, shirt: 0x2a2a2a, pants: 0x5a3a24, hat: 'beanie', hatCol: 0x1a1a1a, hair: 'short', hairCol: 0x2a1e16, beard: 'stubble', nose: 1.6, build: 0.9 } };

/* Villagers who wander the settlement for life. */
export const VILLAGERS = [
  { name: 'nell', seed: 11 }, { name: 'bo', seed: 23 }, { name: 'ruth', seed: 37 }, { name: 'otto', seed: 41 },
  { name: 'dex', seed: 53 }, { name: 'june', seed: 67 },
];

export const RADIO = {
  storm: ['Radio: Storm coming in off the open sea. Get your boats home!', 'Radio: This is Driftwood harbour. Big weather. Big waves. Big trouble.'],
  migration: ['Radio: Fish migration! The water is boiling with them!', 'Radio: Every fish in the bay just showed up at once. Grab a net!'],
  giant: ['Radio: Something HUGE just went under the harbour buoy.', 'Radio: WHAT WAS THAT? Did anybody else see that?'],
  whirlpool: ['Radio: Whirlpool forming. We should probably leave.', 'Radio: The sea is spinning. Repeat, the sea is SPINNING.'],
  meteor: ['Radio: Something just fell out of the sky into the sea!', 'Radio: Meteor down! The water where it landed is glowing!'],
  thief: ['Radio: Hey, is that Slippery Pete in YOUR boat?', 'Radio: Pete\'s nicked another boat. Somebody chase him.'],
};
