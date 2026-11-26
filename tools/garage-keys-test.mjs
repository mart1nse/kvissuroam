// The garage's keys and the name box (src/race/board.js, buildMenu in src/main.js; Martin 26 Nov: back in the
// garage the name was picked again, so a shortcut key was typed into it instead of doing its work).
// Checks on a desktop: the name is picked on the first garage only and the arrows still switch cars there; back
// from a drive nothing is picked, L opens and closes the lap times, G goes back to the car (and the G press that
// opened the garage does not close it again), the name is left as it was; a click into the name types as before.
// Run with the dev server on 5198: node tools/garage-keys-test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = 'http://localhost:5198';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = true;
const fail = (m) => { ok = false; console.log('  FAIL', m); };
const until = (p, fn, ms) => p.waitForFunction(fn, null, { timeout: ms, polling: 100 }).then(() => true, () => false);
const state = (p) => p.evaluate(() => {
  const n = document.querySelector('#drivername'), a = document.activeElement;
  return { mode: __game.mode, name: n.value, focus: a === n ? 'name' : a?.id || a?.tagName, picked: a === n && n.selectionStart === 0 && n.selectionEnd === n.value.length,
    fresh: n.closest('.field').classList.contains('fresh'), car: document.querySelector('#drivecar').textContent, board: !document.querySelector('#board').classList.contains('hidden') };
});

const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => fail(`page error: ${e.message}`));
await p.goto(`${base}/?off=100&q=low&trees=old&lite=1`, { timeout: 180000 });
await p.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
// (drawing without a graphics card takes seconds a frame: nothing here needs a picture)
await p.evaluate(() => { __game.renderer.render = () => {}; });

console.log('first garage');
if (!(await until(p, () => __game.mode === 'menu' && document.activeElement?.id === 'drivername', 20000))) fail('the name is not picked on the first garage');
let s = await state(p);
const name = s.name;
if (!s.picked || !s.fresh || !name) fail(`the name is not selected whole: ${JSON.stringify(s)}`);
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(600);
let t = await state(p);
if (t.car === s.car) fail('the arrows do not switch cars while the name is picked');
if (!t.picked || t.name !== name) fail(`the name lost its pick to an arrow: ${JSON.stringify(t)}`);
await p.keyboard.press('Enter');
if (!(await until(p, () => __game.mode === 'drive', 60000))) fail('Enter did not start the drive');
s = await state(p);
if (s.focus === 'name') fail('the name still holds the keys while driving');

console.log('back in the garage');
await p.waitForTimeout(500);
await p.keyboard.press('KeyG');
await p.waitForTimeout(800);
s = await state(p);
if (s.mode !== 'menu') fail(`G did not open the garage (or the same press closed it): ${JSON.stringify(s)}`);
if (s.focus === 'name' || s.fresh) fail(`the name is picked again: ${JSON.stringify(s)}`);
await p.keyboard.press('KeyL');
await p.waitForTimeout(300);
t = await state(p);
if (!t.board || t.name !== name) fail(`L did not open the lap times: ${JSON.stringify(t)}`);
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(400);
if ((await state(p)).car !== t.car) fail('an arrow switched cars under the lap times');
await p.keyboard.press('KeyL');
await p.waitForTimeout(300);
t = await state(p);
if (t.board || t.mode !== 'menu') fail(`L did not close the lap times: ${JSON.stringify(t)}`);
await p.keyboard.press('ArrowLeft');
await p.waitForTimeout(600);
if ((await state(p)).car === t.car) fail('the arrows do not switch cars');
await p.keyboard.press('Meta+KeyL');
await p.keyboard.press('Control+KeyL');
await p.waitForTimeout(300);
if ((await state(p)).board) fail('the browser\'s own Ctrl / Cmd + L opened the lap times');
await p.keyboard.press('KeyG');
if (!(await until(p, () => __game.mode === 'drive', 60000))) fail('G did not go back to the car');
t = await state(p);
if (t.name !== name) fail(`the name changed: ${t.name} (was ${name})`);

console.log('typing a name after a click');
await p.waitForTimeout(500);
await p.keyboard.press('Escape');
await p.waitForTimeout(800);
if ((await state(p)).mode !== 'menu') fail('Esc did not open the garage');
await p.click('#drivername');
await p.keyboard.press('End');
await p.keyboard.type('gl');
await p.waitForTimeout(300);
t = await state(p);
if (t.name !== `${name}gl`.slice(0, 20) || t.mode !== 'menu' || t.board) fail(`typing into the name went wrong: ${JSON.stringify(t)}`);
await p.keyboard.press('Backspace');
await p.keyboard.press('Backspace');
await p.keyboard.press('Enter');
await p.waitForTimeout(300);
t = await state(p);
if (t.focus === 'name' || t.mode !== 'menu') fail(`Enter in the name did not just leave it: ${JSON.stringify(t)}`);

console.log(ok ? 'garage keys ok' : 'garage keys WRONG');
await browser.close();
process.exit(ok ? 0 : 1);
