// Where the cars really drive a stage (Martin, 26 Nov 2026: the wheel tracks painted on the Raadi stage should be
// "more driver driven": "start logging the actual skid marks on gravel and like 5m side to side dirt grass too and
// merge them to some kind of a rough outline of the racing line").
//
// While a run is timed, and for a little way past the finish (the braking there), the car is written down every
// STEP metres of its way, or sooner when it turns on the spot: where it is, which way it points, how fast it goes
// forwards and sideways, how hard each axle slides and rubs, the ground under it. From that and the car's wheelbase
// and track the four wheel paths can be drawn again, with how much each wore the ground (tools/race/raadi-lines.mjs
// merges the runs of everybody into the stage's painted line). It costs a distance check a frame and ten numbers
// into a typed array every STEP metres.
//
// A run, finished or cancelled, that was at least MIN_M long goes to the server packed like a replay
// (src/race/replay.js): each sample as its change from the one before, as text, gzipped, about 10 to 20 KB.
// Nobody's name goes with it. The server keeps the runs (worker/index.js, /api/line) until the painted line has
// been made from them for the last time, a day after the stage opens to everyone; then this file goes.

export const LINE_FIELDS = 10;             // x, z (cm), yaw (mrad), speed forwards and sideways (dm/s), slide front
                                           // and rear (0..50), rub front and rear (dm/s), flags
export const LINE_V = 1;
const F = LINE_FIELDS;
const STEP = 0.75;                         // metres between samples
const TURN = 0.07;                         // ... or this much turned (radians) after at least TURN_M of the way
const TURN_M = 0.15;
const MIN_M = 150;                         // a shorter run is not sent
const MAX_N = 8000;                        // samples at most (6 km)
const TAIL_M = 150, TAIL_S = 8;            // past the finish: this far or this long, whichever comes first
const JUMP = 30;                           // the car was moved (a new start, the map): the run's log ends

const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };

// the samples as text, in steps of the work queue (as a replay's: src/race/replay.js textOf)
function* textOf(data, n, jobs) {
  const rows = [], row = new Array(F);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < F; k++) { const j = i * F + k; row[k] = i ? data[j] - data[j - F] : data[j]; }
    rows.push(row.join(','));
    if ((i & 63) === 63 && jobs?.late()) yield;
  }
  return rows.join(',');
}

// jobs: the work queue; track: the stage's name on the server; send: false keeps everything but the request (test
// runs measure the same work without writing to the server)
export function createLineLog({ jobs, track, send = true, url = '/api/line' }) {
  let buf = null, n = 0, on = false, meta = null, lx = 0, lz = 0, lyaw = 0, dist = 0;
  let tailAt = 0, tailEnd = 0;             // past the finish: until this moment or this far
  let closed = false;                      // the server takes no more (the line is made): nothing is written down
  let sent = 0, last = null;

  function push(car) {
    if (n >= MAX_N) return;
    if ((n + 1) * F > buf.length) { const b = new Int32Array(Math.min(buf.length * 2, MAX_N * F)); b.set(buf); buf = b; }
    const o = n * F;
    buf[o] = Math.round(car.x * 100); buf[o + 1] = Math.round(car.z * 100); buf[o + 2] = Math.round(car.yaw * 1000);
    buf[o + 3] = Math.round((car.vx || 0) * 10); buf[o + 4] = Math.round((car.vy || 0) * 10);
    buf[o + 5] = Math.round(Math.min(1, car.skidF || 0) * 50); buf[o + 6] = Math.round(Math.min(1, car.skidR || 0) * 50);
    buf[o + 7] = Math.round(Math.min(60, car.rubF || 0) * 10); buf[o + 8] = Math.round(Math.min(60, car.rubR || 0) * 10);
    // flags: 1 braking, 2 in the air, 4 in water, 8 reversing; the ground under the car's middle (data.js SURFACE) from 16 up
    buf[o + 9] = (car.brake > 0 ? 1 : 0) | (car.airborne ? 2 : 0) | (car.inWater ? 4 : 0) | (car.reversing ? 8 : 0) | ((car.surface & 7) << 4);
    n++;
    lx = car.x; lz = car.z; lyaw = car.yaw;
  }

  async function post(m, data, count) {
    try {
      let text = '';
      await new Promise((done) => jobs.add(function* linePack() { text = yield* textOf(data, count, jobs); done(); }, 'line pack'));
      const z = b64(new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()));
      last = { ...m, n: count, bytes: z.length };
      if (!send) return;
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v: LINE_V, track, ...m, n: count, z }) });
      if (res.status === 410) closed = true;
      else if (res.ok) sent++;
    } catch { /* a run's line lost: the next one counts as much */ }
  }

  // what is written down so far goes off (when it is long enough), and the log is off until the next start
  function flush() {
    if (!on) return;
    on = false; tailAt = 0;
    if (dist < MIN_M || n < 2) return;
    post(meta, buf.slice(0, n * F), n);
  }

  return {
    get on() { return on; },
    get sent() { return sent; },
    get last() { return last; },             // (for tests: what the last packed run was)
    // the clock starts: carId, and the car's own measures to draw its wheels from
    begin(car, carId) {
      flush();
      if (closed) return;
      buf ||= new Int32Array(F * 4096);
      const s = car.spec || {};
      meta = { car: carId, done: 0, ms: 0, pen: 0, ty: car.tyres === 'gravel' ? 'gravel' : 'road',
        m: [Math.round((car.a || 0) * 100), Math.round((car.b || 0) * 100), Math.round((s.track || 0) * 100), Math.round((s.tyreWidth?.[1] || 0.2) * 100)] };
      on = true; n = 0; dist = 0; tailAt = 0;
      push(car);
    },
    // through the finish: the time and its penalty seconds; the log runs on a little (the braking past the line)
    finish(ms, pen) {
      if (!on) return;
      meta.done = 1; meta.ms = ms; meta.pen = pen || 0;
      tailAt = performance.now() + TAIL_S * 1000; tailEnd = dist + TAIL_M;
    },
    // the run is over without a finish, or the car is being put somewhere: what there is goes off
    cancel() { flush(); },
    // every frame
    frame(car) {
      if (!on) return;
      const d = Math.hypot(car.x - lx, car.z - lz);
      if (d > JUMP) { flush(); return; }
      if (d >= STEP || (d >= TURN_M && Math.abs(Math.atan2(Math.sin(car.yaw - lyaw), Math.cos(car.yaw - lyaw))) >= TURN)) { dist += d; push(car); }
      if (tailAt && (dist >= tailEnd || performance.now() >= tailAt)) flush();
    },
  };
}

// (for the tools and the tests) the text of a run back into samples: Int32Array of n * LINE_FIELDS
export function lineSamples(text, n) {
  const a = text.split(',');
  if (a.length !== n * F) throw new Error('bad line');
  const out = new Int32Array(n * F);
  for (let i = 0; i < n; i++) for (let k = 0; k < F; k++) { const j = i * F + k; out[j] = (i ? out[j - F] : 0) + Number(a[j]); }
  return out;
}
