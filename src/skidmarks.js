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
LOOKS[LOOK.PAVED] = { w: [0, 0, 0, 0], c: [0.03, 0.03, 0.04], s: 0.74, k: 1 };
LOOKS[LOOK.SETTS] = { w: [1, 0, 0, 0], c: [0.03, 0.03, 0.04], s: 0.72, k: 1 };
LOOKS[LOOK.GRASS] = { w: [0, 1, 0, 0], c: [0.035, 0.02, 0.009], s: 0.9, k: 1.4 };
LOOKS[LOOK.GRAVEL] = { w: [0, 0, 1, 0], c: [0.09, 0.068, 0.042], s: 0.85, k: 1.8 };
LOOKS[LOOK.DIRT] = { w: [0, 0, 1, 0], c: [0.055, 0.035, 0.018], s: 0.85, k: 1.7 };
const MUD = [0.06, 0.036, 0.018];        // mud carried onto hard ground
const soft = (l) => l === LOOK.GRASS || l === LOOK.DIRT;
const hard = (l) => l === LOOK.PAVED || l === LOOK.SETTS;

// One small picture with a pattern in each channel (64 across the mark, 256 along it, wrapping along):
//  R rubber laid by a tyre: soft edges, heavier under the shoulders, faint tread lines, streaky along its length;
//  G turf torn up: ragged edges, clods and tufts left standing;
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
  const edgeL = lattice(1, 24), edgeR = lattice(1, 24), clods = lattice(6, 40), fine = lattice(16, 96), stones = lattice(24, 120);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    // slow variation along the mark (wraps, so the tile repeats without a seam)
    const along = 0.84 + 0.1 * Math.sin(v * Math.PI * 2) + 0.06 * Math.sin(v * Math.PI * 6 + 1.3) + 0.05 * (rows[y] - 0.5);
    const eL = 0.04 + 0.16 * noise(edgeL, 0, v), eR = 0.04 + 0.16 * noise(edgeR, 0, v);
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, o = (y * W + x) * 4;
      // rubber
      const edge = ss(0, 0.16, u) * ss(0, 0.16, 1 - u);
      const shoulder = 0.78 + 0.22 * Math.max(Math.exp(-(((u - 0.17) / 0.09) ** 2)), Math.exp(-(((u - 0.83) / 0.09) ** 2)));
      const groove = 1 - 0.16 * Math.max(Math.exp(-(((u - 0.37) / 0.022) ** 2)), Math.exp(-(((u - 0.5) / 0.022) ** 2)), Math.exp(-(((u - 0.63) / 0.022) ** 2)));
      const streak = 0.9 + 0.1 * cols[x];
      d[o] = Math.round(255 * Math.min(1, edge * shoulder * groove * streak * along * (0.94 + 0.06 * rnd())));
      // turf: a ragged band of soil, clods in it, a few tufts left
      const band = ss(eL, eL + 0.1, u) * ss(eR, eR + 0.1, 1 - u);
      const clod = noise(clods, u, v), grain = noise(fine, u, v);
      const tuft = ss(0.7, 0.82, noise(fine, u + 0.37, v + 0.21)) * 0.8;
      d[o + 1] = Math.round(255 * Math.min(1, band * (0.5 + 0.6 * clod) * (0.75 + 0.35 * grain) * (1 - tuft)));
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

// the patterns mixed by the look weights; the depth lift in the vertex shader
function dress(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 look;\nvarying vec4 vLook;')
    .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')      // flat on the ground (no normals to keep)
    .replace('#include <project_vertex>', `#include <project_vertex>
      vLook = look;
      {
        vec3 ray = normalize(mvPosition.xyz);
        float s = max(abs(dot(ray, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz))), 0.04);
        mvPosition.xyz -= ray * (${LIFT_DEPTH.toFixed(3)} / s);      // ${LIFT_DEPTH} m higher, as far as depth goes
        gl_Position = projectionMatrix * mvPosition;
      }`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec4 vLook;')
    .replace('#include <map_fragment>', '')
    .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec4 sk = texture2D(map, vMapUv);
        float wR = max(0.0, 1.0 - vLook.x - vLook.y - vLook.z - vLook.w);
        // setts and block paving: rubber on the stones' tops, none in the joints, each stone its own share
        vec2 g = vec2(vMapUv.x * 2.6, vMapUv.y * 13.0);
        g.y += 0.5 * mod(floor(g.x), 2.0);
        vec2 f = fract(g), id = floor(g);
        float joint = smoothstep(0.0, 0.16, f.x) * smoothstep(0.0, 0.16, 1.0 - f.x) * smoothstep(0.0, 0.12, f.y) * smoothstep(0.0, 0.12, 1.0 - f.y);
        float stone = 0.55 + 0.45 * fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
        // a muddy tread: lugs across the tyre, angled out from its middle
        float lug = smoothstep(0.35, 0.5, fract(vMapUv.y * 36.0 + abs(vMapUv.x - 0.5) * 1.6)) * smoothstep(0.95, 0.8, fract(vMapUv.y * 36.0 + abs(vMapUv.x - 0.5) * 1.6));
        float groove = sk.b, ridge = sk.a;
        float a = wR * sk.r + vLook.x * sk.r * joint * stone + vLook.y * sk.g + vLook.z * max(groove, ridge) + vLook.w * sk.r * (0.35 + 0.65 * lug);
        // the ridges are the loose stones turned up: lighter than the groove
        float up = vLook.z * ridge / max(groove + ridge, 0.001);
        diffuseColor.rgb = mix(diffuseColor.rgb, min(vec3(1.0), diffuseColor.rgb * 5.5 + 0.12), clamp(up, 0.0, 1.0));
        diffuseColor.a *= a;
      }`);
}

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
  geo.setAttribute('color', aCol);
  geo.setAttribute('uv', aUv);
  geo.setAttribute('look', aLook);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  // (lit like the ground, shadows included: a soil-brown rut drawn unlit was lighter than the grass beside it in a
  // tree's shade)
  const mat = new THREE.MeshLambertMaterial({
    map: markTexture(), vertexColors: true, transparent: true, depthWrite: false,
    // (pulled nearer by the slope at least as much as any ground layer is: streetKit's go to -6, groundLayer's -4 and
    // down by half a step per texture)
    polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -8,
  });
  mat.onBeforeCompile = dress;
  mat.customProgramCacheKey = () => 'skidmarks2';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.receiveShadow = true;

  let next = 0;
  // per wheel: the last ribbon point (centre, its two edges, strength, distance along the mark, heading), the
  // look there (pattern weights L, colour C), and the mud the tyre carries
  const wheelSet = () => [0, 1, 2, 3].map(() => ({ on: false, x: 0, z: 0, lx: 0, ly: 0, lz: 0, rx: 0, ry: 0, rz: 0, a: 0, v: 0, tx: 0, tz: 0, hw: TYRE / 2,
    L: [0, 0, 0, 0], C: [0.03, 0.03, 0.04], mud: 0, mx: 0, mz: 0, look: LOOK.PAVED }));
  const mine = wheelSet(), theirs = new Map();

  // the look under a point: what a hand-built place laid there, else the map's surface (0 on water)
  const lookAt = (x, z) => groundLook(x, z) || GRID[world.surfaceAt(x, z)] || 0;

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
          w.look = lookAt(x, z);
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
      const look = lookAt(x, z);
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

  return { mesh, update: (car) => update(car), updateOthers, get count() { return next; }, lookAt };
}
