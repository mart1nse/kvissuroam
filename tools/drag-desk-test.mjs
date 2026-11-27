// The drag strip's two lanes on the server (worker/drag.js, behind ?drag=1 from 27 Nov 2026): who holds which lane,
// the race of two starting by itself when both are in, a practice on one's own, the results passed on, the 30 Hz
// place feed going to the other driver only, and a lane freed when its page goes.
//   node tools/drag-desk-test.mjs
import assert from 'node:assert/strict';
import { DragDesk } from '../worker/drag.js';

const all = [], socks = [];
const lobby = { broadcast: (m) => all.push(m), ctx: { getWebSockets: () => socks } };
const sock = (id, name) => {
  let att = JSON.stringify({ id, name });
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
// Ann's practice ends, she leaves and comes back: the race of two starts by itself
say(A, { op: 'end', run: solo.run, r: { rt: 0.31, et: 12.4, t330: 5.2, t1000: 10.1, vq: 180, red: 0, foul: 0, dnf: 0, tot: 12.9, junk: 'x' } });
assert.equal(last('res').id, 'a');
assert.equal(last('res').r.et, 12.4);
assert.equal(last('res').r.t330, 5.2); assert.equal(last('res').r.t1000, 10.1);
assert.equal(last('res').r.junk, undefined, 'only the timeslip figures passed on');
say(A, { op: 'out' });
assert.equal(last('lanes').l[0], null);
say(A, { op: 'in', l: 0 });
const duel = last('go');
assert.deepEqual(duel.l, ['a', 'b']);
assert.ok(duel.go - Date.now() >= 2500 && duel.go - Date.now() <= 3600, 'green 2.6 to 3.5 s ahead');
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
// a lane on a run for over a minute is freed by the next message
desk.lanes[0].at -= 61000;
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
console.log('OK: the drag desk holds the lanes, starts the race of two, passes on results and the feed');
