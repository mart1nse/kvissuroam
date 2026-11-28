// Marks that darken (or lighten) the ground under them: one shader for Tallinn's road wear, shared by the Pirita lap
// (src/world/tln/pirita.js) and the centre (src/world/tln/centremarks.js). Each vertex carries the factor its mark
// turns the ground's colour by (f) and what kind of mark it is (k); the blend multiplies what is already drawn.
//  0 a patch of newer or older tarmac (a cut edge)      1 a crack seal (fades out at its edges)
//  2 a tyre mark (streaks along)                         3 a manhole lid with its rim and the repair round it
//  4 a drain grate in its frame                          5, 6 a tram rail set in the road (steel head, dark groove;
//                                                           5 has the groove on its uv 0 side, 6 on its uv 1 side)
// Ribbons carry uv = (0..1 across, metres along); the lid and the grate are squares with uv 0..1 both ways.
import * as THREE from 'three';

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec3 f;
attribute float k;
varying vec3 vF;
varying vec2 vUv;
varying float vK;
varying vec2 vW;
varying float vD;
void main() {
  vF = f; vUv = uv; vK = k; vW = position.xz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vD = length(mvPosition.xyz);
  #include <fog_vertex>
  // (drawn where it lies but depth-tested a little nearer, so the ground's 1 m grid never pokes through: raadi-line.js)
  mvPosition.xyz *= max(0.05, 1.0 - 0.12 / max(length(mvPosition.xyz), 0.6));
  gl_Position = projectionMatrix * mvPosition;
}`;
const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
varying vec3 vF;
varying vec2 vUv;
varying float vK;
varying vec2 vW;
varying float vD;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}
void main() {
  float u = vUv.x;
  vec3 fc;
  if (vK < 2.5) {
    // a patch has a cut edge; a crack seal and a tyre mark fade out at theirs
    float soft = vK < 0.5 ? 0.03 : 0.42;
    float e = smoothstep(0.0, soft, u) * smoothstep(0.0, soft, 1.0 - u);
    float n = vn(vW * 1.3) * 0.6 + vn(vW * 4.7) * 0.4;
    float s = vK < 0.5 ? 0.82 + 0.36 * n
      : vK < 1.5 ? 0.75 + 0.5 * n
      : (0.35 + 0.95 * vn(vec2(vUv.y * 0.45, u * 2.0))) * smoothstep(0.0, 3.0, vUv.y);
    fc = mix(vec3(1.0), vF, clamp(e * s, 0.0, 1.0));
  } else if (vK < 3.5) {
    // a cast iron lid 0.66 m across (r 0.5 of the square), a worn rim, a ring of repair round it with a ragged edge
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float n = vn(vW * 9.0);
    float lid = 0.5 + 0.07 * step(0.5, fract((p.x + p.y) * 15.0)) * step(0.5, fract((p.x - p.y) * 15.0)) + 0.06 * n;
    float g = r < 0.46 ? lid : r < 0.5 ? 0.36 : r < 0.56 ? 0.7 + 0.1 * n : 1.0;
    float ring = (1.0 - smoothstep(0.78 + 0.12 * vn(vW * 3.0), 0.95, r)) * step(0.56, r);
    g = mix(g, 0.84 + 0.08 * vn(vW * 2.1), ring);
    fc = vec3(g) * vF;
  } else if (vK < 4.5) {
    // a grate 0.5 by 0.3 m in its frame (the square is 0.8 by 0.5 m): dark slots across, a steel frame, a repair round
    vec2 p = abs(vUv - 0.5) * 2.0;
    float edge = max(p.x, p.y);
    float slots = step(0.45, fract(vUv.x * 11.0));
    float g = edge < 0.62 ? mix(0.62, 0.22, slots) : edge < 0.72 ? 0.62 : 0.86 + 0.08 * vn(vW * 2.3);
    g = mix(g, 1.0, smoothstep(0.86, 1.0, edge));
    fc = vec3(g) * vF;
  } else {
    // a grooved rail: the groove on the track's inner side, the polished head, the seam beside it
    float q = vK < 5.5 ? u : 1.0 - u;
    float g = q < 0.12 ? 0.82 : q < 0.42 ? 0.3 : q < 0.82 ? 1.6 : 0.8;
    // far away the rail is thinner than a pixel: fade to the seam's tone so it does not sparkle
    g = mix(g, 0.9, smoothstep(18.0, 55.0, vD));
    fc = vec3(g) * vF;
  }
  #ifdef USE_FOG
    fc = mix(fc, vec3(1.0), smoothstep(fogNear, fogFar, vFogDepth));
  #endif
  // (out = src * dst + dst * (1 - src alpha): a factor sent as alpha = the largest 1 - f, colour = f - 1 + alpha)
  float al = clamp(max(max(1.0 - fc.r, 1.0 - fc.g), 1.0 - fc.b), 0.0, 1.0);
  gl_FragColor = vec4(max(fc - 1.0 + al, 0.0), al);
}`;
const MULTIPLY = {
  fog: true, transparent: true, depthWrite: false, toneMapped: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
};
let markMat = null;
export const multiplyMaterial = () => (markMat ||= new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), vertexShader: VERT, fragmentShader: FRAG, ...MULTIPLY,
}));

// a growing array of floats (or indices), so a mesh's numbers are not first held as JS arrays (less for the garbage
// collector: the centre's squares build tens of thousands of corners)
function grow(Type, n0) {
  let a = new Type(n0), n = 0;
  return {
    room(k) { if (n + k > a.length) { const b = new Type(Math.max(a.length * 2, n + k)); b.set(a); a = b; } },
    push(x) { this.room(1); a[n++] = x; },
    push2(x, y) { this.room(2); a[n++] = x; a[n++] = y; },
    push3(x, y, z) { this.room(3); a[n++] = x; a[n++] = y; a[n++] = z; },
    push6(p, q, r, s, u, v) { this.room(6); a[n++] = p; a[n++] = q; a[n++] = r; a[n++] = s; a[n++] = u; a[n++] = v; },
    get n() { return n; },
    out() { return a.slice(0, n); },
  };
}

// Collects ribbons and squares and makes one mesh of them. y(x, z) is the ground under a point.
export function markMesh(y) {
  const pos = grow(Float32Array, 6144), uv = grow(Float32Array, 4096), fa = grow(Float32Array, 6144), ka = grow(Float32Array, 2048), idx = grow(Uint32Array, 6144);
  let n = 0;
  return {
    get empty() { return !idx.n; },
    // a ribbon w wide along centre points [x, z, ...] (only the first two of each are used)
    ribbon(pts, w, F, kind, lift = 0.03) {
      if (pts.length < 2) return;
      let along = 0;
      for (let k = 0; k < pts.length; k++) {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
        if (k) along += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        for (let sd = -1; sd <= 1; sd += 2) {
          const x = pts[k][0] - (dz / l) * (w / 2) * sd, z = pts[k][1] + (dx / l) * (w / 2) * sd;
          pos.push3(x, y(x, z) + lift, z);
          uv.push2(sd < 0 ? 0 : 1, along);
          fa.push3(F[0], F[1], F[2]); ka.push(kind);
        }
        if (k) idx.push6(n - 2, n - 1, n, n, n - 1, n + 1);
        n += 2;
      }
    },
    // a square a by b metres at (x, z), turned by yaw (a along the yaw's direction), uv 0..1 both ways
    square(x, z, yaw, a, b, F, kind, lift = 0.035) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      for (let q = 0; q < 4; q++) {
        const u = q & 1, v = q >> 1;
        const da = (u - 0.5) * a, db = (v - 0.5) * b;
        const px = x + c * da - s * db, pz = z + s * da + c * db;
        pos.push3(px, y(px, pz) + lift, pz);
        uv.push2(u, v); fa.push3(F[0], F[1], F[2]); ka.push(kind);
      }
      idx.push6(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      n += 4;
    },
    mesh() {
      if (!idx.n) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos.out(), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv.out(), 2));
      geo.setAttribute('f', new THREE.BufferAttribute(fa.out(), 3));
      geo.setAttribute('k', new THREE.BufferAttribute(ka.out(), 1));
      geo.setIndex(new THREE.BufferAttribute(idx.out(), 1));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, multiplyMaterial());
      mesh.renderOrder = 2;
      mesh.matrixAutoUpdate = false;
      return mesh;
    },
  };
}
