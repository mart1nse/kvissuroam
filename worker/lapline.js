// The start/finish line of the Toomemägi lap as the game's lap timer has it (src/race/race.js): across the road at
// the lap's first point, 6 m beyond the road on both sides, crossed in the lap's direction.
export function finishLine(track) {
  const P = track.pts, N = P.length, a = P[N - 1], b = P[1], p = P[0];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
  const w = track.hw[0] + 6;
  return { i: N, x: p[0], z: p[1], tx, tz, ax: p[0] - tz * w, az: p[1] + tx * w, bx: p[0] + tz * w, bz: p[1] - tx * w, cp: -1, line: 1 };
}
// did the move from (ax, az) to (bx, bz) cross it forwards?
export function overLine(q, ax, az, bx, bz) {
  const a = (ax - q.x) * q.tx + (az - q.z) * q.tz, b = (bx - q.x) * q.tx + (bz - q.z) * q.tz;
  if (!(a < 0 && b >= 0)) return false;
  const f = a / (a - b), cx = ax + (bx - ax) * f, cz = az + (bz - az) * f;
  return Math.abs(-(cx - q.x) * q.tz + (cz - q.z) * q.tx) < Math.hypot(q.ax - q.x, q.az - q.z);
}
