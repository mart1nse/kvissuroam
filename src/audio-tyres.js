// Tyre squeaks on paving (Martin 2026-11-23: "a bit of tyre squeak as well now and then, not all the time
// and not with the same pitch constantly ... perhaps even more on the lower registers").
//
// A spinning or sliding tyre does not only hiss: its tread blocks stick to the road, wind up and let go,
// and now and then they do it in step and the tyre sings. That is what this makes, over the steady howl
// in audio.js:
//  - three registers. Low groans and moans (rubber dragging, the most common, more so near a standstill),
//    mid squeals, and short high chirps when a spinning tyre bites again.
//  - the pitch never sits still: every squeak glides (up as the slip grows, down as the tyre grips), low
//    ones often dip and come back, a slow noise wanders the pitch all the time, and a new squeak never
//    takes the pitch of the one before. Heavier cars sing lower.
//  - low squeaks often judder (the tyre hopping, 7 to 15 times a second) instead of holding a note.
//  - sometimes the other tyre answers a moment later, a little off pitch, so the two beat.
//  - they come in spells: a slow "mood" decides whether the tyres are in a singing stretch or a silent one,
//    and a sudden change in slip (a launch, a lift, the tyre biting) can set one off at once.
//
// No nodes are made while driving: each voice is one oscillator that stays, and a squeak is only automation
// laid on it (a few numbers a frame on the page, nothing when the tyres grip).

export const SQUEAK_LEVEL = 0.13;

// the stick-slip wave: saw-like, the 2nd and 3rd partials strong (the "eee" of rubber)
let wave = null, waveCtx = null;
function stickSlip(ctx) {
  if (waveCtx === ctx) return wave;
  const n = 20, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (k === 2 ? 1.25 : k === 3 ? 1.1 : 1) / Math.pow(k, 0.9);
  wave = ctx.createPeriodicWave(re, im); waveCtx = ctx;
  return wave;
}

// noise: a looping white noise source that is already running (audio.js has one); out: where the car's
// sounds go. voices: 2 for our own car (two driven tyres), 1 for another player's.
export function createSqueaker(ctx, noise, out, { voices = 2, rnd = Math.random } = {}) {
  const gate = ctx.createGain(); gate.gain.value = 0; gate.connect(out);
  const V = [];
  for (let i = 0; i < voices; i++) {
    const osc = ctx.createOscillator(); osc.setPeriodicWave(stickSlip(ctx)); osc.frequency.value = 300;
    // the pitch wanders with a slow noise all the time (depth set per squeak)
    const jl = ctx.createBiquadFilter(); jl.type = 'lowpass'; jl.frequency.value = 22 + 14 * i; jl.Q.value = 0.5;
    const jg = ctx.createGain(); jg.gain.value = 0;
    if (osc.detune) noise.connect(jl).connect(jg).connect(osc.detune);
    // the note itself, its top taken off (a low groan keeps a good many partials: the pitch is low but the
    // rasp of it sits above the engine's own notes, where it can be heard), and one overtone the tread sings out
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 3.5;
    const bg = ctx.createGain(); bg.gain.value = 2.2;
    const env = ctx.createGain(); env.gain.value = 0;
    osc.connect(lp).connect(env); osc.connect(bp).connect(bg).connect(env); env.connect(gate);
    osc.start();
    V.push({ osc, jg, lp, bp, env, free: 0, f: 0 });
  }
  let last = -1, n = 0, log = null, act = 0, mood = 0.5, moodTo = 0.5, moodT = 0, lastF = 0, gateOn = false;
  const range = (a, b) => a + (b - a) * rnd();
  const logRange = (a, b) => a * Math.pow(b / a, rnd());

  // one squeak on one voice. reg 0 low, 1 mid, 2 high; trend > 0 slip growing, < 0 the tyre gripping up
  function sing(v, t0, reg, f, level, trend) {
    const dur = reg === 0 ? range(0.22, 0.75) : reg === 1 ? range(0.12, 0.45) : range(0.04, 0.13);
    // the glide: with the slip more often than against it, up to a fourth
    const dir = rnd() < 0.5 + 0.35 * Math.sign(trend) ? 1 : -1;
    const f1 = f * Math.pow(2, dir * range(0.5, reg === 2 ? 7 : 5) / 12);
    // low ones often dip (or rise) in the middle and come back: a moan
    const mid = reg === 0 && rnd() < 0.55 ? f * Math.pow(2, range(-4, 2.5) / 12) : Math.sqrt(f * f1);
    const fr = v.osc.frequency, tm = t0 + dur * range(0.3, 0.65), t1 = t0 + dur;
    fr.cancelScheduledValues(t0); fr.setValueAtTime(f, t0); fr.exponentialRampToValueAtTime(mid, tm); fr.exponentialRampToValueAtTime(f1, t1);
    // the overtone that sings: between the 2nd and 5th partial, kept in the band rubber squeals in
    const ov = Math.max(620, Math.min(2600, f * range(2, 5)));
    v.bp.frequency.cancelScheduledValues(t0); v.bp.frequency.setValueAtTime(ov, t0); v.bp.frequency.exponentialRampToValueAtTime(ov * f1 / f, t1);
    v.lp.frequency.cancelScheduledValues(t0); v.lp.frequency.setValueAtTime(Math.max(900, f * (reg === 0 ? 5.5 : 3.2)), t0);
    v.jg.gain.cancelScheduledValues(t0); v.jg.gain.setValueAtTime(range(800, reg === 0 ? 4200 : 2600), t0);
    // loudness: a swell or a snap in, then out; low and mid ones may judder as the tyre hops
    const N = 40, c = new Float32Array(N);
    const att = reg === 2 ? 0.12 : range(0.08, 0.45), rel = range(0.2, 0.5);
    const hop = reg === 0 ? (rnd() < 0.55 ? range(7, 15) : 0) : reg === 1 ? (rnd() < 0.25 ? range(14, 28) : 0) : 0;
    const depth = hop ? range(0.4, 0.95) : 0, ph = rnd() * 6.283;
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      let a = Math.min(1, x / att, (1 - x) / rel);
      a = a * a * (3 - 2 * a);
      if (hop) a *= 1 - depth * (0.5 + 0.5 * Math.sin(ph + 6.283 * hop * x * dur));
      c[i] = a * level;
    }
    c[0] = c[N - 1] = 0;
    // (a browser that will not take the curve stays silent rather than stopping the frame)
    try { v.env.gain.cancelScheduledValues(t0); v.env.gain.setValueCurveAtTime(c, t0, dur); } catch { v.env.gain.value = 0; }
    v.f = f;
    return t1;
  }

  // every frame. t: the audio clock; spin 0..1 (wheelspin), slide 0..1 (sideways scrub), both 0 off paving;
  // speed in m/s; mass in kg
  function step(t, spin, slide, speed, mass = 1400) {
    const dt = last < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, t - last));
    last = t;
    const a = Math.max(spin, Math.max(0, slide - 0.25) * 0.8);
    const trend = dt > 0 ? (a - act) / dt : 0;
    act = a;
    const on = a > 0.03;
    if (on !== gateOn) { gateOn = on; gate.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.02 : 0.05); }
    if (!on) return;
    // the mood: a slow wander between silent stretches and singing ones
    moodT -= dt;
    if (moodT <= 0) { moodT = range(1.2, 4.5); moodTo = rnd(); }
    mood += (moodTo - mood) * Math.min(1, dt / 0.6);
    // squeaks a second: a few in a singing stretch, none in a silent one, and a burst when the slip jumps
    const jump = Math.min(1, Math.abs(trend) * 0.6);
    const rate = 3 * Math.pow(a, 1.2) * Math.max(0, mood - 0.35) / 0.65 + 7 * jump * Math.min(1, a * 3);
    const v = V[0];
    if (t < v.free || rnd() >= rate * dt) return;
    // which register: mostly low, lower still near a standstill; a tyre that is gripping up chirps
    const bite = trend < -0.4 ? 1 : 0;
    const wLow = 0.62 + (speed < 4 ? 0.2 : 0), wMid = 0.3, wHigh = 0.1 + 0.5 * bite;
    const r = rnd() * (wLow + wMid + wHigh), reg = r < wLow ? 0 : r < wLow + wMid ? 1 : 2;
    // heavier cars sing lower; harder spin a little higher
    const k = Math.max(0.6, Math.min(1.15, Math.pow(1400 / mass, 0.25))) * (0.9 + 0.25 * a);
    let f = 0;
    for (let i = 0; i < 4; i++) {
      f = k * (reg === 0 ? logRange(170, 430) : reg === 1 ? logRange(470, 880) : logRange(1000, 1700));
      if (!lastF || Math.abs(Math.log2(f / lastF)) > 0.14) break;     // never the pitch of the one before
    }
    lastF = f;
    const level = SQUEAK_LEVEL * range(0.45, 1) * Math.sqrt(a) * (reg === 0 ? 1 : reg === 1 ? 0.9 : 0.6);
    const t0 = t + 0.01, end = sing(v, t0, reg, f, level, trend);
    n++; log?.push(t0, reg, f, end - t0, level);
    v.free = end + 0.08 - Math.log(1 - rnd() * 0.98) * 0.45;
    // the other tyre answers, a little off pitch
    const w = V[1];
    if (w && t >= w.free && rnd() < 0.35) {
      const off = Math.pow(2, range(0.6, 2.2) / 12);
      w.free = sing(w, t0 + range(0.01, 0.07), reg, rnd() < 0.5 ? f * off : f / off, level * range(0.4, 0.8), trend) + 0.05;
    }
  }
  // (for the demo tool: how many so far, and with keep() a list of time, register, pitch, length, level)
  return { step, count: () => n, keep() { return (log = []); } };
}
