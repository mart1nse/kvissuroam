// The Roadster Rocket in the water (Martin 27 Nov: "thrust working under water ... bringing it possibly back ashore
// following the underwater upward slope when coming out"). Any other car that goes into the river floats a moment
// and goes down (physics.js). The Rocket's cold-gas nozzles blow under water as they do in the air, so BOOST
// pushes it along, at the surface or on the bed, against the water's drag (a full tank about 20 km/h, a near-empty
// one a walk); the two nose jets turn it the way the wheel is held. With the suction fans on, the tyres are held
// down onto the bed hard enough for the motors to crawl it along, forward or back, and up the bank. Either way it
// keeps to the bed as that rises towards the shore and comes up out of the water onto land at the speed it has.
// Only where BOOST works: on a timed lap or the stage, and while waiting for a start, it sinks as any car does.
// No new objects: a handful of height and wall lookups a step, and only while the car is in the water.

import { NOZ_YAW } from './thrust.js';

const G = 9.81;
// (the water's drag on the body: half of 1000 kg/m3 x a drag figure of 0.8 x 2 m2 facing it, over 2100 kg; with the
// still water's own slowing in physics.js a full tank's push, 45 kN, comes to about 5.5 m/s)
const DRAG_Q = 0.38;                // per metre, along the car
const DRAG_SIDE = 3;                // ...and this many times that sideways
const CRAWL_V = 2.5;                // the motors crawl it along the bed this fast with the fans on (m/s, 9 km/h)...
const CRAWL_A = 8;                  // ...pulling it up to that at most this hard (m/s2), through the water's drag and uphill too
const WEIGHT = 0.4;                 // the share of its weight the car still has in the water, pulling it down a slope
const YAW_JET = 0.9;                // the nose jets turn it this fast at most with BOOST blowing (rad/s)
const LOCK = 0.6;                   // the wheels' lock on the bed, crawling
const AHEAD = 0.6;                  // what is this far past the nose (or the tail, backing) is looked at...
const WALL = 1.6;                   // ...and the ground rising more steeply than this from the nose to there is a wall (m a metre, 58 deg; the banks rise 0.3 to 0.5, a few to 1.4)
const SOLID = 0.3;                  // ...as is anything solid nearer than this (a house, a quay wall, the map's edge; m)
const IDLE_SUNK = 4;                // lying still this long with nothing pushing it, it has sunk (s): GLUB, and the way back to dry land
const tmpR = [0, 0, 0];

// the Rocket's nozzles and fans work in the water just now
export const swims = (car, input) => !!car.rocket && !input.rocketOff && !input.boostOff;

// One step of a swimming Rocket, before the water's own moving of it (physics.js): its pushes, its turning, what
// stops it. floorY: what its wheels are over (the bed, or a bank) at its height. Returns true while something
// is pushing it, so it has not sunk.
export function swim(car, input, world, dt, m, floorY, fx, fz, rx, rz) {
  const r = car.rocket, s = car.spec;
  const onBed = car.y <= floorY + 0.3;
  // BOOST: the tail's push, along the body (thrust.js gives it, as on land: it fades with the tank)
  car.vx += ((car.thrustN || 0) / m) * dt;
  // the water's drag, growing with the square of the speed
  car.vx -= DRAG_Q * car.vx * Math.abs(car.vx) * dt;
  car.vy -= DRAG_Q * DRAG_SIDE * car.vy * Math.abs(car.vy) * dt;
  // on the bed: down the slope by what weight it still has, and the motors crawling it with the fans on
  const up = +input.up || 0, down = +input.down || 0;
  let crawl = false;
  if (onBed) {
    car.vx -= G * WEIGHT * Math.sin(car.groundPitch) * dt;
    if (!car.fanOff && up !== down) {
      crawl = true;
      const want = (up - down) * CRAWL_V;
      if (want > 0 && car.vx < want) car.vx = Math.min(want, car.vx + CRAWL_A * dt);
      else if (want < 0 && car.vx > want) car.vx = Math.max(want, car.vx - CRAWL_A * dt);
    }
  }
  // turning: the nose jets while BOOST blows, the wheels while crawling
  const steer = input.steer !== undefined ? input.steer : (+input.right || 0) - (+input.left || 0);
  let yawWant = 0;
  if (r.on) {
    yawWant += steer * YAW_JET;
    // (the one on the outside of the turn blows: the left one turns the nose right)
    const k = Math.min(1, Math.abs(steer));
    if (k > 0.05) r.noz[NOZ_YAW + (steer > 0 ? 0 : 1)] = Math.max(r.noz[NOZ_YAW + (steer > 0 ? 0 : 1)], 0.6 * k);
  }
  if (crawl) yawWant += (car.vx * Math.tan(steer * LOCK)) / s.wheelbase;
  if (r.on || crawl) car.yawRate += (yawWant - car.yawRate) * Math.min(1, dt * 4);
  // what is in the way: a bank too steep to climb, a wall, a bridge's pier
  if (car.vx !== 0) {
    const e = car.vx > 0 ? car.a : -car.b, d = e + Math.sign(car.vx) * AHEAD;
    const x = car.x + fx * d, z = car.z + fz * d;
    if (world.heightAt(x, z) - world.heightAt(car.x + fx * e, car.z + fz * e) > WALL * AHEAD || world.sdfAt(x, z) < SOLID) car.vx = 0;
  }
  if (world.railPush && world.railPush(car.x, car.z, car.y, car.halfWid, tmpR)) {
    car.x += tmpR[0] * tmpR[2]; car.z += tmpR[1] * tmpR[2];
    // (what of its speed went into the pier is gone)
    const into = (car.vx * fx + car.vy * rx) * tmpR[0] + (car.vx * fz + car.vy * rz) * tmpR[1];
    if (into < 0) { car.vx -= into * (fx * tmpR[0] + fz * tmpR[1]); car.vy -= into * (rx * tmpR[0] + rz * tmpR[1]); }
  }
  const busy = r.on || crawl;
  car.swimIdle = busy ? 0 : (car.swimIdle || 0) + dt;
  return busy;
}

// After the water has moved it: on the bed it lies on the bed as that rises or falls under it, pitched and rolled
// with it, so it climbs the bank instead of going into it. Never below what is under it.
export function swimFloor(car, floorY, dt) {
  if (car.y <= floorY + 0.3) {
    car.y = floorY;
    car.pitch += (car.groundPitch - car.pitch) * Math.min(1, dt * 5);
    car.roll += (car.groundRoll - car.roll) * Math.min(1, dt * 5);
  }
}

// it has sunk: lying still on the bed, nothing pushing it for IDLE_SUNK (and up again as soon as something does)
export const swimSunk = (car) => (car.swimIdle || 0) > IDLE_SUNK;
