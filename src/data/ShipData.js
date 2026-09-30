/* ShipData.js - the other boats on the sea.

   Every kind has a hull (a real boat from BoatData, or the pirates' own
   galley), a crew with a temper and a few weapons, a hold of cargo, and the
   things its people say. `mood` is how a crew takes a stranger pulling
   alongside: 'friendly' crews talk, 'wary' ones warn you off, 'shy' ones
   leave, 'hostile' ones come for you.

   Weapons: fists, pin (a belaying pin - a club), cutlass, pistol, blunder.
   Cargo: crates, barrels and chests on the deck; `loot` is what comes out
   when one is broken open, drawn at random from the table. */

export const SHIP_KINDS = {
  fisher: {
    name: 'Fishing Boat', hull: 'motor', paint: 'harbour', mood: 'friendly', crew: [['skipper', 'pin'], ['deckhand', 'fists']],
    speed: 0.55, fishes: true, crates: 2, catch: [3, 7], zones: [0, 3], weight: 5,
    loot: [['fish', 4], ['bait', 3], ['coins', 1]],
    say: { hello: ['Morning! Biting well out here today.', 'You after the same shoal? Plenty for both of us.', 'Mind the lines, friend.'], tip: ['Try the drop-off past the reef at dusk. Trust me.', 'Glow bait after dark. Never fails.', 'Stay out of the fog past the outer banks. Things go missing out there.'], angry: ['Oi! Put that back!', 'Thief! THIEF!', 'That is our catch!'], down: ['Alright, alright - take it!', 'Oof.'], flee: ['Go, go, GO!'] },
  },
  trader: {
    name: 'Trading Boat', hull: 'trawler', paint: 'moss', mood: 'wary', crew: [['captain', 'pistol'], ['deckhand', 'pin'], ['deckhand', 'fists']],
    speed: 0.6, crates: 4, zones: [1, 5], weight: 4,
    loot: [['coins', 3], ['bait', 2], ['mats', 3], ['goods', 3]],
    say: { hello: ['Traders, friend. Nothing worth your while aboard.', 'Keep your hands where I can see them and we will get on fine.'], warn: ['That is close enough.', 'Back your boat off. Now.', 'One more step and we have a problem.'], angry: ['Boarders! Grab them!', 'You will regret that!'], down: ['Take the cargo, just leave the boat...'], flee: ['Full ahead! Lose them!'] },
  },
  salvage: {
    name: 'Salvage Boat', hull: 'salvager', paint: 'rust', mood: 'wary', crew: [['foreman', 'blunder'], ['diver', 'pin'], ['diver', 'fists']],
    speed: 0.5, crates: 3, zones: [2, 6], weight: 3,
    loot: [['mats', 4], ['junk', 3], ['coins', 1], ['strongbox', 1]],
    say: { hello: ['Salvage rights. This patch is ours.', 'Seen any wrecks? We pay for a good tip.'], warn: ['That hold is spoken for.', 'Salvagers keep what they find. Keep off.'], angry: ['Hands off the haul!', 'Get them over the side!'], down: ['Rust take you...'], flee: ['Leave it! Leave the rest!'] },
  },
  explorer: {
    name: 'Survey Boat', hull: 'swiftfin', paint: 'natural', mood: 'friendly', crew: [['surveyor', 'fists'], ['navigator', 'fists']],
    speed: 0.75, crates: 2, zones: [2, 7], weight: 3, charts: true,
    loot: [['chart', 1], ['mats', 2], ['coins', 1]],
    say: { hello: ['Another soul out this far! We are charting the outer water.', 'Want a look at our chart? Here - we copied yours in.'], tip: ['There is an island out past the fog that no chart will show. Black flags. Stay clear.', 'Currents out here run in rivers. Follow them and you save a day.'], angry: ['We are scientists!', 'Help! Somebody!'], down: ['Please... the charts are all we have...'], flee: ['Get us out of here!'] },
  },
  cargo: {
    name: 'Cargo Ship', hull: 'ironclad', paint: 'slate', mood: 'wary', crew: [['captain', 'pistol'], ['guard', 'cutlass'], ['guard', 'pistol'], ['deckhand', 'pin']],
    speed: 0.5, crates: 6, zones: [2, 7], weight: 2,
    loot: [['goods', 4], ['coins', 3], ['mats', 3], ['bait', 1]],
    say: { hello: ['Cargo run. Steer clear of the hull.', 'We are armed and we are busy.'], warn: ['Warning shot is next.', 'This is a guarded ship.'], angry: ['All hands! Repel boarders!', 'Fire!'], down: ['...'], flee: ['Signal the escort!'] },
  },
  rich: {
    name: 'Wealthy Yacht', hull: 'deeprunner', paint: 'royal', mood: 'shy', crew: [['owner', 'fists'], ['bodyguard', 'pistol'], ['bodyguard', 'cutlass']],
    speed: 0.8, crates: 3, catch: [2, 5], rare: true, zones: [1, 6], weight: 2, fishes: true,
    loot: [['coins', 5], ['chest', 1], ['fish', 2], ['goods', 2]],
    say: { hello: ['Do you mind? This is a private charter.', 'We are fishing for sport, darling. Do run along.'], warn: ['Security!', 'I will have you reported to the Guild.'], angry: ['Guards! Do something!', 'How DARE you!'], down: ['My trophy! Not my trophy!'], flee: ['Home, captain! Full speed!'] },
  },
  guarded: {
    name: 'Armed Escort', hull: 'stormbreaker', paint: 'navy', mood: 'wary', crew: [['commander', 'pistol'], ['marine', 'blunder'], ['marine', 'cutlass'], ['marine', 'pistol'], ['marine', 'cutlass']],
    speed: 0.7, crates: 2, zones: [3, 7], weight: 1, escort: true,
    loot: [['coins', 3], ['weapon', 2], ['mats', 2]],
    say: { hello: ['Guild escort. State your business.', 'Move along, fisher.'], warn: ['Last warning.', 'Hands off your weapons.'], angry: ['Take them!', 'Board and restrain!'], down: ['Man down!'], flee: ['Fall back!'] },
  },
  derelict: {
    name: 'Drifting Wreck', hull: 'seafarer', paint: 'weathered', mood: 'none', crew: [], derelict: true,
    speed: 0, crates: 3, zones: [1, 7], weight: 2,
    loot: [['junk', 3], ['coins', 2], ['bait', 1], ['mats', 2], ['odd', 2]],
    say: {},
  },
  pirate: {
    name: 'Pirate Galley', hull: 'galley', paint: 'pirate', mood: 'hostile', crew: [['captain', 'pistol'], ['pirate', 'cutlass'], ['pirate', 'cutlass'], ['pirate', 'pistol'], ['pirate', 'blunder'], ['pirate', 'pin']],
    speed: 1.0, crates: 4, zones: [2, 7], weight: 1.4, pirate: true, cannons: 3,
    loot: [['coins', 5], ['goods', 3], ['weapon', 2], ['chest', 1]],
    say: { hello: [], warn: ['Heave to and hand it over!', 'Strike your colours!'], angry: ['Take the ship!', 'Board her, lads!', 'Leave nobody standing!'], down: ['Arrgh...'], flee: ['Cut the bridge! Away! AWAY!'], taunt: ['Your catch is our catch now!', 'Ha! Look at that little tub!', 'Nobody outruns the Black Gull!'] },
  },
};

/* what the crews look like, by role */
const P = (o) => o;
export const CREW_LOOKS = {
  skipper: [P({ shirt: 0x3a5a7a, pants: 0x3a3a48, hat: 'cap', hatCol: 0xc84a3a, beard: 'full', beardCol: 0x8a6a4a }), P({ shirt: 0x8a6a3a, hat: 'bucket', hatCol: 0x6a7a4a, beard: 'stubble' })],
  deckhand: [P({ shirt: 0xc8a040, hat: 'beanie', hatCol: 0x3a5a8a, overalls: true }), P({ shirt: 0x6a4a8a, hat: 'none', hair: 'long' }), P({ shirt: 0x3a7a4a, hat: 'cap', hatCol: 0xe8c040 })],
  captain: [P({ shirt: 0x2e3e5a, vest: 0x5a3a2a, hat: 'captain', hatCol: 0x2a2a3a, beard: 'full', beardCol: 0x5a4a3a })],
  foreman: [P({ shirt: 0x8a5a2e, overalls: true, hat: 'beanie', hatCol: 0x5a5a5a, beard: 'full', beardCol: 0x3a2a1c, build: 1.2 })],
  diver: [P({ shirt: 0x2e4e5e, pants: 0x1a2a3a, hat: 'none', hair: 'short' }), P({ shirt: 0x5e5e5e, hat: 'beanie', hatCol: 0xa85a2e })],
  surveyor: [P({ shirt: 0xe8e0c8, vest: 0x6a5a3a, hat: 'straw', glasses: true })],
  navigator: [P({ shirt: 0x4a6aa0, hat: 'bucket', hatCol: 0xd8c89a, glasses: true, hair: 'bun' })],
  guard: [P({ shirt: 0x3a3a3a, vest: 0x2a2a2a, hat: 'none', hair: 'short', beard: 'stubble', build: 1.15 })],
  owner: [P({ shirt: 0xf0f0f0, vest: 0x8a2a4a, hat: 'straw', glasses: true, belly: 0.7 })],
  bodyguard: [P({ shirt: 0x1a1a22, pants: 0x1a1a22, hat: 'none', hair: 'bald', glasses: true, build: 1.25 })],
  commander: [P({ shirt: 0x2a3a6a, vest: 0xd8b048, hat: 'captain', hatCol: 0x2a3a6a, beard: 'moustache', beardCol: 0x3a2a1c })],
  marine: [P({ shirt: 0x2a3a6a, pants: 0xe8e0d0, hat: 'cap', hatCol: 0x2a3a6a, build: 1.1 })],
  pirate: [
    P({ shirt: 0x7a2a2a, pants: 0x2a2a2a, hat: 'bandana', hatCol: 0xc83a32, beard: 'stubble', patch: true }),
    P({ shirt: 0xe0d8c0, vest: 0x2a2a2a, hat: 'bandana', hatCol: 0x2a2a2a, beard: 'full', beardCol: 0x2a1a10 }),
    P({ shirt: 0x3a2a2a, pants: 0x4a3a2a, hat: 'tricorn', hatCol: 0x1a1a1a, hair: 'long', hairCol: 0x1a1410 }),
    P({ shirt: 0x5a4a2a, hat: 'bandana', hatCol: 0x3a5a3a, beard: 'moustache', patch: true, build: 1.2 }),
  ],
};
// the pirate captain gets the hat with the skull on it
CREW_LOOKS.pirateCaptain = [P({ shirt: 0x5a1a1a, vest: 0x1a1a1a, pants: 0x1a1a1a, hat: 'tricorn', hatCol: 0x141414, skullHat: true, beard: 'full', beardCol: 0x141010, patch: true, build: 1.15 })];

/* the weapons crews carry (and drop): damage, reach, how often */
export const CREW_WEAPONS = {
  fists:   { reach: 1.3, dmg: 6,  knock: 3.2, cd: 1.3, ranged: false },
  pin:     { reach: 1.6, dmg: 9,  knock: 4.6, cd: 1.5, ranged: false, drop: 'pin' },
  cutlass: { reach: 1.8, dmg: 13, knock: 3.6, cd: 1.2, ranged: false, drop: 'cutlass' },
  pistol:  { reach: 26,  dmg: 11, knock: 1.5, cd: 2.8, ranged: true, aim: 0.9, drop: 'pistol' },
  blunder: { reach: 11,  dmg: 17, knock: 5.5, cd: 3.6, ranged: true, aim: 1.1, spread: true, drop: 'blunder' },
};
