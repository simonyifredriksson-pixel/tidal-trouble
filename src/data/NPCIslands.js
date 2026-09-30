/* NPCIslands.js - the people of the far islands.

   Every island has a fish buyer (role seller, `shop` = the island id), an
   outfitter who sells the gear you can only get there (role outfitter),
   most have a shipwright (role boatyard, `yard` = the island id) and each
   has someone who knows the island's story (role lore). They stand at the
   anchors Islands.js makes: <island>Seller, <island>Outfit, <island>Yard,
   <island>Lore. */

const say = o => ({
  hello: o.hello,
  sold: o.sold || ['{n} fish, {total} coins. Good haul.', '{total} coins for the lot. Pleasure.'],
  soldOne: o.soldOne || ['A {fish}. {total} coins.', 'That {fish} is worth {total} to me.'],
  nothing: o.nothing || ['Nothing to sell? The water is right there.', 'Bring the catch over and we will talk.'],
  empty: o.empty || ['Your hands are empty. Pick a fish up first.'],
  fav: o.fav || ['Not that one. That one is yours. Right-click it if you ever change your mind.'],
  favSome: o.favSome || ['I left your favourites alone.'],
  rods: o.rods,
  bought: o.bought || ['The {rod}. Look after it and it will look after you.'],
  broke: o.broke || ['That is {price} coins. Catch a few more first.'],
  bye: o.bye || ['Tight lines.', 'Safe water.'],
});
// a look: skin, shirt, pants, hat [, hatCol], hair, hairCol, extras
const L = (skin, shirt, pants, hat, hatCol, hair, hairCol, x = {}) => ({ skin, shirt, pants, boots: x.boots || 0x2e2620, hat, hatCol, hair, hairCol, nose: x.nose || 1.1, ...x });

export const ISLAND_NPCS = [
  /* ======================= BLACKFLAG ISLE (on no chart) ======================= */
  { id: 'rattigan', name: 'rattigan', full: 'Rattigan the Fence', pr: 'he', role: 'seller', shop: 'blackflag', at: 'pirateFence', pose: 'stand',
    look: L(0xd8a880, 0x5a2a2a, 0x2a2a2a, 'tricorn', 0x1a1a1a, 'long', 0x2a1a10, { beard: 'moustache', beardCol: 0x2a1a10, patch: true, vest: 0x2a2a2a, nose: 1.5 }),
    lines: ['I sell to anybody. I buy from anybody. The captain lets me, because the captain buys from me.'],
    say: say({
      hello: ['Well now. A face I have not robbed yet. Selling?', 'Fish from the Bell? Careful how you hold those. What have you got?', 'Nobody finds this island by accident, friend. Nobody leaves it by accident either. Buying or selling?'],
      rods: ['Rods? This is a pirate island. I sell things for hurting people. Look at the rack.'],
      nothing: ['Nothing? Then you are wasting a fence\'s time.', 'Come back with something worth the walk.'],
      sold: ['{n} fish, {total} coins, no questions. That is the Blackflag way.', '{total} coins. Do not tell the captain what I paid you.'],
      bye: ['Watch the guards.', 'You never saw me.', 'Fair winds - and foul ones for everyone else.'],
    }) },
  /* ======================= WHISPERING WOODS ======================= */
  { id: 'hazel', name: 'hazel', full: 'Hazel Thornwood', pr: 'she', role: 'seller', shop: 'whisper', at: 'whisperSeller', pose: 'stand',
    look: L(0xe0b48c, 0x3a5a2e, 0x4a3a2a, 'hood', 0x2e4a2a, 'long', 0x6a3a1e, { vest: 0x5a3e28 }),
    lines: ['The woods are loud tonight.'],
    say: say({
      hello: ['You came through the fog to the woods? Brave, or lost. Either way, I buy fish.', 'Fresh from the lakes? Let me see. The Moonpool ones glow a little when they are fresh.', 'Keep your voice down. The trees are listening. What have you got?'],
      rods: ['The Whisperwillow. Grown, not made. It bends like it wants to.'],
      bye: ['Stay on the path.', 'Do not answer if the trees call your name.', 'Mind the roots.'],
    }) },
  { id: 'bram', name: 'bram', full: 'Old Bram', pr: 'he', role: 'outfitter', shop: 'whisper', at: 'whisperOutfit', pose: 'stand',
    look: L(0xc8966e, 0x6a4a30, 0x3a3a30, 'none', 0, 'bald', 0xd8d8d8, { beard: 'full', beardCol: 0xe8e8e8, belly: 0.5, nose: 1.4 }),
    lines: [
      'Moth Lanterns, woodgrubs, the Whisperwillow. Things you want in a forest at night.',
      'A moth lantern on the bank and the lake fish come up to look at it. Then they look at your hook.',
      'My grandfather cut the first path to the Moonpool. He never cut a single one of the giants. You do not.',
    ] },
  { id: 'tamsin', name: 'tamsin', full: 'Tamsin Oakes', pr: 'she', role: 'boatyard', yard: 'whisper', at: 'whisperYard', pose: 'stand',
    look: L(0xf0c8a0, 0x8a4a2a, 0x3a3a48, 'beanie', 0x3a6a3a, 'bun', 0xa84a2a, { build: 1.1 }),
    lines: [
      'Trawlers. Oak ribs, steel plate, a net drum you could lose a cow in. Best working boat in the mid-ocean.',
      'The yard at home builds pleasure boats. I build boats that come back.',
      'Want to go farther than here? You will need more hull than that.',
    ] },
  { id: 'listener', name: 'the listener', full: 'The Listener', pr: 'he', role: 'lore', at: 'whisperLore', pose: 'sit',
    look: L(0x9a6a4a, 0x4a5a4a, 0x3a3a30, 'hood', 0x3a4a3a, 'long', 0x3a3a3a, { beard: 'stubble' }),
    lines: [
      'Shh. Hear that? No? It is the trees. They talk to each other through the roots. The lakes carry it.',
      'There are three lakes up here. Hollow Mere, the Moonpool and Deeproot Tarn. Each one has its own fish, and they do not mix.',
      'At night the Moonpool fish rise to the surface and just... hang there. Like they are listening too.',
      'Something walks between the giants after dark. Tall. Quiet. It has never hurt anybody. It just watches you fish.',
      'Put your ear to the totem. The old ones carved it so you could hear what the woods say.',
    ] },

  /* ======================= SUNSCAR ======================= */
  { id: 'kaia', name: 'kaia', full: 'Kaia Emberly', pr: 'she', role: 'seller', shop: 'sunscar', at: 'sunscarSeller', pose: 'stand',
    look: L(0x8a5a3a, 0xe0702a, 0x3a2e28, 'straw', 0, 'long', 0x1a1410, { nose: 1.0 }),
    say: say({
      hello: ['Welcome to Emberhaven! Mind the hot rocks. And the falling rocks. And the rocks in general.', 'The vents make the water warm, the warm water makes the fish weird. What did you catch?', 'Fish! Good. The mountain has been grumbling all morning. Sell quick.'],
      rods: ['The Magma Rod. Forged in the vents, quenched in the sea. It does not mind heat.'],
      bye: ['If the mountain coughs, row.', 'Watch the sky for rocks!'],
    }), lines: ['The mountain is awake.'] },
  { id: 'dunn', name: 'dunn', full: 'Forgemaster Dunn', pr: 'he', role: 'outfitter', shop: 'sunscar', at: 'sunscarOutfit', pose: 'stand',
    look: L(0x70462e, 0x3a2e28, 0x2a2a2a, 'none', 0, 'short', 0x1a1a1a, { beard: 'full', beardCol: 0x2a2a2a, build: 1.2, vest: 0x8a3a2a }),
    lines: [
      'Heat suits, volcanic bait, and the Magma Rod. Everything I sell has been in a fire and come out fine.',
      'The vent fish want something that smells like sulphur. Volcanic bait. You will not like the smell either.',
      'Wear the heat suit near the vents. The water there will cook an egg. And your feet.',
    ] },
  { id: 'rico', name: 'rico', full: 'Rico Swift', pr: 'he', role: 'boatyard', yard: 'sunscar', at: 'sunscarYard', pose: 'stand',
    look: L(0xc68a62, 0xf2d24a, 0x2a3a5a, 'cap', 0xe03a2a, 'short', 0x2a1e16, { glasses: true }),
    lines: [
      'The Swiftfin! Hydrofoils, a jet you can hear from the next island, and absolutely no room for anything else.',
      'Fastest thing that floats. Well - nearly. There is one ship at the edge of the world that beats her. Nobody has seen it in years.',
      'She hates storms. She hates big waves. She loves going very, very fast.',
    ] },
  { id: 'oldash', name: 'old ash', full: 'Old Ash', pr: 'she', role: 'lore', at: 'sunscarLore', pose: 'stand',
    look: L(0xe0ac86, 0x5a5048, 0x3a3a38, 'hood', 0x5a4a44, 'long', 0xc8c8c8, { glasses: true }),
    lines: [
      'I was born the year the mountain split. It has been talking ever since.',
      'When it rumbles, look up. The rocks it throws come down anywhere within a few hundred metres of the peak. They set boats on fire.',
      'The vents under the water are where the strange fish live. The Ashfin, the Cinder Eel, the Kiln Grouper. Fish the vents if you dare the heat.',
      'Some nights the sea round the mountain glows orange. That is when the rarest one comes up.',
    ] },

  /* ======================= SKYWATCH ======================= */
  { id: 'wren', name: 'wren', full: 'Wren Highcliff', pr: 'she', role: 'seller', shop: 'skywatch', at: 'skywatchSeller', pose: 'stand',
    look: L(0xf1c9a5, 0x3a5a7a, 0x4a4a52, 'bucket', 0x7a8a9a, 'short', 0xe8c060, {}),
    say: say({
      hello: ['You came up the lift? Most people are sick the first time. What did you catch down there?', 'Welcome to the Eyrie. Best view in the sea. Worst wind. Fish?', 'We fish off the edge up here. The line takes a whole minute to reach the water.'],
      rods: ['The Skyline. Longest line in the sea - three hundred metres of braid. You need it up here.'],
      bye: ['Do not lean on the rail.', 'Hold onto your hat.'],
    }), lines: ['Mind the wind.'] },
  { id: 'aldous', name: 'aldous', full: 'Captain Aldous', pr: 'he', role: 'outfitter', shop: 'skywatch', at: 'skywatchOutfit', pose: 'stand',
    look: L(0xe0ac86, 0x2e3e5a, 0x2a2a30, 'captain', 0xf2f2ee, 'short', 0xdddddd, { beard: 'moustache', beardCol: 0xeeeeee, belly: 0.3 }),
    lines: [
      'Cliff harnesses, sky bait, the Skyline Rod. Everything a person needs to fish from a height that would kill them.',
      'With a harness you can fall off the Eyrie and walk away. I have done it twice. On purpose, once.',
      'Up here you can see weather coming for fifty miles. Look through Pip\'s telescope - you can see the islands nobody has charted.',
    ] },
  { id: 'pip', name: 'pip', full: 'Pip the Lookout', pr: 'he', role: 'lore', at: 'skywatchLore', pose: 'stand',
    look: L(0xf0c8a0, 0xc8a040, 0x3a4a5e, 'cap', 0x3a6a4a, 'short', 0xc86a2a, { nose: 0.95, height: 0.94 }),
    lines: [
      'I watch the sea. All of it. Every day. Want to look? The telescope is right there on the edge.',
      'From here you can see four islands on a clear day - the woods to the north, the volcano east, the reef south. And fog to the west. There is always fog to the west.',
      'The fish at the foot of the cliffs are different. They live in the shade of the rock and never see the sun.',
      'Once I saw a whale jump clean out of the water between here and the Blackwater. Nobody believed me. It is still true.',
    ] },

  /* ======================= CRYSTAL REEF ======================= */
  { id: 'marisol', name: 'marisol', full: 'Doctor Marisol Vane', pr: 'she', role: 'seller', shop: 'crystal', at: 'crystalSeller', pose: 'stand',
    look: L(0x9a6a4a, 0xe8ecec, 0x3a3a48, 'none', 0, 'bun', 0x1a1410, { glasses: true, nose: 1.0 }),
    say: say({
      hello: ['Fascinating. You sailed here? Sit down, I buy specimens - and anything else you have caught.', 'The crystals change the water. The water changes the fish. Let me see what you found.', 'Every fish in this lagoon is new to science. Every single one. Sell me some.'],
      rods: ['The Prism Rod. Crystal blank, glass guides. It glows faintly near lagoon fish. We still do not know why.'],
      bye: ['Come back at night. You will see.', 'Do not touch the big spires.'],
    }), lines: ['Science!'] },
  { id: 'lumen', name: 'lumen', full: 'Lumen', pr: 'he', role: 'outfitter', shop: 'crystal', at: 'crystalOutfit', pose: 'stand',
    look: L(0xf5d7bd, 0x9af0f0, 0x3a3a48, 'none', 0, 'short', 0xf0f0f0, { glasses: true, height: 1.04 }),
    lines: [
      'Crystal dust bait, prism lenses, the Prism Rod. All grown right here in the lagoon.',
      'A prism lens lets you see fish in the dark water. Put it on at night and the lagoon is full of little lights.',
      'The crystal fish only bite on crystal dust. We tried everything else. Worms insulted them.',
    ] },
  { id: 'odile', name: 'odile', full: 'Captain Odile', pr: 'she', role: 'boatyard', yard: 'crystal', at: 'crystalYard', pose: 'stand',
    look: L(0xc8966e, 0x2e4e6a, 0xe8e0c8, 'captain', 0x1e2a3a, 'long', 0x5a3a24, { vest: 0x8a6a3a }),
    lines: [
      'The Wanderer. Two masts, a hold you can walk around in, and she goes anywhere the wind does.',
      'I sailed her round the whole sea twice. Nearly three times. The third time the Tidebreaker current turned me round.',
      'Sails do not care about fuel. They care about wind. There is always wind.',
    ] },
  { id: 'tobi', name: 'tobi', full: 'Tobi', pr: 'he', role: 'lore', at: 'crystalLore', pose: 'stand',
    look: L(0xe0ac86, 0xf07a6a, 0x3a4a5e, 'cap', 0x3a9aa8, 'short', 0x2a1e16, { height: 0.82, nose: 0.9 }),
    lines: [
      'My mum studies the crystals. I study the fish. My fish are more interesting.',
      'At night the whole lagoon lights up! Blue and pink and green! And the glass fish come out and you can see RIGHT THROUGH them.',
      'The biggest spire hums if you put your boat right next to it. Mum says it is the tide. I think it is singing.',
      'Only fish inside the lagoon. Outside the ring the fish are normal. Boring.',
    ] },

  /* ======================= FROSTFALL ======================= */
  { id: 'sigrun', name: 'sigrun', full: 'Sigrun', pr: 'she', role: 'seller', shop: 'frostfall', at: 'frostfallSeller', pose: 'stand',
    look: L(0xf5d7bd, 0xc8452e, 0x3a3a48, 'fur', 0xe8e0d0, 'long', 0xe8d8a0, { nose: 1.0 }),
    say: say({
      hello: ['You sailed to Frostfall. Hm. The last one who did that stayed. Fish?', 'Cold out, is it not. Cold keeps fish. I buy them all.', 'Ingrid sent you? Ingrid is my little sister. She thinks Frostbite Lake is cold. Ha.'],
      rods: ['The Glacier Rod. It will not snap at forty below. You might.'],
      bye: ['Keep moving. Stand still and you freeze.', 'Wear the thermal.'],
    }), lines: ['Cold.'] },
  { id: 'halvard', name: 'halvard', full: 'Halvard the Auger-smith', pr: 'he', role: 'outfitter', shop: 'frostfall', at: 'frostfallOutfit', pose: 'stand',
    look: L(0xe8b894, 0x5a4a3a, 0x3a3a38, 'fur', 0x8a6a4a, 'short', 0xd8d8d8, { beard: 'full', beardCol: 0xf0f0f0, build: 1.25, belly: 0.5 }),
    lines: [
      'Augers. The only augers in the whole sea, and I make every one. You want to fish through ice, you come to me.',
      'Thermal suits too. Without one, a night on the glacier will stop your heart. I am not joking. I am never joking.',
      'Frozen krill for bait. The glacier fish have never eaten anything warm and do not intend to start.',
    ] },
  { id: 'oldfrost', name: 'old frost', full: 'Old Frost', pr: 'he', role: 'lore', at: 'frostfallLore', pose: 'stand',
    look: L(0xd8b8a0, 0xe8e8f0, 0x5a5a64, 'fur', 0xf0f0f0, 'long', 0xf8f8f8, { beard: 'full', beardCol: 0xffffff, nose: 1.3 }),
    lines: [
      'Sixty winters on this ice. The glacier lake has never thawed. Not once. The fish under it have never seen the sun.',
      'Drill a hole anywhere on the lake. What comes up is pale as milk and strong as a bull.',
      'At the far end of the lake the ice is old - thousands of years. Fish there and sometimes something frozen comes up with the line.',
      'Without a thermal, get off the ice before dark. The cold at night here is not weather. It is a hand.',
    ] },

  /* ======================= DREADMIRE ======================= */
  { id: 'nettle', name: 'mother nettle', full: 'Mother Nettle', pr: 'she', role: 'seller', shop: 'dread', at: 'dreadSeller', pose: 'stand',
    look: L(0xc8a888, 0x4a5a3a, 0x3a3a30, 'hood', 0x3a4a2e, 'long', 0x8a8a8a, { nose: 1.5, glasses: false, vest: 0x5a4a30 }),
    say: say({
      hello: ['You found us through the channels. Good. Most follow the wrong lanterns.', 'Sit, sit. The mire fish are ugly and they taste of mud. I buy them anyway.', 'Do not look at the fog too long, dear. It looks back.'],
      rods: ['The Bogwood Rod. Cut from a tree that grew in the swamp for three hundred years. It does not rot. Nothing in here rots.'],
      bye: ['Follow the green lanterns. Only the green ones.', 'Go carefully, dear.'],
    }), lines: ['Hush.'] },
  { id: 'silt', name: 'silt', full: 'Silt', pr: 'he', role: 'outfitter', shop: 'dread', at: 'dreadOutfit', pose: 'stand',
    look: L(0x8a6a4a, 0x3a3a2a, 0x2a2a20, 'bucket', 0x4a4a30, 'short', 0x3a2a1a, { beard: 'stubble', build: 0.9 }),
    lines: [
      'Fog lamps, mire leeches, the Bogwood Rod. You want to see in here and you want the fish to bite. That is what I sell.',
      'A fog lamp pushes the fog back. Not much. Enough to see the stilts before you hit them.',
      'Leeches. The mire fish go mad for them. Hold them by the fat end.',
    ] },
  { id: 'lanternboy', name: 'the lantern boy', full: 'The Lantern Boy', pr: 'he', role: 'lore', at: 'dreadLore', pose: 'stand',
    look: L(0xe0ac86, 0x6a6a4a, 0x3a3a30, 'cap', 0x4a4a30, 'short', 0x2a1e16, { height: 0.84, nose: 0.9 }),
    lines: [
      'I light the lanterns on the channels every night. Green ones. So people can find their way in.',
      'Some nights there are more lights than I lit. Pale ones. They float between the trees and move when you are not looking.',
      'Mother Nettle says never follow the pale lights. I followed one once. It led me to a place where the fish were as big as boats.',
      'The fog here is thickest at dawn. That is when the Mire King bites. If it exists. It exists.',
    ] },

  /* ======================= IRONWRECK ======================= */
  { id: 'rusty', name: 'rusty', full: 'Rusty Marlowe', pr: 'he', role: 'seller', shop: 'ironwreck', at: 'ironwreckSeller', pose: 'stand',
    look: L(0xe0ac86, 0x7a4a32, 0x3a3a48, 'beanie', 0x5a5e64, 'short', 0xa84a2a, { beard: 'full', beardCol: 0xa84a2a, overalls: true }),
    say: say({
      hello: ['Salvage Town! Everything here was a ship once. Including some of the people. What you got?', 'Fish, junk, treasure - I buy the lot. Mostly junk, if I am honest.', 'The wreck field eats a boat a month. You are still floating. Good start.'],
      rods: ['Rods? I sell what the sea gives back. Right now that is nothing. Vex sells the good gear.'],
      bye: ['Mind the masts under the water.', 'If you sink, sink near us. We will find you.'],
    }), lines: ['Salvage!'] },
  { id: 'vex', name: 'vex', full: 'Vex Sparks', pr: 'she', role: 'outfitter', shop: 'ironwreck', at: 'ironwreckOutfit', pose: 'stand',
    look: L(0xc68a62, 0x3a3e46, 0x2a2a30, 'none', 0, 'short', 0x1a1a1a, { glasses: true, vest: 0xe0a830 }),
    lines: [
      'Wreck diving suits, salvage magnets, patch kits. The only real diving gear in the sea.',
      'With the suit you can stay down three minutes and see in the murk. The wrecks are full of stuff. Dive and press E at one.',
      'A salvage magnet on the line pulls up twice the treasure. And twice the boots. You win some.',
    ] },
  { id: 'olga', name: 'big olga', full: 'Big Olga', pr: 'she', role: 'boatyard', yard: 'ironwreck', at: 'ironwreckYard', pose: 'stand',
    look: L(0xf0c8a0, 0x5a5e64, 0x3a3a38, 'cap', 0xe0a830, 'bun', 0x8a6a4a, { build: 1.35, belly: 0.4 }),
    lines: [
      'The Ironclad and the Salvager. One takes a beating, the other takes everything off the bottom.',
      'Repairs at half the price Marge charges. Because I am better. Do not tell her.',
      'The Ironclad is plated like a tank. Takes forever to fix when you do break her, mind.',
    ] },
  { id: 'quill', name: 'quill', full: 'Diver Quill', pr: 'he', role: 'lore', at: 'ironwreckLore', pose: 'stand',
    look: L(0x9a6a4a, 0x2a4a6a, 0x2a2a30, 'none', 0, 'bald', 0x3a3a3a, { beard: 'stubble', glasses: true }),
    lines: [
      'Forty years diving these wrecks. I know every one by name. The Marigold. The Duchess. The Unlucky Seven.',
      'Why so many wrecks? The current here goes round in a circle and the bank is shallow. Ships come in, and they do not go out.',
      'The fish live inside the hulls. Wreck eels, rust crabs, the Iron Grouper. They like the dark.',
      'Deep in the field there is one wreck nobody has opened. Her hatches are welded shut from the inside.',
    ] },

  /* ======================= LOST SHORES ======================= */
  { id: 'wyn', name: 'wyn', full: 'Wyn the Hermit', pr: 'he', role: 'seller', shop: 'lost', at: 'lostSeller', pose: 'stand', extraShop: true,
    look: L(0xd8a888, 0x6a645a, 0x4a4a44, 'hood', 0x5a5a52, 'long', 0x9a9a9a, { beard: 'full', beardCol: 0xa8a8a8, nose: 1.4, build: 0.9 }),
    say: say({
      hello: ['A visitor. Two hundred and twelve people lived here once. Now there is me. What do you want?', 'You are real? Good. I buy fish. And I sell what the others left behind.', 'Sit by the fire. The fog cannot get into the fire.'],
      rods: ['I have no rods. Their rods are still in the houses. I do not touch them.'],
      bye: ['Read the notes. All of them.', 'Do not stay after dark.'],
    }), lines: ['They left.'] },
  { id: 'ghostfisher', name: 'the drowned man', full: 'The Drowned Man', pr: 'he', role: 'lore', at: 'lostLore', pose: 'stand',
    look: L(0xb8c0c0, 0x5a6a6a, 0x4a5a5a, 'captain', 0x3a4a4a, 'short', 0x8a9a9a, { beard: 'full', beardCol: 0x8a9a9a }),
    lines: [
      'You can see me? Hm. Then you are further out than most.',
      'We all heard it the same night. A bell, out in the fog. Every one of us got up and walked to the water.',
      'I do not remember the rest. I remember the cold. And the lights under the water. Lights like a town.',
      'The notes will tell you. Everyone wrote one. Find them all and you will know as much as I do.',
    ] },

  /* ======================= THUNDERPEAK ======================= */
  { id: 'juno', name: 'juno', full: 'Juno Voltaire', pr: 'she', role: 'seller', shop: 'thunder', at: 'thunderSeller', pose: 'stand',
    look: L(0x70462e, 0x5a5ab0, 0x2a2a30, 'hood', 0x3a3e44, 'bun', 0x1a1410, { glasses: true }),
    say: say({
      hello: ['You got here in one piece? Impressive. Most boats come in on fire.', 'Sell fast. The next bolt is in about... now. See?', 'Storm fish! I buy storm fish. They only bite when the lightning hits the water.'],
      rods: ['The Thunderstruck Rod. Copper-wound, grounded, rated for a direct strike. Twice.'],
      bye: ['Keep your rod down in the lightning!', 'Lightning rod on the mast. Always.'],
    }), lines: ['It never stops.'] },
  { id: 'sparks', name: 'sparks', full: 'Sparks McGee', pr: 'he', role: 'outfitter', shop: 'thunder', at: 'thunderOutfit', pose: 'stand',
    look: L(0xf0c8a0, 0xe0a830, 0x3a3a48, 'cap', 0x3a3a48, 'short', 0xf0f0f0, { glasses: true, nose: 1.3 }),
    lines: [
      'Lightning rods for your boat, charged bait, the Thunderstruck. I have been hit eleven times. I am fine. Mostly.',
      'Without a lightning rod on the mast, the storm finds your boat. It likes the highest thing on the water. That is you.',
      'Charged bait! It fizzes. The storm fish can feel it from a mile off.',
    ] },
  { id: 'brakka', name: 'brakka', full: 'Captain Brakka', pr: 'she', role: 'boatyard', yard: 'thunder', at: 'thunderYard', pose: 'stand',
    look: L(0xc68a62, 0xe0502a, 0x2a2a30, 'captain', 0x2a2a30, 'short', 0x3a2a1a, { build: 1.15, vest: 0x3a3e44 }),
    lines: [
      'The Stormbreaker. High bow, sealed wheelhouse, rod on the mast. She was built to sail into this and come out again.',
      'Waves that would roll a trawler she just climbs over. Not fast. Not pretty. Never sunk.',
      'Take her to the edge of the world if you like. She will get you there.',
    ] },
  { id: 'rumble', name: 'old rumble', full: 'Old Rumble', pr: 'he', role: 'lore', at: 'thunderLore', pose: 'stand',
    look: L(0xe0ac86, 0x3a3e46, 0x2a2a30, 'hood', 0x2a2e34, 'short', 0xc8c8c8, { beard: 'full', beardCol: 0xdddddd }),
    lines: [
      'The mountain makes the storm. Always has. Air goes up the peak, gets cold, comes down angry.',
      'Count between the flash and the thunder. Less than three and you are too close. Out here it is always less than three.',
      'The storm fish only bite when the lightning is in the water. The Voltfin, the Thundergill. They come up to feed on the light.',
      'At the top of the peak there is a lake of rain. Nobody has climbed to it. Nobody sane.',
    ] },

  /* ======================= TIDEBREAKER ======================= */
  { id: 'marin', name: 'marin', full: 'Marin Swell', pr: 'he', role: 'seller', shop: 'tide', at: 'tideSeller', pose: 'stand',
    look: L(0x9a6444, 0x2a6a9a, 0xe8e0c8, 'straw', 0, 'short', 0x1a1410, { beard: 'stubble' }),
    say: say({
      hello: ['You got in through the rip? Ha! Welcome to Tidebreaker. The water here goes faster than you do.', 'Current fish! The ones that swim against the rip all day are all muscle. Sell them to me.', 'Anchor down, friend, or you will be selling to me from the next island.'],
      rods: ['The Riptide Rod. Heavy, stubborn, low gear. For fish that use the current against you.'],
      bye: ['Anchor well.', 'Ride the race, do not fight it.'],
    }), lines: ['Ride the current.'] },
  { id: 'coriolis', name: 'master coriolis', full: 'Master Coriolis', pr: 'she', role: 'outfitter', shop: 'tide', at: 'tideOutfit', pose: 'stand',
    look: L(0xe0ac86, 0x2a4a6a, 0x3a3a48, 'captain', 0x2a6a9a, 'bun', 0xc8c8c8, { glasses: true }),
    lines: [
      'I am the eldest of the Current Masters. We sell current keels, current charts and the heaviest anchors in the sea.',
      'A keel stops your boat being carried off sideways. A chart shows you where the water runs. An anchor keeps you put.',
      'The Grapnel Claw and the Leviathan Hook are only made here. Nothing else holds in the race.',
    ] },
  { id: 'delphine', name: 'delphine', full: 'Delphine', pr: 'she', role: 'boatyard', yard: 'tide', at: 'tideYard', pose: 'stand',
    look: L(0x70462e, 0xe8e0c8, 0x2a3a5a, 'bucket', 0x2a6a9a, 'long', 0x1a1410, { nose: 1.0 }),
    lines: [
      'The Deep Runner. Long, narrow, a keel like a knife. She runs through currents that would spin anything else.',
      'Built for deep water. Out past the outer ocean she is the best thing afloat - bar one.',
      'The Current Masters design her. I just build her. Carefully.',
    ] },
  { id: 'tidereader', name: 'the tide reader', full: 'The Tide Reader', pr: 'he', role: 'lore', at: 'tideLore', pose: 'stand',
    look: L(0x8a5a3a, 0x3a8ab0, 0x3a3a48, 'hood', 0x2a4a6a, 'long', 0x3a3a3a, { beard: 'full', beardCol: 0x3a3a3a }),
    lines: [
      'The whole sea turns round Driftwood Bay, slowly, like a wheel. Here the wheel catches on the stacks and spins.',
      'The current round the stacks runs at four metres a second. Faster than most boats. Go with it, not against it.',
      'Your boat drifts when you stop - backwards, sideways, wherever the water goes. Out here it can drift a mile while you make tea.',
      'In the rip between the stacks the fish never stop swimming. They are the strongest fish in the sea, pound for pound.',
    ] },

  /* ======================= SUNKEN CROWN ======================= */
  { id: 'amara', name: 'amara', full: 'Regent Amara', pr: 'she', role: 'seller', shop: 'crown', at: 'crownSeller', pose: 'stand',
    look: L(0x8a5a3a, 0xd8b048, 0x6a2a2a, 'none', 0, 'bun', 0x1a1410, { vest: 0x6a2a2a, nose: 1.0 }),
    say: say({
      hello: ['Welcome to the Crown. I am not a real regent. Nobody is, any more. But the title came with the dock.', 'Fish, relics, crowns - bring me anything that comes up out of the city. Relics most of all.', 'You fished the throne room? Then show me. The throne room fish are wearing jewellery.'],
      rods: ['The Crown Rod. Gold-wound, very heavy, and absolutely not stolen from the treasury.'],
      bye: ['Long live nobody.', 'Mind the towers under the water.'],
    }), lines: ['The Crown remembers.'] },
  { id: 'barnaby', name: 'barnaby', full: 'Barnaby Goldtooth', pr: 'he', role: 'outfitter', shop: 'crown', at: 'crownOutfit', pose: 'stand',
    look: L(0xe0ac86, 0x6a2a2a, 0x3a3a48, 'captain', 0x2a2a2a, 'short', 0x3a2a1a, { beard: 'full', beardCol: 0x3a2a1a, belly: 0.5 }),
    lines: [
      'Relic satchels, royal bait, the Crown Rod. Everything a treasure hunter needs, at a treasure hunter\'s price.',
      'With a relic satchel every relic you bring up is worth twice as much. It is a very good satchel.',
      'The city went under in one night, they say. The king stayed on his throne. The throne is still down there. So is he.',
    ] },
  { id: 'herald', name: 'the last herald', full: 'The Last Herald', pr: 'he', role: 'lore', at: 'crownLore', pose: 'stand',
    look: L(0xd8c8a8, 0xe8d8b0, 0x6a2a2a, 'hood', 0xd8b048, 'short', 0xe8e8e8, { beard: 'moustache', beardCol: 0xe8e8e8 }),
    lines: [
      'Hear ye! The city of Aurel, jewel of the southern sea, has... gone under. Some time ago. I am still announcing it.',
      'The streets are shallow enough to fish. The throne room is deeper. The things that live there were the king\'s fish once - he kept them in golden ponds.',
      'Bring up the relics: crowns, sceptres, seals. The Regent pays well for them.',
      'On the night of the full moon the old bells of Aurel ring under the water. I have heard them. So will you.',
    ] },

  /* ======================= ABYSSAL REACH ======================= */
  { id: 'ysolde', name: 'ysolde', full: 'Keeper Ysolde', pr: 'she', role: 'seller', shop: 'abyssal', at: 'abyssalSeller', pose: 'stand',
    look: L(0xc8a888, 0x3a3440, 0x2a2a30, 'hood', 0x3a3440, 'long', 0xe8e8e8, { glasses: true }),
    say: say({
      hello: ['The Deep Light welcomes you. Few come this far. Fewer come back with fish. Did you?', 'Under us the water goes down a mile and a half. What lives down there is enormous. What did you bring up?', 'Sell me what the trench gave you. Carefully. Some of them are still alive.'],
      rods: ['The Abyssal Rod. Built to hold the biggest fish in the world that is not a leviathan. And it does. Usually.'],
      bye: ['Watch the water for lights.', 'Do not look into the eye.'],
    }), lines: ['The deep is watching.'] },
  { id: 'fathom', name: 'doctor fathom', full: 'Doctor Fathom', pr: 'he', role: 'outfitter', shop: 'abyssal', at: 'abyssalOutfit', pose: 'stand',
    look: L(0xf0c8a0, 0x2a2a34, 0x2a2a30, 'none', 0, 'bald', 0x8a8a8a, { glasses: true, vest: 0x6a7af0 }),
    lines: [
      'Pressure line, deep lures, the Abyssal Rod. The trench is a mile and a half deep. Ordinary line pops like thread.',
      'A deep lure glows in the black. Down there, a light is the only thing anybody looks at.',
      'I study the phenomena. The lights that rise. The booms. The eye. Mostly the eye.',
    ] },
  { id: 'nemo', name: 'nemo black', full: 'Nemo Black', pr: 'he', role: 'boatyard', yard: 'abyssal', at: 'abyssalYard', pose: 'stand',
    look: L(0x70462e, 0x1a1a24, 0x1a1a1a, 'beanie', 0x1a1a24, 'short', 0x1a1a1a, { beard: 'stubble', build: 1.05 }),
    lines: [
      'The Abyss. Black hull, blue lights, deep sonar, built for this water and nothing else.',
      'Out here in the dark, the Abyss sees what other boats cannot. Things that bump hulls leave her alone.',
      'She is the second best boat in the sea. The first is at Vigil\'s End, and it is not for sale to just anybody.',
    ] },
  { id: 'watcher', name: 'the watcher', full: 'The Watcher', pr: 'she', role: 'lore', at: 'abyssalLore', pose: 'stand',
    look: L(0xd8b8a0, 0x5a4a6a, 0x3a3a48, 'hood', 0x4a3a5a, 'long', 0x3a2a4a, {}),
    lines: [
      'I keep the lamp lit so the ships see the needle. And so the things below see us, I suppose.',
      'Some nights, columns of light rise out of the trench. Blue. Silent. Then they go back down.',
      'Once, a year ago, an eye opened in the water off the dock. As wide as the lighthouse is tall. It looked at me for a minute. Then it closed.',
      'The fish here are the biggest in the world. The Trench Titan. The Abyssal Grouper. The Deep Emperor. Bring the biggest rod you can find.',
    ] },

  /* ======================= VIGIL'S END: the one who sells the Leviathan Hunter ======================= */
  { id: 'kettle', name: 'bartholomew', full: 'Bartholomew Kettle', pr: 'he', role: 'boatyard', yard: 'reach', at: 'reachYard', pose: 'stand',
    look: L(0xd8a888, 0x3a3e44, 0x2a2a30, 'captain', 0x2a2e34, 'short', 0xc8c8c8, { beard: 'full', beardCol: 0xd8d8d8, build: 1.15, vest: 0x5a4a3a }),
    lines: [
      'Maud is my sister. She sells the rods. I sell the ship.',
      'The Leviathan Hunter. Twin engines, floodlights, a harpoon cannon, a hull made for the edge of the world. There is nothing better on the sea, and there never will be.',
      'My brother and I built her for the great ones. He took the first one out. He did not come back. She did.',
    ] },
];
