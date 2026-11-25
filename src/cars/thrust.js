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
export const QUICK_REFILL_S = 2;   // ...or after this long with input.quickRefill (offline testing, ?off=100: Martin 2026-11-25)

const G = 9.81;
// The tank blows down (Martin 25 Nov, the gas budget): 250 kg of cold gas leaving at GAS_V is 163 kN s of push in
// all, which is the tail's 80 kN for 2 s and no more. So BOOST's push follows the pressure, the share of the gas
// still in the tank, and so does the gas it spends: strong on a full tank, weaker with every second, and never
// quite done; at EMPTY of a tank nothing useful is left and the reload starts. A FLIP is its fixed half tank.
const GAS_V = 650;                 // cold gas leaves a nozzle at about this speed (m/s)
const EMPTY = 0.06;                // BOOST has blown the tank down to this share: the reload starts
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
  if (!r) TANKS.set(id, r = { tank: TANK_S, reload: false, flight: null, up: 0, boost: 0, flipHeld: false, launched: null, landed: false, crashed: false, noz: new Float32Array(NOZ), lean: new Float32Array(4) });
  r.flight = null; r.boost = 0; r.flipHeld = false; r.launched = null; r.landed = false; r.crashed = false; r.noz.fill(0); r.lean.fill(0);
  return r;
}
export function refillTank(id) { const r = TANKS.get(id); if (r) { r.tank = TANK_S; r.reload = false; } }

const use = (r, s) => { r.tank -= s; if (r.tank <= 1e-6) { r.tank = 0; r.reload = true; } };

// One frame of the thrusters. Returns true while a kickflip is flying (the car has been moved along its
// plan and the tyre physics must be left out). input: boost (held), flip (pressed), steer or left/right (the
// roll goes the way the wheel is held), rocketOff (the buttons do nothing: waiting for a start), flipOff (no
// kickflip: a race, a timed lap, the Raadi stage), quickRefill (an empty tank is full again in 2 s, not 2 min).
export function rocketStep(car, input, world, dt) {
  const r = car.rocket, T = car.spec.thrusters;
  r.refillS = input.quickRefill ? QUICK_REFILL_S : REFILL_S;
  if (r.reload) { r.tank = Math.min(TANK_S, r.tank + (dt * TANK_S) / r.refillS); if (r.tank >= TANK_S) r.reload = false; }
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
  const full = r.tank / TANK_S;                                   // the pressure, as a share of a full tank's
  if (on) {
    // (gas out per second = push / GAS_V, so the tank empties by its own share every blowS seconds)
    const blowS = (GAS_V * (T.gasKg || 250)) / T.rear;
    use(r, (dt * r.tank) / blowS);
    if (r.tank < EMPTY * TANK_S) use(r, r.tank);
  }
  const want = on ? full * clamp01((FADE1 - car.vx) / (FADE1 - FADE0)) : 0;
  r.boost += (want - r.boost) * Math.min(1, dt / OPEN_T);
  if (r.boost < 0.002) r.boost = 0;
  car.thrustN = r.boost * T.rear;
  const n = r.noz, k = Math.min(1, dt / OPEN_T);
  // (the jets show and sound the gas that leaves for as long as the button is held, also near the top speed
  // where it pushes less: Martin 25 Nov, the sound for the whole time Shift is down. They shrink with the
  // pressure, by its root, so the last of a tank is still seen and heard.)
  const jet = on ? Math.sqrt(full) : 0;
  for (let i = 0; i < NOZ; i++) n[i] += ((i < NOZ_DOWN ? jet : 0) - n[i]) * k;
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
// The fight for balance (Martin 25 Nov, from stills of Tesla's film: "no movement works in balance ... it tries to
// constantly find the balance"). Nothing in a flight is clean: the tail leaves the ground a moment before the
// nose, the body trembles about its long axis from lift-off on and the roll starts and runs unevenly, level is
// overshot and hunted for in several swings of unequal length ("not just one sideways struggle but a few of them,
// one can be a bit faster"), and the nose nods and swings a little all the way ("front and rear height is trying
// to find the balance"). How much of each, how fast and in what order differs from flight to flight, and is
// worked out from the plan's own numbers, so every page shows the same flight; the jets are then opened by what
// the body does (flightNozzles), so the two go together.
const rnd = (h, i) => {
  let x = (h + Math.imul(i + 1, 0x9e3779b9)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
const DEG = Math.PI / 180, TURN = 2 * Math.PI;
const S5 = (x) => x * x * x * (10 - 15 * x + 6 * x * x);
const OVER_MIN = 10 / 360, OVER_MORE = 6 / 360;   // the first overshoot of the roll, in turns
const HUNT_TAU = 0.4;                             // each swing back is this much smaller (the time to 37 %, s)
const KICK_TAU = 0.3, KICK_W = TURN / 0.75;       // the nose-down kick of lift-off dies away and swings back like this
const KICK_C = 1 / (Math.exp(-Math.atan(KICK_W * KICK_TAU) / (KICK_W * KICK_TAU)) * Math.sin(Math.atan(KICK_W * KICK_TAU)));
const HALF_BASE = 1.5;                            // metres from the middle to an axle, and a little: the nose wheels stay over the ground
const FIGHTS = new WeakMap();
// the three trembles of one axis: [amplitude, turns a second, phase] each
const trio = (h, i, amp, f0, f1) => [0, 1, 2].map((k) => [amp[k] * (0.7 + 0.6 * rnd(h, i + k * 3)), TURN * (f0[k] + f1[k] * rnd(h, i + k * 3 + 1)), TURN * rnd(h, i + k * 3 + 2)]);
const sum3 = (w, t) => w[0][0] * Math.sin(w[0][1] * t + w[0][2]) + w[1][0] * Math.sin(w[1][1] * t + w[1][2]) + w[2][0] * Math.sin(w[2][1] * t + w[2][2]);
function fight(p) {
  let f = FIGHTS.get(p);
  if (f) return f;
  const h = ((Math.round(p.x0 * 100) * 73856093) ^ (Math.round(p.z0 * 100) * 19349663)) >>> 0;
  const T = Math.min(ROLL_T, p.tb - ROLL_T0), tE = ROLL_T0 + T;
  // (the time there is for catching the roll: a landing right after it gets a smaller overshoot)
  const room = Math.max(0.05, p.tl - tE);
  f = {
    T, tE, room, tb: p.tb, tl: p.tl,
    over: (OVER_MIN + OVER_MORE * rnd(h, 0)) * Math.min(1, room / 0.5),
    // the hunt for level: a slow swing and a quicker one on top, so no two swings are as long or as deep
    w1: TURN / (0.46 + 0.14 * rnd(h, 1)), w2: TURN / (0.27 + 0.09 * rnd(h, 2)), mix: 0.3 + 0.15 * rnd(h, 3),
    roll: trio(h, 10, [1.5 / 360, 1 / 360, 0.5 / 360], [1.3, 2.3, 3.9], [0.5, 0.7, 0.9]),    // turns
    pitch: trio(h, 20, [0.7 * DEG, 0.5 * DEG, 0.3 * DEG], [1.1, 2, 3.4], [0.4, 0.6, 0.8]),  // radians
    yaw: trio(h, 30, [0.6 * DEG, 0.4 * DEG, 0.2 * DEG], [0.9, 1.7, 3], [0.4, 0.6, 0.8]),
    kick: (3.2 + 1.4 * rnd(h, 4)) * DEG,          // the nose dips this far as the tail kicks up first
    nose: (1 + 0.8 * rnd(h, 5)) * DEG,            // ...and is held this far up in the landing burn
    flut: [0, 1, 2, 3].map((i) => TURN * (5 + 4 * rnd(h, 40 + i))), drift: [0, 1, 2, 3].map((i) => TURN * (0.6 + 0.9 * rnd(h, 44 + i))),
  };
  FIGHTS.set(p, f);
  return f;
}
// (how much of the trembling there is: none on the wheels, all of it in the air, less of it into the touchdown)
const settle = (f, t) => 1 - 0.6 * smooth((t - (f.tl - 0.35)) / 0.35);
// The roll's own turn, 0 to 1 and a little over: one smooth turn (the quintic 10s3 - 15s4 + 6s5) that goes OVER
// level by 10 to 16 degrees...
function rollMain(f, t) {
  const u = (t - ROLL_T0) / f.T;
  return u <= 0 ? 0 : u < 1 ? (1 + f.over) * S5(u) : 1;
}
// ...and what is on top of it, in turns: the trembling all the way, and after the turn the hunt for level, the
// overshoot caught and pushed back under, over again, each swing smaller and none like the last, with a degree or
// two still in it as the wheels touch, for the springs to take
function rollPlay(f, t) {
  t = Math.min(t, f.tl);
  let v = smooth(t / 0.3) * settle(f, t) * sum3(f.roll, t);
  const x = t - f.tE;
  if (x >= 0) {
    const e = Math.exp(-x / HUNT_TAU), w = 1 - 0.5 * (x / f.room) ** 2;
    const s1 = Math.cos(f.w1 * x) + Math.sin(f.w1 * x) / (f.w1 * HUNT_TAU), s2 = Math.cos(f.w2 * x) + Math.sin(f.w2 * x) / (f.w2 * HUNT_TAU);
    v += f.over * e * w * ((1 - f.mix) * s1 + f.mix * s2);
  }
  return v;
}
// how far round the roll is (0..1; a little over or under 1 while it hunts for level)
const rollFrac = (p, t) => { const f = fight(p); return rollMain(f, t) + rollPlay(f, t); };
// The nose's nodding (radians, + up) apart from the lift-off kick: the trembling, stronger while the landing burn
// holds the car up, and the nose held a little high in that burn
function pitchPlay(f, t) {
  t = Math.min(t, f.tl);
  const burn = clamp01((t - f.tb) / (f.tl - f.tb)), sb = Math.sin(Math.PI * burn);
  return smooth((t - 0.25) / 0.4) * (1 + 0.8 * smooth((t - f.tb) / 0.2)) * settle(f, t) * sum3(f.pitch, t) + f.nose * sb * sb;
}
// ...and the kick: the tail leaves the ground first, so the nose dips (never further than the lift so far has
// room for: the nose wheels stay on the road until the car has risen), is caught, and swings a little high
function pitchKick(p, f, t) {
  const k = f.kick * KICK_C * Math.exp(-t / KICK_TAU) * Math.sin(KICK_W * t);
  if (k <= 0) return -k;
  const up = t < LIFT_T ? 0.5 * Math.max(0, (p.vl - p.v0) / LIFT_T) * t * t : 1e9;
  return -Math.min(k, up / HALF_BASE);
}
// the nose's swinging from side to side (radians): the same trembling, gone by the touchdown
const yawPlay = (f, t) => smooth((t - 0.2) / 0.4) * (1 - smooth((t - (f.tl - 0.4)) / 0.4)) * sum3(f.yaw, Math.min(t, f.tl));
// how hard something is being turned just then (the second difference of one of the curves above, per s2)
const PLAY_D = 0.02;
const pushOf = (fn, f, t) => (fn(f, t + PLAY_D) - 2 * fn(f, t) + fn(f, t - PLAY_D)) / (PLAY_D * PLAY_D);
// a valve that answers a push: shut for a small one, open quickly for more (the short and the long bursts)
const burst = (x, dead) => { const a = Math.abs(x); return a <= dead ? 0 : Math.sign(x) * Math.min(1, (a - dead) / (0.4 * (1 - dead))); };

// Where the car is at time t of its plan, written to out: x, y, z (of the car's origin, on the road between
// its wheels when upright), yaw, pitch, roll, vertical speed. The roll turns the car about its middle, not
// about the road under it, so the origin swings round the flight line.
export function flightPose(p, t, out) {
  t = Math.max(0, Math.min(p.tl, t));
  heightAt(p, t, tmpY);
  const f = fight(p);
  const yaw = p.yaw0 + p.yawR * YAW_TAU * (1 - Math.exp(-t / YAW_TAU));
  const k = smooth(t / p.tl);
  const turn = p.side * TURN * (rollMain(f, t) + rollPlay(f, t));
  const h = p.cg, sn = Math.sin(turn);
  out.x = p.x0 + p.vx * t - Math.cos(yaw) * h * sn;
  out.z = p.z0 + p.vz * t - Math.sin(yaw) * h * sn;
  out.y = tmpY[0] + h * (1 - Math.cos(turn));
  out.vy = tmpY[1];
  out.yaw = yaw + yawPlay(f, t);
  out.pitch = p.p0 + (p.pl - p.p0) * k + pitchKick(p, f, t) + pitchPlay(f, t);
  out.roll = p.r0 + (p.rl - p.r0) * k + turn;
  return out;
}

// How hard each nozzle works at time t of a plan (0..1), into noz: what the flight needs of them. And, into lean
// (when given), how far each of the four corner jets is swung out sideways (radians, + to the car's right): in
// the stills of Tesla's film the jets fan out, one straight down beside one blowing out to the side.
const HUNT_REF = 25, NOD_REF = 5, SWING_REF = 5;   // rad/s2 that opens a valve fully: the roll's hunt, the nodding, the nose's swing
const SPLAY = 0.2, SWING_AIR = 1.15, SWING_LIFT = 0.5;   // the corner jets lean out this much at rest, and this much more when their side gives way (rad)
export function flightNozzles(p, t, noz, spec, lean) {
  noz.fill(0);
  if (lean) lean.fill(0);
  if (t >= p.tl) return noz;
  const f = fight(p);
  heightAt(p, t, tmpY);
  // the corner nozzles: whatever holds the car up against gravity beyond free fall...
  const lift = t < LIFT_T || t > p.tb ? clamp01((spec.mass * (tmpY[2] + G)) / spec.thrusters.down) : 0;
  // ...and the roll. Its own turn is a long burn: one side's pair pushes its side up to spin the car, then the
  // other's stops it. The hunt and the trembling are bursts, short for a small correction and longer for a big
  // one, on whichever side the body is being pushed back from just then
  const u = (t - ROLL_T0) / f.T;
  const main = u > 0 && u < 1 ? (u * (60 + u * (-180 + 120 * u))) / 5.7735 : 0;
  const spin = Math.max(-1, Math.min(1, 0.75 * main + burst((pushOf(rollPlay, f, t) * TURN) / HUNT_REF, 0.12))) * p.side;   // + turning it to the right
  // the nodding: the front pair lifts the nose, the rear pair the tail
  const nod = burst(pushOf(pitchPlay, f, t) / NOD_REF, 0.15);
  for (let i = 0; i < 4; i++) {
    const left = i % 2 === 0, front = i < 2;
    const push = Math.max(0, left ? spin : -spin), ease = Math.max(0, left ? -spin : spin), pn = front ? nod : -nod;
    // (the tail's pair opens first at lift-off: the rear kicks up a moment before the nose)
    const open = front ? smooth((t - 0.05) / 0.09) : 1;
    // while they hold the car up, the side that gives way eases off and swings out; in free flight the pushing
    // side blows down and the other side blows out sideways (it pushes the floor across, the same way round)
    const k = lift * open * (1 - 0.5 * ease) * (1 + 0.3 * pn) + (1 - lift) * (0.8 * push + 0.5 * ease + 0.45 * Math.max(0, pn));
    noz[NOZ_DOWN + i] = clamp01(k * (0.9 + 0.1 * Math.sin(f.flut[i] * t + i * 1.7)));
    if (lean) lean[i] = (left ? -1 : 1) * (SPLAY + ease * (SWING_AIR + (SWING_LIFT - SWING_AIR) * lift)) + 0.07 * Math.sin(f.drift[i] * t + i * 2.3);
  }
  // the two at the nose stop it swinging in the first moment of the flight (the right one pushes the nose left),
  // and after that answer its trembling
  if (t < 2 * YAW_TAU && Math.abs(p.yawR) > 0.05) noz[p.yawR > 0 ? NOZ_YAW + 1 : NOZ_YAW] = 0.6;
  const sw = burst(pushOf(yawPlay, f, t) / SWING_REF, 0.3);
  if (sw) { const i = sw > 0 ? NOZ_YAW : NOZ_YAW + 1; noz[i] = Math.max(noz[i], 0.7 * Math.abs(sw)); }   // (+ yaw is to the right: the left one pushes the nose right)
  // (the four at the tail stay shut in a flight: they are BOOST's, and blow only when they push. Martin 25 Nov)
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
  r.noz.fill(0); r.lean.fill(0); r.flight = null;
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
    flightNozzles(p, p.t, r.noz, s, r.lean);
    return;
  }
  // (what is left of the roll's hunting is in the body as the wheels touch: the springs take it)
  // (and of the nose's nodding)
  car.roll = p.rl + (rollFrac(p, p.tl) - 1) * 2 * Math.PI * p.side; car.pitch = pose.pitch;
  // (the plan ended over a drop: a deck's edge, a hole the planner's line did not see)
  if (pose.y - ground(world, pose.x, pose.z, pose.y) > 0.3) { letGo(car, 0, false, up); return; }
  // touchdown: on the ground at the ground's slope, the springs at rest, the tyres taking over
  car.airborne = false; car.airTime = 0; car.load = 1;
  car.landed = Math.max(car.landed || 0, 0.6);
  r.noz.fill(0); r.lean.fill(0); r.flight = null; r.landed = true;
}
