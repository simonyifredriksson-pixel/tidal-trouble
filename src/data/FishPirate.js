/* FishPirate.js - the Drowned Bell: the lake in the middle of Blackflag Isle.

   Twelve fish found nowhere else in the sea. The pirates say the lake has
   a ship at the bottom of it - the bell of her still rings in a storm - and
   that everything in it has eaten gold, gunpowder or worse.

   The last of them is mythical: one bite in four hundred, the fight of your
   life, and nobody alive has landed one. */

import { F } from './FishKit.js';

const PI = ['pirate'];

export const PIRATE_FISH = [
  F(6, 'doubloon', 'Doubloon Carp', 'common', PI, 'lake', 'any', { worm: 1.1, pieces: 1, grub: 1 }, [2, 11], [35, 75], 180, [1.2, 1.5, 0.3, 0.1],
    { shape: 'hump', hump: 0.45, h: 0.34, w: 0.16, back: 0xc89a2a, belly: 0xf2dc80, fin: 0xa87818, pat: 'scales', patCol: 0xf8e060, tail: 'fork', extras: ['whiskers', 'lips'] },
    'Its scales are round, flat and gold, and they come off in your hand like coins. They are not coins. The pirates keep trying.'),
  F(6, 'powderminnow', 'Powder Minnow', 'common', PI, 'lake', 'any', { worm: 1.2, explosive: 1.6 }, [0.05, 0.4], [8, 18], 110, [0.5, 0.5, 1.6, 0.6],
    { shape: 'torpedo', h: 0.2, back: 0x2a2a2e, belly: 0x6a6a70, fin: 0x1a1a1e, pat: 'speckle', patCol: 0xd8d0c0, tail: 'fork', extras: ['fuse'] },
    'Black as powder, and it smells of it. Schools of them live round the old barrels on the lake bed and dart about like sparks.'),
  F(6, 'grogfish', 'Grogfish', 'common', PI, 'lake', 'any', { pieces: 1.2, worm: 1, mystery: 1.3 }, [1, 6], [25, 50], 150, [1.0, 1.1, 1.9, 0.2],
    { shape: 'box', h: 0.4, w: 0.26, back: 0x5a6a2a, belly: 0xc8c070, fin: 0x4a5a22, pat: 'patches', patCol: 0x8a7a3a, tail: 'round', extras: ['warts', 'lips', 'bigeye'] },
    'Bloated, bleary and never swims in a straight line. Rum casks go into this lake one way or another, and something has to drink it.'),
  F(6, 'plankperch', 'Plankwalker Perch', 'common', PI, 'lake', 'day', { worm: 1.2, grub: 1.1 }, [0.4, 3], [20, 42], 130, [0.9, 0.9, 0.7, 0.4],
    { h: 0.3, w: 0.13, back: 0x2a2622, belly: 0xece4d0, fin: 0xa8302a, pat: 'bars', patCol: 0xf0e8d4, tail: 'fork', extras: ['spinefins'] },
    'Black and cream stripes like a sailor\'s shirt. It swims out along the sunken yardarms and just... stops at the end.'),
  F(6, 'cutlasseel', 'Cutlass Eel', 'uncommon', PI, 'lake', 'night', { pieces: 1.3, glow: 1 }, [2, 9], [80, 170], 320, [1.5, 1.4, 1.2, 0.2],
    { h: 0.09, w: 0.05, back: 0xb8c0c8, belly: 0xf0f4f8, fin: 0x8a929a, pat: 'fade', patCol: 0xe8eef4, tail: 'eel', extras: ['sword', 'bigeye'] },
    'Flat, silver and curved like a blade. It hangs edge-on in the water at night so you cannot see it until it moves.'),
  F(6, 'pollywrasse', 'Polly Wrasse', 'uncommon', PI, 'lake', 'day', { worm: 1, grub: 1.4, feather: 1.6 }, [0.5, 3], [22, 45], 290, [1.0, 1.0, 1.4, 0.8],
    { h: 0.32, w: 0.13, back: 0x2aa84a, belly: 0xf0d040, fin: 0xd83a2a, pat: 'head', patCol: 0x3a6ad8, tail: 'fan', extras: ['crest', 'lips'] },
    'Green, red, yellow and blue, with a crest like a parrot. The camp swears one of them can say "pieces of eight". Nobody has heard it sober.'),
  F(6, 'blackflagray', 'Blackflag Ray', 'uncommon', PI, 'lake', 'dusk', { pieces: 1.2, worm: 0.8 }, [3, 14], [60, 120], 360, [1.4, 1.6, 0.8, 0.1],
    { kind: 'ray', span: 0.72, back: 0x141414, belly: 0xd8d4c8, fin: 0x1e1e1e, pat: 'eyespot', patCol: 0xf0ece0 },
    'Black on top, with two pale marks and a grin across its back that look exactly like the flag the island is named for.'),
  F(6, 'bilgecat', 'Bilge-Rat Catfish', 'uncommon', PI, 'lake', 'night', { pieces: 1.4, worm: 1.1 }, [2, 12], [40, 90], 280, [1.5, 1.7, 0.5, 0],
    { shape: 'arrow', h: 0.2, w: 0.2, snout: 0.8, back: 0x5a5250, belly: 0xb8b0a8, fin: 0x4a4240, pat: 'speckle', patCol: 0x3a3230, tail: 'round', extras: ['whiskers', 'barbel', 'beard'] },
    'Grey, greasy and bold as a ship\'s rat. It lives in the wreck at the bottom and steals bait off hooks like it is paid to.'),
  F(6, 'gunportgrouper', 'Gunport Grouper', 'rare', PI, 'lake', 'any', { pieces: 1.4, glow: 1, mystery: 1 }, [12, 45], [80, 140], 900, [2.2, 2.2, 0.4, 0.1],
    { shape: 'box', h: 0.38, w: 0.2, back: 0x3a3228, belly: 0x9a8a6a, fin: 0x2a241c, pat: 'rings', patCol: 0x141210, tail: 'round', mouth: 1.6, extras: ['jaw', 'plates'] },
    'A row of round black marks down each side like open gun ports, and a mouth that could take a cannonball. Some say it did.'),
  F(6, 'rogerangel', 'Jolly Roger Angelfish', 'rare', PI, 'lake', 'night', { glow: 1.5, feather: 1.2, worm: 0.8 }, [0.8, 4], [25, 45], 1100, [1.3, 1.1, 1.6, 0.9],
    { shape: 'disc', h: 0.62, w: 0.07, back: 0x121214, belly: 0x1e1e22, fin: 0x0e0e10, pat: 'mask', patCol: 0xf0ece0, tail: 'lyre', extras: ['longfins', 'streamer'] },
    'Tall, black and thin as a sail, with a white skull on each side - clearer than anything painted. The pirates think it is lucky. It is not.'),
  F(6, 'krakentooth', 'Kraken\'s-Tooth Pike', 'epic', PI, 'lake', 'any', { pieces: 1.5, glow: 1.2 }, [8, 30], [110, 190], 2600, [2.8, 2.4, 1.3, 0.7],
    { shape: 'arrow', h: 0.15, w: 0.1, snout: 2.4, back: 0x4a2a5a, belly: 0xc8b8d8, fin: 0x3a1a4a, pat: 'tiger', patCol: 0x2a0a3a, tail: 'fork', extras: ['spikeback', 'fangs', 'teeth', 'bigeye'] },
    'Purple-black, spined down the back, with teeth like a kraken\'s beak. It hunts the ducks off the lake at dusk. And the gulls. And, once, a cabin boy\'s boot.'),
  // the mythical one: its own model (FishArt 'ghostcaptain'), one bite in four hundred
  F(6, 'ghostcaptain', 'The Drowned Captain', 'mythical', PI, 'lake', 'any', { glow: 1, pieces: 1, worm: 1, mystery: 1, grub: 1 }, [60, 140], [180, 260], 48000, [3.6, 4.2, 2.4, 1.1],
    { custom: 'ghostcaptain', h: 0.3, w: 0.14, back: 0x9ae8e0, belly: 0xe8fff8, fin: 0x6ad8d0, tail: 'veil', extras: ['ghost', 'glowtail', 'streamer', 'crown'] },
    'A fish the colour of moonlight on a ghost, with a captain\'s tricorn grown into its head, a lantern in its jaw and the bones of a ship showing through its sides. The pirates say it was their first captain, and that he still counts his crew every night. Nobody alive has landed one.',
    { mythic: true }),
];
