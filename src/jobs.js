// Work that can wait a few frames. Building a hand-made street, the pieces of a loaded map square, a
// painted house front: each used to be done in one go the moment it was wanted, and the game stood still
// for as long as it took (0.1 to 0.4 s a time on a fast machine, up to a second on a phone in the centre,
// Martin 20 Nov). Here such work is cut into steps, and each frame only does as many as fit in a few
// milliseconds.
//
// A job is a generator function: every `yield` is a place where it may stop until the next frame
// (`yield 'frame'` before a step that is long by its nature: that one starts a frame of its own). A plain
// function is a job of one step. While the queue is not live (the loading screen, the menu, a jump across
// the map: nobody is watching the road), a job runs at once and to its end, exactly as before.
const queue = [];
let live = false, restUntil = 0, uploader = null, doubles = 0, sent = 0, stepAt = Infinity;   // stepAt: when the step now running began (Infinity outside the queue)
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
    // (the same function while it still waits or runs: not again. A place whose `built` flag was set only
    // inside its build was queued anew every frame until the queue reached it, and then built that many
    // times over: Katoliku nine times in a test drive as an old computer, 21 Nov 2026. `doubles` counts
    // them for the perf check.)
    if (live) for (const q of queue) if (q.fn === fn && !q.done) { doubles++; if (doubles === 1) console.warn('queued twice:', label); return q; }
    const job = { fn, it: fn instanceof GEN ? fn() : (function* () { fn(); })(), done: false, label, n: 0, t: now(), cancel() { this.done = true; } };
    if (live) queue.push(job); else finish(job);
    return job;
  },
  // a generator's steps all at once, where the work cannot wait; gives what it returns
  run(gen) { let r; do r = gen.next(); while (!r.done); return r.value; },
  // each frame: steps until `budget` ms have gone. After a step that took long by itself, nothing for a
  // moment, so that long steps come as single late frames with smooth driving between and not as a freeze.
  // `long`: what counts as a long step (a slow machine's frames are long anyway: main.js passes a share of
  // the frame time). `hurry`: the work has fallen far behind (see `waited`), so no rest after a long step,
  // the budget is used up: an old computer otherwise did one step every other frame and drove through an
  // empty city for minutes (Martin's 2019 MacBook Air, 21 Nov 2026).
  tick(budget = 4, long = 12, hurry = false) {
    const t0 = now();
    sent = 0;
    if (t0 < restUntil && !hurry) return;
    while (queue.length) {
      const job = queue[0];
      if (job.done) { queue.shift(); continue; }
      const s0 = stepAt = now();
      job.n++;
      let fresh = false;
      try { const r = job.it.next(); if (r.done) { job.done = true; queue.shift(); } else fresh = r.value === 'frame'; } catch (err) { console.error(err); job.done = true; queue.shift(); }
      stepAt = Infinity;
      const t = now();
      if (t - s0 > 20) { slow.push([job.label, job.n, Math.round(t - s0)]); if (slow.length > 150) slow.shift(); }
      if (t - s0 > long && !hurry) { restUntil = t + pause(t); break; }
      if (t - t0 >= budget) break;
      // `yield 'frame'`: the job's next step is a long one by its nature (a big wall to paint, a picture to
      // send to the graphics card), so it is not started on top of what this frame has done already. The
      // steps before it used to fill the frame's few milliseconds, and the long one then ran in the same
      // frame: 5 ms and 10 ms are a late frame, 10 ms by itself is not.
      if (fresh && t - t0 > 1 && !hurry) break;
      // a step that sent a picture to the graphics card is the frame's last: the call itself returns in no
      // time on a real card, which takes the picture in while the next frame is drawn, so two or three used to
      // go in one frame whatever the code meant (a map square's photo, mask and cover: 2.5 megapixels at once)
      if (sent && !hurry) break;
    }
  },
  // Has the step now running taken over `ms`? For long loops inside a job: `if (jobs.late()) yield;` after
  // every so many rows or items. A fixed number of rows a step is the right length on one machine only: the
  // ground mask of a map square was two steps of 10 to 15 ms on a fast processor and of 100 to 150 ms on a
  // 2019 MacBook Air, each a freeze there (Martin, 21 Nov 2026). Outside the queue (the menu, a jump across
  // the map, a job run to its end) it is never late, so nothing stops.
  late(ms = 5) { return now() - stepAt > ms; },
  // something long ran outside the queue (a place built itself): the queue rests as after a long step
  rest() { const t = now(); restUntil = Math.max(restUntil, t + pause(t)); },
  get resting() { return now() < restUntil; },
  get pending() { return queue.length; },
  // how long the oldest piece of queued work has been waiting, in ms (0 with nothing queued)
  get waited() { while (queue.length && queue[0].done) queue.shift(); return queue.length ? now() - queue[0].t : 0; },
  get live() { return live; },
  get slow() { return slow; },
  get doubles() { return doubles; },
  // something slow outside the queue (the warmer sending a big picture), for the same list
  note(label, ms) { slow.push([label, 0, ms]); if (slow.length > 150) slow.shift(); },
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
  upload(tex) { if (uploader && live) { sent += (tex.image?.width || 0) * (tex.image?.height || 0) || 1; try { uploader(tex); } catch (err) { console.warn(err); } } },
  // pixels the queue has sent to the graphics card in this frame (the warmer then sends none of its own)
  get sentPx() { return sent; },
  // something else sent this much in this frame (another player's car on its way to the card, main.js): counted
  // with the queue's own, so the warmer sends no picture on top of it
  tell(px) { sent += px || 1; },
};
