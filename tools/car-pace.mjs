// How quick a car is round a circuit, on paper (Martin 27 Nov 2026: the Focus WRC, a purpose-built rally car,
// should beat the road 22B on the Majoraadi stage and round Toomemägi). A lap simulation of the kind race teams
// use: each car is first measured on the game's own physics (src/cars/physics.js, no page), on the ground and tyres
// of the track, for
//   pull    flat out on the level: its acceleration at each speed, gear changes and wheelspin in
//   brakes  the hardest it slows at each speed, the pedal squeezed as hard as the tyres take (no ABS to lean on)
//   grip    the sideways g it holds round a circle of a given size (tools/bot-lap.mjs's robot on a skidpad: what a
//           steady driver gets, the car's balance in, not the tyre table alone)
// and then driven along the line of a real record drive (its path and its heights): as fast as the bends allow,
// braking in time for each, and pulling out of them with what grip the cornering leaves (the friction circle),
// uphill and downhill as the line goes. It leaves out what a player adds (slides, cut corners, kerbs, jumps) and
// takes away (mistakes), so its times are a little quicker than the records: it is for the gap between cars.
//   node tools/car-pace.mjs [track=raadi|toomemagi|both] [cars=focus,impreza] [spec='{"focus":{"grip":1.25}}']
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';
import { makeTrack, drive, curvature } from './bot-lap.mjs';

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(k + '='))?.slice(k.length + 1) ?? d;
const G = 9.81, DT = 1 / 120, BIN = 1;           // m/s per row of the tables

const level = (surf) => ({ meta: { riverLevel: -100 }, heightAt: () => 0, surfaceAt: () => surf, sdfAt: () => 100, sdfGrad: (x, z, o) => o });

// flat out from a standstill: the time it takes through each 1 m/s of speed, as an acceleration (gear changes in)
function pullTable(spec, surf, tyres) {
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  car.tyres = tyres;
  const w = level(surf), at = [];
  let t = 0, top = 0, still = 0;
  while (t < 120 && still < 6 / DT) {
    stepCar(car, { up: 1, steer: 0 }, w, DT);
    t += DT;
    const v = car.vx, k = Math.floor(v / BIN);
    if (at[k] === undefined) at[k] = t;
    if (v > top + 0.01) { top = v; still = 0; } else still++;
  }
  const a = [];
  for (let k = 0; k + 1 < at.length; k++) a[k] = at[k + 1] !== undefined && at[k] !== undefined ? BIN / (at[k + 1] - at[k]) : 0;
  return { a, top };
}
// the hardest stop at each speed: the pedal held at the share that slows it most (a driver with no ABS modulates)
function brakeTable(spec, surf, tyres, top) {
  const d = [];
  for (const p of [0.35, 0.5, 0.65, 0.8, 1]) {
    const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
    car.tyres = tyres;
    const w = level(surf);
    // (up to speed first, the way the car gets there)
    for (let t = 0; car.vx < Math.min(top * 0.97, 60) && t < 120; t += DT) stepCar(car, { up: 1, steer: 0 }, w, DT);
    let last = Math.floor(car.vx / BIN), tl = 0, t = 0;
    while (car.vx > 2 && t < 30) {
      stepCar(car, { down: p, steer: 0 }, w, DT);
      t += DT;
      const k = Math.floor(car.vx / BIN);
      if (k < last) { const dec = BIN / (t - tl); if (tl > 0.3) for (let j = k; j < last; j++) d[j] = Math.max(d[j] || 0, dec); last = k; tl = t; }
    }
  }
  return d;
}
// the sideways g it holds round circles of these sizes (m), and at what speed: a search on the robot's skidpad
function gripTable(spec, surf, tyres) {
  const out = [];
  for (const R of [12, 20, 35, 60, 100, 170, 300]) {
    const P = [], n = Math.round(2 * Math.PI * R);
    for (let i = 0; i < n * 2.5; i++) { const a = i / R; P.push([-R * Math.cos(a), -R * Math.sin(a), 0]); }
    const T = { P, closed: false, start: 0, finish: P.length - 5, surf: () => surf, tyres };
    // (a circle the car cannot go round at its limit for want of power is left out: the bends there are the engine's)
    if (Math.sqrt(1.0 * G * R) > 0.9 * spec._top) break;
    let lo = 0.3, hi = 1.8;
    for (let it = 0; it < 9; it++) {
      const g = (lo + hi) / 2, r = drive(T, spec, g, g);
      // (holds the circle within a metre)
      if (r.worst <= 1.0 && r.time < Infinity) lo = g; else hi = g;
    }
    out.push({ R, v: Math.sqrt(lo * G * R), g: lo });
  }
  return out;
}

export function measure(spec, surf, tyres) {
  const p = pullTable(spec, surf, tyres);
  spec._top = p.top;
  return { pull: p.a, top: p.top, brake: brakeTable(spec, surf, tyres, p.top), grip: gripTable(spec, surf, tyres) };
}

const tab = (t, v) => { const k = Math.max(0, Math.min(t.length - 1, Math.floor(v / BIN))); return t[k] ?? 0; };
// sideways g at a speed: between the skidpad's speeds (below the slowest, the slowest's; above, the fastest's)
function latAt(grip, v) {
  if (v <= grip[0].v) return grip[0].g;
  for (let i = 1; i < grip.length; i++) if (v <= grip[i].v) { const a = grip[i - 1], b = grip[i], f = (v - a.v) / (b.v - a.v); return a.g + (b.g - a.g) * f; }
  return grip[grip.length - 1].g;
}

// along a line: the time from its start to its finish (a lap: the second time round, a flying lap)
export function lapTime(T, m) {
  const { P, closed } = T, n = P.length, kap = curvature(T);
  const loops = closed ? 3 : 1, N = closed ? n * loops : T.finish - T.start + 1;
  const pt = (j) => P[closed ? j % n : T.start + j];
  const kk = (j) => kap[closed ? j % n : T.start + j];
  const surf = (j) => T.surfAt ? T.surfAt(closed ? j % n : T.start + j) : 0;
  const M = (j) => m[surf(j)];
  const ds = new Float64Array(N), grade = new Float64Array(N), vc = new Float64Array(N);
  for (let j = 0; j < N; j++) {
    const a = pt(j), b = pt(Math.min(N - 1, j + 1));
    ds[j] = Math.max(0.2, Math.hypot(b[0] - a[0], b[1] - a[1]));
    grade[j] = (b[2] - a[2]) / ds[j];
    // (the most a bend allows: v^2 k = sideways g at that speed, found by a few rounds)
    let v = 60;
    for (let it = 0; it < 6; it++) v = Math.min(M(j).top, Math.sqrt((latAt(M(j).grip, v) * G) / Math.max(kk(j), 1e-5)));
    vc[j] = v;
  }
  const left = (j, v) => Math.sqrt(Math.max(0, 1 - ((v * v * kk(j)) / (latAt(M(j).grip, v) * G)) ** 2));
  // braking back from each bend
  const vb = Float64Array.from(vc);
  for (let j = N - 2; j >= 0; j--) {
    const v = vb[j + 1], dec = tab(M(j).brake, v) * left(j, v) - G * grade[j];
    vb[j] = Math.min(vb[j], Math.sqrt(v * v + 2 * Math.max(0.5, dec) * ds[j]));
  }
  // and pulling out of them (a stage from a standstill; a lap's first time round sets its flying start)
  const v = new Float64Array(N);
  v[0] = closed ? 20 : 0;
  let t = 0, t0 = closed ? null : 0, tEnd = null;
  for (let j = 0; j + 1 < N; j++) {
    const acc = tab(M(j).pull, v[j]) * left(j, v[j]) - G * grade[j];
    v[j + 1] = Math.min(vb[j + 1], Math.sqrt(Math.max(0.25, v[j] * v[j] + 2 * acc * ds[j])));
    t += ds[j] / Math.max(0.5, (v[j] + v[j + 1]) / 2);
    if (closed && j + 1 === n) t0 = t;
    if (closed && j + 1 === 2 * n) tEnd = t;
  }
  if (!closed) tEnd = t;
  let vmax = 0, sum = 0;
  for (const x of v) { vmax = Math.max(vmax, x); sum += x; }
  return { time: tEnd - t0, top: vmax * 3.6, avg: (sum / N) * 3.6 };
}

function main() {
  const tracks = arg('track', 'both') === 'both' ? ['raadi', 'toomemagi'] : [arg('track')];
  const cars = arg('cars', 'focus,impreza').split(',');
  const over = JSON.parse(arg('spec', '{}'));
  for (const tn of tracks) {
    const T = makeTrack(tn);
    // the ground by the line: Majoraadi's tarmac start then gravel, on gravel tyres; Toomemägi all tarmac, road tyres
    T.surfAt = (i) => (T.surf(i) === 2 ? 1 : 0);
    const grounds = tn === 'raadi' ? [[1, 'gravel'], [2, 'gravel']] : [[1, 'road']];
    console.log(`${tn}: ${T.closed ? T.P.length : T.finish - T.start} m of line (from a ${T.record.toFixed(2)} s record)`);
    for (const id of cars) {
      const base = CARS[id], spec = { ...base, ...(over[id] || {}) };
      if (over[id]?.engine) spec.engine = { ...base.engine, ...over[id].engine };
      const m = grounds.map(([s, ty]) => measure({ ...spec }, s, ty));
      const r = lapTime(T, m);
      const g = m[m.length - 1].grip.map((o) => `${(o.v * 3.6).toFixed(0)}:${o.g.toFixed(2)}`).join(' ');
      const z = (mm) => { let t = 0; for (let k = 0; k < 27.8 / BIN; k++) t += BIN / (mm.pull[k] || 1e-3); return t.toFixed(2); };
      console.log(`  ${id.padEnd(8)} ${r.time.toFixed(2)} s   0-100 ${m.map(z).join(' / ')} s   avg ${r.avg.toFixed(0)} km/h, top ${r.top.toFixed(0)}   grip (km/h:g) ${g}   brakes at 100 ${(tab(m[m.length - 1].brake, 27.8) / G).toFixed(2)} g`);
    }
  }
}
if (process.argv[1]?.endsWith('car-pace.mjs')) main();
