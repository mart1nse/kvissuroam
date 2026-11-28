// The drag strip's two lanes on the server (worker/drag.js, behind ?drag=1 from 27 Nov 2026): who holds which lane,
// the race of two starting by itself when both are in, a practice on one's own, the results passed on, the 30 Hz
// place feed going to the other driver only, a lane freed when its page goes, and which runs go on the board.
//   node tools/drag-desk-test.mjs
import assert from 'node:assert/strict';
import { DragDesk } from '../worker/drag.js';

const all = [], socks = [];
const kept = [], refused = [];
const lobby = { broadcast: (m) => all.push(m), ctx: { getWebSockets: () => socks }, dragTime: (t) => kept.push(t), dragRefused: (m, r, why) => refused.push(why) };
const sock = (id, name) => {
  let att = JSON.stringify({ id, name, car: 'f40', ip: `ip-${id}` });
  const ws = { got: [], send: (s) => ws.got.push(JSON.parse(s)), deserializeAttachment: () => JSON.parse(att), serializeAttachment: (a) => { att = JSON.stringify(a); } };
  socks.push(ws);
  return ws;
};
const desk = new DragDesk(lobby);
const A = sock('a', 'Ann'), B = sock('b', 'Bob'), C = sock('c', 'Cid');
const me = (ws) => ws.deserializeAttachment();
const say = (ws, m) => desk.message(ws, me(ws), { t: 'drag', ...m });
const last = (op) => all.filter((m) => m.op === op).at(-1);

assert.equal(desk.message(A, me(A), { t: 'race', op: 'x' }), false, 'not a drag message');
// Ann into the right lane: everyone told
say(A, { op: 'in', l: 0 });
assert.deepEqual(last('lanes').l, [{ id: 'a', name: 'Ann', run: 0 }, null]);
// Cid cannot take Ann's lane
say(C, { op: 'in', l: 0 });
assert.deepEqual(C.got.at(-1), { t: 'drag', op: 'no', l: 0 });
// Ann practises: her own green, clamped to 0.4..6 s ahead, her lane busy
const t0 = Date.now();
say(A, { op: 'solo', go: t0 + 60000 });
const solo = last('go');
assert.ok(solo.go - t0 <= 6100 && solo.go - t0 >= 5900, 'a practice green no later than 6 s');
assert.deepEqual(solo.l, ['a', null]);
assert.equal(last('lanes').l[0].run, 1, 'lane on a run');
// Bob pulls in beside: no race while Ann is on her practice run
const goes = all.filter((m) => m.op === 'go').length;
say(B, { op: 'in', l: 1 });
assert.equal(all.filter((m) => m.op === 'go').length, goes, 'no race of two during a practice');
// Ann's practice ends at once, before its green has come here: not on the board (and a practice's figures go to nobody)
const run1 = { rt: 0.31, et: 12.4, t60: 2.4, t330: 5.2, t8: 8.1, t1000: 10.1, v8: 160, vq: 200, red: 0, foul: 0, dnf: 0, tot: 12.71 };
say(A, { op: 'end', run: solo.run, r: run1, inp: 'kb' });
assert.equal(all.filter((m) => m.op === 'res').length, 0, 'a practice run is told to nobody');
assert.deepEqual(kept, []); assert.deepEqual(refused, ['clock'], 'a time faster than the server\'s own clock is refused');
say(A, { op: 'end', run: solo.run, r: run1 });
assert.equal(refused.length, 1, 'a run is judged once');
// the next practice, its figures after its R/T + ET has passed here: on the board (Bob out of his lane meanwhile, or
// Ann back in hers would race him)
say(B, { op: 'out' });
const practise = (r, ago = 20000, slow = false) => { say(A, { op: 'out' }); say(A, { op: 'in', l: 0 }); say(A, { op: 'solo', go: Date.now() + 1000 }); const g = last('go'); desk.lanes[0].go = Date.now() - ago; if (slow) desk.lanes[0].at = desk.lanes[0].go - 1000; say(A, { op: 'end', run: g.run, r, inp: 'pad' }); };
practise(run1);
assert.equal(kept.length, 1, 'a clean run on the board');
assert.deepEqual([kept[0].name, kept[0].car, kept[0].inp, kept[0].r.et, kept[0].r.vq], ['Ann', 'f40', 'pad', 12.4, 200]);
// what an F40 cannot do, and runs that were not clean: none on the board
practise({ ...run1, et: 9.9, tot: 10.21 });
practise({ ...run1, vq: 260 });
practise({ ...run1, t330: 11 });
practise({ ...run1, red: 1, rt: -0.2 });
practise({ ...run1, foul: 1 });
practise({ ...run1, dnf: 1, et: null });
practise(run1, 150000);
assert.equal(kept.length, 1, 'nothing more on the board');
assert.deepEqual(refused.slice(1), ['et', 'trap', 'splits', 'clock'], 'too quick, too fast through the trap, splits out of order, figures far too late');
// a page under 20 frames a second drives in slow motion: a run whose green was 90 s ago (an 18 s quarter mile took 87 s
// on a test machine) still has its lane, and goes on the board
practise(run1, 90000, true);
assert.equal(kept.length, 2, 'a slow-motion run on the board');
// a car with no limits worked out (a new one) puts nothing on the board
A.serializeAttachment({ ...me(A), car: 'rocket' });
practise(run1);
assert.equal(kept.length, 2); assert.equal(refused.at(-1), 'car');
A.serializeAttachment({ ...me(A), car: 'f40' });
// Bob back in the left lane, Ann out and in again: the race of two starts by itself
say(A, { op: 'out' });
say(B, { op: 'in', l: 1 });
say(A, { op: 'out' });
assert.equal(last('lanes').l[0], null);
say(A, { op: 'in', l: 0 });
const duel = last('go');
assert.deepEqual(duel.l, ['a', 'b']);
assert.ok(duel.go - Date.now() >= 6900 && duel.go - Date.now() <= 8000, 'green 7 to 7.9 s ahead (the pages hold the start first)');
// a race of two's figures go to everyone (each page judges the race), only the timeslip's
say(B, { op: 'end', run: duel.run, r: { ...run1, junk: 'x' } });
assert.equal(last('res').id, 'b');
assert.equal(last('res').r.et, 12.4);
assert.equal(last('res').r.t330, 5.2); assert.equal(last('res').r.t1000, 10.1);
assert.equal(last('res').r.junk, undefined, 'only the timeslip figures passed on');
// the place feed goes to Bob only, and only well-formed
const n = B.got.length;
desk.feed(A, JSON.stringify({ t: 'dp', a: [12.5, 5.5, 8, 9.1, Date.now(), 0] }));
assert.equal(B.got.length, n + 1);
assert.deepEqual(B.got.at(-1).a, [12.5, 5.5, 8, 9.1, B.got.at(-1).a[4], 0]);
assert.equal(B.got.at(-1).id, 'a');
desk.feed(A, '{"t":"dp","a":[1,"x"]}');
desk.feed(A, '{"t":"dp","a":[1,2,3,4,5,6,7]}');
desk.feed(C, JSON.stringify({ t: 'dp', a: [1, 2] }));
assert.equal(B.got.length, n + 1, 'bad or stray feed dropped');
// the feed's own allowance: 45 a second
for (let k = 0; k < 60; k++) desk.feed(A, JSON.stringify({ t: 'dp', a: [k] }));
assert.ok(B.got.length - n <= 45, `feed held to 45 a second (${B.got.length - n})`);
// the lobby hibernates mid-race and wakes with both pages still connected: the lanes and the race as they were
const woke = new DragDesk(lobby);
assert.deepEqual(woke.view(), desk.view(), 'lanes back after hibernation');
assert.equal(woke.lanes[0].opp, 'b'); assert.equal(woke.lanes[1].run, duel.run);
const nb = B.got.length;
woke.feed(A, JSON.stringify({ t: 'dp', a: [20, 5.5, 9, 9, Date.now(), 0] }));
assert.equal(B.got.length, nb + 1, 'the feed goes on after hibernation');
// Bob's page goes: his lane free
desk.gone(me(B));
assert.equal(last('lanes').l[1], null);
// a ghost (spectator) cannot take a lane
desk.message(C, { id: 'c', ghost: true }, { t: 'drag', op: 'in', l: 1 });
assert.equal(last('lanes').l[1], null);
// a lane on a run for over two minutes is freed by the next message
desk.lanes[0].at -= 129000;
say(C, { op: 'in', l: 1 });
assert.equal(last('lanes').l[0], null, 'a run gone quiet is freed');
// a late joiner hears who holds the lanes
const D = sock('d', 'Dee');
desk.sendTo(D);
assert.deepEqual(D.got.at(-1).l, [null, { id: 'c', name: 'Cid', run: 0 }]);
// saying 'in' again for a lane already held, not on a run, changes nothing (said again after a reconnect)
const nl = all.length;
say(C, { op: 'in', l: 1 });
assert.equal(all.length, nl, 'nothing new to tell');
// a lane let go is wiped from its socket: a later wake-up does not bring it back
say(C, { op: 'out' });
assert.deepEqual(new DragDesk(lobby).view(), [null, null], 'no lanes after all are out');
assert.equal(C.deserializeAttachment().dl, undefined);
// a rematch: Ann asks Bob, whom she raced last; only Bob hears it, with her name; Cid, who never raced Ann, cannot ask her
const reN = all.length;
say(A, { op: 're', id: 'b' });
assert.deepEqual(B.got.at(-1), { t: 'drag', op: 're', id: 'a', name: 'Ann' });
assert.equal(all.length, reN, 'a rematch is told to nobody else');
const nA = A.got.length;
say(C, { op: 're', id: 'a' });
assert.equal(A.got.length, nA, 'only a last opponent may ask');
// asked again at once: held back (one question in a few seconds); Bob's no goes back to Ann
const nB = B.got.length;
say(A, { op: 're', id: 'b' });
assert.equal(B.got.length, nB, 'one question in a few seconds');
say(B, { op: 'reno', id: 'a' });
assert.deepEqual(A.got.at(-1), { t: 'drag', op: 'reno', id: 'b', name: 'Bob' });
console.log('OK: the drag desk holds the lanes, starts the race of two, passes on results, the feed and the rematch question, and puts clean runs on the board');
