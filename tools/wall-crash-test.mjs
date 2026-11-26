// A hard crash into a wall throws the car over (src/cars/crash.js, Martin 2026-11-26: a wall was a free brake,
// "300 to 0 in a split second" at the end of Veski). The rule: over 140 km/h and within 30 degrees of straight at
// the wall. What follows is one of three (his second word that day): back down onto its wheels, onto its side to
// balance there and tip either way, or right over onto its roof, where it lies a second and is rolled back onto
// its wheels. 70 in 100 end on the wheels without the roof.
// Every car is driven at a wall on the game's physics, on both sides of the speed and of the angle, nose first,
// tail first and sideways, in a street with a second wall close behind, at three frame rates, to every ending.
// A crashed car must go the way its ending says, clear of every wall, whatever the pedals do, and stand on its
// wheels as the driver's own again by itself; a hit under the rule must be what it was.
// And a replay of such a drive must show the server each crash (the lap's 5 s are counted there again).
// Run: node tools/wall-crash-test.mjs [quick]
import { CARS, CAR_ORDER } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';
import { CRASH_KMH, CRASH_DEG, CRASH_FLAG, ROOF_S, bodyHeight, onRoof, crashHit, crashesIn } from '../src/cars/crash.js';
import { createRecorder, FIELDS } from '../src/race/replay.js';

// the endings, by the dice that picks one (car.crashDice)
const ENDS = { wheels: 0.3, sideWheels: 0.66, sideRoof: 0.74, roof: 0.9 };

// walls: z < 0 is solid; with `street` also z > street
const mkWorld = (street = 0) => ({
  meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1,
  sdfAt: (x, z) => (street ? Math.min(z, street - z) : z),
  sdfGrad: (x, z, o) => { o[0] = 0; o[1] = street && street - z < z ? -1 : 1; return o; },
});
let fails = 0, runs = 0;
const bad = (what) => { fails++; console.log('FAIL', what); };

// a car `gap` m from the wall, moving at kmh at `deg` off straight at it, the body turned `turn` degrees from
// the way it moves (0 nose first, 180 tail first, 90 sideways). It is driven until `after` s past the moment it
// stands again (from there the pedal down, then the other one: it may stand with its nose at the wall), or secs.
function drive(id, { kmh, deg = 0, turn = 0, street = 0, fps = 60, hold = { up: 1 }, secs = 9, end = 'wheels', after = 4, each = null, gap = 6 }) {
  const world = mkWorld(street), spec = CARS[id];
  const a = (deg * Math.PI) / 180;
  const dir = [Math.sin(a), -Math.cos(a)];                     // the way it moves: towards -z
  const yaw = Math.atan2(dir[0], -dir[1]) + (turn * Math.PI) / 180;
  const car = createCar(spec, { x: 0, z: gap, yaw });
  car.crashDice = ENDS[end];
  const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw), v = kmh / 3.6;
  car.vx = v * (dir[0] * fx + dir[1] * fz); car.vy = v * (dir[0] * rx + dir[1] * rz);
  const dt = 1 / fps;
  const r = { car, world, crashedAt: null, stoodAt: null, roofS: 0, sideS: 0, minSdf: 1e9, top: 0, nan: false, crashes: 0, maxP: 0, maxR: 0, jump: 0, wentV: 0, low: 0, phases: [] };
  let t = 0, was = null, pp = 0, pr = 0;
  while (t < secs && !(r.stoodAt != null && t - r.stoodAt > after)) {
    stepCar(car, t < 0.3 && gap < 10 ? { up: 0 } : r.stoodAt != null ? (t - r.stoodAt < after / 2 ? { up: 1 } : { down: 1 }) : hold, world, dt); t += dt;
    if (![car.x, car.z, car.y, car.yaw, car.pitch, car.roll, car.vx, car.vy].every(Number.isFinite)) { r.nan = true; break; }
    each?.(car, t);
    if (car.crash && car.crash !== was) { r.crashes++; r.crashedAt ??= t; }
    if (car.crash) {
      const c = car.crash;
      if (r.phases.at(-1) !== c.ph) r.phases.push(c.ph);
      r.minSdf = Math.min(r.minSdf, world.sdfAt(car.x, car.z));
      r.top = Math.max(r.top, car.y); r.low = Math.min(r.low, car.y);
      if (onRoof(car)) r.roofS += dt;
      if (Math.abs(Math.abs(car.roll) - Math.PI / 2) < 0.35 && Math.abs(car.pitch) < 0.2) r.sideS += dt;
      r.maxP = Math.max(r.maxP, Math.abs(car.pitch)); r.maxR = Math.max(r.maxR, Math.abs(car.roll));
      // (the body turns smoothly: but for the one frame an end-over landing is rewritten as turned about and rolled)
      if (was === c) {
        const dp = Math.abs(Math.atan2(Math.sin(car.pitch - pp), Math.cos(car.pitch - pp))), dr = Math.abs(Math.atan2(Math.sin(car.roll - pr), Math.cos(car.roll - pr)));
        if (!(dp > 2.4 && dr > 2.4)) r.jump = Math.max(r.jump, dp / dt, dr / dt);
      }
    } else if (was && r.stoodAt == null) r.stoodAt = t;
    if (r.stoodAt != null) r.wentV = Math.max(r.wentV, Math.hypot(car.vx, car.vy));
    was = car.crash; pp = car.pitch; pr = car.roll;
  }
  return r;
}

function mustCrash(id, o, what, way) {
  runs++;
  const end = o.end || 'wheels', r = drive(id, o), c = r.car, tag = `${id} ${what}, to ${end}`;
  const h = bodyHeight(c.spec), roof = end === 'roof' || end === 'sideRoof', side = end.startsWith('side');
  if (r.nan) return bad(`${tag}: a figure went wrong`);
  if (!r.crashedAt) return bad(`${tag}: no crash`);
  if (r.stoodAt == null) return bad(`${tag}: never stood up again (${r.phases.join(' > ')})`);
  const took = r.stoodAt - r.crashedAt;
  if (took > (roof ? 6.5 : side ? 3.6 : 2.2)) bad(`${tag}: ${took.toFixed(1)} s from the wall to standing`);
  if (took < 1) bad(`${tag}: standing again after ${took.toFixed(2)} s`);
  if (r.crashes > 1) bad(`${tag}: crashed ${r.crashes} times`);
  // the ending it was to have
  if (roof && r.roofS < ROOF_S) bad(`${tag}: on its roof for ${r.roofS.toFixed(2)} s, should lie there ${ROOF_S}`);
  if (roof && r.roofS > ROOF_S + 2.6) bad(`${tag}: left on its roof for ${r.roofS.toFixed(1)} s`);
  if (!roof && r.roofS > 0) bad(`${tag}: was on its roof (${r.roofS.toFixed(2)} s)`);
  if (side && r.sideS < 0.4) bad(`${tag}: on its side for ${r.sideS.toFixed(2)} s only`);
  if (end === 'wheels' && (Math.max(r.maxP, r.maxR) < 0.9 || Math.max(r.maxP, r.maxR) > 1.5)) bad(`${tag}: went up to ${Math.max(r.maxP, r.maxR).toFixed(2)} rad`);
  if (way === 'pitch' && r.maxP < 0.9) bad(`${tag}: should have gone up end on (pitch ${r.maxP.toFixed(2)})`);
  if (way === 'roll' && (r.maxR < 0.9 || r.maxP > 0.2)) bad(`${tag}: should have rolled (roll ${r.maxR.toFixed(2)}, pitch ${r.maxP.toFixed(2)})`);
  if (r.jump > 14) bad(`${tag}: the body jerked (${r.jump.toFixed(0)} rad/s)`);
  // (in an alley narrower than the car is long the two walls share it out: only never inside one)
  if (r.minSdf < (o.street && o.street < 2 * c.halfLen + 2 ? 0.5 : c.halfWid - 0.02)) bad(`${tag}: its middle came within ${r.minSdf.toFixed(2)} m of a wall`);
  if (r.top > c.halfLen + h + 0.6) bad(`${tag}: thrown ${r.top.toFixed(1)} m up`);
  if (r.low < -0.12) bad(`${tag}: ${(-r.low).toFixed(2)} m into the ground`);
  // the driver's own again: on its wheels, level, on the ground, and it drives
  if (c.crash || Math.abs(c.pitch) > 0.15 || Math.abs(c.roll) > 0.15) bad(`${tag}: not level on its wheels at the end (pitch ${c.pitch.toFixed(2)}, roll ${c.roll.toFixed(2)})`);
  if (Math.abs(c.y) > 0.2 || c.airborne) bad(`${tag}: not on the road at the end (y ${c.y.toFixed(2)})`);
  // (a 12 m bus across a street narrower than it is long is wedged, as it would be: R is for that)
  if (!(r.wentV > 2) && !(o.street && o.street < 2 * c.halfLen + 1)) bad(`${tag}: does not drive once it stands (${r.wentV.toFixed(1)} m/s)`);
  if (r.world.sdfAt(c.x, c.z) < 0.3) bad(`${tag}: ended in a wall`);
  return { ...r, took };
}
function mustNot(id, o, what) {
  runs++;
  const r = drive(id, { ...o, secs: 2 });
  if (r.nan) return bad(`${id} ${what}: a figure went wrong`);
  if (r.crashedAt) bad(`${id} ${what}: thrown over, and should not have been`);
  if (r.car.pitch > 0.5 || Math.abs(r.car.roll) > 0.5) bad(`${id} ${what}: body turned over without a crash`);
}

const quick = process.argv.includes('quick');
const ids = quick ? ['w201', 'rocket'] : CAR_ORDER;
const longest = {};
for (const id of ids) {
  if (!CARS[id]) continue;
  for (const end of Object.keys(ENDS)) {
    for (const kmh of [CRASH_KMH + 6, 200, 300]) {
      const r = mustCrash(id, { kmh, end }, `${kmh} km/h straight at the wall`, 'pitch');
      if (r?.took) longest[end] = Math.max(longest[end] || 0, r.took);
    }
    mustCrash(id, { kmh: 180, turn: 180, end }, '180 km/h tail first', 'pitch');
    mustCrash(id, { kmh: 180, turn: 90, end }, '180 km/h sideways', 'roll');
    mustCrash(id, { kmh: 180, turn: -90, end }, '180 km/h sideways, the other side', 'roll');
    mustCrash(id, { kmh: 250, street: 11, end }, '250 km/h in a street 11 m wide');
    mustCrash(id, { kmh: 250, street: 7, deg: 20, end }, '250 km/h in an alley 7 m wide');
    for (const fps of [30, 144]) mustCrash(id, { kmh: 200, fps, end }, `200 km/h at ${fps} frames a second`, 'pitch');
    mustCrash(id, { kmh: 200, end, hold: { down: 1, left: 1, handbrake: 1, boost: true, flip: true } }, '200 km/h, every button held');
  }
  mustNot(id, { kmh: CRASH_KMH - 6 }, `${CRASH_KMH - 6} km/h straight at the wall`);
  mustNot(id, { kmh: 100 }, '100 km/h straight at the wall');
  mustCrash(id, { kmh: 220, deg: CRASH_DEG - 5 }, `220 km/h, ${CRASH_DEG - 5} degrees off straight`, 'pitch');
  mustCrash(id, { kmh: 220, deg: -(CRASH_DEG - 5), end: 'roof' }, `220 km/h, ${CRASH_DEG - 5} degrees off the other way`, 'pitch');
  mustNot(id, { kmh: 220, deg: CRASH_DEG + 6 }, `220 km/h, ${CRASH_DEG + 6} degrees off straight`);
  mustNot(id, { kmh: 300, deg: 60 }, '300 km/h along the wall at 30 degrees');
}

// ---- how often each ending: 70 in 100 back on the wheels without the roof
{
  const car = createCar(CARS.w201, { x: 0, z: 6, yaw: 0 }), n = 40000, got = { wheels: 0, side: 0, roof: 0 };
  let wheels = 0, left = 0;
  for (let i = 0; i < n; i++) {
    car.crash = null;
    crashHit(car, 0, 1, 0, -60);
    got[car.crash.way]++;
    if (car.crash.way === 'wheels' || (car.crash.way === 'side' && car.crash.fall === 'wheels')) wheels++;
    if (car.crash.rs < 0) left++;
  }
  runs++;
  const pc = (k) => (100 * k) / n;
  if (Math.abs(pc(wheels) - 70) > 1.2) bad(`${pc(wheels).toFixed(1)} in 100 end on the wheels, should be 70`);
  if (pc(got.side) < 12 || pc(got.side) > 20) bad(`${pc(got.side).toFixed(1)} in 100 balance on a side`);
  if (Math.abs(pc(left) - 50) > 2) bad(`${pc(left).toFixed(1)} in 100 roll to the left`);
  console.log(`endings in 100 crashes: ${pc(got.wheels).toFixed(1)} straight back on the wheels, ${pc(got.side).toFixed(1)} on a side, ${pc(got.roof).toFixed(1)} right over; on the wheels without the roof ${pc(wheels).toFixed(1)}`);
}

// ---- a replay of a crash: the flag each sample carries (multiplayer.js poseNow), counted as the server counts
for (const end of Object.keys(ENDS)) {
  runs++;
  const pose = (car, out) => { out.fill(0); out[0] = car.x; out[1] = car.z; out[2] = car.y; out[3] = car.yaw; out[4] = car.pitch; out[5] = car.roll; out[20] = car.crash ? CRASH_FLAG : 0; return out; };
  const rec = createRecorder(pose);
  let began = false, last = 0, c = null;
  drive('f40', { kmh: 230, end, after: 1.5, gap: 70, each: (car, t) => { if (!began) { rec.begin(t); began = true; } rec.frame(t, car); last = t; c = car; } });
  const tr = rec.finish(last, last, c);
  const flags = []; for (let i = 0; i < tr.n; i++) flags.push(tr.data[i * FIELDS + 20]);
  if (crashesIn(flags) !== 1) bad(`a replay of a crash to ${end}: the server would count ${crashesIn(flags)} crashes`);
  // (and no sample between the two ways an end-over roof landing is written: pitch and roll each near 0 or half a turn there)
  for (let i = 1; i < tr.n; i++) {
    const p0 = tr.data[(i - 1) * FIELDS + 4] / 1000, p1 = tr.data[i * FIELDS + 4] / 1000, r1 = tr.data[i * FIELDS + 5] / 1000;
    if (Math.abs(p0) > 2.2 && Math.abs(p1) > 0.6 && Math.abs(p1) < 2.2 && Math.abs(r1) > 0.6) bad(`a replay of a crash to ${end}: a sample half way between its two forms (pitch ${p1}, roll ${r1})`);
  }
}
runs++;
if (crashesIn([0, CRASH_FLAG, CRASH_FLAG, 0, 0, 8, 8 | CRASH_FLAG, 8 | CRASH_FLAG, 8, 8 | CRASH_FLAG, 8]) !== 2) bad('crashesIn: two crashes after one under way at the start');

console.log(`${runs} drives, ${fails} failed; the longest from the wall to standing again: ${Object.entries(longest).map(([k, v]) => `${k} ${v.toFixed(1)} s`).join(', ')}`);
process.exit(fails ? 1 : 0);
