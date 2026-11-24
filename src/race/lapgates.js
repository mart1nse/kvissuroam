// The hidden gates of the Toomemägi lap (Martin, 24 Nov 2026: a player went up Kroonuaia from the Jakobi
// crossing, touched the river checkpoint, turned round and came back down, skipping Lai and the river loop;
// another drove the river loop backwards). Four checkpoints said nothing about the way between them, so the lap
// now has a gate about every 50 m along it as well, and they must be passed in order: a gate reached while an
// earlier one is still missing is a short cut (or the wrong way round).
//
// A gate touched too early cancels the lap at once where it lies well away from any other part of the lap (only a
// short cut gets there); one nearer (going on up Kroonuaia past the Jakobi crossing that the lap turns at the first
// time) is only not counted, so overshooting a corner and coming back stays free. Either way a checkpoint or the
// finish reached with a gate still missing does not count: the lap is cancelled there.
//
// A gate is a circle round a point of the centre line, the road's half-width and GATE_R more, judged on the line
// the car moved along since the last frame (so a slow frame cannot jump one). Honest mistakes stay free: a spin
// or a wrong turn only goes back to gates already passed, and driving on comes to the next one again. Where the
// lap passes close to another part of itself (the Jakobi crossing it drives twice, the start line) there is no
// gate, so an honest car never touches a later one by being on the earlier pass.
//
// Shared by the game (race.js) and the server's replay check (worker/index.js), so both judge the same way.
export const GATE_R = 14;           // metres beyond the half-width of the road
export const GATE_STEP = 25;        // points between gates (about 51 m)
const CLEAR = 18;                   // metres between a gate and any other part of the lap, beyond both roads
const STRICT = 60;                  // ... and from this far on, touching it out of order cancels the lap at once
const APART = 150;                  // metres along the lap before a point counts as another part of it
const NEAR_CP = 12;                 // points: no hidden gate this close to a checkpoint
const NEAR_START = 25;              // points: nor this close to the start/finish line

// [{ i, x, z, r, cp, strict }] in lap order: cp is the checkpoint's number (0..), or -1 for a hidden gate
export function lapGates(track, cpRadius) {
  const P = track.pts, HW = track.hw, N = P.length, CP = track.checkpoints;
  const s = [0];
  for (let i = 1; i < N; i++) s.push(s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = track.length;
  const along = (a, b) => { const d = Math.abs(s[a] - s[b]); return Math.min(d, L - d); };
  const gates = [];
  for (let i = 0; i < N; i++) {
    const k = CP.indexOf(i);
    if (k >= 0) { gates.push({ i, x: P[i][0], z: P[i][1], r: HW[i] + cpRadius, cp: k, strict: true }); continue; }
    if (i % GATE_STEP || i < NEAR_START || i > N - NEAR_START) continue;
    if (CP.some((c) => Math.abs(c - i) < NEAR_CP)) continue;
    const r = HW[i] + GATE_R;
    let room = Infinity;                // metres from the gate's edge to the road of another part of the lap
    for (let j = 0; j < N; j++) {
      if (along(i, j) >= APART) room = Math.min(room, Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]) - r - HW[j]);
    }
    if (room >= CLEAR) gates.push({ i, x: P[i][0], z: P[i][1], r, cp: -1, strict: room >= STRICT });
  }
  return gates;
}

// does the move from (ax, az) to (bx, bz) come within the gate?
export function throughGate(g, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((g.x - ax) * dx + (g.z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(ax + dx * t - g.x, az + dz * t - g.z) < g.r;
}
