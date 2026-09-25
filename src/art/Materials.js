/* Materials.js - the handful of shared materials the whole game draws with.
   Every model carries its colour per vertex, so there are only a few
   materials in the entire scene and almost everything batches. */

import * as THREE from '../../lib/three.module.js?v=1790356418';

/** Uniforms shared by every animated shader (wind, time). */
export const U = {
  uTime: { value: 0 },
  uWind: { value: 1 },
};

function addWind(mat, strength = 1) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uWind = U.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uTime;\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        #ifdef USE_INSTANCING
          vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        #else
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
        #endif
        float sw = sway * uWind * ${strength.toFixed(2)};
        float ph = wp.x * 0.21 + wp.z * 0.17;
        transformed.x += (sin(uTime * 1.6 + ph) * 0.7 + sin(uTime * 3.7 + ph * 2.3) * 0.3) * sw * 0.16;
        transformed.z += (cos(uTime * 1.2 + ph * 1.3) * 0.7 + sin(uTime * 2.9 + ph) * 0.3) * sw * 0.11;
      }`);
  };
  mat.customProgramCacheKey = () => 'wind' + strength;
  return mat;
}

export const MAT = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
  solidDS: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  foliage: addWind(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 1),
  grass: addWind(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 1.4),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glowAdd: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  ghost: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false }),
  glass: new THREE.MeshLambertMaterial({ color: 0x9fc4d6, transparent: true, opacity: 0.55, emissive: 0x1a2a33 }),
  shiny: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x444444, flatShading: true }),
};

/** Make a mesh from a builder with a given material, shadows on. */
export function meshOf(geo, mat = MAT.solid, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = recv;
  return m;
}
