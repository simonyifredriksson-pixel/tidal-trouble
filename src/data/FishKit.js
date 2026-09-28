/* FishKit.js - the shorthand the far-sea fish files are written in.

   F(zone, id, name, rarity, where, water, time, bait, kg, cm, value,
     [power, stamina, erratic, jump], art, blurb, more)
   exactly like FishMore. `zone` is the species' ZMIN; `more` can carry
   spot (only bites in that FISH_SPOTS circle), weather: 'storm', relic,
   hotspot, zoneOnly... */

export const FAR_ZMIN = {};
export const A = (o) => {
  const a = Object.assign({ h: 0.26, w: 0.12, back: 0x5a7a4a, belly: 0xd8d0a8, fin: 0x4a6a3a, pat: 'none', patCol: 0x2a3a2a, tail: 'fork', extras: [] }, o);
  // a ray's wings are measured in the fish frame: past this it would be shrunk to fit its length
  if (a.kind === 'ray') a.span = Math.min(a.span ?? 0.65, 0.8);
  return a;
};
export const F = (z, id, name, rarity, where, water, time, bait, kg, cm, value, f, art, blurb, more = {}) => {
  FAR_ZMIN[id] = z;
  return { id, name, rarity, where, water, time, bait, kg, cm, value, fight: { power: f[0], stamina: f[1], erratic: f[2], jump: f[3] }, art: A(art), blurb, ...more };
};
/* A relic: treasure out of a drowned place, sold for coin (twice as much in a Relic Satchel). */
export const R = (z, id, name, rarity, where, bait, kg, cm, value, junk, blurb, more = {}) => {
  FAR_ZMIN[id] = z;
  return { id, name, rarity, where, water: 'sea', time: 'any', bait, kg, cm, value, fight: { power: 0.4, stamina: 0.4, erratic: 0.1, jump: 0 }, beh: 'relic', junk, relic: true, art: A({}), blurb, ...more };
};
