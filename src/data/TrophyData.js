/* TrophyData.js - everything that can end up on the bookshelf in your hut.

   A trophy is EARNED (State.award) the moment you do the thing, and then it
   is yours to PLACE: walk into the hut, press E at the bookshelf, and it
   appears on the shelf as a physical object with its own model (TrophyArt).
   Nothing here is a list in a menu - the shelf is the list.

   size  'S' sits in one of the small cubbies; 'L' takes one of the big
         spaces on the bottom shelf or on top of the bookcase. There are
         more trophies than spaces: the shelf shows your best ones (highest
         tier first), and the journal's Trophies page lists every one.
   tier  how grand its stand is: 0 wood, 1 brass, 2 silver, 3 gold, 4 relic */

import { FISH, FISH_BY_ID } from './FishData.js';
import { LEVIATHANS } from './LeviathanData.js';
import { GREAT } from './GreatData.js';
import { BEASTS } from './BeastData.js';
import { ISLAND_INFO } from './IslandData.js';

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
  { id: 'relic', name: 'The Temple Relic', size: 'S', tier: 3, model: 'orb', text: 'The glowing orb from the altar of the Drowned Temple. It hums when the tide turns.' },
  { id: 'explorer', name: 'Off the Charts', size: 'S', tier: 3, model: 'logbook', text: 'Your own logbook of the places that are on no map: the grotto, the temple, the wreck and the key.' },
  { id: 'hoard', name: 'The Hoard', size: 'L', tier: 4, model: 'hoard', text: 'One hundred thousand coins earned. A chest that will not close.' },
);
// every epic and legendary species, mounted (the journal is the collection for the rest)
for (const f of FISH) {
  if (!['epic', 'legendary'].includes(f.rarity) || f.junk || f.beh === 'mimic' || f.beh === 'chest') continue;
  T.push({ id: 'sp:' + f.id, name: f.name, size: 'S', tier: { epic: 2, legendary: 3 }[f.rarity], model: 'fish', sp: f.id, text: f.blurb });
}
// the eleven shard-bearers as skulls; the Tidemother as a statue
for (const L of LEVIATHANS) T.push({ id: 'lev:' + L.id, name: L.name, size: L.final ? 'L' : 'S', tier: 4, rank: 3, model: L.final ? 'levstatue' : 'skull', lev: L.id, text: L.story });
// the creatures at the top of the food chain
T.push({ id: 'strongbox', name: 'The X on the Chart', size: 'S', tier: 2, model: 'strongbox', text: 'You followed an old chart out to sea and pulled up what someone buried there.' });
for (const b of BEASTS) T.push({ id: 'beast:' + b.id, name: b.name, size: 'L', tier: 4, model: 'beast', beast: b.id, text: b.blurb });
T.push({ id: 'kraken', name: 'The Kraken', size: 'L', tier: 4, rank: 2, model: 'kraken', text: 'You fought it off your boat with an axe, and then you caught it.' });
for (const g of GREAT) T.push({ id: 'great:' + g.id, name: g.name, size: 'L', tier: 4, rank: 2, model: 'great', great: g.id, text: g.blurb });

// the far islands: a lantern for every one you set foot on, and the rest of the exploring
for (const I of ISLAND_INFO) T.push({ id: 'isle:' + I.id, name: I.name, size: 'S', tier: 1, model: 'lantern', text: 'You found ' + I.name + ' out in the ' + I.ring + '. ' + I.feature });
T.push(
  { id: 'wayfinder', name: 'Wayfinder', size: 'L', tier: 4, model: 'hoard', text: 'Every one of the twelve far islands, found and charted. There is nowhere left on the map that you have not been.' },
  { id: 'rim', name: "The World's Edge", size: 'S', tier: 3, model: 'lantern', text: 'You sailed to the rim of the world, where the sea stands up into a wall of fog, and came back.' },
  { id: 'lostnotes', name: 'The Ashcombe Notes', size: 'S', tier: 3, model: 'logbook', text: 'Every note the people of the Lost Shores left behind, read. You know where they went.' },
  { id: 'eye', name: 'The Eye in the Deep', size: 'S', tier: 3, model: 'orb', text: 'An eye as wide as a lighthouse opened in the water of the Abyssal Reach, and looked at you.' },
  { id: 'salvage', name: 'Salvage Rights', size: 'S', tier: 2, model: 'strongbox', text: 'Ten wrecks of Ironwreck salvaged. Big Olga offered you a job.' },
  { id: 'eruption', name: 'Under the Volcano', size: 'S', tier: 2, model: 'orb', text: 'A lump of Sunscar rock that landed next to your boat, still warm.' },
  { id: 'struck', name: 'Struck by Lightning', size: 'S', tier: 2, model: 'jar', text: 'A jar of glass fused from sand the moment lightning hit the water beside you at Thunderpeak.' },
  // past the edge, and making a home on the islands
  { id: 'warden', name: 'Gus Was Telling the Truth', size: 'S', tier: 4, rank: 1, model: 'orb', text: 'You sailed past the edge of every chart. Something far bigger than the sea was waiting there, and it sent you back. Nobody leaves.' },
  { id: 'builder', name: 'Four Walls', size: 'S', tier: 1, model: 'logbook', text: 'The first thing you ever built on the islands with your own hands.' },
  { id: 'settler', name: 'Settler', size: 'S', tier: 2, model: 'lantern', text: 'Six buildings of your own across the islands. You are not a castaway any more.' },
  { id: 'woodsman', name: 'Woodsman', size: 'S', tier: 1, model: 'logbook', text: 'Twenty-five trees and rocks taken down. The islands grow back; you keep going.' },
);

export const TROPHIES = T;
export const TROPHY_BY_ID = Object.fromEntries(T.map(t => [t.id, t]));
export const speciesTrophy = sp => TROPHY_BY_ID['sp:' + sp] || null;
void FISH_BY_ID;
