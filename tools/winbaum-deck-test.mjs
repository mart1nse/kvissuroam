// The Winbaum cabin's deck and roof are ground (Martin, 27 Nov 2026: "Make the porch so that you can drive on top of
// it. Also want to jump on it w the Tesla"): a car drives up onto the deck at any speed and off it again, one let
// go over the deck or the roof stands there, one flying at the wall is stopped by it, the Tesla's FLIP lands on the
// deck. The cabin's solids and tops come from cabinGround in src/world/winbaum.js, on the real map.
//   node tools/winbaum-deck-test.mjs [--verbose]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';
import { carry } from '../src/cars/tops.js';
import { refillTank } from '../src/cars/thrust.js';

const verbose = process.argv.includes('--verbose'), TRACE = process.argv.includes('--trace');
const dt = 1 / 120;
let fails = 0, checks = 0;
const check = (ok, what, detail = '') => {
  checks++;
  if (!ok) fails++;
  if (!ok || verbose) console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `  (${detail})` : ''}`);
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(root, 'public/data/');
globalThis.fetch = async (name) => {
  let buf;
  try { buf = readFileSync(join(DATA, String(name).replace(/^data\//, ''))); } catch { return { ok: false }; }
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return { ok: true, arrayBuffer: async () => ab, json: async () => JSON.parse(buf.toString('utf8')) };
};
const dir = mkdtempSync(join(tmpdir(), 'lr-'));
const url = (p) => pathToFileURL(join(root, p)).href;
writeFileSync(join(dir, 'jobs.mjs'), 'export const jobs = { add(f) { const g = f(); if (g && g.next) for (const _ of g); }, late: () => false };\n');
writeFileSync(join(dir, 'data.mjs'), readFileSync(join(root, 'src/world/data.js'), 'utf8').replace('import.meta.env.BASE_URL', "''").replace("'../jobs.js'", "'./jobs.mjs'").replace("'../cars/tops.js'", `'${url('src/cars/tops.js')}'`));
// the cabin's module with what it draws with left out
writeFileSync(join(dir, 'stub.mjs'), 'export class Parts {}\nexport const paintScale = () => 1, loadFont = () => null, FONT = "x", still = (g) => g;\nexport const jobs = { add() {}, late: () => false };\n');
let src = readFileSync(join(root, 'src/world/winbaum.js'), 'utf8');
src = src.replace(/from '(\.\.\/race\/landmarks\.js|\.\/paintscale\.js|\.\/hologram\.js|\.\.\/jobs\.js|\.\.\/still\.js)'/g, "from './stub.mjs'")
  .replace("from 'three';", `from '${url('node_modules/three/build/three.module.js')}';`)
  .replace(/from 'three\/examples\/([^']+)'/g, (_, p) => `from '${url('node_modules/three/examples/' + p)}'`);
writeFileSync(join(dir, 'winbaum.mjs'), src);
const { loadWorldData } = await import(pathToFileURL(join(dir, 'data.mjs')));
const { cabinGround, lotFoot, CABIN } = await import(pathToFileURL(join(dir, 'winbaum.mjs')));
const world = await loadWorldData();
const C = CABIN, S = C.S;
await world.loadAround(C.spot.x, C.spot.z, 300);
const gy = lotFoot(world), ground = cabinGround(world, gy);
world.addSolids(ground.solids);
world.setTops('winbaum', ground.tops);
const DECK_Y = gy + S * C.DY, ROOF_Y = gy + S * C.YT;
const finite = (car) => [car.x, car.z, car.y, car.pitch, car.roll, car.vx, car.vy, car.yaw].every(Number.isFinite);
const hold = (car, kmh) => ({ up: Math.max(0, Math.min(1, (kmh / 3.6 + 0.3 - car.vx) * 0.4)) });
const local = (car) => C.toLocal(car.x, car.z);
// headings: towards the cabin (local -z), away from it (+z), along it (+x)
const Y = C.spot.yaw, IN = -Y, OUT = Math.PI - Y, ALONG = Math.atan2(Math.cos(Y), Math.sin(Y));
const spec = CARS.w201 || Object.values(CARS)[0];
const put = (lx, lz, yaw, y, kmh = 0, sp = spec) => {
  const [x, z] = C.toWorld(lx, lz);
  const car = createCar(sp, { x, z, yaw, y: y ?? world.heightAt(x, z) });
  car.vx = kmh / 3.6;
  return car;
};
const upright = (car) => Math.abs(car.roll) < 0.15 && Math.abs(car.pitch) < 0.15;
if (verbose) console.log(`cabin at (${C.spot.x.toFixed(1)}, ${C.spot.z.toFixed(1)}), foot ${gy.toFixed(2)} m, deck ${DECK_Y.toFixed(2)}, roof ${ROOF_Y.toFixed(2)}; street in front ${world.heightAt(...C.toWorld(-1.5, C.ZF + C.DECK + 3)).toFixed(2)}`);

// the car's middle on the deck's boards, all four wheels on them, the right way up
const onDeck = (car) => {
  const [lx, lz] = local(car);
  return lx > C.X0 + 1.6 && lx < C.X1 + C.DECK_R - 1.6 && lz > C.ZF + 0.6 && lz < C.ZF + C.DECK - 0.6 && Math.abs(car.y - DECK_Y) < 0.06 && !!car.onTop && upright(car);
};

// ---- 1. driven up onto the deck from the plaza: along it from its left end, slow and quick, and stopped on it; and
// from the front, at an angle, up to the glass
for (const kmh of [3, 8, 20, 35]) {
  const car = put(C.X0 - 4, C.ZF + 1.15, ALONG, undefined, kmh);
  let nan = false, jolt = 0, py = car.y, braking = false;
  for (let t = 0; t < 14; t += dt) {
    const [lx] = local(car);
    if (lx > C.X1 - 2.5 - kmh * 0.12) braking = true;
    stepCar(car, braking ? { handbrake: true, down: 0 } : hold(car, kmh), world, dt);
    carry(car);
    jolt = Math.max(jolt, car.y - py - 0.25); py = car.y;
    if (!finite(car)) { nan = true; break; }
    if (braking && Math.abs(car.vx) < 0.05) break;
  }
  for (let u = 0; u < 1; u += dt) stepCar(car, { handbrake: true }, world, dt);
  const [lx, lz] = local(car);
  check(!nan && onDeck(car) && jolt < 0.01, `driven up onto the deck from its end at ${kmh} km/h and along it, it stands on the boards`, `${(car.y - DECK_Y).toFixed(2)} m from the deck's top, ${((lz - C.ZF) * S).toFixed(1)} m from the glass, ${((lx - C.X0) * S).toFixed(1)} m along, roll ${car.roll.toFixed(2)} pitch ${car.pitch.toFixed(2)}`);
}
for (const kmh of [5, 25]) {
  const car = put(-3, C.ZF + C.DECK + 4, IN + 0.6, undefined, kmh);
  let nan = false, inside = false, up = false;
  for (let t = 0; t < 6; t += dt) {
    stepCar(car, hold(car, kmh), world, dt); carry(car);
    if (!finite(car)) { nan = true; break; }
    const [lx, lz] = local(car);
    if (lz < C.ZF - 0.1 && lx > C.X0 && lx < C.X1) inside = true;
    if (car.onTop && car.y > DECK_Y - 0.06) up = true;
  }
  check(!nan && up && !inside, `driven at the deck from the front at ${kmh} km/h, it goes up onto it and the glass stops it`, `${up ? 'up on it' : 'never up'}, ${inside ? 'went INSIDE' : 'stayed outside'}`);
}

// ---- 2. driven off its front and off its end
for (const [name, lx, lz, yaw] of [['front', -1.5, C.ZF + 1.0, OUT], ['right end', C.X1 - 1, C.ZF + 1.15, ALONG]]) {
  const car = put(lx, lz, yaw, DECK_Y);
  for (let t = 0; t < 1; t += dt) stepCar(car, {}, world, dt);
  let nan = false;
  for (let t = 0; t < 5; t += dt) { stepCar(car, hold(car, 10), world, dt); carry(car); if (!finite(car)) { nan = true; break; } }
  for (let t = 0; t < 1.5; t += dt) stepCar(car, { down: 1 }, world, dt);
  const over = car.y - world.heightAt(car.x, car.z);
  check(!nan && Math.abs(over) < 0.1 && upright(car) && !car.onTop, `driven off the deck's ${name} at 10 km/h, it comes down onto the plaza`, `${over.toFixed(2)} m over the ground after`);
}

// ---- 3. let go over the deck and over the roof (behind the sign), it stands there
for (const [name, lx, lz, yaw, top] of [['deck', -1.5, C.ZF + 1.2, ALONG, DECK_Y], ['roof', -2.5, C.ZB + 0.85, ALONG, ROOF_Y]]) {
  const car = put(lx, lz, yaw, top + 2.5);
  car.airborne = true;
  let nan = false;
  for (let t = 0; t < 4; t += dt) { stepCar(car, { handbrake: true }, world, dt); carry(car); if (!finite(car)) { nan = true; break; } }
  check(!nan && Math.abs(car.y - top) < 0.08 && upright(car) && !!car.onTop, `let go 2.5 m over the ${name}, it lands and stays on it`, `${(car.y - top).toFixed(2)} m from its top`);
}

// ---- 4. flying at the wall below the roof, the cabin stops it (no flying through it any more)
{
  const car = put(-1.5, C.ZF + C.DECK + 5, IN, gy + 3.2, 50);
  car.airborne = true;
  let inside = false, nan = false;
  for (let t = 0; t < 3; t += dt) {
    stepCar(car, {}, world, dt);
    if (!finite(car)) { nan = true; break; }
    const [lx, lz] = local(car);
    if (lx > C.X0 + 0.3 && lx < C.X1 - 0.3 && lz < C.ZF - 0.3 && lz > C.ZB + 0.3 && car.y < ROOF_Y - 0.5) inside = true;
  }
  check(!nan && !inside, 'a car flying at the cabin 3 m up does not go into it', inside ? 'went inside' : 'stopped outside');
}

// ---- 5. the Tesla's FLIP from the plaza onto the deck: coming along it from its left end
{
  const sp = CARS.rocket;
  const lands = [];
  for (let d = 2; d <= 14; d += 1) {
    refillTank('rocket');
    const car = put(C.X0 - d / S, C.ZF + 1.15, ALONG, undefined, 12, sp);
    for (let t = 0; t < 0.4; t += dt) stepCar(car, hold(car, 12), world, dt);
    stepCar(car, { flip: 1 }, world, dt);
    if (!car.rocket?.launched) { lands.push({ d, none: true }); continue; }
    let nan = false, t = 0, inside = false, peak = 0;
    for (; t < 12 && car.rocket.flight; t += dt) {
      stepCar(car, {}, world, dt); carry(car);
      if (!finite(car)) { nan = true; break; }
      const [lx, lz] = local(car);
      if (lx > C.X0 + 0.3 && lx < C.X1 - 0.3 && lz < C.ZF - 0.3 && lz > C.ZB + 0.3 && car.y < ROOF_Y - 0.5) inside = true;
      peak = Math.max(peak, car.y - gy);
    }
    const crashed = !!car.rocket.crashed, [lxL] = local(car);
    for (let u = 0; u < 2; u += dt) { stepCar(car, { handbrake: true }, world, dt); carry(car); }
    lands.push({ d, nan, inside, crashed, peak, lxL, ok: onDeck(car), y: car.y - gy });
  }
  const good = lands.filter((l) => l.ok);
  check(good.length >= 3, "the Tesla's FLIP from the plaza lands on the deck and stays there", `${good.length} of ${lands.length} starts land on it, from ${good.map((l) => l.d).join(', ')} m before its end`);
  check(lands.every((l) => !l.none && !l.nan && !l.inside), '...and every FLIP launches and none ends inside the cabin', lands.filter((l) => l.none || l.inside || l.nan).map((l) => `${l.d} m`).join(', ') || 'none');
  if (verbose) for (const l of lands) console.log(l.none ? `  FLIP from ${l.d} m: no jump` : `  FLIP from ${l.d} m before the deck: ${l.crashed ? 'let go' : 'flew'} ${l.peak.toFixed(1)} m high, came down ${((l.lxL - C.X0) * S).toFixed(1)} m along the deck, ends ${l.y.toFixed(2)} m up${l.ok ? ', on the deck' : ''}`);
}

// ---- 6. beside the deck on the plaza, a car stays on the plaza
{
  const car = put(C.X0 - 1.6, C.ZF + C.DECK + 2, IN, undefined, 15);
  let maxOver = 0;
  for (let t = 0; t < 1.2; t += dt) { stepCar(car, hold(car, 15), world, dt); maxOver = Math.max(maxOver, car.y - world.heightAt(car.x, car.z)); }
  check(maxOver < 0.1 && !car.onTop, 'a car driving past the deck\'s end on the plaza is not lifted onto it', `${maxOver.toFixed(2)} m up at most`);
}

console.log(`${checks - fails} of ${checks} checks pass${fails ? `, ${fails} FAIL` : ''}`);
process.exit(fails ? 1 : 0);
