// Overpass and tunnel check on the real map: node tools/overpass-test.mjs [--drive] [x z radius]
//
// Part 1 walks every road that passes over, under or beside a deck (bridge span, walled ramp, tunnel
// lid) half a metre at a time, on its centre line and 1.2 m to both sides, keeping the height a car
// would have. It reports a step in the ground (a missing deck, a deck end that hangs in the air, a
// trench across the road), a solid obstacle or a railing across the road.
// Part 2 (--drive) drives a real car at 50 km/h over and under each long structure and reports
// where it lost speed, left the ground or ended up off its line.
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
// data.js is written for the browser bundle: give it a base path
const dir = mkdtempSync(join(tmpdir(), 'lr-'));
// (data.js hands long work to the page's work queue, src/jobs.js: here its jobs are run at once)
writeFileSync(join(dir, 'jobs.mjs'), 'export const jobs = { add(f) { const g = f(); if (g && g.next) for (const _ of g); }, late: () => false };\n');
writeFileSync(join(dir, 'data.mjs'), readFileSync(join(root, 'src/world/data.js'), 'utf8').replace('import.meta.env.BASE_URL', "''").replace("'../jobs.js'", "'./jobs.mjs'").replace("'../cars/tops.js'", `'${pathToFileURL(join(root, 'src/cars/tops.js')).href}'`));
const { loadWorldData } = await import(pathToFileURL(join(dir, 'data.mjs')));
const world = await loadWorldData();

const args = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number);
const only = args.length === 3 ? args : null;
const near = (x, z) => !only || Math.hypot(x - only[0], z - only[1]) < only[2];
const DRIVABLE = (r) => r.type !== 'Rada' && r.type !== 'Kergliiklustee';

function resample(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(l / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, (b[0] - a[0]) / (l || 1), (b[1] - a[1]) / (l || 1)]);
  }
  return out;
}

// ---- part 1: geometry along every road near a deck
const decks = world.decks;
// (and near every road the map data has in a tunnel or on a bridge, deck or not)
const marked = world.vectors.roads.filter((r) => r.e).flatMap((r) => r.pts);
const cell = new Set(marked.map((p) => `${Math.round(p[0] / 60)}_${Math.round(p[1] / 60)}`));
const nearMarked = (p) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (cell.has(`${Math.round(p[0] / 60) + i}_${Math.round(p[1] / 60) + j}`)) return true; return false; };
const nearDeck = (r) => r.pts.some((p) => nearMarked(p) || decks.some((d) => p[0] > d.x0 - 60 && p[0] < d.x1 + 60 && p[1] > d.z0 - 60 && p[1] < d.z1 + 60));
const roads = world.vectors.roads.filter((r) => r.pts.length > 1 && nearDeck(r) && r.pts.some((p) => near(p[0], p[1])));
const sectorsNeeded = new Map();
for (const r of roads) for (const p of r.pts) sectorsNeeded.set(`${Math.floor((p[0] + 800) / 640)}_${Math.floor((p[1] + 800) / 640)}`, p);
for (const p of sectorsNeeded.values()) await world.loadAround(p[0], p[1], 120);

const out = [0, 0, 0];
const issues = [];
for (const r of roads) {
  const walk = resample(r.pts, 0.5), lv = r.e || 0;
  const hw = Math.min(1.2, Math.max(0, r.w / 2 - 1.2));
  const edge = Math.max(0, r.w / 2 - 0.9);                    // and along both edges of the carriageway
  // (a bridge can be narrower than the road data says, and has railings: no edge walk there)
  for (const off of DRIVABLE(r) ? [...new Set(lv === 1 ? [0, hw, -hw] : [0, hw, -hw, edge, -edge])] : [0]) {
    let y = null, last = null;
    const prof = [];
    for (const [x0, z0, tx, tz] of walk) {
      const x = x0 - tz * off, z = z0 + tx * off;
      if (!world.ready(x, z) || world.sdfAt(x, z) < -3.5) { y = null; prof.length = 0; continue; }          // outside the map
      if (y === null) y = world.topAt(x, z, lv);
      const g = world.groundAt(x, z, y + 0.4);
      const flag = (kind, v) => {
        if (last && last.kind === kind && Math.hypot(x - last.x, z - last.z) < 12) { last.x = x; last.z = z; last.v = Math.max(last.v, v); last.n++; return; }
        last = { kind, x, z, x0: x, z0: z, v, n: 1, road: `${r.type} ${r.name}`.trim(), lv, off };
        issues.push(last);
      };
      if (off !== 0 && world.sdfAt(x, z) < 0.9) { y = null; prof.length = 0; continue; }                    // a wall there: no car gets this far out
      if (Math.abs(g - y) > 0.3) flag(g < y ? 'drop' : 'step up', Math.abs(g - y));
      y = g;
      if (!DRIVABLE(r)) continue;
      // a ditch or a hump with sloping sides has no single step: compare with the road 8 m before and after
      prof.push([x, z, g]);
      if (prof.length > 32) {
        const m = prof[prof.length - 17], dev = m[2] - (prof[prof.length - 33][2] + g) / 2;
        if (Math.abs(dev) > 0.6) { const [sx, sz] = [x, z]; flag(dev < 0 ? 'ditch' : 'hump', Math.abs(dev)); void sx; void sz; }
      }
      if (off === 0 && world.sdfAt(x, z) < 0.6 && world.surfaceAt(x, z) !== 4) flag('obstacle', 0.6 - world.sdfAt(x, z));
      if (off === 0 && world.railPush(x, z, y + 0.4, 0.9, out)) flag('railing', out[2]);
    }
  }
}
// one line per place
const seen = [];
const rows = issues.filter((i) => {
  if (seen.some((s) => s.kind === i.kind && Math.hypot(s.x0 - i.x0, s.z0 - i.z0) < 8)) return false;
  seen.push(i); return true;
});
console.log(`${roads.length} roads near ${decks.length} decks checked`);
for (const i of rows.sort((a, b) => a.x0 - b.x0)) {
  console.log(`${i.kind.padEnd(8)} ${i.v.toFixed(2).padStart(5)} m  at (${i.x0.toFixed(0)}, ${i.z0.toFixed(0)})  ${i.road} level ${i.lv}${i.off ? ' side' : ''}`);
}
console.log(`${rows.length} places to look at`);

// ---- part 2: a real car over and under the long structures
if (process.argv.includes('--drive')) {
  const { CARS } = await import('../src/cars/specs.js');
  const { createCar, stepCar } = await import('../src/cars/physics.js');
  const spec = Object.values(CARS)[0];
  const dt = 1 / 120;
  const drive = (line, y0, label) => {
    const p0 = line[0], yaw = Math.atan2(line[0][2], -line[0][3]);
    const car = createCar(spec, { x: p0[0], z: p0[1], yaw, y: y0 });
    car.vx = 50 / 3.6;
    let k = 0, t = 0, minV = 99, air = 0, worst = 0, where = null;
    while (k < line.length - 8 && t < 120) {
      while (k < line.length - 8 && (line[k][0] - car.x) * line[k][2] + (line[k][1] - car.z) * line[k][3] < 6) k++;       // aim 6 m ahead
      const aim = line[k], want = Math.atan2(aim[0] - car.x, -(aim[1] - car.z));
      let e = want - car.yaw; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
      const v = Math.hypot(car.vx, car.vy);
      stepCar(car, { up: v < 50 / 3.6 ? 0.6 : 0, right: Math.max(0, Math.min(1, e * 2.5)), left: Math.max(0, Math.min(1, -e * 2.5)) }, world, dt);
      t += dt;
      if (t > 1) {
        if (v < minV) { minV = v; where = [car.x, car.z]; }
        if (car.airborne) air += dt;
        const q = line[Math.max(0, k - 12)];
        worst = Math.max(worst, Math.abs((car.x - q[0]) * -q[3] + (car.z - q[1]) * q[2]));
      }
    }
    const done = k >= line.length - 8;
    const bad = !done || minV < 30 / 3.6 || air > 0.25 || worst > 3;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${label.padEnd(52)} slowest ${(minV * 3.6).toFixed(0).padStart(3)} km/h  air ${air.toFixed(2)} s  off line ${worst.toFixed(1)} m${bad && where ? `  near (${where[0].toFixed(0)}, ${where[1].toFixed(0)})` : ''}${done ? '' : '  DID NOT ARRIVE'}`);
    return !bad;
  };
  let fails = 0;
  // over: along each deck and 40 m of road on both sides is covered by part 1; here the deck itself with a run-up
  for (const d of decks) {
    if (d.kind !== 1 || d.wall || d.hw < 3) continue;
    const P = d.pts, mid = P[Math.floor(P.length / 2)];
    if (!near(mid[0], mid[1])) continue;
    const len = P.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]) : 0), 0);
    if (len < 25) continue;
    const line = resample(P.map((p) => [p[0], p[1]]), 1);
    const y0 = P[0][2 + Math.floor((P[0].length - 3) / 2)];
    for (const [ln, lab] of [[line, 'over'], [line.slice().reverse().map((p) => [p[0], p[1], -p[2], -p[3]]), 'over, back']]) {
      if (!drive(ln, ln === line ? y0 : P[P.length - 1][2], `${lab}: ${d.name || 'span'} (${mid[0].toFixed(0)}, ${mid[1].toFixed(0)}) ${len.toFixed(0)} m`)) fails++;
    }
  }
  // under: every drivable road that crosses a span on a lower level
  for (const r of world.vectors.roads) {
    if (!DRIVABLE(r) || r.e === 1 || r.pts.length < 2) continue;
    const line = resample(r.pts, 1);
    if (line.length < 30) continue;
    const under = line.findIndex((p) => decks.some((d) => d.kind === 1 && !d.wall && p[0] > d.x0 && p[0] < d.x1 && p[1] > d.z0 && p[1] < d.z1
      && world.ready(p[0], p[1]) && world.topAt(p[0], p[1], 1) - world.heightAt(p[0], p[1]) > 2.5));
    if (under < 0 || !near(line[under][0], line[under][1])) continue;
    const a = Math.max(0, under - 60), b = Math.min(line.length, under + 80);
    const part = line.slice(a, b);
    if (part.length < 30 || !world.ready(part[0][0], part[0][1])) continue;
    if (!drive(part, world.topAt(part[0][0], part[0][1], 0), `under: ${r.type} ${r.name} (${line[under][0].toFixed(0)}, ${line[under][1].toFixed(0)})`)) fails++;
  }
  console.log(fails ? `${fails} drives failed` : 'all drives fine');
}
