// The adverts' view counts (Martin 27 Nov 2026: how often the Winbaum logo is seen, per hour and day, and peaks, on /winbaum).
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
await post({ laps: { start: 5 }, ad: { 'wb:v': 4, 'wb:s': 12.4, 'wb:u': 1, 'wb:c': 2, 'an:v': 3, 'tp:c': 1 } });
await post({ ad: { 'wb:v': 2, 'wb:s': 6, 'wb:x': 99, 'other': 5 } });         // made-up keys are dropped
clock = RealDate.UTC(2026, 10, 27, 19, 30, 0);
await post({ ad: { 'wb:v': 9999, 'wb:s': 3 } });                           // one bundle adds at most 400
let r = await get();
const D26 = r.days.find((d) => d.day === '2026-11-26'), D27 = r.days.find((d) => d.day === '2026-11-27'), d26 = D26.ads.wb, d27 = D27.ads.wb;
assert.equal(d26.v, 0); assert.equal(D26.ls, 30);
assert.equal(d27.v, 406); assert.equal(d27.u, 1); assert.equal(d27.s, 21); assert.equal(D27.ls, 5);
assert.equal(D27.ads.an.v, 3); assert.equal(D27.ads.an.h[20], 3); assert.equal(D27.ads.tp.c, 1); assert.equal(D27.ads.tp.v, 0);
assert.equal(d27.h[20], 6); assert.equal(d27.h[21], 400); assert.equal(d27.h.reduce((a, b) => a + b), 406);
assert.equal(d27.hs[20], 18); assert.equal(d27.c, 2); assert.equal(d27.hc[20], 2);
assert.deepEqual(r.counted, { wb: '2026-11-27', an: '2026-11-27', tp: null });
assert.equal(r.hours.reduce((a, h) => a + h.ads.wb.v, 0), 406);
assert.ok(!JSON.stringify(r).includes('wb:x'));

// the client's rule: a stand-in camera driven past a stand-in Winbaum sign (its group where winbaum.js puts it)
globalThis.location = { search: '', hostname: 'localhost', href: 'http://localhost/' };
globalThis.addEventListener = () => {};
globalThis.document = { addEventListener() {}, hidden: false };
const opened = [];
globalThis.window = { open: (u) => { opened.push(u); return null; } };
const THREE = await import('three');
const { stats } = await import(root + '/src/stats.js');
const seen = {};
stats.ad = (k, n = 1) => { seen[k] = (seen[k] || 0) + n; };
const { createAdViews } = await import(root + '/src/adviews.js');
const scene = new THREE.Scene(), g = new THREE.Group();
g.position.set(1644.4, 0, 3067.2); g.scale.setScalar(1.4); scene.add(g); scene.updateMatrixWorld(true);
const tasku = new THREE.Mesh(new THREE.PlaneGeometry(9, 12.8)); tasku.userData.tasku = true; tasku.position.set(2000, 12, 3000); scene.add(tasku); scene.updateMatrixWorld(true);
const av = createAdViews({ winbaum: { group: g }, holo: null, posters: [{ mesh: tasku }] });
const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
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
g.visible = false;                        // a cabin that is not shown is never seen
run(1600, 3020, 1700, 3020, 4);
assert.equal(seen['wb:v'], 2);
// the one-sided Tasku banner: from its front (+z) a view, from behind none
const lookT = (z) => { for (let t = 0; t < 2; t += 1 / 60) { cam.position.set(2000, 2, z); cam.lookAt(2000, 12, 3000); cam.updateMatrixWorld(); av.update(cam, 1 / 60, true); } };
lookT(2960); assert.equal(seen['tp:v'], undefined);
run(1800, 3300, 1800, 3300, 6, false);
lookT(3040); assert.equal(seen['tp:v'], 1);
// taps: by the site opened
window.open('https://www.winbaum.ee/', '_blank'); window.open('https://andersonbeer.com/'); window.open('https://www.yaga.ee/torepood-2'); window.open('https://example.com/');
assert.equal(seen['wb:c'], 1); assert.equal(seen['an:c'], 1); assert.equal(seen['tp:c'], 1); assert.equal(opened.length, 4);
console.log('ad views: OK', JSON.stringify(seen));
