// A hard crash into a wall ends on the roof (Martin 2026-11-26: flat out down Veski into the house on
// Kuperjanovi was "300 to 0 in a split second", then straighten up and drive on: a wall braked a Carrera GT 170 m
// later than its brakes could and cost nothing, 2 to 3 s a lap at that one bend).
//
// The rule, one for every car and every wall on the map: faster than CRASH_KMH, and heading within CRASH_DEG of
// straight at the wall. Slower, or at a flatter angle, a hit is what it was (he: under that speed there has been
// braking and turning already, and the car comes off the wall at some odd angle with nothing gained).
//
// What happens then has to look like what a car would do: the end that met the wall runs up it, the car stands
// on its other end and falls over backwards, away from the wall, onto its roof (sideways into a wall: the side
// that met it rides up and the car rolls over the other). It slides on a little and lies there, engine dead,
// wheels turning down. Only R (the last spot, main.js: one at least three seconds before the crash) gets it back.
// There are no tyres in any of this: stepCar hands the car over to crashStep until resetCar.

export const CRASH_KMH = 140, CRASH_DEG = 30;
const CRASH_V = CRASH_KMH / 3.6, CRASH_COS = Math.cos((CRASH_DEG * Math.PI) / 180);
const G = 9.81;
const OUT_MIN = 5, OUT_MAX = 8.5;     // m/s away from the wall as it goes over (it must come down clear of the wall)
const ALONG_K = 0.5, ALONG_MAX = 5;   // what is left of its speed along the wall
const ROOF_MU = 0.6;                  // paint and steel on the road
const tmpG = [0, 0];

// The body's height, for lying on its roof (no spec carries it: 2.45 times the height of its weight is within a
// few centimetres for these cars, on the low side, so a roof never hangs in the air).
export const bodyHeight = (spec) => spec.height ?? Math.max(1.02, spec.cgHeight * 2.45);

// A hit: (nx, nz) out of the wall, (wvx, wvz) the car's velocity as it arrived. True when this one is a crash
// (the car is then crashStep's from its next step on).
export function crashHit(car, nx, nz, wvx, wvz) {
  if (car.crash || car.inWater || car.rocket?.flight) return false;
  const sp = Math.hypot(wvx, wvz);
  if (sp < CRASH_V || -(wvx * nx + wvz * nz) < sp * CRASH_COS) return false;
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
  // which part of the car met the wall: its nose or tail (it goes over end on), or a side (it rolls)
  const uf = (wvx * fx + wvz * fz) / sp, ur = (wvx * rx + wvz * rz) / sp;
  const endOn = Math.abs(uf) >= Math.abs(ur);
  car.crash = {
    t: 0, at: car.time, x: car.x, z: car.z, speed: sp, nx, nz,
    endOn, dir: endOn ? (uf > 0 ? 1 : -1) : (ur > 0 ? -1 : 1),   // (pitch up for a nose, roll with the right side rising for a right side)
    ang: 0, p0: car.pitch, r0: car.roll, lift0: null,
    onRoof: false, still: false, begun: false, wheelV: sp, h: bodyHeight(car.spec),
  };
  return true;
}

// How high the car's own floor (where its wheels stand) is above the ground when the body is turned by ang and
// the lowest part of it rests on the ground. The body from the side (end on) or from behind (rolling): floor,
// waist and roof, the roof shorter and narrower than the floor.
function lift(half, h, ang) {
  const s = Math.sin(ang), c = Math.cos(ang);
  let low = 0;
  for (let k = 0; k < 6; k++) {
    const l = (k % 2 ? -1 : 1) * half * (k < 2 ? 1 : k < 4 ? 1 : 0.5), y = k < 2 ? 0 : k < 4 ? h * 0.55 : h;
    const v = l * s + y * c;
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
  c.t += dt;
  // ---- going over: quick off the wall, slow as it stands on end, quicker again as it falls
  if (!c.onRoof) {
    const k = 1 + 0.25 * Math.min(1, (c.speed - CRASH_V) / 45);
    const w0 = (c.endOn ? 6.2 : 7.6) * k, wMin = c.endOn ? 2.3 : 3.6;
    const w = Math.sqrt(Math.max(wMin * wMin, w0 * w0 - (w0 * w0 - wMin * wMin) * Math.sin(c.ang)));
    c.ang += w * dt;
    // (the end or side still on the road drags)
    const v = Math.hypot(wx, wz), dv = Math.min(v, 1.5 * dt);
    if (v > 1e-6) { wx -= (wx / v) * dv; wz -= (wz / v) * dv; }
    car.yawRate *= Math.exp(-dt * 0.5);
    if (c.ang >= Math.PI) {
      c.ang = Math.PI; c.onRoof = true; c.tRoof = c.t;
      car.landed = Math.max(car.landed || 0, 1.8);        // (the roof coming down)
      car.jolt = 1;
    }
  } else {
    // ---- on its roof: sliding to a stop, turning a little as it goes
    const v = Math.hypot(wx, wz), dv = Math.min(v, ROOF_MU * G * dt);
    if (v > 1e-6) { wx -= (wx / v) * dv; wz -= (wz / v) * dv; }
    car.yawRate *= Math.exp(-dt * (v > 0.3 ? 1.6 : 6));
    if (v < 0.05 && Math.abs(car.yawRate) < 0.02) { wx = wz = 0; car.yawRate = 0; c.still = true; }
    else c.still = false;                                  // (another car can shove it on)
  }
  car.x += wx * dt; car.z += wz * dt;
  car.yaw += car.yawRate * dt;
  // ---- walls: its middle and both ends kept out of them (the street's other side is not far)
  const reach = car.halfLen * (c.endOn ? Math.abs(Math.cos(c.ang)) : 1);
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
  fx = Math.sin(car.yaw); fz = -Math.cos(car.yaw); rx = Math.cos(car.yaw); rz = Math.sin(car.yaw);
  car.vx = wx * fx + wz * fz; car.vy = wx * rx + wz * rz;
  // ---- the body: turned over, its lowest part on the ground (and thrown up a little on the way)
  const a = c.ang, g = ground();
  if (c.endOn) { car.pitch = c.p0 * Math.max(0, 1 - c.t * 6) + c.dir * a; car.roll = c.r0 * Math.max(0, 1 - c.t * 6); }
  else { car.roll = c.r0 * Math.max(0, 1 - c.t * 6) + c.dir * a; car.pitch = c.p0 * Math.max(0, 1 - c.t * 6); }
  // (the roof gives a little as it lands and comes back: a short dip)
  const dip = c.onRoof ? -0.05 * Math.exp(-(c.t - c.tRoof) * 9) * Math.cos((c.t - c.tRoof) * 22) : 0;
  car.y = car.hy = g + lift(c.endOn ? car.halfLen : car.halfWid, c.h, a) + 0.3 * Math.sin(a) + c.lift0 * Math.max(0, 1 - c.t * 5) + dip;
  car.vyUp = 0; car.pitchRate = car.rollRate = 0;
  car.airborne = true; car.airTime += dt; car.load = 0;    // (no wheel is on the road: no marks, no spots to come back to)
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
