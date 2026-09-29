/* CatchArt.js - the model of any catch at a given length: a fish from
   FishArt, or a sea beast built at miniature scale and sized to fit. */

import * as THREE from '../../lib/three.module.js';
import { fishMesh } from './FishArt.js';
import { buildBeast } from './BeastArt.js';
import { buildGreat, buildKrakenStatue } from './GreatArt.js';
import { BEAST_DEFS } from '../data/BeastCatch.js';

/** A catch's model, `lengthM` long. Beasts come back with `.animate(t)` when they have one. */
export function catchMesh(sp, lengthM, opts = {}) {
  if (!sp.beast) return fishMesh(sp, lengthM, opts);
  let b;
  if (sp.beast === 'kraken') b = { group: buildKrakenStatue() };
  else if (sp.beast === 'great') b = buildGreat(BEAST_DEFS.great[sp.def], true);
  else b = buildBeast(BEAST_DEFS.beast[sp.def], true);
  const inner = b.group;
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = lengthM / Math.max(1e-3, size.x, size.z, size.y * 0.8);
  // centre it, so it lies and swims about its middle like a fish does
  inner.position.set(-c.x * k, -c.y * k, -c.z * k);
  inner.scale.multiplyScalar(k);
  inner.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const grp = new THREE.Group();
  // fish face +X in their frame; the beasts face +Z: turn them to match
  const turn = new THREE.Group();
  // the models are not all built facing the same way: lie each one along its longest side
  turn.rotation.y = size.z > size.x ? Math.PI / 2 : 0;
  turn.add(inner);
  grp.add(turn);
  grp.userData.animate = b.animate || null;
  grp.userData.beast = true;
  return grp;
}
