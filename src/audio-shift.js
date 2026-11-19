// What a gear change sounds like (combustion cars only; the electric cars have one gear):
//
// - a blip on a downshift: the throttle snaps wide open for a moment while the clutch is out, the engine
//   roars with a heavy growl and the revs flare up past the lower gear's before the clutch drags them back
//   ("BWAAAP", about a third of a second, Martin 2026-11-19: a roar, a growl, then a tad longer and
//   heavier); a quick downshift by hand (Z) blips harder than the automatic, and each one straight after
//   another harder still
// - crackle: after the blip the throttle shuts on high revs, and the fuel left in the hot exhaust goes off
//   in pops and crackles for a moment (much more on the cars that already pop, the F40, Carrera GT, M3)
// - a clunk: the driveline taking up its slack as the clutch bites, harder the bigger the jump in revs
// - an upshift under power: while the clutch is out the revs only sink at the rate the flywheel lets them
//   (engine.revDrop), so when the new gear goes in they are still well above its speed and the gear has
//   to wrench them down: they are yanked down past it and swing back a couple of times as the driveline
//   winds up and springs back (Martin 2026-11-19: "a short rev struggle"), the engine barks through it
//   (the first firings after the ignition cut, harder and raspier), a deep thunk goes through the
//   driveline, the tyres chirp on a hard one, and the body kicks back and shudders (car.bite in physics.js)
// - over-rev: shifted down by hand too far (src/cars/physics.js lets Z drop up to two gears past the
//   redline), the engine is dragged over its limit by the wheels: it screams a little past the redline,
//   rough and misfiring (valve float), with the straight-cut gears howling under it
//
// The blip, crackle, bark, yank and over-rev are played by the engine synthesiser (public/engine-worklet.js:
// its blip, crackle, bark, yank and over inputs); the clunks and the chirp are short sounds of their own.

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const CUT_HEARD = 0.1;     // s: how long an upshift's ignition cut is heard
const BITE_HEARD = 0.12;   // s: when an upshift's gear is heard going in, however long the change takes
const KICK = 0.7;          // how hard an upshift hits: its bark, thunk and chirp (Martin 2026-11-19: a bit
                           // less, in balance with the rev struggle)
// 1st to 2nd has the biggest jump in revs by far (about a third of the redline, twice 2nd to 3rd's), and
// its long, wide swing sounded wobbly (Martin 2026-11-19): it hits harder, and the swing is smaller,
// faster and over sooner (yankTight in public/engine-worklet.js), so the gear snaps in
const FIRST_KICK = 1.35, FIRST_YANK = 0.6;

export function createShiftSound() {
  let lastGear = 0, at = -9, k = 0, run = 0, lastBite = 0, bAt = -9, bk = 0;
  let lastT = 0, lastRpm = 0, wasCut = false, hold = 0, yankId = 0, yank = 0, tight = 0, cutAt = -9;
  // car: the car (physics.js); t: the time (s); returns what to send to the synthesiser, `clunk` (strength
  // 0..1, how long after now it comes, and `up` for an upshift's) on the frame it starts, and `chirp`
  // (strength) when the tyres chirp on an upshift
  function step(car, t) {
    const s = car.spec, e = s.engine, v = Math.hypot(car.vx, car.vy), dt = Math.min(0.1, Math.max(0, t - lastT));
    let clunk = null, chirp = 0;
    lastT = t;
    // an upshift under power: the revs hang, sinking at the flywheel's rate, while the clutch is out
    const cut = !!car.shiftCut, drop = e.revDrop ?? 3200;
    if (cut && !wasCut) { hold = Math.max(car.rpm, lastRpm); cutAt = t; }
    if (cut && bAt < cutAt) hold = Math.max(car.rpm, hold - drop * dt);
    wasCut = cut;
    lastRpm = car.rpm;
    if (lastGear && car.gear < lastGear && !car.reversing && v > 3 && car.throttle < 0.5) {
      const byHand = car.manual < 0;
      run = t - at < 0.6 ? run + 1 : 0;           // another one straight after the last: Z Z Z
      k = Math.min(1, (byHand ? 1 : 0.75) + 0.1 * run);
      at = t;
      // the jump in revs the clutch has to take up
      const was = (Math.abs(car.vx) / s.wheelRadius) * s.gears[lastGear - 1] * s.finalDrive * (60 / (2 * Math.PI));
      const jump = (was * (s.gears[car.gear - 1] / s.gears[lastGear - 1] - 1)) / e.redline;
      clunk = { k: k * clamp(jump * 3.5, 0.2, 1), after: (car.shiftLen || 0.2) * 0.75 };
    }
    // an upshift biting (by hand a touch harder). It is heard BITE_HEARD into the change, however long the
    // change takes (a quarter of a second on most cars, which sounded like a pause between the gears,
    // Martin 2026-11-19), so the drive itself comes back (car.bite) a moment after the sound of it.
    const bite = car.bite || 0;
    const soon = cut && bAt < cutAt && t - cutAt >= BITE_HEARD && car.throttle > 0.3;
    if (!clunk && t - bAt > 0.2 && (soon || bite > lastBite + 0.05)) {
      const first = car.gear === 2;
      bAt = t; bk = KICK * (first ? FIRST_KICK : 1) * Math.min(1, (soon ? car.throttle : bite) * (car.manual > 0 ? 1 : 0.85) * (0.6 + 0.4 * Math.min(1, car.rpm / e.shiftRpm)));
      clunk = { k: bk, after: 0, up: true };
      // how far above the new gear's speed the revs still are when it bites (as far as they would have
      // sunk by the end of the change, so the swing is as big as it is with the bite heard at the end):
      // the gear wrenches them down
      const left = soon ? Math.max(0, (car.shiftLen || 0) - (t - cutAt)) : 0;
      yank = Math.max(0, Math.max(car.rpm, hold - drop * left) - car.rpm); yankId++;
      // (a hard one, in a low gear on paving, chirps the driven tyres)
      if (car.gear <= 3 && car.surface === 1) chirp = bk * clamp(yank / e.redline * 6, 0, 1) * (car.gear === 2 ? 1 : 0.6);
      if (first) yank *= FIRST_YANK;
      tight = first ? 1 : 0;
    }
    // (the change as heard: from the lift until the gear is heard going in)
    const changing = cut && bAt < cutAt;
    hold = cut ? hold : 0;
    lastBite = bite;
    lastGear = car.reversing ? 1 : car.gear;
    // the blip: wide open in 35 ms, held for 125, then shut over about 130
    const since = t - at;
    const shape = since < 0.035 ? since / 0.035 : since < 0.16 ? 1 : Math.exp(-(since - 0.16) / 0.09);
    const blip = since < 0.6 ? k * shape : 0;
    const crackle = since < 1.8 ? k * clamp((since - 0.08) / 0.1, 0, 1) * Math.exp(-since / 0.55) : 0;
    const sb = t - bAt, bark = sb < 0.8 ? bk * Math.exp(-sb / 0.16) : 0;
    const over = clamp((car.overRev || 0) * 6, 0, 1);
    // (the revs flare past the lower gear's, up to 16 %, short of the redline)
    let rpm = Math.min(car.rpm * (1 + 0.16 * blip), Math.max(car.rpm, e.redline * 0.985));
    if (over > 0) rpm = Math.max(rpm, e.redline * (1 + 0.035 * over));
    if (changing) rpm = Math.max(rpm, hold);
    rpm = Math.min(rpm, e.redline * 1.04);
    // punch: how much of the engine to send round the compressor as well, so the blip and the bark hit
    // instead of being pressed down with the rest
    // The ignition is only heard cut for the first 0.1 s of an upshift, however long the change takes: the
    // F40 and the Carrera GT take a quarter of a second and their sound died for too long (Martin
    // 2026-11-19). Then the engine runs on part throttle, revs hanging, until the gear is heard biting.
    const cutSound = changing && t - cutAt < CUT_HEARD;
    const throttle = changing && !cutSound ? car.throttle * 0.4 : car.throttle;
    return { rpm, throttle, shift: cutSound, blip, crackle, bark, over, clunk, chirp, yank, yankId, yankTight: tight, punch: Math.max(1.2 * bark, 0.65 * blip) };
  }
  return {
    step,
    reset() { lastGear = 0; at = -9; k = 0; run = 0; lastBite = 0; bAt = -9; bk = 0; wasCut = false; hold = 0; },
  };
}

// the clunk: a low shunt through the driveline and the clack of the gear going in (up: an upshift
// biting under power, a deeper, longer thunk as the whole driveline winds up)
export function clunk(ctx, noise, dest, k, t = ctx.currentTime + 0.005, up = false) {
  if (k <= 0.01) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), len = up ? 0.22 : 0.15;
  o.type = 'sine';
  o.frequency.setValueAtTime(up ? 72 : 88, t);
  o.frequency.exponentialRampToValueAtTime(up ? 30 : 40, t + len * 0.75);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime((up ? 0.24 : 0.16) * k, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + len + 0.02);
  if (up) {
    // (and a body to it that small speakers can play)
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(170, t);
    o2.frequency.exponentialRampToValueAtTime(85, t + 0.1);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.1 * k, t + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o2.connect(g2).connect(dest);
    o2.start(t); o2.stop(t + 0.15);
  }
  if (!noise) return;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
  src.buffer = noise; f.type = 'bandpass'; f.frequency.value = 2300; f.Q.value = 2.5;
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(0.05 * k, t + 0.002);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  src.connect(f).connect(gn).connect(dest);
  src.start(t, Math.random() * Math.max(0.01, noise.duration - 0.1)); src.stop(t + 0.05);
}

// the driven tyres chirping as an upshift bites hard: a short squeal, falling a little in pitch
export function chirp(ctx, noise, dest, k, t = ctx.currentTime + 0.005) {
  if (k <= 0.03 || !noise) return;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise; f.type = 'bandpass'; f.Q.value = 4;
  f.frequency.setValueAtTime(1750, t);
  f.frequency.exponentialRampToValueAtTime(1250, t + 0.14);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09 * k, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * Math.max(0.01, noise.duration - 0.3)); src.stop(t + 0.2);
}
