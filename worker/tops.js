// The lap board's five best per car (Martin, 26 Nov 2026: "more times, to be more engaging and worthwhile to get to the
// board"): on each circuit and for each car the five fastest drivers, one line a driver with their best, of all time
// and of today (Tartu's day), and where a time of one's own would place among that car's drivers.
// The lobby makes this once from the laps on the board and then only adds each new one (addTop), as it does the
// board itself. Pure functions, so tools/top-test.mjs can hold them against every stored lap.

export const TOP_SHOW = 5;

// a driver is a name, whatever its capitals (the server's names are unique that way: nameTaken)
const who = (name) => String(name).toLowerCase();

// the faster of two laps; of two equal times the one driven first
const ahead = (a, b) => a.ms < b.ms || (a.ms === b.ms && a.at < b.at);

// rows: laps on the board { track, car, name, ms, at, day, inp, ty, pen }; day: today in Tartu (YYYY-MM-DD)
export function makeTops(rows, day) {
  const t = { day, tracks: {} };
  for (const r of rows) addTop(t, r);
  return t;
}

// a lap that has just gone on the board
export function addTop(t, r) {
  const cars = (t.tracks[r.track] ||= {});
  const c = (cars[r.car] ||= { all: new Map(), today: new Map() });
  keep(c.all, r);
  if (r.day === t.day) keep(c.today, r);
}

function keep(m, r) {
  const k = who(r.name), had = m.get(k);
  if (had && !ahead(r, had)) return;
  m.set(k, { name: r.name, ms: r.ms, at: r.at, inp: r.inp ?? null, ty: r.ty ?? null, ...(r.pen ? { pen: r.pen } : {}) });
}

// past midnight in Tartu: today's lists start again
export function newDay(t, day) {
  if (t.day === day) return;
  t.day = day;
  for (const cars of Object.values(t.tracks)) for (const c of Object.values(cars)) c.today.clear();
}

// the n fastest drivers of a list, fastest first
export function topOf(m, n = TOP_SHOW) {
  return [...m.values()].sort((a, b) => a.ms - b.ms || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)).slice(0, n);
}

// where a time of `me`'s would place among the car's drivers: one more than the other drivers with a faster best
// (me's own times on the board do not count against it)
export function placeOf(m, me, ms) {
  const k = who(me);
  let n = 1;
  for (const [kk, r] of m) if (kk !== k && r.ms < ms) n++;
  return n;
}
