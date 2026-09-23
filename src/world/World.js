/* World.js - assembles the static world: terrain, water, sky, flora,
   settlement, ice, and the point-light pool for lamps.

   A real PointLight per lamp would be dozens of lights in every shader, so
   the settlement DECLARES light sources and a pool of eight real lights is
   handed to the nearest, brightest ones each frame. */

import * as THREE from '../../lib/three.module.js?v=1790183165';
import { Terrain, buildIce, heightAt, groundAt, iceAt, ICE_Y, isOpenWater } from './Terrain.js?v=1790183165';
import { Water } from './Water.js?v=1790183165';
import { Sky } from './Sky.js?v=1790183165';
import { Scatter, Grass } from './Scatter.js?v=1790183165';
import { Settlement } from './Settlement.js?v=1790183165';
import { Colliders } from './Colliders.js?v=1790183165';
import { waveHeight, regionAt, regionWeights, WORLD } from './MapData.js?v=1790183165';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = new Colliders();
  }

  /** Build in steps so the loading screen can breathe. `step(label)` is awaited between. */
  async build(step) {
    await step('Raising the islands');
    this.terrain = new Terrain(this.scene);
    await step('Carving the coastline');
    this.terrain.buildCoarse();
    await step('Filling the sea');
    this.water = new Water(this.scene);
    this.sky = new Sky(this.scene);
    this.ice = buildIce();
    this.scene.add(this.ice);
    await step('Building Driftwood Bay');
    this.settlement = new Settlement(this.scene, this.colliders);
    await step('Growing the forest');
    this.flora = new Scatter(this.scene, this.colliders, this.settlement.blockers, this.terrain);
    this.grass = new Grass(this.scene, this.settlement.blockers);
    await step('Lighting the lamps');
    this.pool = [];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xffc070, 0, 12, 1.6);
      l.castShadow = false;
      this.scene.add(l);
      this.pool.push(l);
    }
    this.extraLights = [];     // dynamic sources added by the game (boat lamps, fires)
    this.time = 0;
    this.storm = 0;
    this.whirl = null;
    this.glow = null;
  }

  prebuild(x, z) {
    this.terrain.prebuild(x, z);
    this.grass.update({ x, z }, true);
  }

  /** Sea surface height at a point right now. */
  sea(x, z) { return waveHeight(x, z, this.time, 1 + this.storm * 1.6, this.whirl); }

  /** Water surface at a point, or -Infinity if it is dry land or ice. */
  waterAt(x, z) {
    const h = heightAt(x, z);
    if (h > 0.25) return -Infinity;
    if (h < ICE_Y && iceAt(x, z)) return -Infinity;
    return this.sea(x, z);
  }

  ground(x, z) { return groundAt(x, z); }
  height(x, z) { return heightAt(x, z); }
  region(x, z) { return regionAt(x, z); }
  weights(x, z) { return regionWeights(x, z); }
  openWater(x, z, d) { return isOpenWater(x, z, d); }
  onIce(x, z) { return iceAt(x, z) && heightAt(x, z) < ICE_Y; }

  update(dt, cam, focus, env, night) {
    this.time += dt;
    this.terrain.update(cam.x, cam.z, 5);
    this.flora.update(cam);
    this.grass.update(cam);
    const light = this.sky.update(dt, env.tod, cam, focus, env);
    this.water.update(dt, cam, this.time, 1 + this.storm * 1.6, this.whirl, this.glow, light);
    // light pool
    const srcs = [];
    for (const L of this.settlement.lights) {
      if (L.night && night < 0.3 && !env.dark) continue;
      const d = L.pos.distanceTo(focus);
      if (d > 70 && !L.beacon) continue;
      srcs.push({ L, s: L.intensity / (1 + d * 0.08) * (L.interior ? 2 : 1) });
    }
    for (const L of this.extraLights) {
      const d = L.pos.distanceTo(focus);
      srcs.push({ L, s: L.intensity / (1 + d * 0.06) * 1.5 });
    }
    srcs.sort((a, b) => b.s - a.s);
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i], s = srcs[i];
      if (!s) { p.intensity = 0; continue; }
      const L = s.L;
      p.position.copy(L.pos);
      p.color.setHex(L.color);
      p.distance = L.dist;
      const fl = L.flicker ? 0.85 + Math.sin(this.time * 13 + i) * 0.08 + Math.sin(this.time * 7.3) * 0.07 : 1;
      const want = L.intensity * 11 * fl * (L.night ? Math.min(1, night * 1.6 + (env.dark || 0)) : 1);
      p.intensity += (want - p.intensity) * Math.min(1, dt * 6);
    }
  }
}
