// Online race, from lights out: two racers and one roamer in the same lobby. The racers sit on the
// grid, the lights go out, and in the run to the start line (before their lap timers start) a racer
// and the roamer are put half on top of the leading racer. Nobody should be pushed: race cars pass
// through each other and through roamers from the lights (Martin, 2026-11-22). Then the same with the
// roamer and a car that left the race, which bumps as usual once out of the start lane.
// Needs the game served with its server on :8787 (npm run build && npx wrangler dev --port 8787) and
// Playwright. Usage: node tools/race-ghost-test.mjs
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');

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
const pos = (p) => p.evaluate(() => { const c = __game.car, m = __game.raceMode(); return { x: +c.x.toFixed(2), z: +c.z.toFixed(2), yaw: +c.yaw.toFixed(3), hit: +(c.hit || 0).toFixed(2), lap: __game.race().running, ghost: m.ghost, hold: m.holding, pin: !!m.pin }; });
const place = (p, q) => p.evaluate((q) => { __game.place(q); __game.race().hopped(q.x, q.z); }, q);
const sees = (p) => p.evaluate(() => [...document.querySelectorAll('.pname')].map((e) => `${e.textContent}${e.classList.contains('hot') ? ' [HOT]' : ''}`));

const [ba, A] = await open('f40');
const [bb, B] = await open('w201');
const [bc, C] = await open('w201');
console.log('three driving', process.uptime() | 0);
await A.waitForFunction(() => __game.mp().online && __game.mp().players().length >= 2, null, { timeout: 60000 });
await A.waitForTimeout(1500);

// A and B vote to race (2 of 3 is enough); C stays a roamer
await A.evaluate(() => __game.raceMode().act());
await B.waitForTimeout(800);
await B.evaluate(() => __game.raceMode().act());
await A.waitForFunction(() => __game.raceMode().holding, null, { timeout: 15000 });
console.log('race on: A', JSON.stringify(await pos(A)), 'B', JSON.stringify(await pos(B)));
await A.waitForFunction(() => __game.raceMode().pin, null, { timeout: 15000 });
console.log('on the grid: A', JSON.stringify(await pos(A)));
// lights out
await A.waitForFunction(() => !__game.raceMode().holding, null, { timeout: 20000 });
await B.waitForFunction(() => !__game.raceMode().holding, null, { timeout: 5000 });
const a0 = await pos(A);
console.log('lights out: A', JSON.stringify(a0), 'B', JSON.stringify(await pos(B)));
await A.waitForTimeout(400);
const idA = await A.evaluate(() => __game.mp().id), idB = await B.evaluate(() => __game.mp().id);
const listed = await C.evaluate(([a, b]) => [__game.raceMode().racing(a), __game.raceMode().racing(b)], [idA, idB]);
console.log('the roamer counts A and B as racers (no bumps even before their flag arrives):', JSON.stringify(listed));
console.log('C sees', JSON.stringify(await sees(C)), 'A sees', JSON.stringify(await sees(A)));

// half on top of A: B a little to the side and back, C on the other side
const fx = Math.sin(a0.yaw), fz = -Math.cos(a0.yaw), rx = Math.cos(a0.yaw), rz = Math.sin(a0.yaw);
const qa = { x: a0.x, z: a0.z, yaw: a0.yaw };
const qb = { x: a0.x + rx * 1.2 - fx * 1.5, z: a0.z + rz * 1.2 - fz * 1.5, yaw: a0.yaw };
const qc = { x: a0.x - rx * 1.2 + fx * 1.5, z: a0.z - rz * 1.2 + fz * 1.5, yaw: a0.yaw };
const moved = (p, q) => Math.hypot(p.x - q.x, p.z - q.z).toFixed(2);
const overlap = async (label) => {
  await place(A, qa); await place(B, qb); await place(C, qc);
  await A.waitForTimeout(2500);
  const a = await pos(A), b = await pos(B), c = await pos(C);
  console.log(label, 'A moved', moved(a, qa), 'B moved', moved(b, qb), 'C moved', moved(c, qc), '| A', JSON.stringify(a), 'B', JSON.stringify(b), 'C', JSON.stringify(c));
  return [+moved(a, qa), +moved(b, qb), +moved(c, qc)];
};
const [ma, mb, mc] = await overlap('racing, before the line:');
const ok1 = ma < 0.3 && mb < 0.3 && mc < 0.3 && listed[0] && listed[1];

// B leaves the race: B and the roamer C bump again. (The grid is on the straight's line back past the last corner,
// off the lap's road, so a car put there is not in the start lane, src/race/startlane.js; a row of it that were on
// that road would be, and B would pass through to the line: the lanes are ended here.) They are driven together, not
// put on top of each other: a car put somewhere passes through for a moment, and a pair that has passed through does
// not bump until apart.
await B.evaluate(() => __game.mp().raceSend({ t: 'rj', on: 0 }));
await B.waitForFunction(() => !__game.raceMode().ghost, null, { timeout: 5000 });
await B.waitForTimeout(500);
const laneB = await B.evaluate(() => __game.lane().on);
console.log('B out of the race, on the grid: in the start lane:', laneB);
await B.evaluate(() => __game.lane().end()); await C.evaluate(() => __game.lane().end());
const move = (p, q) => p.evaluate((q) => { const c = __game.car; c.x = q.x; c.z = q.z; c.yaw = q.yaw; c.vx = c.vy = c.yawRate = 0; }, q);
const pb = { x: a0.x + rx * 9, z: a0.z + rz * 9, yaw: a0.yaw };
const pc = { x: pb.x + rx * 1.2 + fx * 1.5, z: pb.z + rz * 1.2 + fz * 1.5, yaw: a0.yaw };
await move(B, pb); await move(C, { ...pc, x: pc.x + fx * 6, z: pc.z + fz * 6 });
await B.waitForTimeout(3000);
const b1 = await pos(B);
await move(C, pc);
await B.waitForTimeout(1500);
const b2 = await pos(B), c2 = await pos(C);
const ok2 = +moved(b2, b1) + +moved(c2, pc) > 0.4;          // (a pair passing through: about 0.1 m in all)
console.log('B out of the race and the lane, roamer C driven into B: B moved', moved(b2, b1), 'C moved', moved(c2, pc));

console.log(ok1 && ok2 ? 'PASS' : 'FAIL', { ok1, ok2 });
await ba.close(); await bb.close(); await bc.close();
process.exit(ok1 && ok2 ? 0 : 1);
