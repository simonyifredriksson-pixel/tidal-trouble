// _find.mjs - find sea-floor spots in a depth band inside a box.
// tools\run.ps1 _find.mjs x0 z0 x1 z1 minDepth maxDepth
const { heightAt } = await import('../src/world/Terrain.js');
const [x0, z0, x1, z1, lo, hi] = process.argv.slice(2).map(Number);
const out = [];
for (let x = x0; x <= x1; x += 10) for (let z = z0; z <= z1; z += 10) {
  const d = -heightAt(x, z);
  if (d >= lo && d <= hi) { let flat = 0; for (const [a, b] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) flat = Math.max(flat, Math.abs(-heightAt(x + a, z + b) - d)); if (flat < 1.2) out.push([x, z, d.toFixed(1), flat.toFixed(2)]); }
}
console.log(out.length, 'spots'); console.log(out.slice(0, 25).map(a => a.join(' ')).join('\n'));
