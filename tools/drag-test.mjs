// The drag strip (?drag=1, 27 Nov 2026), driven in the browser by the keys:
//  1) DRAG STRIP: the car on the line of a lane, in neutral, held; the throttle revs the engine and the car stays put.
//  2) PRACTICE (P): the tree runs; A before green is a red light; a run with A on green and A at the shift light
//     gives a timeslip with every figure; R puts the car back on the line.
//  3) Two pages, one in each lane: the tree starts for both by itself, each drives, each gets the other's figures
//     and the same verdict from both sides; the other car's place comes 30 times a second.
// Needs the game served with its server: npm run build && npx wrangler dev --port 8787 --persist-to <empty dir>
//   node tools/drag-test.mjs [url] [shots=dir] [duel]     (duel: only part 3, the race of two)
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv.slice(2).find((v) => v.startsWith('http')) || 'http://localhost:8787/?drag=1&q=low&trees=old';
const shots = process.argv.find((v) => v.startsWith('shots='))?.slice(6);
const DUEL_ONLY = process.argv.includes('duel');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function open(name) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
  await ctx.addInitScript((n) => { try { localStorage.setItem('kvissuroam.name', n); } catch {} }, name);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(name, 'PAGEERR', e.message));
  await page.goto(base);
  await page.waitForFunction(() => window.__game?.drag?.(), null, { timeout: 240000 });
  await page.evaluate(() => __game.startDriving());
  await page.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
  return page;
}
const state = (page) => page.evaluate(() => {
  const g = __game, d = g.drag(), c = g.car;
  return { phase: d.phase, stick: c.stick, neutral: !!c.neutral, gear: c.gear, rpm: Math.round(c.rpm), v: +c.vx.toFixed(2), x: c.x, z: c.z, lanes: d.lanes, res: d.result,
    ask: !document.querySelector('#dragask').classList.contains('hidden'), slip: !document.querySelector('#dragslip').classList.contains('hidden'),
    slipText: document.querySelector('#dragslip').innerText, panel: document.querySelector('#drag').innerText, toast: document.querySelector('#toast')?.textContent || '' };
});
// to the line by the DRAG STRIP button, and wait there until the strip is built and the place is ready
async function toLine(page) {
  await page.evaluate(() => document.querySelector('[data-act="track-drag"]').click());
  // (on the line, or already on a race's tree: the other lane was held)
  await page.waitForFunction(() => ['line', 'tree'].includes(__game.drag().phase) && __game.drag().strip.built && !document.querySelector('#getready.show'), null, { timeout: 180000, polling: 250 });
  await page.waitForFunction(() => __game.drag().lanes.some((l) => l?.id === __game.mp().id), null, { timeout: 20000 });
}
// the throttle held, A on green (or `early` s before it), A at the shift light, until the timeslip
async function run(page, early = -0.05, shot = '') {
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction((e) => performance.now() >= __game.drag().go - e * 1000, early, { timeout: 30000, polling: 'raf' });
  await page.keyboard.press('a');
  await page.waitForFunction(() => __game.drag().phase !== 'tree', null, { timeout: 10000 });
  if (shot && shots) await page.screenshot({ path: `${shots}/${shot}.png` });
  // (a slow test machine: up to a few frames a second, the game's clock behind the wall's)
  const t0 = Date.now();
  while (Date.now() - t0 < 300000) {
    const s = await page.evaluate(() => { const c = __game.car; return { phase: __game.drag().phase, gear: c.gear, up: !c.neutral && c.rpm > c.spec.engine.shiftRpm * 0.97 && c.shiftTimer <= 0 }; });
    if (s.phase === 'done') break;
    if (s.up) {
      await page.keyboard.press('a');
      await page.waitForFunction((g) => __game.car.gear !== g || __game.drag().phase === 'done', s.gear, { timeout: 4000 }).catch(() => {});
    }
    await page.waitForTimeout(40);
  }
  await page.keyboard.up('ArrowUp');
  return state(page);
}

// ---- 1) and 2): one page
const A = await open('Ann');
await toLine(A);
let s = await state(A);
if (!DUEL_ONLY) {
assert.equal(s.phase, 'line'); assert.ok(s.stick && s.neutral, 'on the line in neutral'); assert.ok(s.ask, 'asked: practice or leave');
assert.ok(s.lanes[0]?.name === 'Ann', `the server holds the lane for her (${JSON.stringify(s.lanes)})`);
console.log('on the line:', s.panel.replace(/\s+/g, ' '));
// the strip level from side to side (the map's runway has a crown: 1 to 2 % down to each edge, Martin 27 Nov)
const tilt = await A.evaluate(() => {
  const D = __game.drag().strip.frame, w = __game.world, h = (d, v) => w.heightAt(...D.at(d, v)), raw = (d, v) => w.rawHeightAt(...D.at(d, v));
  let across = 0, rawAcross = 0, up = 0;
  for (let d = -10; d <= 440; d += 10) {
    for (const v of [5.5, -5.5]) { across = Math.max(across, Math.abs(h(d, v + 2.5) - h(d, v - 2.5)) / 5); rawAcross = Math.max(rawAcross, Math.abs(raw(d, v + 2.5) - raw(d, v - 2.5)) / 5); }
    for (let v = -15; v <= 15; v += 1) up = Math.max(up, h(d, v) - raw(d, v));
  }
  return { across: across * 100, rawAcross: rawAcross * 100, up };
});
console.log(`across a lane: the map's ground up to ${tilt.rawAcross.toFixed(2)} %, the strip's ${tilt.across.toFixed(3)} %; ground raised by up to ${(tilt.up * 100).toFixed(0)} cm`);
assert.ok(tilt.across < 0.05, 'the lanes level from side to side');
assert.ok(tilt.up < 0.4, 'raised by little');
if (shots) await A.screenshot({ path: `${shots}/drag-line.png` });
// the throttle in neutral: revs up, the car stays put
const p0 = [s.x, s.z];
await A.keyboard.down('ArrowUp'); await A.waitForFunction(() => __game.car.rpm > 3000, null, { timeout: 8000 }).catch(() => {});
s = await state(A);
await A.keyboard.up('ArrowUp');
assert.ok(s.rpm > 3000, `revs in neutral (${s.rpm})`);
assert.ok(Math.hypot(s.x - p0[0], s.z - p0[1]) < 0.05, 'the car does not roll');
// A on the line before P: nothing, a hint
await A.keyboard.press('a');
await A.waitForFunction(() => /PRACTICE/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 8000 });
s = await state(A); assert.ok(s.neutral && s.phase === 'line', 'still in neutral');
// a false start
await A.keyboard.press('p');
await A.waitForFunction(() => __game.drag().phase === 'tree', null, { timeout: 8000 });
s = await run(A, 1.2);
console.log('false start:', s.slipText.split('\n')[0], '| R/T', s.res.rt?.toFixed(3));
assert.ok(s.res.red && s.res.rt < 0, 'a red light');
assert.ok(s.slip, 'timeslip shown');
// R: back on the line at once
await A.keyboard.press('r');
await A.waitForFunction(() => __game.drag().phase === 'line' && __game.drag().lanes.some((l) => l?.id === __game.mp().id), null, { timeout: 15000 });
s = await state(A); assert.ok(s.neutral && !s.slip, 'back on the line in neutral');
// a clean practice run
await A.keyboard.press('p');
await A.waitForFunction(() => __game.drag().phase === 'tree', null, { timeout: 8000 });
s = await run(A);
console.log('practice:', JSON.stringify(s.res));
assert.ok(!s.res.red && !s.res.dnf && s.res.et > 8 && s.res.et < 25 && s.res.vq > 100, 'a clean quarter mile');
for (const k of ['t60', 't330', 't8', 'v8', 't1000']) assert.ok(Number.isFinite(s.res[k]), `${k} timed`);
assert.ok(s.res.t60 < s.res.t330 && s.res.t330 < s.res.t8 && s.res.t8 < s.res.t1000 && s.res.t1000 < s.res.et, 'splits in order');
console.log(s.slipText.replace(/\n+/g, ' | '));
if (shots) await A.screenshot({ path: `${shots}/drag-slip.png` });
await A.keyboard.press('r');
await A.waitForFunction(() => __game.drag().phase === 'line' && __game.drag().lanes.some((l) => l?.id === __game.mp().id), null, { timeout: 15000 });
}

// ---- 3) a second page pulls into the other lane: the race of two
const B = await open('Bob');
await B.waitForFunction(() => __game.drag().lanes[0]?.name === 'Ann', null, { timeout: 15000 });
await toLine(B);
s = await state(B);
assert.equal(s.lanes[1]?.name, 'Bob', 'Bob in the left lane');
await Promise.all([A, B].map((p) => p.waitForFunction(() => __game.drag().phase === 'tree' && __game.drag().duel, null, { timeout: 15000 })));
// (each page shows green at the server's moment by its own estimate of the server's clock: on this slow test machine
// a page busy for half a second a frame misjudges it by that much; the result does not hang on it, each car is timed
// from its own green)
const green = (p) => p.evaluate(() => { const off = __game.mp().serverNow() - Date.now(); return { at: __game.drag().go + performance.timeOrigin, srv: __game.drag().go + performance.timeOrigin + off, off }; });
const [gA, gB] = [await green(A), await green(B)];
console.log(`race of two: green on the server's clock ${Math.abs(gA.srv - gB.srv).toFixed(0)} ms apart; on screen ${Math.abs(gA.at - gB.at).toFixed(0)} ms apart (clock estimates ${gA.off.toFixed(0)} / ${gB.off.toFixed(0)} ms off)`);
assert.ok(Math.abs(gA.srv - gB.srv) < 40, 'the same green for both');
// (the other car's place as it comes, counted)
await Promise.all([A, B].map((p) => p.evaluate(() => { const d = __game.drag(), h = d.heard; window.__dp = 0; window.__dpT = performance.now(); d.heard = (...a) => { window.__dp++; return h(...a); }; })));
// Ann a little late off the line, Bob on time
const [ra, rb] = await Promise.all([run(A, -0.25), run(B, -0.02)]);
const dp = await Promise.all([A, B].map((p) => p.evaluate(() => ({ n: window.__dp, s: (performance.now() - window.__dpT) / 1000 }))));
console.log(`the other car's place heard: Ann ${dp[0].n} times in ${dp[0].s.toFixed(0)} s, Bob ${dp[1].n} in ${dp[1].s.toFixed(0)} s (sent once a frame up to 30 a second; this machine draws a few frames a second)`);
assert.ok(dp[0].n > 20 && dp[1].n > 20, 'the place feed came');
await Promise.all([A, B].map((p) => p.waitForFunction(() => /WIN|LOSS/.test(document.querySelector('#dragslip h3')?.textContent || ''), null, { timeout: 25000 })));
const va = (await state(A)).slipText.split('\n')[0], vb = (await state(B)).slipText.split('\n')[0];
console.log('Ann:', va, JSON.stringify(ra.res));
console.log('Bob:', vb, JSON.stringify(rb.res));
assert.ok(/WIN/.test(va) !== /WIN/.test(vb), 'one wins, the other loses');
const aWon = !ra.res.dnf && (rb.res.dnf || ra.res.tot < rb.res.tot);
assert.ok(!ra.res.dnf && !rb.res.dnf, 'both ran the quarter mile');
const slipB = (await state(A)).slipText;
assert.ok(!/\t–/.test(slipB.split('\n').filter((l) => /FT|MILE/.test(l)).join('\n')), `every split of the other car on the timeslip:\n${slipB}`);
assert.equal(/WIN/.test(va), aWon, 'the first over the line wins');
if (shots) await A.screenshot({ path: `${shots}/drag-duel-slip.png` });
console.log('OK: the line, the tree, a false start, a practice run and a race of two');
await browser.close();
