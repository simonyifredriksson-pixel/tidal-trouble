# Hooked

A chaotic low-poly fishing adventure for 1-4 players, in the browser.

Go fishing. Catch weird things. Sail farther out. Try not to get eaten.

- It starts at sea, in a storm, on the night something enormous comes up out of the water and takes your boat apart. You wake on the beach at Driftwood Bay with Old Gus standing over you. Ask him what happened - and why nobody just sails away.
- The charts say the sea ends at the fog. It does not. Keep going and you find out what Gus meant: something past the edge of the world that cannot be fought, caught or outrun.
- Chop trees with the axe (0) and break rock with the pickaxe (-): trees really fall, rocks really break, and what comes off lands at your feet. Open the Blueprint Book (=), lay a plan out on the ground, and build it piece by piece - hold a material (G), walk to a blue ghost piece, press E. Campfires, chests, bait stations, jetties, shelters, watchtowers. The whole crew builds the same blueprint together.

- First-person fishing with a physical rod: cast, wait, strike, then fight the fish on the catch bar. Bigger, rarer and pricier fish always fight harder.
- A huge sea in rings: the Inner waters round Driftwood Bay, then the Mid-Ocean, the Outer Ocean, the Extreme Waters and, at the very edge of the world, Vigil's End. Every ring out has rougher weather, stronger currents, darker water and bigger, rarer fish.
- Twelve far islands to find, each with its own people, shops and something nobody else has: Whispering Woods (hidden lakes, and something between the trees at night), Sunscar (a live volcano), Skywatch (fishing from a ninety-metre cliff), the Crystal Reef (a lagoon that glows at night), Frostfall (the only Ice Auger in the sea), Dreadmire (swamp channels to take the boat through), Ironwreck (salvage and cheap repairs), the Lost Shores (notes left by people who vanished), Thunderpeak (fish that only bite in lightning), Tidebreaker (the fastest currents), the Sunken Crown (a drowned city full of relics) and the Abyssal Reach (the deepest water, and the biggest fish that are not leviathans).
- A map you fill in yourself: only the home waters are charted at first. Zoom from the whole sea down to close up, drag to look around, and buy Current Charts to see which way the water runs. The Old Compass points at the nearest island you have never set foot on.
- Around 900 species, 40 to 56 in every part of the sea, from sprats to things nobody has named. Not just fish: squid, cuttlefish, octopus, crabs, lobsters, shrimp, jellyfish, seahorses, rays, urchins, starfish, nautilus and turtles, each with its own model - and relics from drowned ships and cities.
- Twelve boats, each with its own speed, handling, hull, cargo, wave rating, stability, deep-water rating and repair cost. The best hulls are only sold at the far islands, and the Leviathan Hunter at Vigil's End is the best boat in the sea - nothing beats it.
- Currents and wind push a boat that nobody is steering. Throw the anchor over, let it bite, and haul it back up at the windlass. Better anchors hold in stronger water.
- Conversations, not shop windows: every island has its own fish seller, rods, bait and gear, and some of it is sold nowhere else.
- Right-click a fish to make it a favourite. Favourites are never sold.
- A small hut on the cove with Pim's fish stall at the door and your own dock. Inside: a bed, a stove, a rod rack and a trophy bookcase that always shows your grandest trophies. The journal lists every one you have earned.
- Vigil's End: fog, a rock field, six old fishermen - and, very rarely, one of three Great Leviathans.
- The Kraken: no warning, three arms over the rail, an axe, and then the hardest fish in the game.
- Twelve shard-bearing leviathans behind chains of clues, ten ocean beasts, giants, storms, migrations, whirlpools, meteors and a boat thief called Pete.
- Co-op for up to four players over WebRTC (PeerJS): shared boat and purse, text chat (tap CTRL) and voice chat - nearby by default, hold C for the walkie-talkie.

Everything - terrain, trees, buildings, characters, fish, boats, rods, trophies, leviathans, icons and sound - is generated in code. There are no asset files and no emoji.

After changing any .js file, run `node tools/stamp.mjs`: it stamps a version on every module in index.html so browsers never keep running old copies of the code.

Controls: WASD move, mouse look, hold left mouse to cast / reel, click to strike, E interact / talk / anchor, 1-9 pick an answer, F pick up, RMB favourite, TAB your catch, 1-9 and 0 tools, B bait, J journal, M map (scroll to zoom, drag to pan), CTRL chat, C walkie-talkie, V mute.
