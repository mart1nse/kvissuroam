// Engine sound configs for the synthesiser in public/engine-worklet.js, one per combustion car.
//
// order:   firing order (cylinder numbers); the events are spread evenly over the 720 degree cycle.
// banks:   exhaust bank (0 or 1) of cylinders 1..n.
// pipes:   one per bank: len (m, sets the pipe resonance), fb (reflection, negative = open end), damp.
// res:     silencer / body resonances [Hz, Q, gain]; dry is the unfiltered share.
// lp0, lpRpm, lpLoad: tone (low-pass Hz) at idle, per 1000 rpm and at full load.
// base:    pulse strength with the throttle closed (0..1); overrun: pulse strength on a trailing throttle.
// pulseDeg: crank degrees of the exhaust blowdown pulse (shorter = harder, rawer edge).
// noise:   turbulent share of each pulse; rough / bias: cycle-to-cycle and cylinder-to-cylinder variation.
// intake:  induction roar level at intakeF Hz; tick: valvetrain / injector tick level at tickF Hz.
// drive:   saturation; gain: overall level; idleVol: share of the level left at idle.

export const ENGINE_SOUNDS = {
  // Mercedes M103.942: 2.6 litre SOHC 12-valve straight six, firing order 1-5-3-6-2-4, Bosch KE-Jetronic.
  // Two cast 3-into-1 manifolds (cylinders 1-3 and 4-6) that join into one pipe and big silencers:
  // a smooth, hushed and even hum with a silky rise to a turbine-like note near the redline.
  w201: {
    seed: 201, order: [1, 5, 3, 6, 2, 4], banks: [0, 0, 0, 1, 1, 1],
    pipes: [{ len: 1.6, fb: -0.42, damp: 0.45 }, { len: 1.66, fb: -0.42, damp: 0.45 }],
    res: [[95, 1.4, 0.7], [205, 2.2, 0.45], [480, 3, 0.18], [1150, 3, 0.06]], dry: 0.35,
    lp0: 260, lpRpm: 120, lpLoad: 520, hp: 26,
    base: 0.4, overrun: 0.8, pulseDeg: 40, noise: 0.08, rough: 0.035, bias: 0.025,
    intake: 0.22, intakeF: 420, intakeQ: 1.4, tick: 0.012, tickF: 3800,
    jitter: 0.8, lope: 6, drive: 1.3, gain: 0.85, idleVol: 0.3,
  },
  // Honda R20A2: 2.0 SOHC 16-valve i-VTEC four, 1-3-4-2, 4-2-1 manifold (1+4, 2+3), quiet SUV silencing.
  crv: {
    seed: 7, order: [1, 3, 4, 2], banks: [0, 1, 1, 0],
    pipes: [{ len: 1.25, fb: -0.38, damp: 0.5 }, { len: 1.25, fb: -0.38, damp: 0.5 }],
    res: [[120, 1.5, 0.55], [260, 2.4, 0.35], [640, 3, 0.16]], dry: 0.4,
    lp0: 300, lpRpm: 140, lpLoad: 650, hp: 32,
    base: 0.4, overrun: 0.8, pulseDeg: 36, noise: 0.12, rough: 0.05, bias: 0.04,
    intake: 0.3, intakeF: 620, intakeQ: 1.3, tick: 0.016, tickF: 4200,
    jitter: 1.2, lope: 8, drive: 1.5, gain: 0.72, idleVol: 0.3,
  },
  // Toyota M20A-FKS Dynamic Force: 2.0 DOHC four, 1-3-4-2, D-4S port + direct injection (the dry
  // injector tick), long-stroke and quiet, with a flat drone under load.
  rav4: {
    seed: 4, order: [1, 3, 4, 2], banks: [0, 1, 1, 0],
    pipes: [{ len: 1.35, fb: -0.36, damp: 0.5 }, { len: 1.35, fb: -0.36, damp: 0.5 }],
    res: [[110, 1.6, 0.6], [240, 2.6, 0.38], [700, 3, 0.12]], dry: 0.38,
    lp0: 290, lpRpm: 120, lpLoad: 560, hp: 32,
    base: 0.4, overrun: 0.8, pulseDeg: 38, noise: 0.11, rough: 0.045, bias: 0.035,
    intake: 0.22, intakeF: 560, intakeQ: 1.5, tick: 0.03, tickF: 5200,
    jitter: 1.0, lope: 7, drive: 1.45, gain: 0.7, idleVol: 0.3,
  },
  // Mazda PE-VPS Skyactiv-G 2.0: DOHC direct-injection four, 1-3-4-2, 4-2-1 header; a slightly
  // eager, raspy four with a light injector tick.
  mazda6: {
    seed: 6, order: [1, 3, 4, 2], banks: [0, 1, 1, 0],
    pipes: [{ len: 1.45, fb: -0.45, damp: 0.42 }, { len: 1.45, fb: -0.45, damp: 0.42 }],
    res: [[125, 1.5, 0.55], [300, 2.2, 0.4], [820, 3, 0.16]], dry: 0.4,
    lp0: 320, lpRpm: 160, lpLoad: 760, hp: 32,
    base: 0.4, overrun: 0.8, pulseDeg: 34, noise: 0.13, rough: 0.05, bias: 0.04,
    intake: 0.3, intakeF: 700, intakeQ: 1.3, tick: 0.024, tickF: 5000,
    jitter: 1.0, lope: 7, drive: 1.6, gain: 0.74, idleVol: 0.3,
  },
  // Ferrari F120A: 2.9 litre 90 degree V8 with a flat-plane crank, DOHC 32 valves, two IHI turbos.
  // Firing order 1-5-3-7-4-8-2-6 alternates banks, so each bank is an even-firing four: no V8 burble,
  // a hard, raw, metallic rasp. The turbines soften the exhaust note, the engine itself is loud and
  // clattery (no sound deadening at all), and it cracks and pops on the overrun.
  f40: {
    seed: 40, order: [1, 5, 3, 7, 4, 8, 2, 6], banks: [0, 0, 0, 0, 1, 1, 1, 1],
    pipes: [{ len: 0.94, fb: -0.55, damp: 0.6 }, { len: 0.99, fb: -0.55, damp: 0.6 }],
    res: [[150, 1.2, 0.5], [340, 1.6, 0.45], [760, 2, 0.32], [1600, 2.5, 0.14]], dry: 0.55,
    lp0: 700, lpRpm: 300, lpLoad: 2200, hp: 30,
    base: 0.4, overrun: 0.8, pulseDeg: 26, noise: 0.2, rough: 0.09, bias: 0.07,
    intake: 0.55, intakeF: 950, intakeQ: 1.1, tick: 0.06, tickF: 3000,
    jitter: 2.0, lope: 14, drive: 2.4, gain: 0.85, idleVol: 0.32,
    turbo: true, turboMuffle: 350, hiss: 0.03, pops: 0.05,
  },
};
