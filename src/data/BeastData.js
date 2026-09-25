/* BeastData.js - the ten ocean beasts.

   These are not bosses and most of them do not want anything from you.
   They are things already happening in the sea: something walking across
   the floor, something eating a storm, something asleep under the fog.
   Each one has:
     where    when and where it can turn up (checked by the director in
              Beasts.js every few seconds, per crewed boat)
     odds     chance per check when the conditions hold (all tiny)
     hook     chance a bite near it becomes a hooked beast - once the
              `fishWhen` condition is true. Before that it only noses the bait
     tell     what a refused bite says - the hint that teaches you the rule
     page     what a Drowned Journal Page says about it (the clue trail)
     fight / pace / cap   the catch bar, pushed as far as it goes
   The behaviour and the body are in Beasts.js and BeastArt.js. */

export const BEASTS = [
  { id: 'cthulhu', name: 'Cthulhu', title: 'The Abyssal God', size: 140, reward: 150000,
    habitat: 'The deepest water there is - the Abyss and the Blackwater trench - at night',
    where: c => c.zone >= 4 && c.night && c.depth > 60, odds: 1 / 900,
    hook: 0.06, fight: 4.2, pace: 0.014, cap: 480,
    fishWhen: 'risen', tell: 'Your line goes slack in the black water. It is not looking at the bait yet. Wait until it rises.',
    page: 'The sea went black and stood up. There was a face in it, and the face had arms. Captain Ruel says it only comes when the water is deeper than any chart and the night is darkest. It did not attack us. The weather did.',
    blurb: 'Not a squid. Not a fish. Something that was sleeping under the sea before the sea was there. Its waking brings a storm the size of a country.' },
  { id: 'skymaw', name: 'The Skymaw', title: 'Mouth of the Clouds', size: 90, reward: 60000,
    habitat: 'Out over the Open Sea and Offshore water, by day - look up',
    where: c => c.zone >= 2 && !c.night && c.region !== 'frost', odds: 1 / 420,
    hook: 0.2, fight: 3.5, pace: 0.024, cap: 360,
    fishWhen: 'under', tell: 'You cannot hook a thing in the sky. Wait for it to dive - then cast where it went in.',
    page: 'We thought it was a cloud. Then its shadow went over us and the cloud had teeth. It dives for the big shoals and stays under a minute, no more. Cast where the splash was. Quickly.',
    blurb: 'A great winged mouth that drifts with the clouds and falls on shoals of fish like a meteor.' },
  { id: 'drownedking', name: 'The Drowned King', title: 'Wearer of Wrecks', size: 55, reward: 55000,
    habitat: 'Near shipwrecks - the Sunken Coast, the Blackwater, the stacks of the Open Sea',
    where: c => c.nearWreck, odds: 1 / 260,
    hook: 0.15, fight: 3.4, pace: 0.024, cap: 360, bait: 'magnetic',
    fishWhen: 'risen', tell: 'It ignores your bait. Something that wears iron might want iron - try magnetic bait.',
    page: 'The wreckage was moving. Anchors, chains, a whole hull, all stuck to something alive. It only bit once in all my years, and only on a lure made of iron.',
    blurb: 'An ancient crab-thing wearing a hundred years of wrecks as armour. It collects ships. Sometimes it collects the people on them.' },
  { id: 'serpent', name: 'The Abyssal Serpent', title: 'The Circle Beneath', size: 160, reward: 70000,
    habitat: 'Very deep water - Deep Water and the Abyss, far from land',
    where: c => c.zone >= 3 && c.depth > 50, odds: 1 / 360,
    hook: 0.12, fight: 3.7, pace: 0.022, cap: 380,
    fishWhen: 'close', tell: 'Only its fin, far off. Cast when it circles in close enough to see its back.',
    page: 'It circled us three times. We only ever saw the fin, the size of a sail, and the current it made spun us round. When it finally came close enough, Harlan cast at the fin. We lost the rod, the line and nearly the boat.',
    blurb: 'You will never see all of it. A fin like a sail, a coil of back, a tail far off in the wrong place for one animal.' },
  { id: 'glassback', name: 'The Glassback', title: 'The Lantern Under the Sea', size: 70, reward: 50000,
    habitat: 'Deep water on dark nights, anywhere offshore',
    where: c => c.zone >= 2 && c.night && c.depth > 25, odds: 1 / 320, peaceful: true,
    hook: 0.25, fight: 3.2, pace: 0.03, cap: 320, bait: 'glow',
    fishWhen: 'above', tell: 'The glow drifts past your bait. It is drawn to light - use glow bait, right above it.',
    page: 'At night the sea under us lit up, and it was a whale made of glass with lamps inside it. It does not hunt and it does not hurry. My son swears it followed the glow of his bait.',
    blurb: 'Clear as a window, with glowing organs you can watch working. It means no harm. It is not sure what you are.' },
  { id: 'stormeater', name: 'The Storm Eater', title: 'The Thing Under the Weather', size: 110, reward: 80000,
    habitat: 'Anywhere past the harbour, but only inside a storm',
    where: c => c.storm && c.zone >= 1, odds: 1 / 150,
    hook: 0.18, fight: 3.8, pace: 0.02, cap: 380,
    fishWhen: 'fed', tell: 'It is waiting for something. Lightning - it feeds on it. Cast right after a strike.',
    page: 'The storm had a heart and the heart was alive. Every bolt went into the water at the same spot and something drank it. After each strike it lay there, dazed, for half a minute.',
    blurb: 'A vast ray-shaped thing that lives under storms and drinks lightning. Where it swims, the weather follows.' },
  { id: 'whalefall', name: 'The Whalefall', title: 'The Old Migration', size: 95, reward: 45000, peaceful: true,
    habitat: 'A slow circle around the whole sea, far offshore. Always the same route',
    where: c => c.onRoute, odds: 1 / 200,
    hook: 0.18, fight: 3.3, pace: 0.026, cap: 360,
    fishWhen: 'surfaced', tell: 'It is too deep to reach. It surfaces to breathe - cast when its back is up.',
    page: 'The old whale goes round the world the same way it always has: out past the Frostbite cliffs, west of the Lighthouse, south through the deep, east under the Sunken Coast. Wait on its road. It surfaces to breathe.',
    blurb: 'An ancient whale-like creature older than the islands, drifting its endless route. Barnacle forests grow on its back.' },
  { id: 'mirrorfish', name: 'The Mirrorfish', title: 'The One You Did Not See', size: 40, reward: 50000,
    habitat: 'Calm, clear water by day - the Sunken Coast and Frostbite shores',
    where: c => (c.region === 'tropic' || c.region === 'frost') && !c.night && !c.storm && c.depth > 6, odds: 1 / 260,
    hook: 0.2, fight: 3.3, pace: 0.026, cap: 340,
    fishWhen: 'seen', tell: 'Your bait went through where it was. It is only really there when you can see it - with the sun behind you.',
    page: 'You only see it with the sun at your back. Look from the other side and it is not there at all - or there are three of it. Only one of them is real, and it only bites when you are looking right at it.',
    blurb: 'A great fish that is also a reflection. From one side it is enormous. From the other, there is nothing but water.' },
  { id: 'trenchwalker', name: 'The Trench Walker', title: 'The Floor Is Moving', size: 120, reward: 90000,
    habitat: 'Only the Blackwater trench - the deepest water in the world',
    where: c => c.region === 'black' && c.depth > 90, odds: 1 / 240,
    hook: 0.1, fight: 3.9, pace: 0.02, cap: 400,
    fishWhen: 'reaching', tell: 'Your line cannot reach the bottom of the trench. Wait until it reaches up.',
    page: 'We heard it before we saw it: a thud under the boat, like a door slamming at the bottom of the world. Then a leg came up out of the water. A LEG. Taller than the lighthouse. We cast at the leg. Do not cast at the leg.',
    blurb: 'Something with long jointed limbs that walks the floor of the trench. When it reaches up, the sea breaks.' },
  { id: 'colossus', name: 'The Colossus', title: 'The Walk Across the World', size: 150, reward: 100000,
    habitat: 'Deep open water - it walks a long line across the sea floor, west to east',
    where: c => c.zone >= 3 && c.depth > 40, odds: 1 / 420,
    hook: 0.15, fight: 3.8, pace: 0.018, cap: 440, drags: true,
    fishWhen: 'surfaced', tell: 'It is walking below you. Follow it - when its back breaks the surface, cast.',
    page: 'The current was wrong. Then the shadow under us was wrong: it was walking. It does not stop for anything. Harlan hooked it and it just kept going, and we went with it, twenty miles, until the line gave out.',
    blurb: 'Not swimming - walking, across the bottom of the ocean, as it has for centuries. It does not know you are there.' },
];
export const BEAST_BY_ID = Object.fromEntries(BEASTS.map(b => [b.id, b]));

/* The Whalefall's route: a slow loop far offshore. */
export const WHALE_ROUTE = [[-300, -1150], [-1150, -400], [-1150, 450], [-400, 1150], [500, 1150], [1150, 500], [1150, -450], [450, -1150]];
