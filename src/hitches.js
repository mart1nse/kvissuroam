// Short hitches while driving, and what each one was.
//
// Martin 2026-11-25, 85 to 95 online on a desktop: "feeling some stutters every now and then, although stats show
// fine". The options window showed the frames of its last two seconds only (late frames 0/2 s, longest 18 ms), which
// a hitch every half minute is never in, least of all with the options open. And the test drives, headless on a
// fast machine with no graphics card, cannot feel what a real one does. So the game keeps its own account: every
// frame that came late while plain driving (the same "felt" rule as the freezes of 1 s and more in src/stats.js)
// is noted with what the frame before it was busy with, for the last five minutes of driving in the options
// window and, counted by kind, for /stats.
//
//   build    queued building work (src/jobs.js, src/warm.js), another player's car on its way to the card
//   draw     the game handing the picture to the graphics card (new shaders, pictures and models go here)
//   online   the other players: their cars' places, the list, name tags, the race
//   game     the rest of the game's own frame
//   page:x   the page busy outside the frame: net (a message from the server), car (a car model back from its
//            worker)
//   card     none of those: the page was free and the picture still came late (the graphics card, the browser
//            putting the page together, or the system)
// A frame is late at 1.75 times the usual frame (29 ms at 60 a second: a frame missed); late frames one after
// another are one hitch. A second or more is a freeze, counted in src/stats.js.
//
// A frame rate that hops all the time is not a row of hitches (Martin's Xiaomi, 25 and 26 Nov 2026: HIGH chosen by
// hand draws every refresh of its fast screen, the phone manages 71 to 99 a second, and the account read "5364
// hitches in the last 5 min", 18 a second, with the real ones of 175 and 308 ms lost among them; on /stats such a
// visit used up its 60 rows in its first seconds). While four or more of the last 120 frames come late
// the frame rate is uneven: that time is counted as such, and a hitch there is a frame 1.75 times those ordinary
// late ones (29 ms and more on that phone), the step that stands out from the rest.

// time taken on the page outside the game's frame, since the last frame: note(what, t0) from the handlers
export const outside = {
  ms: 0, what: '', most: 0,
  note(what, t0) { const d = performance.now() - t0; this.ms += d; if (d > this.most) { this.most = d; this.what = what; } },
  take() { const o = { ms: this.ms, what: this.what || 'net' }; this.ms = 0; this.most = 0; this.what = ''; return o; },
};

const SPAN = 300;                  // seconds of driving remembered
export const WHY = { build: 'building', draw: 'drawing', online: 'other players', game: 'game code', card: 'graphics card or browser', 'page:net': 'server messages', 'page:car': 'a new car model' };

const lateAt = (ms) => Math.max(ms * 1.75, ms + 6);

export function createHitches({ report = null } = {}) {
  const log = [];                  // [driving clock s, ms, why, s since the drive began or the car was put somewhere]
  const win = new Float32Array(120), sorted = new Float32Array(120);
  const rough = new Float32Array(SPAN / 10), roughAt = new Int32Array(SPAN / 10).fill(-1);   // uneven seconds per 10 s of driving
  let base = 16.7, top = 16.7, clock = 0, frames = 0, wi = 0, run = false, uneven = false;
  const usual = { js: 0, build: 0, draw: 0, net: 0 };
  return {
    // is the frame rate uneven now (four or more of the last 120 frames late)?
    get uneven() { return uneven; },
    // each frame. ms: how long the frame before lasted; felt: plain driving (see quietAt in main.js);
    // f: what that frame did ({ js, build, draw, net, progs, tex, car }, ms); s: { others, since } for the report
    frame(ms, felt, f, s = {}) {
      const out = outside.take();
      if (!felt || !(ms > 0) || ms >= 1000) { run = false; return null; }
      clock += ms / 1000;
      frames++;
      while (log.length && clock - log[0][0] > SPAN) log.shift();
      // (judged against the frames before it, from the page's eighth frame of driving on)
      uneven = top >= lateAt(base);
      if (uneven) { const k = Math.floor(clock / 10), i = k % rough.length; if (roughAt[i] !== k) { roughAt[i] = k; rough[i] = 0; } rough[i] += ms / 1000; }
      const late = wi >= 8 && ms >= lateAt(uneven ? top : base);
      // the usual frame: the lower quarter of the last 120 (a frame rate that has settled lower is the usual one
      // within two seconds), and the ordinary late one: the 4th longest of them (the usual frame again while
      // three or fewer were late: a late frame a second on a steady frame rate is a hitch each time, four in the
      // last 120 frames are the frame rate itself)
      win[wi++ % 120] = ms;
      if (wi % 8 === 0 || wi < 30) {
        const n = Math.min(wi, 120), q = sorted.subarray(0, n);
        q.set(win.subarray(0, n)); q.sort();
        base = q[n >> 2];
        top = n < 8 ? base : q[n - 1 - Math.min(3, n >> 3)];
      }
      if (!late) {
        run = false;
        for (const k in usual) usual[k] += ((f[k] || 0) - usual[k]) * 0.02;
        return null;
      }
      // (late frames one after another are one hitch, as long as its longest frame)
      if (run && log.length) { const last = log[log.length - 1]; if (ms > last[1]) last[1] = ms; return null; }
      run = true;
      const extra = ms - base;
      let why = 'card', most = extra * 0.4;
      for (const [k, v] of [['build', (f.build || 0) - usual.build], ['draw', (f.draw || 0) - usual.draw], ['online', (f.net || 0) - usual.net], ['page', out.ms]]) if (v > most) { most = v; why = k; }
      if (why === 'card' && (f.js || 0) - usual.js > extra * 0.4) why = 'game';
      if (why === 'page') why = `page:${out.what}`;
      const hit = { ms, why, news: f.progs > 0 ? 'shaders' : f.tex > 0 ? 'pictures' : f.car ? 'car' : 'none', others: s.others || 0, since: s.since || 0 };
      log.push([clock, ms, why, hit.since]);
      try { report?.(hit); } catch { /* never in the way of the game */ }
      return hit;
    },
    // the last five minutes of driving: { secs, n, worst, by: [[why, n], ...], early, uneven, frames }
    // (early: hitches within 30 s of the drive beginning or the car being put somewhere; uneven: seconds)
    get recent() {
      const by = new Map();
      let worst = 0, early = 0, un = 0;
      for (const [, ms, why, since] of log) { by.set(why, (by.get(why) || 0) + 1); worst = Math.max(worst, ms); if (since < 30) early++; }
      const k0 = Math.floor(clock / 10);
      for (let i = 0; i < rough.length; i++) if (roughAt[i] > k0 - rough.length) un += rough[i];
      const secs = Math.min(clock, SPAN);
      return { secs, n: log.length, worst, by: [...by].sort((a, b) => b[1] - a[1]), early, uneven: Math.min(un, secs), frames };
    },
    // one line for the options window
    get line() {
      const r = this.recent;
      if (r.secs < 5) return '';
      const span = r.secs < 90 ? `${Math.round(r.secs)} s` : `${Math.round(r.secs / 60)} min`;
      const share = r.uneven / r.secs;
      const rate = share >= 0.1 ? `frame rate uneven ${Math.round(share * 100)}% of the time · ` : '';
      if (!r.n) return `${rate}no hitches in the last ${span} of driving`;
      const when = r.n === 1 ? (r.early ? ', in the first 30 s after a start' : '') : r.early ? `, ${r.early === r.n ? 'all' : r.early} of them in the first 30 s after a start` : ', none of them in the first 30 s after a start';
      return `${rate}${r.n} ${r.n === 1 ? 'hitch' : 'hitches'} in the last ${span} of driving, longest ${Math.round(r.worst)} ms (${r.by.map(([k, n]) => `${n} ${WHY[k] || k}`).join(', ')})${when}`;
    },
  };
}
