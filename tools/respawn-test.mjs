// Back-on-dry-land check on the real map: node tools/respawn-test.mjs [count]
//
// Part 1 drives a car into the river or a pond from many places along the shores, remembering safe
// spots the way the game does (src/main.js), lets it sink and presses R: once with the old rule (the
// newest spot at least 3 s old) and once with src/respawn.js. Each time the car is left standing for
// 6 s; it FAILs when it is in the water again, or was put down with water under or right next to it.
// Part 2 puts a car on every bridge deck over water the way a respawn does and checks it stays on top.
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
// (data.js hands long work to the page's work queue, src/jobs.js: here its jobs are run at once)
writeFileSync(join(dir, 'jobs.mjs'), 'export const jobs = { add(f) { const g = f(); if (g && g.next) for (const _ of g); }, late: () => false };\n');
writeFileSync(join(dir, 'data.mjs'), readFileSync(join(root, 'src/world/data.js'), 'utf8').replace('import.meta.env.BASE_URL', "''").replace("'../jobs.js'", "'./jobs.mjs'"));
const { loadWorldData } = await import(pathToFileURL(join(dir, 'data.mjs')));
const world = await loadWorldData();
const { CARS } = await import('../src/cars/specs.js');
const { createCar, stepCar, resetCar } = await import('../src/cars/physics.js');
const { pickFromHistory, searchDry, dryLevel } = await import('../src/respawn.js');
const WATER = 4;

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

// nearest drivable street, as the city map has it (src/bigmap.js)
const PATH = new Set(['Rada', 'Kergliiklustee']);
const roads = world.vectors.roads.filter((r) => !PATH.has(r.type) && r.pts.length > 1);
const boxes = roads.map((r) => { const xs = r.pts.map((p) => p[0]), zs = r.pts.map((p) => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; });
function nearestRoad(x, z, maxD = 80) {
  let best = maxD, hit = null;
  roads.forEach((r, i) => {
    const b = boxes[i];
    if (x < b[0] - best || x > b[1] + best || z < b[2] - best || z > b[3] + best) return;
    for (let j = 0; j < r.pts.length - 1; j++) {
      const [x0, z0] = r.pts[j], [x1, z1] = r.pts[j + 1];
      const dx = x1 - x0, dz = z1 - z0;
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(x - x0 - dx * t, z - z0 - dz * t);
      if (d < best) { best = d; hit = { x: x0 + dx * t, z: z0 + dz * t, yaw: Math.atan2(dx, -dz), d, w: r.w, name: r.name, e: r.e || 0 }; }
    }
  });
  return hit;
}

const spec = CARS.w201 || Object.values(CARS)[0];
const dt = 1 / 60;
const yawTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, -(z1 - z0));
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// shore points: along every water outline (river and ponds), one every ~120 m
const count = Number(process.argv[2]) || 120;
const shore = [];
let acc = 0;
for (const w of world.vectors.water) {
  for (const p of w.polys) {
    const R = p.outer;
    for (let i = 0; i < R.length - 1; i++) {
      const l = Math.hypot(R[i + 1][0] - R[i][0], R[i + 1][1] - R[i][1]);
      acc += l;
      if (acc > 120) { acc = 0; shore.push([R[i][0], R[i][1], w.river ? 'river' : 'pond']); }
    }
  }
}
// spread the sample over the whole list
const pick = [];
for (let k = 0; k < count && shore.length; k++) pick.push(shore[Math.floor((k + 0.5) * shore.length / count)]);

// the game's oldest rule, for comparison
function oldPick(history, now) {
  const h = history.slice();
  let p = null;
  while (h.length) {
    const e = h[h.length - 1];
    if (now - e.t >= 3 || h.length === 1) { p = e; break; }
    h.pop();
  }
  return p;
}

// leave the car standing at pose for 6 s: { wet, nearWater }
function standAt(pose) {
  const car = createCar(spec, pose);
  resetCar(car, pose);
  let wet = false;
  for (let t = 0; t < 6; t += dt) { stepCar(car, {}, world, dt); if (car.inWater) wet = true; }
  let near = world.surfaceAt(pose.x, pose.z, pose.y) === WATER;
  const fx = Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), rx = Math.cos(pose.yaw), rz = Math.sin(pose.yaw);
  for (const a of [-2.5, 0, 2.5]) for (const s of [-1, 1]) {
    const x = pose.x + fx * a + rx * s, z = pose.z + fz * a + rz * s;
    const g = world.groundAt(x, z, pose.y);
    if (world.surfaceAt(x, z, g > world.heightAt(x, z) + 0.3 ? g : undefined) === WATER) near = true;
  }
  return { wet, near, fell: !wet && car.y < pose.y - 1.5 };
}

let runs = 0, oldBad = 0, newBad = 0, viaSearch = 0, home = 0;
const fails = [];
for (const [ex, ez, kind] of pick) {
  await world.loadAround(ex, ez, 200);
  // a run-up from dry land: the direction from the shore point with the longest stretch of land
  let best = null;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let n = 0;
    for (let d = 6; d <= 60; d += 3) { if (world.surfaceAt(ex + dx * d, ez + dz * d) === WATER || world.sdfAt(ex + dx * d, ez + dz * d) < 1.6) break; n = d; }
    if (!best || n > best.n) best = { n, dx, dz };
  }
  if (!best || best.n < 30) continue;
  for (const kmh of [25, 60]) {
    const sx = ex + best.dx * best.n, sz = ez + best.dz * best.n;
    // aim past the shore point into the water
    const tx = ex - best.dx * 20, tz = ez - best.dz * 20;
    const car = createCar(spec, { x: sx, z: sz, yaw: yawTo(sx, sz, tx, tz), y: world.heightAt(sx, sz) });
    const history = [];
    let histTimer = 0, wetAt = null;
    for (let t = 0; t < 25 && !car.sunk; t += dt) {
      const v = Math.hypot(car.vx, car.vy) * 3.6;
      const e = wrap(yawTo(car.x, car.z, tx, tz) - car.yaw);
      stepCar(car, { up: v < kmh ? 1 : 0, right: Math.max(0, Math.min(1, e * 2)), left: Math.max(0, Math.min(1, -e * 2)) }, world, dt);
      if (car.inWater && !wetAt) wetAt = { x: car.x, z: car.z, t: car.time - car.waterTime };
      histTimer -= dt;
      if (histTimer <= 0 && !car.inWater && !car.airborne && car.surface !== WATER && world.sdfAt(car.x, car.z) > 1.6) {
        histTimer = 0.5;
        const last = history[history.length - 1];
        if (!last || Math.hypot(car.x - last.x, car.z - last.z) > 3) history.push({ x: car.x, z: car.z, yaw: car.yaw, y: car.y, t: car.time });
      }
    }
    if (!car.sunk || !wetAt) continue;
    runs++;
    const label = `${kind} (${ex.toFixed(0)}, ${ez.toFixed(0)}) at ${kmh} km/h`;
    const o = oldPick(history, car.time);
    const ro = o ? standAt({ x: o.x, z: o.z, yaw: o.yaw, y: o.y }) : { wet: false, near: false };
    if (ro.wet || ro.near) oldBad++;
    let p = pickFromHistory(world, history, { ref: wetAt.t, sx: wetAt.x, sz: wetAt.z, minAge: 3, minDist: 15 });
    if (p?.wait) p = null;
    if (!p) { p = searchDry(world, wetAt.x, wetAt.z, nearestRoad); if (p) viaSearch++; }
    if (!p) { home++; continue; }
    const rn = standAt(p);
    const bad = rn.wet || rn.near || rn.fell;
    if (bad) { newBad++; fails.push(`FAIL ${label}: put at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) ${rn.wet ? 'in the water again' : rn.fell ? 'fell' : 'water next to it'}`); }
    if (process.argv.includes('--verbose')) console.log(`${bad ? 'FAIL' : 'ok  '} ${label}  old ${ro.wet ? 'WET' : ro.near ? 'brink' : 'ok'}  new ${Math.hypot(p.x - wetAt.x, p.z - wetAt.z).toFixed(0)} m back`);
  }
}
for (const f of fails) console.log(f);
console.log(`part 1: ${runs} plunges; old rule put the car back wet or on the brink ${oldBad} times, new rule ${newBad} times (${viaSearch} from the street search, ${home} sent home)`);

// ---- part 2: every deck over water
let decks = 0, deckBad = 0;
for (const d of world.decks) {
  const P = d.pts;
  for (const f of [0.25, 0.5, 0.75]) {
    const i = Math.min(P.length - 2, Math.floor(f * (P.length - 1)));
    const a = P[i], b = P[i + 1];
    const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    await world.loadAround(x, z, 60);
    if (world.surfaceAt(x, z) !== WATER) continue;
    const yaw = yawTo(a[0], a[1], b[0], b[1]);
    const top = world.topAt(x, z, 1);
    // as recorded while driving: the drawn height may be a few cm into the deck
    for (const rec of [top, top - 0.06, top + 0.5]) {
      const y = dryLevel(world, { x, z, yaw, y: rec });
      if (y === null) continue;
      decks++;
      const car = createCar(spec, { x, z, yaw, y });
      resetCar(car, { x, z, yaw, y });
      let wet = false;
      for (let t = 0; t < 6; t += dt) { stepCar(car, { up: t > 2 ? 0.5 : 0 }, world, dt); if (car.inWater) wet = true; }
      if (wet || car.y < top - 1.5) { deckBad++; console.log(`FAIL deck ${d.name || d.b || '?'} at (${x.toFixed(0)}, ${z.toFixed(0)}) from y ${rec.toFixed(2)}: ${wet ? 'in the water' : 'fell through'}`); }
    }
  }
}
console.log(`part 2: ${decks} drops on decks over water, ${deckBad} fell through`);

// ---- part 3: drive over every bridge over water, then press R with each spot remembered on it
let p3 = 0, p3old = 0, p3new = 0;
for (const d of world.decks) {
  const P = d.pts;
  if (P.length < 4) continue;
  const mid = P[Math.floor(P.length / 2)];
  await world.loadAround(mid[0], mid[1], 200);
  if (!P.some((q) => world.surfaceAt(q[0], q[1]) === WATER)) continue;
  for (const dirn of [1, -1]) {
    const line = dirn > 0 ? P : P.slice().reverse();
    const a = line[0], b = line[1];
    const yaw = yawTo(a[0], a[1], b[0], b[1]);
    // start 25 m before the deck on the approach
    const sx = a[0] - Math.sin(yaw) * 25, sz = a[1] + Math.cos(yaw) * 25;
    const car = createCar(spec, { x: sx, z: sz, yaw, y: world.groundAt(sx, sz, world.topAt(sx, sz, 1)) });
    car.vx = 50 / 3.6;
    const history = [];
    let k = 0, histTimer = 0;
    for (let t = 0; t < 40 && k < line.length - 2; t += dt) {
      while (k < line.length - 2 && Math.hypot(line[k][0] - car.x, line[k][1] - car.z) < 6) k++;
      const e = wrap(yawTo(car.x, car.z, line[k][0], line[k][1]) - car.yaw);
      const v = Math.hypot(car.vx, car.vy) * 3.6;
      stepCar(car, { up: v < 50 ? 0.6 : 0, right: Math.max(0, Math.min(1, e * 2.5)), left: Math.max(0, Math.min(1, -e * 2.5)) }, world, dt);
      if (car.inWater) break;
      histTimer -= dt;
      if (histTimer <= 0 && !car.airborne && car.surface !== WATER && world.sdfAt(car.x, car.z) > 1.6) {
        histTimer = 0.5;
        history.push({ x: car.x, z: car.z, yaw: car.yaw, y: car.y, t: car.time });
      }
    }
    for (const h of history) {
      const g = world.groundAt(h.x, h.z, h.y);
      if (!(g > world.heightAt(h.x, h.z) + 0.3) || world.surfaceAt(h.x, h.z) !== WATER) continue;     // only spots on the deck over the water
      p3++;
      const ro = standAt({ x: h.x, z: h.z, yaw: h.yaw, y: h.y });
      if (ro.wet || ro.fell) p3old++;
      const y = dryLevel(world, h);
      if (y === null) continue;
      const rn = standAt({ x: h.x, z: h.z, yaw: h.yaw, y });
      if (rn.wet || rn.fell) { p3new++; console.log(`FAIL bridge spot (${h.x.toFixed(1)}, ${h.z.toFixed(1)}) ${rn.wet ? 'in the water' : 'fell through'}`); }
    }
  }
}
console.log(`part 3: ${p3} remembered spots on bridges over water; old rule lost the car ${p3old} times, new rule ${p3new} times`);

// ---- part 4: swerve off the side of every bridge over water and press R
let p4 = 0, p4old = 0, p4new = 0;
for (const d of world.decks) {
  const P = d.pts;
  if (P.length < 4) continue;
  for (const f of [0.35, 0.65]) {
    const i = Math.floor(f * (P.length - 1)), a = P[i], b = P[i + 1];
    if (world.surfaceAt(a[0], a[1]) !== WATER) continue;
    for (const side of [1, -1]) {
      const yaw = yawTo(a[0], a[1], b[0], b[1]);
      // 20 m back along the deck, then steer for the side
      const sx = a[0] - Math.sin(yaw) * 20, sz = a[1] + Math.cos(yaw) * 20;
      const car = createCar(spec, { x: sx, z: sz, yaw, y: world.topAt(sx, sz, 1) });
      car.vx = 45 / 3.6;
      const history = [];
      let histTimer = 0, wetAt = null;
      for (let t = 0; t < 25 && !car.sunk; t += dt) {
        const tgt = t < 1.2 ? 0 : side;
        stepCar(car, { up: 0.5, right: tgt > 0 ? 1 : 0, left: tgt < 0 ? 1 : 0 }, world, dt);
        if (car.inWater && !wetAt) wetAt = { x: car.x, z: car.z, t: car.time - car.waterTime };
        histTimer -= dt;
        if (histTimer <= 0 && !car.inWater && !car.airborne && car.surface !== WATER && world.sdfAt(car.x, car.z) > 1.6) {
          histTimer = 0.5;
          const last = history[history.length - 1];
          if (!last || Math.hypot(car.x - last.x, car.z - last.z) > 3) history.push({ x: car.x, z: car.z, yaw: car.yaw, y: car.y, t: car.time });
        }
      }
      if (!car.sunk || !wetAt) continue;
      p4++;
      const o = oldPick(history, car.time);
      const ro = o ? standAt({ x: o.x, z: o.z, yaw: o.yaw, y: o.y }) : { wet: false };
      if (ro.wet || ro.fell || ro.near) p4old++;
      let p = pickFromHistory(world, history, { ref: wetAt.t, sx: wetAt.x, sz: wetAt.z, minAge: 3, minDist: 15 });
      if (p?.wait) p = null;
      if (!p) p = searchDry(world, wetAt.x, wetAt.z, nearestRoad);
      if (!p) continue;
      const rn = standAt(p);
      if (rn.wet || rn.fell || rn.near) { p4new++; console.log(`FAIL off bridge ${d.name || d.b} (${wetAt.x.toFixed(0)}, ${wetAt.z.toFixed(0)}): put at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) ${rn.wet ? 'in the water' : rn.fell ? 'fell' : 'water next to it'}`); }
      else if (process.argv.includes('--verbose')) console.log(`ok   off bridge ${d.name || d.b} (${wetAt.x.toFixed(0)}, ${wetAt.z.toFixed(0)}) old ${ro.wet ? 'WET' : ro.fell ? 'FELL' : ro.near ? 'brink' : 'ok'}`);
    }
  }
}
console.log(`part 4: ${p4} cars off the side of a bridge; old rule put it back wet, falling or on the brink ${p4old} times, new rule ${p4new} times`);
