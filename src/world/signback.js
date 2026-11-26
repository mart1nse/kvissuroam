// One-sided traffic signs (Martin, 20 Nov): seen from behind, a sign is a plain grey metal plate, not its
// face in a mirror. greyBack(mat) patches a DoubleSide sign material so its back faces draw in one grey;
// the texture's alpha still cuts the outline, so a round sign has a round back and a triangle a triangle.
// No new texture, material, mesh or draw call: only one line in the fragment shader of the sign material.
// twoSidedU: atlas columns between these two u are genuinely double-sided signs and keep their face behind.
import * as THREE from 'three';

const uBack = { value: new THREE.Color(0x9a9ca4) };      // galvanised steel, a touch lighter than the post

export function greyBack(mat, { twoSidedU = null } = {}) {
  mat.side = THREE.DoubleSide;
  const keep = twoSidedU ? ` && (vMapUv.x < ${twoSidedU[0].toFixed(6)} || vMapUv.x >= ${twoSidedU[1].toFixed(6)})` : '';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.signBack = uBack;
    sh.fragmentShader = 'uniform vec3 signBack;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      `#include <map_fragment>\n  if (!gl_FrontFacing${keep}) diffuseColor.rgb = signBack;`);
  };
  mat.customProgramCacheKey = () => `signBack${keep}`;
  return mat;
}
