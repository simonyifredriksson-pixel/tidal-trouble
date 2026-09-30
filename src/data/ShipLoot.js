/* ShipLoot.js - what comes out of other people's crates.

   Things you can pick up off a deck (F), carry, bag and sell, registered in
   FISH_BY_ID (not in FISH, so nothing ever bites a line as one): bait by the
   sack, bundles of timber and iron, trade goods a fish seller will give you
   good money for, charts, and the weapons a crew drops when you knock them
   down. What happens when you pick one up is in Game._onPickup (`beh`). */

import { FISH_BY_ID } from './FishData.js';

const add = (id, name, junk, kg, value, beh, more = {}) => {
  FISH_BY_ID[id] = { id, name, rarity: 'junk', where: [], water: 'any', time: 'any', bait: {}, kg: [kg, kg], cm: [40, 40], value, beh, junk,
    fight: { power: 1, stamina: 1, erratic: 0, jump: 0 }, cargo: true, ...more };
};
add('baitsack', 'Sack of Bait', 'sack', 3, 20, 'baitsack', { blurb: 'Somebody\'s bait for the week. Pick it up and it goes in your tin.' });
add('timberbundle', 'Bundle of Supplies', 'bundle', 8, 15, 'mats', { blurb: 'Planks, a bar or two of iron, maybe a pane of glass.' });
add('spicejar', 'Jar of Spice', 'jar', 1.5, 90, 'goods', { blurb: 'Hot enough to make your eyes water through the lid. Any fish seller will buy it.' });
add('silkbolt', 'Bolt of Sea Silk', 'bolt', 2.5, 180, 'goods', { blurb: 'Spun from the beards of giant clams. Worth a small fortune to the right seller.' });
add('rumcask', 'Cask of Rum', 'cask', 18, 140, 'goods', { blurb: 'Sloshes. Smells like a pirate\'s breakfast.' });
add('teachest', 'Chest of Tea', 'teachest', 9, 120, 'goods', { blurb: 'Stamped with a Guild seal. Somebody will want this back.' });
add('shipchart', 'Survey Chart', 'map', 0.3, 30, 'chart', { blurb: 'A hand-drawn chart of the water round here. Pick it up and it goes onto your map.' });
add('pistolitem', 'Barnacle Flintlock', 'w_pistol', 1.4, 200, 'weapon', { weapon: 'pistol', blurb: 'A crewman\'s pistol. Pick it up and it is yours.' });
add('cutlassitem', 'Rusty Cutlass', 'w_cutlass', 1.6, 120, 'weapon', { weapon: 'cutlass', blurb: 'Notched, rusty, still sharp enough.' });
add('pinitem', 'Belaying Pin', 'w_pin', 1, 20, 'weapon', { weapon: 'pin', blurb: 'A hardwood club off a ship\'s rail.' });
add('blunderitem', 'Brine Blunderbuss', 'w_blunder', 4, 400, 'weapon', { weapon: 'blunder', blurb: 'A bell-mouthed gun that throws a fistful of shot.' });
