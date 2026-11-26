// The map's houses have roofs a car can come down on and drive over (Martin, 26 Nov 2026: "free room over those
// buildings, taking into account the slopes of their roofs, so a car could drive onto it in case of a jump from
// another building or the new jump"; "trees from some metres from the top, it should be possible to fly through
// them"; "the first R puts you back on the roof and the next R puts you somewhere near it").
// The real map, in node: roofs in the centre of town, cars put on them, driven off them, dropped on them.
//   node tools/roof-test.mjs [--verbose] [--drops=400] [--trace=17]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, resetCar } from '../src/cars/physics.js';
import { roofLevel, dryLevel, pickFromHistory } from '../src/respawn.js';

const verbose = process.argv.includes('--verbose');
const DROPS = +(process.argv.find((a) => a.startsWith('--drops='))?.slice(8) ?? 300);
const TRACE = +(process.argv.find((a) => a.startsWith('--trace='))?.slice(8) ?? -1);   // the steps of one of the cars let go (its number from --verbose)
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
// (the work queue runs on the page's frames: here its jobs are run at once)
writeFileSync(join(dir, 'jobs.mjs'), 'export const jobs = { add(f) { const g = f(); if (g && g.next) for (const _ of g); }, late: () => false };\n');
writeFileSync(join(dir, 'data.mjs'), readFileSync(join(root, 'src/world/data.js'), 'utf8').replace('import.meta.env.BASE_URL', "''").replace("'../jobs.js'", "'./jobs.mjs'").replace("'../cars/tops.js'", `'${pathToFileURL(join(root, 'src/cars/tops.js')).href}'`));
const { loadWorldData } = await import(pathToFileURL(join(dir, 'data.mjs')));
const world = await loadWorldData();
await world.loadAround(1100, 2600, 1000);
const spec = Object.values(CARS)[0];
const built = () => { let n = 0, bytes = 0; for (const s of world.sectors.values()) if (s.rtris) { n++; bytes += s.rtris.start.byteLength + s.rtris.refs.byteLength; } return { n, bytes }; };
const over = (car) => car.y - world.heightAt(car.x, car.z);
const finite = (car) => [car.x, car.z, car.y, car.pitch, car.roll, car.vx, car.vy, car.yaw].every(Number.isFinite);
// a driver that holds a speed (km/h), with all the throttle a slope asks for
const hold = (car, kmh) => ({ up: Math.max(0, Math.min(1, (kmh / 3.6 + 0.3 - car.vx) * 0.4)) });

// ---- 1. the street: a car that stays down never asks for a roof, and a house is the wall it was
{
  let asked = 0, entered = 0, n = 0, flew = 0;
  let seed = 5; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 0; k < 40; k++) {
    let x, z;
    do { x = 500 + rnd() * 1200; z = 2100 + rnd() * 1000; } while (world.sdfAt(x, z) < 3 || world.surfaceAt(x, z) === 4);
    world.sdfGrad(x, z, [0, 0]);
    const g = world.sdfGrad(x, z, [0, 0]), yaw = Math.atan2(-g[0], g[1]);          // towards the nearest wall
    const car = createCar(spec, { x, z, yaw, y: world.heightAt(x, z) });
    car.vx = 12;
    let inHouse = false;
    // (a car that goes off a bank or a wall some metres high on its way is in the air like any other, and the roofs
    // of its map square are asked for ahead)
    let air = 0;
    for (let t = 0; t < 4; t += dt) {
      stepCar(car, hold(car, 45), world, dt);
      if (world.sdfAt(car.x, car.z) < -0.2) inHouse = true;
      const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw);
      for (const [f, r] of [[1.4, 0.8], [1.4, -0.8], [-1.4, 0.8], [-1.4, -0.8]]) air = Math.max(air, car.y - world.heightAt(car.x + fx * f - fz * r, car.z + fz * f + fx * r));
    }
    n++; if (inHouse) entered++; if (air > 2.2) flew++;
  }
  asked = built().n;
  check(asked <= flew, 'forty cars driven at the nearest wall along the street: no roof was looked up, nothing was made for it', `${asked} map squares with a roof grid, ${flew} of the cars went off a drop of over 2 m on the way`);
  check(entered === 0, '...and none of them got into a house', `${entered} of ${n}`);
}

// ---- 2. a flat roof 4.9 m up (Tähe 4's yard side): down on it, off it on every side
{
  const C = [538, 2984.3], roof = world.roofTop(C[0], C[1]), base = world.heightAt(C[0], C[1]);
  check(roof - base > 4 && roof - base < 6, 'the test roof is where the map had it', `${(roof - base).toFixed(1)} m over the ground`);
  const car = createCar(spec, { x: C[0], z: C[1], yaw: 0.3, y: roof + 2 });
  car.airborne = true;
  let low = Infinity;
  for (let t = 0; t < 3; t += dt) { stepCar(car, {}, world, dt); low = Math.min(low, car.y - roof); }
  check(Math.abs(car.y - roof) < 0.05 && low > -0.25 && !car.airborne, 'a car let go 2 m over the roof comes down on it and stands', `${(car.y - roof).toFixed(2)} m over the roof at rest, lowest ${low.toFixed(2)}`);
  check(world.surfaceAt(car.x, car.z, car.hy + 0.4) === 1, '...on paving, for its tyres, marks and smoke');
  check(world.groundAt(car.x, car.z, base + 0.4) === base, '...while for a car down at the ground the same spot is the ground');
  check(roofLevel(world, car) !== null && dryLevel(world, car) === null, '...and the spot is one R can put a car back on', 'a roof spot, not a street spot');
  const b = built();
  check(b.n >= 1 && b.n <= 4 && b.bytes / b.n < 120e3, 'the roofs of that map square were put in a grid then, and it is small', `${b.n} square${b.n > 1 ? 's' : ''}, ${(b.bytes / b.n / 1024).toFixed(0)} KB each`);
  for (const [name, yaw] of [['north', 0], ['east', Math.PI / 2], ['south', Math.PI], ['west', -Math.PI / 2]]) {
    for (const kmh of [15, 90]) {
      const c = createCar(spec, { x: C[0], z: C[1], yaw, y: roof });
      c.vx = kmh / 3.6;
      let tip = false, put = 0, px = c.x, pz = c.z, left = null, down = null, nose = 0, sunk = 0, ok = true, up = 0;
      for (let t = 0; t < 20 && ok; t += dt) {
        stepCar(c, hold(c, kmh), world, dt);
        ok = finite(c);
        // (put somewhere at once: up at the roof anything over a hand's width, down at the street what no trunk or kerb does)
        { const mv = Math.hypot(c.x - px, c.z - pz) - Math.hypot(c.vx, c.vy) * dt; put = Math.max(put, over(c) > 1 ? mv : mv - 0.25); px = c.x; pz = c.z; }
        if (c.tip) tip = true;
        up = Math.max(up, c.vyUp);
        const g = world.groundAt(c.x, c.z, c.y + 0.4);
        if (left === null && g < roof - 1.5 && c.y < roof - 1) { left = t; nose = c.pitch; }
        if (left === null) sunk = Math.max(sunk, g - c.y);
        if (left !== null && down === null && !c.airborne && !c.tip && over(c) < 0.5) down = t;
        if (down !== null && t > down + 1.5) break;
      }
      const d = `left the roof ${left === null ? 'never' : 'at ' + left.toFixed(1) + ' s'}, nose ${(nose * DEG).toFixed(0)} deg then, moved ${put.toFixed(2)} m at once at most, ${up.toFixed(1)} m/s up at most, ${down === null ? 'not down' : 'down'}, ${over(c).toFixed(2)} m over the ground, ${world.sdfAt(c.x, c.z).toFixed(1)} m from a wall`;
      check(ok && left !== null && down !== null && put < 0.12 + kmh / 3.6 * dt && over(c) < 0.3 && world.sdfAt(c.x, c.z) > 0 && up < 2.5 + 0.25 * kmh / 3.6,      // (a hump in the street throws a fast car a little, as on main)
        `off the ${name} side at ${kmh} km/h: over the edge, down beside the house and out of its wall, never thrown or put elsewhere`, d);
      if (kmh === 15) check(tip, `...at 15 km/h it tips over the roof's edge`, d);
    }
  }
}

// ---- 3. a wall between two roofs: the higher part of the house stops a car on the lower one
// (Kaubamaja's block in the map; the game draws that house by hand, and the roofs driven on there are still the map's)
{
  const C = [1744.4, 3057.8], roof = world.roofTop(C[0], C[1]);
  for (const kmh of [15, 60]) {
    const car = createCar(spec, { x: C[0], z: C[1], yaw: -Math.PI / 2, y: roof });      // west: 28 m on, the next part is 6 m higher
    car.vx = kmh / 3.6;
    let hit = 0, far = 0, high = 0, put = 0, px = car.x, pz = car.z;
    for (let t = 0; t < 8; t += dt) {
      stepCar(car, hold(car, kmh), world, dt);
      hit = Math.max(hit, car.hit || 0); far = Math.max(far, C[0] - car.x); high = Math.max(high, car.y - roof);
      put = Math.max(put, Math.hypot(car.x - px, car.z - pz) - Math.hypot(car.vx, car.vy) * dt); px = car.x; pz = car.z;
    }
    check(hit > 1 && far < 28 && high < 0.5 && Math.abs(car.y - roof) < 0.4 && put < 0.1, `a wall 6 m higher met at ${kmh} km/h on a roof: the car is stopped by it and stays on its roof`, `hit at ${hit.toFixed(1)} m/s, got ${far.toFixed(1)} m, ${(car.y - roof).toFixed(2)} m over its roof at the end`);
  }
}

// ---- 4. a pitched roof: the car lies as the roof does, and its floor rests on the ridge
{
  // the ridge of a 23 degree roof runs north to south here; the car is put on its east side, facing north
  const R = [712, 2810];
  const top = world.roofTop(R[0], R[1]), side = world.roofTop(R[0] + 3, R[1]);
  const slope = Math.atan2(top - side, 3);
  check(slope > 15 / DEG && slope < 30 / DEG, 'the pitched roof is where the map had it', `${(slope * DEG).toFixed(0)} degrees`);
  const car = createCar(spec, { x: R[0] + 3, z: R[1], yaw: 0, y: side + 0.3 });
  for (let t = 0; t < 1.2; t += dt) stepCar(car, { down: 1, handbrake: true }, world, dt);
  check(Math.abs(Math.abs(car.roll) - slope) < 5 / DEG && Math.abs(car.pitch) < 5 / DEG && Math.abs(car.y - world.roofTop(car.x, car.z)) < 0.25, 'a car set on its side leans as the roof does', `leans ${(car.roll * DEG).toFixed(0)} deg on a ${(slope * DEG).toFixed(0)} deg roof, nose ${(car.pitch * DEG).toFixed(0)} deg`);
  // over the ridge, west to east, at 25 and at 45 km/h (from a crawl this car's tyres do not take it up a roof this
  // steep, as they would not up such a hill), and set down a little over the roof, where it must not take the roof
  // rising ahead of it for a wall
  for (const kmh of [25, 45]) {
    const c = createCar(spec, { x: R[0] - 5, z: R[1], yaw: Math.PI / 2, y: world.roofTop(R[0] - 5, R[1]) + 0.2 });
    c.vx = kmh / 3.6;
    let sunk = 0, crossed = false, ok = true, up = 0, hit = 0;
    for (let t = 0; t < 6 && ok; t += dt) {
      stepCar(c, hold(c, kmh), world, dt);
      ok = finite(c);
      if (c.x > R[0] + 2) crossed = true;
      if (c.x < R[0] + 2) { up = Math.max(up, c.vyUp); hit = Math.max(hit, c.hit || 0); }
      if (Math.abs(c.x - R[0]) < 2.5) sunk = Math.max(sunk, world.roofTop(c.x, c.z) - c.y);
    }
    check(ok && crossed && sunk < 0.35 && hit < 0.5 && up < kmh / 3.6 * 0.5 + 2.5, `over the ridge at ${kmh} km/h: up the roof, across, its floor not through the ridge`, `${sunk.toFixed(2)} m below the roof under its middle at most, ${up.toFixed(1)} m/s up at most, hit ${hit.toFixed(1)} m/s`);
  }
}

// ---- 5. a light well: a yard of 3 m inside a block, which the distance field has as house, is closed
{
  const P = [1300.8, 2598.6];
  const t = world.heightAt(P[0], P[1]), lid = world.roofTop(P[0], P[1]);
  check(world.sdfAt(P[0], P[1]) < -2 && lid - t > 8, 'a light well deep inside a block has a lid as high as the roofs round it', `${(lid - t).toFixed(1)} m over its floor`);
  const car = createCar(spec, { x: P[0], z: P[1], yaw: 0.1, y: lid + 1.5 });
  car.airborne = true;
  let low = Infinity;
  for (let k = 0; k < 4 / dt; k++) { stepCar(car, {}, world, dt); low = Math.min(low, over(car)); }
  check(low > 6, '...and a car let go over it does not end up inside the house', `lowest ${low.toFixed(1)} m over the ground`);
}

// ---- 5b. a yard between houses with its floor in the map (34 m by 8, the distance field has it as house): left
// open. A car comes down into it, drives there, and the houses round it are its walls.
{
  const P = [975, 2850];
  const t = world.heightAt(P[0], P[1]);
  check(world.sdfAt(P[0], P[1]) < -2 && Math.abs(world.roofTop(P[0], P[1]) - t) < 0.3, 'a yard with a floor to drive on has no lid', `its floor ${(world.roofTop(P[0], P[1]) - t).toFixed(2)} m over the ground, ${(-world.sdfAt(P[0], P[1])).toFixed(1)} m inside the outline`);
  const car = createCar(spec, { x: P[0], z: P[1], yaw: 1.2, y: t + 22 });
  car.airborne = true;
  let hit = 0, put = 0, px = car.x, pz = car.z, far = 0, up = 0, ok = true;
  for (let k = 0; k < 12 / dt && ok; k++) {
    stepCar(car, k * dt < 4 ? {} : hold(car, 25), world, dt);
    ok = finite(car);
    put = Math.max(put, Math.hypot(car.x - px, car.z - pz) - Math.hypot(car.vx, car.vy) * dt); px = car.x; pz = car.z;
    if (k * dt > 3) { hit = Math.max(hit, car.hit || 0); far = Math.max(far, Math.hypot(car.x - P[0], car.z - P[1])); up = Math.max(up, Math.abs(over(car))); }
  }
  check(ok && far > 8 && far < 20 && hit > 1 && up < 0.3 && put < 0.1, '...a car let go over it comes down to its floor, drives there and is stopped by the houses round it', `drove ${far.toFixed(1)} m from where it came down, hit a wall at ${hit.toFixed(1)} m/s, ${up.toFixed(2)} m off the floor at most, moved ${put.toFixed(2)} m at once at most`);
}

// ---- 6. trees: solid as high as their trunk and boughs go, flown through above that
{
  const T = [1405.5, 2304.5], out = [], tops = [];
  world.trunksNear(T[0], T[1], 1, out, tops);
  const base = world.heightAt(T[0], T[1]), solid = tops[0] - base;
  check(out.length === 3 && solid > 10, 'the test tree stands alone and is tall', `solid to ${solid.toFixed(1)} m`);
  for (const [h, through] of [[0, false], [solid - 2, false], [solid + 1.2, true]]) {
    const car = createCar(spec, { x: T[0] - 6, z: T[1], yaw: Math.PI / 2, y: base + h });
    car.vx = 20; if (h > 0) { car.airborne = true; car.vyUp = 2; }
    let hit = 0;
    for (let t = 0; t < 0.45; t += dt) { stepCar(car, {}, world, dt); hit = Math.max(hit, car.hit || 0); }
    check(through ? hit === 0 && car.x > T[0] + 1 : hit > 5 && car.x < T[0], `a car ${h === 0 ? 'on the ground' : `${h.toFixed(0)} m up`} at 72 km/h: ${through ? 'through the top of the tree' : 'stopped by the tree'}`, `hit ${hit.toFixed(1)} m/s, ${(car.x - T[0]).toFixed(1)} m past it`);
  }
}

// ---- 7. R: a spot on the roof first, with the street spots older than it left for after
{
  const C = [538, 2984.3], roof = world.roofTop(C[0], C[1]);
  const edge = { x: C[0], z: C[1] - 12.5, yaw: 0, y: roof };
  check(roofLevel(world, edge) === null, 'a car hanging over the roof\'s edge is not a spot to be put back on');
  const street = { x: 539.6, z: 2952.7, yaw: 0, y: world.heightAt(539.6, 2952.7), t: 1 };
  const history = [street, { x: C[0], z: C[1], yaw: 0, y: roof, t: 5, roof: true }, { x: C[0], z: C[1] - 3, yaw: 0, y: roof, t: 9.5, roof: true }];
  const a = pickFromHistory(world, history, { ref: 10, sx: C[0], sz: C[1] - 6, minAge: 3 });
  check(a && a.roof && a.t === 5 && Math.abs(a.y - roof) < 0.05, 'R on the roof: the newest spot on it that is three seconds old', a ? `put at ${(a.y - world.heightAt(a.x, a.z)).toFixed(1)} m` : 'none');
  const car = createCar(spec, { x: 0, z: 0, yaw: 0, y: 0 });
  resetCar(car, a);
  for (let t = 0; t < 1; t += dt) stepCar(car, {}, world, dt);
  check(Math.abs(car.y - roof) < 0.05, '...and a car put there stands on the roof', `${(car.y - roof).toFixed(2)} m over it`);
  const b = pickFromHistory(world, history, { ref: 10, sx: C[0], sz: C[1], minAge: 3 });
  check(b && !b.roof && b.t === 1, '...the spot before that is the street it came from');
}

// ---- 8. cars let go over roofs all over the centre, standing and at up to 130 km/h
{
  let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const res = { nan: 0, put: 0, thrown: 0, inside: 0, under: 0, onRoof: 0, onGround: 0 };
  let worst = '';
  for (let k = 0; k < DROPS; k++) {
    let x, z, roof;
    do { x = 400 + rnd() * 1400; z = 2000 + rnd() * 1200; roof = world.roofTop(x, z); } while (roof < -1e8 || roof - world.heightAt(x, z) < 2.5);
    const yaw = rnd() * 6.283, kmh = [0, 10, 25, 45, 80, 130][Math.floor(rnd() * 6)];
    const car = createCar(spec, { x, z, yaw, y: roof + 1.5 });
    car.vx = kmh / 3.6; car.airborne = true;
    let px = car.x, pz = car.z, py = car.y, put = 0, ok = true, under = 0, thrown = 0, how = '', pace = 0;
    const log = k === TRACE ? [] : null; let logAt = 0;
    for (let t = 0; t < 12 && ok; t += dt) {
      stepCar(car, hold(car, kmh), world, dt);
      ok = finite(car);
      {
        // (put somewhere at once: sideways beyond its own pace, or upwards beyond its own; down at the street a trunk
        // or a kerb puts a car clear of itself by a hand's width or two, as on main)
        const side = Math.hypot(car.x - px, car.z - pz) - Math.hypot(car.vx, car.vy) * dt - kmh / 3.6 * dt * 1.2 - (over(car) > 1 ? 0 : 0.25);
        const lift = car.y - py - Math.abs(car.vyUp) * dt - 0.2;
        if (log) { const g = world.heightAt(car.x, car.z); log.push(`${t.toFixed(3)} x ${car.x.toFixed(2)} z ${car.z.toFixed(2)} y ${(car.y - g).toFixed(2)} (${(car.y - py).toFixed(3)}) v ${car.vx.toFixed(1)},${car.vy.toFixed(1)} up ${car.vyUp.toFixed(1)} pitch ${(car.pitch * DEG).toFixed(0)} roll ${(car.roll * DEG).toFixed(0)} ground ${(car.groundPitch * DEG).toFixed(0)},${(car.groundRoll * DEG).toFixed(0)} wheels ${[0, 3, 6, 9, 12].map((o) => (car.roofG[o] - g).toFixed(2)).join(' ')} rise ${(car.rise || 0).toFixed(2)}${car.airborne ? ' air' : ''}${car.tip ? ' tip' : ''}${car.tipped ? ' tipped' : ''}${car.onHigh ? ' high' : ''} hit ${(car.hit || 0).toFixed(1)}`); }
        if (log && (Math.max(side, lift) > Math.max(put, 0.12) || car.vyUp - 4.5 - 0.6 * pace > thrown || over(car) < Math.min(under, -0.7))) logAt = log.length;
        if (Math.max(side, lift) > put) { put = Math.max(side, lift); how = `${side > lift ? 'sideways' : 'upwards'} at ${t.toFixed(2)} s, ${over(car).toFixed(1)} m up${car.tip ? ', tipping' : ''}${car.tipped ? ', tipped' : ''}${car.airborne ? ', in the air' : ''}`; }
        px = car.x; pz = car.z; py = car.y;
      }
      under = Math.min(under, over(car));
      // (thrown up: faster upwards than any roof it could have run up at its pace)
      // (its pace: the fastest of the last second, so a car going up that meets a wall is not counted)
      pace = Math.max(Math.hypot(car.vx, car.vy), pace - 40 * dt);
      thrown = Math.max(thrown, car.vyUp - 4.5 - 0.6 * pace);
    }
    if (log) console.log(log.slice(Math.max(0, logAt - 16), logAt + 4).join('\n'));
    const up = over(car), d = world.sdfAt(car.x, car.z), top = world.roofTop(car.x, car.z);
    const inside = up < 1 && d < -0.5 && top > car.y + 1.5;
    const bad = !ok ? 'not a number' : put > 0.12 ? `moved ${put.toFixed(2)} m at once (${how})` : thrown > 0 ? 'thrown upwards' : inside ? 'down inside a house' : under < -0.7 ? `${(-under).toFixed(1)} m under the ground` : '';
    if (!ok) res.nan++; else if (put > 0.12) res.put++; else if (thrown > 0) res.thrown++; else if (inside) res.inside++; else if (under < -0.7) res.under++;
    if (up > 1.5) res.onRoof++; else res.onGround++;
    if (bad && !worst) worst = `${bad}: let go over (${x.toFixed(1)}, ${z.toFixed(1)}) heading ${(yaw * DEG).toFixed(0)} at ${kmh} km/h`;
    if (bad && verbose) console.log(`     ${k}: ${bad}: (${x.toFixed(1)}, ${z.toFixed(1)}) heading ${(yaw * DEG).toFixed(0)} at ${kmh} km/h`);
  }
  const badN = res.nan + res.put + res.thrown + res.inside + res.under;
  check(res.nan === 0, `${DROPS} cars let go over roofs in the centre: every one stays a car`, `${res.nan} not a number`);
  check(badN <= DROPS * 0.02, '...at most 2 in 100 are moved at once, thrown up, or end inside a house or under the ground', `${badN}: ${res.put} moved, ${res.thrown} thrown, ${res.inside} inside, ${res.under} under${worst ? '; first: ' + worst : ''}`);
  check(res.onRoof > DROPS * 0.1 && res.onGround > DROPS * 0.3, '...some stay up on the roofs, most find their way down', `${res.onRoof} on a roof after 12 s, ${res.onGround} on the ground`);
  const b = built();
  check(b.bytes / b.n < 100e3, 'the roof grids of the whole centre', `${b.n} map squares, ${(b.bytes / 1024).toFixed(0)} KB together, ${(b.bytes / b.n / 1024).toFixed(0)} KB each`);
}

console.log(`${checks - fails} of ${checks} checks passed`);
process.exit(fails ? 1 : 0);
