/* TrophyData.js - everything that can end up on the bookshelf in your hut.

   A trophy is EARNED (State.award) the moment you do the thing, and then it
   is yours to PLACE: walk into the hut, press E at the bookshelf, and it
   appears on the shelf as a physical object with its own model (TrophyArt).
   Nothing here is a list in a menu - the shelf is the list.

   size  'S' sits in one of the forty small cubbies; 'L' takes one of the big
         spaces on the bottom shelf or on top of the bookcase
   tier  how grand its stand is: 0 wood, 1 brass, 2 silver, 3 gold, 4 relic */

import { FISH, FISH_BY_ID } from './FishData.js?v=1790354328';
import { LEVIATHANS } from './LeviathanData.js?v=1790354328';
import { GREAT } from './GreatData.js?v=1790354328';

const T = [];
// the milestones, each with its own object
T.push(
  { id: 'first', name: 'First Catch', size: 'S', tier: 0, model: 'carving', text: 'A little wooden fish you carved the night of your first catch.' },
  { id: 'fifty', name: 'Fifty Fish', size: 'S', tier: 1, model: 'hook', text: 'A bronze hook from the guild, for your fiftieth fish.' },
  { id: 'seasoned', name: 'Seasoned Angler', size: 'S', tier: 2, model: 'reel', text: 'A silver reel on a stand. Two hundred and fifty fish.' },
  { id: 'golden', name: 'The Golden One', size: 'S', tier: 3, model: 'cushion', text: 'Your first golden fish, cast in gold on a velvet cushion.' },
  { id: 'abyssal', name: 'From the Abyss', size: 'S', tier: 3, model: 'orb', text: 'An abyssal catch, sealed in dark glass. It still glows.' },
  { id: 'giant', name: 'Giant Slayer', size: 'S', tier: 2, model: 'tooth', text: 'A tooth from the first giant you landed.' },
  { id: 'coins', name: 'Ten Thousand Coins', size: 'S', tier: 2, model: 'coins', text: 'A tower of coins. Pim says you are her best customer.' },
  { id: 'vigil', name: "Vigil's End", size: 'S', tier: 2, model: 'lantern', text: 'A vigil lantern. You made it to the edge of the sea.' },
  { id: 'legend', name: 'The Legend', size: 'S', tier: 3, model: 'logbook', text: 'Ada\'s copy of the logbook. You heard all six of them out.' },
  { id: 'survivor', name: 'Kraken Survivor', size: 'S', tier: 3, model: 'jar', text: 'The tip of a kraken arm, in a jar. It still twitches.' },
  { id: 'hoard', name: 'The Hoard', size: 'L', tier: 4, model: 'hoard', text: 'One hundred thousand coins earned. A chest that will not close.' },
);
// every rare, epic and legendary species, mounted
for (const f of FISH) {
  if (!['rare', 'epic', 'legendary'].includes(f.rarity) || f.junk || f.beh === 'mimic' || f.beh === 'chest') continue;
  T.push({ id: 'sp:' + f.id, name: f.name, size: 'S', tier: { rare: 1, epic: 2, legendary: 3 }[f.rarity], model: 'fish', sp: f.id, text: f.blurb });
}
// the eleven shard-bearers as skulls; the Tidemother as a statue
for (const L of LEVIATHANS) T.push({ id: 'lev:' + L.id, name: L.name, size: L.final ? 'L' : 'S', tier: 4, model: L.final ? 'levstatue' : 'skull', lev: L.id, text: L.story });
// the creatures at the top of the food chain
T.push({ id: 'kraken', name: 'The Kraken', size: 'L', tier: 4, model: 'kraken', text: 'You fought it off your boat with an axe, and then you caught it.' });
for (const g of GREAT) T.push({ id: 'great:' + g.id, name: g.name, size: 'L', tier: 4, model: 'great', great: g.id, text: g.blurb });

export const TROPHIES = T;
export const TROPHY_BY_ID = Object.fromEntries(T.map(t => [t.id, t]));
export const speciesTrophy = sp => TROPHY_BY_ID['sp:' + sp] || null;
void FISH_BY_ID;
