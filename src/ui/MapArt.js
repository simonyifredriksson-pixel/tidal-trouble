/* MapArt.js - the painted map of the waters, drawn from the terrain and
   shared by the map screen and the great map on the guild hall wall.
   worldMapCanvas paints the whole sea; mapView paints any square window of
   it (the zoomed-in map), and fogCanvas is one pixel per chart square. */

import { heightAt, iceAt, ICE_Y } from '../world/Terrain.js';
import { regionAt, regionWeights, REGIONS, WORLD, PLACES, distHome } from '../world/MapData.js';

const cache = new Map();
const rgb = hex => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

/* land colours by island style: [beach, low, high] */
const LAND = {
  home: [[220, 200, 150], [95, 150, 65], [70, 110, 50]],
  frost: [[180, 185, 180], [200, 208, 210], [236, 242, 246]],
  tropic: [[236, 214, 160], [120, 178, 70], [96, 150, 60]],
  black: [[52, 56, 62], [52, 56, 62], [60, 64, 70]],
  woods: [[150, 140, 100], [40, 90, 45], [30, 70, 36]],
  volcanic: [[40, 36, 36], [70, 56, 50], [150, 60, 36]],
  cliff: [[150, 146, 136], [120, 150, 90], [176, 176, 168]],
  crystal: [[236, 232, 214], [150, 220, 226], [200, 246, 250]],
  swamp: [[96, 96, 70], [70, 90, 52], [58, 76, 46]],
  rust: [[150, 120, 90], [130, 90, 60], [110, 76, 56]],
  ghost: [[170, 166, 150], [120, 124, 108], [140, 140, 130]],
  storm: [[110, 110, 120], [80, 90, 100], [150, 150, 170]],
  tide: [[220, 206, 160], [100, 150, 90], [120, 140, 110]],
  ruins: [[226, 206, 150], [196, 172, 110], [220, 190, 110]],
  abyss: [[70, 60, 80], [60, 50, 76], [90, 80, 110]],
  reach: [[130, 130, 128], [100, 110, 96], [150, 150, 150]],
};

function colourAt(x, z, parchment) {
  const h = heightAt(x, z);
  const reg = REGIONS[regionAt(x, z)] || REGIONS.open;
  let col;
  if (h < 0) {
    // the further out and the deeper, the darker the blue
    const dp = Math.min(1, -h / 70);
    // tint the water by every region it belongs to, weighted, so no region has a hard edge
    const w = regionWeights(x, z), sea = [60, 140, 160], tint = [0, 0, 0];
    let tw = 0;
    for (const id in w) {
      if (!w[id]) continue;
      const R = REGIONS[id], rc = rgb(R.color), k = w[id] * (R.band ? 0.15 : id === 'home' ? 0.1 : 0.3);
      tint[0] += rc[0] * k; tint[1] += rc[1] * k; tint[2] += rc[2] * k; tw += k;
    }
    const kk = Math.min(0.6, tw);
    const far = 1 - 0.4 * Math.min(1, Math.max(0, (distHome(x, z) - 800) / 6000));
    col = sea.map((v, i) => (v * (1 - kk) + (tw ? tint[i] / tw : v) * kk) * (1 - dp * 0.45) * far);
    if (h < ICE_Y && iceAt(x, z)) col = [210, 232, 240];
    if (h > -1.5) col = col.map(v => v + 34);
  } else {
    const P = LAND[reg.style] || LAND.home;
    col = h < 1.3 ? P[0] : h > 14 ? P[2] : P[1];
    const shade = 1 + Math.min(0.25, h / 160);
    col = col.map(v => Math.min(255, v * shade));
  }
  if (parchment) {
    // sepia wash for the guild wall
    const g = (col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11);
    col = [g * 0.55 + 110, g * 0.5 + 88, g * 0.35 + 55];
    if (h >= 0) col = col.map(v => v * 0.8);
  }
  return col;
}

function paint(N, x0, z0, span, parchment, S) {
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const c = cv.getContext('2d');
  if (!c) return cv;
  const img = c.createImageData(N, N);
  for (let j = 0; j < N; j += S) for (let i = 0; i < N; i += S) {
    const x = x0 + (i + S / 2) / N * span, z = z0 + (j + S / 2) / N * span;
    const col = colourAt(x, z, parchment);
    for (let dj = 0; dj < S && j + dj < N; dj++) for (let di = 0; di < S && i + di < N; di++) {
      const k = ((j + dj) * N + i + di) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

export function worldMapCanvas(N = 720, parchment = false) {
  const key = N + ':' + parchment;
  if (cache.has(key)) return cache.get(key);
  const H = WORLD.half;
  const cv = paint(N, -H, -H, 2 * H, parchment, Math.max(2, Math.round(N / 360)));
  const c = cv.getContext('2d');
  if (c && parchment) {
    c.strokeStyle = 'rgba(60,40,20,0.25)'; c.lineWidth = 1;
    for (let k = 1; k < 8; k++) { c.beginPath(); c.moveTo(k * N / 8, 0); c.lineTo(k * N / 8, N); c.stroke(); c.beginPath(); c.moveTo(0, k * N / 8); c.lineTo(N, k * N / 8); c.stroke(); }
    if (N >= 512) {
      c.font = `700 ${Math.round(N / 50)}px Georgia, serif`; c.textAlign = 'center'; c.fillStyle = '#3a2410';
      for (const p of PLACES) if (p.kind === 'region' || p.kind === 'mystery') c.fillText(p.name, (p.x + H) / (2 * H) * N, (p.z + H) / (2 * H) * N);
    }
    c.strokeStyle = '#3a2410'; c.lineWidth = N / 120; c.strokeRect(N / 80, N / 80, N - N / 40, N - N / 40);
  }
  cache.set(key, cv);
  return cv;
}

/* A zoomed window of the sea. Windows snap to a grid so panning about
   reuses the ones already painted. */
const views = new Map();
export function mapView(cx, cz, span, N = 720) {
  const snap = span / 8;
  const x0 = Math.round((cx - span / 2) / snap) * snap, z0 = Math.round((cz - span / 2) / snap) * snap;
  const key = x0 + ':' + z0 + ':' + span + ':' + N;
  if (views.has(key)) { const v = views.get(key); views.delete(key); views.set(key, v); return v; }
  // painted one snap wider on every side, so a window dragged half a snap off still has ground under it
  const m = N / 8;
  const v = { cv: paint(N + 2 * m, x0 - snap, z0 - snap, span + 2 * snap, false, Math.max(2, Math.round(N / 300))), x0: x0 - snap, z0: z0 - snap, span };
  views.set(key, v);
  if (views.size > 8) views.delete(views.keys().next().value);
  return v;
}

/* The fog: one pixel per chart square, opaque where nobody has been.
   Scaled up with smoothing it gives the unknown a soft edge. */
let fogCv = null;
export function fogCanvas(isles, CHART_N, CHART_CELL, knownR) {
  if (!fogCv) { fogCv = document.createElement('canvas'); fogCv.width = CHART_N; fogCv.height = CHART_N; }
  const c = fogCv.getContext('2d');
  if (!c) return fogCv;
  const img = c.createImageData(CHART_N, CHART_N);
  for (let iz = 0; iz < CHART_N; iz++) for (let ix = 0; ix < CHART_N; ix++) {
    const x = -WORLD.half + (ix + 0.5) * CHART_CELL, z = -WORLD.half + (iz + 0.5) * CHART_CELL;
    const known = distHome(x, z) < knownR || (isles && isles.chartedCell(ix, iz));
    const k = (iz * CHART_N + ix) * 4;
    // a little grain in the fog so it reads as paper, not a hole
    const n = ((ix * 73856093) ^ (iz * 19349663)) & 5;
    img.data[k] = 30 + n; img.data[k + 1] = 40 + n; img.data[k + 2] = 52 + n; img.data[k + 3] = known ? 0 : 255;
  }
  c.putImageData(img, 0, 0);
  return fogCv;
}

export const toMap = (x, z, N) => [(x + WORLD.half) / (2 * WORLD.half) * N, (z + WORLD.half) / (2 * WORLD.half) * N];
export { PLACES };
