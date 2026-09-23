/* MapArt.js - the painted map of the waters, drawn once from the terrain
   and shared by the map screen and the great map on the guild hall wall. */

import { heightAt, iceAt, ICE_Y } from '../world/Terrain.js?v=1790183165';
import { regionAt, WORLD, PLACES } from '../world/MapData.js?v=1790183165';

const cache = new Map();

export function worldMapCanvas(N = 720, parchment = false) {
  const key = N + ':' + parchment;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const c = cv.getContext('2d');
  if (!c) return cv;
  const H = WORLD.half;
  const img = c.createImageData(N, N);
  const S = Math.max(2, Math.round(N / 240));
  for (let j = 0; j < N; j += S) for (let i = 0; i < N; i += S) {
    const x = -H + (i + S / 2) / N * 2 * H, z = -H + (j + S / 2) / N * 2 * H;
    const h = heightAt(x, z);
    const reg = regionAt(x, z);
    let col;
    if (h < 0) {
      const dp = Math.min(1, -h / 30);
      col = reg === 'black' ? [14, 20, 28] : reg === 'tropic' ? [40 - dp * 20, 170 - dp * 90, 180 - dp * 60] : reg === 'frost' ? [110 - dp * 60, 150 - dp * 70, 170 - dp * 60] : [50 - dp * 30, 120 - dp * 60, 140 - dp * 50];
      if (h < ICE_Y && iceAt(x, z)) col = [210, 232, 240];
      if (h > -1.5) col = col.map(v => v + 30);
    } else {
      col = reg === 'frost' ? (h > 3 ? [236, 242, 246] : [180, 185, 180]) : reg === 'tropic' ? (h < 2 ? [236, 214, 160] : [120, 178, 70]) : reg === 'black' ? [52, 56, 62] : (h < 1.3 ? [220, 200, 150] : h > 14 ? [70, 110, 50] : [95, 150, 65]);
      const shade = 1 + Math.min(0.25, h / 120);
      col = col.map(v => Math.min(255, v * shade));
    }
    if (parchment) {
      // sepia wash for the guild wall
      const g = (col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11);
      col = [g * 0.55 + 110, g * 0.5 + 88, g * 0.35 + 55];
      if (h >= 0) col = col.map(v => v * 0.8);
    }
    for (let dj = 0; dj < S; dj++) for (let di = 0; di < S; di++) {
      const k = ((j + dj) * N + i + di) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  if (parchment) {
    c.strokeStyle = 'rgba(60,40,20,0.25)'; c.lineWidth = 1;
    for (let k = 1; k < 8; k++) { c.beginPath(); c.moveTo(k * N / 8, 0); c.lineTo(k * N / 8, N); c.stroke(); c.beginPath(); c.moveTo(0, k * N / 8); c.lineTo(N, k * N / 8); c.stroke(); }
    c.font = `700 ${Math.round(N / 42)}px Georgia, serif`; c.textAlign = 'center'; c.fillStyle = '#3a2410';
    for (const p of PLACES) c.fillText(p.name, (p.x + H) / (2 * H) * N, (p.z + H) / (2 * H) * N);
    c.strokeStyle = '#3a2410'; c.lineWidth = N / 120; c.strokeRect(N / 80, N / 80, N - N / 40, N - N / 40);
  }
  cache.set(key, cv);
  return cv;
}

export const toMap = (x, z, N) => [(x + WORLD.half) / (2 * WORLD.half) * N, (z + WORLD.half) / (2 * WORLD.half) * N];
