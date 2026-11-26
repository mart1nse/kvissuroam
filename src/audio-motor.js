// The motors of the Roadster Rocket, heard (Martin 26 Nov: its whine "a bit more mechanical, robust, but also a
// bit futu or sci fi"). The other electric cars keep their one quiet sine in audio.js.
//
// Everything follows one signal, the turns a second of the motor shafts (the wheels through the 9:1 reduction: 117
// a second at 100 km/h), and each tone is so many "to a turn" of it, as the sounds of a real drive unit are: the
// teeth of the reduction gears meeting, the motor's poles, the inverter's switching and its side tones. So a
// frame sets one number for the pitch of all of it and a handful of levels: the pull of the motors (the pedal)
// and how hard they hold the car back with the pedal let go.
//
// Four sounds to choose from until Martin has picked one (?whine=1..4, 0 or nothing: the old sine):
//   1 gear      straight-cut reduction gears as in a race car: two whines a fourth apart (rear and front
//               motors), rough with the shafts' turning, a hum of the motors under it that grows with the pull
//   2 turbine   a stack of fifths and octaves that spools like a turbine: each note a pair a hair apart so it
//               shimmers, the rush of air with it, a filter that opens as the pedal goes down
//   3 inverter  the song of the power electronics: at a launch two tones part from one note and run away up
//               and down (as a tram's or a maglev's do), and meet again as the car brakes to a stop; above
//               town speeds the gears take over
//   4 pulse     a deep growl that throbs faster with speed, metallic under load, a thin whine over it
// Tuned by measurement and spectrograms (tools/motor-sound-demo.mjs), not by ear.

const TAU = Math.PI * 2;
export const MOTOR_KINDS = ['gear', 'turbine', 'inverter', 'pulse'];
// which cars have such motors, and the sound each has when the address does not say (null: the old sine)
const MOTOR_CARS = { rocket: null };

let asked;
// the sound for this car: a name from MOTOR_KINDS, or null for the plain whine of audio.js
export function motorKind(spec) {
  if (!(spec.id in MOTOR_CARS)) return null;
  if (asked === undefined) {
    asked = null;
    try {
      const q = new URLSearchParams(location.search).get('whine');
      if (q !== null) asked = MOTOR_KINDS[Number(q) - 1] || MOTOR_KINDS.find((k) => k === q) || 'old';
    } catch {}
  }
  if (asked) return asked === 'old' ? null : asked;
  return MOTOR_CARS[spec.id];
}

// how hard the motors hold the car back, 0..1: the pedal let go at speed (physics.js evRegen comes in over a third
// of a second and fades out at a walk), more with the brake pedal down
export function motorRegen(car, v) {
  if (car.throttle > 0) return 0;
  return (car.regenIn || 0) * Math.min(1, Math.max(0, (v - 0.5) / 2.5)) * (car.brake > 0 ? 1 : 0.6);
}

const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));

// the bench the sounds are built on: `shaft` carries the shaft's turns a second as a signal, and a tone, a band
// of noise or a filter is tied to so many times that
function bench(ctx, noise) {
  const live = [], taps = [];
  const shaft = ctx.createConstantSource(); shaft.offset.value = 0; shaft.start(); live.push(shaft);
  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const times = (k) => { const g = gain(k); shaft.connect(g); return g; };
  const k = {
    ctx, noise, shaft, gain,
    // a tone `order` to a turn (plus `hz`, for one that stands still), into `dest` (a node or a parameter)
    tone(order, type, level, dest, hz = 0) {
      const o = ctx.createOscillator(), g = gain(level);
      if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
      o.frequency.value = hz;
      if (order) times(order).connect(o.frequency);
      o.connect(g).connect(dest); o.start(); live.push(o);
      return o;
    },
    // a timbre from the strengths of its harmonics
    wave(amps) {
      const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1);
      amps.forEach((a, i) => { im[i + 1] = a; });
      return ctx.createPeriodicWave(re, im, { disableNormalization: true });
    },
    // a filter, at `hz` or following the shaft at `order` to a turn
    filter(type, hz, q, order = 0, db = 0) {
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q; f.gain.value = db;
      if (order) times(order).connect(f.frequency);
      return f;
    },
    chain(...nodes) { for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]); return nodes.at(-1); },
    // the shared noise through these (remembered, so that stop() takes them off it again)
    hiss(...nodes) { noise.connect(nodes[0]); taps.push(nodes[0]); return k.chain(...nodes); },
    stop(at) { for (const n of live) { try { n.stop(at); } catch {} } },
    cut() { for (const n of taps) { try { noise.disconnect(n); } catch {} } },
  };
  return k;
}
const to = (param, v, t, tc = 0.07) => param.setTargetAtTime(v, t, tc);

// ---- 1: straight-cut gears
function gear(k, sum) {
  const mesh = k.wave([1, 0.5, 0.24, 0.1, 0.04]);
  // the rear pair's reduction: the main whine, nine to a turn. Two motors a hair apart, and no gear is quite true,
  // so its whine wavers once a turn of the shaft and once a turn of the slower wheel it drives
  const rough = k.gain(1), rear = k.gain(0);
  k.tone(9, mesh, 0.5, rough); k.tone(9.03, mesh, 0.32, rough);
  k.tone(1, 'sine', 0.3, rough.gain); k.tone(1 / 3.1, 'sine', 0.2, rough.gain);
  rough.connect(rear).connect(sum);
  // the front motor on its own shorter gears: a thinner whine about a fourth higher. Its harmonics all but
  // meet the rear's (3 x 11.94 against 4 x 9), which beats: the grit of two gearboxes at once
  const front = k.gain(0);
  k.tone(11.94, mesh, 0.36, front); front.connect(sum);
  // the motors: a hum four to a turn that grows with the pull, squashed harder the more they are asked for
  const hum = k.gain(0), humLp = k.filter('lowpass', 60, 0.8, 10), sh = k.ctx.createWaveShaper(), drive = k.gain(1);
  const curve = new Float32Array(257); for (let i = 0; i < 257; i++) curve[i] = Math.tanh(2.2 * (i / 128 - 1));
  sh.curve = curve;
  k.tone(4, 'sawtooth', 0.5, humLp); k.tone(2, 'sine', 0.35, humLp);
  k.chain(humLp, drive, sh, hum, sum);
  // the hash of oil and teeth under load: noise held to the whine's pitch
  const hash = k.gain(0);
  k.hiss(k.filter('bandpass', 30, 7, 9), hash, sum);
  // the stator slots: a thin high note, only heard about town
  const zing = k.gain(0);
  k.tone(36, 'sine', 0.16, zing); zing.connect(sum);
  // (the casing rings where it rings, whatever the speed)
  const body = k.chain(k.gain(1), k.filter('peaking', 640, 3, 0, 5), k.filter('peaking', 1750, 4, 0, 6), k.filter('peaking', 3100, 5, 0, 3));
  sum.connect(body);
  return {
    out: body, level: 0.082,
    set(t, v, load, rg) {
      const sp = ramp(v, 0, 18), pull = Math.max(load, 0.5 * rg);
      to(rear.gain, sp * (0.32 + 0.68 * load + 0.2 * rg), t);
      // (held back by the motors the teeth bear on their other flanks: the thin whine leads)
      to(front.gain, sp * (0.32 + 0.43 * load + 0.5 * rg), t);
      to(hum.gain, (0.25 + 0.75 * sp) * (0.9 * load + 0.25 * rg), t, 0.05);
      to(drive.gain, 0.5 + 1.0 * load, t, 0.05);
      to(hash.gain, sp * (1.2 * load + 0.4 * rg), t);
      to(zing.gain, ramp(v, 0.5, 5) * (1 - ramp(v, 14, 30)) * (0.35 + 0.65 * pull), t);
    },
  };
}

// ---- 2: turbine
function turbine(k, sum) {
  const soft = k.wave([1, 0.18, 0.1, 0.04]);
  // (a hair apart: 1.4 Hz and a little more with the pitch, so the shimmer stays slow at any speed)
  const pair = (order, level, dest) => { k.tone(order * 0.9988, soft, level, dest, -0.7); k.tone(order * 1.0012, soft, level, dest, 0.7); };
  // the note, six to a turn, with the octave under it; then the fifth, the octave and the fifth over that, which
  // come in with the pull and run down slowly when the pedal is let go
  const low = k.gain(0), mid = k.gain(0), top = k.gain(0);
  pair(6, 0.3, low); k.tone(3, 'sine', 0.4, low);
  pair(9, 0.26, mid); pair(12, 0.2, mid);
  pair(18, 0.1, top); k.tone(24, 'sine', 0.06, top);
  low.connect(sum); mid.connect(sum); top.connect(sum);
  // the spool: a bright tone through a filter that rings, and the pedal opens it
  const spool = k.gain(0), sweep = k.filter('lowpass', 80, 5);
  k.tone(3, 'sawtooth', 0.3, sweep); k.tone(3.012, 'sawtooth', 0.3, sweep);
  k.chain(sweep, spool, sum);
  // the air through it
  const air = k.gain(0);
  k.hiss(k.filter('bandpass', 40, 3.5, 15), k.filter('lowpass', 3800, 0.6), air, sum);
  let open = 0;
  return {
    out: sum, level: 0.097,
    set(t, v, load, rg, hz) {
      const sp = ramp(v, 0, 18);
      to(low.gain, sp * (0.45 + 0.55 * load + 0.15 * rg), t);
      to(mid.gain, sp * (0.3 + 0.7 * load), t, load > 0.5 ? 0.08 : 0.3);
      to(top.gain, sp * load * load * (1 - ramp(v, 60, 95)), t, load > 0.5 ? 0.12 : 0.35);
      open += ((load > 0 ? 0.25 + 0.75 * load : 0.1 * rg) - open) * (load > open ? 0.12 : 0.035);
      to(sweep.frequency, 60 + hz * 3 * (1.4 + 5.5 * open), t, 0.03);
      to(spool.gain, (0.2 + 0.8 * sp) * (0.25 + 0.75 * open) * Math.min(1, v / 2), t);
      to(air.gain, sp * (0.12 + 0.4 * load + 0.1 * rg), t, 0.12);
    },
  };
}

// ---- 3: inverter
function inverter(k, sum) {
  const FC = 1180;   // the switching note at a standstill
  // the inverter: its side tones part from the switching note by four and eight to a turn of the shaft, up and
  // down, so a launch is one note that splits and runs away both ways. Heard with the current, about town.
  const song = k.gain(0);
  for (const [n, a] of [[4, 0.42], [-4, 0.42], [8, 0.24], [-8, 0.24]]) k.tone(n, 'sine', a, song, FC);
  for (const [n, a] of [[2, 0.1], [-2, 0.1]]) k.tone(n, 'sine', a, song, FC * 2);
  song.connect(sum);
  // the gears: one cleaner whine eight to a turn, and the rear motors' pair a hair apart
  const mesh = k.wave([1, 0.4, 0.16, 0.05]), whine = k.gain(0);
  k.tone(8, mesh, 0.5, whine); k.tone(8.024, mesh, 0.3, whine);
  whine.connect(sum);
  // the motors pulling: the buzz of their poles (24 to a turn) and a hum under it
  const buzz = k.gain(0), hum = k.gain(0);
  k.tone(24, k.wave([1, 0, 0.14]), 0.2, buzz); k.tone(24.07, 'sine', 0.12, buzz);
  k.chain(buzz, k.filter('lowpass', 4200, 0.7), sum);
  k.tone(4, k.wave([1, 0.5, 0.3, 0.15]), 0.5, hum); k.tone(2, 'sine', 0.3, hum);
  hum.connect(sum);
  return {
    out: sum, level: 0.08,
    set(t, v, load, rg) {
      const sp = ramp(v, 0, 18), cur = Math.max(load, 0.5 * rg);
      to(song.gain, (0.1 + 0.9 * cur) * Math.min(1, cur * 4 + v / 3) * (1 - ramp(v, 15, 33)) * 0.7, t, 0.04);
      to(whine.gain, ramp(v, 3, 22) * (0.42 + 0.58 * load + 0.4 * rg), t);
      to(buzz.gain, ramp(v, 1, 12) * (1 - ramp(v, 38, 60)) * (0.15 + 0.85 * cur), t);
      to(hum.gain, (0.2 + 0.8 * sp) * (0.8 * load + 0.3 * rg), t, 0.05);
    },
  };
}

// ---- 4: pulse
function pulse(k, sum) {
  // two bright tones three to a turn and a fifth of a turn apart: they beat seven times a second at 30 km/h and
  // 25 at 100, a throb that quickens into a growl. The pull bends them (a tone 1.5 to a turn swings their pitch),
  // which is the metal in it, and opens the filter over them.
  const growl = k.gain(0), lp = k.filter('lowpass', 100, 2.2), bend = k.gain(0);
  const a = k.tone(3, 'sawtooth', 0.4, lp), b = k.tone(3.21, 'sawtooth', 0.4, lp);
  k.tone(1.5, 'sine', 1, bend);
  bend.connect(a.frequency); bend.connect(b.frequency);
  k.chain(lp, growl, sum);
  // the weight under it
  const sub = k.gain(0);
  k.tone(1.5, 'sine', 0.5, sub); k.tone(3, 'sine', 0.3, sub); sub.connect(sum);
  // and the motors' own thin whine over it, so it is still an electric car
  const whine = k.gain(0);
  k.tone(12, 'sine', 0.2, whine); k.tone(12.05, 'sine', 0.16, whine); k.tone(24, 'sine', 0.05, whine);
  whine.connect(sum);
  let open = 0;
  return {
    out: sum, level: 0.15,
    set(t, v, load, rg, hz) {
      const sp = ramp(v, 0, 18);
      open += ((load > 0 ? 0.2 + 0.8 * load : 0.12 * rg) - open) * (load > open ? 0.15 : 0.05);
      to(lp.frequency, 90 + hz * (4 + 9 * open), t, 0.03);
      to(bend.gain, hz * 1.5 * (0.15 + 1.1 * load), t, 0.05);
      to(growl.gain, (0.15 + 0.85 * sp) * (0.3 + 0.7 * load + 0.25 * rg) * Math.min(1, v / 1.5), t);
      to(sub.gain, sp * (0.35 + 0.65 * load + 0.2 * rg), t);
      to(whine.gain, sp * (0.45 + 0.55 * load + 0.5 * rg) * (1 - 0.5 * ramp(v, 60, 100)), t);
    },
  };
}

const BUILD = { gear, turbine, inverter, pulse };

// The motors of one car: `noise` is a running noise source, `out` where the sound goes. step() each frame with
// the wheels' speed (m/s, spin and all), the pedal (0..1), how hard the motors hold the car back with the pedal
// let go (0..1), and whether the car is out of it (parked, in the river). null where the browser cannot.
export function createMotor(ctx, out, noise, spec, kind) {
  if (!BUILD[kind] || typeof ctx.createConstantSource !== 'function') return null;
  const perMs = spec.gears[0] / (TAU * spec.wheelRadius);   // shaft turns a second for each m/s of the wheels
  const k = bench(ctx, noise), sum = k.gain(1);
  const v = BUILD[kind](k, sum);
  // (nothing sharp at the top: the wind's hiss was too much once)
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6200; lp.Q.value = 0.5;
  const level = k.gain(0);
  v.out.connect(lp).connect(level).connect(out);
  let load = 0, was = -1;
  return {
    kind,
    step(t, vw, throttle, regen, dead) {
      const w = Math.abs(vw), hz = w * perMs;
      to(k.shaft.offset, hz, t, 0.04);
      // (the motors answer the pedal at once, but not in one frame: a click otherwise)
      load += (throttle - load) * 0.35;
      v.set(t, w, load, regen, hz);
      const on = dead ? 0 : 1;
      if (on !== was) { was = on; to(level.gain, on * v.level, t, 0.06); }
    },
    // (faded out first, so that taking it apart is not heard)
    stop() {
      const t = ctx.currentTime;
      level.gain.cancelScheduledValues(t); level.gain.setTargetAtTime(0, t, 0.02);
      k.stop(t + 0.2);
      setTimeout(() => { k.cut(); level.disconnect(); }, 400);
    },
  };
}
