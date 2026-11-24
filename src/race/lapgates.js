// The hidden gates of the Toomemägi lap (Martin, 24 Nov 2026: a player went up Kroonuaia from the Jakobi
// crossing, touched the river checkpoint, turned round and came back down, skipping Lai and the river loop;
// another drove the river loop backwards). Four checkpoints said nothing about the way between them, so the lap
// now has a gate about every 50 m along it as well, and they must be passed in order: a gate reached while two
// or more earlier ones are still missing is a short cut (or the wrong way round). One missed gate is forgiven
// when the next one is passed.
//
// A gate is a line across the road (the checkpoints too), crossed on the way the car moved since the last frame,
// so a slow frame cannot jump one. Going wide must not cost the lap (Martin, 24 Nov: "if you go off onto the grass
// without gaining an advantage"), so a gate reaches WIDE metres beyond the road; on the inside of a bend only
// INSIDE metres, where leaving the road would be a short cut over the corner. Neither end comes nearer than CLEAR
// to another part of the lap, and where the lap passes too close to itself (the Jakobi crossing it drives twice,
// the start line) there is no gate.
//
// Touching a gate too early cancels the lap at once where the gate lies well away from any other part of the lap
// (only a short cut gets there); one nearer (going on up Kroonuaia past the Jakobi crossing that the lap turns at
// the first time) is only not counted, so overshooting a corner and coming back stays free. Either way the finish
// reached with gates missing does not count.
//
// Shared by the game (race.js) and the server's replay check (worker/index.js), so both judge the same way.
export const WIDE = 50;             // metres beyond the road a gate reaches
export const INSIDE = 14;           // ... on the inside of a bend
export const GATE_STEP = 25;        // points between gates (about 51 m)
const BEND = 4;                     // metres the lap bows over 50 m either side before a gate counts as on a bend
const CLEAR = 18;                   // metres between a gate's end and any other part of the lap, beyond its road
const STRICT = 60;                  // ... and from this far on, touching it out of order cancels the lap at once
const APART = 150;                  // metres along the lap before a point counts as another part of it
const NEAR_CP = 12;                 // points: no hidden gate this close to a checkpoint
const NEAR_START = 25;              // points: nor this close to the start/finish line
const MIN_REACH = 4;                // metres beyond the road a gate reaches at the least (else there is none)

// [{ i, x, z, ax, az, bx, bz, cp, strict }] in lap order: a..b the line across the road (a on the right),
// cp the checkpoint's number (0..), or -1 for a hidden gate
export function lapGates(track) {
  const out = [];
  for (const _ of lapGatesSteps(track, out));      // eslint-disable-line no-unused-vars
  return out;
}

// the same as a job for the work queue (about 40 ms in all): fills out, yielding after each gate
export function* lapGatesSteps(track, gates) {
  const P = track.pts, HW = track.hw, N = P.length, CP = track.checkpoints;
  const s = [0];
  for (let i = 1; i < N; i++) s.push(s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = track.length;
  const along = (a, b) => { const d = Math.abs(s[a] - s[b]); return Math.min(d, L - d); };
  const at = (i) => P[(i % N + N) % N];
  for (let i = 0; i < N; i++) {
    const k = CP.indexOf(i);
    if (k < 0 && (i % GATE_STEP || i < NEAR_START || i > N - NEAR_START || CP.some((c) => Math.abs(c - i) < NEAR_CP))) continue;
    const p = P[i], q = at(i + 3), o = at(i - 3);
    let tx = q[0] - o[0], tz = q[1] - o[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;                     // to the right of the way the lap goes
    // the bend: the chord 25 points either side bows to its inside
    const a = at(i - 25), b = at(i + 25);
    const bow = ((a[0] + b[0]) / 2 - p[0]) * nx + ((a[1] + b[1]) / 2 - p[1]) * nz;   // > 0: the inside is right
    // the other parts of the lap near this one
    const far = [];
    for (let j = 0; j < N; j++) if (along(i, j) >= APART && Math.hypot(P[j][0] - p[0], P[j][1] - p[1]) < HW[i] + WIDE + 60) far.push(j);
    const roomAt = (x, z) => { let m = Infinity; for (const j of far) m = Math.min(m, Math.hypot(P[j][0] - x, P[j][1] - z) - HW[j]); return m; };
    // how far out the gate can reach on one side (sg 1 right, -1 left), beyond the road
    const reach = (sg) => {
      const want = Math.abs(bow) > BEND && Math.sign(bow) === sg ? INSIDE : WIDE;
      let r = -1;
      for (let d = 0; d <= want; d += 2) {
        if (roomAt(p[0] + nx * sg * (HW[i] + d), p[1] + nz * sg * (HW[i] + d)) < CLEAR) break;
        r = d;
      }
      return r;
    };
    const rr = reach(1), rl = reach(-1);
    if (k < 0 && (rr < MIN_REACH || rl < MIN_REACH)) continue;
    const er = HW[i] + Math.max(rr, 0), el = HW[i] + Math.max(rl, 0);
    const g = { i, x: p[0], z: p[1], ax: p[0] + nx * er, az: p[1] + nz * er, bx: p[0] - nx * el, bz: p[1] - nz * el, cp: k };
    // the nearest other road to any point of the gate
    let room = Infinity;
    for (let d = -el; d <= er; d += 2) room = Math.min(room, roomAt(p[0] + nx * d, p[1] + nz * d));
    g.strict = k >= 0 || room >= STRICT;
    gates.push(g);
    yield;
  }
}

// does the move from (ax, az) to (bx, bz) cross the gate's line?
export function throughGate(g, ax, az, bx, bz) {
  const cr = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const d1 = cr(g.ax, g.az, g.bx, g.bz, ax, az), d2 = cr(g.ax, g.az, g.bx, g.bz, bx, bz);
  if ((d1 > 0 && d2 > 0) || (d1 < 0 && d2 < 0)) return false;
  const d3 = cr(ax, az, bx, bz, g.ax, g.az), d4 = cr(ax, az, bx, bz, g.bx, g.bz);
  return !((d3 > 0 && d4 > 0) || (d3 < 0 && d4 < 0)) && !(d1 === 0 && d2 === 0);
}
