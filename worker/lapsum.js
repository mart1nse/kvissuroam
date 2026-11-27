// The laps on the lap boards in a few numbers, for /stats (Martin 27 Nov 2026: "how many laps started, completed etc
// all time"): on each circuit how many laps went on the board, by how many drivers, since when, driven with which
// controls and how many with penalty seconds; and the same per car with its fastest lap. The page's own counts (laps
// started, how they ended) come from the game stats; these are the board's, every finished lap since it began.
// The lobby makes this once from the laps on the board, in the same reading of the table as the five best per car
// (worker/tops.js), and then adds each new lap. Pure functions, so tools/lap-stats-test.mjs can hold them to the table.

// a driver is a name, whatever its capitals (as on the board: worker/tops.js)
const who = (name) => String(name).toLowerCase();

// rows: laps on the board { track, car, name, ms, at, inp, pen }
export function makeSum(rows) {
  const s = { tracks: {} };
  for (const r of rows) addSum(s, r);
  return s;
}

// a lap that has just gone on the board
export function addSum(s, r) {
  const T = (s.tracks[r.track] ||= { n: 0, first: r.at, names: new Set(), inp: {}, pen: 0, cars: {} });
  const k = who(r.name), i = r.inp || 'kb';
  T.n++;
  if (r.at < T.first) T.first = r.at;
  T.names.add(k);
  T.inp[i] = (T.inp[i] || 0) + 1;
  if (r.pen) T.pen++;
  const c = (T.cars[r.car] ||= { n: 0, names: new Set(), pen: 0, best: null });
  c.n++;
  c.names.add(k);
  if (r.pen) c.pen++;
  if (!c.best || r.ms < c.best.ms || (r.ms === c.best.ms && r.at < c.best.at)) c.best = { ms: r.ms, name: r.name, at: r.at };
}

// what /stats is sent: { toomemagi: { laps, drivers, first, inp: { kb: n }, pen, cars: { car: { laps, drivers, pen,
// ms, name } } }, raadi: ... }
export function sumView(s) {
  const out = {};
  for (const [t, T] of Object.entries(s.tracks)) {
    const cars = {};
    for (const [car, c] of Object.entries(T.cars)) cars[car] = { laps: c.n, drivers: c.names.size, pen: c.pen, ms: c.best.ms, name: c.best.name };
    out[t] = { laps: T.n, drivers: T.names.size, first: T.first, inp: { ...T.inp }, pen: T.pen, cars };
  }
  return out;
}
