// The tops of other vehicles, for a car that comes down on one (Martin, 26 Nov 2026: "I would like to land on
// vehicles as well, especially the bus. If on a car then tilt the car accordingly on which side it lands. If it
// somehow finds enough ground on the car then let it stay on it fully or partly and you can get off it by just
// driving forward or backward").
//
// A vehicle is a box on the ground, { x, z, y, yaw, hl, hw, h, bus, flat }: its middle, the height it stands at, the way
// it faces, half its length and width, and its height. Its top is a bus's flat roof, or a car's shape along its
// length: a nose, the bonnet, the windscreen up to the roof, the roof, the back down to the boot, a little lower at
// the sides. Each wheel of a car over one stands on the top under it (world.groundAt), so a car that comes down
// across a car's side leans as the two wheels on it and the two beside it lie, one that lands on the roof stays
// there, and one driven forward or back goes down the bonnet or over the end as off any edge (tip.js).
// Nothing here is drawn; the parked cars (src/world/parked.js) and the other players' cars
// (src/net/multiplayer.js) give the world the ones near the car each frame (world.setTops). A bus shelter's roof
// is such a top too, flat (src/world/busstops.js: Martin, 26 Nov: "I would like to land on bus shelters too").

// a car's top along its length, from the front (0) to the back (1): [where, the share of its height]
const CAR = [[0, 0.6], [0.06, 0.66], [0.3, 0.7], [0.47, 1], [0.78, 1], [0.95, 0.72], [1, 0.62]];

// The height of vehicle v's top over the ground it stands on, at (l, w) from its middle (l forward, w to its right);
// -Infinity outside it.
export function topOver(v, l, w) {
  if (!(Math.abs(l) <= v.hl && Math.abs(w) <= v.hw)) return -Infinity;
  const f = (v.hl - l) / (2 * v.hl), q = Math.abs(w) / v.hw;
  if (v.flat) return v.h;
  if (v.bus) return v.h * (f < 0.02 || f > 0.98 || q > 0.94 ? 0.92 : 1);
  let k = 1;
  while (k < CAR.length - 1 && CAR[k][0] < f) k++;
  const [f0, s0] = CAR[k - 1], [f1, s1] = CAR[k];
  let s = s0 + (s1 - s0) * Math.max(0, Math.min(1, (f - f0) / (f1 - f0)));
  // (the shoulders: the roof and the bonnet round off to the sides)
  if (q > 0.75) s -= (s - 0.6) * (q - 0.75) * 1.6;
  return v.h * s;
}

// The top of vehicle v at the world point (x, z), as a height; -Infinity outside it.
export function topAt(v, x, z) {
  const dx = x - v.x, dz = z - v.z;
  const fx = Math.sin(v.yaw), fz = -Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = Math.sin(v.yaw);
  return v.y + topOver(v, dx * fx + dz * fz, dx * rx + dz * rz);
}

// The top of v nearest the point (x, z): (x, z) taken into its outline first. For the bumps between cars: one
// whose wheels are up at that height or over it is coming down on v, not into its side.
export function topNear(v, x, z) {
  const dx = x - v.x, dz = z - v.z;
  const fx = Math.sin(v.yaw), fz = -Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = Math.sin(v.yaw);
  const l = Math.max(-v.hl, Math.min(v.hl, dx * fx + dz * fz)), w = Math.max(-v.hw, Math.min(v.hw, dx * rx + dz * rz));
  return v.y + topOver(v, l, w);
}

// Is a car whose wheels are at height y, its middle at (x, z), up on vehicle v (or coming down on it)? Then the
// two do not bump sideways: one is on the other.
export const ABOVE = 0.35;
export function onTopOf(y, v, x, z) { return y >= topNear(v, x, z) - ABOVE; }

// A car on a vehicle that moves (a player's bus, a parked car knocked sliding) is carried with it, once a frame
// after its physics step. Its speed is then its speed over that vehicle's top: from the moment it comes onto one
// (or over it, in the air) the vehicle's own speed is taken out of it, and put back when it leaves, so that a car
// that drives off a moving bus goes on at the bus's pace and its own, and one that lands on it keeps its own over
// the street. The vehicle gives vx, vz (m/s over the ground) and dx, dz, dyaw (how far it moved since the last
// frame).
export function carry(car) {
  const v = car.onTop || null, was = car.carriedBy || null;
  if (v !== was) {
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    let wx = car.vx * fx + car.vy * rx, wz = car.vx * fz + car.vy * rz;
    if (was) { wx += was.vx || 0; wz += was.vz || 0; }
    if (v) { wx -= v.vx || 0; wz -= v.vz || 0; }
    car.vx = wx * fx + wz * fz; car.vy = wx * rx + wz * rz;
    car.carriedBy = v;
  }
  if (v && (v.dx || v.dz || v.dyaw)) {
    const ox = car.x - v.x + v.dx, oz = car.z - v.z + v.dz, c = Math.cos(v.dyaw), s = Math.sin(v.dyaw);
    car.x = v.x + ox * c - oz * s; car.z = v.z + ox * s + oz * c; car.yaw += v.dyaw;
    v.dx = v.dz = v.dyaw = 0;
  }
}
