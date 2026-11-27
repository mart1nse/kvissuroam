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
    slipText: document.querySelector('#dragslip').innerText, verdict: document.querySelector('#dragslip h3')?.textContent || '', panel: document.querySelector('#drag').innerText, toast: document.querySelector('#toast')?.textContent || '' };
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
// the runway's crown kept under the lanes (Martin 27 Nov: the tilt makes the launch and holding the lane count)
const tilt = await A.evaluate(() => {
  const D = __game.drag().strip.frame, w = __game.world, h = (d, v) => w.heightAt(...D.at(d, v));
  let across = 0;
  for (let d = -10; d <= 440; d += 10) for (const v of [5.5, -5.5]) across = Math.max(across, Math.abs(h(d, v + 2.5) - h(d, v - 2.5)) / 5);
  return across * 100;
});
console.log(`across a lane: the runway's crown up to ${tilt.toFixed(2)} %`);
assert.ok(tilt > 0.3, 'the crown is there');
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
// waiting on the line (Martin 27 Nov): the view rises and looks slowly round, our car and the other lane's spot in it
await A.waitForFunction(() => __game.camera.position.y - __game.car.y > 4, null, { timeout: 60000 });
await A.waitForTimeout(4000);                    // (all the way up)
const seen = [];
for (let i = 0; i < 4; i++) {
  seen.push(await A.evaluate(() => {
    const c = __game.camera, w = __game.drag().waitView, V = c.position.constructor, y = __game.car.y + 0.6;
    return [new V(w.ox, y, w.oz).project(c), new V(w.x, y, w.z).project(c)].flatMap((p) => [+p.x.toFixed(2), +p.y.toFixed(2)]);
  }));
  await A.waitForTimeout(1500);
}
console.log('waiting view, the other lane\'s spot and ours on screen (-1..1):', JSON.stringify(seen));
assert.ok(seen.every((p) => p.every((v) => Math.abs(v) < 0.9) && p[1] > -0.15 && p[3] > -0.15), 'both lanes in the picture while waiting, above the map and the question');
if (shots) await A.screenshot({ path: `${shots}/drag-waiting.png` });
// a false start
await A.keyboard.press('p');
await A.waitForFunction(() => __game.drag().phase === 'tree', null, { timeout: 8000 });
s = await run(A, 1.2);
console.log('false start:', s.verdict, '| R/T', s.res.rt?.toFixed(3));
assert.ok(s.res.red && s.res.rt < 0, 'a red light');
assert.ok(s.slip, 'timeslip shown');
// R: back on the line at once
await A.keyboard.press('r');
await A.waitForFunction(() => __game.drag().phase === 'line' && __game.drag().lanes.some((l) => l?.id === __game.mp().id), null, { timeout: 15000 });
s = await state(A); assert.ok(s.neutral && !s.slip, 'back on the line in neutral');
// a clean practice run (and the view back down behind the car by green: where it is then, above the car)
await A.keyboard.press('p');
await A.waitForFunction(() => __game.drag().phase === 'tree', null, { timeout: 8000 });
await A.evaluate(() => { window.__camGo = null; const f = () => { const d = __game.drag(); if (d.phase === 'tree' && performance.now() < d.go) requestAnimationFrame(f); else window.__camGo = __game.camera.position.y - __game.car.y; }; requestAnimationFrame(f); });
s = await run(A);
const camGo = await A.evaluate(() => window.__camGo);
console.log(`the view at green: ${camGo?.toFixed(2)} m over the car`);
assert.ok(camGo != null && camGo < 3.3, 'the usual driving view by green');
console.log('practice:', JSON.stringify(s.res));
assert.ok(!s.res.red && !s.res.dnf && s.res.et > 8 && s.res.et < 25 && s.res.vq > 100, 'a clean quarter mile');
for (const k of ['t60', 't330', 't8', 'v8', 't1000']) assert.ok(Number.isFinite(s.res[k]), `${k} timed`);
assert.ok(s.res.t60 < s.res.t330 && s.res.t330 < s.res.t8 && s.res.t8 < s.res.t1000 && s.res.t1000 < s.res.et, 'splits in order');
// (as on a real slip: the reaction from green to the car leaving the stage beam, the ET from there; R/T + ET under them)
assert.ok(Math.abs(s.res.tot - (s.res.rt + s.res.et)) < 1e-6, 'R/T + ET is the total');
assert.ok(/R\/T \+ ET\s+[\d.]+/.test(s.slipText), `R/T + ET on the slip:\n${s.slipText}`);
console.log(s.slipText.replace(/\n+/g, ' | '));
if (shots) await A.screenshot({ path: `${shots}/drag-slip.png` });
// the slip stays up until its ✕ (Martin 27 Nov): a click elsewhere folds it into the TIMESLIP tab on the right edge,
// and the tab opens it again with BACK TO THE LINE
await A.waitForTimeout(1500);
assert.ok((await state(A)).slip, 'the slip stays up');
const vp = A.viewportSize();
const folded = () => A.waitForFunction(() => document.querySelector('#dragslip').classList.contains('hidden') && !document.querySelector('#dragsliptab').classList.contains('hidden'), null, { timeout: 5000 });
await A.mouse.click(Math.round(vp.width * 0.3), Math.round(vp.height * 0.55));
await folded();
if (shots) await A.screenshot({ path: `${shots}/drag-slip-folded.png` });
await A.click('#dragsliptab .open');
await A.waitForFunction(() => !document.querySelector('#dragslip').classList.contains('hidden') && document.querySelector('#dragsliptab').classList.contains('hidden'), null, { timeout: 5000 });
assert.ok(await A.evaluate(() => !!document.querySelector('#dragslip [data-drag="again"]') && /R\/T \+ ET/.test(document.querySelector('#dragslip').innerText)), 'the same slip again, with its button');
await A.mouse.click(Math.round(vp.width * 0.3), Math.round(vp.height * 0.55));
await folded();
console.log('slip: stays, folds on a click elsewhere, opens again from its tab');
// the slip folded after the run: one clean button back onto the line, R beside it (Martin 27 Nov)
assert.ok(await A.evaluate(() => !document.querySelector('#dragback').classList.contains('hidden') && /BACK TO THE LINE\s*R/.test(document.querySelector('#dragback').textContent)), 'BACK TO THE LINE after the run');
if (shots) await A.screenshot({ path: `${shots}/drag-back-button.png` });
// on the board (Martin 27 Nov: the strip's own tab on LAP TIMES): the server took the clean run, and the Ülenurme tab
// has it in its car's row, as ET in seconds
const etMs = Math.round(s.res.et * 1000), carId = await A.evaluate(() => __game.car.spec.id);
// (asked in a loop: waitForFunction does not wait for an async function's answer, a promise passes at once)
for (let i = 0; ; i++) {
  const on = await A.evaluate(async ([c, ms]) => ((await (await fetch('/api/board')).json()).drag?.allTime || []).some((r) => r.car === c && Math.abs(r.ms - ms) <= 2 && r.name === 'Ann'), [carId, etMs]);
  if (on) break;
  assert.ok(i < 20, 'the server took the clean run for the board');
  await A.waitForTimeout(1000);
}
await A.evaluate(() => { __game.board().show(); document.querySelector('#board [data-tab="drag"]').click(); });
await A.waitForFunction((t) => document.querySelector('#board .bcol .ev')?.textContent.includes(t), (etMs / 1000).toFixed(3), { timeout: 10000 }).catch(() => {});
const tabText = await A.evaluate(() => [document.querySelector('#board .btabs').innerText, document.querySelector('#board .bcol').innerText]);
console.log('LAP TIMES tabs:', tabText[0].replace(/\s+/g, ' '));
assert.ok(/ÜLENURME/.test(tabText[0]) && /TOOMEMÄGI/.test(tabText[0]) && /MAJORAADI/.test(tabText[0]), 'a tab a track');
assert.ok(tabText[1].includes((etMs / 1000).toFixed(3)) && /Ann/.test(tabText[1]), `the run on the Ülenurme tab:\n${tabText[1].slice(0, 600)}`);
if (shots) await A.screenshot({ path: `${shots}/drag-board.png` });
await A.evaluate(() => __game.board().hide());
// the boxes after a run (Martin 27 Nov): back into the lane's box, the car is on the line again (the car moved there by
// hand, as driving back the quarter mile would take this machine minutes)
await A.evaluate(() => {
  const D = __game.drag().strip.frame, c = __game.car, w = __game.world, [x, z] = D.at(-6, 5.5), [x2, z2] = D.at(4, 5.5);
  c.x = x; c.z = z; c.yaw = Math.atan2(x2 - x, -(z2 - z)); c.y = c.hy = w.heightAt(x, z) + 0.05; c.vx = c.vy = c.yawRate = 0; c.lastGround = null; c.airborne = false;
});
await A.waitForFunction(() => __game.drag().phase === 'line' && __game.drag().lanes.some((l) => l?.id === __game.mp().id), null, { timeout: 30000 });
console.log('after the run: into the box, on the line again');
// H at the strip: off the line (Backspace), then H puts the car back on it
await A.keyboard.press('Backspace');
await A.waitForFunction(() => __game.drag().phase === 'off', null, { timeout: 10000 });
await A.keyboard.press('h');
await A.waitForFunction(() => __game.drag().phase === 'line' && __game.drag().lanes.some((l) => l?.id === __game.mp().id), null, { timeout: 30000 });
console.log('H at the strip: on the line again');
// and from anywhere within 2 km of it (Martin 27 Nov: a car rolled out past the end after a quick run was taken to Toomemägi)
await A.keyboard.press('Backspace');
await A.waitForFunction(() => __game.drag().phase === 'off', null, { timeout: 10000 });
await A.evaluate(() => { const D = __game.drag().strip.frame, c = __game.car, w = __game.world, [x, z] = D.at(1400, 40); c.x = x; c.z = z; c.y = c.hy = w.heightAt(x, z) + 0.05; c.vx = c.vy = 0; c.lastGround = null; });
await A.keyboard.press('h');
await A.waitForFunction(() => __game.drag().phase === 'line' && __game.drag().lanes.some((l) => l?.id === __game.mp().id), null, { timeout: 60000 });
console.log('H 1.2 km from the strip: on the line again');
// the folded slip goes with the car (Martin 27 Nov: "it needs to survive moving between worlds"): not in a lane, there
// at Toomemägi, and only its ✕ puts it away; then back into the lane for the race of two
assert.ok(await A.evaluate(() => document.querySelector('#dragsliptab').classList.contains('hidden') && document.querySelector('#dragback').classList.contains('hidden')), 'no tab or button in a lane');
await A.keyboard.press('Backspace');
await A.waitForFunction(() => __game.drag().phase === 'off', null, { timeout: 10000 });
// out of the lane at the strip after a run: the button, H beside it, puts the car on the line
await A.waitForFunction(() => !document.querySelector('#dragback').classList.contains('hidden') && /H/.test(document.querySelector('#dragback kbd')?.textContent || ''), null, { timeout: 5000 });
await A.click('#dragback');
await A.waitForFunction(() => __game.drag().phase === 'line' && __game.drag().lanes.some((l) => l?.id === __game.mp().id), null, { timeout: 30000 });
console.log('BACK TO THE LINE button: on the line again');
await A.keyboard.press('Backspace');
await A.waitForFunction(() => __game.drag().phase === 'off', null, { timeout: 10000 });
await A.evaluate(() => document.querySelector('[data-act="track-toome"]').click());
await A.waitForFunction(() => !__game.drag().here && !document.querySelector('#dragsliptab').classList.contains('hidden'), null, { timeout: 60000 });
if (shots) await A.screenshot({ path: `${shots}/drag-slip-tab-toomemagi.png` });
await A.click('#dragsliptab .x');
await A.waitForFunction(() => document.querySelector('#dragsliptab').classList.contains('hidden') && document.querySelector('#dragslip').classList.contains('hidden'), null, { timeout: 5000 });
await A.waitForTimeout(500);
assert.ok(await A.evaluate(() => document.querySelector('#dragsliptab').classList.contains('hidden')), 'put away by its ✕');
console.log('slip tab: at Toomemägi too, gone after its ✕');
await toLine(A);
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
console.log('Ann:', JSON.stringify(ra.res));
console.log('Bob:', JSON.stringify(rb.res));
assert.ok(dp[0].n > 20 && dp[1].n > 20, 'the place feed came');
await Promise.all([A, B].map((p) => p.waitForFunction(() => /WIN|LOSS/.test(document.querySelector('#dragslip h3')?.textContent || ''), null, { timeout: 25000 })));
const va = (await state(A)).verdict, vb = (await state(B)).verdict;
console.log('Ann:', va, '| Bob:', vb);
assert.ok(/WIN/.test(va) !== /WIN/.test(vb), 'one wins, the other loses');
// (red light loses, then out of lane, then no time, then reaction + run: the crown can take a car out of its lane)
const bad = (r) => (r.red ? 3 : 0) + (r.foul ? 2 : 0) + (r.dnf ? 1 : 0);
const aWon = bad(ra.res) < bad(rb.res) || (bad(ra.res) === bad(rb.res) && !ra.res.dnf && ra.res.tot < rb.res.tot);
assert.ok(!ra.res.dnf && !rb.res.dnf, 'both ran the quarter mile');
const slipB = (await state(A)).slipText;
assert.ok(!/\t–/.test(slipB.split('\n').filter((l) => /FT|MILE/.test(l)).join('\n')), `every split of the other car on the timeslip:\n${slipB}`);
assert.equal(/WIN/.test(va), aWon, 'the verdict by the rules');
if (shots) await A.screenshot({ path: `${shots}/drag-duel-slip.png` });
console.log('OK: the line, the tree, a false start, a practice run and a race of two');
await browser.close();
