// count_fish.mjs - how many entries each part of the sea has in the journal,
// split by rarity, plus sanity checks on every species.
//   node tools/count_fish.mjs
const { SECTIONS, sectionEntries } = await import('../src/data/JournalData.js');
const { FISH, FISH_BY_ID, ZMIN, fightOf, fishValue, midKg } = await import('../src/data/FishData.js');
const { RODS } = await import('../src/data/GearData.js');

const R = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'giant', 'junk'];
for (const S of SECTIONS) {
  const es = sectionEntries(S).filter(e => e.type === 'fish');
  const by = {};
  for (const e of es) { const r = FISH_BY_ID[e.id].rarity; by[r] = (by[r] || 0) + 1; }
  console.log(S.id.padEnd(8), String(es.length).padStart(3), R.filter(r => by[r]).map(r => r + ' ' + by[r]).join(', '));
}

// sanity: unique ids, every field present, a rod that can hold the biggest one
const ids = new Set(); const bad = [];
const maxRod = Math.max(...RODS.map(r => r.rating));
for (const f of FISH) {
  if (ids.has(f.id)) bad.push('duplicate id ' + f.id);
  ids.add(f.id);
  for (const k of ['name', 'rarity', 'where', 'water', 'time', 'bait', 'kg', 'cm', 'value', 'fight', 'art', 'blurb']) if (f[k] === undefined) bad.push(f.id + ' missing ' + k);
  if (f.junk) continue;
  if (ZMIN[f.id] === undefined) bad.push(f.id + ' has no ZMIN');
  const worst = fightOf(f, f.kg[1] * 1.65, 'abyssal');
  const typical = fightOf(f, midKg(f));
  if (typical > maxRod - 0.1) bad.push(`${f.id} typical fight ${typical.toFixed(2)} beats every rod`);
  if (worst > 4.4) bad.push(`${f.id} worst-case fight ${worst.toFixed(2)}`);
}
console.log('species', FISH.length, bad.length ? '\nPROBLEMS:\n' + bad.join('\n') : 'all ok');
void fishValue;
