// check_models.mjs - build the model of every species and check the geometry:
// no NaN, a sensible triangle count, and a size close to the fish frame
// (about one unit long) so it scales to the catch correctly.
//   node tools/check_models.mjs
globalThis.document = { createElement: () => ({ getContext: () => null, width: 0, height: 0 }) };
globalThis.window = globalThis;
const { FISH, GIANTS } = await import('../src/data/FishData.js');
const { fishGeos } = await import('../src/art/FishArt.js');
const { LEVIATHANS } = await import('../src/data/LeviathanData.js');
const { buildLeviathan } = await import('../src/art/CreatureArt.js');

const bad = [];
const sizes = [];
for (const f of [...FISH, ...GIANTS]) {
  let g;
  try { g = fishGeos(f); } catch (e) { bad.push(f.id + ' threw ' + e.message); continue; }
  for (const [k, geo] of Object.entries(g)) {
    if (!geo) continue;
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) { bad.push(`${f.id}.${k} has NaN`); break; }
    if (k === 'solid' && p.length / 9 < 40) bad.push(`${f.id} has only ${p.length / 9} triangles`);
  }
  const bb = g.solid.boundingBox;
  const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
  const big = Math.max(sx, sy, sz);
  sizes.push([f.id, g.solid.attributes.position.count / 3, big.toFixed(2)]);
  if (!f.junk && (big < 0.5 || big > 2.4)) bad.push(`${f.id} is ${big.toFixed(2)} units across (${sx.toFixed(2)} x ${sy.toFixed(2)} x ${sz.toFixed(2)})`);
}
for (const L of LEVIATHANS) { try { buildLeviathan(L); } catch (e) { bad.push('leviathan ' + L.id + ' threw ' + e.message); } }
const kinds = {};
for (const f of FISH) { const k = f.art?.kind || (f.junk ? 'junk' : 'fish'); kinds[k] = (kinds[k] || 0) + 1; }
console.log('models built:', sizes.length, 'kinds:', JSON.stringify(kinds));
console.log('triangles: min', Math.min(...sizes.map(s => s[1])), 'max', Math.max(...sizes.map(s => s[1])));
console.log(bad.length ? 'PROBLEMS:\n' + bad.join('\n') : 'all models ok');
