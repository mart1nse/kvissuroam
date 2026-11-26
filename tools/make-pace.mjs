// The fastest known way round the lap, gate by gate (worker/pace.json), from the record drives kept in
// tools/fixtures/replays: for each stretch between two gates the shortest time any of them took, summed. The
// server holds a racer's progress against it (worker/follow.js): after a gap in a racer's positions (a lost
// connection, a server restart) the car may be no further on than this pace allows.
//   node tools/make-pace.mjs        (again whenever the lap or its gates change: tools/follow-test.mjs says so)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const here = (p) => new URL(p, import.meta.url);
const LAP = JSON.parse(readFileSync(here('../src/race/track.json')));
const { lapGates, throughGate } = await import(here('../src/race/lapgates.js').href);
const { finishLine } = await import(here('../worker/lapline.js').href);

const gates = [...lapGates(LAP), finishLine(LAP)];
const best = new Array(gates.length).fill(Infinity);
let used = 0;
for (const f of readdirSync(here('./fixtures/replays/'))) {
  if (!f.endsWith('.gz') || f.includes('tuned')) continue;
  const a = gunzipSync(readFileSync(here(`./fixtures/replays/${f}`))).toString().split(',').map(Number);
  const n = a[3], fl = a[1], xs = [], zs = [];
  let x = 0, z = 0;
  for (let i = 0; i < n; i++) { x += a[4 + i * fl] / 100; z += a[4 + i * fl + 1] / 100; xs.push(x); zs.push(z); }
  // when the drive crosses each gate, in order (s into the lap)
  const t = [];
  let g = 0;
  const last = (k, i) => k < gates.length - 1 || i > n - 30;
  for (let i = 1; i < n && g < gates.length; i++) {
    for (;;) {
      if (g < gates.length && last(g, i) && throughGate(gates[g], xs[i - 1], zs[i - 1], xs[i], zs[i])) { t.push(i * 0.1); g++; }
      // (one gate missed is forgiven when the next is passed, as in the game: no time for it)
      else if (g + 1 < gates.length && last(g + 1, i) && throughGate(gates[g + 1], xs[i - 1], zs[i - 1], xs[i], zs[i])) { t.push(NaN, i * 0.1); g += 2; }
      else break;
    }
  }
  // (a replay ends on the line itself)
  if (t.length === gates.length - 2) t.push(NaN);
  if (t.length === gates.length - 1) t.push(a[2] / 1000);
  if (t.length !== gates.length) { console.log(`${f}: only ${t.length} of ${gates.length} gates, left out`); continue; }
  used++;
  for (let k = 0; k < gates.length; k++) { const d = t[k] - (k ? t[k - 1] : 0); if (d > 0) best[k] = Math.min(best[k], d); }
}
const T = [0];
for (const d of best) T.push(Math.round((T.at(-1) + d * 1000)));
writeFileSync(here('../worker/pace.json'), JSON.stringify({ gates: gates.length, at: gates.map((g) => g.i), t: T }) + '\n');
console.log(`${used} drives, ${gates.length} gates, best parts add up to ${(T.at(-1) / 1000).toFixed(1)} s`);
