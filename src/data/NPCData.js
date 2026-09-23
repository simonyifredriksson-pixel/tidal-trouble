/* NPCData.js - the people of Driftwood Bay, the outposts and Vigil's End.

   `at` names a settlement anchor (resolved in Settlement.js) so moving a
   building moves its keeper. `role` decides what talking to them offers.
   Pronouns are in `pr` and are used wherever the game refers to them.

   FISH SELLERS carry `shop` (an island id, see GearData SHOPS) and a `say`
   block: the lines they use in the dialogue - a greeting, what they say when
   you sell, when you have nothing, when you try to sell a favourite, when
   they show you their rods. {n} {total} {fish} {rod} {price} are filled in.
   Every seller is a little different; none of them is a menu. */

export const NPCS = [
  { id: 'gus', name: 'old gus', full: 'Old Gus', pr: 'he', role: 'lore', at: 'gusChair', pose: 'sit',
    look: { skin: 0xf1c9a5, shirt: 0x5a6a7a, pants: 0x6a2e2a, boots: 0x2a2a2a, hat: 'captain', hatCol: 0xf2f2ee, hair: 'short', hairCol: 0xdddddd, beard: 'full', beardCol: 0xeeeeee, nose: 1.3, belly: 0.4, vest: 0x5a3a2a },
    lines: [
      'The waters round here are not normal, kid. Never have been. Not since the guild was young.',
      'Sit a while. Fish bite better when you stop wanting them to.',
      'I saw Grandmother Gloop once. Mirror Lake, full moon. She looked at me. I looked at her. I went home.',
      'Big fish pull the boat. Bigger fish pull the fisherman. The biggest ones pull the whole village into a story.',
      'The farther you sail from the bay, the stranger it gets. Every island out there has its own rods for its own water.',
      'Past the Blackwater, south and east, right at the edge of the map, there is an island in the fog. Old men sit on the cliffs there. Waiting.',
    ] },
  { id: 'melvin', name: 'melvin', full: 'Melvin', pr: 'he', role: 'tackle', at: 'tackleDoor', pose: 'stand',
    look: { skin: 0xf0c8a0, shirt: 0x4a5a8a, pants: 0xe8862a, boots: 0x2a2a2a, hat: 'none', hair: 'bald', hairCol: 0x8a6a4a, glasses: true, overalls: true, nose: 1.5, height: 1.02 },
    lines: [
      'Welcome to Melvin\'s Bait and Tackle. Everything is on sale. Nothing is refundable.',
      'Explosive bait? Legally I have to tell you it is a bad idea. Personally I love it.',
      'That rod of yours has seen better decades. Pim next door to your hut sells a Reinforced. The good stuff is out on the islands.',
      'Mystery bait is called mystery bait because I also do not know what is in it.',
    ] },
  { id: 'marge', name: 'marge', full: 'Marge the Shipwright', pr: 'she', role: 'boatyard', at: 'yardDoor', pose: 'stand',
    look: { skin: 0xc68a62, shirt: 0x7a3a2a, pants: 0x3a3a48, boots: 0x3a2a20, hat: 'beanie', hatCol: 0x3a6a8a, hair: 'long', hairCol: 0x2a1e16, nose: 1.1, build: 1.1 },
    lines: [
      'You break it, I fix it. You sink it, I build you a new one. Either way you pay me.',
      'That rowboat has more patches than planks. I respect it.',
      'The open sea eats little boats. Get a hull that can take a wave.',
      'You want to go to Vigil\'s End? Not in the Biscuit you don\'t. The swell out there would fold it like a letter.',
    ] },
  { id: 'odessa', name: 'odessa', full: 'Guildmaster Odessa', pr: 'she', role: 'guild', at: 'guildDoor', pose: 'stand',
    look: { skin: 0x70462e, shirt: 0x2e4e5e, pants: 0x2a2a30, boots: 0x1a1a1a, hat: 'captain', hatCol: 0x1e2a3a, hair: 'bun', hairCol: 0x1a1410, glasses: true, nose: 1.0, vest: 0x8a6a3a },
    lines: [
      'The guild map shows every leviathan we know of. Find the clues and the map will show you where they wait.',
      'Captain Mare founded this guild a hundred years ago. He left a mess. We are still cleaning it up.',
      'Every leviathan carries a shard. Bring them home and the table starts to hum.',
      'The great ones - the ones at the edge of the world - are not on my map. Nobody has charted them. Nobody has seen one in years.',
    ] },
  { id: 'pim', name: 'pim', full: 'Pim the Fishmonger', pr: 'they', role: 'seller', shop: 'home', at: 'market', pose: 'stand',
    look: { skin: 0xe0ac86, shirt: 0xf2f2ee, pants: 0x3a4a5e, boots: 0x2e5a3a, hat: 'cap', hatCol: 0x2e7ab0, hair: 'short', hairCol: 0xa84a2a, beard: 'moustache', beardCol: 0xa84a2a, nose: 1.2, belly: 0.6 },
    lines: ['Morning, neighbour! Right next door, as always.'],
    say: {
      hello: ['Morning, neighbour! Right next door, as always. What have you got for me?', 'Fresh fish! I buy anything with fins. And some things without.', 'The farther out you go, the more I pay. That is just how the sea works.', 'Back already? Let me see what you hauled in.'],
      sold: ['{n} fish, {total} coins. Pleasure doing business, neighbour!', 'Ooh, lovely. That is {total} coins for the lot. Come back soon.', '{total} coins! I will have these on ice before you are back on your boat.'],
      soldOne: ['A {fish}! Nice. {total} coins, straight into your pocket.', 'That {fish} is worth {total} to me. Deal.'],
      nothing: ['Your hands are empty and your boat is not here. Bring the catch over and we will talk.', 'Nothing to sell? Go on, the fish are not going to catch themselves.'],
      empty: ['You are not holding anything, friend. Pick a fish up first.'],
      fav: ['That is your favourite? Then I am not buying it. Keep it. Right-click it if you change your mind.'],
      favSome: ['I left your favourites alone, of course.'],
      rods: ['I only stock the starter gear here. Better rods are sold out on the islands - the farther you go, the better they get.'],
      bought: ['The {rod}! Look after it. It will look after you.'],
      broke: ['That is {price} coins, neighbour. Catch a few more first.'],
      bye: ['See you, neighbour.', 'Tight lines!', 'Mind the Bombfish.'],
    } },
  { id: 'ingrid', name: 'ingrid', full: 'Ingrid of the Ice', pr: 'she', role: 'seller', shop: 'frost', at: 'iceHut', pose: 'stand', extra: { label: 'Buy augers and gear', act: 'open', arg: 'tackle', icon: 'auger' },
    look: { skin: 0xf5d7bd, shirt: 0xc8452e, pants: 0x3a3a48, boots: 0x3a2a20, hat: 'fur', hatCol: 0xe8e0d0, hair: 'long', hairCol: 0xe8d8a0, nose: 1.0 },
    lines: ['Drill a hole. Drop a line. Do not stand on the singing ice.'],
    say: {
      hello: ['You want to fish the lake? Drill a hole. Drop a line. Do not stand on the singing ice.', 'Cold, is it not? Good. Cold keeps the fish honest.', 'I buy fish. I sell rods that do not snap in the cold. That is all.'],
      sold: ['{n} fish. {total} coins. Do not spend it on anything warm.', '{total}. Fair price. I do not haggle.'],
      soldOne: ['One {fish}. {total} coins.'],
      nothing: ['You have nothing I want. Come back with fish.'],
      empty: ['Your hands are empty. So are mine. Pick something up.'],
      fav: ['You love this one. I can see it. I will not take it.'],
      favSome: ['Your favourites stay with you.'],
      rods: ['The Icebreaker. Short, heavy, stubborn. Like me.'],
      bought: ['Good choice. It will not snap. You might.'],
      broke: ['{price} coins. You do not have them. Come back.'],
      bye: ['Go home before dark.', 'Walk. Do not run.'],
    } },
  { id: 'coco', name: 'coco', full: 'Coco', pr: 'he', role: 'seller', shop: 'tropic', at: 'tiki', pose: 'stand', extra: { label: 'Trade bait and gear', act: 'open', arg: 'tackle', icon: 'chest' },
    look: { skin: 0x9a6444, shirt: 0xf07a8a, pants: 0xe8e0c8, boots: 0x8a6a44, hat: 'straw', hair: 'short', hairCol: 0x1a1410, beard: 'stubble', nose: 1.1 },
    lines: ['Welcome to the Sunken Coast, friend.'],
    say: {
      hello: ['Welcome to the Sunken Coast, friend! Mind the wrecks. Mind the sharks. Mind the sharks in the wrecks.', 'Heyyy, look who sailed all the way out here. What did the sea give you today?', 'Sit, sit. Coconut? No? Fish, then. Let us talk fish.'],
      sold: ['{n} fish! Ha! {total} coins, my friend. The sea is generous today.', '{total} coins, and I did not even have to get wet. Beautiful.'],
      soldOne: ['A {fish}! Lovely colour. {total} coins.'],
      nothing: ['No fish? No problem. The reef is right there. Go on.'],
      empty: ['Your hands are empty, friend. Grab one off the deck.'],
      fav: ['Ahh, that is the special one. No, no. You keep it. Right-click it if you ever want to let it go.'],
      favSome: ['Your favourites stay on the boat, of course.'],
      rods: ['I carve these myself. The Coral Whip, for fast fish. And the Deepwater, for the big ones past the reef.'],
      bought: ['The {rod}! She suits you. Go catch something ridiculous.'],
      broke: ['{price} coins, friend. The reef will lend you the rest if you fish it.'],
      bye: ['Easy tides!', 'Mind the sharks!', 'Come back with something weird.'],
    } },
  { id: 'keeper', name: 'the keeper', full: 'The Lighthouse Keeper', pr: 'he', role: 'seller', shop: 'open', at: 'lighthouse', pose: 'stand', lore: true,
    look: { skin: 0xe0ac86, shirt: 0x2e3e5a, pants: 0x2a2a30, hat: 'hood', hatCol: 0x3a4a3a, beard: 'full', beardCol: 0x8a8a8a, nose: 1.4 },
    lines: [
      'I have not been down those stairs in thirty years. Not since the arms came up the wall.',
      'On storm nights something big swims out past the stacks. It likes the lightning.',
      'The sea out here does not forgive small boats.',
      'There is a kraken in the offshore water. Not the Queen - something else. No warning. It just comes up under you. Carry an axe.',
    ],
    say: {
      hello: ['You found the lighthouse. Most people only find the rocks.', 'Another one who thinks the open sea is just water. Well. Show me your catch.', 'I buy fish. The lamp needs oil and oil needs coin.'],
      sold: ['{n} fish, {total} coins. Now go home before the weather turns.', '{total}. That will keep the lamp lit a while.'],
      soldOne: ['A {fish}. {total} coins. Do not tell the others I paid that much.'],
      nothing: ['Nothing? Then you are just visiting. Visiting is dangerous out here.'],
      empty: ['Your hands are empty. Like the sea, most nights.'],
      fav: ['You would sell THAT one? No. You would not. Keep it.'],
      favSome: ['I did not touch your favourites.'],
      rods: ['Rods for the open sea. The Heavy, for giants. The Stormglass, for when the sky itself is against you.'],
      bought: ['The {rod}. Treat it like the lamp - keep it working and it will keep you alive.'],
      broke: ['{price} coins. The sea will pay you that, if it does not eat you first.'],
      bye: ['Watch the stacks.', 'Stay off the stairs.'],
    } },
  { id: 'maud', name: 'maud', full: 'Maud Kettle', pr: 'she', role: 'seller', shop: 'reach', at: 'vigilSeller', pose: 'stand', lore: true,
    look: { skin: 0xd8a888, shirt: 0x5a6a5a, pants: 0x3a3a38, boots: 0x2a2420, hat: 'hood', hatCol: 0x4a4e52, hair: 'long', hairCol: 0xc8c8c8, nose: 1.15, glasses: true, vest: 0x3a2e28 },
    lines: [
      'End of the sea, love. Nothing past me but fog and the edge of the map.',
      'Six of them on the cliffs, and not one has seen it in years. They come every morning anyway. That is what a vigil is.',
      'When one of the great ones comes up, the whole sea hears about it. The fog goes still first. Then the gulls leave.',
      'Three kinds, the old men say. The grey one, the long one, and the white one. Nobody has seen the white one twice.',
    ],
    say: {
      hello: ['End of the sea, love. Nothing past me but fog and the edge of the map.', 'You made it through the rocks. Most do not, the first time. What have you got?', 'Catch something out there? I buy it all, even the ugly ones. Especially the ugly ones.'],
      sold: ['{n} fish, {total} coins. Out here everything is worth more. Even you.', '{total} coins. The fog pays well, love.'],
      soldOne: ['A {fish}. {total} coins. Lovely thing.'],
      nothing: ['Nothing to sell? Then sit a while. Listen to the old men. They like an audience.'],
      empty: ['Hands empty, love. Bring me something.'],
      fav: ['Oh, not that one. You would miss it. I can tell.'],
      favSome: ['I left your favourites be.'],
      rods: ['Only two rods out here, and you will not find either anywhere else. One of them was made for a leviathan.'],
      bought: ['The {rod}. Now you have no excuse. When it comes up, you go.'],
      broke: ['{price} coins, love. The great ones are worth more than that, if you can land one.'],
      bye: ['Mind the rocks.', 'Keep your eyes on the fog.', 'Go gently.'],
    } },

  /* ---------------- the six fishermen of Vigil's End ----------------
     Each sits (or stands) on a different cliff. Each tells the legend a
     different way; together they are the only map there is. */
  { id: 'tobias', name: 'tobias', full: 'Old Tobias Wren', pr: 'he', role: 'vigil', at: 'vigil1', pose: 'sitfish',
    look: { skin: 0xe8b894, shirt: 0x5a4a3a, pants: 0x3a3a38, boots: 0x2a2420, hat: 'captain', hatCol: 0x3a3e44, hair: 'short', hairCol: 0xe8e8e8, beard: 'full', beardCol: 0xf0f0f0, nose: 1.35, belly: 0.3 },
    lines: [
      'Sit if you like. The rock is cold but the company is patient. I have been on this cliff every morning for thirty-one years.',
      'My brother Eli saw it. The morning before he rowed out past the last rock and never rowed back. He said the sea stood up.',
      'It is out there. Nothing that big dies quietly, and I have heard nothing. So it is out there.',
      'When it comes, the gulls go first. Then the fog goes still. You will feel it in your teeth before you see it.',
      'If you ever hook one, do not think about the money. Think about holding on.',
    ] },
  { id: 'hesketh', name: 'hesketh', full: 'Hesketh Moore', pr: 'he', role: 'vigil', at: 'vigil2', pose: 'fish',
    look: { skin: 0xc8966e, shirt: 0x3a4a3e, pants: 0x2e2e34, boots: 0x1e1e1e, hat: 'beanie', hatCol: 0x5a2a2a, hair: 'short', hairCol: 0x6a6a6a, beard: 'stubble', nose: 1.5, build: 1.05 },
    lines: [
      'Twenty-two years on this ledge. Not a ripple bigger than a seal. Make of that what you will.',
      'Leviathan. Ha. Fog, rocks and old men who drink too much bilge tea. That is your leviathan.',
      'Tobias says it is out there because he has not heard it die. I have not heard the moon die either.',
      'I will tell you what IS real: the rocks. Come in slow, keep the big stack on your left, and do not argue with the swell.',
      '...Still. Every morning I cast out toward the deep water. Just in case I am wrong.',
    ] },
  { id: 'ada', name: 'ada', full: 'Ada Crane', pr: 'she', role: 'vigil', at: 'vigil3', pose: 'sitfish',
    look: { skin: 0x9a6a4a, shirt: 0x6a5a7a, pants: 0x3a3a48, boots: 0x3a2a20, hat: 'bucket', hatCol: 0x6a7a5a, hair: 'bun', hairCol: 0x9a9a9a, glasses: true, nose: 1.05 },
    lines: [
      'My grandfather kept a log. Every sighting, every weather. Want to hear what is in it?',
      'Page forty. "A grey back rose to the north. We took it for an island and made for it. The island blinked."',
      'He called it the Graveback. Plates like gravestones, barnacles like a churchyard. Slow as a tide, and just as hard to stop.',
      'The log says the Graveback comes up more often than the others. More often means once every ten years, mind.',
      'One more thing he wrote: it breathes. From the cliffs you can hear it, like a storm through a keyhole.',
    ] },
  { id: 'pell', name: 'pell', full: 'Young Pell', pr: 'they', role: 'vigil', at: 'vigil4', pose: 'fish',
    look: { skin: 0xf1c9a5, shirt: 0xc8a040, pants: 0x3a4a5e, boots: 0x5a3a24, hat: 'cap', hatCol: 0x3a6a4a, hair: 'short', hairCol: 0xc86a2a, nose: 0.95, height: 0.96 },
    lines: [
      'You came all the way out here too? Brilliant! I have only been here two winters. The others say I talk too much.',
      'Have you heard about the Ninefold? A serpent that comes up in arches - nine of them, all in a row, like a bridge nobody built.',
      'Mags says it lifts its head right out of the water to look at you. Just LOOKS. Then decides.',
      'I carved nine notches on my rod. For luck. Hesketh says that is how you lose a rod.',
      'If one shows up and I am asleep, you will wake me, right? RIGHT?',
    ] },
  { id: 'ansel', name: 'ansel', full: 'Brother Ansel', pr: 'he', role: 'vigil', at: 'vigil5', pose: 'sitfish',
    look: { skin: 0x70462e, shirt: 0x8a7a66, pants: 0x5a4e40, boots: 0x3a2e24, hat: 'hood', hatCol: 0x7a6a56, beard: 'full', beardCol: 0x3a3a3a, nose: 1.1, build: 0.95 },
    lines: [
      'You walk softly. Good. The water here listens.',
      'Most things in the sea swim. One of them flies. White wings under the water, wider than this island is long.',
      'The Hushwing. Once in a lifetime, if the life is long. I have had a long life. I am still waiting.',
      'It makes no sound. That is how you know. When the waves stop talking, look up.',
      'Some come here to catch it. I only want to see it once more before the fog takes me.',
    ] },
  { id: 'mags', name: 'mags', full: 'Mags Hollow', pr: 'she', role: 'vigil', at: 'vigil6', pose: 'fish',
    look: { skin: 0xe0ac86, shirt: 0x2e4e6a, pants: 0x2a2a30, boots: 0x1a1a1a, hat: 'beanie', hatCol: 0xc8a040, hair: 'long', hairCol: 0x5a3a24, nose: 1.1, build: 1.1, vest: 0x4a3a2a },
    lines: [
      'You want advice, or you want stories? Everybody else here has stories. I have got advice.',
      'When one comes up, the whole sea hears about it. Get out past the rocks fast - but not so fast you meet one of them.',
      'They do not take bait like fish do. Maybe one cast in seven it will actually bite. The rest of the time it is deciding whether you are worth it.',
      'Bring the best rod you can buy. Maud\'s Legendary might hold one for a minute. Her Vigil\'s Oath might hold one for longer.',
      'And once it is on, it pulls for minutes, not seconds. Keep the zone on it and do not you dare let go.',
    ] },
];
export const NPC_BY_ID = Object.fromEntries(NPCS.map(n => [n.id, n]));
export const VIGIL_FISHERMEN = ['tobias', 'hesketh', 'ada', 'pell', 'ansel', 'mags'];

export const THIEF = { id: 'pete', name: 'slippery pete', full: 'Slippery Pete', pr: 'he',
  look: { skin: 0xe0ac86, shirt: 0x2a2a2a, pants: 0x5a3a24, hat: 'beanie', hatCol: 0x1a1a1a, hair: 'short', hairCol: 0x2a1e16, beard: 'stubble', nose: 1.6, build: 0.9 } };

/* Villagers who wander the settlement for life. */
export const VILLAGERS = [
  { name: 'nell', seed: 11 }, { name: 'bo', seed: 23 }, { name: 'ruth', seed: 37 }, { name: 'otto', seed: 41 },
  { name: 'dex', seed: 53 }, { name: 'june', seed: 67 },
];

export const RADIO = {
  storm: ['Radio: Storm coming in off the open sea. Get your boats home!', 'Radio: This is Driftwood harbour. Big weather. Big waves. Big trouble.'],
  migration: ['Radio: Fish migration! The water is boiling with them!', 'Radio: Every fish in the bay just showed up at once. Grab a net!'],
  giant: ['Radio: Something HUGE just went under the harbour buoy.', 'Radio: WHAT WAS THAT? Did anybody else see that?'],
  whirlpool: ['Radio: Whirlpool forming. We should probably leave.', 'Radio: The sea is spinning. Repeat, the sea is SPINNING.'],
  meteor: ['Radio: Something just fell out of the sky into the sea!', 'Radio: Meteor down! The water where it landed is glowing!'],
  thief: ['Radio: Hey, is that Slippery Pete in YOUR boat?', 'Radio: Pete\'s nicked another boat. Somebody chase him.'],
};
