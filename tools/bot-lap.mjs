// A robot driver on the game's own physics (src/cars/physics.js, no page), for comparing cars (Martin 27 Nov 2026:
// the Focus WRC, a purpose-built rally car, should be quicker than the road 22B on the Majoraadi stage and round
// Toomemägi). It follows a line taken from a real record drive (its path and its heights) at the speed a bend allows
// for a sideways g it is given, braking in time for the next. The world is the line's ground only: no walls, kerbs,
// trees or bales, so the line is held by the robot itself and how far it strays from it is counted.
// tools/car-pace.mjs uses it on a skidpad to measure each car's grip. Driven down Majoraadi it is a second opinion
// on the gap between two cars (both driven at the same settings); it is not a fast driver (some 10 s off the
// stage's records), and at Toomemägi's speeds the cars get away from it, so use car-pace.mjs there.
//   node tools/bot-lap.mjs [cars=focus,impreza] [spec='{"focus":{"looseGrip":1}}']   (Majoraadi, about a minute)
//   node tools/bot-lap.mjs track=toomemagi cars=impreza one=0.8,0.6 [every=30]     (one drive, written out as it goes)
// Lines: tools/fixtures/replays-raadi/impreza.gz (ElvaJonn's honest stage record) and tools/fixtures/bot-lines/
// toomemagi.gz (the 22B's lap record of 27 Nov, 2:37.73), both replays as the server keeps them (src/race/replay.js).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';

const here = (p) => new URL(p, import.meta.url);
const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(k + '='))?.slice(k.length + 1) ?? d;
const RAADI = JSON.parse(readFileSync(here('../src/race/raadi.json')));
const G = 9.81, DT = 1 / 60;
// (how the robot steers and brakes: see drive(); found by trying, on Majoraadi and on circles of gravel and tarmac)
const LOOK = 0.4;
// AL: the share of the front axle's own slide the wheel follows; KR: rad of lock per rad/s the car turns faster than
// its path wants; ZW, W2: the damper and the spring pulling it back onto the line; PV: s of the line looked ahead;
// TU: the throttle left in a bend, against the grip asked for; BK: the most brake it uses; LOOK: s ahead for the speed
const AL = 0.6, KR = 1, ZW = 1.5, W2 = 1, PV = 0.15, TU = 1.2, BK = 0.85;

// a replay's places (m), ten a second
function replayPath(file) {
  const a = gunzipSync(readFileSync(file)).toString().split(',').map(Number);
  const fl = a[1], n = a[3], xs = [], zs = [], ys = [];
  let x = 0, z = 0, y = 0;
  for (let i = 0; i < n; i++) { x += a[4 + i * fl] / 100; z += a[4 + i * fl + 1] / 100; y += a[4 + i * fl + 2] / 100; xs.push(x); zs.push(z); ys.push(y); }
  return { xs, zs, ys, ms: a[2] };
}
// the path every metre, smoothed over a few metres (a replay's places are rounded and the car wobbles)
function resample(xs, zs, ys, closed) {
  const P = [];
  let carry = 0;
  for (let i = 1; i < xs.length; i++) {
    const l = Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
    if (l > 12 || l < 1e-6) continue;
    let d = carry;
    while (d < l) { const f = d / l; P.push([xs[i - 1] + (xs[i] - xs[i - 1]) * f, zs[i - 1] + (zs[i] - zs[i - 1]) * f, ys[i - 1] + (ys[i] - ys[i - 1]) * f]); d += 1; }
    carry = d - l;
  }
  const n = P.length, W = 4, out = [];
  for (let i = 0; i < n; i++) {
    const o = [0, 0, 0];
    let c = 0;
    for (let k = -W; k <= W; k++) {
      const j = closed ? (i + k + n) % n : Math.max(0, Math.min(n - 1, i + k));
      o[0] += P[j][0]; o[1] += P[j][1]; o[2] += P[j][2]; c++;
    }
    out.push([o[0] / c, o[1] / c, o[2] / c]);
  }
  return out;
}

function makeTrack(name) {
  if (name === 'raadi') {
    const r = replayPath(here('./fixtures/replays-raadi/impreza.gz'));
    const P = resample(r.xs, r.zs, r.ys, false);
    // the stage's own start and finish, and where its gravel begins (src/race/raadi.json)
    const near = (q) => { let b = 0, bd = Infinity; P.forEach((p, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; b = i; } }); return b; };
    const start = near(RAADI.pts[RAADI.start]), finish = near(RAADI.pts[RAADI.finish]), gravel = near(RAADI.pts[RAADI.gravelFrom]);
    return { name, P, closed: false, start, finish, surf: (i) => (i < gravel ? 1 : 2), tyres: 'gravel', record: r.ms / 1000 };
  }
  const r = replayPath(here('./fixtures/bot-lines/toomemagi.gz'));
  const P = resample(r.xs, r.zs, r.ys, true);
  return { name, P, closed: true, start: 0, finish: P.length, surf: () => 1, tyres: 'road', record: r.ms / 1000 };
}

// curvature (1/m) at each point of the line, over a few metres either way
function curvature(T) {
  const { P, closed } = T, n = P.length, k = new Float64Array(n), S = 6;
  for (let i = 0; i < n; i++) {
    const a = P[closed ? (i - S + n) % n : Math.max(0, i - S)], b = P[i], c = P[closed ? (i + S) % n : Math.min(n - 1, i + S)];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ac = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    k[i] = ab && bc && ac ? (2 * Math.abs(cross)) / (ab * bc * ac) : 0;
  }
  return k;
}

// One drive. grip: the sideways g the robot asks for in bends (on this ground, these tyres); brake: the g it
// counts on to slow down. Returns the time from start to finish (s), how far it strayed from the line at most
// (m), and the car's speeds.
function drive(T, spec, grip, brake, opts = {}) {
  const { P, closed } = T, n = P.length;
  const kap = curvature(T);
  const idx = (j) => (closed ? ((j % n) + n) % n : Math.max(0, Math.min(n - 1, j)));
  // the line's heading (as the car's yaw is counted) and its bend with a side to it
  const tan = new Float64Array(n), kapS = new Float64Array(n);
  for (let i = 0; i < n; i++) { const a = P[idx(i - 2)], b = P[idx(i + 2)]; tan[i] = Math.atan2(b[0] - a[0], -(b[1] - a[1])); }
  for (let i = 0; i < n; i++) { const d = tan[idx(i + 4)] - tan[idx(i - 4)]; kapS[i] = Math.atan2(Math.sin(d), Math.cos(d)) / 8; }
  // the speed the robot aims for: what the bend allows, slowed in time for the next one (a lap: twice round)
  const loops = closed ? 2 : 1, N = n * loops;
  const vt = new Float64Array(N);
  for (let j = 0; j < N; j++) vt[j] = Math.min(90, Math.sqrt((grip * G) / Math.max(kap[j % n], 1e-4)));
  for (let j = N - 2; j >= 0; j--) vt[j] = Math.min(vt[j], Math.sqrt(vt[j + 1] ** 2 + 2 * brake * G));
  let hint = T.start;
  // the nearest point of the line to (x, z), looked for near the last one found
  const nearest = (x, z, from, span = 40) => {
    let b = from, bd = Infinity;
    const lo = closed ? from - span : Math.max(0, from - span), hi = closed ? from + span : Math.min(n - 1, from + span);
    for (let j = lo; j <= hi; j++) { const p = P[idx(j)]; const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; b = j; } }
    return b;
  };
  const world = {
    meta: { riverLevel: -100 },
    heightAt: (x, z) => P[idx(nearest(x, z, hint, 12))][2],
    surfaceAt: (x, z) => T.surf(idx(nearest(x, z, hint, 12))),
    sdfAt: () => 100, sdfGrad: (x, z, o) => o,
  };
  const p0 = P[T.start], p1 = P[T.start + 3];
  const yaw = Math.atan2(p1[0] - p0[0], -(p1[1] - p0[1]));
  const car = createCar(spec, { x: p0[0], z: p0[1], y: p0[2], yaw });
  car.tyres = T.tyres;
  let t = 0, prog = T.start, worst = 0, startT = closed ? null : 0, end = null, slide = 0;
  const lapFrom = closed ? n : T.start, lapTo = closed ? 2 * n : T.finish;
  const L = spec.wheelbase;
  const v = [];
  for (let step = 0; step < 60 * 600 && end === null; step++) {
    prog = nearest(car.x, car.z, prog);
    hint = prog;
    const sp = Math.hypot(car.vx, car.vy);
    const q = P[idx(prog)], dev = Math.hypot(q[0] - car.x, q[1] - car.z);
    if (startT !== null) worst = Math.max(worst, dev);
    if (closed && startT === null && prog >= lapFrom) startT = t;
    if (prog >= lapTo) { end = t; break; }
    // Steering: the line's own bend a moment ahead, and a pull back onto the line by how far off it the car is and
    // how its path points away from it (a spring and a damper on the sideways error), as a yaw rate to hold; the
    // wheel then goes by what that yaw rate needs, and against the car when it turns faster than that (a driver
    // catches the tail before it is out). The way the car moves, not the way it points, is what is steered.
    const beta = sp > 3 ? Math.atan2(car.vy, Math.max(car.vx, 1)) : 0;
    const j0 = idx(prog), pv = Math.max(1, sp * PV);
    const tg = tan[j0], nx = Math.cos(tg), nz = Math.sin(tg);
    const e = (car.x - P[j0][0]) * nx + (car.z - P[j0][1]) * nz;
    const he = Math.atan2(Math.sin(car.yaw + beta - tg), Math.cos(car.yaw + beta - tg));
    const vv = Math.max(sp, 4);
    let kc = kapS[idx(prog + Math.round(pv))] - (2 * ZW * he) / vv - (W2 * e) / (vv * vv);
    kc = Math.max(-0.25, Math.min(0.25, kc));
    const align = sp > 3 ? Math.atan2(car.vy + car.a * car.yawRate, Math.max(car.vx, 1)) : 0;
    const delta = Math.atan(L * kc) + AL * align + KR * (sp * kc - car.yawRate);
    const steer = Math.max(-1, Math.min(1, delta / 0.6));
    // throttle and brake to the aimed speed a little ahead (the car takes a moment to answer), the throttle eased
    // when the tail steps out or the wheels spin up, as a driver feeds it in
    const want = vt[Math.max(0, Math.min(N - 1, prog + Math.round(sp * LOOK)))];
    const err = want - sp;
    const slideK = Math.max(0, Math.min(1, 1 - (Math.abs(beta) - 0.08) / 0.15));
    const spinK = Math.max(0.3, Math.min(1, 1 - ((car.slipV || 0) - 3) / 4));
    // (and in a bend only what grip the cornering leaves: a share of the robot's own figure for the ground)
    const use = Math.min(1, (sp * sp * Math.abs(kapS[j0])) / (grip * G * TU));
    const room = Math.sqrt(1 - use * use);
    const up = err > 0 ? Math.min(1, err * 0.8 + 0.2) * Math.max(0.1, Math.min(slideK, spinK, Math.max(0.1, room))) : 0;
    // (the brake squeezed as a driver does with no ABS to lean on: eased once the tail starts to come round)
    // (and let off when the wheel is wound on: locked front wheels do not steer)
    const steerK = Math.max(0.15, Math.min(1, 1 - (Math.abs(steer) - 0.15) / 0.4));
    const down = err < -0.6 ? Math.min(BK, -err * 0.25) * Math.max(0.25, slideK) * steerK : 0;
    const input = { steer, steerDirect: true, up, down };
    stepCar(car, input, world, DT);
    if (Math.abs(Math.atan2(car.vy, Math.max(1, car.vx))) > 0.6 && sp > 8) slide++;
    t += DT;
    if (startT !== null && step % 6 === 0) v.push(sp);
    if (opts.log && step % (opts.every || 120) === 0 && t >= (opts.from || 0)) console.log(`t ${t.toFixed(1)} i ${prog} v ${(sp * 3.6).toFixed(0)} want ${(want * 3.6).toFixed(0)} dev ${dev.toFixed(2)} steer ${steer.toFixed(2)} gear ${car.gear} slipA ${Math.atan2(car.vy, Math.max(1, car.vx)).toFixed(2)} up ${up.toFixed(2)} dn ${down.toFixed(2)} spin ${(car.slipV||0).toFixed(1)} yr ${car.yawRate.toFixed(2)} k ${kap[idx(prog)].toFixed(3)}`);
    if (dev > 25 || car.crash) break;
  }
  return { time: end !== null && startT !== null ? end - startT : Infinity, worst, slide, top: Math.max(...v, 0) * 3.6, avg: v.length ? (v.reduce((a, b) => a + b, 0) / v.length) * 3.6 : 0 };
}

export { makeTrack, drive, curvature };

function main() {
  const tn = arg('track', 'raadi'), T = makeTrack(tn);
  const cars = arg('cars', 'focus,impreza').split(',');
  const over = JSON.parse(arg('spec', '{}'));
  const specOf = (id) => {
    const spec = { ...CARS[id], ...(over[id] || {}) };
    if (over[id]?.engine) spec.engine = { ...CARS[id].engine, ...over[id].engine };
    return spec;
  };
  if (arg('one')) {
    const [g, b] = arg('one').split(',').map(Number);
    for (const id of cars) console.log(id, drive(T, specOf(id), g, b, { log: true, every: +arg('every', 120), from: +arg('from', 0) }));
    return;
  }
  // every car at the same settings; for each leeway off the line, the quickest drive that stayed within it
  const grips = tn === 'raadi' ? [0.45, 0.5, 0.55, 0.6, 0.65, 0.7] : [0.7, 0.8, 0.9, 1.0, 1.1];
  const tols = tn === 'raadi' ? [2.5, 3.5, 5] : [2.5, 4, 6];
  console.log(`${tn}: line ${T.closed ? T.P.length : T.finish - T.start} m, from a ${T.record.toFixed(2)} s record`);
  const best = {};
  for (const id of cars) {
    const spec = specOf(id);
    for (const g of grips) for (const bk of [0.5, 0.65, 0.8]) {
      const r = drive(T, spec, g, g * bk);
      for (const tol of tols) if (r.worst <= tol && r.time < (best[id + tol]?.time ?? Infinity)) best[id + tol] = { ...r, g };
    }
  }
  for (const tol of tols) console.log(`  within ${tol} m of the line: ` + cars.map((id) => `${id} ${best[id + tol] ? `${best[id + tol].time.toFixed(2)} s (bends at ${best[id + tol].g} g)` : 'never'}`).join(', '));
}
if (process.argv[1]?.endsWith('bot-lap.mjs')) main();
