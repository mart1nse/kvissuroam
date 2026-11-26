// Tree and water check: drive each car into lone trunks from many angles and speeds, then try to
// get away (reverse, then forward with full lock), and drive across a narrow stream. A car must
// never end up overlapping a trunk, must always get clear of the tree, and must drive on after
// the stream puts it back on land. Run: node tools/tree-test.mjs
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';

const dt = 1 / 60;
const RIVER = -100;

// a field of trunks; the distance field includes them too (as the baked one does, blurred by its grid)
function forest(trees, water = null) {
  const rad = (h) => Math.min(0.45, Math.max(0.14, 0.035 * h));
  const sdf = (x, z) => {
    let d = 12;
    for (const [tx, tz, h] of trees) d = Math.min(d, Math.hypot(x - tx, z - tz) - rad(h));
    // the baked field is 0.5 m cells, 8 bit: round like it
    return Math.round(d * 16) / 16;
  };
  const inWater = (x, z) => water && z < water[0] && z > water[1];
  return {
    meta: { riverLevel: RIVER },
    heightAt: (x, z) => (inWater(x, z) ? -2 : 0),
    surfaceAt: (x, z) => (inWater(x, z) ? 4 : 0),
    waterLevelAt: () => (water ? -0.3 : RIVER),
    sdfAt: sdf,
    sdfGrad(x, z, o) {
      const e = 0.35, gx = sdf(x + e, z) - sdf(x - e, z), gz = sdf(x, z + e) - sdf(x, z - e), l = Math.hypot(gx, gz);
      o[0] = l > 1e-6 ? gx / l : 0; o[1] = l > 1e-6 ? gz / l : 0; return o;
    },
    trunksNear(x, z, reach, out) {
      out.length = 0;
      for (const [tx, tz, h] of trees) if (Math.abs(tx - x) <= reach && Math.abs(tz - z) <= reach) out.push(tx, tz, rad(h));
      return out;
    },
  };
}

// how deep is the trunk inside the body outline (m, 0 when clear)
function overlap(car, tx, tz, r) {
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = -fz, rz = fx;
  const dx = tx - car.x, dz = tz - car.z;
  const lx = dx * fx + dz * fz, ly = dx * rx + dz * rz;
  const cx = Math.max(-car.halfLen, Math.min(car.halfLen, lx)), cy = Math.max(-car.halfWid, Math.min(car.halfWid, ly));
  const d = Math.hypot(lx - cx, ly - cy);
  if (cx === lx && cy === ly) return r + Math.min(car.halfLen - Math.abs(lx), car.halfWid - Math.abs(ly));
  return Math.max(0, r - d);
}

let fails = 0, worstPen = 0, runs = 0;
const ids = Object.keys(CARS);
for (const id of ids) {
  const spec = CARS[id];
  let stuck = 0, deep = 0;
  for (const kmh of [8, 25, 50, 90, 140]) {
    for (let off = -1.2; off <= 1.21; off += 0.3) {
      for (const ang of [0, 0.35, -0.6]) {
        runs++;
        const tree = [Math.sin(ang) * 30 + off * Math.cos(ang), -Math.cos(ang) * 30 + off * Math.sin(ang), 8 + (runs % 3) * 6];
        const w = forest([tree]);
        const car = createCar(spec, { x: 0, z: 0, yaw: ang, y: 0 });
        car.vx = kmh / 3.6;
        const r = w.trunksNear(tree[0], tree[1], 1, [])[2];
        let maxPen = 0, back = 0, px = car.x, pz = car.z, touched = false, thrown = false;
        // 3 s flat out into it, 2.5 s reversing straight, then 3 s forward at half lock away from it
        const away = off > 0 ? { up: 0.5, left: 0.5 } : { up: 0.5, right: 0.5 };
        for (let t = 0; t < 8.5; t += dt) {
          const inp = t < 3 ? { up: 1 } : t < 5.5 ? { down: 1 } : away;
          stepCar(car, inp, w, dt);
          if (car.crash) thrown = true;
          if (t < 3 && overlap(car, tree[0], tree[1], r + 0.1) > 0) touched = true;
          maxPen = Math.max(maxPen, overlap(car, tree[0], tree[1], r));
          if (t >= 3 && t < 5.5) back += Math.hypot(car.x - px, car.z - pz);
          px = car.x; pz = car.z;
        }
        const dist = Math.hypot(car.x - tree[0], car.z - tree[1]);
        // free: not inside the trunk, and able to reverse away from it after the hit (unless the hit threw it clear)
        // (at 140 km/h and over, square on, the trunk throws the car over, src/cars/crash.js: it must be back on its
        // wheels by itself by now, whichever way it landed)
        const clear = overlap(car, tree[0], tree[1], r) === 0 && (!touched || back > 2 || dist > 6 || (thrown && !car.crash && Math.abs(car.pitch) < 0.2 && Math.abs(car.roll) < 0.2));
        worstPen = Math.max(worstPen, maxPen);
        if (maxPen > 0.25) deep++;
        if (!clear) { stuck++; if (stuck <= 2) console.log(`    ${spec.short} STUCK at ${kmh} km/h offset ${off.toFixed(1)} angle ${ang}: ${dist.toFixed(1)} m from the trunk`); }
      }
    }
  }
  console.log(`  ${spec.short.padEnd(11)} trees: stuck ${stuck}, deep overlaps ${deep}`);
  fails += stuck + deep;

  // the stream: 6 m of deep water across the road; at speed the car carries on onto the far bank
  const w = forest([], [-20, -24]);
  const car = createCar(spec, { x: 0, z: 0, yaw: 0, y: 0 });
  car.vx = 60 / 3.6;
  let wet = false;
  for (let t = 0; t < 3 && !car.inWater; t += dt) { stepCar(car, { up: 0.3 }, w, dt); wet = car.inWater; }
  // whatever happened in the stream, put the car on the far bank as a current or a jump would
  if (car.inWater) { car.z = -25.5; }
  const z0 = car.z;
  for (let t = 0; t < 4; t += dt) stepCar(car, { up: 1 }, w, dt);
  const ok = !car.inWater && !car.sunk && z0 - car.z > 10;
  console.log(`  ${''.padEnd(11)} stream: ${wet ? 'went in' : 'stayed dry'}, then ${ok ? 'drove on' : 'STUCK'} (${(z0 - car.z).toFixed(1)} m in 4 s)`);
  if (!ok) fails++;
}
console.log(`\n${runs} tree runs, deepest overlap ${worstPen.toFixed(2)} m`);
console.log(fails ? `${fails} FAILURES` : 'trees and water OK');
process.exit(fails ? 1 : 0);
