// _probe.mjs - print a height map around a point (for placing things).
// tools\run.ps1 _probe.mjs x z halfSize step
const { heightAt } = await import('../src/world/Terrain.js');
const [x0, z0, R, S] = process.argv.slice(2).map(Number);
const chars = h => h < -6 ? '~' : h < -2 ? '-' : h < 0 ? '.' : h < 1 ? ',' : h < 2 ? ':' : h < 4 ? '+' : h < 8 ? '*' : h < 16 ? '#' : '@';
let head = '      ';
for (let x = x0 - R; x <= x0 + R; x += S) head += (Math.round(x) % (S * 5) === 0 ? '|' : ' ');
console.log(head);
for (let z = z0 - R; z <= z0 + R; z += S) {
  let row = String(Math.round(z)).padStart(5) + ' ';
  for (let x = x0 - R; x <= x0 + R; x += S) row += chars(heightAt(x, z));
  console.log(row);
}
