// The Pirita-Kose lap's racing line, worn darker where the cars really drive, and their tyre marks (Martin 28 Nov 2026:
// "implement the ideal trajectory darker part and then some tire tracks that fit in nicely and are not too aggressive").
//
// Made from the laps driven there (every finished lap in Tallinn sends its drive, src/race/laplines.js):
// tools/race/pirita-lines.py sums the wheel paths of all of them and writes public/data/tln/pirita-line.json, fetched
// only by a Tallinn page:
//  band: how worn the road is, 0..255, on a grid laid along the lap: a row a metre, a column every half metre from E
//        metres left of the lap's line to E right (the line's way smoothed over TURN_M metres either side, so the grid
//        does not fold inside the tight corners; the tool reads the drives in the same frame);
//  marks: where a wheel slid, a ribbon each: [lap point, then x, z, width, strength per point] (cm from the lap's
//        first point, strength 0..100).
// Both are multiplied over the road as its patches and seals are (src/world/tln/multiply.js), so the road keeps its own
// light, colour and texture. Built a stretch at a time as the car comes near, through the work queue; a stretch is
// two meshes, the band's quads only where there is any wear, and none of it is a picture.
import * as THREE from 'three';
import LAP from '../../race/pirita.json';
import { jobs } from '../../jobs.js';
import { DATA } from '../../city.js';
import { multiplyMaterial } from './multiply.js';

const P = LAP.pts, N = P.length;
const SS = new Float64Array(N + 1);
for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % N]; SS[i + 1] = SS[i] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
const LEN = SS[N];
const TURN_M = 8;                    // (as tools/race/pirita-lines.py TURN_M)
const STRETCH = 200;                 // metres of the lap a mesh covers
const NEAR = 340, FAR = 520;         // built when the car is this near a stretch's middle; shown within FAR
// the road's colour where the wear is whole (a little darker, a touch cooler: rubber), and where a mark is
const RUBBER = [0.68, 0.68, 0.7], TYRE = [0.62, 0.62, 0.64];

function centre(s) {
  s = ((s % LEN) + LEN) % LEN;
  let lo = 0, hi = N - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SS[m] <= s) lo = m; else hi = m - 1; }
  const a = P[lo], b = P[(lo + 1) % N], t = (s - SS[lo]) / ((SS[lo + 1] - SS[lo]) || 1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, lo];
}
function frame(s) {
  const a = centre(s - TURN_M), b = centre(s + TURN_M), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float w;
varying float vW;
varying vec2 vP;
void main() {
  vW = w; vP = position.xz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  #include <fog_vertex>
  // (drawn where it lies but depth-tested a little nearer, as the road's other marks are)
  mvPosition.xyz *= max(0.05, 1.0 - 0.1 / max(length(mvPosition.xyz), 0.6));
  gl_Position = projectionMatrix * mvPosition;
}`;
const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
varying float vW;
varying vec2 vP;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
}
void main() {
  // rubber does not lie evenly: blotchy over metres, grainy close by
  float g = 0.7 + 0.45 * vn(vP * 0.55) + 0.25 * (vn(vP * 3.7) - 0.5);
  vec3 f = exp(clamp(pow(vW, 1.4) * g, 0.0, 1.3) * vec3(${RUBBER.map((v) => Math.log(v).toFixed(4)).join(', ')}));
  #ifdef USE_FOG
    f = mix(f, vec3(1.0), smoothstep(fogNear, fogFar, vFogDepth));
  #endif
  float al = clamp(max(max(1.0 - f.r, 1.0 - f.g), 1.0 - f.b), 0.0, 1.0);
  gl_FragColor = vec4(max(f - 1.0 + al, 0.0), al);
}`;
let bandMat = null;
const bandMaterial = () => (bandMat ||= new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
  fog: true, transparent: true, depthWrite: false, toneMapped: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
}));

// y(x, z, i): the road's top at (x, z) near lap point i; onRoad(x, z, margin): on a carriageway (src/world/tln/pirita.js)
export function createPiritaLine(group, { y, onRoad }) {
  let data = null, band = null, asked = false;
  const stretches = [];
  for (let s = 0; s < LEN; s += STRETCH) stretches.push({ s0: s, s1: Math.min(LEN, s + STRETCH), mid: centre(s + STRETCH / 2), built: false, band: null, marks: null });

  function load() {
    asked = true;
    if (new URLSearchParams(location.search).get('pline') === '0') return;     // (?pline=0: the road as before, for pictures)
    fetch(`${DATA}pirita-line.json`).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || j.v !== 1) return;
      const raw = atob(j.band);
      band = new Uint8Array(raw.length);
      for (let k = 0; k < raw.length; k++) band[k] = raw.charCodeAt(k);
      // the marks by the stretch they start in
      j.byStretch = stretches.map(() => []);
      for (const m of j.marks) j.byStretch[Math.min(stretches.length - 1, Math.floor(SS[m[0]] / STRETCH))].push(m);
      data = j;
    }).catch(() => {});
  }

  // a road's softened edge: 1 well on it, 0 off it
  const roadShare = (x, z) => (onRoad(x, z, -0.7) ? 0.4 : 0) + (onRoad(x, z, -0.35) ? 0.3 : 0) + (onRoad(x, z, 0) ? 0.3 : 0);

  function* buildBand(st) {
    const { rows, cols, os, od, e } = data;
    const r0 = Math.floor(st.s0 / os), r1 = Math.min(rows - 1, Math.ceil(st.s1 / os));
    const nr = r1 - r0 + 1;
    // (the last stretch reaches round to the first row, so the band closes over the line)
    const row = (r) => ((r % rows) + rows) % rows;
    const vid = new Int32Array((nr + 1) * cols).fill(-1);
    const pos = [], wa = [], idx = [];
    let n = 0;
    const vert = (q, c) => {
      const k = q * cols + c;
      if (vid[k] >= 0) return vid[k];
      const s = (r0 + q) * os, d = -e + c * od, [cx, cz, i] = centre(s), [tx, tz] = frame(s);
      const x = cx - tz * d, z = cz + tx * d;
      pos.push(x, y(x, z, i) + 0.025, z);
      wa.push((band[row(r0 + q) * cols + c] / 255) * roadShare(x, z));
      return (vid[k] = n++);
    };
    for (let q = 0; q < nr; q++) {
      const a = row(r0 + q) * cols, b = row(r0 + q + 1) * cols;
      for (let c = 0; c < cols - 1; c++) {
        if (band[a + c] < 4 && band[a + c + 1] < 4 && band[b + c] < 4 && band[b + c + 1] < 4) continue;
        const v0 = vert(q, c), v1 = vert(q, c + 1), v2 = vert(q + 1, c), v3 = vert(q + 1, c + 1);
        idx.push(v0, v2, v1, v1, v2, v3);
      }
      if ((q & 1) && jobs.late()) yield;
    }
    if (!idx.length) return null;
    yield;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('w', new THREE.Float32BufferAttribute(wa, 1));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, bandMaterial());
    mesh.renderOrder = 1;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  function* buildMarks(st) {
    const list = data.byStretch[stretches.indexOf(st)];
    if (!list.length) return null;
    const ox = P[0][0], oz = P[0][1];
    const pos = [], uv = [], fa = [], ka = [], idx = [];
    let n = 0;
    for (const m of list) {
      const c = (m.length - 1) / 4, i = m[0];
      let along = 0;
      for (let k = 0; k < c; k++) {
        const o = 1 + k * 4, x = ox + m[o] / 100, z = oz + m[o + 1] / 100, hw = m[o + 2] / 200, a = m[o + 3] / 100;
        const pa = 1 + Math.max(0, k - 1) * 4, pb = 1 + Math.min(c - 1, k + 1) * 4;
        const dx = m[pb] - m[pa], dz = m[pb + 1] - m[pa + 1], l = Math.hypot(dx, dz) || 1;
        if (k) along += Math.hypot(m[o] - m[o - 4], m[o + 1] - m[o - 3]) / 100;
        const sh = roadShare(x, z);
        for (const sd of [-1, 1]) {
          const vx = x - (dz / l) * hw * sd, vz = z + (dx / l) * hw * sd;
          pos.push(vx, y(vx, vz, i) + 0.03, vz);
          uv.push(sd < 0 ? 0 : 1, along + 3);              // (+3: no fade-in of its own, the strength does that)
          const t = a * sh;
          fa.push(1 + (TYRE[0] - 1) * t, 1 + (TYRE[1] - 1) * t, 1 + (TYRE[2] - 1) * t); ka.push(2);
        }
        if (k) idx.push(n - 2, n - 1, n, n, n - 1, n + 1);
        n += 2;
      }
      if (jobs.late()) yield;
    }
    yield;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('f', new THREE.Float32BufferAttribute(fa, 3));
    geo.setAttribute('k', new THREE.Float32BufferAttribute(ka, 1));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, multiplyMaterial());
    mesh.renderOrder = 2;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  return {
    // (for the tests and the pictures)
    info: () => ({ loaded: !!data, runs: data?.runs || 0, built: stretches.filter((s) => s.band || s.marks).length,
      quads: stretches.reduce((t, s) => t + (s.band ? s.band.geometry.index.count / 6 : 0), 0), marks: stretches.reduce((t, s) => t + (s.marks ? s.marks.geometry.index.count / 6 : 0), 0),
      w: (() => { let t = 0, n = 0, hi = 0; for (const s of stretches) if (s.band) for (const v of s.band.geometry.attributes.w.array) { t += v; n++; hi = Math.max(hi, v); } return [n ? +(t / n).toFixed(3) : 0, +hi.toFixed(3)]; })() }),
    update(car) {
      if (!car) return;
      if (!asked) load();
      if (!data) return;
      for (const st of stretches) {
        const d = Math.hypot(st.mid[0] - car.x, st.mid[1] - car.z);
        if (!st.built && d < NEAR) {
          st.built = true;
          jobs.add(function* piritaLine() {
            const b = yield* buildBand(st);
            yield;
            const m = yield* buildMarks(st);
            if (b) group.add(st.band = b);
            if (m) group.add(st.marks = m);
          }, 'pirita line');
        }
        const show = d < FAR;
        if (st.band) st.band.visible = show;
        if (st.marks) st.marks.visible = show;
      }
    },
  };
}
