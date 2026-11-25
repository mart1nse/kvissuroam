// Cold-gas thrusters (the Tesla Roadster Rocket, Martin 2026-11-25): one tank feeding two buttons.
//
// BOOST: the rear nozzles push the body forward for as long as the button is held, a second of tank a
// second. FLIP: a kickflip jump that costs half a tank. The whole flight is worked out at the press
// (planFlip): the lift-off push is the same every time, so the arc is too; the planner follows the line the
// car is travelling along and finds where that arc comes down to the ground, and the car then flies exactly
// that plan (flightPose) with the nozzles doing the work shown. What stands in the way is the driver's to
// look out for (Martin 2026-11-25: "allow to jump and crash"): a house, a tree or a bank met in the air ends
// the flight there, and the car falls and hits it as any car would. On a clear way:
// the four corner nozzles under the floor lift it off, it rolls once round its long axis in free flight (one
// side's pair spins it up, the other side's stops it), and upright again they brake the fall so the wheels
// meet the ground at its slope with almost no vertical speed. The speed it had is the speed it lands with.
// The figures are those measured from Tesla's kickflip film (Martin 2026-11-25, skill-lync.com's analysis):
// the car's middle 8.7 m up at the top, about 3 s in the air, the roll 1.7 s long and starting 0.65 s after
// lift-off, a lift-off push of 0.45 s and a landing burn peaking at 3.3 g. A plan is a short list of numbers, so the other players get it
// in one message and fly the same arc (src/net/multiplayer.js).
//
// Pure logic, no rendering: runs in Node for tools/rocket-test.mjs.

export const TANK_S = 10;          // seconds of thrust in a full tank
export const JUMP_S = 5;           // ...of which one FLIP takes this much
export const REFILL_S = 120;       // an empty tank is full again after this long; nothing works meanwhile

const G = 9.81;
const OPEN_T = 0.05;               // a nozzle's valve opens and shuts in about this long (s)
const FADE0 = 370 / 3.6, FADE1 = 400 / 3.6;   // BOOST eases off between these speeds (m/s)
const LIFT_T = 0.45;               // the lift-off push lasts this long (s)...
const LIFT_V = 10.6;               // ...and leaves the car rising this fast (m/s): 8.1 m up, 3.1 s in the air on the level
const BURN_A = 2.3 * G;            // the landing burn slows the fall by this much (m/s2; thrust of 3.3 g)
const SINK = 0.3;                  // ...down to this, which the springs take (m/s)
const ROLL_T0 = 0.65;              // the roll starts this long after lift-off (s)...
const ROLL_T = 1.7;                // ...and takes this long (s), or what there is before the landing burn...
const ROLL_MIN = 1.1;              // ...which is never less than this (s)
const YAW_TAU = 0.12;              // the side nozzles stop the nose swinging in about this long (s)
const MAX_T = 6;                   // no flight longer than this (s)
const LOW_WALL = 1.5;              // a wall that belongs to no house stops the car only this low over the ground (m)
const TREE_TOP = 6;                // a tree is flown over from this far above the ground (m), into below it

// nozzle order in rocket.noz (0..1, how hard each works): 4 rear (left to right), down front-left,
// front-right, rear-left, rear-right, and the two at the nose that turn it: left, right
export const NOZ = 10;
export const NOZ_REAR = 0, NOZ_DOWN = 4, NOZ_YAW = 8;

// Where the nozzles are on the stand-in body and which way their gas goes: [x, y, z, dx, dy, dz] from the middle
// of the wheelbase at road height, x to the right, z to the tail, in the order above (the four at the tail close
// together in a row in the diffuser, as in Tesla's film). The body marks them
// (src/cars/models/rocket.js) and the jets are drawn from them (src/cars/plumes.js).
export const NOZZLES = [
  [-0.36, 0.36, 2.18, 0, 0, 1], [-0.12, 0.36, 2.18, 0, 0, 1], [0.12, 0.36, 2.18, 0, 0, 1], [0.36, 0.36, 2.18, 0, 0, 1],
  [-0.62, 0.14, -0.705, 0, -1, 0], [0.62, 0.14, -0.705, 0, -1, 0], [-0.62, 0.14, 0.705, 0, -1, 0], [0.62, 0.14, 0.705, 0, -1, 0],
  [-0.86, 0.36, -1.82, -1, 0, 0], [0.86, 0.36, -1.82, 1, 0, 0],
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

// The tank belongs to the car, not to one drive in it: back from the garage it is as full as it was left.
const TANKS = new Map();
export function rocketState(id) {
  let r = TANKS.get(id);
  if (!r) TANKS.set(id, r = { tank: TANK_S, reload: false, flight: null, up: 0, boost: 0, flipHeld: false, launched: null, landed: false, crashed: false, noz: new Float32Array(NOZ) });
  r.flight = null; r.boost = 0; r.flipHeld = false; r.launched = null; r.landed = false; r.crashed = false; r.noz.fill(0);
  return r;
}
export function refillTank(id) { const r = TANKS.get(id); if (r) { r.tank = TANK_S; r.reload = false; } }

const use = (r, s) => { r.tank -= s; if (r.tank <= 1e-6) { r.tank = 0; r.reload = true; } };

// One frame of the thrusters. Returns true while a kickflip is flying (the car has been moved along its
// plan and the tyre physics must be left out). input: boost (held), flip (pressed), steer or left/right (the
// roll goes the way the wheel is held), rocketOff (the buttons do nothing: waiting for a start), flipOff (no
// kickflip: a race, a timed lap, the Raadi stage).
export function rocketStep(car, input, world, dt) {
  const r = car.rocket, T = car.spec.thrusters;
  if (r.reload) { r.tank = Math.min(TANK_S, r.tank + (dt * TANK_S) / REFILL_S); if (r.tank >= TANK_S) r.reload = false; }
  // the gas is weight too (Martin 2026-11-25: about 250 kg of air in the two tanks): what has been used is off the car
  car.gasOut = (T.gasKg || 0) * (1 - r.tank / TANK_S);
  if (r.flight) { fly(car, world, dt); return !!r.flight; }
  const off = !!input.rocketOff || car.inWater;
  const flip = !!input.flip;
  if (flip && !r.flipHeld && !off && !input.flipOff && !r.reload && !car.airborne && r.tank >= JUMP_S - 1e-6) {
    const steer = input.steer !== undefined ? input.steer : (+input.right || 0) - (+input.left || 0);
    const plan = planFlip(car, world, steer < -0.3 ? -1 : 1);
    use(r, JUMP_S);
    r.flight = plan; r.launched = plan; r.flipHeld = true; r.boost = 0; car.thrustN = 0;
    fly(car, world, dt);
    return true;
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
const tmpT = [];
const ground = (world, x, z, y) => (world.groundAt ? world.groundAt(x, z, y + 0.4) : world.heightAt(x, z));

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
// how far round the roll is (0..1) and how hard it is being spun up (+) or stopped (-), -1..1: one smooth
// turn (the quintic 10s3 - 15s4 + 6s5), at rest at both ends
function rollAt(p, t, out) {
  const T = Math.min(ROLL_T, p.tb - ROLL_T0), u = (t - ROLL_T0) / T;
  if (u <= 0) { out[0] = 0; out[1] = 0; }
  else if (u < 1) { out[0] = u * u * u * (10 - 15 * u + 6 * u * u); out[1] = (60 * u - 180 * u * u + 120 * u * u * u) / 5.7735; }
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
  // the corner nozzles: whatever holds the car up against gravity beyond free fall...
  const lift = t < LIFT_T || t > p.tb ? clamp01((spec.mass * (tmpY[2] + G)) / spec.thrusters.down) : 0;
  // ...and the roll: the left pair pushes its side up to spin the car to the right, the right pair stops it
  const spin = rollAt(p, t, tmpS)[1] * p.side;       // + spinning up to the right or stopping a roll to the left
  for (let i = 0; i < 4; i++) {
    const left = i % 2 === 0;
    noz[NOZ_DOWN + i] = clamp01(lift + (left === spin > 0 ? 0.4 * Math.abs(spin) : 0));
  }
  // the two at the nose stop it swinging in the first moment of the flight (the right one pushes the nose left)
  if (t < 2 * YAW_TAU && Math.abs(p.yawR) > 0.05) noz[p.yawR > 0 ? NOZ_YAW + 1 : NOZ_YAW] = 0.6;
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

// The flight from where the car is now. side: 1 rolls to the right. The landing burn is timed for the ground
// the arc comes down to (its height, and its rise or fall along the way); the wheels are set down at its slope.
export function planFlip(car, world, side = 1) {
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
  const p = {
    x0: car.x, z0: car.z, y0: car.hy, vx: car.vx * fx + car.vy * rx, vz: car.vx * fz + car.vy * rz,
    v0: Math.max(-1, Math.min(2, car.vyUp || 0)), yaw0: car.yaw, yawR: Math.max(-3, Math.min(3, car.yawRate || 0)),
    p0: car.pitch, r0: car.roll, cg: car.spec.cgHeight, side, vl: LIFT_V, tb: 0, tl: 0, yl: 0, vland: 0, pl: 0, rl: 0, t: 0,
  };
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
  // the latest burn that still ends above the ground. Ground higher than the roll leaves time for (a bank, a
  // deck) is flown into; with none in reach the flight ends in the air and the car falls the rest
  const first = ROLL_T0 + ROLL_MIN, step = 1 / 60;
  let lo = first, hi = 0;
  if (miss(lo) > 0) {
    for (let t = first + step; t < MAX_T; t += step) { if (miss(t) <= 0) { hi = t; break; } lo = t; }
    if (hi) for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (miss(mid) > 0) lo = mid; else hi = mid; }
  }
  miss(lo);
  p.tb = lo; p.tl = tl; p.vland = vland;
  // the spot: the ground under the four wheels as the car will stand on it
  const yawL = p.yaw0 + p.yawR * YAW_TAU * (1 - Math.exp(-tl / YAW_TAU));
  rise(p, lo, tmpY);
  const yEnd = tmpY[0] + 0.5 * (tmpY[1] + vland) * (tl - lo);
  stand(car.spec, world, p.x0 + p.vx * tl, p.z0 + p.vz * tl, yawL, yEnd, tmpG);
  const lim = (v) => Math.max(-0.6, Math.min(0.6, v));
  p.yl = Math.abs(tmpG[0] - yEnd) < 0.5 ? tmpG[0] : yEnd; p.pl = lim(tmpG[1]); p.rl = lim(tmpG[2]);
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
// The flight is over before its plan is (crash: something was in the way) or the plan ends over a drop: the car
// is left to the ordinary physics as it is, in the air, to fall and hit what it hits. It goes on turning the way
// it was, at the rate that has it the right way up as it comes down (up: metres of air under it).
function letGo(car, rollRate, crash, up) {
  const r = car.rocket, TAU = 2 * Math.PI;
  const roll = car.roll = Math.atan2(Math.sin(car.roll), Math.cos(car.roll));
  const vy = car.vyUp || 0, fall = (vy + Math.sqrt(vy * vy + 2 * G * Math.max(0.3, up))) / G;
  const left = Math.abs(roll) < 0.05 ? 0 : rollRate >= 0 ? (roll <= 0 ? -roll : TAU - roll) : (roll >= 0 ? -roll : -TAU - roll);
  car.rollRate = Math.max(-8, Math.min(8, left / fall)); car.pitchRate = 0;
  car.airborne = true; car.load = 0;
  r.noz.fill(0); r.flight = null;
  if (crash) r.crashed = true; else r.landed = true;
}
function fly(car, world, dt) {
  const r = car.rocket, p = r.flight, s = car.spec;
  const roll0 = car.roll;
  p.t += dt;
  const done = p.t >= p.tl;
  flightPose(p, p.t, pose);
  // what is in the way: the ground itself (a bank), a house or a wall, a tree below its top
  const up = r.up = pose.y - ground(world, pose.x, pose.z, pose.y);
  if (p.t > 0.12) {
    // (a wall is in the way when the house it belongs to stands higher than the car is; one with no house to it,
    // a garden wall, a fence's footing, only low down)
    let wall = world.sdfAt(pose.x, pose.z) < car.halfWid * 0.9;
    if (wall && world.roofAt) {
      let top = -1e9;
      for (let k = 0; k < 5; k++) top = Math.max(top, world.roofAt(pose.x + (k === 1 ? 2 : k === 2 ? -2 : 0), pose.z + (k === 3 ? 2 : k === 4 ? -2 : 0)));
      wall = top > -1e8 ? pose.y < top + 0.2 : up < LOW_WALL;
    }
    const tree = !wall && up < TREE_TOP && world.trunksNear && world.trunksNear(pose.x, pose.z, car.halfWid + 0.3, tmpT).length > 0;
    if (wall || tree || (!done && up < -0.08)) { letGo(car, p.t > dt ? (pose.roll - roll0) / dt : p.side, true, up); return; }
  }
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
  car.roll = p.rl; car.pitch = p.pl;
  // (the plan ended over a drop: a deck's edge, a hole the planner's line did not see)
  if (pose.y - ground(world, pose.x, pose.z, pose.y) > 0.3) { letGo(car, 0, false, up); return; }
  // touchdown: on the ground at the ground's slope, the springs at rest, the tyres taking over
  car.airborne = false; car.airTime = 0; car.load = 1;
  car.landed = Math.max(car.landed || 0, 0.6);
  r.noz.fill(0); r.flight = null; r.landed = true;
}
