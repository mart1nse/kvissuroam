// A car going slowly over an edge (src/cars/tip.js): node tools/edge-test.mjs [--verbose]
//
// Part 1, shaped ground: off an 8 m edge forwards, backwards and at a slant, down a 1 m step, and over the
// ground of every day (a slope, a crest, a ramp, a steep bank), which must not start any of it.
// Part 2, the real map: off a roof laid over a field as ERM's is (world.addSlab with its one-sided walls) on all
// four sides, and off the side of the bridge spans that have no railing.
//
// Slow, the nose must be well down by the time the rear wheels reach the edge, the tail must not sink through
// the top it is still over, the car must end on its wheels on the ground below, and it must never be moved more
// than it drives in a step. Fast, the nose dips only a little, less the faster, and the car lands on its wheels.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';

const verbose = process.argv.includes('--verbose');
const dt = 1 / 120, DEG = 180 / Math.PI;
let fails = 0, checks = 0;
const check = (ok, what, detail = '') => {
  checks++;
  if (!ok) fails++;
  if (!ok || verbose) console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `  (${detail})` : ''}`);
};

// One drive. start: { x, z, yaw, y }, kmh (negative: in reverse), top(x, z): is this point over the top the car
// starts on; steer: a constant steering input. Returns what happened.
function drive(world, spec, start, kmh, top, { time = 14, steer = 0 } = {}) {
  const car = createCar(spec, start);
  const v0 = kmh / 3.6, L = spec.wheelbase;
  car.vx = v0;
  const y0 = start.y;
  const r = { tip: false, tipped: false, pitchAtEdge: null, rollMost: 0, pitchMost: 0, sink: 0, jump: 0, nan: false, landed: null, upright: null, car, lowest: y0, air: 0, flight: 0 };
  let t = 0, px = car.x, pz = car.z, gone = false;
  while (t < time) {
    const v = car.vx;
    const input = kmh > 0 ? { up: Math.max(0, Math.min(0.4, (v0 + 0.3 - v) * 0.4)) } : { down: v > v0 ? 0.3 : 0 };
    if (steer) input.steer = steer;
    stepCar(car, input, world, dt); t += dt;
    if (![car.x, car.z, car.y, car.pitch, car.roll, car.vx, car.vy, car.yaw].every(Number.isFinite)) { r.nan = true; break; }
    const step = Math.hypot(car.x - px, car.z - pz), drove = Math.hypot(car.vx, car.vy) * dt;
    r.jump = Math.max(r.jump, step - drove);
    px = car.x; pz = car.z;
    if (car.tip) r.tip = true;
    if (car.tipped) r.tipped = true;
    if (car.airborne) r.air += dt;
    r.pitchMost = Math.abs(car.pitch) > Math.abs(r.pitchMost) ? car.pitch : r.pitchMost;
    r.rollMost = Math.abs(car.roll) > Math.abs(r.rollMost) ? car.roll : r.rollMost;
    r.lowest = Math.min(r.lowest, car.y);
    // the four wheels' places, and the body's ends as it lies
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    const mx = car.x + fx * (car.a - L / 2), mz = car.z + fz * (car.a - L / 2);
    const over = [1, -1].map((e) => top(mx + fx * e * L / 2, mz + fz * e * L / 2));
    if (!gone) {
      // (how far the end still over the top lies below it: the tail of a car going off forwards)
      for (const e of [1, -1]) {
        if (!top(mx + fx * e * (L / 2 + 0.3), mz + fz * e * (L / 2 + 0.3))) continue;
        r.sink = Math.max(r.sink, y0 - (car.y + e * (L / 2) * Math.sin(car.pitch)));
      }
      if (!over[0] && !over[1]) { gone = true; r.pitchAtEdge = car.pitch; r.rollAtEdge = car.roll; r.fallenAtEdge = y0 - car.y; }
    } else if (r.landed === null && !car.airborne && !car.tip && car.y < y0 - 0.5) r.landed = t;
    else if (r.landed === null && Math.abs(car.pitch) > Math.abs(r.flight)) r.flight = car.pitch;     // (off the edge, until down)
    if (r.landed !== null && r.upright === null && !car.tipped && Math.abs(car.pitch) < 0.12 && Math.abs(car.roll) < 0.12) r.upright = t;
    if (r.upright !== null && t > r.upright + 0.5) break;
  }
  r.gone = gone;
  return r;
}

const spec = Object.values(CARS)[0];
const flatWorld = (h) => ({
  meta: { riverLevel: -100 },
  heightAt: (x, z) => h(x, z),
  surfaceAt: () => 1,
  sdfAt: () => 100,
  sdfGrad: (x, z, o) => o,
});

// ---- part 1: shaped ground. The car drives north (towards -z); s is the distance driven.
{
  const H = 8;
  const cliff = flatWorld((x, z) => (-z < 50 ? H : 0)), top = (x, z) => -z < 50;
  for (const kmh of [6, 10, 20, 30]) {
    const r = drive(cliff, spec, { x: 0, z: -40, yaw: 0, y: H }, kmh, top);
    const d = `nose ${(r.pitchAtEdge * DEG).toFixed(0)} deg at the edge, most ${(r.pitchMost * DEG).toFixed(0)}, tail sank ${r.sink.toFixed(2)} m, moved ${r.jump.toFixed(3)} m, on its wheels ${r.upright ? (r.upright - r.landed).toFixed(2) + ' s after landing' : 'never'}`;
    check(!r.nan && r.gone && r.tip && r.pitchAtEdge < -(kmh <= 20 ? 15 : 6) / DEG, `8 m edge at ${kmh} km/h: the nose is down as the rear wheels leave`, d);
    check(r.sink < 0.06, `8 m edge at ${kmh} km/h: the tail does not sink through the top`, d);
    check(r.upright !== null && r.upright - r.landed < 2 && r.jump < 0.02, `8 m edge at ${kmh} km/h: lands and stands on its wheels`, d);
  }
  // fast, the nose dips only a little, less the faster, and never stops dipping at all (Martin, 27 Nov 2026: "a very
  // very small nose dive until the end"; at 70 km/h "it should dive more"); it lands on its wheels at once, and no slower than it went off
  let dip = -1;
  for (const kmh of [56, 70, 100, 160]) {
    const r = drive(cliff, spec, { x: 0, z: 0, yaw: 0, y: H }, kmh, top);
    const v = Math.hypot(r.car.vx, r.car.vy) * 3.6;
    const d = `nose ${(r.pitchAtEdge * DEG).toFixed(2)} deg at the edge, most ${(r.pitchMost * DEG).toFixed(1)}, on its wheels ${r.upright ? (r.upright - r.landed).toFixed(2) + ' s after landing' : 'never'}, ${v.toFixed(0)} km/h after`;
    check(!r.nan && Math.abs(r.pitchAtEdge) < 3 / DEG && r.pitchMost < -0.5 / DEG && r.pitchMost > -15 / DEG, `8 m edge at ${kmh} km/h: a small nose dip in the air`, d);
    check(r.pitchMost > dip - 0.3 / DEG, `8 m edge at ${kmh} km/h: less dip the faster`, d);
    check(r.upright !== null && r.upright - r.landed < 0.3 && r.jump < 0.02 && v > kmh * 0.94, `8 m edge at ${kmh} km/h: lands on its wheels and drives on`, d);
    dip = r.pitchMost;
  }
  // (between the two the tipping fades out: never more than slow, never a jump in what the car does)
  let last = -1;
  for (const kmh of [30, 36, 42, 48, 54]) {
    const r = drive(cliff, spec, { x: 0, z: -20, yaw: 0, y: H }, kmh, top);
    check(r.pitchAtEdge > last - 1e-3 && r.pitchAtEdge <= 0.01, `8 m edge at ${kmh} km/h: less nose down the faster`, `${(r.pitchAtEdge * DEG).toFixed(1)} deg`);
    last = r.pitchAtEdge;
  }
  // in reverse: the tail falls, so the nose points up
  {
    const r = drive(cliff, spec, { x: 0, z: -44, yaw: Math.PI, y: H }, -8, top);
    check(!r.nan && r.gone && r.tip && r.pitchAtEdge > 15 / DEG && r.sink < 0.06 && r.upright !== null, '8 m edge in reverse at 8 km/h: the tail drops first', `nose ${(r.pitchAtEdge * DEG).toFixed(0)} deg up at the edge, sank ${r.sink.toFixed(2)} m`);
  }
  // at a slant: one front wheel goes over alone first (the car stays on three), then the front axle, and along
  // the edge the side
  for (const deg of [25, 50, 80]) {
    const r = drive(cliff, spec, { x: 0, z: -42, yaw: deg / DEG, y: H }, 8, top, { time: 30 });
    const d = `nose ${(r.pitchMost * DEG).toFixed(0)} deg, roll ${(r.rollMost * DEG).toFixed(0)} deg, moved ${r.jump.toFixed(3)} m, fell level ${r.fallenLevel ?? ''}`;
    check(!r.nan && r.gone && r.tip && r.landed !== null && r.upright !== null && r.jump < 0.02, `8 m edge at 8 km/h, ${deg} deg off straight: tips, lands, stands`, d);
    check(deg < 60 ? r.pitchMost < -10 / DEG : Math.abs(r.rollMost) > 10 / DEG, `8 m edge at 8 km/h, ${deg} deg off straight: ${deg < 60 ? 'nose' : 'side'} down`, d);
  }
  // a 1 m step: the nose comes down onto the ground below, and the car drives on
  {
    const step = flatWorld((x, z) => (-z < 50 ? 1 : 0));
    const r = drive(step, spec, { x: 0, z: -42, yaw: 0, y: 1 }, 8, top);
    check(!r.nan && r.gone && r.tip && r.upright !== null && r.sink < 0.2 && r.jump < 0.02, '1 m step at 8 km/h: nose down onto the lower ground and on', `nose most ${(r.pitchMost * DEG).toFixed(0)} deg, sank ${r.sink.toFixed(2)} m`);
  }
  // everyday ground starts none of it
  const grounds = [
    ['flat', () => 0],
    ['a 25 % slope', (s) => -0.25 * s],
    ['rolling', (s) => 1.5 * Math.sin(s / 40)],
    ['a humpback', (s) => { const d = Math.abs(s - 60); return d > 60 ? 0 : d > 6 ? (60 - d) * 0.08 : 4.56 - (d * d) / 150; }],
    ['a 15 cm kerb down', (s) => (s < 30 ? 0.15 : 0)],
    ['a 40 cm bank down', (s) => (s < 30 ? 0.4 : 0)],
  ];
  for (const [name, h] of grounds) {
    for (const kmh of [8, 25, 50]) {
      const car = createCar(spec, { x: 0, z: 0, yaw: 0, y: h(0) });
      car.vx = kmh / 3.6;
      let tip = false;
      for (let t = 0; t < 12; t += dt) { stepCar(car, { up: car.vx < kmh / 3.6 ? 0.4 : 0 }, flatWorld((x, z) => h(-z)), dt); if (car.tip || car.tipped) tip = true; }
      check(!tip, `${name} at ${kmh} km/h: no tipping`);
    }
  }
}

// ---- part 2: the real map
{
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

  // a roof like ERM's over the open field north of Raadi: 30 x 16 m, 6 m up, a one-sided wall along each side
  const C = [2900, 700], HX = 15, HZ = 8, UP = 6;
  await world.loadAround(C[0], C[1], 200);
  let base = -Infinity;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) base = Math.max(base, world.heightAt(C[0] + i * HX, C[1] + j * HZ));
  const roofY = base + UP;
  const inRoof = (x, z) => Math.abs(x - C[0]) <= HX && Math.abs(z - C[1]) <= HZ;
  world.addSlab({ x0: C[0] - HX, x1: C[0] + HX, z0: C[1] - HZ, z1: C[1] + HZ, at: () => roofY });
  // (a ledge puts a car out along (-sin yaw, -cos yaw): see ledgePush in data.js)
  world.addLedges([
    { x: C[0], z: C[1] - HZ, yaw: 0, hx: HX, hz: 0.15, top: roofY },
    { x: C[0], z: C[1] + HZ, yaw: Math.PI, hx: HX, hz: 0.15, top: roofY },
    { x: C[0] + HX, z: C[1], yaw: -Math.PI / 2, hx: HZ, hz: 0.15, top: roofY },
    { x: C[0] - HX, z: C[1], yaw: Math.PI / 2, hx: HZ, hz: 0.15, top: roofY },
  ]);
  const clear = world.sdfAt(C[0], C[1]) > 3;
  check(clear, 'the test roof stands on open ground', `obstacle ${world.sdfAt(C[0], C[1]).toFixed(1)} m away`);
  for (const [name, yaw] of [['north', 0], ['east', Math.PI / 2], ['south', Math.PI], ['west', -Math.PI / 2]]) {
    for (const kmh of [8, 20, -8]) {
      const r = drive(world, spec, { x: C[0], z: C[1], yaw, y: roofY }, kmh, inRoof, { time: 30 });
      const d = `nose ${(r.pitchAtEdge * DEG).toFixed(0)} deg at the edge, tail sank ${r.sink.toFixed(2)} m, moved ${r.jump.toFixed(3)} m, ${r.upright ? 'on its wheels ' + (r.upright - r.landed).toFixed(2) + ' s after landing' : 'not on its wheels'}`;
      const down = kmh > 0 ? r.pitchAtEdge < -12 / DEG : r.pitchAtEdge > 12 / DEG;
      check(!r.nan && r.gone && r.tip && down && r.sink < 0.06, `roof with walls, off the ${kmh > 0 ? name : 'far'} side at ${kmh} km/h: tips over the edge`, d);
      check(r.upright !== null && r.jump < 0.03 && r.car.y < roofY - UP + 1.5, `roof with walls, off the ${kmh > 0 ? name : 'far'} side at ${kmh} km/h: down and on its wheels, never put elsewhere`, d);
    }
    const r = drive(world, spec, { x: C[0], z: C[1], yaw, y: roofY }, 90, inRoof, { time: 6 });
    check(!r.nan && Math.abs(r.pitchAtEdge) < 1.5 / DEG && Math.abs(r.flight) < 10 / DEG && r.jump < 0.03, `roof with walls, off the ${name} side at 90 km/h: flies all but level`, `nose ${(r.pitchAtEdge * DEG).toFixed(2)} deg, most ${(r.flight * DEG).toFixed(1)} until down`);
  }

  // bridge spans: off the side that has no railing; and nosed against a railing, where the front wheels were past
  // the deck's edge and the car fell through the bridge (26 Nov), it must stand
  const out = [0, 0, 0];
  let railed = 0, held = 0, worst = '';
  for (const d of world.decks) {
    if (d.kind !== 1 || d.wall || d.hw < 4) continue;
    const P = d.pts, k = Math.floor(P.length / 2), a = P[k - 1], b = P[k + 1];
    if (!a || !b) continue;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), mid = P[k], hw = d.ws ? d.ws[k] : d.hw;
    await world.loadAround(mid[0], mid[1], 150);
    const y = world.topAt(mid[0], mid[1], 1);
    for (const sg of [1, -1]) {
      const nx = (-(b[1] - a[1]) / l) * sg, nz = ((b[0] - a[0]) / l) * sg, yaw = Math.atan2(nx, -nz);
      const under = world.heightAt(mid[0] + nx * (hw + 3), mid[1] + nz * (hw + 3));
      if (y - under < 2) continue;                                             // (a deck lying on its bank)
      if (world.railPush(mid[0] + nx * (hw - 0.4), mid[1] + nz * (hw - 0.4), y + 0.4, 0.9, out)) {
        for (const kmh of [8, 30]) {
          for (const deg of [0, 20]) {
            const car = createCar(spec, { x: mid[0], z: mid[1], yaw: yaw + deg / DEG, y });
            car.vx = kmh / 3.6;
            let low = 0, dip = 0;
            for (let t = 0; t < 2.5; t += dt) { stepCar(car, { up: 0.3 }, world, dt); low = Math.max(low, y - car.y); dip = Math.max(dip, Math.abs(car.pitch)); }
            railed++;
            if (low < 0.5 && dip < 6 / DEG) held++;
            else if (!worst) worst = `${d.name || 'span'} at (${mid[0].toFixed(0)}, ${mid[1].toFixed(0)}), ${kmh} km/h, ${deg} deg off square: ${low.toFixed(1)} m down, nose ${(dip * DEG).toFixed(0)} deg`;
          }
        }
        continue;
      }
    }
  }
  // ... and off a deck wherever it has neither railing nor wall along a drop (the ends of some spans)
  let open = 0, tipped = 0;
  for (const d of world.decks) {
    if (d.kind !== 1 || d.wall) continue;
    const P = d.pts;
    let lastK = -99;
    for (let k = 1; k < P.length - 1; k++) {
      const a = P[k - 1], b = P[k + 1], mid = P[k], l = Math.hypot(b[0] - a[0], b[1] - a[1]), hw = d.ws ? d.ws[k] : d.hw;
      if (k - lastK < 12 || hw < 3.5) continue;
      await world.loadAround(mid[0], mid[1], 150);
      const y = world.topAt(mid[0], mid[1], 1);
      for (const sg of [1, -1]) {
        const nx = (-(b[1] - a[1]) / l) * sg, nz = ((b[0] - a[0]) / l) * sg;
        const at = (q) => [mid[0] + nx * q, mid[1] + nz * q];
        const p1 = at(hw - 0.3), p2 = at(hw + 1.2), p3 = at(hw + 3);
        if (world.groundAt(p1[0], p1[1], y + 0.4) < y - 0.5 || world.railPush(p1[0], p1[1], y + 0.4, 0.9, out)) continue;
        if (world.sdfAt(p1[0], p1[1]) < 0.6 || world.sdfAt(p2[0], p2[1]) < 0.6 || world.sdfAt(p3[0], p3[1]) < 0.6) continue;
        const drop = y - world.groundAt(p2[0], p2[1], y + 0.4);
        if (drop < 1.5 || world.surfaceAt(p3[0], p3[1]) === 4) continue;
        if (y - world.groundAt(p3[0], p3[1], y + 0.4) < 1.5) continue;         // (the next deck a metre on: Sõpruse sild's two)
        lastK = k; open++;
        const onDeck = (x, z) => world.groundAt(x, z, y + 0.4) > y - 0.6;
        const r = drive(world, spec, { x: mid[0], z: mid[1], yaw: Math.atan2(nx, -nz), y }, 8, onDeck, { time: 20 });
        if (r.tip) tipped++;
        const det = `at (${mid[0].toFixed(0)}, ${mid[1].toFixed(0)}), ${drop.toFixed(1)} m up: ${r.gone ? `nose ${(r.pitchAtEdge * DEG).toFixed(0)} deg at the edge` : 'did not leave the deck'}, tail sank ${r.sink.toFixed(2)} m, moved ${r.jump.toFixed(3)} m`;
        check(!r.nan && r.gone && r.sink < 0.1 && r.jump < 0.03 && !r.car.tipped && (!r.gone || (r.upright !== null && (drop < 2.5 || r.pitchAtEdge < -8 / DEG))), `bridge ${d.name || 'span'}: off its open side at 8 km/h`, det);
        break;
      }
    }
  }
  check(tipped > 3, 'bridge decks with an open side were found and tipped off', `${tipped} of ${open}`);
  check(railed > 100 && held === railed, 'a car nosed against a bridge railing stands on the deck', `${held} of ${railed} drives${worst ? ', first: ' + worst : ''}`);
}

console.log(`${checks - fails} of ${checks} checks passed`);
process.exit(fails ? 1 : 0);
