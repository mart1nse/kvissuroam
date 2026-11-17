// Vehicle dynamics: a planar single-track ("bicycle") model with load transfer,
// a sprung body that can leave the ground, friction circles, a simple automatic gearbox and SDF collisions. Pure logic,
// no rendering, so it also runs in Node for the performance calibration test.
//
// Frames: world x = east, z = south, y = up. Heading `yaw` is clockwise from
// north. Body frame: vx forward, vy to the right, yawRate clockwise positive.

const G = 9.81;
const LAT_KEEP = 0.4;            // sideways grip a spinning tyre always keeps (share of peak)
const SHAFT_DECAY = 0.8;         // turbine spin-down after a lift (1/s)
const CATCH = 0.55;               // how much of the opposite lock eases off as a caught slide swings back
const CATCH_T = 0.3;             // ...looking this far ahead (s)
const CASTER = 0.45;             // how far a released wheel follows the slide
const HOLD_FOLLOW = 0.15;        // ...and how far it still does while the driver keeps steering into the turn
const LON_SHARE = 0.7;           // how much cornering eats into traction (1 = full friction circle)
const SPIN_YAW = 0.04;          // left/right traction imbalance while the wheels spin
const DONUT = 0.4;              // how firmly a held donut is kept going (share of m*g*L as yaw moment)
const DONUT_LO = 0.6, DONUT_HI = 1.1;    // ...the slide angle band it keeps the car in (rad)
const DONUT_WAIT = 0.3;          // ...and only starts pushing a car round this long after it is floored (s)
const DONUT_LEAD = 0.3;          // ...judged this far ahead (s)
const EV_SLIDE_REAR = 0.7;      // rear share a two-motor EV moves to while powersliding under 100 km/h
const RHO = 1.2;

// Body heave on the suspension, per kg of car: a 1.5 Hz spring with half-critical
// damping that can push the car up but never pull it down. STATIC is how far
// the springs are squeezed at rest, which is also how far the wheels can drop
// before they leave the road.
const SPRING = (2 * Math.PI * 1.5) ** 2;
const DAMP = 2 * 0.5 * Math.sqrt(SPRING);
const STATIC = G / SPRING;
const BUMP = STATIC + 0.09;      // travel where the bump stops start
const FLOOR = 0.13;              // the body never sits lower than this below its ride height

// grip, rolling resistance, tyre stiffness and bumpiness per surface class
// kp / tail describe traction under wheelspin: grip peaks at slip ratio kp and
// settles at `tail` of the peak when the wheel spins freely. Tarmac loses a
// good part of its bite, loose ground hardly any (the tyre digs in).
const SURF = [
  { mu: 0.62, crr: 0.075, b: 5.5, bump: 1.0, kp: 0.25, tail: 0.95 },   // grass
  { mu: 1.0, crr: 0.013, b: 10.0, bump: 0.0, kp: 0.12, tail: 0.87 },   // paved
  { mu: 0.72, crr: 0.03, b: 7.0, bump: 0.35, kp: 0.3, tail: 0.97 },    // gravel
  { mu: 0.62, crr: 0.045, b: 6.0, bump: 0.6, kp: 0.3, tail: 0.95 },    // dirt
  { mu: 0.4, crr: 0.3, b: 4.0, bump: 0.0, kp: 0.3, tail: 0.9 },        // water (shallows)
];
const WATER = 4;

function lerpTable(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

export function createCar(spec, pose) {
  const L = spec.wheelbase;
  return {
    spec,
    x: pose.x, z: pose.z, y: pose.y ?? 0, yaw: pose.yaw ?? 0,
    vx: 0, vy: 0, yawRate: 0, vyBody: 0,
    // vertical motion: hy is the body height the dynamics use (y is what gets drawn),
    // load is the weight on the tyres as a share of the car's own weight
    hy: pose.y ?? 0, vyUp: 0, lastGround: null, load: 1,
    airborne: false, airTime: 0, landed: 0,
    pitchRate: 0, rollRate: 0,
    pitch: 0, roll: 0, groundPitch: 0, groundRoll: 0,
    steer: 0, wheelSpin: 0, wheelSpinF: 0, wheelSpinR: 0,
    slipV: 0, slipVF: 0, slipVR: 0, spin: 0, useF: 0, useR: 0,   // driven-wheel slip speed (m/s), 0..1 wheelspin, lateral grip in use
    gear: 1, shiftTimer: 0, rpm: spec.engine.idle ?? 0, reversing: false, boost: 0, shaft: 0, carry: 0, revCut: 0, csHold: 0, csDir: 0,
    throttle: 0, brake: 0,
    ax: 0, ay: 0,
    surface: 1,
    inWater: false, waterTime: 0, sunk: false, waterLevel: 0,
    hit: 0,                      // strength of the last impact (m/s), decays
    a: L * spec.cgFront, b: L * (1 - spec.cgFront),
    iz: spec.mass * (0.5 * L) ** 2 * 1.15,
    halfLen: L / 2 + 0.85, halfWid: spec.track / 2 + 0.13,
    time: 0,
  };
}

export function speedKmh(car) {
  return Math.hypot(car.vx, car.vy) * 3.6;
}

// rev limiter: the shortest ignition cut (s) and how far the revs must fall before it returns (rpm);
// an engine can set its own with revCut and revCutDrop
const REV_CUT_TIME = 0.03, REV_CUT_DROP = 120;

function engineForce(car, throttle, dt) {
  // Returns the drive force at the wheels (N, signed along vx) and updates rpm / gear.
  // The engine turns with the driven wheels, so under wheelspin the revs follow
  // the wheel speed (wAbs), not the road speed (vAbs). The gearbox shifts on
  // road speed, so it holds its gear while the wheels spin.
  const s = car.spec, e = s.engine;
  const v = car.vx;
  const dir = car.reversing ? -1 : 1;
  const vAbs = Math.abs(v);
  const wAbs = Math.abs(v + dir * car.slipV);
  if (e.type === 'ev') {
    const ratio = s.gears[0];
    car.rpm = (wAbs / s.wheelRadius) * ratio * (60 / (2 * Math.PI));
    car.gear = 1;
    let f = Math.min(e.maxWheelForce, (e.maxPowerKw * 1000 * s.efficiency) / Math.max(wAbs, 0.5));
    const wLim = (s.limiter || 180) / 3.6 * 1.15;      // motor speed limit
    if (wAbs > wLim - 2) f *= Math.max(0, (wLim - wAbs) / 2);
    const lim = car.reversing ? 30 : s.limiter;
    if (lim && vAbs * 3.6 > lim - 2) f *= Math.max(0, (lim - vAbs * 3.6) / 2);
    // one-pedal style regeneration when lifting off
    if (throttle <= 0) return vAbs > 0.5 ? -Math.sign(v) * Math.min(1800, 0.09 * s.mass * G * 0.35) : 0;
    return dir * f * throttle;
  }
  const ratioOf = (g) => (car.reversing ? s.reverse : s.gears[g - 1]) * s.finalDrive;
  const rpmAt = (g) => (vAbs / s.wheelRadius) * ratioOf(g) * (60 / (2 * Math.PI));
  if (car.reversing) car.gear = 1;
  else if (car.shiftTimer <= 0) {
    // kick-down automatic: lowest gear that stays below the shift point
    let g = car.gear;
    // (it also shifts a little early rather than run into the rev limiter when the tyres are only just slipping)
    const early = rpmAt(g) > e.shiftRpm * 0.88 && rpmAt(g) * wAbs >= e.redline * vAbs;
    if ((rpmAt(g) > e.shiftRpm || early) && g < s.gears.length) g++;
    else if (g > 1 && rpmAt(g - 1) < e.shiftRpm * (throttle > 0.5 ? 0.9 : 0.55)) g--;
    if (g !== car.gear) { car.gear = g; car.shiftTimer = s.shiftTime; }
  }
  if (car.shiftTimer > 0) car.shiftTimer -= dt;
  const wheelRpm = (wAbs / s.wheelRadius) * ratioOf(car.gear) * (60 / (2 * Math.PI));
  // torque converter: engine speed never drops below stall while the throttle is open
  const stall = e.idle + (e.stallRpm - e.idle) * throttle;
  const rpm = Math.max(wheelRpm, stall);
  const sr = Math.min(1, wheelRpm / rpm);
  // Turbocharged engines: boost only builds once the exhaust flows enough to
  // spin the turbines, and it takes time to get there (turbo lag). It drops
  // almost at once when the throttle closes.
  const tb = e.turbo;
  // Lifting dumps the boost pressure at once, but the turbine wheels keep
  // spinning down for a second or two, so a quick lift and re-press builds
  // boost again almost straight away; only a long lift brings the lag back.
  if (tb) {
    const rEff = Math.max(rpm, car.carry);
    const u = Math.max(0, Math.min(1, (rEff - tb.onRpm) / (tb.fullRpm - tb.onRpm)));
    const want = throttle * u * u * (3 - 2 * u);
    const sk = want > car.shaft ? tb.spool * (0.25 + 0.75 * Math.min(1, rEff / e.redline)) : SHAFT_DECAY;
    car.shaft += (want - car.shaft) * Math.min(1, dt * sk);
    // pressure follows the turbine speed quickly, and dumps at once on a lift
    const up = Math.min(want, car.shaft);
    car.boost += (up - car.boost) * Math.min(1, dt * (up > car.boost ? 25 : tb.dump));
  }
  const gain = 1 + (e.converterGain - 1) * (1 - sr) ** 2;
  // Engine inertia: after a lift the engine spins down at the rate its
  // flywheel and friction allow (revDrop rpm/s), not at once. Pressing again
  // before it has dropped picks up from those revs, and the torque converter
  // passes some of the stored flywheel energy on to the wheels as it pulls
  // the engine back down.
  const drop = e.revDrop ?? 3200;
  if (throttle <= 0) car.carry = car.lifted ? Math.max(0, car.carry - drop * dt) : Math.min(car.rpm, e.redline);
  else car.carry = Math.max(0, car.carry - drop * 1.2 * dt);
  car.lifted = throttle <= 0;
  // Hard rev limiter, only reached with spinning wheels (shifts come earlier). At the redline the
  // ignition is cut for a moment and stays off until the revs have fallen back, so an engine held flat
  // out on spinning wheels (a donut, a burnout) bounces off the limiter instead of sitting on it.
  // revCut > 0 is the cut in progress; the sound follows it.
  if (throttle <= 0) car.revCut = 0;
  else if (car.revCut > 0) {
    car.revCut -= dt;
    if (car.revCut <= 0) car.revCut = wheelRpm > e.redline - (e.revCutDrop ?? REV_CUT_DROP) ? 1e-4 : 0;
  } else if (wheelRpm >= e.redline) car.revCut = e.revCut ?? REV_CUT_TIME;
  const rpmTo = Math.min(Math.max(rpm, car.carry), e.redline);
  // (the needle and the engine note follow the bounce closely)
  car.rpm += (rpmTo - car.rpm) * Math.min(1, dt * (wheelRpm > e.redline - 600 ? 40 : 12));
  if (throttle <= 0) {
    // engine braking through the converter
    return vAbs > 0.3 ? -Math.sign(v) * (180 + 0.045 * wheelRpm) * (ratioOf(car.gear) / 8) : 0;
  }
  if (car.revCut > 0 || (car.reversing && vAbs > 11)) return 0;
  const cut = car.shiftTimer > 0 ? 0.25 : 1;
  const rq = Math.max(rpm, car.carry);
  const full = lerpTable(e.torque, rq);
  const base = tb ? lerpTable(tb.torqueOff, rq) : full;
  const kick = 1 + 0.5 * Math.min(1, Math.max(0, (car.carry - rpm) / rpm));
  let tq = (base + (full - base) * (tb ? car.boost : 1)) * gain * throttle * cut * kick;
  // electronic speed limiter
  if (s.limiter && !car.reversing && vAbs * 3.6 > s.limiter - 2) tq *= Math.max(0, (s.limiter - vAbs * 3.6) / 2);
  return (dir * tq * ratioOf(car.gear) * s.efficiency) / s.wheelRadius;
}

const tmpG = [0, 0];
const tmpA = [0, 0];
const tmpR = [0, 0, 0];

// input: { up, down, left, right, handbrake } booleans or 0..1 values, steer optional (-1..1)
export function stepCar(car, input, world, dtFrame) {
  const n = Math.max(1, Math.ceil(dtFrame / (1 / 240)));
  const dt = dtFrame / n;
  for (let i = 0; i < n; i++) substep(car, input, world, dt);
  car.time += dtFrame;
  car.hit *= Math.exp(-dtFrame * 4);
  car.landed *= Math.exp(-dtFrame * 6);
}

function substep(car, input, world, dt) {
  car.skidF = car.skidR = car.rubF = car.rubR = 0;
  const s = car.spec;
  const m = s.mass, L = s.wheelbase;
  const up = +input.up || 0, down = +input.down || 0;
  const sinY = Math.sin(car.yaw), cosY = Math.cos(car.yaw);
  const fx = sinY, fz = -cosY;      // forward
  const rx = cosY, rz = sinY;       // right
  const speed = Math.hypot(car.vx, car.vy);

  // ---- arrow-key semantics: up drives forward, down brakes then reverses
  let throttle = 0, brake = 0;
  if (!car.reversing) {
    throttle = up;
    if (down > 0) {
      if (car.vx > 0.6) brake = down;
      else if (up === 0) car.reversing = true;
    }
  }
  if (car.reversing) {
    throttle = down;
    if (up > 0) {
      if (car.vx < -0.6) brake = up;
      else if (down === 0) { car.reversing = false; throttle = 0; }
    }
  }
  if (car.reversing && down === 0 && up === 0 && Math.abs(car.vx) < 0.2) car.reversing = false;
  car.throttle = throttle; car.brake = brake;

  // ---- ground under the wheels
  const hw = s.track / 2;
  const pFLx = car.x + fx * car.a - rx * hw, pFLz = car.z + fz * car.a - rz * hw;
  const pFRx = car.x + fx * car.a + rx * hw, pFRz = car.z + fz * car.a + rz * hw;
  const pRLx = car.x - fx * car.b - rx * hw, pRLz = car.z - fz * car.b - rz * hw;
  const pRRx = car.x - fx * car.b + rx * hw, pRRz = car.z - fz * car.b + rz * hw;
  // (groundAt knows about bridge decks; a plain test world only needs heightAt)
  const gy = car.hy + 0.4;
  const hFL = world.groundAt ? world.groundAt(pFLx, pFLz, gy) : world.heightAt(pFLx, pFLz);
  const hFR = world.groundAt ? world.groundAt(pFRx, pFRz, gy) : world.heightAt(pFRx, pFRz);
  const hRL = world.groundAt ? world.groundAt(pRLx, pRLz, gy) : world.heightAt(pRLx, pRLz);
  const hRR = world.groundAt ? world.groundAt(pRRx, pRRz, gy) : world.heightAt(pRRx, pRRz);
  const groundY = (hFL + hFR + hRL + hRR) / 4;
  car.groundPitch = Math.atan2((hFL + hFR - hRL - hRR) / 2, L);       // nose-up positive
  car.groundRoll = Math.atan2((hFL + hRL - hFR - hRR) / 2, s.track);   // left side high -> rolls right
  const surfF = world.surfaceAt(car.x + fx * car.a, car.z + fz * car.a, gy);
  const surfR = world.surfaceAt(car.x - fx * car.b, car.z - fz * car.b, gy);
  const sf = SURF[surfF] || SURF[0], sr = SURF[surfR] || SURF[0];
  car.surface = world.surfaceAt(car.x, car.z, gy);

  // ---- water
  const wl = world.waterLevelAt ? world.waterLevelAt(car.x, car.z) : world.meta.riverLevel;
  const depth = car.surface === WATER ? wl - groundY : 0;
  if (!car.inWater && depth > 0.55 && car.hy < wl + 0.4) { car.inWater = true; car.waterTime = 0; car.waterLevel = wl; }
  if (car.inWater) {
    car.waterTime += dt;
    const k = Math.exp(-dt * 1.6);
    car.vx *= k; car.vy *= k; car.yawRate *= Math.exp(-dt * 2.5);
    // weak push from the last of the wheelspin, river current
    const still = Math.max(0, 1 - car.waterTime / 2.5);
    car.vx += (up - down) * 1.2 * still * dt;
    const wxv = car.vx * fx + car.vy * rx + 0.08 * dt * 60 * 0.02, wzv = car.vx * fz + car.vy * rz + 0.3 * dt * 60 * 0.02;
    car.x += wxv * dt; car.z += wzv * dt;
    car.yaw += car.yawRate * dt;
    // float for a moment, then go down nose first
    const floatY = car.waterLevel - 0.45;
    const bedY = world.heightAt(car.x, car.z) + 0.05;
    const sinkStart = 1.8;
    let targetY = floatY;
    if (car.waterTime > sinkStart) targetY = Math.max(bedY, floatY - (car.waterTime - sinkStart) * 0.55);
    car.y += (targetY - car.y) * Math.min(1, dt * 4);
    const going = car.waterTime > sinkStart && car.y > bedY + 0.15;
    const tp = going ? -0.32 : (car.y <= bedY + 0.2 ? car.groundPitch : -0.05);
    car.pitch += (tp - car.pitch) * Math.min(1, dt * 1.5);
    car.roll += (Math.sin(car.waterTime * 1.7) * 0.05 * (going ? 1 : 0.4) - car.roll) * Math.min(1, dt * 2);
    car.rpm *= Math.exp(-dt * 3);
    car.wheelSpin += (car.vx / s.wheelRadius) * dt;
    car.wheelSpinF = car.wheelSpinR = car.wheelSpin; car.slipV = car.slipVF = car.slipVR = 0; car.spin = 0;
    car.steer *= Math.exp(-dt * 3);
    if (!car.sunk && car.y <= Math.max(bedY + 0.2, car.waterLevel - 1.3) + 0.01 && car.waterTime > sinkStart + 0.8) car.sunk = true;
    if (!car.sunk && car.waterTime > 9) car.sunk = true;
    car.ax = 0; car.ay = 0;
    car.hy = car.y; car.vyUp = 0; car.lastGround = null; car.load = 1; car.airborne = false; car.airTime = 0;
    return;
  }

  // ---- heave: the body rides the ground on its springs and flies when the ground drops away
  // faster than it can fall
  const vGround = car.lastGround === null ? 0 : (groundY - car.lastGround) / dt;
  car.lastGround = groundY;
  const comp = groundY + STATIC - car.hy;     // spring travel in use; below zero the wheels hang clear
  let lift = 0;                               // upward acceleration from the suspension
  if (comp > 0) {
    // (a kerb or the lip of a deck is a step in the ground: the damper only sees so much of it)
    lift = SPRING * comp + DAMP * Math.max(-4, Math.min(4, vGround - car.vyUp));
    if (comp > BUMP) lift += 6 * SPRING * (comp - BUMP);
    if (lift < 0) lift = 0;
    if (car.airborne) {
      if (car.airTime > 0.12) car.landed = Math.max(car.landed, Math.min(vGround, 0) - car.vyUp);
      car.airborne = false; car.airTime = 0;
    }
  } else {
    car.airborne = true; car.airTime += dt;
  }
  car.vyUp += (lift - G) * dt;
  car.hy += car.vyUp * dt;
  if (car.hy < groundY - FLOOR) { car.hy = groundY - FLOOR; if (car.vyUp < 0) car.vyUp = 0; }
  // weight on the tyres: light over a crest, heavy in a dip, none in the air
  if (car.airborne) car.load = 0;
  else car.load += (Math.min(2.5, lift / G) - car.load) * Math.min(1, dt * 40);
  const load = car.load;

  // ---- steering: fast at parking speeds, limited near the grip limit when quick
  const steerIn = input.steer !== undefined ? input.steer : (+input.right || 0) - (+input.left || 0);
  const maxLock = 0.6;
  const vS = Math.max(Math.abs(car.vx), 1);
  const gripLock = Math.atan((1.25 * G * L) / (vS * vS));
  const lock = Math.min(maxLock, gripLock);
  // In a slide the front wheels need the slide angle on top of the usual lock
  // to point where the car is going, so the limit is centred on that angle;
  // and like a real steering wheel let go of, a released wheel casters most
  // of the way towards it.
  const sliding = Math.max(0, Math.min(1, (Math.abs(car.slipR || 0) - 0.1) / 0.1));
  const align = sliding > 0 && car.vx > 2 ? sliding * Math.atan2(car.vy + car.a * car.yawRate, car.vx) : 0;
  // Steering against the slide gets the full angle, so opposite lock reaches
  // far enough to catch it. Holding the wheel into the turn is the driver
  // asking for the slide, so the wheels mostly stay where they are put.
  const follow = steerIn === 0 ? CASTER : steerIn * align < 0 ? HOLD_FOLLOW : 1;
  // Catching a slide: held opposite lock points the wheels past the direction
  // of travel, and once the tail swings back that extra lock keeps rotating
  // the car, flinging it into a slide the other way (a tank-slapper). A driver
  // unwinds the wheel as the tail comes back. Here the opposite lock eases off
  // when the rear slip angle is on course to pass zero within CATCH_T, and
  // stays eased for a moment afterwards while the same key is still held.
  const sR = car.slipR || 0, dsR = (sR - (car.slipRPrev ?? sR)) / dt;
  car.slipRPrev = sR;
  let over = 0;
  if (steerIn !== 0 && steerIn * align > 0 && Math.abs(sR) > 0.03) {
    const pred = sR + dsR * CATCH_T;
    if (pred * sR < 0) over = Math.min(1, -pred / sR);
    car.csDir = Math.sign(steerIn);
  }
  if (steerIn === 0 || Math.sign(steerIn) !== car.csDir) car.csHold = 0;
  else car.csHold = Math.max(over, car.csHold - dt * 1.5);
  const ease = 1 - CATCH * car.csHold;
  const target = Math.max(-maxLock, Math.min(maxLock, (steerIn * lock + align * follow) * ease));
  // (unwinding is quick: in a slide the wheel spins back through your hands)
  const rate = ((steerIn === 0 ? 2.6 : 1.7) * Math.max(lock, 0.08) + 0.25) * (1 + 2 * car.csHold);
  const ds = target - car.steer;
  car.steer += Math.sign(ds) * Math.min(Math.abs(ds), rate * dt);
  const sd = Math.sin(car.steer), cd = Math.cos(car.steer);

  // ---- vertical loads with longitudinal transfer
  const transfer = (m * car.ax * s.cgHeight) / L;
  // (in the air a trace of load is kept so nothing below divides by zero)
  const tl = Math.max(load, 1e-4);
  const fzF = Math.max(0.1 * m * G, (m * G * car.b) / L - transfer) * tl;
  const fzR = Math.max(0.1 * m * G, (m * G * car.a) / L + transfer) * tl;

  // ---- slip angles
  const v0 = 2.0;
  const vLatF = -car.vx * sd + (car.vy + car.a * car.yawRate) * cd;
  const vLonF = car.vx * cd + (car.vy + car.a * car.yawRate) * sd;
  const vLatR = car.vy - car.b * car.yawRate;
  const slipF = Math.atan2(vLatF, Math.max(Math.abs(vLonF), v0));
  const slipR = Math.atan2(vLatR, Math.max(Math.abs(car.vx), v0));
  car.slipR = slipR;

  // ---- longitudinal forces
  const dir = car.reversing ? -1 : 1;
  const hb = +input.handbrake || 0;
  const drivenF = s.drive !== 'rwd', drivenR = s.drive !== 'fwd';
  // (wide performance tyres: spec.grip scales every surface)
  const tyre = s.grip ?? 1;
  const capF = sf.mu * tyre * fzF, capR = sr.mu * tyre * fzR;
  // traction left on each driven axle once cornering has taken its share
  const lonF = drivenF ? capF * Math.sqrt(1 - LON_SHARE * car.useF * car.useF) : 0;
  const lonR = drivenR ? capR * Math.sqrt(1 - LON_SHARE * car.useR * car.useR) : 0;
  const drive = engineForce(car, throttle, dt);
  const vSign = Math.abs(car.vx) > 0.05 ? Math.sign(car.vx) : 0;
  const brakeTotal = brake * 1.05 * m * G * Math.min(1, load * 4);
  const brakeF = brakeTotal * 0.66, brakeR = brakeTotal * 0.34;
  // Share of the drive sent to the rear axle. Two-motor EVs have a fixed
  // split set by their motors; an on-demand coupling sends more to the rear
  // only once the front wheels start to spin. Nothing moves torque towards
  // the axle with grip to spare, so a rear-biased car that floors it on a
  // loaded rear axle can break the tail loose while the front still grips.
  const base = s.drive === 'rwd' ? 1 : s.drive === 'fwd' ? 0 : s.rearShare ?? 0.5;
  let shareR = s.rearShareMax ? base + (s.rearShareMax - base) * Math.min(1, car.slipVF / 2) : base;
  // A two-motor EV sets its split in software. Floored in a slide at modest
  // speed it lets the rear motor do more of the work, so the front wheels stop
  // dragging the car straight and the slide can be held on the throttle
  // (as the drift modes of powerful twin-motor cars do).
  const bodySlip = Math.abs(Math.atan2(car.vy, Math.max(car.vx, 1)));
  if (s.drive === 'awd' && s.engine.type === 'ev' && throttle > 0.5 && !car.reversing) {
    const kSlide = Math.min(1, Math.max(0, (bodySlip - 0.08) / 0.15)) * Math.min(1, Math.max(0, (110 - speed * 3.6) / 30));
    car.evSlide = (car.evSlide || 0) + (kSlide * throttle - (car.evSlide || 0)) * Math.min(1, dt * 4);
  } else car.evSlide = (car.evSlide || 0) * Math.exp(-dt * 4);
  if (car.evSlide > 0) shareR += (Math.max(shareR, EV_SLIDE_REAR) - shareR) * car.evSlide;
  const shareF = 1 - shareR;
  // inertia of motor/engine, driveline and wheels as felt at each axle's tread
  const e = s.engine;
  const ratio = e.type === 'ev' ? s.gears[0] : (car.reversing ? s.reverse : s.gears[car.gear - 1]) * s.finalDrive;
  const motorI = (e.type === 'ev' ? 0.05 : 0.13) * ratio * ratio;
  let fxF, fxR, askF, askR;       // ask = demand over grip, for the skid marks only
  let fySpinF = null, fySpinR = null;
  // Wheelspin. When the engine asks for more than an axle's tyres can pass
  // on, the surplus spins those wheels (and the engine with them) up instead
  // of being trimmed away. slipVF/slipVR are how much faster the tread runs
  // than the road. A spinning tyre pushes against the direction its contact
  // patch slides in, with `tail` of its peak grip: the faster it spins, the
  // more of that goes into driving the car on and the less is left to hold
  // the car sideways. That is what lets the throttle hold or tighten a slide,
  // and lifting end it.
  const ts = drivenR ? (drivenF ? (sf.tail < sr.tail ? sf : sr) : sr) : sf;
  let spinMax = 0, drive_cut = false;
  const tcWant = s.tc && steerIn === 0 && !hb ? s.tc : 0;
  const tcNow = car.tcK ?? tcWant;
  car.tcK = Math.max(0, Math.min(1, tcNow + Math.max(-dt * 8, Math.min(dt * 4, tcWant - tcNow))));
  const evFront = e.type === 'ev' && s.drive !== 'rwd';
  const axle = (front, share, surf, cap, lon, alpha, brakeK) => {
    let slipV = front ? car.slipVF : car.slipVR;
    const kappa = slipV / Math.max(Math.abs(car.vx), 3);
    let demand = drive * dir * share - brakeK;
    // A front e-motor's own torque control keeps its wheels near peak grip,
    // as on the real cars (otherwise no AWD EV reaches its factory 0-100).
    // The rear motor gets no such help, so power oversteer stays possible.
    if (front && evFront && demand > lon) { demand = lon; if (share > 0) drive_cut = true; }
    // Traction control (spec.tc): with the wheel held straight the electronics trim the drive to what the
    // tyres can pass on. It lets go as soon as the driver steers or pulls the handbrake.
    let trimmed = false;
    if (car.tcK > 0 && share > 0 && throttle > 0) {
      // (once the tyres are past their peak it backs off further, to pull them down again)
      const allow = lon * Math.max(0, 1 - 2 * Math.max(0, kappa / surf.kp - 1));
      if (demand > allow) { demand = allow + (demand - allow) * (1 - car.tcK); trimmed = true; }
    }
    // A tyre already sliding sideways has no grip to spare for drive, so any
    // drive torque spins it up (and the revs with it) rather than the wheel
    // rolling with the road while the car slides.
    const sideSlide = Math.abs(Math.tan(alpha)) * surf.b / 2.3 > 1;
    const spinning = share > 0 && throttle > 0 && !(hb && !front) && (demand > lon || kappa > surf.kp || (sideSlide && demand > 0));
    let fx, fy = null, ask;
    if (spinning) {
      const sx = kappa / surf.kp, sy = Math.abs(Math.tan(alpha)) * surf.b / 2.3;
      const sig = Math.hypot(sx, sy) + 1e-6;
      const g = sig < 1 ? sig * (2 - sig) : surf.tail + (1 - surf.tail) * Math.exp(-(sig - 1) / 3);
      const f = cap * g;
      const sent = (f * sx) / sig;
      fx = dir * sent;
      // (a little sideways bite always remains, so slides stay catchable)
      fy = -Math.sign(alpha) * Math.max((f * sy) / sig, LAT_KEEP * cap * Math.min(1, sy));
      const mEq = (motorI * share + 2.5) / (s.wheelRadius * s.wheelRadius);
      slipV = Math.max(0, slipV + ((demand - sent) / mEq - car.ax * dir) * dt);
      const spin = Math.max(0, Math.min(1, (kappa - surf.kp) / 0.6));
      spinMax = Math.max(spinMax, spin);
      ask = 1.3 + 0.4 * spin;
    } else {
      // gripping: the tread creeps just enough to carry the force
      const d = throttle > 0 && share > 0 && lon > 0 ? Math.max(0, Math.min(1, demand / lon)) : 0;
      const slipEq = (1 - Math.sqrt(1 - d)) * surf.kp * Math.max(Math.abs(car.vx), 3);
      slipV += (slipEq - slipV) * Math.min(1, dt * 25);
      fx = ((drive_cut && front) || trimmed ? demand * dir : drive * share - vSign * brakeK);
      if (hb && !front) fx = -vSign * surf.mu * fzR * 0.95;
      ask = hb && !front ? 2 : Math.abs(fx) / cap;
      fx = Math.max(-cap, Math.min(cap, fx));
    }

    if (front) { car.slipVF = slipV; fxF = fx; fySpinF = fy; askF = ask; }
    else { car.slipVR = slipV; fxR = fx; fySpinR = fy; askR = ask; }
  };
  axle(true, shareF, sf, capF, lonF, slipF, brakeF);
  axle(false, shareR, sr, capR, lonR, slipR, brakeR);
  car.spin = spinMax;
  // the engine (or the motor on the faster axle) turns with its spinning wheels
  car.slipV = shareF === 0 ? car.slipVR : shareR === 0 ? car.slipVF : Math.max(car.slipVF, car.slipVR);
  let latCapF = Math.sqrt(Math.max(capF * capF - fxF * fxF, (0.55 * capF) ** 2));
  let latCapR = Math.sqrt(Math.max(capR * capR - fxR * fxR, (0.55 * capR) ** 2));
  // Hard braking unloads the rear axle, so the front tyres would out-grip the
  // rears and any small disturbance would swing the tail round. While the
  // wheel is held straight the front lateral grip is trimmed to what the rear
  // axle can balance; steering into a corner hands it back, so braking into a
  // turn still rotates the car as before.
  if (brake > 0 && !hb) {
    const straight = Math.max(0, 1 - Math.abs(car.steer) / (0.5 * lock));
    const balanced = (latCapR * car.b) / car.a;
    if (balanced < latCapF) latCapF += (balanced - latCapF) * straight * brake;
  }
  if (hb) latCapR *= 0.45;

  // ---- lateral tyre forces
  // How hard each axle is sliding, 0..1. Read by the skid marks and the tyre
  // sound; nothing in the dynamics depends on it.
  if ((speed > 2.5 || car.slipV > 2) && load > 0.15) {
    const lon = (x) => Math.max(0, Math.min(1, (x - 1.3) / 0.4));
    car.skidF = Math.max(lon(askF), Math.min(1, Math.max(0, (Math.abs(slipF) - 0.12) / 0.1)));
    car.skidR = Math.max(lon(askR), Math.min(1, Math.max(0, (Math.abs(slipR) - 0.12) / 0.1)));
    // Speed of the tread sliding over the road at each axle (m/s), for the tyre smoke and the marks:
    // wheelspin beyond the creep of a gripping tyre, sideways sliding, or the whole road speed when locked.
    const rub = (skid, slipV, vLat, locked) => skid * Math.hypot(locked ? car.vx : Math.max(0, slipV - 0.2 * Math.max(Math.abs(car.vx), 3)), vLat);
    car.rubF = rub(car.skidF, car.slipVF, vLatF, false); car.rubR = rub(car.skidR, car.slipVR, vLatR, hb);
  } else car.skidF = car.skidR = car.rubF = car.rubR = 0;
  const fyF = fySpinF !== null ? fySpinF : -latCapF * Math.sin(1.35 * Math.atan(sf.b * slipF));
  const fyR = fySpinR !== null ? fySpinR : -latCapR * Math.sin(1.35 * Math.atan(sr.b * slipR));

  // ---- resistances and slope
  const drag = 0.5 * RHO * s.cdA * car.vx * Math.abs(car.vx);
  const crr = (sf.crr * fzF + sr.crr * fzR);
  const roll = Math.abs(car.vx) > 0.1 ? Math.sign(car.vx) * crr : 0;
  const slopeX = -m * G * Math.sin(car.groundPitch) * load;     // the slope pushes through the tyres
  const slopeY = m * G * Math.sin(car.groundRoll) * load;

  const FX = fxF * cd - fyF * sd + fxR - drag - roll + slopeX;
  const FY = fyF * cd + fxF * sd + fyR + slopeY - 0.5 * RHO * s.cdA * 1.6 * car.vy * Math.abs(car.vy);
  let MZ = car.a * (fyF * cd + fxF * sd) - car.b * fyR;
  // Spinning wheels never bite evenly left and right, so a hard launch tugs
  // the car a touch off line, more so on rough ground.
  if (car.spin > 0) {
    const wob = Math.sin(car.time * 1.7 + 1.3) + 0.5 * Math.sin(car.time * 4.3 + car.x * 0.3);
    MZ += hw * (fxF + fxR) * SPIN_YAW * car.spin * wob * (1 + ts.bump);
  }
  // Donuts. Held at full lock and full throttle on spinning wheels, the model
  // car would rotate past 90 degrees, scrub off its speed, then snap straight
  // as the wheels found grip and drive it forward, a few seconds per cycle.
  // A driver feathers the throttle and wheel to stop that; here a gentle yaw
  // moment does it, keeping the slide angle inside DONUT_LO..DONUT_HI while
  // the wheel is held into the rotation, the pedal down and the wheels spin.
  if (!(throttle > 0.5 && !car.reversing && Math.abs(steerIn) > 0.5 && load > 0.3)) { car.donutAng = undefined; car.donutT = 0; }
  else {
    car.donutT = (car.donutT || 0) + dt;
    const turn = Math.sign(steerIn);
    const ang = -turn * Math.atan2(car.vy, car.vx);          // slide angle, tail out positive
    // (looking a moment ahead, so a fast swing is met before it overshoots)
    const dAng = car.donutAng === undefined ? 0 : Math.max(-6, Math.min(6, (ang - car.donutAng) / dt));
    car.donutAng = ang;
    const angP = ang + DONUT_LEAD * dAng;
    const spinW = Math.min(1, car.slipVR / 4);      // (the rear wheels: a front driver washes wide)
    const slow = Math.min(1, Math.max(0, (70 - speed * 3.6) / 30));
    const w = throttle * Math.min(1, (Math.abs(steerIn) - 0.5) / 0.4) * spinW * slow;
    if (w > 0) {
      let err = 0;
      // (only a true donut, near full lock at low speed, is pushed round; a
      // floored corner is just kept from over-rotating)
      // From a standstill the push waits for the revs and the wheelspin to
      // build first, so the tail comes round with the engine, not ahead of it.
      if (angP < DONUT_LO && ang > -0.3 && Math.abs(steerIn) > 0.85 && speed < 10) {
        const build = Math.min(1, Math.max(0, (car.donutT - DONUT_WAIT) / 0.8));
        err = Math.min(1, (DONUT_LO - angP) / 0.5) * build;
      }
      else if (angP > DONUT_HI) err = -Math.min(1, (angP - DONUT_HI) / 0.35);
      // (rotating against the wheel already: leave the driver to sort it out)
      if (car.yawRate * turn > -0.2) MZ += turn * err * w * DONUT * m * G * L * load;
    }
  }
  const uF = Math.min(1, Math.abs(fyF) / capF), uR = Math.min(1, Math.abs(fyR) / capR);
  car.useF += (uF - car.useF) * Math.min(1, dt * 15);
  car.useR += (uR - car.useR) * Math.min(1, dt * 15);

  const ax = FX / m, ay = FY / m;
  car.ax += (ax - car.ax) * Math.min(1, dt * 20);
  car.ay += (ay - car.ay) * Math.min(1, dt * 20);
  car.vx += (ax + car.vy * car.yawRate) * dt;
  car.vy += (ay - car.vx * car.yawRate) * dt;
  car.yawRate += (MZ / car.iz) * dt;

  // ---- come to a clean stop instead of creeping on rounding noise
  if (load > 0.2 && throttle === 0 && Math.abs(car.vx) < 0.25 && Math.abs(car.vy) < 0.25 && Math.abs(slopeX) < crr + brakeTotal + 0.02 * m * G) {
    car.vx *= Math.exp(-dt * 8); car.vy *= Math.exp(-dt * 12); car.yawRate *= Math.exp(-dt * 12);
    if (Math.abs(car.vx) < 0.02) { car.vx = 0; car.vy = 0; car.yawRate = 0; }
  }
  if (speed < 1.5 && load > 0.2) { car.vy *= Math.exp(-dt * 6); }

  // ---- integrate pose
  let wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz;
  car.x += wvx * dt; car.z += wvz * dt;
  car.yaw += car.yawRate * dt;

  // ---- collisions against the obstacle distance field
  const hl = car.halfLen, hwid = car.halfWid;
  let worst = 0.12, wpx = 0, wpz = 0, found = false;
  for (let k = 0; k < 10; k++) {
    // corners, side midpoints, bumper centres, quarter points
    const lx = k < 4 ? (k < 2 ? hl : -hl) : k < 6 ? 0 : k < 8 ? (k === 6 ? hl : -hl) : (k === 8 ? hl * 0.5 : -hl * 0.5);
    const ly = k < 4 ? (k % 2 ? hwid : -hwid) : k < 6 ? (k === 4 ? hwid : -hwid) : k < 8 ? 0 : (k === 8 ? hwid : -hwid);
    const ox = fx * lx + rx * ly, oz = fz * lx + rz * ly;
    const d = world.sdfAt(car.x + ox, car.z + oz);
    if (d < worst) { worst = d; wpx = ox; wpz = oz; found = true; }
  }
  if (found) {
    world.sdfGrad(car.x + wpx, car.z + wpz, tmpG);
    const nx = tmpG[0], nz = tmpG[1];
    if (nx !== 0 || nz !== 0) {
      const pen = 0.12 - worst;
      car.x += nx * pen; car.z += nz * pen;
      // velocity of the contact point (yaw is clockwise: v + w x r in the x/z plane)
      const pvx = wvx - car.yawRate * wpz, pvz = wvz + car.yawRate * wpx;
      const vn = pvx * nx + pvz * nz;
      if (vn < 0) {
        const rn = wpx * nz - wpz * nx;
        const j = (-(1 + 0.15) * vn) / (1 / m + (rn * rn) / car.iz);
        // friction along the wall
        const tx = -nz, tz = nx;
        const vt = pvx * tx + pvz * tz;
        const rt = wpx * tz - wpz * tx;
        let jt = -vt / (1 / m + (rt * rt) / car.iz);
        const jtMax = 0.35 * j;
        jt = Math.max(-jtMax, Math.min(jtMax, jt));
        wvx += (j * nx + jt * tx) / m; wvz += (j * nz + jt * tz) / m;
        car.yawRate += (rn * j + rt * jt) / car.iz;
        car.vx = wvx * fx + wvz * fz; car.vy = wvx * rx + wvz * rz;
        car.hit = Math.max(car.hit, -vn);
      }
    }
  }

  // ---- bridge railings
  if (world.railPush && world.railPush(car.x, car.z, car.y + 0.4, hwid, tmpR)) {
    const nx = tmpR[0], nz = tmpR[1];
    car.x += nx * tmpR[2]; car.z += nz * tmpR[2];
    const vn = wvx * nx + wvz * nz;
    if (vn < 0) {
      wvx -= 1.1 * vn * nx; wvz -= 1.1 * vn * nz;
      car.vx = wvx * fx + wvz * fz; car.vy = wvx * rx + wvz * rz;
      car.hit = Math.max(car.hit, -vn);
    }
  }

  // ---- body attitude
  car.y = Math.max(car.hy, groundY - 0.06);     // the drawn wheels may sink a little, not through the road
  const bump = ((sf.bump + sr.bump) / 2) * Math.min(1, speed / 12);
  const tPitch = car.groundPitch + car.ax * 0.0075 + bump * 0.012 * Math.sin(car.time * 31 + car.x);
  const tRoll = car.groundRoll - car.ay * 0.011 + bump * 0.014 * Math.sin(car.time * 27 + car.z * 1.3);
  if (car.airborne) {
    // nothing to turn the body in flight: it keeps the rotation it left the ground with
    car.pitch += car.pitchRate * dt;
    car.roll += car.rollRate * dt;
  } else {
    const p0 = car.pitch, r0 = car.roll;
    car.pitch += (tPitch - car.pitch) * Math.min(1, dt * 9);
    car.roll += (tRoll - car.roll) * Math.min(1, dt * 9);
    const k = Math.min(1, dt * 12);
    car.pitchRate += (Math.max(-0.7, Math.min(0.7, (car.pitch - p0) / dt)) - car.pitchRate) * k;
    car.rollRate += (Math.max(-0.5, Math.min(0.5, (car.roll - r0) / dt)) - car.rollRate) * k;
  }
  const roll1 = (car.vx / s.wheelRadius) * dt, k1 = ((car.reversing ? -1 : 1) / s.wheelRadius) * dt;
  car.wheelSpin += roll1;
  car.wheelSpinF += roll1 + car.slipVF * k1;
  car.wheelSpinR += roll1 + car.slipVR * k1;
}

export function resetCar(car, pose) {
  car.x = pose.x; car.z = pose.z; car.yaw = pose.yaw; car.y = pose.y ?? car.y;
  car.hy = car.y; car.vyUp = 0; car.lastGround = null; car.load = 1;
  car.airborne = false; car.airTime = 0; car.landed = 0; car.pitchRate = car.rollRate = 0;
  car.vx = car.vy = car.yawRate = 0;
  car.steer = 0; car.slipV = car.slipVF = car.slipVR = 0; car.spin = 0; car.useF = car.useR = 0; car.gear = 1; car.shiftTimer = 0; car.reversing = false; car.boost = 0; car.shaft = 0; car.carry = 0; car.revCut = 0; car.csHold = 0; car.slipRPrev = 0; car.evSlide = 0; car.tcK = undefined;
  car.inWater = false; car.sunk = false; car.waterTime = 0;
  car.pitch = car.roll = 0; car.ax = car.ay = 0; car.hit = 0;
  car.rpm = car.spec.engine.idle ?? 0;
}
