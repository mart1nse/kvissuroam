// The Raadi stage's worn line, made from how people really drive it (Martin, 26 Nov 2026: "more driver driven":
// the real marks on the gravel and the grass beside it merged "to some kind of a rough outline of the racing line";
// the cars are sideways through the corners, so there it is no pair of ruts but one broad band).
//
// The timed runs of the day it was made were written down (the logging was taken out at the stage's launch, 26 Nov
// 2026: the runs are in the project's raadi-lines/runs.ndjson), and tools/race/raadi-lines.py sums the wheel paths of
// all of them on the ground and bakes the result into one small picture, a strip laid along the stage: 9 m either side
// of its centre line, 64 texels across and 4096 along (1 MB on the graphics card with its smaller copies). Each
// texel says how worn the ground is there, as four shares: gravel swept by the wheels (darker, packed), the loose
// gravel that lies beside the swept band (lighter, stony), grass worn through to soil, and rubber on tarmac.
//
// The strip runs from just before the start line to 30 m past the stage's last point (Martin 26 Nov 10:07: the road
// from the last corner on and "the inital asphalty part" are to have it too). On the tarmac of the start the picture
// gives the soft dark band where the cars brake and turn into the first corner, and over it lie the marks themselves
// (`marks` in raadi-line.json): every stretch a wheel slid there in a logged run, a ribbon as wide as its tyre, as
// long as that launch's wheelspin or that slide was (and on the gravel beside it and 20 m into the first corner). A few thousand points, one more mesh, no picture.
//
// One mesh multiplied over the ground, as the wheel tracks it replaces were: the ground keeps its own light, shade
// and texture. A share s of a look turns the ground's colour by colour ^ s, so the shares of two layers add up to
// the same look as one: the strip lies on itself where the stage crosses its own path, drives one stretch twice and
// folds inside a tight corner, and the tool has given each layer its part there. Only the quads of the strip with
// anything on them are built (about half).
import * as THREE from 'three';
import LINE from './raadi-line.json';
import lineUrl from './raadi-line.png';
import { jobs } from '../jobs.js';

const LIFT = 0.035;
// the ground's colour is multiplied by these where a look is whole (over 1 lightens)
const SWEPT = [0.65, 0.59, 0.52], LOOSE = [1.24, 1.21, 1.15], SOIL = [0.66, 0.5, 0.36], RUBBER = [0.8, 0.8, 0.81];
// one old mark at full strength (the fresh ones of src/skidmarks.js are about 0.3): faint alone, and marks that lie
// on each other multiply, so where twenty launches left the line together the tarmac is black and the strands of
// single launches show beside and beyond it
const MARK = [0.74, 0.74, 0.76];
const ln = (c) => c.map((v) => Math.log(v).toFixed(4)).join(', ');

// a small tile of grain: R streaks along the way the cars go, G stones and crumbs
function grainTex() {
  const W = 64, H = 128, d = new Uint8Array(W * H * 4);
  let seed = 29;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cols = Array.from({ length: W }, rnd), rows = Array.from({ length: H }, rnd);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    d[o] = Math.round(255 * (0.25 + 0.5 * cols[x] + 0.25 * rows[y] * rnd()));
    d[o + 1] = Math.round(255 * (rnd() > 0.8 ? 0.6 + 0.4 * rnd() : 0.35 * rnd()));
    d[o + 2] = 0; d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  #include <fog_vertex>
  // (drawn where it lies but depth-tested a little nearer the camera, so the ground's 1 m grid never pokes through)
  mvPosition.xyz *= max(0.05, 1.0 - 0.15 / max(length(mvPosition.xyz), 0.6));
  gl_Position = projectionMatrix * mvPosition;
}`;
const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D map;
uniform sampler2D grain;
uniform vec2 tile;
varying vec2 vUv;
void main() {
  vec4 w = texture2D(map, vUv);
  vec4 g = texture2D(grain, vUv * tile);
  vec4 g2 = texture2D(grain, vUv * tile * vec2(3.1, 0.37) + 0.37);
  float streak = 0.55 + 0.9 * g.r, crumb = 0.5 + 1.1 * g.g;
  // each look's share of the wear, as the power its colour is raised to
  vec3 f = exp(w.r * streak * vec3(${ln(SWEPT)}) + w.g * crumb * vec3(${ln(LOOSE)}) + w.b * (0.6 + 0.8 * g2.r) * vec3(${ln(SOIL)})
    + (1.0 - w.a) * (0.7 + 0.6 * g.r) * vec3(${ln(RUBBER)}));
  #ifdef USE_FOG
    f = mix(f, vec3(1.0), smoothstep(fogNear, fogFar, vFogDepth));
  #endif
  // (the blend is out = src * dst + dst * (1 - src alpha): a factor f is sent as alpha = the largest of 1 - f, and
  // colour = f - 1 + alpha, as the tyre marks are: src/skidmarks.js)
  float al = clamp(max(max(1.0 - f.r, 1.0 - f.g), 1.0 - f.b), 0.0, 1.0);
  gl_FragColor = vec4(max(f - 1.0 + al, 0.0), al);
}`;

// The marks: uv.x across the ribbon, uv.y metres along it, `a` the slide's strength there. Rubber laid by a tyre:
// soft at its edges, heavier under the shoulders, streaky along its length and thin in places.
const MARK_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float a;
varying vec2 vUv;
varying float vA;
void main() {
  vUv = uv; vA = a;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  #include <fog_vertex>
  mvPosition.xyz *= max(0.05, 1.0 - 0.2 / max(length(mvPosition.xyz), 0.6));
  gl_Position = projectionMatrix * mvPosition;
}`;
const MARK_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D grain;
varying vec2 vUv;
varying float vA;
void main() {
  float u = vUv.x;
  float edge = smoothstep(0.0, 0.14, u) * smoothstep(0.0, 0.14, 1.0 - u);
  float shoulder = 0.75 + 0.25 * max(exp(-pow((u - 0.18) / 0.1, 2.0)), exp(-pow((u - 0.82) / 0.1, 2.0)));
  vec4 g = texture2D(grain, vec2(u * 0.35 + 0.1, vUv.y * 0.09));
  vec4 g2 = texture2D(grain, vec2(u * 0.11 + 0.6, vUv.y * 0.021));
  float k = clamp(vA * edge * shoulder * (0.62 + 0.5 * g.r) * (0.55 + 0.7 * g2.r), 0.0, 1.0);
  vec3 f = mix(vec3(1.0), vec3(${MARK.map((v) => v.toFixed(3)).join(', ')}), k);
  #ifdef USE_FOG
    f = mix(f, vec3(1.0), smoothstep(fogNear, fogFar, vFogDepth));
  #endif
  float al = clamp(max(max(1.0 - f.r, 1.0 - f.g), 1.0 - f.b), 0.0, 1.0);
  gl_FragColor = vec4(max(f - 1.0 + al, 0.0), al);
}`;

// the strip's picture, unpacked away from the game's own thread where the browser can
function loadPicture(done) {
  const dress = (tex) => {
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;                         // (the picture's first row is the strip's first metres)
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  };
  const plain = () => new THREE.TextureLoader().load(lineUrl, (tex) => done(dress(tex)), undefined, () => {});
  if (typeof createImageBitmap !== 'function') { plain(); return; }
  fetch(lineUrl).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((blob) => createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
    .then((bmp) => {
      const tex = new THREE.Texture(bmp);
      tex.addEventListener('dispose', () => bmp.close && bmp.close());
      done(dress(tex));
    }, plain);
}

// multiplied over the ground: out = src * dst + dst * (1 - src alpha)
const MULTIPLY = {
  fog: true, transparent: true, depthWrite: false, toneMapped: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, polygonOffset: true,
};

// the marks as one mesh: each ribbon two points wide, as broad as the bake says there
function* buildMarks({ P0, groundY, grain }) {
  const pos = [], uv = [], str = [], idx = [];
  let n = 0;
  for (const m of LINE.marks || []) {
    const c = m.length / 4;
    let along = 0;
    for (let k = 0; k < c; k++) {
      const x = P0[0] + m[k * 4] / 100, z = P0[1] + m[k * 4 + 1] / 100, hw = m[k * 4 + 2] / 200;
      const a = Math.max(0, k - 1) * 4, b = Math.min(c - 1, k + 1) * 4;
      const dx = m[b] - m[a], dz = m[b + 1] - m[a + 1], l = Math.hypot(dx, dz) || 1;
      if (k) along += Math.hypot(m[k * 4] - m[k * 4 - 4], m[k * 4 + 1] - m[k * 4 - 3]) / 100;
      for (const sd of [-1, 1]) {
        const vx = x - (dz / l) * hw * sd, vz = z + (dx / l) * hw * sd;
        pos.push(vx, groundY(vx, vz) + LIFT + 0.01, vz);
        uv.push(sd < 0 ? 0 : 1, along);
        str.push(m[k * 4 + 3] / 100);
      }
      if (k) idx.push(n - 2, n - 1, n, n, n - 1, n + 1);
      n += 2;
    }
    if (jobs.late()) yield;
  }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('a', new THREE.Float32BufferAttribute(str, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { grain: { value: null } }]),
    vertexShader: MARK_VERT, fragmentShader: MARK_FRAG, ...MULTIPLY, side: THREE.DoubleSide, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
  });
  mat.uniforms.grain.value = grain;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

// Builds the strip in steps of the work queue and adds it to `group` once its picture has come.
// P: the stage's points; START: the start line's point; groundY(x, z)
export function* buildLine({ group, P, START, groundY }) {
  const { i0, i1, e: E, k: K, cols } = LINE;
  // the strip's own centre line: the stage's points and the tail past the last one, and the way it runs at each
  const Q = P.concat(LINE.tail || []), M = Q.length;
  const TAN = Q.map((_, i) => {
    const a = Q[Math.max(0, i - 1)], b = Q[Math.min(M - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  });
  let len = 0;
  for (let i = i0; i < i1; i++) len += Math.hypot(Q[i + 1][0] - Q[i][0], Q[i + 1][1] - Q[i][1]);
  const rows = i1 - i0 + 1, vid = new Int32Array(rows * (K + 1)).fill(-1);
  const pos = [], uv = [], idx = [];
  let n = 0;
  const vert = (r, j) => {
    const q = r * (K + 1) + j;
    if (vid[q] >= 0) return vid[q];
    const i = i0 + r, d = -E + (2 * E * j) / K;
    const x = Q[i][0] - TAN[i][1] * d, z = Q[i][1] + TAN[i][0] * d;
    pos.push(x, groundY(x, z) + LIFT, z);
    uv.push(j / K, r / (rows - 1));
    return (vid[q] = n++);
  };
  for (let r = 0; r < rows - 1; r++) {
    const [j0, j1] = cols[r];
    for (let j = j0; j < j1; j++) {
      const a = vert(r, j), b = vert(r, j + 1), c = vert(r + 1, j), d = vert(r + 1, j + 1);
      idx.push(a, b, c, c, b, d);
    }
    if ((r & 15) === 15 && jobs.late()) yield;
  }
  yield;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const grain = grainTex();
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, grain: { value: null }, tile: { value: new THREE.Vector2((2 * E) / 2.2, len / 3.4) } }]),
    vertexShader: VERT, fragmentShader: FRAG, ...MULTIPLY, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
  });
  mat.uniforms.grain.value = grain;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  yield;
  const marks = yield* buildMarks({ P0: P[START], groundY, grain });
  loadPicture((tex) => jobs.add(function* raadiLine() {
    mat.uniforms.map.value = tex;
    group.add(mesh);
    if (marks) group.add(marks);
    jobs.upload(tex);                          // (the picture goes to the graphics card as this frame's last step)
  }, 'raadi line'));
  return { mesh, marks, quads: idx.length / 6, verts: n, runs: LINE.runs };
}
