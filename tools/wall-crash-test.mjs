// A hard crash into a wall ends on the roof (src/cars/crash.js, Martin 2026-11-26: a wall was a free brake,
// "300 to 0 in a split second" at the end of Veski). The rule: over 140 km/h and within 30 degrees of straight at
// the wall. Every car is driven at a wall on the game's physics, on both sides of the speed and of the angle,
// nose first, tail first and sideways, in a street with a second wall close behind, at three frame rates.
// A crashed car must go over, come to rest on its roof clear of every wall, stay there whatever the pedals
// do, and be whole again after resetCar; a hit under the rule must be what it was.
// Run: node tools/wall-crash-test.mjs
import { CARS, CAR_ORDER } from '../src/cars/specs.js';
import { createCar, stepCar, resetCar } from '../src/cars/physics.js';
import { CRASH_KMH, CRASH_DEG, bodyHeight, onRoof } from '../src/cars/crash.js';

// walls: z < 0 is solid; with `street` also z > street
const mkWorld = (street = 0) => ({
  meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1,
  sdfAt: (x, z) => (street ? Math.min(z, street - z) : z),
  sdfGrad: (x, z, o) => { o[0] = 0; o[1] = street && street - z < z ? -1 : 1; return o; },
});
let fails = 0, runs = 0;
const bad = (what) => { fails++; console.log('FAIL', what); };

// a car `gap` m from the wall, moving at kmh at `deg` off straight at it, the body turned `turn` degrees from
// the way it moves (0 nose first, 180 tail first, 90 sideways)
function drive(id, { kmh, deg = 0, turn = 0, street = 0, fps = 60, hold = { up: 1 }, secs = 7 }) {
  const world = mkWorld(street), spec = CARS[id];
  const a = (deg * Math.PI) / 180;
  const dir = [Math.sin(a), -Math.cos(a)];                     // the way it moves: towards -z
  const yaw = Math.atan2(dir[0], -dir[1]) + (turn * Math.PI) / 180;
  const car = createCar(spec, { x: 0, z: 6, yaw });
  const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw), v = kmh / 3.6;
  car.vx = v * (dir[0] * fx + dir[1] * fz); car.vy = v * (dir[0] * rx + dir[1] * rz);
  const dt = 1 / fps;
  let crashedAt = null, roofAt = null, stillAt = null, minSdf = 1e9, top = 0, t = 0, nan = false, moved = 0, rest = null;
  while (t < secs) {
    stepCar(car, t < 0.3 ? { up: 0 } : hold, world, dt); t += dt;
    if (![car.x, car.z, car.y, car.yaw, car.pitch, car.roll, car.vx, car.vy].every(Number.isFinite)) { nan = true; break; }
    if (car.crash) {
      crashedAt ??= t;
      minSdf = Math.min(minSdf, world.sdfAt(car.x, car.z));
      top = Math.max(top, car.y);
      if (car.crash.onRoof) roofAt ??= t;
      if (car.crash.still) { stillAt ??= t; rest ??= [car.x, car.z]; moved = Math.max(moved, Math.hypot(car.x - rest[0], car.z - rest[1])); }
    }
  }
  return { car, world, crashedAt, roofAt, stillAt, minSdf, top, nan, moved };
}

function mustCrash(id, o, what, way) {
  runs++;
  const r = drive(id, o), c = r.car, tag = `${id} ${what}`;
  if (r.nan) return bad(`${tag}: a figure went wrong`);
  if (!r.crashedAt) return bad(`${tag}: no crash`);
  if (!r.roofAt || r.roofAt - r.crashedAt > 2) bad(`${tag}: not on its roof within 2 s (${r.roofAt})`);
  if (!r.stillAt || r.stillAt - r.crashedAt > 5) bad(`${tag}: not at rest within 5 s (${r.stillAt})`);
  if (!onRoof(c)) bad(`${tag}: not upside down at the end (pitch ${c.pitch.toFixed(2)}, roll ${c.roll.toFixed(2)})`);
  if (way === 'pitch+' && Math.abs(c.pitch - Math.PI) > 0.01) bad(`${tag}: should have gone over nose up (pitch ${c.pitch.toFixed(2)})`);
  if (way === 'pitch-' && Math.abs(c.pitch + Math.PI) > 0.01) bad(`${tag}: should have gone over tail up (pitch ${c.pitch.toFixed(2)})`);
  if (way === 'roll' && Math.abs(Math.abs(c.roll) - Math.PI) > 0.01) bad(`${tag}: should have rolled (roll ${c.roll.toFixed(2)})`);
  // (in an alley narrower than the car is long the two walls share it out: only never inside one)
  if (r.minSdf < (o.street && o.street < 2 * c.halfLen + 2 ? 0.5 : c.halfWid - 0.02)) bad(`${tag}: its middle came within ${r.minSdf.toFixed(2)} m of a wall`);
  if (Math.abs(c.y - bodyHeight(c.spec)) > 0.02) bad(`${tag}: lies at ${c.y.toFixed(2)} m, its roof is ${bodyHeight(c.spec).toFixed(2)} m`);
  if (r.top > c.halfLen + bodyHeight(c.spec) + 0.6) bad(`${tag}: thrown ${r.top.toFixed(1)} m up`);
  if (r.moved > 0.01) bad(`${tag}: moved ${r.moved.toFixed(2)} m on its roof with the pedal down`);
  if (Math.hypot(c.vx, c.vy) > 0.01 || c.throttle || c.rpm > 1) bad(`${tag}: not dead on its roof (v ${Math.hypot(c.vx, c.vy).toFixed(2)}, rpm ${c.rpm.toFixed(0)})`);
  // back on its wheels by R
  resetCar(c, o.street ? { x: 30, z: o.street / 2, yaw: Math.PI / 2, y: 0 } : { x: 0, z: 40, yaw: 0, y: 0 });
  if (c.crash || c.pitch || c.roll || c.airborne) bad(`${tag}: resetCar left it crashed`);
  for (let i = 0; i < 180; i++) stepCar(c, { up: 1 }, r.world, 1 / 60);
  if (!(c.vx > 2)) bad(`${tag}: does not drive after resetCar (${c.vx.toFixed(1)} m/s)`);
  return r;
}
function mustNot(id, o, what) {
  runs++;
  const r = drive(id, { ...o, secs: 2 });
  if (r.nan) return bad(`${id} ${what}: a figure went wrong`);
  if (r.crashedAt) bad(`${id} ${what}: crashed onto its roof, and should not have`);
  if (r.car.pitch > 0.5 || Math.abs(r.car.roll) > 0.5) bad(`${id} ${what}: body turned over without a crash`);
}

const quick = process.argv.includes('quick');
const ids = quick ? ['w201', 'rocket'] : CAR_ORDER;
let longest = 0;
for (const id of ids) {
  if (!CARS[id]) continue;
  for (const kmh of [CRASH_KMH + 6, 200, 300]) {
    const r = mustCrash(id, { kmh }, `${kmh} km/h straight at the wall`, 'pitch+');
    if (r?.stillAt) longest = Math.max(longest, r.stillAt - r.crashedAt);
  }
  mustNot(id, { kmh: CRASH_KMH - 6 }, `${CRASH_KMH - 6} km/h straight at the wall`);
  mustNot(id, { kmh: 100 }, '100 km/h straight at the wall');
  mustCrash(id, { kmh: 220, deg: CRASH_DEG - 5 }, `220 km/h, ${CRASH_DEG - 5} degrees off straight`, 'pitch+');
  mustCrash(id, { kmh: 220, deg: -(CRASH_DEG - 5) }, `220 km/h, ${CRASH_DEG - 5} degrees off the other way`, 'pitch+');
  mustNot(id, { kmh: 220, deg: CRASH_DEG + 6 }, `220 km/h, ${CRASH_DEG + 6} degrees off straight`);
  mustNot(id, { kmh: 300, deg: 60 }, '300 km/h along the wall at 30 degrees');
  mustCrash(id, { kmh: 180, turn: 180 }, '180 km/h tail first', 'pitch-');
  mustCrash(id, { kmh: 180, turn: 90 }, '180 km/h sideways', 'roll');
  mustCrash(id, { kmh: 180, turn: -90 }, '180 km/h sideways, the other side', 'roll');
  mustCrash(id, { kmh: 250, street: 11 }, '250 km/h in a street 11 m wide');
  mustCrash(id, { kmh: 250, street: 7, deg: 20 }, '250 km/h in an alley 7 m wide');
  for (const fps of [30, 144]) mustCrash(id, { kmh: 200, fps }, `200 km/h at ${fps} frames a second`, 'pitch+');
  mustCrash(id, { kmh: 200, hold: { down: 1, left: 1, handbrake: 1, boost: true, flip: true } }, '200 km/h, every button held');
}
console.log(`${runs} drives, ${fails} failed; the longest from the wall to lying still: ${longest.toFixed(1)} s`);
process.exit(fails ? 1 : 0);
