/* Sky.js - sky dome, sun and moon, stars, low-poly clouds, rain and
   lightning, and the day/night lighting that drives everything else.

   The palette is keyframed across the day. Atmosphere comes from the COLOUR
   difference between the sky light and the key light, never from darkness:
   even midnight keeps enough ambient that the flat-shaded undersides of the
   trees do not go solid black. The Blackwater is the one place the game is
   allowed to be properly dark, and there it is the fog that closes in. */

import * as THREE from '../../lib/three.module.js?v=1790193571';
import { clamp, lerp, smoothstep, hash3, rng } from '../core/Util.js?v=1790193571';
import { MeshBuilder, hexToLinear } from '../art/Geo.js?v=1790193571';

const KEYS = [
  // t,    top,      horizon,  fog,      sun,      sunI, hemiSky,  hemiGnd,  hemiI
  [0.00, 0x0e1a34, 0x2a4068, 0x22335a, 0xa8bcff, 0.75, 0x5a6ea8, 0x262c3a, 1.35],
  [0.20, 0x1c2a52, 0x5b5f8a, 0x4e5678, 0xb09cd0, 0.7, 0x5a64a0, 0x2a2c38, 1.3],
  [0.25, 0x4a67a0, 0xf2a574, 0xd9a58a, 0xffb27a, 0.95, 0x7c8cb0, 0x3a3228, 1.0],
  [0.32, 0x5aa0dc, 0xd4ebf4, 0xc0dbe6, 0xfff0d8, 1.75, 0xb5d4ef, 0x5e5a3e, 1.05],
  [0.50, 0x4a90d8, 0xc4e3f2, 0xb6d7e6, 0xfff7ea, 2.0, 0xbad8f2, 0x5f5c40, 1.1],
  [0.68, 0x5a8fcf, 0xf2d8a8, 0xe3d2ac, 0xffdcaa, 1.75, 0xbccbd8, 0x645a3c, 1.05],
  [0.745, 0x4c5c96, 0xff9a58, 0xeba27a, 0xffa060, 1.25, 0x9a8ab0, 0x4a3a2c, 1.0],
  [0.79, 0x2a3464, 0xc0607a, 0x7a5070, 0xd08aa0, 0.6, 0x6a6090, 0x241e26, 0.95],
  [0.84, 0x131d3c, 0x3a3a66, 0x2a3050, 0xa0b0f0, 0.7, 0x56649e, 0x262a36, 1.3],
  [1.00, 0x0e1a34, 0x2a4068, 0x22335a, 0xa8bcff, 0.75, 0x5a6ea8, 0x262c3a, 1.35],
];

const _ca = new THREE.Color(), _cb = new THREE.Color();
function lerpHex(a, b, t, out) {
  _ca.setHex(a); _cb.setHex(b);
  return out.copy(_ca).lerp(_cb, t);
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.state = {
      top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(),
      sunCol: new THREE.Color(), sunI: 1, sunDir: new THREE.Vector3(0, 1, 0),
      amb: new THREE.Color(), sky: new THREE.Color(), night: 0, farSea: new THREE.Color(),
    };

    // dome
    this.domeU = {
      uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
      uNight: { value: 0 }, uDark: { value: 0 },
    };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.domeU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uNight; uniform float uDark;
        varying vec3 vD;
        void main(){
          float h = clamp(vD.y, -0.2, 1.0);
          vec3 c = mix(uHor, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
          if (h < 0.0) c = mix(uHor, uHor * 0.7, clamp(-h * 5.0, 0.0, 1.0));
          float s = max(dot(vD, normalize(uSun)), 0.0);
          c += uSunCol * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.28) * (1.0 - uDark);
          c = mix(c, c * 0.25, uDark);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    dome.name = 'sky';
    this.dome = dome;
    scene.add(dome);

    // moon: a faceted disc that tracks opposite the sun
    const mb = new MeshBuilder();
    mb.color(0xe8ecff).blob(38, 38, 8, 0, 0, 0, 8, 4);
    this.moon = new THREE.Mesh(mb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true }));
    this.moon.renderOrder = -9;
    scene.add(this.moon);

    // stars
    const sp = [];
    for (let i = 0; i < 900; i++) {
      const u = hash3(i, 1, 3), v = hash3(i, 2, 3);
      const th = u * Math.PI * 2, ph = Math.acos(1 - v * 0.95);
      sp.push(Math.sin(ph) * Math.cos(th) * 2800, Math.cos(ph) * 2800, Math.sin(ph) * Math.sin(th) * 2800);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.renderOrder = -9;
    scene.add(this.stars);

    // clouds
    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.96, emissive: 0x909090 });
    this.cloudMat = cloudMat;
    for (let i = 0; i < 46; i++) {
      const b = new MeshBuilder(rng(i * 97 + 5));
      b.color(0xffffff);
      const n = 3 + Math.floor(hash3(i, 5, 1) * 4);
      for (let k = 0; k < n; k++) {
        const r = 16 + hash3(i, k, 2) * 22;
        b.lump(r, (k - n / 2) * 20 + hash3(i, k, 4) * 10, hash3(i, k, 6) * 8, hash3(i, k, 8) * 16 - 8, 0.12, 0.7, 1);
      }
      // flatten the bottoms
      for (let p = 1; p < b.P.length; p += 3) if (b.P[p] < -2) b.P[p] = -2 - (b.P[p] + 2) * 0.12;
      const m = new THREE.Mesh(b.build(), cloudMat);
      m.position.set((hash3(i, 9, 9) - 0.5) * 3000, 190 + hash3(i, 3, 3) * 120, (hash3(i, 7, 7) - 0.5) * 3000);
      m.rotation.y = hash3(i, 1, 1) * 6.28;
      const s = 0.8 + hash3(i, 2, 2) * 1.2;
      m.scale.set(s, s * 0.8, s);
      this.clouds.add(m);
    }
    scene.add(this.clouds);

    // rain
    const rn = 2400, rp = new Float32Array(rn * 6);
    for (let i = 0; i < rn; i++) {
      const x = (Math.random() - 0.5) * 80, y = Math.random() * 40, z = (Math.random() - 0.5) * 80;
      rp.set([x, y, z, x + 0.15, y - 1.1, z + 0.08], i * 6);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaabbd0, transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8f0, 0x5a5a40, 1.0);
    scene.add(this.hemi);

    this.fog = new THREE.FogExp2(0xb6d7e6, 0.0022);
    scene.fog = this.fog;

    this.flash = 0;
    this.boltTimer = 6;
    this.onThunder = null;
    const bb = new MeshBuilder();
    this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xe6f0ff, fog: false, transparent: true, opacity: 0.95 }));
    this.bolt.visible = false;
    scene.add(this.bolt);
    void bb;
  }

  /**
   * @param t      time of day 0..1
   * @param cam    camera position
   * @param focus  point to centre shadows on (the player)
   * @param env    {storm 0..1, dark 0..1 (Blackwater), frost 0..1, underwater}
   */
  update(dt, t, cam, focus, env) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const f = smoothstep(0, 1, (t - A[0]) / (B[0] - A[0]));
    const S = this.state;
    lerpHex(A[1], B[1], f, S.top);
    lerpHex(A[2], B[2], f, S.hor);
    lerpHex(A[3], B[3], f, S.fog);
    lerpHex(A[4], B[4], f, S.sunCol);
    S.sunI = lerp(A[5], B[5], f);
    const hs = lerpHex(A[6], B[6], f, new THREE.Color());
    const hg = lerpHex(A[7], B[7], f, new THREE.Color());
    let hemiI = lerp(A[8], B[8], f);

    const storm = env.storm || 0, dark = env.dark || 0;
    // storms: grey everything down
    const grey = new THREE.Color(0x5a6470);
    S.top.lerp(grey.clone().multiplyScalar(0.8), storm * 0.8);
    S.hor.lerp(grey, storm * 0.75);
    S.fog.lerp(new THREE.Color(0x56606a), storm * 0.8);
    S.sunI *= 1 - storm * 0.65;
    // blackwater: it closes in
    const bw = new THREE.Color(0x0a0d12);
    S.top.lerp(bw, dark * 0.85); S.hor.lerp(new THREE.Color(0x1a2028), dark * 0.85); S.fog.lerp(new THREE.Color(0x0e1218), dark * 0.9);
    S.sunI *= 1 - dark * 0.7;
    hemiI *= 1 - dark * 0.45;
    // Vigil's End: the colour drains out of everything and the fog closes in
    const mist = env.mist || 0;
    if (mist > 0) {
      const des = (c, k, lift = 1) => { const l = (c.r * 0.3 + c.g * 0.55 + c.b * 0.15) * lift; c.lerp(new THREE.Color(l * 0.96, l, l * 1.04), k); };
      des(S.top, mist * 0.82, 0.9); des(S.hor, mist * 0.88, 0.95); des(S.fog, mist * 0.92, 0.92); des(S.sunCol, mist * 0.7);
      des(hs, mist * 0.7); des(hg, mist * 0.6);
      S.sunI *= 1 - mist * 0.45;
      hemiI *= 1 - mist * 0.08;
    }

    // sun and moon positions
    const ang = (t - 0.25) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang) * 0.75, Math.sin(ang), 0.42).normalize();
    const moonDir = sunDir.clone().multiplyScalar(-1);
    moonDir.y = Math.abs(moonDir.y) * 0.8 + 0.25; moonDir.normalize();
    const day = smoothstep(-0.08, 0.12, sunDir.y);
    S.night = 1 - day;
    const lightDir = day > 0.5 ? sunDir : moonDir;
    S.sunDir.copy(lightDir);

    this.domeU.uTop.value.copy(S.top);
    this.domeU.uHor.value.copy(S.hor);
    this.domeU.uSun.value.copy(sunDir);
    this.domeU.uSunCol.value.copy(S.sunCol).multiplyScalar(day);
    this.domeU.uDark.value = dark * 0.6;

    this.dome.position.copy(cam);
    this.stars.position.copy(cam);
    this.stars.material.opacity = clamp(S.night * 1.2 - storm, 0, 1) * (1 - dark * 0.6);
    this.moon.position.copy(cam).addScaledVector(moonDir, 2600);
    this.moon.lookAt(cam);
    this.moon.material.opacity = clamp(S.night * 1.5 - storm, 0, 1);

    // lightning
    this.flash = Math.max(0, this.flash - dt * 3.5);
    if (storm > 0.6) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        this.boltTimer = 4 + Math.random() * 9;
        this._strike(cam);
      }
    }
    if (this.bolt.visible) { this.bolt.material.opacity -= dt * 3; if (this.bolt.material.opacity <= 0) this.bolt.visible = false; }

    const fl = this.flash;
    this.sun.color.copy(S.sunCol).lerp(new THREE.Color(0xdfe8ff), fl);
    this.sun.intensity = S.sunI + fl * 2.5;
    this.hemi.color.copy(hs).lerp(new THREE.Color(0x8a96a8), storm * 0.6).lerp(new THREE.Color(0x202838), dark * 0.6);
    this.hemi.groundColor.copy(hg);
    this.hemi.intensity = hemiI + fl * 1.5;

    const fogCol = S.fog.clone();
    if (env.underwater) fogCol.set(dark > 0.5 ? 0x02060a : 0x0d4a5a);
    this.fog.color.copy(fogCol);
    let dens = 0.0019 + storm * 0.0045 + dark * 0.0105 + (env.frost || 0) * 0.0006;
    if (env.edge) dens += env.edge * 0.01;
    dens += mist * 0.0038;
    if (env.underwater) dens = dark > 0.5 ? 0.09 : 0.045;
    if (env.lights && dark > 0) dens -= env.lights * dark * 0.004;
    this.fog.density = dens;

    // shadows follow the player
    const fp = focus;
    this.sun.position.set(fp.x + lightDir.x * 150, fp.y + lightDir.y * 150, fp.z + lightDir.z * 150);
    this.sun.target.position.copy(fp);
    this.sun.target.updateMatrixWorld();

    // clouds drift and wrap around the camera
    const drift = dt * (3 + storm * 9);
    for (const c of this.clouds.children) {
      c.position.x += drift;
      if (c.position.x - cam.x > 1500) c.position.x -= 3000;
      if (c.position.x - cam.x < -1500) c.position.x += 3000;
      if (c.position.z - cam.z > 1500) c.position.z -= 3000;
      if (c.position.z - cam.z < -1500) c.position.z += 3000;
    }
    this.cloudMat.color.setRGB(1, 1, 1).lerp(new THREE.Color(0x5a626c), Math.max(storm * 0.8, mist * 0.6));
    this.cloudMat.opacity = 0.96 * (1 - dark * 0.85);
    this.cloudMat.emissive.copy(S.hor).lerp(S.top, 0.3).multiplyScalar(0.62 * (1 - storm * 0.5) * (1 - dark * 0.8));

    // rain
    this.rain.visible = storm > 0.05 && !env.underwater;
    if (this.rain.visible) {
      this.rain.material.opacity = storm * 0.55;
      this.rain.position.set(cam.x, cam.y - 20, cam.z);
      const p = this.rain.geometry.attributes.position.array;
      const fall = dt * 38;
      for (let k = 0; k < p.length; k += 6) {
        p[k + 1] -= fall; p[k + 4] -= fall;
        if (p[k + 1] < 0) { p[k + 1] += 40; p[k + 4] += 40; }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    S.amb.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.55);
    S.sky.copy(S.hor).lerp(S.top, 0.4);
    S.farSea.copy(fogCol).multiplyScalar(0.8);
    return S;
  }

  _strike(cam) {
    this.flash = 1;
    const a = Math.random() * Math.PI * 2, d = 150 + Math.random() * 350;
    const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
    const pts = [];
    let px = x, py = 220, pz = z;
    const b = new MeshBuilder();
    b.color(0xffffff);
    while (py > 0) {
      const nx = px + (Math.random() - 0.5) * 24, ny = py - 15 - Math.random() * 20, nz = pz + (Math.random() - 0.5) * 24;
      b.beam([px, py, pz], [nx, Math.max(0, ny), nz], 1.6, 1.6);
      px = nx; py = ny; pz = nz;
      pts.push([px, py, pz]);
    }
    this.bolt.geometry.dispose();
    this.bolt.geometry = b.build();
    this.bolt.material.opacity = 0.95;
    this.bolt.visible = true;
    if (this.onThunder) this.onThunder(d);
  }
}
