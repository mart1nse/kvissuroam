// What a downshift sounds like (combustion cars only; the electric cars have one gear):
//
// - a blip: the throttle snaps open for a moment while the clutch is out, so the revs flare up to meet the
//   lower gear ("BWAP"); a quick downshift by hand (Z) blips harder than the automatic, and each one
//   straight after another harder still
// - crackle: after the blip the throttle shuts on high revs, and the fuel left in the hot exhaust goes off
//   in pops and crackles for a moment (much more on the cars that already pop, the F40, Carrera GT, M3)
// - a clunk: the driveline taking up its slack as the clutch bites, harder the bigger the jump in revs
// - over-rev: shifted down by hand too far (src/cars/physics.js lets Z drop up to two gears past the
//   redline), the engine is dragged over its limit by the wheels: it screams a little past the redline,
//   rough and misfiring (valve float), with the straight-cut gears howling under it
//
// The blip, crackle and over-rev are played by the engine synthesiser (public/engine-worklet.js: its
// blip, crackle and over inputs); the clunk is a short sound of its own.

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function createShiftSound() {
  let lastGear = 0, at = -9, k = 0, run = 0;
  // car: the car (physics.js); t: the time (s); returns what to send to the synthesiser, and `clunk`
  // (strength 0..1, and how long after now it comes) on the frame a downshift starts
  function step(car, t) {
    const s = car.spec, e = s.engine, v = Math.hypot(car.vx, car.vy);
    let clunk = null;
    if (lastGear && car.gear < lastGear && !car.reversing && v > 3 && car.throttle < 0.5) {
      const byHand = car.manual < 0;
      run = t - at < 0.6 ? run + 1 : 0;           // another one straight after the last: Z Z Z
      k = Math.min(1, (byHand ? 0.8 : 0.5) + 0.15 * run);
      at = t;
      // the jump in revs the clutch has to take up
      const was = (Math.abs(car.vx) / s.wheelRadius) * s.gears[lastGear - 1] * s.finalDrive * (60 / (2 * Math.PI));
      const jump = (was * (s.gears[car.gear - 1] / s.gears[lastGear - 1] - 1)) / e.redline;
      clunk = { k: k * clamp(jump * 3.5, 0.2, 1), after: (car.shiftLen || 0.2) * 0.75 };
    }
    lastGear = car.reversing ? 1 : car.gear;
    const since = t - at;
    const blip = since < 0.5 ? k * Math.exp(-since / 0.07) : 0;
    const crackle = since < 1.6 ? k * Math.exp(-since / 0.5) : 0;
    const over = clamp((car.overRev || 0) * 6, 0, 1);
    let rpm = car.rpm * (1 + 0.07 * blip);
    if (over > 0) rpm = Math.max(rpm, e.redline * (1 + 0.035 * over));
    rpm = Math.min(rpm, e.redline * 1.04);
    return { rpm, blip, crackle, over, clunk };
  }
  return { step, reset() { lastGear = 0; at = -9; k = 0; run = 0; } };
}

// the clunk: a low shunt through the driveline and the clack of the gear going in
export function clunk(ctx, noise, dest, k, t = ctx.currentTime + 0.005) {
  if (k <= 0.01) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(88, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.11);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 * k, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.17);
  if (!noise) return;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
  src.buffer = noise; f.type = 'bandpass'; f.frequency.value = 2300; f.Q.value = 2.5;
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(0.05 * k, t + 0.002);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  src.connect(f).connect(gn).connect(dest);
  src.start(t, Math.random() * Math.max(0.01, noise.duration - 0.1)); src.stop(t + 0.05);
}
