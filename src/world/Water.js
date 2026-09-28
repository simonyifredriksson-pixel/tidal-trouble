/* Water.js - the sea. One faceted, flat-shaded surface for every body of
   water in the game.

   THE SURFACE IS THE SAME FUNCTION THE BOAT FLOATS ON. The GLSL below is a
   line-for-line mirror of waveAmp / waveHeight in MapData.js. Change one and
   you must change the other, or boats hover over troughs and sink into
   crests.

   The grid is piecewise-uniform: 2 m cells near the camera, 16 m far out.
   Every vertex coordinate is a multiple of its own spacing and the grid is
   snapped to 16 m, so no vertex ever slides across the wave field as the
   camera moves - the facets stay put instead of swimming.

   Colour comes from depth, sampled out of a heightmap texture of the
   terrain: turquoise over sand, deep blue in the open, near-black in the
   Blackwater, with foam where the water is thin. */

import * as THREE from '../../lib/three.module.js';
import { heightAt } from './Terrain.js';
import { LAKES, WORLD, WAVE_SPOTS, REGIONS, SHELTERS } from './MapData.js';

/* The depth texture no longer covers the whole world (15 km would be 20 m a
   pixel): it is a 1.6 km square that follows the camera, rebuilt a few rows
   a frame in the background whenever you have sailed far enough. */
const TEX_N = 512;
const TEX_HALF = 800;
/** A JS number as an exact GLSL float literal (the wave field must match to the digit). */
const f1 = v => { const s = String(+v); return /[.e]/.test(s) ? s : s + '.0'; };

/* Water colour per region: [deep rgb, shallow rgb]. */
const TINTS = {
  frost: [[0.030, 0.100, 0.140], [0.200, 0.420, 0.470]],
  tropic: [[0.004, 0.170, 0.260], [0.120, 0.700, 0.620]],
  black: [[0.002, 0.004, 0.008], [0.012, 0.030, 0.040]],
  whisper: [[0.020, 0.090, 0.090], [0.080, 0.300, 0.220]],
  sunscar: [[0.030, 0.070, 0.090], [0.200, 0.300, 0.270]],
  skywatch: [[0.010, 0.120, 0.200], [0.100, 0.450, 0.500]],
  crystal: [[0.010, 0.250, 0.350], [0.250, 0.850, 0.850]],
  frostfall: [[0.030, 0.100, 0.140], [0.220, 0.460, 0.520]],
  dread: [[0.020, 0.035, 0.018], [0.100, 0.130, 0.060]],
  ironwreck: [[0.030, 0.065, 0.075], [0.180, 0.220, 0.180]],
  lost: [[0.030, 0.055, 0.065], [0.140, 0.200, 0.200]],
  thunder: [[0.010, 0.030, 0.060], [0.080, 0.140, 0.200]],
  tide: [[0.000, 0.120, 0.220], [0.100, 0.550, 0.600]],
  crown: [[0.010, 0.140, 0.180], [0.200, 0.550, 0.450]],
  abyssal: [[0.000, 0.000, 0.010], [0.030, 0.020, 0.060]],
};
function tintGLSL() {
  let s = '';
  for (const k in TINTS) {
    const R = REGIONS[k], [d, sh] = TINTS[k];
    const r0 = k === 'black' ? 240 : R.r * 0.55;
    s += `{ float w = 1.0 - sstep(${f1(r0)}, ${f1(R.r)}, length(p - vec2(${f1(R.x)}, ${f1(R.z)})));
      deep = mix(deep, vec3(${d.join(', ')}), w); shal = mix(shal, vec3(${sh.join(', ')}), w); }\n`;
  }
  return s;
}
function spotGLSL() {
  return WAVE_SPOTS.map(S => `a += ${f1(S.a)} * (1.0 - sstep(${f1(S.r0)}, ${f1(S.r1)}, length(p - vec2(${f1(S.x)}, ${f1(S.z)}))));`).join('\n  ');
}

function axisList() {
  const out = [];
  const push = v => { if (!out.length || Math.abs(out[out.length - 1] - v) > 1e-6) out.push(v); };
  const segs = [[-800, -400, 16], [-400, -160, 8], [-160, -60, 4], [-60, 60, 2], [60, 160, 4], [160, 400, 8], [400, 800, 16]];
  for (const [a, b, s] of segs) for (let v = a; v <= b + 1e-6; v += s) push(v);
  return out;
}

function lakeGLSL() {
  let s = '';
  for (const L of LAKES) {
    const lo = L.ice ? '0.0' : L.sea ? '0.55' : '0.3';
    s += `{ float d = length(p - vec2(${L.x.toFixed(1)}, ${L.z.toFixed(1)}));
      a *= ${lo} + (1.0 - ${lo}) * sstep(${(L.r * 0.8).toFixed(2)}, ${(L.r * 1.5).toFixed(2)}, d); }\n`;
  }
  return s;
}

const WAVE_GLSL = `
uniform float uTime;
uniform float uStorm;
uniform vec4 uWp;
float sstep(float a, float b, float v) { float t = clamp((v - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float waveAmp(vec2 p) {
  float dHome = length(p - vec2(0.0, 60.0));
  float a = 0.16 + 0.22 * sstep(230.0, 700.0, dHome);
  a += 1.15 * sstep(-380.0, -820.0, p.x) * (1.0 - sstep(560.0, 760.0, length(p - vec2(-680.0, 820.0))) * 0.4) * (1.0 - sstep(1600.0, 2600.0, dHome));
  a += 0.55 * sstep(1500.0, 3000.0, dHome) + 0.5 * sstep(3000.0, 4600.0, dHome) + 0.55 * sstep(4600.0, 6500.0, dHome);
  ${spotGLSL()}
  a += 2.4 * sstep(${f1(WORLD.edge - 500)}, ${f1(WORLD.edge)}, dHome);
  a += 1.6 * sstep(${f1(WORLD.edge)}, ${f1(WORLD.edge + 1200)}, dHome);
  ${SHELTERS.map(S => `a *= 0.32 + 0.68 * sstep(${f1(S.r0)}, ${f1(S.r1)}, length(p - vec2(${f1(S.x)}, ${f1(S.z)})));`).join('\n  ')}
  ${lakeGLSL()}
  return a;
}
float waveH(vec2 p, float t) {
  float a = waveAmp(p) * uStorm;
  float h = a * (
    0.55 * sin(0.071 * p.x + 0.052 * p.y + 1.10 * t) +
    0.30 * sin(-0.043 * p.x + 0.110 * p.y + 1.63 * t + 1.7) +
    0.15 * sin(0.190 * p.x - 0.130 * p.y + 2.40 * t + 0.5));
  h += 0.035 * sin(0.61 * p.x + 0.43 * p.y + 3.1 * t) * min(1.0, a * 3.0);
  h += 0.06 * sin(0.33 * p.x - 0.27 * p.y + 2.7 * t) * min(1.0, a * 4.0);
  if (uWp.w > 0.0) {
    float d = length(p - uWp.xy);
    if (d < uWp.z) { float f = 1.0 - d / uWp.z; h -= uWp.w * f * f * 6.0; }
  }
  return h;
}
`;

const VERT = `
${WAVE_GLSL}
varying vec3 vW;
varying float vAmp;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float h = waveH(wp.xz, uTime);
  wp.y += h;
  vW = wp.xyz;
  vAmp = waveAmp(wp.xz) * uStorm;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = `
uniform float uTime;
uniform vec4 uWp;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform vec3 uSky;
uniform sampler2D uHeight;
uniform float uTexHalf;
uniform vec2 uTexCentre;
uniform vec4 uGlow;
uniform float uNight;
varying vec3 vW;
varying float vAmp;
#include <fog_pars_fragment>
float sstep(float a, float b, float v) { float t = clamp((v - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  if (n.y < 0.0) n = -n;
  vec2 uv = (vW.xz - uTexCentre + uTexHalf) / (2.0 * uTexHalf);
  float inTex = step(0.001, uv.x) * step(uv.x, 0.999) * step(0.001, uv.y) * step(uv.y, 0.999);
  float ground = mix(-60.0, texture2D(uHeight, uv).r * 60.0 - 45.0, inTex);
  float depth = vW.y - ground;
  vec2 p = vW.xz;
  float dHome = length(p - vec2(0.0, 80.0));

  // region tint (same centres as MapData.REGIONS), and the sea darkens the farther out you go
  float wBlack = 1.0 - sstep(240.0, 440.0, length(p - vec2(-680.0, 820.0)));
  float wOpen = sstep(-360.0, -760.0, p.x) * (1.0 - wBlack) * (1.0 - sstep(1500.0, 2500.0, dHome));
  vec3 deep = vec3(0.020, 0.140, 0.190);
  vec3 shal = vec3(0.090, 0.420, 0.400);
  deep = mix(deep, vec3(0.008, 0.060, 0.120), wOpen);   shal = mix(shal, vec3(0.040, 0.230, 0.320), wOpen);
  deep = mix(deep, vec3(0.012, 0.075, 0.130), sstep(1500.0, 3000.0, dHome));
  deep = mix(deep, vec3(0.006, 0.030, 0.060), sstep(3000.0, 6500.0, dHome));
  ${tintGLSL()}
  float wReach = 1.0 - sstep(260.0, 720.0, length(p - vec2(${f1(REGIONS.reach.x)}, ${f1(REGIONS.reach.z)})));
  deep = mix(deep, vec3(0.018, 0.032, 0.040), wReach);  shal = mix(shal, vec3(0.080, 0.130, 0.135), wReach);
  float wCrys = 1.0 - sstep(120.0, 210.0, length(p - vec2(700.0, 2650.0)));

  float shallow = 1.0 - sstep(0.0, 9.0, depth);
  vec3 col = mix(deep, shal, shallow);

  // lighting on the facet
  float dif = max(dot(n, uSunDir), 0.0);
  vec3 V = normalize(cameraPosition - vW);
  vec3 R = reflect(-uSunDir, n);
  float spec = pow(max(dot(R, V), 0.0), 60.0) * (1.0 - uNight * 0.85);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  float facet = 0.94 + 0.12 * hash(floor(vW.xz * 0.5) + floor(uTime * 0.0));
  col = col * (uAmb * 1.0 + uSunCol * dif * 0.75) * facet;
  col = mix(col, uSky * 0.8, fres * 0.28);
  col += uSunCol * spec * 0.9;

  // foam: thin water and wave crests
  float shore = 1.0 - sstep(0.05, 1.2 + 0.4 * sin(uTime * 1.3 + p.x * 0.2 + p.y * 0.13), depth);
  float crest = sstep(0.62, 0.95, (vW.y) / max(vAmp, 0.05)) * sstep(0.35, 1.0, vAmp);
  float speck = step(0.78, hash(floor(p * 0.9)));
  float foam = clamp(shore * (0.55 + 0.45 * speck) + crest * speck * 0.8, 0.0, 1.0);
  col = mix(col, vec3(0.85, 0.92, 0.95) * (uAmb + uSunCol * 0.5), foam * 0.75);

  // the Crystal Lagoon glows at night: light from the spires down in the water
  if (wCrys > 0.0) col += vec3(0.10, 0.55, 0.65) * wCrys * uNight * (0.35 + 0.25 * sin(uTime * 0.7 + p.x * 0.05) * sin(p.y * 0.07 + uTime * 0.4)) * (1.0 - sstep(0.0, 8.0, depth) * 0.4);
  // whirlpool streaks
  if (uWp.w > 0.0) {
    vec2 dv = p - uWp.xy; float d = length(dv);
    if (d < uWp.z) {
      float ang = atan(dv.y, dv.x);
      float s = sin(ang * 6.0 + d * 0.25 - uTime * 3.0 * uWp.w);
      col = mix(col, vec3(0.8, 0.9, 0.95), sstep(0.7, 1.0, s) * (1.0 - d / uWp.z) * 0.7);
    }
  }
  // meteor glow
  if (uGlow.w > 0.0) {
    float d = length(p - uGlow.xy);
    float g = (1.0 - sstep(0.0, uGlow.z, d)) * uGlow.w;
    col += vec3(0.35, 0.55, 1.0) * g * (0.7 + 0.3 * sin(uTime * 4.0 + d * 0.5));
  }

  float alpha = mix(0.93, 0.55, shallow * shallow);
  alpha = max(alpha, foam * 0.9);
  if (!gl_FrontFacing) { col = mix(deep, shal, 0.3) * 0.7; alpha = 0.9; }
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export class Water {
  constructor(scene) {
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uStorm: { value: 1 },
        uWp: { value: new THREE.Vector4(0, 0, 0, 0) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
        uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
        uAmb: { value: new THREE.Color(0.4, 0.45, 0.5) },
        uSky: { value: new THREE.Color(0.6, 0.75, 0.9) },
        uHeight: { value: null },
        uTexHalf: { value: TEX_HALF },
        uTexCentre: { value: new THREE.Vector2(0, 0) },
        uGlow: { value: new THREE.Vector4(0, 0, 0, 0) },
        uNight: { value: 0 },
      },
    ]);
    this.uniforms.uHeight.value = this._heightTex();
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      fog: true,
      side: THREE.DoubleSide,
      depthWrite: true,
      extensions: { derivatives: true },
    });
    this.mesh = new THREE.Mesh(this._grid(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.name = 'water';
    scene.add(this.mesh);

    // a flat far sheet under the edge of the grid, out to the horizon
    const far = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x1b4a5e, fog: true }));
    far.position.y = -1.2;
    far.renderOrder = 1;
    far.name = 'farsea';
    this.far = far;
    scene.add(far);
  }

  _grid() {
    const ax = axisList();
    const n = ax.length;
    const pos = new Float32Array(n * n * 3);
    let k = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { pos[k++] = ax[i]; pos[k++] = 0; pos[k++] = ax[j]; }
    const idx = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      if ((i + j) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  _heightTex() {
    this.texData = new Uint8Array(TEX_N * TEX_N);
    const t = new THREE.DataTexture(this.texData, TEX_N, TEX_N, THREE.RedFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    this.tex = t;
    this.job = null;
    this.rebuild(0, 0, true);
    return t;
  }

  /** Re-centre the depth texture on (cx, cz): all at once, or a few rows a frame. */
  rebuild(cx, cz, now = false) {
    // snap the centre to whole texels so the depth colours do not crawl as it moves
    const px = 2 * TEX_HALF / TEX_N;
    cx = Math.round(cx / px) * px; cz = Math.round(cz / px) * px;
    this.job = { cx, cz, row: 0, data: now ? this.texData : new Uint8Array(TEX_N * TEX_N) };
    if (now) this._work(1e9);
  }
  _work(budgetMs) {
    const J = this.job;
    if (!J) return;
    const t0 = performance.now();
    while (J.row < TEX_N) {
      const j = J.row++;
      const z = J.cz - TEX_HALF + (j + 0.5) / TEX_N * 2 * TEX_HALF;
      for (let i = 0; i < TEX_N; i++) {
        const x = J.cx - TEX_HALF + (i + 0.5) / TEX_N * 2 * TEX_HALF;
        J.data[j * TEX_N + i] = Math.max(0, Math.min(255, Math.round((heightAt(x, z) + 45) / 60 * 255)));
      }
      if (performance.now() - t0 > budgetMs) break;
    }
    if (J.row >= TEX_N) {
      this.texData.set(J.data);
      this.tex.needsUpdate = true;
      this.uniforms.uTexCentre.value.set(J.cx, J.cz);
      this.centre = { x: J.cx, z: J.cz };
      this.job = null;
    }
  }

  update(dt, camPos, time, storm, wp, glow, light) {
    // keep the depth map under the camera
    if (this.job) this._work(2.5);
    else if (Math.hypot(camPos.x - this.centre.x, camPos.z - this.centre.z) > TEX_HALF * 0.35) this.rebuild(camPos.x, camPos.z);
    const s = 16;
    this.mesh.position.set(Math.round(camPos.x / s) * s, 0, Math.round(camPos.z / s) * s);
    this.far.position.x = camPos.x; this.far.position.z = camPos.z;
    const u = this.uniforms;
    u.uTime.value = time;
    u.uStorm.value = storm;
    if (wp) u.uWp.value.set(wp.x, wp.z, wp.r, wp.s); else u.uWp.value.w = 0;
    if (glow) u.uGlow.value.set(glow.x, glow.z, glow.r, glow.s); else u.uGlow.value.w = 0;
    if (light) {
      u.uSunDir.value.copy(light.sunDir);
      u.uSunCol.value.copy(light.sunCol);
      u.uAmb.value.copy(light.amb);
      u.uSky.value.copy(light.sky);
      u.uNight.value = light.night;
      this.far.material.color.copy(light.farSea);
    }
  }
}
