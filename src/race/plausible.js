// Could this car have driven this? (26 Nov 2026: an Audi 200 took its record with twice the pull and 2.3 g in
// the bends and under braking: its figures changed in the browser. The server took any drive that passed the
// gates under 430 km/h.)
//
// A replay is the car's place ten times a second (src/race/replay.js). From the places alone, whatever the
// page says of speed or pedals, three things are read and held against what the game's own physics gives
// that car (the server runs the same src/cars/physics.js, so the figures follow the specs by themselves):
//   pull   the energy the car gains in a second, speed and height together (a hill pays for itself), against
//          the car flat out on a flat dry road at that speed
//   grip   how hard its path bends at its speed, against its tyres on dry paving
//   stop   how fast it sheds speed for a second on end, against its brakes (a wall stops a car harder, but
//          not second after second)
// Each is counted in seconds over the limit, and a lap is refused past a few of them: a kerb, a landing, a
// dip or a knock can throw a car for a moment, and a drive that is honest must never be refused. The limits
// stand well clear of honest laps (see tools/plausible-test.mjs: the records of 26 Nov read 0 s on all three)
// and well under a car made twice as strong. A car made a tenth stronger passes: this catches tuning that
// shows, not all of it.
import { createCar, stepCar, TYRE_GRIP } from '../cars/physics.js';

const G = 9.81;
export const STEP = 0.1;             // seconds between a replay's samples
const HOP = 12;                      // m between two samples: more is R back to an earlier spot (worker checkTrace), not driving
const PULL_K = 1.3, PULL_SLACK = 4;  // energy gained in a second: this share of the car's own, plus J/kg
const GRIP_K = 1.35;                 // sideways: this share of the tyres' grip on dry paving
const STOP_K = 1.5;                  // braking: this share of the car's own full stop
const TOP_K = 1.12;                  // faster than this share of its top speed (a long hill adds a little)
export const OVER_MAX = 3;           // seconds over a limit a lap may have before it is refused
const BIN = 2;                       // m/s per step of the pull table

const flat = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };

// What a car can do, measured once on the game's physics: flat out from a standstill to its top speed on a flat
// dry road, then a full stop. pull[k]: the most it gains in speed per second (m/s2) at k * BIN m/s or above
// (taken at or above, so a gear change or a turbo still filling at that speed in this one run does not lower it).
// null for a car with thrusters (the Rocket, shown to nobody yet: its BOOST is not in this run, and until it is
// such a car is not judged).
// (a generator that stops every `every` steps of the physics when asked to: the run is 5,000 to 9,000 of them, 0.1 to
// 0.3 s of processor, and the server has every player's positions to pass on meanwhile)
const cache = new Map();
export function* carLimitsSteps(spec, every = 0) {
  if (!spec || spec.thrusters) return null;
  let lim = cache.get(spec.id);
  if (lim) return lim;
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  const dt = 1 / 60, W = 30;                             // (half-second spans)
  const v = [0];
  let top = 0, still = 0;
  for (let i = 0; i < 60 * 150 && still < 60 * 6; i++) {
    stepCar(car, { up: 1 }, flat, dt);
    const s = Math.hypot(car.vx, car.vy);
    v.push(s);
    if (s > top + 0.02) { top = s; still = 0; } else still++;   // (stops once the speed has not risen for 6 s)
    if (every && i % every === every - 1) yield;
  }
  const pull = new Float64Array(Math.ceil(top / BIN) + 2);
  for (let i = 0; i + W < v.length; i++) {
    const a = (v[i + W] - v[i]) / (W * dt);
    for (let k = Math.floor(Math.min(v[i], v[i + W]) / BIN); k <= Math.floor(Math.max(v[i], v[i + W]) / BIN) && k < pull.length; k++) if (a > pull[k]) pull[k] = a;
  }
  for (let k = pull.length - 2; k >= 0; k--) if (pull[k + 1] > pull[k]) pull[k] = pull[k + 1];
  let stop = 0;
  const b = [Math.hypot(car.vx, car.vy)];
  for (let i = 0; i < 60 * 4; i++) { stepCar(car, { down: 1 }, flat, dt); b.push(Math.hypot(car.vx, car.vy)); }
  for (let i = 0; i + 60 < b.length; i++) if (b[i + 60] > 5) stop = Math.max(stop, b[i] - b[i + 60]);
  // sideways: the tyre's grip on dry paving (road tyres there, the better of the two), the car's own rubber,
  // the best patch of road (physics.js: 5 % either way), and suction fans' weight if it has them
  const grip = G * Math.max(TYRE_GRIP('road', 1), TYRE_GRIP('gravel', 1)) * (spec.grip ?? 1) * 1.05 * (1 + (spec.fanDown || 0) / (spec.mass * G));
  lim = { top, pull, stop: Math.max(stop, 0.5 * G), grip };
  cache.set(spec.id, lim);
  return lim;
}
// (all at once: tests and tools)
export function carLimits(spec) {
  const it = carLimitsSteps(spec);
  let r;
  do r = it.next(); while (!r.done);
  return r.value;
}

// A drive against a car's limits. xs, zs, ys: the samples' places (m), STEP apart. Seconds over each limit:
// { pull, grip, stop, top } and `why`, '' when it holds or the first of those past OVER_MAX.
// Each second is judged as two halves and counts only when both are over: a wall, a landing or R (back to an
// earlier spot) changes a car's speed or heading in one sample, tuning does it for seconds on end. So a messy lap
// with a dozen knocks (the first of the day in a car is held for its replay too) reads as nothing.
export function judgeDrive(xs, zs, ys, lim, k = {}) {
  const n = xs.length, out = { pull: 0, grip: 0, stop: 0, top: 0, why: '' };
  if (!lim || n < 25) return out;
  const pullK = k.pull ?? PULL_K, gripK = k.grip ?? GRIP_K, stopK = k.stop ?? STOP_K;
  // speed at each sample from the places on both sides of it (level, and with the climb), its heading, and
  // whether a hop is near (those samples are not driving)
  const vh = new Float64Array(n), e = new Float64Array(n), hd = new Float64Array(n), hop = new Uint8Array(n), pw = new Float64Array(n + 1);
  for (let i = 1; i < n; i++) if (Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]) > HOP) for (let j = Math.max(0, i - 12); j < Math.min(n, i + 12); j++) hop[j] = 1;
  const at = (v) => lim.pull[Math.min(lim.pull.length - 1, Math.floor(v / BIN))];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), t = (b - a) * STEP;
    const dx = xs[b] - xs[a], dz = zs[b] - zs[a], dy = ys[b] - ys[a];
    vh[i] = Math.hypot(dx, dz) / t; hd[i] = Math.atan2(dx, dz);
    e[i] = (dx * dx + dz * dz + dy * dy) / (2 * t * t) + G * ys[i];        // energy per kg: speed (the climb's too) and height
    pw[i + 1] = pw[i] + at(vh[i]) * vh[i] * STEP;                           // what the car's own pull adds, summed
  }
  const H = Math.round(0.5 / STEP);                      // half a second of samples
  const turn = (a, b) => { const d = hd[b] - hd[a]; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
  for (let i = 0; i < n; i++) {
    if (vh[i] > lim.top * TOP_K && !hop[i]) out.top += STEP;
    const m = i - H, o = i - 2 * H;
    if (o < 0 || hop[i] || hop[o]) continue;
    const over = (f) => f(o, m) && f(m, i);
    if (over((a, b) => e[b] - e[a] > (pw[b] - pw[a]) * pullK + PULL_SLACK / 2)) out.pull += STEP;
    // (a stop: the speed shed, the hill's share left out, only while the car rolls on)
    if (vh[i] > 3 && over((a, b) => vh[a] - vh[b] - (G * Math.max(0, ys[b] - ys[a])) / Math.max(5, vh[a]) > lim.stop * stopK * H * STEP)) out.stop += STEP;
    // (sideways: how far the heading turns, times the speed; a car all but standing has no path to speak of)
    if (vh[o] > 5 && vh[m] > 5 && vh[i] > 5 && over((a, b) => turn(a, b) * Math.min(vh[a], vh[b]) > lim.grip * gripK * H * STEP)) out.grip += STEP;
  }
  for (const key of ['pull', 'grip', 'stop', 'top']) { out[key] = Math.round(out[key] * 10) / 10; if (!out.why && out[key] > OVER_MAX) out.why = key; }
  return out;
}
