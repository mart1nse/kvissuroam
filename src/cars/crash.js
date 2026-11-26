// A hard crash into a wall throws the car over (Martin 2026-11-26: flat out down Veski into the house on
// Kuperjanovi was "300 to 0 in a split second", then straighten up and drive on: a wall braked a Carrera GT 170 m
// later than its brakes could and cost nothing, 2 to 3 s a lap at that one bend).
//
// The rule, one for every car and every wall on the map: faster than CRASH_KMH, and heading within CRASH_DEG of
// straight at the wall. Slower, or at a flatter angle, a hit is what it was (he: under that speed there has been
// braking and turning already, and the car comes off the wall at some odd angle with nothing gained).
//
// What happens then has to look like what a car would do: the end that met the wall runs up it and the car is
// thrown up and back off the wall, standing on its other end (sideways into a wall: the side that met it rides
// up). From there, his second word the same day ("let it actually fall to its wheels 70% of the time, it can also
// balance a bit in some cases on its side and then fall to either side. If it turns to its backside, put the car
// automatically back after 1 s"), one of three things:
//   wheels   it falls back the way it came up, onto its wheels (62 in 100)
//   side     it comes down on its side, balances there a moment and tips over, onto its wheels or its roof (16)
//   roof     it goes right over onto its roof (22)
// which is wheels 70 times in 100. On its roof it slides to a stop, lies there ROOF_S and is rolled back onto
// its wheels where it lies. Then the car is the driver's again, standing, a couple of seconds after the wall.
// A timed lap or stage run gets CRASH_PEN seconds for it however it lands (race.js, raadi.js, and the server
// counts the crashes again from the replay, where the car's flags carry each one: worker/index.js).
// There are no tyres in any of this: stepCar hands the car over to crashStep until it stands again (or resetCar).

export const CRASH_KMH = 140, CRASH_DEG = 30;
export const CRASH_PEN = 5;           // seconds on a timed lap for each crash
export const CRASH_FLAG = 512;        // in a car's flags as its position goes out and into a replay (multiplayer.js poseNow), while it is thrown over
export const ROOF_S = 1;              // seconds on its roof before it is put back on its wheels
const CRASH_V = CRASH_KMH / 3.6, CRASH_COS = Math.cos((CRASH_DEG * Math.PI) / 180);
const G = 9.81, HALF = Math.PI / 2;
const OUT_MIN = 5, OUT_MAX = 8.5;     // m/s away from the wall as it goes over (it must come down clear of the wall)
const ALONG_K = 0.5, ALONG_MAX = 5;   // what is left of its speed along the wall
const ROOF_MU = 0.6;                  // paint and steel on the road
const WHEELS = 0.62, SIDE = 0.16;     // shares of the endings (the rest: the roof); half the sides end on the wheels
const BAL_MIN = 0.45, BAL_MORE = 0.55, DROP_S = 0.42, RIGHT_S = 0.7, SETTLE_S = 0.3;
const tmpG = [0, 0];

// The body's height, for lying on its roof (no spec carries it: 2.45 times the height of its weight is within a
// few centimetres for these cars, on the low side, so a roof never hangs in the air).
export const bodyHeight = (spec) => spec.height ?? Math.max(1.02, spec.cgHeight * 2.45);

// A hit: (nx, nz) out of the wall, (wvx, wvz) the car's velocity as it arrived. True when this one is a crash
// (the car is then crashStep's from its next step on).
// car.crashDice (0..1), when set, picks the ending instead of chance: the tests' way to every one of them.
export function crashHit(car, nx, nz, wvx, wvz) {
  if (car.crash || car.inWater || car.rocket?.flight) return false;
  const sp = Math.hypot(wvx, wvz);
  if (sp < CRASH_V || -(wvx * nx + wvz * nz) < sp * CRASH_COS) return false;
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
  // which part of the car met the wall: its nose or tail (it goes up end on), or a side (it rolls)
  const uf = (wvx * fx + wvz * fz) / sp, ur = (wvx * rx + wvz * rz) / sp;
  const endOn = Math.abs(uf) >= Math.abs(ur);
  const dice = car.crashDice ?? Math.random(), rnd = car.crashDice != null ? 0.5 : Math.random();
  const dir = endOn ? (uf > 0 ? 1 : -1) : (ur > 0 ? -1 : 1);     // (pitch up for a nose, roll with the right side rising for a right side)
  car.crash = {
    t: 0, at: car.time, x: car.x, z: car.z, speed: sp, nx, nz, endOn, dir,
    way: dice < WHEELS ? 'wheels' : dice < WHEELS + SIDE ? 'side' : 'roof',
    fall: dice < WHEELS + SIDE / 2 ? 'wheels' : 'roof',          // (which way a car on its side tips)
    rs: endOn ? (rnd < 0.5 ? 1 : -1) : dir,                      // the side it rolls to
    peak: 1 + 0.35 * rnd, upS: 0.95 + 0.25 * rnd, balS: BAL_MIN + BAL_MORE * rnd,
    ph: 'up', pt: 0, ang: 0, P: 0, R: 0, a0: 0, p0: car.pitch, r0: car.roll, lift0: null,
    onRoof: false, still: false, begun: false, done: false, wheelV: sp, h: bodyHeight(car.spec),
  };
  return true;
}

// How high the car's own floor (where its wheels stand) is above the ground when the body is pitched by p and
// rolled by r (the way it is drawn: turned, then pitched, then rolled) and the lowest part of it rests on the
// ground. The body: floor and waist as long and wide as the car, the roof shorter and narrower.
function lift(hl, hw, h, p, r) {
  const sp = Math.sin(p), cp = Math.cos(p), sr = Math.sin(r), cr = Math.cos(r);
  let low = 0;
  for (let k = 0; k < 12; k++) {
    const top = k >= 8, y = k < 4 ? 0 : top ? h : h * 0.55;
    const l = (k & 1 ? -1 : 1) * hl * (top ? 0.5 : 1), x = (k & 2 ? -1 : 1) * hw * (top ? 0.7 : 1);
    const v = (y * cr - x * sr) * cp + l * sp;
    if (v < low) low = v;
  }
  return -low;
}

export function crashStep(car, world, dt) {
  const c = car.crash, s = car.spec;
  let fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
  let wx = car.vx * fx + car.vy * rx, wz = car.vx * fz + car.vy * rz;
  const ground = () => (world.groundAt ? world.groundAt(car.x, car.z, car.y + 0.4) : world.heightAt(car.x, car.z));
  if (!c.begun) {
    // what the wall gave back: away from it at a pace that lands the car clear of it, a share of the rest along it
    c.begun = true;
    const tx = -c.nz, tz = c.nx;
    const out = Math.max(OUT_MIN, Math.min(OUT_MAX, wx * c.nx + wz * c.nz));
    const along = Math.max(-ALONG_MAX, Math.min(ALONG_MAX, (wx * tx + wz * tz) * ALONG_K));
    wx = c.nx * out + tx * along; wz = c.nz * out + tz * along;
    car.yawRate = Math.max(-1.3, Math.min(1.3, car.yawRate * 0.4));
    c.lift0 = car.y - ground();
    car.hit = Math.max(car.hit, c.speed);
    car.landed = Math.max(car.landed || 0, 2.2);          // (the bang: audio.js thumps on this)
    if (car.rocket) { car.rocket.on = false; car.rocket.boost = 0; if (car.rocket.noz) car.rocket.noz.fill(0); }
  }
  c.t += dt; c.pt += dt;
  const next = (ph) => { c.ph = ph; c.pt = 0; };
  const thump = (k) => { car.landed = Math.max(car.landed || 0, k); car.jolt = 1; };
  let hop = 0, dip = 0, drag = ROOF_MU * G;                // (drag: what slows it over the road, m/s2)
  if (c.ph === 'up') {
    drag = 1.5;                                            // (only the end or side still on the road drags)
    if (c.way === 'roof') {
      // right over: quick off the wall, slow as it stands on end, quicker again as it falls
      const k = 1 + 0.25 * Math.min(1, (c.speed - CRASH_V) / 45);
      const w0 = (c.endOn ? 6.2 : 7.6) * k, wMin = c.endOn ? 2.3 : 3.6;
      c.ang += Math.sqrt(Math.max(wMin * wMin, w0 * w0 - (w0 * w0 - wMin * wMin) * Math.sin(c.ang))) * dt;
      hop = 0.3 * Math.sin(Math.min(Math.PI, c.ang));
      if (c.endOn) c.P = c.dir * Math.min(Math.PI, c.ang); else c.R = c.dir * Math.min(Math.PI, c.ang);
      if (c.ang >= Math.PI) {
        // (lying on its roof, end over end: the same as turned about and rolled over, and that is how it is
        // kept from here on, to be rolled back onto its wheels)
        if (c.endOn) { car.yaw += Math.PI; c.P = 0; c.R = c.rs * Math.PI; }
        c.onRoof = true; thump(1.8); next('roof');
      }
    } else {
      const T = c.way === 'side' && !c.endOn ? 0.6 : c.upS, u = Math.min(1, c.pt / T);
      hop = 0.3 * Math.sin(Math.PI * u);
      if (c.way === 'wheels') {
        // up to its peak and back down the way it came
        const a = c.dir * c.peak * 4 * u * (1 - u);
        if (c.endOn) c.P = a; else c.R = a;
        if (u >= 1) { thump(1.6); next('settle'); }
      } else {
        // onto its side: end on it twists as it comes down, a side that met the wall rides straight up to there
        if (c.endOn) { c.P = c.dir * c.peak * 0.9 * 4 * u * (1 - u); c.R = c.rs * HALF * u * u * (3 - 2 * u); }
        else c.R = c.rs * HALF * (1 - (1 - u) * (1 - u));
        if (u >= 1) { c.P = 0; thump(1.3); next('bal'); }
      }
    }
  } else if (c.ph === 'bal') {
    // on its side: it rocks, and leans further and further the way it will go
    const u = Math.min(1, c.pt / c.balS), lean = c.fall === 'roof' ? 1 : -1;
    c.a0 = HALF + 0.09 * Math.sin(c.pt * 7) * (1 - u) + lean * 0.22 * u * u * u;
    c.R = c.rs * c.a0;
    if (u >= 1) next('drop');
  } else if (c.ph === 'drop') {
    const u = Math.min(1, c.pt / DROP_S), to = c.fall === 'roof' ? Math.PI : 0;
    c.R = c.rs * (c.a0 + (to - c.a0) * u * u);
    if (u >= 1) { thump(1.5); if (c.fall === 'roof') { c.onRoof = true; next('roof'); } else next('settle'); }
  } else if (c.ph === 'roof') {
    // (the roof gives a little as it lands and comes back: a short dip)
    dip = -0.05 * Math.exp(-c.pt * 9) * Math.cos(c.pt * 22);
    c.R = c.rs * Math.PI;
    if (c.pt >= ROOF_S && Math.hypot(wx, wz) < 1.5) { c.onRoof = false; c.still = false; next('right'); }
  } else if (c.ph === 'right') {
    // put back: rolled over onto its wheels where it lies
    const u = Math.min(1, c.pt / RIGHT_S);
    c.R = c.rs * Math.PI * (1 - u * u * (3 - 2 * u));
    hop = 0.12 * Math.sin(Math.PI * u);
    if (u >= 1) { thump(1.1); next('settle'); }
  } else {
    // on its wheels: the springs take it, and the car is the driver's again
    c.P = c.R = 0; drag = 4;
    dip = -0.05 * Math.exp(-c.pt * 9) * Math.sin(c.pt * 24);
    if (c.pt >= SETTLE_S) c.done = true;
  }
  // ---- over the road: sliding to a stop, turning a little as it goes
  const v = Math.hypot(wx, wz), dv = Math.min(v, drag * dt);
  if (v > 1e-6) { wx -= (wx / v) * dv; wz -= (wz / v) * dv; }
  car.yawRate *= Math.exp(-dt * (c.ph === 'up' ? 0.5 : v > 0.3 ? 1.6 : 6));
  if (c.ph === 'roof') {
    if (v < 0.05 && Math.abs(car.yawRate) < 0.02) { wx = wz = 0; car.yawRate = 0; c.still = true; }
    else c.still = false;                                  // (another car can shove it on)
  }
  car.x += wx * dt; car.z += wz * dt;
  car.yaw += car.yawRate * dt;
  fx = Math.sin(car.yaw); fz = -Math.cos(car.yaw); rx = Math.cos(car.yaw); rz = Math.sin(car.yaw);
  // ---- walls: its middle and both ends kept out of them (the street's other side is not far)
  const reach = car.halfLen * Math.abs(Math.cos(c.P));
  for (let k = -1; k <= 1; k++) {
    const px = car.x + fx * reach * k, pz = car.z + fz * reach * k;
    const d = world.sdfAt(px, pz), keep = k === 0 ? car.halfWid : 0.25;
    if (d >= keep) continue;
    world.sdfGrad(px, pz, tmpG);
    if (tmpG[0] === 0 && tmpG[1] === 0) continue;
    car.x += tmpG[0] * (keep - d); car.z += tmpG[1] * (keep - d);
    const vn = wx * tmpG[0] + wz * tmpG[1];
    if (vn < 0) { wx -= 1.2 * vn * tmpG[0]; wz -= 1.2 * vn * tmpG[1]; car.yawRate *= 0.5; }
  }
  car.vx = wx * fx + wz * fz; car.vy = wx * rx + wz * rz;
  // ---- the body: turned over, its lowest part on the ground (and thrown up a little on the way)
  const fade = Math.max(0, 1 - c.t * 6);                   // (what lean it had as it hit goes in a moment)
  car.pitch = c.P + c.p0 * fade; car.roll = c.R + c.r0 * fade;
  car.y = car.hy = ground() + lift(car.halfLen, car.halfWid, c.h, c.P, c.R) + hop + c.lift0 * Math.max(0, 1 - c.t * 5) + dip;
  car.vyUp = 0; car.pitchRate = car.rollRate = 0;
  car.airborne = true; car.airTime += dt; car.load = 0;    // (no tyre is at work: no marks, no spots to come back to)
  car.throttle = 0; car.brake = 0; car.ax = car.ay = 0; car.thrustN = 0; car.reversing = false;
  car.steer *= Math.exp(-dt * 3);
  car.slipV = car.slipVF = car.slipVR = 0; car.spin = 0; car.skidF = car.skidR = car.rubF = car.rubR = 0; car.useF = car.useR = 0;
  car.boost = 0; car.shaft = 0; car.revCut = 0;
  // the engine has stopped; the wheels turn on in the air for a while
  car.rpm *= Math.exp(-dt * 5); if (car.rpm < 1) car.rpm = 0;
  c.wheelV *= Math.exp(-dt * 0.9);
  const spin = (c.wheelV / s.wheelRadius) * dt;
  car.wheelSpin += spin; car.wheelSpinF += spin; car.wheelSpinR += spin;
  car.lastGround = null; car.kerbS = null; car.stone = null;
}

// Is this car (ours, or another player's as its position came in) lying on its roof?
export const onRoof = (c) => Math.cos(c.pitch || 0) * Math.cos(c.roll || 0) < -0.7;

// How many hard crashes a replay has: flags, each sample's (ten a second). The server asks, to see the lap's time
// carries CRASH_PEN for each (worker/index.js). One under way as the lap began or in its first frames is not
// counted: the page may have had it before its clock ran.
export function crashesIn(flags) {
  let n = 0;
  for (let i = 3; i < flags.length; i++) if ((flags[i] & CRASH_FLAG) && !(flags[i - 1] & CRASH_FLAG)) n++;
  return n;
}
