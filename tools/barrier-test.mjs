// Barrier check: drive each car into thin solid things (guard rails, lane dividers, low walls between
// carriageways, the map's walls) from many angles and speeds, then try to get away (reverse, then
// forward at half lock away from it), and into the narrow wedge where two barriers meet. The obstacle
// field is built the way the game builds it (0.5 m cells, 8 bit, read bilinear, the thin boxes stamped
// in as world.addSolids does), and the same boxes are handed to the physics through world.solidsNear.
// A car must never pass through, must never end up deep inside one, and must always get clear again.
// Run: node tools/barrier-test.mjs  (add `quick` for two cars only)
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';

const dt = 1 / 60;
const RES = 0.5, DMIN = -4, DSPAN = 16, N = 241, X0 = -60, Z0 = -60;   // a 120 m field round the start

// box: { x, z, yaw, hx, hz } as world.addSolids takes it (local x = (cos yaw, -sin yaw))
function boxDist(b, x, z) {
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw), px = x - b.x, pz = z - b.z;
  const qx = Math.abs(px * c - pz * s) - b.hx, qz = Math.abs(px * s + pz * c) - b.hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

function field(boxes, exact = true) {
  const D = new Uint8Array(N * N).fill(255);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    let d = 12;
    for (const b of boxes) d = Math.min(d, boxDist(b, X0 + c * RES, Z0 + r * RES));
    D[r * N + c] = Math.max(0, Math.min(255, Math.round(((d - DMIN) / DSPAN) * 255)));
  }
  const sdfAt = (x, z) => {
    let fx = (x - X0) / RES, fz = (z - Z0) / RES;
    if (fx < 0 || fz < 0 || fx >= N - 1 || fz >= N - 1) return 12;
    const c = Math.floor(fx), r = Math.floor(fz); fx -= c; fz -= r;
    const i = r * N + c;
    const v = (D[i] * (1 - fx) + D[i + 1] * fx) * (1 - fz) + (D[i + N] * (1 - fx) + D[i + N + 1] * fx) * fz;
    return DMIN + (v / 255) * DSPAN;
  };
  return {
    meta: { riverLevel: -100 },
    heightAt: () => 0, surfaceAt: () => 1, waterLevelAt: () => -100,
    sdfAt,
    sdfGrad(x, z, o) {
      const e = 0.35, gx = sdfAt(x + e, z) - sdfAt(x - e, z), gz = sdfAt(x, z + e) - sdfAt(x, z - e), l = Math.hypot(gx, gz);
      o[0] = l > 1e-6 ? gx / l : 0; o[1] = l > 1e-6 ? gz / l : 0; return o;
    },
    solidsNear: exact ? (x, z, reach, out) => {
      out.length = 0;
      for (const b of boxes) if (Math.min(b.hx, b.hz) <= 0.6 && boxDist(b, x, z) <= reach) out.push(b);
      return out;
    } : undefined,
  };
}

// how deep is the box inside the body outline (m, 0 when clear): the deepest body point inside the box,
// or the deepest box corner / edge point inside the body
function overlap(car, b) {
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = -fz, rz = fx;
  let worst = 0;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 4; j++) {
    const lx = -car.halfLen + (2 * car.halfLen * i) / 8, ly = -car.halfWid + (2 * car.halfWid * j) / 4;
    const d = boxDist(b, car.x + fx * lx + rx * ly, car.z + fz * lx + rz * ly);
    if (d < 0) worst = Math.max(worst, -d);
  }
  return worst;
}
// which side of the box line is the car centre on (+1 / -1 along the box's local z)
function side(b, x, z) { const s = Math.sin(b.yaw), c = Math.cos(b.yaw); return Math.sign((x - b.x) * s + (z - b.z) * c); }

const KINDS = [
  { name: 'guard rail', hz: 0.06 },
  { name: 'steel fence', hz: 0.12 },
  { name: 'lane divider', hz: 0.25 },
  { name: 'map wall', hz: 0.3 },
  { name: 'median wall', hz: 0.45 },
];

const quick = process.argv.includes('quick');
const only = process.argv.find((a) => a.startsWith('car='));
const ids = only ? [only.slice(4)] : quick ? ['w201', 'bus'] : Object.keys(CARS);
const exact = !process.argv.includes('old');
let fails = 0, runs = 0, worstPen = 0, thrown = 0, thrownC = null;
const t0 = Date.now();
for (const id of ids) {
  const spec = CARS[id];
  let through = 0, stuck = 0, deep = 0;
  for (const K of KINDS) {
    // a long barrier across the way at z = -20, running east-west (yaw 0: local x is east)
    const wall = { x: 0, z: -20, yaw: 0, hx: 300, hz: K.hz };
    const w = field([wall], exact);
    for (const kmh of [6, 20, 45, 80, 130, 200]) {
      for (const ang of [0, 0.3, 0.7, 1.1, 1.35]) {            // 0 head on, 1.35 rad a glancing scrape
        for (const off of [0, 0.37]) {
          runs++;
          const yaw = ang * (runs % 2 ? 1 : -1);
          const car = createCar(spec, { x: off, z: -20 + K.hz + 0.2 + car0(spec, yaw) + 6 * Math.cos(yaw), yaw, y: 0 });
          car.x -= Math.sin(yaw) * 6;
          car.vx = kmh / 3.6;
          let maxPen = 0, back = 0, px = car.x, pz = car.z, crossed = false;
          const startSide = side(wall, car.x, car.z);
          const away = yaw > 0 ? { up: 0.6, left: 0.6 } : { up: 0.6, right: 0.6 };
          for (let t = 0; t < 8; t += dt) {
            const inp = t < 2.5 ? { up: 1 } : t < 5 ? { down: 1 } : away;
            // (fast and square it is thrown over, src/cars/crash.js, tools/wall-crash-test.mjs: it must not pass
            // through on the way; it comes back onto its wheels by itself, and gets away like the rest)
            if (car.crash && car.crash !== thrownC) { thrown++; thrownC = car.crash; }
            stepCar(car, inp, w, dt);
            maxPen = Math.max(maxPen, overlap(car, wall));
            if (side(wall, car.x, car.z) !== startSide) crossed = true;
            if (t >= 2.5) back += Math.hypot(car.x - px, car.z - pz);
            px = car.x; pz = car.z;
          }
          worstPen = Math.max(worstPen, maxPen);
          const free = overlap(car, wall) < 0.02 && back > 3;
          if (crossed) { through++; if (through <= 2) console.log(`    ${spec.short} THROUGH the ${K.name} at ${kmh} km/h, angle ${yaw.toFixed(2)}`); }
          else if (!free) { stuck++; if (stuck <= 3) console.log(`    ${spec.short} STUCK on the ${K.name} at ${kmh} km/h, angle ${yaw.toFixed(2)}: moved ${back.toFixed(1)} m after the hit, overlap ${overlap(car, wall).toFixed(2)} m`); }
          if (maxPen > 0.2) { deep++; if (deep <= 2) console.log(`    ${spec.short} DEEP ${maxPen.toFixed(2)} m into the ${K.name} at ${kmh} km/h, angle ${yaw.toFixed(2)}`); }
        }
      }
    }
    // the end of a barrier, met off centre (a rail or median that starts in front of the car)
    const stub = { x: 0, z: -40, yaw: Math.PI / 2, hx: 20, hz: K.hz };        // runs north-south from z = -20 to -60
    const ws = field([stub], exact);
    for (const kmh of [10, 40, 90]) for (const off of [-0.8, -0.3, 0.3, 0.8]) {
      runs++;
      const car = createCar(spec, { x: off, z: 0, yaw: 0, y: 0 });
      car.vx = kmh / 3.6;
      let maxPen = 0, back = 0, px = car.x, pz = car.z;
      const away = off > 0 ? { up: 0.6, right: 0.6 } : { up: 0.6, left: 0.6 };
      for (let t = 0; t < 8; t += dt) {
        stepCar(car, t < 2.5 ? { up: 1 } : t < 5 ? { down: 1 } : away, ws, dt);
        maxPen = Math.max(maxPen, overlap(car, stub));
        if (t >= 2.5) back += Math.hypot(car.x - px, car.z - pz);
        px = car.x; pz = car.z;
      }
      worstPen = Math.max(worstPen, maxPen);
      if (overlap(car, stub) >= 0.02 || back < 3) { stuck++; if (stuck <= 3) console.log(`    ${spec.short} STUCK on the end of the ${K.name} at ${kmh} km/h, offset ${off}`); }
      if (maxPen > 0.2) { deep++; if (deep <= 2) console.log(`    ${spec.short} DEEP ${maxPen.toFixed(2)} m into the end of the ${K.name} at ${kmh} km/h, offset ${off}`); }
    }
    // the wedge: two barriers meeting at 25 degrees, the car driven into the point and then backed out
    const half = 0.22;
    const A = { x: -Math.sin(half) * 15, z: -30 + Math.cos(half) * 15, yaw: Math.PI / 2 - half, hx: 15, hz: K.hz };
    const B = { x: Math.sin(half) * 15, z: -30 + Math.cos(half) * 15, yaw: Math.PI / 2 + half, hx: 15, hz: K.hz };
    const wv = field([A, B], exact);
    for (const kmh of [15, 50]) {
      runs++;
      const car = createCar(spec, { x: 0.2, z: 5, yaw: 0, y: 0 });
      car.vx = kmh / 3.6;
      let maxPen = 0, back = 0, pz = car.z, zMin = 0, out = false;
      const sA = side(A, car.x, car.z), sB = side(B, car.x, car.z);
      const along = (b) => Math.abs((car.x - b.x) * Math.cos(b.yaw) - (car.z - b.z) * Math.sin(b.yaw)) < b.hx;
      for (let t = 0; t < 7; t += dt) {
        stepCar(car, t < 3 ? { up: 1 } : { down: 1 }, wv, dt);
        maxPen = Math.max(maxPen, overlap(car, A), overlap(car, B));
        zMin = Math.min(zMin, car.z);
        if ((along(A) && side(A, car.x, car.z) !== sA) || (along(B) && side(B, car.x, car.z) !== sB)) out = true;
        if (t >= 3) back += Math.max(0, car.z - pz);
        pz = car.z;
      }
      worstPen = Math.max(worstPen, maxPen);
      if (out || zMin < -30) { through++; console.log(`    ${spec.short} THROUGH the ${K.name} wedge at ${kmh} km/h`); }
      else if (back < 3) { stuck++; console.log(`    ${spec.short} STUCK in the ${K.name} wedge at ${kmh} km/h: backed ${back.toFixed(1)} m`); }
      if (maxPen > 0.2) { deep++; if (deep <= 2) console.log(`    ${spec.short} DEEP ${maxPen.toFixed(2)} m into the ${K.name} wedge at ${kmh} km/h`); }
    }
  }
  // a barrier in 2 m pieces (a wall built from short boxes, the map's walls in 3 m pieces): scraping along it
  // must feel like scraping along one long box, no catching on the joins
  let snag = 0;
  {
    const scrape = (list) => {
      const w = field(list, exact);
      const car = createCar(spec, { x: -40, z: -20 + 0.06 + 1.6, yaw: Math.PI / 2 - 0.12, y: 0 });
      car.vx = 60 / 3.6;
      let worst = 0;
      for (let t = 0; t < 2.5; t += dt) {
        stepCar(car, { up: 1, left: 0.4 }, w, dt);
        for (const b of list) worst = Math.max(worst, overlap(car, b));
      }
      return { v: Math.hypot(car.vx, car.vy), worst, x: car.x };
    };
    const one = scrape([{ x: 0, z: -20, yaw: 0, hx: 60, hz: 0.06 }]);
    const parts = [];
    for (let x = -60; x < 60; x += 2) parts.push({ x: x + 1, z: -20, yaw: 0, hx: 1, hz: 0.06 });
    const many = scrape(parts);
    runs++;
    if (process.env.SHOW) console.log(`    scrape ${(one.v * 3.6).toFixed(0)} vs ${(many.v * 3.6).toFixed(0)} km/h, overlap ${many.worst.toFixed(3)}`);
    if (many.v < one.v * 0.9 || many.worst > 0.1) { snag++; console.log(`    ${spec.short} SNAGS on a barrier in pieces: ${(many.v * 3.6).toFixed(0)} km/h after the scrape against ${(one.v * 3.6).toFixed(0)} along one piece`); }
  }
  console.log(`  ${spec.short.padEnd(11)} barriers: through ${through}, stuck ${stuck}, deep overlaps ${deep}${snag ? ', snags ' + snag : ''}`);
  fails += snag;
  fails += through + stuck + deep;
}
function car0(spec, yaw) { const c = createCar(spec, { x: 0, z: 0, yaw: 0, y: 0 }); return Math.abs(Math.cos(yaw)) * c.halfLen + Math.abs(Math.sin(yaw)) * c.halfWid; }
console.log(`\n${runs} barrier runs, deepest overlap ${worstPen.toFixed(2)} m, ${thrown} thrown over by a hard crash (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
console.log(fails ? `${fails} FAILURES` : 'barriers OK');
process.exit(fails ? 1 : 0);
