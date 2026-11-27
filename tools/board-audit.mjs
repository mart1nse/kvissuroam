// A look at the lap boards from outside (26 Nov 2026: two Audi 200 records stood for a night, driven in a car whose
// figures had been changed in the browser, until a player wrote in). Run each night with the performance check
// (CLAUDE.md, "For the nightly run"), and by hand when a record looks wrong.
//   node tools/board-audit.mjs [--site https://www.linnaring.com] [--json out.json] [--days 3] [--from folder] [--all]
// It reads only what anyone can: /api/laps.json, each record's drive (/api/replay), the list of refused drives and
// how near play came to the server's leeways (/api/margins).
//   1) every car's record on each track: its drive through the car check again (src/race/plausible.js, with the
//      car's figures as they are in the code now), a Raadi run through the stage's rules as well
//      (worker/stagecheck.js), and whether the drive that is stored is that lap's at all
//   2) every lap on the board: its split times against the rest of that car's laps by other drivers. A part of the
//      lap driven far faster than anybody else has in that car is what a changed car looks like in the splits
//      (the tuned Audi's third part: 34.2 s, the best of 635 other laps 39.2), and the parts next to it with it.
//   3) what the server refused in the last 24 hours, counted by reason
//   4) the leeways: how far the server's clock was from the lap times, the racers' finish times from the server's
//      sighting, and how much of each leeway ordinary play used (a note when it is over six tenths)
// Prints one line when all is well, and a line for each thing worth a look. --from reads laps.json and
// replay-<track>-<car>.gz from a folder instead of the site (the test of this script does).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { register } from 'node:module';
import { CARS } from '../src/cars/specs.js';
import { carLimits, judgeDrive, OVER_MAX } from '../src/race/plausible.js';
// (the stage's rules read the stage from a .json, which node wants told)
register('data:text/javascript,' + encodeURIComponent(`export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const { stageCheck } = await import('../worker/stagecheck.js');

const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const SITE = arg('site', 'https://www.linnaring.com'), FROM = arg('from'), OUT = arg('json');
const DAYS = Number(arg('days', 3));     // split times: only laps of the last so many days are reported (0: all), the older ones were looked at on their night
const CLOSE = OVER_MAX / 2;        // seconds over a limit that are worth a line though the drive holds
const PART_K = 0.96;               // a part of the lap under this share of the best by any other driver in the car
const PAIR_K = 0.97;               // ... and with the part before it under this share of the best such pair
const PART_MIN = 20;               // ... when at least this many laps by others in that car have splits
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (ms) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(2).padStart(5, '0')}`;

async function get(path, kind) {
  if (FROM) {
    if (path.startsWith('/api/laps.json')) return JSON.parse(readFileSync(`${FROM}/laps.json`));
    if (path.includes('refused')) return existsSync(`${FROM}/refused.json`) ? JSON.parse(readFileSync(`${FROM}/refused.json`)) : [];
    const q = new URL(path, 'http://x').searchParams, f = `${FROM}/replay-${q.get('track')}-${q.get('car')}.gz`;
    return existsSync(f) ? { ms: null, bytes: readFileSync(f) } : null;
  }
  for (let k = 0; ; k++) {
    const r = await fetch(SITE + path, { headers: { 'user-agent': 'linnaring-board-audit' } });
    if (r.status === 429 && k < 4) { await sleep(15000); continue; }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return kind === 'bytes' ? { ms: Number(r.headers.get('x-ms')), name: decodeURIComponent(r.headers.get('x-name') || ''), bytes: Buffer.from(await r.arrayBuffer()) } : r.json();
  }
}

const laps = await get('/api/laps.json');
// (--all: with the laps taken off the board too, to see what this would have said of them)
// (the drag strip's quarter miles have no drive stored: the server judges them by src/race/dragrules.js as they come)
const board = laps.filter((l) => l.track !== 'drag' && (l.hold == null || (process.argv.includes('--all') && l.hold === 2)));
const notes = [], out = { at: new Date().toISOString(), site: FROM || SITE, laps: laps.length, records: [], parts: [], refused: {} };

// ---- 1) the records' drives
const records = new Map();
for (const l of board) { const k = `${l.track}|${l.car}`; if (!records.has(k) || l.ms < records.get(k).ms) records.set(k, l); }
const limits = new Map();
for (const l of [...records.values()].sort((a, b) => a.track.localeCompare(b.track) || a.car.localeCompare(b.car))) {
  const row = { track: l.track, car: l.car, name: l.name, ms: l.ms, at: l.at };
  out.records.push(row);
  const spec = CARS[l.car];
  if (!spec) { row.note = 'a car the game does not have'; notes.push(`${l.track} ${l.car} ${fmt(l.ms)} ${l.name}: a car the game does not have`); continue; }
  const rp = await get(`/api/replay?track=${l.track}&car=${l.car}`, 'bytes');
  if (!FROM) await sleep(400);
  if (!rp) { row.note = 'no drive stored'; if (l.at > '2026-11-26') notes.push(`${l.track} ${l.car} ${fmt(l.ms)} ${l.name}: on the board with no drive stored`); continue; }
  let a;
  try { a = gunzipSync(rp.bytes).toString().split(',').map(Number); } catch { row.note = 'drive unreadable'; notes.push(`${l.track} ${l.car}: the stored drive cannot be read`); continue; }
  const [, f, ms, n] = a;
  // (a stage time has its penalty seconds on top of the drive's own time)
  if (Math.abs(ms + (l.pen || 0) * 1000 - l.ms) > 2) { row.note = `the stored drive is of ${fmt(ms)}`; if (l.at > '2026-11-26') notes.push(`${l.track} ${l.car} ${fmt(l.ms)} ${l.name}: the stored drive is another lap's (${fmt(ms)})`); continue; }
  const xs = new Float64Array(n), zs = new Float64Array(n), ys = new Float64Array(n), roll = new Float64Array(n);
  let x = 0, z = 0, y = 0, ro = 0;
  for (let i = 0; i < n; i++) { x += a[4 + i * f]; z += a[5 + i * f]; y += a[6 + i * f]; ro += a[9 + i * f]; xs[i] = x / 100; zs[i] = z / 100; ys[i] = y / 100; roll[i] = ro / 1000; }
  if (!limits.has(l.car)) limits.set(l.car, carLimits(spec));
  const lim = limits.get(l.car), where = {};
  // (a car with thrusters: BOOST worked on timed runs until Martin's 27 Nov "lets remove boost option from timed
  // efforts", live that evening; its laps since are judged by the motors alone, as the server does)
  const boosted = !!lim?.gas && l.at < '2026-11-28';
  if (l.track === 'raadi') {
    // (a car with thrusters leaves the start line harder than the others: on BOOST, and since 27 Nov on its motors)
    row.stage = stageCheck(xs, zs, l.pen || 0, boosted ? lim.gas.launch : lim?.full?.pull?.[0] || 0, where);
    if (row.stage) notes.push(`${l.track} ${l.car} ${fmt(l.ms)} ${l.name}: THE RUN DOES NOT HOLD by the stage's rules (${row.stage})`);
  }
  if (!lim) { row.note = 'not judged'; continue; }
  const j = judgeDrive(xs, zs, ys, lim, { roll, loose: where.loose, noGas: !boosted });   // (a stage run's gravel against gravel's grip)
  row.over = { pull: j.pull, grip: j.grip, stop: j.stop, top: j.top };
  // (a car with thrusters, the Rocket: the gas its drive used over what the tank held, of a full tank, the tanks it
  // was counted to use in all, and the seconds of a kickflip in it)
  const gas = boosted ? `; gas over ${j.gas} of a tank, ${j.spent} tanks used, ${j.air} s of a kickflip` : '';
  if (lim.gas) Object.assign(row.over, boosted ? { gas: j.gas, spent: j.spent, air: j.air } : { air: j.air });
  const worst = Math.max(j.pull, j.grip, j.stop, j.top);
  if (j.why) notes.push(`${l.track} ${l.car} ${fmt(l.ms)} ${l.name}: THE DRIVE DOES NOT HOLD for this car (seconds over: pull ${j.pull}, grip ${j.grip}, stop ${j.stop}, top ${j.top}${gas})`);
  else if (worst > CLOSE) notes.push(`${l.track} ${l.car} ${fmt(l.ms)} ${l.name}: near a limit (seconds over: pull ${j.pull}, grip ${j.grip}, stop ${j.stop}, top ${j.top}; refused past ${OVER_MAX})`);
}

// ---- 2) the split times
const parts = (l) => {
  if (!l.splits || !l.cp) return null;
  let s; try { s = JSON.parse(l.splits); } catch { return null; }
  if (!Array.isArray(s) || !s.length || !s.every((v, i) => v > 0 && (!i || v > s[i - 1])) || s.at(-1) >= l.ms) return null;
  return [...s.map((v, i) => v - (i ? s[i - 1] : 0)), l.ms - s.at(-1)];
};
const byCar = new Map();
for (const l of board) {
  const p = parts(l);
  if (!p) continue;
  const k = `${l.track}|${l.car}|${l.cp}`;
  if (!byCar.has(k)) byCar.set(k, []);
  byCar.get(k).push({ l, p });
}
for (const rows of byCar.values()) {
  const names = new Set(rows.map((r) => r.l.name.toLowerCase()));
  if (rows.length < PART_MIN || names.size < 3) continue;
  for (const { l, p } of rows) {
    const me = l.name.toLowerCase(), others = rows.filter((r) => r.l.name.toLowerCase() !== me);
    if (others.length < PART_MIN) continue;
    // (with the part before it too: a checkpoint is a circle 14 m wide, and a line that clips it late moves seconds
    // from the part before into this one without the car being any faster; Winbaum's records of 25 Nov read like
    // that, 3 s "gained" in the last part and lost in the one before. The first part is held with the second.)
    const bestOf = (f) => Math.min(...others.map((r) => f(r.p)));
    for (let i = 0; i < p.length; i++) {
      if (DAYS && Date.parse(l.at) < Date.now() - DAYS * 86400000) break;
      const best = bestOf((q) => q[i] ?? Infinity);
      if (!(p[i] < best * PART_K)) continue;
      const j = i > 0 ? i - 1 : 1;
      if (p.length > 1 && !(p[i] + p[j] < bestOf((q) => q[i] + q[j]) * PAIR_K)) continue;
      out.parts.push({ track: l.track, car: l.car, name: l.name, ms: l.ms, at: l.at, id: l.id, part: i + 1, of: p.length, s: p[i] / 1000, best: best / 1000, others: others.length });
    }
  }
}
// (one line a lap: its part furthest ahead of the rest; a driver's fastest such lap in a car)
const worstOf = new Map();
for (const r of out.parts) { const k = `${r.track}|${r.car}|${r.name.toLowerCase()}`, h = worstOf.get(k); if (!h || r.s / r.best < h.s / h.best) worstOf.set(k, r); }
for (const r of [...worstOf.values()].sort((a, b) => a.s / a.best - b.s / b.best).slice(0, 15)) {
  notes.push(`${r.track} ${r.car} ${fmt(r.ms)} ${r.name} (lap ${r.id}, ${r.at.slice(0, 10)}): part ${r.part} of ${r.of} in ${r.s.toFixed(1)} s, the best of ${r.others} laps by others in that car ${r.best.toFixed(1)} s`);
}

// ---- 3) refused in the last 24 hours
const refused = await get('/api/replay?refused=1').catch(() => []);
const since = Date.now() - 86400000;
for (const r of refused || []) if (Date.parse(r.at) > since) { const k = r.why.startsWith('race') ? 'race finish' : r.why.split(':')[0].split(' ')[0]; out.refused[k] = (out.refused[k] || 0) + 1; }
const ref = Object.entries(out.refused).map(([k, n]) => `${k} ${n}`).join(', ');

// ---- 4) how near play came to the server's leeways in the last three days (GET /api/margins)
const mg = FROM ? null : await get('/api/margins').catch(() => null);
const room = [];
if (mg?.kinds) {
  out.margins = mg.kinds;
  const s1 = (v) => `${v > 0 ? '+' : ''}${(v / 1000).toFixed(2)}`;
  const c = mg.kinds.clock, f = mg.kinds.fin, g = mg.kinds.gaps, rc = mg.kinds.rcar, cr = mg.kinds.car;
  if (c?.n) {
    room.push(`lap clock: ${c.n} laps, the server's clock against the lap time from ${s1(c.min)} to ${s1(c.max)} s (98 in 100 within ${s1(c.p1)} to ${s1(c.p99)}); leeway ${s1(c.lo)} to ${s1(c.hi)} s, ${c.out} outside`);
    // (a page that runs under 20 frames a second reads 2 s over by design: its clock may lose that much to slow
    // frames, SLOW_FREE in src/race/race.js. The first 17 laps of 26 Nov: half within 0.03 s, one at +2.02 s. What
    // is watched is the rest of the leeway, the marks' way to the server.)
    const SLOW = 2000;
    if (c.p99 > SLOW + 0.6 * (c.hi - SLOW) || c.p1 < 0.6 * c.lo) notes.push(`the lap clock's leeway is nearly used by ordinary laps (98 in 100 within ${s1(c.p1)} to ${s1(c.p99)} s of ${s1(c.lo)} to ${s1(c.hi)})`);
  }
  if (f?.n) {
    room.push(`race finishes: ${f.n}, the racer's own time ${s1(f.p1)} to ${s1(f.p99)} s before the server saw the car over the line, at most ${s1(f.max)} (leeway ${s1(f.hi)} s, ${f.out} beyond it and counted from the server's sighting)${g?.n ? `; gaps in positions at most ${g.max} of ${g.hi}` : ''}${rc?.n ? `; car check at most ${rc.max} s over, of ${rc.hi}` : ''}`);
    if (f.p99 > 0.6 * f.hi) notes.push(`the race finish's leeway is nearly used by ordinary finishes (99 in 100 within ${s1(f.p99)} s of ${s1(f.hi)})`);
    if (g?.n && g.max >= g.hi) notes.push(`a racer used all ${g.hi} gaps in positions a race allows`);
  }
  if (cr?.n) room.push(`record drives sent: ${cr.n}, at most ${cr.max} s over a limit, of ${cr.hi}`);
  // (a record's drive against where the server saw the car while the lap was driven: worker/livecheck.js)
  const lv = mg.kinds.live;
  if (lv?.n) {
    const pc = (v) => Math.round(v * 100);
    room.push(`record drives against where the car was seen: ${lv.n}, at most ${pc(lv.max)} in 100 of the places off the drive (leeway ${pc(lv.hi)}), ${lv.out} beyond it`);
    if (lv.p50 > 0.6 * lv.hi) notes.push(`half the record drives sent have over ${pc(0.6 * lv.hi)} in 100 of the places the car was seen at off the drive (leeway ${pc(lv.hi)}): the check is too tight or the places come late`);
  }
}

out.notes = notes;
const judged = out.records.filter((r) => r.over).length;
console.log(`BOARDS: ${out.records.length} records (${judged} drives judged against their car), ${[...byCar.values()].reduce((s, r) => s + r.length, 0)} laps' split times compared. ${notes.length ? `${notes.length} worth a look:` : 'Nothing stands out.'}`);
for (const n of notes) console.log(`  ${n}`);
console.log(`  refused by the server in the last 24 h (of its last 50): ${ref || 'none'}`);
for (const r of room) console.log(`  ${r}`);
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
