// Work that can wait a few frames. Building a hand-made street, the pieces of a loaded map square, a
// painted house front: each used to be done in one go the moment it was wanted, and the game stood still
// for as long as it took (0.1 to 0.4 s a time on a fast machine, up to a second on a phone in the centre,
// Martin 20 Nov). Here such work is cut into steps, and each frame only does as many as fit in a few
// milliseconds.
//
// A job is a generator function: every `yield` is a place where it may stop until the next frame. A plain
// function is a job of one step. While the queue is not live (the loading screen, the menu, a jump across
// the map: nobody is watching the road), a job runs at once and to its end, exactly as before.
const queue = [];
let live = false, restUntil = 0, uploader = null;
const slow = [];                            // the last steps that took over 20 ms: [label, step, ms] (for looking into pauses)
const now = () => performance.now();
const GEN = Object.getPrototypeOf(function* () {}).constructor;

// How long nothing is done after a long step. Falling behind (a fast drive through the centre queues more than
// gets done) shortens it: work that has waited over 2 s gets a third of the pause, over 5 s none, so that
// houses do not turn up late for the sake of smoothness.
function pause(t) {
  while (queue.length && queue[0].done) queue.shift();
  const waited = queue.length ? t - queue[0].t : 0;
  return waited > 5000 ? 0 : waited > 2000 ? 30 : 90;
}
function finish(job) {
  try { for (;;) { const r = job.it.next(); if (r.done) break; } } catch (err) { console.error(err); }
  job.done = true;
}

export const jobs = {
  // queue a job; returns a handle: { done, cancel() }
  add(fn, label = '') {
    const job = { it: fn instanceof GEN ? fn() : (function* () { fn(); })(), done: false, label, n: 0, t: now(), cancel() { this.done = true; } };
    if (live) queue.push(job); else finish(job);
    return job;
  },
  // a generator's steps all at once, where the work cannot wait; gives what it returns
  run(gen) { let r; do r = gen.next(); while (!r.done); return r.value; },
  // each frame: steps until `budget` ms have gone. After a step that took long by itself, nothing for a
  // moment, so that long steps come as single late frames with smooth driving between and not as a freeze.
  tick(budget = 4) {
    const t0 = now();
    if (t0 < restUntil) return;
    while (queue.length) {
      const job = queue[0];
      if (job.done) { queue.shift(); continue; }
      const s0 = now();
      job.n++;
      try { if (job.it.next().done) { job.done = true; queue.shift(); } } catch (err) { console.error(err); job.done = true; queue.shift(); }
      const t = now();
      if (t - s0 > 20) { slow.push([job.label, job.n, Math.round(t - s0)]); if (slow.length > 40) slow.shift(); }
      if (t - s0 > 12) { restUntil = t + pause(t); break; }
      if (t - t0 >= budget) break;
    }
  },
  // something long ran outside the queue (a place built itself): the queue rests as after a long step
  rest() { const t = now(); restUntil = Math.max(restUntil, t + pause(t)); },
  get resting() { return now() < restUntil; },
  get pending() { return queue.length; },
  get live() { return live; },
  get slow() { return slow; },
  get labels() { return queue.map((j) => j.label + (j.done ? ' (done)' : '') + ' ' + j.n); },
  // live while somebody is driving and watching; switching it off finishes everything queued at once
  setLive(v) {
    if (live === v) return;
    live = v;
    if (!v) this.drain();
  },
  drain() { while (queue.length) { const job = queue.shift(); if (!job.done) finish(job); } },
  // sending a picture to the graphics card ahead of the frame that first shows it (set by main.js)
  setUploader(f) { uploader = f; },
  upload(tex) { if (uploader && live) { try { uploader(tex); } catch (err) { console.warn(err); } } },
};
