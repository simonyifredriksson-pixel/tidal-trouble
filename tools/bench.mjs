// bench.mjs - time world generation on the real CPU (no browser, no GPU).
// Run: tools\run.ps1 bench.mjs
globalThis.document = { createElement: () => ({ getContext: () => null, width: 0, height: 0 }) };
globalThis.window = globalThis;
globalThis.performance = globalThis.performance || { now: () => Date.now() };
const THREE = await import('../lib/three.module.js');
const { World } = await import('../src/world/World.js');
const T = () => performance.now();
const scene = new THREE.Scene();
const w = new World(scene);
let t = T(), last = t;
await w.build(async label => { const n = T(); console.log(label.padEnd(26), Math.round(n - last), 'ms'); last = n; });
console.log('last step'.padEnd(26), Math.round(T() - last), 'ms');
last = T();
w.prebuild(20, 180);
console.log('prebuild (near terrain)'.padEnd(26), Math.round(T() - last), 'ms');
console.log('TOTAL'.padEnd(26), Math.round(T() - t), 'ms', 'flora', w.flora.count, 'chunks', w.terrain.chunks.size);
last = T();
for (let i = 0; i < 10; i++) w.terrain.update(20 + i * 30, 180, 1e9);
console.log('stream 300m of terrain'.padEnd(26), Math.round(T() - last), 'ms');
