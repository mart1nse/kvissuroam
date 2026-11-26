// The account of short hitches (src/hitches.js): what counts as a hitch on a steady frame rate and on one that
// hops all the time. node tools/hitches-test.mjs
import { createHitches } from '../src/hitches.js';

let fails = 0;
const ok = (what, cond, got) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}${cond ? '' : `  (got ${JSON.stringify(got)})`}`); if (!cond) fails++; };
// a repeatable random number
const rnd = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
// once(T): true for the first frame that starts at T ms or later
const once = (T) => { let done = false; return (t) => !done && t >= T && (done = true); };
const F = { js: 3, build: 0, draw: 2, net: 0.2 };
// drive `secs` seconds: frame(i, t) gives each frame's length in ms; `since` counts from 0
const drive = (h, secs, frame, since0 = 0) => {
  const hits = [];
  for (let t = 0, i = 0; t < secs * 1000; i++) { const ms = frame(i, t); t += ms; const hit = h.frame(ms, true, F, { others: 30, since: since0 + t / 1000 }); if (hit) hits.push(hit); }
  return hits;
};

// 1. a steady 60 a second with a missed frame now and then: each one is a hitch, as before
{
  const h = createHitches();
  const hits = drive(h, 120, (i) => (i % 600 === 599 ? 33.4 : 16.7));
  ok('steady 60: every missed frame is a hitch', hits.length === 11 || hits.length === 12, hits.length);
  ok('steady 60: never uneven', h.recent.uneven === 0, h.recent.uneven);
  ok('steady 60: the line has no uneven part', !/uneven/.test(h.line) && /hitches in the last 2 min/.test(h.line), h.line);
}

// 2. a steady 120 a second: one refresh missed (16.7 ms) is a hitch there (a fast computer notices a step of 15 ms)
{
  const h = createHitches();
  const hits = drive(h, 60, (i) => (i % 1200 === 1199 ? 16.7 : 8.33));
  ok('steady 120: a single missed refresh is a hitch', hits.length >= 5 && hits.length <= 6, hits.length);
  ok('steady 120: never uneven', h.recent.uneven === 0, h.recent.uneven);
}

// 3. Martin's Xiaomi on HIGH (26 Nov 2026): a 120 Hz screen at 86 a second, frames of one refresh or two all the
// time, and two real hitches (308 ms early, 175 ms later). Before: thousands of hitches. Now: the two.
{
  const h = createHitches(), r = rnd(7), a = once(12000), b = once(150000);
  const hits = drive(h, 240, (i, t) => (a(t) ? 308 : b(t) ? 175 : r() < 0.39 ? 16.7 : 8.33));
  ok('hopping 120/60: only the frames that stand out are hitches', hits.length === 2, hits.map((x) => x.ms));
  ok('hopping 120/60: the 308 ms and the 175 ms', hits[0]?.ms === 308 && hits[1]?.ms === 175, hits.map((x) => x.ms));
  const rec = h.recent;
  ok('hopping 120/60: uneven nearly all the time', rec.uneven / rec.secs > 0.95, rec.uneven / rec.secs);
  ok('hopping 120/60: one of the two early', rec.early === 1, rec.early);
  ok('hopping 120/60: the line says so', /^frame rate uneven (9\d|100)% of the time · 2 hitches in the last 4 min of driving, longest 308 ms \(.*\), 1 of them in the first 30 s after a start$/.test(h.line), h.line);
  console.log('     ' + h.line);
}

// 4. the same phone at 99 a second (a fifth of the frames late), three refreshes (25 ms) now and then: still no hitches;
// four refreshes (33 ms) is one
{
  const h = createHitches(), r = rnd(3), a = once(40000);
  const hits = drive(h, 60, (i, t) => (a(t) ? 33.4 : r() < 0.21 ? (r() < 0.05 ? 25 : 16.7) : 8.33));
  // (in the page's first second of driving, before the account knows the frame rate, a late frame may still count)
  const later = hits.filter((x) => x.since > 1);
  ok('hopping at 99 a second: a frame of 33 ms is the one hitch', later.length === 1 && later[0].ms === 33.4 && hits.length <= 4, hits.map((x) => x.ms));
}

// 5. a 60 Hz phone that cannot hold 60 (a third of the frames take two refreshes): uneven, and a hitch is 58 ms up
{
  const h = createHitches(), r = rnd(11), a = once(30000), b = once(45000);
  const hits = drive(h, 60, (i, t) => (a(t) ? 66.8 : b(t) ? 50.1 : r() < 0.33 ? 33.4 : 16.7));
  ok('hopping 60/30: 67 ms is a hitch, 50 ms is not', hits.length === 1 && hits[0].ms === 66.8, hits.map((x) => x.ms));
  ok('hopping 60/30: uneven', h.recent.uneven / h.recent.secs > 0.9, h.recent.uneven / h.recent.secs);
}

// 6. a steady device with a rough two seconds (a place building itself: every third frame late for 2 s): the
// first of them are hitches, then that stretch is an uneven one; smooth again afterwards, and a late frame is a
// hitch again
{
  const h = createHitches(), a = once(50000);
  const hits = drive(h, 60, (i, t) => ((t > 20000 && t < 22000 && i % 3 === 0) || a(t) ? 33.4 : 16.7));
  const burst = hits.filter((x) => x.since > 19 && x.since < 23).length, after = hits.filter((x) => x.since > 49).length;
  ok('a rough two seconds: some hitches, not one a frame', burst >= 3 && burst <= 10, burst);
  ok('a rough two seconds: uneven for a few seconds only', h.recent.uneven > 0.5 && h.recent.uneven < 5, h.recent.uneven);
  ok('smooth again: a late frame is a hitch again', after === 1, after);
}

// 7. late frames one after another are one hitch, as long as its longest frame; a frame of a second is a freeze, not a hitch
{
  const h = createHitches();
  const hits = drive(h, 30, (i) => (i === 600 ? 40 : i === 601 ? 90 : i === 602 ? 50 : i === 900 ? 1200 : 16.7));
  ok('late frames in a row: one hitch', hits.length === 1, hits.length);
  ok('late frames in a row: its longest frame', Math.round(h.recent.worst) === 90, h.recent.worst);
}

// 8. hitches after the first 30 s only
{
  const h = createHitches();
  drive(h, 100, (i) => (i === 3000 || i === 4000 ? 50 : 16.7));
  ok('none early: the line says so', /2 hitches .*, none of them in the first 30 s after a start$/.test(h.line), h.line);
}

// 9. a 120 Hz screen showing every 2nd refresh (Martin's Mac, 26 Nov 2026): a picture a refresh late (25 ms) is a slip,
// not a hitch; two refreshes late (33 ms) is a hitch
{
  const h = createHitches(), R = 1000 / 120;
  let n = 0;
  for (let t = 0, i = 0; t < 60000; i++) { const ms = i % 300 === 299 ? 25 : i === 1000 ? 33.3 : 16.67; t += ms; if (h.frame(ms, true, F, { since: t / 1000 }, R, 2)) n++; }
  const r = h.recent;
  ok('120 Hz every 2nd: slips counted', r.slips >= 11 && r.slips <= 12, r.slips);
  ok('120 Hz every 2nd: the 33 ms one is the one hitch', n === 1, n);
  ok('120 Hz every 2nd: the line says it', /^screen 120 Hz, every 2nd refresh drawn, 1\d pictures a refresh late · 1 hitch/.test(h.line), h.line);
  console.log('     ' + h.line);
}
// 10. a 60 Hz screen: no slips, the line names the screen only
{
  const h = createHitches();
  for (let t = 0, i = 0; t < 30000; i++) { const ms = i === 900 ? 33.4 : 16.67; t += ms; h.frame(ms, true, F, { since: t / 1000 }, 16.67, 1); }
  ok('60 Hz: no slips', h.recent.slips === 0, h.recent.slips);
  ok('60 Hz: the line', /^screen 60 Hz · 1 hitch in the last 30 s/.test(h.line), h.line);
}

console.log(fails ? `\n${fails} failed` : '\nall ok');
process.exit(fails ? 1 : 0);
