/* Util.js - small maths and randomness helpers shared by everything.
   Deterministic randomness matters here: the world, every tree and every
   island is rebuilt from a seed on each load, so two players in the same
   co-op room stand in exactly the same forest without sending it over the
   wire. */

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const saturate = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a, b, v) => {
  const t = saturate((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const smootherstep = t => t * t * t * (t * (t * 6 - 15) + 10);
export const damp = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));
export const wrapAngle = a => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
export const dampAngle = (cur, target, rate, dt) => cur + wrapAngle(target - cur) * (1 - Math.exp(-rate * dt));
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/** 32-bit integer hash of up to three ints. Returns 0..1. */
export function hash3(x, y, z = 0) {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Hash a string to a uint32 seed. */
export function strSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/** Small fast seeded RNG (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a0, b0) => a0 + (b0 - a0) * f();
  f.int = (a0, b0) => Math.floor(a0 + (b0 - a0 + 1) * f());
  f.pick = arr => arr[Math.floor(f() * arr.length) % arr.length];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  f.chance = p => f() < p;
  return f;
}

/** Weighted pick from [{w, ...}] or with a weight function. */
export function weighted(list, r, wf = o => o.w) {
  let total = 0;
  for (const o of list) total += Math.max(0, wf(o));
  if (total <= 0) return null;
  let x = r() * total;
  for (const o of list) {
    x -= Math.max(0, wf(o));
    if (x <= 0) return o;
  }
  return list[list.length - 1];
}

export const fmtInt = n => Math.round(n).toLocaleString('en-US');
export const fmtKg = kg => (kg >= 100 ? Math.round(kg) + ' kg' : kg >= 10 ? kg.toFixed(1) + ' kg' : kg.toFixed(2) + ' kg');
export const fmtCm = cm => (cm >= 100 ? (cm / 100).toFixed(2) + ' m' : Math.round(cm) + ' cm');
export const fmtTime = s => {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
};

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let _uid = 1;
export const uid = (p = 'o') => p + (_uid++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
