// What the server believes of a drag strip time (Martin 27 Nov 2026: the drag strip's own tab on LAP TIMES, "same
// logic as previous results"). Shared by the page (src/race/drag.js) and the server (worker/drag.js).
//
// A quarter mile goes on the board when it was clean (no red light, in its lane, to the finish) and the car could
// have done it: no quicker than the game's own physics drives that car over the quarter mile from its best launch
// revs with the shifts at the shift light, less 5 %, and no faster through the trap than it does there, and 8 %
// more. (A drag run has no replay as a lap has: these limits, the server's own clock from green and the run being
// one the server started are what hold a made-up time off the board.)
// [quickest ET in s, fastest trap speed in km/h], from `node tools/drag-launch-test.mjs none limits`; a car not in
// the list (a new one, the Rocket) puts no time on the board until it is added.
export const DRAG_LIMITS = {
  w201: [15.94, 146], crv: [17.97, 131], enyaq: [14.4, 165], rav4: [17.43, 137], passat: [17.46, 132], mazda6: [16.76, 138],
  bz4x: [12.38, 189], f40: [11.42, 220], cgt: [11.16, 228], audi200: [14.27, 161], m3: [12.49, 199], impreza: [12.27, 186],
  focus: [11.36, 197], bus: [26.2, 85],
};
// the board's track name for the drag strip (the laps table's `track`)
export const DRAG_TRACK = 'drag';

// r: a run's figures as the page sends them (seconds, km/h); null when it may go on the board, else why not
export function dragRefused(car, r) {
  const lim = DRAG_LIMITS[car];
  if (!lim) return 'car';
  if (!r || r.red || r.foul || r.dnf) return 'not clean';
  const { et, rt, vq, t60, t330, t8, t1000 } = r;
  if (![et, rt, vq].every(Number.isFinite)) return 'figures';
  if (et < lim[0] || et > 120) return 'et';
  if (vq > lim[1] || vq <= 0) return 'trap';
  if (rt < 0 || rt > 30) return 'rt';
  // (the splits, where there are any, in order and inside the run)
  const sp = [t60, t330, t8, t1000].filter((v) => v != null);
  if (!sp.every(Number.isFinite) || sp.some((v, i) => v <= 0 || v >= et || (i && v <= sp[i - 1]))) return 'splits';
  return null;
}
