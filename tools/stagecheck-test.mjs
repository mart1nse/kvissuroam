// A recorded Raadi run judged again on the server by the stage's own rules (worker/stagecheck.js, 26 Nov 2026).
//   node tools/stagecheck-test.mjs
// The honest drives are the stage's two records of 26 Nov as they came from a player's browser
// (tools/fixtures/replays-raadi), neither with penalty seconds. They must hold, and by a margin: read with no
// leeway at all (EASE 0) they must still show no seconds. Then the same drives bent: a start further up the stage,
// a flying start, a bend cut across the grass, a corner's bale passed on the wrong side, the park crossed from one
// part of the stage to a later one, R used and its seconds left out, the finish passed beside its flag.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
register('data:text/javascript,' + encodeURIComponent(`export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { stageCheck, EASE } = await import(root + '/worker/stagecheck.js');
const R = await import(root + '/src/race/raadirules.js');
const { P, TAN, HW, START, FIN, CHECKS, BENDS, newRun, judgeStep } = R;

const dir = new URL('./fixtures/replays-raadi/', import.meta.url), drives = {};
for (const f of readdirSync(dir)) {
  const a = gunzipSync(readFileSync(new URL(f, dir))).toString().split(',').map(Number), n = a[3];
  const xs = new Float64Array(n), zs = new Float64Array(n);
  let x = 0, z = 0;
  for (let i = 0; i < n; i++) { x += a[4 + i * 21] / 100; z += a[5 + i * 21] / 100; xs[i] = x; zs[i] = z; }
  drives[f.replace('.gz', '')] = { xs, zs };
}
// the run's seconds with no leeway, as the page counts them
function strict({ xs, zs }) {
  const st = newRun(0); st.prev = { x: xs[0], z: zs[0] };
  for (let i = 1; i < xs.length; i++) { const ev = judgeStep(st, xs[i], zs[i]); if (ev?.cancel) return ev.cancel; st.prev = { x: xs[i], z: zs[i] }; }
  return st.pen;
}
// where along the stage each place of a run is (its index into the stage's points)
function along({ xs, zs }) {
  const out = []; let at = START;
  for (let i = 0; i < xs.length; i++) {
    let best = at, bd = Infinity;
    for (let k = Math.max(0, at - 4); k <= Math.min(P.length - 1, at + 12); k++) { const d = Math.hypot(P[k][0] - xs[i], P[k][1] - zs[i]); if (d < bd) { bd = d; best = k; } }
    out.push(at = best);
  }
  return out;
}
const cut = (d, i0, i1) => ({ xs: Float64Array.from([...d.xs.slice(0, i0), ...d.xs.slice(i1)]), zs: Float64Array.from([...d.zs.slice(0, i0), ...d.zs.slice(i1)]) });
// places i0..i1 pushed sideways by up to m metres (+ to the right of the stage's way), eased in and out
function push(d, i0, i1, m) {
  const k = along(d), xs = Float64Array.from(d.xs), zs = Float64Array.from(d.zs);
  for (let i = i0; i <= i1; i++) { const w = Math.sin(Math.PI * (i - i0) / (i1 - i0)) ** 0.5 * m, t = TAN[k[i]]; xs[i] += -t[1] * w; zs[i] += t[0] * w; }
  return { xs, zs };
}

for (const [car, d] of Object.entries(drives)) {
  assert.equal(stageCheck(d.xs, d.zs, 0), '', `${car}: the record must hold`);
  assert.equal(strict(d), 0, `${car}: no seconds even with no leeway`);
  console.log(`${car.padEnd(8)} ${((d.xs.length - 1) / 10).toFixed(1)} s: holds, 0 s of penalties (also with no leeway)`);
}
const D = drives.impreza, K = along(D);
const at = (k) => K.findIndex((v) => v >= k);
const tell = (what, why) => { console.log(`  ${what}: ${why || 'HOLDS'}`); return why; };

// the start
assert.match(tell('the first 3 s left out', stageCheck(D.xs.slice(30), D.zs.slice(30), 0)), /start line/);
{
  // (through the start spot at the speed of the run's fifth second)
  const v = Math.hypot(D.xs[50] - D.xs[49], D.zs[50] - D.zs[49]), tx = TAN[START][0], tz = TAN[START][1], xs = [], zs = [];
  const j = D.xs.findIndex((_, i) => (D.xs[i] - D.xs[0]) * tx + (D.zs[i] - D.zs[0]) * tz > 40);
  for (let s = 0; s < 40; s += v) { xs.push(D.xs[0] + tx * s); zs.push(D.zs[0] + tz * s); }
  assert.match(tell('through the start at speed', stageCheck(Float64Array.from([...xs, ...D.xs.slice(j)]), Float64Array.from([...zs, ...D.zs.slice(j)]), 0)), /flying start/);
}
// an out-of-bounds bend cut 9 m deep (BENDS: the stage's side there is the inside)
{
  const [b0, b1, sd] = BENDS[0], i0 = at(b0 - 6), i1 = at(b1 + 6), bent = push(D, i0, i1, sd * (HW[b0] + 9));
  const why = tell('a bend cut 9 m inside, no seconds claimed', stageCheck(bent.xs, bent.zs, 0));
  assert.match(why, /penalties: the drive has 1\d s/);
  assert.equal(tell('... with those seconds in the time', stageCheck(bent.xs, bent.zs, +why.match(/has (\d+) s/)[1])), '');
}
// an apex cut 5 m inside the bale, and one passed 20 m inside (not round the bale at all)
{
  const [k, sd] = CHECKS[6], i0 = at(k - 10), i1 = at(k + 10);
  const five = push(D, i0, i1, sd * (HW[k] + 6));
  assert.match(tell('an apex cut 6 m inside the edge, no seconds claimed', stageCheck(five.xs, five.zs, 0)), /penalties/);
  const far = push(D, i0, i1, sd * (HW[k] + 24));
  assert.match(tell('a bale passed 24 m inside', stageCheck(far.xs, far.zs, 0)), /the run ends|misses a corner/);
}
// straight across the park: from a tenth of the way round to nine tenths, in a line at 30 m/s
{
  const i0 = Math.round(D.xs.length * 0.3), i1 = Math.round(D.xs.length * 0.8), L = Math.hypot(D.xs[i1] - D.xs[i0], D.zs[i1] - D.zs[i0]), xs = [], zs = [];
  for (let s = 3; s < L; s += 3) { xs.push(D.xs[i0] + (D.xs[i1] - D.xs[i0]) * s / L); zs.push(D.zs[i0] + (D.zs[i1] - D.zs[i0]) * s / L); }
  const run = { xs: Float64Array.from([...D.xs.slice(0, i0), ...xs, ...D.xs.slice(i1)]), zs: Float64Array.from([...D.zs.slice(0, i0), ...zs, ...D.zs.slice(i1)]) };
  assert.match(tell('half the stage left out across the park', stageCheck(run.xs, run.zs, 0)), /the run ends|misses a corner/);
}
// R: back 4 s along its own path at 60 s, and on from there
{
  const i = 600, r = { xs: Float64Array.from([...D.xs.slice(0, i), ...D.xs.slice(i - 40)]), zs: Float64Array.from([...D.zs.slice(0, i), ...D.zs.slice(i - 40)]) };
  assert.ok(Math.hypot(D.xs[i] - D.xs[i - 40], D.zs[i] - D.zs[i - 40]) > 12);
  assert.match(tell('R once, its 5 s left out', stageCheck(r.xs, r.zs, 0)), /penalties: the drive has 5 s/);
  assert.equal(tell('... with its 5 s in the time', stageCheck(r.xs, r.zs, 5)), '');
}
// a jump forward (not onto its own path)
assert.match(tell('a jump 20 s forward', stageCheck(cut(D, 500, 700).xs, cut(D, 500, 700).zs, 0)), /a jump/);
// the finish passed 8 m to the right of its flag
{
  const i0 = at(FIN - 10), bent = push({ xs: D.xs, zs: D.zs }, i0, D.xs.length - 1, 0);
  const t = TAN[FIN], w = HW[FIN] + 8;
  for (let i = i0; i < bent.xs.length; i++) { const f = (i - i0) / (bent.xs.length - 1 - i0); bent.xs[i] += -t[1] * w * f; bent.zs[i] += t[0] * w * f; }
  assert.match(tell('the finish passed beside its flag', stageCheck(bent.xs, bent.zs, 0)), /finish/);
}
console.log(`ok: ${Object.keys(drives).length} real stage runs hold; a moved start, cuts, a skipped half, an unpaid R and a missed finish are refused (leeway ${EASE} m)`);
