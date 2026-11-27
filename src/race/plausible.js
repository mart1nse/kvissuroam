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
//
// A car with thrusters (the Roadster Rocket, 26 Nov 2026: until then such a car was not judged at all, so a lap in
// one with its tank made bottomless would have stood). Its limits are the car's with the tank empty, where it
// is lightest, and with its fans on or off, whichever gives more. What its tyres and motors do not explain, the
// gas must: BOOST pushes the car the way it points with at most the tail nozzles' force, and every metre a second
// it adds is gas out of a tank that holds only so much and fills in a minute while nothing blows. The drive is
// walked in half seconds, its gas counted out of a tank that is full at the start (the game fills it at the line of
// every timed lap and at a stage's start):
//   gas    the most the tank was overdrawn by, as a share of a full one: refused past GAS_OVER
//   air    seconds the car was turning over while in free flight: a kickflip, which the game does not allow
//          once a lap or a stage run is on (refused at any: AIR_MAX)
import { createCar, stepCar, TYRE_GRIP, FAN_LOOSE } from '../cars/physics.js';
import { GAS_V, REFILL_S, FADE, TANK_S, refillTank } from '../cars/thrust.js';

const G = 9.81;
export const STEP = 0.1;             // seconds between a replay's samples
const HOP = 12;                      // m between two samples: more is R back to an earlier spot (worker checkTrace), not driving
const PULL_K = 1.3, PULL_SLACK = 4;  // energy gained in a second: this share of the car's own, plus J/kg
const GRIP_K = 1.35;                 // sideways: this share of the tyres' grip on dry paving
// ... and on gravel this share of the grip there (27 Nov 2026: an Impreza took the Majoraadi record 12 s ahead of
// anyone in any car, 1.16 g in its bends on gravel at the 90th in 100 where the honest records read 0.72 to 0.82;
// against 1.35 it read 0.3 s over and stood. Every honest stage record of that morning reads 0 s at 1.0. Gravel's
// limit already holds its best patches, 13 % over, so the paving's leeway is not needed on it.)
const LOOSE_GRIP_K = 1.1;
const STOP_K = 1.5;                  // braking: this share of the car's own full stop
const TOP_K = 1.12;                  // faster than this share of its top speed (a long hill adds a little)
export const OVER_MAX = 3;           // seconds over a limit a lap may have before it is refused
const BIN = 2;                       // m/s per step of the pull table
// a car with thrusters:
const THRUST_K = 1.3;                // the gas pushes at most this share of the tail nozzles' force on the car at its lightest
const GAS_PULL_K = 1.1;              // what the car gains over this share of its motors' own pull is gas (the other cars'
                                     // records of 26 Nov gain nothing over their own engines' pull at all)
const GAS_FLOOR = 0.3;               // m/s in half a second over the tyres and motors that is not yet taken for gas
export const GAS_OVER = 0.1;         // of a full tank: the gas a drive may use over what there was
const SIDE_K = 1;                    // gas turns the car's path only as it pushes it on: by this share of that push at the most
// ...and on a timed run, judged by its motors and tyres alone (noGas) against its limits with the tank full, smaller
// leeways than other cars get (Martin 27 Nov, "yes tighten and check other tesla hacks": with the 35 % and 50 % of
// any car, fans hacked to three times their pull and a sixth of a lap's time passed). The honest records of the other
// cars reach at the most 1.01 of their grip and 1.00 of their brakes; honest Rocket drives of every kind 0.91 and
// 1.005 (tools/rocket-judge-test.mjs). Its fans at 1.5 times brake at 1.17, at twice 1.22 sideways and 1.34 braking.
const THRUST_PULL_K = 1.15, THRUST_GRIP_K = 1.08, THRUST_STOP_K = 1.08;
// ...and on a stage's gravel, its fans there at physics.js FAN_LOOSE (Martin 27 Nov: "modify the check to be as fool
// proof as possible"): sideways no more than the gravel's best patches give (the honest stage records of the other
// cars read nothing over at that; honest Rocket drives on gravel 0.88 of it), its pull and brakes measured on gravel,
// the pull with 5 % over its best patches. Its fans sealed as on paving there (the page telling of paving under it)
// read 1.03 sideways, 1.06 braking and 1.4 pulling; at 1.5 times 1.1 pulling; 1.15 times the grip 1.04 pulling.
const THRUST_LOOSE_K = 1.0, THRUST_LOOSE_PULL_K = 1.05;
// in the air and going over: rolled this far (rad) and turning this fast (rad/s; a kickflip: a whole turn in
// 1.7 s) while its height bends as a falling thing's does, this far (m) over the middle of where it was AIR_T s
// before and will be AIR_T s after (free fall: 3.1 m, whatever the ground does). The records of 26 Nov: 0.43 rad
// at the most, and 0.8 m over a crest; a car that leaves a crest and leans slowly over as it flies turns at
// a tenth of a radian a second; one thrown over by a wall (src/cars/crash.js) is 0.8 m over its path at the most
// while it turns, a kickflip 3.2 to 3.9 m.
const AIR_ROLL = 1.2, AIR_SPIN = 2, AIR_UP = 2.2, AIR_T = 0.8;
export const AIR_MAX = 0;            // seconds of that a drive may have

const flat = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const flatGravel = { ...flat, surfaceAt: () => 2 };
const LOOSE_PATCH = 1.13;            // loose ground's best patches (physics.js: 13 % either way), for its pull

// What a car can do, measured once on the game's physics: flat out from a standstill to its top speed on a flat
// dry road, then a full stop. pull[k]: the most it gains in speed per second (m/s2) at k * BIN m/s or above
// (taken at or above, so a gear change or a turbo still filling at that speed in this one run does not lower it).
// A car with thrusters also gets `gas`, what its BOOST can add to that (see the top of this file).
// (a generator that stops every `every` steps of the physics when asked to: the run is 5,000 to 9,000 of them, 0.1 to
// 0.3 s of processor, and the server has every player's positions to pass on meanwhile)
const cache = new Map();
// (one run: flat out from a standstill to its top speed, then a full stop. fanOff: with the suction fans off;
// a car with thrusters is run with its tank held empty, the gas's weight off it, or with full: held full, as it is
// all through a timed run now that there is no BOOST on one; gravel: on flat gravel, on these tyres)
function* flatOut(spec, every, fanOff, full = false, gravel = null) {
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  const ground = gravel ? flatGravel : flat;
  if (gravel) car.tyres = gravel;
  const dt = 1 / 60, W = 30;                             // (half-second spans)
  const light = () => { if (car.rocket) car.rocket.tank = full ? TANK_S : 0; };
  const steady = !!spec.thrusters;
  car.fanOff = fanOff;
  const v = [0];
  let top = 0, still = 0;
  for (let i = 0; i < 60 * 150 && still < 60 * 6; i++) {
    light();
    // (a car with thrusters is held straight: the rear-driven Rocket with its fans off spins on a floored wheel left
    // alone, and its limits then read ~265 km/h; judged by its motors alone on a timed run that was 1.7 s over at 405)
    stepCar(car, steady ? { up: 1, steer: Math.max(-1, Math.min(1, -car.yaw * 2 - car.yawRate * 0.3)) } : { up: 1 }, ground, dt);
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
  for (let i = 0; i < 60 * 4; i++) { light(); stepCar(car, { down: 1 }, ground, dt); b.push(Math.hypot(car.vx, car.vy)); }
  for (let i = 0; i + 60 < b.length; i++) if (b[i + 60] > 5) stop = Math.max(stop, b[i] - b[i + 60]);
  if (car.rocket) refillTank(spec.id);
  return { top, pull, stop };
}
export function* carLimitsSteps(spec, every = 0) {
  if (!spec) return null;
  let lim = cache.get(spec.id);
  if (lim) return lim;
  const T = spec.thrusters, light = spec.mass - (T?.gasKg || 0);
  let { top, pull, stop } = yield* flatOut(spec, every, false);
  if (T && spec.fanDown) {
    // (with the fans off it grips less and runs on to a higher top speed: at each speed the better of the two)
    const o = yield* flatOut(spec, every, true);
    const both = new Float64Array(Math.max(pull.length, o.pull.length));
    for (let k = 0; k < both.length; k++) both[k] = Math.max(pull[k] || 0, o.pull[k] || 0);
    pull = both; top = Math.max(top, o.top); stop = Math.max(stop, o.stop);
  }
  // (the same with the tank full, for a timed run judged without the gas, noGas: the 250 kg of gas left in would
  // otherwise be leeway, and a car 700 kg lighter passed)
  let pullFull = null, pullLoose = null, stopFull = 0, stopLoose = 0;
  if (T) {
    const a = yield* flatOut(spec, every, false, true), b = spec.fanDown ? yield* flatOut(spec, every, true, true) : a;
    pullFull = new Float64Array(Math.max(a.pull.length, b.pull.length));
    for (let k = 0; k < pullFull.length; k++) pullFull[k] = Math.max(a.pull[k] || 0, b.pull[k] || 0);
    stopFull = Math.max(a.stop, b.stop);
    // (and on gravel, a stage past its tarmac start: the motors there pull only what the rear tyres hold, the fans at
    // physics.js FAN_LOOSE; on either tyre, fans on or off, the best patch of gravel: a spinning tyre holds more of its grip on gravel than on
    // paving, so at some speeds that is more than on paving)
    pullLoose = new Float64Array(pullFull.length); stopLoose = 0;
    for (const [fanOff, tyres] of [[false, 'gravel'], [false, 'road'], [true, 'gravel'], [true, 'road']]) {
      if (fanOff && !spec.fanDown) continue;
      const g = yield* flatOut(spec, every, fanOff, true, tyres);
      stopLoose = Math.max(stopLoose, g.stop);
      // (held 2 rows, 14 km/h, further up: where the tyres hold more than in that one run the car reaches a little
      // more than its top speed there, at which the table has nothing left)
      for (let k = 0; k < pullLoose.length; k++) for (let j = Math.max(0, k - 2); j <= k; j++) pullLoose[k] = Math.max(pullLoose[k], (g.pull[j] || 0) * LOOSE_PATCH);
    }
  }
  // sideways: the tyre's grip on dry paving (road tyres there, the better of the two), the car's own rubber,
  // the best patch of road (physics.js: 5 % either way), and suction fans' weight if it has them
  const fans = 1 + (spec.fanDown || 0) / (light * G);
  const grip = G * Math.max(TYRE_GRIP('road', 1), TYRE_GRIP('gravel', 1)) * (spec.grip ?? 1) * 1.05 * fans;
  // on gravel (a Raadi run past its tarmac start; Martin 26 Nov: judged against paving a tune of up to 1.6 to 1.8
  // times the grip and brakes passed there): the better tyre on gravel, the wide rubber's rule off paving
  // (physics.js WIDE_LOOSE), the loose ground's patches (13 % either way); braking by the same share
  const wide = spec.grip ?? 1, looseWide = wide > 1 ? 1 - (wide - 1) * 0.5 : wide;
  // (and a car built for loose ground holds its own share more there: physics.js spec.looseGrip, the Focus WRC)
  // (the fans hold FAN_LOOSE of their suction there: their skirts seal against a smooth road only)
  const fansLoose = 1 + (FAN_LOOSE * (spec.fanDown || 0)) / (light * G);
  const gripLoose = G * Math.max(TYRE_GRIP('gravel', 2) * Math.min(1, wide), TYRE_GRIP('road', 2) * looseWide) * (spec.looseGrip ?? 1) * 1.13 * fansLoose;
  const stopAll = Math.max(stop, 0.5 * G);
  lim = { top, pull, stop: stopAll, grip, loose: { grip: gripLoose, stop: Math.max(0.4 * G, stopAll * (gripLoose / grip)) } };
  // thrusters: dv, the speed a full tank can add (m/s: all its gas out at GAS_V, the car growing lighter as it
  // goes); a, the most the tail nozzles push the car at its lightest (m/s2); fill, seconds an empty tank takes to
  // fill; launch, the hardest it leaves a standstill (m/s2, for a stage's start: worker/stagecheck.js; the motors'
  // pull and the nozzles' push together, which is more than the car does with both: 0 to 100 in 0.75 s)
  // (a car with thrusters on a timed run, judged without the gas: as it is there, the tank full, all its weight on)
  if (pullFull) {
    const full = (1 + (spec.fanDown || 0) / (spec.mass * G)) / fans, stopF = Math.max(stopFull, 0.5 * G);
    const fullLoose = (1 + (FAN_LOOSE * (spec.fanDown || 0)) / (spec.mass * G)) / fansLoose, gripLooseF = gripLoose * fullLoose;
    // (its brakes on gravel measured there too, the best patch's: a locked tyre holds more of its grip on gravel)
    lim.full = { pull: pullFull, stop: stopF, grip: grip * full, loose: { grip: gripLooseF, stop: Math.max(0.4 * G, stopLoose * LOOSE_PATCH), pull: pullLoose } };
  }
  if (T) lim.gas = { dv: GAS_V * Math.log(spec.mass / light), a: T.rear / light, fill: REFILL_S, launch: pull[0] + T.rear / light };
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
// { pull, grip, stop, top } and `why`, '' when it holds or the first of those past OVER_MAX. For a car with
// thrusters also gas (of a full tank, the most the drive's tank was overdrawn by; `why` past GAS_OVER), spent (the
// tanks of gas it was counted to use in all) and, when the samples' roll is given (k.roll, rad), air (seconds
// turning over in free flight; `why` past AIR_MAX).
// Each second is judged as two halves and counts only when both are over: a wall, a landing or R (back to an
// earlier spot) changes a car's speed or heading in one sample, tuning does it for seconds on end. So a messy lap
// with a dozen knocks (the first of the day in a car is held for its replay too) reads as nothing.
// k.noGas: a car with thrusters judged by its motors and tyres alone, as any other car (a timed lap or a stage run,
// where the game has no BOOST since Martin 27 Nov: "lets remove boost option from timed efforts"); its kickflip
// check stays. With the gas allowed a 10 s tank hid tunes of up to twice the motors. It is judged against lim.full
// with the THRUST_ leeways.
// k.loose: 1 for each sample on loose ground (gravel), judged there against lim.loose's grip and brakes: a half
// second counts as loose when it starts and ends there.
export function judgeDrive(xs, zs, ys, lim, k = {}) {
  const n = xs.length, out = { pull: 0, grip: 0, stop: 0, top: 0, gas: 0, air: 0, spent: 0, why: '' };
  if (!lim || n < 25) return out;
  const gas = k.noGas ? null : lim.gas, full = !!(k.noGas && lim.full);
  if (full) lim = { ...lim, ...lim.full };
  const pullK = k.pull ?? (full ? THRUST_PULL_K : PULL_K), gripK = k.grip ?? (full ? THRUST_GRIP_K : GRIP_K), stopK = k.stop ?? (full ? THRUST_STOP_K : STOP_K);
  const loose = k.loose && lim.loose ? k.loose : null;
  const looseK = k.looseGrip ?? Math.min(gripK, full ? THRUST_LOOSE_K : LOOSE_GRIP_K);
  // (the grip a half second may use, its leeway in)
  const gripAt = (a, b) => (loose && loose[a] && loose[b] ? lim.loose.grip * looseK : lim.grip * gripK);
  const stopAt = (a, b) => (loose && loose[a] && loose[b] ? lim.loose.stop : lim.stop);
  // speed at each sample from the places on both sides of it (level, and with the climb), its heading, and
  // whether a hop is near (those samples are not driving)
  const vh = new Float64Array(n), e = new Float64Array(n), hd = new Float64Array(n), hop = new Uint8Array(n), pw = new Float64Array(n + 1);
  // (k.hop: the caller knows which samples are an R, the race desk does: there a long step is not taken for one)
  if (k.hop) hop.set(k.hop);
  else for (let i = 1; i < n; i++) if (Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]) > HOP) for (let j = Math.max(0, i - 12); j < Math.min(n, i + 12); j++) hop[j] = 1;
  // (the car's own pull at a speed: on loose ground its pull there, where the limits have one: lim.full.loose.pull)
  const lp = loose && lim.loose.pull, lpK = (k.loosePull ?? THRUST_LOOSE_PULL_K) / pullK;
  const at = (v, i) => { const t = lp && loose[i] ? lp : lim.pull; return t[Math.min(t.length - 1, Math.floor(v / BIN))] * (t === lp ? lpK : 1); };
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), t = (b - a) * STEP;
    const dx = xs[b] - xs[a], dz = zs[b] - zs[a], dy = ys[b] - ys[a];
    vh[i] = Math.hypot(dx, dz) / t; hd[i] = Math.atan2(dx, dz);
    e[i] = (dx * dx + dz * dz + dy * dy) / (2 * t * t) + G * ys[i];        // energy per kg: speed (the climb's too) and height
    pw[i + 1] = pw[i] + at(vh[i], i) * vh[i] * STEP;                           // what the car's own pull adds, summed
  }
  const H = Math.round(0.5 / STEP);                      // half a second of samples
  const turn = (a, b) => { const d = hd[b] - hd[a]; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
  for (let i = 0; i < n; i++) {
    if (vh[i] > lim.top * TOP_K && !hop[i]) out.top += STEP;
    const m = i - H, o = i - 2 * H;
    if (o < 0 || hop[i] || hop[o]) continue;
    const over = (f) => f(o, m) && f(m, i);
    // (a car with thrusters: its pull and its bends are judged with the gas, below)
    if (!gas && over((a, b) => e[b] - e[a] > (pw[b] - pw[a]) * pullK + PULL_SLACK / 2)) out.pull += STEP;
    // (a stop: the speed shed, the hill's share left out, only while the car rolls on)
    if (vh[i] > 3 && over((a, b) => vh[a] - vh[b] - (G * Math.max(0, ys[b] - ys[a])) / Math.max(5, vh[a]) > stopAt(a, b) * stopK * H * STEP)) out.stop += STEP;
    // (sideways: how far the heading turns, times the speed; a car all but standing has no path to speak of)
    if (!gas && vh[o] > 5 && vh[m] > 5 && vh[i] > 5 && over((a, b) => turn(a, b) * Math.min(vh[a], vh[b]) > gripAt(a, b) * H * STEP)) out.grip += STEP;
  }
  if (gas) {
    // Half second by half second: what the car gained on its way (fwd, m/s) and what its path turned (side) over
    // what the tyres and motors give. Up to the nozzles' push that is gas, and comes out of the tank; the rest is
    // over the car's limits as it would be for any car, counted when two half seconds on end have it (a knock off
    // a wall turns a car's path in one sample). The gas pushes the car the way it points, so it turns the path only
    // by a share of what it adds to the speed: a path that turns harder than the tyres can with nothing pushing is
    // not the gas. While nothing blows the tank fills.
    const span = H * STEP, fill = (gas.dv * span) / gas.fill;
    let tank = gas.dv, low = 0, spent = 0, wasF = false, wasS = false, wasGas = false;
    for (let a = 0; a + H < n; a += H) {
      const b = a + H;
      let skip = false;
      for (let j = a; j <= b && !skip; j++) skip = !!hop[j];
      if (skip) { tank = Math.min(gas.dv, tank + fill); wasF = wasS = wasGas = false; continue; }
      const v = (vh[a] + vh[b]) / 2;
      const room = gas.a * THRUST_K * span * Math.max(0, Math.min(1, (lim.top - v) / FADE + 0.5));
      let fwd = Math.max(0, (e[b] - e[a] - (pw[b] - pw[a]) * GAS_PULL_K - PULL_SLACK / 2) / Math.max(v, 2));
      const side = vh[a] > 5 && vh[b] > 5 ? Math.max(0, turn(a, b) * Math.min(vh[a], vh[b]) - gripAt(a, b) * span) : 0;
      // (while the gas is plainly blowing, pushing the car on now or just before, it may turn the path with all of its
      // push that is not going into speed: BOOST on a car sliding well sideways, a rear-wheel-drive Rocket after a spin,
      // pushes across its path while the motors account for the speed. With no gas to be seen, only its forward share.)
      const blowing = fwd > GAS_FLOOR || wasGas;
      const overF = fwd > room + GAS_FLOOR, paid = Math.min(side, Math.max(fwd * SIDE_K, blowing ? room - Math.min(fwd, room) : 0)), overS = side - paid > GAS_FLOOR;
      if (overF) { fwd = room; if (wasF) out.pull += wasF === 1 ? 2 * span : span; }
      if (overS && wasS) out.grip += wasS === 1 ? 2 * span : span;
      wasF = overF ? (wasF ? 2 : 1) : false; wasS = overS ? (wasS ? 2 : 1) : false;
      const used = Math.min(Math.hypot(fwd, paid), room + GAS_FLOOR);
      if (used > GAS_FLOOR) { tank -= used; spent += used; } else tank = Math.min(gas.dv, tank + fill);
      wasGas = fwd > GAS_FLOOR;
      if (-tank > low) low = -tank;
    }
    out.gas = Math.round((low / gas.dv) * 100) / 100; out.spent = Math.round((spent / gas.dv) * 100) / 100;
  }
  if (lim.gas) {
    // A kickflip: the car turns right over while it flies. (A car that rolls over on the road after a knock does
    // not fall freely for seconds; one that drives off an edge or a crest does not spin over.)
    const roll = k.roll, A = Math.round(AIR_T / STEP), wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    if (roll) for (let i = A; i + A < n; i++) {
      if (hop[i] || hop[i - A] || hop[i + A]) continue;
      if (Math.abs(wrap(roll[i])) > AIR_ROLL && Math.abs(wrap(roll[i + 1] - roll[i - 1])) > AIR_SPIN * 2 * STEP && ys[i] - (ys[i - A] + ys[i + A]) / 2 > AIR_UP) out.air += STEP;
    }
  }
  for (const key of ['pull', 'grip', 'stop', 'top']) { out[key] = Math.round(out[key] * 10) / 10; if (!out.why && out[key] > OVER_MAX) out.why = key; }
  out.air = Math.round(out.air * 10) / 10;
  if (!out.why && out.gas > GAS_OVER) out.why = 'gas';
  if (!out.why && out.air > AIR_MAX) out.why = 'air';
  return out;
}
