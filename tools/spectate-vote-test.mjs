// A spectator votes to start a race (Martin, 2026-11-24: "allow me to vote for start when i am watching").
// Needs the game and its server on :8787 (npx wrangler dev --port 8787) and Playwright.
// Usage: node tools/spectate-vote-test.mjs
// A watches B past the 30 s a page off the map still counts as a driver, presses 1: the vote is in (2 needed,
// A counted with it); B presses 1: the race starts with both, and at the grid A is back in their own car on it.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (car, name) => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('PAGEERR', name, e.message));
  await p.addInitScript((n) => { localStorage.setItem('kvissuroam.name', n); }, name);
  await p.goto('http://localhost:8787/?q=low&trees=old');
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  await p.evaluate(() => { const r = __game.renderer; r.realRender = r.render; r.render = () => {}; });
  return [b, p];
};
const key = (p, code) => p.evaluate((c) => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true })); }, code);
const ok = (cond, what) => { console.log(cond ? 'PASS' : 'FAIL', what); if (!cond) process.exitCode = 1; };

const [ba, A] = await open('w201', 'Watcher');
const [bb, B] = await open('m3', 'Driver');
await A.waitForTimeout(4000);
await A.waitForFunction(() => document.querySelector('#people .who li[data-id]'), null, { timeout: 30000 });
await A.click('#people .who li[data-id]');
await A.waitForFunction(() => __game.watch().view, null, { timeout: 120000 });
console.log('watching; waiting past the 30 s grace', process.uptime() | 0);
await A.waitForTimeout(34000);
const idA = await A.evaluate(() => __game.mp().id);
const sub = (p) => p.evaluate(() => document.querySelector('#rsub')?.textContent || '');
console.log('A line before', await sub(A));
await key(A, 'Digit1');
await A.waitForTimeout(2500);
const la = await sub(A), lb = await sub(B);
console.log('A line', la, '| B line', lb);
ok(/1 \/ 2/.test(la) && /1 \/ 2/.test(lb), 'spectator vote counted, 1 / 2 on both pages');
ok(await A.evaluate(() => !!__game.watch().id), 'A still watching after the vote');
await key(B, 'Digit1');
await B.waitForTimeout(2500);
const btnA = await A.evaluate(() => document.querySelector('#rbtn')?.textContent || '');
console.log('A button', btnA);
ok(/IN|GRID/.test(btnA), 'race on with A in it');
const back = await A.waitForFunction(() => !__game.watch().id && __game.raceMode().holding, null, { timeout: 30000 }).then(() => true, () => false);
ok(back, 'A back in own car on the grid');
await ba.close(); await bb.close();
