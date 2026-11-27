// The Roadster Rocket in the water, on the real map (src/cars/swim.js): node tools/rocket-swim-test.mjs [count] [--v]
//
// At shore points along the Emajõgi and the deeper ponds a car is put down in the water 14 m out, facing the
// shore, and left to go down. Then: BOOST held, the wheel turned towards the shore, must bring it up the bank and
// out onto land within 12 s; the fans' crawl on the motors alone within 25 s; with the fans off and no BOOST it
// stays in. An ordinary car, and the Rocket where BOOST is off (a timed run), sink as before; a Rocket left alone
// has sunk (GLUB) after its few seconds, and BOOST brings it up again.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const { CARS } = await import('../src/cars/specs.js');
const { createCar, stepCar } = await import('../src/cars/physics.js');
const { refillTank } = await import('../src/cars/thrust.js');
const WATER = 4;
const verbose = process.argv.includes('--v');

// pond levels as src/world/scenery.js gives them to the physics
const inside = (ring, x, z) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
};
const ponds = [];
for (const w of world.vectors.water) {
  if (w.river) continue;
  for (const p of w.polys) {
    const xs = p.outer.map((q) => q[0]), zs = p.outer.map((q) => q[1]);
    ponds.push({ minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), level: w.level, ring: p.outer });
  }
}
world.waterLevelAt = (x, z) => {
  let near = null;
  for (const p of ponds) {
    if (x < p.minX - 2 || x > p.maxX + 2 || z < p.minZ - 2 || z > p.maxZ + 2) continue;
    if (inside(p.ring, x, z)) return p.level;
    near = near || p;
  }
  if (near && Math.abs(world.heightAt(x, z) - near.level) < Math.abs(world.heightAt(x, z) - world.meta.riverLevel)) return near.level;
  return world.meta.riverLevel;
};

const dt = 1 / 60;
const yawTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, -(z1 - z0));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
let ok = true;
const check = (name, pass, detail = '') => { ok &&= !!pass; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

// shore points with deep water off them and dry land behind them
const count = Number(process.argv[2]) || 40;
const cand = [];
let acc = 0;
for (const w of world.vectors.water) for (const p of w.polys) {
  const R = p.outer;
  for (let i = 0; i < R.length - 1; i++) {
    const dx = R[i + 1][0] - R[i][0], dz = R[i + 1][1] - R[i][1], l = Math.hypot(dx, dz);
    acc += l;
    if (acc > 90 && l > 0) { acc = 0; cand.push([R[i][0] + dx / 2, R[i][1] + dz / 2, -dz / l, dx / l, w.river ? 'river' : 'pond']); }
  }
}
const spots = [], why = { ok: 0, shallow: 0, built: 0, narrow: 0 };
for (let k = 0; k < cand.length; k++) {
  let [x, z, nx, nz, kind] = cand[k];
  await world.loadAround(x, z, 60);
  if (world.surfaceAt(x + nx * 8, z + nz * 8) !== WATER) { nx = -nx; nz = -nz; }
  let wet = true, dry = true;
  for (let d = 4; d <= 20; d += 2) if (world.surfaceAt(x + nx * d, z + nz * d) !== WATER) wet = false;
  for (let d = 0; d <= 9; d += 1.5) if ((d >= 3 && world.surfaceAt(x - nx * d, z - nz * d) === WATER) || world.sdfAt(x - nx * d, z - nz * d) < 1.5) dry = false;
  const wl = world.waterLevelAt(x + nx * 14, z + nz * 14);
  const deep = wl - world.heightAt(x + nx * 14, z + nz * 14) > 1.5;
  why[wet ? dry ? deep ? 'ok' : 'shallow' : 'built' : 'narrow']++;
  if (wet && dry && deep) spots.push({ x, z, nx, nz, kind, wl });
}
if (verbose) console.log(cand.length, 'shore points', why);
const pick = [];
for (let k = 0, m = Math.min(count, spots.length); k < m; k++) pick.push(spots[Math.floor((k + 0.5) * spots.length / m)]);

// a car put down 14 m out, facing the shore, left to go down for `wait` s; then `drive` for up to `T` s
function run(spec, sp, drive, T, wait = 3, setup) {
  if (spec.thrusters) refillTank(spec.id);
  const sx = sp.x + sp.nx * 14, sz = sp.z + sp.nz * 14;
  const tx = sp.x - sp.nx * 10, tz = sp.z - sp.nz * 10;
  const car = createCar(spec, { x: sx, z: sz, yaw: yawTo(sx, sz, tx, tz), y: sp.wl });
  if (setup) setup(car);
  let was = false, out = null, sunkAt = null, t = 0, deepest = Infinity;
  for (; t < wait; t += dt) { stepCar(car, { fans: true }, world, dt); was ||= car.inWater; deepest = Math.min(deepest, car.y); if (car.sunk && sunkAt === null) sunkAt = t; }
  for (; t < wait + T; t += dt) {
    const e = wrap(yawTo(car.x, car.z, tx, tz) - car.yaw);
    // (BOOST let go once out on land)
    stepCar(car, { ...(out ? { up: drive.up } : drive), steer: Math.max(-1, Math.min(1, e * 2)) }, world, dt);
    was ||= car.inWater;
    if (car.sunk && sunkAt === null) sunkAt = t;
    if (was && !car.inWater && out === null) out = { t: t - wait, kmh: Math.hypot(car.vx, car.vy) * 3.6, jump: car.y - deepest };
    if (out && t - wait > out.t + 1.5) break;
  }
  const land = !car.inWater && world.surfaceAt(car.x, car.z, car.y) !== WATER;
  return { car, was, out, land, sunkAt, deepest, back: (car.x - sp.x) * -sp.nx + (car.z - sp.z) * -sp.nz };
}

const rocket = CARS.rocket, plain = CARS.w201 || Object.values(CARS).find((c) => !c.thrusters);
let boostOut = 0, crawlOut = 0, idleIn = 0, n = 0, worstT = 0, worstCrawl = 0;
const bad = [];
for (const sp of pick) {
  n++;
  const label = `${sp.kind} (${sp.x.toFixed(0)}, ${sp.z.toFixed(0)}) ${(sp.wl - world.heightAt(sp.x + sp.nx * 14, sp.z + sp.nz * 14)).toFixed(1)} m deep`;
  // (BOOST with the gas held, as a player would: with a 7 s tank since 27 Nov, BOOST alone ran dry 2 m down in one spot)
  const b = run(rocket, sp, { boost: 1, up: 1 }, 12);
  if (b.out && b.land) { boostOut++; worstT = Math.max(worstT, b.out.t); } else bad.push(`BOOST did not bring it out: ${label}`);
  const c = run(rocket, sp, { up: 1 }, 25);
  if (c.out && c.land) { crawlOut++; worstCrawl = Math.max(worstCrawl, c.out.t); } else bad.push(`the fans' crawl did not bring it out: ${label}`);
  const i = run(rocket, sp, {}, 8, 3, (car) => { car.fanOff = true; });
  if (i.car.inWater) idleIn++; else bad.push(`left alone with the fans off it came out: ${label}`);
  if (verbose) console.log(`${label}: BOOST ${b.out ? `out in ${b.out.t.toFixed(1)} s at ${b.out.kmh.toFixed(0)} km/h, ${b.back.toFixed(1)} m up the shore` : 'IN'}; crawl ${c.out ? `${c.out.t.toFixed(1)} s` : 'IN'}`);
}
for (const l of bad) console.log(l);
check(`BOOST and gas towards the shore bring the Rocket up the bank and onto land (${n} places)`, boostOut === n, `${boostOut}/${n}, slowest ${worstT.toFixed(1)} s`);
check('...and so does the fans\' crawl on the motors alone', crawlOut === n, `${crawlOut}/${n}, slowest ${worstCrawl.toFixed(1)} s`);
check('...with the fans off and nothing pressed it stays in the water', idleIn === n, `${idleIn}/${n}`);

{
  const sp = pick[0];
  const p = run(plain, sp, { up: 1 }, 10);
  check('an ordinary car floored in the water sinks and stays in, as before', p.car.inWater && p.car.sunk && !p.out);
  const t = run(rocket, sp, { boost: 1, boostOff: true }, 10);
  check('the Rocket with BOOST off (a timed run) sinks as any car', t.car.inWater && t.car.sunk && !t.out && t.car.thrustN === 0);
  const f = run(rocket, sp, { boost: 1, flip: 1 }, 2, 3);
  check('no kickflip from the water', !f.car.rocket.flight && !f.car.rocket.launched);
  const s = run(rocket, sp, {}, 4, 3);
  check('a Rocket left alone in the water has sunk after a few seconds (GLUB)', s.car.sunk && s.sunkAt > 3.5, `at ${s.sunkAt?.toFixed(1)} s`);
  for (let k = 0; k < 10; k++) stepCar(s.car, { boost: 1 }, world, dt);
  check('...and BOOST brings it up again', !s.car.sunk);
  // speed under water on a full tank
  const v = run(rocket, sp, { boost: 1 }, 0.8, 3, (car) => { car.yaw += Math.PI; });
  check('under water BOOST is a slow push: about 20 km/h on a full tank', Math.hypot(v.car.vx, v.car.vy) * 3.6 < 30 && Math.hypot(v.car.vx, v.car.vy) * 3.6 > 12, `${(Math.hypot(v.car.vx, v.car.vy) * 3.6).toFixed(0)} km/h after 0.8 s`);
}
console.log(ok ? 'all ok' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
