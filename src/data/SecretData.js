/* SecretData.js - the hidden places. None of them is on the map, and no one
   in the game tells you where they are: you find them by going and looking.

   Once found, a place gets its name on the map, a banner for the whole crew
   and a line in the journal, and all four together earn the Explorer
   trophy. Each hides a cache that can be opened once for its big prize and
   refills with something smaller every few days, so they are worth coming
   back to.

   kind    cave  a sea cave you can drive a boat into
           dive  on the sea floor - swim down (Q) to reach the cache
           isle  a tiny island that is on no chart
   r       discovery radius (m, horizontal)
   fish    how far from the centre the site's own fish bite */

export const SECRETS = [
  { id: 'grotto', name: "Smuggler's Grotto", kind: 'cave', x: 330, z: 470, r: 17, fish: 15, refill: 5,
    found: 'A sea cave, lit by crystals. There are crates on the ledge that somebody did not want found.',
    cache: "Open the smugglers' cache", icon: 'chest' },
  { id: 'temple', name: 'The Drowned Temple', kind: 'dive', x: 605, z: 395, r: 26, fish: 30, refill: 6,
    found: 'Columns under the water. A whole temple, with something glowing on the altar. Swim down (Q) to reach it.',
    cache: 'Take the relic from the altar', icon: 'shard' },
  { id: 'promise', name: 'Wreck of the Bright Promise', kind: 'dive', x: 605, z: -185, r: 24, fish: 26, refill: 5,
    found: "Sarah Moore's ship, from the cairns at Vigil's End. It never came home - it is down here. Her sea chest is still aboard.",
    cache: "Open Sarah Moore's sea chest", icon: 'chest' },
  { id: 'castaway', name: 'Castaway Key', kind: 'isle', x: 430, z: 650, r: 34, fish: 45, refill: 7,
    found: 'An island on no chart. Someone lived here: a shelter, a fire pit, and an X scratched into the sand.',
    cache: 'Dig where the X is', icon: 'compass' },
];
export const SECRET_BY_ID = Object.fromEntries(SECRETS.map(S => [S.id, S]));
