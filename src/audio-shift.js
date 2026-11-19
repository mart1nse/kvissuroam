// What a gear change sounds like (combustion cars only; the electric cars have one gear):
//
// - a blip on a downshift: the throttle snaps wide open for a moment while the clutch is out, the engine
//   roars and the revs flare up past the lower gear's before the clutch drags them back ("BWAAP", about a
//   quarter of a second, Martin 2026-11-19: a roar, a growl); a quick downshift by hand (Z) blips harder
//   than the automatic, and each one straight after another harder still
// - crackle: after the blip the throttle shuts on high revs, and the fuel left in the hot exhaust goes off
//   in pops and crackles for a moment (much more on the cars that already pop, the F40, Carrera GT, M3)
// - a clunk: the driveline taking up its slack as the clutch bites, harder the bigger the jump in revs
// - the bite of an upshift under power: when the clutch takes up the new gear the engine barks (the
//   first firings after the ignition cut, harder and raspier), with a deep thunk through the driveline
//   (Martin 2026-11-19: more violent); the body kicks back with it (car.bite in physics.js)
// - over-rev: shifted down by hand too far (src/cars/physics.js lets Z drop up to two gears past the
//   redline), the engine is dragged over its limit by the wheels: it screams a little past the redline,
//   rough and misfiring (valve float), with the straight-cut gears howling under it
//
// The blip, crackle, bark and over-rev are played by the engine synthesiser (public/engine-worklet.js: its
// blip, crackle, bark and over inputs); the clunks are short sounds of their own.

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function createShiftSound() {
  let lastGear = 0, at = -9, k = 0, run = 0, lastBite = 0, bAt = -9, bk = 0;
  // car: the car (physics.js); t: the time (s); returns what to send to the synthesiser, and `clunk`
  // (strength 0..1, how long after now it comes, and `up` for an upshift's) on the frame it starts
  function step(car, t) {
    const s = car.spec, e = s.engine, v = Math.hypot(car.vx, car.vy);
    let clunk = null;
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
    // an upshift biting (by hand a touch harder)
    const bite = car.bite || 0;
    if (bite > lastBite + 0.05 && !clunk) {
      bAt = t; bk = Math.min(1, bite * (car.manual > 0 ? 1 : 0.85) * (0.6 + 0.4 * Math.min(1, car.rpm / e.shiftRpm)));
      clunk = { k: bk, after: 0, up: true };
    }
    lastBite = bite;
    lastGear = car.reversing ? 1 : car.gear;
    // the blip: wide open in 30 ms, held for 90, then shut over about 100
    const since = t - at;
    const shape = since < 0.03 ? since / 0.03 : since < 0.12 ? 1 : Math.exp(-(since - 0.12) / 0.07);
    const blip = since < 0.6 ? k * shape : 0;
    const crackle = since < 1.8 ? k * clamp((since - 0.08) / 0.1, 0, 1) * Math.exp(-since / 0.55) : 0;
    const sb = t - bAt, bark = sb < 0.8 ? bk * Math.exp(-sb / 0.16) : 0;
    const over = clamp((car.overRev || 0) * 6, 0, 1);
    // (the revs flare past the lower gear's, up to 16 %, short of the redline)
    let rpm = Math.min(car.rpm * (1 + 0.16 * blip), Math.max(car.rpm, e.redline * 0.985));
    if (over > 0) rpm = Math.max(rpm, e.redline * (1 + 0.035 * over));
    rpm = Math.min(rpm, e.redline * 1.04);
    // punch: how much of the engine to send round the compressor as well, so the blip and the bark hit
    // instead of being pressed down with the rest
    return { rpm, blip, crackle, bark, over, clunk, punch: Math.max(0.9 * bark, 0.5 * blip) };
  }
  return { step, reset() { lastGear = 0; at = -9; k = 0; run = 0; lastBite = 0; bAt = -9; bk = 0; } };
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
