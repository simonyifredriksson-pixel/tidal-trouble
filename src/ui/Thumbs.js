/* Thumbs.js - 3D thumbnails for the journal, shops and catch cards.

   A second, tiny WebGL renderer draws the real models - the same fish you
   pull out of the water, the same rods, the same boats - once each, and
   caches the PNG as a data URL. Undiscovered species render as a dark
   silhouette so the journal shows you the SHAPE of what you are missing. */

import * as THREE from '../../lib/three.module.js?v=1790354328';
import { fishMesh } from '../art/FishArt.js?v=1790354328';
import { buildRod } from '../art/RodArt.js?v=1790354328';
import { buildBoat } from '../art/BoatArt.js?v=1790354328';
import { buildLeviathan } from '../art/CreatureArt.js?v=1790354328';
import { FISH_BY_ID } from '../data/FishData.js?v=1790354328';
import { ROD_BY_ID } from '../data/GearData.js?v=1790354328';
import { LEV_BY_ID } from '../data/LeviathanData.js?v=1790354328';

let R = null, scene, cam, sun, hemi;
const cache = new Map();
const W = 240, H = 150;

function init() {
  if (R) return true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    R.setPixelRatio(1);
    R.setSize(W, H, false);
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.outputColorSpace = THREE.SRGBColorSpace;
  } catch (e) { R = null; return false; }
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 200);
  sun = new THREE.DirectionalLight(0xfff4e0, 2.4); sun.position.set(2, 3, 4);
  hemi = new THREE.HemisphereLight(0xdfefff, 0x6a5a40, 1.2);
  scene.add(sun, hemi);
  return true;
}

function frame(obj, dist = 1.5, dir = [0.25, 0.18, 1]) {
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.y * 1.6, s.z) * 0.5;
  const d = r / Math.tan((cam.fov * Math.PI / 180) / 2) * dist;
  const v = new THREE.Vector3(...dir).normalize();
  cam.position.copy(c).addScaledVector(v, d);
  cam.lookAt(c);
  cam.near = d / 50; cam.far = d * 10; cam.updateProjectionMatrix();
}

function shoot(obj, silhouette = false) {
  if (!init()) return '';
  if (silhouette) obj.traverse(o => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: 0x1a2a30 }); });
  scene.add(obj);
  R.setClearColor(0x000000, 0);
  R.render(scene, cam);
  const url = R.domElement.toDataURL('image/png');
  scene.remove(obj);
  return url;
}

export function fishThumb(id, known = true) {
  const key = 'f:' + id + ':' + known;
  if (cache.has(key)) return cache.get(key);
  const sp = FISH_BY_ID[id];
  if (!sp) return '';
  if (!init()) return '';
  const len = sp.junk ? 1 : Math.min(1.2, (sp.cm[0] + sp.cm[1]) / 200);
  const m = fishMesh(sp, len);
  m.rotation.set(0, 0, 0);
  m.rotation.y = -0.2;
  frame(m, 0.82, [0.1, 0.12, 1]);
  const url = shoot(m, !known);
  cache.set(key, url);
  return url;
}

export function rodThumb(id) {
  const key = 'r:' + id;
  if (cache.has(key)) return cache.get(key);
  if (!init()) return '';
  const rod = buildRod(ROD_BY_ID[id]);
  rod.group.rotation.set(0, 0, -1.05);
  frame(rod.group, 1.05, [0, 0.1, 1]);
  const url = shoot(rod.group);
  cache.set(key, url);
  return url;
}

export function boatThumb(cfg) {
  const key = 'b:' + JSON.stringify(cfg);
  if (cache.has(key)) return cache.get(key);
  if (!init()) return '';
  const b = buildBoat(cfg);
  b.group.rotation.y = 0.9;
  frame(b.group, 1.2, [0.6, 0.35, 1]);
  const url = shoot(b.group);
  cache.set(key, url);
  return url;
}

/** Any model, framed and cached by `key`. */
export function objThumb(key, make, dir = [0.4, 0.35, 1], dist = 1.15, silhouette = false) {
  if (cache.has(key)) return cache.get(key);
  if (!init()) return '';
  const obj = make();
  frame(obj, dist, dir);
  const url = shoot(obj, silhouette);
  cache.set(key, url);
  return url;
}

export function levThumb(id, known) {
  const key = 'l:' + id + ':' + known;
  if (cache.has(key)) return cache.get(key);
  if (!init()) return '';
  const L = LEV_BY_ID[id];
  const b = buildLeviathan(L);
  b.group.rotation.y = -0.3;
  if (b.heart) b.heart.visible = known;
  frame(b.group, 1.2, [0.2, 0.3, 1]);
  const url = shoot(b.group, !known);
  cache.set(key, url);
  return url;
}
