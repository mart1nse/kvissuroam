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
    // a valve that opens a touch late lets the compressor surge first: the whoosh follows after the first
    // couple of flutters (60 ms or so) and the rest of the flutter runs on under it (Martin 2026-11-19:
    // the whoosh came too late when it waited for most of the flutter, about 0.4 s)
    if (P > 0.3 && rnd() < (cfg.flutter ?? 0) * (0.4 + 0.6 * P)) t1 = t + Math.min(0.07, surge(ctx, noise, dest, t, P, L * 0.7, rnd) * 0.12);
    steam(ctx, noise, dest, t1, P, L * 0.6, rnd, { dur: 0.3, f0: 1100, f1: 330, depth: 0.45, rate: 9, sizzle: 0.12, chuff: 0.4 });
  } else {
    const L = Math.min(0.16, 0.14 * P) * lvl, dur = 0.45;
    const a = chain(ctx, noise, dest, t, t + dur, 0.8);
    a.f.setValueAtTime(950, t);
    a.f.exponentialRampToValueAtTime(420, t + dur);
    env(a.g, t, L, 0.03, L * 0.5, t + 0.12, t + dur);
  }
}

// An upshift on boost. The gearbox works like a quick manual change, and a driver lifts for every one:
// the throttle plate shuts and the valve vents the boost (Martin 2026-11-22). It plays only in the gap of
// the change: a first blast, then a few quick pulses. The whole sound is pulled down to a whisper by the
// time the gear is heard biting (SHIFT_BITE, audio-shift.js BITE_HEARD), so the bark, the clunk, the tyre
// chirp and the rev swing of the upshift kick land as they did before, and it fades out under them, as in
// a real car where the valve shuts once the throttle opens again. There is no low chuff, because the
// bite's thump lives down there. cfg.shift scales it (0: none, e.g. the bus, an automatic with a torque
// converter); diesels have no valve.
//
// No two are alike (Martin 2026-11-22: not repetitive). How much air there is to let out depends on:
// - P, the boost at the change: a full pssh after a hard pull, a breath on a gentle short shift;
// - o.held, how long it pulled on boost: a quick dab has not filled the pipes and the intercooler yet;
// - o.rev, the revs at the change as a share of the redline: the turbo moves more air high up, and a
//   short shift at 60 % lets out less;
// - the change itself (rnd): how fast the foot comes off, how the valve seats, so the size of the puff,
//   its length, its pulses and its pitch all wander a little from one shift to the next.
// The valve opens a moment after the cut (Martin: it came too soon after the clutch on the 22B and the
// Audi). A diverter valve (recirc) opens on the vacuum behind the shut throttle plate, 30 to 50 ms, a
// touch sooner on high boost; a valve open to the air (vent) is quicker, 10 to 20 ms. The gap left before
// the bite is shorter for it: the whoosh is cut off by the gear going in, as it is in a real car. A late
// diverter on a hard shift sometimes lets the compressor surge first: a quick tu-tu in that delay.
// Returns whether anything was played.
const SHIFT_BITE = 0.12;
export function shiftBlowOff(ctx, noise, dest, P, cfg = {}, o = {}, rnd = Math.random, t0 = ctx.currentTime + 0.005) {
  const kind = cfg.kind || 'vent', k = cfg.shift ?? 1.4;
  P = clamp(P, 0, 1.3);
  if (kind === 'diesel' || !(k > 0) || P < 0.15) return false;
  const fill = clamp((o.held ?? 1) / 0.8, 0.25, 1);
  const revs = 0.7 + 0.45 * clamp(((o.rev ?? 0.9) - 0.5) / 0.5, 0, 1);
  const A = Math.pow(P, 1.5) * Math.pow(fill, 0.7) * revs * (0.72 + 0.48 * rnd());
  const L = Math.min(0.45, 0.36 * A) * (cfg.level ?? 1) * k;
  // the duck, timed from the cut: full until just before the bite, under a fifth as it bites, then gone
  const duck = ctx.createGain();
  duck.gain.setValueAtTime(1, t0);
  duck.gain.setValueAtTime(1, t0 + SHIFT_BITE - 0.03);
  duck.gain.linearRampToValueAtTime(0.18, t0 + SHIFT_BITE + 0.01);
  duck.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
  duck.connect(dest);
  const dur = (0.16 + 0.1 * A) * (0.85 + 0.3 * rnd()), wob = 0.92 + 0.16 * rnd();
  if (kind === 'vent') {
    const t = t0 + (0.01 + 0.01 * rnd()) * (1.2 - 0.3 * clamp(A, 0, 1));
    knock(ctx, duck, t, L * 0.3);
    const times = pulseTimes(t, dur, (15 + 8 * A) * (0.85 + 0.3 * rnd()), 0.88 + 0.05 * rnd(), rnd), peak = times.map(() => 0.75 + 0.5 * rnd());
    const f0 = (2100 + 700 * P) * wob;
    band(ctx, noise, duck, t, dur, times, { q: 1, f0, f1: 900 * wob, L, depth: 0.85, peak });
    band(ctx, noise, duck, t, dur * 0.8, times, { q: 1.2, f0: f0 * 2, f1: 2700 * wob, L: L * 0.32, depth: 0.85, peak });
  } else {
    const t = t0 + (0.03 + 0.02 * rnd()) * (1.2 - 0.3 * clamp(A, 0, 1));
    // the compressor surging while the valve is still shut (only the upper band: no low puffs)
    if (A > 0.5 && rnd() < (cfg.flutter ?? 0) * 0.6 * Math.min(1, A)) {
      const list = [], n = 2 + Math.floor(rnd() * 2);
      for (let j = 0, at = t0 + 0.004; j < n; j++, at += 0.042 + 0.01 * rnd()) list.push({ t: at, len: 0.028, level: L * 0.42 * Math.pow(0.8, j), f: 1050 - 30 * j });
      puffs(ctx, noise, duck, 1.5, list);
    }
    // a diverter valve: the muffled whoosh, gently pulsing
    const times = pulseTimes(t, dur, (11 + 6 * A) * (0.85 + 0.3 * rnd()), 0.88 + 0.05 * rnd(), rnd), peak = times.map(() => 0.75 + 0.5 * rnd());
    band(ctx, noise, duck, t, dur, times, { q: 1, f0: (1100 + 300 * P) * wob, f1: 650 * wob, L: L * 0.6, depth: 0.45, peak });
    band(ctx, noise, duck, t, dur * 0.8, times, { q: 1.2, f0: 2400 * wob, f1: 1500 * wob, L: L * 0.08, depth: 0.45, peak });
  }
  return true;
}
