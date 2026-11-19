// Turbo sounds that are not the engine itself: the whistle of the spinning turbine and what the boost
// pressure does when the throttle snaps shut (src/cars/specs.js engine.turbo.bov says which kind):
//
// - 'vent': a blow-off valve open to the air (F40). A crack as it pops open, a falling "pssh" through the
//   valve seat with a thin metallic edge on top, and often, as the last of the pressure goes, the valve
//   chattering on its spring: the air leaves in a few short chunks, further apart each time. Now and then
//   it shuts and lifts once more, a second, smaller pssh.
// - 'recirc': a diverter valve that sends the air back round to the intake (Audi 200, the bus): a muffled
//   whoosh, and if it opens a touch late, the compressor surges first: the "stu-tu-tu" flutter of air
//   bouncing back through the compressor wheel.
// - 'diesel': no throttle and no valve (the Passat TDI): only a soft breath of air as the boost bleeds off.
//
// Everything here is scheduled once on Web Audio nodes that stop themselves; there is nothing to run per
// frame. noise is a looping buffer of white noise.

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// a looping noise source through a band-pass into a gain, started at t and stopped at end
function chain(ctx, noise, dest, t, end, q) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise; src.loop = true;
  f.type = 'bandpass'; f.Q.value = q;
  g.gain.value = 0;
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * Math.max(0.01, noise.duration - 0.1)); src.stop(end + 0.03);
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

// the vent valve's pssh, at pressure P (0..1.3) and level L
function pssh(ctx, noise, dest, t, P, L) {
  const dur = 0.2 + 0.32 * P;
  const a = chain(ctx, noise, dest, t, t + dur, 1.1);
  a.f.setValueAtTime(2700 + 1500 * P, t);
  a.f.exponentialRampToValueAtTime(950, t + dur);
  env(a.g, t, L, 0.005, L * 0.42, t + 0.045, t + dur);
  // the thin, metallic edge of air through the valve seat, gone as the pressure falls
  const e = chain(ctx, noise, dest, t, t + 0.2, 8);
  e.f.setValueAtTime(5000 + 1400 * P, t);
  e.f.exponentialRampToValueAtTime(2900, t + 0.18);
  env(e.g, t, L * 0.55, 0.004, L * 0.2, t + 0.05, t + 0.19);
  return dur;
}

// the valve popping open: a pressure knock through the intake pipes
function knock(ctx, dest, t, L) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.07);
  env(g.gain, t, L, 0.003, L * 0.3, t + 0.03, t + 0.09);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.1);
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

// cfg: engine.turbo.bov ({ kind, level, chunks, flutter }); P: the boost that was built (0..1)
export function blowOff(ctx, noise, dest, P, cfg = {}, rnd = Math.random, t = ctx.currentTime + 0.005) {
  const kind = cfg.kind || 'vent', lvl = cfg.level ?? 1;
  P = clamp(P, 0, 1.3);
  if (kind === 'vent') {
    const L = Math.min(0.4, 0.36 * P) * lvl;
    knock(ctx, dest, t, L * 0.7);
    const dur = pssh(ctx, noise, dest, t, P, L);
    // now and then the valve shuts once and lifts again on what is left: a second, smaller pssh
    let end = t + dur;
    if (P > 0.7 && rnd() < 0.3 * (cfg.chunks ?? 1)) {
      const t2 = t + 0.1 + 0.07 * rnd();
      end = t2 + pssh(ctx, noise, dest, t2, P * 0.55, L * 0.5);
    }
    // the last of the pressure: the valve chatters on its spring and the air goes in chunks
    if (P > 0.4 && rnd() < (0.35 + 0.45 * P) * (cfg.chunks ?? 1)) {
      const n = 1 + Math.floor(rnd() * (1.5 + 3 * P)), list = [];
      let at = end - dur * 0.35, gap = 0.05 + 0.025 * rnd();
      for (let k = 0; k < Math.min(5, n); k++) {
        at += gap;
        list.push({ t: at, len: 0.032 + 0.03 * rnd(), level: L * 0.6 * Math.pow(0.68, k), f: 2300 - 180 * k + 300 * rnd() });
        gap *= 1.2 + 0.2 * rnd();
      }
      puffs(ctx, noise, dest, 1.7, list);
    }
    if (P > 0.5 && rnd() < (cfg.flutter ?? 0)) surge(ctx, noise, dest, t + 0.02, P * 0.6, L * 0.35, rnd);
  } else if (kind === 'recirc') {
    const L = Math.min(0.3, 0.26 * P) * lvl;
    let t1 = t;
    // a valve that opens a touch late lets the compressor surge first
    if (P > 0.3 && rnd() < (cfg.flutter ?? 0) * (0.4 + 0.6 * P)) t1 = t + surge(ctx, noise, dest, t, P, L * 0.8, rnd) * 0.55;
    const dur = 0.3 + 0.35 * P, a = chain(ctx, noise, dest, t1, t1 + dur, 0.7);
    a.f.setValueAtTime(1400 + 500 * P, t1);
    a.f.exponentialRampToValueAtTime(550, t1 + dur);
    env(a.g, t1, L * 0.6, 0.02, L * 0.3, t1 + 0.1, t1 + dur);
  } else {
    const L = Math.min(0.16, 0.14 * P) * lvl, dur = 0.45;
    const a = chain(ctx, noise, dest, t, t + dur, 0.8);
    a.f.setValueAtTime(950, t);
    a.f.exponentialRampToValueAtTime(420, t + dur);
    env(a.g, t, L, 0.03, L * 0.5, t + 0.12, t + dur);
  }
}

// a vent valve on an upshift on boost: two quick "tsh-tsh" as the throttle plate flicks shut and open
export function shiftChirp(ctx, noise, dest, P, cfg = {}, rnd = Math.random, t = ctx.currentTime + 0.005) {
  if ((cfg.kind || 'vent') !== 'vent' || !cfg.shiftChirp) return;
  const L = Math.min(0.4, 0.36 * clamp(P, 0, 1.3)) * (cfg.level ?? 1) * cfg.shiftChirp;
  const g1 = 0.055 + 0.02 * rnd();
  puffs(ctx, noise, dest, 1.4, [
    { t, len: 0.06, level: L, f: 2900 + 300 * rnd() },
    { t: t + g1, len: 0.04, level: L * 0.55, f: 2400 + 300 * rnd() },
  ]);
}

// The turbine whistle: pitch from the revs and how fast the turbine spins, level from the boost. After a
// lift the turbine runs on (shaft spins down over a second or two): a falling whine under the pssh.
export function whistle(rpm, boost, shaft, throttle, wh = 1) {
  const spin = throttle > 0 ? boost : Math.max(boost, shaft * 0.75);
  return {
    f: 1400 + rpm * 0.35 * (0.4 + 0.6 * spin),
    g: 0.016 * wh * (boost * boost + (throttle > 0 ? 0 : 0.3 * shaft * shaft)),
  };
}
