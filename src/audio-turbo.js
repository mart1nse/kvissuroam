// What a turbo's boost pressure does when the throttle snaps shut (src/cars/specs.js engine.turbo.bov
// says which kind; the turbine whistle itself is in the engine synthesiser, public/engine-worklet.js):
//
// - 'vent': a blow-off valve open to the air (F40). A knock as it pops open, a first blast, then the
//   valve flutters on its spring and the air goes in pulses of steam, each one lower than the last and
//   further apart, as the pressure runs out: "PSSH-sh-sh-sh-sh". A low chuff under it gives it weight.
// - 'recirc': a diverter valve that sends the air back round to the intake (Audi 200, the bus): a muffled,
//   gently pulsing whoosh, and if it opens a touch late, the compressor surges first: the "stu-tu-tu"
//   flutter of air bouncing back through the compressor wheel.
// - 'diesel': no throttle and no valve (the Passat TDI): only a soft breath of air as the boost bleeds off.
//
// Everything here is scheduled once on Web Audio nodes that stop themselves; there is nothing to run per
// frame. noise is a looping buffer of white noise; rnd a random source (seeded in the clip tool).

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// a looping noise source through a band-pass into a gain, started at t and stopped at end
function chain(ctx, noise, dest, t, end, q) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise; src.loop = true;
  f.type = 'bandpass'; f.Q.value = q;
  g.gain.value = 0;
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * Math.max(0.01, noise.duration - 0.1)); src.stop(end + 0.05);
  return { f: f.frequency, g: g.gain };
}

// a gain envelope made only of ramps (rise to peak, fall to `mid` by `tm`, then die away by `end`)
function env(g, t, peak, rise, mid, tm, end) {
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + rise);
  g.exponentialRampToValueAtTime(Math.max(0.0002, mid), tm);
  g.exponentialRampToValueAtTime(0.0001, end);
}

// a train of short puffs on one chain: times[k], len[k], level[k], freq[k]
function puffs(ctx, noise, dest, q, list) {
  if (!list.length) return;
  const last = list[list.length - 1];
  const c = chain(ctx, noise, dest, list[0].t, last.t + last.len, q);
  c.g.setValueAtTime(0, list[0].t);
  for (const p of list) {
    c.f.setValueAtTime(p.f, p.t);
    c.g.setValueAtTime(0.0001, p.t);
    c.g.exponentialRampToValueAtTime(Math.max(0.0002, p.level), p.t + Math.min(0.006, p.len * 0.25));
    c.g.exponentialRampToValueAtTime(0.0001, p.t + p.len);
  }
}

// When the pulses of a fluttering valve come: fast at first, slowing as the pressure runs out.
function pulseTimes(t, dur, rate, slow, rnd) {
  const out = [];
  let at = t + 0.07 + 0.03 * rnd();
  while (at < t + dur && out.length < 14) {
    out.push(at);
    at += (1 / rate) * (0.85 + 0.3 * rnd());
    rate *= slow;
  }
  return out;
}

// One band of the steam: a first blast at t, then a pulse at each of `times`, each pulse rising to its
// share of a level that dies away over the whole release, and falling to `depth` below it before the next.
// The band itself drops through the release, and each pulse starts a little above it and sinks: the air
// "revving" down.
function band(ctx, noise, dest, t, dur, all, o) {
  const times = all.filter((x) => x < t + dur - 0.03);
  const c = chain(ctx, noise, dest, t, t + dur + 0.08, o.q);
  const f = (x) => o.f0 * Math.pow(o.f1 / o.f0, clamp((x - t) / dur, 0, 1));
  const lvl = (x) => o.L * Math.exp(-(x - t) / (dur * 0.6));
  c.f.setValueAtTime(o.f0 * 1.15, t);
  c.f.exponentialRampToValueAtTime(f(times[0] ?? t + dur), times[0] ?? t + dur);
  c.g.setValueAtTime(0.0001, t);
  c.g.exponentialRampToValueAtTime(Math.max(0.0002, o.L * 0.85), t + 0.008);
  for (let k = 0; k < times.length; k++) {
    const tp = times[k], next = times[k + 1] ?? t + dur, top = lvl(tp) * o.peak[k];
    c.g.exponentialRampToValueAtTime(Math.max(0.0002, top * (1 - o.depth)), tp);
    c.g.exponentialRampToValueAtTime(Math.max(0.0002, top), tp + Math.min(0.022, (next - tp) * 0.35));
    c.f.setValueAtTime(f(tp) * 1.3, tp);
    c.f.exponentialRampToValueAtTime(f(next) * 0.95, next);
  }
  c.g.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
}

// the whole steamy release, at pressure P and level L
function steam(ctx, noise, dest, t, P, L, rnd, o = {}) {
  const dur = (o.dur ?? 0.45) + 0.55 * P;
  const times = pulseTimes(t, dur, (o.rate ?? 12) + 5 * P, o.slow ?? 0.9, rnd);
  const peak = times.map(() => 0.8 + 0.4 * rnd());           // no two pulses quite alike
  const depth = o.depth ?? 0.85, f0 = (o.f0 ?? 2100) + 700 * P, f1 = o.f1 ?? 330;
  // the wet body of the steam: a wide band, not a whistle
  band(ctx, noise, dest, t, dur, times, { q: 1, f0, f1, L, depth, peak });
  // its sizzle on top
  band(ctx, noise, dest, t, dur * 0.8, times, { q: 1.2, f0: f0 * 2, f1: f1 * 3, L: L * (o.sizzle ?? 0.32), depth, peak });
  // and the low chuff of each pulse in the pipes
  band(ctx, noise, dest, t, dur, times, { q: 1.3, f0: 380, f1: 150, L: L * (o.chuff ?? 0.55), depth: Math.min(0.9, depth + 0.1), peak });
  return dur;
}

// the valve popping open: a pressure knock through the intake pipes
function knock(ctx, dest, t, L) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(115, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
  env(g.gain, t, L, 0.003, L * 0.3, t + 0.03, t + 0.1);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.12);
}

// compressor surge: air bouncing back through the wheel, a fast flutter that slows as it dies
function surge(ctx, noise, dest, t, P, L, rnd) {
  const n = Math.round(4 + 6 * P + rnd() * 2), list = [], low = [];
  let at = t, rate = 19 + 5 * P;
  for (let k = 0; k < n; k++) {
    const per = 1 / rate, lv = L * Math.pow(0.86, k) * (0.85 + 0.3 * rnd());
    list.push({ t: at, len: per * 0.7, level: lv, f: 1050 - 25 * k });
    low.push({ t: at, len: per * 0.6, level: lv * 0.9, f: 300 - 6 * k });
    at += per * (0.92 + 0.16 * rnd());
    rate *= 0.93;
  }
  puffs(ctx, noise, dest, 1.5, list);
  puffs(ctx, noise, dest, 3, low);
  return at - t;
}

// cfg: engine.turbo.bov ({ kind, level, flutter }); P: the boost that was built (0..1)
export function blowOff(ctx, noise, dest, P, cfg = {}, rnd = Math.random, t = ctx.currentTime + 0.005) {
  const kind = cfg.kind || 'vent', lvl = cfg.level ?? 1;
  P = clamp(P, 0, 1.3);
  if (kind === 'vent') {
    const L = Math.min(0.4, 0.36 * P) * lvl;
    knock(ctx, dest, t, L * 0.45);
    steam(ctx, noise, dest, t, P, L, rnd);
    if (P > 0.5 && rnd() < (cfg.flutter ?? 0)) surge(ctx, noise, dest, t + 0.02, P * 0.6, L * 0.3, rnd);
  } else if (kind === 'recirc') {
    const L = Math.min(0.3, 0.26 * P) * lvl;
    let t1 = t;
    // a valve that opens a touch late lets the compressor surge first
    if (P > 0.3 && rnd() < (cfg.flutter ?? 0) * (0.4 + 0.6 * P)) t1 = t + surge(ctx, noise, dest, t, P, L * 0.8, rnd) * 0.55;
    steam(ctx, noise, dest, t1, P, L * 0.6, rnd, { dur: 0.3, f0: 1100, f1: 330, depth: 0.45, rate: 9, sizzle: 0.12, chuff: 0.4 });
  } else {
    const L = Math.min(0.16, 0.14 * P) * lvl, dur = 0.45;
    const a = chain(ctx, noise, dest, t, t + dur, 0.8);
    a.f.setValueAtTime(950, t);
    a.f.exponentialRampToValueAtTime(420, t + dur);
    env(a.g, t, L, 0.03, L * 0.5, t + 0.12, t + dur);
  }
}

// a vent valve on an upshift on boost: two quick chuffs as the throttle plate flicks shut and open
export function shiftChirp(ctx, noise, dest, P, cfg = {}, rnd = Math.random, t = ctx.currentTime + 0.005) {
  if ((cfg.kind || 'vent') !== 'vent' || !cfg.shiftChirp) return;
  const L = Math.min(0.4, 0.36 * clamp(P, 0, 1.3)) * (cfg.level ?? 1) * cfg.shiftChirp;
  const g1 = 0.06 + 0.02 * rnd();
  puffs(ctx, noise, dest, 0.9, [
    { t, len: 0.07, level: L, f: 2000 + 300 * rnd() },
    { t: t + g1, len: 0.05, level: L * 0.6, f: 1500 + 200 * rnd() },
  ]);
  puffs(ctx, noise, dest, 1.4, [
    { t, len: 0.06, level: L * 0.5, f: 330 },
    { t: t + g1, len: 0.045, level: L * 0.3, f: 260 },
  ]);
}
