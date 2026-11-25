// Cold-gas thrusters (the Tesla Roadster Rocket, Martin 2026-11-25): one tank feeding two buttons.
//
// BOOST: the rear nozzles push the body forward for as long as the button is held, a second of tank a
// second. FLIP: a kickflip jump that costs half a tank. The whole flight is worked out at the press
// (planFlip): the lift-off push is the same every time, so the arc is too; the planner follows the line the
// car is travelling along, finds where that arc comes down to the ground, checks the way and the spot are
// clear, and the car then flies exactly that plan (flightPose) with the nozzles doing the work shown:
// down nozzles lift it off, it rolls once round its long axis in free flight, and upright again the down
// nozzles brake the fall so the wheels meet the ground at its slope with almost no vertical speed. The
// speed it had is the speed it lands with. A plan is a short list of numbers, so the other players get it
// in one message and fly the same arc (src/net/multiplayer.js).
//
// Pure logic, no rendering: runs in Node for tools/rocket-test.mjs.

export const TANK_S = 10;          // seconds of thrust in a full tank
export const JUMP_S = 5;           // ...of which one FLIP takes this much
export const REFILL_S = 120;       // an empty tank is full again after this long; nothing works meanwhile

const G = 9.81;
const OPEN_T = 0.05;               // a nozzle's valve opens and shuts in about this long (s)
const FADE0 = 370 / 3.6, FADE1 = 400 / 3.6;   // BOOST eases off between these speeds (m/s)
const LIFT_T = 0.25;               // the lift-off push lasts this long (s)...
const LIFT_V = 6;                  // ...and leaves the car rising this fast (m/s): 2.6 m up, 1.8 s in the air on the level
const BURN_A = 2 * G;              // the landing burn slows the fall by this much (m/s2; thrust of 3 g)
const SINK = 0.3;                  // ...down to this, which the springs take (m/s)
const ROLL_T0 = 0.6 * LIFT_T;      // the roll starts late in the lift-off push...
const ROLL_MIN = 0.75;             // ...and needs at least this long before the landing burn (s)
const ROLL_RAMP = 0.15;            // spinning it up, and stopping it (s)
const YAW_TAU = 0.12;              // the side nozzles stop the nose swinging in about this long (s)
const MAX_T = 6;                   // no flight longer than this (s)
const SLOPE_MAX = 0.35;            // no landing on ground steeper than this (rad)
const ROLL_ROOM = 1.25;            // houses and walls this far from the car's middle are in the way of the roll (m)
const LOW_CLEAR = 1.8;             // low things (rails, dividers) are flown over from this far above the ground (m)
// when the spot is blocked: the same arc with a lift-off this much weaker or stronger, nearest first
const SCALES = [1, 0.95, 1.05, 0.9, 1.1, 0.85, 1.15, 0.8, 1.2, 0.75, 1.25, 0.7, 1.3];
const WATER = 4;

// nozzle order in rocket.noz (0..1, how hard each works): 4 rear (left to right), down front-left,
// front-right, rear-left, rear-right, side left, side right
export const NOZ = 10;
export const NOZ_REAR = 0, NOZ_DOWN = 4, NOZ_SIDE = 8;

// Where the nozzles are on the stand-in body and which way their gas goes: [x, y, z, dx, dy, dz] from the middle
// of the wheelbase at road height, x to the right, z to the tail, in the order above. The body marks them
// (src/cars/models/rocket.js) and the jets are drawn from them (src/cars/plumes.js).
export const NOZZLES = [
  [-0.48, 0.5, 2.18, 0, 0, 1], [-0.17, 0.5, 2.18, 0, 0, 1], [0.17, 0.5, 2.18, 0, 0, 1], [0.48, 0.5, 2.18, 0, 0, 1],
  [-0.62, 0.14, -0.705, 0, -1, 0], [0.62, 0.14, -0.705, 0, -1, 0], [-0.62, 0.14, 0.705, 0, -1, 0], [0.62, 0.14, 0.705, 0, -1, 0],
  [-0.97, 0.3, 0.1, -1, 0, 0], [0.97, 0.3, 0.1, 1, 0, 0],
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

// The tank belongs to the car, not to one drive in it: back from the garage it is as full as it was left.
const TANKS = new Map();
export function rocketState(id) {
  let r = TANKS.get(id);
  if (!r) TANKS.set(id, r = { tank: TANK_S, reload: false, flight: null, boost: 0, deny: 0, flipHeld: false, launched: null, landed: false, noz: new Float32Array(NOZ) });
  r.flight = null; r.boost = 0; r.deny = 0; r.flipHeld = false; r.launched = null; r.landed = false; r.noz.fill(0);
  return r;
}
export function refillTank(id) { const r = TANKS.get(id); if (r) { r.tank = TANK_S; r.reload = false; } }

const use = (r, s) => { r.tank -= s; if (r.tank <= 1e-6) { r.tank = 0; r.reload = true; } };

// One frame of the thrusters. Returns true while a kickflip is flying (the car has been moved along its
// plan and the tyre physics must be left out). input: boost (held), flip (pressed), steer or left/right (the
// roll goes the way the wheel is held), rocketOff (the buttons do nothing: a race, the Raadi stage).
export function rocketStep(car, input, world, dt) {
  const r = car.rocket, T = car.spec.thrusters;
  if (r.reload) { r.tank = Math.min(TANK_S, r.tank + (dt * TANK_S) / REFILL_S); if (r.tank >= TANK_S) r.reload = false; }
  r.deny = Math.max(0, r.deny - dt);
  if (r.flight) { fly(car, dt); return true; }
  const off = !!input.rocketOff || car.inWater;
  const flip = !!input.flip;
  if (flip && !r.flipHeld && !off && !r.reload && r.tank >= JUMP_S - 1e-6) {
    const steer = input.steer !== undefined ? input.steer : (+input.right || 0) - (+input.left || 0);
    const plan = car.airborne ? null : planFlip(car, world, steer < -0.3 ? -1 : 1);
    if (plan) {
      use(r, JUMP_S);
      r.flight = plan; r.launched = plan; r.flipHeld = true; r.boost = 0; car.thrustN = 0;
      fly(car, dt);
      return true;
    }
    r.deny = 1.2;          // nowhere to land: no gas used, the button says so
  }
  r.flipHeld = flip;
  // BOOST
  const on = !!input.boost && !off && !r.reload && r.tank > 0;
  if (on) use(r, dt);
  const want = on ? clamp01((FADE1 - car.vx) / (FADE1 - FADE0)) : 0;
  r.boost += (want - r.boost) * Math.min(1, dt / OPEN_T);
  if (r.boost < 0.002) r.boost = 0;
  car.thrustN = r.boost * T.rear;
  const n = r.noz, k = Math.min(1, dt / OPEN_T);
  for (let i = 0; i < NOZ; i++) n[i] += ((i < NOZ_DOWN ? r.boost : 0) - n[i]) * k;
  return false;
}

// ---------------------------------------------------------------------------------------------- the plan
const tmpT = [], tmpB = [], tmpR = [0, 0, 0];
const ground = (world, x, z, y) => (world.groundAt ? world.groundAt(x, z, y + 0.4) : world.heightAt(x, z));
function boxDist(b, x, z) {
  const c = Math.cos(b.yaw), sn = Math.sin(b.yaw), px = x - b.x, pz = z - b.z;
  const qx = Math.abs(px * c - pz * sn) - b.hx, qz = Math.abs(px * sn + pz * c) - b.hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

// height and vertical speed before the landing burn: the lift-off push, then free flight
function rise(p, t, out) {
  if (t < LIFT_T) {
    const a = (p.vl - p.v0) / LIFT_T;
    out[0] = p.y0 + p.v0 * t + 0.5 * a * t * t; out[1] = p.v0 + a * t; out[2] = a;
  } else {
    const u = t - LIFT_T;
    out[0] = p.y0 + 0.5 * (p.v0 + p.vl) * LIFT_T + p.vl * u - 0.5 * G * u * u; out[1] = p.vl - G * u; out[2] = -G;
  }
  return out;
}
const tmpY = [0, 0, 0];
// height, vertical speed and vertical acceleration at time t of a plan
function heightAt(p, t, out) {
  if (t <= p.tb) return rise(p, t, out);
  // the landing burn: from the free flight's height and speed to the ground's, as one smooth curve
  const T = p.tl - p.tb, u = Math.min(1, (t - p.tb) / T);
  rise(p, p.tb, out);
  const ya = out[0], va = out[1] * T, yb = p.yl, vb = p.vland * T;
  const u2 = u * u, u3 = u2 * u;
  const y = (2 * u3 - 3 * u2 + 1) * ya + (u3 - 2 * u2 + u) * va + (-2 * u3 + 3 * u2) * yb + (u3 - u2) * vb;
  const v = ((6 * u2 - 6 * u) * ya + (3 * u2 - 4 * u + 1) * va + (-6 * u2 + 6 * u) * yb + (3 * u2 - 2 * u) * vb) / T;
  const a = ((12 * u - 6) * ya + (6 * u - 4) * va + (-12 * u + 6) * yb + (6 * u - 2) * vb) / (T * T);
  out[0] = y; out[1] = v; out[2] = a;
  return out;
}
// how far round the roll is (0..1) and how hard it is being spun up (+) or stopped (-), -1..1
function rollAt(p, t, out) {
  const T = p.tb - ROLL_T0, u = (t - ROLL_T0) / T, r = ROLL_RAMP / T;
  // (turning rate: up over r, steady, down over r; the steady rate is 1 / (1 - r) of a turn per T)
  const w = 1 / (1 - r);
  if (u <= 0) { out[0] = 0; out[1] = 0; }
  else if (u < r) { out[0] = (0.5 * w * u * u) / r; out[1] = 1; }
  else if (u < 1 - r) { out[0] = w * (u - 0.5 * r); out[1] = 0; }
  else if (u < 1) { const d = 1 - u; out[0] = 1 - (0.5 * w * d * d) / r; out[1] = -1; }
  else { out[0] = 1; out[1] = 0; }
  return out;
}
const tmpS = [0, 0];

// Where the car is at time t of its plan, written to out: x, y, z (of the car's origin, on the road between
// its wheels when upright), yaw, pitch, roll, vertical speed. The roll turns the car about its middle, not
// about the road under it, so the origin swings round the flight line.
export function flightPose(p, t, out) {
  t = Math.max(0, Math.min(p.tl, t));
  heightAt(p, t, tmpY);
  const yaw = p.yaw0 + p.yawR * YAW_TAU * (1 - Math.exp(-t / YAW_TAU));
  const k = smooth(t / p.tl);
  const turn = p.side * 2 * Math.PI * rollAt(p, t, tmpS)[0];
  const h = p.cg, sn = Math.sin(turn);
  out.x = p.x0 + p.vx * t - Math.cos(yaw) * h * sn;
  out.z = p.z0 + p.vz * t - Math.sin(yaw) * h * sn;
  out.y = tmpY[0] + h * (1 - Math.cos(turn));
  out.vy = tmpY[1];
  out.yaw = yaw;
  out.pitch = p.p0 + (p.pl - p.p0) * k;
  out.roll = p.r0 + (p.rl - p.r0) * k + turn;
  return out;
}

// How hard each nozzle works at time t of a plan (0..1), into noz: what the flight needs of them.
export function flightNozzles(p, t, noz, spec) {
  noz.fill(0);
  if (t >= p.tl) return noz;
  heightAt(p, t, tmpY);
  // down nozzles: whatever holds the car up against gravity beyond free fall
  const lift = t < LIFT_T || t > p.tb ? clamp01((spec.mass * (tmpY[2] + G)) / spec.thrusters.down) : 0;
  const spin = rollAt(p, t, tmpS)[1] * p.side;       // + spinning up to the right or stopping a roll to the left
  for (let i = 0; i < 4; i++) {
    const left = i % 2 === 0;
    noz[NOZ_DOWN + i] = clamp01(lift + (spin !== 0 ? (left === spin > 0 ? 0.3 : -0.15) : 0));
  }
  // side nozzles sit low on the sills: the right one pushes the floor left, which rolls the car to the right
  if (spin > 0) noz[NOZ_SIDE + 1] = 1; else if (spin < 0) noz[NOZ_SIDE] = 1;
  // (and the first moment of the flight they stop the nose swinging)
  if (t < 2 * YAW_TAU && Math.abs(p.yawR) > 0.05) noz[p.yawR > 0 ? NOZ_SIDE : NOZ_SIDE + 1] = Math.max(noz[p.yawR > 0 ? NOZ_SIDE : NOZ_SIDE + 1], 0.6);
  // rear nozzles: short puffs that give back what the air takes off the speed
  const v = Math.hypot(p.vx, p.vz);
  if (v > 3 && t > LIFT_T) { const puff = 0.12 + 0.1 * Math.sin(t * 40); for (let i = 0; i < 4; i++) noz[NOZ_REAR + i] = puff; }
  return noz;
}

// the ground under the four wheels of a car standing at (x, z, yaw): mean height, pitch and roll, as the physics has them
function stand(spec, world, x, z, yaw, y, out) {
  const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
  const L = spec.wheelbase, a = L * spec.cgFront, b = L - a, hw = spec.track / 2;
  const hFL = ground(world, x + fx * a - rx * hw, z + fz * a - rz * hw, y), hFR = ground(world, x + fx * a + rx * hw, z + fz * a + rz * hw, y);
  const hRL = ground(world, x - fx * b - rx * hw, z - fz * b - rz * hw, y), hRR = ground(world, x - fx * b + rx * hw, z - fz * b + rz * hw, y);
  out[0] = (hFL + hFR + hRL + hRR) / 4;
  out[1] = Math.atan2((hFL + hFR - hRL - hRR) / 2, L);
  out[2] = Math.atan2((hFL + hRL - hFR - hRR) / 2, spec.track);
  return out;
}
const tmpG = [0, 0, 0];

// The flight from where the car is now, or null when there is nowhere to land. side: 1 rolls to the right.
export function planFlip(car, world, side = 1) {
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
  const base = {
    x0: car.x, z0: car.z, y0: car.hy, vx: car.vx * fx + car.vy * rx, vz: car.vx * fz + car.vy * rz,
    v0: Math.max(-1, Math.min(2, car.vyUp || 0)), yaw0: car.yaw, yawR: Math.max(-3, Math.min(3, car.yawRate || 0)),
    p0: car.pitch, r0: car.roll, cg: car.spec.cgHeight, side, vl: 0, tb: 0, tl: 0, yl: 0, vland: 0, pl: 0, rl: 0, t: 0,
  };
  for (const k of SCALES) {
    const p = arc(car, world, { ...base, vl: LIFT_V * k });
    if (p) return p;
  }
  return null;
}

// (why the last arc tried was no good, for the test and for looking into a refusal)
let why = '';
export const flipRefusal = () => why;
const no = (w) => { why = w; return null; };
// one arc: when the landing burn must start for the car to arrive on the ground at the ground's own speed
function arc(car, world, p) {
  const gAt = (t, y) => ground(world, p.x0 + p.vx * t, p.z0 + p.vz * t, y);
  // (the burn that starts at tb: how long it lasts, where it ends, and how far above the ground there)
  let tl = 0, vland = 0;
  const miss = (tb) => {
    rise(p, tb, tmpY);
    const yb = tmpY[0], vb = tmpY[1];
    vland = -SINK;
    let yEnd = yb;
    for (let it = 0; it < 3; it++) {
      const T = Math.max(0.05, (vland - vb) / BURN_A);
      tl = tb + T;
      yEnd = yb + 0.5 * (vb + vland) * T;
      // (the ground's own rise or fall along the flight there)
      const e = 0.05, slope = (gAt(tl + e, yEnd) - gAt(tl - e, yEnd)) / (2 * e);
      vland = Math.max(-5, Math.min(3, slope)) - SINK;
    }
    return yEnd - gAt(tl, yEnd);
  };
  const first = ROLL_T0 + ROLL_MIN, step = 1 / 60;
  let lo = first, mLo = miss(lo);
  if (!(mLo > 0)) return no('ground too high');   // the roll would not be finished
  let hi = 0;
  for (let t = first + step; t < MAX_T; t += step) {
    const m = miss(t);
    if (m <= 0) { hi = t; break; }
    lo = t; mLo = m;
  }
  if (!hi) return no('no ground in reach');
  for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (miss(mid) > 0) lo = mid; else hi = mid; }
  const m = miss(lo);
  if (Math.abs(m) > 0.12) return no('step in the ground');    // (a wall, a deck's edge) where it would come down
  p.tb = lo; p.tl = tl; p.vland = vland;
  // the spot: the ground under the four wheels as the car will stand on it
  const yawL = p.yaw0 + p.yawR * YAW_TAU * (1 - Math.exp(-tl / YAW_TAU));
  const xl = p.x0 + p.vx * tl, zl = p.z0 + p.vz * tl;
  rise(p, lo, tmpY);
  stand(car.spec, world, xl, zl, yawL, tmpY[0] + 0.5 * (tmpY[1] + vland) * (tl - lo), tmpG);
  p.yl = tmpG[0]; p.pl = tmpG[1]; p.rl = tmpG[2];
  if (Math.abs(p.pl) > SLOPE_MAX || Math.abs(p.rl) > SLOPE_MAX) return no('too steep');
  if (world.surfaceAt(xl, zl, p.yl + 0.4) === WATER) return no('water');
  if (world.waterLevelAt && world.waterLevelAt(xl, zl) > p.yl + 0.3) return no('water');
  if (world.railPush && world.railPush(xl, zl, p.yl + 0.4, car.halfWid, tmpR)) return no('railing');
  if (world.ledgePush && world.ledgePush(xl, zl, p.yl + 0.4, car.halfWid + 0.25, tmpR)) return no('ledge');
  // the way there, and the spot's surroundings
  const hl = car.halfLen, hw = car.halfWid, n = Math.max(8, Math.ceil(tl * 30));
  const fx = Math.sin(yawL), fz = -Math.cos(yawL), rx = Math.cos(yawL), rz = Math.sin(yawL);
  for (let i = 0; i <= n; i++) {
    const t = (tl * i) / n, x = p.x0 + p.vx * t, z = p.z0 + p.vz * t;
    heightAt(p, t, tmpY);
    const up = tmpY[0] - gAt(t, tmpY[0]);
    const last = i === n;
    if (t < 0.1 && !last) continue;                            // where the car stands now is where it stands
    if (up < -0.05) return no('ground in the way');
    // houses, walls, the map's edge: no telling how high, so never over them
    if (world.sdfAt(x, z) < (last ? hw + 0.1 : ROLL_ROOM)) return no('house or wall');
    if (last) for (let q = 0; q < 4; q++) {
      const ox = fx * (q < 2 ? hl : -hl) + rx * (q % 2 ? hw : -hw), oz = fz * (q < 2 ? hl : -hl) + rz * (q % 2 ? hw : -hw);
      if (world.sdfAt(x + ox, z + oz) < 0.15) return no('house or wall');
    }
    // trees
    if (world.trunksNear && world.trunksNear(x, z, Math.hypot(hl, hw) + 0.6, tmpT).length) return no('tree');
    // rails, dividers and low walls: only where the car is low over them
    if (up < LOW_CLEAR && world.solidsNear) {
      const bs = world.solidsNear(x, z, hl + 0.5, tmpB);
      for (let b = 0; b < bs.length; b++) if (boxDist(bs[b], x, z) < (last ? hl : hw) + 0.2) return no('rail or divider');
    }
  }
  return p;
}

// A plan as the other players get it (src/net/multiplayer.js: one message at the press, and every page flies
// that car along the same curve): its numbers in this order, and back again. A list that is no plan (a word
// among the numbers, a flight of a minute, a car thrown a kilometre up) comes back as null.
const PLAN_KEYS = ['x0', 'z0', 'y0', 'vx', 'vz', 'v0', 'yaw0', 'yawR', 'p0', 'r0', 'cg', 'side', 'vl', 'tb', 'tl', 'yl', 'vland', 'pl', 'rl'];
const PLAN_DEC = [2, 2, 3, 3, 3, 3, 4, 3, 4, 4, 3, 0, 3, 4, 4, 3, 3, 4, 4];
export const PLAN_LEN = PLAN_KEYS.length;
export function packPlan(p) { return PLAN_KEYS.map((k, i) => { const m = 10 ** PLAN_DEC[i]; return Math.round(p[k] * m) / m; }); }
export function unpackPlan(a) {
  if (!Array.isArray(a) || a.length !== PLAN_LEN) return null;
  const p = { t: 0 };
  for (let i = 0; i < PLAN_LEN; i++) { if (typeof a[i] !== 'number' || !Number.isFinite(a[i])) return null; p[PLAN_KEYS[i]] = a[i]; }
  if (Math.abs(p.side) !== 1 || !(p.tl > LIFT_T && p.tl <= MAX_T + 1) || !(p.tb >= ROLL_T0 + ROLL_MIN - 0.02 && p.tb < p.tl)) return null;
  if (Math.hypot(p.vx, p.vz) > 150 || Math.abs(p.v0) > 3 || !(p.vl > 0 && p.vl <= LIFT_V * 1.31) || Math.abs(p.vland) > 20) return null;
  if (!(p.cg >= 0 && p.cg <= 1.5) || Math.abs(p.yawR) > 3.01 || Math.abs(p.yl - p.y0) > 200) return null;
  if (Math.max(Math.abs(p.p0), Math.abs(p.r0), Math.abs(p.pl), Math.abs(p.rl)) > 1.2) return null;
  return p;
}

// ---------------------------------------------------------------------------------------------- flying it
const pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, vy: 0 };
function fly(car, dt) {
  const r = car.rocket, p = r.flight, s = car.spec;
  p.t += dt;
  const done = p.t >= p.tl;
  flightPose(p, p.t, pose);
  car.x = pose.x; car.z = pose.z; car.yaw = pose.yaw; car.pitch = pose.pitch;
  car.y = car.hy = pose.y; car.vyUp = pose.vy;
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
  car.vx = p.vx * fx + p.vz * fz; car.vy = p.vx * rx + p.vz * rz;
  car.yawRate = done ? 0 : p.yawR * Math.exp(-p.t / YAW_TAU);
  car.pitchRate = car.rollRate = 0;
  car.throttle = 0; car.brake = 0; car.ax = car.ay = 0; car.thrustN = 0;
  car.steer *= Math.exp(-dt * 6);
  car.slipV = car.slipVF = car.slipVR = 0; car.spin = 0; car.skidF = car.skidR = car.rubF = car.rubR = 0; car.useF = car.useR = 0;
  const spin = (car.vx / s.wheelRadius) * dt;
  car.wheelSpin += spin; car.wheelSpinF += spin; car.wheelSpinR += spin;
  if (s.engine.type === 'ev') car.rpm = (Math.abs(car.vx) / s.wheelRadius) * s.gears[0] * (60 / (2 * Math.PI));
  car.lastGround = null; car.kerbS = null; car.stone = null;
  if (!done) {
    car.roll = pose.roll;
    car.airborne = true; car.airTime += dt; car.load = 0;
    flightNozzles(p, p.t, r.noz, s);
    return;
  }
  // touchdown: on the ground at the ground's slope, the springs at rest, the tyres taking over
  car.roll = p.rl; car.pitch = p.pl;
  car.airborne = false; car.airTime = 0; car.load = 1;
  car.landed = Math.max(car.landed || 0, 0.6);
  r.noz.fill(0); r.flight = null; r.landed = true;
}
