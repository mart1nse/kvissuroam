// The Rocket's jets (src/cars/thrust.js): a blue-white cone of cold gas at each nozzle that is blowing, as long as
// the nozzle is open. Compressed air, so no flame: a tight bright core in a wider mist that thins out to nothing.
// One instanced mesh for every Rocket in sight (ours and other players'), always in the scene, so its shader is
// made with the rest at the start and a first BOOST costs nothing new; with no nozzle open it draws nothing.
// A jet of a car that is turning bends into an arc (Martin 26 Nov, from a still of Tesla's film: "they seem to arc a
// bit when rotating"): the gas further out left the nozzle a moment ago, when it pointed elsewhere, so the far end
// trails behind the turn. The bend is done in the shader, from one number and a direction per jet.
// And a jet is a soft column of vapour, not a hard cone (Martin 26 Nov: "a bit blocky ... just smoother and some
// real life variance", the size kept): the shader thins each surface by how squarely it is looked at, as a round
// column of mist is thickest through its middle and nothing at its rim (so the rounds across the jet do not show
// as lines from the side either); a small noise picture flowing out along the jet breaks its far half into
// wisps, the far end sways, and each jet breathes a little on its own (wider, narrower, longer, shorter).
import * as THREE from 'three';
import { NOZ, NOZ_DOWN, NOZ_YAW, NOZZLES } from './thrust.js';

const CARS_MAX = 8;                 // Rockets with jets drawn at once (the nearest come first in the lists)
const PER = NOZ * 2;                // a mist and a core for each nozzle
const FAR = 300;                    // metres: no jets drawn further off
// metres at full blow: the four at the tail, the four under the corners (in Tesla's film the jets that roll the
// car and set it down are longer than the car is wide), the two at the nose
// (the corner jets a touch longer since 27 Nov, 3.2 before, and a jet that is not at its hardest is less of a
// stub: its length goes as the 0.4th power of how hard it blows, the square root before. Martin: "reducing short
// ones and making the ones left a touch longer")
const LEN_REAR = 3.4, LEN_DOWN = 3.5, LEN_YAW = 1.4, LEN_POW = 0.4;
const GAS_SEEN = 14;                // m/s: how fast the gas that is seen moves out along a jet (the slower, the more a turning car's jets arc)
const BEND_MAX = 1.15;              // a jet's far end points at most this far off its nozzle's way (rad)
const STEAM = 0.5;                  // a nozzle blowing at its hardest is this much wider (the lift-off push, the landing burn)
const SOFT = 1.3;                   // the cones are this much wider than the jet looks: their rims are thinned away
const SWAY = 0.3;                   // how far a jet's far end wanders, in its own far-end widths
const FLOW = [1.5, 2.3];            // how fast the two layers of wisps run out along a jet (jet lengths a second)

export function createPlumes() {
  // a cone along +y from the nozzle (narrow, at 0) to its wide far end (at 1), and five rounds across it, so the
  // jet has a body seen from behind too, where the chase camera looks straight down it. The picture: across,
  // from a round's middle (left) to its rim; up, from the nozzle to the far end, thinning out
  const SEG = 12, ROUNDS = [0.06, 0.2, 0.38, 0.6, 0.85];
  // (N: which way each point's surface faces, out from the wall and along the jet for a round; RO: its place round the jet, 0..1)
  const P = [], UV = [], IX = [], N = [], RO = [];
  const wideAt = (v) => 0.22 + 0.78 * v;
  // (the cone's wall in ROWS rings along its length, so that a bent jet's wall bends with its rounds)
  const ROWS = 6, W = ROWS + 1;
  for (let k = 0; k <= SEG; k++) {
    const a = (k / SEG) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    for (let j = 0; j <= ROWS; j++) { const v = j / ROWS; P.push(cx * wideAt(v), v, cz * wideAt(v)); UV.push(0.45, v); N.push(cx, 0, cz); RO.push(k / SEG); }
    if (k < SEG) for (let j = 0; j < ROWS; j++) { const i = k * W + j; IX.push(i, i + 1, i + W, i + 1, i + W + 1, i + W); }
  }
  for (const v of ROUNDS) {
    const c = P.length / 3;
    P.push(0, v, 0); UV.push(0, v); N.push(0, 1, 0); RO.push(0.5);
    for (let k = 0; k <= SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      P.push(Math.cos(a) * wideAt(v), v, Math.sin(a) * wideAt(v)); UV.push(1, v); N.push(0, 1, 0); RO.push(k / SEG);
      if (k < SEG) IX.push(c, c + 1 + k, c + 2 + k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setAttribute('facing', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('round', new THREE.Float32BufferAttribute(RO, 1));
  geo.setIndex(IX);
  const c = document.createElement('canvas');
  c.width = 16; c.height = 64;
  const g = c.getContext('2d'), img = g.createImageData(16, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) {
    const v = 1 - (y + 0.5) / 64, u = (x + 0.5) / 16, o = (y * 16 + x) * 4;
    const along = v < 0.1 ? 0.5 + 5 * v : Math.pow(1 - (v - 0.1) / 0.9, 1.6);
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
    img.data[o + 3] = Math.round(255 * 0.72 * along * (1 - u * u));
  }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  // the wisps: a small cloudy picture that repeats both ways (two lattices of random greys, smoothed)
  const NS = 64, nc = document.createElement('canvas');
  nc.width = nc.height = NS;
  {
    const ng = nc.getContext('2d'), nim = ng.createImageData(NS, NS);
    const lat = (n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = Math.random(); return a; };
    const A = lat(8), B = lat(16), ease = (t) => t * t * (3 - 2 * t);
    const at = (a, n, x, y) => {
      const fx = (x / NS) * n, fy = (y / NS) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = ease(fx - x0), ty = ease(fy - y0);
      const g = (i, j) => a[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
      return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
    };
    for (let y = 0; y < NS; y++) for (let x = 0; x < NS; x++) {
      const o = (y * NS + x) * 4, v = Math.round(255 * (0.65 * at(A, 8, x, y) + 0.35 * at(B, 16, x, y)));
      nim.data[o] = nim.data[o + 1] = nim.data[o + 2] = v; nim.data[o + 3] = 255;
    }
    ng.putImageData(nim, 0, 0);
  }
  const wisps = new THREE.CanvasTexture(nc);
  wisps.wrapS = wisps.wrapT = THREE.RepeatWrapping;
  const flow = { value: new THREE.Vector3() };     // the two layers' run so far (each 0..1, the picture repeats) and the clock
  const mat = new THREE.MeshBasicMaterial({ map, color: 0xdcecff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
  // the arc: each jet's own [x, z of the way it bends in the cone's frame, the turn of its far end (rad), its length
  // over its width]; the cone's length becomes a round arc of that turn, bent that way
  const bend = new THREE.InstancedBufferAttribute(new Float32Array(CARS_MAX * PER * 4), 4);
  bend.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('bend', bend);
  // each jet's own number: its wisps and its sway are not its neighbour's
  const seed = new THREE.InstancedBufferAttribute(new Float32Array(CARS_MAX * PER), 1);
  seed.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('seed', seed);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.jetWisps = { value: wisps };
    sh.uniforms.jetFlow = flow;
    sh.vertexShader = `attribute vec4 bend; attribute float seed; attribute vec3 facing; attribute float round;
      uniform vec3 jetFlow; varying vec3 vJetN; varying vec3 vJetV; varying vec3 vJetAt;
      ` + sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
      float jy = position.y, jph = jetFlow.z * 6.0 + seed * 1.7;
      // (the sway: slow and a quicker one on top, growing to the far end; the nozzle end stays put)
      transformed.xz += vec2(sin(jph + jy * 4.0) + 0.5 * sin(jph * 2.3 + jy * 9.0 + 1.3), cos(jph * 1.3 + jy * 3.4 + seed) + 0.5 * sin(jph * 2.9 + jy * 8.0)) * jy * jy * ${SWAY.toFixed(2)};
      if (abs(bend.z) > 0.002) {
        float ang = bend.z * jy;
        transformed.y = sin(ang) / bend.z;
        transformed.xz += bend.xy * ((1.0 - cos(ang)) / bend.z) * bend.w;
      }
      vJetAt = vec3(round + seed * 0.37, jy, seed);`).replace('#include <project_vertex>', `#include <project_vertex>
      vJetV = -mvPosition.xyz;
      vJetN = normalMatrix * (mat3(instanceMatrix) * facing);`);
    sh.fragmentShader = `uniform sampler2D jetWisps; uniform vec3 jetFlow; varying vec3 vJetN; varying vec3 vJetV; varying vec3 vJetAt;
      ` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      // (thickest where it is looked at squarely, nothing at the rim)
      float jSquare = abs(dot(normalize(vJetN), normalize(vJetV)));
      // (two layers of wisps running out, long along the jet; none at the nozzle, most at the far end)
      float jW = texture2D(jetWisps, vec2(vJetAt.x, vJetAt.y * 0.55 - jetFlow.x + vJetAt.z * 0.11)).r
        * texture2D(jetWisps, vec2(vJetAt.x * 2.0 + 0.37, vJetAt.y * 1.2 - jetFlow.y)).r;
      float jBreak = smoothstep(0.04, 0.55, vJetAt.y) * 0.78;
      diffuseColor.a *= pow(jSquare, 1.15) * mix(1.0, smoothstep(0.04, 0.36, jW) * 1.35, jBreak);`);
  };
  mat.customProgramCacheKey = () => 'rocket-jets-soft';
  const mesh = new THREE.InstancedMesh(geo, mat, CARS_MAX * PER);
  mesh.name = 'rocket jets';
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 3;
  const body = new THREE.Matrix4(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
  const pos = new THREE.Vector3(), sc = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  // each nozzle's turn from the cone's +y to the way its gas goes
  const turns = NOZZLES.map((n) => new THREE.Quaternion().setFromUnitVectors(up, dir.set(n[3], n[4], n[5]).normalize()));
  const swung = new THREE.Quaternion(), back = new THREE.Quaternion(), lag = new THREE.Vector3();
  // how fast each car is rolling, from one frame's roll to the next (a flight moves the car along its plan and
  // leaves its rollRate at 0): kept by the car's own object, ours or a remote's
  const turning = new WeakMap();
  let n = 0, cars = 0, clock = 0, step = 1 / 60;
  function rollRate(who, roll) {
    let t = turning.get(who);
    if (!t) { turning.set(who, t = { roll, rate: 0 }); return 0; }
    const d = Math.atan2(Math.sin(roll - t.roll), Math.cos(roll - t.roll));
    t.roll = roll;
    // (eased over a few frames, so one uneven frame does not kink the jets)
    t.rate += (Math.max(-12, Math.min(12, d / step)) - t.rate) * Math.min(1, step * 14);
    return t.rate;
  }
  // one car: where its body is (the middle of its wheelbase on the road), how hard each nozzle blows (0..1) and
  // how far each of the four corner jets is swung out sideways just then (lean, radians; none: straight down)
  function car(x, y, z, yaw, pitch, roll, noz, lean, who) {
    const rr = rollRate(who, roll);
    if (cars >= CARS_MAX) return;
    let any = false;
    for (let i = 0; i < NOZ; i++) if (noz[i] > 0.02) { any = true; break; }
    if (!any) return;
    const seedOf = cars++ * 7.3;
    body.compose(pos.set(x, y, z), q.setFromEuler(e.set(pitch, -yaw, -roll)), one);
    for (let i = 0; i < NOZ; i++) {
      const k = noz[i];
      if (k <= 0.02) continue;
      const N = NOZZLES[i], big = i < NOZ_DOWN;
      // (the jet shivers: its length by a tenth, quicker than the eye follows)
      const len = (big ? LEN_REAR : i < NOZ_YAW ? LEN_DOWN : LEN_YAW) * Math.pow(k, LEN_POW) * (0.92 + 0.08 * Math.sin(clock * 61 + i * 2.1 + seedOf) + 0.05 * Math.sin(clock * 37 + i) + 0.06 * Math.sin(clock * 3.1 + i * 1.7 + seedOf));
      // (blowing at its hardest a corner jet is a thicker, steamier column)
      // (and it breathes: a tenth wider and narrower, slowly, each jet in its own time)
      const own = seedOf + i * 2.39;
      const wide = (big ? 0.2 : i < NOZ_YAW ? 0.2 : 0.14) * (0.6 + 0.4 * k) * (!big && i < NOZ_YAW ? 1 + STEAM * Math.max(0, (k - 0.75) / 0.25) : 1)
        * SOFT * (1 + 0.1 * Math.sin(clock * 5.3 + own) + 0.06 * Math.sin(clock * 12.7 + own * 1.9));
      pos.set(N[0], N[1], N[2]);
      let turn = turns[i];
      const a = lean && i >= NOZ_DOWN && i < NOZ_YAW ? lean[i - NOZ_DOWN] : 0;
      if (a) turn = swung.setFromUnitVectors(up, dir.set(Math.sin(a), -Math.cos(a), 0));
      // the arc: the car rolls about its long axis (the body's z), so the far end of a jet that points across it
      // (dx, dy) trails the other way round, towards (-dy, dx) * rate; none for the tail's jets, which point along it
      let bx = 0, bz = 0, turnBy = 0;
      if (!big && Math.abs(rr) > 0.15) {
        dir.set(0, 1, 0).applyQuaternion(turn);
        lag.set(-dir.y * rr, dir.x * rr, 0);
        const across = lag.length();
        if (across > 0.05) {
          lag.applyQuaternion(back.copy(turn).invert());
          const flat = Math.hypot(lag.x, lag.z) || 1;
          bx = lag.x / flat; bz = lag.z / flat;
          turnBy = Math.min(BEND_MAX, (across * len) / GAS_SEEN);
        }
      }
      seed.setX(n, own); seed.setX(n + 1, own + 0.5);
      bend.setXYZW(n, bx, bz, turnBy, len / wide);
      m.compose(pos, turn, sc.set(wide, len, wide)).premultiply(body);
      mesh.setMatrixAt(n++, m);
      bend.setXYZW(n, bx, bz, turnBy * 0.75, (len * 0.75) / (wide * 0.4));
      m.compose(pos, turn, sc.set(wide * 0.4, len * 0.75, wide * 0.4)).premultiply(body);
      mesh.setMatrixAt(n++, m);
    }
  }
  return {
    mesh,
    // ours: the car being driven (or null); list: the other players' cars as multiplayer.js hands them out
    // (remotes(): x, y, z, yaw, pitch, roll, spec, noz and lean for a Rocket); cam: the camera's place
    update(ours, list, cam, dt) {
      n = 0; cars = 0; clock = (clock + dt) % 1000; step = Math.max(1 / 240, Math.min(0.1, dt || 1 / 60));
      if (ours?.rocket) {
        const s = ours.spec, off = s.wheelbase * s.cgFront - s.wheelbase / 2;
        car(ours.x + Math.sin(ours.yaw) * off, ours.y, ours.z - Math.cos(ours.yaw) * off, ours.yaw, ours.pitch, ours.roll, ours.rocket.noz, ours.rocket.lean, ours);
      }
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        if (!r.noz || (r.x - cam.x) ** 2 + (r.z - cam.z) ** 2 > FAR * FAR) continue;
        const s = r.spec, off = s.wheelbase * s.cgFront - s.wheelbase / 2;
        car(r.x + Math.sin(r.yaw) * off, r.y, r.z - Math.cos(r.yaw) * off, r.yaw, r.pitch, r.roll, r.noz, r.lean, r);
      }
      if (mesh.count !== n) mesh.count = n;
      if (n) { mesh.instanceMatrix.needsUpdate = true; bend.needsUpdate = true; seed.needsUpdate = true; flow.value.set((clock * FLOW[0]) % 1, (clock * FLOW[1]) % 1, clock); }
    },
  };
}
