// A recorded run of the Raadi stage, judged again by the stage's own rules (26 Nov 2026, the review of ways to
// cheat: the board took the page's word for a run's penalty seconds, and of the way it was driven it only asked for
// a point every 80 along the stage, 45 m to either side: a cut across the park and "no penalties" was a record).
//
// The rules are the game's own (src/race/raadirules.js, the same code the page runs as the car drives). Here they
// run over the replay's places, ten a second:
//   the start     standing on the start line when the clock starts, and no further from it in the first moments
//                 than a car gets from a standstill
//   the way       the hidden check at every bale in turn, the finish between its flags; nothing that ends a run
//                 on the page (a missed corner, a short cut, off the stage, the wrong way)
//   the seconds   every apex cut, wide way in and out-of-bounds bend counted again, and R (a hop back onto the
//                 run's own earlier path) with its seconds; the run's time must carry at least as many
// The straight line between two places cuts a bend a little more than the car did, so every measure is taken EASE
// metres in the car's favour: an honest run must never be refused, and a cut that deep in is no accident.
import { newRun, judgeStep, P, TAN, HW, START, FIN, RESET_PEN, CHECKS, FIN_WIDE, FIN_FLAG, STAGE } from '../src/race/raadirules.js';

export const EASE = 0.6;
const START_BACK = 1.6;          // m behind the start line the car is put (src/race/raadi.js startPose)
const START_R = 2.5;             // m from that spot the run's first place may be
const LAUNCH_A = 14;             // m/s2: no car leaves a standstill harder (worker/follow.js)
const HOP = 12, BACK_AGE = 20, BACK_R = 8;   // R, as the replay check knows it (worker/index.js checkTrace)

// xs, zs: the run's places, 0.1 s apart from the green light to the finish line; pen: the penalty seconds in its time.
// launch: how hard this car leaves a standstill when that is harder than LAUNCH_A (m/s2: a car with thrusters, whose
// BOOST could be held from the green light until 27 Nov 2026: src/race/plausible.js gas.launch; since, its motors
// with the tank full, full.pull[0], 18 m/s2 for the Rocket on its launch suction).
// '' when the run holds, else what is wrong with it. out, when given, gets `loose`: 1 for each place the run was past
// the tarmac start, on the stage's gravel (the car check judges those against gravel's grip: src/race/plausible.js).
export function stageCheck(xs, zs, pen = 0, launch = 0, out = null) {
  const launchA = Math.max(LAUNCH_A, launch || 0);
  const n = xs.length;
  if (n < 20) return 'too short';
  const sx = P[START][0] - TAN[START][0] * START_BACK, sz = P[START][1] - TAN[START][1] * START_BACK;
  if (Math.hypot(xs[0] - sx, zs[0] - sz) > START_R) return 'not from the start line';
  for (let i = 1; i <= 10; i++) {
    const t = i * 0.1 + 0.2;
    if (Math.hypot(xs[i] - xs[0], zs[i] - zs[0]) > 1 + 0.5 * launchA * t * t) return 'a flying start';
  }
  const st = newRun(EASE), snap = new Array(n);
  st.prev = { x: xs[0], z: zs[0] };
  snap[0] = [st.prog, st.gate];
  let fin = false;
  for (let i = 1; i < n && !fin; i++) {
    const x = xs[i], z = zs[i];
    if (Math.hypot(x - xs[i - 1], z - zs[i - 1]) > HOP) {
      // R: the run is where it was on that spot (the newest place of its own it is back on), and RESET_PEN seconds
      let j = i - 1 - BACK_AGE;
      while (j >= 0 && Math.hypot(xs[j] - x, zs[j] - z) >= BACK_R) j--;
      if (j < 0) return 'a jump';
      // (the nearest of the places round that one: the spot is a moment of the drive, not one of its tenths)
      for (let k = j - 1; k >= Math.max(0, j - 10); k--) if (Math.hypot(xs[k] - x, zs[k] - z) < Math.hypot(xs[j] - x, zs[j] - z)) j = k;
      st.prog = Math.min(st.prog, snap[j][0]); st.gate = Math.min(st.gate, snap[j][1]);
      st.prev = null; st.later = null; st.laterM = 0; st.missed = false;
      st.pen += RESET_PEN; st.resets++;
    } else {
      const ev = judgeStep(st, x, z);
      if (ev?.cancel) return `the run ends at ${(i / 10).toFixed(1)} s: ${ev.cancel.split(' · ')[0].toLowerCase()}`;
      if (ev?.fin != null) fin = true;
    }
    st.prev = { x, z };
    snap[i] = [st.prog, st.gate];
  }
  if (!fin) {
    // (a run's last place is on the finish line itself, which the rounding to centimetres may leave a hair short)
    const [fx, fz] = P[FIN], [tx, tz] = TAN[FIN], x = xs[n - 1], z = zs[n - 1];
    const along = (x - fx) * tx + (z - fz) * tz, right = -(x - fx) * tz + (z - fz) * tx;
    if (Math.abs(along) > 1 || Math.abs(right) > HW[FIN] + FIN_WIDE + EASE || right > HW[FIN] + FIN_FLAG + EASE) return 'not over the finish line';
    if (st.gate < CHECKS.length) return `the run misses a corner: ${st.gate} of ${CHECKS.length} bales passed`;
  }
  if (st.pen > pen) return `penalties: the drive has ${st.pen} s of them, its time ${pen}`;
  if (out) {
    // (two points into the gravel: the tarmac's last metres are judged as tarmac; past the finish, as the finish)
    const from = (STAGE.gravelFrom || START) + 2, loose = new Uint8Array(n);
    let last = 0;
    for (let i = 0; i < n; i++) { if (snap[i]) last = snap[i][0]; loose[i] = last >= from ? 1 : 0; }
    out.loose = loose;
  }
  return '';
}
