// Tallinn's lobby follows a racer round Pirita-Kose as Tartu's does round Toomemägi (worker/follow.js courseOf,
// 28 Nov 2026): a car that stands on the grid, leaves after the lights and drives the lap's centre line is seen to
// start, pass every gate and finish; the same drive with a stretch of the lap left out is not. Tartu's own course is
// untouched (tools/follow-test.mjs).
//   node tools/pirita-follow-test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register('data:text/javascript,' + encodeURIComponent(`export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { courseOf, TOOME } = await import(root + '/worker/follow.js');
const LAP = JSON.parse(readFileSync(new URL('../src/race/pirita.json', import.meta.url)));
const C = courseOf('tallinn');
assert.notEqual(C, TOOME);
assert.equal(C.LAP.name, 'Pirita-Kose');
assert.ok(C.PT, 'the pace table (worker/pace-pirita.json) is of these gates: node tools/race/pace-geometric.mjs pirita');
const P = LAP.pts, N = P.length;

// the grid's middle spot of the first row (src/race/racemode.js gridPose), the car standing there
const A = P[N - 30], GL = Math.hypot(P[0][0] - A[0], P[0][1] - A[1]);
const ux = (P[0][0] - A[0]) / GL, uz = (P[0][1] - A[1]) / GL;
const T = -34 - 0.6 - 2.2;                                     // (GRID_LINE in follow.js, a car's half length)
const grid = [A[0] + ux * T, A[1] + uz * T];

function drive(skip = null) {
  const r = {}, f = C.newFollow(1);
  const go = 10000;
  let now = 0, ev = [];
  const at = (x, z) => { const e = C.follow(r, f, x, z, now, go, false, now % 60000, 0); if (e) ev.push(e); now += 100; };
  for (let k = 0; k < 40; k++) at(...grid);                    // 4 s standing, the lights at 10 s
  while (now < go) at(...grid);
  // off the line at 4 m/s2 up to 35 m/s: along the straight to the line, then the lap's points
  let v = 0, s = 0;
  const path = [grid, ...P.slice(N - 30), ...P, P[0], P[1], P[2], P[3]];
  let i = 0, x = grid[0], z = grid[1];
  while (i < path.length - 1) {
    v = Math.min(35, v + 0.4);
    let left = v * 0.1;
    while (left > 0 && i < path.length - 1) {
      const [bx, bz] = path[i + 1], l = Math.hypot(bx - x, bz - z);
      if (l <= left) { left -= l; x = bx; z = bz; i++; } else { x += (bx - x) / l * left; z += (bz - z) / l * left; left = 0; }
    }
    // (a cut: the stretch from skip[0] to skip[1] left out, the car put straight on)
    if (skip && i === skip[0]) { i = skip[1]; [x, z] = path[i]; }
    at(x, z);
    s += v * 0.1;
  }
  return { ev, r };
}
const honest = drive();
const gates = honest.ev.filter((e) => e === 'gate').length;
console.log('honest:', honest.ev.filter((e) => e !== 'arm').slice(0, 2).join(' '), '...', gates, 'gates,', honest.ev.at(-1), 'fs', honest.r.fs);
assert.ok(honest.ev.includes('start'));
assert.ok(honest.ev.includes('finish'), 'the lap is finished');
const cut = drive([900, 1400]);
console.log('cut:', cut.ev.includes('finish') ? 'FINISHED' : 'no finish', cut.r.gt, 'of', C.PASS.length);
assert.ok(!cut.ev.includes('finish'), 'a lap with a kilometre left out is not finished');
console.log('ok: Pirita-Kose followed to the finish in Tallinn\'s lobby; a cut lap refused');
