// Tyre marks: a ring buffer of flat quads laid on the ground behind each wheel while its axle is sliding.
// A mark fades in as the slide builds and trails off when the tyre grips again, is darker the harder the
// tread rubs, and is as wide as the tyre is across its path: a tyre's width when it spins or locks in a
// straight line, broader when it is dragged sideways. The oldest marks are overwritten by the newest.
//
// What a mark looks like follows the ground under the wheel (Martin, 22 Nov 2026): black rubber on tarmac and
// concrete, the same broken up by the joints on setts and block paving, torn turf with the soil showing on grass,
// a groove with the stones pushed up either side on gravel and dirt. The look changes over half a metre or so
// where the ground does, and a tyre that has been churning grass or dirt carries mud onto the tarmac: brown
// prints of its tread, even rolling, fading out over the next 15 m or so.
//
// The hand-built places lay their paving and lawns a few centimetres over the map's ground (streetKit 5 to 9 cm),
// which used to hide the marks under them. A mark is now drawn where it lies, but tested for depth as if it were
// LIFT_DEPTH higher: its points are moved towards the camera along the line of sight (the picture does not move),
// so it lies on top of any layer laid by hand and behind anything taller.
import * as THREE from 'three';
import { groundLook, LOOK } from './world/groundlook.js';

const MAX = 3000;          // quads kept (about 750 m of marks)
const STEP = 0.25;         // metres between ribbon points
const TYRE = 0.2;          // tyre width, unless the car's spec gives its own (spec.tyreWidth: [front, rear])
const PATCH = 0.15;        // length of the contact patch: the width of a mark laid fully sideways
const LIFT = 0.025;        // above the ground, with polygon offset on top
const LIFT_DEPTH = 0.1;    // how much higher it is for the depth test (over the hand-laid ground, see above)
const TILE = 1.4;          // metres of mark per repeat of the texture

// The map's surface classes (data.js SURFACE: grass, paved, gravel, dirt, water) as looks
const GRID = [LOOK.GRASS, LOOK.PAVED, LOOK.GRAVEL, LOOK.DIRT, 0];
// per look: the pattern weights [setts, turf, groove, print] (rubber is what is left), colour, strength, width
const LOOKS = [];
// (the colour is what the ground under the mark is multiplied by where the mark is full: see the shader)
const RUBBER = [0.07, 0.07, 0.08];
LOOKS[LOOK.PAVED] = { w: [0, 0, 0, 0], c: RUBBER, s: 0.74, k: 1 };
LOOKS[LOOK.SETTS] = { w: [1, 0, 0, 0], c: RUBBER, s: 0.72, k: 1 };
LOOKS[LOOK.GRASS] = { w: [0, 1, 0, 0], c: [0.42, 0.3, 0.19], s: 0.9, k: 2.1 };
LOOKS[LOOK.GRAVEL] = { w: [0, 0, 1, 0], c: [0.6, 0.52, 0.42], s: 0.85, k: 1.8 };
LOOKS[LOOK.DIRT] = { w: [0, 0, 1, 0], c: [0.5, 0.4, 0.3], s: 0.85, k: 1.7 };
const MUD = [0.45, 0.34, 0.24];        // mud carried onto hard ground
const soft = (l) => l === LOOK.GRASS || l === LOOK.DIRT;
const hard = (l) => l === LOOK.PAVED || l === LOOK.SETTS;

// One small picture with a pattern in each channel (64 across the mark, 256 along it, wrapping along):
//  R rubber laid by a tyre: soft edges, heavier under the shoulders, faint tread lines, streaky along its length;
//  G soil where turf is torn up: soft clods and crumbs (the shape of the tear is worked out in the shader);
//  B a groove pressed into loose stones: speckled;
//  A the stones pushed up either side of it.
function markTexture() {
  const W = 64, H = 256, d = new Uint8Array(W * H * 4);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rows = new Float32Array(H), cols = new Float32Array(W);
  for (let y = 0; y < H; y++) rows[y] = rnd();
  for (let x = 0; x < W; x++) cols[x] = rnd();
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // smooth noise on a lattice that wraps (nx across, ny along)
  const lattice = (nx, ny) => { const g = new Float32Array(nx * ny); for (let i = 0; i < g.length; i++) g[i] = rnd(); return { g, nx, ny }; };
  const noise = ({ g, nx, ny }, u, v) => {
    const fx = u * nx, fy = v * ny, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const at = (x, y) => g[((y % ny) + ny) % ny * nx + ((x % nx) + nx) % nx];
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
  const edgeL = lattice(1, 24), clods = lattice(6, 40), fine = lattice(16, 96), stones = lattice(24, 120);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    // slow variation along the mark (wraps, so the tile repeats without a seam)
    const along = 0.84 + 0.1 * Math.sin(v * Math.PI * 2) + 0.06 * Math.sin(v * Math.PI * 6 + 1.3) + 0.05 * (rows[y] - 0.5);
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, o = (y * W + x) * 4;
      // rubber
      const edge = ss(0, 0.16, u) * ss(0, 0.16, 1 - u);
      const shoulder = 0.78 + 0.22 * Math.max(Math.exp(-(((u - 0.17) / 0.09) ** 2)), Math.exp(-(((u - 0.83) / 0.09) ** 2)));
      const groove = 1 - 0.16 * Math.max(Math.exp(-(((u - 0.37) / 0.022) ** 2)), Math.exp(-(((u - 0.5) / 0.022) ** 2)), Math.exp(-(((u - 0.63) / 0.022) ** 2)));
      const streak = 0.9 + 0.1 * cols[x];
      d[o] = Math.round(255 * Math.min(1, edge * shoulder * groove * streak * along * (0.94 + 0.06 * rnd())));
      // soil: clods and finer crumbs, soft
      const clod = noise(clods, u, v), grain = noise(fine, u, v);
      d[o + 1] = Math.round(255 * Math.min(1, 0.55 * clod + 0.45 * grain));
      // gravel: the groove under the tyre, speckled with stones, and the ridges pushed up beside it
      const st = noise(stones, u, v), sp = rnd();
      // (a broad trough, deepest under the tyre's middle, its edges wandering a little; the ridges outside it)
      const wob = 0.03 * (noise(edgeL, 0, v) - 0.5);
      const gr = ss(0.13 + wob, 0.32 + wob, u) * ss(0.13 - wob, 0.32 - wob, 1 - u) * (0.75 + 0.25 * Math.exp(-(((u - 0.5) / 0.2) ** 2)));
      d[o + 2] = Math.round(255 * Math.min(1, gr * (0.45 + 0.4 * st + 0.25 * sp) * (0.9 + 0.1 * along)));
      const ridge = Math.max(Math.exp(-(((u - 0.1 - wob) / 0.055) ** 2)), Math.exp(-(((u - 0.9 + wob) / 0.055) ** 2)));
      d[o + 3] = Math.round(255 * Math.min(1, ridge * (0.45 + 0.8 * st) * (sp > 0.2 ? 1 : 0.35) * (0.7 + 0.3 * noise(clods, u, v + 0.5))));
    }
  }
  const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// How a mark is drawn. It does not paint a colour over the ground: it multiplies what is already there (the
// blending below), so a rut keeps the grass photo's own light, shade and texture under it, and the ground darkens
// or browns rather than being covered. The factor per look, at full strength:
//  - rubber (tarmac, setts, a muddy print): towards the tint where the pattern is;
//  - turf: a wide soft band of grass pressed flat (a little darker and yellower, streaked along the way the tyre
//    went), and inside it, once the slide is hard enough, soil where the turf tore: the harder the slide, the
//    wider the tear, with wandering edges, a slightly lighter lip of turf thrown up along them, and crumbs;
//  - groove (gravel, dirt): darker in the trough, lighter where the stones were pushed up.
// Factors over 1 lighten. The blend is out = src * dst + dst * (1 - srcAlpha), so a factor f is sent as
// alpha = largest of 1 - f, and colour = f - 1 + alpha.
const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec4 tint;
attribute vec4 look;
varying vec2 vUv;
varying vec4 vTint;
varying vec4 vLook;
varying vec3 vW;
void main() {
  vUv = uv; vTint = tint; vLook = look; vW = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  #include <fog_vertex>
  vec3 ray = normalize(mvPosition.xyz);
  float s = max(abs(dot(ray, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz))), 0.04);
  mvPosition.xyz -= ray * (${LIFT_DEPTH.toFixed(3)} / s);      // ${LIFT_DEPTH} m higher, as far as depth goes
  gl_Position = projectionMatrix * mvPosition;
}`;
const FRAG = /* glsl */ `
#define TILE ${TILE.toFixed(2)}
#include <common>
#include <fog_pars_fragment>
uniform sampler2D map;
uniform float grassMode;
uniform vec3 sunDir;
varying vec2 vUv;
varying vec4 vTint;
varying vec4 vLook;
varying vec3 vW;
float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
// C (Martin 23 Nov 2026, "something very real"): the mark as a shape in the ground, lit by the sun. The height
// across and along the mark (metres): a trough as wide as the tyre, the ground it pushed aside heaped beside it, and
// the tread pressed into the bottom: blocks when the tyre rolls, combed lines when it slides.
// q: x across the mark (-1 to 1), y along it in metres; D: depth; tH: half the tyre's share of the mark's width.
float rutH(vec2 q, float D, float tH, float smear, float wv) {
  float ax = abs(q.x), side = step(0.0, q.x);
  float e = ax + ((n1(q.y * 5.0 + side * 17.0) - 0.5) * 0.08 + (n1(q.y * 23.0 + side * 5.0) - 0.5) * 0.04) * wv;
  float trough = 1.0 - smoothstep(tH - 0.16, tH + 0.02, e);
  float berm = exp(-pow((e - tH - 0.1) / 0.09, 2.0));
  float t = fract(q.y * 14.0 + ax * 0.7);
  float lug = smoothstep(0.3, 0.42, t) * smoothstep(0.9, 0.78, t) * smoothstep(0.02, 0.06, fract(ax * 2.6 + 0.3)) * smoothstep(0.02, 0.06, 1.0 - fract(ax * 2.6 + 0.3));
  float ln = floor(q.x * 34.0);
  float comb = h1(ln + 7.0) * (0.6 + 0.4 * n1(q.y * 9.0 + ln));
  return D * (0.45 * berm - trough) + 0.004 * mix(lug, comb, smear) * trough;
}
// C: the factor for a mark in grass (grass 1) or loose earth (grass 0), with its relief lit by the sun
vec3 realMark(float a, vec3 tint, vec4 sk, float grass, vec2 gu, vec2 gv) {
  vec3 one = vec3(1.0);
  float d = clamp(a / 0.9, 0.0, 1.0);
  vec2 q = vec2(vUv.x * 2.0 - 1.0, vUv.y * TILE);
  float tH = mix(0.58, 0.48, grass);
  // grass tears open only in a hard slide, in patches; earth is dug all along
  // grass (Martin 23 Nov 2026 evening: "more consistent, not a lot of variance"): one even rut whose depth and torn
  // core follow the slide's strength alone, edges nearly straight; earth and gravel keep their wander
  float torn = grass > 0.5 ? smoothstep(0.55, 0.95, d) : 1.0;
  float D = grass > 0.5 ? 0.004 + 0.022 * d : 0.008 + 0.035 * d;
  float wv = grass > 0.5 ? 0.3 : 1.0;
  float smear = smoothstep(0.25, 0.7, d);
  float h0 = rutH(q, D, tH, smear, wv);
  float hx = (rutH(q + vec2(0.02, 0.0), D, tH, smear, wv) - rutH(q - vec2(0.02, 0.0), D, tH, smear, wv)) / 0.04;
  float hv = (rutH(q + vec2(0.0, 0.01), D, tH, smear, wv) - rutH(q - vec2(0.0, 0.01), D, tH, smear, wv)) / 0.02;
  vec2 eye = vW.xz - cameraPosition.xz;
  float dist = length(eye);
  // the slope on the ground (fades out far away, where it would only shimmer)
  vec2 gh = (2.0 * hx * gu + TILE * hv * gv) * (1.0 - smoothstep(30.0, 80.0, dist));
  gh *= 1.0 / max(1.0, length(gh) / 1.2);
  vec3 n = normalize(vec3(-gh.x, 1.0, -gh.y));
  float lit = (0.55 + max(dot(n, sunDir), 0.0)) / (0.55 + max(sunDir.y, 0.05));
  float ao = 1.0 - 0.3 * clamp(-h0 / 0.04, 0.0, 1.0);
  // what the ground is made of where it is
  float ax = abs(q.x);
  float trough = 1.0 - smoothstep(tH - 0.12, tH + 0.04, ax + (sk.g - 0.5) * 0.12 * wv);
  float berm = exp(-pow((ax - tH - 0.1) / 0.1, 2.0));
  vec3 base; float wet;
  if (grass > 0.5) {
    // crushed blades the width of the tyre, evenly a shade darker; in a harder slide a steady core of soil down the
    // middle of it, wet and dark, as even as the slide
    vec3 crushed = mix(one, vec3(0.88, 0.9, 0.8), trough * (0.35 + 0.65 * smoothstep(0.0, 0.6, d)));
    float core = 1.0 - smoothstep(tH * 0.5, tH * 0.72, ax + (sk.g - 0.5) * 0.04);
    float soil = 0.85 * torn * core;
    vec3 earth = tint * (1.0 + 0.2 * sk.g);
    base = mix(crushed, earth, soil);
    wet = soil;
  } else {
    // earth and gravel: the bottom pressed smooth and a shade darker, the loose stuff pushed up lighter, stones in it
    base = mix(one, tint * (0.9 + 0.25 * sk.b), trough * (0.3 + 0.4 * d)) * (1.0 + 0.18 * berm * (0.6 + 0.8 * sk.a));
    wet = 0.4 * trough * d;
  }
  vec3 V = normalize(cameraPosition - vW);
  float spec = pow(max(dot(n, normalize(sunDir + V)), 0.0), 60.0) * 0.4 * wet;
  vec3 fC = base * lit * ao + spec;
  // clods thrown out in a hard slide: little lumps lit on the sun's side, each with its shadow
  vec2 cg = vec2(vUv.x * 6.0, vUv.y * 14.0), ci = floor(cg), cf = fract(cg) - 0.5;
  float ha = fract(sin(dot(ci, vec2(41.3, 289.1))) * 43758.5453), hb = fract(sin(dot(ci, vec2(17.7, 113.9))) * 23421.631);
  float p = grass > 0.5 ? 0.0 : 0.35 * smoothstep(0.6, 1.0, d) * smoothstep(0.3, 0.8, ax);   // (none on grass: kept even)
  if (hb < p) {
    vec2 cq = (cf - (vec2(ha, hb) - 0.5) * 0.4) * vec2(7.0, 10.0);
    float r = 1.2 + 2.2 * fract(ha * 7.13);
    vec2 du = gu / max(length(gu), 1e-6), dv = gv / max(length(gv), 1e-6);
    vec2 sm = vec2(dot(sunDir.xz, du), dot(sunDir.xz, dv));       // the sun's way in the mark's own directions
    float shadow = 1.0 - smoothstep(r * 0.5, r, length(cq + sm * r * 1.2));
    float body = 1.0 - smoothstep(r * 0.75, r, length(cq));
    vec2 l = cq / r;
    vec3 nc = normalize(vec3(l.x * du.x + l.y * dv.x, 0.9, l.x * du.y + l.y * dv.y));
    float cl = (0.55 + max(dot(nc, sunDir), 0.0)) / (0.55 + max(sunDir.y, 0.05));
    fC *= 1.0 - 0.35 * shadow * (1.0 - body);
    fC = mix(fC, tint * (0.8 + 0.35 * fract(hb * 13.7)) * cl, body);
  }
  return fC;
}
void main() {
  // how the mark's u (across) and v (along) change per metre on the ground, from how they and the ground position
  // change across the screen (worked out here, before any branch, where screen derivatives are well defined)
  vec2 px = dFdx(vW.xz), py = dFdy(vW.xz);
  float det = px.x * py.y - px.y * py.x;
  det = abs(det) < 1e-12 ? 1e-12 : det;
  vec2 ux = vec2(dFdx(vUv.x), dFdy(vUv.x)), vx = vec2(dFdx(vUv.y), dFdy(vUv.y));
  vec2 gu = vec2(py.y * ux.x - px.y * ux.y, px.x * ux.y - py.x * ux.x) / det;
  vec2 gv = vec2(py.y * vx.x - px.y * vx.y, px.x * vx.y - py.x * vx.x) / det;
  vec4 sk = texture2D(map, vUv);
  vec3 tint = vTint.rgb;
  float a = vTint.a;
  float wR = max(0.0, 1.0 - vLook.x - vLook.y - vLook.z - vLook.w);
  vec3 one = vec3(1.0);
  vec3 f = one * (wR + vLook.y + vLook.z + vLook.x + vLook.w);
  // rubber
  f -= wR * (one - mix(one, tint, a * sk.r));
  // setts and block paving: rubber on the stones' tops, none in the joints, each stone its own share
  if (vLook.x > 0.001) {
    vec2 g = vec2(vUv.x * 2.6, vUv.y * 13.0);
    g.y += 0.5 * mod(floor(g.x), 2.0);
    vec2 q = fract(g), id = floor(g);
    float joint = smoothstep(0.0, 0.16, q.x) * smoothstep(0.0, 0.16, 1.0 - q.x) * smoothstep(0.0, 0.12, q.y) * smoothstep(0.0, 0.12, 1.0 - q.y);
    float stone = 0.55 + 0.45 * fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
    f -= vLook.x * (one - mix(one, tint, a * sk.r * joint * stone));
  }
  // turf
  if (vLook.y > 0.001 && abs(grassMode - 1.0) < 0.5) {
    // grass B (Martin 23 Nov 2026, to compare): mostly grass laid flat, which shows by its sheen rather than as a
    // rut. Blades combed over the way the tyre went are lighter seen along that way and darker seen against it (as
    // mown stripes in a lawn), so a slide reads pale from behind and a donut shows light and dark arcs. Only a hard
    // slide or wheelspin tears the turf, in chunks, not one ribbon: dark wet soil with the tread printed in it and
    // clods thrown out beside it.
    float d = clamp(a / 0.9, 0.0, 1.0);
    float x = abs(vUv.x - 0.5) * 2.0;
    float side = step(0.5, vUv.x);
    // the way the tyre went: how far along the mark changes across the screen, turned into metres on the ground
    vec2 g = gv;
    vec2 dir = g / max(length(g), 1e-6);
    vec2 eye = vW.xz - cameraPosition.xz;
    float sh = dot(eye / max(length(eye), 1e-3), dir) * step(1e-6, length(g));
    float wob = (n1(vUv.y * 7.0 + side * 17.0) - 0.5) * 0.12 + (n1(vUv.y * 40.0 + side * 5.0) - 0.5) * 0.05;
    float band = 1.0 - smoothstep(0.5, 0.64, x + wob);
    float line = floor(vUv.x * 46.0);
    float comb = 0.6 + 0.6 * h1(line + 1.0) * (0.6 + 0.4 * n1(vUv.y * 21.0 + line * 3.7));
    float press = clamp(band * comb * (0.3 + 0.7 * smoothstep(0.0, 0.55, d)), 0.0, 1.0);
    vec3 fP = (one + sh * vec3(0.28, 0.27, 0.32)) * vec3(0.95, 0.97, 0.9);
    vec3 fT = mix(one, fP, press);
    // torn turf in chunks along the way, wider the harder the slide
    float chunk = 0.6 * n1(vUv.y * 3.3 + side * 3.0 + 11.0) + 0.4 * n1(vUv.y * 13.0 + side * 9.0);
    float tearW = 0.4 * smoothstep(0.8, 1.1, d * (0.4 + 0.9 * chunk));
    float rag = (sk.g - 0.5) * 0.24 + wob;
    float soil = (1.0 - smoothstep(tearW - 0.12, tearW, x + rag)) * step(0.03, tearW);
    float rim = exp(-pow((x + rag - tearW - 0.05) / 0.06, 2.0)) * step(0.03, tearW);
    float t = fract(vUv.y * 30.0 + x * 0.8);
    float lug = smoothstep(0.4, 0.55, t) * smoothstep(0.95, 0.8, t);
    vec3 wet = tint * (0.72 + 0.5 * sk.g) * (0.86 + 0.24 * lug);
    fT = mix(fT * (1.0 - 0.18 * rim), wet, soil);
    // clods: bits of soil and turf thrown out, more and further the harder the slide
    vec2 cg = vec2(vUv.x * 6.0, vUv.y * 14.0), ci = floor(cg), cf = fract(cg) - 0.5;
    float ha = fract(sin(dot(ci, vec2(41.3, 289.1))) * 43758.5453), hb = fract(sin(dot(ci, vec2(17.7, 113.9))) * 23421.631);
    float p = 0.3 * smoothstep(0.6, 1.0, d) * smoothstep(0.25, 0.75, x) * smoothstep(0.3, 0.7, chunk);
    vec2 cq = (cf - (vec2(ha, hb) - 0.5) * 0.5) * vec2(7.0, 10.0);
    float r = 1.5 + 2.5 * fract(ha * 7.13);
    float clod = (1.0 - smoothstep(r * 0.55, r, length(cq))) * step(hb, p);
    fT = mix(fT, tint * (fract(hb * 13.7) > 0.4 ? 0.85 : 1.25) * (0.85 + 0.4 * sk.g), clod * (1.0 - soil) * (0.6 + 0.4 * fract(ha * 3.1)));
    f -= vLook.y * (one - fT);
  } else if (vLook.y > 0.001 && grassMode > 1.5) {
    f -= vLook.y * (one - realMark(a, tint, sk, 1.0, gu, gv));
  } else if (vLook.y > 0.001) {
    float d = clamp(a / 0.9, 0.0, 1.0);
    float x = abs(vUv.x - 0.5) * 2.0;                              // 0 in the middle, 1 at the edge
    float side = step(0.5, vUv.x);
    float wob = (n1(vUv.y * 9.0 + side * 17.0) - 0.5) * 0.18 + (n1(vUv.y * 31.0 + side * 5.0) - 0.5) * 0.06;
    float pressed = (1.0 - smoothstep(0.45, 1.0, x + wob * 0.5)) * (0.78 + 0.44 * h1(floor(vUv.x * 19.0) + 3.0));
    float tear = 0.5 * smoothstep(0.3, 0.95, d * (0.6 + 0.7 * n1(vUv.y * 2.3 + 7.0)));
    float soil = (1.0 - smoothstep(tear - 0.16, tear + 0.02, x + wob)) * step(0.02, tear);
    float lip = exp(-pow((x + wob - tear - 0.1) / 0.1, 2.0)) * smoothstep(0.08, 0.3, tear);
    vec3 fT = mix(one, vec3(0.78, 0.8, 0.6), clamp(pressed * (0.3 + 0.5 * d), 0.0, 1.0))
      * mix(one, tint * (0.55 + 0.9 * sk.g), soil * (0.35 + 0.4 * d))
      * (1.0 + 0.08 * lip);
    f -= vLook.y * (one - fT);
  }
  // groove in loose ground, the ridges lighter
  if (vLook.z > 0.001) {
    vec3 fG = grassMode > 1.5 ? realMark(a, tint, sk, 0.0, gu, gv) : mix(one, tint, a * sk.b) * (1.0 + 0.45 * a * sk.a * (1.0 - sk.b));
    f -= vLook.z * (one - fG);
  }
  // a muddy tread: lugs across the tyre, angled out from its middle
  if (vLook.w > 0.001) {
    float t = fract(vUv.y * 36.0 + abs(vUv.x - 0.5) * 1.6);
    float lug = smoothstep(0.35, 0.5, t) * smoothstep(0.95, 0.8, t);
    f -= vLook.w * (one - mix(one, tint, a * sk.r * (0.35 + 0.65 * lug)));
  }
  #ifdef USE_FOG
    f = mix(f, one, smoothstep(fogNear, fogFar, vFogDepth));
  #endif
  float al = clamp(max(max(1.0 - f.r, 1.0 - f.g), 1.0 - f.b), 0.0, 1.0);
  gl_FragColor = vec4(max(f - 1.0 + al, 0.0), al);
}`;

export function createSkidMarks(world) {
  const pos = new Float32Array(MAX * 4 * 3);
  const col = new Float32Array(MAX * 4 * 4);
  const uv = new Float32Array(MAX * 4 * 2);
  const lk = new Float32Array(MAX * 4 * 4);
  const idx = new Uint16Array(MAX * 6);
  for (let q = 0; q < MAX; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3], q * 6);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aCol = new THREE.BufferAttribute(col, 4), aUv = new THREE.BufferAttribute(uv, 2), aLook = new THREE.BufferAttribute(lk, 4);
  const attrs = [aPos, aCol, aUv, aLook];
  for (const a of attrs) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos);
  geo.setAttribute('tint', aCol);
  geo.setAttribute('uv', aUv);
  geo.setAttribute('look', aLook);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, grassMode: { value: 0 }, sunDir: { value: new THREE.Vector3(0.5, 0.44, -0.75).normalize() } }]),
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    // (pulled nearer by the slope at least as much as any ground layer is: streetKit's go to -6, groundLayer's -4 and
    // down by half a step per texture)
    polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -8,
  });
  mat.uniforms.map.value = markTexture();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  let next = 0;
  // per wheel: the last ribbon point (centre, its two edges, strength, distance along the mark, heading), the
  // look there (pattern weights L, colour C), and the mud the tyre carries
  const wheelSet = () => [0, 1, 2, 3].map(() => ({ on: false, x: 0, z: 0, lx: 0, ly: 0, lz: 0, rx: 0, ry: 0, rz: 0, a: 0, v: 0, tx: 0, tz: 0, hw: TYRE / 2,
    L: [0, 0, 0, 0], C: RUBBER, mud: 0, mx: 0, mz: 0, look: LOOK.PAVED }));
  const mine = wheelSet(), theirs = new Map();

  // the look under a point: what a hand-built place laid there, else the map's surface (0 on water). With y (the
  // car's height), a roof or bridge deck it stands on (ERM roof, world.addSlab / decks) is tarmac, not the grass below
  const lookAt = (x, z, y) => (y !== undefined && world.groundAt(x, z, y + 0.4) > world.heightAt(x, z) + 0.3 ? LOOK.PAVED : 0)
    || groundLook(x, z) || GRID[world.surfaceAt(x, z)] || 0;

  // one quad from the wheel's last point to a new one (its look L, colour C)
  function quad(w, lx, ly, lz, rx, ry, rz, a, v, L, C) {
    const o = next * 12, c = next * 16, t = next * 8;
    pos[o] = w.lx; pos[o + 1] = w.ly; pos[o + 2] = w.lz;
    pos[o + 3] = w.rx; pos[o + 4] = w.ry; pos[o + 5] = w.rz;
    pos[o + 6] = lx; pos[o + 7] = ly; pos[o + 8] = lz;
    pos[o + 9] = rx; pos[o + 10] = ry; pos[o + 11] = rz;
    for (let k = 0; k < 4; k++) {
      const P = k < 2 ? w.C : C, Q = k < 2 ? w.L : L;
      col[c + k * 4] = P[0]; col[c + k * 4 + 1] = P[1]; col[c + k * 4 + 2] = P[2];
      col[c + k * 4 + 3] = k < 2 ? w.a : a;
      lk[c + k * 4] = Q[0]; lk[c + k * 4 + 1] = Q[1]; lk[c + k * 4 + 2] = Q[2]; lk[c + k * 4 + 3] = Q[3];
    }
    uv[t] = 0; uv[t + 1] = w.v; uv[t + 2] = 1; uv[t + 3] = w.v; uv[t + 4] = 0; uv[t + 5] = v; uv[t + 6] = 1; uv[t + 7] = v;
    // only this quad goes to the graphics card again (three.js joins neighbouring ranges), not all 3000
    aPos.addUpdateRange(o, 12); aCol.addUpdateRange(c, 16); aUv.addUpdateRange(t, 8); aLook.addUpdateRange(c, 16);
    next = (next + 1) % MAX;
    for (const at of attrs) at.needsUpdate = true;
  }

  // the tyre grips again: the mark thins out over a short tail instead of stopping dead
  function close(w) {
    if (w.on && w.a > 0.01 && (w.tx || w.tz)) {
      const L = STEP * 2.2, x = w.x + w.tx * L, z = w.z + w.tz * L, hw = w.hw * 0.8;
      const y = world.groundAt(x, z, w.ly + 0.4) + LIFT;
      quad(w, x + w.tz * hw, y, z - w.tx * hw, x - w.tz * hw, y, z + w.tx * hw, 0, w.v + L / TILE, w.L, w.C);
    }
    w.on = false;
  }

  // other players' cars (multiplayer.js remotes()) lay marks too, while they are near enough to be seen
  function updateOthers(list, me) {
    for (const o of list) {
      if (!o.tyres || (me && (o.x - me.x) ** 2 + (o.z - me.z) ** 2 > 350 * 350)) continue;
      let set = theirs.get(o.id);
      if (!set) theirs.set(o.id, set = wheelSet());
      update(o, set);
    }
    if (theirs.size > list.length) for (const [id, set] of [...theirs]) if (!list.some((o) => o.id === id)) { set.forEach(close); theirs.delete(id); }
  }

  const tL = [0, 0, 0, 0], tC = [0, 0, 0];
  function update(car, wheels = mine) {
    const live = !car.inWater;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    const sx = Math.cos(car.yaw), sz = Math.sin(car.yaw);
    const ht = car.spec.track / 2;
    for (let i = 0; i < 4; i++) {
      const w = wheels[i];
      const front = i < 2;
      const along = front ? car.a : -car.b, side = i % 2 ? ht : -ht;
      const x = car.x + fx * along + sx * side, z = car.z + fz * along + sz * side;
      // mud: picked up on grass and dirt, worn off on hard ground (and quicker on gravel), washed off in water
      if (!live) w.mud = 0;
      else if (!car.airborne) {
        const dm = Math.hypot(x - w.mx, z - w.mz);
        if (dm > 3) { w.mx = x; w.mz = z; }
        else if (dm >= STEP) {
          w.look = lookAt(x, z, car.y);
          w.mud = soft(w.look) ? Math.min(1, w.mud + dm * 0.6) : w.mud * Math.exp(-dm / (hard(w.look) ? 5 : 2.5));
          w.mx = x; w.mz = z;
        }
      }
      const k = live ? (front ? car.skidF : car.skidR) || 0 : 0;
      const print = w.mud > 0.05 && hard(w.look) && !car.airborne;      // a muddy tyre rolling on tarmac
      if (k < 0.08 && !print) { close(w); continue; }
      const dx = x - w.x, dz = z - w.z, d = Math.hypot(dx, dz);
      if (w.on && d > 3) w.on = false;              // the car was moved: not one mark
      if (w.on && d < STEP) continue;
      const look = lookAt(x, z, car.y);
      if (!look) { w.on = false; continue; }
      // what is laid here: the ground's own look, with mud over it from a tyre that carries some
      const G = LOOKS[look], m = hard(look) ? w.mud : 0;
      const skid = k >= 0.08;
      for (let j = 0; j < 4; j++) tL[j] = G.w[j];
      if (m > 0) { const p = skid ? m * 0.6 : 1; for (let j = 0; j < 4; j++) tL[j] *= 1 - p; tL[3] += p; }
      for (let j = 0; j < 3; j++) tC[j] = G.c[j] + (MUD[j] - G.c[j]) * Math.min(1, m * 1.4);
      const y = world.groundAt(x, z, car.y + 0.4) + LIFT;
      const tyre = car.spec.tyreWidth ? car.spec.tyreWidth[front ? 0 : 1] : TYRE;
      if (!w.on) {
        // a new mark starts from nothing and builds over the next points
        const hw = tyre / 2 * G.k;
        Object.assign(w, { on: true, x, z, a: 0, v: Math.random(), tx: 0, tz: 0, hw,
          lx: x - sx * hw, ly: y, lz: z - sz * hw, rx: x + sx * hw, ry: y, rz: z + sz * hw });
        w.L = [...tL]; w.C = [...tC];
        continue;
      }
      // strength: how far over the limit the tyre is, and how fast the tread is rubbing; a print: how muddy it is
      let want = 0;
      if (skid) {
        const rub = (front ? car.rubF : car.rubR) ?? 6;
        const k1 = Math.min(1, (k - 0.08) / 0.55);
        want = G.s * k1 * k1 * (3 - 2 * k1) * (0.5 + 0.5 * Math.min(1, rub / 7));
      }
      if (m > 0) want = Math.max(want, 0.65 * Math.min(1, m * 1.2));
      const a = w.a + (want - w.a) * (want > w.a ? 0.3 : 0.45);
      // the look turns into the next one over about half a metre
      const L = w.L.map((q, j) => q + (tL[j] - q) * 0.5), C = w.C.map((q, j) => q + (tC[j] - q) * 0.5);
      // width: the tyre seen across its path (wider in loose ground: what it throws up beside it)
      const tx = dx / d, tz = dz / d;
      const yawW = car.yaw + (front ? car.steer || 0 : 0);
      const cb = Math.abs(tx * Math.sin(yawW) - tz * Math.cos(yawW)), sb = Math.sqrt(Math.max(0, 1 - cb * cb));
      const hw = (w.hw + (Math.max(0.1, tyre * cb + PATCH * sb) / 2 * G.k - w.hw) * 0.5);
      const px = -tz, pz = tx;
      const lx = x - px * hw, lz = z - pz * hw, rx = x + px * hw, rz = z + pz * hw;
      const v = w.v + d / TILE;
      if (!w.tx && !w.tz) {
        // the first point was laid across the car: turn it across the path now that there is one
        const h0 = w.hw; w.lx = w.x - px * h0; w.lz = w.z - pz * h0; w.rx = w.x + px * h0; w.rz = w.z + pz * h0;
      }
      quad(w, lx, y, lz, rx, y, rz, a, v, L, C);
      w.x = x; w.z = z; w.a = a; w.v = v; w.tx = tx; w.tz = tz; w.hw = hw; w.L = L; w.C = C;
      w.lx = lx; w.ly = y; w.lz = lz; w.rx = rx; w.ry = y; w.rz = rz;
    }
  }

    // grass marks A (torn soil ruts, #513), B (grass laid flat with its sheen, #537) or C (the mark as a shape in the
  // ground lit by the sun, also on gravel and dirt): all in the one shader, so switching costs nothing and changes the
  // marks already laid too. setSun: the way to the sun (sky.js createLights' sunOffset).
  const MODES = { a: 0, b: 1, c: 2 };
  const setGrass = (k) => { mat.uniforms.grassMode.value = MODES[k] ?? 0; };
  const setSun = (v) => { mat.uniforms.sunDir.value.copy(v).normalize(); };
  return { mesh, update: (car) => update(car), updateOthers, get count() { return next; }, lookAt, setGrass, setSun, get grass() { return 'abc'[mat.uniforms.grassMode.value]; } };
}
