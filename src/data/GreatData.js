/* GreatData.js - the creatures at the very top of the food chain.

   THE GREAT LEVIATHANS live in the fog around Vigil's End, at the edge of
   the sea. Nobody has seen one for years. When one does come up, it is
   announced to the whole sea, and it is one of three - never the same odds:

     The Graveback   60%   an ancient armoured whale, a moving island
     The Ninefold    30%   a sea serpent that rises in nine arches
     The Hushwing    10%   a pale manta the size of a harbour, that flies

   THE KRAKEN is the opposite experience: no legend, no warning. It only
   hunts in the Offshore zone (the third zone out), it comes up under your
   boat, and three arms come over the rail. Chop them with the axe and it
   dives - and for a few minutes you can try to hook the thing itself.

   Fighting any of them uses the ordinary rod and the ordinary catch bar,
   pushed as far as it goes: `fight` is compared to the rod's rating, `pace`
   slows the whole fight down (the meter climbs, drains and bleeds that much
   slower, so a well-played fight takes minutes), `cap` is how long the line holds, and
   `hook` is the chance a bite near one becomes a hooked monster at all. */

export const GREAT = [
  { id: 'graveback', name: 'The Graveback', title: 'The Island That Breathes', chance: 0.6, size: 64,
    colors: { back: 0x4a4e52, belly: 0xa8a49a, plate: 0x6a6660, barnacle: 0xc8c2b0, glow: 0xffc070, eye: 0xffb050 },
    fight: 3.45, pace: 0.028, cap: 340, hook: 0.15, reward: 32000, speed: 6,
    blurb: 'A whale older than the guild, grown over with stone plates and barnacles until it looks like an island. It surfaces like one, too.' },
  { id: 'ninefold', name: 'The Ninefold', title: 'Serpent of the Last Water', chance: 0.3, size: 110,
    colors: { back: 0x2a3a3e, belly: 0xb8c8b8, fin: 0x5a8a86, frill: 0x9ad0c8, glow: 0x8af0d0, eye: 0xd8ff9a },
    fight: 3.65, pace: 0.024, cap: 340, hook: 0.15, reward: 46000, speed: 9,
    blurb: 'A serpent so long it rises in nine arches at once. The fishermen say it rears its head to look at every boat before it decides.' },
  { id: 'hushwing', name: 'The Hushwing', title: 'The White Shadow', chance: 0.1, size: 78,
    colors: { back: 0xd8dcd8, belly: 0xf4f6f4, spot: 0x8a9aa8, glow: 0xb8e8ff, eye: 0x3a2a4a },
    fight: 3.9, pace: 0.02, cap: 360, hook: 0.15, reward: 90000, speed: 7,
    blurb: 'A pale manta the size of a harbour, with six eyes along its brow. Once in a lifetime it leaves the water entirely and glides.' },
];
export const GREAT_BY_ID = Object.fromEntries(GREAT.map(g => [g.id, g]));

export const KRAKEN = {
  id: 'kraken', name: 'The Kraken', title: 'It Came Up Under The Boat', zone: 2, size: 34,
  colors: { skin: 0x6a1e2e, skin2: 0x8a2e3a, belly: 0xe8b8b0, sucker: 0xf4d8cc, eye: 0xf0d040, ink: 0x14101a },
  fight: 3.6, pace: 0.024, cap: 340, hook: 0.1, reward: 40000, arms: 3, armHp: 2,
  blurb: 'Not a legend. Nobody tells stories about it, because nobody who met it wants to. It lives in the Offshore water and it hates boats.',
};

/** Pick a Great Leviathan with the 60/30/10 odds. `r` is 0..1. */
export function rollGreat(r = Math.random()) {
  let x = r;
  for (const g of GREAT) { x -= g.chance; if (x < 0) return g; }
  return GREAT[GREAT.length - 1];
}
