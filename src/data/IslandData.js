/* IslandData.js - the twelve far islands: what each one is for.

   Geography lives in MapData (the land, lakes, channels, pads, currents and
   weather). This file is about PEOPLE and PLACES: where to land, who lives
   there, what they sell, and what the island does that no other one does.
   Settlement builds them (world/Islands.js); NPCData holds their people. */

export const ISLAND_INFO = [
  { id: 'whisper', region: 'whisper', name: 'Whispering Woods', town: 'Woodsmoke Camp', ring: 'Mid-Ocean', feature: 'Three lakes hidden in a forest of giants. At night the woods whisper, and the lake fish rise.' },
  { id: 'sunscar', region: 'sunscar', name: 'Sunscar Archipelago', town: 'Emberhaven', ring: 'Mid-Ocean', feature: 'A live volcano. It throws burning rock into the sea - and the hot vents under it are full of fish.' },
  { id: 'skywatch', region: 'skywatch', name: 'Skywatch Isle', town: 'The Eyrie', ring: 'Mid-Ocean', feature: 'A cliff lift up to a village ninety metres above the sea. You fish from the edge of the sky.' },
  { id: 'crystal', region: 'crystal', name: 'The Crystal Reef', town: 'Glasswater Camp', ring: 'Mid-Ocean', feature: 'A lagoon of crystal spires. By night the water glows and the crystal fish come out.' },
  { id: 'frostfall', region: 'frostfall', name: 'Frostfall', town: 'Rime Camp', ring: 'Outer Ocean', feature: 'The only Ice Auger for sale in the world, and a glacier lake full of fish that have never seen the sun.' },
  { id: 'dread', region: 'dread', name: 'Dreadmire', town: 'the Stilt Houses', ring: 'Outer Ocean', feature: 'A swamp you enter by boat, down fog-choked channels to a village on stilts.' },
  { id: 'ironwreck', region: 'ironwreck', name: 'Ironwreck', town: 'Salvage Town', ring: 'Outer Ocean', feature: 'A town built out of wrecks. Salvagers, divers, the best repairs anywhere and the only wreck-diving gear.' },
  { id: 'lost', region: 'lost', name: 'The Lost Shores', town: 'the empty village', ring: 'Outer Ocean', feature: 'Everyone left in one night. Their notes are still in the houses. Find them all.' },
  { id: 'thunder', region: 'thunder', name: 'Thunderpeak', town: 'Stormwatch Station', ring: 'Extreme Waters', feature: 'A storm that never ends. Lightning hits the water every few seconds - and some fish only bite when it does.' },
  { id: 'tide', region: 'tide', name: 'Tidebreaker', town: 'the Current Masters', ring: 'Extreme Waters', feature: 'The fastest water in the world, racing round a ring of stacks. Anchor or be carried away.' },
  { id: 'crown', region: 'crown', name: 'The Sunken Crown', town: 'the Crown Dock', ring: 'Extreme Waters', feature: 'A drowned city. Fish the streets and the throne room, and bring up what the kings left behind.' },
  { id: 'abyssal', region: 'abyssal', name: 'The Abyssal Reach', town: 'the Deep Light', ring: 'Extreme Waters', feature: 'A lighthouse on a needle of rock over the deepest trench in the world. The biggest fish that are not leviathans.' },
];
export const ISLAND_BY_ID = Object.fromEntries(ISLAND_INFO.map(I => [I.id, I]));

/* The notes left on the tables of the Lost Shores (Ashcombe), one per house. */
export const LOST_NOTES = [
  { by: 'Agnes Rook, the baker', text: 'Heard the bell again tonight, out past the point. Tom says it is the fog playing tricks. The fog does not ring.' },
  { by: 'Tom Rook', text: 'Agnes is sleeping. I am going down to the water to look. There are lights out there, under it, in rows. Like streets.' },
  { by: 'Father Cole', text: 'Half the village is on the beach. Nobody is speaking. We are all just listening. I should ring the chapel bell. I cannot make my hands do it.' },
  { by: 'Maggie Pell, age 9', text: 'Mum says we are going to see the other town. The one under the water where the bell is. I am taking my good boots.' },
  { by: 'Harlan Webb, harbourmaster', text: 'No boats have gone out. None were needed. They are walking in. Up to their knees, their waists. Smiling. I am writing this so someone knows.' },
  { by: 'Ivy Marsh', text: 'If you are reading this, do not go to the water when the bell rings. Tie yourself to something. I tied myself to the table and I can still hear it.' },
  { by: 'the lighthouse boy', text: 'I climbed the tower to see. The lights go all the way out to sea and down. At the far end something big is holding a lantern. It is waiting for all of us.' },
  { by: 'Wyn', text: 'I was out hauling pots when it happened. When I came back they were gone. Every one. I stay so there is someone here if they ever come up again. The Lost Pilot swims in the bay at night. I think it is leading them.' },
];

/* Admin teleports to every island's landing (anchors are made in Islands.js). */
export const ISLAND_TELEPORTS = [
  ...ISLAND_INFO.map(I => ({ id: 'isle:' + I.id, name: I.name + ' - ' + I.town, anchor: I.id + 'Landing' })),
  { id: 'skytop', name: 'Skywatch - the cliff top', anchor: 'skyTop' },
];
