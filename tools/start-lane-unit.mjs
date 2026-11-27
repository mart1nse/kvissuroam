// The start lane's rules (src/race/startlane.js) on the real lap and start spots, without a browser: which spots
// count, a car pulling out of a bay, a slip over a kerb and back, out for long, over the line, and the car put on
// the lane's road some other way (R, the map, the grid). Usage: node tools/start-lane-unit.mjs
import fs from 'fs';
import { createStartLane } from '../src/race/startlane.js';
import { slots, BAYS } from '../src/race/startslots.js';

const T = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url)));
const P = T.pts, N = P.length, HW = T.hw, spawnI = T.spawn;
const s = new Float64Array(N), tan = [];
for (let i = 0; i < N; i++) {
  if (i) s[i] = s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  const a = P[(i + N - 1) % N], b = P[(i + 1) % N], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  tan.push([(b[0] - a[0]) / l, (b[1] - a[1]) / l]);
}
// (as createTrack's nearest in src/race/race.js: with a hint, only near it; here every segment otherwise)
function nearest(x, z, hint = -1) {
  const out = { d: Infinity, d2: Infinity, i: -1, t: 0 };
  const seg = (i) => {
    const a = P[i], b = P[(i + 1) % N], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const ex = x - a[0] - dx * t, ez = z - a[1] - dz * t, d2 = ex * ex + ez * ez;
    if (d2 < out.d2) { out.d2 = d2; out.i = i; out.t = t; }
  };
  if (hint >= 0) {
    for (let k = -50; k <= 50; k++) seg((hint + k + N) % N);
    if (out.d2 < 900) { out.d = Math.sqrt(out.d2); return out; }
    out.d2 = Infinity;
  }
  for (let i = 0; i < N; i++) seg(i);
  out.d = Math.sqrt(out.d2);
  return out;
}
const track = { P, HW, N, s, tan, spawnI, nearest, spawn: { x: P[spawnI][0], z: P[spawnI][1], yaw: Math.atan2(tan[spawnI][0], -tan[spawnI][1]) } };
// a point on the lap: metres along from track point i (minus: back), metres to the right
function at(i, along = 0, right = 0) {
  let k = (i + N) % N, left = Math.abs(along);
  const dir = along < 0 ? -1 : 1;
  while (left > 0) { const j = (k + dir + N) % N, l = Math.hypot(P[j][0] - P[k][0], P[j][1] - P[k][1]); if (l > left) break; left -= l; k = j; }
  const [tx, tz] = tan[k];
  return { x: P[k][0] + tx * left * dir - tz * right, z: P[k][1] + tz * left * dir + tx * right };
}

let fails = 0;
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) fails++; };
const lane = createStartLane(track, () => null, BAYS);
let now = 0;
const car = { x: 0, z: 0 };
const put = (q) => { car.x = q.x; car.z = q.z; };
// drive the car along a list of points, a frame each 1/60 s and 0.25 m apart; true if it passed through all the way
function drive(pts, { untilOff = false } = {}) {
  let all = true, n = 0;
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k], steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25));
    for (let q = 1; q <= steps; q++) {
      put({ x: a.x + (b.x - a.x) * q / steps, z: a.z + (b.z - a.z) * q / steps });
      now += 1000 / 60; n++;
      if (!lane.update(car, now)) { all = false; if (untilOff) return { all, n }; }
    }
  }
  return { all, n };
}
const start = { x: track.spawn.x - tan[spawnI][1] * 1.5, z: track.spawn.z + tan[spawnI][0] * 1.5, yaw: track.spawn.yaw };
const spots = slots(track, start);

// 1: every start spot is in the lane or in the bays
const kinds = spots.map((q) => lane.where(q.x, q.z));
check(kinds.filter((k) => k === 'lane').length === 21 && kinds.filter((k) => k === 'bay').length === 5, `start spots: ${kinds.filter((k) => k === 'lane').length} on the lane's road, ${kinds.filter((k) => k === 'bay').length} in the bays`);

// 2: from each bay, pulling out gently (along the bays first, onto the road 25 m on) and on to the line
for (let b = BAYS.from; b <= BAYS.to; b += 7) {
  const from = at(spawnI, b, BAYS.right);
  put(from); lane.begin(from.x, from.z); now += 5000;
  const path = [from];
  for (let a = 2; a <= 25; a += 2) path.push(at(spawnI, b + a, BAYS.right - (BAYS.right - 1.5) * Math.min(1, Math.max(0, (a - 5) / 20)) ** 1.5));
  const end = (T.length - s[spawnI]) - (b + 25) - 2;
  for (let a = 4; a <= end; a += 4) path.push(at(spawnI, b + 25 + a, 1.5));
  const r = drive(path);
  check(r.all && lane.on, `bay ${b} m: pulled out gently along ${25} m of bays and on to the line, passing through all the way`);
}

// 3: from the spot of old straight up the road, over the line: on all the way, over a little past it; back over
// the line the wrong way: still over
{
  put(start); lane.begin(start.x, start.z);
  const path = [start];
  const end = T.length - s[spawnI];
  for (let a = 4; a < end - 1; a += 4) path.push(at(spawnI, a, 1.5));
  const r = drive(path);
  check(r.all, 'spot of old to the line: passing through all the way');
  drive([at(0, -1, 1.5), at(0, 12, 1.5)]);
  check(!lane.on, '12 m past the line: over');
  drive([at(0, 12, 1.5), at(0, -10, 1.5)]);
  check(!lane.on, 'back over the line the wrong way: still over');
}

// 4: a slip over the kerb in the last corner and back: hittable over it, through again once back
{
  const c = 2350;
  put(at(c, -30, 0)); lane.begin(car.x, car.z); lane.update(car, now += 16);
  drive([at(c, -30, 0), at(c, -5, 0)]);
  check(lane.on, 'before the last corner: through');
  drive([at(c, -5, 0), at(c, 0, HW[c] + 1.2)]);
  check(!lane.on, `${(HW[c] + 1.2).toFixed(1)} m right in the corner, over the kerb: hittable`);
  now += 1500; lane.update(car, now);
  check(!lane.on, '1.5 s over the kerb: still hittable');
  drive([at(c, 0, HW[c] + 1.2), at(c, 8, 0)]);
  check(lane.on, 'back on the road within 5 s: through again');
  drive([at(c, 8, 0), at(c, 10, -(HW[c + 5] + 1.5))]);
  now += 6000; lane.update(car, now);
  drive([at(c, 10, -(HW[c + 5] + 1.5)), at(c, 14, 0), at(c, 30, 0)]);
  check(!lane.on, 'over the kerb for 6 s, then back on the road: over until put on the start again');
}

// 5: out of the back of the lane and back
{
  put(at(lane.i0, 10, 1)); lane.begin(car.x, car.z); lane.update(car, now += 16);
  check(lane.on, `back up the street, 10 m from the back of the lane: through`);
  drive([at(lane.i0, 10, 1), at(lane.i0, -6, 1)]);
  check(!lane.on, 'out of the back of the lane: hittable');
  drive([at(lane.i0, -6, 1), at(lane.i0, 6, 1)]);
  check(lane.on, 'in again within 5 s: through');
}

// 6: on the road from a bay, then back into the bays: the bays no longer count
{
  const from = at(spawnI, 0, BAYS.right);
  put(from); lane.begin(from.x, from.z); lane.update(car, now += 16);
  check(lane.on, 'on a bay spot: through');
  now += 60000; lane.update(car, now);
  check(lane.on, 'a minute on the bay spot: still through');
  drive([from, at(spawnI, 12, 1.5)]);
  check(lane.on, 'pulled out onto the road: through');
  drive([at(spawnI, 12, 1.5), at(spawnI, 16, BAYS.right)]);
  check(!lane.on, 'back over the kerb into the bays: hittable');
  now += 6000; lane.update(car, now);
  drive([at(spawnI, 16, BAYS.right), at(spawnI, 24, 1.5)]);
  check(!lane.on, '6 s in the bays, then on the road: over');
}

// 7: put on the lane's road some other way (R, the map, the grid), or somewhere else
{
  lane.end();
  lane.placed(at(spawnI, 40, -1).x, at(spawnI, 40, -1).z);
  check(lane.on, 'put on the lane\'s road 40 m past the start (R): through');
  lane.placed(at(0, -15, 3).x, at(0, -15, 3).z);
  check(lane.on, 'put on the grid just before the line: through');
  lane.placed(at(1000, 0, 0).x, at(1000, 0, 0).z);
  check(!lane.on, 'put further round the lap: over');
  lane.placed(at(spawnI, 7, BAYS.right).x, at(spawnI, 7, BAYS.right).z);
  check(!lane.on, 'put in the bays by R, not from the start: not through');
  const bay = at(spawnI, 7, BAYS.right);
  put(bay); lane.begin(bay.x, bay.z); lane.placed(bay.x, bay.z); lane.update(car, now += 16);
  check(lane.on, 'put on a bay spot by the start (place, then begin): through');
  lane.placed(start.x + 3000, start.z);
  check(!lane.on, 'put far away: over');
}

console.log(fails ? `${fails} failed` : 'all ok');
process.exit(fails ? 1 : 0);
