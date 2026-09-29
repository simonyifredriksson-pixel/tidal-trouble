/* BeastCatch.js - the sea beasts, the great leviathans and the Kraken as
   things you can actually land, carry, sell or keep in an aquarium.

   Each becomes a species in FISH_BY_ID (not in FISH, so nothing ever
   bites your line as one by accident) under the id the fight already
   uses: beast:<id>, great:<id> and great:kraken. What comes out of the
   water is the creature at a size you can haul about - a carcass as long
   as a house - and it is worth what the old bounty paid. */

import { FISH_BY_ID } from './FishData.js';
import { BEASTS } from './BeastData.js';
import { GREAT, KRAKEN } from './GreatData.js';

/** How long a landed creature is, in metres: big enough to struggle with, small enough to drag home. */
export const catchLength = D => Math.max(4, Math.min(14, D.size * 0.085 + 2.5));

function add(id, D, kind) {
  const L = catchLength(D);
  const kg = Math.round(L * L * L * 38);
  FISH_BY_ID[id] = {
    id, name: D.name, rarity: 'legendary', beast: kind, def: D.id, great: D.id, lev: false, water: 'any', time: 'any', where: [], bait: {},
    kg: [kg, kg], cm: [L * 100, L * 100], value: D.reward, fight: { power: 5, stamina: 5, erratic: 0.5, jump: 0 },
    blurb: D.blurb || D.title || '', art: { kind: 'beast' }, beh: 'beast',
  };
}
for (const D of BEASTS) add('beast:' + D.id, D, 'beast');
for (const D of GREAT) add('great:' + D.id, D, 'great');
add('great:kraken', KRAKEN, 'kraken');

export const isBeast = sp => !!sp?.beast;
export const BEAST_DEFS = { beast: Object.fromEntries(BEASTS.map(b => [b.id, b])), great: Object.fromEntries(GREAT.map(g => [g.id, g])), kraken: { kraken: KRAKEN } };
