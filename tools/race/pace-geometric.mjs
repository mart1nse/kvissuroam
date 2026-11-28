// A circuit's fastest pace gate by gate from its shape alone, for a circuit nobody has driven a record on yet
// (Tallinn's Pirita-Kose, 28 Nov 2026: worker/pace-pirita.json). The server lets a racer whose positions stopped
// for a while be found again further on only as far as this pace allows (worker/follow.js findAgain), so it has to
// be faster than anyone can drive: each 2 m of the lap at the speed its bend allows at LAT m/s2 sideways (twice what a car holds: a record line cuts the bends the centre line follows), never
// over V_MAX, with no time lost braking or speeding up. Checked against Toomemägi, where the record drives give the
// real table (tools/make-pace.mjs): this is quicker on every stretch there.
//   node tools/race/pace-geometric.mjs pirita       (writes worker/pace-pirita.json)
//   node tools/race/pace-geometric.mjs toome        (only compares with worker/pace.json)
import { readFileSync, writeFileSync } from 'node:fs';
const here = (p) => new URL(p, import.meta.url);
const which = process.argv[2] || 'pirita';
const LAP = JSON.parse(readFileSync(here(which === 'toome' ? '../../src/race/track.json' : '../../src/race/pirita.json')));
const { lapGates } = await import(here('../../src/race/lapgates.js').href);
const { finishLine } = await import(here('../../worker/lapline.js').href);
const LAT = 30, V_MAX = 95;
const P = LAP.pts, N = P.length;
// the radius of the bend at each point, from the points 8 either side
const speed = P.map((_, i) => {
  const a = P[(i - 8 + N) % N], b = P[i], c = P[(i + 8) % N];
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ac = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const R = area2 > 1e-6 ? (ab * bc * ac) / (2 * area2) : Infinity;
  return Math.min(V_MAX, Math.sqrt(LAT * R));
});
// seconds from the line to each point
const T = [0];
for (let i = 1; i <= N; i++) {
  const a = P[i - 1], b = P[i % N];
  T.push(T[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]) / speed[i - 1]);
}
const gates = [...lapGates(LAP), finishLine(LAP)];
const at = gates.map((g) => g.i);
const t = [0, ...gates.map((g, k) => Math.round((k === gates.length - 1 ? T[N] : T[g.i]) * 1000))];
console.log(which, 'gates', gates.length, 'lap', (T[N]).toFixed(1), 's');
if (which === 'toome') {
  const real = JSON.parse(readFileSync(here('../../worker/pace.json')));
  let slower = 0;
  for (let k = 1; k < t.length; k++) if (t[k] - t[k - 1] > real.t[k] - real.t[k - 1]) slower++;
  console.log('real record pace', real.t.at(-1) / 1000, 's; stretches where this is slower than the records:', slower);
} else {
  writeFileSync(here('../../worker/pace-pirita.json'), JSON.stringify({ gates: gates.length, at, t, from: 'tools/race/pace-geometric.mjs' }));
}
