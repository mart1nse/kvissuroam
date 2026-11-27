// The mark of what a lap record was driven with, beside the name of its replay (Martin 27 Nov: "if i watch a lap
// record replay, show in small the controller icon too somewhere for info"; src/spectate.js, the record's `inp` from
// the board in multiplayer.js loadReplay). With a real record lap from the live site: for each kind (keyboard,
// gamepad, wheel, touch screen) the board says the record was driven with, the watch bar shows that mark with its
// name; a record with no kind kept shows none. A picture of the bar with a folder given.
// Run with the dev server on 5198: node tools/replay-device-test.mjs [folder for pictures]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = 'http://localhost:5198', dir = process.argv[2] || '';
const LIVE = 'https://www.linnaring.com';
let bad = 0;
const check = (name, ok, note = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  (${note})` : ''}`); if (!ok) bad++; };

const board = await (await fetch(`${LIVE}/api/board`)).json();
const TRACK = 'toomemagi', CAR = Object.keys(board.rp?.[TRACK] || {})[0];
if (!CAR) { console.log('FAIL no replay on the live board'); process.exit(1); }
const rpRes = await fetch(`${LIVE}/api/replay?track=${TRACK}&car=${CAR}`);
const rpBody = Buffer.from(await rpRes.arrayBuffer()), rpHead = { 'content-type': 'application/octet-stream', 'x-ms': rpRes.headers.get('x-ms'), 'x-name': rpRes.headers.get('x-name') };
const ms = Number(rpHead['x-ms']);
console.log(`     replay: ${TRACK} ${CAR} ${ms} ms by ${decodeURIComponent(rpHead['x-name'])}`);
// the board as it would be with the record driven with each kind
const withInp = (inp) => ({ ...board, allTime: board.allTime.map((r) => (r.car === CAR && r.ms === ms ? { ...r, inp } : r)),
  today: (board.today || []).map((r) => (r.car === CAR && r.ms === ms ? { ...r, inp } : r)), recent: (board.recent || []).map((r) => (r.car === CAR && r.ms === ms ? { ...r, inp } : r)) });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dir ? 2 : 1 });
let now = withInp('pad');
await ctx.route('**/api/board', (r) => r.fulfill({ json: now }));
await ctx.route('**/api/top?**', (r) => r.fulfill({ json: {} }));
await ctx.route('**/api/replay?**', (r) => r.fulfill({ status: 200, headers: rpHead, body: rpBody }));
const p = await ctx.newPage();
p.on('pageerror', (e) => check(`no page error: ${e.message}`, false));
await p.goto(`${base}/?off=100&q=low&trees=old&lite=1&hidden=1`, { timeout: 180000 });
await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
await p.evaluate(() => __game.startDriving());
await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying && __game.mp().board?.rp, null, { timeout: 120000 });

const WANT = { kb: 'DRIVEN WITH A KEYBOARD', pad: 'DRIVEN WITH A GAMEPAD', wheel: 'DRIVEN WITH A WHEEL', touch: 'DRIVEN WITH A TOUCH SCREEN', '': '' };
for (const k of ['pad', 'wheel', 'kb', 'touch', '']) {
  now = withInp(k || null);
  await p.evaluate(async (b) => { const mp = __game.mp(); for (const r of [...(mp.board.allTime || [])]) if (r.car === b.car && r.ms === b.ms) r.inp = b.inp; }, { car: CAR, ms, inp: k || null });
  await p.evaluate(([t, c]) => __game.watchReplay(t, c), [TRACK, CAR]);
  await p.waitForFunction(() => !document.querySelector('#watch').classList.contains('hidden') && __game.mp().replay, null, { timeout: 60000 });
  await p.waitForTimeout(700);   // (the bar's words are set every quarter second)
  const got = await p.evaluate(() => ({ title: document.querySelector('#watch .who .dev svg title')?.textContent || '', shown: getComputedStyle(document.querySelector('#watch .who .dev')).display !== 'none',
    w: document.querySelector('#watch .who .dev svg')?.getBoundingClientRect().width || 0, st: document.querySelector('#watch .who .st').textContent }));
  check(`${k || 'none kept'}: ${WANT[k] ? `mark "${WANT[k]}"` : 'no mark'}`, got.title === WANT[k] && got.shown === !!WANT[k] && (!WANT[k] || (got.w > 8 && got.w < 30)), `${JSON.stringify(got)}`);
  if (dir && k === 'pad') {
    await p.evaluate(() => { const r = __game.renderer; r.realRender?.(__game.scene, __game.camera); });
    const b = await p.locator('#watch').boundingBox();
    await p.screenshot({ path: `${dir}/replay-device-bar.png`, clip: { x: 0, y: Math.max(0, b.y - 10), width: 1280, height: Math.min(140, b.height + 20) } });
  }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
}
await browser.close();
console.log(bad ? `${bad} FAILED` : 'all ok');
process.exit(bad ? 1 : 0);
