/* Noise.js - gradient noise for the shape of the islands.
   Deterministic from a seed so every client builds the same archipelago. */

const GRAD = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
  [0.9239, 0.3827], [-0.9239, 0.3827], [0.9239, -0.3827], [-0.9239, -0.3827],
  [0.3827, 0.9239], [-0.3827, 0.9239], [0.3827, -0.9239], [-0.3827, -0.9239],
];

const fade = t => t * t * t * (t * (t * 6 - 15) + 10);

export class Noise2D {
  constructor(seed = 1337) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = (seed >>> 0) || 1;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = 255; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  /** roughly [-1, 1] */
  noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255, P = this.perm;
    const g00 = GRAD[P[(P[X] + Y) & 255] & 15];
    const g10 = GRAD[P[(P[X + 1] + Y) & 255] & 15];
    const g01 = GRAD[P[(P[X] + Y + 1) & 255] & 15];
    const g11 = GRAD[P[(P[X + 1] + Y + 1) & 255] & 15];
    const n00 = g00[0] * xf + g00[1] * yf;
    const n10 = g10[0] * (xf - 1) + g10[1] * yf;
    const n01 = g01[0] * xf + g01[1] * (yf - 1);
    const n11 = g11[0] * (xf - 1) + g11[1] * (yf - 1);
    const u = fade(xf), v = fade(yf);
    const a = n00 + (n10 - n00) * u, b = n01 + (n11 - n01) * u;
    return (a + (b - a) * v) * 1.4;
  }

  fbm(x, y, oct = 4, gain = 0.5, lac = 2.03) {
    let amp = 1, f = 1, t = 0, n = 0;
    for (let i = 0; i < oct; i++) { t += this.noise(x * f, y * f) * amp; n += amp; amp *= gain; f *= lac; }
    return t / n;
  }

  ridged(x, y, oct = 4) {
    let amp = 1, f = 1, t = 0, n = 0, prev = 1;
    for (let i = 0; i < oct; i++) {
      let v = 1 - Math.abs(this.noise(x * f, y * f));
      v *= v; v *= prev; prev = v;
      t += v * amp; n += amp; amp *= 0.5; f *= 2.03;
    }
    return t / n;
  }
}
