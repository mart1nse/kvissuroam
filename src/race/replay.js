// Lap record replays (Martin, 2026-11-24): the record lap of each car, kept on the server as movement, not
// video, and watched on demand like a spectated player (a lap time on the LAP TIMES board is the way in).
//
// While a lap or a stage run is timed, the car is written down ten times a second of the lap clock: the same
// values a position for the other players carries (multiplayer.js poseNow: place, turn, speed, steering, pedals,
// revs, slides, ground), at the same rounding, as whole numbers. Each sample sits at an exact moment of the lap
// (the car between the two frames around it), so a lap of 1:30.00 is 901 samples and one at the finish line.
// It costs nothing to speak of while driving: 21 numbers into a typed array, made once and reused.
//
// Only a lap the server takes as the car's record goes there (multiplayer.js), packed: each sample as its change
// from the one before (mostly small numbers and noughts), as text, gzipped. About 20 to 40 KB a lap.

// decimals each value of a position is sent to the other players with (multiplayer.js), and a replay keeps
export const POSE_DEC = [2, 2, 2, 3, 3, 3, 2, 2, 3, 0, 0, 2, 2, 2, 0, 1, 1, 1, 1, 1, 0];

export const FIELDS = POSE_DEC.length;            // 21
export const STEP = 0.1;                          // seconds between samples
const SC = POSE_DEC.map((d) => 10 ** d);
const MAX_S = 900;                                // a lap or a run longer than this (15 min) is not written down
const ANG = new Set([3, 4, 5, 8]);                // yaw, pitch, roll, steering: the short way round
const SMOOTH = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19]);   // (the rest are on/off: the nearer one)

function mix(a, b, f, out) {
  for (let k = 0; k < FIELDS; k++) {
    if (!SMOOTH.has(k)) { out[k] = f < 0.5 ? a[k] : b[k]; continue; }
    let d = b[k] - a[k];
    if (ANG.has(k)) d = Math.atan2(Math.sin(d), Math.cos(d));
    out[k] = a[k] + d * f;
  }
  return out;
}

// pose(car, out): fills out with the car's position values (multiplayer.js poseNow)
export function createRecorder(pose) {
  const cur = new Float64Array(FIELDS), prev = new Float64Array(FIELDS), tmp = new Float64Array(FIELDS);
  let prevT = null, buf = null, n = 0, t0 = 0, on = false;
  function push(src) {
    if ((n + 1) * FIELDS > buf.length) {
      if (buf.length >= (MAX_S / STEP + 2) * FIELDS) { on = false; return; }      // too long a lap: no replay of it
      const b = new Int32Array(Math.min(buf.length * 2, (MAX_S / STEP + 2) * FIELDS));
      b.set(buf); buf = b;
    }
    for (let k = 0; k < FIELDS; k++) buf[n * FIELDS + k] = Math.round(src[k] * SC[k]);
    n++;
  }
  // the samples due up to time t, between the last frame (prevT) and this one (curT)
  function emit(t, curT) {
    while (on && t0 + n * STEP <= t + 1e-9) {
      const ts = t0 + n * STEP;
      const f = prevT == null || curT <= prevT ? 1 : Math.max(0, Math.min(1, (ts - prevT) / (curT - prevT)));
      push(prevT == null ? cur : mix(prev, cur, f, tmp));
    }
  }
  return {
    get on() { return on; },
    // a lap begins at tc (a moment between the last frame and this one, on the lap clock)
    begin(tc) {
      on = true; n = 0; t0 = tc;
      buf ||= new Int32Array((180 / STEP) * FIELDS);       // (three minutes; grows if needed)
    },
    cancel() { on = false; },
    // the lap ended at tc during this frame (time): its samples, the last one at tc exactly; null when none were kept
    finish(tc, time, car) {
      if (!on) return null;
      pose(car, cur);
      emit(tc, time);
      if (!on) return null;
      const last = t0 + (n - 1) * STEP;
      if (tc - last > 1e-4) push(prevT == null || time <= prevT ? cur : mix(prev, cur, Math.max(0, Math.min(1, (tc - prevT) / (time - prevT))), tmp));
      on = false;
      if (n < 2) return null;
      return { n, ms: Math.round((tc - t0) * 1000), data: buf.slice(0, n * FIELDS) };
    },
    // every frame (time: the lap clock), after begin / finish
    frame(time, car) {
      pose(car, cur);
      emit(time, time);
      prev.set(cur); prevT = time;
    },
  };
}

// ---- packing
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

// a recorded trace as text: "v,fields,ms,n" and then each sample's change from the one before. A generator, in
// steps that stop once `jobs` says the step has run long (src/jobs.js: 3 to 6 ms for a long lap on a fast
// processor, more on an old laptop, while the next lap is being driven)
function* textOf(trace, jobs) {
  const { n, ms, data } = trace, rows = [`1,${FIELDS},${ms},${n}`], row = new Array(FIELDS);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < FIELDS; k++) { const j = i * FIELDS + k; row[k] = i ? data[j] - data[j - FIELDS] : data[j]; }
    rows.push(row.join(','));
    if ((i & 63) === 63 && jobs?.late()) yield;
  }
  return rows.join(',');
}
// the text gzipped, as base64; jobs: the work queue to do the text in (none: at once)
export async function pack(trace, jobs = null) {
  let text = '';
  if (jobs) await new Promise((done) => jobs.add(function* replayPack() { text = yield* textOf(trace, jobs); done(); }, 'replay pack'));
  else { const it = textOf(trace); let r; do r = it.next(); while (!r.done); text = r.value; }
  return b64(await pipe(new TextEncoder().encode(text), new CompressionStream('gzip')));
}

// gzipped bytes from the server back into samples: { ms, n, frames: [Float64Array of FIELDS values] }
export async function unpack(bytes) {
  const text = new TextDecoder().decode(await pipe(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), new DecompressionStream('gzip')));
  const a = text.split(',').map(Number);
  const [v, f, ms, n] = a;
  if (v !== 1 || f !== FIELDS || !(n >= 2) || a.length !== 4 + n * FIELDS) throw new Error('bad replay');
  const frames = [], run = new Float64Array(FIELDS);
  for (let i = 0; i < n; i++) {
    const fr = new Float64Array(FIELDS);
    for (let k = 0; k < FIELDS; k++) { run[k] += a[4 + i * FIELDS + k]; fr[k] = run[k] / SC[k]; }
    frames.push(fr);
  }
  return { ms, n, frames };
}
export { unb64 };

// the pose at t seconds into a replay (out: an array to fill), between the two samples around it; the place
// follows the speeds at both ends (as multiplayer.js draws other cars), so a bend is an arc
export function replayAt(rp, t, out) {
  const { frames, ms } = rp, dur = ms / 1000, last = frames.length - 1;
  t = Math.max(0, Math.min(dur, t));
  let i = Math.min(last - 1, Math.floor(t / STEP));
  const ta = i * STEP, tb = i + 1 === last ? dur : (i + 1) * STEP;
  const span = Math.max(1e-3, tb - ta), f = Math.max(0, Math.min(1, (t - ta) / span));
  const A = frames[i], B = frames[i + 1];
  mix(A, B, f, out);
  const f2 = f * f, f3 = f2 * f, h10 = f3 - 2 * f2 + f, h11 = f3 - f2, h01 = 3 * f2 - 2 * f3, h00 = 1 - h01;
  out[0] = h00 * A[0] + h10 * span * A[6] + h01 * B[0] + h11 * span * B[6];
  out[1] = h00 * A[1] + h10 * span * A[7] + h01 * B[1] + h11 * span * B[7];
  out[20] = (out[20] | 0) & ~8;                   // (no HOTLAP glow on the replay)
  return out;
}
