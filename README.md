# Hooked

A chaotic low-poly fishing adventure for 1-4 players, in the browser.

Go fishing. Catch weird things. Sail farther out. Try not to get eaten.

- First-person fishing with a physical rod: cast, wait, strike, then fight the fish on the catch bar. Bigger, rarer and pricier fish always fight harder.
- A small hut on the cove with Pim's fish stall at the door and your own dock. Inside: a bed, a stove, a rod rack and a trophy bookcase that fills up with real objects as you play.
- Conversations, not shop windows: every island has its own fish seller and its own rods. Nine rods, each built as its own model.
- Right-click a fish to make it a favourite. Favourites are never sold.
- Around 300 species - 43 to 54 in every part of the sea: Driftwood Bay, Frostbite Lake, the Sunken Coast, the Open Sea, the Blackwater, the Kraken's Water and Vigil's End. Not just fish: squid, cuttlefish, octopus, crabs, lobsters, shrimp, jellyfish, seahorses, rays, urchins, starfish, nautilus and turtles, each with its own model.
- A trophy bookcase that always shows your grandest trophies, and a Trophies page in the journal that lists every one you have earned.
- Vigil's End: the last island before the edge of the sea. Fog, a rock field, six old fishermen - and, very rarely, one of three Great Leviathans.
- The Kraken: no warning, three arms over the rail, an axe, and then the hardest fish in the game.
- Twelve shard-bearing leviathans behind chains of clues, giants, storms, migrations, whirlpools, meteors and a boat thief called Pete.
- Co-op for up to four players over WebRTC (PeerJS): shared boat and purse, text chat (tap CTRL) and voice chat - nearby by default, hold C for the walkie-talkie.

Everything - terrain, trees, buildings, characters, fish, boats, rods, trophies, leviathans, icons and sound - is generated in code. There are no asset files and no emoji.

After changing any .js file, run `node tools/stamp.mjs`: it stamps a version on every module in index.html so browsers never keep running old copies of the code.

Controls: WASD move, mouse look, hold left mouse to cast / reel, click to strike, E interact / talk, 1-9 pick an answer, F pick up, RMB favourite, TAB your catch, 1-9 and 0 tools, B bait, J journal, M map, CTRL chat, C walkie-talkie, V mute.
