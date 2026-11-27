// The start lane (src/race/startlane.js): two browsers in the same lobby. A car just put on the start passes
// through the other one while it stays between the kerbs up to the line; out of the lane the two bump again.
// Needs the game served with its server on :8787 (npm run build && npx wrangler dev --port 8787) and
// Playwright. Usage: node tools/start-lane-test.mjs [folder for the pictures]   (SHOTS=1: with pictures)
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const T = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url)));
const P = T.pts, N = P.length, SP = T.spawn;
const dir = process.argv[2] || '.';
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (car) => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERR', car, e.message));
  await p.goto('http://localhost:8787/?q=low&trees=old');
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  await p.evaluate(() => { const r = __game.renderer; r.realRender = r.render; r.render = () => {}; });
  return [b, p];
};
const key = (p, type, code) => p.evaluate(([t, c]) => window.dispatchEvent(new KeyboardEvent(t, { code: c })), [type, code]);
const at = (i, side = 0, back = 0) => {
  const a = P[(i + N) % N], b = P[(i + 1 + N) % N];
  const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz);
  const ux = tx / l, uz = tz / l;
  return { x: a[0] - uz * side - ux * back, z: a[1] + ux * side - uz * back, yaw: Math.atan2(ux, -uz) };
};
const place = (p, pose) => p.evaluate((q) => { __game.place(q); }, pose);
const home = (p) => p.evaluate(() => __game.goHome());
const end = (p) => p.evaluate(() => __game.lane().end());
const pos = (p) => p.evaluate(() => { const c = __game.car; return { x: +c.x.toFixed(2), z: +c.z.toFixed(2), v: +Math.hypot(c.vx, c.vy).toFixed(2), hit: +(c.hit || 0).toFixed(2), lane: __game.lane().on, lap: __game.race().running }; });
let fails = 0;
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) fails++; };
const [ba, A] = await open('f40');
const [bb, B] = await open('w201');
console.log('both driving', process.uptime() | 0);
await key(A, 'keydown', 'Space'); await key(B, 'keydown', 'Space');     // handbrakes on: an automatic creeps

// how far two cars put half on top of each other at track point i have pushed each other after 2.5 s
// (a car put on the lane's road is in the lane, as by R: lanes says which of the two keep it)
const overlap = async (i, lanes = [true, true]) => {
  const a0 = at(i), b0 = at(i, 1.2, 1.5);
  await place(A, a0); await place(B, b0);
  if (!lanes[0]) await end(A);
  if (!lanes[1]) await end(B);
  await A.waitForTimeout(2500);
  const a = await pos(A), b = await pos(B);
  return { a: Math.hypot(a.x - a0.x, a.z - a0.z), b: Math.hypot(b.x - b0.x, b.z - b0.z), A: a, B: b };
};
const apart = async () => { await place(A, at(SP + 20)); await place(B, at(SP - 20)); await A.waitForTimeout(1200); };
const fmt = (r) => `A moved ${r.a.toFixed(2)} m, B moved ${r.b.toFixed(2)} m`;
// the car moved as if driven there (not put there, which would start its lane)
const move = (p, q) => p.evaluate((q) => { const c = __game.car; c.x = q.x; c.z = q.z; c.vx = c.vy = c.yawRate = 0; }, q);

// 1: H on both: each on a spot of its own, both in the lane
let a, b, r;
if (!process.env.ONLY9) {
await home(A); await A.waitForTimeout(1500); await home(B); await B.waitForTimeout(1500);
a = await pos(A); b = await pos(B);
check(a.lane && b.lane, `H: both in the lane (${Math.hypot(a.x - b.x, a.z - b.z).toFixed(1)} m apart)`);
check(Math.hypot(a.x - b.x, a.z - b.z) > 3, 'H: B was given another spot than A');

// 2: both in the lane, put on top of each other: nobody moves
r = await overlap(SP + 10);
check(r.a < 0.3 && r.b < 0.3 && r.A.lane && r.B.lane, `both in the lane, overlapping: ${fmt(r)}`);

// 3: only A in the lane (B came driving by): still nobody moves
await apart();
r = await overlap(SP + 10, [true, false]);
check(r.a < 0.3 && r.b < 0.3 && r.A.lane && !r.B.lane, `A in the lane, B not, overlapping: ${fmt(r)}`);

// 4: A's lane ends while the two still overlap: they stay as they are until they have come apart
await end(A); await A.waitForTimeout(2500);
a = await pos(A); b = await pos(B);
check(Math.hypot(a.x - r.A.x, a.z - r.A.z) < 0.3 && Math.hypot(b.x - r.B.x, b.z - r.B.z) < 0.3, 'lane ended inside another car: no shove');

// 5: neither in the lane, coming together: they push apart (driven together: two cars put on top of each other pass
// through for a moment, as any car put somewhere does, and a pair that has passed through does not bump until apart)
await apart(); await end(A); await end(B);
await move(A, at(SP + 10)); await move(B, at(SP + 13, 1.2)); await A.waitForTimeout(3000);
{
  const a5 = await pos(A), b5 = at(SP + 10, 1.2, 1.5);
  await move(B, b5); await A.waitForTimeout(1500);
  const a = await pos(A), b = await pos(B);
  r = { a: Math.hypot(a.x - a5.x, a.z - a5.z), b: Math.hypot(b.x - b5.x, b.z - b5.z) };
}
check(r.a > 0.25 && r.b > 0.25, `neither in the lane, driven together: ${fmt(r)} (a pair passing through: about 0.1 m)`);

// 6: over the kerb: hittable; back on the road within 5 s: through again (27 Nov); over it for longer: over until
// the car is put on the start again
await apart(); await home(A); await A.waitForTimeout(800);
await move(A, at(SP + 10, 2)); await A.waitForTimeout(600);
check((await pos(A)).lane, 'on the road 10 m on: in the lane');
await move(A, at(SP + 10, 3.2)); await A.waitForTimeout(600);
check((await pos(A)).lane, '3.2 m right of the centre (kerb at 3.8): in the lane');
await move(A, at(SP + 10, 4.6)); await A.waitForTimeout(600);
check(!(await pos(A)).lane, '4.6 m right, past the kerb: hittable');
await move(A, at(SP + 10, 0)); await A.waitForTimeout(600);
check((await pos(A)).lane, 'back on the road within 5 s: in the lane again');
await move(A, at(SP + 10, 4.6)); await A.waitForTimeout(6000);
await move(A, at(SP + 10, 0)); await A.waitForTimeout(600);
check(!(await pos(A)).lane, 'past the kerb for 6 s, then back on the road: out');
await place(A, at(SP + 30, 1)); await A.waitForTimeout(2600);
check((await pos(A)).lane, 'put back on the lane\'s road (R, the map): in the lane');

// 7: the wrong way: up the street out of the back of the lane, and back
const i0 = await A.evaluate(() => __game.lane().i0);
await apart(); await home(A); await A.waitForTimeout(800);
await move(A, at(i0 + 3)); await A.waitForTimeout(600);
check((await pos(A)).lane, `back up the street, ${SP - i0 - 3} points behind the start: in the lane`);
await move(A, at(i0 - 3)); await A.waitForTimeout(600);
check(!(await pos(A)).lane, 'past the back of the lane: hittable');
await move(A, at(i0 + 3)); await A.waitForTimeout(600);
check((await pos(A)).lane, 'back in within 5 s: in the lane');

// 8: a bay beside the road: in the lane on the spot and along the bays until on the road (27 Nov: it ended 9 m from
// the spot, and a car pulling out gently was still in the bays there), then the road's kerbs count
const bay = at(SP + 3, 5.9);
const begin = (p, q) => p.evaluate((q) => { __game.place(q); __game.lane().begin(q.x, q.z); }, q);
await begin(A, bay); await A.waitForTimeout(2600);
check((await pos(A)).lane, 'on a bay spot beside the road: in the lane');
await move(A, at(SP + 9, 6.2)); await A.waitForTimeout(600);
check((await pos(A)).lane, '12 m along the bays, not yet on the road: in the lane');
await move(A, at(SP + 14, 2)); await A.waitForTimeout(600);
check((await pos(A)).lane, 'pulled out onto the road: in the lane');
await move(A, at(SP + 16, 5.9)); await A.waitForTimeout(600);
check(!(await pos(A)).lane, 'back over the kerb into the bays from the road: hittable');

}
// 9: A is put on the start and drives (steered along the road, at town speed) through B, parked on the road
// ahead, up to and over the line
const drive = (p, on) => p.evaluate((on) => {
  clearInterval(window.__steer);
  const k = (t, c) => window.dispatchEvent(new KeyboardEvent(t, { code: c }));
  if (!on) { for (const c of ['ArrowUp', 'ArrowLeft', 'ArrowRight']) k('keyup', c); return; }
  window.__steer = setInterval(() => {
    // towards a point 9 m on along the road, 1 m right of its centre
    const c = __game.car, tr = __game.race().track, n = tr.nearest(c.x, c.z), j = (n.i + 5) % tr.N;
    const tx = tr.P[j][0] - tr.tan[j][1] - c.x, tz = tr.P[j][1] + tr.tan[j][0] - c.z;
    let h = Math.atan2(tx, -tz) - c.yaw; h = Math.atan2(Math.sin(h), Math.cos(h));
    k(h > 0.03 ? 'keydown' : 'keyup', 'ArrowRight'); k(h < -0.03 ? 'keydown' : 'keyup', 'ArrowLeft');
    k(Math.hypot(c.vx, c.vy) < 8 ? 'keydown' : 'keyup', 'ArrowUp');
  }, 30);
}, on);
await key(A, 'keyup', 'Space');
await apart(); await end(B);
await home(A); await A.waitForTimeout(800);
a = await pos(A);
const iA = await A.evaluate(() => __game.race().track.nearest(__game.car.x, __game.car.z).i);
const b0 = at(iA + 7, 1.2);
await place(B, b0); await end(B);
await A.waitForTimeout(1500);
await drive(A, true);
let hit = 0, hitB = 0, inLane = 0, lapped = false, laneAtLap = null, outAt = null, passed = false;
const ahead = (q) => (q.x - b0.x) * Math.sin(b0.yaw) - (q.z - b0.z) * Math.cos(b0.yaw);
for (let k = 0; k < 400 && !lapped; k++) {
  await A.waitForTimeout(150);
  a = await pos(A);
  // (knocks count until A is well past B: further on, a kerb or a post is not what this is about)
  if (ahead(a) < 12) { hit = Math.max(hit, a.hit); hitB = Math.max(hitB, (await pos(B)).hit); } else passed = true;
  if (a.lane) inLane++; else if (!outAt && !a.lap) outAt = a;
  if (process.env.TRACE && k % 5 === 0) console.log(k, JSON.stringify(a), ahead(a).toFixed(1));
  if (a.lap) { lapped = true; laneAtLap = a.lane; }
}
await A.waitForTimeout(1500);
await drive(A, false);
a = await pos(A);
check(lapped, `A reached the line and its lap started (in the lane for ${inLane} looks on the way)`);
check(!outAt, `A stayed in the lane all the way to the line${outAt ? ' (out at ' + JSON.stringify(outAt) + ')' : ''}`);
check(passed && hit === 0 && hitB === 0, `A drove through B, parked on the road: no knock on either (${hit}, ${hitB})`);
check(!a.lane && a.lap, `past the line: lap running, lane over (lane at the line: ${laneAtLap})`);
await A.evaluate(() => __game.race().teleported());

// pictures from A: B parked 7 m ahead, solid (neither in the lane) and see-through (A just put on the start)
if (process.env.SHOTS) {
  await key(A, 'keydown', 'Space');
  const shot = async (name, lane) => {
    await apart();
    await home(A); await A.waitForTimeout(800);
    const i = await A.evaluate(() => __game.race().track.nearest(__game.car.x, __game.car.z).i);
    await place(B, at(i + 3, 1.5));
    if (!lane) await end(A);
    await end(B);
    await A.waitForTimeout(1500);
    await A.evaluate(() => { const r = __game.renderer; r.render = r.realRender; });
    await A.waitForTimeout(9000);
    await A.screenshot({ path: `${dir}/${name}.png` });
    await A.evaluate(() => { __game.renderer.render = () => {}; });
  };
  await shot('lane-off', false);
  await shot('lane-on', true);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
await ba.close(); await bb.close();
process.exit(fails ? 1 : 0);
