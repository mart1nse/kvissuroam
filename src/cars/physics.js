// Vehicle dynamics: a planar single-track ("bicycle") model with load transfer,
// friction circles, a simple automatic gearbox and SDF collisions. Pure logic,
// no rendering, so it also runs in Node for the performance calibration test.
//
// Frames: world x = east, z = south, y = up. Heading `yaw` is clockwise from
// north. Body frame: vx forward, vy to the right, yawRate clockwise positive.

const G = 9.81;
const RHO = 1.2;

// grip, rolling resistance, tyre stiffness and bumpiness per surface class
const SURF = [
  { mu: 0.62, crr: 0.075, b: 5.5, bump: 1.0 },   // grass
  { mu: 1.0, crr: 0.013, b: 10.0, bump: 0.0 },   // paved
  { mu: 0.72, crr: 0.03, b: 7.0, bump: 0.35 },   // gravel
  { mu: 0.62, crr: 0.045, b: 6.0, bump: 0.6 },   // dirt
  { mu: 0.4, crr: 0.3, b: 4.0, bump: 0.0 },      // water (shallows)
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
    pitch: 0, roll: 0, groundPitch: 0, groundRoll: 0,
    steer: 0, wheelSpin: 0,
    gear: 1, shiftTimer: 0, rpm: spec.engine.idle ?? 0, reversing: false,
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

function engineForce(car, throttle, dt) {
  // Returns the drive force at the wheels (N, signed along vx) and updates rpm / gear.
  const s = car.spec, e = s.engine;
  const v = car.vx;
  const dir = car.reversing ? -1 : 1;
  const vAbs = Math.abs(v);
  if (e.type === 'ev') {
    const ratio = s.gears[0];
    car.rpm = (vAbs / s.wheelRadius) * ratio * (60 / (2 * Math.PI));
    car.gear = 1;
    let f = Math.min(e.maxWheelForce, (e.maxPowerKw * 1000 * s.efficiency) / Math.max(vAbs, 0.5));
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
    if (rpmAt(g) > e.shiftRpm && g < s.gears.length) g++;
    else if (g > 1 && rpmAt(g - 1) < e.shiftRpm * (throttle > 0.5 ? 0.9 : 0.55)) g--;
    if (g !== car.gear) { car.gear = g; car.shiftTimer = s.shiftTime; }
  }
  if (car.shiftTimer > 0) car.shiftTimer -= dt;
  const wheelRpm = rpmAt(car.gear);
  // torque converter: engine speed never drops below stall while the throttle is open
  const stall = e.idle + (e.stallRpm - e.idle) * throttle;
  const rpm = Math.max(wheelRpm, stall);
  const sr = Math.min(1, wheelRpm / rpm);
  const gain = 1 + (e.converterGain - 1) * (1 - sr) ** 2;
  car.rpm += (Math.min(rpm, e.redline) - car.rpm) * Math.min(1, dt * 12);
  if (throttle <= 0) {
    // engine braking through the converter
    return vAbs > 0.3 ? -Math.sign(v) * (180 + 0.045 * wheelRpm) * (ratioOf(car.gear) / 8) : 0;
  }
  if (wheelRpm >= e.redline || (car.reversing && vAbs > 11)) return 0;
  const cut = car.shiftTimer > 0 ? 0.25 : 1;
  const tq = lerpTable(e.torque, rpm) * gain * throttle * cut;
  return (dir * tq * ratioOf(car.gear) * s.efficiency) / s.wheelRadius;
}

const tmpG = [0, 0];

// input: { up, down, left, right, handbrake } booleans or 0..1 values, steer optional (-1..1)
export function stepCar(car, input, world, dtFrame) {
  const n = Math.max(1, Math.ceil(dtFrame / (1 / 240)));
  const dt = dtFrame / n;
  for (let i = 0; i < n; i++) substep(car, input, world, dt);
  car.time += dtFrame;
  car.hit *= Math.exp(-dtFrame * 4);
}

function substep(car, input, world, dt) {
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
  const hFL = world.heightAt(pFLx, pFLz), hFR = world.heightAt(pFRx, pFRz);
  const hRL = world.heightAt(pRLx, pRLz), hRR = world.heightAt(pRRx, pRRz);
  const groundY = (hFL + hFR + hRL + hRR) / 4;
  car.groundPitch = Math.atan2((hFL + hFR - hRL - hRR) / 2, L);       // nose-up positive
  car.groundRoll = Math.atan2((hFL + hRL - hFR - hRR) / 2, s.track);   // left side high -> rolls right
  const surfF = world.surfaceAt(car.x + fx * car.a, car.z + fz * car.a);
  const surfR = world.surfaceAt(car.x - fx * car.b, car.z - fz * car.b);
  const sf = SURF[surfF] || SURF[0], sr = SURF[surfR] || SURF[0];
  car.surface = world.surfaceAt(car.x, car.z);

  // ---- water
  const wl = world.waterLevelAt ? world.waterLevelAt(car.x, car.z) : world.meta.riverLevel;
  const depth = car.surface === WATER ? wl - groundY : 0;
  if (!car.inWater && depth > 0.55) { car.inWater = true; car.waterTime = 0; car.waterLevel = wl; }
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
    car.steer *= Math.exp(-dt * 3);
    if (!car.sunk && car.y <= Math.max(bedY + 0.2, car.waterLevel - 1.3) + 0.01 && car.waterTime > sinkStart + 0.8) car.sunk = true;
    if (!car.sunk && car.waterTime > 9) car.sunk = true;
    car.ax = 0; car.ay = 0;
    return;
  }

  // ---- steering: fast at parking speeds, limited near the grip limit when quick
  const steerIn = input.steer !== undefined ? input.steer : (+input.right || 0) - (+input.left || 0);
  const maxLock = 0.6;
  const vS = Math.max(Math.abs(car.vx), 1);
  const gripLock = Math.atan((1.55 * G * L) / (vS * vS));
  const lock = Math.min(maxLock, gripLock);
  const target = steerIn * lock;
  const rate = (steerIn === 0 ? 2.6 : 1.7) * Math.max(lock, 0.08) + 0.25;
  const ds = target - car.steer;
  car.steer += Math.sign(ds) * Math.min(Math.abs(ds), rate * dt);
  const sd = Math.sin(car.steer), cd = Math.cos(car.steer);

  // ---- vertical loads with longitudinal transfer
  const transfer = (m * car.ax * s.cgHeight) / L;
  const fzF = Math.max(0.1 * m * G, (m * G * car.b) / L - transfer);
  const fzR = Math.max(0.1 * m * G, (m * G * car.a) / L + transfer);

  // ---- longitudinal forces
  let drive = engineForce(car, throttle, dt);
  let driveF = 0, driveR = 0;
  if (s.drive === 'rwd') driveR = drive;
  else if (s.drive === 'fwd') driveF = drive;
  else { driveF = drive * (fzF / (fzF + fzR)); driveR = drive - driveF; }
  const vSign = Math.abs(car.vx) > 0.05 ? Math.sign(car.vx) : 0;
  const brakeTotal = brake * 1.05 * m * G;
  let fxF = driveF - vSign * brakeTotal * 0.66;
  let fxR = driveR - vSign * brakeTotal * 0.34;
  const hb = +input.handbrake || 0;
  if (hb) fxR = -vSign * sr.mu * fzR * 0.95;
  const capF = sf.mu * fzF, capR = sr.mu * fzR;
  fxF = Math.max(-capF, Math.min(capF, fxF));
  fxR = Math.max(-capR, Math.min(capR, fxR));
  const latCapF = Math.sqrt(Math.max(capF * capF - fxF * fxF, (0.3 * capF) ** 2));
  let latCapR = Math.sqrt(Math.max(capR * capR - fxR * fxR, (0.3 * capR) ** 2));
  if (hb) latCapR *= 0.45;

  // ---- lateral tyre forces from slip angles
  const v0 = 2.0;
  const vLatF = -car.vx * sd + (car.vy + car.a * car.yawRate) * cd;
  const vLonF = car.vx * cd + (car.vy + car.a * car.yawRate) * sd;
  const vLatR = car.vy - car.b * car.yawRate;
  const slipF = Math.atan2(vLatF, Math.max(Math.abs(vLonF), v0));
  const slipR = Math.atan2(vLatR, Math.max(Math.abs(car.vx), v0));
  const fyF = -latCapF * Math.sin(1.35 * Math.atan(sf.b * slipF));
  const fyR = -latCapR * Math.sin(1.35 * Math.atan(sr.b * slipR));

  // ---- resistances and slope
  const drag = 0.5 * RHO * s.cdA * car.vx * Math.abs(car.vx);
  const crr = (sf.crr * fzF + sr.crr * fzR);
  const roll = Math.abs(car.vx) > 0.1 ? Math.sign(car.vx) * crr : 0;
  const slopeX = -m * G * Math.sin(car.groundPitch);
  const slopeY = m * G * Math.sin(car.groundRoll);

  const FX = fxF * cd - fyF * sd + fxR - drag - roll + slopeX;
  const FY = fyF * cd + fxF * sd + fyR + slopeY - 0.5 * RHO * s.cdA * 1.6 * car.vy * Math.abs(car.vy);
  const MZ = car.a * (fyF * cd + fxF * sd) - car.b * fyR;

  const ax = FX / m, ay = FY / m;
  car.ax += (ax - car.ax) * Math.min(1, dt * 20);
  car.ay += (ay - car.ay) * Math.min(1, dt * 20);
  car.vx += (ax + car.vy * car.yawRate) * dt;
  car.vy += (ay - car.vx * car.yawRate) * dt;
  car.yawRate += (MZ / car.iz) * dt;

  // ---- come to a clean stop instead of creeping on rounding noise
  if (throttle === 0 && Math.abs(car.vx) < 0.25 && Math.abs(car.vy) < 0.25 && Math.abs(slopeX) < crr + brakeTotal + 0.02 * m * G) {
    car.vx *= Math.exp(-dt * 8); car.vy *= Math.exp(-dt * 12); car.yawRate *= Math.exp(-dt * 12);
    if (Math.abs(car.vx) < 0.02) { car.vx = 0; car.vy = 0; car.yawRate = 0; }
  }
  if (speed < 1.5) { car.vy *= Math.exp(-dt * 6); }

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

  // ---- body attitude
  const ride = groundY;
  if (car.y < ride) car.y = ride; else car.y += (ride - car.y) * Math.min(1, dt * 18);
  const bump = ((sf.bump + sr.bump) / 2) * Math.min(1, speed / 12);
  const tPitch = car.groundPitch - car.ax * 0.0075 + bump * 0.012 * Math.sin(car.time * 31 + car.x);
  const tRoll = car.groundRoll + car.ay * 0.011 + bump * 0.014 * Math.sin(car.time * 27 + car.z * 1.3);
  car.pitch += (tPitch - car.pitch) * Math.min(1, dt * 9);
  car.roll += (tRoll - car.roll) * Math.min(1, dt * 9);
  car.wheelSpin += (car.vx / s.wheelRadius) * dt;
}

export function resetCar(car, pose) {
  car.x = pose.x; car.z = pose.z; car.yaw = pose.yaw; car.y = pose.y ?? car.y;
  car.vx = car.vy = car.yawRate = 0;
  car.steer = 0; car.gear = 1; car.shiftTimer = 0; car.reversing = false;
  car.inWater = false; car.sunk = false; car.waterTime = 0;
  car.pitch = car.roll = 0; car.ax = car.ay = 0; car.hit = 0;
  car.rpm = car.spec.engine.idle ?? 0;
}
