// The motors of the electric cars, heard. First the Roadster Rocket's (Martin 26 Nov: its whine "a bit more
// mechanical, robust, but also a bit futu or sci fi"), then the other two, which are four-wheel drive with a motor
// at each axle (Martin 26 Nov: "can the other 4wd EVs also get the dual engines turning up effect"). An electric
// car that is not listed here keeps the one quiet sine in audio.js.
//
// Everything follows one signal, the turns a second of the motor shafts (the wheels through the reduction gears:
// in the Rocket 117 a second at 100 km/h), and each tone is so many "to a turn" of it, as the sounds of a real
// drive unit are: the teeth of the reduction gears meeting, the motor's poles, the inverter's switching. So a
// frame sets one number for the pitch of all of it and a handful of levels: the pull of the motors (the pedal)
// and how hard they hold the car back with the pedal let go.
//
// The Rocket ("gear"): Martin picked it from four (the other three, a turbine, an inverter's song and a throbbing
// growl, are with the clips in the project's shared folder, rocket/whine): straight-cut reduction gears as in a
// race car, two whines a fourth apart (the rear motors and the front one), rough with the shafts' turning, and
// under them a hum of the motors that grows with the pull. Over 200 km/h its pitch all but stops rising (his
// wish: "reaches like some max point but ever so slightly gets higher").
//
// The road cars ("pair"): the same two whines rising together, one for each axle's motor, but clean as a family
// car's are, and each car its own: the Enyaq is led by its rear motor and the front one joins a third higher when
// the pedal asks for it (as the real 80x's front motor does); the bZ4X's two are equals a fifth apart, each a pair
// of tones a hair apart, so it shimmers. The intervals are chosen by ear's rules, not from the real cars' gear
// teeth. They do not stand in for the plain whine but go with it (Martin 26 Nov, having driven them: "make it a
// blend of the initial regular hiss sound and this two motor thingy. reduce two engine thing to 70% of the hiss"):
// the old sine sounds as it always did and the two motors follow its level at 0.7 of it, whatever the speed and
// the pedal, which only move the balance between the two whines.
//
// All of it tuned by measurement and spectrograms (tools/motor-sound-demo.mjs), not by ear.

const TAU = Math.PI * 2;
// which cars have such motors, and which sound
const MOTOR_CARS = { rocket: 'gear', enyaq: 'enyaq', bz4x: 'bz4x' };
// the sound for this car: its name, or null for the plain whine of audio.js
export const motorKind = (spec) => MOTOR_CARS[spec.id] || null;

// how hard the motors hold the car back, 0..1: the pedal let go at speed (physics.js evRegen comes in over a third
// of a second and fades out at a walk), more with the brake pedal down
export function motorRegen(car, v) {
  if (car.throttle > 0) return 0;
  // (another player's car does not say how far its motors have come in: taken as all the way)
  return (car.regenIn ?? 1) * Math.min(1, Math.max(0, (v - 0.5) / 2.5)) * (car.brake > 0 ? 1 : 0.6);
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
// (each change is a word to the sound thread: none is sent for a level or a pitch that has not moved)
const to = (param, v, t, tc = 0.07) => {
  if (Math.abs(v - (param.was ?? NaN)) < 1e-4 * (1 + Math.abs(v))) return;
  param.was = v; param.setTargetAtTime(v, t, tc);
};

// ---- straight-cut gears
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
    // the pitch follows the wheels up to here (m/s, 200 km/h), then eases off within some 20 km/h to a tenth of its rise
    knee: 200 / 3.6, ease: 5, creep: 0.1,
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

// the plain whine every electric car has had from the start, as audio.js plays it: its level (the gain of one sine)
// at this wheel speed (m/s) and pedal
export const plainWhine = (vw, throttle) => Math.min(0.05, 0.004 + vw * 0.0012) * (0.5 + throttle * 0.5);
// and its pitch (Hz). It does not follow the wheels in proportion: 180 Hz standing still, 38 Hz more for each m/s
export const plainWhineHz = (vw) => 180 + vw * 38;

// ---- a road car with a motor at each axle, heard with the plain whine
// Its two whines are tuned to the plain whine, not to the wheels (Martin 26 Nov: "check if there is a clash of
// frequencies on both sound now together and blend them in more nicely and evenly and complementing each other").
// Tied to the wheels they slid past it, as it starts at 180 Hz and they at nothing: in the Enyaq the front whine
// crossed it at 70 km/h (within 32 Hz of it from 50 to 90, a rough beat) and in the bZ4X the rear at 40; at other
// speeds they stood at odd intervals from it that kept changing. Now each is a fixed share of its pitch, below
// it, so all of it is one chord that rises with the car: every tone and every harmonic is a whole multiple of one
// low note, and none comes near another without meeting it exactly.
// o: rear, front: the two whines as shares of the plain whine's pitch; timbre: the strengths of a whine's
// harmonics; apart: Hz between the two tones each whine is made of (0: one tone); idle, pull, hold: each whine's
// weight with the pedal let go, how much the pedal adds and how much the motors holding the car back add, [rear,
// front]; hum: the motors' own low note under load, also a share of the whine's pitch; share: how loud all of it
// is, as a part of the plain whine's loudness
function pair(o) {
  return (k, sum) => {
    const wave = k.wave(o.timbre), amp = o.apart ? 0.3 : 0.5;
    const whine = (order) => {
      const g = k.gain(0);
      if (o.apart) { k.tone(order, wave, amp, g, -o.apart / 2); k.tone(order, wave, amp, g, o.apart / 2); } else k.tone(order, wave, amp, g);
      g.connect(sum);
      return g;
    };
    const rear = whine(o.rear), front = whine(o.front);
    const hum = k.gain(0);
    k.tone(o.hum, 'sine', 0.4, hum); k.tone(o.hum * 2, 'sine', 0.12, hum); hum.connect(sum);
    // how loud one whine and the hum are at a weight of 1 (root mean square), so the three weights can be scaled
    // to make all of it just as loud whatever their balance
    const W = amp * Math.sqrt((o.apart ? 2 : 1) * o.timbre.reduce((a, x) => a + x * x, 0) / 2), H = Math.sqrt((0.4 * 0.4 + 0.12 * 0.12) / 2);
    return {
      out: sum, share: o.share, pitch: plainWhineHz,
      set(t, v, load, rg) {
        const r = o.idle[0] + o.pull[0] * load + o.hold[0] * rg, f = o.idle[1] + o.pull[1] * load + o.hold[1] * rg, h = 0.6 * (load + 0.3 * rg);
        const n = 1 / Math.hypot(r * W, f * W, h * H);
        to(rear.gain, r * n, t); to(front.gain, f * n, t); to(hum.gain, h * n, t, 0.05);
      },
    };
  };
}

const BUILD = {
  gear,
  // Škoda Enyaq 80x: the rear motor does the work and is always heard; the front one joins when the pedal asks
  // (rear an octave under the plain whine, front a fifth over the rear, the hum an octave under the rear)
  enyaq: pair({ rear: 1 / 2, front: 3 / 4, timbre: [1, 0.3, 0.1], apart: 0, idle: [0.5, 0.1], pull: [0.5, 0.9], hold: [0.45, 0.1], hum: 1 / 4, share: 0.7 }),
  // Toyota bZ4X AWD: two equal motors, and a shimmer in each
  // (one over the plain whine and one under it, which it sits between: rear a fifth over it, front an octave under,
  // the hum two octaves under. A fourth under it at first, with the rear a fifth under, was rough below 30 km/h)
  bz4x: pair({ rear: 3 / 2, front: 1 / 2, timbre: [1, 0.14, 0.05], apart: 1.6, idle: [0.42, 0.42], pull: [0.58, 0.58], hold: [0.3, 0.3], hum: 1 / 4, share: 0.7 }),
};

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
    blend: !!v.share,   // heard with the plain whine of audio.js, not in its place
    step(t, vw, throttle, regen, dead) {
      const w = Math.abs(vw), over = w - v.knee;
      // (past the knee the note nears a top and then only creeps on: at 300 km/h it is where 226 would be, at 370 where
      // 233. A sound tuned to the plain whine follows its pitch, glide and all, so the two never part)
      const hz = v.pitch ? v.pitch(vw) : (over > 0 ? v.knee + v.ease * (1 - v.creep) * (1 - Math.exp(-over / v.ease)) + v.creep * over : w) * perMs;
      to(k.shaft.offset, hz, t, v.pitch ? 0.05 : 0.04);
      // (the motors answer the pedal at once, but not in one frame: a click otherwise)
      load += (throttle - load) * 0.35;
      v.set(t, w, load, regen, hz);
      const on = dead ? 0 : 1;
      // (a sound that goes with the plain whine follows that whine's level: a sine of gain g is g / √2 loud. The motors
      // come in as the car gets going, all there by 30 km/h: tuned to the whine they would sound standing still, and
      // the lowest of their notes, close together down there, only muddied it about the car park)
      if (v.share) to(level.gain, on * v.share * Math.SQRT1_2 * plainWhine(w, throttle) * ramp(w, 1, 8.3), t, 0.08);
      else if (on !== was) { was = on; to(level.gain, on * v.level, t, 0.06); }
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
