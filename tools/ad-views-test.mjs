// The adverts' view counts (Martin 27 Nov 2026: how often the Winbaum logo is seen, per hour and day, and peaks, on /ads).
// The server half: bundles with the sign's views into a real Stats object over node:sqlite, then GET /api/stats?ads=1;
// and the client half's rule (src/adviews.js) driven past the sign with a stand-in camera.
//   node tools/ad-views-test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) {
  if (s === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }', shortCircuit: true };
  return n(s, c);
}
export async function load(u, c, n) {
  if (u.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(u)), shortCircuit: true };
  return n(u, c);
}`));
const root = new URL('..', import.meta.url).href.replace(/\/$/, '');
const { Stats } = await import(root + '/worker/stats.js');

let clock = Date.UTC(2026, 10, 27, 18, 10, 0);     // 20:10 in Tallinn
Date.now = () => clock;
const db = new DatabaseSync(':memory:');
const cursor = (rows) => ({ toArray: () => rows, one: () => rows[0] });
const sql = { exec: (q, ...a) => { const st = db.prepare(q); return cursor(/^\s*(SELECT|PRAGMA)/i.test(q) ? st.all(...a).map((r) => ({ ...r })) : (st.run(...a), [])); } };
const S = new Stats({ storage: { sql } }, {});
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [clock])); } static now() { return clock; } };
const post = (b) => S.fetch(new Request('https://x/api/stats', { method: 'POST', body: JSON.stringify({ v: 1, ...b }), headers: { 'cf-connecting-ip': String(Math.random()) } }));
const get = async () => { S.cache.clear(); return (await S.fetch(new Request('https://x/api/stats?ads=1'))).json(); };

// a day before the counter: only lap starts
clock = RealDate.UTC(2026, 10, 26, 18, 0, 0);
assert.equal((await post({ laps: { start: 30 } })).status, 200);
// the counter's first day: 20:xx and 21:xx Tallinn
clock = RealDate.UTC(2026, 10, 27, 18, 10, 0);
await post({ laps: { start: 5 }, ad: { 'wb:v': 4, 'wb:s': 12.4, 'wb:u': 1 } });
await post({ ad: { 'wb:v': 2, 'wb:s': 6, 'wb:x': 99, 'other': 5 } });         // made-up keys are dropped
clock = RealDate.UTC(2026, 10, 27, 19, 30, 0);
await post({ ad: { 'wb:v': 9999, 'wb:s': 3 } });                           // one bundle adds at most 400
let r = await get();
const d26 = r.days.find((d) => d.day === '2026-11-26'), d27 = r.days.find((d) => d.day === '2026-11-27');
assert.equal(d26.v, 0); assert.equal(d26.ls, 30);
assert.equal(d27.v, 406); assert.equal(d27.u, 1); assert.equal(d27.s, 21); assert.equal(d27.ls, 5);
assert.equal(d27.h[20], 6); assert.equal(d27.h[21], 400); assert.equal(d27.h.reduce((a, b) => a + b), 406);
assert.equal(d27.hs[20], 18);
assert.equal(r.counted, '2026-11-27');
assert.equal(r.hours.reduce((a, h) => a + h.v, 0), 406);
assert.ok(!JSON.stringify(r).includes('wb:x'));

// the client's rule: a stand-in camera driven past the sign
globalThis.location = { search: '?winbaum=1', hostname: 'localhost' };
globalThis.addEventListener = () => {};
globalThis.document = { addEventListener() {}, hidden: false };
const THREE = await import('three');
const { stats } = await import(root + '/src/stats.js');
const seen = {};
stats.ad = (k, n = 1) => { seen[k] = (seen[k] || 0) + n; };
const { createAdViews } = await import(root + '/src/adviews.js');
const av = createAdViews({ heightAt: () => 0 });
const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
// the sign is about (1645.1, 3067.2): drive along a line south-west of it, looking at it, at 25 m/s
const look = (x, z) => { cam.position.set(x, 2, z); cam.lookAt(1645, 6, 3067); cam.updateMatrixWorld(); };
const run = (x0, z0, x1, z1, secs, lookAt = true) => {
  for (let t = 0; t < secs; t += 1 / 60) {
    const f = t / secs, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f;
    if (lookAt) look(x, z); else { cam.position.set(x, 2, z); cam.lookAt(x - 100, 2, z); cam.updateMatrixWorld(); }
    av.update(cam, 1 / 60, true);
  }
};
run(1600, 3020, 1700, 3020, 4);           // past it, 50 to 60 m away: one view
assert.equal(seen['wb:v'], 1); assert.equal(seen['wb:u'], 1);
run(1700, 3020, 1600, 3020, 0.5);         // straight back at once, still in sight: no second view
assert.equal(seen['wb:v'], 1);
run(1800, 3300, 1800, 3300, 6, false);    // far away for 6 s
run(1620, 3040, 1660, 3040, 0.6);         // a glimpse of 0.6 s: none
assert.equal(seen['wb:v'], 1);
run(1800, 3300, 1800, 3300, 6, false);
run(1620, 3040, 1660, 3040, 2);           // another lap past it: a second view, the visit already counted
assert.equal(seen['wb:v'], 2); assert.equal(seen['wb:u'], 1);
run(1640, 3040, 1640, 3040, 3, false);    // beside it looking away: nothing on screen
assert.equal(seen['wb:v'], 2);
assert.ok(seen['wb:s'] > 5 && seen['wb:s'] < 8, `seconds ${seen['wb:s']}`);
console.log('ad views: OK', JSON.stringify(seen));
