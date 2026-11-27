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
// fireAt:  crank angle of each firing in `order`, for engines with uneven firing intervals.
// stagger: up to this many degrees of fixed offset per cylinder (unequal manifold runners).
// cylGain: pulse strength of cylinders 1..n (default 1 each): runners of unlike length deliver unlike pulses.
// smoothTop: for loud, open engines: induction roar cut off above its band, ticks fading with revs, lower
//          turbo hiss. Without it their noise turns into a sharp hiss; quieter engines keep a brighter top.
// edge:    0..1, how much sharper the front of each exhaust pulse is than its tail (loud pulses steepen in
//          the pipe); rasp: level of the buzzy upper harmonics this gives (raspF Hz and up, raspDrive).
// whistle: turbo whistle level (turbo cars), whistleF: its pitch scale (small turbos spin faster, higher).
// pops:    overrun pops per firing (much more for a moment after a downshift's blip, src/audio-shift.js);
//          crackle: the pops a car without them gets after a blip (default 0.06, none for the diesels);
//          howl, howlTeeth: level and pitch (teeth per crank turn) of the gear howl when over-revved.
// yank, yankHz: size (x the revs still to come down) and rate of the swing as an upshift's gear wrenches
//          the revs down (defaults 0.55 and 8.2 Hz; Martin 2026-11-19 found 1 too much beside the
//          softer hit); yankFirst: the size of 1st to 2nd's, x (default 1).
// lopeFast: a quicker wander of the idle (rpm); roughIdle: extra firing-to-firing roughness at idle (wild cams);
//          raspIdle: the share of the rasp left at idle (default 0.3); pulseMax: the longest a pulse lasts (s, default
//          0.004: an open race pipe's stays short, a hard bright idle); crack: an anti-lag bang's snap (default 0.9).
// limVary: s, each limiter cut heard up to this much late at its start and end (off the page's grid of frames),
//          and each with its own depth, a soft cut now and then (every other firing let through), pops and bark.
// antilag: a rally car's anti-lag on a lift (from alsRpm, default 3000, fully 1500 above): the chance of a bang
//          per firing, the bangs coming in runs with a crack on each, the firings between them spitting; alsRattle
//          (default 1): the metallic rattle and clicking between the bangs, rattleF its pitch (Hz, default 2500).
//          The bigger bangs light a flame at the pipe (spec.exhaust.flame, smoke.js).
// revUp, blipLag: how fast the engine revs up on a downshift's blip with the clutch out (rpm a second, wide
//          open; default 30000) and how long its manifold takes to fill behind the throttle
//          (s, default 0.03): the milder engines with their heavier flywheels are not as eager to rev
//          (Martin 2026-11-20), the turbo and diesel ones slower to answer (src/audio-shift.js).

export const ENGINE_SOUNDS = {
  // Mercedes M103.942: 2.6 litre SOHC 12-valve straight six, firing order 1-5-3-6-2-4, Bosch KE-Jetronic.
  // Two cast 3-into-1 manifolds (cylinders 1-3 and 4-6) that join into one pipe and big silencers:
  // a smooth, hushed and even hum with a silky rise to a turbine-like note near the redline.
  w201: {
    revUp: 22000, blipLag: 0.035,
    seed: 201, order: [1, 5, 3, 6, 2, 4], banks: [0, 0, 0, 1, 1, 1],
    pipes: [{ len: 1.6, fb: -0.42, damp: 0.45 }, { len: 1.66, fb: -0.42, damp: 0.45 }],
    res: [[95, 1.4, 0.7], [205, 2.2, 0.45], [480, 3, 0.18], [1150, 3, 0.06]], dry: 0.35,
    lp0: 260, lpRpm: 130, lpLoad: 680, hp: 26,
    base: 0.4, overrun: 0.8, pulseDeg: 40, noise: 0.08, rough: 0.035, bias: 0.025,
    intake: 0.26, intakeF: 420, intakeQ: 1.4, tick: 0.012, tickF: 3800,
    jitter: 0.8, lope: 6, drive: 1.6, gain: 0.9, idleVol: 0.3,
    // (more growl under load, so it breaks through, Martin 2026-11-20: the edge and rasp up, driven harder,
    // and a little more of the top let out when it pulls)
    edge: 0.36, rasp: 0.22,
  },
  // VW AFN: 1.9 litre 8-valve TDI four, 1-3-4-2, direct injection with a variable-vane turbo. A hard,
  // knocking diesel clatter at idle (the injectors and the combustion itself), a gruff low drone under load
  // and almost nothing above 4000; the turbo whistles and the tired silencer lets plenty through.
  passat: {
    revUp: 13000, blipLag: 0.05,
    crackle: 0,               // (a diesel: nothing to light in the exhaust)
    seed: 19, order: [1, 3, 4, 2], banks: [0, 0, 0, 0],
    pipes: [{ len: 1.7, fb: -0.4, damp: 0.5 }],
    res: [[85, 1.4, 0.65], [190, 2, 0.5], [420, 2.5, 0.22], [1300, 3, 0.1]], dry: 0.45,
    lp0: 300, lpRpm: 110, lpLoad: 560, hp: 28,
    base: 0.55, overrun: 0.6, pulseDeg: 22, noise: 0.16, rough: 0.09, bias: 0.06,
    intake: 0.2, intakeF: 520, intakeQ: 1.3, tick: 0.09, tickF: 2600,
    jitter: 1.4, lope: 5, drive: 1.9, gain: 0.8, idleVol: 0.42,
    edge: 0.2, rasp: 0.1,
    turbo: true, turboMuffle: 320, hiss: 0.035, whistle: 0.85, whistleF: 1.15,
  },
  // Honda R20A2: 2.0 SOHC 16-valve i-VTEC four, 1-3-4-2, 4-2-1 manifold (1+4, 2+3), quiet SUV silencing.
  crv: {
    revUp: 20000, blipLag: 0.035,
    seed: 7, order: [1, 3, 4, 2], banks: [0, 1, 1, 0],
    pipes: [{ len: 1.25, fb: -0.38, damp: 0.5 }, { len: 1.25, fb: -0.38, damp: 0.5 }],
    res: [[120, 1.5, 0.55], [260, 2.4, 0.35], [640, 3, 0.16]], dry: 0.4,
    lp0: 300, lpRpm: 140, lpLoad: 650, hp: 32,
    base: 0.4, overrun: 0.8, pulseDeg: 36, noise: 0.12, rough: 0.05, bias: 0.04,
    intake: 0.3, intakeF: 620, intakeQ: 1.3, tick: 0.016, tickF: 4200,
    jitter: 1.2, lope: 8, drive: 1.5, gain: 0.72, idleVol: 0.3,
    edge: 0.3, rasp: 0.15,
  },
  // Toyota M20A-FKS Dynamic Force: 2.0 DOHC four, 1-3-4-2, D-4S port + direct injection (the dry
  // injector tick), long-stroke and quiet, with a flat drone under load.
  rav4: {
    revUp: 20000, blipLag: 0.035,
    seed: 4, order: [1, 3, 4, 2], banks: [0, 1, 1, 0],
    pipes: [{ len: 1.35, fb: -0.36, damp: 0.5 }, { len: 1.35, fb: -0.36, damp: 0.5 }],
    res: [[110, 1.6, 0.6], [240, 2.6, 0.38], [700, 3, 0.12]], dry: 0.38,
    lp0: 290, lpRpm: 120, lpLoad: 560, hp: 32,
    base: 0.4, overrun: 0.8, pulseDeg: 38, noise: 0.11, rough: 0.045, bias: 0.035,
    intake: 0.22, intakeF: 560, intakeQ: 1.5, tick: 0.03, tickF: 5200,
    jitter: 1.0, lope: 7, drive: 1.45, gain: 0.7, idleVol: 0.3,
    edge: 0.25, rasp: 0.12,
  },
  // Mazda PE-VPS Skyactiv-G 2.0: DOHC direct-injection four, 1-3-4-2, 4-2-1 header; a slightly
  // eager, raspy four with a light injector tick.
  mazda6: {
    revUp: 22000, blipLag: 0.035,
    seed: 6, order: [1, 3, 4, 2], banks: [0, 1, 1, 0],
    pipes: [{ len: 1.45, fb: -0.45, damp: 0.42 }, { len: 1.45, fb: -0.45, damp: 0.42 }],
    res: [[125, 1.5, 0.55], [300, 2.2, 0.4], [820, 3, 0.16]], dry: 0.4,
    lp0: 320, lpRpm: 160, lpLoad: 760, hp: 32,
    base: 0.4, overrun: 0.8, pulseDeg: 34, noise: 0.13, rough: 0.05, bias: 0.04,
    intake: 0.3, intakeF: 700, intakeQ: 1.3, tick: 0.024, tickF: 5000,
    jitter: 1.0, lope: 7, drive: 1.6, gain: 0.74, idleVol: 0.3,
    edge: 0.35, rasp: 0.2,
  },
  // Ferrari F120A: 2.9 litre 90 degree V8 with a flat-plane crank, DOHC 32 valves, two IHI turbos.
  // Firing order 1-5-3-7-4-8-2-6 alternates banks, so each bank is an even-firing four: no V8 burble,
  // a hard, raw, metallic rasp. The turbines soften the exhaust note, the engine itself is loud and
  // clattery (no sound deadening at all), and it cracks and pops on the overrun.
  f40: {
    revUp: 40000, blipLag: 0.025,
    seed: 40, order: [1, 5, 3, 7, 4, 8, 2, 6], banks: [0, 0, 0, 0, 1, 1, 1, 1],
    pipes: [{ len: 0.94, fb: -0.55, damp: 0.6 }, { len: 0.99, fb: -0.55, damp: 0.6 }],
    res: [[150, 1.2, 0.5], [340, 1.6, 0.45], [760, 2, 0.32], [1600, 2.5, 0.14]], dry: 0.55,
    lp0: 700, lpRpm: 300, lpLoad: 2200, hp: 30,
    base: 0.4, overrun: 0.8, pulseDeg: 26, noise: 0.2, rough: 0.09, bias: 0.07,
    intake: 0.55, intakeF: 950, intakeQ: 1.1, tick: 0.06, tickF: 3000,
    jitter: 2.0, lope: 14, drive: 2.4, gain: 0.85, idleVol: 0.32,
    edge: 0.5, rasp: 0.4,
    turbo: true, turboMuffle: 350, hiss: 0.03, pops: 0.05, smoothTop: true, whistle: 1.4, whistleF: 0.95,
  },
  // Porsche Carrera GT: 5.7 litre 68 degree V10 born as a Le Mans racing engine, firing order
  // 1-6-5-10-2-7-3-8-4-9. Each crankpin carries one cylinder of each bank, so the firing intervals alternate
  // 68 and 76 degrees; each bank is an even-firing five with its own exhaust. Dry sump, tiny flywheel and
  // almost no silencing: a clean, hard, very high wail with a loud induction howl right behind the seats.
  cgt: {
    revUp: 48000, blipLag: 0.015,
    yankHz: 6.6,                  // (a slower struggle than the others', Martin 2026-11-19)
    yankFirst: 0.75,              // (and 1st to 2nd still wobbled: a touch smaller, Martin 2026-11-20)
    seed: 980, order: [1, 6, 5, 10, 2, 7, 3, 8, 4, 9], banks: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    fireAt: [0, 68, 144, 212, 288, 356, 432, 500, 576, 644],
    pipes: [{ len: 0.74, fb: -0.52, damp: 0.66 }, { len: 0.78, fb: -0.52, damp: 0.66 }],
    res: [[210, 1.2, 0.38], [520, 1.6, 0.46], [1150, 2, 0.4], [2300, 2.4, 0.22]], dry: 0.6,
    lp0: 900, lpRpm: 360, lpLoad: 2500, hp: 38,
    base: 0.4, overrun: 0.75, pulseDeg: 22, noise: 0.11, rough: 0.05, bias: 0.04,
    intake: 0.6, intakeF: 1150, intakeQ: 1.2, tick: 0.05, tickF: 3400,
    jitter: 1.0, lope: 12, drive: 2.0, gain: 0.85, idleVol: 0.3,
    edge: 0.6, rasp: 0.55,
    pops: 0.02, smoothTop: true,
  },
  // Audi 3B: 2.2 litre DOHC 20-valve inline five with a KKK K24 turbo, firing order 1-2-4-5-3. Five pulses
  // every two turns through one manifold and one turbine: the off-beat, warbling five-cylinder howl of the
  // quattro rally cars, rounded off by the turbo.
  audi200: {
    revUp: 26000, blipLag: 0.04,
    seed: 44, order: [1, 2, 4, 5, 3], banks: [0, 0, 0, 0, 0], stagger: 8,
    pipes: [{ len: 1.5, fb: -0.44, damp: 0.46 }],
    res: [[105, 1.4, 0.62], [235, 2.2, 0.5], [560, 2.6, 0.32], [1250, 3, 0.1]], dry: 0.4,
    lp0: 300, lpRpm: 165, lpLoad: 1000, hp: 30,
    base: 0.4, overrun: 0.8, pulseDeg: 34, noise: 0.1, rough: 0.05, bias: 0.205,
    intake: 0.34, intakeF: 600, intakeQ: 1.3, tick: 0.02, tickF: 4200,
    jitter: 1.2, lope: 9, drive: 2.0, gain: 0.95, idleVol: 0.3,
    // (the five-cylinder warble more to the fore, Martin 2026-11-20: the cylinders a little more unlike
    // each other and further off the even beat, halfway between the first values (0.16, 7) and the next
    // (0.25, 9, a tad too uneven); more edge and rasp, driven harder and a touch brighter)
    edge: 0.55, rasp: 0.5,
    turbo: true, turboMuffle: 170, hiss: 0.02, whistle: 0.5, whistleF: 1.1,
  },
  // Subaru EJ22G: 2.2 litre DOHC 16-valve flat four with one IHI turbo, firing order 1-3-2-4. Cylinders 1 and 3
  // lie on the right, 2 and 4 on the left, and the cast manifold's runners are of unequal length: the right
  // bank's pulses reach the turbine together and early, the left bank's come the long way round, late and
  // softened. So instead of four even beats a turn you hear them in pairs, strong-strong-weak-weak, once every
  // two turns: the off-beat boxer burble, deep and lumpy at idle, a hard flat drone with a rasp on top as it
  // pulls, the turbo whistling over it.
  impreza: {
    revUp: 30000, blipLag: 0.035,
    seed: 22, order: [1, 3, 2, 4], banks: [0, 1, 0, 1],
    fireAt: [0, 180, 374, 554], cylGain: [1.2, 0.74, 1.2, 0.74], stagger: 3,
    pipes: [{ len: 0.78, fb: -0.5, damp: 0.5 }, { len: 1.34, fb: -0.44, damp: 0.56 }],
    res: [[88, 1.5, 0.7], [176, 2.0, 0.55], [410, 2.4, 0.34], [980, 2.8, 0.14]], dry: 0.45,
    lp0: 330, lpRpm: 190, lpLoad: 1250, hp: 26,
    base: 0.45, overrun: 0.8, pulseDeg: 30, noise: 0.13, rough: 0.07, bias: 0.06,
    intake: 0.36, intakeF: 560, intakeQ: 1.2, tick: 0.022, tickF: 3800,
    jitter: 1.5, lope: 12, drive: 2.1, gain: 0.92, idleVol: 0.36,
    edge: 0.5, rasp: 0.42,
    turbo: true, turboMuffle: 210, hiss: 0.025, whistle: 0.8, whistleF: 1.0, pops: 0.02,
  },
  // Ford Duratec R (Cosworth) in the Focus WRC 03: 2.0 litre DOHC 16-valve straight four, firing order 1-3-4-2, one
  // Garrett TR30R behind the 34 mm restrictor, a short open rally exhaust with hardly a silencer. Even beats, so no
  // burble: a hard, buzzy, rasping drone that the turbine only partly softens, the straight-cut gears whining under it,
  // and anti-lag banging and spitting in the pipe on every lift.
  // (Martin 2026-11-27: "more robust, more free", the off-throttle clicking and rattling more pronounced: revving up
  // quicker, rougher, and the anti-lag of its own below. Then his recording of a Focus WRC 04 at Goodwood, "very loud
  // and rough idle (somewhat higher revs too)", "hardly any muffling", matched by measure: it idles at about 1820 rpm,
  // wandering 1750-1900 (the car's idle, lope, lopeFast), each firing up to 1.5 dB unlike the last (roughIdle), its idle only
  // 3 dB darker from 200 Hz to 1 kHz and 10 dB more to 1-3 kHz (lp0, pulseMax, dry, raspIdle, tick); flat out the 1-3
  // and 3-8 kHz bands sit 3.5 and 9 dB under the 200 Hz-1 kHz one (rasp, raspF, edge); a lift bangs 11-18 times a
  // second, each 16-21 dB over the rattle in the upper band (antilag, crack, pops down to leave them room))
  focus: {
    revUp: 56000, blipLag: 0.014,
    seed: 3, order: [1, 3, 4, 2], banks: [0, 0, 0, 0], stagger: 2,
    pipes: [{ len: 0.62, fb: -0.45, damp: 0.6 }],
    res: [[108, 1.2, 0.4], [250, 1.8, 0.52], [620, 2.2, 0.45], [1400, 2.6, 0.45]], dry: 1.0,
    lp0: 3000, lpRpm: 300, lpLoad: 2600, hp: 34,
    base: 0.6, overrun: 0.8, pulseDeg: 24, noise: 0.18, rough: 0.1, bias: 0.05,
    intake: 0.45, intakeF: 900, intakeQ: 1.1, tick: 0.14, tickF: 3400,
    jitter: 1.8, lope: 40, drive: 2.75, gain: 0.88, idleVol: 0.5,
    lopeFast: 20, roughIdle: 0.12, pulseMax: 0.0006,
    edge: 0.75, rasp: 0.85, raspF: 800, raspIdle: 0.9,
    turbo: true, turboMuffle: 100, hiss: 0.03, whistle: 1.0, whistleF: 1.05,
    pops: 0.04, crackle: 0.3, smoothTop: true,
    antilag: 0.03, crack: 1.4, alsRattle: 1, rattleF: 2500,
    limVary: 0.012,           // (each bounce off the limiter its own, Martin 2026-11-27: 1st on Majoraadi spends long there)
  },
  // BMW S65B40: 4.0 litre 90 degree V8, cross-plane crank, firing order 1-5-4-8-7-2-6-3, eight individual
  // throttle butterflies, 8400 rpm. A cross-plane burble at low revs that hardens into a metallic, raspy
  // howl, with a sharp induction bark from the airbox.
  m3: {
    revUp: 46000, blipLag: 0.02,
    seed: 92, order: [1, 5, 4, 8, 7, 2, 6, 3], banks: [0, 0, 0, 0, 1, 1, 1, 1],
    pipes: [{ len: 0.86, fb: -0.5, damp: 0.56 }, { len: 0.91, fb: -0.5, damp: 0.56 }],
    res: [[125, 1.3, 0.56], [300, 1.8, 0.46], [700, 2.2, 0.32], [1500, 2.5, 0.15]], dry: 0.5,
    lp0: 520, lpRpm: 260, lpLoad: 1700, hp: 32,
    base: 0.4, overrun: 0.8, pulseDeg: 28, noise: 0.14, rough: 0.06, bias: 0.05,
    intake: 0.6, intakeF: 820, intakeQ: 1.2, tick: 0.03, tickF: 3600,
    jitter: 1.4, lope: 9, drive: 2.0, gain: 0.85, idleVol: 0.3,
    edge: 0.55, rasp: 0.45,
    pops: 0.015, smoothTop: true,
  },
  // Scania OC09 101: 9.3 litre straight five running on compressed natural gas, spark ignition and a
  // three-way catalyst, so none of the diesel's clatter: a deep, soft, even thrum at 600-2200 rpm through a
  // long pipe and a big silencer in the rear engine bay, the turbo whistling over it as it pulls away.
  bus: {
    revUp: 5000, blipLag: 0.07,
    crackle: 0,               // (a diesel: nothing to light in the exhaust)
    seed: 408, order: [1, 2, 4, 5, 3], banks: [0, 0, 0, 0, 0], stagger: 4,
    pipes: [{ len: 3.2, fb: -0.4, damp: 0.5 }],
    res: [[62, 1.2, 0.8], [140, 1.8, 0.55], [330, 2.4, 0.3], [780, 3, 0.08]], dry: 0.3,
    lp0: 190, lpRpm: 160, lpLoad: 420, hp: 20,
    base: 0.45, overrun: 0.7, pulseDeg: 46, noise: 0.08, rough: 0.04, bias: 0.06,
    intake: 0.25, intakeF: 380, intakeQ: 1.2, tick: 0.008, tickF: 3000,
    jitter: 0.8, lope: 5, drive: 1.4, gain: 0.95, idleVol: 0.38,
    edge: 0.15, rasp: 0.05,
    turbo: true, turboMuffle: 180, hiss: 0.015, whistle: 0.35, whistleF: 0.7,
  },
};
