// Cars come down on other vehicles and stand on them (Martin, 26 Nov 2026: "I would like to land on vehicles as
// well, especially the bus. If on a car then tilt the car accordingly on which side it lands. If it somehow finds
// enough ground on the car then let it stay on it fully or partly and you can get off it by just driving forward
// or backward"). The tops are src/cars/tops.js, given to the world (world.setTops) as the parked cars and the
// other players' cars do in the game.
//   node tools/vehicle-test.mjs [--verbose]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';
import { onTopOf, topAt, carry } from '../src/cars/tops.js';

const verbose = process.argv.includes('--verbose');
const dt = 1 / 120, DEG = 180 / Math.PI;
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
writeFileSync(join(dir, 'jobs.mjs'), 'export const jobs = { add(f) { const g = f(); if (g && g.next) for (const _ of g); }, late: () => false };\n');
writeFileSync(join(dir, 'data.mjs'), readFileSync(join(root, 'src/world/data.js'), 'utf8').replace('import.meta.env.BASE_URL', "''").replace("'../jobs.js'", "'./jobs.mjs'").replace("'../cars/tops.js'", `'${pathToFileURL(join(root, 'src/cars/tops.js')).href}'`));
const { loadWorldData } = await import(pathToFileURL(join(dir, 'data.mjs')));
const world = await loadWorldData();
const spec = CARS.ceed || Object.values(CARS)[0];
const hold = (car, kmh) => ({ up: Math.max(0, Math.min(1, (kmh / 3.6 + 0.3 - car.vx) * 0.4)) });
const finite = (car) => [car.x, car.z, car.y, car.pitch, car.roll, car.vx, car.vy, car.yaw].every(Number.isFinite);

// a flat, open piece of street: nothing within 12 m, the ground level to 10 cm over 20 m along it
await world.loadAround(1100, 2600, 700);
let P = null;
{
  let seed = 3; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 0; k < 20000 && !P; k++) {
    const x = 700 + rnd() * 900, z = 2200 + rnd() * 800;
    if (world.sdfAt(x, z) < 12 || world.deckUnder(x, z, world.heightAt(x, z))) continue;
    const g = world.heightAt(x, z);
    let flat = true;
    for (const [a, b] of [[0, -12], [0, 12], [3, 0], [-3, 0], [3, -12], [-3, 12]]) if (Math.abs(world.heightAt(x + a, z + b) - g) > 0.1) flat = false;
    if (flat) P = { x, z, g };
  }
}
check(!!P, 'a flat open street to try it on', P ? `(${P.x.toFixed(1)}, ${P.z.toFixed(1)})` : 'none');
const BUS = { x: P.x, z: P.z, y: P.g, yaw: 0, hl: 6, hw: 1.275, h: 3.3, bus: true, dx: 0, dz: 0, dyaw: 0 };
const CAR = { x: P.x, z: P.z, y: P.g, yaw: 0, hl: 2.3, hw: 0.9, h: 1.465, bus: false, dx: 0, dz: 0, dyaw: 0 };
const fwd = (yaw) => [Math.sin(yaw), -Math.cos(yaw)];
const right = (yaw) => [Math.cos(yaw), Math.sin(yaw)];

// let a car go over vehicle v: dl along it (forward +), dw to its right, up m over its top there, at kmh along it
function drop(v, { dl = 0, dw = 0, up = 1, kmh = 0, yaw = 0, secs = 4, gas = kmh, move = null, trace = false }) {
  world.setTops('test', [v]);
  const [fx, fz] = fwd(v.yaw), [rx, rz] = right(v.yaw);
  const x = v.x + fx * dl + rx * dw, z = v.z + fz * dl + rz * dw;
  const top = topAt(v, x, z);
  const car = createCar(spec, { x, z, yaw: v.yaw + yaw, y: (top > -1e8 ? top : v.y + v.h) + up });
  car.vx = kmh / 3.6; car.airborne = true;
  const out = { car, top, landed: -1, maxUp: 0, minOver: Infinity, put: 0, roll: 0, pitch: 0, onAt: -1, offAt: -1 };
  let px = car.x, pz = car.z, py = car.y;
  for (let t = 0; t < secs; t += dt) {
    if (move) { move(v, dt); }
    stepCar(car, gas > 0 ? hold(car, gas) : { handbrake: true }, world, dt);
    carry(car);           // (carried along on what it stands on, as main.js does each frame)
    if (trace && Math.round(t / dt) % 6 === 0) console.log(t.toFixed(2), (car.z - v.z).toFixed(2), (car.y - P.g).toFixed(2), car.vx.toFixed(2), car.airborne, !!car.onTop, 'roll', (car.roll * DEG).toFixed(0), 'groundRoll', (car.groundRoll * DEG).toFixed(0), car.tip ? 'tip' : '', car.tipped ? 'tipped' : '', [0, 3, 6, 9].map((o) => (car.roofG[o] - P.g).toFixed(2)).join(' '));
    if (out.landed < 0 && !car.airborne) out.landed = t;
    if (car.onTop && out.onAt < 0) out.onAt = t;
    if (out.onAt >= 0 && !car.onTop && out.offAt < 0) out.offAt = t;
    if (out.landed >= 0) out.maxUp = Math.max(out.maxUp, car.vyUp);
    out.minOver = Math.min(out.minOver, car.y - world.heightAt(car.x, car.z));
    const side = Math.hypot(car.x - px, car.z - pz) - Math.hypot(car.vx, car.vy) * dt - 0.02;
    out.put = Math.max(out.put, side, car.y - py - Math.abs(car.vyUp) * dt - 0.1);
    px = car.x; pz = car.z; py = car.y;
    if (out.landed >= 0 && t - out.landed < 0.6) { if (Math.abs(car.roll) > Math.abs(out.roll)) out.roll = car.roll; if (Math.abs(car.pitch) > Math.abs(out.pitch)) out.pitch = car.pitch; }
    if (!finite(car)) { out.nan = true; break; }
  }
  out.over = car.y - P.g;
  world.setTops('test', []);
  return out;
}

// ---- 1. the bus: down on its roof, and it stays there
{
  const r = drop(BUS, { up: 1.5 });
  check(!r.nan && Math.abs(r.over - BUS.h) < 0.12 && r.car.onTop === BUS, 'a car let go over a bus stands on its roof', `${r.over.toFixed(2)} m up, the roof ${BUS.h} m`);
  check(r.put < 0.1 && r.maxUp < 2.5, '...without being thrown or put anywhere', `moved ${r.put.toFixed(2)} m at once at most, ${r.maxUp.toFixed(1)} m/s up at most`);
  for (const [name, dl, yaw] of [['forward', 2, 0], ['backward', -2, Math.PI]]) {
    const d = drop(BUS, { dl, up: 0.3, kmh: 12, yaw, secs: 7 });
    check(!d.nan && d.offAt > 0 && Math.abs(d.over) < 0.15 && d.minOver > -0.3, `...and one on its roof driven off the ${name === 'forward' ? 'front' : 'back'} at 12 km/h comes down onto the street`, `off it at ${d.offAt.toFixed(1)} s, ${d.over.toFixed(2)} m over the street at the end`);
  }
  const s = drop(BUS, { dw: 2.4, up: 1.5 });
  check(Math.abs(s.over - BUS.h) > 1 && s.car.onTop === null, 'a car let go beside a bus is not on it', `${s.over.toFixed(2)} m up`);
}

// ---- 2. a car: across its side the car leans to the side it came down on; on top it stays; it is driven off
{
  const L = drop(CAR, { dw: -1.25, up: 0.8, secs: 2, trace: !!process.env.VS }), R = drop(CAR, { dw: 1.25, up: 0.8, secs: 2 });
  // (the car below on our right: our right wheels up, the car leans to its left, as the body's roll has it)
  check(!L.nan && !R.nan && Math.abs(L.roll) > 0.25 && Math.abs(R.roll) > 0.25 && Math.sign(L.roll) === -Math.sign(R.roll), 'a car that comes down across a car\'s side leans the way it landed, one way on its left side, the other on its right', `${(L.roll * DEG).toFixed(0)} and ${(R.roll * DEG).toFixed(0)} deg as it lands`);
  check(L.put < 0.1 && R.put < 0.1 && L.maxUp < 2.5 && R.maxUp < 2.5 && L.car.onTop === CAR && R.car.onTop === CAR, '...stays there partly on it, never thrown or put elsewhere', `leaning ${(L.car.roll * DEG).toFixed(0)} and ${(R.car.roll * DEG).toFixed(0)} deg after 2 s, moved ${Math.max(L.put, R.put).toFixed(2)} m at once at most`);
  {
    // (and is driven off forward from there)
    const car = L.car;
    world.setTops('test', [CAR]);
    let put = 0, py = car.y, off = -1;
    for (let t = 0; t < 5; t += dt) {
      stepCar(car, hold(car, 10), world, dt);
      if (!car.onTop && off < 0) off = t;
      put = Math.max(put, car.y - py - Math.abs(car.vyUp) * dt - 0.1); py = car.y;
    }
    world.setTops('test', []);
    check(off >= 0 && Math.abs(car.y - P.g) < 0.2 && Math.abs(car.roll) < 0.1 && put < 0.1, '...and driven forward it comes off onto the street, level again', `off at ${off.toFixed(1)} s, ${(car.y - P.g).toFixed(2)} m up, leaning ${(car.roll * DEG).toFixed(0)} deg`);
  }
  const M = drop(CAR, { dw: 0.5, up: 0.6, secs: 3 });
  check(!M.nan && M.car.onTop === CAR && Math.abs(M.roll) > 0.03 && M.over > 0.8, '...one that comes down mostly on it stays on it, leaning a little', `${M.over.toFixed(2)} m up, leaning ${(M.car.roll * DEG).toFixed(0)} deg`);
  const T = drop(CAR, { up: 0.6, secs: 3 });
  check(!T.nan && T.car.onTop === CAR && T.over > 0.85 && T.put < 0.1, 'a car let go square over a car stays up on it (bonnet, roof and boot under its wheels)', `${T.over.toFixed(2)} m up, nose ${(T.car.pitch * DEG).toFixed(0)} deg`);
  for (const [name, kmh] of [['forward', 8], ['backward', -8]]) {
    const d = (() => {
      world.setTops('test', [CAR]);
      const car = createCar(spec, { x: CAR.x, z: CAR.z, yaw: 0, y: P.g + 1.6 });
      car.airborne = true;
      for (let t = 0; t < 2; t += dt) stepCar(car, { handbrake: true }, world, dt);
      let off = -1, put = 0, py = car.y;
      for (let t = 0; t < 6; t += dt) {
        if (kmh < 0) { car.reversing = true; stepCar(car, { down: Math.max(0, Math.min(1, (car.vx + 2.2) * -0.5 + 0.3)), reverse: true, up: 0 }, world, dt); }
        else stepCar(car, hold(car, kmh), world, dt);
        if (!car.onTop && off < 0) off = t;
        put = Math.max(put, car.y - py - Math.abs(car.vyUp) * dt - 0.1); py = car.y;
      }
      world.setTops('test', []);
      return { off, over: car.y - P.g, put, car };
    })();
    check(d.off >= 0 && Math.abs(d.over) < 0.2 && d.put < 0.1, `...and driven ${name} off it comes down onto the street`, `off at ${d.off.toFixed(1)} s, ${d.over.toFixed(2)} m over the street, moved ${d.put.toFixed(2)} m at once at most`);
  }
}

// ---- 3. on the street a car beside or into another does not climb on it
{
  world.setTops('test', [CAR]);
  const [fx, fz] = fwd(0);
  const car = createCar(spec, { x: CAR.x - fx * 12, z: CAR.z - fz * 12, yaw: 0, y: P.g });
  let most = 0, onIt = false;
  for (let t = 0; t < 3; t += dt) { stepCar(car, hold(car, 40), world, dt); most = Math.max(most, car.y - P.g); if (car.onTop) onIt = true; }
  world.setTops('test', []);
  check(!onIt && most < 0.3, 'a car driven along the street into a car\'s nose is not lifted onto it (the bump sideways is the parked cars\' and the players\' own)', `${most.toFixed(2)} m up at most`);
  const v = { ...CAR }, me = { x: CAR.x + 1.9, z: CAR.z, y: P.g };
  check(!onTopOf(me.y, v, me.x, me.z), '...two cars side by side on the street still bump each other');
  check(onTopOf(P.g + 1.4, v, CAR.x, CAR.z) && onTopOf(P.g + 0.95, v, CAR.x, CAR.z - 2.1), '...one up on the other\'s roof or bonnet does not', `the bonnet ${(topAt(v, CAR.x, CAR.z - 2.1) - P.g).toFixed(2)} m, the roof ${(topAt(v, CAR.x, CAR.z) - P.g).toFixed(2)} m`);
}

// ---- 4. a bus that moves carries the car on its roof with it
{
  const v = { ...BUS, dx: 0, dz: 0 };
  v.vx = 0; v.vz = -6;
  const r = drop(v, { up: 0.5, kmh: 21.6, gas: 0, secs: 1.8, trace: !!process.env.VT, move: (b, h) => { b.dx = 0; b.dz = b.vz * h; b.z += b.dz; } });
  check(r.car.onTop === v && Math.abs(r.over - BUS.h) < 0.15 && Math.abs(r.car.z - v.z) < 1, 'a car on the roof of a bus going 22 km/h is carried along on it', `${Math.abs(r.car.z - v.z).toFixed(2)} m from the bus\'s middle after 1.8 s (10 m on: the open street ends there), ${r.over.toFixed(2)} m up`);
}

// ---- 5. a bus shelter's roof (Martin, 26 Nov: "I would like to land on bus shelters too"): its walls are in the
// map's obstacles as src/world/shelter.js gives them (the back 0.6 m and the two ends), its roof a flat top
{
  const [fx, fz] = fwd(0);
  const C = { x: P.x - fx * 8, z: P.z - fz * 8 };       // (beside the place the bus stood, across the street from it)
  const box = { x: C.x + 6, z: C.z, yaw: 0.3, hx: 2.6, hz: 0.875 };
  const ux = Math.cos(box.yaw), uz = -Math.sin(box.yaw), nx = Math.sin(box.yaw), nz = Math.cos(box.yaw);
  const walls = [[-box.hx, box.hx, box.hz - 0.6, box.hz], [-box.hx, -box.hx + 0.2, -box.hz, box.hz], [box.hx - 0.2, box.hx, -box.hz, box.hz]].map(([s0, s1, n0, n1]) => {
    const sm = (s0 + s1) / 2, nm = (n0 + n1) / 2;
    return { x: box.x + ux * sm + nx * nm, z: box.z + uz * sm + nz * nm, yaw: box.yaw, hx: (s1 - s0) / 2, hz: (n1 - n0) / 2, tall: 2.6, removable: true };
  });
  world.addSolids(walls);
  const y = world.heightAt(box.x, box.z);
  const roof = { x: box.x, z: box.z, y, yaw: -box.yaw, hl: box.hz + 0.08, hw: box.hx + 0.08, h: 2.55, flat: true, dx: 0, dz: 0, dyaw: 0, vx: 0, vz: 0 };
  const r = drop(roof, { up: 1.2, secs: 3, yaw: Math.PI / 2 });
  check(!r.nan && Math.abs(r.over - (y - P.g) - 2.55) < 0.12 && r.car.onTop === roof && r.put < 0.1, 'a car let go over a bus shelter stands on its roof', `${(r.over - (y - P.g)).toFixed(2)} m up, the roof 2.55 m, moved ${r.put.toFixed(2)} m at once at most`);
  // (flown at it from the street side at 50 km/h, its wheels 2.8 m up: it comes down on the roof, not stopped by the walls)
  world.setTops('test', [roof]);
  const car = createCar(spec, { x: box.x - nx * 6, z: box.z - nz * 6, yaw: Math.atan2(nx, -nz), y: y + 3.1 });
  car.vx = 50 / 3.6; car.airborne = true;
  let on = false, hit = 0;
  for (let t = 0; t < 0.5; t += dt) { stepCar(car, {}, world, dt); if (car.onTop === roof && !car.airborne) on = true; hit = Math.max(hit, car.hit || 0); }
  world.setTops('test', []);
  check(on && hit < 1, '...and one flown onto it from the street at 50 km/h lands on the roof, not stopped by the walls', `${on ? 'on it' : 'not on it'}, hit ${hit.toFixed(1)} m/s`);
  world.removeSolids(walls);
}

// ---- 6. the shelter's glass (Martin, 26 Nov: "make the bus shelter glass shatter when landing ontop of it with any
// speed. contsuction itself can remain sound"): src/world/shelter.js as the game makes one, a car let down on it
{
  globalThis.location ??= { search: '', hostname: 'localhost' };          // (src/stats.js reads the page's address)
  const THREE = await import('three');
  const { breakableShelter, updateShelters } = await import('../src/world/shelter.js');
  const w = { setTops() {}, heightAt: () => 0, removeSolids() {}, addSolids() {} };
  const box = { x: 0, z: 0, yaw: 0.3, hx: 2.6, hz: 0.875 };
  const panes = [{ a: [-2.5, 0.8], b: [2.5, 0.8], y0: 0.2, y1: 2.2 }, { a: [-2.5, -0.8], b: [-2.5, 0.8], y0: 0.2, y1: 2.2 }, { a: [2.5, -0.8], b: [2.5, 0.8], y0: 0.2, y1: 2.2 }];
  const s = breakableShelter(w, new THREE.Group(), { box, y: 0, H: 2.45, frame: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), panes });
  const car = { x: 30, z: 0, y: 0, yaw: 0, vx: 0, vy: 0, halfLen: 2, halfWid: 0.9, onTop: null };
  let smashed = 0;
  const sound = { smash: (n) => { smashed += n; } };
  for (let i = 0; i < 30; i++) updateShelters(car, 1 / 60, sound);
  const before = s.info().broken;
  Object.assign(car, { x: 0.3, z: 0.1, y: 2.55, onTop: s.top });          // (let down still: no speed at all)
  for (let i = 0; i < 120; i++) updateShelters(car, 1 / 60, sound);
  const i = s.info();
  check(before === 0 && i.broken === i.panes && smashed === i.panes && i.bend === 0 && !i.through, 'a car let down on a bus shelter\'s roof, still, bursts all its glass, the frame unbent', `${i.broken} of ${i.panes} panes, bend ${i.bend.toFixed(2)} m, ${i.shards} shards`);
  s.remove();
}

console.log(`${checks - fails} of ${checks} checks passed`);
process.exit(fails ? 1 : 0);
